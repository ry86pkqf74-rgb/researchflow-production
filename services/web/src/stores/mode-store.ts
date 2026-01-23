/**
 * Mode Store
 *
 * Zustand store for DEMO, LIVE, and OFFLINE mode separation.
 * - DEMO mode: Public access, NO login, landing page only
 * - LIVE mode: Requires login + AI enabled, full features with AI
 * - OFFLINE mode: Requires login, AI disabled, features without AI assistance
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type AppMode = 'DEMO' | 'LIVE' | 'OFFLINE';

interface ModeState {
  mode: AppMode;
  isDemo: boolean;
  isLive: boolean;
  isOffline: boolean;
  isLoading: boolean;
  aiEnabled: boolean;
  setMode: (mode: AppMode) => void;
  setAIEnabled: (enabled: boolean) => void;
}

export const useModeStore = create<ModeState>()(
  persist(
    (set) => ({
      mode: 'DEMO',
      isDemo: true,
      isLive: false,
      isOffline: false,
      isLoading: true,
      aiEnabled: true, // AI enabled by default
      setMode: (mode) => set({
        mode,
        isDemo: mode === 'DEMO',
        isLive: mode === 'LIVE',
        isOffline: mode === 'OFFLINE',
        isLoading: false,
      }),
      setAIEnabled: (enabled) => set({ aiEnabled: enabled }),
    }),
    {
      name: 'ros-mode-storage',
      partialize: (state) => ({ aiEnabled: state.aiEnabled }), // Only persist AI setting
    }
  )
);
