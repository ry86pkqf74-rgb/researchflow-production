import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useModeStore } from "@/stores/mode-store";

export type GovernanceMode = 'DEMO' | 'LIVE';

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

export function useGovernanceMode() {
  const setModeStore = useModeStore((state) => state.setMode);
  const storeMode = useModeStore((state) => state.mode);

  const { data, isLoading } = useQuery<GovernanceModeResponse>({
    queryKey: ["/api/governance/mode"],
    queryFn: fetchGovernanceMode,
    retry: false,
    staleTime: 1000 * 60 * 5,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    refetchOnReconnect: false,
  });

  const mode = data?.mode ?? 'DEMO';

  // Sync React Query data with Zustand store when they differ
  useEffect(() => {
    if (!isLoading && mode !== storeMode) {
      console.log('[useGovernanceMode] Syncing mode store:', mode);
      setModeStore(mode);
    }
  }, [mode, storeMode, isLoading, setModeStore]);

  return {
    mode,
    isDemo: mode === 'DEMO',
    isLive: mode === 'LIVE',
    isLoading,
  };
}
