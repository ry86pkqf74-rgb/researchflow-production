/**
 * MSW Browser Worker Setup for E2E Tests
 *
 * Sets up Mock Service Worker for intercepting API calls
 * during Playwright E2E tests.
 */

import { setupWorker } from 'msw/browser';
import { handlers, resetMockState, setMockUser, setMockMode, addPendingApproval } from './handlers';

/**
 * Create the MSW browser worker with handlers.
 */
export const worker = setupWorker(...handlers);

/**
 * Start the mock service worker.
 * Call this in your test setup.
 */
export async function startMockServer(): Promise<void> {
  await worker.start({
    onUnhandledRequest: 'bypass', // Let unhandled requests pass through
    quiet: true, // Reduce console noise
  });
}

/**
 * Stop the mock service worker.
 * Call this in your test teardown.
 */
export function stopMockServer(): void {
  worker.stop();
}

/**
 * Reset mock state between tests.
 */
export function resetMocks(): void {
  resetMockState();
}

// Re-export mock state setters for use in tests
export { setMockUser, setMockMode, addPendingApproval };
