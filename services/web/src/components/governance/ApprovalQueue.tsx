import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  ScrollArea,
} from "@/components/ui/scroll-area";
import {
  CheckCircle2,
  Clock,
  Shield,
  Database,
  Zap,
  AlertCircle,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Loader2,
  RefreshCw,
  Eye,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

type ActionType = "PHI_REVEAL" | "DATA_EXPORT" | "AI_ACTION";

interface PendingAction {
  id: string;
  type: ActionType;
  requestedBy: string;
  requestedAt: string;
  description: string;
  resource: string;
  priority: "low" | "medium" | "high";
  metadata?: Record<string, unknown>;
}

interface ApprovalQueueProps {
  refreshInterval?: number;
}

const ACTION_TYPE_CONFIG: Record<ActionType, { label: string; icon: React.ComponentType<{ className?: string }>; color: string }> = {
  PHI_REVEAL: {
    label: "PHI Reveal",
    icon: Shield,
    color: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  },
  DATA_EXPORT: {
    label: "Data Export",
    icon: Database,
    color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  },
  AI_ACTION: {
    label: "AI Action",
    icon: Zap,
    color: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
  },
};

const PRIORITY_COLORS: Record<string, string> = {
  low: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  medium: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
  high: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
};

export function ApprovalQueue({ refreshInterval = 30000 }: ApprovalQueueProps) {
  const [selectedAction, setSelectedAction] = useState<PendingAction | null>(null);
  const [approvalReason, setApprovalReason] = useState("");
  const [denialReason, setDenialReason] = useState("");
  const [isApproving, setIsApproving] = useState(false);
  const [isDenying, setIsDenying] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch pending actions
  const { data: pendingActions = [], isLoading, refetch } = useQuery<PendingAction[]>({
    queryKey: ["/api/governance/pending-actions"],
    refetchInterval: refreshInterval,
  });

  // Approve action mutation
  const approveMutation = useMutation({
    mutationFn: async (actionId: string) => {
      return apiRequest.post(`/api/governance/actions/${actionId}/approve`, {
        reason: approvalReason,
      });
    },
    onSuccess: () => {
      toast({
        title: "Action Approved",
        description: "The pending action has been approved.",
      });
      setApprovalReason("");
      setSelectedAction(null);
      queryClient.invalidateQueries({ queryKey: ["/api/governance/pending-actions"] });
    },
    onError: (error: any) => {
      toast({
        title: "Approval Failed",
        description: error.message || "Failed to approve action",
        variant: "destructive",
      });
    },
  });

  // Deny action mutation
  const denyMutation = useMutation({
    mutationFn: async (actionId: string) => {
      return apiRequest.post(`/api/governance/actions/${actionId}/deny`, {
        reason: denialReason,
      });
    },
    onSuccess: () => {
      toast({
        title: "Action Denied",
        description: "The pending action has been denied.",
      });
      setDenialReason("");
      setSelectedAction(null);
      queryClient.invalidateQueries({ queryKey: ["/api/governance/pending-actions"] });
    },
    onError: (error: any) => {
      toast({
        title: "Denial Failed",
        description: error.message || "Failed to deny action",
        variant: "destructive",
      });
    },
  });

  const handleApprove = async () => {
    if (!selectedAction) return;
    setIsApproving(true);
    try {
      await approveMutation.mutateAsync(selectedAction.id);
    } finally {
      setIsApproving(false);
    }
  };

  const handleDeny = async () => {
    if (!selectedAction) return;
    setIsDenying(true);
    try {
      await denyMutation.mutateAsync(selectedAction.id);
    } finally {
      setIsDenying(false);
    }
  };

  const pendingByType = {
    PHI_REVEAL: pendingActions.filter((a) => a.type === "PHI_REVEAL"),
    DATA_EXPORT: pendingActions.filter((a) => a.type === "DATA_EXPORT"),
    AI_ACTION: pendingActions.filter((a) => a.type === "AI_ACTION"),
  };

  if (isLoading) {
    return (
      <Card data-testid="card-approval-queue-loading">
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card data-testid="card-approval-queue">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Approval Queue
              </CardTitle>
              <CardDescription>
                {pendingActions.length} pending action{pendingActions.length !== 1 ? "s" : ""}
              </CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              data-testid="button-refresh-queue"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {pendingActions.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <CheckCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No pending approvals</p>
              <p className="text-sm">All actions have been processed</p>
            </div>
          ) : (
            <Tabs defaultValue="all" className="w-full">
              <TabsList className="mb-4 grid w-full grid-cols-4">
                <TabsTrigger
                  value="all"
                  data-testid="tab-all-actions"
                >
                  All ({pendingActions.length})
                </TabsTrigger>
                <TabsTrigger
                  value="phi"
                  data-testid="tab-phi-actions"
                >
                  PHI ({pendingByType.PHI_REVEAL.length})
                </TabsTrigger>
                <TabsTrigger
                  value="export"
                  data-testid="tab-export-actions"
                >
                  Export ({pendingByType.DATA_EXPORT.length})
                </TabsTrigger>
                <TabsTrigger
                  value="ai"
                  data-testid="tab-ai-actions"
                >
                  AI ({pendingByType.AI_ACTION.length})
                </TabsTrigger>
              </TabsList>

              {["all", "phi", "export", "ai"].map((tabValue) => {
                const typeMap: Record<string, ActionType[]> = {
                  all: ["PHI_REVEAL", "DATA_EXPORT", "AI_ACTION"],
                  phi: ["PHI_REVEAL"],
                  export: ["DATA_EXPORT"],
                  ai: ["AI_ACTION"],
                };

                const actions = pendingActions.filter((a) =>
                  typeMap[tabValue].includes(a.type)
                );

                return (
                  <TabsContent key={tabValue} value={tabValue} className="space-y-3">
                    {actions.length === 0 ? (
                      <div className="text-center py-6 text-muted-foreground">
                        <p>No pending actions in this category</p>
                      </div>
                    ) : (
                      <ScrollArea className="h-[500px] pr-4">
                        <div className="space-y-3">
                          {actions.map((action) => {
                            const config = ACTION_TYPE_CONFIG[action.type];
                            const Icon = config.icon;

                            return (
                              <div
                                key={action.id}
                                className="p-4 rounded-lg border bg-card hover:bg-card/80 transition-colors cursor-pointer"
                                onClick={() => setSelectedAction(action)}
                                data-testid={`action-item-${action.id}`}
                              >
                                <div className="flex items-start gap-4">
                                  <div className={`p-2 rounded-lg ${config.color}`}>
                                    <Icon className="h-5 w-5" />
                                  </div>

                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-1">
                                      <span className="font-semibold text-sm">
                                        {config.label}
                                      </span>
                                      <Badge
                                        className={PRIORITY_COLORS[action.priority]}
                                        variant="outline"
                                      >
                                        {action.priority}
                                      </Badge>
                                    </div>

                                    <p className="text-sm text-muted-foreground mb-2">
                                      {action.description}
                                    </p>

                                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                                      <span>
                                        Requested by {action.requestedBy}
                                      </span>
                                      <span>
                                        {new Date(action.requestedAt).toLocaleString()}
                                      </span>
                                    </div>
                                  </div>

                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setSelectedAction(action);
                                    }}
                                    data-testid={`button-view-action-${action.id}`}
                                  >
                                    <Eye className="h-4 w-4" />
                                  </Button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </ScrollArea>
                    )}
                  </TabsContent>
                );
              })}
            </Tabs>
          )}
        </CardContent>
      </Card>

      {/* Approval Dialog */}
      <Dialog open={!!selectedAction} onOpenChange={(open) => !open && setSelectedAction(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Review Pending Action</DialogTitle>
            <DialogDescription>
              {selectedAction && ACTION_TYPE_CONFIG[selectedAction.type].label}
            </DialogDescription>
          </DialogHeader>

          {selectedAction && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs font-semibold text-muted-foreground">
                    Type
                  </Label>
                  <p className="text-sm font-medium mt-1">
                    {ACTION_TYPE_CONFIG[selectedAction.type].label}
                  </p>
                </div>

                <div>
                  <Label className="text-xs font-semibold text-muted-foreground">
                    Priority
                  </Label>
                  <Badge
                    className={PRIORITY_COLORS[selectedAction.priority]}
                    variant="outline"
                    className="mt-1 w-fit"
                  >
                    {selectedAction.priority}
                  </Badge>
                </div>

                <div>
                  <Label className="text-xs font-semibold text-muted-foreground">
                    Requested By
                  </Label>
                  <p className="text-sm font-medium mt-1">{selectedAction.requestedBy}</p>
                </div>

                <div>
                  <Label className="text-xs font-semibold text-muted-foreground">
                    Requested At
                  </Label>
                  <p className="text-sm font-medium mt-1">
                    {new Date(selectedAction.requestedAt).toLocaleString()}
                  </p>
                </div>

                <div className="col-span-2">
                  <Label className="text-xs font-semibold text-muted-foreground">
                    Resource
                  </Label>
                  <p className="text-sm font-medium mt-1 break-all">
                    {selectedAction.resource}
                  </p>
                </div>

                <div className="col-span-2">
                  <Label className="text-xs font-semibold text-muted-foreground">
                    Description
                  </Label>
                  <p className="text-sm text-muted-foreground mt-1">
                    {selectedAction.description}
                  </p>
                </div>
              </div>

              <div className="border-t pt-4">
                <div className="space-y-3 mb-4">
                  <div>
                    <Label htmlFor="approval-reason" className="text-xs font-semibold">
                      Approval Notes (optional)
                    </Label>
                    <Textarea
                      id="approval-reason"
                      placeholder="Add any notes about this approval..."
                      value={approvalReason}
                      onChange={(e) => setApprovalReason(e.target.value)}
                      className="mt-2 resize-none"
                      rows={3}
                      data-testid="textarea-approval-reason"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          <DialogFooter className="flex gap-2 justify-end">
            <Button
              variant="outline"
              onClick={() => setSelectedAction(null)}
              disabled={isApproving || isDenying}
              data-testid="button-cancel-action"
            >
              Cancel
            </Button>

            <Button
              variant="destructive"
              onClick={handleDeny}
              disabled={isApproving || isDenying}
              data-testid="button-deny-action"
            >
              {isDenying && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Deny
            </Button>

            <Button
              onClick={handleApprove}
              disabled={isApproving || isDenying}
              data-testid="button-approve-action"
            >
              {isApproving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Approve
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
