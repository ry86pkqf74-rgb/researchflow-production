# Visual Regression Testing

This directory contains Playwright-based visual regression tests for ResearchFlow UI components and pages.

## Quick Start

### 1. Run Visual Regression Tests

```bash
# Run all visual regression tests
npm run test:visual

# Update baseline screenshots (when intentional UI changes are made)
npm run test:visual:update

# Run specific test file
npx playwright test tests/visual/baseline.spec.ts

# Run with specific browser
npx playwright test tests/visual/baseline.spec.ts --project=chromium
```

### 2. Understand Test Results

When tests run, Playwright compares current screenshots against baseline images stored in `__screenshots__/`.

- **PASS**: Screenshot matches baseline within threshold (20% pixel difference)
- **FAIL**: Screenshot differs from baseline beyond threshold
- **NEW**: No baseline exists yet (first run)

### 3. Update Baselines

When UI changes are intentional:

```bash
# Update all baselines
npm run test:visual:update

# Update specific test file
npx playwright test tests/visual/baseline.spec.ts --update-snapshots

# Update specific test
npx playwright test tests/visual/baseline.spec.ts -g "login page should match baseline" --update-snapshots
```

## Test Coverage

### Pages Tested

1. **Login Page** (`/auth/login`)
   - Full page layout
   - Form elements
   - Error states

2. **Dashboard** (`/dashboard`)
   - Overview layout
   - Project cards
   - Empty state

3. **Governance Page** (`/governance`)
   - Policy enforcement panel
   - Mode indicator
   - RBAC matrix

4. **Manuscript Studio** (`/studio`)
   - Editor layout
   - Toolbar
   - Sidebar
   - Preview panel

### Responsive Design Tests

Tests include:
- **Mobile** (375x667) - iPhone-like view
- **Tablet** (768x1024) - iPad-like view
- **Desktop** (1280x720) - Default desktop view

### Theme Tests

- **Light Mode** (default)
- **Dark Mode** (when applicable)

## Configuration

### Visual Comparison Thresholds

Thresholds control sensitivity to pixel differences:

```typescript
{
  maxDiffPixels: 100,    // Allow up to 100 pixels of difference
  threshold: 0.2         // Allow up to 20% color difference per pixel
}
```

Adjust per test based on expected volatility:
- **Stable UI**: Lower threshold (0.1-0.15)
- **Dynamic content**: Higher threshold (0.2-0.3)

### Screenshot Size Limits

Playwright has built-in limits:
- **Max height**: 32,767 pixels
- **Max width**: 32,767 pixels
- Exceeding limits results in clipped screenshots

## Best Practices

### 1. Write Stable Tests

```typescript
test('element should match baseline', async ({ page }) => {
  await page.goto('/path');

  // Wait for all resources to load
  await page.waitForLoadState('networkidle');

  // Wait for animations to complete
  await page.waitForTimeout(500);

  // Wait for specific elements
  await page.waitForSelector('[data-testid="content"]', { timeout: 5000 });

  // Take screenshot
  await expect(element).toHaveScreenshot('name.png');
});
```

### 2. Handle Dynamic Content

```typescript
// Hide timestamps
await page.locator('[data-testid="timestamp"]').evaluate(el => {
  el.textContent = '2024-01-01 00:00:00';
});

// Hide user-specific data
await page.locator('[data-testid="username"]').evaluate(el => {
  el.textContent = '[USER]';
});

// Then take screenshot
await expect(page).toHaveScreenshot('page.png');
```

### 3. Use Test Fixtures

```typescript
test('with authenticated user', async ({ page }) => {
  // Use pre-configured auth state
  await page.context().addCookies([{
    name: 'auth_token',
    value: 'test-token',
    url: 'http://localhost:5173'
  }]);

  await page.goto('/dashboard');
  await expect(page).toHaveScreenshot('dashboard.png');
});
```

### 4. Organize Screenshots

Keep baseline screenshots organized:

```
tests/visual/
├── __screenshots__/
│   ├── baseline.spec.ts-chromium/
│   │   ├── login-page.png
│   │   ├── login-form.png
│   │   ├── login-error-state.png
│   │   ├── dashboard-overview.png
│   │   └── ...
│   └── [other test files]/
```

## Troubleshooting

### Screenshots Not Matching

**Issue**: Test fails with "visual diff detected"

**Solutions**:
1. Review the diff image (generated in test-results/)
2. Verify the UI change was intentional
3. Update baseline if intentional: `npm run test:visual:update`
4. Fix code if unintentional

### Missing Baselines

**Issue**: "No golden file found"

**Solutions**:
1. This is normal on first run or after adding new tests
2. Review the new screenshot in test-results/
3. Run: `npm run test:visual:update` to create baseline
4. Commit baseline images to git

### Flaky Tests

**Issue**: Same test passes/fails randomly

**Solutions**:
1. Add more `waitForLoadState()` calls
2. Increase `timeout` values
3. Use `page.waitForTimeout()` for animations
4. Isolate dynamic content (hide it before screenshot)
5. Run test multiple times: `--repeat 3`

### Screenshot Size Issues

**Issue**: Screenshot height exceeds limit or is clipped

**Solutions**:
1. Test smaller sections instead of full page
2. Use `clip` parameter to capture specific area:
   ```typescript
   await expect(page).toHaveScreenshot('section.png', {
     clip: { x: 0, y: 0, width: 1280, height: 2000 }
   });
   ```
3. Test responsive view (narrower viewport)

## CI/CD Integration

### GitHub Actions

Visual regression tests run automatically:

**On PRs:**
- Tests run against PR code
- Failures block merge
- Screenshots uploaded as artifacts

**On Main Branch Push:**
- Tests run as part of CI/CD
- Baselines can be updated
- Results included in test reports

### Reviewing Visual Diffs

1. Go to GitHub Actions workflow run
2. Check job logs for failures
3. Download "visual-baseline-screenshots" artifact
4. Compare images in visual diff viewer

### Updating Baselines in CI

```bash
# Local: Update baselines
npm run test:visual:update

# Commit changes
git add tests/visual/__screenshots__/
git commit -m "test: update visual regression baselines"
git push
```

## Advanced Topics

### Custom Visual Comparison

```typescript
// Compare only part of the page
const section = page.locator('[data-testid="section"]');
await expect(section).toHaveScreenshot('section.png', {
  maxDiffPixels: 50,
  threshold: 0.15,
});
```

### Inline Snapshots

```typescript
// For simple components
await expect(page.locator('button')).toHaveScreenshot({
  inline: true
});
```

### Mask Regions

```typescript
// Hide certain regions from comparison
await expect(page).toHaveScreenshot('page.png', {
  mask: [page.locator('[data-testid="live-data"]')]
});
```

## Performance Tips

- Run tests in parallel: `--workers=4`
- Use headed mode for debugging: `--headed`
- Generate trace for failed tests: `--trace on`
- Use specific project: `--project=chromium`

## Resources

- [Playwright Visual Comparisons](https://playwright.dev/docs/test-snapshots)
- [Best Practices](https://playwright.dev/docs/best-practices)
- [Screenshot API](https://playwright.dev/docs/api/class-page#page-screenshot)
- [Visual Diff Viewer](https://playwright.dev/docs/test-reporters)

## Maintenance

### Weekly Tasks

1. Review failed visual regression tests
2. Update baselines for intentional changes
3. Monitor screenshot size growth
4. Clean up old test artifacts

### Monthly Tasks

1. Review test coverage
2. Update thresholds if needed
3. Add tests for new features
4. Archive old test results

## Contributing

When adding new visual regression tests:

1. Create test in appropriate describe block
2. Use consistent naming: `[page]-[component]-[state].png`
3. Add comments explaining what's being tested
4. Run locally: `npm run test:visual:update`
5. Commit baseline screenshots
6. Submit PR with tests and baselines

## Support

For issues with visual regression testing:

1. Check Playwright documentation
2. Review test output in test-results/
3. Look at visual diff images
4. Check GitHub Actions logs
5. Run tests locally for debugging
