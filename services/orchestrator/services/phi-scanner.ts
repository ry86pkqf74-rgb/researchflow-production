import crypto from "crypto";
import { PHI_PATTERNS, type PatternDefinition } from "@researchflow/phi-engine";

export type PHICategory =
  | 'name'
  | 'date'
  | 'ssn'
  | 'phone'
  | 'email'
  | 'address'
  | 'mrn'
  | 'account_number'
  | 'license_number'
  | 'vehicle_id'
  | 'device_id'
  | 'url'
  | 'ip_address'
  | 'biometric'
  | 'photo'
  | 'geographic'
  | 'age_over_89'
  | 'other';

export type RiskLevel = 'none' | 'low' | 'medium' | 'high';
export type ScanContext = 'upload' | 'export';

export interface PHIPattern {
  id: string;
  category: PHICategory;
  pattern: string;
  matchedText: string;
  position: { start: number; end: number };
  confidence: number;
  suggestedAction: 'redact' | 'review' | 'remove';
  hipaaIdentifier: string;
}

export interface PHIScanResult {
  scanId: string;
  scannedAt: string;
  context: ScanContext;
  contentLength: number;
  detected: PHIPattern[];
  riskLevel: RiskLevel;
  requiresOverride: boolean;
  summary: {
    totalPatterns: number;
    byCategory: Record<string, number>;
    highConfidenceCount: number;
  };
}

export interface PHIOverrideRequest {
  scanId: string;
  justification: string;
  approverRole: string;
}

export interface PHIOverrideResult {
  approved: boolean;
  auditId: string;
  reviewedAt: string;
  reviewedBy: string;
  expiresAt?: string;
  conditions?: string[];
}

const scanStore = new Map<string, PHIScanResult>();
const overrideStore = new Map<string, PHIOverrideResult>();

/**
 * Map phi-engine type to orchestrator PHICategory
 */
function mapPhiTypeToCategory(type: PatternDefinition['type']): PHICategory {
  const typeMap: Record<PatternDefinition['type'], PHICategory> = {
    'SSN': 'ssn',
    'MRN': 'mrn',
    'DOB': 'date',
    'PHONE': 'phone',
    'EMAIL': 'email',
    'NAME': 'name',
    'ADDRESS': 'address',
    'ZIP_CODE': 'geographic',
    'IP_ADDRESS': 'ip_address',
    'URL': 'url',
    'ACCOUNT': 'account_number',
    'HEALTH_PLAN': 'other',
    'LICENSE': 'license_number',
    'DEVICE_ID': 'device_id',
    'AGE_OVER_89': 'age_over_89'
  };
  return typeMap[type] || 'other';
}

function calculateConfidence(baseConfidence: number, matchedText: string): number {
  let confidence = baseConfidence;

  if (matchedText.length > 5) confidence += 0.1;
  if (matchedText.length > 10) confidence += 0.05;

  if (/\d/.test(matchedText) && /[A-Za-z]/.test(matchedText)) {
    confidence += 0.05;
  }

  return Math.min(0.99, confidence);
}

function determineRiskLevel(patterns: PHIPattern[]): RiskLevel {
  if (patterns.length === 0) return 'none';
  
  const highConfidencePatterns = patterns.filter(p => p.confidence >= 0.85);
  const criticalCategories: PHICategory[] = ['ssn', 'mrn', 'name', 'address'];
  const hasCritical = patterns.some(p => criticalCategories.includes(p.category));
  
  if (highConfidencePatterns.length >= 5 || (hasCritical && patterns.length >= 3)) {
    return 'high';
  }
  if (patterns.length >= 3 || highConfidencePatterns.length >= 2) {
    return 'medium';
  }
  return 'low';
}

function determineSuggestedAction(category: PHICategory, confidence: number): 'redact' | 'review' | 'remove' {
  const criticalCategories: PHICategory[] = ['ssn', 'mrn', 'name', 'address', 'phone'];
  
  if (criticalCategories.includes(category) && confidence >= 0.8) {
    return 'redact';
  }
  if (confidence >= 0.7) {
    return 'review';
  }
  return 'remove';
}

export function scanForPHI(content: string, context: ScanContext): PHIScanResult {
  const scanId = crypto.randomUUID();
  const detected: PHIPattern[] = [];

  for (const patternDef of PHI_PATTERNS) {
    // Clone regex to reset lastIndex for each scan
    const regex = new RegExp(patternDef.regex.source, patternDef.regex.flags);

    let match;
    while ((match = regex.exec(content)) !== null) {
      const category = mapPhiTypeToCategory(patternDef.type);
      const confidence = calculateConfidence(patternDef.baseConfidence, match[0]);

      detected.push({
        id: crypto.randomUUID(),
        category,
        pattern: patternDef.description,
        // Redact matched text to prevent PHI leakage in scan results
        matchedText: '[REDACTED]',
        position: { start: match.index, end: match.index + match[0].length },
        confidence: Math.round(confidence * 100) / 100,
        suggestedAction: determineSuggestedAction(category, confidence),
        hipaaIdentifier: patternDef.hipaaCategory
      });
    }
  }

  const byCategory: Record<string, number> = {};
  for (const pattern of detected) {
    byCategory[pattern.category] = (byCategory[pattern.category] || 0) + 1;
  }

  const riskLevel = determineRiskLevel(detected);
  const requiresOverride = context === 'export' && riskLevel !== 'none';

  const result: PHIScanResult = {
    scanId,
    scannedAt: new Date().toISOString(),
    context,
    contentLength: content.length,
    detected,
    riskLevel,
    requiresOverride,
    summary: {
      totalPatterns: detected.length,
      byCategory,
      highConfidenceCount: detected.filter(p => p.confidence >= 0.85).length
    }
  };

  scanStore.set(scanId, result);
  
  return result;
}

export function requestPHIOverride(request: PHIOverrideRequest): PHIOverrideResult {
  const scan = scanStore.get(request.scanId);
  
  if (!scan) {
    throw new Error(`Scan not found: ${request.scanId}`);
  }

  const auditId = crypto.randomUUID();
  
  const validRoles = ['STEWARD', 'ADMIN', 'IRB_OFFICER', 'COMPLIANCE_OFFICER'];
  const approved = validRoles.includes(request.approverRole.toUpperCase()) 
    && request.justification.length >= 20;

  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + 24);

  const result: PHIOverrideResult = {
    approved,
    auditId,
    reviewedAt: new Date().toISOString(),
    reviewedBy: request.approverRole,
    expiresAt: approved ? expiresAt.toISOString() : undefined,
    conditions: approved ? [
      'Export must be logged to audit trail',
      'Data must be encrypted in transit',
      'Recipient must have signed DUA',
      'Override valid for 24 hours only'
    ] : undefined
  };

  overrideStore.set(auditId, result);
  
  return result;
}

export function getScanResult(scanId: string): PHIScanResult | undefined {
  return scanStore.get(scanId);
}

export function getOverrideResult(auditId: string): PHIOverrideResult | undefined {
  return overrideStore.get(auditId);
}
