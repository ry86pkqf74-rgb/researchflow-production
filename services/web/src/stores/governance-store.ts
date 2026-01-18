/**
 * Governance Store
 *
 * Zustand store for governance mode and feature flags
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { GovernanceMode, FeatureFlags } from '@/types/api';

interface GovernanceState {
  mode: GovernanceMode;
  featureFlags: FeatureFlags;
  setMode: (mode: GovernanceMode) => void;
  toggleFeatureFlag: (flag: keyof FeatureFlags) => void;
  setFeatureFlag: (flag: keyof FeatureFlags, value: boolean) => void;
}

export const useGovernanceStore = create<GovernanceState>()(
  persist(
    (set) => ({
      mode: 'DEMO',
      featureFlags: {
        REQUIRE_PHI_SCAN: true,
        PHI_SCAN_ON_UPLOAD: true,
        ALLOW_UPLOADS: true,
        ALLOW_EXPORTS: false,
        ALLOW_LLM_CALLS: true,
        REQUIRE_APPROVAL_FOR_EXPORTS: true,
      },
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
    }),
    {
      name: 'governance-store',
    }
  )
);
