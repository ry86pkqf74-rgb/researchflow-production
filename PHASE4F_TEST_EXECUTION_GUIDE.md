# PHASE 4F - TEST EXECUTION GUIDE

Quick reference guide for running Phase 4F E2E validation tests.

## Prerequisites

Ensure the following are installed and working:
- Node.js 20+
- npm 10+
- Playwright browsers (auto-installed)
- Running application (dev server on http://localhost:5173)

## Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Start Application (if not running)
```bash
npm run dev
# Application will be available at http://localhost:5173
```

### 3. Run All Tests
```bash
npx playwright test
```

## Specific Test Execution

### Run Individual Test Suites

**VAL-001: User Journey Tests**
```bash
npx playwright test tests/e2e/user-journey.spec.ts
```

**VAL-002: Run Lifecycle Tests**
```bash
npx playwright test tests/e2e/run-lifecycle.spec.ts
```

**VAL-003: Artifact Browser Tests**
```bash
npx playwright test tests/e2e/artifact-browser.spec.ts
```

**VAL-004: Governance Flow Tests**
```bash
npx playwright test tests/e2e/governance-flow.spec.ts
```

**VAL-005: Visual Regression Tests**
```bash
npm run test:visual
# or
npx playwright test tests/visual/key-screens.spec.ts
```

### Run Specific Tests

Filter by test name:
```bash
npx playwright test -g "should load landing page"
npx playwright test -g "VAL-001"
```

Run with specific project/browser:
```bash
npx playwright test --project chromium
npx playwright test --project firefox
```

## Advanced Options

### Headless Mode (Default)
```bash
npx playwright test --headed=false
```

### Headed Mode (See Browser)
```bash
npx playwright test --headed
```

### Debug Mode (Opens Inspector)
```bash
npx playwright test --debug
npx playwright test --debug tests/e2e/user-journey.spec.ts
```

### Single Test Isolation
```bash
npx playwright test tests/e2e/user-journey.spec.ts -g "should load landing"
```

### Retry Failed Tests
```bash
npx playwright test --retries 3
```

### Parallel Execution
```bash
npx playwright test --workers 4
```

### Sequential Execution
```bash
npx playwright test --workers 1
```

## Viewing Results

### HTML Report
After tests complete:
```bash
npx playwright show-report
```
Opens `playwright-report/index.html` in browser with full test results, screenshots, and videos.

### Console Output
Tests print results to console with:
- Test names and status (✓ PASS / ✗ FAIL)
- Duration for each test
- Failure details if applicable

## Visual Regression Testing

### Run Visual Tests Only
```bash
npm run test:visual
```

### Update Visual Baselines
When UI intentionally changes:
```bash
npm run test:visual:update
```
This regenerates baseline screenshots in `tests/visual/__screenshots__/`

### View Visual Differences
Check `playwright-report/` for:
- Baseline images
- Actual screenshots
- Diff highlights (pink areas show differences)

## Troubleshooting

### Tests Not Finding Application
```bash
# Set custom base URL
PLAYWRIGHT_BASE_URL=http://localhost:3000 npx playwright test
```

### Timeout Errors
```bash
# Increase timeout (in ms)
npx playwright test --timeout 180000
```

### Memory Issues
```bash
# Run with fewer workers
npx playwright test --workers 1
```

### Browser Not Installed
```bash
npx playwright install
npx playwright install chromium
```

### Clear Test Cache
```bash
rm -rf test-results/
rm -rf playwright-report/
npx playwright test
```

## CI/CD Integration

### GitHub Actions Example
```yaml
name: E2E Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: 20
      - run: npm ci
      - run: npm run build
      - run: npx playwright install --with-deps
      - run: npm run test:e2e
      - uses: actions/upload-artifact@v3
        if: always()
        with:
          name: playwright-report
          path: playwright-report/
```

## Test Configuration

### Playwright Config Location
`playwright.config.ts`

### Key Settings
- **testDir**: `./tests/e2e` (configurable)
- **timeout**: 120 seconds
- **retries**: 0 (local), 2 (CI)
- **workers**: Auto (local), 1 (CI)
- **baseURL**: `http://localhost:5173`

### Modify Configuration
Edit `playwright.config.ts` to change:
- Test timeout
- Retry behavior
- Browser options
- Screenshot/video settings

## Performance Monitoring

### Time Each Test
```bash
npx playwright test --reporter=list
```

### Detailed Timing Report
```bash
npx playwright test --reporter=json > results.json
```

## Best Practices

1. **Run Locally Before Committing**
   ```bash
   npm run test:e2e
   ```

2. **Update Visual Snapshots When UI Changes**
   ```bash
   npm run test:visual:update
   ```

3. **Use --headed Mode for Debugging**
   ```bash
   npx playwright test --headed --debug
   ```

4. **Check HTML Report for Full Context**
   ```bash
   npx playwright show-report
   ```

5. **Run Specific Test in Debug When Failing**
   ```bash
   npx playwright test -g "test name" --debug
   ```

## Useful Commands Summary

| Command | Purpose |
|---------|---------|
| `npx playwright test` | Run all tests |
| `npx playwright test --headed` | Run with browser visible |
| `npx playwright test --debug` | Run with debugger |
| `npx playwright test -g "pattern"` | Run tests matching pattern |
| `npx playwright show-report` | View HTML report |
| `npm run test:visual:update` | Update visual baselines |
| `npx playwright install` | Install browsers |
| `npm run test:e2e` | Run E2E tests (alias) |

## Test Files

### E2E Tests (42 tests total)
- `tests/e2e/user-journey.spec.ts` (11 tests)
- `tests/e2e/run-lifecycle.spec.ts` (9 tests)
- `tests/e2e/artifact-browser.spec.ts` (11 tests)
- `tests/e2e/governance-flow.spec.ts` (11 tests)

### Visual Tests (13 tests total)
- `tests/visual/key-screens.spec.ts` (13 tests)

### Test Utilities
- `tests/e2e/fixtures/auth.fixture.ts`
- `tests/e2e/fixtures/users.fixture.ts`
- `tests/e2e/pages/base.page.ts`
- `tests/e2e/pages/pipeline.page.ts`
- `tests/e2e/pages/governance.page.ts`

## Support & Documentation

### Full Documentation
See `PHASE4F_IMPLEMENTATION_SUMMARY.md` for:
- Detailed test descriptions
- Coverage metrics
- Design patterns
- Known limitations

### Test Naming Convention
All Phase 4F tests are tagged with:
- `VAL-001`: User Journey
- `VAL-002`: Run Lifecycle
- `VAL-003`: Artifact Browser
- `VAL-004`: Governance Flow
- `VAL-005`: Visual Regression

Filter by tag:
```bash
npx playwright test -g "VAL-001"
```

## Notes

- Tests use mocked API responses (no real backend required)
- Tests create isolated state (localStorage cleared between tests)
- Visual tests have 20% pixel difference tolerance
- Screenshots stored in `tests/visual/__screenshots__/`
- Test reports include trace recordings for debugging

---

**Last Updated**: January 28, 2026
**Version**: 1.0
