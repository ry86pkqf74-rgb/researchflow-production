/**
 * INF-14: Validation Suites - Invariant Checks
 * Additional invariant checks for data validation
 */

const HIPAA_18_PATTERNS: Array<{
  name: string;
  pattern: RegExp;
  description: string;
}> = [
  {
    name: 'ssn',
    pattern: /\b\d{3}[-\s]?\d{2}[-\s]?\d{4}\b/g,
    description: 'Social Security Number',
  },
  {
    name: 'phone',
    pattern: /\b(?:\+1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g,
    description: 'Phone Number',
  },
  {
    name: 'email',
    pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
    description: 'Email Address',
  },
  {
    name: 'mrn',
    pattern: /\b(?:MRN|MR#|Medical Record|Patient ID)[:\s#]*[A-Z0-9]{6,12}\b/gi,
    description: 'Medical Record Number',
  },
  {
    name: 'date_mmddyyyy',
    pattern: /\b(?:0?[1-9]|1[0-2])[-\/](?:0?[1-9]|[12]\d|3[01])[-\/](?:19|20)\d{2}\b/g,
    description: 'Date (MM/DD/YYYY)',
  },
  {
    name: 'ip_address',
    pattern: /\b(?:(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.){3}(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\b/g,
    description: 'IP Address',
  },
  {
    name: 'address',
    pattern: /\b\d{1,5}\s+(?:[A-Za-z]+\s+){1,4}(?:Street|St|Avenue|Ave|Boulevard|Blvd|Road|Rd|Drive|Dr|Lane|Ln|Court|Ct|Way|Place|Pl)\b/gi,
    description: 'Street Address',
  },
  {
    name: 'zip_code',
    pattern: /\b\d{5}(?:-\d{4})?\b/g,
    description: 'ZIP Code',
  },
  {
    name: 'name_with_title',
    pattern: /\b(?:Dr\.|Mr\.|Mrs\.|Ms\.)\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,2}\b/g,
    description: 'Name with Title',
  },
  {
    name: 'patient_subject_name',
    pattern: /\b(?:Patient|Subject)[:\s]+[A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,2}\b/g,
    description: 'Patient/Subject Name',
  },
  {
    name: 'age_over_89',
    pattern: /\b(?:age|aged?)[:\s]+(?:9\d|[1-9]\d{2,})\b/gi,
    description: 'Age over 89',
  },
  {
    name: 'account_number',
    pattern: /\b(?:Account|Acct)[:\s#]*\d{8,16}\b/gi,
    description: 'Account Number',
  },
  {
    name: 'license_number',
    pattern: /\b(?:License|DL|Driver's License)[:\s#]*[A-Z0-9]{6,12}\b/gi,
    description: 'License Number',
  },
  {
    name: 'device_id',
    pattern: /\b(?:Device|Serial|IMEI)[:\s#]*[A-Z0-9]{10,20}\b/gi,
    description: 'Device Identifier',
  },
  {
    name: 'vin',
    pattern: /\b[A-HJ-NPR-Z0-9]{17}\b/g,
    description: 'Vehicle Identification Number',
  },
  {
    name: 'biometric_reference',
    pattern: /\b(?:fingerprint|retina|iris|voice|facial)[:\s]+(?:scan|print|pattern|id)[:\s#]*[A-Z0-9]+\b/gi,
    description: 'Biometric Identifier Reference',
  },
  {
    name: 'url',
    pattern: /https?:\/\/(?:www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b(?:[-a-zA-Z0-9()@:%_\+.~#?&\/=]*)/gi,
    description: 'Web URL',
  },
  {
    name: 'health_plan_id',
    pattern: /\b(?:Health Plan|Insurance|Policy)[:\s#]*[A-Z0-9]{8,16}\b/gi,
    description: 'Health Plan Beneficiary Number',
  },
];

export interface PHIDetectionResult {
  hasPHI: boolean;
  detectedPatterns: Array<{
    name: string;
    description: string;
    matches: string[];
    count: number;
  }>;
  totalMatches: number;
}

export function invariantNoPHI(content: string): boolean {
  if (!content || typeof content !== 'string') {
    return true;
  }

  for (const { pattern } of HIPAA_18_PATTERNS) {
    pattern.lastIndex = 0;
    if (pattern.test(content)) {
      return false;
    }
  }

  return true;
}

export function detectPHIPatterns(content: string): PHIDetectionResult {
  const detectedPatterns: PHIDetectionResult['detectedPatterns'] = [];
  let totalMatches = 0;

  if (!content || typeof content !== 'string') {
    return { hasPHI: false, detectedPatterns: [], totalMatches: 0 };
  }

  for (const { name, pattern, description } of HIPAA_18_PATTERNS) {
    pattern.lastIndex = 0;
    const matches = content.match(pattern) || [];
    
    if (matches.length > 0) {
      detectedPatterns.push({
        name,
        description,
        matches: matches.slice(0, 5),
        count: matches.length,
      });
      totalMatches += matches.length;
    }
  }

  return {
    hasPHI: totalMatches > 0,
    detectedPatterns,
    totalMatches,
  };
}

export function invariantValidJSON(content: string): boolean {
  if (!content || typeof content !== 'string') {
    return false;
  }

  const trimmed = content.trim();
  if (!trimmed) {
    return false;
  }

  try {
    JSON.parse(trimmed);
    return true;
  } catch {
    return false;
  }
}

export interface JSONValidationResult {
  valid: boolean;
  error?: string;
  errorPosition?: number;
}

export function validateJSON(content: string): JSONValidationResult {
  if (!content || typeof content !== 'string') {
    return { valid: false, error: 'Content is empty or not a string' };
  }

  const trimmed = content.trim();
  if (!trimmed) {
    return { valid: false, error: 'Content is empty after trimming' };
  }

  try {
    JSON.parse(trimmed);
    return { valid: true };
  } catch (e) {
    const error = e as SyntaxError;
    const positionMatch = error.message.match(/position\s+(\d+)/i);
    return {
      valid: false,
      error: error.message,
      errorPosition: positionMatch ? parseInt(positionMatch[1], 10) : undefined,
    };
  }
}

export function invariantMaxSize(content: string, maxBytes: number): boolean {
  if (!content || typeof content !== 'string') {
    return true;
  }

  if (maxBytes <= 0) {
    return false;
  }

  const sizeBytes = Buffer.byteLength(content, 'utf8');
  return sizeBytes <= maxBytes;
}

export interface SizeValidationResult {
  valid: boolean;
  sizeBytes: number;
  maxBytes: number;
  percentUsed: number;
}

export function validateSize(content: string, maxBytes: number): SizeValidationResult {
  const sizeBytes = content ? Buffer.byteLength(content, 'utf8') : 0;
  const valid = sizeBytes <= maxBytes;
  const percentUsed = maxBytes > 0 ? Math.round((sizeBytes / maxBytes) * 100) : 0;

  return {
    valid,
    sizeBytes,
    maxBytes,
    percentUsed,
  };
}

export function invariantNonEmpty(content: unknown): boolean {
  if (content === null || content === undefined) {
    return false;
  }

  if (typeof content === 'string') {
    return content.trim().length > 0;
  }

  if (Array.isArray(content)) {
    return content.length > 0;
  }

  if (typeof content === 'object') {
    return Object.keys(content).length > 0;
  }

  return true;
}

export function invariantValidTimestamp(timestamp: string): boolean {
  if (!timestamp || typeof timestamp !== 'string') {
    return false;
  }

  const date = new Date(timestamp);
  return !isNaN(date.getTime());
}

export function invariantRequiredFields(
  data: Record<string, unknown>,
  requiredFields: string[]
): boolean {
  if (!data || typeof data !== 'object') {
    return false;
  }

  for (const field of requiredFields) {
    const value = data[field];
    if (value === undefined || value === null) {
      return false;
    }
    if (typeof value === 'string' && value.trim() === '') {
      return false;
    }
  }

  return true;
}
