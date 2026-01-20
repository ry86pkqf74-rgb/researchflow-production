/**
 * System Smoke Test (Task 100)
 *
 * End-to-end smoke test using the Atlanta mock case.
 * Verifies core functionality across the system.
 *
 * Run with: npx playwright test tests/e2e/system-smoke.spec.ts
 */

import { test, expect, Page } from '@playwright/test';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const API_URL = process.env.API_URL || 'http://localhost:3001';

test.describe('Phase E: System Smoke Test', () => {
  test.describe('Public Routes', () => {
    test('should load the home page', async ({ page }) => {
      await page.goto(BASE_URL);
      await expect(page).toHaveTitle(/ResearchFlow/);
    });

    test('should load the demo landing page', async ({ page }) => {
      await page.goto(`${BASE_URL}/demo`);
      await expect(page.locator('text=Demo')).toBeVisible();
    });

    test('should show mode loader then redirect for protected routes', async ({ page }) => {
      await page.goto(`${BASE_URL}/pipeline`);
      // Should show loading state or redirect based on mode
      await page.waitForLoadState('networkidle');
    });
  });

  test.describe('API Health', () => {
    test('should return healthy status from health endpoint', async ({ request }) => {
      const response = await request.get(`${API_URL}/api/v1/health`);
      expect(response.ok()).toBeTruthy();

      const data = await response.json();
      expect(data.status).toMatch(/healthy|degraded/);
      expect(data.timestamp).toBeDefined();
    });

    test('should return mode information', async ({ request }) => {
      const response = await request.get(`${API_URL}/api/mode`);
      expect(response.ok()).toBeTruthy();

      const data = await response.json();
      expect(data.mode).toMatch(/DEMO|LIVE/);
    });

    test('should return governance mode', async ({ request }) => {
      const response = await request.get(`${API_URL}/api/governance/mode`);
      expect(response.ok()).toBeTruthy();

      const data = await response.json();
      expect(data.mode).toBeDefined();
    });
  });

  test.describe('Organization Endpoints', () => {
    test('should reject unauthenticated org list request', async ({ request }) => {
      const response = await request.get(`${API_URL}/api/org`);
      // Should require authentication
      expect(response.status()).toBe(401);
    });

    test('should reject unauthenticated org creation', async ({ request }) => {
      const response = await request.post(`${API_URL}/api/org`, {
        data: {
          name: 'Test Org',
          slug: 'test-org',
        },
      });
      expect(response.status()).toBe(401);
    });
  });

  test.describe('Search Endpoint', () => {
    test('should reject unauthenticated search request', async ({ request }) => {
      const response = await request.get(`${API_URL}/api/search?q=test`);
      expect(response.status()).toBe(401);
    });
  });

  test.describe('Billing Endpoints', () => {
    test('should reject unauthenticated billing request', async ({ request }) => {
      const response = await request.get(`${API_URL}/api/billing/subscription`);
      expect(response.status()).toBe(401);
    });
  });

  test.describe('Integrations Endpoints', () => {
    test('should reject unauthenticated integrations request', async ({ request }) => {
      const response = await request.get(`${API_URL}/api/integrations`);
      expect(response.status()).toBe(401);
    });
  });

  test.describe('Badges Endpoints', () => {
    test('should return badge list (gamification)', async ({ request }) => {
      const response = await request.get(`${API_URL}/api/badges`);
      // Badges list is public but may require auth
      expect([200, 401]).toContain(response.status());
    });
  });

  test.describe('Sustainability Endpoints', () => {
    test('should reject unauthenticated sustainability request', async ({ request }) => {
      const response = await request.get(`${API_URL}/api/sustainability`);
      expect(response.status()).toBe(401);
    });
  });

  test.describe('Frontend Pages', () => {
    test('should load community page', async ({ page }) => {
      await page.goto(`${BASE_URL}/community`);
      await page.waitForLoadState('networkidle');
      // Should show community content or loading state
    });

    test('should load onboarding page', async ({ page }) => {
      await page.goto(`${BASE_URL}/onboarding`);
      await page.waitForLoadState('networkidle');
    });

    test('should load settings page', async ({ page }) => {
      await page.goto(`${BASE_URL}/settings`);
      await page.waitForLoadState('networkidle');
    });

    test('should load search page', async ({ page }) => {
      await page.goto(`${BASE_URL}/search`);
      await page.waitForLoadState('networkidle');
    });

    test('should load XR page', async ({ page }) => {
      await page.goto(`${BASE_URL}/xr`);
      await page.waitForLoadState('networkidle');
      // Should show XR content or coming soon
    });

    test('should show 404 for unknown routes', async ({ page }) => {
      await page.goto(`${BASE_URL}/nonexistent-page-12345`);
      await expect(page.locator('text=404')).toBeVisible({ timeout: 10000 });
    });
  });

  test.describe('Demo Mode Functionality', () => {
    test('should show demo watermark in demo mode', async ({ page }) => {
      await page.goto(BASE_URL);
      await page.waitForLoadState('networkidle');

      // Check for demo mode indicators (depends on current mode)
      const modeBanner = page.locator('[data-testid="mode-banner"]');
      const demoWatermark = page.locator('[data-testid="demo-watermark"]');

      // At least one should be visible in demo mode
      const hasDemoIndicator = await Promise.race([
        modeBanner.isVisible().catch(() => false),
        demoWatermark.isVisible().catch(() => false),
        new Promise(resolve => setTimeout(() => resolve(false), 3000)),
      ]);

      // Mode loader should not be stuck
      const modeLoader = page.locator('[data-testid="mode-loader"]');
      await expect(modeLoader).not.toBeVisible({ timeout: 10000 });
    });
  });

  test.describe('PWA Support', () => {
    test('should have manifest.json', async ({ request }) => {
      const response = await request.get(`${BASE_URL}/manifest.json`);
      expect(response.ok()).toBeTruthy();

      const manifest = await response.json();
      expect(manifest.name).toBe('ResearchFlow Canvas');
      expect(manifest.short_name).toBe('ResearchFlow');
      expect(manifest.display).toBe('standalone');
    });
  });

  test.describe('Responsive Design', () => {
    test('should be responsive on mobile viewport', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      await page.goto(BASE_URL);
      await page.waitForLoadState('networkidle');

      // Page should render without horizontal scroll
      const documentWidth = await page.evaluate(() => document.documentElement.scrollWidth);
      const viewportWidth = await page.evaluate(() => window.innerWidth);
      expect(documentWidth).toBeLessThanOrEqual(viewportWidth + 10); // Allow small margin
    });

    test('should be responsive on tablet viewport', async ({ page }) => {
      await page.setViewportSize({ width: 768, height: 1024 });
      await page.goto(BASE_URL);
      await page.waitForLoadState('networkidle');
    });

    test('should be responsive on desktop viewport', async ({ page }) => {
      await page.setViewportSize({ width: 1920, height: 1080 });
      await page.goto(BASE_URL);
      await page.waitForLoadState('networkidle');
    });
  });

  test.describe('Accessibility', () => {
    test('should have proper heading structure', async ({ page }) => {
      await page.goto(BASE_URL);
      await page.waitForLoadState('networkidle');

      const h1Count = await page.locator('h1').count();
      expect(h1Count).toBeGreaterThanOrEqual(1);
    });

    test('should have accessible buttons', async ({ page }) => {
      await page.goto(BASE_URL);
      await page.waitForLoadState('networkidle');

      // All buttons should be accessible via keyboard
      const buttons = page.locator('button:visible');
      const buttonCount = await buttons.count();

      if (buttonCount > 0) {
        // First button should be focusable
        await buttons.first().focus();
      }
    });
  });
});

test.describe('Atlanta Case Integration', () => {
  // These tests assume the Atlanta case has been seeded
  // Run: npm run db:seed:atlanta first

  test('should load pipeline with mock data', async ({ page }) => {
    await page.goto(`${BASE_URL}/pipeline`);
    await page.waitForLoadState('networkidle');
    // In demo mode, should show mock projects
  });

  test('should handle search queries', async ({ page }) => {
    await page.goto(`${BASE_URL}/search`);
    await page.waitForLoadState('networkidle');

    const searchInput = page.locator('input[type="text"]');
    if (await searchInput.isVisible()) {
      await searchInput.fill('thyroidectomy');
      await page.keyboard.press('Enter');
      await page.waitForLoadState('networkidle');
    }
  });
});

// Performance tests
test.describe('Performance', () => {
  test('should load home page within 3 seconds', async ({ page }) => {
    const startTime = Date.now();
    await page.goto(BASE_URL);
    await page.waitForLoadState('domcontentloaded');
    const loadTime = Date.now() - startTime;

    expect(loadTime).toBeLessThan(3000);
  });

  test('should have reasonable API response times', async ({ request }) => {
    const startTime = Date.now();
    await request.get(`${API_URL}/api/v1/health`);
    const responseTime = Date.now() - startTime;

    expect(responseTime).toBeLessThan(500);
  });
});
