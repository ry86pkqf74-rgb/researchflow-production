# Testing Quick Reference Card

Fast lookup for common testing commands and workflows.

## Run Tests

| Test Type | Command | Time | Notes |
|-----------|---------|------|-------|
| All tests | `npm test` | 2-3m | Unit + Integration |
| Unit tests | `npm run test:unit` | 30s | Fast, no services needed |
| E2E tests | `npm run test:e2e` | 15m | Requires full stack |
| Visual tests | `npm run test:visual` | 20m | Requires full stack |
| Load tests | `npm run test:load` | 25m | Requires API running |
| Governance | `npm run test:rbac` | 5s | Security critical |

## Visual Regression

```bash
# Run tests
npm run test:visual

# Update baselines (after intentional UI changes)
npm run test:visual:update

# Specific test
npx playwright test tests/visual/baseline.spec.ts -g "login"

# View detailed report
open playwright-report/index.html

# Headed mode (see browser)
npx playwright test tests/visual/baseline.spec.ts --headed
```

## Load Testing

```bash
# Full load test (25 minutes)
npm run test:load

# Specific endpoint
npm run test:load:auth
npm run test:load:projects
npm run test:load:governance

# Workflow test
npm run test:load:workflow

# Stress test
npm run test:load:stress

# View reports
ls -la tests/load/reports/
cat tests/load/reports/report_*.json | jq '.metrics'
```

## Debugging

| Issue | Command | Result |
|-------|---------|--------|
| See browser during test | `npx playwright test --headed` | Visual debugging |
| Step through test | `npx playwright test --debug` | Interactive debugger |
| Trace failures | `npx playwright test --trace on` | Generate trace files |
| Watch mode (unit) | `npm run test:unit -- --watch` | Auto-rerun on changes |
| Single test (E2E) | `npx playwright test auth.spec.ts` | Run specific file |
| Match pattern | `npx playwright test -g "login"` | Run tests matching pattern |

## Git Workflow

### After UI Changes

```bash
# Update visual baselines
npm run test:visual:update

# Verify changes
git diff tests/visual/__screenshots__/

# Commit
git add tests/visual/__screenshots__/
git commit -m "test: update visual regression baselines"
git push
```

### Before Pushing

```bash
# Run critical tests
npm run test:unit          # Fast check
npm run test:rbac          # Security check
npm run test:e2e           # Full integration

# Or just rely on CI
git push  # GitHub Actions will run everything
```

## CI/CD Status

### View Workflow Results

```bash
# List all workflows
gh workflow list

# View latest run
gh workflow view ci.yml

# Watch real-time
gh workflow run ci.yml --watch
```

### Troubleshoot Failures

```bash
# Check PR status
gh pr checks

# View logs
gh run view <run-id> --log

# Download artifacts
gh run download <run-id> -n playwright-report
```

## File Locations

| Component | Location | Key Files |
|-----------|----------|-----------|
| Visual tests | `tests/visual/` | `baseline.spec.ts`, `__screenshots__/` |
| Load tests | `tests/load/` | `k6-config.js`, `k6-runner.sh` |
| Workflows | `.github/workflows/` | `visual-regression.yml`, `load-testing.yml` |
| Docs | Root + tests/ | `TESTING-GUIDE.md`, `README.md` files |

## Common Issues

| Problem | Solution |
|---------|----------|
| Visual tests fail locally but pass in CI | Clear node_modules, reinstall: `npm ci` |
| "No golden file found" | Normal on first run, update baselines: `npm run test:visual:update` |
| Load test errors | Check API health: `curl http://localhost:3001/health` |
| Tests timeout | Check Docker: `docker ps`, `docker compose up` |
| Flaky tests | Run multiple times: `--repeat 3` |

## Performance Targets

| Metric | Target | Status |
|--------|--------|--------|
| Auth p95 | < 200ms | ✓ Threshold set |
| Projects p95 | < 200ms | ✓ Threshold set |
| Governance p95 | < 300ms | ✓ Threshold set |
| Error rate | < 1% | ✓ Threshold set |
| Peak load | 100 VUs | ✓ Configured |

## Environment Setup

### Requirements

- Node.js 20+
- npm 10+
- Docker & Docker Compose
- Playwright browsers: `npx playwright install`
- K6: `brew install k6` (macOS) or package manager

### Quick Setup

```bash
npm install
npx playwright install
docker-compose up -d
npm run test:unit  # Verify setup works
```

## Useful Links

- [Playwright Docs](https://playwright.dev/)
- [K6 Docs](https://k6.io/docs/)
- [Testing Guide](../TESTING-GUIDE.md)
- [Visual Testing Guide](./visual/README.md)
- [Load Testing Guide](./load/README.md)

## Team Standards

**Visual Baselines:**
- Update when UI intentionally changes
- Commit baselines to git
- Review diffs in PR

**Load Testing:**
- Run before major releases
- Track performance trends
- Alert on regressions

**Test Coverage:**
- New features need tests
- Critical paths well covered
- Governance tests always pass
- Performance within thresholds

## Watch for These Checks

✅ Unit tests pass
✅ Governance tests pass
✅ Visual regression pass
✅ E2E tests pass
✅ No performance regressions
✅ Load test error rate < 1%

All green = Safe to merge!
