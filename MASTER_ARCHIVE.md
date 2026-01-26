# ResearchFlow Production - Master Archive
**Last Updated:** January 26, 2026  
**Repository:** `ry86pkqf74-rgb/researchflow-production`

---

## 📊 OVERALL STATUS

| Category | Status |
|----------|--------|
| Large-Data Ingestion (11 phases) | ✅ Complete |
| Medical Integrations (9 phases) | ✅ Complete |
| Writing & Compliance (Phases 4-5) | ✅ Complete |
| Spreadsheet Cell Parsing | ✅ Complete |
| Additional Integrations | ✅ Complete |
| Pitch Deck | ✅ Complete |
| **Issue #1: Manuscript Routes** | ✅ **FIXED Jan 26** |
| **Issue #2: AI Insights Button** | 🔄 **PLANNED - Ready to Execute** |

---

## ✅ RECENTLY COMPLETED

### Issue #1: Manuscript Generation Routes (Jan 26, 2026)
**Commit:** `784971d`

**Problem:** Routes existed but weren't mounted in main routes.ts

**Fix Applied:**
```typescript
// Added import (line ~109)
import manuscriptGenerationRouter from "./src/routes/manuscript-generation";

// Added mount (line ~989)
app.use("/api/manuscript", manuscriptGenerationRouter);
```

**Endpoints Now Available:**
- `POST /api/manuscript/generate/results`
- `POST /api/manuscript/generate/discussion`
- `POST /api/manuscript/generate/title-keywords`
- `POST /api/manuscript/generate/full`
- `POST /api/manuscript/validate/section`
- `GET /api/manuscript/budgets`
- `PUT /api/manuscript/budgets/:manuscriptId`

---

## 🔄 NEXT: Issue #2 - ALL AI API Calls

**Plan File:** `FIX_PLAN_AI_INSIGHTS.md`

**Scope:** 15+ AI endpoints across the application

### AI Endpoint Categories
| Category | Endpoints | Middleware |
|----------|-----------|------------|
| AI Insights Panel | 4 endpoints | `requireRole(RESEARCHER)` |
| Workflow Stages | 3 endpoints | `requireRole(RESEARCHER)` |
| Journal/Submission | 3 endpoints | `requireRole(RESEARCHER)` |
| ROS-prefixed | 3 endpoints | `blockAIInDemo` |
| Other | 5+ endpoints | Various |

### OpenAI Configuration
- Primary key: `AI_INTEGRATIONS_OPENAI_API_KEY`
- Fallback key: `OPENAI_API_KEY`
- Files: `ai-research.ts`, `routes.ts`

### Investigation Steps
1. Check `.env` for API keys
2. Check frontend auth headers
3. Test endpoints with curl
4. Check server logs

### Likely Root Causes
- Missing/invalid OpenAI API key
- Auth headers not being sent
- User missing RESEARCHER role

---

## 📁 KEY FILES REFERENCE

| Purpose | Path |
|---------|------|
| Main Routes | `services/orchestrator/routes.ts` |
| Mode Guard Middleware | `services/orchestrator/middleware/mode-guard.ts` |
| AI Insights Panel | `services/web/src/components/ai-insights-panel.tsx` |
| AI Research Functions | `services/orchestrator/ai-research.ts` |
| Environment Config | `.env` |
| Docker Config | `docker-compose.yml` |
| Manuscript Router | `services/orchestrator/src/routes/manuscript-generation.ts` |
| Medical Routes | `services/worker/src/medical_routes.py` |
| Worker API Server | `services/worker/src/api_server.py` |

---

## 🐳 DOCKER COMMANDS

```bash
# Standard deployment
docker-compose build && docker-compose up -d

# With medical integrations
docker-compose -f docker-compose.yml -f docker-compose.medical.yml up -d

# Restart specific service
docker-compose restart orchestrator

# Health checks
curl http://localhost:8000/health          # Worker
curl http://localhost:3001/health          # Orchestrator
curl http://localhost:3000                 # Web
```

---

## 🔧 COMMON FIXES REFERENCE

### Fix Pattern: Mount Missing Router
```typescript
// 1. Add import at top of routes.ts
import newRouter from "./src/routes/new-router";

// 2. Add mount with other app.use() calls
app.use("/api/new-path", newRouter);
```

### Fix Pattern: Check Environment Variables
```bash
grep -E "OPENAI|ANTHROPIC|GOVERNANCE|JWT" .env
```

### Fix Pattern: Test Endpoint
```bash
curl -X POST http://localhost:3001/api/endpoint \
  -H "Content-Type: application/json" \
  -d '{"key":"value"}'
```

---

## 📝 DOCUMENTATION FILES

| File | Purpose |
|------|---------|
| `CHECKPOINT_2026_01_26.md` | Detailed progress checkpoint |
| `CURRENT_STATUS.md` | Quick status reference |
| `FIX_COMPLETE_MANUSCRIPT_ROUTES.md` | Issue #1 completion doc |
| `FIX_TEMPLATE_MANUSCRIPT_ROUTES.md` | Reusable fix template |
| `FIX_PLAN_AI_INSIGHTS.md` | Issue #2 execution plan |
| `MASTER_ARCHIVE.md` | This file - master reference |

---

## 🔑 ENVIRONMENT VARIABLES REQUIRED

```env
# Core
NODE_ENV=development
GOVERNANCE_MODE=DEMO  # or LIVE

# AI/LLM (CRITICAL for AI Insights)
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=...

# JWT Auth
JWT_SECRET=...

# Medical Integrations
REDCAP_API_URL=https://...
REDCAP_API_TOKEN=...
EPIC_CLIENT_ID=...
PUBMED_API_KEY=...

# Services
WORKER_URL=http://worker:8000
REDIS_URL=redis://redis:6379
DATABASE_URL=postgresql://...
```

---

## 📈 COMPLETED TRACKS SUMMARY

### Track 1: Large-Data Ingestion ✅
- Dask/chunked pipeline
- PHI scanning
- Partitioned output
- AI self-improvement loop

### Track 2: Medical Integrations ✅
- REDCap, Epic FHIR, PubMed
- Redis cache, Ray execution
- Simulation module

### Track 3: Writing & Compliance ✅
- PHI-protected writing tools
- STROBE/PRISMA checkers
- Approval gates

### Track 4: Spreadsheet Parsing ✅
- Cell extraction with LLM
- Block text detection
- Checkpoint system

### Track 5: Additional Integrations ✅
- Box, Dropbox cloud storage
- RIS export, GitHub Actions
- Prompt versioning

---

*Archive Updated: January 26, 2026*
