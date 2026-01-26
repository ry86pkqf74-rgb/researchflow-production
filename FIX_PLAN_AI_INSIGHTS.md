# FIX PLAN: AI Insights Button Not Working

**Date Created:** January 26, 2026  
**Issue:** AI Insights and Recommendations button not functioning  
**Priority:** High

---

## Problem Summary

The AI Insights panel in the frontend calls backend endpoints that exist but return errors. Users click the "AI Insights" button and nothing happens or they get error responses.

---

## Known Information

### Backend Routes (CONFIRMED TO EXIST)
Located in `services/orchestrator/routes.ts` around lines 2800-3000:

| Endpoint | Purpose |
|----------|---------|
| `POST /api/ai/research-brief` | Generate research brief |
| `POST /api/ai/evidence-gap-map` | Create evidence gap map |
| `POST /api/ai/study-cards` | Generate study cards |
| `POST /api/ai/decision-matrix` | Create decision matrix |

### Frontend Component
- **File:** `services/web/src/components/ai-insights-panel.tsx`
- Calls the above endpoints when user clicks buttons

---

## Likely Root Causes (To Investigate)

### Cause 1: Missing API Keys
```bash
# Check if OPENAI_API_KEY is set
grep -E "OPENAI_API_KEY" .env
```
**Fix:** Add valid OpenAI API key to `.env`

### Cause 2: GOVERNANCE_MODE=DEMO Blocking AI
```bash
# Check governance mode
grep -E "GOVERNANCE_MODE" .env
```
The `blockAIInDemo` middleware may be blocking AI calls in demo mode.

**Fix Options:**
- Switch to LIVE mode for testing
- OR ensure demo mode returns mock responses instead of blocking

### Cause 3: Authentication/JWT Issues
- Frontend may not be sending proper auth token
- Backend may be rejecting unauthenticated requests

**Fix:** Check auth middleware on AI routes

### Cause 4: Worker Service Not Running
AI routes may call the Python worker service which might be down.

**Fix:** Verify worker is running: `curl http://localhost:8000/health`

---

## Investigation Steps

### Step 1: Check Environment Variables
```bash
cd /Users/ros/Documents/GitHub/researchflow-production
grep -E "OPENAI|ANTHROPIC|GOVERNANCE|JWT" .env
```

### Step 2: Check Frontend Component
```bash
cat services/web/src/components/ai-insights-panel.tsx | head -100
```
Look for:
- API endpoint URLs being called
- Auth headers being sent
- Error handling

### Step 3: Check Route Implementation
```bash
grep -A 50 "research-brief" services/orchestrator/routes.ts | head -60
```
Look for:
- Middleware (blockAIInDemo, requireAuth)
- OpenAI client usage
- Error handling

### Step 4: Check Mode Guard Middleware
```bash
cat services/orchestrator/middleware/mode-guard.ts
```
Understand how `blockAIInDemo` works.

### Step 5: Test Endpoint Directly
```bash
# Test without auth
curl -X POST http://localhost:3001/api/ai/research-brief \
  -H "Content-Type: application/json" \
  -d '{"topicId":"test"}'

# Test with auth (if you have a token)
curl -X POST http://localhost:3001/api/ai/research-brief \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{"topicId":"test"}'
```

---

## Fix Implementation Plan

### Phase 1: Diagnosis (10 min)
1. [ ] Check `.env` for API keys and mode settings
2. [ ] Review `ai-insights-panel.tsx` for how it calls APIs
3. [ ] Review route handlers for middleware chain
4. [ ] Test endpoints with curl

### Phase 2: Fix Based on Findings
**If missing API key:**
- Add `OPENAI_API_KEY=sk-...` to `.env`

**If blocked by demo mode:**
- Option A: Add mock responses for demo mode
- Option B: Ensure proper mode switching works

**If auth issues:**
- Fix JWT middleware or auth header passing

**If worker down:**
- Check Docker compose, ensure worker service starts

### Phase 3: Verification
1. [ ] Restart services: `docker-compose restart`
2. [ ] Test endpoint with curl
3. [ ] Test in browser UI
4. [ ] Verify both demo and live modes work appropriately

### Phase 4: Commit
```bash
git add -A
git commit -m "fix(ai-insights): [description based on actual fix]"
git push origin main
```

---

## Key Files to Examine

| File | Purpose |
|------|---------|
| `.env` | Environment variables |
| `services/orchestrator/routes.ts` | Backend route handlers |
| `services/orchestrator/middleware/mode-guard.ts` | Demo/Live mode middleware |
| `services/web/src/components/ai-insights-panel.tsx` | Frontend component |
| `services/orchestrator/ai-research.ts` | AI generation functions |
| `docker-compose.yml` | Service configuration |

---

## Success Criteria

- [ ] AI Insights button responds when clicked
- [ ] Research brief generates successfully
- [ ] Evidence gap map generates successfully
- [ ] Study cards generate successfully
- [ ] Decision matrix generates successfully
- [ ] Works in appropriate mode (LIVE with real AI, DEMO with mocks)

---

*Plan Created: January 26, 2026*
*For: ResearchFlow Production - Issue #2*
