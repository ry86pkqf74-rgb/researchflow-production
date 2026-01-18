/**
 * Regex-based PHI Scanner Implementation
 *
 * Core implementation of the PhiScanner interface using regular expressions.
 * Ported from apps/api-node/services/phi-scanner.ts with improvements.
 */

import type { PhiScanner, PhiFinding } from './types';
import { PHI_PATTERNS } from './patterns';

/**
 * Regex-based implementation of PHI scanner
 * Uses pattern matching to detect HIPAA 18 identifiers
 */
export class RegexPhiScanner implements PhiScanner {
  /**
   * Scan text and return all PHI findings
   */
  scan(text: string): PhiFinding[] {
    const findings: PhiFinding[] = [];

    for (const patternDef of PHI_PATTERNS) {
      // Reset regex lastIndex to start fresh
      patternDef.regex.lastIndex = 0;

      let match;
      while ((match = patternDef.regex.exec(text)) !== null) {
        const confidence = this.calculateConfidence(
          patternDef.baseConfidence,
          match[0]
        );

        findings.push({
          type: patternDef.type,
          value: match[0],
          startIndex: match.index,
          endIndex: match.index + match[0].length,
          confidence: Math.round(confidence * 100) / 100 // Round to 2 decimals
        });
      }
    }

    // Sort findings by startIndex for consistent ordering
    return findings.sort((a, b) => a.startIndex - b.startIndex);
  }

  /**
   * Redact PHI from text, replacing with [REDACTED-TYPE] tags
   */
  redact(text: string): string {
    const findings = this.scan(text);

    if (findings.length === 0) {
      return text;
    }

    // Sort findings by position (descending) to avoid index shifting
    const sorted = [...findings].sort((a, b) => b.startIndex - a.startIndex);

    let redacted = text;
    for (const finding of sorted) {
      const replacement = `[REDACTED-${finding.type}]`;
      redacted =
        redacted.substring(0, finding.startIndex) +
        replacement +
        redacted.substring(finding.endIndex);
    }

    return redacted;
  }

  /**
   * Quick check if text contains any PHI
   * More efficient than full scan for simple boolean check
   */
  hasPhi(text: string): boolean {
    // Early exit on first match for performance
    for (const patternDef of PHI_PATTERNS) {
      patternDef.regex.lastIndex = 0;
      if (patternDef.regex.test(text)) {
        return true;
      }
    }
    return false;
  }

  /**
   * Calculate confidence score for a match
   * Ported from phi-scanner.ts:180-192 with improvements
   *
   * @param baseConfidence - Base confidence from pattern definition
   * @param matchedText - The matched text value
   * @returns Confidence score between 0 and 1
   */
  private calculateConfidence(baseConfidence: number, matchedText: string): number {
    let confidence = baseConfidence;

    // Longer matches are generally more confident
    if (matchedText.length > 5) confidence += 0.05;
    if (matchedText.length > 10) confidence += 0.05;

    // Mixed alphanumeric is more likely to be a real identifier
    if (/\d/.test(matchedText) && /[A-Za-z]/.test(matchedText)) {
      confidence += 0.05;
    }

    // Cap at 0.99 (never 100% certain with regex alone)
    return Math.min(0.99, confidence);
  }
}
