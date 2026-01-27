/**
 * Base Page Object Model
 *
 * Common functionality shared across all page objects.
 */

import { Page, Locator } from '@playwright/test';

export class BasePage {
  readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  /**
   * Navigate to a URL path.
   */
  async goto(path: string = '/'): Promise<void> {
    await this.page.goto(path);
  }

  /**
   * Wait for the mode banner to resolve (loading state to disappear).
   */
  async waitForModeToResolve(): Promise<void> {
    // Wait for any loading indicators to disappear
    const loader = this.page.locator('[data-testid="mode-loader"]');
    await loader.waitFor({ state: 'hidden', timeout: 10000 }).catch(() => {
      // Loader may not exist, which is fine
    });
  }

  /**
   * Get the current governance mode from the UI.
   */
  async getCurrentMode(): Promise<'DEMO' | 'LIVE' | 'UNKNOWN'> {
    await this.waitForModeToResolve();

    // Wait for React to hydrate and mode to initialize
    await this.page.waitForTimeout(1000);

    // Check for mode banner with specific test IDs (multiple banner components exist)
    const demoBannerSelectors = [
      '[data-testid="mode-banner-demo"]',
      '[data-testid="demo-mode-banner"]',
      '[data-testid="governance-badge-demo"]',
    ];
    const liveBannerSelectors = [
      '[data-testid="mode-banner-live"]',
      '[data-testid="live-mode-banner"]',
      '[data-testid="governance-badge-live"]',
    ];

    for (const selector of demoBannerSelectors) {
      if (await this.page.locator(selector).isVisible().catch(() => false)) {
        return 'DEMO';
      }
    }
    for (const selector of liveBannerSelectors) {
      if (await this.page.locator(selector).isVisible().catch(() => false)) {
        return 'LIVE';
      }
    }

    // Fallback: check for any banner with mode text
    const anyBanner = this.page.locator('[data-testid^="mode-banner"], [data-testid$="-mode-banner"]');
    if (await anyBanner.isVisible().catch(() => false)) {
      const text = await anyBanner.textContent();
      if (text?.toUpperCase().includes('DEMO')) return 'DEMO';
      if (text?.toUpperCase().includes('LIVE')) return 'LIVE';
    }

    // Fallback: check page content for mode indicators
    const pageContent = await this.page.content();
    if (pageContent.includes('DEMO MODE') || pageContent.includes('demo mode') || pageContent.includes('Demo Mode')) {
      return 'DEMO';
    }
    if (pageContent.includes('LIVE MODE') || pageContent.includes('live mode') || pageContent.includes('Live Mode')) {
      return 'LIVE';
    }

    // Check text-current-mode if it exists (governance page)
    const modeText = this.page.locator('[data-testid="text-current-mode"]');
    if (await modeText.isVisible().catch(() => false)) {
      const text = await modeText.textContent();
      if (text?.toUpperCase().includes('DEMO')) return 'DEMO';
      if (text?.toUpperCase().includes('LIVE')) return 'LIVE';
    }

    // On landing pages, default to DEMO if no explicit LIVE indicator
    // (landing pages may not show mode banner but are always DEMO for unauthenticated users)
    const isLandingPage = await this.page.url().then(url => {
      const path = new URL(url).pathname;
      return ['/', '/landing', '/demo', '/login', '/register'].includes(path);
    });
    if (isLandingPage) {
      return 'DEMO';
    }

    return 'UNKNOWN';
  }

  /**
   * Check if the user is authenticated by looking for auth indicators.
   */
  async isAuthenticated(): Promise<boolean> {
    // Look for user-specific UI elements that only appear when logged in
    const userMenu = this.page.locator('[data-testid="user-menu"]');
    const logoutButton = this.page.locator('[data-testid="button-logout"]');

    return (
      (await userMenu.isVisible().catch(() => false)) ||
      (await logoutButton.isVisible().catch(() => false))
    );
  }

  /**
   * Click the logout button if visible.
   */
  async clickLogout(): Promise<void> {
    const logoutButton = this.page.locator('[data-testid="button-logout"]');
    if (await logoutButton.isVisible()) {
      await logoutButton.click();
    }
  }

  /**
   * Get the mode banner element.
   */
  getModeBanner(): Locator {
    return this.page.locator('[data-testid^="mode-banner"]');
  }

  /**
   * Check if an element with a specific data-testid exists and is visible.
   */
  async isElementVisible(testId: string): Promise<boolean> {
    const element = this.page.locator(`[data-testid="${testId}"]`);
    return element.isVisible().catch(() => false);
  }

  /**
   * Get an element by data-testid.
   */
  getByTestId(testId: string): Locator {
    return this.page.locator(`[data-testid="${testId}"]`);
  }

  /**
   * Wait for navigation to complete.
   */
  async waitForNavigation(): Promise<void> {
    await this.page.waitForLoadState('networkidle');
  }
}
