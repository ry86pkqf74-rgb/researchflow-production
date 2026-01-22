/**
 * ModeBanner Component
 * 
 * Prominent sticky banner showing current mode (DEMO or LIVE).
 * - DEMO: Amber banner with mode switch link
 * - LIVE: Green banner confirming full functionality
 */

import { useState } from 'react';
import { useGovernanceMode } from '@/hooks/useGovernanceMode';
import { ModeSwitcher } from '@/components/governance/ModeSwitcher';
import { AlertTriangle, CheckCircle, ArrowRight } from 'lucide-react';

export function ModeBanner() {
  const { mode, isDemo, isLive, isLoading } = useGovernanceMode();
  const [switcherOpen, setSwitcherOpen] = useState(false);
  
  if (isLoading) {
    return null;
  }
  
  if (isDemo) {
    return (
      <>
        <div 
          className="bg-amber-500 text-amber-950 px-4 py-3 flex items-center justify-center gap-4 fixed top-16 left-0 right-0 z-40"
          role="alert"
          data-testid="mode-banner-demo"
        >
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span className="text-sm font-semibold" data-testid="text-demo-mode-message">
              DEMO MODE — Explore how ResearchFlow Canvas works. No login required. AI responses are simulated.
            </span>
          </div>
          <button
            onClick={() => {
              console.log('[ModeBanner] Switch button clicked');
              setSwitcherOpen(true);
            }}
            className="flex items-center gap-1 text-sm font-bold underline whitespace-nowrap hover:opacity-80 transition-opacity"
            data-testid="link-switch-to-live"
          >
            Switch to LIVE Mode
            <ArrowRight className="h-3 w-3" aria-hidden="true" />
          </button>
        </div>
        <ModeSwitcher
          currentMode={mode}
          open={switcherOpen}
          onOpenChange={setSwitcherOpen}
        />
      </>
    );
  }
  
  if (isLive) {
    return (
      <div
        className="bg-green-600 text-white px-4 py-1.5 flex items-center justify-center gap-2 fixed top-16 left-0 right-0 z-40"
        role="status"
        data-testid="mode-banner-live"
      >
        <CheckCircle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        <span className="text-xs font-medium" data-testid="text-live-mode-message">
          LIVE MODE — Full functionality enabled. All AI calls are real.
        </span>
      </div>
    );
  }
  
  return null;
}
