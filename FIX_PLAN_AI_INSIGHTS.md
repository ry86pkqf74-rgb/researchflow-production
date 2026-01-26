# COMPREHENSIVE FIX PLAN: All AI API Calls (Live Page After Login)

**Date Created:** January 26, 2026  
**Scope:** ALL AI endpoints used after login in ResearchFlow  
**Priority:** High

---

## Complete AI Endpoint Inventory

### Category 1: AI Insights Panel (`ai-insights-panel.tsx`)
| Endpoint | Purpose | Middleware |
|----------|---------|------------|
| `POST /api/ai/research-brief` | Generate research brief | `requireRole(RESEARCHER)` |
| `POST /api/ai/evidence-gap-map` | Create evidence gap map | `requireRole(RESEARCHER)` |
| `POST /api/ai/study-cards` | Generate study cards | `requireRole(RESEARCHER)` |
| `POST /api/ai/decision-matrix` | Create decision matrix | `requireRole(RESEARCHER)` |

### Category 2: Workflow Stage AI Calls (`routes.ts`)
| Endpoint | Purpose | Stage |
|----------|---------|-------|
| `POST /api/ai/topic-recommendations` | PICO refinement suggestions | Stage 1 |
| `POST /api/ai/literature-search` | Literature search | Stage 2 |
| `POST /api/ai/planned-extraction` | Extraction planning | Stage 4 |

### Category 3: Journal & Submission AI
| Endpoint | Purpose | Middleware |
|----------|---------|------------|
| `POST /api/ai/journal-recommendations` | Journal matching | `requireRole(RESEARCHER)` |
| `POST /api/ai/submission-requirements` | Submission reqs | `requireRole(RESEARCHER)` |
| `POST /api/ai/submission-documents` | Generate documents | `requireRole(RESEARCHER)` |

### Category 4: Other AI Generation
| Endpoint | Purpose | Middleware |
|----------|---------|------------|
| `POST /api/ai/data-contribution` | Data contribution analysis | `requireRole(RESEARCHER)` |
| `GET /api/ai/usage` | AI usage stats | None |
| `GET /api/ai/approval-stats` | Approval stats | None |
| `POST /api/ai/approve-stage` | Stage approval | `requireRole` |
| `POST /api/ai/approve-phase` | Phase approval | `requireRole` |
| `POST /api/ai/approve-session` | Session approval | `requireRole` |

### Category 5: ROS-prefixed AI Routes (use `blockAIInDemo`)
| Endpoint | Purpose | Middleware |
|----------|---------|------------|
| `POST /api/ros/irb/generate` | IRB proposal | `blockAIInDemo` |
| `GET /api/ros/ideation/generate` | Ideation | `blockAIInDemo` |
| `GET /api/ros/literature/search` | Literature | `blockAIInDemo` |

### Category 6: Manuscript & Streaming
| Endpoint | Purpose | Location |
|----------|---------|----------|
| `POST /api/ai/streaming/generate` | Streaming generation | `manuscript-editor.tsx` |
| `POST /api/ai/stream` | AI streaming | `useAIStreaming.ts` |

---

## OpenAI Client Configuration

**File:** `services/orchestrator/ai-research.ts`
```typescript
const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});
```

**File:** `services/orchestrator/routes.ts` (direct usage)
```typescript
const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY || process.env.OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});
```

---

## Root Cause Analysis

### Issue A: OpenAI API Key
The AI functions use `AI_INTEGRATIONS_OPENAI_API_KEY` (primary) or `OPENAI_API_KEY` (fallback).

**Check:**
```bash
grep -E "AI_INTEGRATIONS_OPENAI|OPENAI_API_KEY" .env
```

### Issue B: Authentication (requireRole middleware)
All `/api/ai/*` endpoints require `RESEARCHER` role. Users must:
1. Be logged in with valid JWT
2. Have RESEARCHER role assigned

**Check:** Verify user has proper role in database.

### Issue C: Demo Mode (NOT blocking most AI routes)
`blockAIInDemo` middleware is ONLY applied to:
- `/api/ros/irb/generate`
- `/api/ros/ideation/generate`  
- `/api/ros/literature/search`

Main `/api/ai/*` routes do NOT use `blockAIInDemo` - they call OpenAI directly.

### Issue D: Frontend Auth Header
Frontend must send JWT token in Authorization header.

**Check in `ai-insights-panel.tsx`:**
- Does `apiRequest()` include auth headers?
- Is the user's token being passed?

---

## Investigation Steps

### Step 1: Check Environment Variables
```bash
cd /Users/ros/Documents/GitHub/researchflow-production
cat .env | grep -E "OPENAI|AI_INTEGRATIONS|GOVERNANCE|JWT"
```

**Required variables:**
```env
AI_INTEGRATIONS_OPENAI_API_KEY=sk-...   # Primary
OPENAI_API_KEY=sk-...                    # Fallback
JWT_SECRET=...                           # For auth
GOVERNANCE_MODE=LIVE                     # For real AI calls (optional - most routes work in DEMO too)
```

### Step 2: Check Frontend API Client
```bash
cat services/web/src/lib/api-client.ts | head -50
cat services/web/src/components/ai-insights-panel.tsx | head -80
```

Look for:
- How `apiRequest()` is implemented
- Whether auth headers are included

### Step 3: Test Endpoint Directly
```bash
# Get a valid token first (from browser dev tools or login endpoint)

# Test without auth (should fail with 401)
curl -X POST http://localhost:3001/api/ai/research-brief \
  -H "Content-Type: application/json" \
  -d '{"topic":"test"}'

# Test with auth
curl -X POST http://localhost:3001/api/ai/research-brief \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <JWT_TOKEN>" \
  -d '{"topic":"diabetes management"}'
```

### Step 4: Check Server Logs
```bash
docker-compose logs orchestrator | tail -100
```

Look for:
- OpenAI API errors
- Authentication failures
- 401/403/500 errors

---

## Fix Implementation

### Fix A: Add/Fix OpenAI API Key
```bash
# Edit .env file
echo "AI_INTEGRATIONS_OPENAI_API_KEY=sk-your-key-here" >> .env
echo "OPENAI_API_KEY=sk-your-key-here" >> .env
```

### Fix B: Ensure Auth Headers in Frontend
If `apiRequest()` doesn't include auth, modify it or ensure token is passed.

### Fix C: Add Demo Mode Mock Responses (if needed)
For endpoints that should work in demo mode, add `blockAIInDemo` middleware and ensure mock responses are returned.

### Fix D: Verify User Role
Ensure logged-in users have `RESEARCHER` role for AI access.

---

## Files to Modify (Potential)

| File | Potential Fix |
|------|---------------|
| `.env` | Add API keys |
| `services/web/src/lib/api-client.ts` | Fix auth headers |
| `services/orchestrator/routes.ts` | Add error handling/logging |
| `services/orchestrator/ai-research.ts` | Add fallback/mock for missing key |

---

## Verification Checklist

After fix, verify ALL endpoints work:

- [ ] `/api/ai/research-brief` - Research brief generation
- [ ] `/api/ai/evidence-gap-map` - Evidence gap map
- [ ] `/api/ai/study-cards` - Study cards
- [ ] `/api/ai/decision-matrix` - Decision matrix
- [ ] `/api/ai/topic-recommendations` - Topic recommendations
- [ ] `/api/ai/journal-recommendations` - Journal recommendations
- [ ] `/api/ai/submission-requirements` - Submission requirements
- [ ] `/api/ai/submission-documents` - Submission documents
- [ ] `/api/ai/data-contribution` - Data contribution
- [ ] `/api/ros/irb/generate` - IRB generation
- [ ] `/api/ros/ideation/generate` - Ideation
- [ ] `/api/ros/literature/search` - Literature search
- [ ] Workflow Stage 1 AI recommendations
- [ ] Workflow Stage 2 literature search

---

## Success Criteria

1. All AI buttons respond when clicked (no silent failures)
2. Real AI responses in LIVE mode (not mock data)
3. Proper error messages if API key missing
4. Authentication properly enforced
5. All workflow stages with AI work correctly

---

*Plan Created: January 26, 2026*
*Covers: ALL AI endpoints in ResearchFlow Production*
