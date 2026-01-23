import { useLocation } from "wouter";
import { useGovernanceMode } from "@/hooks/useGovernanceMode";

// Pages where the DEMO watermark should NOT appear (public/landing pages)
const LANDING_PAGES = ['/', '/landing', '/demo', '/login', '/register', '/forgot-password', '/terms', '/privacy'];

export function DemoWatermark() {
  const { isDemo, isLoading } = useGovernanceMode();
  const [location] = useLocation();

  if (isLoading || !isDemo) {
    return null;
  }

  // Hide watermark on landing/public pages
  if (LANDING_PAGES.includes(location)) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-50 pointer-events-none overflow-hidden"
      aria-hidden="true"
      data-testid="demo-watermark"
    >
      <div className="absolute inset-0 flex items-center justify-center">
        <div
          className="text-8xl font-bold text-muted-foreground/10 whitespace-nowrap select-none"
          style={{
            transform: "rotate(-45deg)",
            letterSpacing: "0.2em",
          }}
        >
          DEMO MODE
        </div>
      </div>
    </div>
  );
}
