/**
 * Stage 20 - Conference Prep & Final Export
 * Task 60 - Implement Stage 20 UI
 * Final export with PHI scanning, approval, and multiple format support
 */

import * as React from 'react';
import { useState, useCallback, useMemo } from 'react';
import {
  Download,
  FileText,
  FileCode,
  FileArchive,
  Shield,
  CheckCircle,
  AlertTriangle,
  Lock,
  Unlock,
  Eye,
  RefreshCcw,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Clock,
  User,
  Calendar,
  Presentation,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from '@/components/ui/alert';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';

// Export format types
export type ExportFormat = 'pdf' | 'docx' | 'latex' | 'markdown' | 'html' | 'bibtex' | 'zip';

export interface ExportOption {
  format: ExportFormat;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  requiresApproval: boolean;
  available: boolean;
}

// PHI scan result
export interface PhiScanResult {
  status: 'pending' | 'scanning' | 'passed' | 'failed' | 'needs_review';
  findings: Array<{
    id: string;
    type: 'name' | 'date' | 'location' | 'id' | 'medical' | 'other';
    text: string;
    location: { file: string; line: number; column: number };
    confidence: number;
    redacted?: boolean;
  }>;
  scannedAt?: Date;
  scannedBy?: string;
}

// Approval status
export interface ApprovalStatus {
  required: boolean;
  approved: boolean;
  approvedBy?: string;
  approvedAt?: Date;
  comments?: string;
}

// Export bundle
export interface ExportBundle {
  id: string;
  name: string;
  formats: ExportFormat[];
  includeArtifacts: boolean;
  includeMetadata: boolean;
  includeCitations: boolean;
  phiScan: PhiScanResult;
  approval: ApprovalStatus;
  createdAt: Date;
  exportedAt?: Date;
  downloadUrl?: string;
}

interface Stage20Props {
  bundle: ExportBundle;
  onBundleChange: (bundle: ExportBundle) => void;
  governanceMode: 'DEMO' | 'LIVE';
  onScanPhi?: () => Promise<PhiScanResult>;
  onRequestApproval?: () => Promise<void>;
  onExport?: (formats: ExportFormat[]) => Promise<string>;
  isScanning?: boolean;
  isExporting?: boolean;
  className?: string;
}

const EXPORT_OPTIONS: ExportOption[] = [
  {
    format: 'pdf',
    label: 'PDF Document',
    description: 'Publication-ready PDF with formatting',
    icon: FileText,
    requiresApproval: true,
    available: true,
  },
  {
    format: 'docx',
    label: 'Word Document',
    description: 'Editable Microsoft Word format',
    icon: FileText,
    requiresApproval: true,
    available: true,
  },
  {
    format: 'latex',
    label: 'LaTeX Source',
    description: 'LaTeX source files for journal submission',
    icon: FileCode,
    requiresApproval: true,
    available: true,
  },
  {
    format: 'markdown',
    label: 'Markdown',
    description: 'Plain text with Markdown formatting',
    icon: FileText,
    requiresApproval: false,
    available: true,
  },
  {
    format: 'html',
    label: 'HTML',
    description: 'Web-ready HTML with styling',
    icon: FileCode,
    requiresApproval: false,
    available: true,
  },
  {
    format: 'bibtex',
    label: 'BibTeX Citations',
    description: 'Bibliography in BibTeX format',
    icon: FileText,
    requiresApproval: false,
    available: true,
  },
  {
    format: 'zip',
    label: 'Complete Bundle',
    description: 'All formats and artifacts in ZIP archive',
    icon: FileArchive,
    requiresApproval: true,
    available: true,
  },
];

export function Stage20FinalExport({
  bundle,
  onBundleChange,
  governanceMode,
  onScanPhi,
  onRequestApproval,
  onExport,
  isScanning = false,
  isExporting = false,
  className,
}: Stage20Props) {
  const [selectedFormats, setSelectedFormats] = useState<Set<ExportFormat>>(
    new Set(bundle.formats)
  );
  const [findingsExpanded, setFindingsExpanded] = useState(false);

  // Check if export is allowed
  const canExport = useMemo(() => {
    if (governanceMode === 'DEMO') return true;

    // In LIVE mode, PHI scan must pass and approval must be granted
    const phiPassed = bundle.phiScan.status === 'passed';
    const approvalGranted = !bundle.approval.required || bundle.approval.approved;

    return phiPassed && approvalGranted;
  }, [governanceMode, bundle]);

  // Check if approval is needed for selected formats
  const needsApproval = useMemo(() => {
    return Array.from(selectedFormats).some((format) => {
      const option = EXPORT_OPTIONS.find((o) => o.format === format);
      return option?.requiresApproval;
    });
  }, [selectedFormats]);

  // Toggle format selection
  const toggleFormat = useCallback((format: ExportFormat) => {
    setSelectedFormats((prev) => {
      const next = new Set(prev);
      if (next.has(format)) {
        next.delete(format);
      } else {
        next.add(format);
      }
      return next;
    });
  }, []);

  // Update bundle options
  const updateBundleOption = useCallback(
    (key: keyof ExportBundle, value: boolean) => {
      onBundleChange({ ...bundle, [key]: value });
    },
    [bundle, onBundleChange]
  );

  // Trigger PHI scan
  const handleScanPhi = useCallback(async () => {
    if (!onScanPhi) return;
    const result = await onScanPhi();
    onBundleChange({ ...bundle, phiScan: result });
  }, [onScanPhi, bundle, onBundleChange]);

  // Request approval
  const handleRequestApproval = useCallback(async () => {
    if (!onRequestApproval) return;
    await onRequestApproval();
  }, [onRequestApproval]);

  // Execute export
  const handleExport = useCallback(async () => {
    if (!onExport) return;
    const url = await onExport(Array.from(selectedFormats));
    onBundleChange({
      ...bundle,
      formats: Array.from(selectedFormats),
      exportedAt: new Date(),
      downloadUrl: url,
    });
  }, [onExport, selectedFormats, bundle, onBundleChange]);

  // PHI scan status display
  const PhiScanStatus = () => {
    const statusConfig = {
      pending: { label: 'Not Scanned', variant: 'secondary' as const, icon: Clock },
      scanning: { label: 'Scanning...', variant: 'secondary' as const, icon: RefreshCcw },
      passed: { label: 'PHI Scan Passed', variant: 'default' as const, icon: CheckCircle },
      failed: { label: 'PHI Detected', variant: 'destructive' as const, icon: AlertTriangle },
      needs_review: { label: 'Needs Review', variant: 'outline' as const, icon: Eye },
    };

    const config = statusConfig[bundle.phiScan.status];
    const Icon = config.icon;

    return (
      <Badge variant={config.variant} className="gap-1">
        <Icon className={cn('h-3 w-3', bundle.phiScan.status === 'scanning' && 'animate-spin')} />
        {config.label}
      </Badge>
    );
  };

  return (
    <div className={cn('space-y-6', className)}>
      {/* Governance Warning for LIVE mode */}
      {governanceMode === 'LIVE' && (
        <Alert>
          <Shield className="h-4 w-4" />
          <AlertTitle>LIVE Mode Export</AlertTitle>
          <AlertDescription>
            Exporting in LIVE mode requires PHI scanning and approval. All exports will be logged
            and watermarked for compliance tracking.
          </AlertDescription>
        </Alert>
      )}

      {/* PHI Scan Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                PHI Compliance Check
              </CardTitle>
              <CardDescription>
                Scan all content for Protected Health Information before export
              </CardDescription>
            </div>
            <PhiScanStatus />
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {bundle.phiScan.status === 'pending' && (
            <div className="text-center py-4">
              <Shield className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">
                Content has not been scanned for PHI yet.
              </p>
              <Button className="mt-4" onClick={handleScanPhi} disabled={isScanning}>
                {isScanning ? (
                  <>
                    <RefreshCcw className="mr-2 h-4 w-4 animate-spin" />
                    Scanning...
                  </>
                ) : (
                  <>
                    <Shield className="mr-2 h-4 w-4" />
                    Start PHI Scan
                  </>
                )}
              </Button>
            </div>
          )}

          {bundle.phiScan.status === 'scanning' && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span>Scanning content...</span>
                <span>Please wait</span>
              </div>
              <Progress value={45} className="h-2" />
            </div>
          )}

          {bundle.phiScan.status === 'passed' && (
            <div className="flex items-center gap-4 p-4 bg-green-50 dark:bg-green-950 rounded-lg">
              <CheckCircle className="h-8 w-8 text-green-600" />
              <div>
                <p className="font-medium text-green-700 dark:text-green-300">
                  No PHI Detected
                </p>
                <p className="text-sm text-green-600 dark:text-green-400">
                  Scanned on {bundle.phiScan.scannedAt?.toLocaleString()}
                </p>
              </div>
            </div>
          )}

          {(bundle.phiScan.status === 'failed' || bundle.phiScan.status === 'needs_review') && (
            <div className="space-y-4">
              <div className="flex items-center gap-4 p-4 bg-red-50 dark:bg-red-950 rounded-lg">
                <AlertTriangle className="h-8 w-8 text-red-600" />
                <div>
                  <p className="font-medium text-red-700 dark:text-red-300">
                    PHI Findings Detected
                  </p>
                  <p className="text-sm text-red-600 dark:text-red-400">
                    {bundle.phiScan.findings.length} potential PHI instances found
                  </p>
                </div>
              </div>

              <Collapsible open={findingsExpanded} onOpenChange={setFindingsExpanded}>
                <CollapsibleTrigger asChild>
                  <Button variant="outline" className="w-full justify-between">
                    <span>View Findings ({bundle.phiScan.findings.length})</span>
                    {findingsExpanded ? (
                      <ChevronUp className="h-4 w-4" />
                    ) : (
                      <ChevronDown className="h-4 w-4" />
                    )}
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="mt-2 space-y-2">
                  {bundle.phiScan.findings.map((finding) => (
                    <div
                      key={finding.id}
                      className="flex items-center justify-between p-3 border rounded-lg"
                    >
                      <div className="flex items-center gap-3">
                        <Badge variant="outline">{finding.type}</Badge>
                        <span className="text-sm font-mono bg-muted px-2 py-1 rounded">
                          {finding.text}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {finding.location.file}:{finding.location.line}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary">
                          {Math.round(finding.confidence * 100)}% confident
                        </Badge>
                        <Checkbox
                          checked={finding.redacted}
                          aria-label="Mark as redacted"
                        />
                      </div>
                    </div>
                  ))}
                </CollapsibleContent>
              </Collapsible>

              <Button variant="outline" onClick={handleScanPhi} disabled={isScanning}>
                <RefreshCcw className="mr-2 h-4 w-4" />
                Re-scan After Redaction
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Approval Card (LIVE mode only) */}
      {governanceMode === 'LIVE' && needsApproval && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  {bundle.approval.approved ? (
                    <Unlock className="h-5 w-5 text-green-600" />
                  ) : (
                    <Lock className="h-5 w-5" />
                  )}
                  Export Approval
                </CardTitle>
                <CardDescription>
                  Selected formats require approval before export
                </CardDescription>
              </div>
              <Badge variant={bundle.approval.approved ? 'default' : 'secondary'}>
                {bundle.approval.approved ? 'Approved' : 'Pending Approval'}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            {bundle.approval.approved ? (
              <div className="flex items-center gap-4 p-4 bg-green-50 dark:bg-green-950 rounded-lg">
                <CheckCircle className="h-8 w-8 text-green-600" />
                <div>
                  <p className="font-medium text-green-700 dark:text-green-300">
                    Export Approved
                  </p>
                  <p className="text-sm text-green-600 dark:text-green-400">
                    Approved by {bundle.approval.approvedBy} on{' '}
                    {bundle.approval.approvedAt?.toLocaleString()}
                  </p>
                  {bundle.approval.comments && (
                    <p className="text-sm mt-1 italic">"{bundle.approval.comments}"</p>
                  )}
                </div>
              </div>
            ) : (
              <div className="text-center py-4">
                <Lock className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground mb-4">
                  Export requires approval from a data steward or PI.
                </p>
                <Button onClick={handleRequestApproval}>
                  <Shield className="mr-2 h-4 w-4" />
                  Request Approval
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Export Formats */}
      <Card>
        <CardHeader>
          <CardTitle>Export Formats</CardTitle>
          <CardDescription>
            Select the formats to include in your export bundle
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            {EXPORT_OPTIONS.map((option) => {
              const Icon = option.icon;
              const isSelected = selectedFormats.has(option.format);
              const isDisabled = !option.available;

              return (
                <div
                  key={option.format}
                  className={cn(
                    'flex items-center gap-4 p-4 border rounded-lg cursor-pointer transition-colors',
                    isSelected && 'border-primary bg-primary/5',
                    isDisabled && 'opacity-50 cursor-not-allowed',
                    !isSelected && !isDisabled && 'hover:bg-muted/50'
                  )}
                  onClick={() => !isDisabled && toggleFormat(option.format)}
                >
                  <Checkbox
                    checked={isSelected}
                    disabled={isDisabled}
                    onChange={() => {}}
                  />
                  <Icon className="h-8 w-8 text-muted-foreground" />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-medium">{option.label}</p>
                      {option.requiresApproval && governanceMode === 'LIVE' && (
                        <Lock className="h-3 w-3 text-muted-foreground" />
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">{option.description}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Export Options */}
      <Card>
        <CardHeader>
          <CardTitle>Export Options</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label>Include Artifacts</Label>
              <p className="text-sm text-muted-foreground">
                Include all generated figures, tables, and data files
              </p>
            </div>
            <Checkbox
              checked={bundle.includeArtifacts}
              onCheckedChange={(checked) => updateBundleOption('includeArtifacts', !!checked)}
            />
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div>
              <Label>Include Metadata</Label>
              <p className="text-sm text-muted-foreground">
                Include workflow metadata and audit trail
              </p>
            </div>
            <Checkbox
              checked={bundle.includeMetadata}
              onCheckedChange={(checked) => updateBundleOption('includeMetadata', !!checked)}
            />
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div>
              <Label>Include Citations</Label>
              <p className="text-sm text-muted-foreground">
                Include BibTeX bibliography file
              </p>
            </div>
            <Checkbox
              checked={bundle.includeCitations}
              onCheckedChange={(checked) => updateBundleOption('includeCitations', !!checked)}
            />
          </div>
        </CardContent>
      </Card>

      {/* Export Action */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Ready to Export</p>
              <p className="text-sm text-muted-foreground">
                {selectedFormats.size} format(s) selected
              </p>
            </div>
            <div className="flex gap-2">
              {bundle.downloadUrl && (
                <Button variant="outline" asChild>
                  <a href={bundle.downloadUrl} download>
                    <Download className="mr-2 h-4 w-4" />
                    Download Previous Export
                  </a>
                </Button>
              )}
              <Button
                onClick={handleExport}
                disabled={!canExport || selectedFormats.size === 0 || isExporting}
              >
                {isExporting ? (
                  <>
                    <RefreshCcw className="mr-2 h-4 w-4 animate-spin" />
                    Exporting...
                  </>
                ) : (
                  <>
                    <Download className="mr-2 h-4 w-4" />
                    Export Bundle
                  </>
                )}
              </Button>
            </div>
          </div>

          {!canExport && governanceMode === 'LIVE' && (
            <Alert className="mt-4" variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Export Blocked</AlertTitle>
              <AlertDescription>
                {bundle.phiScan.status !== 'passed' && 'PHI scan must pass before export. '}
                {needsApproval && !bundle.approval.approved && 'Approval is required for selected formats.'}
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default Stage20FinalExport;
