import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
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
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  ShieldX,
  ShieldCheck,
  Loader2,
  AlertTriangle,
  CheckCircle,
  XCircle,
  FileText,
  Clock
} from "lucide-react";
import { format } from "date-fns";
import type { QuarantineReason } from "./QuarantineBadge";

interface QuarantinedItem {
  id: string;
  name: string;
  type: string;
  reason: QuarantineReason;
  quarantinedAt: string;
  quarantinedBy?: string;
  findings?: Array<{
    type: string;
    severity: string;
    description: string;
  }>;
}

interface QuarantineReviewModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  item: QuarantinedItem | null;
  onReleaseSuccess?: () => void;
  onRejectSuccess?: () => void;
}

type ReviewDecision = "release" | "reject" | "escalate";

const MIN_JUSTIFICATION_LENGTH = 20;

export function QuarantineReviewModal({
  isOpen,
  onOpenChange,
  item,
  onReleaseSuccess,
  onRejectSuccess
}: QuarantineReviewModalProps) {
  const { toast } = useToast();
  const [decision, setDecision] = useState<ReviewDecision>("release");
  const [justification, setJustification] = useState("");

  const reviewMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/quarantine/review", {
        itemId: item?.id,
        decision,
        justification
      });
      const data = await response.json();
      if (data.status === "success") {
        return data;
      }
      throw new Error(data.error || "Review submission failed");
    },
    onSuccess: () => {
      const successMessage = decision === "release"
        ? "Item has been released from quarantine"
        : decision === "reject"
        ? "Item has been permanently rejected"
        : "Item has been escalated for further review";

      toast({
        title: "Review Submitted",
        description: successMessage,
      });

      setJustification("");
      setDecision("release");
      onOpenChange(false);

      if (decision === "release") {
        onReleaseSuccess?.();
      } else if (decision === "reject") {
        onRejectSuccess?.();
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Review Failed",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  const handleSubmit = () => {
    if (justification.length < MIN_JUSTIFICATION_LENGTH) {
      toast({
        title: "Justification Required",
        description: `Please provide at least ${MIN_JUSTIFICATION_LENGTH} characters explaining your decision.`,
        variant: "destructive",
      });
      return;
    }

    reviewMutation.mutate();
  };

  const canSubmit =
    justification.length >= MIN_JUSTIFICATION_LENGTH &&
    !reviewMutation.isPending;

  if (!item) return null;

  const formattedDate = format(new Date(item.quarantinedAt), "MMM d, yyyy 'at' h:mm a");

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg" data-testid="quarantine-review-modal">
        <DialogHeader>
          <div className="flex flex-wrap items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center">
              <ShieldX className="w-5 h-5 text-amber-500" />
            </div>
            <div>
              <DialogTitle>Quarantine Review</DialogTitle>
              <DialogDescription>
                Review and decide on the quarantined item
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="p-3 rounded-lg bg-muted/50 border space-y-2">
            <div className="flex items-start justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <FileText className="w-4 h-4 text-muted-foreground" />
                <span className="font-medium text-sm">{item.name}</span>
              </div>
              <Badge variant="outline" className="text-xs">
                {item.type}
              </Badge>
            </div>
            <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
              <span className="flex flex-wrap items-center gap-1">
                <Clock className="w-3 h-3" />
                {formattedDate}
              </span>
              {item.quarantinedBy && (
                <span>by {item.quarantinedBy}</span>
              )}
            </div>
          </div>

          <div className="p-3 rounded-lg bg-red-500/5 border border-red-500/20 space-y-2">
            <div className="flex flex-wrap items-center gap-2 text-sm font-medium text-red-600 dark:text-red-400">
              <AlertTriangle className="w-4 h-4" />
              <span>Quarantine Reason: {item.reason.replace(/_/g, " ")}</span>
            </div>
            {item.findings && item.findings.length > 0 && (
              <div className="space-y-1 mt-2">
                {item.findings.slice(0, 3).map((finding, idx) => (
                  <div
                    key={idx}
                    className="text-xs text-muted-foreground flex flex-wrap items-start gap-2"
                  >
                    <span className="text-red-500">•</span>
                    <span>{finding.description}</span>
                  </div>
                ))}
                {item.findings.length > 3 && (
                  <p className="text-xs text-muted-foreground pl-4">
                    +{item.findings.length - 3} more findings
                  </p>
                )}
              </div>
            )}
          </div>

          <div className="space-y-3">
            <Label className="text-sm font-medium">Review Decision</Label>
            <RadioGroup
              value={decision}
              onValueChange={(value) => setDecision(value as ReviewDecision)}
              className="space-y-2"
            >
              <div className="flex flex-wrap items-start gap-3 p-3 rounded-lg border bg-card hover-elevate cursor-pointer" data-testid="card-decision-release">
                <RadioGroupItem value="release" id="release" className="mt-0.5" data-testid="radio-decision-release" />
                <Label htmlFor="release" className="cursor-pointer flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-green-500" />
                    <span className="font-medium">Release</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Clear the item from quarantine and allow it to proceed
                  </p>
                </Label>
              </div>

              <div className="flex flex-wrap items-start gap-3 p-3 rounded-lg border bg-card hover-elevate cursor-pointer" data-testid="card-decision-reject">
                <RadioGroupItem value="reject" id="reject" className="mt-0.5" data-testid="radio-decision-reject" />
                <Label htmlFor="reject" className="cursor-pointer flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <XCircle className="w-4 h-4 text-red-500" />
                    <span className="font-medium">Reject</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Permanently reject this item - it cannot be recovered
                  </p>
                </Label>
              </div>

              <div className="flex flex-wrap items-start gap-3 p-3 rounded-lg border bg-card hover-elevate cursor-pointer" data-testid="card-decision-escalate">
                <RadioGroupItem value="escalate" id="escalate" className="mt-0.5" data-testid="radio-decision-escalate" />
                <Label htmlFor="escalate" className="cursor-pointer flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-500" />
                    <span className="font-medium">Escalate</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Escalate to a supervisor or compliance officer for review
                  </p>
                </Label>
              </div>
            </RadioGroup>
          </div>

          <div className="space-y-2">
            <Label htmlFor="justification" className="text-sm font-medium">
              Justification <span className="text-red-500">*</span>
            </Label>
            <Textarea
              id="justification"
              placeholder="Explain your decision (minimum 20 characters)..."
              value={justification}
              onChange={(e) => setJustification(e.target.value)}
              className="min-h-[80px] resize-none"
              data-testid="input-review-justification"
            />
            <p className="text-xs text-muted-foreground text-right">
              {justification.length}/{MIN_JUSTIFICATION_LENGTH} minimum characters
            </p>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            data-testid="button-review-cancel"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!canSubmit}
            className={cn(
              "border",
              decision === "release"
                ? "bg-green-600 border-green-600 text-white"
                : decision === "reject"
                ? "bg-red-600 border-red-600 text-white"
                : "bg-amber-600 border-amber-600 text-white"
            )}
            data-testid="button-review-submit"
          >
            {reviewMutation.isPending ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Submitting...
              </>
            ) : (
              <>
                {decision === "release" && <CheckCircle className="w-4 h-4 mr-2" />}
                {decision === "reject" && <XCircle className="w-4 h-4 mr-2" />}
                {decision === "escalate" && <AlertTriangle className="w-4 h-4 mr-2" />}
                {decision === "release" ? "Release Item" : decision === "reject" ? "Reject Item" : "Escalate"}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
