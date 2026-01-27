/**
 * PHI Scanner Utility
 *
 * Scans text for Protected Health Information (PHI) patterns.
 * Used by chat agents to enforce governance rules.
 */

export interface PHIScanResult {
  hasPHI: boolean;
  patterns: PHIPattern[];
  score: number;  // 0-1 confidence score
  redactedText?: string;
}

export interface PHIPattern {
  type: string;
  match: string;
  position: { start: number; end: number };
  confidence: number;
}

// PHI pattern definitions
const PHI_PATTERNS = [
  // Medical Record Numbers (MRN)
  { type: 'mrn', pattern: /\b(?:MRN|Medical Record|Patient ID)[:\s#]*(\d{5,12})\b/gi, confidence: 0.95 },
  { type: 'mrn', pattern: /\bMRN[-\s]?\d{6,10}\b/gi, confidence: 0.95 },

  // Social Security Numbers
  { type: 'ssn', pattern: /\b\d{3}[-\s]?\d{2}[-\s]?\d{4}\b/g, confidence: 0.9 },

  // Date of Birth (various formats)
  { type: 'dob', pattern: /\b(?:DOB|Date of Birth|Born)[:\s]*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})\b/gi, confidence: 0.9 },
  { type: 'dob', pattern: /\b(?:age|aged)\s+\d{1,3}\s*(?:years?|yo|y\.?o\.?)\b/gi, confidence: 0.7 },

  // Phone Numbers
  { type: 'phone', pattern: /\b\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g, confidence: 0.8 },

  // Email Addresses
  { type: 'email', pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, confidence: 0.85 },

  // Physical Addresses
  { type: 'address', pattern: /\b\d+\s+(?:[A-Za-z]+\s+){1,3}(?:Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Drive|Dr|Lane|Ln|Way|Court|Ct|Place|Pl)\b/gi, confidence: 0.75 },

  // IP Addresses
  { type: 'ip', pattern: /\b(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\b/g, confidence: 0.7 },

  // Names with titles (Dr., Mr., Mrs., etc.)
  { type: 'name', pattern: /\b(?:Dr\.|Mr\.|Mrs\.|Ms\.)\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?\b/g, confidence: 0.6 },

  // Patient names in clinical context
  { type: 'name', pattern: /\b(?:patient|pt\.?|subject)\s+(?:name)?[:\s]*[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?\b/gi, confidence: 0.8 },

  // Health Insurance Numbers
  { type: 'insurance', pattern: /\b(?:Policy|Insurance|Member)\s*(?:Number|ID|#)?[:\s]*[A-Z0-9]{8,15}\b/gi, confidence: 0.85 },

  // Account Numbers
  { type: 'account', pattern: /\b(?:Account|Acct)\s*(?:Number|#)?[:\s]*\d{8,12}\b/gi, confidence: 0.8 },

  // Fax Numbers
  { type: 'fax', pattern: /\b(?:Fax|FAX)[:\s]*\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/gi, confidence: 0.85 },

  // Prescription/DEA Numbers
  { type: 'prescription', pattern: /\b(?:DEA|NPI|Rx)\s*(?:Number|#)?[:\s]*[A-Z0-9]{9,10}\b/gi, confidence: 0.9 },

  // Dates within last 90 days context (could be admission dates)
  { type: 'admission_date', pattern: /\b(?:admitted|discharged|seen on|visit date)[:\s]*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})\b/gi, confidence: 0.85 },

  // Vehicle Information
  { type: 'vehicle', pattern: /\b(?:VIN|License Plate)[:\s#]*[A-Z0-9]{6,17}\b/gi, confidence: 0.75 },

  // Biometric Identifiers
  { type: 'biometric', pattern: /\b(?:fingerprint|retina|voice print|facial recognition)\s*(?:id|identifier)?[:\s]*[A-Z0-9]+\b/gi, confidence: 0.9 },
];

/**
 * Scan text for PHI patterns
 */
export function scanForPHI(text: string): PHIScanResult {
  const patterns: PHIPattern[] = [];
  let maxConfidence = 0;

  for (const { type, pattern, confidence } of PHI_PATTERNS) {
    const regex = new RegExp(pattern.source, pattern.flags);
    let match;

    while ((match = regex.exec(text)) !== null) {
      patterns.push({
        type,
        match: match[0],
        position: { start: match.index, end: match.index + match[0].length },
        confidence,
      });

      if (confidence > maxConfidence) {
        maxConfidence = confidence;
      }
    }
  }

  return {
    hasPHI: patterns.length > 0,
    patterns,
    score: maxConfidence,
    redactedText: patterns.length > 0 ? redactText(text, patterns) : undefined,
  };
}

/**
 * Redact PHI from text
 */
export function redactText(text: string, patterns: PHIPattern[]): string {
  // Sort patterns by position (descending) to replace from end to start
  const sorted = [...patterns].sort((a, b) => b.position.start - a.position.start);

  let result = text;
  for (const pattern of sorted) {
    const replacement = `[${pattern.type.toUpperCase()}_REDACTED]`;
    result = result.slice(0, pattern.position.start) + replacement + result.slice(pattern.position.end);
  }

  return result;
}

/**
 * Check if PHI should block the operation based on governance mode
 */
export function shouldBlockPHI(scanResult: PHIScanResult, governanceMode: 'DEMO' | 'LIVE'): boolean {
  if (!scanResult.hasPHI) {
    return false;
  }

  // In LIVE mode, block if PHI detected with high confidence
  if (governanceMode === 'LIVE' && scanResult.score >= 0.7) {
    return true;
  }

  return false;
}

/**
 * Get governance decision for PHI
 */
export function getGovernanceDecision(
  scanResult: PHIScanResult,
  governanceMode: 'DEMO' | 'LIVE'
): {
  allowed: boolean;
  reason: string;
  warning?: string;
} {
  if (!scanResult.hasPHI) {
    return { allowed: true, reason: 'No PHI detected' };
  }

  if (governanceMode === 'LIVE') {
    if (scanResult.score >= 0.7) {
      return {
        allowed: false,
        reason: `PHI detected (confidence: ${(scanResult.score * 100).toFixed(0)}%). Operation blocked in LIVE mode.`,
      };
    }
    return {
      allowed: true,
      reason: 'Low-confidence PHI patterns detected',
      warning: 'Potential PHI patterns found but confidence below threshold.',
    };
  }

  // DEMO mode
  return {
    allowed: true,
    reason: 'DEMO mode - PHI checks are advisory only',
    warning: `PHI detected (confidence: ${(scanResult.score * 100).toFixed(0)}%). Would be blocked in LIVE mode.`,
  };
}

export default {
  scanForPHI,
  redactText,
  shouldBlockPHI,
  getGovernanceDecision,
};
