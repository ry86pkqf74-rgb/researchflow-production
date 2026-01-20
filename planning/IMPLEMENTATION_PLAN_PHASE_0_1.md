# ResearchFlow 100 Improvements - Implementation Plan
## Phases 0 & 1: Foundation + Custom Workflow Builder

**Created:** 2026-01-20
**Branch:** `feature/roadmap-100-improvements-foundation`
**Scope:** Items 1-10 from the 100 Improvements Playbook

---

## Executive Summary

This plan implements the foundational work for ResearchFlow's 100 improvements initiative:
- **Phase 0**: Resolve 83 Drizzle schema mismatches to unblock typecheck
- **Phase 1**: Build the Custom Workflow Builder (items 1-10)

---

## Current State Analysis

### Existing Infrastructure
- **Migrations**: 5 existing files (0000, 0002, 003, 0004, 0005)
- **Schema**: `packages/core/types/schema.ts` (~1200 lines, 50+ tables defined)
- **Orchestrator**: Express routes in `services/orchestrator/src/routes/` (26 route files)
- **Worker**: Python workflow engine with stage registry (stages 1-20)
- **Web**: React/Vite with Wouter routing, 19 pages in `services/web/src/pages/`

### Schema Alignment Issues (83 errors)
Based on `docs/LIVE_VIEW_STATUS.md`, the Drizzle schema defines tables that don't exist in migrations:
- Phase F tables (feature_flags, experiments, experiment_assignments)
- Phase F tables (org_custom_fields, entity_custom_field_values)
- Phase F tables (artifact_embeddings, tutorial_assets)
- Topic briefs, venues, doc_kits, doc_kit_items, doc_anchors

---

## Phase 0: Schema Alignment

### Objective
Create migration `0006_phase_f_schema_alignment.sql` to add all missing tables defined in `schema.ts`.

### Files to Create/Modify

| File | Action | Description |
|------|--------|-------------|
| `migrations/0006_phase_f_schema_alignment.sql` | CREATE | Add missing Phase F tables |
| `docs/dev/MIGRATIONS.md` | CREATE | Migration discipline documentation |

### Commit
```
fix(db): align migrations with drizzle schema (0006_phase_f_schema_alignment)
```

---

## Phase 1: Custom Workflow Builder

### Phase 1A: Database Layer

**Migration:** `0007_phase_g_workflow_builder.sql`

Tables:
- `workflows` - metadata (id, org_id, name, description, status)
- `workflow_versions` - immutable versions (workflow_id, version, definition JSONB)
- `workflow_templates` - seeded templates
- `workflow_policies` - RBAC per workflow
- `workflow_run_checkpoints` - for resume capability

**Schema Updates:** `packages/core/types/schema.ts`
**New Types:** `packages/core/types/workflow.ts`

**Commit:** `feat(core): add workflow builder tables, types, and migration`

---

### Phase 1B: Orchestrator API

**New Service:** `services/orchestrator/src/services/workflowService.ts`
**New Router:** `services/orchestrator/src/routes/workflows.ts`

Endpoints:
- GET /api/workflows - List workflows
- POST /api/workflows - Create workflow
- GET /api/workflows/:id - Get workflow + latest version
- POST /api/workflows/:id/versions - Create new version
- GET /api/workflows/:id/versions - List versions
- GET /api/workflows/:id/versions/:v - Get specific version
- POST /api/workflows/:id/publish - Publish (lock) workflow
- POST /api/workflows/:id/policy - Set policy
- GET /api/workflows/:id/policy - Get policy
- GET /api/workflows/templates - List templates

**Commit:** `feat(orchestrator): add workflow CRUD API with policy enforcement`

---

### Phase 1C: Worker DAG Compiler

**New Files:**
- `services/worker/src/workflow_engine/dag_compiler.py`
- `services/worker/src/workflow_engine/dag_runner.py`

Features:
- Schema validation
- Cycle detection
- Topological sort
- Condition evaluation (on_success, on_failure)
- Gate handling (auto-pass in DEMO, require approval in LIVE)
- Checkpoint/resume support

**Commit:** `feat(worker): add DAG compiler and runner for custom workflows`

---

### Phase 1D: Web UI

**New Pages:**
- `services/web/src/pages/workflows.tsx` - List view with create dialog
- `services/web/src/pages/workflow-builder.tsx` - ReactFlow DAG editor

**Routes to add in App.tsx:**
- /workflows
- /workflow-builder/:id

**Commit:** `feat(web): add workflows list and workflow builder UI`

---

### Phase 1E: Tests & Documentation

**Tests:**
- `services/orchestrator/src/__tests__/workflows.test.ts`
- `services/worker/tests/test_dag_compiler.py`
- `tests/e2e/mocks/handlers.ts` updates

**Documentation:**
- `docs/dev/MIGRATIONS.md`
- `docs/roadmaps/RESEARCHFLOW_100_IMPROVEMENTS_2026.md`
- `integration-prompts/workflows/` phase placeholders

**Commit:** `docs: add migration guide, roadmap, and tests`

---

## Commit Plan (8 commits)

1. `fix(db): align migrations with drizzle schema (0006)`
2. `docs: add migration discipline guide`
3. `feat(core): add workflow builder tables + types (0007)`
4. `feat(orchestrator): workflow CRUD + policy API`
5. `feat(worker): DAG compiler and runner`
6. `feat(web): workflows list + builder UI`
7. `test: add workflow tests + E2E mocks`
8. `docs: add roadmap + phase prompt placeholders`

---

## Validation After Each Commit

- [ ] `npm run typecheck` passes
- [ ] `npm test` passes
- [ ] `cd services/worker && pytest` passes
- [ ] Docker services start
- [ ] API endpoints respond
- [ ] UI pages render
