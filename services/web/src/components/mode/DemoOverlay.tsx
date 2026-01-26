/**
 * DemoOverlay Component
 * 
 * Visual indicator wrapper for AI-generated content in DEMO mode.
 * Shows a DEMO badge and dashed border around simulated content.
 */

import { useModeStore } from '@/stores/mode-store';

interface DemoOverlayProps {
  children: React.ReactNode;
  className?: string;
}

export function DemoOverlay({ children, className = '' }: DemoOverlayProps) {
  const { isDemo } = useModeStore();
  
  if (!isDemo) {
    return <>{children}</>;
  }
  
  return (
    <div className={`relative ${className}`} data-testid="demo-overlay-wrapper">
      <span 
        className="absolute top-2 right-2 bg-amber-500 text-amber-950 text-xs px-2 py-1 rounded font-bold z-10"
        data-testid="badge-demo-indicator"
        aria-label="Demo mode content"
      >
        DEMO
      </span>
      <div className="border-2 border-dashed border-amber-400 rounded-lg p-2" data-testid="demo-overlay-border">
        {children}
      </div>
    </div>
  );
}
