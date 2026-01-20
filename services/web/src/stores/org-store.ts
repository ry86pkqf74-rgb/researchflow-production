import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/**
 * Organization Store (Task 102 - Role-Adaptive Navigation)
 *
 * Manages organization context including:
 * - Selected organization details
 * - User's membership and role
 * - Computed capabilities for the current org
 * - Feature flags available for org tier
 *
 * Persisted to localStorage for session continuity.
 */

export type OrgRole = 'OWNER' | 'ADMIN' | 'MEMBER' | 'VIEWER';
export type OrgCapability =
  | 'view_research'
  | 'create_research'
  | 'edit_research'
  | 'delete_research'
  | 'export'
  | 'invite'
  | 'manage_members'
  | 'billing'
  | 'integrations'
  | 'admin';

interface OrgContext {
  org: {
    id: string;
    name: string;
    slug: string;
    tier: string;
    settings: Record<string, any>;
  } | null;
  membership: {
    role: OrgRole;
    joinedAt: Date;
    capabilities: OrgCapability[];
  } | null;
  features: Record<string, boolean>;
}

interface OrgState extends OrgContext {
  fetchContext: () => Promise<void>;
  setOrg: (orgId: string) => Promise<void>;
  clearOrg: () => void;
  hasCapability: (cap: OrgCapability) => boolean;

  // Computed getters
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
  canExport: boolean;
  canManageMembers: boolean;
  isAdmin: boolean;
}

export const useOrgStore = create<OrgState>()(
  persist(
    (set, get) => ({
      org: null,
      membership: null,
      features: {},

      /**
       * Fetch organization context from backend
       *
       * Called on app mount to restore org state
       */
      fetchContext: async () => {
        try {
          const res = await fetch('/api/org/context', {
            credentials: 'include',
          });

          if (!res.ok) {
            if (res.status === 401 || res.status === 403) {
              // No org context available
              set({ org: null, membership: null, features: {} });
              return;
            }
            throw new Error(`HTTP ${res.status}`);
          }

          const data = await res.json();

          set({
            org: data.org,
            membership: {
              ...data.membership,
              joinedAt: new Date(data.membership.joinedAt),
            },
            features: data.features,
          });
        } catch (error) {
          console.error('[OrgStore] Failed to fetch context:', error);
          // Don't clear state on network errors - keep cached data
        }
      },

      /**
       * Switch to a different organization
       *
       * @param orgId - Organization ID to switch to
       */
      setOrg: async (orgId: string) => {
        try {
          const res = await fetch(`/api/org/${orgId}/select`, {
            method: 'POST',
            credentials: 'include',
          });

          if (!res.ok) {
            throw new Error(`HTTP ${res.status}`);
          }

          // Fetch updated context after switch
          await get().fetchContext();
        } catch (error) {
          console.error('[OrgStore] Failed to set org:', error);
          throw error;
        }
      },

      /**
       * Clear organization context (logout/switch scenario)
       */
      clearOrg: () => {
        set({ org: null, membership: null, features: {} });
      },

      /**
       * Check if user has a specific capability
       *
       * @param cap - Capability to check
       * @returns boolean - Whether user has the capability
       */
      hasCapability: (cap: OrgCapability) => {
        const { membership } = get();
        return membership?.capabilities.includes(cap) ?? false;
      },

      // Computed getters (accessed as properties, not methods)
      get canCreate() {
        return get().hasCapability('create_research');
      },
      get canEdit() {
        return get().hasCapability('edit_research');
      },
      get canDelete() {
        return get().hasCapability('delete_research');
      },
      get canExport() {
        return get().hasCapability('export');
      },
      get canManageMembers() {
        return get().hasCapability('manage_members');
      },
      get isAdmin() {
        return get().hasCapability('admin');
      },
    }),
    {
      name: 'org-store',
      // Only persist specific fields
      partialize: (state) => ({
        org: state.org,
        membership: state.membership,
        features: state.features,
      }),
    }
  )
);
