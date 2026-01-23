import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useGovernanceMode, GovernanceMode } from "@/hooks/useGovernanceMode";
import { ModeSwitcher } from "./ModeSwitcher";

export interface GovernanceBadgeProps {
  mode?: GovernanceMode;
  showTooltip?: boolean;
  clickable?: boolean;
}

interface ModeConfig {
  label: string;
  className: string;
  tooltipText: string;
}

const MODE_CONFIGS: Record<GovernanceMode, ModeConfig> = {
  DEMO: {
    label: "Demo Mode",
    className: "bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-700",
    tooltipText: "Demo mode uses synthetic data only. No real patient data is accessible.",
  },
  LIVE: {
    label: "Live Mode",
    className: "bg-green-100 text-green-800 border-green-300 dark:bg-green-900/30 dark:text-green-300 dark:border-green-700",
    tooltipText: "Live mode with full access to real data and all features enabled.",
  },
};

export function GovernanceBadge({ mode: propMode, showTooltip = false, clickable = false }: GovernanceBadgeProps) {
  const { mode: hookMode, isLoading } = useGovernanceMode();
  const currentMode = propMode ?? hookMode;
  const [switcherOpen, setSwitcherOpen] = useState(false);

  if (isLoading && !propMode) {
    return (
      <Badge variant="outline" className="animate-pulse">
        Loading...
      </Badge>
    );
  }

  const config = MODE_CONFIGS[currentMode] ?? MODE_CONFIGS.DEMO;

  const badge = (
    <Badge
      variant="outline"
      className={`${config.className} ${clickable ? "cursor-pointer hover:opacity-80 transition-opacity" : ""}`}
      aria-label={`Current governance mode: ${config.label}`}
      onClick={clickable ? (e: React.MouseEvent) => {
        // Stop propagation to prevent parent anchor tags from navigating
        e.stopPropagation();
        e.preventDefault();
        console.log('[GovernanceBadge] Badge clicked, opening switcher');
        setSwitcherOpen(true);
      } : undefined}
      role={clickable ? "button" : undefined}
    >
      {config.label}
    </Badge>
  );

  if (!showTooltip) {
    return (
      <>
        {badge}
        {clickable && (
          <ModeSwitcher
            currentMode={currentMode}
            open={switcherOpen}
            onOpenChange={setSwitcherOpen}
          />
        )}
      </>
    );
  }

  return (
    <>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>{badge}</TooltipTrigger>
          <TooltipContent>
            <p className="max-w-xs">{config.tooltipText}</p>
            {clickable && (
              <p className="text-xs text-muted-foreground mt-1">Click to change mode</p>
            )}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
      {clickable && (
        <ModeSwitcher
          currentMode={currentMode}
          open={switcherOpen}
          onOpenChange={setSwitcherOpen}
        />
      )}
    </>
  );
}
