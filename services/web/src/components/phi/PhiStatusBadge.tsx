import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { 
  ShieldCheck, 
  ShieldAlert, 
  ShieldQuestion,
  AlertTriangle
} from "lucide-react";

export type PhiStatus = "PASS" | "FAIL" | "OVERRIDDEN" | "UNCHECKED";

interface PhiStatusBadgeProps {
  status: PhiStatus;
  lastScanDate?: string;
  scanId?: string;
  findingsCount?: number;
  overrideReason?: string;
  className?: string;
}

export function PhiStatusBadge({
  status,
  lastScanDate,
  scanId,
  findingsCount,
  overrideReason,
  className = ""
}: PhiStatusBadgeProps) {
  const getStatusConfig = () => {
    switch (status) {
      case "PASS":
        return {
          variant: "outline" as const,
          className: "border-green-500/50 text-green-600 dark:text-green-400 bg-green-500/10",
          icon: <ShieldCheck className="w-3 h-3" />,
          label: "PHI: PASS",
          description: "No protected health information detected"
        };
      case "FAIL":
        return {
          variant: "outline" as const,
          className: "border-red-500/50 text-red-600 dark:text-red-400 bg-red-500/10",
          icon: <ShieldAlert className="w-3 h-3" />,
          label: "PHI: FAIL",
          description: `Protected health information detected${findingsCount ? ` (${findingsCount} issues)` : ""}`
        };
      case "OVERRIDDEN":
        return {
          variant: "outline" as const,
          className: "border-amber-500/50 text-amber-600 dark:text-amber-400 bg-amber-500/10",
          icon: <AlertTriangle className="w-3 h-3" />,
          label: "PHI: OVERRIDE",
          description: overrideReason || "PHI check was overridden with justification"
        };
      case "UNCHECKED":
      default:
        return {
          variant: "outline" as const,
          className: "border-muted-foreground/50 text-muted-foreground bg-muted/50",
          icon: <ShieldQuestion className="w-3 h-3" />,
          label: "PHI: UNCHECKED",
          description: "PHI scan has not been performed"
        };
    }
  };

  const config = getStatusConfig();
  const formattedDate = lastScanDate 
    ? format(new Date(lastScanDate), "MMM d, yyyy HH:mm")
    : null;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Badge
          variant={config.variant}
          className={`${config.className} ${className} cursor-help gap-1`}
          data-testid={`phi-status-badge-${status.toLowerCase()}`}
        >
          {config.icon}
          <span className="text-xs">{config.label}</span>
        </Badge>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-xs">
        <div className="space-y-1">
          <p className="font-medium">{config.description}</p>
          {formattedDate && (
            <p className="text-xs text-muted-foreground">
              Last scanned: {formattedDate}
            </p>
          )}
          {scanId && (
            <p className="text-xs text-muted-foreground font-mono">
              Scan ID: {scanId}
            </p>
          )}
          {status === "OVERRIDDEN" && overrideReason && (
            <p className="text-xs text-amber-600 dark:text-amber-400">
              Override reason: {overrideReason}
            </p>
          )}
        </div>
      </TooltipContent>
    </Tooltip>
  );
}
