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
 *
 * @param page The Playwright page object
 * @param user The E2E user object. If undefined, defaults to ADMIN user.
 * @throws Error if user object is invalid or missing required fields
 */
export async function loginAs(page: Page, user?: E2EUser): Promise<void> {
  // Handle undefined/null user - default to ADMIN
  let targetUser = user;
  if (!targetUser) {
    console.warn('loginAs called with undefined user, defaulting to ADMIN');
    targetUser = E2E_USERS.ADMIN;
  }

  // Validate user object exists and is an object
  if (!targetUser || typeof targetUser !== 'object') {
    throw new Error(
      `Invalid user object provided to loginAs. Expected an object with user data. Received: ${JSON.stringify(targetUser)}`
    );
  }

  // Validate user object has required id field
  if (!targetUser.id) {
    throw new Error(
      `Invalid user object provided to loginAs. User must have an 'id' property. ` +
      `Received user: ${JSON.stringify(targetUser)}. ` +
      `Available users: ${Object.keys(E2E_USERS).join(', ')}`
    );
  }

  const authState: AuthStoreState = {
    state: {
      user: targetUser,
      token: `e2e-test-token-${targetUser.id}`,
    },
    version: 0,
  };

  // When logging in, also set mode to LIVE (authenticated users get LIVE mode)
  const modeState: ModeStoreState = {
    state: { mode: 'LIVE' },
    version: 0,
  };

  await page.addInitScript(({ auth, mode }) => {
    localStorage.setItem('auth-store', JSON.stringify(auth));
    localStorage.setItem('auth_token', auth.state.token);
    localStorage.setItem('mode-store', JSON.stringify(mode));
  }, { auth: authState, mode: modeState });
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
 * This simulates a user logout by removing auth and mode storage.
 *
 * @param page The Playwright page object
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
 *
 * @param page The Playwright page object
 * @param role The role name (VIEWER, ANALYST, STEWARD, or ADMIN)
 * @throws Error if the role is not found in E2E_USERS
 */
export async function loginAsRole(
  page: Page,
  role: 'VIEWER' | 'ANALYST' | 'STEWARD' | 'ADMIN'
): Promise<void> {
  const user = E2E_USERS[role];
  if (!user) {
    throw new Error(
      `Unknown role: ${role}. Available roles: ${Object.keys(E2E_USERS).join(', ')}. ` +
      `User object must have an 'id' property. Received user: ${JSON.stringify(user)}`
    );
  }
  // Validate user has required id before calling loginAs
  if (!user.id) {
    throw new Error(
      `User object for role '${role}' is missing required 'id' property. Received: ${JSON.stringify(user)}`
    );
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
