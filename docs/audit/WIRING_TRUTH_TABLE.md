# Wiring Truth Table (Docs ↔ Code ↔ Runtime)

Generated: 2026-01-26

## Purpose

This document maps each documented ROS feature to its runtime requirements, identifying what exists vs. what is missing in Docker Compose.

---

## Feature Wiring Matrix

### 1. Literature Integration (Phase 2)

| Component | Doc Claim | Code Path | Runtime Wired? | Env Vars Needed | Status |
|-----------|-----------|-----------|----------------|-----------------|--------|
| PubMed Search | ✅ `literature.md` | `packages/manuscript-engine/src/services/pubmed.service.ts` | ✅ | `NCBI_API_KEY` (optional), `REDIS_URL` | ✅ Complete |
| Semantic Scholar | ✅ `literature.md` | `packages/manuscript-engine/src/services/semantic-scholar.service.ts` | ✅ | `SEMANTIC_SCHOLAR_API_KEY` | ⚠️ Missing env var in compose |
| arXiv Search | ✅ `literature.md` | `packages/manuscript-engine/src/services/arxiv.service.ts` | ✅ | None | ✅ Complete |
| Citation Formatter | ✅ `literature.md` | `packages/manuscript-engine/src/services/citation-formatter.service.ts` | ✅ | None | ✅ Complete |
| Redis Caching | ✅ `literature.md` | `services/orchestrator/src/services/redis-cache.ts` | ✅ | `REDIS_URL`, `LITERATURE_CACHE_TTL` | ⚠️ `LITERATURE_CACHE_TTL` missing |

**Routes**: `/api/literature/search`, `/api/literature/item/:id`, `/api/literature/library`, `/api/literature/format`

**Required Services**: orchestrator, redis

---

### 2. IMRaD Manuscript Engine (Phase 3)

| Component | Doc Claim | Code Path | Runtime Wired? | Env Vars Needed | Status |
|-----------|-----------|-----------|----------------|-----------------|--------|
| Introduction Builder | ✅ `manuscript_engine.md` | `packages/manuscript-engine/src/services/introduction-builder.service.ts` | ✅ | AI keys | ✅ Complete |
| Methods Populator | ✅ `manuscript_engine.md` | `packages/manuscript-engine/src/services/methods-populator.service.ts` | ✅ | AI keys | ✅ Complete |
| Results Scaffold | ✅ `manuscript_engine.md` | `packages/manuscript-engine/src/services/results-scaffold.service.ts` | ✅ | AI keys | ✅ Complete |
| Discussion Builder | ✅ `manuscript_engine.md` | `packages/manuscript-engine/src/services/discussion-builder.service.ts` | ✅ | AI keys | ✅ Complete |
| Abstract Generator | ✅ `manuscript_engine.md` | `packages/manuscript-engine/src/services/abstract-generator.service.ts` | ✅ | AI keys | ✅ Complete |
| PHI Scanning | ✅ `manuscript_engine.md` | `packages/phi-engine/`, `services/orchestrator/src/middleware/phiScan.ts` | ✅ | `PHI_SCAN_ENABLED`, `PHI_FAIL_CLOSED` | ⚠️ Missing in compose |

**Routes**: `/api/manuscript/*`, `/api/ai/*`

**Required Services**: orchestrator, worker, postgres

---

### 3. Conference Preparation (Stage 20)

| Component | Doc Claim | Code Path | Runtime Wired? | Env Vars Needed | Status |
|-----------|-----------|-----------|----------------|-----------------|--------|
| Conference Discovery | ✅ `conference_prep.md` | `services/worker/src/conference_prep/discovery.py` | ✅ | `ENABLE_WEB_SEARCH` | ⚠️ Missing in compose |
| Guideline Extraction | ✅ `conference_prep.md` | `services/worker/src/conference_prep/guidelines.py` | ✅ | None | ✅ Complete |
| Material Generation | ✅ `conference_prep.md` | `services/worker/src/conference_prep/generate_materials.py` | ✅ | AI keys | ✅ Complete |
| Export Bundle | ✅ `conference_prep.md` | `services/worker/src/conference_prep/export_bundle.py` | ✅ | `ARTIFACTS_PATH` | ⚠️ Named `ARTIFACT_PATH` in compose |
| Stage 20 Registry | ✅ `conference_prep.md` | `services/worker/src/workflow_engine/stages/stage_20_conference.py` | ✅ | None | ✅ Complete |

**Routes**: `/api/ros/conference/discover`, `/api/ros/conference/guidelines`, `/api/ros/conference/generate`, `/api/ros/conference/export`

**Required Services**: orchestrator, worker, redis

**Naming Issue**: Doc uses `ARTIFACTS_PATH`, compose uses `ARTIFACT_PATH` (missing 'S')

---

### 4. Collaboration (CRDT/Yjs)

| Component | Doc Claim | Code Path | Runtime Wired? | Env Vars Needed | Status |
|-----------|-----------|-----------|----------------|-----------------|--------|
| Collab Server | ✅ `collaboration.md` | `services/collab/src/server.ts` | ✅ | `PORT`, `REDIS_URL`, `DATABASE_URL` | ✅ Complete |
| Yjs Persistence | ✅ `collaboration.md` | `services/collab/src/persistence/` | ✅ | `DATABASE_URL` | ✅ Complete |
| Auth Integration | ✅ `collaboration.md` | `services/collab/src/auth.ts` | ✅ | `JWT_SECRET` | ✅ Complete |
| PHI Scanner (Collab) | ✅ `collaboration.md` | `services/collab/src/phi-scanner.ts` | ✅ | None | ✅ Complete |

**Routes**: WebSocket at port 1234, health at port 1235

**Required Services**: collab, postgres, redis

**Doc Mismatch**: Runbook references `COLLAB_PORT`, `COLLAB_REDIS_URL` but code uses `PORT`, `REDIS_URL`

---

### 5. Artifact Provenance & Comments

| Component | Doc Claim | Code Path | Runtime Wired? | Env Vars Needed | Status |
|-----------|-----------|-----------|----------------|-----------------|--------|
| artifact_edges table | ✅ `collaboration.md` | `migrations/0008_phase_h_document_lifecycle.sql` | ✅ | None | ✅ Complete |
| Graph API Routes | ✅ `collaboration.md` | `services/orchestrator/src/routes/artifact-graph.ts` | ✅ | None | ✅ Complete |
| Comments Table | ✅ `collaboration.md` | `migrations/0008_phase_h_document_lifecycle.sql` | ✅ | None | ✅ Complete |
| Comments Routes | ✅ `collaboration.md` | `services/orchestrator/src/routes/comments.ts` | ✅ | None | ✅ Complete |

**Routes**: `/api/v2/artifacts/:id`, `/api/v2/artifacts/:id/graph`, `/api/v2/artifact-edges`, `/api/comments/:artifactId`

**Required Services**: orchestrator, postgres

---

### 6. Feature Flags & Experiments (Phase F)

| Component | Doc Claim | Code Path | Runtime Wired? | Env Vars Needed | Status |
|-----------|-----------|-----------|----------------|-----------------|--------|
| governance_config table | ✅ `PHASE_F_OBSERVABILITY_FEATUREFLAGS.md` | `migrations/0010_phase_f_observability_featureflags.sql` | ✅ | None | ✅ Complete |
| feature_flags table | ✅ `PHASE_F_OBSERVABILITY_FEATUREFLAGS.md` | `migrations/0010_phase_f_observability_featureflags.sql` | ✅ | None | ✅ Complete |
| experiments table | ✅ `PHASE_F_OBSERVABILITY_FEATUREFLAGS.md` | `migrations/0010_phase_f_observability_featureflags.sql` | ✅ | None | ✅ Complete |
| FeatureFlagsService | ✅ `PHASE_F_OBSERVABILITY_FEATUREFLAGS.md` | `services/orchestrator/src/services/feature-flags.service.ts` | ✅ | `FEATURE_*` overrides | ✅ Complete |
| ExperimentsService | ✅ `PHASE_F_OBSERVABILITY_FEATUREFLAGS.md` | `services/orchestrator/src/services/experiments.service.ts` | ✅ | None | ✅ Complete |

**Routes**: `/api/governance/state`, `/api/governance/mode`

**Required Services**: orchestrator, postgres

---

### 7. Analytics (Phase F)

| Component | Doc Claim | Code Path | Runtime Wired? | Env Vars Needed | Status |
|-----------|-----------|-----------|----------------|-----------------|--------|
| analytics_events table | ✅ `PHASE_F_OBSERVABILITY_FEATUREFLAGS.md` | `migrations/0010_phase_f_observability_featureflags.sql` | ✅ | None | ✅ Complete |
| AnalyticsService | ✅ `PHASE_F_OBSERVABILITY_FEATUREFLAGS.md` | `services/orchestrator/src/services/analytics.service.ts` | ✅ | `ANALYTICS_IP_SALT` | ⚠️ Missing in compose |
| SSE Stream | ✅ `PHASE_F_OBSERVABILITY_FEATUREFLAGS.md` | `services/orchestrator/src/routes/stream.ts` | ✅ | None | ✅ Complete |

**Routes**: `/api/analytics/events`, `/api/analytics/summary`, `/api/stream`

**Required Services**: orchestrator, postgres

---

### 8. Webhooks (External Integrations)

| Component | Doc Claim | Code Path | Runtime Wired? | Env Vars Needed | Status |
|-----------|-----------|-----------|----------------|-----------------|--------|
| Stripe Handler | ✅ `webhooks.md` | `services/orchestrator/src/webhooks/stripe.ts` | ✅ | `STRIPE_WEBHOOK_SECRET` | ⚠️ Missing in compose |
| Zoom Handler | ✅ `webhooks.md` | `services/orchestrator/src/webhooks/zoom.ts` | ✅ | `ZOOM_WEBHOOK_SECRET_TOKEN`, `ZOOM_VERIFICATION_TOKEN` | ⚠️ Missing in compose |
| Webhook Routes | ✅ `webhooks.md` | `services/orchestrator/src/routes/webhooks.ts` | ✅ | None | ✅ Complete |
| Health Endpoint | ✅ `webhooks.md` | `services/orchestrator/src/routes/webhooks.ts` | ✅ | None | ✅ Complete |

**Routes**: `POST /api/webhooks/stripe`, `POST /api/webhooks/zoom`, `GET /api/webhooks/health`

**Required Services**: orchestrator

---

## Missing Environment Variables Summary

### docker-compose.yml (dev) - Orchestrator

| Variable | Purpose | Default | Priority |
|----------|---------|---------|----------|
| `SEMANTIC_SCHOLAR_API_KEY` | Literature search API | None | Medium |
| `LITERATURE_CACHE_TTL` | Cache duration | 3600 | Low |
| `PHI_SCAN_ENABLED` | Enable PHI scanning | true | High |
| `PHI_FAIL_CLOSED` | Block on PHI detection | true | High |
| `ANALYTICS_IP_SALT` | IP hashing for analytics | Random | High |
| `STRIPE_WEBHOOK_SECRET` | Stripe signature verification | None | Medium |
| `ZOOM_WEBHOOK_SECRET_TOKEN` | Zoom signature verification | None | Medium |

### docker-compose.yml (dev) - Worker

| Variable | Purpose | Default | Priority |
|----------|---------|---------|----------|
| `PHI_SCAN_ENABLED` | Enable PHI scanning | true | High |
| `PHI_FAIL_CLOSED` | Block on PHI detection | true | High |
| `ARTIFACTS_PATH` | Artifact storage (rename from ARTIFACT_PATH) | /data/artifacts | High |
| `CONFERENCE_CACHE_TTL` | Conference discovery cache | 86400 | Low |
| `ENABLE_WEB_SEARCH` | Allow online conference discovery | false | Low |

---

## Naming Mismatches

| Document | Code/Compose | Issue | Resolution |
|----------|--------------|-------|------------|
| `collaboration.md`: `COLLAB_PORT` | `docker-compose.yml`: `PORT` | Different var names | Update docs to use `PORT` |
| `collaboration.md`: `COLLAB_REDIS_URL` | `docker-compose.yml`: `REDIS_URL` | Different var names | Update docs to use `REDIS_URL` |
| `conference_prep.md`: `ARTIFACTS_PATH` | `docker-compose.yml`: `ARTIFACT_PATH` | Missing 'S' | Standardize to `ARTIFACTS_PATH` |

---

## Database Tables Required

All tables exist in migrations. Run in order:

1. `0000_omniscient_emma_frost.sql` - Base schema
2. `0002_ai_integration.sql` - AI integration
3. `0004_phase_d_ethics_security.sql` - Ethics/security
4. `0005_phase_e_multitenancy.sql` - Multi-tenancy
5. `0006_phase_f_schema_alignment.sql` - Schema alignment
6. `0007_phase_g_workflow_builder.sql` - Workflow builder
7. `0008_phase_h_document_lifecycle.sql` - Document lifecycle (artifact_edges, comments)
8. `0009_password_reset_tokens.sql` - Password reset
9. `0009_performance_indexes.sql` - Performance indexes
10. `0010_phase_f_observability_featureflags.sql` - Feature flags/analytics
11. `0011_manual_fixes.sql` - Manual fixes
12. `0012_governance_config_hotfix.sql` - Governance hotfix
13. `0013_fix_workflow_tables.sql` - Workflow fixes
14. `0014_add_org_role_column.sql` - Org role column
15. `003_create_manuscript_tables.sql` - Manuscript tables

---

## Action Items for Phase 1

### P0 - Critical

1. ✅ **Webhooks are already implemented** - GAP_MATRIX needs update
2. Add missing env vars to docker-compose.yml:
   - `PHI_SCAN_ENABLED=true` (orchestrator, worker)
   - `PHI_FAIL_CLOSED=true` (orchestrator, worker)
   - `ANALYTICS_IP_SALT` (orchestrator)
   - Fix `ARTIFACT_PATH` → `ARTIFACTS_PATH` (worker)

### P1 - High Priority

3. Add to docker-compose.yml:
   - `SEMANTIC_SCHOLAR_API_KEY` (orchestrator)
   - `LITERATURE_CACHE_TTL` (orchestrator)
   - `CONFERENCE_CACHE_TTL` (worker)
   - `ENABLE_WEB_SEARCH` (worker)

4. Add webhook secrets to .env.example:
   - `STRIPE_WEBHOOK_SECRET`
   - `ZOOM_WEBHOOK_SECRET_TOKEN`

### P2 - Documentation

5. Update `docs/runbooks/collaboration.md`:
   - Change `COLLAB_PORT` → `PORT`
   - Change `COLLAB_REDIS_URL` → `REDIS_URL`

6. Update `docs/runbooks/conference_prep.md`:
   - Verify `ARTIFACTS_PATH` naming

7. Update `docs/audit/GAP_MATRIX.md`:
   - Mark webhooks as ✅ Implemented

---

## Smoke Test Checklist

```bash
# 1. Health check
curl http://localhost:3001/api/health

# 2. Literature search
curl -X POST http://localhost:3001/api/literature/search \
  -H "Content-Type: application/json" \
  -d '{"query": "diabetes", "providers": ["pubmed"], "limit": 5}'

# 3. Conference discovery
curl http://localhost:3001/api/ros/conference/discover

# 4. Webhook health
curl http://localhost:3001/api/webhooks/health

# 5. Collab health
curl http://localhost:1235/health

# 6. Check database tables
docker compose exec postgres psql -U ros -d ros -c "\dt"
```

---

## Conclusion

The repository is **well-implemented** with most features having working code and runtime wiring. The primary gaps are:

1. **Environment variables** missing from docker-compose files
2. **Naming inconsistencies** between docs and code
3. **GAP_MATRIX.md** outdated (webhooks are already implemented)

All issues are fixable without new code - just configuration updates.
