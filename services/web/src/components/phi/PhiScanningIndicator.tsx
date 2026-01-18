import { useState, useEffect } from "react";
import { Shield, Loader2 } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

type ScanStage = "initializing" | "scanning" | "analyzing" | "finalizing";

interface PhiScanningIndicatorProps {
  progress?: number;
  currentStage?: ScanStage;
  itemsScanned?: number;
  totalItems?: number;
  variant?: "default" | "compact" | "inline";
  className?: string;
}

const stageLabels: Record<ScanStage, string> = {
  initializing: "Initializing PHI scanner...",
  scanning: "Scanning for protected health information...",
  analyzing: "Analyzing potential identifiers...",
  finalizing: "Finalizing scan results..."
};

const stageDescriptions: Record<ScanStage, string> = {
  initializing: "Loading PHI detection models",
  scanning: "Checking for SSN, MRN, names, DOB, and other identifiers",
  analyzing: "Evaluating confidence scores for detections",
  finalizing: "Generating compliance report"
};

export function PhiScanningIndicator({
  progress: externalProgress,
  currentStage = "scanning",
  itemsScanned,
  totalItems,
  variant = "default",
  className = ""
}: PhiScanningIndicatorProps) {
  const [internalProgress, setInternalProgress] = useState(0);

  useEffect(() => {
    if (externalProgress === undefined) {
      const interval = setInterval(() => {
        setInternalProgress((prev) => {
          if (prev >= 95) return prev;
          return prev + Math.random() * 5;
        });
      }, 300);
      return () => clearInterval(interval);
    }
  }, [externalProgress]);

  const progress = externalProgress ?? internalProgress;

  if (variant === "inline") {
    return (
      <div
        className={cn("flex flex-wrap items-center gap-2 text-sm", className)}
        data-testid="phi-scanning-indicator-inline"
      >
        <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
        <span className="text-muted-foreground">Scanning for PHI...</span>
        <span className="font-medium">{Math.round(progress)}%</span>
      </div>
    );
  }

  if (variant === "compact") {
    return (
      <div
        className={cn(
          "flex flex-wrap items-center gap-3 p-3 rounded-lg border bg-card",
          className
        )}
        data-testid="phi-scanning-indicator-compact"
      >
        <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
          <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 text-sm mb-1">
            <span className="font-medium truncate">{stageLabels[currentStage]}</span>
            <span className="text-muted-foreground ml-2">{Math.round(progress)}%</span>
          </div>
          <Progress value={progress} className="h-1.5" />
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "p-4 rounded-lg border bg-card space-y-4",
        className
      )}
      data-testid="phi-scanning-indicator"
    >
      <div className="flex flex-wrap items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
          <div className="relative">
            <Shield className="w-5 h-5 text-blue-500" />
            <Loader2 className="w-3 h-3 text-blue-500 absolute -bottom-1 -right-1 animate-spin" />
          </div>
        </div>
        <div>
          <h4 className="font-medium text-sm">{stageLabels[currentStage]}</h4>
          <p className="text-xs text-muted-foreground">
            {stageDescriptions[currentStage]}
          </p>
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2 text-sm">
          <span className="text-muted-foreground">Progress</span>
          <span className="font-medium">{Math.round(progress)}%</span>
        </div>
        <Progress value={progress} className="h-2" />
      </div>

      {itemsScanned !== undefined && totalItems !== undefined && (
        <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground pt-1 border-t">
          <span>Items scanned</span>
          <span className="font-mono">{itemsScanned} / {totalItems}</span>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
        <span>PHI detection in progress - do not close this window</span>
      </div>
    </div>
  );
}
