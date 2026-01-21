/**
 * AuthGate Component
 * 
 * Route protection for LIVE mode.
 * Redirects unauthenticated users to login when in LIVE mode.
 */

import { useEffect, useState } from 'react';
import { useModeStore } from '@/stores/mode-store';
import { Loader2 } from 'lucide-react';

interface AuthGateProps {
  children: React.ReactNode;
  requireAuth?: boolean;
}

interface AuthState {
  isAuthenticated: boolean;
  isLoading: boolean;
  user: any | null;
}

export function AuthGate({ children, requireAuth = false }: AuthGateProps) {
  const { isLive, isLoading: modeLoading } = useModeStore();
  const [authState, setAuthState] = useState<AuthState>({
    isAuthenticated: false,
    isLoading: true,
    user: null,
  });
  const [shouldRedirect, setShouldRedirect] = useState(false);

  useEffect(() => {
    let cancelled = false;
    
    async function checkAuth() {
      try {
        const response = await fetch('/api/auth/user', {
          credentials: 'include',
        });
        
        if (cancelled) return;
        
        if (response.ok) {
          const user = await response.json();
          setAuthState({
            isAuthenticated: true,
            isLoading: false,
            user,
          });
        } else {
          setAuthState({
            isAuthenticated: false,
            isLoading: false,
            user: null,
          });
        }
      } catch {
        if (!cancelled) {
          setAuthState({
            isAuthenticated: false,
            isLoading: false,
            user: null,
          });
        }
      }
    }

    checkAuth();
    
    return () => {
      cancelled = true;
    };
  }, []);

  // Handle redirect in useEffect to avoid side effects during render
  useEffect(() => {
    if (!modeLoading && !authState.isLoading && isLive && requireAuth && !authState.isAuthenticated) {
      setShouldRedirect(true);
    }
  }, [modeLoading, authState.isLoading, isLive, requireAuth, authState.isAuthenticated]);

  useEffect(() => {
    if (shouldRedirect) {
      window.location.href = '/login';
    }
  }, [shouldRedirect]);

  // Show loading state while checking mode and auth
  if (modeLoading || authState.isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" data-testid="auth-gate-loading">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" aria-label="Loading" />
      </div>
    );
  }

  // In LIVE mode, if auth is required and user is not authenticated, show redirecting state
  if (isLive && requireAuth && !authState.isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center" data-testid="auth-gate-redirecting">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mx-auto mb-4" aria-label="Redirecting" />
          <p className="text-muted-foreground">Redirecting to login...</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

/**
 * Hook to check authentication status
 */
export function useAuth() {
  const [authState, setAuthState] = useState<AuthState>({
    isAuthenticated: false,
    isLoading: true,
    user: null,
  });

  useEffect(() => {
    let cancelled = false;
    
    async function checkAuth() {
      try {
        const response = await fetch('/api/auth/user', {
          credentials: 'include',
        });
        
        if (cancelled) return;
        
        if (response.ok) {
          const user = await response.json();
          setAuthState({
            isAuthenticated: true,
            isLoading: false,
            user,
          });
        } else {
          setAuthState({
            isAuthenticated: false,
            isLoading: false,
            user: null,
          });
        }
      } catch {
        if (!cancelled) {
          setAuthState({
            isAuthenticated: false,
            isLoading: false,
            user: null,
          });
        }
      }
    }

    checkAuth();
    
    return () => {
      cancelled = true;
    };
  }, []);

  return authState;
}
