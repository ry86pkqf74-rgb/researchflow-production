# LLM Extraction System - Updated Integration Plan

**Date**: January 23, 2026  
**Status**: Partially Integrated - Action Required  
**Repository**: `researchflow-production`

---

## Executive Summary

The LLM extraction system has been **partially deployed** to the repository. Core Python modules and API routes are in place, but **critical integration gaps** remain that prevent the system from functioning end-to-end.

---

## Current State Analysis

### ✅ COMPLETED - Files Deployed

| Component | Location | Status |
|-----------|----------|--------|
| Extraction Schemas | `services/worker/src/data_extraction/schemas.py` | ✅ Deployed |
| Extraction Logic | `services/worker/src/data_extraction/extract_from_cells.py` | ✅ Deployed |
| NLM Enrichment | `services/worker/src/data_extraction/nlm_enrichment.py` | ✅ Deployed |
| Module Init | `services/worker/src/data_extraction/__init__.py` | ✅ Deployed |
| FastAPI Routes | `services/worker/src/data_extraction/api_routes.py` | ✅ Deployed |
| LLM Prompts | `services/worker/src/data_extraction/prompts/*.txt` | ✅ Deployed (3 files) |
| API Server Update | `services/worker/api_server.py` | ✅ Router registered |
| Env Config | `.env.example` | ✅ Updated |
| Runbook | `docs/runbooks/data_extraction.md` | ✅ Deployed |
| AI Router Service | `apps/api-node/services/ai-router.service.ts` | ✅ Deployed (standalone) |
| MeSH Client | `apps/api-node/services/mesh-client.service.ts` | ✅ Deployed (standalone) |

### ❌ GAPS - Requires Integration

| Gap | Description | Severity | Effort |
|-----|-------------|----------|--------|
| **API Endpoint Mismatch** | Extraction calls `/api/ai/route` but orchestrator exposes `/api/ai/router/route` | 🔴 Critical | Low |
| **Payload Schema Mismatch** | Extraction sends `{task, tier, input, schema}` but orchestrator expects `{taskType, estimatedInputTokens, governanceMode}` | 🔴 Critical | Medium |
| **MeSH Endpoint Missing** | No `POST /api/literature/mesh/lookup` in orchestrator | 🟡 High | Medium |
| **Workflow Stage Integration** | Extraction not wired to stages 5 (PHI), 6 (Analysis), 10 (Validation) | 🟡 High | Medium |
| **AI Router Not Integrated** | `apps/api-node/services/ai-router.service.ts` is standalone, not used by orchestrator | 🟡 High | Medium |
| **Tests Not Verified** | Unit tests exist but not integrated into CI/CD | 🟢 Medium | Low |
| **Docker Compose** | No service updates for extraction dependencies | 🟢 Medium | Low |

---

## Architecture Gap Analysis

### Current Flow (BROKEN)
```
Worker (FastAPI)                    Orchestrator (Express)
      │                                    │
      │ POST /api/ai/route                 │ Expected: /api/ai/router/route
      │ {task, tier, input, schema}        │ Expected: {taskType, estimatedInputTokens...}
      │                                    │
      └──────────── X ─────────────────────┘
                 MISMATCH
```

### Target Flow (TO BE IMPLEMENTED)
```
Worker (FastAPI)                    Orchestrator (Express)               LLM Providers
      │                                    │                                  │
      │ POST /api/ai/extraction/route      │                                  │
      │ {task, tier, input, schema...}     │ ───► Route to provider ─────────►│
      │                                    │                                  │
      │ POST /api/literature/mesh/lookup   │                                  │
      │ {terms, include_synonyms}          │ ───► NLM E-utilities ────────────┘
      │                                    │
      └────────────────────────────────────┘
```

---

## Remediation Plan

### Phase 1: Fix API Endpoint Compatibility (Priority: CRITICAL)

**Option A: Update Extraction Module** (Recommended - Less Risk)

Update `services/worker/src/data_extraction/extract_from_cells.py` to call the existing orchestrator endpoint:

```python
# Current (BROKEN)
AI_ROUTER_URL = os.getenv("AI_ROUTER_URL", "http://localhost:3001/api/ai/route")

# Fix to match orchestrator
AI_ROUTER_URL = os.getenv("AI_ROUTER_URL", "http://localhost:3001/api/ai/router/route")
```

Also update payload format to match orchestrator schema:

```python
# Current payload
payload = {
    "task": task,
    "tier": tier,
    "input": text,
    "schema": schema,
    "metadata": {...},
    "return_format": "json",
}

# Updated payload to match orchestrator
payload = {
    "taskType": task,
    "estimatedInputTokens": len(text) // 4,  # Rough estimate
    "estimatedOutputTokens": 2000,
    "governanceMode": os.getenv("GOVERNANCE_MODE", "DEMO"),
    "preferredTier": tier.lower(),  # economy, standard, premium
    "requirePhiCompliance": True,
    "input": text,  # Add input to payload
    "schema": schema,
}
```

**Option B: Add New Endpoint to Orchestrator** (More Flexible)

Add a new route in orchestrator that accepts the extraction-specific payload format:

File: `services/orchestrator/src/routes/ai-extraction.ts`

```typescript
// POST /api/ai/extraction/route
// Accepts extraction-specific payload and translates to internal format
```

### Phase 2: Add MeSH Lookup Endpoint (Priority: HIGH)

Add new route to orchestrator:

File: `services/orchestrator/src/routes/mesh-lookup.ts`

```typescript
import { Router } from 'express';
import { lookupTermsBatch } from '../services/mesh-client.service';

const router = Router();

router.post('/api/literature/mesh/lookup', async (req, res) => {
  const { terms, include_synonyms, max_results_per_term } = req.body;
  const result = await lookupTermsBatch(terms, include_synonyms, max_results_per_term);
  res.json(result);
});

export default router;
```

**Note**: The `mesh-client.service.ts` already exists in `apps/api-node/services/` - needs to be moved/imported to orchestrator.

### Phase 3: Integrate with Workflow Stages (Priority: HIGH)

Wire extraction to the 20-stage workflow:

1. **Stage 5 (PHI Detection)** - Call extraction before analysis
2. **Stage 6 (Analysis)** - Use extraction results
3. **Stage 10 (Validation)** - Validate extraction output

File to modify: `services/worker/src/workflow_engine/stages/stage_06_analysis.py`

```python
from data_extraction import extract_clinical_from_cell, ClinicalExtraction

async def run_analysis_stage(context: StageContext) -> StageResult:
    # Extract clinical data from uploaded cells
    for cell in context.data_cells:
        extraction_result = await extract_clinical_from_cell(
            cell_text=cell.content,
            metadata={"stage": "06_analysis", "file_id": cell.file_id}
        )
        # Store extraction results for downstream stages
        context.extractions.append(extraction_result)
```

### Phase 4: Docker Compose Updates (Priority: MEDIUM)

Add to `docker-compose.yml`:

```yaml
services:
  worker:
    environment:
      - AI_ROUTER_URL=http://orchestrator:3001/api/ai/router/route
      - ORCHESTRATOR_URL=http://orchestrator:3001
      - EXTRACTION_TIMEOUT_SECONDS=60
      - ENRICHMENT_TIMEOUT_SECONDS=30
    depends_on:
      - orchestrator
      - redis
```

### Phase 5: CI/CD Test Integration (Priority: MEDIUM)

Add to `.github/workflows/test.yml`:

```yaml
- name: Run Extraction Tests
  run: |
    cd services/worker
    python -m pytest tests/test_extraction.py -v
```

---

## Implementation Order

| Step | Task | Owner | ETA |
|------|------|-------|-----|
| 1 | Fix AI_ROUTER_URL and payload schema in extract_from_cells.py | Dev | 1 hour |
| 2 | Add MeSH lookup route to orchestrator | Dev | 2 hours |
| 3 | Move mesh-client.service.ts to orchestrator | Dev | 1 hour |
| 4 | Update .env.example with correct endpoint URLs | Dev | 15 min |
| 5 | Test extraction API endpoint manually | QA | 1 hour |
| 6 | Wire extraction to Stage 6 (Analysis) | Dev | 3 hours |
| 7 | Add extraction tests to CI/CD | DevOps | 1 hour |
| 8 | Update Docker Compose | DevOps | 30 min |
| 9 | End-to-end Playwright test | QA | 2 hours |

**Total Estimated Effort**: ~12 hours

---

## Environment Variables Reference

### Worker Service (services/worker)
```bash
# AI Router
AI_ROUTER_URL=http://orchestrator:3001/api/ai/router/route
ORCHESTRATOR_URL=http://orchestrator:3001

# Timeouts
EXTRACTION_TIMEOUT_SECONDS=60
ENRICHMENT_TIMEOUT_SECONDS=30

# Governance
GOVERNANCE_MODE=DEMO  # or LIVE
```

### Orchestrator Service (services/orchestrator)
```bash
# AI Providers
AI_INTEGRATIONS_OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...

# NLM/NCBI
NCBI_API_KEY=...
```

---

## Verification Checklist

After completing integration:

- [ ] Worker starts without import errors
- [ ] `GET /api/extraction/health` returns 200
- [ ] `POST /api/extraction/extract` successfully calls orchestrator
- [ ] Extraction returns valid ClinicalExtraction schema
- [ ] MeSH enrichment works (if NCBI_API_KEY configured)
- [ ] Stage 6 (Analysis) uses extraction results
- [ ] Audit trail shows AI calls
- [ ] Playwright E2E tests pass
- [ ] CI/CD pipeline green

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Orchestrator schema changes break extraction | Medium | High | Version API endpoints, add integration tests |
| Rate limiting from NLM E-utilities | Low | Medium | Implement caching, use API key |
| PHI leak through AI calls | Low | Critical | PHI scan before every call (already implemented) |
| Cost overrun from AI calls | Medium | Medium | Budget limits in orchestrator, tier selection |

---

## Next Steps

1. **Immediate**: Fix the API endpoint mismatch (Phase 1)
2. **This Sprint**: Complete Phases 1-4
3. **Next Sprint**: Full workflow integration and E2E testing

Would you like me to execute any of these phases now?
