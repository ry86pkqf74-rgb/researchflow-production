# Stage 20: Conference Preparation - Master Implementation Plan

**Repository:** `ry86pkqf74-rgb/researchflow-production`
**Primary Languages:** TypeScript (516 files), Python (285 files), React/TSX (189 files)
**Generated:** 2026-01-20

---

## Executive Summary

Stage 20 Conference Preparation is **~75% implemented**. This plan covers the remaining 25% needed for production deployment.

### What's Already Complete ✅

| Component | Status | Lines of Code |
|-----------|--------|---------------|
| Python Discovery Module | 100% | 395 |
| Python Registry Module | 100% | 478 |
| Python Guidelines Module | 100% | 793 |
| Python Material Generation | 100% | 789 |
| Python Export Bundle | 100% | 521 |
| Python Provenance Tracking | 100% | 490 |
| TypeScript Conference Types | 95% | 264 |
| React Conference UI | 85% | 936 |
| Orchestrator Stage Config | 100% | ~50 |
| Governance Mappings | 100% | ~30 |
| Dependencies (reportlab, python-pptx) | 100% | N/A |

### What Needs Implementation 🔧

| Component | Gap | Priority |
|-----------|-----|----------|
| Worker FastAPI Endpoints | 100% missing | P0 |
| Orchestrator→Worker Proxy Routes | 70% missing | P0 |
| Frontend API Integration | 50% missing | P0 |
| Download Streaming Endpoint | 100% missing | P1 |
| Integration Tests | 80% missing | P1 |
| E2E Playwright Tests | 100% missing | P2 |
| Documentation | 80% missing | P2 |

---

## Implementation Phases

### Phase 1: Worker FastAPI Endpoints (Python)
**File:** `docs/implementation-plans/01-PHASE1-WORKER-ENDPOINTS.md`
- Add FastAPI routes to expose conference_prep modules
- ~200 lines of new code

### Phase 2: Orchestrator Proxy Routes (TypeScript)
**File:** `docs/implementation-plans/02-PHASE2-ORCHESTRATOR-ROUTES.md`
- Complete conference router with worker proxying
- Add download streaming endpoint
- ~300 lines of new code

### Phase 3: Frontend API Integration (React/TypeScript)
**File:** `docs/implementation-plans/03-PHASE3-FRONTEND-INTEGRATION.md`
- Wire React component to backend APIs
- Add proper error handling and loading states
- ~150 lines of modifications

### Phase 4: Testing Suite
**File:** `docs/implementation-plans/04-PHASE4-TESTING.md`
- Python pytest tests for worker endpoints
- TypeScript vitest tests for orchestrator
- Playwright E2E tests
- ~500 lines of test code

### Phase 5: Documentation & Deployment
**File:** `docs/implementation-plans/05-PHASE5-DOCS-DEPLOY.md`
- API documentation
- User guide
- Docker compose for testing
- CI/CD workflows

---

## Recommended Commit Strategy

### Commit 1: Worker API Layer
```
feat(worker): add FastAPI endpoints for conference prep

- POST /api/conference/discover
- POST /api/conference/extract-guidelines
- POST /api/conference/generate-materials
- POST /api/conference/create-bundle
- GET /api/conference/bundle/{run_id}/download
```

### Commit 2: Orchestrator Integration
```
feat(orchestrator): complete conference API proxy routes

- POST /api/ros/conference/discover → worker
- POST /api/ros/conference/guidelines/extract → worker
- POST /api/ros/conference/export → worker
- GET /api/ros/conference/download/:runId/:filename
```

### Commit 3: Frontend Wiring
```
feat(web): integrate conference-readiness with backend APIs

- Wire discovery mutations to /api/ros/conference/discover
- Wire export flow to /api/ros/conference/export
- Add download handling for generated materials
```

### Commit 4: Testing & Docs
```
test(conference): add comprehensive test suite

- pytest: worker endpoint tests
- vitest: orchestrator route tests
- playwright: e2e conference workflow
- docs: API reference and user guide
```

---

## File Change Summary

### New Files to Create
```
services/worker/src/api/conference_routes.py       (~200 lines)
tests/unit/worker/test_conference_api.py           (~150 lines)
tests/e2e/conference-workflow.spec.ts              (~100 lines)
docs/conference/CONFERENCE_PREP_PHASE.md           (~200 lines)
docs/conference/API_REFERENCE.md                   (~150 lines)
docker-compose.conference-test.yml                 (~50 lines)
```

### Files to Modify
```
services/worker/api_server.py                      (+30 lines)
services/orchestrator/src/routes/conference.ts     (+150 lines)
services/web/src/components/ui/conference-readiness.tsx (+50 lines)
services/web/src/lib/api-client.ts                 (+30 lines)
README.md                                          (+50 lines)
INTEGRATION-ROADMAP.md                             (+20 lines)
```

### Total New Code: ~1,200 lines

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Worker-Orchestrator communication failure | Medium | High | Add health checks, retries |
| Large PDF/PPTX generation timeout | Low | Medium | Async generation with polling |
| PHI leakage in guidelines | Low | Critical | Sanitization already implemented |
| Dependencies version conflicts | Low | Low | Pin versions in requirements.txt |

---

## Success Criteria

1. ✅ `POST /api/ros/conference/discover` returns ranked conferences
2. ✅ `POST /api/ros/conference/guidelines/extract` returns sanitized text + hashes
3. ✅ `POST /api/ros/conference/export` generates real PDF/PPTX/ZIP files
4. ✅ `GET /api/ros/conference/download/:runId/:filename` streams files securely
5. ✅ DEMO mode works without network calls
6. ✅ All tests pass (pytest + vitest + playwright)
7. ✅ Documentation complete

---

## Quick Links to Implementation Plans

1. [Phase 1: Worker FastAPI Endpoints](./01-PHASE1-WORKER-ENDPOINTS.md)
2. [Phase 2: Orchestrator Proxy Routes](./02-PHASE2-ORCHESTRATOR-ROUTES.md)
3. [Phase 3: Frontend API Integration](./03-PHASE3-FRONTEND-INTEGRATION.md)
4. [Phase 4: Testing Suite](./04-PHASE4-TESTING.md)
5. [Phase 5: Documentation & Deployment](./05-PHASE5-DOCS-DEPLOY.md)
