// ============================================
// TanStack Query Client Configuration
// ============================================
// Centralized query client setup with authentication and retry logic

import { QueryClient, QueryFunction, DefaultError } from "@tanstack/react-query";
import { getAuthToken, isTokenExpired, clearAuthTokens } from './api/auth';
import { DEFAULT_RETRY_CONFIG, isRetryable } from './api/retry';

/**
 * Throw error if response is not OK
 */
async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    const error = new Error(`${res.status}: ${text}`);
    (error as any).statusCode = res.status;
    throw error;
  }
}

/**
 * Get authentication token from storage or store
 */
function getAuthToken_(): string | null {
  if (typeof window === 'undefined') return null;

  // Try to get from Zustand store first
  try {
    const { useTokenStore } = require('@/hooks/use-auth');
    const storeToken = useTokenStore.getState()?.accessToken;
    if (storeToken) return storeToken;
  } catch (e) {
    // Fallback if import fails
  }

  // Fallback to local auth utils
  try {
    return getAuthToken();
  } catch (e) {
    // Last fallback to localStorage
    return localStorage.getItem('auth_token') || localStorage.getItem('authToken');
  }
}

/**
 * Build request headers with auth token
 */
function buildRequestHeaders(includeContentType: boolean = false): Record<string, string> {
  const headers: Record<string, string> = {
    'X-App-Mode': typeof window !== 'undefined'
      ? localStorage.getItem('appMode') || 'demo'
      : 'demo',
  };

  if (includeContentType) {
    headers['Content-Type'] = 'application/json';
  }

  // Add auth token if available and not expired
  const token = getAuthToken_();
  if (token && !isTokenExpired()) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  return headers;
}

/**
 * Generic API request function
 */
export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  const res = await fetch(url, {
    method,
    headers: buildRequestHeaders(!!data),
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
  });

  await throwIfResNotOk(res);
  return res;
}

/**
 * Unauthorized behavior type
 */
type UnauthorizedBehavior = "returnNull" | "throw";

/**
 * Create a query function with custom 401 handling
 */
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T, string[], unknown> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const res = await fetch(queryKey.join("/") as string, {
      headers: buildRequestHeaders(false),
      credentials: "include",
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      // Clear auth tokens on 401
      if (typeof window !== 'undefined') {
        clearAuthTokens();
      }
      return null;
    }

    if (res.status === 401) {
      // Clear auth tokens on 401
      if (typeof window !== 'undefined') {
        clearAuthTokens();
      }
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

/**
 * Retry logic for query client
 */
function shouldRetry(failureCount: number, error: DefaultError) {
  // Don't retry 4xx errors (except 429 and 408)
  if (error instanceof Error && 'statusCode' in error) {
    const status = (error as any).statusCode;
    if (status >= 400 && status < 500) {
      if (status !== 429 && status !== 408) {
        return false;
      }
    }
  }

  return failureCount < DEFAULT_RETRY_CONFIG.maxRetries && isRetryable(error);
}

/**
 * Initialize and export QueryClient
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      refetchOnReconnect: "stale", // Refetch when reconnecting if stale
      staleTime: 1000 * 60 * 5, // 5 minutes
      gcTime: 1000 * 60 * 10, // 10 minutes (was cacheTime in v4)
      retry: shouldRetry,
      throwOnError: false, // Don't throw errors by default
    },
    mutations: {
      retry: (failureCount, error) => shouldRetry(failureCount, error),
      throwOnError: false,
    },
  },
});

/**
 * Get the current query client instance
 */
export function getQueryClient(): QueryClient {
  return queryClient;
}

/**
 * Clear all queries and mutations
 */
export function clearQueryCache(): void {
  queryClient.clear();
}

/**
 * Invalidate all queries
 */
export function invalidateAllQueries(): Promise<void> {
  return queryClient.invalidateQueries();
}

/**
 * Reset the query client to default state
 */
export function resetQueryClient(): void {
  queryClient.clear();
  queryClient.removeObserverListener();
}
