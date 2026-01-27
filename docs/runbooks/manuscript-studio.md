# Manuscript Studio Runbook

**Version**: 1.0
**Updated**: January 27, 2026
**Track**: M (Phases M0-M8)

---

## Overview

The Manuscript Studio provides AI-powered manuscript generation, collaborative editing, inline comments, and PHI-safe document management for ResearchFlow.

## Features

- AI-powered section generation (IMRaD structure)
- Collaborative real-time editing (Yjs CRDT)
- Inline AI refinement with diff review (accept/reject)
- Comments with threads and resolve workflow
- PHI-safe (LIVE mode gating)
- Version history and provenance logging
- Word budget validation

---

## API Endpoints

### Health Check
```
GET /api/manuscripts/ping
```
Returns service status and governance mode.

### CRUD Operations
```
POST   /api/manuscripts                     # Create manuscript
GET    /api/manuscripts                     # List manuscripts
GET    /api/manuscripts/:id                 # Get manuscript
PATCH  /api/manuscripts/:id                 # Update manuscript
```

### Document Operations
```
GET    /api/manuscripts/:id/sections        # Get sections
GET    /api/manuscripts/:id/doc             # Get latest doc state
POST   /api/manuscripts/:id/doc/save        # Save doc snapshot
```

### AI Operations
```
POST   /api/manuscripts/:id/sections/:sid/refine     # Refine with AI (diff)
POST   /api/manuscripts/:id/sections/:sid/generate   # Generate section
POST   /api/manuscripts/:id/abstract/generate        # Generate abstract
```

### Comments
```
GET    /api/manuscripts/:id/comments                 # Get comments
POST   /api/manuscripts/:id/comments                 # Add comment
POST   /api/manuscripts/:id/comments/:cid/resolve    # Resolve comment
DELETE /api/manuscripts/:id/comments/:cid            # Archive comment
```

### Provenance
```
GET    /api/manuscripts/:id/events          # Provenance log
```

---

## Governance Modes

### DEMO Mode (Default)
- AI calls allowed without restrictions
- PHI warnings displayed but not blocking
- Suitable for testing and demos

### LIVE Mode (Production)
- PHI detected = request blocked
- Only location coordinates returned (no raw values)
- All AI calls logged to provenance
- Fail-closed security model

Set via environment variable:
```bash
GOVERNANCE_MODE=LIVE  # or DEMO
```

---

## Database Tables

### manuscripts
Main manuscript records with status, template type, citation style.

### manuscript_versions
Version history with hash-chained content for integrity.

### manuscript_docs
Yjs state persistence and text content for search/PHI.

### manuscript_comments
Inline comments with anchor positions and threading.

### manuscript_ai_events
AI operation provenance (input/output hashes, no raw content).

### manuscript_audit_log
Hash-chained audit trail for all operations.

---

## Docker Compose

The manuscript studio is included in the standard compose:

```bash
docker compose up -d
```

Or production:
```bash
docker compose -f docker-compose.prod.yml up -d
```

### Required Services
- `orchestrator` - API server (port 3001)
- `postgres` - Database
- `redis` - Cache and job queue
- `web` - Frontend (port 5173 dev, 80 prod)
- `collab` - Real-time collaboration (port 1234, optional)

---

## Verification

Run the verification script:
```bash
./scripts/verify-manuscript-studio.sh
```

Or run E2E tests:
```bash
npm run test:e2e -- tests/e2e/manuscript-journey.spec.ts
```

---

## Troubleshooting

### Endpoint returns HTML instead of JSON
**Cause**: Route not mounted in index.ts
**Fix**: Verify import and `app.use('/api/manuscripts', manuscriptsRoutes)` in index.ts

### Collab disconnects
**Cause**: WebSocket URL doesn't include `/collab` path
**Fix**: Set `VITE_COLLAB_URL=wss://domain/collab` (note the path)

### Content not persisting
**Cause**: Version not being created on save
**Check**:
```sql
SELECT * FROM manuscript_versions WHERE manuscript_id = 'your-id' ORDER BY created_at DESC;
```

### PHI blocking in DEMO mode
**Cause**: GOVERNANCE_MODE not set correctly
**Fix**: Ensure `GOVERNANCE_MODE=DEMO` in .env

### AI refine returns 400
**Check**:
1. Is GOVERNANCE_MODE=LIVE and text contains PHI?
2. Are required fields (selectedText, instruction, selectionStart, selectionEnd) provided?

---

## PHI Handling

In LIVE mode, all AI-related endpoints scan content for PHI:

```typescript
// Example response when PHI detected
{
  "error": "PHI_DETECTED",
  "message": "Content contains PHI. Please remove or redact.",
  "locations": [
    { "start": 8, "end": 18, "type": "NAME" },
    { "start": 25, "end": 35, "type": "DOB" }
  ]
}
```

**Key**: Locations contain coordinates only, never raw PHI values.

---

## Metrics

The manuscript studio exposes metrics at `/api/metrics`:
- `manuscript_created_total`
- `manuscript_section_generated_total`
- `manuscript_refine_requests_total`
- `manuscript_phi_blocked_total`

---

## Support

For issues:
1. Check service logs: `docker compose logs orchestrator`
2. Run verification script
3. Review audit log: `GET /api/manuscripts/:id/events`
4. Check PHI scanner logs for LIVE mode issues
