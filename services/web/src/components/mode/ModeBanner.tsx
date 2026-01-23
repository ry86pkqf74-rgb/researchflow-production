/**
 * ModeBanner Component
 *
 * Prominent banner showing DEMO mode warning.
 * Only displays in DEMO mode on authenticated pages - hidden on landing pages and in LIVE mode.
 * The "Switch to LIVE Mode" option is only available after login.
 */

import { useState } from 'react';
import { useLocation } from 'wouter';
import { useGovernanceMode } from '@/hooks/useGovernanceMode';
import { useAuth } from '@/hooks/use-auth';
import { ModeSwitcher } from '@/components/governance/ModeSwitcher';
import { AlertTriangle, ArrowRight } from 'lucide-react';

// Pages where the DEMO banner should NOT appear (public/landing pages)
const LANDING_PAGES = ['/', '/landing', '/demo', '/login', '/register', '/forgot-password', '/terms', '/privacy'];

export function ModeBanner() {
  const { mode, isDemo, isLoading } = useGovernanceMode();
  const { isAuthenticated } = useAuth();
  const [location] = useLocation();
  const [switcherOpen, setSwitcherOpen] = useState(false);

  // Hide banner when loading or in LIVE mode
  if (isLoading || !isDemo) {
    return null;
  }

  // Hide banner on landing/public pages - no DEMO banner needed there
  if (LANDING_PAGES.includes(location)) {
    return null;
  }

  return (
    <>
      <div
        className="bg-amber-500 text-amber-950 px-4 py-3 flex items-center justify-between fixed top-16 left-0 right-0 z-40"
        role="alert"
        data-testid="mode-banner-demo"
      >
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span className="text-sm font-semibold" data-testid="text-demo-mode-message">
            DEMO MODE — Explore how ResearchFlow Canvas works. No login required. AI responses are simulated.
          </span>
        </div>
        {/* Only show Switch to LIVE Mode button when user is authenticated */}
        {isAuthenticated && (
          <button
            onClick={() => {
              console.log('[ModeBanner] Switch button clicked');
              setSwitcherOpen(true);
            }}
            className="flex items-center gap-1 text-sm font-bold underline whitespace-nowrap hover:opacity-80 transition-opacity ml-auto mr-4"
            data-testid="link-switch-to-live"
          >
            Switch to LIVE Mode
            <ArrowRight className="h-3 w-3" aria-hidden="true" />
          </button>
        )}
      </div>
      {isAuthenticated && (
        <ModeSwitcher
          currentMode={mode}
          open={switcherOpen}
          onOpenChange={setSwitcherOpen}
        />
      )}
    </>
  );
}
