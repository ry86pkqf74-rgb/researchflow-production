import { useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useModeStore, AppMode } from "@/stores/mode-store";
import { useAuth } from "@/hooks/use-auth";

export type GovernanceMode = 'DEMO' | 'LIVE' | 'OFFLINE';

interface GovernanceModeResponse {
  mode: GovernanceMode;
}

async function fetchGovernanceMode(): Promise<GovernanceModeResponse> {
  const response = await fetch("/api/governance/mode", {
    credentials: "include",
  });

  if (response.status === 401 || response.status === 403) {
    return { mode: 'DEMO' };
  }

  if (!response.ok) {
    return { mode: 'DEMO' };
  }

  return response.json();
}

/**
 * Hook to determine the effective governance mode.
 *
 * Mode Logic:
 * - DEMO: Unauthenticated users (landing page only)
 * - LIVE: Authenticated users with AI enabled
 * - OFFLINE: Authenticated users with AI disabled
 */
export function useGovernanceMode() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const setModeStore = useModeStore((state) => state.setMode);
  const storeMode = useModeStore((state) => state.mode);
  const aiEnabled = useModeStore((state) => state.aiEnabled);

  const { data, isLoading: queryLoading } = useQuery<GovernanceModeResponse>({
    queryKey: ["/api/governance/mode"],
    queryFn: fetchGovernanceMode,
    retry: false,
    staleTime: 1000 * 60 * 5,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    refetchOnReconnect: false,
  });

  const isLoading = authLoading || queryLoading;

  // Calculate effective mode based on auth and AI settings
  const effectiveMode: GovernanceMode = useMemo(() => {
    if (!isAuthenticated) {
      return 'DEMO';
    }
    // Authenticated user
    if (aiEnabled) {
      return 'LIVE';
    }
    return 'OFFLINE';
  }, [isAuthenticated, aiEnabled]);

  // Sync effective mode with Zustand store
  useEffect(() => {
    if (!isLoading && effectiveMode !== storeMode) {
      console.log('[useGovernanceMode] Syncing mode store:', effectiveMode, '(aiEnabled:', aiEnabled, ')');
      setModeStore(effectiveMode);
    }
  }, [effectiveMode, storeMode, isLoading, setModeStore, aiEnabled]);

  return {
    mode: effectiveMode,
    isDemo: effectiveMode === 'DEMO',
    isLive: effectiveMode === 'LIVE',
    isOffline: effectiveMode === 'OFFLINE',
    isLoading,
    aiEnabled,
  };
}
