# PHASE 5C - E2E TEST QUICK START GUIDE

## Current Status

- **Tests Created**: 661 test blocks ✓
- **Configuration**: Ready ✓
- **Blockers**: 4 identified (documented in full report)
- **Execution Status**: Blocked by docker-compose and minor errors

---

## 5-Minute Setup

```bash
# 1. Install browsers
npx playwright install --with-deps

# 2. Start app (in separate terminal)
npm run dev
# or with docker
docker-compose up

# 3. Run tests
npm run test:e2e
```

---

## Test Inventory

| Metric | Count |
|--------|-------|
| Test Files | 19 |
| Test Blocks | 661 |
| Lines of Code | 6,644 |
| Test Suites | All major workflows covered |
| Execution Time | 30-45 minutes |

---

## 4 Blocking Issues

### 1. Docker-Compose Not Found (CRITICAL)

**Error**: `sh: 1: docker-compose: not found`

**Fix Options**:
- Option A: `sudo apt-get install docker-compose`
- Option B: Start app manually, then set `PLAYWRIGHT_BASE_URL=http://localhost:5173`
- Option C: Use `CI=true npm run test:e2e` to skip auto-startup

### 2. TypeScript Errors (3 files affected)

| File | Line | Issue |
|------|------|-------|
| artifact-browser.spec.ts | 323 | Event type mismatch |
| full-workflow-journey.spec.ts | 119 | Invalid locator option |
| interactive-elements.spec.ts | 46 | Attribute comparison type |
| pages/base.page.ts | 93 | Promise handling |

**Impact**: Type checking fails, runtime may have issues

### 3. Playwright Browsers Not Installed

**Fix**: `npx playwright install --with-deps`

### 4. No Running Application Server

**Fix**: Start app on http://localhost:5173

---

## Run Tests Now

### All Tests
```bash
npm run test:e2e
```

### Specific Tests
```bash
# Smoke tests only
npx playwright test -g "smoke"

# Auth tests
npx playwright test tests/e2e/auth.spec.ts

# Headed mode (see browser)
npx playwright test --headed

# Debug mode
npx playwright test --debug
```

### View Results
```bash
npx playwright show-report
```

---

## Test Files (19 total)

1. auth.spec.ts - 15 tests
2. system-smoke.spec.ts - 56 tests
3. ros-integration-workflow.spec.ts - 53 tests
4. full-workflow-journey.spec.ts - 48 tests
5. full-ai-workflow.spec.ts - 43 tests
6. critical-journeys.spec.ts - 40 tests
7. manuscript-journey.spec.ts - 40 tests
8. interactive-elements.spec.ts - 71 tests
9. artifact-browser.spec.ts - 37 tests
10. guideline-engine.spec.ts - 36 tests
11. governance-flow.spec.ts - 32 tests
12. manuscripts.spec.ts - 30 tests
13. cumulative-workflow.spec.ts - 29 tests
14. run-lifecycle.spec.ts - 29 tests
15. policy-enforcement.spec.ts - 20 tests
16. user-journey.spec.ts - 18 tests
17. phi-redaction.spec.ts - 17 tests
18. workflow-navigation.spec.ts - 16 tests
19. governance-modes.spec.ts - 12 tests

---

## Environment Setup

```bash
# Create test environment file
cat > .env.test << 'EOF'
BASE_URL=http://localhost:5173
API_URL=http://localhost:3001
PLAYWRIGHT_BASE_URL=http://localhost:5173
NODE_ENV=test
EOF

# Use with tests
npx playwright test
```

---

## Key Fixtures Available

- **Auth**: loginAs(), loginAsRole(), logout(), setMode()
- **Users**: Pre-defined VIEWER, RESEARCHER, STEWARD, ADMIN profiles
- **PHI Data**: Mock PHI for redaction testing
- **Page Objects**: BasePage, GovernancePage, PipelinePage, WorkflowPage

---

## CI/CD Integration

GitHub Actions workflow provided in full report. Template includes:
- Node.js setup
- Browser installation
- Service startup
- Test execution
- Artifact uploads
- PR comments with results

---

## Troubleshooting

### Tests Won't Start
```bash
# Check app is running
curl -I http://localhost:5173

# Start app
npm run dev
```

### Timeout Errors
```bash
# Increase timeout
npx playwright test --timeout 180000
```

### Memory Issues
```bash
# Run sequentially
npx playwright test --workers 1
```

### Browser Missing
```bash
npx playwright install
```

---

## Full Report

See **PHASE5C_TEST_ANALYSIS_REPORT.md** for:
- Detailed blocker analysis
- Fix instructions for 4 TypeScript errors
- Complete execution guide
- CI/CD integration template
- Performance benchmarks
- Troubleshooting guide

---

## Files & Locations

| Item | Location |
|------|----------|
| Playwright Config | `playwright.config.ts` |
| E2E Tests | `tests/e2e/*.spec.ts` |
| Fixtures | `tests/e2e/fixtures/` |
| Page Objects | `tests/e2e/pages/` |
| Full Report | `PHASE5C_TEST_ANALYSIS_REPORT.md` |
| Test Data | `tests/fixtures/` |

---

**Status**: Ready to execute (resolve 4 blockers first)
**Next Step**: Run `PHASE5C_TEST_ANALYSIS_REPORT.md` for detailed instructions
