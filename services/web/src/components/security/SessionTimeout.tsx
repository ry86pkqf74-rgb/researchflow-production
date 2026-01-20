/**
 * Session Timeout Component
 * Task 111 - Add session timeout with warning modals
 * Provides session management with countdown warnings
 */

import * as React from 'react';
import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Clock,
  LogOut,
  RefreshCcw,
  AlertTriangle,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';

// Session configuration
export interface SessionConfig {
  sessionDurationMs: number;      // Total session duration
  warningThresholdMs: number;     // When to show warning (time remaining)
  countdownIntervalMs: number;    // How often to update countdown
  activityEvents: string[];       // Events that reset the session timer
}

const DEFAULT_CONFIG: SessionConfig = {
  sessionDurationMs: 30 * 60 * 1000,    // 30 minutes
  warningThresholdMs: 2 * 60 * 1000,    // 2 minutes warning
  countdownIntervalMs: 1000,             // Update every second
  activityEvents: ['mousedown', 'keydown', 'scroll', 'touchstart'],
};

// Session state
export interface SessionState {
  isActive: boolean;
  expiresAt: Date | null;
  lastActivityAt: Date;
  warningShown: boolean;
}

interface SessionTimeoutProps {
  config?: Partial<SessionConfig>;
  onSessionExpire: () => void;
  onSessionExtend?: () => Promise<boolean>;
  onLogout?: () => void;
  enabled?: boolean;
}

export function SessionTimeout({
  config: userConfig,
  onSessionExpire,
  onSessionExtend,
  onLogout,
  enabled = true,
}: SessionTimeoutProps) {
  const config = { ...DEFAULT_CONFIG, ...userConfig };

  const [showWarning, setShowWarning] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState(config.sessionDurationMs);
  const [isExtending, setIsExtending] = useState(false);

  const expirationRef = useRef<Date>(new Date(Date.now() + config.sessionDurationMs));
  const warningTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const expirationTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Reset session timer
  const resetSession = useCallback(() => {
    if (!enabled) return;

    // Clear existing timers
    if (warningTimerRef.current) clearTimeout(warningTimerRef.current);
    if (expirationTimerRef.current) clearTimeout(expirationTimerRef.current);
    if (countdownRef.current) clearInterval(countdownRef.current);

    // Set new expiration time
    expirationRef.current = new Date(Date.now() + config.sessionDurationMs);
    setTimeRemaining(config.sessionDurationMs);
    setShowWarning(false);

    // Set warning timer
    warningTimerRef.current = setTimeout(() => {
      setShowWarning(true);
      startCountdown();
    }, config.sessionDurationMs - config.warningThresholdMs);

    // Set expiration timer
    expirationTimerRef.current = setTimeout(() => {
      handleExpiration();
    }, config.sessionDurationMs);
  }, [config.sessionDurationMs, config.warningThresholdMs, enabled]);

  // Start countdown
  const startCountdown = useCallback(() => {
    countdownRef.current = setInterval(() => {
      const remaining = expirationRef.current.getTime() - Date.now();
      setTimeRemaining(Math.max(0, remaining));

      if (remaining <= 0) {
        if (countdownRef.current) clearInterval(countdownRef.current);
      }
    }, config.countdownIntervalMs);
  }, [config.countdownIntervalMs]);

  // Handle expiration
  const handleExpiration = useCallback(() => {
    setShowWarning(false);
    if (countdownRef.current) clearInterval(countdownRef.current);
    onSessionExpire();
  }, [onSessionExpire]);

  // Extend session
  const extendSession = useCallback(async () => {
    if (!onSessionExtend) {
      resetSession();
      return;
    }

    setIsExtending(true);
    try {
      const success = await onSessionExtend();
      if (success) {
        resetSession();
      } else {
        handleExpiration();
      }
    } catch (error) {
      console.error('Failed to extend session:', error);
      handleExpiration();
    } finally {
      setIsExtending(false);
    }
  }, [onSessionExtend, resetSession, handleExpiration]);

  // Handle user activity
  const handleActivity = useCallback(() => {
    if (!showWarning) {
      resetSession();
    }
  }, [showWarning, resetSession]);

  // Set up activity listeners
  useEffect(() => {
    if (!enabled) return;

    // Initial setup
    resetSession();

    // Add activity listeners
    config.activityEvents.forEach((event) => {
      window.addEventListener(event, handleActivity, { passive: true });
    });

    // Cleanup
    return () => {
      config.activityEvents.forEach((event) => {
        window.removeEventListener(event, handleActivity);
      });
      if (warningTimerRef.current) clearTimeout(warningTimerRef.current);
      if (expirationTimerRef.current) clearTimeout(expirationTimerRef.current);
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, [enabled, config.activityEvents, handleActivity, resetSession]);

  // Format time remaining
  const formatTimeRemaining = (ms: number): string => {
    const seconds = Math.ceil(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  // Calculate progress percentage
  const progressPercentage = (timeRemaining / config.warningThresholdMs) * 100;

  if (!enabled) return null;

  return (
    <Dialog open={showWarning} onOpenChange={() => {}}>
      <DialogContent className="sm:max-w-[425px]" hideCloseButton>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            Session Expiring Soon
          </DialogTitle>
          <DialogDescription>
            Your session will expire due to inactivity. Would you like to continue working?
          </DialogDescription>
        </DialogHeader>

        <div className="py-6 space-y-4">
          <div className="flex items-center justify-center gap-3">
            <Clock className="h-8 w-8 text-muted-foreground" />
            <span className="text-4xl font-mono font-bold">
              {formatTimeRemaining(timeRemaining)}
            </span>
          </div>

          <Progress
            value={progressPercentage}
            className={cn(
              'h-2',
              progressPercentage <= 25 && '[&>div]:bg-red-500',
              progressPercentage > 25 && progressPercentage <= 50 && '[&>div]:bg-amber-500'
            )}
          />

          <p className="text-center text-sm text-muted-foreground">
            Click "Continue Session" to stay logged in
          </p>
        </div>

        <DialogFooter className="flex gap-2 sm:justify-between">
          <Button
            variant="outline"
            onClick={onLogout}
            disabled={isExtending}
          >
            <LogOut className="mr-2 h-4 w-4" />
            Log Out
          </Button>
          <Button onClick={extendSession} disabled={isExtending}>
            {isExtending ? (
              <>
                <RefreshCcw className="mr-2 h-4 w-4 animate-spin" />
                Extending...
              </>
            ) : (
              <>
                <RefreshCcw className="mr-2 h-4 w-4" />
                Continue Session
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Session context for app-wide session management
interface SessionContextValue {
  isAuthenticated: boolean;
  sessionExpiresAt: Date | null;
  resetSession: () => void;
  logout: () => void;
}

const SessionContext = React.createContext<SessionContextValue | null>(null);

export function useSession() {
  const context = React.useContext(SessionContext);
  if (!context) {
    throw new Error('useSession must be used within a SessionProvider');
  }
  return context;
}

interface SessionProviderProps {
  children: React.ReactNode;
  config?: Partial<SessionConfig>;
  onSessionExpire: () => void;
  onSessionExtend?: () => Promise<boolean>;
  onLogout: () => void;
  isAuthenticated: boolean;
}

export function SessionProvider({
  children,
  config,
  onSessionExpire,
  onSessionExtend,
  onLogout,
  isAuthenticated,
}: SessionProviderProps) {
  const [sessionExpiresAt, setSessionExpiresAt] = useState<Date | null>(null);

  const resetSession = useCallback(() => {
    const fullConfig = { ...DEFAULT_CONFIG, ...config };
    setSessionExpiresAt(new Date(Date.now() + fullConfig.sessionDurationMs));
  }, [config]);

  useEffect(() => {
    if (isAuthenticated) {
      resetSession();
    } else {
      setSessionExpiresAt(null);
    }
  }, [isAuthenticated, resetSession]);

  const contextValue: SessionContextValue = {
    isAuthenticated,
    sessionExpiresAt,
    resetSession,
    logout: onLogout,
  };

  return (
    <SessionContext.Provider value={contextValue}>
      {children}
      <SessionTimeout
        config={config}
        onSessionExpire={onSessionExpire}
        onSessionExtend={onSessionExtend}
        onLogout={onLogout}
        enabled={isAuthenticated}
      />
    </SessionContext.Provider>
  );
}

// Session status indicator
interface SessionStatusProps {
  className?: string;
}

export function SessionStatus({ className }: SessionStatusProps) {
  const { sessionExpiresAt, isAuthenticated } = useSession();
  const [timeRemaining, setTimeRemaining] = useState<string>('--:--');

  useEffect(() => {
    if (!sessionExpiresAt || !isAuthenticated) return;

    const updateTime = () => {
      const remaining = sessionExpiresAt.getTime() - Date.now();
      if (remaining <= 0) {
        setTimeRemaining('0:00');
        return;
      }

      const seconds = Math.ceil(remaining / 1000);
      const minutes = Math.floor(seconds / 60);
      const remainingSeconds = seconds % 60;
      setTimeRemaining(`${minutes}:${remainingSeconds.toString().padStart(2, '0')}`);
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);

    return () => clearInterval(interval);
  }, [sessionExpiresAt, isAuthenticated]);

  if (!isAuthenticated) return null;

  return (
    <div className={cn('flex items-center gap-1 text-xs text-muted-foreground', className)}>
      <Clock className="h-3 w-3" />
      <span>{timeRemaining}</span>
    </div>
  );
}

export default SessionTimeout;
