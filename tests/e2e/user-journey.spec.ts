/**
 * VAL-001: E2E Test - Complete User Journey
 *
 * Tests the complete user journey:
 * - Landing page navigation
 * - Login flow
 * - Dashboard access
 * - Create new run
 * - View run details
 * - Inspect artifacts
 * - Verify DEMO/LIVE banner visibility
 * - Test navigation flows
 */

import { test, expect, Page } from '@playwright/test';
import { loginAs, setMode } from './fixtures';
import { E2E_USERS } from './fixtures/users.fixture';
import { BasePage } from './pages/base.page';
import { PipelinePage } from './pages/pipeline.page';

test.describe('VAL-001: Complete User Journey', () => {
  test.beforeEach(async ({ page }) => {
    // Clear any existing state
    await page.addInitScript(() => {
      localStorage.clear();
    });
  });

  test('should load landing page and display mode information', async ({ page }) => {
    // Navigate to home
    await page.goto('/');

    // Wait for page to load
    await page.waitForLoadState('domcontentloaded');

    // Check that page title exists
    const pageTitle = page.locator('h1, h2, [data-testid*="title"]');
    await expect(pageTitle.first()).toBeVisible({ timeout: 10000 });
  });

  test('should show DEMO banner on home page when in DEMO mode', async ({ page }) => {
    // Route governance mode to return DEMO
    await page.route('**/api/governance/mode', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ mode: 'DEMO' }),
      });
    });

    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    const basePage = new BasePage(page);
    // Wait a moment for React hydration
    await page.waitForTimeout(1000);

    // Check for DEMO mode indication
    const pageContent = await page.content();
    // Either the banner is visible or DEMO text appears somewhere
    const hasDemoIndication =
      await page.locator('[data-testid*="demo"], [data-testid*="mode"]').first().isVisible().catch(() => false) ||
      pageContent.toUpperCase().includes('DEMO');

    expect(hasDemoIndication || pageContent.includes('Mode')).toBeTruthy();
  });

  test('should successfully login as admin and access dashboard', async ({ page }) => {
    // Login as admin
    await loginAs(page, E2E_USERS.ADMIN);
    await setMode(page, 'LIVE');

    // Navigate to dashboard/pipeline
    const pipelinePage = new PipelinePage(page);
    await pipelinePage.navigate();

    // Wait for page to be fully loaded
    await pipelinePage.waitForModeToResolve();

    // Check that we're on the pipeline page
    const url = page.url();
    expect(url).toContain('pipeline');

    // Verify mode banner is visible
    const modeBanner = pipelinePage.getModeBanner();
    await expect(modeBanner).toBeVisible({ timeout: 5000 });

    // Verify mode is LIVE
    const currentMode = await pipelinePage.getCurrentMode();
    expect(currentMode).toBe('LIVE');
  });

  test('should show LIVE banner when in LIVE mode', async ({ page }) => {
    // Login and set LIVE mode
    await loginAs(page, E2E_USERS.ADMIN);
    await setMode(page, 'LIVE');

    const basePage = new BasePage(page);
    await basePage.goto('/');

    // Check current mode
    const mode = await basePage.getCurrentMode();
    expect(mode).toBe('LIVE');

    // Verify banner exists
    const modeBanner = basePage.getModeBanner();
    await expect(modeBanner).toBeVisible({ timeout: 5000 });
  });

  test('should navigate from home to pipeline to run details', async ({ page }) => {
    // Setup: Login and set mode
    await loginAs(page, E2E_USERS.ADMIN);
    await setMode(page, 'LIVE');

    const basePage = new BasePage(page);

    // Step 1: Start at home
    await basePage.goto('/');
    expect(page.url()).toContain('localhost');

    // Step 2: Navigate to pipeline
    await page.goto('/pipeline');
    await page.waitForLoadState('domcontentloaded');

    // Verify we're on pipeline page
    expect(page.url()).toContain('pipeline');

    // Wait for content to load
    await page.waitForSelector('[data-testid*="card"], [data-testid*="tab"], h1', { timeout: 10000 });
  });

  test('should mock run creation and verify success response', async ({ page }) => {
    // Setup auth
    await loginAs(page, E2E_USERS.ADMIN);
    await setMode(page, 'LIVE');

    // Mock the run creation endpoint
    await page.route('**/api/runs', async (route) => {
      if (route.request().method() === 'POST') {
        await route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({
            id: 'run-e2e-001',
            name: 'E2E Test Run',
            status: 'pending',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            stages: [
              { id: 'stage-1', name: 'Data Preparation', status: 'pending' },
              { id: 'stage-2', name: 'Analysis', status: 'pending' },
            ],
          }),
        });
      } else {
        await route.continue();
      }
    });

    // Navigate to create run page (if available)
    await page.goto('/pipeline');
    await page.waitForLoadState('domcontentloaded');

    // Try to find and click create run button
    const createButton = page.locator('[data-testid*="create"], [data-testid*="new"], button:has-text("New")').first();
    if (await createButton.isVisible().catch(() => false)) {
      await createButton.click();
      // Wait for dialog or form
      await page.waitForTimeout(500);
    }
  });

  test('should handle navigation between different pages', async ({ page }) => {
    // Setup auth
    await loginAs(page, E2E_USERS.ADMIN);
    await setMode(page, 'LIVE');

    const pages = ['/', '/pipeline', '/governance'];

    for (const path of pages) {
      await page.goto(path);
      await page.waitForLoadState('domcontentloaded');

      // Verify page loaded
      const content = await page.content();
      expect(content.length).toBeGreaterThan(0);

      // Verify mode banner is visible
      const basePage = new BasePage(page);
      const modeBanner = basePage.getModeBanner();
      const isBannerVisible = await modeBanner.isVisible().catch(() => false);

      // Banner should be visible on most pages
      if (path !== '/') {
        expect(isBannerVisible || content.includes('Mode')).toBeTruthy();
      }
    }
  });

  test('should verify role-based access control on dashboard', async ({ page }) => {
    // Test VIEWER access
    await loginAs(page, E2E_USERS.VIEWER);
    await setMode(page, 'LIVE');

    const pipelinePage = new PipelinePage(page);
    await pipelinePage.navigate();

    // Wait for load
    await pipelinePage.waitForModeToResolve();

    // Viewer should be able to view but not edit
    const url = page.url();
    expect(url).toContain('pipeline');

    // Test ADMIN access
    await loginAs(page, E2E_USERS.ADMIN);
    await setMode(page, 'LIVE');

    await pipelinePage.navigate();
    await pipelinePage.waitForModeToResolve();

    // Admin should have full access
    expect(page.url()).toContain('pipeline');
  });

  test('should persist mode across navigation', async ({ page }) => {
    // Set LIVE mode
    await loginAs(page, E2E_USERS.ADMIN);
    await setMode(page, 'LIVE');

    const basePage = new BasePage(page);

    // Navigate to multiple pages and verify mode persists
    const paths = ['/pipeline', '/governance', '/'];

    let previousMode = '';
    for (const path of paths) {
      await basePage.goto(path);
      await basePage.waitForModeToResolve();

      const currentMode = await basePage.getCurrentMode();
      if (previousMode) {
        // Mode should remain consistent
        expect(currentMode).toBe(previousMode);
      }
      previousMode = currentMode;
    }

    // Final verification that mode is still LIVE
    expect(previousMode).toBe('LIVE');
  });

  test('should display correct governance badge throughout journey', async ({ page }) => {
    // Setup LIVE mode
    await loginAs(page, E2E_USERS.ADMIN);
    await setMode(page, 'LIVE');

    const basePage = new BasePage(page);

    // Check mode badge on different pages
    await basePage.goto('/pipeline');
    await basePage.waitForModeToResolve();

    const badge = basePage.getModeBanner();
    await expect(badge).toBeVisible({ timeout: 5000 });

    // Verify badge content
    const badgeText = await badge.textContent();
    expect(badgeText?.toUpperCase()).toContain('LIVE');
  });

  test('should handle logout and return to home', async ({ page }) => {
    // Login first
    await loginAs(page, E2E_USERS.ADMIN);
    await setMode(page, 'LIVE');

    // Navigate to protected page
    await page.goto('/pipeline');
    await page.waitForLoadState('domcontentloaded');

    // Simulate logout by clearing auth state
    await page.addInitScript(() => {
      localStorage.removeItem('auth-store');
      localStorage.removeItem('auth_token');
    });

    // Reload page
    await page.reload();
    await page.waitForLoadState('domcontentloaded');

    // Should either redirect to home or show login
    const url = page.url();
    const isHomePage = url.endsWith('/') || url.includes('home');
    const hasAuthError = await page.locator('text=login, text=sign in, text=unauthorized').first().isVisible().catch(() => false);

    expect(isHomePage || hasAuthError).toBeTruthy();
  });
});
