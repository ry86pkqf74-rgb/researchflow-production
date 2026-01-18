/**
 * Mode Store
 * 
 * Zustand store for absolute DEMO vs LIVE mode separation.
 * - DEMO mode: Public access, NO login, shows how ROS works with mock data
 * - LIVE mode: Requires login, real AI functionality, full features
 */

import { create } from 'zustand';

export type AppMode = 'DEMO' | 'LIVE';

interface ModeState {
  mode: AppMode;
  isDemo: boolean;
  isLive: boolean;
  isLoading: boolean;
  setMode: (mode: AppMode) => void;
}

export const useModeStore = create<ModeState>((set) => ({
  mode: 'DEMO',
  isDemo: true,
  isLive: false,
  isLoading: true,
  setMode: (mode) => set({ 
    mode, 
    isDemo: mode === 'DEMO', 
    isLive: mode === 'LIVE',
    isLoading: false,
  }),
}));
