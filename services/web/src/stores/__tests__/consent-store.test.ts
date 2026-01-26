/**
 * Tests for Consent Store
 *
 * Tests analytics consent state management and server sync.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { act } from '@testing-library/react';

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Reset modules to get fresh store state
vi.resetModules();

describe('ConsentStore', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();

    // Reset fetch mock
    mockFetch.mockReset();

    // Clear any localStorage
    if (typeof localStorage !== 'undefined') {
      localStorage.clear();
    }
  });

  it('should have initial state with analytics not granted', async () => {
    const { useConsentStore } = await import('../consent-store');
    const state = useConsentStore.getState();

    expect(state.analyticsGranted).toBe(false);
    expect(state.loaded).toBe(false);
    expect(state.loading).toBe(false);
  });

  it('should load consent status from server', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          consents: [
            { consent_type: 'analytics', granted: true },
          ],
        }),
    });

    const { useConsentStore } = await import('../consent-store');

    await act(async () => {
      await useConsentStore.getState().loadFromServer();
    });

    const state = useConsentStore.getState();
    expect(state.analyticsGranted).toBe(true);
    expect(state.loaded).toBe(true);
  });

  it('should handle server error gracefully', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network error'));

    const { useConsentStore } = await import('../consent-store');

    await act(async () => {
      await useConsentStore.getState().loadFromServer();
    });

    const state = useConsentStore.getState();
    expect(state.analyticsGranted).toBe(false);
    expect(state.loaded).toBe(true); // Still mark as loaded to prevent retry loops
    expect(state.loading).toBe(false);
  });

  it('should grant analytics consent', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ success: true }),
    });

    const { useConsentStore } = await import('../consent-store');

    await act(async () => {
      await useConsentStore.getState().grantAnalytics();
    });

    const state = useConsentStore.getState();
    expect(state.analyticsGranted).toBe(true);
  });

  it('should revoke analytics consent', async () => {
    // First grant
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ success: true }),
    });

    const { useConsentStore } = await import('../consent-store');

    await act(async () => {
      await useConsentStore.getState().grantAnalytics();
    });

    // Then revoke
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ success: true }),
    });

    await act(async () => {
      await useConsentStore.getState().revokeAnalytics();
    });

    const state = useConsentStore.getState();
    expect(state.analyticsGranted).toBe(false);
  });

  it('should call correct API endpoint for grant', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ success: true }),
    });

    const { useConsentStore } = await import('../consent-store');

    await act(async () => {
      await useConsentStore.getState().grantAnalytics();
    });

    expect(mockFetch).toHaveBeenCalledWith(
      '/api/consent',
      expect.objectContaining({
        method: 'POST',
        body: expect.stringContaining('analytics'),
      })
    );
  });

  it('should call correct API endpoint for revoke', async () => {
    // Grant first
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ success: true }),
    });

    const { useConsentStore } = await import('../consent-store');

    await act(async () => {
      await useConsentStore.getState().grantAnalytics();
    });

    // Then revoke
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ success: true }),
    });

    await act(async () => {
      await useConsentStore.getState().revokeAnalytics();
    });

    expect(mockFetch).toHaveBeenLastCalledWith(
      '/api/consent/revoke',
      expect.objectContaining({
        method: 'POST',
        body: expect.stringContaining('analytics'),
      })
    );
  });

  it('should set loading state during operations', async () => {
    let resolvePromise: () => void;
    const pendingPromise = new Promise<void>((resolve) => {
      resolvePromise = resolve;
    });

    mockFetch.mockImplementationOnce(() =>
      pendingPromise.then(() => ({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      }))
    );

    const { useConsentStore } = await import('../consent-store');

    // Start the operation
    const grantPromise = useConsentStore.getState().grantAnalytics();

    // Should be loading
    expect(useConsentStore.getState().loading).toBe(true);

    // Resolve the promise
    resolvePromise!();
    await grantPromise;

    // Should no longer be loading
    expect(useConsentStore.getState().loading).toBe(false);
  });
});
