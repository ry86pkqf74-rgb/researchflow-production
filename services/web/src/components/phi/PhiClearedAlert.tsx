import { ShieldCheck, CheckCircle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";

interface PhiClearedAlertProps {
  scanDate?: string;
  scanId?: string;
  itemsScanned?: number;
  onDismiss?: () => void;
  className?: string;
}

export function PhiClearedAlert({
  scanDate,
  scanId,
  itemsScanned,
  onDismiss,
  className = ""
}: PhiClearedAlertProps) {
  const formattedDate = scanDate
    ? format(new Date(scanDate), "MMM d, yyyy 'at' h:mm a")
    : null;

  return (
    <Alert
      className={`border-green-500/50 bg-green-500/10 ${className}`}
      data-testid="alert-phi-cleared"
    >
      <ShieldCheck className="h-5 w-5 text-green-600 dark:text-green-400" />
      <AlertTitle className="flex items-center gap-2 flex-wrap text-green-700 dark:text-green-300" data-testid="text-phi-cleared-title">
        <span>PHI Scan Passed</span>
        <Badge
          variant="outline"
          className="border-green-500/50 text-green-600 dark:text-green-400 bg-green-500/20"
          data-testid="badge-phi-cleared"
        >
          <CheckCircle className="w-3 h-3 mr-1" />
          Cleared
        </Badge>
      </AlertTitle>
      <AlertDescription className="mt-2 space-y-2 text-green-700/80 dark:text-green-300/80">
        <p className="text-sm" data-testid="text-phi-cleared-description">
          No protected health information was detected in this dataset.
          {itemsScanned && ` ${itemsScanned} items were scanned.`}
        </p>
        
        <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
          {formattedDate && (
            <span className="flex flex-wrap items-center gap-1" data-testid="text-scan-date">
              <span className="font-medium">Scanned:</span> {formattedDate}
            </span>
          )}
          {scanId && (
            <span className="flex flex-wrap items-center gap-1 font-mono" data-testid="text-scan-id">
              <span className="font-medium font-sans">ID:</span> {scanId}
            </span>
          )}
        </div>

        {onDismiss && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onDismiss}
            className="text-xs text-green-600 dark:text-green-400"
            data-testid="button-phi-cleared-dismiss"
          >
            Dismiss
          </Button>
        )}
      </AlertDescription>
    </Alert>
  );
}
