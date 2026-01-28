/**
 * Enhanced Mode Banner Component (Phase 4C - RUN-001)
 *
 * Displays current execution mode (DEMO/LIVE) with PHI protection status indicator.
 * Shows governance state and data protection level alongside mode information.
 * Hidden on landing pages (/login, /register, etc.)
 *
 * Features:
 * - Mode indicator (DEMO/LIVE)
 * - PHI status badge (safe/sensitive/redacted)
 * - Governance state display
 * - Mode switching for authenticated users
 */

import { useState } from 'react';
import { useLocation } from 'wouter';
import { useGovernanceMode } from '@/hooks/useGovernanceMode';
import { useAuth } from '@/hooks/use-auth';
import { ModeSwitcher } from '@/components/governance/ModeSwitcher';
import { AlertTriangle, ArrowRight, Shield, AlertCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

// Pages where the banner should NOT appear (public/landing pages)
const LANDING_PAGES = ['/', '/landing', '/demo', '/login', '/register', '/forgot-password', '/terms', '/privacy'];

type PHIStatus = 'safe' | 'sensitive' | 'redacted';

export function ModeBanner() {
  const { mode, isDemo, isLoading } = useGovernanceMode();
  const { isAuthenticated } = useAuth();
  const [location] = useLocation();
  const [switcherOpen, setSwitcherOpen] = useState(false);

  // Determine PHI status (can be connected to actual governance store)
  const phiStatus: PHIStatus = isDemo ? 'safe' : 'sensitive';
  const governanceState = isDemo ? 'demo' : 'live';

  // Hide banner when loading
  if (isLoading) {
    return null;
  }

  // Hide banner on landing/public pages
  if (LANDING_PAGES.includes(location)) {
    return null;
  }

  // For DEMO mode
  if (isDemo) {
    return (
      <>
        <div
          className="bg-amber-500 text-amber-950 px-4 py-3 flex items-center justify-between fixed top-16 left-0 right-0 z-40"
          role="alert"
          data-testid="mode-banner-demo"
        >
          <div className="flex items-center gap-3">
            <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span className="text-sm font-semibold" data-testid="text-demo-mode-message">
              DEMO MODE — Explore how ResearchFlow Canvas works. No login required. AI responses are simulated.
            </span>
            <Badge variant="outline" className="bg-amber-600/20 text-amber-900 border-amber-600/30">
              {phiStatus === 'safe' && 'PHI Safe'}
              {phiStatus === 'sensitive' && 'PHI Sensitive'}
              {phiStatus === 'redacted' && 'PHI Redacted'}
            </Badge>
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

  // For LIVE mode - show governance banner
  return (
    <div
      className="bg-blue-900 text-blue-50 px-4 py-2.5 flex items-center justify-between fixed top-16 left-0 right-0 z-40"
      role="alert"
      data-testid="mode-banner-live"
    >
      <div className="flex items-center gap-3">
        <Shield className="h-4 w-4 shrink-0" aria-hidden="true" />
        <span className="text-sm font-semibold" data-testid="text-live-mode-message">
          LIVE MODE
        </span>
        <Badge variant="outline" className="bg-blue-800 text-blue-100 border-blue-700">
          Governance: Enhanced
        </Badge>
        <Badge
          variant="outline"
          className={`${
            phiStatus === 'safe'
              ? 'bg-green-800/50 text-green-100 border-green-700'
              : phiStatus === 'sensitive'
              ? 'bg-yellow-800/50 text-yellow-100 border-yellow-700'
              : 'bg-red-800/50 text-red-100 border-red-700'
          }`}
        >
          {phiStatus === 'safe' && <Shield className="h-3 w-3 mr-1" aria-hidden="true" />}
          {phiStatus === 'sensitive' && <AlertCircle className="h-3 w-3 mr-1" aria-hidden="true" />}
          {phiStatus === 'redacted' && <AlertTriangle className="h-3 w-3 mr-1" aria-hidden="true" />}
          {phiStatus === 'safe' && 'PHI Safe'}
          {phiStatus === 'sensitive' && 'PHI Sensitive'}
          {phiStatus === 'redacted' && 'PHI Redacted'}
        </Badge>
      </div>
    </div>
  );
}
