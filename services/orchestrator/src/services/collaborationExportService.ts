/**
 * Collaboration Export Service (Task 93)
 * Export collaboration logs with hash chain verification
 *
 * Security: Exports maintain audit integrity, no PHI in exported data
 */

import { z } from 'zod';
import crypto from 'crypto';

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

export const CollaborationEventTypeSchema = z.enum([
  // Document events
  'DOCUMENT_CREATED',
  'DOCUMENT_EDITED',
  'DOCUMENT_VERSION_CREATED',
  'DOCUMENT_SHARED',
  'DOCUMENT_UNSHARED',

  // Comment events
  'COMMENT_ADDED',
  'COMMENT_EDITED',
  'COMMENT_DELETED',
  'COMMENT_RESOLVED',
  'COMMENT_UNRESOLVE',
  'COMMENT_REPLY',

  // Review events
  'REVIEW_REQUESTED',
  'REVIEW_STARTED',
  'REVIEW_COMPLETED',
  'REVIEW_DECLINED',
  'REVIEW_SCORE_UPDATED',

  // Claim events
  'CLAIM_CREATED',
  'CLAIM_VERIFIED',
  'CLAIM_DISPUTED',
  'CLAIM_RETRACTED',
  'EVIDENCE_LINKED',
  'EVIDENCE_UNLINKED',

  // Task events
  'TASK_CREATED',
  'TASK_ASSIGNED',
  'TASK_MOVED',
  'TASK_COMPLETED',
  'TASK_DELETED',

  // Submission events
  'SUBMISSION_CREATED',
  'SUBMISSION_SUBMITTED',
  'SUBMISSION_REVISED',
  'SUBMISSION_ACCEPTED',
  'SUBMISSION_REJECTED',

  // Access events
  'USER_JOINED',
  'USER_LEFT',
  'ROLE_CHANGED',
  'PERMISSION_GRANTED',
  'PERMISSION_REVOKED',

  // Presence events
  'USER_ONLINE',
  'USER_OFFLINE',
  'USER_VIEWING',
  'USER_EDITING',
]);
export type CollaborationEventType = z.infer<typeof CollaborationEventTypeSchema>;

export const CollaborationEventSchema = z.object({
  id: z.string().uuid(),
  researchId: z.string().uuid(),
  artifactId: z.string().uuid().optional(),
  type: CollaborationEventTypeSchema,
  actorId: z.string().uuid(),
  actorRole: z.string().optional(),
  targetId: z.string().uuid().optional(), // Target user for permission/assignment events
  timestamp: z.string().datetime(),
  metadata: z.record(z.unknown()).optional(),

  // Hash chain fields
  previousHash: z.string(),
  eventHash: z.string(),
});
export type CollaborationEvent = z.infer<typeof CollaborationEventSchema>;

export const ExportOptionsSchema = z.object({
  researchId: z.string().uuid(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  eventTypes: z.array(CollaborationEventTypeSchema).optional(),
  actorIds: z.array(z.string().uuid()).optional(),
  artifactIds: z.array(z.string().uuid()).optional(),
  includePresence: z.boolean().default(false),
  format: z.enum(['json', 'jsonl', 'csv']).default('json'),
  verifyChain: z.boolean().default(true),
});
export type ExportOptions = z.infer<typeof ExportOptionsSchema>;

export interface ExportedCollaborationLog {
  exportId: string;
  researchId: string;
  exportedAt: string;
  exportedBy: string;
  options: ExportOptions;
  chainIntegrity: {
    verified: boolean;
    firstEventHash: string;
    lastEventHash: string;
    totalEvents: number;
    brokenLinks: string[]; // Event IDs where chain is broken
  };
  events: CollaborationEvent[];
}

export interface ChainVerificationResult {
  valid: boolean;
  totalEvents: number;
  verifiedEvents: number;
  brokenLinks: Array<{
    eventId: string;
    expectedPreviousHash: string;
    actualPreviousHash: string;
  }>;
  firstHash: string;
  lastHash: string;
}

// ---------------------------------------------------------------------------
// In-Memory Storage (would be database in production)
// ---------------------------------------------------------------------------

const events: CollaborationEvent[] = [];
let lastHash = 'GENESIS';

// ---------------------------------------------------------------------------
// Hash Chain Functions
// ---------------------------------------------------------------------------

function computeEventHash(event: Omit<CollaborationEvent, 'eventHash'>): string {
  const payload = JSON.stringify({
    id: event.id,
    researchId: event.researchId,
    artifactId: event.artifactId,
    type: event.type,
    actorId: event.actorId,
    targetId: event.targetId,
    timestamp: event.timestamp,
    metadata: event.metadata,
    previousHash: event.previousHash,
  });

  return crypto.createHash('sha256').update(payload).digest('hex');
}

export function verifyHashChain(eventList: CollaborationEvent[]): ChainVerificationResult {
  if (eventList.length === 0) {
    return {
      valid: true,
      totalEvents: 0,
      verifiedEvents: 0,
      brokenLinks: [],
      firstHash: '',
      lastHash: '',
    };
  }

  const brokenLinks: ChainVerificationResult['brokenLinks'] = [];
  let verifiedCount = 0;
  let expectedPreviousHash = 'GENESIS';

  for (let i = 0; i < eventList.length; i++) {
    const event = eventList[i];

    // Verify previous hash link
    if (event.previousHash !== expectedPreviousHash) {
      brokenLinks.push({
        eventId: event.id,
        expectedPreviousHash,
        actualPreviousHash: event.previousHash,
      });
    } else {
      verifiedCount++;
    }

    // Verify event hash
    const computedHash = computeEventHash({
      id: event.id,
      researchId: event.researchId,
      artifactId: event.artifactId,
      type: event.type,
      actorId: event.actorId,
      actorRole: event.actorRole,
      targetId: event.targetId,
      timestamp: event.timestamp,
      metadata: event.metadata,
      previousHash: event.previousHash,
    });

    if (computedHash !== event.eventHash) {
      brokenLinks.push({
        eventId: event.id,
        expectedPreviousHash: `HASH_MISMATCH: expected ${computedHash}`,
        actualPreviousHash: event.eventHash,
      });
    }

    expectedPreviousHash = event.eventHash;
  }

  return {
    valid: brokenLinks.length === 0,
    totalEvents: eventList.length,
    verifiedEvents: verifiedCount,
    brokenLinks,
    firstHash: eventList[0].eventHash,
    lastHash: eventList[eventList.length - 1].eventHash,
  };
}

// ---------------------------------------------------------------------------
// Event Recording
// ---------------------------------------------------------------------------

export function recordCollaborationEvent(
  input: Omit<CollaborationEvent, 'id' | 'previousHash' | 'eventHash' | 'timestamp'>
): CollaborationEvent {
  const id = crypto.randomUUID();
  const timestamp = new Date().toISOString();
  const previousHash = lastHash;

  const partialEvent = {
    id,
    ...input,
    timestamp,
    previousHash,
  };

  const eventHash = computeEventHash(partialEvent);

  const event: CollaborationEvent = {
    ...partialEvent,
    eventHash,
  };

  events.push(event);
  lastHash = eventHash;

  return event;
}

// Convenience functions for common event types
export function recordDocumentEdit(
  researchId: string,
  artifactId: string,
  actorId: string,
  actorRole: string,
  changesSummary?: string
): CollaborationEvent {
  return recordCollaborationEvent({
    researchId,
    artifactId,
    type: 'DOCUMENT_EDITED',
    actorId,
    actorRole,
    metadata: { changesSummary },
  });
}

export function recordCommentEvent(
  researchId: string,
  artifactId: string,
  type: 'COMMENT_ADDED' | 'COMMENT_EDITED' | 'COMMENT_DELETED' | 'COMMENT_RESOLVED' | 'COMMENT_REPLY',
  actorId: string,
  commentId: string,
  threadId?: string
): CollaborationEvent {
  return recordCollaborationEvent({
    researchId,
    artifactId,
    type,
    actorId,
    metadata: { commentId, threadId },
  });
}

export function recordReviewEvent(
  researchId: string,
  submissionId: string,
  type: 'REVIEW_REQUESTED' | 'REVIEW_STARTED' | 'REVIEW_COMPLETED' | 'REVIEW_DECLINED',
  actorId: string,
  reviewerId?: string,
  score?: number
): CollaborationEvent {
  return recordCollaborationEvent({
    researchId,
    artifactId: submissionId,
    type,
    actorId,
    targetId: reviewerId,
    metadata: { score },
  });
}

export function recordAccessEvent(
  researchId: string,
  type: 'USER_JOINED' | 'USER_LEFT' | 'ROLE_CHANGED' | 'PERMISSION_GRANTED' | 'PERMISSION_REVOKED',
  actorId: string,
  targetId: string,
  details?: { previousRole?: string; newRole?: string; permission?: string }
): CollaborationEvent {
  return recordCollaborationEvent({
    researchId,
    type,
    actorId,
    targetId,
    metadata: details,
  });
}

// ---------------------------------------------------------------------------
// Event Querying
// ---------------------------------------------------------------------------

export function getEvents(options: Partial<ExportOptions>): CollaborationEvent[] {
  let filtered = [...events];

  if (options.researchId) {
    filtered = filtered.filter(e => e.researchId === options.researchId);
  }

  if (options.startDate) {
    const start = new Date(options.startDate);
    filtered = filtered.filter(e => new Date(e.timestamp) >= start);
  }

  if (options.endDate) {
    const end = new Date(options.endDate);
    filtered = filtered.filter(e => new Date(e.timestamp) <= end);
  }

  if (options.eventTypes && options.eventTypes.length > 0) {
    filtered = filtered.filter(e => options.eventTypes!.includes(e.type));
  }

  if (options.actorIds && options.actorIds.length > 0) {
    filtered = filtered.filter(e => options.actorIds!.includes(e.actorId));
  }

  if (options.artifactIds && options.artifactIds.length > 0) {
    filtered = filtered.filter(e => e.artifactId && options.artifactIds!.includes(e.artifactId));
  }

  if (!options.includePresence) {
    const presenceTypes: CollaborationEventType[] = ['USER_ONLINE', 'USER_OFFLINE', 'USER_VIEWING', 'USER_EDITING'];
    filtered = filtered.filter(e => !presenceTypes.includes(e.type));
  }

  return filtered.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
}

// ---------------------------------------------------------------------------
// Export Functions
// ---------------------------------------------------------------------------

export function exportCollaborationLog(
  options: ExportOptions,
  exportedBy: string
): ExportedCollaborationLog {
  const validated = ExportOptionsSchema.parse(options);
  const filteredEvents = getEvents(validated);

  let chainIntegrity: ExportedCollaborationLog['chainIntegrity'];

  if (validated.verifyChain && filteredEvents.length > 0) {
    const verification = verifyHashChain(filteredEvents);
    chainIntegrity = {
      verified: verification.valid,
      firstEventHash: verification.firstHash,
      lastEventHash: verification.lastHash,
      totalEvents: verification.totalEvents,
      brokenLinks: verification.brokenLinks.map(b => b.eventId),
    };
  } else {
    chainIntegrity = {
      verified: false,
      firstEventHash: filteredEvents[0]?.eventHash || '',
      lastEventHash: filteredEvents[filteredEvents.length - 1]?.eventHash || '',
      totalEvents: filteredEvents.length,
      brokenLinks: [],
    };
  }

  return {
    exportId: crypto.randomUUID(),
    researchId: validated.researchId,
    exportedAt: new Date().toISOString(),
    exportedBy,
    options: validated,
    chainIntegrity,
    events: filteredEvents,
  };
}

export function formatExport(log: ExportedCollaborationLog, format: 'json' | 'jsonl' | 'csv'): string {
  switch (format) {
    case 'json':
      return JSON.stringify(log, null, 2);

    case 'jsonl':
      const lines = [
        JSON.stringify({
          type: 'header',
          exportId: log.exportId,
          researchId: log.researchId,
          exportedAt: log.exportedAt,
          chainIntegrity: log.chainIntegrity,
        }),
        ...log.events.map(e => JSON.stringify({ type: 'event', ...e })),
      ];
      return lines.join('\n');

    case 'csv':
      const headers = [
        'id',
        'timestamp',
        'type',
        'actorId',
        'actorRole',
        'artifactId',
        'targetId',
        'previousHash',
        'eventHash',
      ];
      const csvLines = [
        headers.join(','),
        ...log.events.map(e => [
          e.id,
          e.timestamp,
          e.type,
          e.actorId,
          e.actorRole || '',
          e.artifactId || '',
          e.targetId || '',
          e.previousHash,
          e.eventHash,
        ].map(v => `"${v}"`).join(',')),
      ];
      return csvLines.join('\n');
  }
}

// ---------------------------------------------------------------------------
// Import & Verification
// ---------------------------------------------------------------------------

export function verifyExportedLog(exportedJson: string): {
  valid: boolean;
  log: ExportedCollaborationLog | null;
  errors: string[];
} {
  const errors: string[] = [];

  try {
    const log = JSON.parse(exportedJson) as ExportedCollaborationLog;

    // Verify structure
    if (!log.exportId || !log.researchId || !log.events) {
      errors.push('Invalid export structure: missing required fields');
      return { valid: false, log: null, errors };
    }

    // Verify hash chain
    const chainResult = verifyHashChain(log.events);
    if (!chainResult.valid) {
      errors.push(`Hash chain verification failed: ${chainResult.brokenLinks.length} broken links`);
      for (const broken of chainResult.brokenLinks) {
        errors.push(`  - Event ${broken.eventId}: expected ${broken.expectedPreviousHash}, got ${broken.actualPreviousHash}`);
      }
    }

    // Verify event hashes
    for (const event of log.events) {
      const computed = computeEventHash({
        id: event.id,
        researchId: event.researchId,
        artifactId: event.artifactId,
        type: event.type,
        actorId: event.actorId,
        actorRole: event.actorRole,
        targetId: event.targetId,
        timestamp: event.timestamp,
        metadata: event.metadata,
        previousHash: event.previousHash,
      });

      if (computed !== event.eventHash) {
        errors.push(`Event ${event.id} hash mismatch: computed ${computed}, stored ${event.eventHash}`);
      }
    }

    return {
      valid: errors.length === 0,
      log,
      errors,
    };
  } catch (e) {
    errors.push(`JSON parse error: ${e instanceof Error ? e.message : 'Unknown error'}`);
    return { valid: false, log: null, errors };
  }
}

// ---------------------------------------------------------------------------
// Summary & Statistics
// ---------------------------------------------------------------------------

export interface CollaborationSummary {
  researchId: string;
  period: { start: string; end: string };
  totalEvents: number;
  eventsByType: Record<CollaborationEventType, number>;
  uniqueActors: number;
  actorActivity: Array<{ actorId: string; eventCount: number }>;
  artifactActivity: Array<{ artifactId: string; eventCount: number }>;
  dailyActivity: Array<{ date: string; eventCount: number }>;
  chainIntact: boolean;
}

export function getCollaborationSummary(
  researchId: string,
  startDate?: string,
  endDate?: string
): CollaborationSummary {
  const filtered = getEvents({ researchId, startDate, endDate, includePresence: false });

  const eventsByType: Record<string, number> = {};
  const actorCounts = new Map<string, number>();
  const artifactCounts = new Map<string, number>();
  const dailyCounts = new Map<string, number>();

  for (const event of filtered) {
    // By type
    eventsByType[event.type] = (eventsByType[event.type] || 0) + 1;

    // By actor
    actorCounts.set(event.actorId, (actorCounts.get(event.actorId) || 0) + 1);

    // By artifact
    if (event.artifactId) {
      artifactCounts.set(event.artifactId, (artifactCounts.get(event.artifactId) || 0) + 1);
    }

    // By day
    const day = event.timestamp.slice(0, 10);
    dailyCounts.set(day, (dailyCounts.get(day) || 0) + 1);
  }

  const chainResult = verifyHashChain(filtered);

  return {
    researchId,
    period: {
      start: filtered[0]?.timestamp || '',
      end: filtered[filtered.length - 1]?.timestamp || '',
    },
    totalEvents: filtered.length,
    eventsByType: eventsByType as Record<CollaborationEventType, number>,
    uniqueActors: actorCounts.size,
    actorActivity: Array.from(actorCounts.entries())
      .map(([actorId, eventCount]) => ({ actorId, eventCount }))
      .sort((a, b) => b.eventCount - a.eventCount)
      .slice(0, 20),
    artifactActivity: Array.from(artifactCounts.entries())
      .map(([artifactId, eventCount]) => ({ artifactId, eventCount }))
      .sort((a, b) => b.eventCount - a.eventCount)
      .slice(0, 20),
    dailyActivity: Array.from(dailyCounts.entries())
      .map(([date, eventCount]) => ({ date, eventCount }))
      .sort((a, b) => a.date.localeCompare(b.date)),
    chainIntact: chainResult.valid,
  };
}
