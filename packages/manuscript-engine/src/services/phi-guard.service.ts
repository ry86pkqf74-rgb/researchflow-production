/**
 * PHI Guard Service (CRITICAL)
 * Fail-closed PHI protection for manuscript content
 *
 * SECURITY: This service MUST block all operations if PHI is detected or scanning fails
 */

import type { PhiScanner, PhiFinding } from '@researchflow/phi-engine';
import type { PHIScanResult, ManuscriptAuditEntry } from '../types';

export interface PhiGuardConfig {
  scanner: PhiScanner;
  failClosed: boolean; // Must be true in production
  auditLogger?: (entry: ManuscriptAuditEntry) => Promise<void>;
}

export interface RedactedContent {
  content: string;
  redacted: boolean;
  originalLength: number;
  redactedLength: number;
  findingsCount: number;
}

/**
 * PHI Guard Service - Critical security component
 * Implements fail-closed behavior for PHI protection
 */
export class PhiGuardService {
  private static instance: PhiGuardService;
  private scanner: PhiScanner;
  private failClosed: boolean;
  private auditLogger?: (entry: ManuscriptAuditEntry) => Promise<void>;

  private constructor(config: PhiGuardConfig) {
    this.scanner = config.scanner;
    this.failClosed = config.failClosed;
    this.auditLogger = config.auditLogger;

    // SECURITY: Enforce fail-closed in production
    if (process.env.NODE_ENV === 'production' && !this.failClosed) {
      throw new Error('SECURITY: PHI Guard MUST be fail-closed in production');
    }
  }

  static getInstance(config?: PhiGuardConfig): PhiGuardService {
    if (!this.instance) {
      if (!config) {
        throw new Error('PHI Guard config required for first initialization');
      }
      this.instance = new PhiGuardService(config);
    }
    return this.instance;
  }

  /**
   * Scan content before manuscript insertion
   * CRITICAL: Blocks insertion if PHI detected or scan fails
   */
  async scanBeforeInsertion(
    content: string,
    context: { manuscriptId: string; section: string; userId: string }
  ): Promise<PHIScanResult> {
    const scannedAt = new Date();

    try {
      // Perform PHI scan
      const findings: PhiFinding[] = this.scanner.scan(content);

      const result: PHIScanResult = {
        passed: findings.length === 0,
        findings: findings.map(f => ({
          type: f.type,
          value: f.value,
          location: f.startIndex,
          confidence: f.confidence,
        })),
        riskLevel: this.assessRiskLevel(findings),
        scannedAt,
      };

      // Audit log
      if (this.auditLogger) {
        await this.auditLogger({
          id: crypto.randomUUID(),
          manuscriptId: context.manuscriptId,
          action: 'PHI_SCAN',
          details: {
            section: context.section,
            findingsCount: findings.length,
            riskLevel: result.riskLevel,
            passed: result.passed,
          },
          userId: context.userId,
          timestamp: scannedAt,
          previousHash: null,
          currentHash: this.hashContent(content),
        });
      }

      // FAIL-CLOSED: If PHI detected and fail-closed is enabled, throw
      if (!result.passed && this.failClosed) {
        throw new PHIDetectedError(
          `PHI detected in ${context.section}: ${findings.length} findings`,
          findings
        );
      }

      return result;
    } catch (error) {
      // FAIL-CLOSED: If scan fails, block the operation
      if (this.failClosed) {
        throw new PHIScanFailureError(
          `PHI scan failed for ${context.section}: ${error instanceof Error ? error.message : 'Unknown error'}`,
          error
        );
      }

      // If not fail-closed (dev/test only), return failure
      return {
        passed: false,
        findings: [],
        riskLevel: 'high',
        scannedAt,
      };
    }
  }

  /**
   * Redact PHI from content with audit trail
   */
  async redactAndLog(
    content: string,
    context: { manuscriptId: string; userId: string }
  ): Promise<RedactedContent> {
    const originalLength = content.length;
    const findings = this.scanner.scan(content);

    if (findings.length === 0) {
      return {
        content,
        redacted: false,
        originalLength,
        redactedLength: originalLength,
        findingsCount: 0,
      };
    }

    const redactedContent = this.scanner.redact(content);

    // Audit log
    if (this.auditLogger) {
      await this.auditLogger({
        id: crypto.randomUUID(),
        manuscriptId: context.manuscriptId,
        action: 'PHI_REDACTION',
        details: {
          findingsCount: findings.length,
          originalLength,
          redactedLength: redactedContent.length,
        },
        userId: context.userId,
        timestamp: new Date(),
        previousHash: this.hashContent(content),
        currentHash: this.hashContent(redactedContent),
      });
    }

    return {
      content: redactedContent,
      redacted: true,
      originalLength,
      redactedLength: redactedContent.length,
      findingsCount: findings.length,
    };
  }

  /**
   * Quick check if content contains PHI
   */
  hasPhi(content: string): boolean {
    return this.scanner.hasPhi(content);
  }

  /**
   * Assess risk level based on findings
   */
  private assessRiskLevel(findings: PhiFinding[]): 'none' | 'low' | 'medium' | 'high' {
    if (findings.length === 0) return 'none';

    // High-risk identifiers
    const highRiskTypes = ['SSN', 'MRN', 'HEALTH_PLAN', 'ACCOUNT'];
    const hasHighRisk = findings.some(f => highRiskTypes.includes(f.type));
    if (hasHighRisk) return 'high';

    // Medium-risk: multiple findings or name+address
    if (findings.length >= 3) return 'high';
    if (findings.length >= 2) return 'medium';

    return 'low';
  }

  /**
   * Hash content for audit trail
   */
  private hashContent(content: string): string {
    // Simple hash for audit - in production, use crypto.subtle
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash).toString(16).padStart(16, '0');
  }
}

/**
 * Error thrown when PHI is detected
 */
export class PHIDetectedError extends Error {
  constructor(message: string, public findings: PhiFinding[]) {
    super(message);
    this.name = 'PHIDetectedError';
  }
}

/**
 * Error thrown when PHI scan fails
 */
export class PHIScanFailureError extends Error {
  constructor(message: string, public cause?: unknown) {
    super(message);
    this.name = 'PHIScanFailureError';
  }
}

/**
 * Factory function for getting PHI Guard instance
 */
export function getPhiGuard(config?: PhiGuardConfig): PhiGuardService {
  return PhiGuardService.getInstance(config);
}
