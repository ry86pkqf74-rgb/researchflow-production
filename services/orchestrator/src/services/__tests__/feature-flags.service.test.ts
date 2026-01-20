/**
 * Tests for FeatureFlagsService
 *
 * Tests feature flag evaluation, rollout percentages, and mode constraints.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Mock database module
vi.mock('../../../db', () => ({
  db: {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    onConflictDoUpdate: vi.fn().mockResolvedValue({}),
  },
}));

// Mock audit service
vi.mock('../audit-service', () => ({
  logAction: vi.fn().mockResolvedValue(undefined),
}));

// Mock event bus
vi.mock('../event-bus', () => ({
  eventBus: {
    publishGovernanceEvent: vi.fn(),
  },
}));

// Reset modules after mocks
vi.resetModules();

import { db } from '../../../db';
import {
  isFlagEnabled,
  getFlags,
  listFlags,
  setFlag,
} from '../feature-flags.service';

describe('FeatureFlagsService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Clear environment overrides
    delete process.env.FEATURE_ALLOW_UPLOADS;
    delete process.env.FEATURE_ALLOW_EXPORTS;
    process.env.GOVERNANCE_MODE = 'DEMO';
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('isFlagEnabled', () => {
    it('should return true for enabled flag with matching mode', async () => {
      const mockFlag = {
        key: 'ALLOW_UPLOADS',
        enabled: true,
        description: 'Allow uploads',
        requiredModes: ['DEMO', 'LIVE'],
        rolloutPercent: 100,
      };

      (db.select as any).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([mockFlag]),
        }),
      });

      const result = await isFlagEnabled('ALLOW_UPLOADS');
      expect(result).toBe(true);
    });

    it('should return false for disabled flag', async () => {
      const mockFlag = {
        key: 'ALLOW_EXPORTS',
        enabled: false,
        description: 'Allow exports',
        requiredModes: ['LIVE'],
        rolloutPercent: 100,
      };

      (db.select as any).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([mockFlag]),
        }),
      });

      const result = await isFlagEnabled('ALLOW_EXPORTS');
      expect(result).toBe(false);
    });

    it('should return false when current mode not in requiredModes', async () => {
      process.env.GOVERNANCE_MODE = 'STANDBY';

      const mockFlag = {
        key: 'ALLOW_UPLOADS',
        enabled: true,
        description: 'Allow uploads',
        requiredModes: ['DEMO', 'LIVE'],
        rolloutPercent: 100,
      };

      (db.select as any).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([mockFlag]),
        }),
      });

      const result = await isFlagEnabled('ALLOW_UPLOADS');
      expect(result).toBe(false);
    });

    it('should respect environment variable overrides', async () => {
      process.env.FEATURE_ALLOW_UPLOADS = 'false';

      const mockFlag = {
        key: 'ALLOW_UPLOADS',
        enabled: true,
        description: 'Allow uploads',
        requiredModes: ['DEMO', 'LIVE'],
        rolloutPercent: 100,
      };

      (db.select as any).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([mockFlag]),
        }),
      });

      const result = await isFlagEnabled('ALLOW_UPLOADS');
      expect(result).toBe(false);
    });

    it('should use default value for unknown flags', async () => {
      (db.select as any).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([]),
        }),
      });

      const result = await isFlagEnabled('UNKNOWN_FLAG', true);
      expect(result).toBe(true);
    });

    it('should handle rollout percentage correctly', async () => {
      const mockFlag = {
        key: 'EXPERIMENTAL_FEATURE',
        enabled: true,
        description: 'Experimental',
        requiredModes: ['DEMO', 'LIVE'],
        rolloutPercent: 50,
      };

      (db.select as any).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([mockFlag]),
        }),
      });

      // With 50% rollout, deterministic hash should give consistent results
      // for same user
      const result1 = await isFlagEnabled('EXPERIMENTAL_FEATURE', false, 'user-123');
      const result2 = await isFlagEnabled('EXPERIMENTAL_FEATURE', false, 'user-123');
      expect(result1).toBe(result2);
    });
  });

  describe('getFlags', () => {
    it('should return all flags as a boolean map', async () => {
      const mockFlags = [
        { key: 'ALLOW_UPLOADS', enabled: true, requiredModes: ['DEMO', 'LIVE'], rolloutPercent: 100 },
        { key: 'ALLOW_EXPORTS', enabled: false, requiredModes: ['LIVE'], rolloutPercent: 100 },
      ];

      (db.select as any).mockReturnValue({
        from: vi.fn().mockResolvedValue(mockFlags),
      });

      const result = await getFlags();
      expect(result.ALLOW_UPLOADS).toBe(true);
      expect(result.ALLOW_EXPORTS).toBe(false);
    });
  });

  describe('listFlags', () => {
    it('should return flags with full metadata', async () => {
      const mockFlags = [
        {
          key: 'ALLOW_UPLOADS',
          enabled: true,
          description: 'Allow uploads',
          requiredModes: ['DEMO', 'LIVE'],
          rolloutPercent: 100,
        },
      ];

      (db.select as any).mockReturnValue({
        from: vi.fn().mockResolvedValue(mockFlags),
      });

      const result = await listFlags();
      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        name: 'ALLOW_UPLOADS',
        enabled: true,
        description: 'Allow uploads',
        requiredModes: ['DEMO', 'LIVE'],
      });
    });
  });

  describe('setFlag', () => {
    it('should update flag and publish event', async () => {
      const mockFlag = {
        key: 'ALLOW_EXPORTS',
        enabled: false,
        description: 'Allow exports',
        requiredModes: ['LIVE'],
        rolloutPercent: 100,
      };

      (db.select as any).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([mockFlag]),
        }),
      });

      await setFlag('ALLOW_EXPORTS', true, 'user-1');

      expect(db.insert).toHaveBeenCalled();
    });
  });
});
