/**
 * Convenience API for PHI Scanning
 *
 * Provides simple function-based API using a default RegexPhiScanner instance.
 * For most use cases, these functions are more convenient than instantiating a scanner.
 */

import { RegexPhiScanner } from './regex-scanner';
import type { PhiFinding } from './types';

/**
 * Default scanner instance (singleton)
 */
const defaultScanner = new RegexPhiScanner();

/**
 * Scan text for PHI using the default scanner
 * @param text - Text to scan
 * @returns Array of PHI findings
 */
export function scan(text: string): PhiFinding[] {
  return defaultScanner.scan(text);
}

/**
 * Redact PHI from text using the default scanner
 * @param text - Text to redact
 * @returns Text with PHI replaced by [REDACTED-TYPE] tags
 */
export function redact(text: string): string {
  return defaultScanner.redact(text);
}

/**
 * Check if text contains PHI using the default scanner
 * @param text - Text to check
 * @returns True if PHI detected, false otherwise
 */
export function hasPhi(text: string): boolean {
  return defaultScanner.hasPhi(text);
}
