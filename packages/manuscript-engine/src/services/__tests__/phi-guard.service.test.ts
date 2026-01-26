/**
 * PHI Guard Service Tests (CRITICAL)
 * Comprehensive tests for fail-closed PHI protection
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  PhiGuardService,
  PHIDetectedError,
  PHIScanFailureError,
  getPhiGuard,
  type PhiGuardConfig,
  type RedactedContent,
} from '../phi-guard.service';
import type { PhiScanner, PhiFinding } from '@researchflow/phi-engine';
import type { ManuscriptAuditEntry } from '../../types';

// Mock PHI Scanner
class MockPhiScanner implements PhiScanner {
  private mockFindings: PhiFinding[] = [];
  private shouldFail = false;

  setMockFindings(findings: PhiFinding[]): void {
    this.mockFindings = findings;
  }

  setShouldFail(shouldFail: boolean): void {
    this.shouldFail = shouldFail;
  }

  scan(content: string): PhiFinding[] {
    if (this.shouldFail) {
      throw new Error('Scanner failure - database unavailable');
    }
    return this.mockFindings;
  }

  hasPhi(content: string): boolean {
    if (this.shouldFail) {
      throw new Error('Scanner failure');
    }
    return this.mockFindings.length > 0;
  }

  redact(content: string): string {
    if (this.shouldFail) {
      throw new Error('Redaction failure');
    }
    // Simple redaction: replace findings with [REDACTED]
    let redacted = content;
    for (const finding of this.mockFindings) {
      const before = content.substring(0, finding.startIndex);
      const after = content.substring(finding.endIndex);
      redacted = before + '[REDACTED]' + after;
    }
    return redacted;
  }
}

describe('PhiGuardService', () => {
  let mockScanner: MockPhiScanner;
  let auditLog: ManuscriptAuditEntry[];
  let auditLogger: (entry: ManuscriptAuditEntry) => Promise<void>;
  let config: PhiGuardConfig;

  beforeEach(() => {
    // Reset singleton for each test
    (PhiGuardService as any).instance = undefined;

    mockScanner = new MockPhiScanner();
    auditLog = [];
    auditLogger = async (entry: ManuscriptAuditEntry) => {
      auditLog.push(entry);
    };

    config = {
      scanner: mockScanner,
      failClosed: true,
      auditLogger,
    };
  });

  describe('Initialization and Singleton', () => {
    it('should create instance with valid config', () => {
      const service = PhiGuardService.getInstance(config);
      expect(service).toBeInstanceOf(PhiGuardService);
    });

    it('should return same instance on subsequent calls', () => {
      const service1 = PhiGuardService.getInstance(config);
      const service2 = PhiGuardService.getInstance();
      expect(service1).toBe(service2);
    });

    it('should throw error if first call without config', () => {
      expect(() => PhiGuardService.getInstance()).toThrow(
        'PHI Guard config required for first initialization'
      );
    });

    it('should work with factory function', () => {
      const service = getPhiGuard(config);
      expect(service).toBeInstanceOf(PhiGuardService);
    });
  });

  describe('Fail-Closed Security', () => {
    it('should enforce fail-closed in production', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      const nonFailClosedConfig: PhiGuardConfig = {
        scanner: mockScanner,
        failClosed: false,
      };

      expect(() => PhiGuardService.getInstance(nonFailClosedConfig)).toThrow(
        'SECURITY: PHI Guard MUST be fail-closed in production'
      );

      process.env.NODE_ENV = originalEnv;
    });

    it('should allow non-fail-closed in development', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';

      const nonFailClosedConfig: PhiGuardConfig = {
        scanner: mockScanner,
        failClosed: false,
      };

      expect(() => PhiGuardService.getInstance(nonFailClosedConfig)).not.toThrow();

      process.env.NODE_ENV = originalEnv;
    });
  });

  describe('scanBeforeInsertion - Clean Content', () => {
    it('should pass scan for clean content', async () => {
      const service = PhiGuardService.getInstance(config);
      mockScanner.setMockFindings([]);

      const result = await service.scanBeforeInsertion(
        'This is clean medical research content about diabetes.',
        {
          manuscriptId: 'ms-001',
          section: 'results',
          userId: 'user-001',
        }
      );

      expect(result.passed).toBe(true);
      expect(result.findings).toHaveLength(0);
      expect(result.riskLevel).toBe('none');
      expect(result.scannedAt).toBeInstanceOf(Date);
    });

    it('should log audit entry for clean content', async () => {
      const service = PhiGuardService.getInstance(config);
      mockScanner.setMockFindings([]);

      await service.scanBeforeInsertion('Clean content', {
        manuscriptId: 'ms-001',
        section: 'methods',
        userId: 'user-001',
      });

      expect(auditLog).toHaveLength(1);
      expect(auditLog[0].action).toBe('PHI_SCAN');
      expect(auditLog[0].manuscriptId).toBe('ms-001');
      expect(auditLog[0].details.passed).toBe(true);
      expect(auditLog[0].details.section).toBe('methods');
      expect(auditLog[0].details.findingsCount).toBe(0);
    });
  });

  describe('scanBeforeInsertion - PHI Detected', () => {
    it('should throw PHIDetectedError when PHI found with fail-closed', async () => {
      const service = PhiGuardService.getInstance(config);

      const findings: PhiFinding[] = [
        {
          type: 'SSN',
          value: '123-45-6789',
          startIndex: 10,
          endIndex: 21,
          confidence: 0.95,
        },
      ];
      mockScanner.setMockFindings(findings);

      await expect(
        service.scanBeforeInsertion('Patient SSN: 123-45-6789', {
          manuscriptId: 'ms-001',
          section: 'methods',
          userId: 'user-001',
        })
      ).rejects.toThrow(PHIDetectedError);
    });

    it('should include findings in PHIDetectedError', async () => {
      const service = PhiGuardService.getInstance(config);

      const findings: PhiFinding[] = [
        {
          type: 'MRN',
          value: 'MRN-12345',
          startIndex: 8,
          endIndex: 17,
          confidence: 0.98,
        },
      ];
      mockScanner.setMockFindings(findings);

      try {
        await service.scanBeforeInsertion('Patient MRN-12345', {
          manuscriptId: 'ms-001',
          section: 'results',
          userId: 'user-001',
        });
        expect.fail('Should have thrown PHIDetectedError');
      } catch (error) {
        expect(error).toBeInstanceOf(PHIDetectedError);
        expect((error as PHIDetectedError).findings).toHaveLength(1);
        expect((error as PHIDetectedError).findings[0].type).toBe('MRN');
      }
    });

    it('should log audit entry even when PHI detected', async () => {
      const service = PhiGuardService.getInstance(config);

      const findings: PhiFinding[] = [
        {
          type: 'PHONE',
          value: '555-1234',
          startIndex: 6,
          endIndex: 14,
          confidence: 0.90,
        },
      ];
      mockScanner.setMockFindings(findings);

      try {
        await service.scanBeforeInsertion('Phone 555-1234', {
          manuscriptId: 'ms-001',
          section: 'results',
          userId: 'user-001',
        });
      } catch (error) {
        // Expected to throw
      }

      expect(auditLog).toHaveLength(1);
      expect(auditLog[0].details.passed).toBe(false);
      expect(auditLog[0].details.findingsCount).toBe(1);
      expect(auditLog[0].details.riskLevel).toBe('low');
    });

    it('should return result without throwing when not fail-closed', async () => {
      (PhiGuardService as any).instance = undefined;
      const nonFailClosedConfig: PhiGuardConfig = {
        scanner: mockScanner,
        failClosed: false,
        auditLogger,
      };
      const service = PhiGuardService.getInstance(nonFailClosedConfig);

      const findings: PhiFinding[] = [
        {
          type: 'EMAIL',
          value: 'patient@example.com',
          startIndex: 7,
          endIndex: 27,
          confidence: 0.95,
        },
      ];
      mockScanner.setMockFindings(findings);

      const result = await service.scanBeforeInsertion('Email: patient@example.com', {
        manuscriptId: 'ms-001',
        section: 'methods',
        userId: 'user-001',
      });

      expect(result.passed).toBe(false);
      expect(result.findings).toHaveLength(1);
    });
  });

  describe('scanBeforeInsertion - Scanner Failure', () => {
    it('should throw PHIScanFailureError when scanner fails with fail-closed', async () => {
      const service = PhiGuardService.getInstance(config);
      mockScanner.setShouldFail(true);

      await expect(
        service.scanBeforeInsertion('Any content', {
          manuscriptId: 'ms-001',
          section: 'results',
          userId: 'user-001',
        })
      ).rejects.toThrow(PHIScanFailureError);
    });

    it('should include cause in PHIScanFailureError', async () => {
      const service = PhiGuardService.getInstance(config);
      mockScanner.setShouldFail(true);

      try {
        await service.scanBeforeInsertion('Any content', {
          manuscriptId: 'ms-001',
          section: 'results',
          userId: 'user-001',
        });
        expect.fail('Should have thrown PHIScanFailureError');
      } catch (error) {
        expect(error).toBeInstanceOf(PHIScanFailureError);
        expect((error as PHIScanFailureError).cause).toBeDefined();
      }
    });

    it('should return high-risk result when scanner fails without fail-closed', async () => {
      (PhiGuardService as any).instance = undefined;
      const nonFailClosedConfig: PhiGuardConfig = {
        scanner: mockScanner,
        failClosed: false,
      };
      const service = PhiGuardService.getInstance(nonFailClosedConfig);
      mockScanner.setShouldFail(true);

      const result = await service.scanBeforeInsertion('Any content', {
        manuscriptId: 'ms-001',
        section: 'results',
        userId: 'user-001',
      });

      expect(result.passed).toBe(false);
      expect(result.findings).toHaveLength(0);
      expect(result.riskLevel).toBe('high');
    });
  });

  describe('redactAndLog - Clean Content', () => {
    it('should return unmodified content when no PHI found', async () => {
      const service = PhiGuardService.getInstance(config);
      mockScanner.setMockFindings([]);

      const content = 'This is clean research content.';
      const result = await service.redactAndLog(content, {
        manuscriptId: 'ms-001',
        userId: 'user-001',
      });

      expect(result.content).toBe(content);
      expect(result.redacted).toBe(false);
      expect(result.originalLength).toBe(content.length);
      expect(result.redactedLength).toBe(content.length);
      expect(result.findingsCount).toBe(0);
    });

    it('should not log audit entry when no redaction needed', async () => {
      const service = PhiGuardService.getInstance(config);
      mockScanner.setMockFindings([]);

      await service.redactAndLog('Clean content', {
        manuscriptId: 'ms-001',
        userId: 'user-001',
      });

      // No audit log for clean content in redactAndLog
      expect(auditLog).toHaveLength(0);
    });
  });

  describe('redactAndLog - PHI Content', () => {
    it('should redact PHI and return modified content', async () => {
      const service = PhiGuardService.getInstance(config);

      const findings: PhiFinding[] = [
        {
          type: 'SSN',
          value: '123-45-6789',
          startIndex: 12,
          endIndex: 23,
          confidence: 0.95,
        },
      ];
      mockScanner.setMockFindings(findings);

      const content = 'Patient SSN 123-45-6789 enrolled.';
      const result = await service.redactAndLog(content, {
        manuscriptId: 'ms-001',
        userId: 'user-001',
      });

      expect(result.content).toContain('[REDACTED]');
      expect(result.content).not.toContain('123-45-6789');
      expect(result.redacted).toBe(true);
      expect(result.findingsCount).toBe(1);
      expect(result.originalLength).toBe(content.length);
      expect(result.redactedLength).toBeLessThan(result.originalLength);
    });

    it('should log audit entry for redaction', async () => {
      const service = PhiGuardService.getInstance(config);

      const findings: PhiFinding[] = [
        {
          type: 'MRN',
          value: 'MRN-12345',
          startIndex: 8,
          endIndex: 17,
          confidence: 0.98,
        },
      ];
      mockScanner.setMockFindings(findings);

      await service.redactAndLog('Patient MRN-12345', {
        manuscriptId: 'ms-002',
        userId: 'user-002',
      });

      expect(auditLog).toHaveLength(1);
      expect(auditLog[0].action).toBe('PHI_REDACTION');
      expect(auditLog[0].manuscriptId).toBe('ms-002');
      expect(auditLog[0].userId).toBe('user-002');
      expect(auditLog[0].details.findingsCount).toBe(1);
      expect(auditLog[0].previousHash).toBeDefined();
      expect(auditLog[0].currentHash).toBeDefined();
      expect(auditLog[0].previousHash).not.toBe(auditLog[0].currentHash);
    });

    it('should handle multiple PHI findings', async () => {
      const service = PhiGuardService.getInstance(config);

      const findings: PhiFinding[] = [
        {
          type: 'NAME',
          value: 'John Doe',
          startIndex: 8,
          endIndex: 16,
          confidence: 0.90,
        },
        {
          type: 'PHONE',
          value: '555-1234',
          startIndex: 24,
          endIndex: 32,
          confidence: 0.88,
        },
      ];
      mockScanner.setMockFindings(findings);

      const result = await service.redactAndLog('Patient John Doe, phone 555-1234', {
        manuscriptId: 'ms-001',
        userId: 'user-001',
      });

      expect(result.findingsCount).toBe(2);
      expect(result.redacted).toBe(true);
    });
  });

  describe('hasPhi - Quick Check', () => {
    it('should return false for clean content', () => {
      const service = PhiGuardService.getInstance(config);
      mockScanner.setMockFindings([]);

      const result = service.hasPhi('Clean research content');

      expect(result).toBe(false);
    });

    it('should return true when PHI present', () => {
      const service = PhiGuardService.getInstance(config);

      const findings: PhiFinding[] = [
        {
          type: 'EMAIL',
          value: 'test@example.com',
          startIndex: 0,
          endIndex: 16,
          confidence: 0.95,
        },
      ];
      mockScanner.setMockFindings(findings);

      const result = service.hasPhi('test@example.com in content');

      expect(result).toBe(true);
    });
  });

  describe('Risk Level Assessment', () => {
    it('should return "none" for no findings', async () => {
      const service = PhiGuardService.getInstance(config);
      mockScanner.setMockFindings([]);

      const result = await service.scanBeforeInsertion('Clean content', {
        manuscriptId: 'ms-001',
        section: 'results',
        userId: 'user-001',
      });

      expect(result.riskLevel).toBe('none');
    });

    it('should return "low" for single non-critical finding', async () => {
      (PhiGuardService as any).instance = undefined;
      const nonFailClosedConfig: PhiGuardConfig = {
        scanner: mockScanner,
        failClosed: false,
        auditLogger,
      };
      const service = PhiGuardService.getInstance(nonFailClosedConfig);

      const findings: PhiFinding[] = [
        {
          type: 'ZIP_CODE',
          value: '12345',
          startIndex: 0,
          endIndex: 5,
          confidence: 0.85,
        },
      ];
      mockScanner.setMockFindings(findings);

      const result = await service.scanBeforeInsertion('12345', {
        manuscriptId: 'ms-001',
        section: 'results',
        userId: 'user-001',
      });

      expect(result.riskLevel).toBe('low');
    });

    it('should return "medium" for two non-critical findings', async () => {
      (PhiGuardService as any).instance = undefined;
      const nonFailClosedConfig: PhiGuardConfig = {
        scanner: mockScanner,
        failClosed: false,
        auditLogger,
      };
      const service = PhiGuardService.getInstance(nonFailClosedConfig);

      const findings: PhiFinding[] = [
        {
          type: 'ZIP_CODE',
          value: '12345',
          startIndex: 0,
          endIndex: 5,
          confidence: 0.85,
        },
        {
          type: 'DOB',
          value: '2023-01-01',
          startIndex: 10,
          endIndex: 20,
          confidence: 0.90,
        },
      ];
      mockScanner.setMockFindings(findings);

      const result = await service.scanBeforeInsertion('12345 and 2023-01-01', {
        manuscriptId: 'ms-001',
        section: 'results',
        userId: 'user-001',
      });

      expect(result.riskLevel).toBe('medium');
    });

    it('should return "high" for SSN (high-risk identifier)', async () => {
      (PhiGuardService as any).instance = undefined;
      const nonFailClosedConfig: PhiGuardConfig = {
        scanner: mockScanner,
        failClosed: false,
        auditLogger,
      };
      const service = PhiGuardService.getInstance(nonFailClosedConfig);

      const findings: PhiFinding[] = [
        {
          type: 'SSN',
          value: '123-45-6789',
          startIndex: 0,
          endIndex: 11,
          confidence: 0.95,
        },
      ];
      mockScanner.setMockFindings(findings);

      const result = await service.scanBeforeInsertion('123-45-6789', {
        manuscriptId: 'ms-001',
        section: 'results',
        userId: 'user-001',
      });

      expect(result.riskLevel).toBe('high');
    });

    it('should return "high" for MRN (high-risk identifier)', async () => {
      (PhiGuardService as any).instance = undefined;
      const nonFailClosedConfig: PhiGuardConfig = {
        scanner: mockScanner,
        failClosed: false,
        auditLogger,
      };
      const service = PhiGuardService.getInstance(nonFailClosedConfig);

      const findings: PhiFinding[] = [
        {
          type: 'MRN',
          value: 'MRN-12345',
          startIndex: 0,
          endIndex: 9,
          confidence: 0.98,
        },
      ];
      mockScanner.setMockFindings(findings);

      const result = await service.scanBeforeInsertion('MRN-12345', {
        manuscriptId: 'ms-001',
        section: 'results',
        userId: 'user-001',
      });

      expect(result.riskLevel).toBe('high');
    });

    it('should return "high" for HEALTH_PLAN identifier', async () => {
      (PhiGuardService as any).instance = undefined;
      const nonFailClosedConfig: PhiGuardConfig = {
        scanner: mockScanner,
        failClosed: false,
        auditLogger,
      };
      const service = PhiGuardService.getInstance(nonFailClosedConfig);

      const findings: PhiFinding[] = [
        {
          type: 'HEALTH_PLAN',
          value: 'Plan-67890',
          startIndex: 0,
          endIndex: 10,
          confidence: 0.92,
        },
      ];
      mockScanner.setMockFindings(findings);

      const result = await service.scanBeforeInsertion('Plan-67890', {
        manuscriptId: 'ms-001',
        section: 'results',
        userId: 'user-001',
      });

      expect(result.riskLevel).toBe('high');
    });

    it('should return "high" for ACCOUNT identifier', async () => {
      (PhiGuardService as any).instance = undefined;
      const nonFailClosedConfig: PhiGuardConfig = {
        scanner: mockScanner,
        failClosed: false,
        auditLogger,
      };
      const service = PhiGuardService.getInstance(nonFailClosedConfig);

      const findings: PhiFinding[] = [
        {
          type: 'ACCOUNT',
          value: 'Account-999',
          startIndex: 0,
          endIndex: 11,
          confidence: 0.91,
        },
      ];
      mockScanner.setMockFindings(findings);

      const result = await service.scanBeforeInsertion('Account-999', {
        manuscriptId: 'ms-001',
        section: 'results',
        userId: 'user-001',
      });

      expect(result.riskLevel).toBe('high');
    });

    it('should return "high" for 3+ findings', async () => {
      (PhiGuardService as any).instance = undefined;
      const nonFailClosedConfig: PhiGuardConfig = {
        scanner: mockScanner,
        failClosed: false,
        auditLogger,
      };
      const service = PhiGuardService.getInstance(nonFailClosedConfig);

      const findings: PhiFinding[] = [
        {
          type: 'ZIP_CODE',
          value: '12345',
          startIndex: 0,
          endIndex: 5,
          confidence: 0.85,
        },
        {
          type: 'DOB',
          value: '2023-01-01',
          startIndex: 10,
          endIndex: 20,
          confidence: 0.90,
        },
        {
          type: 'EMAIL',
          value: 'test@example.com',
          startIndex: 25,
          endIndex: 41,
          confidence: 0.95,
        },
      ];
      mockScanner.setMockFindings(findings);

      const result = await service.scanBeforeInsertion('12345 and 2023-01-01 test@example.com', {
        manuscriptId: 'ms-001',
        section: 'results',
        userId: 'user-001',
      });

      expect(result.riskLevel).toBe('high');
    });
  });

  describe('Content Hashing', () => {
    it('should generate consistent hash for same content', async () => {
      const service = PhiGuardService.getInstance(config);
      mockScanner.setMockFindings([]);

      const content = 'Consistent content for hashing';

      await service.scanBeforeInsertion(content, {
        manuscriptId: 'ms-001',
        section: 'results',
        userId: 'user-001',
      });
      const hash1 = auditLog[0].currentHash;

      auditLog = [];
      await service.scanBeforeInsertion(content, {
        manuscriptId: 'ms-002',
        section: 'methods',
        userId: 'user-002',
      });
      const hash2 = auditLog[0].currentHash;

      expect(hash1).toBe(hash2);
    });

    it('should generate different hashes for different content', async () => {
      const service = PhiGuardService.getInstance(config);
      mockScanner.setMockFindings([]);

      await service.scanBeforeInsertion('Content A', {
        manuscriptId: 'ms-001',
        section: 'results',
        userId: 'user-001',
      });
      const hash1 = auditLog[0].currentHash;

      auditLog = [];
      await service.scanBeforeInsertion('Content B', {
        manuscriptId: 'ms-001',
        section: 'results',
        userId: 'user-001',
      });
      const hash2 = auditLog[0].currentHash;

      expect(hash1).not.toBe(hash2);
    });

    it('should generate hash of correct format', async () => {
      const service = PhiGuardService.getInstance(config);
      mockScanner.setMockFindings([]);

      await service.scanBeforeInsertion('Test content', {
        manuscriptId: 'ms-001',
        section: 'results',
        userId: 'user-001',
      });

      const hash = auditLog[0].currentHash;
      expect(hash).toMatch(/^[0-9a-f]{16}$/);
    });
  });

  describe('Audit Logging', () => {
    it('should include UUID in audit entry', async () => {
      const service = PhiGuardService.getInstance(config);
      mockScanner.setMockFindings([]);

      await service.scanBeforeInsertion('Content', {
        manuscriptId: 'ms-001',
        section: 'results',
        userId: 'user-001',
      });

      expect(auditLog[0].id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
      );
    });

    it('should work without audit logger', async () => {
      (PhiGuardService as any).instance = undefined;
      const configWithoutLogger: PhiGuardConfig = {
        scanner: mockScanner,
        failClosed: true,
      };
      const service = PhiGuardService.getInstance(configWithoutLogger);
      mockScanner.setMockFindings([]);

      await expect(
        service.scanBeforeInsertion('Content', {
          manuscriptId: 'ms-001',
          section: 'results',
          userId: 'user-001',
        })
      ).resolves.not.toThrow();
    });
  });

  describe('Error Types', () => {
    it('PHIDetectedError should have correct name', () => {
      const error = new PHIDetectedError('Test message', []);
      expect(error.name).toBe('PHIDetectedError');
      expect(error).toBeInstanceOf(Error);
    });

    it('PHIScanFailureError should have correct name', () => {
      const error = new PHIScanFailureError('Test message');
      expect(error.name).toBe('PHIScanFailureError');
      expect(error).toBeInstanceOf(Error);
    });

    it('PHIScanFailureError should store cause', () => {
      const cause = new Error('Original error');
      const error = new PHIScanFailureError('Wrapper message', cause);
      expect(error.cause).toBe(cause);
    });
  });
});
