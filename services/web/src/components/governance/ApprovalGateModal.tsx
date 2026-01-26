import { useState } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { safeFixed, formatBytes } from "@/lib/format";
import { X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  AlertTriangle,
  FileUp,
  Loader2,
  ShieldAlert,
  FileText,
  HardDrive,
  Database,
  Tag,
} from "lucide-react";

export interface UploadDetails {
  filename: string;
  sizeBytes: number;
  rowCount?: number;
  classification: "SYNTHETIC" | "DEIDENTIFIED" | "IDENTIFIED" | "UNKNOWN";
  phiDetected?: boolean;
}

export interface ApprovalGateModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  uploadDetails: UploadDetails;
  approvalReason: string;
  onSubmitForApproval: (justification: string) => Promise<void>;
  onCancel: () => void;
}

const classificationColors: Record<string, string> = {
  SYNTHETIC: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  DEIDENTIFIED: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  IDENTIFIED: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  UNKNOWN: "bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400",
};

export function ApprovalGateModal({
  open,
  onOpenChange,
  uploadDetails,
  approvalReason,
  onSubmitForApproval,
  onCancel,
}: ApprovalGateModalProps) {
  const [justification, setJustification] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      await onSubmitForApproval(justification);
      setJustification("");
      onOpenChange(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    setJustification("");
    onCancel();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay 
          className="fixed inset-0 z-[100] bg-black/80 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0"
        />
        <DialogPrimitive.Content
          className={cn(
            "fixed left-[50%] top-[50%] z-[100] grid w-full sm:max-w-lg translate-x-[-50%] translate-y-[-50%] gap-4 border bg-background p-6 shadow-lg duration-200",
            "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
            "data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2",
            "data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%]",
            "sm:rounded-lg"
          )}
          data-testid="modal-approval-gate"
        >
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center">
              <ShieldAlert className="w-5 h-5 text-amber-500" />
            </div>
            <div>
              <DialogTitle>Approval Required</DialogTitle>
              <DialogDescription>
                This upload requires steward approval before processing
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>{approvalReason}</AlertDescription>
          </Alert>

          <div className="rounded-lg border bg-card p-4 space-y-3">
            <h4 className="text-sm font-semibold flex items-center gap-2">
              <FileUp className="w-4 h-4" />
              Upload Details
            </h4>

            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-muted-foreground" />
                <span className="text-muted-foreground">Filename:</span>
              </div>
              <span
                className="font-medium truncate"
                title={uploadDetails.filename}
                data-testid="text-upload-filename"
              >
                {uploadDetails.filename}
              </span>

              <div className="flex items-center gap-2">
                <HardDrive className="w-4 h-4 text-muted-foreground" />
                <span className="text-muted-foreground">Size:</span>
              </div>
              <span className="font-medium" data-testid="text-upload-size">
                {formatBytes(uploadDetails.sizeBytes)}
              </span>

              {uploadDetails.rowCount !== undefined && (
                <>
                  <div className="flex items-center gap-2">
                    <Database className="w-4 h-4 text-muted-foreground" />
                    <span className="text-muted-foreground">Rows:</span>
                  </div>
                  <span className="font-medium" data-testid="text-upload-rows">
                    {uploadDetails.rowCount.toLocaleString()}
                  </span>
                </>
              )}

              <div className="flex items-center gap-2">
                <Tag className="w-4 h-4 text-muted-foreground" />
                <span className="text-muted-foreground">Classification:</span>
              </div>
              <Badge
                className={classificationColors[uploadDetails.classification]}
                data-testid="badge-upload-classification"
              >
                {uploadDetails.classification}
              </Badge>
            </div>

            {uploadDetails.phiDetected && (
              <div className="mt-2 p-2 rounded-md bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
                <p className="text-xs text-red-600 dark:text-red-400 flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" />
                  PHI indicators detected in this file
                </p>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="approval-justification" className="text-sm font-medium">
              Justification (optional)
            </Label>
            <Textarea
              id="approval-justification"
              placeholder="Provide any additional context for the approval request..."
              value={justification}
              onChange={(e) => setJustification(e.target.value)}
              className="min-h-[80px] resize-none"
              data-testid="input-approval-justification"
            />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            variant="outline"
            onClick={handleCancel}
            disabled={isSubmitting}
            data-testid="button-approval-cancel"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting}
            data-testid="button-approval-submit"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Submitting...
              </>
            ) : (
              <>
                <FileUp className="w-4 h-4 mr-2" />
                Submit for Approval
              </>
            )}
          </Button>
        </DialogFooter>
        
        <DialogPrimitive.Close className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground">
          <X className="h-4 w-4" />
          <span className="sr-only">Close</span>
        </DialogPrimitive.Close>
      </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </Dialog>
  );
}
