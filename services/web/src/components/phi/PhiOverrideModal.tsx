import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { 
  AlertTriangle, 
  Loader2,
  ShieldAlert,
  FileWarning
} from "lucide-react";

interface PhiOverrideModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  stageId: number;
  artifactId?: string;
  scanId?: string;
  onSuccess: () => void;
}

const MIN_JUSTIFICATION_LENGTH = 20;

export function PhiOverrideModal({
  isOpen,
  onOpenChange,
  stageId,
  artifactId,
  scanId,
  onSuccess
}: PhiOverrideModalProps) {
  const { toast } = useToast();
  const [justification, setJustification] = useState("");
  const [acknowledged, setAcknowledged] = useState(false);

  const overrideMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/ros/phi/override", {
        stageId,
        artifactId,
        scanId,
        justification,
        acknowledged
      });
      const data = await response.json();
      if (data.status === "success" && data.override) {
        return data.override;
      }
      throw new Error(data.error || "Override request failed");
    },
    onSuccess: (overrideData) => {
      toast({
        title: "Override Submitted",
        description: `PHI override ${overrideData.overrideId} has been recorded in the audit log.`,
      });
      setJustification("");
      setAcknowledged(false);
      onSuccess();
    },
    onError: (error: Error) => {
      toast({
        title: "Override Failed",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  const handleSubmit = () => {
    if (justification.length < MIN_JUSTIFICATION_LENGTH) {
      toast({
        title: "Justification Required",
        description: `Please provide at least ${MIN_JUSTIFICATION_LENGTH} characters explaining the override reason.`,
        variant: "destructive",
      });
      return;
    }

    if (!acknowledged) {
      toast({
        title: "Acknowledgment Required",
        description: "Please acknowledge that this action will be logged.",
        variant: "destructive",
      });
      return;
    }

    overrideMutation.mutate();
  };

  const canSubmit = 
    justification.length >= MIN_JUSTIFICATION_LENGTH && 
    acknowledged && 
    !overrideMutation.isPending;

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" data-testid="phi-override-modal">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center">
              <ShieldAlert className="w-5 h-5 text-amber-500" />
            </div>
            <div>
              <DialogTitle>PHI Override Request</DialogTitle>
              <DialogDescription>
                Override the PHI compliance gate for Stage {stageId}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/30">
            <div className="flex gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="text-sm font-medium text-amber-700 dark:text-amber-400">
                  Compliance Warning
                </p>
                <p className="text-xs text-amber-600 dark:text-amber-500">
                  Overriding PHI detection may have regulatory implications. This action 
                  will be permanently logged in the audit trail and may require review 
                  by your compliance officer.
                </p>
              </div>
            </div>
          </div>

          <div className="p-3 rounded-lg bg-muted/50 border">
            <div className="flex gap-2">
              <FileWarning className="w-5 h-5 text-muted-foreground shrink-0 mt-0.5" />
              <div className="text-xs text-muted-foreground space-y-1">
                <p>By proceeding, you confirm that:</p>
                <ul className="list-disc list-inside space-y-0.5 ml-1">
                  <li>The detected PHI is a false positive, OR</li>
                  <li>You have appropriate authorization to access this data, OR</li>
                  <li>The data has been properly consented for research use</li>
                </ul>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="justification" className="text-sm font-medium">
              Override Justification <span className="text-red-500">*</span>
            </Label>
            <Textarea
              id="justification"
              placeholder="Explain why this PHI detection should be overridden (minimum 20 characters)..."
              value={justification}
              onChange={(e) => setJustification(e.target.value)}
              className="min-h-[100px] resize-none"
              data-testid="input-override-justification"
            />
            <p className="text-xs text-muted-foreground text-right">
              {justification.length}/{MIN_JUSTIFICATION_LENGTH} minimum characters
            </p>
          </div>

          <div className="flex items-start gap-3 p-3 rounded-lg border bg-card">
            <Checkbox
              id="acknowledge"
              checked={acknowledged}
              onCheckedChange={(checked) => setAcknowledged(checked === true)}
              data-testid="checkbox-override-acknowledge"
            />
            <div className="space-y-1">
              <Label 
                htmlFor="acknowledge" 
                className="text-sm font-medium cursor-pointer"
              >
                I understand this will be logged
              </Label>
              <p className="text-xs text-muted-foreground">
                This override action, including my identity, timestamp, and justification, 
                will be permanently recorded in the compliance audit log.
              </p>
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            data-testid="button-override-cancel"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="bg-amber-500 hover:bg-amber-600 text-white"
            data-testid="button-override-submit"
          >
            {overrideMutation.isPending ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Submitting...
              </>
            ) : (
              <>
                <AlertTriangle className="w-4 h-4 mr-2" />
                Submit Override
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
