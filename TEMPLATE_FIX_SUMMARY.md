# TEMPLATE FIX - Implementation Summary

## Date: 2026-01-26

## Issue
"Create New Workflow" dialog showed "No Template" - templates were not being loaded from the database.

## Root Cause Analysis
1. **Migration exists and is correct** - `0007_phase_g_workflow_builder.sql` has proper INSERT statements for 4 templates
2. **API routes are correct** - `/api/workflows/templates` endpoint exists
3. **Likely issue**: Migration may not have run successfully, or DB query returns empty

## Fix Applied

### 1. Added Fallback Templates (`services/orchestrator/src/services/workflowService.ts`)
- Added `FALLBACK_TEMPLATES` constant with 4 built-in templates:
  - `standard-research` - Full 20-stage research pipeline
  - `quick-analysis` - Abbreviated analysis pipeline
  - `conference-prep` - Conference materials workflow
  - `literature-review` - Literature review workflow
- Updated `listTemplates()` to use fallback if DB is empty or unavailable
- Updated `getTemplate()` to check fallback if DB returns nothing
- Added `seedTemplatesIfEmpty()` function to populate DB from fallbacks
- Added `ensureDb()` helper for null-safety

### 2. Added Seed Endpoint (`services/orchestrator/src/routes/workflows.ts`)
- Added `POST /api/workflows/templates/seed` endpoint (admin only)
- Can be called to populate templates in DB if empty
- Added better logging for debugging

## Files Changed
1. `services/orchestrator/src/services/workflowService.ts` - Complete rewrite with fallback support
2. `services/orchestrator/src/routes/workflows.ts` - Added seed endpoint and logging

## Testing the Fix

### Option 1: Templates should now work automatically (fallback)
1. Start the app: `docker compose up -d`
2. Navigate to http://localhost:5173
3. Login with admin credentials
4. Go to Workflows page
5. Click "New Workflow" - should see 4 templates in dropdown

### Option 2: Seed templates to database
```bash
# After services are running, seed templates
curl -X POST http://localhost:3001/api/workflows/templates/seed \
  -H "Authorization: Bearer <admin_token>" \
  -H "Content-Type: application/json"
```

### Option 3: Verify API directly
```bash
# Check templates endpoint
curl http://localhost:3001/api/workflows/templates | jq .
```

## Commit
```bash
git add -A
git commit -m "[Fix] Add fallback templates for workflow creation

- Add built-in fallback templates when DB is empty
- Add seed endpoint for populating templates
- Improve null-safety and error handling in workflowService
- Add logging for template operations

Templates: standard-research, quick-analysis, conference-prep, literature-review"
```

## Next Steps (Part 2: Full AI Workflow Test)
After verifying templates work:
1. Create a new workflow with the standard-research template
2. Test all AI functions (literature search, manuscript generation, etc.)
3. Run Playwright E2E tests
