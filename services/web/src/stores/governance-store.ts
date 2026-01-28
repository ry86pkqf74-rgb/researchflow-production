/**
 * Governance Store
 *
 * Zustand store for governance mode and feature flags.
 * Supports SSE-based realtime updates from server.
 *
 * @module stores/governance-store
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { GovernanceMode, FeatureFlags } from '@/types/api';

/**
 * Flag metadata from server
 */
export interface FlagMeta {
  name: string;
  enabled: boolean;
  description: string;
  requiredModes?: GovernanceMode[];
  rolloutPercent?: number;
}

/**
 * Server state shape from /api/governance/state
 */
export interface ServerGovernanceState {
  mode: GovernanceMode;
  flags: FlagMeta[];
  flagsMeta?: FlagMeta[];
  timestamp?: string;
}

interface GovernanceState {
  mode: GovernanceMode;
  featureFlags: FeatureFlags;
  flagsMeta: FlagMeta[];
  lastUpdated: string | null;
  sseConnected: boolean;
  setMode: (mode: GovernanceMode) => void;
  toggleFeatureFlag: (flag: keyof FeatureFlags) => void;
  setFeatureFlag: (flag: keyof FeatureFlags, value: boolean) => void;
  hydrateFromServer: (data: ServerGovernanceState) => void;
  setSseConnected: (connected: boolean) => void;
}

/**
 * Convert server flags array to FeatureFlags object
 */
function flagsArrayToObject(flags: FlagMeta[]): Partial<FeatureFlags> {
  const obj: Partial<FeatureFlags> = {};
  for (const flag of flags) {
    // Map flag names to FeatureFlags keys
    const key = flag.name as keyof FeatureFlags;
    obj[key] = flag.enabled;
  }
  return obj;
}

export const useGovernanceStore = create<GovernanceState>()(
  persist(
    (set, get) => ({
      mode: 'DEMO',
      featureFlags: {
        REQUIRE_PHI_SCAN: true,
        PHI_SCAN_ON_UPLOAD: true,
        ALLOW_UPLOADS: true,
        ALLOW_EXPORTS: false,
        ALLOW_LLM_CALLS: true,
        REQUIRE_APPROVAL_FOR_EXPORTS: true,
      },
      flagsMeta: [] as FlagMeta[],
      lastUpdated: null as string | null,
      sseConnected: false,

      setMode: (mode) => set({ mode }),

      toggleFeatureFlag: (flag) =>
        set((state) => ({
          featureFlags: {
            ...state.featureFlags,
            [flag]: !state.featureFlags[flag],
          },
        })),

      setFeatureFlag: (flag, value) =>
        set((state) => ({
          featureFlags: {
            ...state.featureFlags,
            [flag]: value,
          },
        })),

      /**
       * Hydrate store from server state (SSE or initial fetch)
       */
      hydrateFromServer: (data: ServerGovernanceState) => {
        const flags = data.flags || data.flagsMeta || [];
        const flagsObj = flagsArrayToObject(flags);

        set((state) => ({
          mode: data.mode || state.mode,
          featureFlags: {
            ...state.featureFlags,
            ...flagsObj,
          },
          flagsMeta: flags,
          lastUpdated: data.timestamp || new Date().toISOString(),
        }));
      },

      setSseConnected: (connected: boolean) => set({ sseConnected: connected }),
    }),
    {
      name: 'governance-store',
      // Only persist mode and featureFlags, not SSE state
      partialize: (state) => ({
        mode: state.mode,
        featureFlags: state.featureFlags,
      }),
    }
  )
);
