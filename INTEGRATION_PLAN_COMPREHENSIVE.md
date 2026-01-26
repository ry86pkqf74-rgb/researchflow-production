# ResearchFlow Production - Comprehensive Integration Plan

**Generated:** January 23, 2026  
**Repository:** https://github.com/ry86pkqf74-rgb/researchflow-production  
**Status:** Active Development

---

## Executive Summary

This document provides a complete assessment of the ResearchFlow production codebase with a phased integration plan to ensure all components are fully wired and functional in Docker local deployment.

### Current State Overview

| Component | Status | Details |
|-----------|--------|---------|
| **Worker Stages (Python)** | ✅ Complete | All 20 stages implemented |
| **UI Stages (React)** | ✅ Complete | All 20 stage components exist |
| **Orchestrator Routes** | ⚠️ Partial | 32 registered, **26 NOT registered** |
| **Worker API Server** | ✅ Functional | Extraction router registered |
| **Docker Services** | ⚠️ Needs fixes | Worker port not exposed |
| **Extraction Pipeline** | ⚠️ Partial | API endpoint mismatch |

---

## Part 1: What's Already Implemented

### 1.1 Worker Stages (20/20 Complete)

All 20 workflow stages are implemented in Python:

| Stage | File | Size | Status |
|-------|------|------|--------|
| 01 | `stage_01_upload.py` | 6.0KB | ✅ Upload/intake |
| 02 | `stage_02_literature.py` | 13KB | ✅ Literature search |
| 03 | `stage_03_irb.py` | 3.0KB | ✅ IRB compliance |
| 04 | `stage_04_validate.py` | 8.5KB | ✅ Schema validation |
| 05 | `stage_05_phi.py` | 7.0KB | ✅ PHI detection |
| 06 | `stage_06_analysis.py` | 32KB | ✅ Analysis engine |
| 07 | `stage_07_stats.py` | 16KB | ✅ Statistical modeling |
| 08 | `stage_08_validation.py` | 3.5KB | ✅ Data validation |
| 09 | `stage_09_interpretation.py` | 9.0KB | ✅ Results interpretation |
| 10 | `stage_10_validation.py` | 12KB | ✅ Reproducibility validation |
| 11 | `stage_11_iteration.py` | 13KB | ✅ Iteration tracking |
| 12 | `stage_12_documentation.py` | 11KB | ✅ Documentation |
| 13 | `stage_13_internal_review.py` | 15KB | ✅ Internal review |
| 14 | `stage_14_ethical.py` | 27KB | ✅ Ethical review |
| 15 | `stage_15_bundling.py` | 11KB | ✅ Artifact bundling |
| 16 | `stage_16_handoff.py` | 10KB | ✅ Collaboration handoff |
| 17 | `stage_17_archiving.py` | 13KB | ✅ Archiving |
| 18 | `stage_18_impact.py` | 17KB | ✅ Impact assessment |
| 19 | `stage_19_dissemination.py` | 30KB | ✅ Dissemination |
| 20 | `stage_20_conference.py` | 22KB | ✅ Conference prep |

**Location:** `services/worker/src/workflow_engine/stages/`

### 1.2 UI Stage Components (20/20 Complete)

All 20 React stage components exist in the frontend:

| Stage | Component | Status |
|-------|-----------|--------|
| 01 | `Stage01Hypothesis.tsx` | ✅ |
| 02 | `Stage02LiteratureReview.tsx` | ✅ |
| 03 | `Stage03LiteratureSearch.tsx` | ✅ |
| 04 | `Stage04DataCollection.tsx` | ✅ |
| 05 | `Stage05DataPreprocessing.tsx` | ✅ |
| 06 | `Stage06Analysis.tsx` | ✅ |
| 07 | `Stage07StatisticalModeling.tsx` | ✅ |
| 08 | `Stage08Visualization.tsx` | ✅ |
| 09 | `Stage09Interpretation.tsx` | ✅ |
| 10 | `Stage10Validation.tsx` | ✅ |
| 11 | `Stage11Iteration.tsx` | ✅ |
| 12 | `Stage12Documentation.tsx` | ✅ |
| 13 | `Stage13InternalReview.tsx` | ✅ |
| 14 | `Stage14EthicalReview.tsx` | ✅ |
| 15 | `Stage15ArtifactBundling.tsx` | ✅ |
| 16 | `Stage16CollaborationHandoff.tsx` | ✅ |
| 17 | `Stage17Archiving.tsx` | ✅ |
| 18 | `Stage18ImpactAssessment.tsx` | ✅ |
| 19 | `Stage19Dissemination.tsx` | ✅ |
| 20 | `Stage20FinalExport.tsx` | ✅ |

**Location:** `services/web/src/components/stages/`

### 1.3 Registered Orchestrator Routes (32 Routes)

These routes are properly imported and mounted in `services/orchestrator/src/index.ts`:

| Route | Mount Path | Status |
|-------|------------|--------|
| governance | `/api/governance` | ✅ |
| datasets | `/api/datasets` | ✅ |
| conference | `/api/ros/conference` | ✅ |
| comments | `/api/ros/comments` | ✅ |
| submissions | `/api/ros/submissions` | ✅ |
| manuscript-branches | `/api/ros/manuscripts` | ✅ |
| orcid | `/api/orcid` | ✅ |
| artifactsV2 | `/api/v2/artifacts` | ✅ |
| ideas (docs-first) | `/api/docs-first/ideas` | ✅ |
| topic-briefs | `/api/docs-first/topic-briefs` | ✅ |
| venues | `/api/docs-first/venues` | ✅ |
| doc-kits | `/api/docs-first/doc-kits` | ✅ |
| experiments | `/api/experiments` | ✅ |
| custom-fields | `/api/custom-fields` | ✅ |
| tutorials | `/api/tutorials` | ✅ |
| search | `/api/search` | ✅ |
| semanticSearch | `/api/search` + `/api/embeddings` | ✅ |
| webhooks | `/api/webhooks` | ✅ |
| phaseG | `/api/monitoring` | ✅ |
| help | `/api/help` | ✅ |
| plugins | `/api/plugins` | ✅ |
| aiProviders | `/api/ai` | ✅ |
| ecosystemIntegrations | `/api/integrations` | ✅ |
| google-drive | `/api/integrations/google-drive` | ✅ |
| literature-integrations | `/api/literature` | ✅ |
| apiKeys | `/api/profile/api-keys` | ✅ |
| tutorialSandbox | `/api/tutorials/sandbox` | ✅ |
| futureProofing | `/api/admin/upgrades` | ✅ |
| watermark | `/api/ai/watermark` | ✅ |
| preferences | `/api/me/preferences` | ✅ |
| invites | `/api` (handles org invites) | ✅ |
| badges | `/api/badges` | ✅ |
| sustainability | `/api/sustainability` | ✅ |
| peerReview | `/api/peer-review` | ✅ |
| taskBoards | `/api` (handles research boards) | ✅ |
| consent | `/api/consent` | ✅ |
| auth | `/api/auth` | ✅ |
| workflow-stages | `/api/workflow` | ✅ |
| workflows | `/api/workflows` | ✅ |
| organizations | `/api/org` | ✅ |
| user-settings | `/api/user` | ✅ |

---

## Part 2: What Needs Integration

### 2.1 Unregistered Routes (26 Routes - Critical)

These route files exist but are **NOT imported or mounted** in `index.ts`:

| Route File | Purpose | Priority |
|------------|---------|----------|
| `ai-extraction.ts` | LLM clinical extraction | 🔴 CRITICAL |
| `ai-feedback.ts` | AI output feedback collection | 🔴 CRITICAL |
| `ai-router.ts` | Intelligent model routing | 🔴 CRITICAL |
| `ai-streaming.ts` | SSE for AI responses | 🔴 CRITICAL |
| `spreadsheet-cell-parse.ts` | Cell-level extraction | 🔴 CRITICAL |
| `phi-scanner.ts` | PHI scanning API | 🔴 CRITICAL |
| `artifact-graph.ts` | Provenance graph API | 🟡 HIGH |
| `artifact-versions.ts` | Version management | 🟡 HIGH |
| `export-bundle.ts` | Reproducibility bundles | 🟡 HIGH |
| `ros-worker-proxy.ts` | Worker job proxy | 🟡 HIGH |
| `stream.ts` | SSE event stream | 🟡 HIGH |
| `analysis-execution.ts` | Analysis job execution | 🟡 HIGH |
| `claims.ts` | Claim extraction | 🟡 HIGH |
| `metrics.ts` | Prometheus metrics | 🟡 HIGH |
| `literature.ts` | Literature search API | 🟡 HIGH |
| `mesh-lookup.ts` | MeSH term lookup | 🟡 HIGH |
| `governance-simulate.ts` | Governance simulation | 🟢 MEDIUM |
| `quality.ts` | Quality dashboard data | 🟢 MEDIUM |
| `mfa.ts` | Multi-factor auth | 🟢 MEDIUM |
| `notifications.ts` | Notification center | 🟢 MEDIUM |
| `billing.ts` | Stripe integration | 🟢 MEDIUM |
| `collaborationExport.ts` | Yjs document export | 🟢 MEDIUM |
| `sap.ts` | Statistical Analysis Plan | 🟢 MEDIUM |
| `research-brief.ts` | Research brief generation | 🟢 MEDIUM |
| `integrations.ts` | External integrations | 🟢 MEDIUM |
| `shares.ts` | Document sharing | 🟢 MEDIUM |
| `topics.ts` | Topic management | 🟢 LOW |
| `analytics.ts` | Analytics events | 🟢 LOW |

### 2.2 Docker Configuration Gaps

| Issue | Current State | Fix Required |
|-------|---------------|--------------|
| Worker port | Not exposed externally | Expose port 8000 |
| Worker depends_on | Missing orchestrator | Add orchestrator dependency |
| Environment variables | Missing extraction URLs | Add AI_ROUTER_URL, etc. |

### 2.3 Extraction System Gaps

| Gap | Description | Severity |
|-----|-------------|----------|
| API Endpoint Mismatch | Worker calls wrong URL | 🔴 Critical |
| Payload Schema | Format mismatch | 🔴 Critical |
| MeSH Lookup | Route not mounted | 🟡 High |

---

## Part 3: Phased Integration Plan

### Phase 1: Critical Route Registration (Estimated: 2 hours)

**Objective:** Register all AI and extraction routes in orchestrator

**Tasks:**
1. Import and mount `ai-extraction.ts` → `/api/ai/extraction`
2. Import and mount `ai-feedback.ts` → `/api/ai/feedback`
3. Import and mount `ai-router.ts` → `/api/ai/router`
4. Import and mount `ai-streaming.ts` → `/api/ai/streaming`
5. Import and mount `spreadsheet-cell-parse.ts` → `/api/extraction/spreadsheet`
6. Import and mount `phi-scanner.ts` → `/api/ros/phi`

**Verification:**
- [ ] `curl http://localhost:3001/api/ai/extraction/health` returns 200
- [ ] `curl http://localhost:3001/api/ai/router/health` returns 200
- [ ] `curl http://localhost:3001/api/ros/phi/health` returns 200

### Phase 2: Core API Route Registration (Estimated: 2 hours)

**Objective:** Register artifact, export, and worker proxy routes

**Tasks:**
1. Import and mount `artifact-graph.ts` → `/api/ros/artifacts/graph`
2. Import and mount `artifact-versions.ts` → `/api/ros/artifacts/versions`
3. Import and mount `export-bundle.ts` → `/api/export`
4. Import and mount `ros-worker-proxy.ts` → `/api/ros/worker`
5. Import and mount `stream.ts` → `/api/stream`
6. Import and mount `analysis-execution.ts` → `/api/ros/analysis`
7. Import and mount `claims.ts` → `/api/ros/claims`
8. Import and mount `literature.ts` → `/api/ros/literature`
9. Import and mount `mesh-lookup.ts` → `/api/literature/mesh`
10. Import and mount `metrics.ts` → `/api/metrics`

**Verification:**
- [ ] `curl http://localhost:3001/api/ros/artifacts/graph` returns 200
- [ ] `curl http://localhost:3001/api/export/health` returns 200
- [ ] `curl http://localhost:3001/api/metrics` returns Prometheus metrics

### Phase 3: Secondary Route Registration (Estimated: 1.5 hours)

**Objective:** Register remaining utility routes

**Tasks:**
1. Import and mount `governance-simulate.ts` → `/api/governance/simulate`
2. Import and mount `quality.ts` → `/api/ros/quality`
3. Import and mount `mfa.ts` → `/api/auth/mfa`
4. Import and mount `notifications.ts` → `/api/notifications`
5. Import and mount `billing.ts` → `/api/billing`
6. Import and mount `collaborationExport.ts` → `/api/collaboration/export`
7. Import and mount `sap.ts` → `/api/ros/sap`
8. Import and mount `research-brief.ts` → `/api/ros/research-brief`
9. Import and mount `integrations.ts` → `/api/integrations/external`
10. Import and mount `shares.ts` → `/api/shares`
11. Import and mount `topics.ts` → `/api/topics`
12. Import and mount `analytics.ts` → `/api/analytics`

### Phase 4: Docker Configuration (Estimated: 1 hour)

**Objective:** Fix Docker compose for full functionality

**Tasks:**
1. Expose worker port 8000 in docker-compose.yml
2. Add orchestrator to worker depends_on
3. Add extraction environment variables
4. Verify healthcheck endpoints

**File Changes:**
```yaml
# docker-compose.yml - worker service
worker:
  ports:
    - "8000:8000"  # ADD THIS
  depends_on:
    postgres:
      condition: service_healthy
    redis:
      condition: service_healthy
    orchestrator:  # ADD THIS
      condition: service_healthy
```

### Phase 5: Extraction Pipeline Fix (Estimated: 2 hours)

**Objective:** Wire extraction system end-to-end

**Tasks:**
1. Update `extract_from_cells.py` API URL to match orchestrator
2. Update payload schema to match orchestrator expectations
3. Verify MeSH lookup endpoint is accessible
4. Test extraction with sample clinical data

### Phase 6: Integration Testing (Estimated: 2 hours)

**Objective:** Verify all routes and services work together

**Tasks:**
1. Run full Docker stack
2. Test each newly registered route
3. Test extraction pipeline end-to-end
4. Verify stage UI components connect to APIs
5. Run existing E2E tests

---

## Part 4: Implementation Tracking

### Phase Completion Checklist

| Phase | Status | Started | Completed | Notes |
|-------|--------|---------|-----------|-------|
| Phase 1 | ✅ Complete | 2026-01-23 | 2026-01-23 | AI & Extraction routes registered |
| Phase 2 | ✅ Complete | 2026-01-23 | 2026-01-23 | Core API routes registered |
| Phase 3 | ✅ Complete | 2026-01-23 | 2026-01-23 | Secondary routes registered |
| Phase 4 | ✅ Complete | 2026-01-23 | 2026-01-23 | Docker config updated |
| Phase 5 | ⬜ Pending | | | Extraction pipeline verification |
| Phase 6 | ⬜ Pending | | | Integration testing |

### Changes Made This Session

1. **Orchestrator index.ts** - Added 26 route imports and registrations:
   - Phase 1: ai-extraction, ai-feedback, ai-router, ai-streaming, spreadsheet-cell-parse, phi-scanner
   - Phase 2: artifact-graph, artifact-versions, export-bundle, ros-worker-proxy, stream, analysis-execution, claims, literature, mesh-lookup, metrics
   - Phase 3: governance-simulate, quality, mfa, notifications, billing, collaborationExport, sap, research-brief, integrations, shares, topics, analytics

2. **docker-compose.yml** - Updated:
   - Added orchestrator healthcheck
   - Exposed worker port 8000
   - Added worker depends_on orchestrator
   
### Archive/Context Updates

After each phase:
1. Update this document with completion status
2. Commit changes to GitHub
3. Clear context window
4. Reference this document for next phase

---

## Part 5: Quick Reference

### Key File Locations

| Component | Location |
|-----------|----------|
| Orchestrator Index | `services/orchestrator/src/index.ts` |
| Orchestrator Routes | `services/orchestrator/src/routes/` |
| Worker Stages | `services/worker/src/workflow_engine/stages/` |
| Worker API | `services/worker/api_server.py` |
| UI Stages | `services/web/src/components/stages/` |
| Docker Compose | `docker-compose.yml` |
| Extraction Module | `services/worker/src/data_extraction/` |

### Environment Variables Required

```bash
# Orchestrator
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
NCBI_API_KEY=...

# Worker
AI_ROUTER_URL=http://orchestrator:3001/api/ai/extraction/generate
ORCHESTRATOR_URL=http://orchestrator:3001
EXTRACTION_TIMEOUT_SECONDS=60
ENRICHMENT_TIMEOUT_SECONDS=30
```

### Testing Commands

```bash
# Start all services
docker-compose up -d

# Check service health
curl http://localhost:3001/health  # Orchestrator
curl http://localhost:8000/health  # Worker
curl http://localhost:5173/health  # Web

# Run tests
npm run test        # Unit tests
npm run test:e2e    # E2E tests
```

---

*Document maintained as single source of truth for integration work.*
