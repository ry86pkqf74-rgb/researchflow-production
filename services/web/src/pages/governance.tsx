import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { FatiguePolicyBanner } from "@/components/ui/fatigue-policy-banner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Shield,
  AlertTriangle,
  CheckCircle2,
  Clock,
  FileText,
  AlertCircle,
  ArrowLeft,
  Download,
  RefreshCw,
  Activity,
  Flag,
  Settings,
  Check,
  X
} from "lucide-react";
import { Link } from "wouter";
import { useGovernanceMode } from "@/hooks/useGovernanceMode";
import { ApprovalQueue } from "@/components/governance/ApprovalQueue";

interface IncidentStep {
  id: string;
  step: string;
  actions: string[];
  required: boolean;
}

interface PhiIncident {
  id: string;
  timestamp: string;
  session_id: string;
  research_id: string | null;
  findings_count: number;
  severity: string;
  status: string;
}

interface SystemStatus {
  mode: string;
  mock_only: boolean;
  no_network: boolean;
  allow_uploads: boolean;
  status: string;
  backend_connected: boolean;
}

interface AuditEntry {
  id: string;
  timestamp: string;
  action: string;
  user: string;
  resource: string;
  status: string;
}

const MODE_COLORS: Record<string, string> = {
  LIVE: "bg-green-500",
  DEMO: "bg-blue-500", 
  STANDBY: "bg-amber-500",
};

const MODE_DESCRIPTIONS: Record<string, string> = {
  LIVE: "Full functionality enabled - production mode",
  DEMO: "Demo mode with synthetic data only",
  STANDBY: "Reduced functionality - maintenance mode",
};

const OPERATIONS_BY_MODE: Record<string, { operation: string; allowed: boolean; notes: string }[]> = {
  LIVE: [
    { operation: "AI Analysis", allowed: true, notes: "Full AI capabilities enabled" },
    { operation: "Data Export", allowed: true, notes: "Requires steward approval" },
    { operation: "Dataset Upload", allowed: true, notes: "Admin only, PHI scan required" },
    { operation: "Manuscript Drafting", allowed: true, notes: "Human review required" },
    { operation: "IRB Submission", allowed: true, notes: "Approval workflow active" },
  ],
  DEMO: [
    { operation: "AI Analysis", allowed: true, notes: "Limited to demo datasets" },
    { operation: "Data Export", allowed: false, notes: "Disabled in demo mode" },
    { operation: "Dataset Upload", allowed: false, notes: "Disabled in demo mode" },
    { operation: "Manuscript Drafting", allowed: true, notes: "Draft only, no export" },
    { operation: "IRB Submission", allowed: false, notes: "Disabled in demo mode" },
  ],
  STANDBY: [
    { operation: "AI Analysis", allowed: false, notes: "System in maintenance" },
    { operation: "Data Export", allowed: false, notes: "System in maintenance" },
    { operation: "Dataset Upload", allowed: false, notes: "System in maintenance" },
    { operation: "Manuscript Drafting", allowed: false, notes: "System in maintenance" },
    { operation: "IRB Submission", allowed: false, notes: "System in maintenance" },
  ],
};

export default function GovernancePage() {
  const [completedSteps, setCompletedSteps] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState("status");

  const { data: systemStatus } = useQuery<SystemStatus>({
    queryKey: ["/api/ros/status"],
  });

  const { data: checklist } = useQuery<IncidentStep[]>({
    queryKey: ["/api/governance/phi-checklist"],
  });

  const { data: incidents, refetch: refetchIncidents } = useQuery<PhiIncident[]>({
    queryKey: ["/api/governance/phi-incidents"],
  });

  const { data: auditLog } = useQuery<AuditEntry[]>({
    queryKey: ["/api/governance/audit-log"],
  });

  const toggleStep = (stepId: string) => {
    const newCompleted = new Set(completedSteps);
    if (newCompleted.has(stepId)) {
      newCompleted.delete(stepId);
    } else {
      newCompleted.add(stepId);
    }
    setCompletedSteps(newCompleted);
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "critical": return "bg-red-500";
      case "high": return "bg-orange-500";
      case "medium": return "bg-yellow-500";
      default: return "bg-green-500";
    }
  };

  const handleExportAudit = () => {
    const data = JSON.stringify(auditLog || [], null, 2);
    const blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `audit-log-${new Date().toISOString().split("T")[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const requiredSteps = checklist?.filter(s => s.required) || [];
  const completedRequired = requiredSteps.filter(s => completedSteps.has(s.id)).length;
  const progress = requiredSteps.length > 0 ? (completedRequired / requiredSteps.length) * 100 : 0;

  // Use the authoritative governance mode from database (via useGovernanceMode hook)
  // This ensures consistency with the ModeBanner and other mode-aware components
  const { mode: governanceMode } = useGovernanceMode();
  const currentMode = governanceMode || "DEMO";
  const operations = OPERATIONS_BY_MODE[currentMode] || OPERATIONS_BY_MODE.DEMO;

  const activeFlags = [
    { name: "mock_only", label: "Mock Only Mode", active: systemStatus?.mock_only ?? false },
    { name: "no_network", label: "No Network Mode", active: systemStatus?.no_network ?? false },
    { name: "allow_uploads", label: "Allow Uploads", active: systemStatus?.allow_uploads ?? true },
    { name: "backend_connected", label: "Backend Connected", active: systemStatus?.backend_connected ?? false },
  ];

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-6 py-8 max-w-5xl">
        <div className="flex items-center gap-4 mb-8">
          <Link href="/">
            <Button variant="ghost" size="icon" data-testid="button-back-home">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Shield className="h-6 w-6 text-blue-500" />
              Governance & Compliance
            </h1>
            <p className="text-muted-foreground">
              System status, AI governance, and compliance documentation
            </p>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-6 flex-wrap gap-1 sm:gap-2">
            <TabsTrigger value="approvals" data-testid="tab-approvals">
              <Clock className="h-4 w-4 mr-2" />
              Approval Queue
            </TabsTrigger>
            <TabsTrigger value="status" data-testid="tab-status">
              <Activity className="h-4 w-4 mr-2" />
              System Status
            </TabsTrigger>
            <TabsTrigger value="policy" data-testid="tab-policy">
              <FileText className="h-4 w-4 mr-2" />
              AI Policy
            </TabsTrigger>
            <TabsTrigger value="phi-incident" data-testid="tab-phi-incident">
              <AlertTriangle className="h-4 w-4 mr-2" />
              PHI Response
            </TabsTrigger>
            <TabsTrigger value="audit" data-testid="tab-audit">
              <Clock className="h-4 w-4 mr-2" />
              Audit Log
            </TabsTrigger>
          </TabsList>

          <TabsContent value="approvals" className="space-y-6">
            <ApprovalQueue />
          </TabsContent>

          <TabsContent value="status" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card data-testid="card-system-mode">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Settings className="h-5 w-5" />
                    Current Mode
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-4">
                    <div className={`w-4 h-4 rounded-full ${MODE_COLORS[currentMode] || "bg-gray-500"} animate-pulse`} />
                    <div>
                      <div className="text-2xl font-bold" data-testid="text-current-mode">{currentMode}</div>
                      <p className="text-sm text-muted-foreground">
                        {MODE_DESCRIPTIONS[currentMode] || "Unknown mode"}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card data-testid="card-active-flags">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Flag className="h-5 w-5" />
                    Active Flags
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {activeFlags.map((flag) => (
                      <div key={flag.name} className="flex items-center justify-between" data-testid={`flag-${flag.name}`}>
                        <span className="text-sm">{flag.label}</span>
                        <Badge variant={flag.active ? "default" : "secondary"}>
                          {flag.active ? "Active" : "Inactive"}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card data-testid="card-operations-table">
              <CardHeader>
                <CardTitle>Allowed Operations</CardTitle>
                <CardDescription>
                  Operations available in {currentMode} mode
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Operation</TableHead>
                      <TableHead className="text-center">Status</TableHead>
                      <TableHead>Notes</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {operations.map((op) => (
                      <TableRow key={op.operation} data-testid={`operation-${op.operation.toLowerCase().replace(/\s+/g, "-")}`}>
                        <TableCell className="font-medium">{op.operation}</TableCell>
                        <TableCell className="text-center">
                          {op.allowed ? (
                            <Check className="h-5 w-5 text-green-500 inline" />
                          ) : (
                            <X className="h-5 w-5 text-red-500 inline" />
                          )}
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">{op.notes}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="policy" className="space-y-6">
            <FatiguePolicyBanner showLearnMore={false} />

            <Card data-testid="card-ai-policy">
              <CardHeader>
                <CardTitle>AI-Generated Content Policy</CardTitle>
                <CardDescription>
                  Guidelines for reviewing and validating AI-assisted research outputs
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <h4 className="font-semibold mb-2">Hallucination Detection</h4>
                  <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
                    <li>Verify all statistical claims against source data</li>
                    <li>Cross-reference citations with actual publications</li>
                    <li>Validate numerical results with independent calculations</li>
                    <li>Check for logical consistency in generated narratives</li>
                  </ul>
                </div>

                <div>
                  <h4 className="font-semibold mb-2">Session Fatigue Mitigation</h4>
                  <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
                    <li>Take breaks every 2 hours during AI-assisted work</li>
                    <li>Review critical outputs with fresh perspective</li>
                    <li>Have a colleague validate key findings</li>
                    <li>Save work frequently and review in new sessions</li>
                  </ul>
                </div>

                <div>
                  <h4 className="font-semibold mb-2">Bias Awareness</h4>
                  <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
                    <li>Check demographic representation in datasets</li>
                    <li>Review AI suggestions for potential selection bias</li>
                    <li>Validate that minority groups are adequately represented</li>
                    <li>Consider alternative interpretations of findings</li>
                  </ul>
                </div>

                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Human Review Required</AlertTitle>
                  <AlertDescription>
                    All AI-generated content must be reviewed by a qualified human 
                    researcher before publication or submission. AI outputs are 
                    suggestions only and do not constitute validated research findings.
                  </AlertDescription>
                </Alert>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="phi-incident" className="space-y-6">
            <Card data-testid="card-phi-response">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <AlertTriangle className="h-5 w-5 text-amber-500" />
                      PHI Incident Response Checklist
                    </CardTitle>
                    <CardDescription>
                      Follow these steps when PHI is detected in research data
                    </CardDescription>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold">{Math.round(progress)}%</div>
                    <div className="text-xs text-muted-foreground">
                      {completedRequired}/{requiredSteps.length} required steps
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[500px] pr-4">
                  <div className="space-y-6">
                    {checklist?.map((step) => (
                      <div
                        key={step.id}
                        className={`p-4 rounded-lg border ${
                          completedSteps.has(step.id)
                            ? "bg-green-500/10 border-green-500/30"
                            : "bg-card"
                        }`}
                        data-testid={`step-${step.id}`}
                      >
                        <div className="flex items-start gap-3">
                          <Checkbox
                            checked={completedSteps.has(step.id)}
                            onCheckedChange={() => toggleStep(step.id)}
                            data-testid={`checkbox-step-${step.id}`}
                          />
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <span className="font-semibold">
                                Step {step.id}: {step.step}
                              </span>
                              {step.required && (
                                <Badge variant="outline" className="text-xs">
                                  Required
                                </Badge>
                              )}
                              {completedSteps.has(step.id) && (
                                <CheckCircle2 className="h-4 w-4 text-green-500" />
                              )}
                            </div>
                            <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
                              {step.actions.map((action, idx) => (
                                <li key={idx}>{action}</li>
                              ))}
                            </ul>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>

            <Card data-testid="card-incident-log">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>PHI Incident Log</CardTitle>
                    <CardDescription>
                      Recent PHI detection incidents and their status
                    </CardDescription>
                  </div>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => refetchIncidents()}
                    data-testid="button-refresh-incidents"
                  >
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Refresh
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {incidents && incidents.length > 0 ? (
                  <ScrollArea className="h-[300px]">
                    <div className="space-y-3">
                      {incidents.map((incident) => (
                        <div
                          key={incident.id}
                          className="flex items-center justify-between p-3 rounded-lg border bg-card"
                          data-testid={`incident-${incident.id}`}
                        >
                          <div className="flex items-center gap-3">
                            <div className={`w-2 h-2 rounded-full ${getSeverityColor(incident.severity)}`} />
                            <div>
                              <div className="font-medium text-sm">{incident.id}</div>
                              <div className="text-xs text-muted-foreground">
                                {new Date(incident.timestamp).toLocaleString()}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <Badge variant="outline">{incident.findings_count} findings</Badge>
                            <Badge className={getSeverityColor(incident.severity)}>
                              {incident.severity}
                            </Badge>
                            <Badge variant="secondary">{incident.status}</Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <Shield className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No PHI incidents recorded</p>
                    <p className="text-sm">All clear - no PHI detections to report</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="audit" className="space-y-6">
            <Card data-testid="card-audit-log">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Approval & Audit Log</CardTitle>
                    <CardDescription>
                      Complete history of approvals and system actions
                    </CardDescription>
                  </div>
                  <Button 
                    variant="outline"
                    onClick={handleExportAudit}
                    data-testid="button-export-audit"
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Export Audit Log
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {auditLog && auditLog.length > 0 ? (
                  <ScrollArea className="h-[500px]">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Timestamp</TableHead>
                          <TableHead>Action</TableHead>
                          <TableHead>User</TableHead>
                          <TableHead>Resource</TableHead>
                          <TableHead>Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {auditLog.map((entry) => (
                          <TableRow key={entry.id} data-testid={`audit-entry-${entry.id}`}>
                            <TableCell className="font-mono text-xs">
                              {new Date(entry.timestamp).toLocaleString()}
                            </TableCell>
                            <TableCell>{entry.action}</TableCell>
                            <TableCell>{entry.user}</TableCell>
                            <TableCell className="max-w-[200px] truncate">{entry.resource}</TableCell>
                            <TableCell>
                              <Badge variant={entry.status === "approved" ? "default" : "secondary"}>
                                {entry.status}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </ScrollArea>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <Clock className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No audit entries yet</p>
                    <p className="text-sm">Actions will appear here as they occur</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
