import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import crypto from 'crypto';

/**
 * Audit Hash Chain Tests
 *
 * Tests for the immutable hash chain implementation in audit logs.
 * The hash chain ensures audit log integrity and detects tampering.
 */

// Mock the audit service functions for testing
// In a real integration test, these would use a test database

interface AuditEntry {
  id: number;
  eventType: string;
  userId: string | null;
  action: string;
  details: Record<string, unknown> | null;
  resourceType: string | null;
  resourceId: string | null;
  createdAt: Date;
  previousHash: string | null;
  entryHash: string | null;
}

function calculateAuditHash(entry: {
  eventType: string;
  userId?: string | null;
  action: string;
  details?: Record<string, unknown> | null;
  resourceType?: string | null;
  resourceId?: string | null;
  createdAt: Date;
  previousHash?: string | null;
}): string {
  const payload = {
    eventType: entry.eventType,
    userId: entry.userId || null,
    action: entry.action,
    details: entry.details || null,
    resourceType: entry.resourceType || null,
    resourceId: entry.resourceId || null,
    createdAt: entry.createdAt.toISOString(),
    previousHash: entry.previousHash || null,
  };

  const jsonString = JSON.stringify(payload, Object.keys(payload).sort());
  return crypto.createHash('sha256').update(jsonString).digest('hex');
}

function validateAuditChain(entries: AuditEntry[]): {
  valid: boolean;
  entriesValidated: number;
  brokenAt?: number;
} {
  if (entries.length === 0) {
    return { valid: true, entriesValidated: 0 };
  }

  let previousHash = 'GENESIS';
  let entriesValidated = 0;

  for (const entry of entries) {
    entriesValidated++;

    // Verify the previousHash matches the expected chain
    if (entry.previousHash !== previousHash) {
      return { valid: false, entriesValidated, brokenAt: entry.id };
    }

    // Recalculate the entry hash
    const calculatedHash = calculateAuditHash({
      eventType: entry.eventType,
      userId: entry.userId,
      action: entry.action,
      details: entry.details,
      resourceType: entry.resourceType,
      resourceId: entry.resourceId,
      createdAt: entry.createdAt,
      previousHash: entry.previousHash,
    });

    // Verify the stored hash matches the calculated hash
    if (entry.entryHash !== calculatedHash) {
      return { valid: false, entriesValidated, brokenAt: entry.id };
    }

    previousHash = entry.entryHash!;
  }

  return { valid: true, entriesValidated };
}

describe('Audit Hash Chain', () => {
  describe('calculateAuditHash', () => {
    it('should generate consistent hashes for same input', () => {
      const entry = {
        eventType: 'DATA_UPLOAD',
        userId: 'user-123',
        action: 'UPLOAD',
        details: { filename: 'test.csv' },
        resourceType: 'dataset',
        resourceId: 'ds-001',
        createdAt: new Date('2026-01-18T12:00:00Z'),
        previousHash: 'GENESIS',
      };

      const hash1 = calculateAuditHash(entry);
      const hash2 = calculateAuditHash(entry);

      expect(hash1).toBe(hash2);
      expect(hash1).toHaveLength(64); // SHA-256 hex = 64 characters
    });

    it('should generate different hashes for different inputs', () => {
      const baseEntry = {
        eventType: 'DATA_UPLOAD',
        userId: 'user-123',
        action: 'UPLOAD',
        details: { filename: 'test.csv' },
        resourceType: 'dataset',
        resourceId: 'ds-001',
        createdAt: new Date('2026-01-18T12:00:00Z'),
        previousHash: 'GENESIS',
      };

      const hash1 = calculateAuditHash(baseEntry);
      const hash2 = calculateAuditHash({ ...baseEntry, action: 'DELETE' });
      const hash3 = calculateAuditHash({ ...baseEntry, userId: 'different-user' });

      expect(hash1).not.toBe(hash2);
      expect(hash1).not.toBe(hash3);
      expect(hash2).not.toBe(hash3);
    });

    it('should include previousHash in calculation for chain linking', () => {
      const entry1 = {
        eventType: 'DATA_UPLOAD',
        action: 'UPLOAD',
        createdAt: new Date('2026-01-18T12:00:00Z'),
        previousHash: 'GENESIS',
      };

      const entry2 = {
        eventType: 'DATA_UPLOAD',
        action: 'UPLOAD',
        createdAt: new Date('2026-01-18T12:00:00Z'),
        previousHash: 'abc123def456',
      };

      const hash1 = calculateAuditHash(entry1);
      const hash2 = calculateAuditHash(entry2);

      expect(hash1).not.toBe(hash2);
    });

    it('should handle null values consistently', () => {
      const entry = {
        eventType: 'SYSTEM',
        action: 'STARTUP',
        createdAt: new Date('2026-01-18T12:00:00Z'),
      };

      const hash = calculateAuditHash(entry);
      expect(hash).toHaveLength(64);
    });
  });

  describe('Hash Chain Validation', () => {
    it('should validate empty chain as valid', () => {
      const result = validateAuditChain([]);

      expect(result.valid).toBe(true);
      expect(result.entriesValidated).toBe(0);
    });

    it('should validate first entry starting with GENESIS', () => {
      const createdAt = new Date('2026-01-18T12:00:00Z');
      const entryHash = calculateAuditHash({
        eventType: 'DATA_UPLOAD',
        userId: 'user-123',
        action: 'UPLOAD',
        details: null,
        resourceType: 'dataset',
        resourceId: 'ds-001',
        createdAt,
        previousHash: 'GENESIS',
      });

      const entries: AuditEntry[] = [
        {
          id: 1,
          eventType: 'DATA_UPLOAD',
          userId: 'user-123',
          action: 'UPLOAD',
          details: null,
          resourceType: 'dataset',
          resourceId: 'ds-001',
          createdAt,
          previousHash: 'GENESIS',
          entryHash,
        },
      ];

      const result = validateAuditChain(entries);

      expect(result.valid).toBe(true);
      expect(result.entriesValidated).toBe(1);
    });

    it('should validate chain of multiple entries', () => {
      const time1 = new Date('2026-01-18T12:00:00Z');
      const time2 = new Date('2026-01-18T12:01:00Z');
      const time3 = new Date('2026-01-18T12:02:00Z');

      // First entry
      const hash1 = calculateAuditHash({
        eventType: 'DATA_UPLOAD',
        action: 'UPLOAD',
        createdAt: time1,
        previousHash: 'GENESIS',
      });

      // Second entry links to first
      const hash2 = calculateAuditHash({
        eventType: 'DATA_ACCESS',
        action: 'READ',
        createdAt: time2,
        previousHash: hash1,
      });

      // Third entry links to second
      const hash3 = calculateAuditHash({
        eventType: 'DATA_EXPORT',
        action: 'EXPORT',
        createdAt: time3,
        previousHash: hash2,
      });

      const entries: AuditEntry[] = [
        {
          id: 1,
          eventType: 'DATA_UPLOAD',
          userId: null,
          action: 'UPLOAD',
          details: null,
          resourceType: null,
          resourceId: null,
          createdAt: time1,
          previousHash: 'GENESIS',
          entryHash: hash1,
        },
        {
          id: 2,
          eventType: 'DATA_ACCESS',
          userId: null,
          action: 'READ',
          details: null,
          resourceType: null,
          resourceId: null,
          createdAt: time2,
          previousHash: hash1,
          entryHash: hash2,
        },
        {
          id: 3,
          eventType: 'DATA_EXPORT',
          userId: null,
          action: 'EXPORT',
          details: null,
          resourceType: null,
          resourceId: null,
          createdAt: time3,
          previousHash: hash2,
          entryHash: hash3,
        },
      ];

      const result = validateAuditChain(entries);

      expect(result.valid).toBe(true);
      expect(result.entriesValidated).toBe(3);
    });

    it('should detect tampering - modified entry content', () => {
      const time1 = new Date('2026-01-18T12:00:00Z');
      const time2 = new Date('2026-01-18T12:01:00Z');

      // Calculate original hashes
      const hash1 = calculateAuditHash({
        eventType: 'DATA_UPLOAD',
        action: 'UPLOAD',
        createdAt: time1,
        previousHash: 'GENESIS',
      });

      const hash2 = calculateAuditHash({
        eventType: 'DATA_ACCESS',
        action: 'READ',
        createdAt: time2,
        previousHash: hash1,
      });

      // Create entries with tampered content (action changed but hash not updated)
      const entries: AuditEntry[] = [
        {
          id: 1,
          eventType: 'DATA_UPLOAD',
          userId: null,
          action: 'UPLOAD',
          details: null,
          resourceType: null,
          resourceId: null,
          createdAt: time1,
          previousHash: 'GENESIS',
          entryHash: hash1,
        },
        {
          id: 2,
          eventType: 'DATA_ACCESS',
          userId: null,
          action: 'DELETE', // TAMPERED: was 'READ'
          details: null,
          resourceType: null,
          resourceId: null,
          createdAt: time2,
          previousHash: hash1,
          entryHash: hash2, // Hash no longer matches content
        },
      ];

      const result = validateAuditChain(entries);

      expect(result.valid).toBe(false);
      expect(result.brokenAt).toBe(2);
    });

    it('should detect tampering - broken chain link', () => {
      const time1 = new Date('2026-01-18T12:00:00Z');
      const time2 = new Date('2026-01-18T12:01:00Z');

      const hash1 = calculateAuditHash({
        eventType: 'DATA_UPLOAD',
        action: 'UPLOAD',
        createdAt: time1,
        previousHash: 'GENESIS',
      });

      // Second entry with wrong previousHash
      const hash2 = calculateAuditHash({
        eventType: 'DATA_ACCESS',
        action: 'READ',
        createdAt: time2,
        previousHash: 'wrong_hash', // Uses wrong hash in calculation
      });

      const entries: AuditEntry[] = [
        {
          id: 1,
          eventType: 'DATA_UPLOAD',
          userId: null,
          action: 'UPLOAD',
          details: null,
          resourceType: null,
          resourceId: null,
          createdAt: time1,
          previousHash: 'GENESIS',
          entryHash: hash1,
        },
        {
          id: 2,
          eventType: 'DATA_ACCESS',
          userId: null,
          action: 'READ',
          details: null,
          resourceType: null,
          resourceId: null,
          createdAt: time2,
          previousHash: 'wrong_hash', // Doesn't match hash1
          entryHash: hash2,
        },
      ];

      const result = validateAuditChain(entries);

      expect(result.valid).toBe(false);
      expect(result.brokenAt).toBe(2);
    });

    it('should detect tampering - first entry not starting with GENESIS', () => {
      const time1 = new Date('2026-01-18T12:00:00Z');

      const hash1 = calculateAuditHash({
        eventType: 'DATA_UPLOAD',
        action: 'UPLOAD',
        createdAt: time1,
        previousHash: 'not_genesis',
      });

      const entries: AuditEntry[] = [
        {
          id: 1,
          eventType: 'DATA_UPLOAD',
          userId: null,
          action: 'UPLOAD',
          details: null,
          resourceType: null,
          resourceId: null,
          createdAt: time1,
          previousHash: 'not_genesis',
          entryHash: hash1,
        },
      ];

      const result = validateAuditChain(entries);

      expect(result.valid).toBe(false);
      expect(result.brokenAt).toBe(1);
    });

    it('should detect deleted entries (gap in chain)', () => {
      const time1 = new Date('2026-01-18T12:00:00Z');
      const time2 = new Date('2026-01-18T12:01:00Z');
      const time3 = new Date('2026-01-18T12:02:00Z');

      const hash1 = calculateAuditHash({
        eventType: 'DATA_UPLOAD',
        action: 'UPLOAD',
        createdAt: time1,
        previousHash: 'GENESIS',
      });

      const hash2 = calculateAuditHash({
        eventType: 'DATA_ACCESS',
        action: 'READ',
        createdAt: time2,
        previousHash: hash1,
      });

      const hash3 = calculateAuditHash({
        eventType: 'DATA_EXPORT',
        action: 'EXPORT',
        createdAt: time3,
        previousHash: hash2,
      });

      // Simulate deletion of middle entry
      const entries: AuditEntry[] = [
        {
          id: 1,
          eventType: 'DATA_UPLOAD',
          userId: null,
          action: 'UPLOAD',
          details: null,
          resourceType: null,
          resourceId: null,
          createdAt: time1,
          previousHash: 'GENESIS',
          entryHash: hash1,
        },
        // Entry 2 is missing!
        {
          id: 3,
          eventType: 'DATA_EXPORT',
          userId: null,
          action: 'EXPORT',
          details: null,
          resourceType: null,
          resourceId: null,
          createdAt: time3,
          previousHash: hash2, // Points to deleted entry's hash
          entryHash: hash3,
        },
      ];

      const result = validateAuditChain(entries);

      expect(result.valid).toBe(false);
      expect(result.brokenAt).toBe(3);
    });
  });

  describe('Hash Properties', () => {
    it('should produce 64-character hex strings (SHA-256)', () => {
      const hash = calculateAuditHash({
        eventType: 'TEST',
        action: 'TEST',
        createdAt: new Date(),
      });

      expect(hash).toMatch(/^[a-f0-9]{64}$/);
    });

    it('should be deterministic with sorted keys', () => {
      const date = new Date('2026-01-18T12:00:00Z');

      // Different order of properties should produce same hash
      const hash1 = calculateAuditHash({
        action: 'TEST',
        eventType: 'DATA',
        createdAt: date,
      });

      const hash2 = calculateAuditHash({
        eventType: 'DATA',
        action: 'TEST',
        createdAt: date,
      });

      expect(hash1).toBe(hash2);
    });
  });
});

describe('Audit Chain Integration Scenarios', () => {
  it('should handle typical audit trail for dataset lifecycle', () => {
    const baseTime = new Date('2026-01-18T12:00:00Z');
    const entries: AuditEntry[] = [];
    let previousHash = 'GENESIS';

    // Simulate dataset lifecycle events
    const events = [
      { eventType: 'DATA_UPLOAD', action: 'UPLOAD', offset: 0 },
      { eventType: 'PHI_SCAN', action: 'SCAN_PASSED', offset: 60000 },
      { eventType: 'DATA_ACCESS', action: 'READ', offset: 120000 },
      { eventType: 'DATA_EXPORT', action: 'EXPORT_REQUESTED', offset: 180000 },
      { eventType: 'GOVERNANCE', action: 'EXPORT_APPROVED', offset: 240000 },
    ];

    events.forEach((event, index) => {
      const createdAt = new Date(baseTime.getTime() + event.offset);
      const hash = calculateAuditHash({
        eventType: event.eventType,
        action: event.action,
        createdAt,
        previousHash,
      });

      entries.push({
        id: index + 1,
        eventType: event.eventType,
        userId: null,
        action: event.action,
        details: null,
        resourceType: null,
        resourceId: null,
        createdAt,
        previousHash,
        entryHash: hash,
      });

      previousHash = hash;
    });

    const result = validateAuditChain(entries);

    expect(result.valid).toBe(true);
    expect(result.entriesValidated).toBe(5);
  });
});
