import { useQuery } from "@tanstack/react-query";

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

  return {
    mode,
    isDemo: mode === 'DEMO',
    isLive: mode === 'LIVE',
    isLoading,
  };
}
