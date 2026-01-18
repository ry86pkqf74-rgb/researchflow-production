import { useState } from "react";
import { ShieldAlert, AlertTriangle, X, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type BannerVariant = "critical" | "warning" | "info";

interface PhiWarningBannerProps {
  variant?: BannerVariant;
  title?: string;
  message?: string;
  phiCount?: number;
  stageId?: number;
  dismissible?: boolean;
  onDismiss?: () => void;
  onViewDetails?: () => void;
  className?: string;
}

const variantStyles: Record<BannerVariant, { bg: string; text: string; border: string }> = {
  critical: {
    bg: "bg-red-600 dark:bg-red-700",
    text: "text-white",
    border: "border-red-700 dark:border-red-600"
  },
  warning: {
    bg: "bg-amber-500 dark:bg-amber-600",
    text: "text-amber-950 dark:text-white",
    border: "border-amber-600 dark:border-amber-500"
  },
  info: {
    bg: "bg-blue-600 dark:bg-blue-700",
    text: "text-white",
    border: "border-blue-700 dark:border-blue-600"
  }
};

const defaultMessages: Record<BannerVariant, { title: string; message: string }> = {
  critical: {
    title: "PHI Detected - Action Required",
    message: "Protected health information has been detected. This operation is blocked until resolved."
  },
  warning: {
    title: "PHI Scan Warning",
    message: "Potential PHI indicators found. Review recommended before proceeding."
  },
  info: {
    title: "PHI Scan in Progress",
    message: "Scanning content for protected health information. Please wait."
  }
};

export function PhiWarningBanner({
  variant = "critical",
  title,
  message,
  phiCount,
  stageId,
  dismissible = false,
  onDismiss,
  onViewDetails,
  className = ""
}: PhiWarningBannerProps) {
  const [isVisible, setIsVisible] = useState(true);

  if (!isVisible) return null;

  const styles = variantStyles[variant];
  const defaults = defaultMessages[variant];
  const displayTitle = title || defaults.title;
  const displayMessage = message || defaults.message;

  const handleDismiss = () => {
    setIsVisible(false);
    onDismiss?.();
  };

  return (
    <div
      className={cn(
        "fixed top-0 left-0 right-0 z-50 px-4 py-2 border-b",
        styles.bg,
        styles.text,
        styles.border,
        className
      )}
      role="alert"
      data-testid={`phi-warning-banner-${variant}`}
    >
      <div className="container mx-auto flex items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3 flex-1 min-w-0">
          <div className="shrink-0">
            {variant === "critical" ? (
              <ShieldAlert className="h-5 w-5" />
            ) : (
              <AlertTriangle className="h-5 w-5" />
            )}
          </div>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 flex-1 min-w-0">
            <span className="font-bold text-sm whitespace-nowrap" data-testid="text-banner-title">
              {displayTitle}
            </span>
            <span className="text-sm opacity-90 hidden sm:inline truncate" data-testid="text-banner-message">
              {displayMessage}
            </span>
          </div>

          {phiCount !== undefined && phiCount > 0 && (
            <Badge
              variant="outline"
              className="shrink-0"
              data-testid="badge-phi-count"
            >
              {phiCount} {phiCount === 1 ? "issue" : "issues"}
            </Badge>
          )}

          {stageId !== undefined && (
            <span className="shrink-0 text-xs opacity-75 hidden md:inline" data-testid="text-banner-stage">
              Stage {stageId}
            </span>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {onViewDetails && (
            <Button
              size="sm"
              variant="ghost"
              className={cn("text-xs", styles.text)}
              onClick={onViewDetails}
              data-testid="button-phi-banner-details"
            >
              View Details
              <ChevronRight className="w-3 h-3 ml-1" />
            </Button>
          )}

          {dismissible && (
            <Button
              size="icon"
              variant="ghost"
              className={styles.text}
              onClick={handleDismiss}
              aria-label="Dismiss PHI warning banner"
              data-testid="button-phi-banner-dismiss"
            >
              <X className="h-4 w-4" />
              <span className="sr-only">Dismiss</span>
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
