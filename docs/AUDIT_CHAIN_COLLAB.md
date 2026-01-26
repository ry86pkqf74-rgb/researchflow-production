# Collaboration Audit Chain

> **Last Updated:** 2025
> **Status:** Production Ready
> **Covers:** Tasks 84, 93 (Audit Trails for Collaboration)

## Overview

ResearchFlow implements a cryptographically-verifiable audit chain for all collaboration events. This ensures non-repudiation, tamper detection, and regulatory compliance for research workflows.

## Hash Chain Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     Collaboration Event Chain                    │
│                                                                  │
│  ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐  │
│  │ GENESIS  │───▶│ Event 1  │───▶│ Event 2  │───▶│ Event N  │  │
│  │ (root)   │    │          │    │          │    │          │  │
│  └──────────┘    └──────────┘    └──────────┘    └──────────┘  │
│       │               │               │               │         │
│       ▼               ▼               ▼               ▼         │
│    hash_0         hash_1          hash_2          hash_n        │
│       │               │               │               │         │
│       └───────────────┴───────────────┴───────────────┘         │
│                previousHash chain linkage                        │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## Event Schema

Every collaboration event is structured as:

```typescript
interface CollaborationEvent {
  id: UUID;
  researchId: UUID;
  artifactId?: UUID;
  type: CollaborationEventType;
  actorId: UUID;
  actorRole?: string;
  targetId?: UUID;          // For permission/assignment events
  timestamp: ISO8601;
  metadata?: Record<string, unknown>;

  // Hash chain fields
  previousHash: string;     // Links to prior event
  eventHash: string;        // This event's computed hash
}
```

## Event Types

```typescript
type CollaborationEventType =
  // Document events
  | 'DOCUMENT_CREATED'
  | 'DOCUMENT_EDITED'
  | 'DOCUMENT_VERSION_CREATED'
  | 'DOCUMENT_SHARED'
  | 'DOCUMENT_UNSHARED'

  // Comment events
  | 'COMMENT_ADDED'
  | 'COMMENT_EDITED'
  | 'COMMENT_DELETED'
  | 'COMMENT_RESOLVED'
  | 'COMMENT_UNRESOLVE'
  | 'COMMENT_REPLY'

  // Review events
  | 'REVIEW_REQUESTED'
  | 'REVIEW_STARTED'
  | 'REVIEW_COMPLETED'
  | 'REVIEW_DECLINED'
  | 'REVIEW_SCORE_UPDATED'

  // Claim events
  | 'CLAIM_CREATED'
  | 'CLAIM_VERIFIED'
  | 'CLAIM_DISPUTED'
  | 'CLAIM_RETRACTED'
  | 'EVIDENCE_LINKED'
  | 'EVIDENCE_UNLINKED'

  // Task events
  | 'TASK_CREATED'
  | 'TASK_ASSIGNED'
  | 'TASK_MOVED'
  | 'TASK_COMPLETED'
  | 'TASK_DELETED'

  // Submission events
  | 'SUBMISSION_CREATED'
  | 'SUBMISSION_SUBMITTED'
  | 'SUBMISSION_REVISED'
  | 'SUBMISSION_ACCEPTED'
  | 'SUBMISSION_REJECTED'

  // Access events
  | 'USER_JOINED'
  | 'USER_LEFT'
  | 'ROLE_CHANGED'
  | 'PERMISSION_GRANTED'
  | 'PERMISSION_REVOKED'

  // Presence events (optional, high volume)
  | 'USER_ONLINE'
  | 'USER_OFFLINE'
  | 'USER_VIEWING'
  | 'USER_EDITING';
```

## Hash Computation

### Algorithm

SHA-256 hash over deterministic JSON payload:

```typescript
function computeEventHash(
  event: Omit<CollaborationEvent, 'eventHash'>
): string {
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

  return crypto.createHash('sha256')
    .update(payload)
    .digest('hex');
}
```

### Chain Linkage

Each event references the previous event's hash:

```typescript
function recordEvent(input: EventInput): CollaborationEvent {
  const previousHash = getLastEventHash(input.researchId) || 'GENESIS';

  const partialEvent = {
    id: crypto.randomUUID(),
    ...input,
    timestamp: new Date().toISOString(),
    previousHash,
  };

  const eventHash = computeEventHash(partialEvent);

  const event = { ...partialEvent, eventHash };

  // Store event
  storeEvent(event);

  // Update last hash pointer
  setLastEventHash(input.researchId, eventHash);

  return event;
}
```

## Chain Verification

### Verification Algorithm

```typescript
function verifyHashChain(events: CollaborationEvent[]): VerificationResult {
  if (events.length === 0) {
    return { valid: true, totalEvents: 0, verifiedEvents: 0, brokenLinks: [] };
  }

  const brokenLinks: BrokenLink[] = [];
  let expectedPreviousHash = 'GENESIS';
  let verifiedCount = 0;

  for (const event of events) {
    // Check chain linkage
    if (event.previousHash !== expectedPreviousHash) {
      brokenLinks.push({
        eventId: event.id,
        expectedPreviousHash,
        actualPreviousHash: event.previousHash,
      });
    } else {
      verifiedCount++;
    }

    // Verify event hash integrity
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
        expectedPreviousHash: `HASH_MISMATCH: computed ${computedHash}`,
        actualPreviousHash: event.eventHash,
      });
    }

    expectedPreviousHash = event.eventHash;
  }

  return {
    valid: brokenLinks.length === 0,
    totalEvents: events.length,
    verifiedEvents: verifiedCount,
    brokenLinks,
    firstHash: events[0].eventHash,
    lastHash: events[events.length - 1].eventHash,
  };
}
```

### Verification Result

```typescript
interface VerificationResult {
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
```

## Export Format

### JSON Export

```json
{
  "exportId": "uuid",
  "researchId": "uuid",
  "exportedAt": "2025-01-20T12:00:00Z",
  "exportedBy": "user-uuid",
  "chainIntegrity": {
    "verified": true,
    "firstEventHash": "abc123...",
    "lastEventHash": "xyz789...",
    "totalEvents": 1247,
    "brokenLinks": []
  },
  "events": [
    {
      "id": "event-uuid",
      "researchId": "research-uuid",
      "type": "DOCUMENT_EDITED",
      "actorId": "user-uuid",
      "timestamp": "2025-01-15T10:30:00Z",
      "previousHash": "prev-hash",
      "eventHash": "this-hash",
      "metadata": {}
    }
  ]
}
```

### JSON Lines (JSONL) Export

```jsonl
{"type":"header","exportId":"uuid","researchId":"uuid","chainIntegrity":{...}}
{"type":"event","id":"event-1",...}
{"type":"event","id":"event-2",...}
```

### CSV Export

```csv
id,timestamp,type,actorId,actorRole,artifactId,targetId,previousHash,eventHash
event-1,2025-01-15T10:30:00Z,DOCUMENT_EDITED,user-1,,artifact-1,,GENESIS,hash-1
event-2,2025-01-15T10:31:00Z,COMMENT_ADDED,user-2,,artifact-1,,hash-1,hash-2
```

## Recording Best Practices

### When to Record

| Event | Record Immediately | Batch OK |
|-------|-------------------|----------|
| Document edit | ✅ | ❌ |
| Comment add/resolve | ✅ | ❌ |
| Permission change | ✅ | ❌ |
| Review completion | ✅ | ❌ |
| Presence update | ❌ | ✅ |

### What to Include

**Always include:**
- Event type
- Actor ID
- Timestamp
- Resource ID (artifact, research)

**Never include:**
- PHI (Protected Health Information)
- Raw text content
- User credentials
- Session tokens

**Sanitize before including:**
- User-generated text → content hash only
- File attachments → file hash + metadata only

### Convenience Functions

```typescript
// Document operations
recordDocumentEdit(researchId, artifactId, actorId, changesSummary?);

// Comment operations
recordCommentEvent(researchId, artifactId, type, actorId, commentId, threadId?);

// Review operations
recordReviewEvent(researchId, submissionId, type, actorId, reviewerId?, score?);

// Access operations
recordAccessEvent(researchId, type, actorId, targetId, details?);
```

## API Reference

### Export Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/research/:id/collaboration/export` | POST | Export with options |
| `/api/research/:id/collaboration/summary` | GET | Get summary stats |
| `/api/research/:id/collaboration/events` | GET | List events (paginated) |

### Verification Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/collaboration/verify` | POST | Verify exported log |
| `/api/research/:id/collaboration/verify-chain` | POST | Verify live chain |

### Export Options

```typescript
interface ExportOptions {
  researchId: UUID;
  startDate?: ISO8601;
  endDate?: ISO8601;
  eventTypes?: CollaborationEventType[];
  actorIds?: UUID[];
  artifactIds?: UUID[];
  includePresence?: boolean;  // Default: false
  format?: 'json' | 'jsonl' | 'csv';  // Default: json
  verifyChain?: boolean;  // Default: true
}
```

## Compliance Considerations

### Regulatory Requirements

| Regulation | Requirement | Implementation |
|------------|-------------|----------------|
| HIPAA | Audit controls | Hash chain, immutable |
| 21 CFR Part 11 | Electronic signatures | Actor attribution |
| GDPR | Right to access | Export functionality |
| SOC 2 | Audit trails | Complete event history |

### Retention Policy

```typescript
const RETENTION_POLICY = {
  // Active research: keep all events
  activeResearch: 'INDEFINITE',

  // Archived research: keep summary + chain anchors
  archivedResearch: '7_YEARS',

  // Presence events: can be pruned
  presenceEvents: '90_DAYS',
};
```

### Data Minimization

The audit chain stores **references and hashes**, not raw content:

```typescript
// Good: Store reference
{
  type: 'COMMENT_ADDED',
  metadata: {
    commentId: 'uuid',
    threadId: 'uuid',
    contentHash: 'sha256-of-content',
  }
}

// Bad: Store content
{
  type: 'COMMENT_ADDED',
  metadata: {
    content: 'This patient has...',  // PHI!
  }
}
```

## Troubleshooting

### Chain Verification Failures

```bash
# Run verification
npm run collab:verify-chain -- $RESEARCH_ID

# Output
Verifying chain for research: abc123
Total events: 1247
Verified events: 1245
Broken links: 2
  - Event evt-456: expected hash-123, got hash-789
  - Event evt-457: HASH_MISMATCH: computed hash-abc, stored hash-def
```

### Common Issues

| Issue | Cause | Resolution |
|-------|-------|------------|
| Gap in chain | Events deleted | Mark research as tampered |
| Hash mismatch | Data corruption | Restore from backup |
| Duplicate hashes | ID collision | Extremely rare, investigate |

### Recovery Process

1. Identify scope of corruption
2. Export unaffected portion
3. Mark affected range as "verification failed"
4. Document in incident report
5. Do NOT attempt to "fix" hashes

## Performance Considerations

### Write Performance

- Hash computation: < 1ms per event
- Chain update: O(1) with last-hash pointer
- Batch recording: Not recommended (breaks ordering)

### Read Performance

- Sequential scan for verification: O(n)
- Index by `researchId`, `timestamp`
- Consider partitioning by research/month

### Storage

- ~500 bytes per event (average)
- 1 million events ≈ 500 MB
- Compression ratio ~3:1 for export

## Related Documentation

- [COLLABORATION_MODEL.md](./COLLABORATION_MODEL.md) - Collaboration features
- [TENANCY_GUARDS.md](./TENANCY_GUARDS.md) - Multi-tenant security
- [services/orchestrator/src/services/collaborationExportService.ts](../services/orchestrator/src/services/collaborationExportService.ts) - Implementation
