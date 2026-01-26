/**
 * Field Adapter for Dataset PHI Detection
 *
 * Provides detectPhiFields() interface for dataset uploads.
 * Ported from apps/api-node/src/services/phi-protection.ts:184-235
 */

import { RegexPhiScanner } from '../regex-scanner';

/**
 * Suspicious field names that may contain PHI
 */
const SUSPICIOUS_FIELD_NAMES = [
  'ssn', 'social_security',
  'dob', 'date_of_birth', 'birthdate',
  'mrn', 'medical_record',
  'phone', 'telephone', 'mobile',
  'email', 'address',
  'name', 'first_name', 'last_name', 'full_name',
  'patient_id', 'member_id',
  'subject', 'subject_id'
];

/**
 * Detect PHI fields in structured data
 *
 * Checks both field names and sample values for PHI.
 * Used by dataset upload endpoint to auto-detect PHI.
 *
 * @param data - Single record or array of records to scan
 * @param columns - Optional explicit column names to check
 * @returns Array of field names containing PHI
 */
export function detectPhiFields(
  data: Record<string, any> | Array<Record<string, any>>,
  columns?: string[]
): string[] {
  const scanner = new RegexPhiScanner();
  const phiFields: string[] = [];

  // Normalize to array format
  const records = Array.isArray(data) ? data : [data];
  if (records.length === 0) return [];

  // Get fields to check
  const fieldsToCheck = columns || Object.keys(records[0]);

  for (const field of fieldsToCheck) {
    const lowerField = field.toLowerCase();

    // Check field name against suspicious list
    if (SUSPICIOUS_FIELD_NAMES.some(suspicious => lowerField.includes(suspicious))) {
      phiFields.push(field);
      continue;
    }

    // Check sample values from first few records
    const sampleValues = records
      .slice(0, Math.min(10, records.length)) // Check up to 10 records
      .map(record => record[field])
      .filter(val => typeof val === 'string');

    // Scan each sample value
    for (const value of sampleValues) {
      const findings = scanner.scan(value);
      if (findings.length > 0 && findings.some(f => f.confidence >= 0.7)) {
        phiFields.push(field);
        break; // Found PHI in this field, move to next
      }
    }
  }

  // Return unique field names
  return [...new Set(phiFields)];
}

/**
 * Calculate risk score for dataset classification
 * Ported from phi-protection.ts:222-235
 *
 * @param phiFields - Array of field names containing PHI
 * @param classification - Dataset classification
 * @returns Risk score (0-100)
 */
export function calculateRiskScore(
  phiFields: string[],
  classification: string
): number {
  let score = 0;

  // Base score from classification
  switch (classification) {
    case 'IDENTIFIED':
      score += 80;
      break;
    case 'DEIDENTIFIED':
      score += 30;
      break;
    case 'SYNTHETIC':
      score += 5;
      break;
    default:
      score += 50;
  }

  // Add points for each PHI field (max 20 points)
  score += Math.min(phiFields.length * 5, 20);

  return Math.min(score, 100);
}
