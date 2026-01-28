# ResearchFlow Execution Plan — January 28, 2026

## Current State Assessment

### ✅ Environment Status
- **Repository**: Clean, on main branch, up to date with origin
- **Recent Commits**: n8n integration docs, Vercel config fixes pushed
- **Notion Schema**: Tasks DB has all recommended properties (Type, Service, Risk, Needs Approval, PR Link, Deploy Link, Verification)

### 🔴 Critical Issues Found

#### 1. TESTROS Security Bypass (P0 - MUST FIX)
**Files affected:**
- `services/orchestrator/src/routes/auth.ts` (lines 73-81)
- `services/orchestrator/src/services/authService.ts` (lines 380-432, 625-694)

**Issue**: Hardcoded test user bypass that auto-creates admin accounts
```typescript
// FOUND: TESTROS_BYPASS pattern
if (req.body.email === 'TESTROS_BYPASS' && req.body.password === 'TESTROS_SECRET')

// FOUND: testros@gmail.com bypass
if (normalizedEmail === 'testros@gmail.com')
```

#### 2. Vercel Deployment Not Triggering
- GitHub webhook not receiving push events
- Vercel settings corrected: Framework=Vite, Root=services/web
- Deploy hook created: `https://api.vercel.com/v1/integrations/deploy/prj_wtdmfXtRTAzbtmJ664gBAtEha14h/Po8Pl2C8aM`

### ✅ Already Configured
- **Redis Authentication**: `--requirepass ${REDIS_PASSWORD}` configured
- **JWT Validation**: Basic validation at startup exists
- **n8n Integration**: Client library + docs created (5 files)

---

## Execution Priority Order

### Phase 1: Security (P0) - 2-3 hours
**Goal**: Remove all security bypasses before ANY production deployment

| Task | File | Action | Verification |
|------|------|--------|--------------|
| 1.1 | auth.ts | Remove TESTROS_BYPASS block | `grep -r "TESTROS" services/` returns 0 |
| 1.2 | authService.ts | Remove testros@gmail.com bypass | Same verification |
| 1.3 | authService.ts | Remove createTestROSUser function | Same verification |
| 1.4 | config/index.ts | Strengthen JWT validation | App fails to start without 32-char secret in prod |

### Phase 2: Infrastructure (P1) - 1-2 hours
**Goal**: Ensure reliable service startup and health monitoring

| Task | File | Action |
|------|------|--------|
| 2.1 | docker-compose.yml | Add `service_healthy` conditions for all dependencies |
| 2.2 | All services | Verify `/health` endpoints return proper JSON |
| 2.3 | docker-compose.yml | Add Redis persistence volume |

### Phase 3: Frontend (P1) - 2-3 hours
**Goal**: Build passes, TypeScript errors resolved, deploy to Vercel

| Task | File | Action |
|------|------|--------|
| 3.1 | papers.tsx | Fix type errors |
| 3.2 | schema.ts | Fix type assignment errors |
| 3.3 | spreadsheet-cell-parse.tsx | Fix component type errors |
| 3.4 | All web files | Replace `NEXT_PUBLIC_` with `VITE_` |
| 3.5 | Vercel | Trigger successful deployment |

### Phase 4: n8n Workflows (P2) - 2 hours
**Goal**: Automate GitHub → Notion synchronization

| Workflow | Trigger | Action |
|----------|---------|--------|
| A | Notion task → "Ready" | Create GitHub branch + PR |
| B | GitHub PR status change | Update Notion task status |
| C | PR merged | Create deployment log entry |

---

## Git Workflow (Non-Negotiable)

```bash
# For each logical change set:

# 1. Create feature branch
git checkout -b task/<notion-id>-<slug>

# 2. Make changes, then stage
git add -A

# 3. Commit with semantic message
git commit -m "fix(service): Brief description

- Detailed bullet point 1
- Detailed bullet point 2

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"

# 4. Push
git push origin task/<notion-id>-<slug>

# 5. Create PR (for security changes, require review)
```

---

## Notion Task Links

Key tasks to update after completion:
- [Fix auth.ts security bypass](https://www.notion.so/2f650439dcba815c8ed3dd20525245fd)
- [Fix email-based bypass](https://www.notion.so/2f650439dcba81448243d5caa4014509)
- [Add Redis authentication](https://www.notion.so/2f650439dcba813a95e4c6c2cf36c85d)
- [Replace NEXT_PUBLIC with VITE_](https://www.notion.so/2f650439dcba813c84fbc61add5cd00c)
- [Frontend Vercel Deploy](https://www.notion.so/2f650439dcba8172ba8cc52fe077557b)

---

## Emergency Stop Conditions

**STOP and ask human if:**
- Any change involves PHI data
- Any change to production credentials
- Any merge without CI passing
- Any database schema changes
- Any auth logic changes beyond removing bypasses
- Anything that feels "risky"

---

## Next Immediate Action

**Start Phase 1.1**: Remove TESTROS bypass from `services/orchestrator/src/routes/auth.ts`

```bash
# Verify current state
grep -n "TESTROS" services/orchestrator/src/routes/auth.ts

# Then edit to remove the bypass block (lines 73-86)
```
