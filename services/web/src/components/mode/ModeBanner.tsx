/**
 * ModeBanner Component
 * 
 * Prominent sticky banner showing current mode (DEMO or LIVE).
 * - DEMO: Amber banner with login link
 * - LIVE: Green banner confirming full functionality
 */

import { useModeStore } from '@/stores/mode-store';
import { AlertTriangle, CheckCircle, ArrowRight } from 'lucide-react';

export function ModeBanner() {
  const { isDemo, isLive, isLoading } = useModeStore();
  
  if (isLoading) {
    return null;
  }
  
  if (isDemo) {
    return (
      <div 
        className="bg-amber-500 text-amber-950 px-4 py-3 flex items-center justify-center gap-4 sticky top-0 z-50"
        role="alert"
        data-testid="mode-banner-demo"
      >
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span className="text-sm font-semibold" data-testid="text-demo-mode-message">
            DEMO MODE — Explore how ResearchFlow Canvas works. No login required. AI responses are simulated.
          </span>
        </div>
        <a 
          href="/api/login" 
          className="flex items-center gap-1 text-sm font-bold underline whitespace-nowrap"
          data-testid="link-switch-to-live"
        >
          Switch to LIVE Mode
          <ArrowRight className="h-3 w-3" aria-hidden="true" />
        </a>
      </div>
    );
  }
  
  if (isLive) {
    return (
      <div 
        className="bg-green-600 text-white px-4 py-2 flex items-center justify-center gap-2 sticky top-0 z-50"
        role="status"
        data-testid="mode-banner-live"
      >
        <CheckCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
        <span className="text-sm font-medium" data-testid="text-live-mode-message">
          LIVE MODE — Full functionality enabled. All AI calls are real.
        </span>
      </div>
    );
  }
  
  return null;
}
