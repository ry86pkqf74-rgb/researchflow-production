import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useGovernanceMode, GovernanceMode } from "@/hooks/useGovernanceMode";

export interface GovernanceBadgeProps {
  mode?: GovernanceMode;
  showTooltip?: boolean;
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
  STANDBY: {
    label: "Standby Mode",
    className: "bg-gray-100 text-gray-700 border-gray-300 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-600",
    tooltipText: "System is in standby. Data processing is paused.",
  },
  LIVE: {
    label: "Live Mode",
    className: "bg-green-100 text-green-800 border-green-300 dark:bg-green-900/30 dark:text-green-300 dark:border-green-700",
    tooltipText: "Live mode with full access to real data and all features enabled.",
  },
};

export function GovernanceBadge({ mode: propMode, showTooltip = false }: GovernanceBadgeProps) {
  const { mode: hookMode, isLoading } = useGovernanceMode();
  const currentMode = propMode ?? hookMode;

  if (isLoading && !propMode) {
    return (
      <Badge variant="outline" className="animate-pulse">
        Loading...
      </Badge>
    );
  }

  const config = MODE_CONFIGS[currentMode] ?? MODE_CONFIGS.STANDBY;

  const badge = (
    <Badge
      variant="outline"
      className={config.className}
      aria-label={`Current governance mode: ${config.label}`}
    >
      {config.label}
    </Badge>
  );

  if (!showTooltip) {
    return badge;
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>{badge}</TooltipTrigger>
        <TooltipContent>
          <p className="max-w-xs">{config.tooltipText}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
