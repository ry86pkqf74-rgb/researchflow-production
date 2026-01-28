/**
 * PHI Gate Service
 *
 * Integrates PHI scanning into AI request/response flows.
 * Ensures no PHI passes through AI operations undetected.
 */

import { PHI_PATTERNS, scrubLog, containsPhi, getPhiStats } from '@researchflow/phi-engine';
import type { AIPhiScanResult } from './types';

/**
 * PHI finding location (no values, only locations)
 */
interface PhiFindingLocation {
  type: string;
  startIndex: number;
  endIndex: number;
}

/**
 * PHI Gate Service
 *
 * Scans AI inputs and outputs for PHI, returning only locations (never values).
 */
export class PhiGateService {
  /**
   * Scan content for PHI
   *
   * @returns Scan result with finding locations only (no PHI values)
   */
  scanContent(content: string): AIPhiScanResult {
    if (!content || typeof content !== 'string') {
      return {
        passed: true,
        findingsCount: 0,
        riskLevel: 'none',
        findings: [],
      };
    }

    const findings: PhiFindingLocation[] = [];

    // Scan with each pattern
    for (const pattern of PHI_PATTERNS) {
      // Reset lastIndex for global regex
      pattern.regex.lastIndex = 0;

      let match: RegExpExecArray | null;
      while ((match = pattern.regex.exec(content)) !== null) {
        findings.push({
          type: pattern.type,
          startIndex: match.index,
          endIndex: match.index + match[0].length,
        });

        // Prevent infinite loops with zero-length matches
        if (match[0].length === 0) {
          pattern.regex.lastIndex++;
        }
      }
    }

    // Sort by startIndex and handle overlaps
    findings.sort((a, b) => a.startIndex - b.startIndex);
    const deduplicatedFindings = this.deduplicateOverlapping(findings);

    const findingsCount = deduplicatedFindings.length;
    const riskLevel = this.calculateRiskLevel(deduplicatedFindings);
    const passed = findingsCount === 0;

    // Generate redacted content if PHI found
    const redactedContent = passed ? undefined : this.redactContent(content, deduplicatedFindings);

    return {
      passed,
      findingsCount,
      riskLevel,
      redactedContent,
      findings: deduplicatedFindings,
    };
  }

  /**
   * Check if content contains any PHI (quick check)
   */
  hasPhi(content: string): boolean {
    return containsPhi(content);
  }

  /**
   * Get PHI statistics for content
   */
  getStats(content: string): Record<string, number> {
    return getPhiStats(content);
  }

  /**
   * Redact PHI from content
   */
  redact(content: string): string {
    return scrubLog(content);
  }

  /**
   * Scan and redact in one operation
   */
  scanAndRedact(content: string): { result: AIPhiScanResult; redacted: string } {
    const result = this.scanContent(content);
    const redacted = result.passed ? content : (result.redactedContent || this.redact(content));
    return { result, redacted };
  }

  /**
   * Scan content and return compatible result format
   * Returns a simplified scan result with hasPhi boolean and stats
   */
  scan(content: string): ScanResult {
    const result = this.scanContent(content);
    return {
      hasPhi: !result.passed,
      stats: this.getStats(content)
    };
  }

  /**
   * Remove overlapping findings (keep the more specific one)
   */
  private deduplicateOverlapping(findings: PhiFindingLocation[]): PhiFindingLocation[] {
    if (findings.length === 0) return [];

    const result: PhiFindingLocation[] = [];
    let current = findings[0];

    for (let i = 1; i < findings.length; i++) {
      const next = findings[i];

      // Check for overlap
      if (next.startIndex < current.endIndex) {
        // Keep the one with higher priority (more specific type)
        const currentPriority = this.getTypePriority(current.type);
        const nextPriority = this.getTypePriority(next.type);

        if (nextPriority > currentPriority) {
          current = next;
        } else if (next.endIndex > current.endIndex) {
          // Extend current if next goes further
          current = {
            ...current,
            endIndex: next.endIndex,
          };
        }
      } else {
        result.push(current);
        current = next;
      }
    }

    result.push(current);
    return result;
  }

  /**
   * Get priority for PHI type (higher = more specific)
   */
  private getTypePriority(type: string): number {
    const priorities: Record<string, number> = {
      SSN: 100,
      MRN: 95,
      EMAIL: 90,
      PHONE: 85,
      DOB: 80,
      NAME: 75,
      ADDRESS: 70,
      IP_ADDRESS: 65,
      URL: 60,
      ACCOUNT: 55,
      HEALTH_PLAN: 50,
      LICENSE: 45,
      DEVICE_ID: 40,
      ZIP_CODE: 35,
      AGE_OVER_89: 30,
    };

    return priorities[type] || 0;
  }

  /**
   * Calculate risk level based on findings
   */
  private calculateRiskLevel(findings: PhiFindingLocation[]): 'none' | 'low' | 'medium' | 'high' {
    if (findings.length === 0) return 'none';

    // High-risk types
    const highRiskTypes = ['SSN', 'MRN', 'HEALTH_PLAN', 'ACCOUNT'];
    const hasHighRisk = findings.some(f => highRiskTypes.includes(f.type));

    if (hasHighRisk) return 'high';

    // Medium-risk types
    const mediumRiskTypes = ['DOB', 'NAME', 'ADDRESS', 'PHONE', 'EMAIL'];
    const hasMediumRisk = findings.some(f => mediumRiskTypes.includes(f.type));

    if (hasMediumRisk) return 'medium';

    // Low-risk (other types)
    return 'low';
  }

  /**
   * Redact content using finding locations
   * Works backwards to preserve index positions
   */
  private redactContent(content: string, findings: PhiFindingLocation[]): string {
    // Sort by endIndex descending to redact from end to start
    const sortedFindings = [...findings].sort((a, b) => b.startIndex - a.startIndex);

    let result = content;
    for (const finding of sortedFindings) {
      const before = result.substring(0, finding.startIndex);
      const after = result.substring(finding.endIndex);
      result = `${before}[REDACTED:${finding.type}]${after}`;
    }

    return result;
  }
}

/**
 * Scan result interface compatible with writing-tools expectations
 */
export interface ScanResult {
  hasPhi: boolean;
  stats: Record<string, number>;
}

/**
 * Create a singleton instance
 */
let defaultInstance: PhiGateService | null = null;

export function getPhiGate(): PhiGateService {
  if (!defaultInstance) {
    defaultInstance = new PhiGateService();
  }
  return defaultInstance;
}
