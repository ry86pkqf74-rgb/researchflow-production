import { createCipheriv, createDecipheriv, randomBytes, createHash } from 'crypto';

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
  hipaaCategory: number; // 1-18
}

const PHI_PATTERNS = {
  // 1. Names - partial pattern (full names require NER)
  NAME: /\b[A-Z][a-z]+ [A-Z][a-z]+\b/g,

  // 2. Geographic - ZIP codes, addresses
  ZIP_CODE: /\b\d{5}(?:-\d{4})?\b/g,
  ADDRESS: /\b\d+\s+[A-Za-z\s]+(?:Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Lane|Ln|Drive|Dr|Court|Ct)\b/gi,

  // 3. Dates (specific dates, not just years)
  DATE_MDY: /\b(?:0?[1-9]|1[0-2])[-/](?:0?[1-9]|[12]\d|3[01])[-/](?:19|20)?\d{2}\b/g,
  DATE_DMY: /\b(?:0?[1-9]|[12]\d|3[01])[-/](?:0?[1-9]|1[0-2])[-/](?:19|20)?\d{2}\b/g,
  DATE_ISO: /\b(?:19|20)\d{2}-(?:0?[1-9]|1[0-2])-(?:0?[1-9]|[12]\d|3[01])\b/g,

  // 4-5. Phone and Fax
  PHONE: /\b(?:\+?1[-.\s]?)?\(?([0-9]{3})\)?[-.\s]?([0-9]{3})[-.\s]?([0-9]{4})\b/g,

  // 6. Email
  EMAIL: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,

  // 7. SSN
  SSN: /\b\d{3}-\d{2}-\d{4}\b/g,

  // 8. Medical Record Numbers (MRN)
  MRN: /\b(?:MRN|mrn)[\s:]*(\d{6,10})\b/gi,

  // 9. Health Plan Numbers
  HEALTH_PLAN: /\b(?:Member|Policy|Plan)[\s#:]*([A-Z0-9]{6,15})\b/gi,

  // 10. Account Numbers
  ACCOUNT: /\b(?:Account|Acct)[\s#:]*(\d{6,15})\b/gi,

  // 14. URLs
  URL: /https?:\/\/[^\s]+/g,

  // 15. IP Addresses
  IP_ADDRESS: /\b(?:\d{1,3}\.){3}\d{1,3}\b/g,
};

/**
 * Compute SHA256 hash of matched text, returning first 12 hex chars.
 * This allows deduplication without exposing raw PHI.
 */
function hashValue(text: string): string {
  return createHash('sha256').update(text).digest('hex').slice(0, 12);
}

/**
 * Scan text for PHI identifiers
 */
export function scanForPhi(text: string): PhiDetectionResult {
  const identifiers: PhiIdentifier[] = [];

  // Scan all patterns
  for (const [type, pattern] of Object.entries(PHI_PATTERNS)) {
    const matches = text.matchAll(pattern);

    for (const match of matches) {
      const matchedValue = match[0];
      const valueLength = matchedValue.length;
      // Hash immediately, discard raw value
      const valueHash = hashValue(matchedValue);

      identifiers.push({
        type,
        valueHash,
        valueLength,
        position: { start: match.index!, end: match.index! + valueLength },
        confidence: getConfidence(type),
        hipaaCategory: getHipaaCategory(type)
      });
    }
  }

  const uniqueTypes = new Set(identifiers.map(i => i.type)).size;
  const criticalCount = identifiers.filter(i =>
    ['SSN', 'MRN', 'HEALTH_PLAN'].includes(i.type)
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

// Helper functions
function getConfidence(type: string): 'LOW' | 'MEDIUM' | 'HIGH' {
  const highConfidence = ['SSN', 'EMAIL', 'IP_ADDRESS', 'URL'];
  const mediumConfidence = ['PHONE', 'MRN', 'HEALTH_PLAN'];

  if (highConfidence.includes(type)) return 'HIGH';
  if (mediumConfidence.includes(type)) return 'MEDIUM';
  return 'LOW';
}

function getHipaaCategory(type: string): number {
  const mapping: Record<string, number> = {
    'NAME': 1,
    'ZIP_CODE': 2,
    'ADDRESS': 2,
    'DATE_MDY': 3,
    'DATE_DMY': 3,
    'DATE_ISO': 3,
    'PHONE': 4,
    'EMAIL': 6,
    'SSN': 7,
    'MRN': 8,
    'HEALTH_PLAN': 9,
    'ACCOUNT': 10,
    'URL': 14,
    'IP_ADDRESS': 15,
  };

  return mapping[type] || 18; // 18 = other unique identifier
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
