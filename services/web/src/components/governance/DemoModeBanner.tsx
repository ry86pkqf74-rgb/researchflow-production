/**
 * @deprecated Use GovernanceModeControl component instead
 *
 * This component has been superseded by GovernanceModeControl which provides
 * a unified API for all mode banner/indicator variants. DemoModeBanner functionality
 * is now available via:
 *
 * <GovernanceModeControl
 *   variant="banner"
 *   dismissible={true}
 * />
 *
 * This file will be removed in a future release.
 */

import { useState, useEffect } from "react";
import { AlertTriangle, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useGovernanceMode } from "@/hooks/useGovernanceMode";

const DISMISS_KEY = "ros_demo_banner_dismissed";

export function DemoModeBanner() {
  const { isDemo, isLoading } = useGovernanceMode();
  const [isDismissed, setIsDismissed] = useState(false);

  useEffect(() => {
    const dismissed = localStorage.getItem(DISMISS_KEY);
    if (dismissed === "true") {
      setIsDismissed(true);
    }
  }, []);

  const handleDismiss = () => {
    setIsDismissed(true);
    localStorage.setItem(DISMISS_KEY, "true");
  };

  if (isLoading || !isDemo || isDismissed) {
    return null;
  }

  return (
    <div
      className="bg-amber-500 text-amber-950 px-4 py-2 flex items-center justify-between gap-4"
      role="alert"
      data-testid="demo-mode-banner"
    >
      <div className="flex items-center gap-3">
        <AlertTriangle className="h-5 w-5 shrink-0" />
        <span className="text-sm font-medium">
          DEMO MODE - Data is simulated. Uploads and exports are disabled.
        </span>
      </div>
      <Button
        variant="ghost"
        size="sm"
        onClick={handleDismiss}
        className="text-amber-950 shrink-0"
        data-testid="button-dismiss-demo-banner"
      >
        <X className="h-4 w-4" />
        <span className="sr-only">Dismiss</span>
      </Button>
    </div>
  );
}
