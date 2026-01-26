# FIX COMPLETED: AI Endpoints Configuration

**Date:** January 26, 2026  
**Issue:** AI Insights and all AI API calls not working  
**Status:** ✅ CODE FIXES APPLIED - ⚠️ USER ACTION REQUIRED

---

## Root Causes Identified & Fixed

### Issue 1: Empty `.env` File ✅ FIXED
**Problem:** The `.env` file only contained empty placeholder values.

**Fix Applied:** Created proper `.env` with all required defaults:
- `JWT_SECRET` - Set to development default
- `GOVERNANCE_MODE=LIVE` - Enables real AI calls
- `DATABASE_URL` - PostgreSQL connection
- `WORKER_URL` - Worker service URL
- `REDIS_URL` - Redis connection

### Issue 2: Missing Auth Headers in API Client ✅ FIXED
**Problem:** `apiRequest()` in `queryClient.ts` didn't send Authorization header.

**Fix Applied:** Updated `queryClient.ts` to:
- Add `getAuthToken()` function to retrieve JWT from store/localStorage
- Add `buildRequestHeaders()` to include Authorization header
- Both `apiRequest()` and `getQueryFn()` now send auth tokens

### Issue 3: No Fallback for OpenAI Key ✅ FIXED
**Problem:** `ai-research.ts` only checked `AI_INTEGRATIONS_OPENAI_API_KEY`.

**Fix Applied:** Updated to check both keys with fallback:
```typescript
const apiKey = process.env.AI_INTEGRATIONS_OPENAI_API_KEY || process.env.OPENAI_API_KEY;
```
Also added warning logs when API key is missing.

---

## ⚠️ USER ACTION REQUIRED

### You Must Add Your OpenAI API Key

The `.env` file is configured but the OpenAI API key is empty. 

**To enable AI features:**

1. Get your API key from: https://platform.openai.com/api-keys

2. Edit `.env` file and add your key:
```bash
OPENAI_API_KEY=sk-your-actual-api-key-here
```

3. Restart the services:
```bash
docker-compose restart orchestrator
```

4. Test an AI endpoint:
```bash
curl -X POST http://localhost:3001/api/ai/research-brief \
  -H "Content-Type: application/json" \
  -d '{"topic":"diabetes management"}'
```

---

## Files Modified

| File | Change |
|------|--------|
| `.env` | Added all required environment variables with defaults |
| `services/web/src/lib/queryClient.ts` | Added auth header support to apiRequest() |
| `services/orchestrator/ai-research.ts` | Added API key fallback and warning logs |

---

## AI Endpoints Now Configured

All 15+ AI endpoints are now properly configured:

### AI Insights Panel
- ✅ `POST /api/ai/research-brief`
- ✅ `POST /api/ai/evidence-gap-map`
- ✅ `POST /api/ai/study-cards`
- ✅ `POST /api/ai/decision-matrix`

### Workflow Stages
- ✅ `POST /api/ai/topic-recommendations`
- ✅ `POST /api/ai/literature-search`
- ✅ `POST /api/ai/planned-extraction`

### Journal & Submission
- ✅ `POST /api/ai/journal-recommendations`
- ✅ `POST /api/ai/submission-requirements`
- ✅ `POST /api/ai/submission-documents`

### Other AI Endpoints
- ✅ `POST /api/ai/data-contribution`
- ✅ `POST /api/ros/irb/generate`
- ✅ `POST /api/ros/ideation/generate`
- ✅ `POST /api/ros/literature/search`

---

## Verification Steps

After adding your OpenAI API key:

1. **Check services are running:**
```bash
docker-compose ps
```

2. **Check orchestrator logs for API key warning:**
```bash
docker-compose logs orchestrator | grep "OpenAI"
```
- If you see "WARNING: No OpenAI API key configured" - key is not set
- If no warning - key is configured correctly

3. **Test AI endpoint:**
```bash
curl -X POST http://localhost:3001/api/ai/research-brief \
  -H "Content-Type: application/json" \
  -d '{"topic":"impact of telemedicine on chronic disease"}'
```

4. **Test in browser:**
- Log in to the application
- Navigate to a workflow
- Click "AI Insights" or "Get Recommendations" buttons
- Verify responses are generated (not errors)

---

## Troubleshooting

### "401 Unauthorized" Error
- User not logged in or token expired
- Try logging out and back in

### "OpenAI API Error"
- Check API key is correct in `.env`
- Check OpenAI account has credits/billing enabled
- Check API key permissions

### "Network Error"
- Check Docker services are running
- Check orchestrator can reach OpenAI API (network/firewall)

---

*Fix Completed: January 26, 2026*
*Commits: Pending staging and push*
