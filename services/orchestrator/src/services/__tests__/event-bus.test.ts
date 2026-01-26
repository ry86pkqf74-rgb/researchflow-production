/**
 * Tests for EventBus Service
 *
 * Tests pub/sub functionality, PHI safety validation, and event filtering.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Import directly for unit tests (no database dependency)
import { EventBus } from '../event-bus';

describe('EventBus', () => {
  let eventBus: EventBus;

  beforeEach(() => {
    eventBus = new EventBus();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('subscribe/publish', () => {
    it('should deliver events to subscribers', () => {
      const callback = vi.fn();
      eventBus.subscribe('governance', callback);

      eventBus.publishGovernanceEvent('governance.mode_changed', {
        previousMode: 'DEMO',
        newMode: 'LIVE',
        changedBy: 'user-1',
      });

      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'governance.mode_changed',
          data: expect.objectContaining({
            previousMode: 'DEMO',
            newMode: 'LIVE',
          }),
        })
      );
    });

    it('should not deliver events to wrong topic subscribers', () => {
      const governanceCallback = vi.fn();
      const jobsCallback = vi.fn();

      eventBus.subscribe('governance', governanceCallback);
      eventBus.subscribe('jobs', jobsCallback);

      eventBus.publishJobEvent('job.started', {
        jobId: 'job-123',
        timestamp: new Date().toISOString(),
      });

      expect(governanceCallback).not.toHaveBeenCalled();
      expect(jobsCallback).toHaveBeenCalledTimes(1);
    });

    it('should deliver all events to "all" topic subscribers', () => {
      const allCallback = vi.fn();
      eventBus.subscribe('all', allCallback);

      eventBus.publishGovernanceEvent('governance.mode_changed', {
        previousMode: 'DEMO',
        newMode: 'LIVE',
        changedBy: 'user-1',
      });

      eventBus.publishJobEvent('job.started', {
        jobId: 'job-123',
        timestamp: new Date().toISOString(),
      });

      expect(allCallback).toHaveBeenCalledTimes(2);
    });
  });

  describe('unsubscribe', () => {
    it('should stop delivering events after unsubscribe', () => {
      const callback = vi.fn();
      const unsubscribe = eventBus.subscribe('governance', callback);

      eventBus.publishGovernanceEvent('governance.mode_changed', {
        previousMode: 'DEMO',
        newMode: 'LIVE',
        changedBy: 'user-1',
      });

      expect(callback).toHaveBeenCalledTimes(1);

      // Unsubscribe
      unsubscribe();

      eventBus.publishGovernanceEvent('governance.mode_changed', {
        previousMode: 'LIVE',
        newMode: 'STANDBY',
        changedBy: 'user-1',
      });

      // Should still be 1, not 2
      expect(callback).toHaveBeenCalledTimes(1);
    });
  });

  describe('PHI safety', () => {
    it('should validate events contain no obvious PHI patterns', () => {
      const callback = vi.fn();
      eventBus.subscribe('governance', callback);

      // This should still work - service validates but doesn't reject
      eventBus.publishGovernanceEvent('governance.flag_changed', {
        flagKey: 'TEST_FLAG',
        enabled: true,
        changedBy: 'user-1',
      });

      expect(callback).toHaveBeenCalled();
    });

    it('should include timestamp in all events', () => {
      const callback = vi.fn();
      eventBus.subscribe('governance', callback);

      eventBus.publishGovernanceEvent('governance.mode_changed', {
        previousMode: 'DEMO',
        newMode: 'LIVE',
        changedBy: 'user-1',
      });

      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({
          timestamp: expect.any(String),
        })
      );
    });
  });

  describe('publishJobEvent', () => {
    it('should publish job started events', () => {
      const callback = vi.fn();
      eventBus.subscribe('jobs', callback);

      eventBus.publishJobEvent('job.started', {
        jobId: 'job-123',
        researchId: 'research-456',
        timestamp: new Date().toISOString(),
      });

      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'job.started',
          data: expect.objectContaining({
            jobId: 'job-123',
            researchId: 'research-456',
          }),
        })
      );
    });

    it('should publish job progress events', () => {
      const callback = vi.fn();
      eventBus.subscribe('jobs', callback);

      eventBus.publishJobEvent('job.progress', {
        jobId: 'job-123',
        progress: 50,
        stage: 'PHI_SCANNING',
        timestamp: new Date().toISOString(),
      });

      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'job.progress',
          data: expect.objectContaining({
            progress: 50,
            stage: 'PHI_SCANNING',
          }),
        })
      );
    });

    it('should publish job completed events', () => {
      const callback = vi.fn();
      eventBus.subscribe('jobs', callback);

      eventBus.publishJobEvent('job.completed', {
        jobId: 'job-123',
        researchId: 'research-456',
        timestamp: new Date().toISOString(),
      });

      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'job.completed',
        })
      );
    });

    it('should publish job failed events with error code', () => {
      const callback = vi.fn();
      eventBus.subscribe('jobs', callback);

      eventBus.publishJobEvent('job.failed', {
        jobId: 'job-123',
        errorCode: 'PHI_DETECTED',
        timestamp: new Date().toISOString(),
      });

      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'job.failed',
          data: expect.objectContaining({
            errorCode: 'PHI_DETECTED',
          }),
        })
      );
    });
  });

  describe('publishGovernanceEvent', () => {
    it('should publish mode changed events', () => {
      const callback = vi.fn();
      eventBus.subscribe('governance', callback);

      eventBus.publishGovernanceEvent('governance.mode_changed', {
        previousMode: 'DEMO',
        newMode: 'LIVE',
        changedBy: 'user-1',
      });

      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'governance.mode_changed',
        })
      );
    });

    it('should publish flag changed events', () => {
      const callback = vi.fn();
      eventBus.subscribe('governance', callback);

      eventBus.publishGovernanceEvent('governance.flag_changed', {
        flagKey: 'ALLOW_EXPORTS',
        previousValue: false,
        newValue: true,
        changedBy: 'user-1',
      });

      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'governance.flag_changed',
          data: expect.objectContaining({
            flagKey: 'ALLOW_EXPORTS',
            newValue: true,
          }),
        })
      );
    });
  });

  describe('multiple subscribers', () => {
    it('should deliver events to all subscribers on same topic', () => {
      const callback1 = vi.fn();
      const callback2 = vi.fn();
      const callback3 = vi.fn();

      eventBus.subscribe('governance', callback1);
      eventBus.subscribe('governance', callback2);
      eventBus.subscribe('governance', callback3);

      eventBus.publishGovernanceEvent('governance.mode_changed', {
        previousMode: 'DEMO',
        newMode: 'LIVE',
        changedBy: 'user-1',
      });

      expect(callback1).toHaveBeenCalledTimes(1);
      expect(callback2).toHaveBeenCalledTimes(1);
      expect(callback3).toHaveBeenCalledTimes(1);
    });

    it('should handle subscriber errors gracefully', () => {
      const errorCallback = vi.fn().mockImplementation(() => {
        throw new Error('Subscriber error');
      });
      const normalCallback = vi.fn();

      eventBus.subscribe('governance', errorCallback);
      eventBus.subscribe('governance', normalCallback);

      // Should not throw even with subscriber error
      expect(() => {
        eventBus.publishGovernanceEvent('governance.mode_changed', {
          previousMode: 'DEMO',
          newMode: 'LIVE',
          changedBy: 'user-1',
        });
      }).not.toThrow();

      // Normal callback should still be called
      expect(normalCallback).toHaveBeenCalledTimes(1);
    });
  });
});
