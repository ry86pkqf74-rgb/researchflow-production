import { useState } from "react";
import { Lock, Unlock, Activity, ChevronDown, ChevronUp } from "lucide-react";
import { useGovernanceMode, GovernanceMode } from "@/hooks/useGovernanceMode";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

interface ModeConfig {
  color: string;
  bgColor: string;
  borderColor: string;
  icon: typeof Lock;
  label: string;
  description: string;
  allowedOperations: string[];
}

const MODE_CONFIGS: Record<GovernanceMode, ModeConfig> = {
  DEMO: {
    color: "text-amber-600 dark:text-amber-400",
    bgColor: "bg-amber-500/10",
    borderColor: "border-amber-500/30",
    icon: Activity,
    label: "DEMO",
    description: "Demo mode - Synthetic data only",
    allowedOperations: [
      "View data (synthetic only)",
      "Run analyses (synthetic data)",
      "Generate drafts (watermarked)",
      "LLM calls (rate limited)",
      "View all features",
    ],
  },
  LIVE: {
    color: "text-green-600 dark:text-green-400",
    bgColor: "bg-green-500/10",
    borderColor: "border-green-500/30",
    icon: Unlock,
    label: "LIVE",
    description: "Live mode - Full operations enabled",
    allowedOperations: [
      "Upload data (with approval)",
      "Run full analyses",
      "Generate manuscripts",
      "Export results (with approval)",
      "LLM calls (tracked)",
      "Full feature access",
    ],
  },
};

interface ModeIndicatorProps {
  variant?: "compact" | "full";
  showDetails?: boolean;
}

export function ModeIndicator({
  variant = "full",
  showDetails = true,
}: ModeIndicatorProps) {
  const { mode, isLoading } = useGovernanceMode();
  const [isOpen, setIsOpen] = useState(false);

  if (isLoading) {
    return (
      <Badge variant="outline" className="animate-pulse" data-testid="mode-indicator-loading">
        Loading...
      </Badge>
    );
  }

  const config = MODE_CONFIGS[mode];
  const Icon = config.icon;

  if (variant === "compact") {
    return (
      <Badge
        variant="outline"
        className={`${config.bgColor} ${config.color} ${config.borderColor} gap-1.5 cursor-pointer`}
        onClick={() => setIsOpen(!isOpen)}
        data-testid="mode-indicator-compact"
      >
        <Icon className="h-3 w-3" />
        {config.label}
      </Badge>
    );
  }

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card
        className={`${config.borderColor} border-2 ${config.bgColor}`}
        data-testid="mode-indicator"
      >
        <CollapsibleTrigger asChild>
          <CardContent className="p-4 cursor-pointer hover-elevate">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${config.bgColor} ${config.color}`}>
                  <Icon className="h-6 w-6" />
                </div>
                <div>
                  <div className={`font-bold text-lg ${config.color}`} data-testid="mode-label">
                    {config.label}
                  </div>
                  <div className="text-sm text-muted-foreground" data-testid="mode-description">
                    {config.description}
                  </div>
                </div>
              </div>
              {showDetails && (
                <div className="text-muted-foreground" data-testid="mode-expand-trigger">
                  {isOpen ? (
                    <ChevronUp className="h-5 w-5" />
                  ) : (
                    <ChevronDown className="h-5 w-5" />
                  )}
                </div>
              )}
            </div>
          </CardContent>
        </CollapsibleTrigger>

        {showDetails && (
          <CollapsibleContent>
            <div className="px-4 pb-4 border-t border-border/50 pt-4">
              <h4 className="text-sm font-medium mb-3">
                Allowed Operations in {config.label} Mode
              </h4>
              <ul className="space-y-2">
                {config.allowedOperations.map((op) => (
                  <li
                    key={op}
                    className="flex items-center gap-2 text-sm text-muted-foreground"
                  >
                    <div className={`h-1.5 w-1.5 rounded-full ${config.color.replace('text-', 'bg-')}`} />
                    <span>{op}</span>
                  </li>
                ))}
              </ul>
            </div>
          </CollapsibleContent>
        )}
      </Card>
    </Collapsible>
  );
}
