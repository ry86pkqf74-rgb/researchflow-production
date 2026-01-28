/**
 * Consent Store
 *
 * Zustand store for managing user consent settings, particularly analytics consent.
 * Syncs with server-side consent records via the /api/consent endpoints.
 *
 * @module stores/consent-store
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface ConsentState {
  /**
   * Whether analytics consent has been granted
   */
  analyticsGranted: boolean;

  /**
   * Whether consent status has been loaded from server
   */
  loaded: boolean;

  /**
   * Whether a consent operation is in progress
   */
  loading: boolean;

  /**
   * Error message if consent operation failed
   */
  error: string | null;

  /**
   * Load consent status from server
   */
  loadFromServer: () => Promise<void>;

  /**
   * Grant analytics consent
   */
  grantAnalytics: () => Promise<void>;

  /**
   * Revoke analytics consent
   */
  revokeAnalytics: () => Promise<void>;

  /**
   * Reset store state (for logout)
   */
  reset: () => void;
}

export const useConsentStore = create<ConsentState>()(
  persist(
    (set, get) => ({
      analyticsGranted: false,
      loaded: false,
      loading: false,
      error: null as string | null,

      loadFromServer: async () => {
        set({ loading: true, error: null });

        try {
          const response = await fetch('/api/consent/status', {
            credentials: 'include',
          });

          if (!response.ok) {
            // Not authenticated or other error - use local state
            set({ loaded: true, loading: false });
            return;
          }

          const data = await response.json();

          // Check if analytics consent is granted
          const analyticsConsent = data.consents?.analytics;
          const analyticsGranted = analyticsConsent?.granted === true;

          set({
            analyticsGranted,
            loaded: true,
            loading: false,
          });
        } catch (error) {
          console.error('[ConsentStore] Failed to load consent status:', error);
          set({
            loaded: true,
            loading: false,
            error: 'Failed to load consent status',
          });
        }
      },

      grantAnalytics: async () => {
        set({ loading: true, error: null });

        try {
          const response = await fetch('/api/consent/grant', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            credentials: 'include',
            body: JSON.stringify({
              consentType: 'analytics',
              legalBasis: 'consent',
              purpose: 'product_analytics',
            }),
          });

          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || 'Failed to grant consent');
          }

          set({
            analyticsGranted: true,
            loading: false,
          });

          console.log('[ConsentStore] Analytics consent granted');
        } catch (error) {
          console.error('[ConsentStore] Failed to grant analytics consent:', error);
          set({
            loading: false,
            error: error instanceof Error ? error.message : 'Failed to grant consent',
          });
        }
      },

      revokeAnalytics: async () => {
        set({ loading: true, error: null });

        try {
          const response = await fetch('/api/consent/revoke', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            credentials: 'include',
            body: JSON.stringify({
              consentType: 'analytics',
              reason: 'user_opt_out',
            }),
          });

          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || 'Failed to revoke consent');
          }

          set({
            analyticsGranted: false,
            loading: false,
          });

          console.log('[ConsentStore] Analytics consent revoked');
        } catch (error) {
          console.error('[ConsentStore] Failed to revoke analytics consent:', error);
          set({
            loading: false,
            error: error instanceof Error ? error.message : 'Failed to revoke consent',
          });
        }
      },

      reset: () => {
        set({
          analyticsGranted: false,
          loaded: false,
          loading: false,
          error: null,
        });
      },
    }),
    {
      name: 'consent-store',
      // Only persist the analyticsGranted flag for quick access
      // Server is source of truth and will be synced on load
      partialize: (state) => ({
        analyticsGranted: state.analyticsGranted,
      }),
    }
  )
);
