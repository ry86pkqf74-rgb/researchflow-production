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

interface OrgInfo {
  id: string;
  name: string;
  slug: string;
  tier: string;
  settings: Record<string, any>;
}

interface MembershipInfo {
  role: OrgRole;
  joinedAt: Date;
  capabilities: OrgCapability[];
}

interface OrgContext {
  org: OrgInfo | null;
  membership: MembershipInfo | null;
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
      org: null as OrgInfo | null,
      membership: null as MembershipInfo | null,
      features: {} as Record<string, boolean>,

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
        const state = get();
        return state.membership?.capabilities.includes(cap) ?? false;
      },

      // Computed getters (accessed as properties, not methods)
      get canCreate() {
        const state = get();
        return state.membership?.capabilities.includes('create_research') ?? false;
      },
      get canEdit() {
        const state = get();
        return state.membership?.capabilities.includes('edit_research') ?? false;
      },
      get canDelete() {
        const state = get();
        return state.membership?.capabilities.includes('delete_research') ?? false;
      },
      get canExport() {
        const state = get();
        return state.membership?.capabilities.includes('export') ?? false;
      },
      get canManageMembers() {
        const state = get();
        return state.membership?.capabilities.includes('manage_members') ?? false;
      },
      get isAdmin() {
        const state = get();
        return state.membership?.capabilities.includes('admin') ?? false;
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
