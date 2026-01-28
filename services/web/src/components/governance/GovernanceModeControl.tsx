/**
 * GovernanceModeControl Component
 *
 * Unified governance mode control component that consolidates DemoModeBanner,
 * ModeIndicator, and ModeBanner into a single, flexible component with multiple
 * display variants.
 *
 * Supports three variants:
 * - 'banner': Dismissible alert banner with optional mode switching
 * - 'indicator': Detailed expandable mode indicator with operations list
 * - 'compact': Compact badge-style indicator for inline use
 *
 * Features:
 * - Governance mode status display
 * - Optional dismissibility with localStorage persistence
 * - Optional mode switching integration
 * - Responsive design with dark mode support
 * - Full accessibility support
 */

import { useState, useEffect } from "react";
import {
  AlertTriangle,
  X,
  Lock,
  Unlock,
  Activity,
  ChevronDown,
  ChevronUp,
  ArrowRight,
  Info,
  Zap,
  WifiOff,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { useGovernanceMode, GovernanceMode } from "@/hooks/useGovernanceMode";
import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "wouter";
import { ModeSwitcher } from "@/components/governance/ModeSwitcher";

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
  OFFLINE: {
    color: "text-amber-600 dark:text-amber-400",
    bgColor: "bg-amber-500/10",
    borderColor: "border-amber-500/30",
    icon: WifiOff,
    label: "OFFLINE",
    description: "Offline mode - AI disabled",
    allowedOperations: [
      "View data",
      "Manual data entry",
      "Run basic analyses",
      "Local operations only",
      "No AI assistance",
    ],
  },
};

// Pages where the banner should NOT appear (public/landing pages)
const LANDING_PAGES = [
  "/",
  "/landing",
  "/demo",
  "/login",
  "/register",
  "/forgot-password",
  "/terms",
  "/privacy",
];

type GovernanceModeVariant = "banner" | "indicator" | "compact";

export interface GovernanceModeControlProps {
  /**
   * Display variant
   * - 'banner': Full-width dismissible banner (default)
   * - 'indicator': Detailed expandable indicator with mode details
   * - 'compact': Minimal badge-style indicator
   */
  variant?: GovernanceModeVariant;

  /**
   * Show detailed information (operations list, descriptions)
   * Only applicable to 'indicator' variant
   * @default true
   */
  showDetails?: boolean;

  /**
   * Enable dismissibility and localStorage persistence
   * Only applicable to 'banner' variant
   * @default true
   */
  dismissible?: boolean;

  /**
   * Custom localStorage key for dismissal state
   * Only applicable to 'banner' variant
   * @default 'ros_governance_mode_dismissed'
   */
  dismissKeyPrefix?: string;

  /**
   * Enable mode switching capability
   * Shows "Switch to LIVE Mode" button for authenticated users in DEMO mode
   * @default false
   */
  enableModeSwitching?: boolean;

  /**
   * Hide banner on landing/public pages
   * Only applicable to 'banner' variant
   * @default true
   */
  hideOnLandingPages?: boolean;

  /**
   * Custom banner message for DEMO mode
   * Only applicable to 'banner' variant
   */
  demoMessage?: string;
}

/**
 * Banner variant - Dismissible alert banner with mode information
 */
function BannerVariant({
  dismissible,
  dismissKeyPrefix,
  enableModeSwitching,
  hideOnLandingPages,
  demoMessage,
}: Omit<GovernanceModeControlProps, "variant" | "showDetails">) {
  const { mode, isDemo, isLoading } = useGovernanceMode();
  const { isAuthenticated } = useAuth();
  const [location] = useLocation();
  const [isDismissed, setIsDismissed] = useState(false);
  const [switcherOpen, setSwitcherOpen] = useState(false);

  const dismissKey = `${dismissKeyPrefix || "ros_governance_mode"}_dismissed`;

  useEffect(() => {
    if (dismissible) {
      const dismissed = localStorage.getItem(dismissKey);
      if (dismissed === "true") {
        setIsDismissed(true);
      }
    }
  }, [dismissible, dismissKey]);

  const handleDismiss = () => {
    setIsDismissed(true);
    if (dismissible) {
      localStorage.setItem(dismissKey, "true");
    }
  };

  // Hide when loading
  if (isLoading) {
    return null;
  }

  // Hide in LIVE mode or when already dismissed
  if (!isDemo || isDismissed) {
    return null;
  }

  // Hide on landing pages if configured
  if (hideOnLandingPages && LANDING_PAGES.includes(location)) {
    return null;
  }

  const config = MODE_CONFIGS[mode];
  const defaultMessage =
    "DEMO MODE — Explore how ResearchFlow Canvas works. No login required. AI responses are simulated.";

  return (
    <>
      <div
        className="bg-amber-500 text-amber-950 px-4 py-3 flex items-center justify-between fixed top-16 left-0 right-0 z-40"
        role="alert"
        data-testid="governance-mode-banner"
      >
        <div className="flex items-center gap-2">
          <AlertTriangle
            className="h-4 w-4 shrink-0"
            aria-hidden="true"
          />
          <span className="text-sm font-semibold" data-testid="text-governance-mode-message">
            {demoMessage || defaultMessage}
          </span>
        </div>
        <div className="flex items-center gap-2 ml-auto">
          {enableModeSwitching && isAuthenticated && (
            <button
              onClick={() => setSwitcherOpen(true)}
              className="flex items-center gap-1 text-sm font-bold underline whitespace-nowrap hover:opacity-80 transition-opacity mr-4"
              data-testid="link-switch-to-live"
            >
              Switch to LIVE Mode
              <ArrowRight className="h-3 w-3" aria-hidden="true" />
            </button>
          )}
          {dismissible && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleDismiss}
              className="text-amber-950 shrink-0"
              data-testid="button-dismiss-mode-banner"
            >
              <X className="h-4 w-4" />
              <span className="sr-only">Dismiss</span>
            </Button>
          )}
        </div>
      </div>
      {enableModeSwitching && isAuthenticated && (
        <ModeSwitcher
          currentMode={mode}
          open={switcherOpen}
          onOpenChange={setSwitcherOpen}
        />
      )}
    </>
  );
}

/**
 * Indicator variant - Detailed expandable mode indicator
 */
function IndicatorVariant({
  showDetails,
}: Omit<GovernanceModeControlProps, "variant" | "dismissible" | "dismissKeyPrefix" | "enableModeSwitching" | "hideOnLandingPages" | "demoMessage">) {
  const { mode, isLoading } = useGovernanceMode();
  const [isOpen, setIsOpen] = useState(false);

  if (isLoading) {
    return (
      <Badge
        variant="outline"
        className="animate-pulse"
        data-testid="governance-mode-indicator-loading"
      >
        Loading...
      </Badge>
    );
  }

  const config = MODE_CONFIGS[mode];
  const Icon = config.icon;

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card
        className={`${config.borderColor} border-2 ${config.bgColor}`}
        data-testid="governance-mode-indicator"
      >
        <CollapsibleTrigger asChild>
          <CardContent className="p-4 cursor-pointer hover-elevate">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div
                  className={`p-2 rounded-lg ${config.bgColor} ${config.color}`}
                >
                  <Icon className="h-6 w-6" />
                </div>
                <div>
                  <div
                    className={`font-bold text-lg ${config.color}`}
                    data-testid="mode-label"
                  >
                    {config.label}
                  </div>
                  <div
                    className="text-sm text-muted-foreground"
                    data-testid="mode-description"
                  >
                    {config.description}
                  </div>
                </div>
              </div>
              {showDetails && (
                <div
                  className="text-muted-foreground"
                  data-testid="mode-expand-trigger"
                >
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
                    <div
                      className={`h-1.5 w-1.5 rounded-full ${config.color.replace("text-", "bg-")}`}
                    />
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

/**
 * Compact variant - Minimal badge-style indicator
 */
function CompactVariant() {
  const { mode, isLoading } = useGovernanceMode();
  const [isOpen, setIsOpen] = useState(false);

  if (isLoading) {
    return (
      <Badge
        variant="outline"
        className="animate-pulse"
        data-testid="governance-mode-compact-loading"
      >
        Loading...
      </Badge>
    );
  }

  const config = MODE_CONFIGS[mode];
  const Icon = config.icon;

  return (
    <Badge
      variant="outline"
      className={`${config.bgColor} ${config.color} ${config.borderColor} gap-1.5 cursor-pointer`}
      onClick={() => setIsOpen(!isOpen)}
      data-testid="governance-mode-compact"
    >
      <Icon className="h-3 w-3" />
      {config.label}
    </Badge>
  );
}

/**
 * GovernanceModeControl - Unified governance mode display component
 *
 * Consolidates DemoModeBanner, ModeIndicator, and ModeBanner into a single
 * flexible component with support for multiple display variants.
 *
 * @example
 * // Simple banner (dismissible)
 * <GovernanceModeControl variant="banner" />
 *
 * @example
 * // Detailed indicator with operations list
 * <GovernanceModeControl variant="indicator" showDetails={true} />
 *
 * @example
 * // Compact badge for inline use
 * <GovernanceModeControl variant="compact" />
 *
 * @example
 * // Banner with mode switching capability
 * <GovernanceModeControl
 *   variant="banner"
 *   enableModeSwitching={true}
 *   dismissible={true}
 * />
 */
export function GovernanceModeControl({
  variant = "banner",
  showDetails = true,
  dismissible = true,
  dismissKeyPrefix,
  enableModeSwitching = false,
  hideOnLandingPages = true,
  demoMessage,
}: GovernanceModeControlProps) {
  switch (variant) {
    case "indicator":
      return <IndicatorVariant showDetails={showDetails} />;
    case "compact":
      return <CompactVariant />;
    case "banner":
    default:
      return (
        <BannerVariant
          dismissible={dismissible}
          dismissKeyPrefix={dismissKeyPrefix}
          enableModeSwitching={enableModeSwitching}
          hideOnLandingPages={hideOnLandingPages}
          demoMessage={demoMessage}
        />
      );
  }
}
