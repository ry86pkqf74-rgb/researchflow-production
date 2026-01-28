import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ShieldCheck, AlertTriangle, ClipboardCheck, Lock, User } from "lucide-react";
import type { AttestationGate, LifecycleState } from "@/lib/governance";
import { STATE_METADATA } from "@/lib/governance";
import { useAuth } from "@/hooks/use-auth";

interface AttestationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (attestation: AttestationResult) => void;
  gate: AttestationGate;
  stageName: string;
  currentState: LifecycleState;
  /** Optional: pre-fill the attester name */
  defaultAttesterName?: string;
  /** If true, session-wide approval mode - auto-checks items and simplifies flow */
  sessionWideApproval?: boolean;
}

export interface AttestationResult {
  confirmed: boolean;
  checkedItems: string[];
  timestamp: string;
  attestedBy: string;
}

export function AttestationModal({
  isOpen,
  onClose,
  onConfirm,
  gate,
  stageName,
  currentState,
  defaultAttesterName,
  sessionWideApproval = false,
}: AttestationModalProps) {
  const { user } = useAuth();
  const [checkedItems, setCheckedItems] = useState<Set<string>>(new Set());
  const [attesterName, setAttesterName] = useState("");

  // Auto-fill attester name from user auth or default prop
  useEffect(() => {
    if (isOpen) {
      if (defaultAttesterName) {
        setAttesterName(defaultAttesterName);
      } else if (user) {
        const name = user.displayName ||
                     (user.firstName && user.lastName ? `${user.firstName} ${user.lastName}` : '') ||
                     user.email?.split('@')[0] ||
                     "Principal Investigator";
        setAttesterName(name);
      }

      // If session-wide approval, auto-check all items
      if (sessionWideApproval) {
        setCheckedItems(new Set(gate.checklistItems));
      }
    }
  }, [isOpen, user, defaultAttesterName, sessionWideApproval, gate.checklistItems]);

  const allChecked = checkedItems.size === gate.checklistItems.length;
  const canConfirm = allChecked && attesterName.trim().length > 0;
  const targetMeta = STATE_METADATA[gate.targetState];
  const currentMeta = STATE_METADATA[currentState];

  const handleCheckChange = (item: string, checked: boolean) => {
    const newChecked = new Set(checkedItems);
    if (checked) {
      newChecked.add(item);
    } else {
      newChecked.delete(item);
    }
    setCheckedItems(newChecked);
  };

  const handleConfirm = () => {
    if (!canConfirm) return;

    onConfirm({
      confirmed: true,
      checkedItems: Array.from(checkedItems),
      timestamp: new Date().toISOString(),
      attestedBy: attesterName.trim(),
    });
    setCheckedItems(new Set());
  };

  const handleCancel = () => {
    setCheckedItems(new Set());
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleCancel()}>
      <DialogContent className="sm:max-w-lg" data-testid="modal-attestation">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-lg bg-ros-workflow/10 flex items-center justify-center">
              <ShieldCheck className="h-5 w-5 text-ros-workflow" />
            </div>
            <div>
              <DialogTitle className="text-lg" data-testid="text-attestation-title">
                {gate.title}
              </DialogTitle>
              <p className="text-sm text-muted-foreground mt-0.5">
                {sessionWideApproval ? "Session-Wide AI Approval" : "Human Attestation Required"}
              </p>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="flex items-center gap-2 text-sm">
            <Badge variant="secondary" className="gap-1">
              <ClipboardCheck className="h-3 w-3" />
              {stageName}
            </Badge>
            <span className="text-muted-foreground">→</span>
            <Badge className="gap-1 bg-ros-workflow/10 text-ros-workflow border-ros-workflow/20">
              <Lock className="h-3 w-3" />
              {targetMeta.label}
            </Badge>
          </div>

          {/* Attester Name Field - auto-filled from auth */}
          <div className="space-y-2">
            <Label htmlFor="attester-name" className="text-sm font-medium flex items-center gap-2">
              <User className="h-3 w-3" />
              Attester Name
            </Label>
            <Input
              id="attester-name"
              value={attesterName}
              onChange={(e) => setAttesterName(e.target.value)}
              placeholder="Enter your name"
              className="font-medium"
              data-testid="input-attester-name"
            />
            <p className="text-xs text-muted-foreground">
              Your name will be recorded in the audit trail.
            </p>
          </div>

          <div className="p-3 rounded-lg bg-amber-500/5 border border-amber-500/20">
            <div className="flex gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-medium text-amber-600 dark:text-amber-400">
                  {sessionWideApproval ? "Session-Wide Approval Active" : "Governance Gate"}
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  {sessionWideApproval
                    ? "You've selected session-wide AI approval. Click Acknowledge to proceed."
                    : "This transition requires explicit confirmation. State changes are logged in the audit trail for compliance."
                  }
                </p>
              </div>
            </div>
          </div>

          <div>
            <p className="text-sm text-muted-foreground mb-3" data-testid="text-attestation-description">
              {gate.description}
            </p>
            <div className="space-y-3">
              {gate.checklistItems.map((item, index) => (
                <label
                  key={index}
                  className="flex items-start gap-3 p-3 rounded-lg border border-border/50 cursor-pointer hover-elevate transition-colors"
                  data-testid={`checkbox-attestation-${index}`}
                >
                  <Checkbox
                    checked={checkedItems.has(item)}
                    onCheckedChange={(checked) => handleCheckChange(item, checked as boolean)}
                    className="mt-0.5"
                    disabled={sessionWideApproval} // Disable individual checkboxes in session-wide mode
                  />
                  <span className="text-sm leading-relaxed">{item}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between text-xs text-muted-foreground pt-2 border-t">
            <span>
              {checkedItems.size} of {gate.checklistItems.length} items confirmed
            </span>
            <span>
              Current: <span className={currentMeta.color}>{currentMeta.label}</span>
            </span>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={handleCancel}
            data-testid="button-attestation-cancel"
          >
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={!canConfirm}
            className="bg-ros-workflow"
            data-testid="button-attestation-confirm"
          >
            <ShieldCheck className="h-4 w-4 mr-2" />
            {sessionWideApproval ? "Acknowledge" : "Confirm & Proceed"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
