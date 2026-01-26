# Current Status - Quick Reference
**Updated:** January 26, 2026

---

## 🎯 IMMEDIATE FOCUS
**Issue #2: AI Insights Button** - Ready to execute
- Plan file: `FIX_PLAN_AI_INSIGHTS.md`

---

## ✅ Recently Fixed
| Issue | Status | Commit |
|-------|--------|--------|
| Manuscript generation routes | ✅ FIXED | `784971d` |

---

## 🔄 Ready to Execute
| Issue | Plan File | Likely Cause |
|-------|-----------|--------------|
| AI Insights button | `FIX_PLAN_AI_INSIGHTS.md` | API key / mode / auth |

---

## Quick Investigation Commands

```bash
cd /Users/ros/Documents/GitHub/researchflow-production

# Step 1: Check env vars
grep -E "OPENAI|GOVERNANCE|JWT" .env

# Step 2: Check if services running
curl http://localhost:3001/health
curl http://localhost:8000/health

# Step 3: Test AI endpoint
curl -X POST http://localhost:3001/api/ai/research-brief \
  -H "Content-Type: application/json" \
  -d '{"topicId":"test"}'
```

---

## Key Files for Issue #2

| File | Check For |
|------|-----------|
| `.env` | OPENAI_API_KEY, GOVERNANCE_MODE |
| `middleware/mode-guard.ts` | blockAIInDemo logic |
| `ai-insights-panel.tsx` | How frontend calls API |
| `routes.ts` | Route middleware chain |

---

## After Fix Complete

```bash
git add -A
git commit -m "fix(ai-insights): [description]"
git push origin main
```

---

## Reference Docs
- `MASTER_ARCHIVE.md` - Full project archive
- `FIX_PLAN_AI_INSIGHTS.md` - Detailed execution plan
- `CHECKPOINT_2026_01_26.md` - Progress checkpoint
