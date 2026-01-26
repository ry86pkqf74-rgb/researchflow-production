# FIX TEMPLATE: Manuscript Generation Routes Not Mounted

## Problem Summary
The `manuscript-generation.ts` router exists at `services/orchestrator/src/routes/manuscript-generation.ts` but is:
1. NOT imported in main `routes.ts`
2. NOT mounted with `app.use()`

## File Locations
- **Main Routes:** `services/orchestrator/routes.ts`
- **Manuscript Router:** `services/orchestrator/src/routes/manuscript-generation.ts`

## Fix Steps

### Step 1: Add Import Statement
**Location:** Around line 108-110 (with other router imports)
**Add:**
```typescript
import manuscriptGenerationRouter from "./src/routes/manuscript-generation";
```

### Step 2: Mount Router
**Location:** Around line 982-985 (with other `/api/ros/*` routes)
**Add:**
```typescript
app.use("/api/manuscript", manuscriptGenerationRouter);
```

## Expected Endpoints After Fix
- `POST /api/manuscript/generate/results` - Generate Results section
- `POST /api/manuscript/generate/discussion` - Generate Discussion section
- `POST /api/manuscript/generate/title-keywords` - Generate titles and keywords
- `POST /api/manuscript/generate/full` - Generate full manuscript structure
- `POST /api/manuscript/validate/section` - Validate section word budget
- `GET /api/manuscript/budgets` - Get word budget configuration
- `PUT /api/manuscript/budgets/:manuscriptId` - Update word budgets

## Verification After Fix
```bash
# Restart orchestrator
docker-compose restart orchestrator

# Test endpoint
curl -X GET http://localhost:3001/api/manuscript/budgets
```

---
*Template Created: January 26, 2026*
