# AI Agent Task Delegation Plan
**Generated:** Jan 29, 2026 | **Priority:** Auth Flow Fix

---

## 🎯 Primary Issue
Playwright auth tests fail: login doesn't set LIVE mode properly
- Tests expect `mode === 'LIVE'` after login
- Getting `mode === 'DEMO'` instead

---

## Agent Assignments

### 🔵 CURSOR (3 Subagents)

**Cursor-1: Frontend Auth Investigation**
```
@codebase Search for mode state changes after login
Files: services/web/src/stores/mode-store.ts, hooks/use-auth.ts
Task: Find where mode should switch DEMO→LIVE on successful login
```

**Cursor-2: Backend Auth Flow**
```
@codebase Trace POST /api/auth/login response
Files: services/orchestrator/src/routes/auth.ts
Task: Verify login returns proper session/mode data
```

**Cursor-3: Test Fixture Analysis**
```
@codebase Review E2E test login flow
Files: tests/e2e/fixtures/auth.fixture.ts
Task: Check if test properly waits for mode change
```

### 🟢 CONTINUE.DEV

**Task: Add TypeScript strict mode**
```
/edit Enable strict mode in tsconfig.json files
/edit Add Zod validation to auth endpoints
```

### 🟡 CLAUDE AGENTS (This Session)

**Agent-A: Auth Flow Debug**
- Read mode-store.ts and useAuth hook
- Trace login → mode change flow
- Apply fix

**Agent-B: Docker Rebuild**
- Rebuild web container with fixes
- Verify mode indicator visible

### 🔴 CONTEXT7

**Task: Fetch latest docs**
- Zustand state management patterns
- Playwright auth testing best practices

---

## Execution Order

```
Phase 1 (Parallel):
├── Cursor-1: Frontend investigation
├── Cursor-2: Backend investigation  
├── Claude-A: Mode store analysis
└── Context7: Fetch docs

Phase 2 (After findings):
├── Apply fix (highest confidence finding)
├── Cursor-3: Update test if needed
└── Continue.dev: Add strict types

Phase 3 (Verify):
├── Run Playwright tests
├── Claude-B: Docker rebuild
└── Push to GitHub
```

---

## Quick Commands

**For Cursor:**
```
@codebase Why doesn't login set mode to LIVE? Check mode-store.ts and use-auth.ts
```

**For Continue.dev:**
```
/edit services/web/src/stores/mode-store.ts - ensure setMode('LIVE') called after login
```

---

## Files to Investigate

| File | Purpose | Agent |
|------|---------|-------|
| `stores/mode-store.ts` | Zustand mode state | Cursor-1 |
| `hooks/use-auth.ts` | Auth hook | Cursor-1 |
| `routes/auth.ts` | Login endpoint | Cursor-2 |
| `fixtures/auth.fixture.ts` | Test helpers | Cursor-3 |
| `App.tsx` ModeInitializer | Mode logic | Claude-A |

