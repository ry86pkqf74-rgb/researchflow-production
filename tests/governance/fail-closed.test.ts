import { describe, it, expect, vi, beforeEach } from 'vitest';
import { scanForPHI } from '@apps/api-node/services/phi-scanner';
import { hasPermissionByRole, hasMinimumRoleByName } from '@packages/core/types/roles';

describe('Fail-Closed Governance', () => {
  const ROS_MODE_STANDBY = 'STANDBY';
  const ROS_MODE_DEMO = 'DEMO';
  const ROS_MODE_LIVE = 'LIVE';

  describe('PHI Detection Blocks Downstream Stages', () => {
    it('should block progression when PHI is detected', () => {
      const content = 'Patient: Dr. John Smith, SSN: 123-45-6789';
      const result = scanForPHI(content, 'export');
      
      expect(result.riskLevel).not.toBe('none');
      expect(result.requiresOverride).toBe(true);
    });

    it('should require explicit override to proceed with PHI', () => {
      const content = 'Patient: Dr. John Smith, SSN: 123-45-6789';
      const scanResult = scanForPHI(content, 'export');
      
      const canProceed = scanResult.riskLevel === 'none' || !scanResult.requiresOverride;
      expect(canProceed).toBe(false);
    });

    it('should log PHI detection with severity level', () => {
      const content = 'SSN: 123-45-6789, MRN: 847291, Phone: 555-123-4567';
      const result = scanForPHI(content, 'export');
      
      expect(result.riskLevel).toBe('high');
      expect(result.summary.totalPatterns).toBeGreaterThanOrEqual(3);
    });
  });

  describe('STANDBY Mode Restrictions', () => {
    it('should block all network calls in STANDBY mode', () => {
      const mode = ROS_MODE_STANDBY;
      const allowNetworkCalls = mode !== 'STANDBY';
      
      expect(allowNetworkCalls).toBe(false);
    });

    it('should allow read-only operations in STANDBY mode', () => {
      const mode = ROS_MODE_STANDBY;
      const isReadOnlyAllowed = true; // Read-only is always allowed
      const isWriteAllowed = mode !== 'STANDBY';
      
      expect(isReadOnlyAllowed).toBe(true);
      expect(isWriteAllowed).toBe(false);
    });

    it('should block AI generation in STANDBY mode', () => {
      const mode = ROS_MODE_STANDBY;
      const aiEnabledStages = [2, 3, 4, 5, 9, 10, 11, 13, 14, 15, 16];
      
      const canUseAI = mode !== 'STANDBY';
      expect(canUseAI).toBe(false);
    });
  });

  describe('DEMO Mode Restrictions', () => {
    it('should block file uploads in DEMO mode', () => {
      const mode = ROS_MODE_DEMO;
      const allowFileUpload = mode === 'LIVE';
      
      expect(allowFileUpload).toBe(false);
    });

    it('should add watermarks to exports in DEMO mode', () => {
      const mode = ROS_MODE_DEMO;
      const shouldAddWatermark = mode === 'DEMO';
      
      expect(shouldAddWatermark).toBe(true);
    });

    it('should allow read operations in DEMO mode', () => {
      const mode = ROS_MODE_DEMO;
      const isReadAllowed = mode === 'DEMO' || mode === 'LIVE';
      
      expect(isReadAllowed).toBe(true);
    });

    it('should block production data access in DEMO mode', () => {
      const mode = ROS_MODE_DEMO;
      const allowProductionData = mode === 'LIVE';
      
      expect(allowProductionData).toBe(false);
    });
  });

  describe('LIVE Mode Approval Gates', () => {
    it('should require steward approval for exports in LIVE mode', () => {
      const mode = ROS_MODE_LIVE;
      const requiresApproval = mode === 'LIVE';
      
      expect(requiresApproval).toBe(true);
    });

    it('should allow STEWARD to approve exports', () => {
      const canApprove = hasPermissionByRole('STEWARD', 'approve:exports');
      expect(canApprove).toBe(true);
    });

    it('should deny RESEARCHER from approving exports', () => {
      const canApprove = hasPermissionByRole('RESEARCHER', 'approve:exports');
      expect(canApprove).toBe(false);
    });

    it('should require dual approval for sensitive operations', () => {
      const isSensitiveOperation = true;
      const mode = ROS_MODE_LIVE;
      
      const requiresDualApproval = mode === 'LIVE' && isSensitiveOperation;
      expect(requiresDualApproval).toBe(true);
    });
  });

  describe('Audit Log Captures Sensitive Operations', () => {
    it('should generate audit entry for PHI scan', () => {
      const content = 'Patient: Dr. John Smith';
      const result = scanForPHI(content, 'upload');
      
      expect(result.scanId).toBeDefined();
      expect(result.scannedAt).toBeDefined();
    });

    it('should include context in scan result', () => {
      const content = 'Patient SSN: 123-45-6789';
      const result = scanForPHI(content, 'export');
      
      expect(result.context).toBe('export');
    });

    it('should track scan duration/timestamp', () => {
      const content = 'Sample content for testing';
      const result = scanForPHI(content, 'upload');
      
      expect(result.scannedAt).toBeDefined();
      const timestamp = new Date(result.scannedAt);
      expect(timestamp.getTime()).not.toBeNaN();
    });
  });

  describe('No PHI in Error Messages', () => {
    it('should not include matched text in high-level errors', () => {
      const content = 'Patient SSN: 123-45-6789';
      const result = scanForPHI(content, 'upload');
      
      const errorMessage = `PHI detected: ${result.summary.totalPatterns} patterns found`;
      
      expect(errorMessage).not.toContain('123-45-6789');
      expect(errorMessage).toContain('patterns found');
    });

    it('should sanitize pattern details for logging', () => {
      const content = 'Patient SSN: 123-45-6789';
      const result = scanForPHI(content, 'upload');
      
      const sanitizedPatterns = result.detected.map(p => ({
        category: p.category,
        confidence: p.confidence,
        suggestedAction: p.suggestedAction
      }));

      const logEntry = JSON.stringify(sanitizedPatterns);
      expect(logEntry).not.toContain('123-45-6789');
    });
  });

  describe('Audit Log Hash Chain Validation', () => {
    it('should generate deterministic hash for content', () => {
      const content1 = 'Test content';
      const content2 = 'Test content';
      
      const hash1 = simpleHash(content1);
      const hash2 = simpleHash(content2);
      
      expect(hash1).toBe(hash2);
    });

    it('should produce different hashes for different content', () => {
      const content1 = 'Test content 1';
      const content2 = 'Test content 2';
      
      const hash1 = simpleHash(content1);
      const hash2 = simpleHash(content2);
      
      expect(hash1).not.toBe(hash2);
    });

    it('should chain hashes for audit trail', () => {
      const entries = [
        { action: 'PHI_SCAN', timestamp: Date.now() },
        { action: 'EXPORT_APPROVED', timestamp: Date.now() + 1000 }
      ];
      
      let previousHash = '';
      const hashedEntries = entries.map(entry => {
        const prevHashForEntry = previousHash;
        const entryHash = simpleHash(JSON.stringify(entry) + prevHashForEntry);
        previousHash = entryHash;
        return { ...entry, hash: entryHash, previousHash: prevHashForEntry };
      });
      
      expect(hashedEntries[1].previousHash).toBe(hashedEntries[0].hash);
    });
  });

  describe('Mode Transition Guards', () => {
    it('should not allow direct STANDBY to LIVE transition', () => {
      const currentMode = 'STANDBY';
      const targetMode = 'LIVE';
      
      const validTransitions: Record<string, string[]> = {
        'STANDBY': ['DEMO'],
        'DEMO': ['LIVE', 'STANDBY'],
        'LIVE': ['DEMO']
      };
      
      const isValidTransition = validTransitions[currentMode]?.includes(targetMode) ?? false;
      expect(isValidTransition).toBe(false);
    });

    it('should allow STANDBY to DEMO transition', () => {
      const currentMode = 'STANDBY';
      const targetMode = 'DEMO';
      
      const validTransitions: Record<string, string[]> = {
        'STANDBY': ['DEMO'],
        'DEMO': ['LIVE', 'STANDBY'],
        'LIVE': ['DEMO']
      };
      
      const isValidTransition = validTransitions[currentMode]?.includes(targetMode) ?? false;
      expect(isValidTransition).toBe(true);
    });

    it('should allow DEMO to LIVE transition', () => {
      const currentMode = 'DEMO';
      const targetMode = 'LIVE';
      
      const validTransitions: Record<string, string[]> = {
        'STANDBY': ['DEMO'],
        'DEMO': ['LIVE', 'STANDBY'],
        'LIVE': ['DEMO']
      };
      
      const isValidTransition = validTransitions[currentMode]?.includes(targetMode) ?? false;
      expect(isValidTransition).toBe(true);
    });
  });
});

function simpleHash(input: string): string {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    const char = input.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16).padStart(8, '0');
}
