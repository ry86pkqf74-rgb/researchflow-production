# Collaboration Model

> **Last Updated:** 2025
> **Status:** Production Ready
> **Covers:** Tasks 76-95 (Collaboration & Multi-Tenancy)

## Overview

ResearchFlow's collaboration model enables multi-user, real-time collaboration on research artifacts while maintaining strict governance, audit, and PHI protection requirements.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Client Layer                              │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐              │
│  │  Comments   │  │   Tasks     │  │  Presence   │              │
│  │    Panel    │  │   Board     │  │  Indicators │              │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘              │
│         │                │                │                      │
│  ┌──────▼────────────────▼────────────────▼──────┐              │
│  │              WebSocket Connection              │              │
│  │         (Hocuspocus / Yjs CRDT Sync)          │              │
│  └──────────────────────┬───────────────────────┘              │
└─────────────────────────┼───────────────────────────────────────┘
                          │
┌─────────────────────────┼───────────────────────────────────────┐
│                         │    Backend Layer                       │
│  ┌──────────────────────▼────────────────────────┐              │
│  │            Collaboration Server                │              │
│  │  ┌────────────┐  ┌────────────┐  ┌──────────┐ │              │
│  │  │  Comment   │  │  Presence  │  │   Task   │ │              │
│  │  │  Service   │  │  Service   │  │  Service │ │              │
│  │  └─────┬──────┘  └─────┬──────┘  └────┬─────┘ │              │
│  └────────┼───────────────┼──────────────┼───────┘              │
│           │               │              │                       │
│  ┌────────▼───────────────▼──────────────▼───────┐              │
│  │              Audit & PHI Layer                 │              │
│  │  ┌────────────┐  ┌────────────┐  ┌──────────┐ │              │
│  │  │   Audit    │  │    PHI     │  │  Hash    │ │              │
│  │  │  Service   │  │  Scanner   │  │  Chain   │ │              │
│  │  └────────────┘  └────────────┘  └──────────┘ │              │
│  └───────────────────────┬───────────────────────┘              │
└──────────────────────────┼──────────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────────┐
│                      Storage Layer                               │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐              │
│  │  PostgreSQL │  │    Redis    │  │     S3      │              │
│  │   (State)   │  │  (Presence) │  │ (Artifacts) │              │
│  └─────────────┘  └─────────────┘  └─────────────┘              │
└─────────────────────────────────────────────────────────────────┘
```

## Core Concepts

### 1. Append-Only Semantics

All collaboration data follows append-only semantics for auditability:

```typescript
// Comments cannot be deleted, only marked superseded
interface Comment {
  id: UUID;
  artifactId: UUID;
  parentId?: UUID;          // For threading
  body: string;
  version: number;
  supersededBy?: UUID;      // Points to newer version
  createdAt: DateTime;
}

// Edits create new versions, not mutations
interface EditEvent {
  artifactId: UUID;
  previousVersion: number;
  newVersion: number;
  changes: Diff;
  hashPrev: string;         // Chain link
}
```

### 2. Version-Safe Threading

Comments are version-aware and can be anchored to specific artifact versions:

```typescript
interface CommentAnchor {
  artifactId: UUID;
  artifactVersion: number;
  anchorType: 'text_selection' | 'entire_section' | 'table_cell' | 'figure_region';
  startOffset?: number;
  endOffset?: number;
  sectionPath?: string;
}
```

### 3. Real-Time Sync via Yjs CRDT

Document editing uses Yjs for conflict-free real-time collaboration:

- **No merge conflicts** - CRDT handles concurrent edits automatically
- **Offline support** - Changes sync when reconnected
- **Version snapshots** - Periodic snapshots for recovery

### 4. Presence Tracking

User presence is tracked per-room (artifact):

```typescript
interface PresenceState {
  userId: string;
  artifactId: string;
  state: 'viewing' | 'editing' | 'commenting';
  cursor?: { x: number; y: number };
  selection?: { start: number; end: number };
  lastHeartbeat: DateTime;
}
```

Heartbeats every 10 seconds, stale after 60 seconds.

## Feature Details

### Comments & Threads (Tasks 76, 80)

| Feature | Description |
|---------|-------------|
| Threading | Nested replies with `parentId` |
| Resolution | Threads can be resolved/unresolve |
| PHI Scanning | All comments scanned for PHI before storage |
| Anchoring | Multiple anchor types for precise attachment |
| Version Diff | View comments relative to artifact versions |

### Task Boards (Task 88)

Kanban-style task management:

- **Columns**: BACKLOG → TODO → IN_PROGRESS → IN_REVIEW → DONE
- **No PHI**: Task titles/descriptions validated for PHI
- **Artifact Links**: Tasks can link to research artifacts
- **Analytics**: Completion time, velocity, workload distribution

### Notifications (Task 82)

Multi-channel notification delivery:

```typescript
type NotificationChannel = 'IN_APP' | 'EMAIL' | 'SLACK' | 'WEBHOOK';

interface NotificationPreferences {
  channelPreferences: Record<NotificationType, {
    enabled: boolean;
    channels: NotificationChannel[];
  }>;
  digestEnabled: boolean;
  quietHoursEnabled: boolean;
}
```

### Peer Review (Task 87)

Formal review system with scored rubrics:

| Blind Mode | Author Visible | Reviewer Visible |
|------------|----------------|------------------|
| OPEN | Yes | Yes |
| SINGLE_BLIND | No | Yes |
| DOUBLE_BLIND | No | No |

Rubric criterion types:
- **SCALE**: Numeric rating (1-5, 1-10)
- **BOOLEAN**: Yes/No
- **GRADE**: Letter grade (A-F)
- **TEXT**: Free text feedback
- **CHECKLIST**: Multiple items to verify

### Video Conferencing (Task 86)

External links only (no in-app A/V):

- Zoom, Google Meet, Microsoft Teams support
- Calendar event generation (ICS format)
- Meeting notes with sharing controls
- Invite management with RSVP tracking

### AI Moderation (Task 94)

Async content moderation:

```typescript
type ModerationCategory =
  | 'TOXICITY'
  | 'HARASSMENT'
  | 'SPAM'
  | 'OFF_TOPIC'
  | 'PHI_LEAK';

// PHI leaks always escalated to human review
// Appeal system for contested decisions
```

### Collaboration Export (Task 93)

Exportable audit logs with hash chain verification:

```json
{
  "exportId": "uuid",
  "researchId": "uuid",
  "chainIntegrity": {
    "verified": true,
    "firstEventHash": "abc123...",
    "lastEventHash": "xyz789...",
    "totalEvents": 1247,
    "brokenLinks": []
  },
  "events": [...]
}
```

## API Reference

### Comments

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/ros/comments` | POST | Create comment |
| `/api/ros/comments` | GET | List comments |
| `/api/ros/comments/:id` | PATCH | Update comment |
| `/api/ros/comments/:id/resolve` | POST | Resolve thread |

### Task Boards

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/research/:id/boards` | POST | Create board |
| `/api/boards/:id` | GET | Get board with tasks |
| `/api/boards/:id/tasks` | POST | Create task |
| `/api/tasks/:id/move` | POST | Move task to column |

### Notifications

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/me/notifications` | GET | List notifications |
| `/api/me/notifications/:id/read` | POST | Mark as read |
| `/api/me/notification-preferences` | PATCH | Update preferences |

### Peer Review

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/rubrics/templates` | GET | List rubric templates |
| `/api/submissions/:id/review-assignments` | POST | Assign reviewer |
| `/api/review-assignments/:id/score` | PUT | Save review score |

### Collaboration Export

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/research/:id/collaboration/export` | POST | Export log |
| `/api/collaboration/verify` | POST | Verify exported log |

## Security Considerations

### PHI Protection

1. **Comments**: Scanned before storage, PHI flagged
2. **Tasks**: Title/description validated, no PHI allowed
3. **Moderation**: PHI detection triggers escalation
4. **Export**: Location-only data, no raw PHI

### Audit Chain

Every collaboration event is hash-chained:

```typescript
const eventHash = sha256({
  id, researchId, artifactId, type,
  actorId, timestamp, metadata, previousHash
});
```

Tampering is detectable via chain verification.

### Access Control

- **Tenant Isolation**: All queries scoped to organization
- **RBAC**: Role-based feature access
- **Time-boxed Tokens**: Share links expire automatically

## Best Practices

### For Implementers

1. **Always audit** - Every action should be logged
2. **Scan for PHI** - Before storing any user-generated content
3. **Use transactions** - For multi-step operations
4. **Handle offline** - Yjs handles sync, but test edge cases

### For Users

1. **Resolve threads** - Keep comment sections clean
2. **Use task boards** - Track work without PHI in titles
3. **Set quiet hours** - Manage notification fatigue
4. **Export regularly** - Archive collaboration history

## Troubleshooting

### WebSocket Connection Issues

```bash
# Check Hocuspocus server
curl http://localhost:1234/health

# Verify JWT token
npm run debug:jwt -- $TOKEN
```

### PHI Scanner False Positives

```bash
# Test specific content
npm run phi:scan -- "Your text here"

# Review scan patterns
cat packages/core/src/phi/patterns.ts
```

### Hash Chain Verification Failures

```bash
# Verify chain for research
npm run collab:verify-chain -- $RESEARCH_ID

# Export and inspect
npm run collab:export -- $RESEARCH_ID --format=json
```

## Related Documentation

- [TENANCY_GUARDS.md](./TENANCY_GUARDS.md) - Multi-tenant security
- [AUDIT_CHAIN_COLLAB.md](./AUDIT_CHAIN_COLLAB.md) - Audit chain details
- [runbooks/collaboration.md](./runbooks/collaboration.md) - Operations guide
- [COLLABORATION_PROVENANCE_DESIGN.md](./COLLABORATION_PROVENANCE_DESIGN.md) - Architecture deep dive
