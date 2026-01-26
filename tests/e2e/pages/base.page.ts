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

    // Check for mode banner with specific test IDs
    const demoBanner = this.page.locator('[data-testid="mode-banner-demo"]');
    const liveBanner = this.page.locator('[data-testid="mode-banner-live"]');

    if (await demoBanner.isVisible().catch(() => false)) {
      return 'DEMO';
    }
    if (await liveBanner.isVisible().catch(() => false)) {
      return 'LIVE';
    }

    // Fallback: check for any banner with mode text
    const anyBanner = this.page.locator('[data-testid^="mode-banner"]');
    if (await anyBanner.isVisible().catch(() => false)) {
      const text = await anyBanner.textContent();
      if (text?.toUpperCase().includes('DEMO')) return 'DEMO';
      if (text?.toUpperCase().includes('LIVE')) return 'LIVE';
    }

    // Fallback: check page content for mode indicators
    const pageContent = await this.page.content();
    if (pageContent.includes('DEMO MODE') || pageContent.includes('demo mode')) {
      return 'DEMO';
    }
    if (pageContent.includes('LIVE MODE') || pageContent.includes('live mode')) {
      return 'LIVE';
    }

    // Check text-current-mode if it exists (governance page)
    const modeText = this.page.locator('[data-testid="text-current-mode"]');
    if (await modeText.isVisible().catch(() => false)) {
      const text = await modeText.textContent();
      if (text?.toUpperCase().includes('DEMO')) return 'DEMO';
      if (text?.toUpperCase().includes('LIVE')) return 'LIVE';
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
