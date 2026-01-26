# FIX COMPLETED: Manuscript Generation Routes

**Date:** January 26, 2026  
**Issue:** Manuscript generation routes not mounted  
**Status:** ✅ FIXED

---

## Changes Made

### 1. Import Added (Line ~109)
```typescript
import manuscriptGenerationRouter from "./src/routes/manuscript-generation";
```

### 2. Router Mounted (Line ~988)
```typescript
// Manuscript Generation Routes (IMRaD structure, word budgets)
app.use("/api/manuscript", manuscriptGenerationRouter);
```

---

## Endpoints Now Available

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/manuscript/generate/results` | Generate Results section scaffold |
| POST | `/api/manuscript/generate/discussion` | Generate Discussion section |
| POST | `/api/manuscript/generate/title-keywords` | Generate titles and keywords |
| POST | `/api/manuscript/generate/full` | Generate full manuscript structure |
| POST | `/api/manuscript/validate/section` | Validate section word budget |
| GET | `/api/manuscript/budgets` | Get word budget configuration |
| PUT | `/api/manuscript/budgets/:manuscriptId` | Update word budgets |

---

## Verification Steps

```bash
# 1. Restart services
docker-compose restart orchestrator

# 2. Test budgets endpoint (no auth required)
curl http://localhost:3001/api/manuscript/budgets

# Expected response:
# {"budgets":[...],"description":"Default word budgets for manuscript sections"}

# 3. Test generate endpoint (requires auth)
curl -X POST http://localhost:3001/api/manuscript/generate/results \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{"manuscriptId":"test","analysisResults":{"summary":"test data"}}'
```

---

## File Modified
- `services/orchestrator/routes.ts` (2 edits)

## Next Steps
1. Test endpoints work in browser/Postman
2. Verify worker service endpoints are responding
3. Integrate CollaborativeEditor with manuscript generation flow
4. Move to Issue #2: AI Insights Button

---

*Completed: January 26, 2026*
