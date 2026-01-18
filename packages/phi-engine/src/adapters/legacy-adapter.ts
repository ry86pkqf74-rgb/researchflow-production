/**
 * Legacy Adapter for Backward Compatibility
 *
 * Adapts the new PhiFinding[] format to the legacy PHIScanResult format
 * used by existing code in apps/api-node/services/phi-scanner.ts
 */

import crypto from 'crypto';
import type { PhiFinding, RiskLevel, ScanContext } from '../types';

// Legacy types from phi-scanner.ts
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

/**
 * Map new PHI types to legacy category names
 */
function mapToLegacyCategory(type: PhiFinding['type']): PHICategory {
  const mapping: Record<PhiFinding['type'], PHICategory> = {
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
  return mapping[type];
}

/**
 * Get HIPAA identifier for a PHI type
 */
function getHipaaIdentifier(type: PhiFinding['type']): string {
  const mapping: Record<PhiFinding['type'], string> = {
    'SSN': 'HIPAA 164.514(b)(2)(i)(E)',
    'MRN': 'HIPAA 164.514(b)(2)(i)(F)',
    'DOB': 'HIPAA 164.514(b)(2)(i)(B)',
    'PHONE': 'HIPAA 164.514(b)(2)(i)(C)',
    'EMAIL': 'HIPAA 164.514(b)(2)(i)(D)',
    'NAME': 'HIPAA 164.514(b)(2)(i)(A)',
    'ADDRESS': 'HIPAA 164.514(b)(2)(i)(B)',
    'ZIP_CODE': 'HIPAA 164.514(b)(2)(i)(B)',
    'IP_ADDRESS': 'HIPAA 164.514(b)(2)(i)(N)',
    'URL': 'HIPAA 164.514(b)(2)(i)(M)',
    'ACCOUNT': 'HIPAA 164.514(b)(2)(i)(H)',
    'HEALTH_PLAN': 'HIPAA 164.514(b)(2)(i)(G)',
    'LICENSE': 'HIPAA 164.514(b)(2)(i)(K)',
    'DEVICE_ID': 'HIPAA 164.514(b)(2)(i)(L)',
    'AGE_OVER_89': 'HIPAA 164.514(b)(2)(i)(C)'
  };
  return mapping[type];
}

/**
 * Determine suggested action based on category and confidence
 */
function determineSuggestedAction(
  category: PHICategory,
  confidence: number
): 'redact' | 'review' | 'remove' {
  const criticalCategories: PHICategory[] = ['ssn', 'mrn', 'name', 'address', 'phone'];

  if (criticalCategories.includes(category) && confidence >= 0.8) {
    return 'redact';
  }
  if (confidence >= 0.7) {
    return 'review';
  }
  return 'remove';
}

/**
 * Calculate risk level from findings
 * Ported from phi-scanner.ts:194-208
 */
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

/**
 * Convert PhiFinding[] to legacy PHIScanResult format
 *
 * @param findings - Array of PHI findings from new scanner
 * @param context - Scan context (upload, export, llm)
 * @param contentLength - Length of scanned content
 * @returns PHIScanResult in legacy format
 */
export function adaptToLegacyScanResult(
  findings: PhiFinding[],
  context: ScanContext,
  contentLength: number
): PHIScanResult {
  // Convert findings to legacy PHIPattern format
  const detected: PHIPattern[] = findings.map(finding => ({
    id: crypto.randomUUID(),
    category: mapToLegacyCategory(finding.type),
    pattern: finding.type,
    matchedText: finding.value,
    position: { start: finding.startIndex, end: finding.endIndex },
    confidence: finding.confidence,
    suggestedAction: determineSuggestedAction(
      mapToLegacyCategory(finding.type),
      finding.confidence
    ),
    hipaaIdentifier: getHipaaIdentifier(finding.type)
  }));

  // Build byCategory summary
  const byCategory: Record<string, number> = {};
  for (const pattern of detected) {
    byCategory[pattern.category] = (byCategory[pattern.category] || 0) + 1;
  }

  // Calculate risk level
  const riskLevel = determineRiskLevel(detected);

  // Determine if override required (export context with PHI)
  const requiresOverride = context === 'export' && riskLevel !== 'none';

  return {
    scanId: crypto.randomUUID(),
    scannedAt: new Date().toISOString(),
    context,
    contentLength,
    detected,
    riskLevel,
    requiresOverride,
    summary: {
      totalPatterns: detected.length,
      byCategory,
      highConfidenceCount: detected.filter(p => p.confidence >= 0.85).length
    }
  };
}
