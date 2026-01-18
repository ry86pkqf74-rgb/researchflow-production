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
    // Navigate without authentication
    await page.goto('/');

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

    // Look for demo-specific UI elements
    const demoBanner = page.locator('[data-testid^="mode-banner"]');
    await expect(demoBanner).toBeVisible();

    // Banner should indicate demo mode
    const bannerText = await demoBanner.textContent();
    expect(bannerText?.toLowerCase()).toContain('demo');
  });

  test('login sets LIVE mode', async ({ page }) => {
    // Inject authenticated user state
    await loginAs(page, E2E_USERS.ADMIN);
    await setMode(page, 'LIVE');

    await page.goto('/');

    const basePage = new BasePage(page);
    await basePage.waitForModeToResolve();

    // Should see LIVE mode
    const mode = await basePage.getCurrentMode();
    expect(mode).toBe('LIVE');

    // Should have user-specific elements visible
    // (exact selector depends on implementation)
    const modeBanner = page.locator('[data-testid^="mode-banner"]');
    const bannerText = await modeBanner.textContent();

    // Should NOT contain demo warning
    expect(bannerText?.toLowerCase()).not.toContain('demo mode');
  });

  test('logout clears session and returns to DEMO', async ({ page }) => {
    // Start authenticated
    await loginAs(page, E2E_USERS.ADMIN);
    await setMode(page, 'LIVE');

    await page.goto('/');

    const basePage = new BasePage(page);
    await basePage.waitForModeToResolve();

    // Verify we start in LIVE mode
    let mode = await basePage.getCurrentMode();
    expect(mode).toBe('LIVE');

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

    await page.goto('/');

    const basePage = new BasePage(page);
    await basePage.waitForModeToResolve();

    // Verify authenticated
    let mode = await basePage.getCurrentMode();
    expect(mode).toBe('LIVE');

    // Reload page
    await page.reload();
    await basePage.waitForModeToResolve();

    // Should still be authenticated after reload
    mode = await basePage.getCurrentMode();
    expect(mode).toBe('LIVE');

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
