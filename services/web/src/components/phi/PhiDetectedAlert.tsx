import { useState } from "react";
import { ShieldAlert, AlertTriangle, XCircle, AlertCircle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PhiOverrideModal } from "./PhiOverrideModal";

export interface PhiFinding {
  type: string;
  severity: "HIGH" | "MEDIUM" | "LOW";
  location: string;
  description: string;
}

interface PhiDetectedAlertProps {
  stageId: number;
  artifactId?: string;
  scanId?: string;
  findings?: PhiFinding[];
  findingsCount?: number;
  blocking?: boolean;
  showOverrideOption?: boolean;
  onOverrideSuccess?: () => void;
  onDismiss?: () => void;
  className?: string;
}

export function PhiDetectedAlert({
  stageId,
  artifactId,
  scanId,
  findings = [],
  findingsCount,
  blocking = true,
  showOverrideOption = true,
  onOverrideSuccess,
  onDismiss,
  className = ""
}: PhiDetectedAlertProps) {
  const [showOverrideModal, setShowOverrideModal] = useState(false);

  const totalFindings = findingsCount ?? findings.length;
  const highSeverityCount = findings.filter(f => f.severity === "HIGH").length;
  const mediumSeverityCount = findings.filter(f => f.severity === "MEDIUM").length;
  const lowSeverityCount = findings.filter(f => f.severity === "LOW").length;

  const handleOverrideSuccess = () => {
    setShowOverrideModal(false);
    onOverrideSuccess?.();
  };

  return (
    <>
      <Alert
        variant="destructive"
        className={`border-red-500/50 bg-red-500/10 ${className}`}
        data-testid="alert-phi-detected"
      >
        <ShieldAlert className="h-5 w-5" />
        <AlertTitle className="flex items-center gap-2 flex-wrap">
          <span>Protected Health Information Detected</span>
          {blocking && (
            <Badge
              variant="outline"
              className="border-red-500/50 text-red-600 dark:text-red-400 bg-red-500/20"
              data-testid="badge-phi-blocking"
            >
              <XCircle className="w-3 h-3 mr-1" />
              Blocking
            </Badge>
          )}
        </AlertTitle>
        <AlertDescription className="mt-2 space-y-3">
          <p className="text-sm">
            The PHI scan detected {totalFindings} potential issue{totalFindings !== 1 ? "s" : ""} 
            that may contain protected health information. 
            {blocking && " This operation is blocked until resolved."}
          </p>

          {findings.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {highSeverityCount > 0 && (
                <Badge
                  variant="outline"
                  className="border-red-500/50 text-red-600 dark:text-red-400"
                  data-testid="badge-severity-high"
                >
                  {highSeverityCount} High
                </Badge>
              )}
              {mediumSeverityCount > 0 && (
                <Badge
                  variant="outline"
                  className="border-amber-500/50 text-amber-600 dark:text-amber-400"
                  data-testid="badge-severity-medium"
                >
                  {mediumSeverityCount} Medium
                </Badge>
              )}
              {lowSeverityCount > 0 && (
                <Badge
                  variant="outline"
                  className="border-yellow-500/50 text-yellow-600 dark:text-yellow-400"
                  data-testid="badge-severity-low"
                >
                  {lowSeverityCount} Low
                </Badge>
              )}
            </div>
          )}

          {findings.length > 0 && (
            <div className="space-y-2 mt-3">
              <p className="text-xs font-medium text-red-600 dark:text-red-400" data-testid="text-detected-issues-label">
                Detected Issues:
              </p>
              <div className="max-h-32 overflow-y-auto space-y-1">
                {findings.slice(0, 5).map((finding, idx) => (
                  <div
                    key={idx}
                    className="flex flex-wrap items-start gap-2 text-xs p-2 rounded bg-red-500/5 border border-red-500/20"
                    data-testid={`phi-finding-item-${idx}`}
                  >
                    <AlertCircle className="w-3 h-3 mt-0.5 shrink-0 text-red-500" />
                    <div>
                      <span className="font-medium">{finding.type}</span>
                      <span className="text-muted-foreground"> - {finding.description}</span>
                    </div>
                  </div>
                ))}
                {findings.length > 5 && (
                  <p className="text-xs text-muted-foreground pl-5" data-testid="text-more-issues">
                    ... and {findings.length - 5} more issues
                  </p>
                )}
              </div>
            </div>
          )}

          <div className="flex flex-wrap gap-2 pt-2">
            {showOverrideOption && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => setShowOverrideModal(true)}
                className="border-amber-500/50 text-amber-600"
                data-testid="button-phi-request-override"
              >
                <AlertTriangle className="w-4 h-4 mr-1" />
                Request Override
              </Button>
            )}
            {onDismiss && !blocking && (
              <Button
                size="sm"
                variant="ghost"
                onClick={onDismiss}
                data-testid="button-phi-alert-dismiss"
              >
                Dismiss
              </Button>
            )}
          </div>
        </AlertDescription>
      </Alert>

      <PhiOverrideModal
        isOpen={showOverrideModal}
        onOpenChange={setShowOverrideModal}
        stageId={stageId}
        artifactId={artifactId}
        scanId={scanId}
        onSuccess={handleOverrideSuccess}
      />
    </>
  );
}
