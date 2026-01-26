# Current Status - Quick Reference
**Updated:** January 26, 2026

## ✅ Working
- Large-data ingestion pipeline (Dask)
- Medical integrations (REDCap, Epic FHIR, PubMed)
- Writing assistance with PHI protection
- STROBE/PRISMA compliance checkers
- Spreadsheet cell parsing
- Cloud storage (Box, Dropbox)
- Docker deployment

## ✅ Recently Fixed
1. **Manuscript generation/editing** - Routes now mounted (Jan 26)

## ⚠️ Still Not Working
2. **AI Insights button** - Env vars or auth issue

## 🔧 Immediate Fixes Needed

### Fix #1: Mount Manuscript Routes ✅ DONE

### Fix #2: Check AI Insights
```bash
# Check env
grep -E "OPENAI|GOVERNANCE|JWT" .env

# Test endpoint
curl -X POST http://localhost:3001/api/ai/research-brief \
  -H "Content-Type: application/json" \
  -d '{"projectId":"test"}'
```

## 📂 Key Files
- Routes: `services/orchestrator/routes.ts`
- Manuscript: `services/orchestrator/src/routes/manuscript-generation.ts`
- AI Panel: `services/web/src/components/ai-insights-panel.tsx`
- Env: `.env`
