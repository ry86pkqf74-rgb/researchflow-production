# ResearchFlow Production - Checkpoint Summary

**Date**: January 27, 2026
**Git HEAD**: 930d331
**Repository**: https://github.com/ry86pkqf74-rgb/researchflow-production

---

## Completed Tracks

### Track A (Phases 1-9): Production Activation ✅

| Phase | Description | Status |
|-------|-------------|--------|
| 1 | Migration runner in prod compose | ✅ |
| 2 | Collab healthcheck port (1235) | ✅ |
| 3 | Web Dockerfile build args | ✅ |
| 4 | WebSocket URL for nginx | ✅ |
| 5 | Workflow state Redis persistence | ✅ |
| 6 | Demo fixtures audit | ✅ |
| 7 | PHI location-only reporting | ✅ |
| 8 | Integration tests scaffolded | ✅ |
| 9 | Final verification | ✅ |

### Track M (Phases M0-M8): Manuscript Studio ✅

| Phase | Description | Status |
|-------|-------------|--------|
| M0 | Wiring audit document | ✅ |
| M1 | Canonical `/api/manuscripts` CRUD | ✅ |
| M2 | Document persistence (Yjs state) | ✅ |
| M3 | Comments with threads/resolve | ✅ |
| M4 | AI Refine returns diff | ✅ |
| M5 | PHI gating on manuscript routes | ✅ |
| M6 | Generation UX endpoints | ✅ |
| M7 | E2E tests (Playwright) | ✅ |
| M8 | Verification script + runbook | ✅ |

---

## Git Commits (Track A & M)

| Commit | Description |
|--------|-------------|
| `930d331` | docs: add comprehensive wiring guides for backend and frontend |
| `dc441a3` | fix(Track M): mount manuscripts route and fix migration types |
| `b4f3306` | feat(manuscript): Track M complete - Canonical API, comments, tests |
| `cb4e019` | feat(manuscript): Track M Phases M0-M4 - Canonical API with comments |
| `2205702` | [Feature] Add database persistence for PHI scans and datasets |

---

## Files Created/Modified

### Routes
- `services/orchestrator/routes.ts` - Added manuscripts route import/mount
- `services/orchestrator/src/routes/manuscripts.ts` - Canonical CRUD API

### Migrations
- `migrations/003_create_manuscript_tables.sql` - Fixed user_id types
- `migrations/005_manuscript_docs_comments.sql` - Docs, comments, AI events

### Tests
- `tests/e2e/manuscript-journey.spec.ts` - End-to-end Playwright tests
- `tests/integration/collab.test.ts` - 25 test cases
- `tests/integration/artifact-graph.test.ts` - 22 test cases
- `tests/integration/webhooks.test.ts` - 28 test cases
- `tests/integration/imrad-ai.test.ts` - 30 test cases

### Documentation
- `docs/ROUTE_MOUNTING_GUIDE.md` - Backend route registration guide
- `docs/UI_WIRING_GUIDE.md` - Frontend routing & patterns
- `docs/MANUSCRIPT_STUDIO_WIRING_AUDIT.md` - Audit document
- `docs/runbooks/manuscript-studio.md` - Operations runbook
- `docs/DEPLOYMENT_CHECKLIST.md` - Production deployment
- `docs/DEMO_FIXTURES_INVENTORY.md` - Demo data inventory

### Scripts
- `scripts/verify-manuscript-studio.sh` - Verification script

---

## API Endpoints Verified

| Endpoint | Status | Response |
|----------|--------|----------|
| `GET /api/manuscripts/ping` | ✅ 200 | `{"status":"ok","service":"manuscript-studio"}` |
| `GET /api/manuscripts` | ✅ 200 | `{"manuscripts":[],"pagination":{...}}` |
| `GET /health` | ✅ 200 | `{"status":"healthy","service":"orchestrator"}` |

---

## Database Tables Created

### Migration 003 (manuscripts)
- `manuscripts` - Core manuscript records
- `manuscript_versions` - Version history (hash-chained)
- `manuscript_authors` - Author records
- `manuscript_citations` - Citation library
- `manuscript_audit_log` - Audit trail

### Migration 005 (docs/comments)
- `manuscript_docs` - Yjs document state
- `manuscript_comments` - Inline comments with anchors
- `manuscript_ai_events` - AI operation provenance

---

## Docker Services Status

| Service | Port | Status |
|---------|------|--------|
| orchestrator | 3001 | ✅ Running |
| web | 5173 | ✅ Running |
| worker | 8000 | ✅ Running |
| postgres | 5432 | ✅ Running |
| redis | 6379 | ✅ Running |
| nginx | 80/443 | ✅ Running |
| collab | 1234/1235 | ⚠️ Restarting (known issue) |

---

## Key Patterns Established

### Backend Route Registration
1. Create route file in `services/orchestrator/src/routes/`
2. Import in `services/orchestrator/routes.ts`
3. Mount with `app.use()` in `registerRoutes()`
4. Restart Docker: `docker compose restart orchestrator`

### Frontend Page Addition
1. Create page in `services/web/src/pages/`
2. Import in `services/web/src/App.tsx`
3. Add `<Route>` in `<Switch>` component
4. Wrap with `<AuthGate>` if protected

### PHI Scanning
```typescript
import { scanForPhi } from '../services/phi-protection';
const result = scanForPhi(content);
if (result.detected) {
  // Return 400 with location-only info
}
```

---

## Next: Track B (Phases 10-17) - SciSpace Parity

| Phase | Feature |
|-------|---------|
| 10 | Paper Library & PDF ingestion |
| 11 | PDF Viewer with annotations |
| 12 | AI Copilot for PDFs |
| 13 | Literature Review workspace |
| 14 | Citation Manager (CSL) |
| 15 | Manuscript Export (Pandoc) |
| 16 | Integrity Tools |
| 17 | Ecosystem Integrations |

---

## Context for Next Session

When resuming development:

1. **Start Docker**: `docker compose up -d`
2. **Check services**: `docker compose ps`
3. **Run migrations if needed**:
   ```bash
   cat migrations/003_create_manuscript_tables.sql | docker compose exec -T postgres psql -U ros -d ros
   cat migrations/005_manuscript_docs_comments.sql | docker compose exec -T postgres psql -U ros -d ros
   ```
4. **Test API**: `curl http://localhost:3001/api/manuscripts/ping`
5. **View logs**: `docker compose logs orchestrator --tail=50`

---

**Track A & Track M Complete**
**Ready for Track B: SciSpace Parity**
