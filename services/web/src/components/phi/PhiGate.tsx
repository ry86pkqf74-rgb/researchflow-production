import { useState, useEffect } from "react";
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
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  ShieldCheck, 
  ShieldAlert, 
  Loader2, 
  AlertTriangle,
  CheckCircle,
  XCircle
} from "lucide-react";
import { PhiOverrideModal } from "./PhiOverrideModal";

export type PhiScanStatus = "PASS" | "FAIL" | "OVERRIDDEN" | "UNCHECKED" | "SCANNING";

interface PhiScanResult {
  status: PhiScanStatus;
  scanId: string;
  scanDate: string;
  findings: PhiFinding[];
  summary: string;
}

interface PhiFinding {
  type: string;
  severity: "HIGH" | "MEDIUM" | "LOW";
  location: string;
  description: string;
  suggestion: string;
}

interface PhiGateProps {
  stageId: number;
  artifactId?: string;
  researchId?: string;
  onPass: () => void;
  onFail?: () => void;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

export function PhiGate({ 
  stageId, 
  artifactId, 
  researchId,
  onPass, 
  onFail,
  isOpen,
  onOpenChange
}: PhiGateProps) {
  const { toast } = useToast();
  const [scanResult, setScanResult] = useState<PhiScanResult | null>(null);
  const [scanProgress, setScanProgress] = useState(0);
  const [showOverrideModal, setShowOverrideModal] = useState(false);

  const scanMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/ros/phi/scan", {
        stageId,
        artifactId,
        researchId
      });
      const data = await response.json();
      if (data.status === "success" && data.scan) {
        return data.scan as PhiScanResult;
      }
      throw new Error(data.error || "PHI scan failed");
    },
    onSuccess: (scanData: PhiScanResult) => {
      setScanResult(scanData);
      if (scanData.status === "PASS") {
        toast({
          title: "PHI Scan Passed",
          description: "No protected health information detected.",
        });
      } else if (scanData.status === "FAIL") {
        toast({
          title: "PHI Detected",
          description: `Found ${scanData.findings?.length || 0} potential PHI issues.`,
          variant: "destructive",
        });
        onFail?.();
      }
    },
    onError: (error: Error) => {
      toast({
        title: "PHI Scan Failed",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  useEffect(() => {
    if (isOpen && !scanResult && !scanMutation.isPending) {
      scanMutation.mutate();
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) {
      setScanResult(null);
      setScanProgress(0);
      setShowOverrideModal(false);
    }
  }, [isOpen, stageId]);

  useEffect(() => {
    if (scanMutation.isPending) {
      const interval = setInterval(() => {
        setScanProgress((prev) => Math.min(prev + 10, 90));
      }, 200);
      return () => clearInterval(interval);
    } else if (scanResult) {
      setScanProgress(100);
    }
  }, [scanMutation.isPending, scanResult]);

  const handleProceed = () => {
    if (scanResult?.status === "PASS" || scanResult?.status === "OVERRIDDEN") {
      onPass();
      onOpenChange(false);
    }
  };

  const handleOverrideSuccess = () => {
    setShowOverrideModal(false);
    setScanResult((prev) => prev ? { ...prev, status: "OVERRIDDEN" } : null);
    toast({
      title: "Override Applied",
      description: "PHI gate has been overridden. This action has been logged.",
    });
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "HIGH": return "bg-red-500/10 text-red-500 border-red-500/30";
      case "MEDIUM": return "bg-amber-500/10 text-amber-500 border-amber-500/30";
      case "LOW": return "bg-yellow-500/10 text-yellow-500 border-yellow-500/30";
      default: return "bg-muted text-muted-foreground";
    }
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-lg" data-testid="phi-gate-modal">
          <DialogHeader>
            <div className="flex items-center gap-3">
              {scanMutation.isPending ? (
                <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                  <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />
                </div>
              ) : scanResult?.status === "PASS" || scanResult?.status === "OVERRIDDEN" ? (
                <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center">
                  <ShieldCheck className="w-5 h-5 text-green-500" />
                </div>
              ) : scanResult?.status === "FAIL" ? (
                <div className="w-10 h-10 rounded-lg bg-red-500/10 flex items-center justify-center">
                  <ShieldAlert className="w-5 h-5 text-red-500" />
                </div>
              ) : (
                <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
                  <ShieldCheck className="w-5 h-5 text-muted-foreground" />
                </div>
              )}
              <div>
                <DialogTitle>PHI Compliance Gate</DialogTitle>
                <DialogDescription>
                  Stage {stageId} requires PHI verification before proceeding
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {scanMutation.isPending && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Scanning for PHI...</span>
                  <span className="font-medium">{scanProgress}%</span>
                </div>
                <Progress value={scanProgress} className="h-2" />
                <p className="text-xs text-muted-foreground">
                  Checking for SSN, MRN, names, dates of birth, and other identifiers...
                </p>
              </div>
            )}

            {scanResult && (
              <div className="space-y-4">
                <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                  <div className="flex items-center gap-2">
                    {scanResult.status === "PASS" && (
                      <>
                        <CheckCircle className="w-5 h-5 text-green-500" />
                        <span className="font-medium text-green-600 dark:text-green-400">
                          No PHI Detected
                        </span>
                      </>
                    )}
                    {scanResult.status === "FAIL" && (
                      <>
                        <XCircle className="w-5 h-5 text-red-500" />
                        <span className="font-medium text-red-600 dark:text-red-400">
                          PHI Detected - {scanResult.findings.length} Issues
                        </span>
                      </>
                    )}
                    {scanResult.status === "OVERRIDDEN" && (
                      <>
                        <AlertTriangle className="w-5 h-5 text-amber-500" />
                        <span className="font-medium text-amber-600 dark:text-amber-400">
                          Override Applied
                        </span>
                      </>
                    )}
                  </div>
                  <Badge 
                    variant="outline" 
                    className={
                      scanResult.status === "PASS" 
                        ? "border-green-500/50 text-green-600" 
                        : scanResult.status === "OVERRIDDEN"
                        ? "border-amber-500/50 text-amber-600"
                        : "border-red-500/50 text-red-600"
                    }
                    data-testid="phi-status-result"
                  >
                    {scanResult.status}
                  </Badge>
                </div>

                {scanResult.summary && (
                  <p className="text-sm text-muted-foreground">
                    {scanResult.summary}
                  </p>
                )}

                {scanResult.findings.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="text-sm font-medium">Findings</h4>
                    <div className="max-h-48 overflow-y-auto space-y-2">
                      {scanResult.findings.map((finding, idx) => (
                        <div 
                          key={idx} 
                          className="p-3 rounded-lg border bg-card text-sm space-y-1"
                          data-testid={`phi-finding-${idx}`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-medium">{finding.type}</span>
                            <Badge 
                              variant="outline" 
                              className={getSeverityColor(finding.severity)}
                            >
                              {finding.severity}
                            </Badge>
                          </div>
                          <p className="text-muted-foreground">{finding.description}</p>
                          <p className="text-xs text-muted-foreground">
                            Location: {finding.location}
                          </p>
                          {finding.suggestion && (
                            <p className="text-xs text-blue-600 dark:text-blue-400">
                              Suggestion: {finding.suggestion}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            {scanResult?.status === "FAIL" && (
              <Button
                variant="outline"
                onClick={() => setShowOverrideModal(true)}
                className="border-amber-500/50 text-amber-600 hover:bg-amber-500/10"
                data-testid="button-phi-override"
              >
                <AlertTriangle className="w-4 h-4 mr-2" />
                Request Override
              </Button>
            )}
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              data-testid="button-phi-cancel"
            >
              Cancel
            </Button>
            <Button
              onClick={handleProceed}
              disabled={scanMutation.isPending || scanResult?.status === "FAIL"}
              data-testid="button-phi-proceed"
            >
              {scanMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Scanning...
                </>
              ) : (
                "Proceed to Stage"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <PhiOverrideModal
        isOpen={showOverrideModal}
        onOpenChange={setShowOverrideModal}
        stageId={stageId}
        artifactId={artifactId}
        scanId={scanResult?.scanId}
        onSuccess={handleOverrideSuccess}
      />
    </>
  );
}
