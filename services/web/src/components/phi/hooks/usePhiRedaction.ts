import { useState, useCallback, useEffect, useRef } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useGovernanceMode } from "@/hooks/useGovernanceMode";

export type PhiType = 
  | "SSN" 
  | "MRN" 
  | "DOB" 
  | "NAME" 
  | "ADDRESS" 
  | "PHONE" 
  | "EMAIL" 
  | "OTHER";

export interface PhiItem {
  id: string;
  type: PhiType;
  value: string;
}

export interface UsePhiRedactionOptions {
  autoHideTimeout?: number;
}

export interface UsePhiRedactionReturn {
  revealedIds: Set<string>;
  canReveal: boolean;
  isRevealed: (id: string) => boolean;
  reveal: (id: string) => Promise<boolean>;
  hide: (id: string) => void;
  hideAll: () => void;
  logRevealAttempt: (id: string, phiType: PhiType, success: boolean) => Promise<void>;
}

const ALLOWED_REVEAL_ROLES = ["ANALYST", "RESEARCHER", "STEWARD", "ADMIN"];

export function usePhiRedaction(
  options: UsePhiRedactionOptions = {}
): UsePhiRedactionReturn {
  const { autoHideTimeout = 30000 } = options;
  const [revealedIds, setRevealedIds] = useState<Set<string>>(new Set());
  const timeoutRefs = useRef<Map<string, NodeJS.Timeout>>(new Map());
  
  const { user, isAuthenticated } = useAuth();
  const { isDemo, isLoading: isGovernanceLoading } = useGovernanceMode();

  const userRole = (user as any)?.role || "VIEWER";
  const hasPermission = ALLOWED_REVEAL_ROLES.includes(userRole);
  const canReveal = !isDemo && isAuthenticated && hasPermission && !isGovernanceLoading;

  useEffect(() => {
    return () => {
      timeoutRefs.current.forEach((timeout) => clearTimeout(timeout));
      timeoutRefs.current.clear();
    };
  }, []);

  const logRevealAttempt = useCallback(
    async (id: string, phiType: PhiType, success: boolean): Promise<void> => {
      try {
        await fetch("/api/audit/phi-reveal", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "include",
          body: JSON.stringify({
            phiId: id,
            phiType,
            action: success ? "REVEAL" : "REVEAL_DENIED",
            timestamp: new Date().toISOString(),
            userId: user?.id,
            userRole,
            governanceMode: isDemo ? "DEMO" : "LIVE",
          }),
        });
      } catch (error) {
        console.error("Failed to log PHI reveal attempt:", error);
      }
    },
    [user?.id, userRole, isDemo]
  );

  const reveal = useCallback(
    async (id: string): Promise<boolean> => {
      if (!canReveal) {
        return false;
      }

      setRevealedIds((prev) => {
        const next = new Set(prev);
        next.add(id);
        return next;
      });

      if (autoHideTimeout > 0) {
        const existingTimeout = timeoutRefs.current.get(id);
        if (existingTimeout) {
          clearTimeout(existingTimeout);
        }

        const timeout = setTimeout(() => {
          setRevealedIds((prev) => {
            const next = new Set(prev);
            next.delete(id);
            return next;
          });
          timeoutRefs.current.delete(id);
        }, autoHideTimeout);

        timeoutRefs.current.set(id, timeout);
      }

      return true;
    },
    [canReveal, autoHideTimeout]
  );

  const hide = useCallback((id: string): void => {
    const existingTimeout = timeoutRefs.current.get(id);
    if (existingTimeout) {
      clearTimeout(existingTimeout);
      timeoutRefs.current.delete(id);
    }

    setRevealedIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }, []);

  const hideAll = useCallback((): void => {
    timeoutRefs.current.forEach((timeout) => clearTimeout(timeout));
    timeoutRefs.current.clear();
    setRevealedIds(new Set());
  }, []);

  const isRevealed = useCallback(
    (id: string): boolean => {
      return revealedIds.has(id);
    },
    [revealedIds]
  );

  return {
    revealedIds,
    canReveal,
    isRevealed,
    reveal,
    hide,
    hideAll,
    logRevealAttempt,
  };
}
