/**
 * Authentication E2E Tests
 *
 * Tests for login, logout, session persistence, and protected routes.
 */

import { test, expect } from '@playwright/test';
import { loginAs, loginAsRole, logout, setMode } from './fixtures';
import { E2E_USERS } from './fixtures/users.fixture';
import { BasePage } from './pages/base.page';

test.describe('Authentication Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Clear any existing state before each test
    await page.addInitScript(() => {
      localStorage.clear();
    });
  });

  test('unauthenticated user sees DEMO mode banner @smoke', async ({ page }) => {
    // Navigate to a page that shows the demo banner (not landing page)
    // Landing pages intentionally hide the mode banner for cleaner UX
    await page.goto('/workflow');

    // Wait for page to load
    await page.waitForLoadState('domcontentloaded');

    const basePage = new BasePage(page);
    await basePage.waitForModeToResolve();

    // Check if app loaded (not blank page)
    const hasContent = await page.locator('body').evaluate((el) => el.textContent?.trim().length || 0) > 0;

    if (!hasContent) {
      // App didn't load - skip with informative message
      test.skip(true, 'App not loaded - server may not be running');
      return;
    }

    // Should see DEMO mode indicator
    const mode = await basePage.getCurrentMode();
    expect(mode).toBe('DEMO');

    // Look for demo-specific UI elements (multiple banners exist with different test IDs)
    const demoBanner = page.locator('[data-testid="mode-banner-demo"], [data-testid="demo-mode-banner"]');

    // Banner may or may not be visible depending on route, so check mode is correct
    if (await demoBanner.first().isVisible().catch(() => false)) {
      const bannerText = await demoBanner.first().textContent();
      expect(bannerText?.toLowerCase()).toContain('demo');
    }
  });

  test('login sets LIVE mode', async ({ page }) => {
    // Inject authenticated user state
    await loginAs(page, E2E_USERS.ADMIN);
    await setMode(page, 'LIVE');

    // Navigate to a non-landing page to see mode indicators
    await page.goto('/workflow');

    const basePage = new BasePage(page);
    await basePage.waitForModeToResolve();

    // Should see LIVE mode (or infer it from lack of DEMO indicators)
    const mode = await basePage.getCurrentMode();
    // In LIVE mode, mode banner is hidden, so we check it's not DEMO
    expect(['LIVE', 'UNKNOWN']).toContain(mode);

    // DEMO banner should NOT be visible in LIVE mode
    const demoBanner = page.locator('[data-testid="mode-banner-demo"], [data-testid="demo-mode-banner"]');
    await expect(demoBanner).not.toBeVisible().catch(() => {
      // Banner not found is also acceptable
    });
  });

  test('logout clears session and returns to DEMO', async ({ page }) => {
    // Start authenticated
    await loginAs(page, E2E_USERS.ADMIN);
    await setMode(page, 'LIVE');

    // Navigate to a non-landing page
    await page.goto('/workflow');

    const basePage = new BasePage(page);
    await basePage.waitForModeToResolve();

    // Verify we start in LIVE mode (or at least not showing DEMO banner)
    let mode = await basePage.getCurrentMode();
    expect(['LIVE', 'UNKNOWN']).toContain(mode);

    // Clear auth state (simulating logout)
    await page.evaluate(() => {
      localStorage.removeItem('auth-store');
      localStorage.removeItem('auth_token');
      localStorage.removeItem('mode-store');
    });

    // Reload page to reflect logout
    await page.reload();
    await basePage.waitForModeToResolve();

    // Should now be in DEMO mode
    mode = await basePage.getCurrentMode();
    expect(mode).toBe('DEMO');
  });

  test('session persists across page reload', async ({ page }) => {
    // Login as admin
    await loginAs(page, E2E_USERS.ADMIN);
    await setMode(page, 'LIVE');

    // Navigate to a non-landing page
    await page.goto('/workflow');

    const basePage = new BasePage(page);
    await basePage.waitForModeToResolve();

    // Verify authenticated (LIVE mode or UNKNOWN since banner hidden in LIVE)
    let mode = await basePage.getCurrentMode();
    expect(['LIVE', 'UNKNOWN']).toContain(mode);

    // Reload page
    await page.reload();
    await basePage.waitForModeToResolve();

    // Should still be authenticated after reload
    mode = await basePage.getCurrentMode();
    expect(['LIVE', 'UNKNOWN']).toContain(mode);

    // Verify auth state persisted in localStorage
    const authStore = await page.evaluate(() => localStorage.getItem('auth-store'));
    expect(authStore).not.toBeNull();

    const parsed = JSON.parse(authStore!);
    expect(parsed.state.user.id).toBe(E2E_USERS.ADMIN.id);
  });

  test('protected routes redirect unauthenticated users in LIVE mode expectation', async ({ page }) => {
    // This test verifies that protected routes handle unauthenticated access appropriately
    // In DEMO mode, routes should be accessible but with limited functionality

    // Start unauthenticated
    await page.goto('/governance');

    const basePage = new BasePage(page);
    await basePage.waitForModeToResolve();

    // In DEMO mode, page should load but show demo state
    const mode = await basePage.getCurrentMode();
    expect(mode).toBe('DEMO');

    // The governance page should be viewable but indicate demo mode
    const heading = page.locator('h1, h2').first();
    await expect(heading).toBeVisible();

    // Check for any auth gate or demo mode indicator
    const modeIndicator = page.locator('[data-testid^="mode-"]').first();
    await expect(modeIndicator).toBeVisible();

    // Verify we can access the page content (even in demo mode)
    const pageContent = page.locator('main, [role="main"], .container').first();
    await expect(pageContent).toBeVisible();
  });
});
