import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ShieldX, Clock, User } from "lucide-react";

export type QuarantineReason = 
  | "PHI_DETECTED" 
  | "VALIDATION_FAILED" 
  | "MANUAL_REVIEW" 
  | "POLICY_VIOLATION"
  | "PENDING_APPROVAL";

interface QuarantineBadgeProps {
  reason?: QuarantineReason;
  quarantinedAt?: string;
  quarantinedBy?: string;
  reviewRequired?: boolean;
  className?: string;
}

const reasonLabels: Record<QuarantineReason, string> = {
  PHI_DETECTED: "PHI Detected",
  VALIDATION_FAILED: "Validation Failed",
  MANUAL_REVIEW: "Manual Review",
  POLICY_VIOLATION: "Policy Violation",
  PENDING_APPROVAL: "Pending Approval"
};

const reasonDescriptions: Record<QuarantineReason, string> = {
  PHI_DETECTED: "This item contains protected health information and has been quarantined",
  VALIDATION_FAILED: "This item failed validation checks and requires review",
  MANUAL_REVIEW: "This item has been flagged for manual review",
  POLICY_VIOLATION: "This item violates one or more data governance policies",
  PENDING_APPROVAL: "This item is awaiting approval before it can be released"
};

export function QuarantineBadge({
  reason = "MANUAL_REVIEW",
  quarantinedAt,
  quarantinedBy,
  reviewRequired = true,
  className = ""
}: QuarantineBadgeProps) {
  const formattedDate = quarantinedAt
    ? format(new Date(quarantinedAt), "MMM d, yyyy HH:mm")
    : null;

  const isPhi = reason === "PHI_DETECTED";
  const badgeClass = isPhi
    ? "border-red-500/50 text-red-600 dark:text-red-400 bg-red-500/10"
    : "border-amber-500/50 text-amber-600 dark:text-amber-400 bg-amber-500/10";

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Badge
          variant="outline"
          className={`${badgeClass} ${className} cursor-help gap-1`}
          data-testid={`quarantine-badge-${reason.toLowerCase().replace(/_/g, "-")}`}
        >
          <ShieldX className="w-3 h-3" />
          <span className="text-xs">Quarantined</span>
        </Badge>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-xs" data-testid="tooltip-quarantine-content">
        <div className="space-y-2">
          <div className="space-y-1">
            <p className="font-medium" data-testid="text-quarantine-reason">{reasonLabels[reason]}</p>
            <p className="text-xs text-muted-foreground" data-testid="text-quarantine-description">
              {reasonDescriptions[reason]}
            </p>
          </div>
          
          <div className="space-y-1 pt-1 border-t text-xs text-muted-foreground">
            {formattedDate && (
              <div className="flex flex-wrap items-center gap-1.5">
                <Clock className="w-3 h-3" />
                <span>Quarantined: {formattedDate}</span>
              </div>
            )}
            {quarantinedBy && (
              <div className="flex flex-wrap items-center gap-1.5">
                <User className="w-3 h-3" />
                <span>By: {quarantinedBy}</span>
              </div>
            )}
          </div>

          {reviewRequired && (
            <p className="text-xs text-amber-600 dark:text-amber-400 pt-1" data-testid="text-review-required">
              Review required before release
            </p>
          )}
        </div>
      </TooltipContent>
    </Tooltip>
  );
}
