import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Package,
  Shield,
  ShieldAlert,
  ShieldCheck,
  ShieldX,
  Clock,
  User,
  ChevronDown,
  ChevronRight,
  AlertTriangle,
  Check,
  X,
  Loader2,
  FileText,
  RefreshCw,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

interface PHIScanSummary {
  scannedAt: string;
  totalPatternsDetected: number;
  riskLevel: "none" | "low" | "medium" | "high";
  requiresOverride: boolean;
  byCategory?: Record<string, number>;
}

interface BundleRequest {
  requestId: string;
  researchId: string;
  status: string;
  requestedBy: string;
  requestedByEmail?: string;
  requestedByName?: string;
  requestedAt: string;
  phiOverride?: {
    applied: boolean;
    justification?: string;
    approvedBy?: string;
    expiresAt?: string;
  };
  metadata?: {
    phiScanSummary?: PHIScanSummary;
    contentCounts?: {
      topics: number;
      statisticalPlans: number;
      artifacts: number;
      auditLogs: number;
    };
    bundleId?: string;
  };
}

const statusConfig: Record<string, { label: string; icon: typeof Shield; color: string }> = {
  PENDING: { label: "Pending Approval", icon: Clock, color: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" },
  PHI_BLOCKED: { label: "PHI Detected", icon: ShieldAlert, color: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" },
  APPROVED: { label: "Approved", icon: ShieldCheck, color: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" },
  REJECTED: { label: "Denied", icon: ShieldX, color: "bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400" },
};

const riskColors: Record<string, string> = {
  none: "text-green-600",
  low: "text-yellow-600",
  medium: "text-orange-600",
  high: "text-red-600",
};

function formatDate(dateString: string) {
  return new Date(dateString).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

interface RequestCardProps {
  request: BundleRequest;
  onApprove: (requestId: string) => void;
  onDeny: (requestId: string, reason: string) => void;
  onPHIOverride: (requestId: string, justification: string) => void;
  isProcessing: boolean;
}

function RequestCard({ request, onApprove, onDeny, onPHIOverride, isProcessing }: RequestCardProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [showDenyDialog, setShowDenyDialog] = useState(false);
  const [showOverrideDialog, setShowOverrideDialog] = useState(false);
  const [denyReason, setDenyReason] = useState("");
  const [overrideJustification, setOverrideJustification] = useState("");

  const config = statusConfig[request.status] || statusConfig.PENDING;
  const StatusIcon = config.icon;
  const phiScan = request.metadata?.phiScanSummary;
  const contentCounts = request.metadata?.contentCounts;

  const handleDeny = () => {
    onDeny(request.requestId, denyReason);
    setShowDenyDialog(false);
    setDenyReason("");
  };

  const handleOverride = () => {
    onPHIOverride(request.requestId, overrideJustification);
    setShowOverrideDialog(false);
    setOverrideJustification("");
  };

  return (
    <>
      <Card className="border-l-4" style={{ borderLeftColor: request.status === "PHI_BLOCKED" ? "rgb(239 68 68)" : "rgb(234 179 8)" }} data-testid={`card-request-${request.requestId}`}>
        <Collapsible open={isOpen} onOpenChange={setIsOpen}>
          <CollapsibleTrigger className="w-full">
            <CardHeader className="flex flex-row items-center justify-between gap-4 pb-2">
              <div className="flex items-center gap-3">
                {isOpen ? (
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                )}
                <Package className="h-5 w-5 text-ros-primary" />
                <div className="text-left">
                  <CardTitle className="text-base">
                    Bundle Export Request
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Research: {request.researchId.slice(0, 12)}...
                  </CardDescription>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge className={config.color} data-testid={`badge-status-${request.requestId}`}>
                  <StatusIcon className="h-3 w-3 mr-1" />
                  {config.label}
                </Badge>
              </div>
            </CardHeader>
          </CollapsibleTrigger>

          <CollapsibleContent>
            <CardContent className="space-y-4 pt-0">
              <div className="grid grid-cols-2 gap-4 p-3 rounded-lg bg-muted/50">
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">Requested by:</span>
                  <span className="text-sm font-medium" data-testid={`text-requester-${request.requestId}`}>
                    {request.requestedByName || request.requestedByEmail || request.requestedBy}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">Date:</span>
                  <span className="text-sm font-medium">
                    {formatDate(request.requestedAt)}
                  </span>
                </div>
              </div>

              {contentCounts && (
                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline" className="text-xs">
                    <FileText className="h-3 w-3 mr-1" />
                    {contentCounts.topics} Topics
                  </Badge>
                  <Badge variant="outline" className="text-xs">
                    {contentCounts.statisticalPlans} SAPs
                  </Badge>
                  <Badge variant="outline" className="text-xs">
                    {contentCounts.artifacts} Artifacts
                  </Badge>
                  <Badge variant="outline" className="text-xs">
                    {contentCounts.auditLogs} Audit Entries
                  </Badge>
                </div>
              )}

              {phiScan && phiScan.requiresOverride && (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>PHI Detected</AlertTitle>
                  <AlertDescription className="space-y-2">
                    <p>
                      {phiScan.totalPatternsDetected} potential PHI pattern(s) detected.
                      Risk level: <span className={`font-semibold ${riskColors[phiScan.riskLevel]}`}>
                        {phiScan.riskLevel.toUpperCase()}
                      </span>
                    </p>
                    {phiScan.byCategory && Object.keys(phiScan.byCategory).length > 0 && (
                      <div className="text-xs">
                        Categories: {Object.entries(phiScan.byCategory)
                          .map(([cat, count]) => `${cat}: ${count}`)
                          .join(", ")}
                      </div>
                    )}
                  </AlertDescription>
                </Alert>
              )}

              {request.phiOverride?.applied && (
                <Alert className="border-amber-500 bg-amber-50 dark:bg-amber-900/20">
                  <ShieldCheck className="h-4 w-4 text-amber-600" />
                  <AlertTitle className="text-amber-800 dark:text-amber-200">PHI Override Applied</AlertTitle>
                  <AlertDescription className="text-amber-700 dark:text-amber-300">
                    <p>Justification: {request.phiOverride.justification}</p>
                    <p className="text-xs mt-1">
                      Expires: {request.phiOverride.expiresAt ? formatDate(request.phiOverride.expiresAt) : "N/A"}
                    </p>
                  </AlertDescription>
                </Alert>
              )}

              <div className="flex justify-end gap-2 pt-2 border-t">
                {request.status === "PHI_BLOCKED" && !request.phiOverride?.applied && (
                  <Button
                    variant="outline"
                    onClick={() => setShowOverrideDialog(true)}
                    disabled={isProcessing}
                    data-testid={`button-override-${request.requestId}`}
                  >
                    <ShieldAlert className="h-4 w-4 mr-2" />
                    Apply PHI Override
                  </Button>
                )}
                <Button
                  variant="outline"
                  onClick={() => setShowDenyDialog(true)}
                  disabled={isProcessing}
                  data-testid={`button-deny-${request.requestId}`}
                >
                  <X className="h-4 w-4 mr-2" />
                  Deny
                </Button>
                <Button
                  onClick={() => onApprove(request.requestId)}
                  disabled={isProcessing || (request.status === "PHI_BLOCKED" && !request.phiOverride?.applied)}
                  data-testid={`button-approve-${request.requestId}`}
                >
                  {isProcessing ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Check className="h-4 w-4 mr-2" />
                  )}
                  Approve Export
                </Button>
              </div>
            </CardContent>
          </CollapsibleContent>
        </Collapsible>
      </Card>

      <Dialog open={showDenyDialog} onOpenChange={setShowDenyDialog}>
        <DialogContent data-testid="modal-deny-request">
          <DialogHeader>
            <DialogTitle>Deny Export Request</DialogTitle>
            <DialogDescription>
              Provide a reason for denying this export request. This will be logged in the audit trail.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="deny-reason">Denial Reason (required)</Label>
              <Textarea
                id="deny-reason"
                placeholder="Enter the reason for denial..."
                value={denyReason}
                onChange={(e) => setDenyReason(e.target.value)}
                className="min-h-[100px]"
                data-testid="input-deny-reason"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDenyDialog(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeny}
              disabled={denyReason.length < 10}
              data-testid="button-confirm-deny"
            >
              Confirm Denial
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showOverrideDialog} onOpenChange={setShowOverrideDialog}>
        <DialogContent data-testid="modal-phi-override">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-amber-500" />
              PHI Override
            </DialogTitle>
            <DialogDescription>
              Applying a PHI override allows the export to proceed despite detected PHI patterns.
              This requires detailed justification (minimum 20 characters).
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                Overriding PHI controls is a sensitive action. Ensure you have proper authorization
                and document your justification thoroughly. This will be permanently logged.
              </AlertDescription>
            </Alert>
            <div className="space-y-2">
              <Label htmlFor="override-justification">Justification (minimum 20 characters)</Label>
              <Textarea
                id="override-justification"
                placeholder="Explain why this export is permitted despite PHI detection..."
                value={overrideJustification}
                onChange={(e) => setOverrideJustification(e.target.value)}
                className="min-h-[120px]"
                data-testid="input-override-justification"
              />
              <p className="text-xs text-muted-foreground">
                {overrideJustification.length}/20 characters minimum
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowOverrideDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleOverride}
              disabled={overrideJustification.length < 20}
              data-testid="button-confirm-override"
            >
              Apply Override
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export interface StewardExportApprovalProps {
  className?: string;
}

export function StewardExportApproval({ className }: StewardExportApprovalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [processingId, setProcessingId] = useState<string | null>(null);

  const { data: pendingRequests = [], isLoading, refetch } = useQuery<BundleRequest[]>({
    queryKey: ["/api/ros/export/requests/pending"],
    refetchInterval: 30000,
  });

  const approveMutation = useMutation({
    mutationFn: async (requestId: string) => {
      const res = await apiRequest("POST", `/api/ros/export/bundle/approve/${requestId}`, {});
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ros/export/requests/pending"] });
      toast({
        title: "Export Approved",
        description: "The export request has been approved. The researcher can now download the bundle.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Approval Failed",
        description: error.message,
        variant: "destructive",
      });
    },
    onSettled: () => setProcessingId(null),
  });

  const denyMutation = useMutation({
    mutationFn: async ({ requestId, reason }: { requestId: string; reason: string }) => {
      const res = await apiRequest("POST", `/api/ros/export/bundle/deny/${requestId}`, { reason });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ros/export/requests/pending"] });
      toast({
        title: "Export Denied",
        description: "The export request has been denied.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Denial Failed",
        description: error.message,
        variant: "destructive",
      });
    },
    onSettled: () => setProcessingId(null),
  });

  const overrideMutation = useMutation({
    mutationFn: async ({ requestId, justification }: { requestId: string; justification: string }) => {
      const res = await apiRequest("POST", `/api/ros/export/bundle/phi-override/${requestId}`, { justification });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ros/export/requests/pending"] });
      toast({
        title: "PHI Override Applied",
        description: "The PHI override has been applied. The request is now pending final approval.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Override Failed",
        description: error.message,
        variant: "destructive",
      });
    },
    onSettled: () => setProcessingId(null),
  });

  const handleApprove = (requestId: string) => {
    setProcessingId(requestId);
    approveMutation.mutate(requestId);
  };

  const handleDeny = (requestId: string, reason: string) => {
    setProcessingId(requestId);
    denyMutation.mutate({ requestId, reason });
  };

  const handlePHIOverride = (requestId: string, justification: string) => {
    setProcessingId(requestId);
    overrideMutation.mutate({ requestId, justification });
  };

  return (
    <Card className={className} data-testid="panel-steward-export-approval">
      <CardHeader className="flex flex-row items-center justify-between gap-4 pb-4">
        <div className="flex items-center gap-2">
          <Shield className="h-5 w-5 text-ros-primary" />
          <div>
            <CardTitle>Export Approval Queue</CardTitle>
            <CardDescription>
              Review and approve bundle export requests
            </CardDescription>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="secondary" data-testid="badge-pending-count">
            {pendingRequests.length} pending
          </Badge>
          <Button
            variant="outline"
            size="icon"
            onClick={() => refetch()}
            disabled={isLoading}
            data-testid="button-refresh-requests"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {isLoading && pendingRequests.length === 0 && (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        )}

        {!isLoading && pendingRequests.length === 0 && (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <ShieldCheck className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="font-medium">No Pending Requests</h3>
            <p className="text-sm text-muted-foreground mt-1">
              All export requests have been processed
            </p>
          </div>
        )}

        {pendingRequests.map((request) => (
          <RequestCard
            key={request.requestId}
            request={request}
            onApprove={handleApprove}
            onDeny={handleDeny}
            onPHIOverride={handlePHIOverride}
            isProcessing={processingId === request.requestId}
          />
        ))}
      </CardContent>
    </Card>
  );
}
