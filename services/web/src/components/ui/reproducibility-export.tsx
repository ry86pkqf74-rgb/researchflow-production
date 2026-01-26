import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Package,
  Download,
  ChevronDown,
  ChevronRight,
  FileCode,
  Database,
  FileText,
  Settings,
  FileOutput,
  Check,
  Copy,
  Loader2,
  Shield,
  ShieldAlert,
  ShieldCheck,
  ShieldX,
  Clock,
  HardDrive,
  AlertTriangle,
  RefreshCw,
  Send,
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { ReproducibilityBundle, ReproducibilityArtifact } from "@packages/core/types";

interface PHIScanSummary {
  scannedAt: string;
  totalPatternsDetected: number;
  riskLevel: "none" | "low" | "medium" | "high";
  requiresOverride: boolean;
  byCategory?: Record<string, number>;
}

interface BundleRequestStatus {
  requestId: string;
  researchId: string;
  status: "PENDING" | "PHI_BLOCKED" | "APPROVED" | "REJECTED";
  requestedBy: string;
  requestedAt: string;
  approvedBy?: string;
  approvedAt?: string;
  deniedReason?: string;
  expiresAt?: string;
  phiOverride?: {
    applied: boolean;
    justification?: string;
    approvedBy?: string;
    expiresAt?: string;
  };
  metadata?: {
    phiScanSummary?: PHIScanSummary;
    contentCounts?: Record<string, number>;
    bundleId?: string;
  };
}

interface ReproducibilityExportProps {
  bundle?: ReproducibilityBundle;
  onGenerateBundle?: () => Promise<void>;
  onDownloadBundle?: () => Promise<void>;
  isGenerating?: boolean;
  generationProgress?: number;
  researchId?: string;
  isDemoMode?: boolean;
}

const ARTIFACT_TYPE_CONFIG: Record<
  ReproducibilityArtifact["type"],
  { icon: typeof FileCode; label: string; color: string }
> = {
  config: {
    icon: Settings,
    label: "Configuration",
    color: "text-ros-workflow",
  },
  data_schema: {
    icon: Database,
    label: "Data Schema",
    color: "text-ros-primary",
  },
  analysis_script: {
    icon: FileCode,
    label: "Analysis Script",
    color: "text-ros-success",
  },
  output: {
    icon: FileOutput,
    label: "Output",
    color: "text-muted-foreground",
  },
  manifest: {
    icon: FileText,
    label: "Manifest",
    color: "text-ros-alert",
  },
};

const statusConfig: Record<string, { label: string; icon: typeof Shield; color: string; bg: string }> = {
  PENDING: { 
    label: "Pending Approval", 
    icon: Clock, 
    color: "text-amber-700 dark:text-amber-400",
    bg: "bg-amber-100 dark:bg-amber-900/30"
  },
  PHI_BLOCKED: { 
    label: "PHI Detected", 
    icon: ShieldAlert, 
    color: "text-red-700 dark:text-red-400",
    bg: "bg-red-100 dark:bg-red-900/30"
  },
  APPROVED: { 
    label: "Approved", 
    icon: ShieldCheck, 
    color: "text-green-700 dark:text-green-400",
    bg: "bg-green-100 dark:bg-green-900/30"
  },
  REJECTED: { 
    label: "Denied", 
    icon: ShieldX, 
    color: "text-gray-700 dark:text-gray-400",
    bg: "bg-gray-100 dark:bg-gray-900/30"
  },
};

const riskColors: Record<string, string> = {
  none: "text-green-600",
  low: "text-yellow-600",
  medium: "text-orange-600",
  high: "text-red-600",
};

function ArtifactTypeSection({
  type,
  artifacts,
}: {
  type: ReproducibilityArtifact["type"];
  artifacts: ReproducibilityArtifact[];
}) {
  const [isOpen, setIsOpen] = useState(true);
  const config = ARTIFACT_TYPE_CONFIG[type];
  const IconComponent = config.icon;

  if (artifacts.length === 0) return null;

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger className="flex items-center gap-2 w-full p-2 rounded-md hover-elevate text-sm">
        {isOpen ? (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        )}
        <IconComponent className={`h-4 w-4 ${config.color}`} />
        <span className="font-medium">{config.label}</span>
        <Badge variant="secondary" className="text-xs ml-auto">
          {artifacts.length}
        </Badge>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="ml-6 mt-1 space-y-1">
          {artifacts.map((artifact) => (
            <div
              key={artifact.id}
              className="flex items-center justify-between gap-3 p-2 rounded-md bg-muted/30 text-sm"
              data-testid={`artifact-${artifact.id}`}
            >
              <div className="flex items-center gap-2 min-w-0">
                <FileText className="h-3 w-3 text-muted-foreground shrink-0" />
                <span className="truncate">{artifact.name}</span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-xs text-muted-foreground">
                  {artifact.size}
                </span>
                {artifact.hash && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Badge variant="outline" className="text-[10px] font-mono">
                        {artifact.hash.slice(0, 8)}
                      </Badge>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="text-xs font-mono">{artifact.hash}</p>
                    </TooltipContent>
                  </Tooltip>
                )}
              </div>
            </div>
          ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

function ChecksumDisplay({
  checksum,
  onCopy,
}: {
  checksum: string;
  onCopy: () => void;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(checksum);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    onCopy();
  };

  return (
    <div className="flex items-center gap-2 p-3 rounded-md bg-muted/50 border">
      <Shield className="h-4 w-4 text-ros-success shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="text-xs text-muted-foreground mb-1">Bundle Checksum (SHA-256)</div>
        <code className="text-xs font-mono break-all">{checksum}</code>
      </div>
      <Button
        variant="ghost"
        size="icon"
        onClick={handleCopy}
        className="shrink-0"
        data-testid="button-copy-checksum"
      >
        {copied ? (
          <Check className="h-3 w-3 text-ros-success" />
        ) : (
          <Copy className="h-3 w-3" />
        )}
      </Button>
    </div>
  );
}

function formatDate(dateString: string) {
  return new Date(dateString).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function isDownloadExpired(expiresAt?: string): boolean {
  if (!expiresAt) return false;
  return new Date(expiresAt) < new Date();
}

function getTimeRemaining(expiresAt?: string): string {
  if (!expiresAt) return "";
  const now = new Date();
  const expires = new Date(expiresAt);
  const diff = expires.getTime() - now.getTime();
  if (diff <= 0) return "Expired";
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  return `${hours}h ${minutes}m remaining`;
}

export function ReproducibilityExport({
  bundle,
  onGenerateBundle,
  onDownloadBundle: _onDownloadBundle,
  isGenerating = false,
  generationProgress = 0,
  researchId,
  isDemoMode = false,
}: ReproducibilityExportProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showRequestDialog, setShowRequestDialog] = useState(false);
  const [exportReason, setExportReason] = useState("");

  const { data: projectRequests = [], refetch: refetchRequests } = useQuery<BundleRequestStatus[]>({
    queryKey: ["/api/ros/export/requests", researchId],
    queryFn: async () => {
      const res = await fetch(`/api/ros/export/requests?researchId=${researchId}`, {
        credentials: "include",
      });
      if (!res.ok) {
        throw new Error("Failed to fetch export requests");
      }
      return res.json();
    },
    enabled: !!researchId,
  });

  const latestRequest = projectRequests.length > 0 ? projectRequests[0] : null;

  const requestMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/ros/export/bundle/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          researchId,
          reason: exportReason || "Reproducibility bundle export request",
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 403 && data.code === "PHI_DETECTED") {
          return { ...data, _phiBlocked: true };
        }
        throw new Error(data.error || data.message || "Request failed");
      }
      return data;
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/ros/export/requests", researchId] });
      setShowRequestDialog(false);
      setExportReason("");
      
      if (data._phiBlocked || data.status === "PHI_BLOCKED") {
        toast({
          title: "PHI Detected",
          description: "Your export request requires STEWARD approval due to detected PHI patterns. Request ID: " + (data.requestId || "pending"),
          variant: "destructive",
        });
        refetchRequests();
      } else {
        toast({
          title: "Export Requested",
          description: "Your bundle export request has been submitted for approval.",
        });
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Request Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleDownload = async () => {
    if (!latestRequest?.requestId) return;

    try {
      window.open(`/api/ros/export/bundle/download/${latestRequest.requestId}`, "_blank");
      toast({
        title: "Download Started",
        description: "Your bundle download has started.",
      });
    } catch {
      toast({
        title: "Download Failed",
        description: "Failed to download bundle. Please try again.",
        variant: "destructive",
      });
    }
  };

  const artifactsByType = bundle?.artifacts.reduce((acc, artifact) => {
    if (!acc[artifact.type]) {
      acc[artifact.type] = [];
    }
    acc[artifact.type].push(artifact);
    return acc;
  }, {} as Record<ReproducibilityArtifact["type"], ReproducibilityArtifact[]>);

  const canRequestExport = !latestRequest || 
    latestRequest.status === "REJECTED" || 
    (latestRequest.status === "APPROVED" && isDownloadExpired(latestRequest.expiresAt));

  return (
    <>
      <Card className="overflow-hidden" data-testid="panel-reproducibility-export">
        <div className="p-4 border-b border-border bg-muted/30">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Package className="h-4 w-4 text-ros-primary" />
              <span className="font-medium text-sm">Reproducibility Bundle</span>
              {latestRequest && statusConfig[latestRequest.status] && (
                <Badge className={`${statusConfig[latestRequest.status].bg} ${statusConfig[latestRequest.status].color} text-xs`} data-testid="badge-request-status">
                  {(() => {
                    const StatusIcon = statusConfig[latestRequest.status].icon;
                    return <StatusIcon className="h-2.5 w-2.5 mr-1" />;
                  })()}
                  {statusConfig[latestRequest.status].label}
                </Badge>
              )}
              {bundle?.status === "ready" && !latestRequest && (
                <Badge className="bg-ros-success/10 text-ros-success border-ros-success/30 text-xs">
                  <Check className="h-2.5 w-2.5 mr-1" />
                  Ready
                </Badge>
              )}
              {bundle?.status === "generating" && (
                <Badge className="bg-ros-workflow/10 text-ros-workflow border-ros-workflow/30 text-xs">
                  <Loader2 className="h-2.5 w-2.5 mr-1 animate-spin" />
                  Generating
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-2">
              {researchId && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => refetchRequests()}
                  data-testid="button-refresh-status"
                >
                  <RefreshCw className="h-3 w-3" />
                </Button>
              )}
              {bundle && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <HardDrive className="h-3 w-3" />
                  <span>{bundle.totalSize}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="p-4 space-y-4">
          {isDemoMode && (
            <Alert variant="destructive">
              <ShieldAlert className="h-4 w-4" />
              <AlertTitle>Demo Mode Active</AlertTitle>
              <AlertDescription>
                Exports are disabled in DEMO mode. Switch to LIVE mode to export data.
              </AlertDescription>
            </Alert>
          )}

          {isGenerating && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Generating bundle...</span>
                <span className="font-medium">{Math.round(generationProgress)}%</span>
              </div>
              <Progress value={generationProgress} className="h-2" />
              <p className="text-xs text-muted-foreground">
                Collecting artifacts and computing checksums
              </p>
            </div>
          )}

          {latestRequest?.status === "PHI_BLOCKED" && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>PHI Detected in Export</AlertTitle>
              <AlertDescription className="space-y-2">
                <p>
                  Potential PHI patterns were detected in the bundle content. 
                  A STEWARD must apply a PHI override before this export can be approved.
                </p>
                {latestRequest.metadata?.phiScanSummary && (
                  <p className="text-xs">
                    {latestRequest.metadata.phiScanSummary.totalPatternsDetected} pattern(s) detected. 
                    Risk level: <span className={riskColors[latestRequest.metadata.phiScanSummary.riskLevel]}>
                      {latestRequest.metadata.phiScanSummary.riskLevel.toUpperCase()}
                    </span>
                  </p>
                )}
              </AlertDescription>
            </Alert>
          )}

          {latestRequest?.status === "PENDING" && (
            <Alert className="border-amber-500 bg-amber-50 dark:bg-amber-900/20">
              <Clock className="h-4 w-4 text-amber-600" />
              <AlertTitle className="text-amber-800 dark:text-amber-200">Awaiting Approval</AlertTitle>
              <AlertDescription className="text-amber-700 dark:text-amber-300">
                Your export request is pending STEWARD approval. You will be notified when it is approved.
              </AlertDescription>
            </Alert>
          )}

          {latestRequest?.status === "REJECTED" && (
            <Alert variant="destructive">
              <ShieldX className="h-4 w-4" />
              <AlertTitle>Export Denied</AlertTitle>
              <AlertDescription>
                <p>Your export request was denied.</p>
                {latestRequest.deniedReason && (
                  <p className="text-xs mt-1">Reason: {latestRequest.deniedReason}</p>
                )}
              </AlertDescription>
            </Alert>
          )}

          {latestRequest?.status === "APPROVED" && (
            <>
              {isDownloadExpired(latestRequest.expiresAt) ? (
                <Alert variant="destructive">
                  <Clock className="h-4 w-4" />
                  <AlertTitle>Download Expired</AlertTitle>
                  <AlertDescription>
                    Your download link has expired. Please request a new export.
                  </AlertDescription>
                </Alert>
              ) : (
                <Alert className="border-green-500 bg-green-50 dark:bg-green-900/20">
                  <ShieldCheck className="h-4 w-4 text-green-600" />
                  <AlertTitle className="text-green-800 dark:text-green-200">Export Approved</AlertTitle>
                  <AlertDescription className="text-green-700 dark:text-green-300">
                    <p>Your export is ready for download.</p>
                    {latestRequest.expiresAt && (
                      <p className="text-xs mt-1 flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {getTimeRemaining(latestRequest.expiresAt)}
                      </p>
                    )}
                  </AlertDescription>
                </Alert>
              )}
            </>
          )}

          {(!researchId || canRequestExport) && !isGenerating && !isDemoMode && (
            <div className="flex flex-col items-center justify-center gap-4 py-6 text-center">
              <Package className="h-12 w-12 text-muted-foreground" />
              <div>
                <h3 className="font-medium">Request Reproducibility Bundle</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Package all artifacts for complete reproducibility
                </p>
              </div>
              <Button 
                onClick={() => researchId ? setShowRequestDialog(true) : onGenerateBundle?.()}
                disabled={isDemoMode}
                data-testid="button-request-export"
              >
                <Send className="h-4 w-4 mr-2" />
                Request Export
              </Button>
            </div>
          )}

          {bundle && bundle.status === "ready" && (
            <>
              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  Generated: {formatDate(bundle.generatedAt)}
                </span>
                <Badge variant="outline" className="text-[10px] font-mono">
                  Topic: {bundle.topicVersionHash.slice(0, 8)}
                </Badge>
              </div>

              <ChecksumDisplay
                checksum={bundle.checksum}
                onCopy={() => {}}
              />

              <div className="border rounded-lg divide-y">
                {(["config", "data_schema", "analysis_script", "output", "manifest"] as const).map(
                  (type) =>
                    artifactsByType?.[type] && (
                      <ArtifactTypeSection
                        key={type}
                        type={type}
                        artifacts={artifactsByType[type]}
                      />
                    )
                )}
              </div>
            </>
          )}

          {latestRequest?.status === "APPROVED" && !isDownloadExpired(latestRequest.expiresAt) && (
            <div className="flex justify-end gap-2 pt-2">
              <Button
                onClick={handleDownload}
                disabled={isDemoMode}
                data-testid="button-download-bundle"
              >
                <Download className="h-4 w-4 mr-2" />
                Download Bundle
              </Button>
            </div>
          )}

          {bundle && bundle.status === "error" && (
            <div className="flex flex-col items-center justify-center gap-4 py-6 text-center">
              <div className="h-12 w-12 rounded-full bg-ros-alert/10 flex items-center justify-center">
                <Package className="h-6 w-6 text-ros-alert" />
              </div>
              <div>
                <h3 className="font-medium text-ros-alert">Generation Failed</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  An error occurred while generating the bundle
                </p>
              </div>
              <Button onClick={onGenerateBundle} variant="outline" data-testid="button-retry-bundle">
                Retry Generation
              </Button>
            </div>
          )}
        </div>
      </Card>

      <Dialog open={showRequestDialog} onOpenChange={setShowRequestDialog}>
        <DialogContent data-testid="modal-request-export">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Package className="h-5 w-5 text-ros-primary" />
              Request Bundle Export
            </DialogTitle>
            <DialogDescription>
              Your export request will be reviewed by a STEWARD before the bundle can be downloaded.
              PHI patterns will be scanned automatically.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <Alert>
              <Shield className="h-4 w-4" />
              <AlertDescription>
                This export will include all topics, statistical plans, artifacts, and audit logs
                for this research project. A pre-scan for PHI will be performed.
              </AlertDescription>
            </Alert>
            <div className="space-y-2">
              <Label htmlFor="export-reason">Export Reason (optional)</Label>
              <Textarea
                id="export-reason"
                placeholder="Describe why you need to export this bundle..."
                value={exportReason}
                onChange={(e) => setExportReason(e.target.value)}
                className="min-h-[100px]"
                data-testid="input-export-reason"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRequestDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => requestMutation.mutate()}
              disabled={requestMutation.isPending}
              data-testid="button-submit-request"
            >
              {requestMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Submitting...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4 mr-2" />
                  Submit Request
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
