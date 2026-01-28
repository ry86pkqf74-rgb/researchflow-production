/**
 * Regex-based PHI Scanner Implementation
 *
 * Core implementation of the PhiScanner interface using regular expressions.
 * Ported from apps/api-node/services/phi-scanner.ts with improvements.
 */
import type { PhiScanner, PhiFinding } from './types';
/**
 * Regex-based implementation of PHI scanner
 * Uses pattern matching to detect HIPAA 18 identifiers
 */
export declare class RegexPhiScanner implements PhiScanner {
    /**
     * Scan text and return all PHI findings
     */
    scan(text: string): PhiFinding[];
    /**
     * Redact PHI from text, replacing with [REDACTED-TYPE] tags
     */
    redact(text: string): string;
    /**
     * Quick check if text contains any PHI
     * More efficient than full scan for simple boolean check
     */
    hasPhi(text: string): boolean;
    /**
     * Calculate confidence score for a match
     * Ported from phi-scanner.ts:180-192 with improvements
     *
     * @param baseConfidence - Base confidence from pattern definition
     * @param matchedText - The matched text value
     * @returns Confidence score between 0 and 1
     */
    private calculateConfidence;
}
