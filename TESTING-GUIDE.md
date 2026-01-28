# ResearchFlow Testing Guide

Complete guide to testing infrastructure and best practices for ResearchFlow.

## Testing Overview

ResearchFlow includes multiple layers of automated testing:

| Test Type | Framework | Purpose | Run Time | Location |
|-----------|-----------|---------|----------|----------|
| Unit | Vitest | Test individual functions/components | 30s | `tests/unit/` |
| Integration | Vitest | Test components together | 2m | `tests/integration/` |
| E2E | Playwright | Test full user journeys | 15m | `tests/e2e/` |
| Visual Regression | Playwright | Catch UI changes | 20m | `tests/visual/` |
| Load Testing | K6 | Performance under load | 25m | `tests/load/` |
| Governance | Vitest | Security/compliance | 5m | `tests/governance/` |

## Quick Commands

```bash
# Run all tests
npm test

# Unit tests only
npm run test:unit

# Integration tests
npm run test:integration

# E2E tests (full app)
npm run test:e2e

# Visual regression tests
npm run test:visual

# Load testing
npm run test:load

# Governance tests
npm run test:rbac
npm run test:phi
npm run test:fail-closed
npm run test:mode-enforcement
npm run test:invariants

# Coverage report
npm run test:coverage

# Type checking
npm run type-check

# Linting
npm run lint
npm run lint:fix

# Formatting
npm run format
npm run format:check
```

## Test Environment Setup

### Local Development

```bash
# Install dependencies
npm install

# Install Playwright browsers
npx playwright install

# Install K6
brew install k6  # macOS
# or your package manager

# Start services
docker-compose up

# Run tests
npm run test:e2e
npm run test:visual
npm run test:load
```

### CI/CD Pipeline

Tests run automatically on:
- Push to `main` or `develop`
- Pull requests to `main`
- Manual workflow dispatch

**Workflows:**
- `ci.yml` - Unit/integration/governance tests
- `e2e-tests.yml` - End-to-end tests
- `visual-regression.yml` - Visual regression tests
- `load-testing.yml` - Load tests (main only)

## Detailed Test Guides

### Unit Tests

**Location:** `tests/unit/`

**Framework:** Vitest

**Run:**
```bash
npm run test:unit
npm run test:unit -- --watch
npm run test:unit -- tests/unit/auth.test.ts
```

**Example:**
```typescript
import { describe, it, expect } from 'vitest';
import { validateEmail } from '@/lib/validators';

describe('validateEmail', () => {
  it('should validate correct email', () => {
    expect(validateEmail('user@example.com')).toBe(true);
  });

  it('should reject invalid email', () => {
    expect(validateEmail('invalid')).toBe(false);
  });
});
```

### Integration Tests

**Location:** `tests/integration/`

**Framework:** Vitest with mocked services

**Run:**
```bash
npm run test:integration
npm run test:integration -- --watch
```

**Example:**
```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { AuthService } from '@/services/auth';
import { mockDatabase } from '@/__mocks__/database';

describe('AuthService', () => {
  let authService: AuthService;

  beforeEach(() => {
    authService = new AuthService(mockDatabase);
  });

  it('should authenticate user', async () => {
    const token = await authService.login('user@example.com', 'password');
    expect(token).toBeDefined();
  });
});
```

### E2E Tests

**Location:** `tests/e2e/`

**Framework:** Playwright

**Run:**
```bash
npm run test:e2e
npm run test:e2e -- --headed      # Show browser
npm run test:e2e -- --debug       # Debug mode
npx playwright test tests/e2e/auth.spec.ts
```

**Example:**
```typescript
import { test, expect } from '@playwright/test';

test.describe('Login Page', () => {
  test('user can login', async ({ page }) => {
    await page.goto('/auth/login');

    await page.fill('input[name="email"]', 'user@example.com');
    await page.fill('input[name="password"]', 'password');
    await page.click('button[type="submit"]');

    await expect(page).toHaveURL('/dashboard');
  });
});
```

### Visual Regression Tests

**Location:** `tests/visual/`

**Framework:** Playwright with visual snapshots

**Run:**
```bash
# Run tests
npm run test:visual

# Update baselines
npm run test:visual:update

# Run specific test
npx playwright test tests/visual/baseline.spec.ts -g "login"
```

**Example:**
```typescript
import { test, expect } from '@playwright/test';

test('login page should match baseline', async ({ page }) => {
  await page.goto('/auth/login');
  await page.waitForLoadState('networkidle');

  await expect(page).toHaveScreenshot('login-page.png', {
    maxDiffPixels: 100,
    threshold: 0.2,
  });
});
```

**When to update baselines:**
```bash
# After intentional UI changes
npm run test:visual:update

# Commit the changes
git add tests/visual/__screenshots__/
git commit -m "test: update visual regression baselines"
```

### Load Testing

**Location:** `tests/load/`

**Framework:** K6

**Run:**
```bash
# Full load test
npm run test:load

# Specific endpoint
npm run test:load:auth
npm run test:load:projects
npm run test:load:governance

# Realistic workflow
npm run test:load:workflow

# Stress test
npm run test:load:stress

# Or use the runner directly
./tests/load/k6-runner.sh full
./tests/load/k6-runner.sh auth --url=http://api.example.com
```

**Configuration:**
- Target: 100 concurrent users
- P95 latency: < 200ms
- Error rate: < 1%
- Duration: 25 minutes

**Reading results:**
```
scenarios: 1 scenario, 100 max VUs, 25m30s max duration
✓ status is correct
✓ response time < 500ms

http_req_duration: avg=156ms p(95)=289ms
errors: 0.5% ✓ (rate<0.01)
```

### Governance Tests

**Location:** `tests/governance/`

**Framework:** Vitest

**Critical Security Tests:**

```bash
# RBAC enforcement
npm run test:rbac

# PHI scanner
npm run test:phi

# Fail-closed enforcement
npm run test:fail-closed

# Mode enforcement
npm run test:mode-enforcement

# App mode invariants
npm run test:invariants
```

These tests verify:
- Role-based access control
- Personal health information (PHI) redaction
- Fail-closed security defaults
- Governance mode enforcement
- System invariant compliance

## Testing Best Practices

### 1. Write Descriptive Tests

```typescript
// ❌ Bad
test('login', async ({ page }) => {
  // ...
});

// ✅ Good
test('user should be redirected to dashboard after successful login', async ({ page }) => {
  // ...
});
```

### 2. Use Proper Waits

```typescript
// ❌ Bad - Arbitrary wait
await page.waitForTimeout(5000);

// ✅ Good - Wait for specific conditions
await page.waitForLoadState('networkidle');
await page.waitForSelector('[data-testid="dashboard"]');
await expect(page.locator('button')).toBeEnabled();
```

### 3. Isolate Test Data

```typescript
test.beforeEach(async ({ page }) => {
  // Setup test data
  await setupTestUser();
});

test.afterEach(async () => {
  // Cleanup
  await cleanupTestUser();
});
```

### 4. Use Page Object Model

```typescript
// page-objects/LoginPage.ts
export class LoginPage {
  constructor(private page: Page) {}

  async goto() {
    await this.page.goto('/auth/login');
  }

  async login(email: string, password: string) {
    await this.page.fill('input[name="email"]', email);
    await this.page.fill('input[name="password"]', password);
    await this.page.click('button[type="submit"]');
  }
}

// test
test('login', async ({ page }) => {
  const loginPage = new LoginPage(page);
  await loginPage.goto();
  await loginPage.login('user@example.com', 'password');
});
```

### 5. Handle Flaky Tests

```typescript
// Retry specific tests
test.describe('Flaky Feature', () => {
  test.describe.configure({ retries: 3 });

  test('should work', async ({ page }) => {
    // ...
  });
});

// Or retry single test
test('should work', async ({ page }) => {
  test.retry(3);
  // ...
});
```

### 6. Mock External Services

```typescript
test.beforeEach(async ({ page }) => {
  // Mock API response
  await page.route('**/api/projects', route => {
    route.abort('blockedclient');
  });

  // Or mock with response
  await page.route('**/api/projects', route => {
    route.continue({
      response: {
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ projects: [] })
      }
    });
  });
});
```

## Test Organization

### Directory Structure

```
tests/
├── unit/                    # Unit tests
│   ├── lib/
│   ├── utils/
│   └── services/
├── integration/             # Integration tests
│   ├── auth.test.ts
│   └── api.test.ts
├── e2e/                     # End-to-end tests
│   ├── auth.spec.ts
│   ├── critical-journeys.spec.ts
│   ├── pages/              # Page objects
│   └── fixtures/           # Test data
├── visual/                  # Visual regression tests
│   ├── baseline.spec.ts
│   ├── __screenshots__/    # Baseline images
│   └── README.md
├── load/                    # Load testing
│   ├── k6-config.js
│   ├── k6-runner.sh
│   ├── reports/
│   └── README.md
├── governance/              # Security tests
│   ├── rbac.test.ts
│   ├── phi-scanner.test.ts
│   └── fail-closed.test.ts
├── fixtures/                # Shared test data
└── utils/                   # Test utilities
```

## Performance Optimization

### Test Execution Time

**Target Times:**
- Unit tests: < 1 minute
- Integration tests: < 2 minutes
- E2E tests: < 15 minutes
- Visual tests: < 20 minutes
- Load tests: 25 minutes (production only)

**Optimization Tips:**
```bash
# Run tests in parallel
npm run test:unit -- --threads=4

# Run specific tests to avoid full suite
npm run test:e2e -- --grep "critical-journeys"

# Use dedicated test database
DATABASE_URL=postgresql://ros:ros@localhost:5432/ros_test npm run test:integration
```

## Debugging Tests

### Debug E2E Tests

```bash
# Run in headed mode
npx playwright test --headed

# Debug mode (step through)
npx playwright test --debug

# Inspector mode
PWDEBUG=1 npx playwright test

# Generate trace
npx playwright test --trace on
```

### Debug in VS Code

Add to `.vscode/launch.json`:

```json
{
  "type": "node",
  "request": "launch",
  "name": "Playwright Debug",
  "runtimeExecutable": "${workspaceFolder}/node_modules/.bin/playwright",
  "runtimeArgs": ["test", "--debug"],
  "console": "integratedTerminal"
}
```

### Debug Load Tests

```bash
# Verbose output
./tests/load/k6-runner.sh full -v

# Check logs
cat tests/load/reports/output_*.log

# Analyze JSON report
jq '.metrics | keys' tests/load/reports/report_*.json
```

## CI/CD Pipeline

### GitHub Actions Workflows

**ci.yml** (Every push/PR)
- TypeCheck
- Unit tests
- Governance tests
- Security audit
- Build

**e2e-tests.yml** (Every push/PR)
- Full E2E test suite
- Screenshots on failure
- HTML report

**visual-regression.yml** (Every push/PR)
- Visual regression tests
- Screenshot comparison
- PR comment with results

**load-testing.yml** (Main branch only)
- Full load test (25m)
- Endpoint-specific tests
- Performance monitoring

### Artifact Collection

Tests produce artifacts:
- Coverage reports
- HTML reports
- Screenshots
- Videos (on failure)
- Traces (on failure)

Access in GitHub Actions:
1. Go to workflow run
2. Scroll to "Artifacts"
3. Download reports

## Maintenance

### Regular Tasks

**Daily:**
- Monitor CI/CD failures
- Fix flaky tests
- Update test data

**Weekly:**
- Review test coverage
- Update baselines if needed
- Analyze performance trends

**Monthly:**
- Review test strategy
- Update load test scenarios
- Clean up old artifacts
- Archive test reports

### Adding New Tests

1. **Choose test type** based on what you're testing
2. **Write test** following conventions
3. **Run locally** to verify it works
4. **Commit** with clear message
5. **Monitor CI** to ensure it passes
6. **Document** any special setup

## Troubleshooting

### Tests Fail Locally but Pass in CI

1. Check environment variables
2. Verify database state
3. Clear cache: `rm -rf node_modules && npm install`
4. Check Node.js version: `node --version` (should be 20+)

### Flaky Tests

1. Add more specific waits
2. Isolate test data
3. Increase timeouts
4. Mock external services
5. Run test multiple times: `--repeat 3`

### Performance Issues

1. Run subset of tests: `--grep "pattern"`
2. Parallel execution: `--workers=4`
3. Skip slow tests: `.skip()` for debugging
4. Profile with traces: `--trace on`

## Resources

- [Vitest Documentation](https://vitest.dev/)
- [Playwright Documentation](https://playwright.dev/)
- [K6 Documentation](https://k6.io/docs/)
- [Testing Library](https://testing-library.com/)
- [Testing Best Practices](https://github.com/goldbergyoni/javascript-testing-best-practices)

## Support

For testing issues:
1. Check this guide
2. Review test output/logs
3. Consult framework documentation
4. Check GitHub Issues
5. Ask team members
