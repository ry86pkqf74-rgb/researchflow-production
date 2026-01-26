# Webpage Evaluation Plan - ResearchFlow Production

**Date:** January 26, 2026  
**Purpose:** Comprehensive testing of all webpage functionality after fixes

---

## Pre-Evaluation Requirements

- [ ] Docker services running (see `PLAN_DOCKER_LAUNCH.md`)
- [ ] Frontend accessible at http://localhost:3000
- [ ] API accessible at http://localhost:3001
- [ ] API keys configured in `.env`

---

## Phase 1: Landing Page (Demo Mode)

### 1.1 Visual Check
- [ ] Landing page loads without errors
- [ ] Demo mode indicator visible (icon, not banner)
- [ ] Navigation works
- [ ] Responsive on different screen sizes

### 1.2 Demo Mode Behavior
- [ ] Landing page stays in DEMO mode (no live API calls)
- [ ] Demo data appears in workflow preview
- [ ] "Try Demo" or similar CTA works

---

## Phase 2: Authentication

### 2.1 Login Flow
- [ ] Login page loads
- [ ] Can enter credentials
- [ ] Login succeeds with valid admin credentials
- [ ] JWT token stored properly
- [ ] Redirect to dashboard after login

### 2.2 Admin Credentials (Check your records)
```
Default admin: Check .env or database seeds
```

### 2.3 Auth Persistence
- [ ] Refresh page - still logged in
- [ ] Token sent with API requests (check Network tab)
- [ ] Logout works

---

## Phase 3: Workflow Pipeline (After Login)

### 3.1 Stage 1: Topic Declaration
- [ ] Can enter research topic
- [ ] Can fill PICO fields (Population, Intervention, Comparator, Outcomes)
- [ ] "Get AI Recommendations" button visible
- [ ] **AI TEST:** Click AI recommendations - should return suggestions
- [ ] Stage completes and advances

### 3.2 Stage 2: Literature Search
- [ ] Can enter search parameters
- [ ] **AI TEST:** Literature search executes
- [ ] Results display (or demo results in demo mode)
- [ ] Stage completes

### 3.3 Stages 3-10: Mid-Workflow
- [ ] Each stage loads correctly
- [ ] User inputs save
- [ ] Progress tracking works
- [ ] Can navigate between stages

### 3.4 Stage 11+: Manuscript Development
- [ ] Manuscript proposals display
- [ ] **AI TEST:** Can generate manuscript sections
- [ ] Editor loads for manuscript editing

---

## Phase 4: AI Insights Panel

### 4.1 Research Brief
- [ ] Button clickable
- [ ] **AI TEST:** Generates research brief
- [ ] Response displays correctly
- [ ] No console errors

### 4.2 Evidence Gap Map
- [ ] Button clickable
- [ ] **AI TEST:** Generates gap map
- [ ] Visualization renders (if applicable)

### 4.3 Study Cards
- [ ] Button clickable
- [ ] **AI TEST:** Generates study cards
- [ ] Cards display with proper formatting

### 4.4 Decision Matrix
- [ ] Button clickable
- [ ] **AI TEST:** Generates matrix
- [ ] Scores/rankings display

---

## Phase 5: Manuscript Generation (Issue #1 Fix Verification)

### 5.1 Test New Endpoints
```bash
# Test manuscript budgets endpoint
curl http://localhost:3001/api/manuscript/budgets

# Test results generation (with auth)
curl -X POST http://localhost:3001/api/manuscript/generate/results \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{"manuscriptId":"test","analysisResults":{"summary":"test data"}}'
```

### 5.2 UI Integration
- [ ] Manuscript editor loads
- [ ] Can generate Results section
- [ ] Can generate Discussion section
- [ ] Can generate Title/Keywords
- [ ] Word budget validation works

---

## Phase 6: AI Endpoints (Issue #2 Fix Verification)

### 6.1 Test All AI Endpoints via curl
```bash
# Get auth token first (from browser dev tools after login)
TOKEN="your-jwt-token"

# Test research brief
curl -X POST http://localhost:3001/api/ai/research-brief \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"topic":"diabetes telemedicine"}'

# Test topic recommendations
curl -X POST http://localhost:3001/api/ai/topic-recommendations \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"researchOverview":"Impact of telemedicine on diabetes","currentValues":{}}'

# Test study cards
curl -X POST http://localhost:3001/api/ai/study-cards \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"topic":"diabetes telemedicine","count":3}'
```

### 6.2 Expected Responses
- Returns JSON with AI-generated content
- No "401 Unauthorized" errors
- No "OpenAI API key" errors
- Response includes `generatedAt` timestamp

---

## Phase 7: Mode Switching

### 7.1 Demo Mode
- [ ] `/api/mode` returns `{"mode":"DEMO"}` or `{"mode":"LIVE"}`
- [ ] Demo mode shows mock data for `blockAIInDemo` routes
- [ ] Landing page always in demo mode

### 7.2 Live Mode
- [ ] After login, can access live features
- [ ] Real AI calls execute (check Network tab)
- [ ] Real data persists

---

## Phase 8: Error Handling

### 8.1 Network Errors
- [ ] Graceful error messages on API failure
- [ ] No white screen of death
- [ ] Retry options where appropriate

### 8.2 Auth Errors
- [ ] 401 redirects to login
- [ ] Session expiry handled gracefully

### 8.3 AI Errors
- [ ] Missing API key shows helpful error
- [ ] Rate limit errors displayed properly
- [ ] Timeout handling works

---

## Phase 9: Browser Console Check

### 9.1 Open Developer Tools (F12)
- [ ] No red errors in Console
- [ ] No failed network requests (Network tab)
- [ ] No React errors
- [ ] Auth tokens visible in requests

---

## Test Results Template

| Test | Status | Notes |
|------|--------|-------|
| Landing page loads | ⬜ | |
| Login works | ⬜ | |
| Auth headers sent | ⬜ | |
| AI Insights - Research Brief | ⬜ | |
| AI Insights - Evidence Gap | ⬜ | |
| AI Insights - Study Cards | ⬜ | |
| AI Insights - Decision Matrix | ⬜ | |
| Topic Recommendations (Stage 1) | ⬜ | |
| Literature Search (Stage 2) | ⬜ | |
| Manuscript Generation | ⬜ | |
| Manuscript Editing | ⬜ | |
| Mode switching | ⬜ | |
| No console errors | ⬜ | |

---

## Quick Verification Commands

```bash
# Health checks
curl http://localhost:3000 -s | head -5
curl http://localhost:3001/health
curl http://localhost:8000/health

# Mode check
curl http://localhost:3001/api/mode

# AI test (after getting token)
curl -X POST http://localhost:3001/api/ai/research-brief \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"topic":"test"}'
```

---

## Success Criteria

✅ **All tests pass when:**
1. All services start without errors
2. Landing page loads in demo mode
3. Login/logout works
4. All 15+ AI endpoints return real AI responses
5. Manuscript generation endpoints work
6. No console errors
7. Workflow stages complete successfully

---

*Plan Created: January 26, 2026*
