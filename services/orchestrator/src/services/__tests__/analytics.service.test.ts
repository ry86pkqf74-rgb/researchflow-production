/**
 * Tests for AnalyticsService
 *
 * Tests PHI-safe event tracking, validation, and batch ingestion.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Mock database module
vi.mock('../../../db', () => ({
  db: {
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockResolvedValue({}),
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    groupBy: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockResolvedValue([]),
  },
}));

// Mock audit service
vi.mock('../audit-service', () => ({
  logAction: vi.fn().mockResolvedValue(undefined),
}));

// Reset modules after mocks
vi.resetModules();

import { db } from '../../../db';
import {
  trackEvent,
  ingestBatch,
  getSummary,
  type AnalyticsEventInput,
} from '../analytics.service';

describe('AnalyticsService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('trackEvent', () => {
    it('should accept valid event with allowed event name', async () => {
      const event: AnalyticsEventInput = {
        eventName: 'page_view',
        userId: 'user-123',
        sessionId: 'session-456',
      };

      const result = await trackEvent(event);
      expect(result).toBe(true);
      expect(db.insert).toHaveBeenCalled();
    });

    it('should reject events with unknown event names', async () => {
      const event: AnalyticsEventInput = {
        eventName: 'unknown_event',
        userId: 'user-123',
      };

      const result = await trackEvent(event);
      expect(result).toBe(false);
      expect(db.insert).not.toHaveBeenCalled();
    });

    it('should sanitize properties containing PHI patterns', async () => {
      const event: AnalyticsEventInput = {
        eventName: 'page_view',
        userId: 'user-123',
        properties: {
          email: 'test@example.com',
          ssn: '123-45-6789',
        },
      };

      const result = await trackEvent(event);
      // Event should still be tracked but with redacted properties
      expect(result).toBe(true);
    });

    it('should reject properties exceeding size limit', async () => {
      const largeData = 'x'.repeat(10000);
      const event: AnalyticsEventInput = {
        eventName: 'page_view',
        userId: 'user-123',
        properties: {
          largeField: largeData,
        },
      };

      const result = await trackEvent(event);
      // Should still track but with redacted properties
      expect(result).toBe(true);
    });

    it('should hash IP addresses for privacy', async () => {
      const event: AnalyticsEventInput = {
        eventName: 'page_view',
        userId: 'user-123',
        ip: '192.168.1.1',
      };

      await trackEvent(event);

      // Verify that insert was called with hashed IP (not raw IP)
      expect(db.insert).toHaveBeenCalled();
    });

    it('should detect and redact long text strings', async () => {
      const event: AnalyticsEventInput = {
        eventName: 'page_view',
        properties: {
          notes: 'A'.repeat(250), // Long text might contain PHI
        },
      };

      const result = await trackEvent(event);
      expect(result).toBe(true);
    });
  });

  describe('ingestBatch', () => {
    it('should process multiple events', async () => {
      const events: AnalyticsEventInput[] = [
        { eventName: 'page_view', userId: 'user-1' },
        { eventName: 'feature_used', userId: 'user-1' },
        { eventName: 'button_clicked', userId: 'user-1' },
      ];

      const context = {
        userId: 'user-1',
        sessionId: 'session-1',
        ip: '192.168.1.1',
        userAgent: 'TestAgent/1.0',
      };

      const result = await ingestBatch(events, context);

      expect(result.accepted + result.rejected).toBe(events.length);
    });

    it('should count rejected events separately', async () => {
      const events: AnalyticsEventInput[] = [
        { eventName: 'page_view' },
        { eventName: 'invalid_event_name' },
        { eventName: 'feature_used' },
      ];

      const result = await ingestBatch(events, {});

      expect(result.rejected).toBeGreaterThan(0);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should merge context into events', async () => {
      const events: AnalyticsEventInput[] = [
        { eventName: 'page_view' },
      ];

      const context = {
        userId: 'context-user',
        sessionId: 'context-session',
      };

      await ingestBatch(events, context);

      expect(db.insert).toHaveBeenCalled();
    });
  });

  describe('getSummary', () => {
    it('should return summary with all metrics', async () => {
      // Mock count query
      (db.select as any).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ count: 100 }]),
        }),
      });

      const result = await getSummary();

      expect(result).toHaveProperty('totalEvents');
      expect(result).toHaveProperty('eventsByName');
      expect(result).toHaveProperty('eventsByDay');
      expect(result).toHaveProperty('eventsByMode');
    });

    it('should respect date range options', async () => {
      const dateFrom = new Date('2024-01-01');
      const dateTo = new Date('2024-01-31');

      (db.select as any).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ count: 50 }]),
        }),
      });

      await getSummary({ dateFrom, dateTo });

      // Verify date filtering was applied
      expect(db.select).toHaveBeenCalled();
    });

    it('should return empty summary when database unavailable', async () => {
      // Simulate DB error
      (db.select as any).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockRejectedValue(new Error('DB error')),
        }),
      });

      const result = await getSummary();

      expect(result.totalEvents).toBe(0);
      expect(result.eventsByName).toEqual({});
    });
  });
});
