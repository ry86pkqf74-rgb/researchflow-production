import crypto from "crypto";

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

const PHI_PATTERNS: Array<{
  category: PHICategory;
  regex: RegExp;
  hipaaIdentifier: string;
  description: string;
}> = [
  {
    category: 'ssn',
    regex: /\b\d{3}[-\s]?\d{2}[-\s]?\d{4}\b/g,
    hipaaIdentifier: 'HIPAA 164.514(b)(2)(i)(A)',
    description: 'Social Security Number'
  },
  {
    category: 'phone',
    regex: /\b(?:\+1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g,
    hipaaIdentifier: 'HIPAA 164.514(b)(2)(i)(C)',
    description: 'Telephone Number'
  },
  {
    category: 'email',
    regex: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
    hipaaIdentifier: 'HIPAA 164.514(b)(2)(i)(F)',
    description: 'Email Address'
  },
  {
    category: 'mrn',
    regex: /\b(?:MRN|MR#|Medical Record|Patient ID)[:\s#]*[A-Z0-9]{6,12}\b/gi,
    hipaaIdentifier: 'HIPAA 164.514(b)(2)(i)(O)',
    description: 'Medical Record Number'
  },
  {
    category: 'date',
    regex: /\b(?:0?[1-9]|1[0-2])[-\/](?:0?[1-9]|[12]\d|3[01])[-\/](?:19|20)\d{2}\b/g,
    hipaaIdentifier: 'HIPAA 164.514(b)(2)(i)(B)',
    description: 'Date (MM/DD/YYYY or MM-DD-YYYY)'
  },
  {
    category: 'date',
    regex: /\b(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s+(?:19|20)\d{2}\b/gi,
    hipaaIdentifier: 'HIPAA 164.514(b)(2)(i)(B)',
    description: 'Date (Month Day, Year)'
  },
  {
    category: 'date',
    regex: /\b(?:19|20)\d{2}[-\/](?:0?[1-9]|1[0-2])[-\/](?:0?[1-9]|[12]\d|3[01])\b/g,
    hipaaIdentifier: 'HIPAA 164.514(b)(2)(i)(B)',
    description: 'Date (YYYY-MM-DD)'
  },
  {
    category: 'ip_address',
    regex: /\b(?:(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.){3}(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\b/g,
    hipaaIdentifier: 'HIPAA 164.514(b)(2)(i)(N)',
    description: 'IP Address'
  },
  {
    category: 'url',
    regex: /https?:\/\/(?:www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b(?:[-a-zA-Z0-9()@:%_\+.~#?&\/=]*)/gi,
    hipaaIdentifier: 'HIPAA 164.514(b)(2)(i)(M)',
    description: 'Web URL'
  },
  {
    category: 'address',
    regex: /\b\d{1,5}\s+(?:[A-Za-z]+\s+){1,4}(?:Street|St|Avenue|Ave|Boulevard|Blvd|Road|Rd|Drive|Dr|Lane|Ln|Court|Ct|Way|Place|Pl)\b/gi,
    hipaaIdentifier: 'HIPAA 164.514(b)(2)(i)(C)',
    description: 'Street Address'
  },
  {
    category: 'geographic',
    regex: /\b\d{5}(?:-\d{4})?\b/g,
    hipaaIdentifier: 'HIPAA 164.514(b)(2)(i)(C)',
    description: 'ZIP Code'
  },
  {
    category: 'account_number',
    regex: /\b(?:Account|Acct)[:\s#]*\d{8,16}\b/gi,
    hipaaIdentifier: 'HIPAA 164.514(b)(2)(i)(H)',
    description: 'Account Number'
  },
  {
    category: 'license_number',
    regex: /\b(?:License|DL|Driver's License)[:\s#]*[A-Z0-9]{6,12}\b/gi,
    hipaaIdentifier: 'HIPAA 164.514(b)(2)(i)(K)',
    description: 'License Number'
  },
  {
    category: 'device_id',
    regex: /\b(?:Device|Serial|IMEI)[:\s#]*[A-Z0-9]{10,20}\b/gi,
    hipaaIdentifier: 'HIPAA 164.514(b)(2)(i)(L)',
    description: 'Device Identifier'
  },
  {
    category: 'name',
    regex: /\b(?:Dr\.|Mr\.|Mrs\.|Ms\.)\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,2}\b/g,
    hipaaIdentifier: 'HIPAA 164.514(b)(2)(i)(A)',
    description: 'Name with Title'
  },
  {
    category: 'name',
    regex: /\b(?:Patient|Subject)[:\s]+[A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,2}\b/g,
    hipaaIdentifier: 'HIPAA 164.514(b)(2)(i)(A)',
    description: 'Patient/Subject Name'
  },
  {
    category: 'age_over_89',
    regex: /\b(?:age|aged?)[:\s]+(?:9\d|[1-9]\d{2,})\b/gi,
    hipaaIdentifier: 'HIPAA 164.514(b)(2)(i)(C)',
    description: 'Age over 89'
  }
];

function calculateConfidence(pattern: string, matchedText: string): number {
  const baseConfidence = 0.7;
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
    patternDef.regex.lastIndex = 0;
    
    let match;
    while ((match = patternDef.regex.exec(content)) !== null) {
      const confidence = calculateConfidence(patternDef.description, match[0]);
      
      detected.push({
        id: crypto.randomUUID(),
        category: patternDef.category,
        pattern: patternDef.description,
        matchedText: match[0],
        position: { start: match.index, end: match.index + match[0].length },
        confidence: Math.round(confidence * 100) / 100,
        suggestedAction: determineSuggestedAction(patternDef.category, confidence),
        hipaaIdentifier: patternDef.hipaaIdentifier
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
