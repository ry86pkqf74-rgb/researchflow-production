import { useState, useCallback, createContext, useContext, type ReactNode } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
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
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  Bot, 
  ShieldAlert, 
  DollarSign, 
  Cpu,
  AlertTriangle,
  Zap,
  Settings2
} from "lucide-react";
import type { 
  AIApprovalMode,
  AuditLogEntry 
} from "@/lib/governance";
import { 
  AI_ENABLED_STAGES, 
  AI_APPROVAL_MODE_LABELS,
  AI_APPROVAL_MODE_DESCRIPTIONS,
  getPhaseForStage,
  stageUsesAI,
  getAIToolsForStage 
} from "@/lib/governance";

export interface AIApprovalState {
  mode: AIApprovalMode;
  approvedStages: Set<number>;
  approvedPhases: Set<string>;
  sessionApproved: boolean;
  approverName: string;
}

export interface AIApprovalGateResult {
  approved: boolean;
  approvedBy: string;
  approvalMode: AIApprovalMode;
  approvedTools: string[];
  timestamp: string;
  stageId?: number;
  phaseId?: string;
}

interface AIApprovalGateContextType {
  state: AIApprovalState;
  setMode: (mode: AIApprovalMode) => void;
  checkApproval: (stageId: number) => boolean;
  requestApproval: (stageId: number, stageName: string) => Promise<AIApprovalGateResult>;
  resetApprovals: () => void;
  getApprovalStats: () => { approved: number; pending: number; total: number };
}

const AIApprovalGateContext = createContext<AIApprovalGateContextType | null>(null);

export function useAIApprovalGate() {
  const context = useContext(AIApprovalGateContext);
  if (!context) {
    throw new Error("useAIApprovalGate must be used within AIApprovalGateProvider");
  }
  return context;
}

interface AIApprovalGateProviderProps {
  children: ReactNode;
  initialMode?: AIApprovalMode;
  onApprovalChange?: (entry: AuditLogEntry) => void;
}

export function AIApprovalGateProvider({ 
  children, 
  initialMode = 'REQUIRE_EACH',
  onApprovalChange: _onApprovalChange 
}: AIApprovalGateProviderProps) {
  const [state, setState] = useState<AIApprovalState>({
    mode: initialMode,
    approvedStages: new Set(),
    approvedPhases: new Set(),
    sessionApproved: false,
    approverName: "",
  });

  const [modalState, setModalState] = useState<{
    isOpen: boolean;
    stageId: number | null;
    stageName: string;
    resolve: ((result: AIApprovalGateResult) => void) | null;
  }>({
    isOpen: false,
    stageId: null,
    stageName: "",
    resolve: null,
  });

  const setMode = useCallback((mode: AIApprovalMode) => {
    setState(prev => ({ ...prev, mode, approvedStages: new Set(), approvedPhases: new Set(), sessionApproved: false }));
  }, []);

  const checkApproval = useCallback((stageId: number): boolean => {
    if (!stageUsesAI(stageId)) return true;
    
    switch (state.mode) {
      case 'APPROVE_SESSION':
        return state.sessionApproved;
      case 'APPROVE_PHASE': {
        const phase = getPhaseForStage(stageId);
        return phase ? state.approvedPhases.has(phase.phaseId) : false;
      }
      case 'REQUIRE_EACH':
      default:
        return state.approvedStages.has(stageId);
    }
  }, [state]);

  const requestApproval = useCallback((stageId: number, stageName: string): Promise<AIApprovalGateResult> => {
    if (!stageUsesAI(stageId)) {
      return Promise.resolve({
        approved: true,
        approvedBy: "System",
        approvalMode: state.mode,
        approvedTools: [],
        timestamp: new Date().toISOString(),
        stageId,
      });
    }

    if (checkApproval(stageId)) {
      const tools = getAIToolsForStage(stageId);
      return Promise.resolve({
        approved: true,
        approvedBy: state.approverName || "Researcher",
        approvalMode: state.mode,
        approvedTools: tools.map(t => t.id),
        timestamp: new Date().toISOString(),
        stageId,
      });
    }

    return new Promise((resolve) => {
      setModalState({
        isOpen: true,
        stageId,
        stageName,
        resolve,
      });
    });
  }, [state.mode, state.approverName, checkApproval]);

  const handleApprove = useCallback((approverName: string) => {
    if (!modalState.stageId || !modalState.resolve) return;

    const stageId = modalState.stageId;
    const tools = getAIToolsForStage(stageId);
    const phase = getPhaseForStage(stageId);

    setState(prev => {
      const newState = { ...prev, approverName };
      
      switch (prev.mode) {
        case 'APPROVE_SESSION':
          newState.sessionApproved = true;
          break;
        case 'APPROVE_PHASE':
          if (phase) {
            newState.approvedPhases = new Set([...Array.from(prev.approvedPhases), phase.phaseId]);
          }
          break;
        case 'REQUIRE_EACH':
        default:
          newState.approvedStages = new Set([...Array.from(prev.approvedStages), stageId]);
          break;
      }
      
      return newState;
    });

    const result: AIApprovalGateResult = {
      approved: true,
      approvedBy: approverName || "Researcher",
      approvalMode: state.mode,
      approvedTools: tools.map(t => t.id),
      timestamp: new Date().toISOString(),
      stageId,
      phaseId: phase?.phaseId,
    };

    modalState.resolve(result);
    setModalState({ isOpen: false, stageId: null, stageName: "", resolve: null });
  }, [modalState, state.mode]);

  const handleDeny = useCallback(() => {
    if (modalState.resolve) {
      modalState.resolve({
        approved: false,
        approvedBy: "",
        approvalMode: state.mode,
        approvedTools: [],
        timestamp: new Date().toISOString(),
        stageId: modalState.stageId || undefined,
      });
    }
    setModalState({ isOpen: false, stageId: null, stageName: "", resolve: null });
  }, [modalState, state.mode]);

  const resetApprovals = useCallback(() => {
    setState(prev => ({
      ...prev,
      approvedStages: new Set(),
      approvedPhases: new Set(),
      sessionApproved: false,
    }));
  }, []);

  const getApprovalStats = useCallback(() => {
    const allAIStages = Object.keys(AI_ENABLED_STAGES).map(Number);
    const total = allAIStages.length;
    
    let approved = 0;
    switch (state.mode) {
      case 'APPROVE_SESSION':
        approved = state.sessionApproved ? total : 0;
        break;
      case 'APPROVE_PHASE':
        approved = allAIStages.filter(stageId => {
          const phase = getPhaseForStage(stageId);
          return phase && state.approvedPhases.has(phase.phaseId);
        }).length;
        break;
      case 'REQUIRE_EACH':
      default:
        approved = state.approvedStages.size;
        break;
    }

    return { approved, pending: total - approved, total };
  }, [state]);

  return (
    <AIApprovalGateContext.Provider value={{
      state,
      setMode,
      checkApproval,
      requestApproval,
      resetApprovals,
      getApprovalStats,
    }}>
      {children}
      <AIApprovalGateModal
        isOpen={modalState.isOpen}
        stageId={modalState.stageId}
        stageName={modalState.stageName}
        mode={state.mode}
        onApprove={handleApprove}
        onDeny={handleDeny}
      />
    </AIApprovalGateContext.Provider>
  );
}

interface AIApprovalGateModalProps {
  isOpen: boolean;
  stageId: number | null;
  stageName: string;
  mode: AIApprovalMode;
  onApprove: (approverName: string) => void;
  onDeny: () => void;
}

function AIApprovalGateModal({
  isOpen,
  stageId,
  stageName,
  mode,
  onApprove,
  onDeny,
}: AIApprovalGateModalProps) {
  const [acknowledged, setAcknowledged] = useState(false);
  const [approverName, setApproverName] = useState("");

  const tools = stageId ? getAIToolsForStage(stageId) : [];
  const phase = stageId ? getPhaseForStage(stageId) : null;
  
  const allTools = mode === 'APPROVE_SESSION' 
    ? Object.values(AI_ENABLED_STAGES).flat()
    : mode === 'APPROVE_PHASE' && phase
      ? phase.aiTools
      : tools;

  const hasHighRisk = allTools.some(t => t.phiRisk === 'high');
  const hasMediumRisk = allTools.some(t => t.phiRisk === 'medium');

  const handleApprove = () => {
    onApprove(approverName);
    setAcknowledged(false);
    setApproverName("");
  };

  const handleDeny = () => {
    onDeny();
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

  const getTitle = () => {
    switch (mode) {
      case 'APPROVE_SESSION':
        return "AI Action: Approve all AI tools for this session. Approve?";
      case 'APPROVE_PHASE':
        return `AI Action: Approve all AI tools in ${phase?.phaseName || 'this phase'}. Approve?`;
      case 'REQUIRE_EACH':
      default:
        return `AI Action: ${tools[0]?.description || tools[0]?.name || stageName}. Approve?`;
    }
  };

  const getDescription = () => {
    switch (mode) {
      case 'APPROVE_SESSION':
        return "Approving will allow all AI tools to execute throughout your research session without additional prompts.";
      case 'APPROVE_PHASE':
        return `Approving will allow all AI tools in the "${phase?.phaseName}" phase to execute without additional prompts.`;
      case 'REQUIRE_EACH':
      default:
        return `Stage "${stageName}" requires AI processing. Review the details below and approve to proceed.`;
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleDeny()}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay 
          className="fixed inset-0 z-[100] bg-black/80 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0"
        />
        <DialogPrimitive.Content
          className={cn(
            "fixed left-[50%] top-[50%] z-[100] grid w-full max-w-lg translate-x-[-50%] translate-y-[-50%] gap-4 border bg-background p-6 shadow-lg duration-200",
            "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
            "data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2",
            "data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%]",
            "sm:rounded-lg"
          )}
          data-testid="modal-ai-approval-gate"
        >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bot className="h-5 w-5 text-ros-workflow" />
            {getTitle()}
          </DialogTitle>
          <DialogDescription>{getDescription()}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-ros-workflow/10 border border-ros-workflow/20">
            <Settings2 className="h-4 w-4 text-ros-workflow" />
            <span className="text-sm">
              <span className="font-medium">Approval Mode:</span>{" "}
              {AI_APPROVAL_MODE_LABELS[mode]}
            </span>
          </div>

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
              AI Tools {mode !== 'REQUIRE_EACH' && `(${allTools.length} tools)`}
            </h4>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {allTools.map((t) => (
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
                id="acknowledge-gate"
                checked={acknowledged}
                onCheckedChange={(checked) => setAcknowledged(checked === true)}
                data-testid="checkbox-ai-acknowledge"
              />
              <Label htmlFor="acknowledge-gate" className="text-sm leading-relaxed cursor-pointer">
                I acknowledge that AI will process research data and I have reviewed 
                the tools, their associated risks, and estimated costs.
              </Label>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="approver-name-gate" className="text-sm">
                Your Name (for audit trail)
              </Label>
              <Input
                id="approver-name-gate"
                placeholder="Enter your name"
                value={approverName}
                onChange={(e) => setApproverName(e.target.value)}
                data-testid="input-approver-name"
              />
            </div>
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
            className="bg-ros-workflow gap-1.5"
            data-testid="button-ai-approve"
          >
            <Zap className="h-4 w-4" />
            {mode === 'APPROVE_SESSION' ? 'Approve All' : mode === 'APPROVE_PHASE' ? 'Approve Phase' : 'Approve'}
          </Button>
        </DialogFooter>
        
        <DialogPrimitive.Close 
          className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground"
          onClick={handleDeny}
        >
          <X className="h-4 w-4" />
          <span className="sr-only">Close</span>
        </DialogPrimitive.Close>
      </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </Dialog>
  );
}

export function AIApprovalModeSelector({
  value,
  onChange,
}: {
  value: AIApprovalMode;
  onChange: (mode: AIApprovalMode) => void;
}) {
  const modes: AIApprovalMode[] = ['REQUIRE_EACH', 'APPROVE_PHASE', 'APPROVE_SESSION'];

  return (
    <div className="space-y-2">
      <Label className="text-sm font-medium">AI Approval Mode</Label>
      <div className="space-y-2">
        {modes.map((mode) => (
          <Card 
            key={mode}
            className={`p-3 cursor-pointer transition-all ${
              value === mode 
                ? 'ring-2 ring-ros-workflow bg-ros-workflow/5' 
                : 'hover:bg-muted/50'
            }`}
            onClick={() => onChange(mode)}
            data-testid={`card-approval-mode-${mode.toLowerCase().replace('_', '-')}`}
          >
            <div className="flex items-start gap-3">
              <div className={`w-4 h-4 rounded-full border-2 mt-0.5 flex items-center justify-center ${
                value === mode ? 'border-ros-workflow' : 'border-muted-foreground'
              }`}>
                {value === mode && <div className="w-2 h-2 rounded-full bg-ros-workflow" />}
              </div>
              <div className="space-y-0.5">
                <div className="font-medium text-sm">{AI_APPROVAL_MODE_LABELS[mode]}</div>
                <p className="text-xs text-muted-foreground">
                  {AI_APPROVAL_MODE_DESCRIPTIONS[mode]}
                </p>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
