# ResearchFlow Production - Checkpoint Summary

**Date**: January 27, 2026
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

### Track B (Phases 10-17): SciSpace Parity - COMPLETE ✅

| Phase | Description | Status |
|-------|-------------|--------|
| 10 | Paper Library & PDF Ingestion | ✅ |
| 11 | PDF Viewer with Annotations | ✅ |
| 12 | AI Copilot for PDFs (RAG) | ✅ |
| 13 | Literature Review Workspace | ✅ |
| 14 | Citation Manager (CSL) | ✅ |
| 15 | Manuscript Export (Pandoc) | ✅ |
| 16 | Integrity Tools | ✅ |
| 17 | Ecosystem Integrations | ✅ |

---

## Migrations to Run

```bash
# Track M migrations
cat migrations/003_create_manuscript_tables.sql | docker compose exec -T postgres psql -U ros -d ros
cat migrations/005_manuscript_docs_comments.sql | docker compose exec -T postgres psql -U ros -d ros

# Track B migrations (Phases 10-12)
cat migrations/006_paper_library.sql | docker compose exec -T postgres psql -U ros -d ros
cat migrations/007_paper_annotations.sql | docker compose exec -T postgres psql -U ros -d ros
cat migrations/008_ai_copilot.sql | docker compose exec -T postgres psql -U ros -d ros

# Track B migration (Phase 13)
cat migrations/009_literature_workspace.sql | docker compose exec -T postgres psql -U ros -d ros

# Track B migration (Phase 14)
cat migrations/010_citation_manager.sql | docker compose exec -T postgres psql -U ros -d ros

# Track B migration (Phase 15)
cat migrations/011_manuscript_export.sql | docker compose exec -T postgres psql -U ros -d ros

# Track B migration (Phase 16)
cat migrations/012_integrity_tools.sql | docker compose exec -T postgres psql -U ros -d ros

# Track B migration (Phase 17)
cat migrations/013_ecosystem_integrations.sql | docker compose exec -T postgres psql -U ros -d ros
```

---

## Phase Details (Phases 13-17)

### Phase 13: Literature Review Workspace
- **Database**: `collections`, `collection_papers`, `literature_notes`, `smart_collections`
- **API**: `/api/collections`, `/api/notes`
- **Frontend**: `CollectionsSidebar` component, papers page integration

### Phase 14: Citation Manager (CSL)
- **Database**: `citations`, `citation_groups`, `citation_styles`, `citation_formatted`
- **API**: `/api/citations`, import from DOI/PubMed, batch formatting

### Phase 15: Manuscript Export (Pandoc)
- **Database**: `export_templates`, `export_jobs`, `export_presets`, `journal_requirements`
- **API**: `/api/export`, templates, presets, journal search

### Phase 16: Integrity Tools
- **Database**: `integrity_checks`, `similarity_matches`, `statistical_verifications`, `citation_verifications`, `integrity_reports`, `retracted_papers`
- **API**: `/api/integrity`, plagiarism check, stats verification, citation verification

### Phase 17: Ecosystem Integrations
- **Database**: `user_integrations`, `orcid_profiles`, `reference_manager_items`, `webhook_configs`, `webhook_logs`, `import_export_jobs`
- **API**: `/api/ecosystem`, ORCID, Zotero, Mendeley, webhooks, import/export

---

## Key Files (Phases 13-17)

### Backend Routes
- `services/orchestrator/src/routes/collections.ts`
- `services/orchestrator/src/routes/literature-notes.ts`
- `services/orchestrator/src/routes/citations.ts`
- `services/orchestrator/src/routes/export.ts`
- `services/orchestrator/src/routes/integrity.ts`
- `services/orchestrator/src/routes/ecosystem.ts`

### Frontend Components
- `services/web/src/components/papers/CollectionsSidebar.tsx`

---

## Environment Notes

- **PostgreSQL**: `pgvector/pgvector:pg16` with vector extension
- **OpenAI API Key**: Required for AI Copilot (`OPENAI_API_KEY`)
- **Embedding Model**: `text-embedding-3-small` (1536 dimensions)
- **Chat Model**: `gpt-4o-mini`

---

## Context for Next Session

When resuming development:

1. **Start Docker**: `docker compose up -d`
2. **Check services**: `docker compose ps`
3. **Run migrations if needed** (see above)
4. **Test APIs**:
   ```bash
   curl http://localhost:3001/api/manuscripts/ping
   curl http://localhost:3001/api/papers/ping
   curl http://localhost:3001/api/citations/ping
   curl http://localhost:3001/api/export/ping
   curl http://localhost:3001/api/integrity/ping
   curl http://localhost:3001/api/ecosystem/ping
   ```
5. **View logs**: `docker compose logs orchestrator --tail=50`

---

## Checkpoint 4.5: Auth/Live Mode Verification ✅

### Authentication Architecture

The system uses a dual-mode authentication architecture:

| Mode | Authentication | Features | Data |
|------|---------------|----------|------|
| **Demo Mode** | Unauthenticated | Limited features | Mock data acceptable |
| **Live Mode** | JWT required | Full features | REAL data required |

### Auth Middleware Stack

Located in `services/orchestrator/src/services/authService.ts`:

1. **`optionalAuth`** (line 530-558): Attaches user if token present, doesn't require it
2. **`requireAuth`** (line 480-524): Requires valid JWT, returns 401 if missing/invalid
3. **`devOrRequireAuth`** (line 579-588): Uses dev fallback in development, requires auth in production

### RBAC Middleware

Located in `services/orchestrator/src/middleware/rbac.ts`:

1. **`requirePermission(permission)`**: Checks specific permission (e.g., 'ANALYZE', 'EXPORT')
2. **`requireRole(minRole)`**: Checks minimum role level (VIEWER < RESEARCHER < STEWARD < ADMIN)
3. **`protect(permission)`**: Combines active account check + permission check

### Route Protection Summary

| Route | Protection | Notes |
|-------|------------|-------|
| `/api/auth/*` | Public | Login, register, refresh |
| `/api/analysis/extract` | `requirePermission('ANALYZE')` | Clinical extraction |
| `/api/analysis/run` | `requirePermission('ANALYZE')` | Statistical analysis |
| `/api/governance/approve` | `requireRole('STEWARD')` | Approval workflow |
| `/api/ros/export/data` | `requireRole('STEWARD')` | Data export |
| `/api/papers/*` | `optionalAuth` + user context | Paper library |
| `/api/manuscripts/*` | `optionalAuth` + user context | Manuscript studio |
| `/api/citations/*` | `optionalAuth` + user context | Citation manager |

### Global Auth Middleware (routes.ts)

Line 898 applies `optionalAuth` globally:
```typescript
app.use(optionalAuth);
```

Lines 902-933 set user context for all routes:
- If JWT authenticated: Uses token user info with role
- If unauthenticated: Sets anonymous user with VIEWER role

### Frontend Auth Integration

Located in `services/web/src/hooks/use-auth.ts`:

- **Zustand store** for token persistence
- **Auto-refresh** on 401 responses
- **`useAuth()` hook** provides: `user`, `isAuthenticated`, `login`, `register`, `logout`

Located in `services/web/src/lib/queryClient.ts`:

- **`buildRequestHeaders()`** automatically adds `Authorization: Bearer <token>`
- All API requests include auth token when available

### Environment Variables for Auth

```bash
# JWT Configuration
JWT_SECRET=<secure-random-key>  # REQUIRED in production
JWT_EXPIRES_IN=24h
JWT_REFRESH_EXPIRES_IN=7d

# Auth Modes
AUTH_ALLOW_STATELESS_JWT=true   # Dev only, false in production
GOVERNANCE_MODE=LIVE            # LIVE or STANDBY

# Admin Access
ADMIN_EMAILS=logan.glosser@gmail.com  # Comma-separated list
```

### Test Auth Flow

```bash
# 1. Register new user
curl -X POST http://localhost:3001/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"securepassword123"}'

# 2. Login and get token
TOKEN=$(curl -s -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"securepassword123"}' | jq -r '.accessToken')

# 3. Access protected endpoint
curl -H "Authorization: Bearer $TOKEN" http://localhost:3001/api/analysis/health

# 4. Test TESTROS bypass (development only)
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"testros@gmail.com","password":"any"}'
```

### Verification Checklist

- [x] Auth middleware exists (`authService.ts`)
- [x] RBAC middleware exists (`rbac.ts`)
- [x] Global `optionalAuth` applied (routes.ts:898)
- [x] User context set for all routes (routes.ts:902-933)
- [x] Analysis endpoints protected with `requirePermission('ANALYZE')`
- [x] Frontend API calls include auth headers (`queryClient.ts`)
- [x] Token persistence via Zustand + localStorage (`use-auth.ts`)
- [x] Environment variables documented (`.env.example`)
- [x] Docker compose includes auth env vars (`docker-compose.yml`)

---

**ALL TRACKS COMPLETE: Track A, Track M, Track B (10-17)**
**Auth/Live Mode Wiring: VERIFIED ✅**
**ResearchFlow Production is feature-complete for SciSpace parity**
