// ============================================
// ResearchFlow Authentication Context
// ============================================
// Provides authentication state and mode management throughout the app

'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { authApi, User } from '@/lib/api';

type AppMode = 'demo' | 'live';

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  mode: AppMode;
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>;
  setMode: (mode: AppMode) => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [mode, setModeState] = useState<AppMode>('demo');

  // Initialize state from localStorage on mount
  useEffect(() => {
    const initializeAuth = async () => {
      if (typeof window === 'undefined') {
        setIsLoading(false);
        return;
      }

      const savedMode = (localStorage.getItem('appMode') as AppMode) || 'demo';
      setModeState(savedMode);

      if (savedMode === 'live') {
        const token = localStorage.getItem('authToken');
        if (token) {
          try {
            const response = await authApi.me();
            if (response.data?.user) {
              setUser(response.data.user);
            } else {
              // Token invalid, clear it
              localStorage.removeItem('authToken');
            }
          } catch {
            localStorage.removeItem('authToken');
          }
        }
      }

      setIsLoading(false);
    };

    initializeAuth();
  }, []);

  const login = useCallback(async (email: string, password: string): Promise<boolean> => {
    try {
      const response = await authApi.login({ email, password });
      if (response.data?.success && response.data.token) {
        localStorage.setItem('authToken', response.data.token);
        setUser(response.data.user);
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } catch {
      // Ignore logout errors
    }
    localStorage.removeItem('authToken');
    setUser(null);
  }, []);

  const setMode = useCallback((newMode: AppMode) => {
    setModeState(newMode);
    localStorage.setItem('appMode', newMode);

    // Clear auth state when switching to demo mode
    if (newMode === 'demo') {
      setUser(null);
      localStorage.removeItem('authToken');
    }
  }, []);

  const refreshUser = useCallback(async () => {
    if (mode !== 'live') return;

    const token = localStorage.getItem('authToken');
    if (!token) {
      setUser(null);
      return;
    }

    try {
      const response = await authApi.me();
      if (response.data?.user) {
        setUser(response.data.user);
      } else {
        localStorage.removeItem('authToken');
        setUser(null);
      }
    } catch {
      localStorage.removeItem('authToken');
      setUser(null);
    }
  }, [mode]);

  const value: AuthContextType = {
    user,
    isAuthenticated: !!user,
    isLoading,
    mode,
    login,
    logout,
    setMode,
    refreshUser,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

// Higher-order component for protected routes
interface ProtectedRouteProps {
  children: ReactNode;
  fallback?: ReactNode;
}

export function ProtectedRoute({ children, fallback }: ProtectedRouteProps) {
  const { isAuthenticated, isLoading, mode } = useAuth();

  // In demo mode, always allow access
  if (mode === 'demo') {
    return <>{children}</>;
  }

  // Show loading state
  if (isLoading) {
    return <>{fallback || <div>Loading...</div>}</>;
  }

  // In live mode, require authentication
  if (!isAuthenticated) {
    // Redirect to login
    if (typeof window !== 'undefined') {
      window.location.href = `/login?redirect=${encodeURIComponent(window.location.pathname)}`;
    }
    return null;
  }

  return <>{children}</>;
}
