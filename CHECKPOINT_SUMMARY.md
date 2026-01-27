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

**ALL TRACKS COMPLETE: Track A, Track M, Track B (10-17)**
**ResearchFlow Production is feature-complete for SciSpace parity**
