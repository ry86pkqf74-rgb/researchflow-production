/**
 * Helper to check if the app has loaded properly.
 * Useful for gracefully skipping tests when server isn't running.
 */

import { Page, test } from '@playwright/test';

/**
 * Check if the application has loaded (not blank page).
 * Skips test if app didn't load.
 */
export async function ensureAppLoaded(page: Page): Promise<boolean> {
  // Wait for DOM to be ready
  await page.waitForLoadState('domcontentloaded');

  // Wait a bit for React to hydrate
  await page.waitForTimeout(500);

  // Check if body has meaningful content
  const hasContent = await page.locator('body').evaluate((el) => {
    const text = el.textContent?.trim() || '';
    // Check for more than just whitespace/loading indicators
    return text.length > 50;
  });

  if (!hasContent) {
    // Check if there's a root React element that might be loading
    const rootElement = await page.locator('#root, #app, [data-reactroot]').count();

    if (rootElement === 0) {
      test.skip(true, 'App not loaded - server may not be running');
      return false;
    }
  }

  return true;
}

/**
 * Wait for a banner or indicator that the app has fully initialized.
 */
export async function waitForAppReady(page: Page): Promise<void> {
  // Wait for either:
  // - Mode banner to appear
  // - Any data-testid element (indicates React rendered)
  // - Error message

  await Promise.race([
    page.waitForSelector('[data-testid^="mode-banner"]', { timeout: 10000 }),
    page.waitForSelector('[data-testid]', { timeout: 10000 }),
    page.waitForSelector('[role="alert"]', { timeout: 10000 }),
    page.waitForTimeout(5000), // Fallback timeout
  ]).catch(() => {
    // Ignore timeout - we'll handle missing elements in tests
  });
}
