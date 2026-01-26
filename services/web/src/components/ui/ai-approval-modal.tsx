import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { 
  Bot, 
  ShieldAlert, 
  DollarSign, 
  Cpu,
  AlertTriangle,
  CheckCircle2,
  Info
} from "lucide-react";
import type { AITool, PhaseAIConfig } from "@/lib/governance";

export interface AIApprovalResult {
  approved: boolean;
  approvedBy: string;
  approvalMode: 'phase' | 'per-call';
  approvedTools: string[];
  timestamp: string;
}

interface AIApprovalModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApprove: (result: AIApprovalResult) => void;
  mode: 'phase' | 'per-call';
  phaseConfig?: PhaseAIConfig;
  tool?: AITool;
  stageName?: string;
}

export function AIApprovalModal({
  isOpen,
  onClose,
  onApprove,
  mode,
  phaseConfig,
  tool,
  stageName,
}: AIApprovalModalProps) {
  const [acknowledged, setAcknowledged] = useState(false);
  const [approverName, setApproverName] = useState("");

  const tools = mode === 'phase' && phaseConfig ? phaseConfig.aiTools : tool ? [tool] : [];
  const hasHighRisk = tools.some(t => t.phiRisk === 'high');
  const hasMediumRisk = tools.some(t => t.phiRisk === 'medium');

  const handleApprove = () => {
    onApprove({
      approved: true,
      approvedBy: approverName || "Researcher",
      approvalMode: mode,
      approvedTools: tools.map(t => t.id),
      timestamp: new Date().toISOString(),
    });
    resetForm();
  };

  const handleDeny = () => {
    onClose();
    resetForm();
  };

  const resetForm = () => {
    setAcknowledged(false);
    setApproverName("");
  };

  const getRiskBadge = (risk: 'low' | 'medium' | 'high') => {
    switch (risk) {
      case 'high':
        return <Badge className="bg-ros-alert text-white">High PHI Risk</Badge>;
      case 'medium':
        return <Badge className="bg-amber-500 text-white">Medium Risk</Badge>;
      default:
        return <Badge variant="secondary">Low Risk</Badge>;
    }
  };

  const title = `AI Action: ${tool?.description || tool?.name}. Approve?`;

  const description = `Stage "${stageName}" requires AI processing. Review the details below and approve to proceed.`;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleDeny()}>
      <DialogContent className="max-w-lg" data-testid="modal-ai-approval">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bot className="h-5 w-5 text-ros-workflow" />
            {title}
          </DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {hasHighRisk && (
            <div className="flex items-start gap-3 p-3 rounded-lg bg-ros-alert/10 border border-ros-alert/30">
              <ShieldAlert className="h-5 w-5 text-ros-alert shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-ros-alert">PHI Warning</p>
                <p className="text-sm text-muted-foreground">
                  This operation may process Protected Health Information. 
                  Ensure data is properly de-identified before proceeding.
                </p>
              </div>
            </div>
          )}

          {hasMediumRisk && !hasHighRisk && (
            <div className="flex items-start gap-3 p-3 rounded-lg bg-amber-500/10 border border-amber-500/30">
              <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-amber-600">Data Sensitivity Notice</p>
                <p className="text-sm text-muted-foreground">
                  This operation processes research data. Review AI outputs carefully.
                </p>
              </div>
            </div>
          )}

          <div className="space-y-2">
            <h4 className="text-sm font-medium flex items-center gap-2">
              <Cpu className="h-4 w-4" />
              AI Tools to be Used
            </h4>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {tools.map((t) => (
                <Card key={t.id} className="p-3" data-testid={`card-ai-tool-${t.id}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm">{t.name}</span>
                        {getRiskBadge(t.phiRisk)}
                      </div>
                      <p className="text-xs text-muted-foreground">{t.description}</p>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Bot className="h-3 w-3" />
                          {t.model}
                        </span>
                        <span className="flex items-center gap-1">
                          <DollarSign className="h-3 w-3" />
                          {t.costEstimate}
                        </span>
                      </div>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </div>

          <div className="space-y-3 pt-2 border-t">
            <div className="flex items-start gap-3">
              <Checkbox
                id="acknowledge"
                checked={acknowledged}
                onCheckedChange={(checked) => setAcknowledged(checked === true)}
                data-testid="checkbox-ai-acknowledge"
              />
              <Label htmlFor="acknowledge" className="text-sm leading-relaxed cursor-pointer">
                I acknowledge that AI will process research data and I have reviewed 
                the tools listed above. I understand that AI outputs should be 
                verified before use in publications.
              </Label>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="approver" className="text-sm">
                Approved by
              </Label>
              <Input
                id="approver"
                placeholder="Enter your name"
                value={approverName}
                onChange={(e) => setApproverName(e.target.value)}
                data-testid="input-ai-approver"
              />
            </div>
          </div>

          <div className="flex items-start gap-2 p-3 rounded-lg bg-muted/50">
            <Info className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
            <p className="text-xs text-muted-foreground">
              {mode === 'phase' 
                ? `This approval covers all AI calls in the ${phaseConfig?.phaseName} phase. You won't be asked again for individual stages.`
                : 'This approval is for this specific AI operation only.'}
            </p>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={handleDeny}
            data-testid="button-ai-deny"
          >
            Deny
          </Button>
          <Button
            onClick={handleApprove}
            disabled={!acknowledged}
            className="bg-ros-workflow gap-2"
            data-testid="button-ai-approve"
          >
            <CheckCircle2 className="h-4 w-4" />
            Approve AI {mode === 'phase' ? 'for Phase' : 'Call'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
