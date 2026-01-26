# LLM Extraction System - Docker Wiring Verification

**Date**: January 23, 2026  
**Status**: ✅ FULLY WIRED

---

## Complete Request Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           WEB BROWSER (localhost:5173)                       │
└────────────────────────────────────────────────────────────────────────────┬─┘
                                                                              │
                              HTTP Request                                    │
                                                                              ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                      ORCHESTRATOR (localhost:3001)                          │
│                                                                             │
│  Routes registered:                                                         │
│  ├─ /api/ai/extraction/generate     → ai-extraction.ts (LLM calls)         │
│  ├─ /api/ai/extraction/health       → Health check                          │
│  ├─ /api/literature/mesh/lookup     → mesh-lookup.ts (NLM E-utilities)     │
│  ├─ /api/literature/mesh/health     → Health check                          │
│  ├─ /api/analysis/extract           → analysis-execution.ts (worker proxy) │
│  ├─ /api/analysis/run               → analysis-execution.ts                │
│  └─ /api/analysis/health            → Health check + worker status         │
│                                                                             │
│  Config (docker-compose):                                                   │
│  ├─ WORKER_URL=http://worker:8000                                          │
│  └─ ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY}                                 │
└───────────────────────────────────┬─────────────────────────────────────────┘
                                    │
           ┌────────────────────────┴────────────────────────┐
           │                                                  │
           ▼                                                  ▼
┌──────────────────────┐                      ┌──────────────────────────────┐
│   LLM Providers      │                      │     WORKER (localhost:8000)  │
│                      │                      │                              │
│ • Anthropic Claude   │                      │  Routes registered:          │
│ • OpenAI GPT         │                      │  ├─ /api/extraction/extract  │
│ • Together AI        │                      │  ├─ /api/extraction/batch    │
│                      │                      │  ├─ /api/extraction/enrich   │
└──────────────────────┘                      │  └─ /api/extraction/health   │
                                              │                              │
                                              │  Config (docker-compose):    │
                                              │  ├─ AI_ROUTER_URL=           │
                                              │  │  http://orchestrator:3001 │
                                              │  │  /api/ai/extraction/      │
                                              │  │  generate                 │
                                              │  ├─ ORCHESTRATOR_URL=        │
                                              │  │  http://orchestrator:3001 │
                                              │  └─ ANTHROPIC_API_KEY=...    │
                                              └──────────────────────────────┘
```

---

## Docker Compose Configuration

### Orchestrator Service
```yaml
orchestrator:
  environment:
    - WORKER_URL=http://worker:8000
    - ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY}
    - OPENAI_API_KEY=${OPENAI_API_KEY}
    - NCBI_API_KEY=${NCBI_API_KEY}
```

### Worker Service
```yaml
worker:
  environment:
    - AI_ROUTER_URL=http://orchestrator:3001/api/ai/extraction/generate
    - ORCHESTRATOR_URL=http://orchestrator:3001
    - EXTRACTION_TIMEOUT_SECONDS=60
    - ENRICHMENT_TIMEOUT_SECONDS=30
    - ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY}
  depends_on:
    - orchestrator
```

---

## API Endpoints Summary

### Orchestrator Endpoints

| Endpoint | Method | Purpose | Calls |
|----------|--------|---------|-------|
| `/api/ai/extraction/generate` | POST | Direct LLM extraction | Anthropic/OpenAI |
| `/api/ai/extraction/health` | GET | Health check | - |
| `/api/literature/mesh/lookup` | POST | MeSH term lookup | NLM E-utilities |
| `/api/literature/mesh/health` | GET | Health check | - |
| `/api/analysis/extract` | POST | Batch extraction | Worker |
| `/api/analysis/run` | POST | Run analysis | Worker |
| `/api/analysis/health` | GET | Health + worker status | Worker |

### Worker Endpoints

| Endpoint | Method | Purpose | Calls |
|----------|--------|---------|-------|
| `/api/extraction/extract` | POST | Single cell extraction | Orchestrator |
| `/api/extraction/extract/batch` | POST | Batch extraction | Orchestrator |
| `/api/extraction/enrich` | POST | MeSH enrichment | Orchestrator |
| `/api/extraction/health` | GET | Health check | - |

---

## Verification Commands

After running `docker-compose up -d`:

```bash
# 1. Check orchestrator health
curl http://localhost:3001/api/ai/extraction/health

# 2. Check worker health  
curl http://localhost:8000/api/extraction/health

# 3. Check analysis service (verifies worker connectivity)
curl http://localhost:3001/api/analysis/health

# 4. Check MeSH service
curl http://localhost:3001/api/literature/mesh/health

# 5. Test extraction (requires ANTHROPIC_API_KEY)
curl -X POST http://localhost:3001/api/analysis/extract \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "cells": [
      {"text": "Patient diagnosed with acute appendicitis"}
    ],
    "parameters": {
      "enrich_with_mesh": true
    }
  }'
```

---

## Files Modified/Created

### New Files
- `services/orchestrator/src/routes/ai-extraction.ts` - LLM extraction endpoint
- `services/orchestrator/src/routes/mesh-lookup.ts` - MeSH term lookup
- `services/orchestrator/src/routes/analysis-execution.ts` - Worker proxy for analysis

### Modified Files
- `services/orchestrator/routes.ts` - Registered new routers
- `services/worker/src/data_extraction/extract_from_cells.py` - Fixed AI_ROUTER_URL
- `services/worker/src/data_extraction/nlm_enrichment.py` - Fixed response parsing
- `services/worker/src/workflow_engine/stages/stage_06_analysis.py` - Added clinical_extraction
- `docker-compose.yml` - Added extraction environment variables
- `.env.example` - Updated with extraction config

---

## Stage 6 (Analysis) Integration

When Stage 6 runs with `analysis_type: "clinical_extraction"`:

1. **Frontend** calls `POST /api/workflow/execute/6`
2. **Orchestrator** routes to `stage_06_analysis.py` via worker
3. **Worker** calls `extract_batch()` which calls orchestrator's `/api/ai/extraction/generate`
4. **Orchestrator** performs PHI scan → calls LLM → returns structured extraction
5. **Worker** optionally enriches with MeSH via `/api/literature/mesh/lookup`
6. **Results** returned to frontend

---

## Required Environment Variables

Create `.env` file with:

```bash
# Required for LLM extraction
ANTHROPIC_API_KEY=sk-ant-api03-...

# Optional for other providers
OPENAI_API_KEY=sk-...

# Optional for faster NLM requests
NCBI_API_KEY=...

# Database (already configured)
DATABASE_URL=postgresql://ros:ros@postgres:5432/ros
REDIS_URL=redis://redis:6379
```

---

## Troubleshooting

### Worker can't reach orchestrator
```bash
# Check network connectivity
docker exec worker curl -v http://orchestrator:3001/api/ai/extraction/health
```

### PHI scan blocking requests
- PHI scanning is enabled by default
- Ensure test data doesn't contain real PHI patterns
- Check logs: `docker logs orchestrator | grep PHI`

### Extraction returning empty results
- Verify ANTHROPIC_API_KEY is set
- Check orchestrator logs: `docker logs orchestrator | grep Extraction`
- Verify tier escalation: NANO → MINI → FRONTIER on validation failures
