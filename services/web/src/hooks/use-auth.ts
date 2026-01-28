/**
 * Authentication Hook
 *
 * React hook for JWT-based authentication.
 * Provides login, register, logout, and token refresh functionality.
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// User type definition
export interface User {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  displayName?: string;
  profileImageUrl?: string;
  role: 'admin' | 'researcher' | 'reviewer' | 'viewer';
  orgId?: string;
  createdAt?: string;
  updatedAt?: string;
}

// Auth response types
interface AuthResponse {
  message: string;
  user: User;
  accessToken: string;
}

interface LoginInput {
  email: string;
  password: string;
}

interface RegisterInput {
  email: string;
  password: string;
  firstName?: string;
  lastName?: string;
}

interface AuthResult {
  success: boolean;
  error?: string;
}

// Token store using Zustand with persistence
interface TokenStore {
  accessToken: string | null;
  setAccessToken: (token: string | null) => void;
  clearToken: () => void;
}

export const useTokenStore = create<TokenStore>()(
  persist(
    (set) => ({
      accessToken: null as string | null,
      setAccessToken: (token) => {
        set({ accessToken: token });
        // Sync with localStorage for api-client compatibility
        if (typeof window !== 'undefined') {
          if (token) {
            localStorage.setItem('auth_token', token);
          } else {
            localStorage.removeItem('auth_token');
          }
        }
      },
      clearToken: () => {
        set({ accessToken: null });
        if (typeof window !== 'undefined') {
          localStorage.removeItem('auth_token');
        }
      },
    }),
    {
      name: 'auth-storage',
    }
  )
);

// API helper with auth header
async function authFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const { accessToken } = useTokenStore.getState();

  const headers = new Headers(options.headers);
  if (accessToken) {
    headers.set('Authorization', `Bearer ${accessToken}`);
  }
  headers.set('Content-Type', 'application/json');

  return fetch(url, {
    ...options,
    headers,
    credentials: 'include',
  });
}

// Fetch current user
async function fetchUser(): Promise<User | null> {
  const { accessToken } = useTokenStore.getState();

  if (!accessToken) {
    return null;
  }

  try {
    const response = await authFetch('/api/auth/user');

    if (response.status === 401) {
      // Try to refresh token
      const refreshed = await refreshToken();
      if (!refreshed) {
        useTokenStore.getState().clearToken();
        return null;
      }
      // Retry with new token
      const retryResponse = await authFetch('/api/auth/user');
      if (!retryResponse.ok) {
        return null;
      }
      const data = await retryResponse.json();
      return data.user;
    }

    if (!response.ok) {
      throw new Error(`${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    return data.user;
  } catch (error) {
    console.error('Error fetching user:', error);
    return null;
  }
}

// Login function
async function loginUser(input: LoginInput): Promise<AuthResponse> {
  const response = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Login failed');
  }

  return response.json();
}

// Register function
async function registerUser(input: RegisterInput): Promise<AuthResponse> {
  const response = await fetch('/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Registration failed');
  }

  return response.json();
}

// Logout function
async function logoutUser(): Promise<void> {
  const response = await authFetch('/api/auth/logout', {
    method: 'POST',
  });

  // Clear token regardless of response
  useTokenStore.getState().clearToken();

  if (!response.ok) {
    console.warn('Logout request failed, but token was cleared');
  }
}

// Refresh token function
async function refreshToken(): Promise<boolean> {
  try {
    const response = await fetch('/api/auth/refresh', {
      method: 'POST',
      credentials: 'include',
    });

    if (!response.ok) {
      return false;
    }

    const data = await response.json();
    if (data.accessToken) {
      useTokenStore.getState().setAccessToken(data.accessToken);
      return true;
    }
    return false;
  } catch (error) {
    console.error('Error refreshing token:', error);
    return false;
  }
}

// Main auth hook
export function useAuth() {
  const queryClient = useQueryClient();
  const { accessToken, setAccessToken, clearToken } = useTokenStore();

  // User query
  const {
    data: user,
    isLoading,
    refetch: refetchUser,
  } = useQuery<User | null>({
    queryKey: ['/api/auth/user', accessToken],
    queryFn: fetchUser,
    retry: false,
    staleTime: 1000 * 60 * 5, // 5 minutes
    enabled: !!accessToken, // Only fetch if we have a token
  });

  // Login mutation
  const loginMutation = useMutation({
    mutationFn: loginUser,
    onSuccess: (data) => {
      setAccessToken(data.accessToken);
      queryClient.setQueryData(['/api/auth/user', data.accessToken], data.user);
    },
  });

  // Register mutation
  const registerMutation = useMutation({
    mutationFn: registerUser,
    onSuccess: (data) => {
      setAccessToken(data.accessToken);
      queryClient.setQueryData(['/api/auth/user', data.accessToken], data.user);
    },
  });

  // Logout mutation
  const logoutMutation = useMutation({
    mutationFn: logoutUser,
    onSuccess: () => {
      clearToken();
      queryClient.setQueryData(['/api/auth/user', null], null);
      queryClient.invalidateQueries({ queryKey: ['/api/auth/user'] });
      // Redirect to landing page after logout
      window.location.href = '/landing';
    },
  });

  // Login handler
  const login = async (input: LoginInput): Promise<AuthResult> => {
    try {
      await loginMutation.mutateAsync(input);
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Login failed',
      };
    }
  };

  // Register handler
  const register = async (input: RegisterInput): Promise<AuthResult> => {
    try {
      await registerMutation.mutateAsync(input);
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Registration failed',
      };
    }
  };

  // Logout handler
  const logout = async (): Promise<void> => {
    await logoutMutation.mutateAsync();
  };

  return {
    user,
    isLoading: isLoading || loginMutation.isPending || registerMutation.isPending,
    isAuthenticated: !!user && !!accessToken,
    login,
    register,
    logout,
    refetchUser,
    isLoggingOut: logoutMutation.isPending,
    accessToken,
  };
}

// Hook for checking authentication status
export function useAuthStatus() {
  const { isAuthenticated, isLoading, user } = useAuth();
  return { isAuthenticated, isLoading, user };
}

// Hook for getting just the access token (for API calls)
export function useAccessToken(): string | null {
  return useTokenStore((state) => state.accessToken);
}
