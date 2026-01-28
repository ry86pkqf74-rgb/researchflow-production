/**
 * Convenience API for PHI Scanning
 *
 * Provides simple function-based API using a default RegexPhiScanner instance.
 * For most use cases, these functions are more convenient than instantiating a scanner.
 */
import type { PhiFinding } from './types';
/**
 * Scan text for PHI using the default scanner
 * @param text - Text to scan
 * @returns Array of PHI findings
 */
export declare function scan(text: string): PhiFinding[];
/**
 * Redact PHI from text using the default scanner
 * @param text - Text to redact
 * @returns Text with PHI replaced by [REDACTED-TYPE] tags
 */
export declare function redact(text: string): string;
/**
 * Check if text contains PHI using the default scanner
 * @param text - Text to check
 * @returns True if PHI detected, false otherwise
 */
export declare function hasPhi(text: string): boolean;
