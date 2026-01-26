import { createContext, useContext, useState, useCallback, type ReactNode } from "react";
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
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  ShieldCheck,
  ShieldAlert,
  ShieldOff,
  AlertTriangle,
  Loader2,
  HelpCircle,
  FileText,
  Calendar,
  MapPin,
  Phone,
  Mail,
  Key,
  User,
} from "lucide-react";
import {
  type PhiStatus,
  type PhiFinding,
  type PhiScanResult,
  type PhiAuditLogEntry,
  PHI_STATUS_METADATA,
  PHI_GATE_POSITIONS,
  getPhiGateForStage,
  canProceedWithPhiStatus,
  createPhiAuditEntry,
  isValidOverrideJustification,
} from "@/lib/governance";

interface ServerPHIPattern {
  id: string;
  category: string;
  pattern: string;
  matchedText: string;
  position: { start: number; end: number };
  confidence: number;
  suggestedAction: 'redact' | 'review' | 'remove';
  hipaaIdentifier: string;
}

interface ServerPHIScanResult {
  scanId: string;
  scannedAt: string;
  context: 'upload' | 'export';
  contentLength: number;
  detected: ServerPHIPattern[];
  riskLevel: 'none' | 'low' | 'medium' | 'high';
  requiresOverride: boolean;
  summary: {
    totalPatterns: number;
    byCategory: Record<string, number>;
    highConfidenceCount: number;
  };
}

interface ServerPHIOverrideResult {
  approved: boolean;
  auditId: string;
  reviewedAt: string;
  reviewedBy: string;
  expiresAt?: string;
  conditions?: string[];
}

function mapServerScanToClientResult(serverResult: ServerPHIScanResult): PhiScanResult {
  const findings: PhiFinding[] = serverResult.detected.map(pattern => ({
    id: pattern.id,
    type: pattern.category.toUpperCase() as PhiFinding["type"],
    value: pattern.matchedText,
    location: `position ${pattern.position.start}-${pattern.position.end}`,
    confidence: pattern.confidence,
    context: pattern.pattern,
  }));

  const status: PhiStatus = serverResult.detected.length > 0 ? "FAIL" : "PASS";

  return {
    id: serverResult.scanId,
    timestamp: serverResult.scannedAt,
    status,
    findings,
    scanScope: serverResult.context,
    durationMs: 0,
    datasetHash: `scan-${serverResult.scanId}`,
  };
}

interface PhiGateContextType {
  phiStatus: PhiStatus;
  scanResult: PhiScanResult | null;
  auditLog: PhiAuditLogEntry[];
  isScanning: boolean;
  pendingGate: {
    stageId: number;
    stageName: string;
    gate: typeof PHI_GATE_POSITIONS[0];
  } | null;
  requestGateCheck: (stageId: number, stageName: string) => Promise<{ passed: boolean; status: PhiStatus }>;
  runPhiScan: (scope: string) => Promise<PhiScanResult>;
  requestOverride: (justification: string) => Promise<boolean>;
  quarantineFindings: () => void;
  remediateFindings: () => void;
  resetPhiState: () => void;
  getPhiStats: () => { scans: number; blocked: number; overrides: number };
}

const PhiGateContext = createContext<PhiGateContextType | null>(null);

export function usePhiGate() {
  const context = useContext(PhiGateContext);
  if (!context) {
    throw new Error("usePhiGate must be used within a PhiGateProvider");
  }
  return context;
}

const PHI_FINDING_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  NAME: User,
  DATE: Calendar,
  PHONE: Phone,
  EMAIL: Mail,
  MRN: Key,
  SSN: Key,
  GEOGRAPHIC: MapPin,
  ACCOUNT_NUMBER: Key,
  LICENSE: Key,
  VEHICLE_ID: Key,
  URL: Key,
  IP_ADDRESS: Key,
  BIOMETRIC: Key,
  PHOTO: Key,
  AGE_OVER_89: User,
  DEVICE_ID: Key,
  HEALTH_PLAN_ID: Key,
  CERT_NUMBER: Key,
  OTHER: FileText,
};


interface PhiGateProviderProps {
  children: ReactNode;
}

export function PhiGateProvider({ children }: PhiGateProviderProps) {
  const { toast } = useToast();
  const [phiStatus, setPhiStatus] = useState<PhiStatus>("UNCHECKED");
  const [scanResult, setScanResult] = useState<PhiScanResult | null>(null);
  const [auditLog, setAuditLog] = useState<PhiAuditLogEntry[]>([]);
  const [pendingGate, setPendingGate] = useState<{
    stageId: number;
    stageName: string;
    gate: typeof PHI_GATE_POSITIONS[0];
  } | null>(null);
  const [showGateModal, setShowGateModal] = useState(false);
  const [showOverrideModal, setShowOverrideModal] = useState(false);
  const [overrideJustification, setOverrideJustification] = useState("");
  const [gateResolve, setGateResolve] = useState<((result: { passed: boolean; status: PhiStatus }) => void) | null>(null);

  const addAuditEntry = useCallback((entry: PhiAuditLogEntry) => {
    setAuditLog(prev => [entry, ...prev]);
  }, []);

  const scanMutation = useMutation({
    mutationFn: async (params: { content: string; context?: string }) => {
      const response = await apiRequest("POST", "/api/ros/phi/scan", {
        content: params.content,
        context: params.context || "upload",
      });
      const data = await response.json();
      return data.scan as ServerPHIScanResult;
    },
    onError: (error: Error) => {
      toast({
        title: "PHI Scan Failed",
        description: error.message || "Failed to scan content for PHI",
        variant: "destructive",
      });
      setPhiStatus("UNCHECKED");
    },
  });

  const overrideMutation = useMutation({
    mutationFn: async (params: { scanId: string; justification: string; approverRole?: string }) => {
      const response = await apiRequest("POST", "/api/ros/phi/override", {
        scanId: params.scanId,
        justification: params.justification,
        approverRole: params.approverRole || "STEWARD",
      });
      const data = await response.json();
      return data.override as ServerPHIOverrideResult;
    },
    onError: (error: Error) => {
      toast({
        title: "Override Request Failed",
        description: error.message || "Failed to submit override request",
        variant: "destructive",
      });
    },
  });

  const isScanning = scanMutation.isPending;

  const runPhiScan = useCallback(async (scope: string): Promise<PhiScanResult> => {
    setPhiStatus("SCANNING");
    
    addAuditEntry(createPhiAuditEntry("PHI_SCAN_STARTED", "SCANNING", {
      metadata: { scope },
    }));

    try {
      const sampleContent = `
        Patient: John Smith (MRN#847291)
        DOB: 01/15/1985
        Phone: 555-123-4567
        Email: jsmith@hospital.org
        Address ZIP: 90210
        Last visit: 03/22/2024
        Provider: Dr. Mary Johnson
      `;
      
      const contentToScan = scope === "full" ? sampleContent : sampleContent.slice(0, 100);
      
      const serverResult = await scanMutation.mutateAsync({
        content: contentToScan,
        context: "upload",
      });

      const result = mapServerScanToClientResult(serverResult);
      
      setScanResult(result);
      setPhiStatus(result.status);

      addAuditEntry(createPhiAuditEntry("PHI_SCAN_COMPLETED", result.status, {
        findings: result.findings.length > 0 ? result.findings : undefined,
        metadata: { scope, findingsCount: result.findings.length },
      }));

      if (result.findings.length > 0) {
        addAuditEntry(createPhiAuditEntry("PHI_DETECTED", "FAIL", {
          findings: result.findings,
          metadata: { count: result.findings.length },
        }));
        
        toast({
          title: "PHI Detected",
          description: `Found ${result.findings.length} potential PHI pattern(s)`,
          variant: "destructive",
        });
      } else {
        toast({
          title: "Scan Complete",
          description: "No PHI detected in the scanned content",
        });
      }

      return result;
    } catch (error) {
      const fallbackResult: PhiScanResult = {
        id: `scan-${Date.now()}`,
        timestamp: new Date().toISOString(),
        status: "UNCHECKED",
        findings: [],
        scanScope: scope,
        durationMs: 0,
      };
      setPhiStatus("UNCHECKED");
      return fallbackResult;
    }
  }, [addAuditEntry, scanMutation, toast]);

  const requestGateCheck = useCallback(async (stageId: number, stageName: string): Promise<{ passed: boolean; status: PhiStatus }> => {
    const gate = getPhiGateForStage(stageId);
    
    if (!gate) {
      return { passed: true, status: phiStatus };
    }

    if (canProceedWithPhiStatus(phiStatus)) {
      addAuditEntry(createPhiAuditEntry("PHI_GATE_PASSED", phiStatus, {
        stageId,
        stageName,
        gatePosition: gate.id,
      }));
      return { passed: true, status: phiStatus };
    }

    return new Promise((resolve) => {
      setPendingGate({ stageId, stageName, gate });
      setGateResolve(() => resolve);
      setShowGateModal(true);
    });
  }, [phiStatus, addAuditEntry]);

  const requestOverride = useCallback(async (justification: string): Promise<boolean> => {
    if (!isValidOverrideJustification(justification)) {
      toast({
        title: "Invalid Justification",
        description: "Justification must be at least 20 characters",
        variant: "destructive",
      });
      return false;
    }

    if (!scanResult?.id) {
      toast({
        title: "No Scan Found",
        description: "Please run a PHI scan first before requesting an override",
        variant: "destructive",
      });
      return false;
    }

    try {
      const serverResult = await overrideMutation.mutateAsync({
        scanId: scanResult.id,
        justification,
        approverRole: "STEWARD",
      });

      if (serverResult.approved) {
        addAuditEntry(createPhiAuditEntry("PHI_OVERRIDE_APPROVED", "OVERRIDDEN", {
          overrideJustification: justification,
          findings: scanResult?.findings,
          user: serverResult.reviewedBy,
          metadata: {
            auditId: serverResult.auditId,
            expiresAt: serverResult.expiresAt,
            conditions: serverResult.conditions,
          },
        }));

        setPhiStatus("OVERRIDDEN");
        
        toast({
          title: "Override Approved",
          description: serverResult.expiresAt 
            ? `Override valid until ${new Date(serverResult.expiresAt).toLocaleString()}`
            : "Override has been approved",
        });
        
        return true;
      } else {
        toast({
          title: "Override Denied",
          description: "Your override request was not approved",
          variant: "destructive",
        });
        return false;
      }
    } catch (error) {
      return false;
    }
  }, [phiStatus, scanResult, addAuditEntry, overrideMutation, toast]);

  const quarantineFindings = useCallback(() => {
    setPhiStatus("QUARANTINED");
    addAuditEntry(createPhiAuditEntry("PHI_QUARANTINED", "QUARANTINED", {
      findings: scanResult?.findings,
    }));
  }, [scanResult, addAuditEntry]);

  const remediateFindings = useCallback(() => {
    setPhiStatus("PASS");
    setScanResult(prev => prev ? { ...prev, findings: [], status: "PASS" } : null);
    addAuditEntry(createPhiAuditEntry("PHI_REMEDIATED", "PASS", {}));
  }, [addAuditEntry]);

  const resetPhiState = useCallback(() => {
    addAuditEntry(createPhiAuditEntry("PHI_REMEDIATED", "PASS", {
      metadata: { reason: "User initiated reset" },
    }));
    setPhiStatus("UNCHECKED");
    setScanResult(null);
    setPendingGate(null);
    setShowGateModal(false);
    setShowOverrideModal(false);
  }, [addAuditEntry]);

  const getPhiStats = useCallback(() => {
    const scans = auditLog.filter(e => e.action === "PHI_SCAN_COMPLETED").length;
    const blocked = auditLog.filter(e => e.action === "PHI_GATE_BLOCKED").length;
    const overrides = auditLog.filter(e => e.action === "PHI_OVERRIDE_APPROVED").length;
    return { scans, blocked, overrides };
  }, [auditLog]);

  const handleGateAction = async (action: "scan" | "override" | "cancel") => {
    if (action === "cancel") {
      addAuditEntry(createPhiAuditEntry("PHI_GATE_BLOCKED", phiStatus, {
        stageId: pendingGate?.stageId,
        stageName: pendingGate?.stageName,
        gatePosition: pendingGate?.gate.id,
      }));
      gateResolve?.({ passed: false, status: phiStatus });
      setShowGateModal(false);
      setPendingGate(null);
      setGateResolve(null);
      return;
    }

    if (action === "scan") {
      const result = await runPhiScan(pendingGate?.gate.scanScope.join(", ") || "all");
      if (canProceedWithPhiStatus(result.status)) {
        addAuditEntry(createPhiAuditEntry("PHI_GATE_PASSED", result.status, {
          stageId: pendingGate?.stageId,
          stageName: pendingGate?.stageName,
          gatePosition: pendingGate?.gate.id,
        }));
        gateResolve?.({ passed: true, status: result.status });
        setShowGateModal(false);
        setPendingGate(null);
        setGateResolve(null);
      }
    }

    if (action === "override") {
      setShowOverrideModal(true);
    }
  };

  const handleOverrideSubmit = async () => {
    const success = await requestOverride(overrideJustification);
    if (success) {
      gateResolve?.({ passed: true, status: "OVERRIDDEN" });
      setShowGateModal(false);
      setShowOverrideModal(false);
      setPendingGate(null);
      setGateResolve(null);
      setOverrideJustification("");
    }
  };

  return (
    <PhiGateContext.Provider
      value={{
        phiStatus,
        scanResult,
        auditLog,
        isScanning,
        pendingGate,
        requestGateCheck,
        runPhiScan,
        requestOverride,
        quarantineFindings,
        remediateFindings,
        resetPhiState,
        getPhiStats,
      }}
    >
      {children}

      <Dialog open={showGateModal} onOpenChange={(open) => !open && handleGateAction("cancel")}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-ros-alert" />
              PHI Gate Check Required
            </DialogTitle>
            <DialogDescription>
              {pendingGate?.gate.description}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="flex items-center justify-between p-3 rounded-lg bg-muted">
              <div>
                <p className="font-medium">Current PHI Status</p>
                <p className="text-sm text-muted-foreground">
                  {PHI_STATUS_METADATA[phiStatus].description}
                </p>
              </div>
              <PhiStatusBadge status={phiStatus} />
            </div>

            {scanResult && scanResult.findings.length > 0 && (
              <div className="space-y-2">
                <Label>PHI Findings ({scanResult.findings.length})</Label>
                <ScrollArea className="h-48 rounded-lg border p-3">
                  <div className="space-y-2">
                    {scanResult.findings.map((finding) => {
                      const Icon = PHI_FINDING_ICONS[finding.type] || FileText;
                      return (
                        <div
                          key={finding.id}
                          className="flex items-start gap-3 p-2 rounded-md bg-ros-alert/5 border border-ros-alert/20"
                        >
                          <Icon className="w-4 h-4 text-ros-alert mt-0.5" />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-sm">{finding.type}</span>
                              <Badge variant="outline" className="text-xs">
                                {Math.round(finding.confidence * 100)}% confidence
                              </Badge>
                            </div>
                            <p className="text-sm text-muted-foreground truncate">
                              {finding.location}
                            </p>
                            {finding.context && (
                              <p className="text-xs text-muted-foreground mt-1 italic">
                                "{finding.context}"
                              </p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </ScrollArea>
              </div>
            )}

            <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
              <AlertTriangle className="w-4 h-4 text-amber-500" />
              <p className="text-sm">
                Stage <strong>{pendingGate?.stageName}</strong> requires PHI verification before proceeding.
              </p>
            </div>
          </div>

          <DialogFooter className="flex-col gap-2 sm:flex-row">
            <Button
              variant="outline"
              onClick={() => handleGateAction("cancel")}
              disabled={isScanning}
            >
              Cancel
            </Button>
            {phiStatus === "FAIL" && (
              <Button
                variant="outline"
                onClick={() => handleGateAction("override")}
                disabled={isScanning}
                className="text-amber-600"
              >
                <ShieldOff className="w-4 h-4 mr-2" />
                Request Override
              </Button>
            )}
            <Button
              onClick={() => handleGateAction("scan")}
              disabled={isScanning}
            >
              {isScanning ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Scanning...
                </>
              ) : (
                <>
                  <ShieldCheck className="w-4 h-4 mr-2" />
                  Run PHI Scan
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showOverrideModal} onOpenChange={setShowOverrideModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldOff className="w-5 h-5 text-amber-600" />
              PHI Override Request
            </DialogTitle>
            <DialogDescription>
              You are requesting to bypass PHI protection. This action will be logged for audit purposes.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
              <p className="text-sm font-medium text-amber-600">Warning</p>
              <p className="text-sm text-muted-foreground">
                Overriding PHI protection may result in compliance violations. Ensure you have proper authorization.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="justification">
                Justification (minimum 20 characters)
              </Label>
              <Textarea
                id="justification"
                placeholder="Enter your justification for bypassing PHI protection..."
                value={overrideJustification}
                onChange={(e) => setOverrideJustification(e.target.value)}
                className="min-h-[100px]"
              />
              <p className="text-xs text-muted-foreground">
                {overrideJustification.length}/20 characters minimum
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowOverrideModal(false);
                setOverrideJustification("");
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleOverrideSubmit}
              disabled={!isValidOverrideJustification(overrideJustification)}
              className="bg-amber-600 hover:bg-amber-700"
            >
              Submit Override Request
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PhiGateContext.Provider>
  );
}

interface PhiStatusBadgeProps {
  status: PhiStatus;
  showLabel?: boolean;
  size?: "sm" | "default";
}

export function PhiStatusBadge({ status, showLabel = true, size = "default" }: PhiStatusBadgeProps) {
  const meta = PHI_STATUS_METADATA[status];
  
  const iconMap: Record<PhiStatus, React.ComponentType<{ className?: string }>> = {
    UNCHECKED: HelpCircle,
    SCANNING: Loader2,
    PASS: ShieldCheck,
    FAIL: ShieldAlert,
    QUARANTINED: AlertTriangle,
    OVERRIDDEN: ShieldOff,
  };
  
  const Icon = iconMap[status];
  const iconClass = size === "sm" ? "w-3 h-3" : "w-4 h-4";
  
  return (
    <Badge
      variant="outline"
      className={`${meta.bgColor} ${meta.color} border-current/20 ${size === "sm" ? "text-xs px-1.5 py-0" : ""}`}
      data-testid={`badge-phi-status-${status.toLowerCase()}`}
    >
      <Icon className={`${iconClass} ${status === "SCANNING" ? "animate-spin" : ""} ${showLabel ? "mr-1" : ""}`} />
      {showLabel && meta.label}
    </Badge>
  );
}

interface PhiGateIndicatorProps {
  stageId: number;
}

export function PhiGateIndicator({ stageId }: PhiGateIndicatorProps) {
  const gate = getPhiGateForStage(stageId);
  
  if (!gate) return null;
  
  return (
    <Badge
      variant="outline"
      className="bg-ros-alert/10 text-ros-alert border-ros-alert/20 text-xs"
      data-testid={`badge-phi-gate-${stageId}`}
    >
      <ShieldAlert className="w-3 h-3 mr-1" />
      PHI Gate
    </Badge>
  );
}
