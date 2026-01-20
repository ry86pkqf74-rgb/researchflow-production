/**
 * PHI Protection Service
 *
 * Provides PHI detection, redaction, and encryption utilities.
 * Uses @researchflow/phi-engine for pattern definitions - SINGLE SOURCE OF TRUTH.
 *
 * CRITICAL: All findings return hash + location only (no raw PHI).
 */

import { createCipheriv, createDecipheriv, randomBytes, createHash } from 'crypto';
import { PHI_PATTERNS, type PatternDefinition } from '@researchflow/phi-engine';

export interface PhiDetectionResult {
  detected: boolean;
  identifiers: PhiIdentifier[];
  riskLevel: 'NONE' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  summary: {
    totalMatches: number;
    uniqueTypes: number;
    criticalCount: number;
  };
}

export interface PhiIdentifier {
  type: string;
  /** SHA256 hash of matched value (first 12 chars) - never store raw PHI */
  valueHash: string;
  /** Length of the original matched value */
  valueLength: number;
  position: { start: number; end: number };
  confidence: 'LOW' | 'MEDIUM' | 'HIGH';
  hipaaCategory: string;
}

/**
 * Compute SHA256 hash of matched text, returning first 12 hex chars.
 * This allows deduplication without exposing raw PHI.
 */
function hashValue(text: string): string {
  return createHash('sha256').update(text).digest('hex').slice(0, 12);
}

/**
 * Map phi-engine type to confidence level
 */
function getConfidence(type: string, baseConfidence: number): 'LOW' | 'MEDIUM' | 'HIGH' {
  if (baseConfidence >= 0.8) return 'HIGH';
  if (baseConfidence >= 0.7) return 'MEDIUM';
  return 'LOW';
}

/**
 * Scan text for PHI identifiers using phi-engine patterns
 */
export function scanForPhi(text: string): PhiDetectionResult {
  const identifiers: PhiIdentifier[] = [];

  // Use phi-engine patterns (single source of truth)
  for (const patternDef of PHI_PATTERNS) {
    // Clone regex to reset lastIndex
    const regex = new RegExp(patternDef.regex.source, patternDef.regex.flags);

    let match;
    while ((match = regex.exec(text)) !== null) {
      const matchedValue = match[0];
      const valueLength = matchedValue.length;
      // Hash immediately, discard raw value
      const valueHash = hashValue(matchedValue);

      identifiers.push({
        type: patternDef.type,
        valueHash,
        valueLength,
        position: { start: match.index, end: match.index + valueLength },
        confidence: getConfidence(patternDef.type, patternDef.baseConfidence),
        hipaaCategory: patternDef.hipaaCategory,
      });
    }
  }

  const uniqueTypes = new Set(identifiers.map(i => i.type)).size;
  const criticalTypes = ['SSN', 'MRN', 'HEALTH_PLAN'];
  const criticalCount = identifiers.filter(i =>
    criticalTypes.includes(i.type)
  ).length;

  const riskLevel = calculateRiskLevel(identifiers.length, criticalCount);

  return {
    detected: identifiers.length > 0,
    identifiers,
    riskLevel,
    summary: {
      totalMatches: identifiers.length,
      uniqueTypes,
      criticalCount
    }
  };
}

/**
 * Redact PHI from text
 */
export function redactPhiInData(text: string, replacementChar = '*'): string {
  const result = scanForPhi(text);

  if (!result.detected) {
    return text;
  }

  let redacted = text;

  // Sort identifiers by position (descending) to avoid index shifting
  const sorted = [...result.identifiers].sort((a, b) =>
    b.position.start - a.position.start
  );

  for (const identifier of sorted) {
    const replacement = `[${identifier.type}_REDACTED]`;
    redacted =
      redacted.substring(0, identifier.position.start) +
      replacement +
      redacted.substring(identifier.position.end);
  }

  return redacted;
}

/**
 * Encrypt sensitive data with AES-256-GCM
 */
export function encryptData(plaintext: string, keyId: string): {
  encrypted: string;
  iv: string;
  authTag: string;
  keyId: string;
} {
  // In production, fetch key from secure key management service
  const key = process.env.ENCRYPTION_KEY || randomBytes(32);
  const iv = randomBytes(16);

  const cipher = createCipheriv('aes-256-gcm', key, iv);

  let encrypted = cipher.update(plaintext, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  const authTag = cipher.getAuthTag();

  return {
    encrypted,
    iv: iv.toString('hex'),
    authTag: authTag.toString('hex'),
    keyId
  };
}

/**
 * Decrypt sensitive data
 */
export function decryptData(
  encrypted: string,
  iv: string,
  authTag: string,
  keyId: string
): string {
  // In production, fetch key from secure key management service
  const key = process.env.ENCRYPTION_KEY || randomBytes(32);

  const decipher = createDecipheriv(
    'aes-256-gcm',
    key,
    Buffer.from(iv, 'hex')
  );

  decipher.setAuthTag(Buffer.from(authTag, 'hex'));

  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}

/**
 * Detect PHI fields in structured data
 */
export function detectPhiFields(data: Record<string, any>): string[] {
  const phiFields: string[] = [];

  const suspiciousFieldNames = [
    'ssn', 'social_security',
    'dob', 'date_of_birth', 'birthdate',
    'mrn', 'medical_record',
    'phone', 'telephone', 'mobile',
    'email', 'address',
    'name', 'first_name', 'last_name', 'full_name',
    'patient_id', 'member_id'
  ];

  for (const [key, value] of Object.entries(data)) {
    const lowerKey = key.toLowerCase();

    // Check field name
    if (suspiciousFieldNames.some(suspicious => lowerKey.includes(suspicious))) {
      phiFields.push(key);
      continue;
    }

    // Check field value if string
    if (typeof value === 'string') {
      const result = scanForPhi(value);
      if (result.detected && result.riskLevel !== 'NONE') {
        phiFields.push(key);
      }
    }
  }

  return phiFields;
}

/**
 * Calculate risk score for classification
 */
export function calculateRiskScore(phiFields: string[], classification: string): number {
  let score = 0;

  switch (classification) {
    case 'IDENTIFIED': score += 80; break;
    case 'DEIDENTIFIED': score += 30; break;
    case 'SYNTHETIC': score += 5; break;
    default: score += 50;
  }

  score += Math.min(phiFields.length * 5, 20);

  return Math.min(score, 100);
}

function calculateRiskLevel(
  totalMatches: number,
  criticalCount: number
): 'NONE' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' {
  if (totalMatches === 0) return 'NONE';
  if (criticalCount > 0) return 'CRITICAL';
  if (totalMatches >= 10) return 'HIGH';
  if (totalMatches >= 5) return 'MEDIUM';
  return 'LOW';
}
