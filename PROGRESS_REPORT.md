# ResearchFlow Integration Rebuild Progress

**Started**: 2026-01-28
**Status**: In Progress

## Phase Completion

| Phase | Status | Issues Found | Fixed |
|-------|--------|--------------|-------|
| 0. Pre-flight Setup | ✅ Complete | None | - |
| 1. P0 Assessment (Export/PHI) | ✅ Complete | Already fixed in prior commit | - |
| 2. Backend Route Audit | ✅ Complete | 12 missing routes | ✅ All registered |
| 3. Environment Config | ✅ Complete | None - comprehensive | - |
| 4. Docker Rebuild | ⏳ Pending | Docker starting | - |
| 5. Smoke Tests | ⏳ Pending | - | - |
| 6. Frontend Testing | ⏳ Pending | - | - |
| 7. Final Commit | ⏳ Pending | - | - |

## Issues Discovered & Fixed

### 1. Missing Route Registrations (Fixed)

**12 routes** were exported but NOT registered in `services/orchestrator/src/index.ts`:

| Route File | Mount Path | Purpose |
|------------|------------|---------|
| projects.ts | /api/projects | Project CRUD operations |
| citations.ts | /api/citations | Citation management (APA, MLA, etc.) |
| export.ts | /api/export/documents | Document export (PDF, DOCX, LaTeX) |
| ecosystem.ts | /api/ecosystem | External ecosystem integrations |
| integrity.ts | /api/integrity | Data integrity & reproducibility checks |
| papers.ts | /api/papers | Paper management & metadata |
| collections.ts | /api/collections | Research collections |
| guidelines.routes.ts | /api/guidelines/full | Full guidelines engine routes |
| paper-annotations.ts | /api/papers/annotations | Paper annotations & highlights |
| paper-copilot.ts | /api/papers/copilot | AI paper copilot assistant |
| literature-notes.ts | /api/literature/notes | Literature notes & summaries |
| branches.routes.ts | /api/branches | Git-style branch management |

**Resolution**: Added imports and registrations to `services/orchestrator/src/index.ts`

### 2. P0 Items Already Fixed

Per the audit document, the following P0 critical items were already addressed in commit `db43fb4`:

- ✅ **Export Toolchain**: Worker Dockerfile has pandoc, texlive-latex-base, texlive-fonts-recommended, texlive-latex-extra, wkhtmltopdf, fonts-liberation, fonts-dejavu-core
- ✅ **PHI Protection**: requirements.txt has presidio-analyzer, presidio-anonymizer, spacy; Dockerfile downloads spaCy model
- ✅ **Production Compose Parity**: docker-compose.prod.yml has guideline-engine service, all env vars, projects-data volume

## Key Service URLs

| Service | Development URL | Production |
|---------|-----------------|------------|
| Frontend | http://localhost:5173 | https://domain/ |
| Orchestrator API | http://localhost:3001 | https://domain/api |
| Worker API | http://localhost:8000 | Internal only |
| Collab WebSocket | ws://localhost:1234 | wss://domain/collab |
| Collab Health | http://localhost:1235 | Internal only |
| Guideline Engine | http://localhost:8001 | Internal only |

## Docker Services

| Service | Status | Notes |
|---------|--------|-------|
| postgres | ⏳ | PostgreSQL 16-alpine |
| redis | ⏳ | Redis 7-alpine with persistence |
| migrate | ⏳ | Runs 17+ SQL migrations |
| orchestrator | ⏳ | Node.js Express API |
| worker | ⏳ | Python FastAPI compute |
| web | ⏳ | React/Vite frontend |
| collab | ⏳ | Yjs CRDT collaboration |
| guideline-engine | ⏳ | Python FastAPI clinical scoring |

## API Endpoints to Test

### Health Checks
- [ ] GET http://localhost:3001/health - Orchestrator
- [ ] GET http://localhost:8000/health - Worker
- [ ] GET http://localhost:1235/health - Collab
- [ ] GET http://localhost:8001/health - Guideline Engine

### Core APIs
- [ ] GET http://localhost:3001/api/governance/state
- [ ] GET http://localhost:3001/api/cumulative/stages
- [ ] GET http://localhost:3001/api/ai/router/status
- [ ] GET http://localhost:3001/api/hub/health
- [ ] GET http://localhost:3001/api/projects (auth required)

### Newly Registered Routes
- [ ] GET http://localhost:3001/api/projects
- [ ] GET http://localhost:3001/api/citations
- [ ] GET http://localhost:3001/api/papers
- [ ] GET http://localhost:3001/api/collections

## Commits Made

| Hash | Message |
|------|---------|
| (pending) | fix(routes): register 12 missing API routes in orchestrator |

## Next Steps

1. Wait for Docker to start
2. Run `docker compose down -v` to clean up
3. Run `docker compose build --no-cache` to rebuild
4. Run `docker compose up -d` to start services
5. Wait for healthchecks (60 seconds)
6. Run `./scripts/smoke-test.sh`
7. Test frontend in browser
8. Commit and push changes
