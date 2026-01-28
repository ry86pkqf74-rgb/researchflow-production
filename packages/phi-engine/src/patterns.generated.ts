/**
 * PHI Pattern Definitions - AUTO-GENERATED
 *
 * Source: shared/phi/phi_patterns.v1.json
 * Generated: 2026-01-20T17:59:45.393003+00:00
 * Version: 1.0.0
 *
 * DO NOT EDIT MANUALLY - regenerate with:
 *   python scripts/governance/generate_phi_patterns.py
 */

import type { PhiFinding } from './types';

/**
 * Pattern definition for PHI detection
 */
export interface PatternDefinition {
  /** Unique pattern identifier */
  id: string;
  /** PHI type this pattern detects */
  type: PhiFinding['type'];
  /** Detection tiers this pattern belongs to */
  tier: ('HIGH_CONFIDENCE' | 'OUTPUT_GUARD')[];
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
 * HIGH_CONFIDENCE patterns - use for upload/egress gating
 * These patterns have high precision to avoid false positives
 */
export const PHI_PATTERNS_HIGH_CONFIDENCE: PatternDefinition[] = [
  {
    id: 'SSN_STRICT',
    type: 'SSN',
    tier: ["HIGH_CONFIDENCE", "OUTPUT_GUARD"],
    regex: /\b\d{3}[-\s]?\d{2}[-\s]?\d{4}\b/g,
    hipaaCategory: '164.514(b)(2)(i)(E)',
    description: 'Social Security Number (with or without separators)',
    baseConfidence: 0.8,
  },
  {
    id: 'EMAIL',
    type: 'EMAIL',
    tier: ["HIGH_CONFIDENCE", "OUTPUT_GUARD"],
    regex: /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/gi,
    hipaaCategory: '164.514(b)(2)(i)(D)',
    description: 'Email Address',
    baseConfidence: 0.85,
  },
  {
    id: 'PHONE',
    type: 'PHONE',
    tier: ["HIGH_CONFIDENCE", "OUTPUT_GUARD"],
    regex: /\b(?:\+1[-.]?)?\(?\d{3}\)?[-.]?\d{3}[-.]?\d{4}\b/g,
    hipaaCategory: '164.514(b)(2)(i)(C)',
    description: 'US Phone Number',
    baseConfidence: 0.75,
  },
  {
    id: 'MRN',
    type: 'MRN',
    tier: ["HIGH_CONFIDENCE", "OUTPUT_GUARD"],
    regex: /\b(?:MRN|MR#|Medical Record|Patient ID)[:\s#]*[A-Z0-9]{6,12}\b/gi,
    hipaaCategory: '164.514(b)(2)(i)(F)',
    description: 'Medical Record Number',
    baseConfidence: 0.85,
  },
];

/**
 * OUTPUT_GUARD patterns - use for export/output scanning
 * More comprehensive than HIGH_CONFIDENCE, may have more false positives
 */
export const PHI_PATTERNS_OUTPUT_GUARD: PatternDefinition[] = [
  {
    id: 'SSN_STRICT',
    type: 'SSN',
    tier: ["HIGH_CONFIDENCE", "OUTPUT_GUARD"],
    regex: /\b\d{3}[-\s]?\d{2}[-\s]?\d{4}\b/g,
    hipaaCategory: '164.514(b)(2)(i)(E)',
    description: 'Social Security Number (with or without separators)',
    baseConfidence: 0.8,
  },
  {
    id: 'EMAIL',
    type: 'EMAIL',
    tier: ["HIGH_CONFIDENCE", "OUTPUT_GUARD"],
    regex: /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/gi,
    hipaaCategory: '164.514(b)(2)(i)(D)',
    description: 'Email Address',
    baseConfidence: 0.85,
  },
  {
    id: 'PHONE',
    type: 'PHONE',
    tier: ["HIGH_CONFIDENCE", "OUTPUT_GUARD"],
    regex: /\b(?:\+1[-.]?)?\(?\d{3}\)?[-.]?\d{3}[-.]?\d{4}\b/g,
    hipaaCategory: '164.514(b)(2)(i)(C)',
    description: 'US Phone Number',
    baseConfidence: 0.75,
  },
  {
    id: 'MRN',
    type: 'MRN',
    tier: ["HIGH_CONFIDENCE", "OUTPUT_GUARD"],
    regex: /\b(?:MRN|MR#|Medical Record|Patient ID)[:\s#]*[A-Z0-9]{6,12}\b/gi,
    hipaaCategory: '164.514(b)(2)(i)(F)',
    description: 'Medical Record Number',
    baseConfidence: 0.85,
  },
  {
    id: 'NAME_WITH_TITLE',
    type: 'NAME',
    tier: ["OUTPUT_GUARD"],
    regex: /\b(?:Dr\.|Mr\.|Mrs\.|Ms\.)\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,2}\b/g,
    hipaaCategory: '164.514(b)(2)(i)(A)',
    description: 'Name with Title (Dr., Mr., Mrs., Ms.)',
    baseConfidence: 0.75,
  },
  {
    id: 'PATIENT_NAME',
    type: 'NAME',
    tier: ["OUTPUT_GUARD"],
    regex: /\b(?:Patient|Subject)[:\s]+[A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,2}\b/g,
    hipaaCategory: '164.514(b)(2)(i)(A)',
    description: 'Patient/Subject Name',
    baseConfidence: 0.8,
  },
  {
    id: 'ZIP_CODE',
    type: 'ZIP_CODE',
    tier: ["OUTPUT_GUARD"],
    regex: /\b\d{5}(?:-\d{4})?\b/g,
    hipaaCategory: '164.514(b)(2)(i)(B)',
    description: 'ZIP Code (5 or 9 digit)',
    baseConfidence: 0.7,
  },
  {
    id: 'ADDRESS',
    type: 'ADDRESS',
    tier: ["OUTPUT_GUARD"],
    regex: /\b\d{1,5}\s+(?:[A-Za-z]+\s+){1,4}(?:Street|St|Avenue|Ave|Boulevard|Blvd|Road|Rd|Drive|Dr|Lane|Ln|Court|Ct|Way|Place|Pl)\b/gi,
    hipaaCategory: '164.514(b)(2)(i)(B)',
    description: 'Street Address',
    baseConfidence: 0.75,
  },
  {
    id: 'DATE_MDY',
    type: 'DOB',
    tier: ["OUTPUT_GUARD"],
    regex: /\b(?:0?[1-9]|1[0-2])[-/](?:0?[1-9]|[12]\d|3[01])[-/](?:19|20)\d{2}\b/g,
    hipaaCategory: '164.514(b)(2)(i)(B)',
    description: 'Date (MM/DD/YYYY or MM-DD-YYYY)',
    baseConfidence: 0.7,
  },
  {
    id: 'DATE_WRITTEN',
    type: 'DOB',
    tier: ["OUTPUT_GUARD"],
    regex: /\b(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s+(?:19|20)\d{2}\b/gi,
    hipaaCategory: '164.514(b)(2)(i)(B)',
    description: 'Date (Month Day, Year)',
    baseConfidence: 0.75,
  },
  {
    id: 'DATE_ISO',
    type: 'DOB',
    tier: ["OUTPUT_GUARD"],
    regex: /\b(?:19|20)\d{2}[-/](?:0?[1-9]|1[0-2])[-/](?:0?[1-9]|[12]\d|3[01])\b/g,
    hipaaCategory: '164.514(b)(2)(i)(B)',
    description: 'Date (YYYY-MM-DD ISO format)',
    baseConfidence: 0.75,
  },
  {
    id: 'HEALTH_PLAN',
    type: 'HEALTH_PLAN',
    tier: ["OUTPUT_GUARD"],
    regex: /\b(?:Member|Policy|Plan)[\s#:]*[A-Z0-9]{6,15}\b/gi,
    hipaaCategory: '164.514(b)(2)(i)(G)',
    description: 'Health Plan Beneficiary Number',
    baseConfidence: 0.75,
  },
  {
    id: 'ACCOUNT',
    type: 'ACCOUNT',
    tier: ["OUTPUT_GUARD"],
    regex: /\b(?:Account|Acct)[:\s#]*\d{8,16}\b/gi,
    hipaaCategory: '164.514(b)(2)(i)(H)',
    description: 'Account Number',
    baseConfidence: 0.7,
  },
  {
    id: 'LICENSE',
    type: 'LICENSE',
    tier: ["OUTPUT_GUARD"],
    regex: /\b(?:License|DL|Driver's License)[:\s#]*[A-Z0-9]{6,12}\b/gi,
    hipaaCategory: '164.514(b)(2)(i)(K)',
    description: 'License Number',
    baseConfidence: 0.75,
  },
  {
    id: 'DEVICE_ID',
    type: 'DEVICE_ID',
    tier: ["OUTPUT_GUARD"],
    regex: /\b(?:Device|Serial|IMEI)[:\s#]*[A-Z0-9]{10,20}\b/gi,
    hipaaCategory: '164.514(b)(2)(i)(L)',
    description: 'Device Identifier',
    baseConfidence: 0.7,
  },
  {
    id: 'URL',
    type: 'URL',
    tier: ["OUTPUT_GUARD"],
    regex: /https?:\/\/(?:www\.)?[-a-zA-Z0-9@:%._+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b(?:[-a-zA-Z0-9()@:%_+.~#?&\/=]*)/gi,
    hipaaCategory: '164.514(b)(2)(i)(M)',
    description: 'Web URL',
    baseConfidence: 0.85,
  },
  {
    id: 'IP_ADDRESS',
    type: 'IP_ADDRESS',
    tier: ["OUTPUT_GUARD"],
    regex: /\b(?:(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.){3}(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\b/g,
    hipaaCategory: '164.514(b)(2)(i)(N)',
    description: 'IPv4 Address',
    baseConfidence: 0.85,
  },
  {
    id: 'AGE_OVER_89',
    type: 'AGE_OVER_89',
    tier: ["OUTPUT_GUARD"],
    regex: /\b(?:age|aged?)[:\s]+(?:9\d|[1-9]\d{2,})\b/gi,
    hipaaCategory: '164.514(b)(2)(i)(C)',
    description: 'Age over 89 years',
    baseConfidence: 0.7,
  },
];

/**
 * Default PHI patterns - uses OUTPUT_GUARD for comprehensive detection
 * @deprecated Use PHI_PATTERNS_HIGH_CONFIDENCE or PHI_PATTERNS_OUTPUT_GUARD
 */
export const PHI_PATTERNS: PatternDefinition[] = PHI_PATTERNS_OUTPUT_GUARD;
