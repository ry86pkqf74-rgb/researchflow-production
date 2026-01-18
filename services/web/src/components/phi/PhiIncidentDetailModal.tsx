import { format } from "date-fns";
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
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  ShieldAlert,
  AlertTriangle,
  Clock,
  User,
  FileText,
  MapPin,
  Hash,
  ChevronRight,
  Copy
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export interface PhiIncidentFinding {
  id: string;
  type: string;
  severity: "HIGH" | "MEDIUM" | "LOW";
  category: string;
  location: string;
  lineNumber?: number;
  context?: string;
  description: string;
  suggestion?: string;
  confidence: number;
}

export interface PhiIncident {
  id: string;
  scanId: string;
  stageId: number;
  artifactId?: string;
  status: "OPEN" | "RESOLVED" | "OVERRIDDEN" | "FALSE_POSITIVE";
  detectedAt: string;
  resolvedAt?: string;
  resolvedBy?: string;
  resolutionNote?: string;
  findings: PhiIncidentFinding[];
  summary: string;
}

interface PhiIncidentDetailModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  incident: PhiIncident | null;
  onResolve?: () => void;
  onOverride?: () => void;
}

const severityColors: Record<string, string> = {
  HIGH: "border-red-500/50 text-red-600 dark:text-red-400 bg-red-500/10",
  MEDIUM: "border-amber-500/50 text-amber-600 dark:text-amber-400 bg-amber-500/10",
  LOW: "border-yellow-500/50 text-yellow-600 dark:text-yellow-400 bg-yellow-500/10"
};

const statusColors: Record<string, string> = {
  OPEN: "border-red-500/50 text-red-600 dark:text-red-400 bg-red-500/10",
  RESOLVED: "border-green-500/50 text-green-600 dark:text-green-400 bg-green-500/10",
  OVERRIDDEN: "border-amber-500/50 text-amber-600 dark:text-amber-400 bg-amber-500/10",
  FALSE_POSITIVE: "border-muted-foreground/50 text-muted-foreground bg-muted/50"
};

const categoryIcons: Record<string, string> = {
  "SSN": "Social Security Number",
  "MRN": "Medical Record Number",
  "DOB": "Date of Birth",
  "NAME": "Patient Name",
  "ADDRESS": "Address",
  "PHONE": "Phone Number",
  "EMAIL": "Email Address",
  "DIAGNOSIS": "Diagnosis Information",
  "MEDICATION": "Medication Information"
};

export function PhiIncidentDetailModal({
  isOpen,
  onOpenChange,
  incident,
  onResolve,
  onOverride
}: PhiIncidentDetailModalProps) {
  const { toast } = useToast();

  if (!incident) return null;

  const formattedDetectedAt = format(
    new Date(incident.detectedAt),
    "MMM d, yyyy 'at' h:mm:ss a"
  );
  const formattedResolvedAt = incident.resolvedAt
    ? format(new Date(incident.resolvedAt), "MMM d, yyyy 'at' h:mm a")
    : null;

  const highCount = incident.findings.filter(f => f.severity === "HIGH").length;
  const mediumCount = incident.findings.filter(f => f.severity === "MEDIUM").length;
  const lowCount = incident.findings.filter(f => f.severity === "LOW").length;

  const handleCopyId = () => {
    navigator.clipboard.writeText(incident.id);
    toast({
      title: "Copied",
      description: "Incident ID copied to clipboard",
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh]" data-testid="phi-incident-detail-modal">
        <DialogHeader>
          <div className="flex flex-wrap items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-red-500/10 flex items-center justify-center">
              <ShieldAlert className="w-5 h-5 text-red-500" />
            </div>
            <div className="flex-1">
              <DialogTitle className="flex items-center gap-2 flex-wrap">
                <span>PHI Incident Details</span>
                <Badge
                  variant="outline"
                  className={statusColors[incident.status]}
                  data-testid="badge-incident-status"
                >
                  {incident.status}
                </Badge>
              </DialogTitle>
              <DialogDescription>
                Comprehensive view of the PHI detection incident
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <ScrollArea className="max-h-[60vh] pr-4">
          <div className="space-y-6 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="p-3 rounded-lg bg-muted/50 border" data-testid="card-incident-id">
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground mb-1">
                  <Hash className="w-3 h-3" />
                  <span>Incident ID</span>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <code className="text-sm font-mono">{incident.id.slice(0, 12)}...</code>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={handleCopyId}
                    aria-label="Copy incident ID to clipboard"
                    data-testid="button-copy-incident-id"
                  >
                    <Copy className="w-3 h-3" />
                    <span className="sr-only">Copy incident ID</span>
                  </Button>
                </div>
              </div>

              <div className="p-3 rounded-lg bg-muted/50 border" data-testid="card-incident-detected">
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground mb-1">
                  <Clock className="w-3 h-3" />
                  <span>Detected</span>
                </div>
                <p className="text-sm" data-testid="text-incident-detected-time">{formattedDetectedAt}</p>
              </div>

              <div className="p-3 rounded-lg bg-muted/50 border" data-testid="card-incident-stage">
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground mb-1">
                  <FileText className="w-3 h-3" />
                  <span>Stage / Artifact</span>
                </div>
                <p className="text-sm" data-testid="text-incident-stage-info">
                  Stage {incident.stageId}
                  {incident.artifactId && ` / ${incident.artifactId.slice(0, 8)}...`}
                </p>
              </div>

              <div className="p-3 rounded-lg bg-muted/50 border" data-testid="card-incident-findings-summary">
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground mb-1">
                  <AlertTriangle className="w-3 h-3" />
                  <span>Findings Summary</span>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {highCount > 0 && (
                    <Badge variant="outline" className={severityColors.HIGH} data-testid="badge-incident-severity-high">
                      {highCount} High
                    </Badge>
                  )}
                  {mediumCount > 0 && (
                    <Badge variant="outline" className={severityColors.MEDIUM} data-testid="badge-incident-severity-medium">
                      {mediumCount} Med
                    </Badge>
                  )}
                  {lowCount > 0 && (
                    <Badge variant="outline" className={severityColors.LOW} data-testid="badge-incident-severity-low">
                      {lowCount} Low
                    </Badge>
                  )}
                </div>
              </div>
            </div>

            {incident.summary && (
              <div className="p-3 rounded-lg bg-muted/50 border">
                <p className="text-sm text-muted-foreground">{incident.summary}</p>
              </div>
            )}

            <Separator />

            <div className="space-y-3">
              <h4 className="font-medium text-sm flex flex-wrap items-center gap-2">
                <AlertTriangle className="w-4 h-4" />
                Detailed Findings ({incident.findings.length})
              </h4>

              <div className="space-y-3">
                {incident.findings.map((finding, idx) => (
                  <div
                    key={finding.id || idx}
                    className="p-4 rounded-lg border bg-card space-y-3"
                    data-testid={`finding-detail-${idx}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge
                          variant="outline"
                          className={severityColors[finding.severity]}
                        >
                          {finding.severity}
                        </Badge>
                        <span className="font-medium text-sm">
                          {categoryIcons[finding.category] || finding.type}
                        </span>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {Math.round(finding.confidence * 100)}% confidence
                      </div>
                    </div>

                    <p className="text-sm text-muted-foreground">
                      {finding.description}
                    </p>

                    <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
                      <span className="flex flex-wrap items-center gap-1">
                        <MapPin className="w-3 h-3" />
                        {finding.location}
                        {finding.lineNumber && `:${finding.lineNumber}`}
                      </span>
                    </div>

                    {finding.context && (
                      <div className="p-2 rounded bg-muted/50 border">
                        <code className="text-xs font-mono text-muted-foreground">
                          {finding.context}
                        </code>
                      </div>
                    )}

                    {finding.suggestion && (
                      <div className="flex flex-wrap items-start gap-2 p-2 rounded bg-blue-500/5 border border-blue-500/20">
                        <ChevronRight className="w-3 h-3 mt-0.5 text-blue-500" />
                        <p className="text-xs text-blue-600 dark:text-blue-400">
                          {finding.suggestion}
                        </p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {(incident.status === "RESOLVED" || incident.status === "OVERRIDDEN") && (
              <>
                <Separator />
                <div className="space-y-3">
                  <h4 className="font-medium text-sm flex flex-wrap items-center gap-2">
                    <User className="w-4 h-4" />
                    Resolution Details
                  </h4>
                  <div className="p-3 rounded-lg bg-green-500/5 border border-green-500/20 space-y-2">
                    {formattedResolvedAt && (
                      <p className="text-sm">
                        <span className="text-muted-foreground">Resolved: </span>
                        {formattedResolvedAt}
                      </p>
                    )}
                    {incident.resolvedBy && (
                      <p className="text-sm">
                        <span className="text-muted-foreground">By: </span>
                        {incident.resolvedBy}
                      </p>
                    )}
                    {incident.resolutionNote && (
                      <p className="text-sm text-muted-foreground mt-2">
                        {incident.resolutionNote}
                      </p>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        </ScrollArea>

        <DialogFooter className="gap-2 sm:gap-0">
          {incident.status === "OPEN" && (
            <>
              {onOverride && (
                <Button
                  variant="outline"
                  onClick={onOverride}
                  className="border-amber-500/50 text-amber-600"
                  data-testid="button-incident-override"
                >
                  <AlertTriangle className="w-4 h-4 mr-2" />
                  Override
                </Button>
              )}
              {onResolve && (
                <Button
                  onClick={onResolve}
                  className="border bg-green-600 border-green-600 text-white"
                  data-testid="button-incident-resolve"
                >
                  Mark Resolved
                </Button>
              )}
            </>
          )}
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            data-testid="button-incident-close"
          >
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
