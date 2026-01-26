/**
 * E2E Authentication Fixtures
 *
 * Provides helpers for injecting authentication state into Playwright tests.
 * Uses localStorage injection to set Zustand auth-store state.
 */

import { test as base, Page } from '@playwright/test';
import { E2EUser, E2E_USERS } from './users.fixture';

/**
 * Zustand auth-store state structure.
 * Matches apps/web/src/stores/auth-store.ts
 */
interface AuthStoreState {
  state: {
    user: E2EUser | null;
    token: string | null;
  };
  version: number;
}

/**
 * Zustand mode-store state structure.
 * Matches apps/web/src/stores/mode-store.ts
 */
interface ModeStoreState {
  state: {
    mode: 'DEMO' | 'LIVE';
  };
  version: number;
}

/**
 * Inject authenticated user state into localStorage before page load.
 * This simulates a logged-in user without needing to go through login flow.
 */
export async function loginAs(page: Page, user: E2EUser): Promise<void> {
  const authState: AuthStoreState = {
    state: {
      user,
      token: `e2e-test-token-${user.id}`,
    },
    version: 0,
  };

  await page.addInitScript((state) => {
    localStorage.setItem('auth-store', JSON.stringify(state));
    localStorage.setItem('auth_token', state.state.token);
  }, authState);
}

/**
 * Inject a specific governance mode into localStorage.
 */
export async function setMode(page: Page, mode: 'DEMO' | 'LIVE'): Promise<void> {
  const modeState: ModeStoreState = {
    state: { mode },
    version: 0,
  };

  await page.addInitScript((state) => {
    localStorage.setItem('mode-store', JSON.stringify(state));
  }, modeState);
}

/**
 * Clear all authentication state from localStorage.
 */
export async function logout(page: Page): Promise<void> {
  await page.addInitScript(() => {
    localStorage.removeItem('auth-store');
    localStorage.removeItem('auth_token');
    localStorage.removeItem('mode-store');
  });
}

/**
 * Helper to login as a specific role by name.
 */
export async function loginAsRole(
  page: Page,
  role: 'VIEWER' | 'ANALYST' | 'STEWARD' | 'ADMIN'
): Promise<void> {
  const user = E2E_USERS[role];
  if (!user) {
    throw new Error(`Unknown role: ${role}`);
  }
  await loginAs(page, user);
}

/**
 * Extended test fixture with authentication helpers.
 */
export const test = base.extend<{
  authenticatedPage: Page;
}>({
  authenticatedPage: async ({ page }, use) => {
    // Default to ADMIN for full access in authenticated tests
    await loginAs(page, E2E_USERS.ADMIN);
    await use(page);
  },
});

export { expect } from '@playwright/test';
