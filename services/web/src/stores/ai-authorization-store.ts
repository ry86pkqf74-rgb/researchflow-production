/**
 * AI Authorization Store
 *
 * Zustand store for managing AI assistance authorization and consent.
 * Tracks which scopes have been authorized and by whom.
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface AuthorizationRecord {
  scope: string;
  authorizedBy: string;
  timestamp: string;
  expiresAt?: string;
}

interface AIAuthorizationState {
  /**
   * Map of scope -> authorization record
   */
  authorizations: Record<string, AuthorizationRecord>;

  /**
   * Check if a scope is currently authorized
   */
  isAuthorized: (scope: string) => boolean;

  /**
   * Grant authorization for a scope
   */
  authorize: (record: AuthorizationRecord) => void;

  /**
   * Revoke authorization for a scope
   */
  revoke: (scope: string) => void;

  /**
   * Revoke all authorizations (e.g., on logout)
   */
  revokeAll: () => void;

  /**
   * Get authorization record for a scope
   */
  getAuthorization: (scope: string) => AuthorizationRecord | undefined;
}

export const useAIAuthorizationStore = create<AIAuthorizationState>()(
  persist(
    (set, get) => ({
      authorizations: {},

      isAuthorized: (scope: string) => {
        const record = get().authorizations[scope];
        if (!record) return false;

        // Check expiration if set
        if (record.expiresAt) {
          const expiresAt = new Date(record.expiresAt);
          if (expiresAt < new Date()) {
            // Expired, remove it
            set((state) => {
              const newAuthorizations = { ...state.authorizations };
              delete newAuthorizations[scope];
              return { authorizations: newAuthorizations };
            });
            return false;
          }
        }

        return true;
      },

      authorize: (record: AuthorizationRecord) => {
        set((state) => ({
          authorizations: {
            ...state.authorizations,
            [record.scope]: record,
          },
        }));

        console.log('[AIAuthorization] Authorized scope:', record.scope, 'by:', record.authorizedBy);
      },

      revoke: (scope: string) => {
        set((state) => {
          const newAuthorizations = { ...state.authorizations };
          delete newAuthorizations[scope];
          return { authorizations: newAuthorizations };
        });

        console.log('[AIAuthorization] Revoked scope:', scope);
      },

      revokeAll: () => {
        set({ authorizations: {} });
        console.log('[AIAuthorization] Revoked all authorizations');
      },

      getAuthorization: (scope: string) => {
        return get().authorizations[scope];
      },
    }),
    {
      name: 'ai-authorization-storage',
      // Optional: Clear on logout by listening to auth changes
    }
  )
);

/**
 * Hook to request authorization for a scope
 * Returns a function that opens the modal and waits for authorization
 */
export function useRequestAIAuthorization() {
  const { isAuthorized, authorize } = useAIAuthorizationStore();

  return {
    isAuthorized,
    authorize,
  };
}
