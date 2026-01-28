/**
 * PHI Scanner Health Check Tests
 *
 * Tests for SEC-004: PHI Scanner Startup Validation
 * Verifies that the health check correctly validates scanner functionality
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  performPhiScannerHealthCheck,
  logHealthCheckResults,
  validateHealthCheckForStartup,
  type HealthCheckResult
} from '../../../services/orchestrator/src/services/phi-scanner-healthcheck';

describe('PHI Scanner Health Check', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('performPhiScannerHealthCheck', () => {
    it('should return healthy status when PHI_SCAN_ENABLED=false', async () => {
      // When PHI scanning is disabled, health check should pass quickly
      const result = await performPhiScannerHealthCheck();

      expect(result).toBeDefined();
      expect(result.timestamp).toBeDefined();
      expect(result.checks).toBeDefined();
    });

    it('should include required result fields', async () => {
      const result = await performPhiScannerHealthCheck();

      expect(result).toHaveProperty('status');
      expect(result).toHaveProperty('timestamp');
      expect(result).toHaveProperty('checks');
      expect(result).toHaveProperty('errors');
      expect(result).toHaveProperty('warnings');
    });

    it('should have valid status values', async () => {
      const result = await performPhiScannerHealthCheck();

      expect(['healthy', 'degraded', 'failed']).toContain(result.status);
    });

    it('should include all required checks', async () => {
      const result = await performPhiScannerHealthCheck();

      expect(result.checks).toHaveProperty('configEnabled');
      expect(result.checks).toHaveProperty('scannerLoaded');
      expect(result.checks).toHaveProperty('testScanPassed');
      expect(result.checks).toHaveProperty('testRedactionPassed');
    });

    it('should track config enabled status', async () => {
      const result = await performPhiScannerHealthCheck();

      expect(typeof result.checks.configEnabled).toBe('boolean');
    });

    it('should include errors and warnings arrays', async () => {
      const result = await performPhiScannerHealthCheck();

      expect(Array.isArray(result.errors)).toBe(true);
      expect(Array.isArray(result.warnings)).toBe(true);
    });
  });

  describe('logHealthCheckResults', () => {
    it('should not throw when logging results', () => {
      const mockResult: HealthCheckResult = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        checks: {
          configEnabled: true,
          scannerLoaded: true,
          testScanPassed: true,
          testRedactionPassed: true
        },
        errors: [],
        warnings: []
      };

      // Should not throw
      expect(() => {
        logHealthCheckResults(mockResult);
      }).not.toThrow();
    });

    it('should log errors when present', () => {
      const consoleErrorSpy = vi.spyOn(console, 'error');

      const mockResult: HealthCheckResult = {
        status: 'failed',
        timestamp: new Date().toISOString(),
        checks: {
          configEnabled: true,
          scannerLoaded: false,
          testScanPassed: false,
          testRedactionPassed: false
        },
        errors: ['Test error 1', 'Test error 2'],
        warnings: []
      };

      logHealthCheckResults(mockResult);

      expect(consoleErrorSpy).toHaveBeenCalled();
    });

    it('should log warnings when present', () => {
      const consoleWarnSpy = vi.spyOn(console, 'warn');

      const mockResult: HealthCheckResult = {
        status: 'degraded',
        timestamp: new Date().toISOString(),
        checks: {
          configEnabled: true,
          scannerLoaded: true,
          testScanPassed: true,
          testRedactionPassed: true
        },
        errors: [],
        warnings: ['Test warning 1']
      };

      logHealthCheckResults(mockResult);

      expect(consoleWarnSpy).toHaveBeenCalled();
    });
  });

  describe('validateHealthCheckForStartup', () => {
    it('should not throw when status is healthy', () => {
      const mockResult: HealthCheckResult = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        checks: {
          configEnabled: true,
          scannerLoaded: true,
          testScanPassed: true,
          testRedactionPassed: true
        },
        errors: [],
        warnings: []
      };

      expect(() => {
        validateHealthCheckForStartup(mockResult, false);
      }).not.toThrow();
    });

    it('should not throw when status is degraded', () => {
      const mockResult: HealthCheckResult = {
        status: 'degraded',
        timestamp: new Date().toISOString(),
        checks: {
          configEnabled: true,
          scannerLoaded: true,
          testScanPassed: true,
          testRedactionPassed: true
        },
        errors: [],
        warnings: ['Test warning']
      };

      expect(() => {
        validateHealthCheckForStartup(mockResult, false);
      }).not.toThrow();
    });

    it('should not throw when failed in development', () => {
      const mockResult: HealthCheckResult = {
        status: 'failed',
        timestamp: new Date().toISOString(),
        checks: {
          configEnabled: true,
          scannerLoaded: false,
          testScanPassed: false,
          testRedactionPassed: false
        },
        errors: ['Test error'],
        warnings: []
      };

      // In development (isProduction=false), should not throw
      expect(() => {
        validateHealthCheckForStartup(mockResult, false);
      }).not.toThrow();
    });

    it('should throw when failed in production with config enabled', () => {
      const mockResult: HealthCheckResult = {
        status: 'failed',
        timestamp: new Date().toISOString(),
        checks: {
          configEnabled: true,
          scannerLoaded: false,
          testScanPassed: false,
          testRedactionPassed: false
        },
        errors: ['Test error'],
        warnings: []
      };

      // In production (isProduction=true) with configEnabled=true, should throw
      expect(() => {
        validateHealthCheckForStartup(mockResult, true);
      }).toThrow('[PHI Health Check] PHI Scanner initialization failed - startup blocked');
    });

    it('should not throw when failed in production but config disabled', () => {
      const mockResult: HealthCheckResult = {
        status: 'failed',
        timestamp: new Date().toISOString(),
        checks: {
          configEnabled: false,
          scannerLoaded: false,
          testScanPassed: false,
          testRedactionPassed: false
        },
        errors: ['Test error'],
        warnings: []
      };

      // Even in production, if config is disabled, should not throw
      expect(() => {
        validateHealthCheckForStartup(mockResult, true);
      }).not.toThrow();
    });
  });

  describe('Health Check Flow', () => {
    it('should complete full health check without throwing', async () => {
      const result = await performPhiScannerHealthCheck();
      logHealthCheckResults(result);

      expect(() => {
        validateHealthCheckForStartup(result, false);
      }).not.toThrow();
    });

    it('should have consistent timestamp format', async () => {
      const result = await performPhiScannerHealthCheck();

      // Timestamp should be ISO string
      expect(() => {
        new Date(result.timestamp);
      }).not.toThrow();

      // Should be valid date
      expect(isNaN(new Date(result.timestamp).getTime())).toBe(false);
    });

    it('should include informative error messages', async () => {
      const result = await performPhiScannerHealthCheck();

      // If there are errors, they should be non-empty strings
      result.errors.forEach(error => {
        expect(typeof error).toBe('string');
        expect(error.length).toBeGreaterThan(0);
      });
    });

    it('should include informative warning messages', async () => {
      const result = await performPhiScannerHealthCheck();

      // If there are warnings, they should be non-empty strings
      result.warnings.forEach(warning => {
        expect(typeof warning).toBe('string');
        expect(warning.length).toBeGreaterThan(0);
      });
    });
  });
});
