/**
 * PHI Pattern Definitions
 *
 * Consolidated patterns from existing implementations:
 * - apps/api-node/services/phi-scanner.ts (16 patterns)
 * - apps/api-node/src/services/phi-protection.ts (13 patterns)
 *
 * Includes HIPAA 164.514(b)(2) identifier mappings for compliance.
 */

import type { PhiFinding } from './types';

/**
 * Pattern definition for PHI detection
 */
export interface PatternDefinition {
  /** PHI type this pattern detects */
  type: PhiFinding['type'];
  /** Regular expression for matching */
  regex: RegExp;
  /** HIPAA Safe Harbor identifier reference */
  hipaaCategory: string;
  /** Human-readable description */
  description: string;
  /** Base confidence score (0-1) */
  baseConfidence: number;
}

/**
 * Comprehensive PHI pattern library
 * Consolidated from both existing scanners with de-duplication
 */
export const PHI_PATTERNS: PatternDefinition[] = [
  // 1. Names (HIPAA 164.514(b)(2)(i)(A))
  {
    type: 'NAME',
    regex: /\b(?:Dr\.|Mr\.|Mrs\.|Ms\.)\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,2}\b/g,
    hipaaCategory: 'HIPAA 164.514(b)(2)(i)(A)',
    description: 'Name with Title',
    baseConfidence: 0.75
  },
  {
    type: 'NAME',
    regex: /\b(?:Patient|Subject)[:\s]+[A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,2}\b/g,
    hipaaCategory: 'HIPAA 164.514(b)(2)(i)(A)',
    description: 'Patient/Subject Name',
    baseConfidence: 0.80
  },

  // 2-3. Geographic (HIPAA 164.514(b)(2)(i)(B))
  {
    type: 'ZIP_CODE',
    regex: /\b\d{5}(?:-\d{4})?\b/g,
    hipaaCategory: 'HIPAA 164.514(b)(2)(i)(B)',
    description: 'ZIP Code',
    baseConfidence: 0.70
  },
  {
    type: 'ADDRESS',
    regex: /\b\d{1,5}\s+(?:[A-Za-z]+\s+){1,4}(?:Street|St|Avenue|Ave|Boulevard|Blvd|Road|Rd|Drive|Dr|Lane|Ln|Court|Ct|Way|Place|Pl)\b/gi,
    hipaaCategory: 'HIPAA 164.514(b)(2)(i)(B)',
    description: 'Street Address',
    baseConfidence: 0.75
  },

  // 4. Dates (HIPAA 164.514(b)(2)(i)(B))
  {
    type: 'DOB',
    regex: /\b(?:0?[1-9]|1[0-2])[-\/](?:0?[1-9]|[12]\d|3[01])[-\/](?:19|20)\d{2}\b/g,
    hipaaCategory: 'HIPAA 164.514(b)(2)(i)(B)',
    description: 'Date (MM/DD/YYYY or MM-DD-YYYY)',
    baseConfidence: 0.70
  },
  {
    type: 'DOB',
    regex: /\b(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s+(?:19|20)\d{2}\b/gi,
    hipaaCategory: 'HIPAA 164.514(b)(2)(i)(B)',
    description: 'Date (Month Day, Year)',
    baseConfidence: 0.75
  },
  {
    type: 'DOB',
    regex: /\b(?:19|20)\d{2}[-\/](?:0?[1-9]|1[0-2])[-\/](?:0?[1-9]|[12]\d|3[01])\b/g,
    hipaaCategory: 'HIPAA 164.514(b)(2)(i)(B)',
    description: 'Date (YYYY-MM-DD ISO format)',
    baseConfidence: 0.75
  },

  // 5-6. Phone/Fax (HIPAA 164.514(b)(2)(i)(C))
  {
    type: 'PHONE',
    regex: /\b(?:\+1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g,
    hipaaCategory: 'HIPAA 164.514(b)(2)(i)(C)',
    description: 'Telephone Number',
    baseConfidence: 0.75
  },

  // 7. Email (HIPAA 164.514(b)(2)(i)(D))
  {
    type: 'EMAIL',
    regex: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g,
    hipaaCategory: 'HIPAA 164.514(b)(2)(i)(D)',
    description: 'Email Address',
    baseConfidence: 0.85
  },

  // 8. SSN (HIPAA 164.514(b)(2)(i)(E))
  {
    type: 'SSN',
    regex: /\b\d{3}[-\s]?\d{2}[-\s]?\d{4}\b/g,
    hipaaCategory: 'HIPAA 164.514(b)(2)(i)(E)',
    description: 'Social Security Number',
    baseConfidence: 0.80
  },

  // 9. Medical Record Number (HIPAA 164.514(b)(2)(i)(F))
  {
    type: 'MRN',
    regex: /\b(?:MRN|MR#|Medical Record|Patient ID)[:\s#]*[A-Z0-9]{6,12}\b/gi,
    hipaaCategory: 'HIPAA 164.514(b)(2)(i)(F)',
    description: 'Medical Record Number',
    baseConfidence: 0.85
  },

  // 10. Health Plan Number (HIPAA 164.514(b)(2)(i)(G))
  {
    type: 'HEALTH_PLAN',
    regex: /\b(?:Member|Policy|Plan)[\s#:]*([A-Z0-9]{6,15})\b/gi,
    hipaaCategory: 'HIPAA 164.514(b)(2)(i)(G)',
    description: 'Health Plan Beneficiary Number',
    baseConfidence: 0.75
  },

  // 11. Account Numbers (HIPAA 164.514(b)(2)(i)(H))
  {
    type: 'ACCOUNT',
    regex: /\b(?:Account|Acct)[:\s#]*\d{8,16}\b/gi,
    hipaaCategory: 'HIPAA 164.514(b)(2)(i)(H)',
    description: 'Account Number',
    baseConfidence: 0.70
  },

  // 12. License Numbers (HIPAA 164.514(b)(2)(i)(K))
  {
    type: 'LICENSE',
    regex: /\b(?:License|DL|Driver's License)[:\s#]*[A-Z0-9]{6,12}\b/gi,
    hipaaCategory: 'HIPAA 164.514(b)(2)(i)(K)',
    description: 'License Number',
    baseConfidence: 0.75
  },

  // 13. Device Identifiers (HIPAA 164.514(b)(2)(i)(L))
  {
    type: 'DEVICE_ID',
    regex: /\b(?:Device|Serial|IMEI)[:\s#]*[A-Z0-9]{10,20}\b/gi,
    hipaaCategory: 'HIPAA 164.514(b)(2)(i)(L)',
    description: 'Device Identifier',
    baseConfidence: 0.70
  },

  // 14. URLs (HIPAA 164.514(b)(2)(i)(M))
  {
    type: 'URL',
    regex: /https?:\/\/(?:www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b(?:[-a-zA-Z0-9()@:%_\+.~#?&\/=]*)/gi,
    hipaaCategory: 'HIPAA 164.514(b)(2)(i)(M)',
    description: 'Web URL',
    baseConfidence: 0.85
  },

  // 15. IP Addresses (HIPAA 164.514(b)(2)(i)(N))
  {
    type: 'IP_ADDRESS',
    regex: /\b(?:(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.){3}(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\b/g,
    hipaaCategory: 'HIPAA 164.514(b)(2)(i)(N)',
    description: 'IP Address',
    baseConfidence: 0.85
  },

  // 16. Age over 89 (HIPAA 164.514(b)(2)(i)(C))
  {
    type: 'AGE_OVER_89',
    regex: /\b(?:age|aged?)[:\s]+(?:9\d|[1-9]\d{2,})\b/gi,
    hipaaCategory: 'HIPAA 164.514(b)(2)(i)(C)',
    description: 'Age over 89',
    baseConfidence: 0.70
  }
];
