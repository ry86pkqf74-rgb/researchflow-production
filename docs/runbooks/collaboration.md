# Collaboration & Provenance Runbook

## Overview

ResearchFlow's collaboration features include real-time CRDT-based editing (Yjs), artifact provenance tracking, and threaded comments.

## Prerequisites

- Node.js 20+
- PostgreSQL 14+
- Redis (for pub/sub)
- JWT auth configured

## Environment Variables

```bash
# Collaboration Server
COLLAB_PORT=4002
COLLAB_REDIS_URL=redis://localhost:6379

# Database
DATABASE_URL=postgres://user:pass@localhost:5432/researchflow

# Auth
JWT_SECRET=your_jwt_secret
```

## How to Run Locally

### 1. Run Migrations

```bash
npm run db:migrate
```

### 2. Start Redis

```bash
docker run -d -p 6379:6379 redis:7-alpine
```

### 3. Start Collaboration Server

```bash
cd services/collab
npm run dev
```

### 4. Connect from Web App

The web app automatically connects to the collab server when editing manuscripts.

## Architecture

### Yjs CRDT Sync

```
┌─────────────┐    WebSocket    ┌─────────────┐
│   Client A  │◄───────────────►│   Collab    │
└─────────────┘                 │   Server    │
                                │             │
┌─────────────┐    WebSocket    │   (Yjs)     │
│   Client B  │◄───────────────►│             │
└─────────────┘                 └──────┬──────┘
                                       │
                                       ▼
                               ┌───────────────┐
                               │  PostgreSQL   │
                               │  (Snapshots)  │
                               └───────────────┘
```

### Persistence

- **Snapshots**: Periodic full state saves
- **Updates**: Incremental changes for replay
- **Tables**: `manuscript_yjs_snapshots`, `manuscript_yjs_updates`

## Artifact Provenance

### Graph Model

```
┌──────────┐  derived_from  ┌──────────┐
│ Dataset  │───────────────►│ Analysis │
└──────────┘                └────┬─────┘
                                 │
                    references   │
                                 ▼
                           ┌──────────┐
                           │Manuscript│
                           └──────────┘
```

### API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v2/artifacts/:id` | Get artifact |
| GET | `/api/v2/artifacts/:id/graph` | Get provenance graph |
| POST | `/api/v2/artifacts` | Create artifact |
| POST | `/api/v2/artifact-edges` | Create edge |

### Edge Types

- `derived_from` - Output derived from input
- `references` - Citation/reference link
- `supersedes` - Newer version replaces older
- `uses` - Dependency relationship
- `generated_from` - Auto-generated from source
- `exported_to` - Export relationship
- `annotates` - Comment/annotation link

## Comments & Threads

### Data Model

```sql
comments (
  id, research_id, artifact_id, version_id,
  parent_comment_id, thread_id,
  anchor_type, anchor_data,
  body, resolved, assigned_to,
  created_by, created_at, updated_at
)
```

### Anchor Types

- `text_selection` - Selected text range
- `entire_section` - Full section
- `table_cell` - Specific cell
- `figure_region` - Image region
- `slide_region` - Presentation area

### API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/comments/:artifactId` | List comments |
| POST | `/api/comments` | Create comment |
| PUT | `/api/comments/:id` | Update comment |
| POST | `/api/comments/:id/resolve` | Resolve thread |

## PHI Governance

All collaboration content is PHI-scanned:

- **Comments**: Scanned on create/update
- **Yjs updates**: Real-time PHI detection
- **LIVE mode**: PHI blocks the operation

## Troubleshooting

### "WebSocket connection failed"

1. Check collab server is running
2. Verify CORS configuration
3. Check JWT token is valid

### "Sync conflicts"

1. Yjs handles conflicts automatically via CRDT
2. Check network connectivity
3. Review server logs for merge issues

### "Snapshot restore failed"

1. Check database connectivity
2. Verify snapshot exists
3. Check disk space

## Testing

```bash
# Unit tests
cd services/collab
npm test

# Integration tests
npm run test:integration

# WebSocket tests
npm run test:ws
```

## Related Documentation

- [services/collab/](../../services/collab/) - Collaboration server
- [migrations/0008_phase_h_document_lifecycle.sql](../../migrations/0008_phase_h_document_lifecycle.sql) - DB schema
- [services/orchestrator/src/routes/artifact-graph.ts](../../services/orchestrator/src/routes/artifact-graph.ts) - Graph API
- [services/orchestrator/src/routes/comments.ts](../../services/orchestrator/src/routes/comments.ts) - Comments API
