/**
 * Stage 05 - Data Preprocessing
 * Task 45 - Implement Stage 05 UI
 * Clean, validate, and scan data for PHI
 */

import * as React from 'react';
import { useState, useCallback, useMemo } from 'react';
import {
  Shield,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Eye,
  EyeOff,
  RefreshCcw,
  Play,
  Pause,
  FileText,
  Database,
  Trash2,
  Settings,
  Filter,
  AlertCircle,
  Info,
  ChevronDown,
  ChevronRight,
  Download,
  Upload,
  Zap,
  BarChart2,
  Activity,
  Lock,
  Unlock,
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import { Switch } from '@/components/ui/switch';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from '@/components/ui/alert';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

// ==================== Types ====================

export type PhiDetectionStatus = 'not_scanned' | 'scanning' | 'clean' | 'detected' | 'redacted' | 'error';
export type DataQualityLevel = 'excellent' | 'good' | 'fair' | 'poor';
export type ValidationStatus = 'pending' | 'passed' | 'failed' | 'warning';
export type PreprocessingStepStatus = 'pending' | 'in_progress' | 'completed' | 'failed' | 'skipped';

export interface PhiDetection {
  id: string;
  type: 'name' | 'ssn' | 'dob' | 'address' | 'phone' | 'email' | 'mrn' | 'custom';
  field: string;
  row: number;
  originalValue: string;
  redactedValue?: string;
  confidence: number;
  isRedacted: boolean;
}

export interface PhiScanReport {
  id: string;
  datasetId: string;
  scanStartedAt: Date;
  scanCompletedAt?: Date;
  status: PhiDetectionStatus;
  totalRecords: number;
  scannedRecords: number;
  detections: PhiDetection[];
  summary: {
    totalDetections: number;
    detectionsByType: Record<string, number>;
    redactedCount: number;
    pendingCount: number;
  };
}

export interface DataQualitySummary {
  totalRows: number;
  totalColumns: number;
  missingValues: number;
  missingPercentage: number;
  duplicateRows: number;
  outlierCount: number;
  dataTypes: Record<string, number>;
  qualityScore: number;
  qualityLevel: DataQualityLevel;
}

export interface ValidationCheck {
  id: string;
  name: string;
  description: string;
  status: ValidationStatus;
  message?: string;
  details?: string[];
}

export interface CleaningOperation {
  id: string;
  name: string;
  description: string;
  type: 'missing_values' | 'outliers' | 'duplicates' | 'format' | 'normalization' | 'custom';
  status: PreprocessingStepStatus;
  config: Record<string, unknown>;
  affectedRows?: number;
  affectedColumns?: string[];
}

export interface PreprocessingStep {
  id: string;
  name: string;
  description: string;
  status: PreprocessingStepStatus;
  progress: number;
  startedAt?: Date;
  completedAt?: Date;
  errorMessage?: string;
}

export interface DatasetInfo {
  id: string;
  name: string;
  fileName: string;
  size: number;
  rowCount: number;
  columnCount: number;
  uploadedAt: Date;
  lastModifiedAt: Date;
}

interface Stage05Props {
  dataset?: DatasetInfo;
  qualitySummary?: DataQualitySummary;
  phiScanReport?: PhiScanReport;
  validationChecks: ValidationCheck[];
  cleaningOperations: CleaningOperation[];
  preprocessingSteps: PreprocessingStep[];
  onValidationChecksChange: (checks: ValidationCheck[]) => void;
  onCleaningOperationsChange: (operations: CleaningOperation[]) => void;
  onPreprocessingStepsChange: (steps: PreprocessingStep[]) => void;
  onRunPhiScan?: () => Promise<PhiScanReport>;
  onApplyRedaction?: (detectionIds: string[]) => Promise<void>;
  onRunCleaning?: (operationId: string) => Promise<void>;
  onRunAllPreprocessing?: () => Promise<void>;
  onExportProcessedData?: () => Promise<void>;
  isProcessing?: boolean;
  governanceMode: 'DEMO' | 'LIVE';
  className?: string;
}

// ==================== Main Component ====================

export function Stage05DataPreprocessing({
  dataset,
  qualitySummary,
  phiScanReport,
  validationChecks,
  cleaningOperations,
  preprocessingSteps,
  onValidationChecksChange,
  onCleaningOperationsChange,
  onPreprocessingStepsChange,
  onRunPhiScan,
  onApplyRedaction,
  onRunCleaning,
  onRunAllPreprocessing,
  onExportProcessedData,
  isProcessing = false,
  governanceMode,
  className,
}: Stage05Props) {
  const [selectedTab, setSelectedTab] = useState('overview');
  const [selectedDetections, setSelectedDetections] = useState<Set<string>>(new Set());
  const [showRedactedPreview, setShowRedactedPreview] = useState(false);
  const [expandedOperations, setExpandedOperations] = useState<Set<string>>(new Set());

  // Calculate overall progress
  const overallProgress = useMemo(() => {
    if (preprocessingSteps.length === 0) return 0;
    const completedSteps = preprocessingSteps.filter(s => s.status === 'completed').length;
    return Math.round((completedSteps / preprocessingSteps.length) * 100);
  }, [preprocessingSteps]);

  // PHI scan status
  const phiStatus = useMemo(() => {
    if (!phiScanReport) return 'not_scanned';
    return phiScanReport.status;
  }, [phiScanReport]);

  // Handle PHI detection selection
  const toggleDetectionSelection = useCallback((detectionId: string) => {
    setSelectedDetections(prev => {
      const next = new Set(prev);
      if (next.has(detectionId)) {
        next.delete(detectionId);
      } else {
        next.add(detectionId);
      }
      return next;
    });
  }, []);

  // Select all unredacted detections
  const selectAllUnredacted = useCallback(() => {
    if (!phiScanReport) return;
    const unredactedIds = phiScanReport.detections
      .filter(d => !d.isRedacted)
      .map(d => d.id);
    setSelectedDetections(new Set(unredactedIds));
  }, [phiScanReport]);

  // Apply redaction to selected
  const handleApplyRedaction = useCallback(async () => {
    if (!onApplyRedaction || selectedDetections.size === 0) return;
    await onApplyRedaction(Array.from(selectedDetections));
    setSelectedDetections(new Set());
  }, [onApplyRedaction, selectedDetections]);

  // Toggle operation expansion
  const toggleOperationExpansion = useCallback((operationId: string) => {
    setExpandedOperations(prev => {
      const next = new Set(prev);
      if (next.has(operationId)) {
        next.delete(operationId);
      } else {
        next.add(operationId);
      }
      return next;
    });
  }, []);

  // Update cleaning operation config
  const updateOperationConfig = useCallback((operationId: string, config: Record<string, unknown>) => {
    onCleaningOperationsChange(
      cleaningOperations.map(op =>
        op.id === operationId ? { ...op, config: { ...op.config, ...config } } : op
      )
    );
  }, [cleaningOperations, onCleaningOperationsChange]);

  return (
    <div className={cn('space-y-6', className)}>
      {/* PHI Compliance Alert for LIVE mode */}
      {governanceMode === 'LIVE' && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>PHI Compliance Required</AlertTitle>
          <AlertDescription>
            You are operating in LIVE mode. All data must be scanned for PHI before proceeding.
            Detected PHI must be redacted or approved by a compliance officer.
          </AlertDescription>
        </Alert>
      )}

      {/* Dataset Info Header */}
      {dataset && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <Database className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-lg">{dataset.name}</CardTitle>
                  <CardDescription>
                    {dataset.rowCount.toLocaleString()} rows x {dataset.columnCount} columns
                    {' '}&bull;{' '}
                    {(dataset.size / 1024 / 1024).toFixed(2)} MB
                  </CardDescription>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={governanceMode === 'LIVE' ? 'destructive' : 'secondary'}>
                  {governanceMode}
                </Badge>
                <PhiStatusBadge status={phiStatus} />
              </div>
            </div>
          </CardHeader>
        </Card>
      )}

      {/* Overall Progress */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Preprocessing Progress</CardTitle>
            <span className="text-sm font-medium">{overallProgress}%</span>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <Progress value={overallProgress} className="h-2" />
          <div className="grid grid-cols-4 gap-4">
            {preprocessingSteps.map((step) => (
              <StepIndicator key={step.id} step={step} />
            ))}
          </div>
        </CardContent>
        <CardFooter className="flex justify-end gap-2">
          <Button
            variant="outline"
            onClick={onExportProcessedData}
            disabled={isProcessing || overallProgress < 100}
          >
            <Download className="mr-2 h-4 w-4" />
            Export Processed Data
          </Button>
          <Button
            onClick={onRunAllPreprocessing}
            disabled={isProcessing}
          >
            {isProcessing ? (
              <>
                <RefreshCcw className="mr-2 h-4 w-4 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <Play className="mr-2 h-4 w-4" />
                Run All Steps
              </>
            )}
          </Button>
        </CardFooter>
      </Card>

      {/* Main Tabs */}
      <Tabs value={selectedTab} onValueChange={setSelectedTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">
            <BarChart2 className="mr-2 h-4 w-4" />
            Quality
          </TabsTrigger>
          <TabsTrigger value="phi">
            <Shield className="mr-2 h-4 w-4" />
            PHI Scan
          </TabsTrigger>
          <TabsTrigger value="cleaning">
            <Filter className="mr-2 h-4 w-4" />
            Cleaning
          </TabsTrigger>
          <TabsTrigger value="validation">
            <CheckCircle className="mr-2 h-4 w-4" />
            Validation
          </TabsTrigger>
        </TabsList>

        {/* Quality Overview Tab */}
        <TabsContent value="overview" className="mt-4">
          <DataQualityPanel qualitySummary={qualitySummary} />
        </TabsContent>

        {/* PHI Scan Tab */}
        <TabsContent value="phi" className="mt-4">
          <PhiScanPanel
            phiScanReport={phiScanReport}
            selectedDetections={selectedDetections}
            showRedactedPreview={showRedactedPreview}
            onToggleDetection={toggleDetectionSelection}
            onSelectAllUnredacted={selectAllUnredacted}
            onApplyRedaction={handleApplyRedaction}
            onTogglePreview={() => setShowRedactedPreview(!showRedactedPreview)}
            onRunScan={onRunPhiScan}
            isProcessing={isProcessing}
            governanceMode={governanceMode}
          />
        </TabsContent>

        {/* Data Cleaning Tab */}
        <TabsContent value="cleaning" className="mt-4">
          <DataCleaningPanel
            operations={cleaningOperations}
            expandedOperations={expandedOperations}
            onToggleExpansion={toggleOperationExpansion}
            onUpdateConfig={updateOperationConfig}
            onRunCleaning={onRunCleaning}
            isProcessing={isProcessing}
          />
        </TabsContent>

        {/* Validation Tab */}
        <TabsContent value="validation" className="mt-4">
          <ValidationPanel
            checks={validationChecks}
            onChecksChange={onValidationChecksChange}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ==================== Sub-Components ====================

// PHI Status Badge
function PhiStatusBadge({ status }: { status: PhiDetectionStatus }) {
  const config: Record<PhiDetectionStatus, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline'; icon: React.ComponentType<{ className?: string }> }> = {
    not_scanned: { label: 'Not Scanned', variant: 'secondary', icon: AlertCircle },
    scanning: { label: 'Scanning...', variant: 'default', icon: RefreshCcw },
    clean: { label: 'PHI Clean', variant: 'outline', icon: CheckCircle },
    detected: { label: 'PHI Detected', variant: 'destructive', icon: AlertTriangle },
    redacted: { label: 'Redacted', variant: 'outline', icon: Lock },
    error: { label: 'Scan Error', variant: 'destructive', icon: XCircle },
  };

  const { label, variant, icon: Icon } = config[status];

  return (
    <Badge variant={variant} className="gap-1">
      <Icon className={cn('h-3 w-3', status === 'scanning' && 'animate-spin')} />
      {label}
    </Badge>
  );
}

// Step Indicator
function StepIndicator({ step }: { step: PreprocessingStep }) {
  const statusConfig: Record<PreprocessingStepStatus, { color: string; icon: React.ComponentType<{ className?: string }> }> = {
    pending: { color: 'bg-gray-200 text-gray-600', icon: Info },
    in_progress: { color: 'bg-blue-100 text-blue-600', icon: RefreshCcw },
    completed: { color: 'bg-green-100 text-green-600', icon: CheckCircle },
    failed: { color: 'bg-red-100 text-red-600', icon: XCircle },
    skipped: { color: 'bg-yellow-100 text-yellow-600', icon: AlertCircle },
  };

  const { color, icon: Icon } = statusConfig[step.status];

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className={cn('flex items-center gap-2 p-2 rounded-lg', color)}>
            <Icon className={cn('h-4 w-4', step.status === 'in_progress' && 'animate-spin')} />
            <span className="text-xs font-medium truncate">{step.name}</span>
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <p className="font-medium">{step.name}</p>
          <p className="text-xs">{step.description}</p>
          {step.status === 'in_progress' && step.progress > 0 && (
            <p className="text-xs mt-1">Progress: {step.progress}%</p>
          )}
          {step.errorMessage && (
            <p className="text-xs text-red-500 mt-1">{step.errorMessage}</p>
          )}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

// Data Quality Panel
function DataQualityPanel({ qualitySummary }: { qualitySummary?: DataQualitySummary }) {
  if (!qualitySummary) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <BarChart2 className="h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-muted-foreground">No quality data available</p>
          <p className="text-sm text-muted-foreground">Upload a dataset to see quality metrics</p>
        </CardContent>
      </Card>
    );
  }

  const qualityColors: Record<DataQualityLevel, string> = {
    excellent: 'text-green-600 bg-green-100',
    good: 'text-blue-600 bg-blue-100',
    fair: 'text-yellow-600 bg-yellow-100',
    poor: 'text-red-600 bg-red-100',
  };

  return (
    <div className="space-y-4">
      {/* Quality Score Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Data Quality Score
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-6">
            <div className={cn('p-6 rounded-full', qualityColors[qualitySummary.qualityLevel])}>
              <span className="text-4xl font-bold">{qualitySummary.qualityScore}</span>
              <span className="text-lg">/100</span>
            </div>
            <div className="flex-1">
              <Badge className={cn('mb-2', qualityColors[qualitySummary.qualityLevel])}>
                {qualitySummary.qualityLevel.toUpperCase()}
              </Badge>
              <p className="text-sm text-muted-foreground">
                Based on completeness, consistency, and data integrity metrics.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Quality Metrics Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard
          title="Total Records"
          value={qualitySummary.totalRows.toLocaleString()}
          icon={Database}
          description={`${qualitySummary.totalColumns} columns`}
        />
        <MetricCard
          title="Missing Values"
          value={qualitySummary.missingValues.toLocaleString()}
          icon={AlertCircle}
          description={`${qualitySummary.missingPercentage.toFixed(1)}% of data`}
          variant={qualitySummary.missingPercentage > 10 ? 'warning' : 'default'}
        />
        <MetricCard
          title="Duplicate Rows"
          value={qualitySummary.duplicateRows.toLocaleString()}
          icon={FileText}
          description={`${((qualitySummary.duplicateRows / qualitySummary.totalRows) * 100).toFixed(1)}% duplicates`}
          variant={qualitySummary.duplicateRows > 0 ? 'warning' : 'default'}
        />
        <MetricCard
          title="Outliers"
          value={qualitySummary.outlierCount.toLocaleString()}
          icon={Zap}
          description="Detected anomalies"
          variant={qualitySummary.outlierCount > 0 ? 'info' : 'default'}
        />
      </div>

      {/* Data Types Distribution */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Column Data Types</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {Object.entries(qualitySummary.dataTypes).map(([type, count]) => (
              <Badge key={type} variant="outline" className="px-3 py-1">
                {type}: {count}
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// Metric Card
function MetricCard({
  title,
  value,
  icon: Icon,
  description,
  variant = 'default',
}: {
  title: string;
  value: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
  variant?: 'default' | 'warning' | 'info';
}) {
  const variantStyles = {
    default: 'bg-muted/50',
    warning: 'bg-yellow-50 border-yellow-200',
    info: 'bg-blue-50 border-blue-200',
  };

  return (
    <Card className={cn('border', variantStyles[variant])}>
      <CardContent className="pt-4">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm text-muted-foreground">{title}</p>
            <p className="text-2xl font-bold mt-1">{value}</p>
            <p className="text-xs text-muted-foreground mt-1">{description}</p>
          </div>
          <Icon className="h-5 w-5 text-muted-foreground" />
        </div>
      </CardContent>
    </Card>
  );
}

// PHI Scan Panel
function PhiScanPanel({
  phiScanReport,
  selectedDetections,
  showRedactedPreview,
  onToggleDetection,
  onSelectAllUnredacted,
  onApplyRedaction,
  onTogglePreview,
  onRunScan,
  isProcessing,
  governanceMode,
}: {
  phiScanReport?: PhiScanReport;
  selectedDetections: Set<string>;
  showRedactedPreview: boolean;
  onToggleDetection: (id: string) => void;
  onSelectAllUnredacted: () => void;
  onApplyRedaction: () => void;
  onTogglePreview: () => void;
  onRunScan?: () => Promise<PhiScanReport>;
  isProcessing: boolean;
  governanceMode: 'DEMO' | 'LIVE';
}) {
  const phiTypeLabels: Record<PhiDetection['type'], string> = {
    name: 'Name',
    ssn: 'SSN',
    dob: 'Date of Birth',
    address: 'Address',
    phone: 'Phone Number',
    email: 'Email',
    mrn: 'Medical Record #',
    custom: 'Custom Pattern',
  };

  const phiTypeColors: Record<PhiDetection['type'], string> = {
    name: 'bg-purple-100 text-purple-700',
    ssn: 'bg-red-100 text-red-700',
    dob: 'bg-orange-100 text-orange-700',
    address: 'bg-blue-100 text-blue-700',
    phone: 'bg-green-100 text-green-700',
    email: 'bg-cyan-100 text-cyan-700',
    mrn: 'bg-pink-100 text-pink-700',
    custom: 'bg-gray-100 text-gray-700',
  };

  if (!phiScanReport) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            PHI Scanner
          </CardTitle>
          <CardDescription>
            Scan your data for Protected Health Information (PHI)
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <Shield className="h-16 w-16 text-muted-foreground mb-4" />
          <p className="text-muted-foreground text-center mb-4">
            No PHI scan has been performed yet.
            {governanceMode === 'LIVE' && (
              <span className="block text-red-600 mt-2">
                PHI scanning is required in LIVE mode.
              </span>
            )}
          </p>
          <Button onClick={onRunScan} disabled={isProcessing}>
            {isProcessing ? (
              <>
                <RefreshCcw className="mr-2 h-4 w-4 animate-spin" />
                Scanning...
              </>
            ) : (
              <>
                <Shield className="mr-2 h-4 w-4" />
                Run PHI Scan
              </>
            )}
          </Button>
        </CardContent>
      </Card>
    );
  }

  const unredactedCount = phiScanReport.detections.filter(d => !d.isRedacted).length;
  const scanProgress = Math.round((phiScanReport.scannedRecords / phiScanReport.totalRecords) * 100);

  return (
    <div className="space-y-4">
      {/* Scan Summary */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                PHI Scan Results
              </CardTitle>
              <CardDescription>
                {phiScanReport.status === 'scanning'
                  ? `Scanning... ${scanProgress}% complete`
                  : `Completed ${phiScanReport.scanCompletedAt?.toLocaleString()}`}
              </CardDescription>
            </div>
            <PhiStatusBadge status={phiScanReport.status} />
          </div>
        </CardHeader>
        <CardContent>
          {phiScanReport.status === 'scanning' && (
            <Progress value={scanProgress} className="mb-4" />
          )}

          <div className="grid grid-cols-4 gap-4">
            <div className="text-center p-4 bg-muted rounded-lg">
              <p className="text-2xl font-bold">{phiScanReport.totalRecords.toLocaleString()}</p>
              <p className="text-xs text-muted-foreground">Records Scanned</p>
            </div>
            <div className="text-center p-4 bg-red-50 rounded-lg">
              <p className="text-2xl font-bold text-red-600">{phiScanReport.summary.totalDetections}</p>
              <p className="text-xs text-muted-foreground">PHI Detected</p>
            </div>
            <div className="text-center p-4 bg-green-50 rounded-lg">
              <p className="text-2xl font-bold text-green-600">{phiScanReport.summary.redactedCount}</p>
              <p className="text-xs text-muted-foreground">Redacted</p>
            </div>
            <div className="text-center p-4 bg-yellow-50 rounded-lg">
              <p className="text-2xl font-bold text-yellow-600">{unredactedCount}</p>
              <p className="text-xs text-muted-foreground">Pending</p>
            </div>
          </div>

          {/* Detection by Type */}
          {phiScanReport.summary.totalDetections > 0 && (
            <div className="mt-4">
              <p className="text-sm font-medium mb-2">Detections by Type</p>
              <div className="flex flex-wrap gap-2">
                {Object.entries(phiScanReport.summary.detectionsByType).map(([type, count]) => (
                  <Badge key={type} className={phiTypeColors[type as PhiDetection['type']]}>
                    {phiTypeLabels[type as PhiDetection['type']]}: {count}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </CardContent>
        <CardFooter className="flex justify-between">
          <Button variant="outline" onClick={onRunScan} disabled={isProcessing}>
            <RefreshCcw className="mr-2 h-4 w-4" />
            Rescan
          </Button>
          {unredactedCount > 0 && (
            <div className="flex gap-2">
              <Button variant="outline" onClick={onSelectAllUnredacted}>
                Select All Pending ({unredactedCount})
              </Button>
              <Button
                onClick={onApplyRedaction}
                disabled={selectedDetections.size === 0}
              >
                <Lock className="mr-2 h-4 w-4" />
                Redact Selected ({selectedDetections.size})
              </Button>
            </div>
          )}
        </CardFooter>
      </Card>

      {/* Detections List */}
      {phiScanReport.detections.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">PHI Detections</CardTitle>
              <div className="flex items-center gap-2">
                <Label htmlFor="preview-toggle" className="text-sm">Show Redacted Preview</Label>
                <Switch
                  id="preview-toggle"
                  checked={showRedactedPreview}
                  onCheckedChange={onTogglePreview}
                />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[400px]">
              <div className="space-y-2">
                {phiScanReport.detections.map((detection) => (
                  <PhiDetectionCard
                    key={detection.id}
                    detection={detection}
                    isSelected={selectedDetections.has(detection.id)}
                    showRedacted={showRedactedPreview}
                    onToggleSelect={() => onToggleDetection(detection.id)}
                    typeLabel={phiTypeLabels[detection.type]}
                    typeColor={phiTypeColors[detection.type]}
                  />
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// PHI Detection Card
function PhiDetectionCard({
  detection,
  isSelected,
  showRedacted,
  onToggleSelect,
  typeLabel,
  typeColor,
}: {
  detection: PhiDetection;
  isSelected: boolean;
  showRedacted: boolean;
  onToggleSelect: () => void;
  typeLabel: string;
  typeColor: string;
}) {
  return (
    <Card className={cn(
      'transition-colors',
      detection.isRedacted && 'bg-green-50/50 border-green-200',
      isSelected && !detection.isRedacted && 'ring-2 ring-primary'
    )}>
      <CardContent className="py-3">
        <div className="flex items-center gap-3">
          {!detection.isRedacted && (
            <Checkbox
              checked={isSelected}
              onCheckedChange={onToggleSelect}
            />
          )}
          {detection.isRedacted && (
            <Lock className="h-4 w-4 text-green-600" />
          )}

          <div className="flex-1">
            <div className="flex items-center gap-2">
              <Badge className={cn('text-xs', typeColor)}>{typeLabel}</Badge>
              <span className="text-xs text-muted-foreground">
                Row {detection.row} &bull; Column: {detection.field}
              </span>
              <Badge variant="outline" className="text-xs">
                {Math.round(detection.confidence * 100)}% confidence
              </Badge>
            </div>
            <div className="mt-1 font-mono text-sm">
              {showRedacted && detection.isRedacted ? (
                <span className="text-green-600">{detection.redactedValue}</span>
              ) : showRedacted && detection.redactedValue ? (
                <span>
                  <span className="line-through text-red-500">{detection.originalValue}</span>
                  {' '}&rarr;{' '}
                  <span className="text-green-600">{detection.redactedValue}</span>
                </span>
              ) : (
                <span className={detection.isRedacted ? 'text-green-600' : 'text-red-600'}>
                  {detection.isRedacted ? detection.redactedValue : detection.originalValue}
                </span>
              )}
            </div>
          </div>

          {detection.isRedacted ? (
            <Badge variant="outline" className="bg-green-100 text-green-700">
              <CheckCircle className="mr-1 h-3 w-3" />
              Redacted
            </Badge>
          ) : (
            <Badge variant="destructive">
              <AlertTriangle className="mr-1 h-3 w-3" />
              Pending
            </Badge>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// Data Cleaning Panel
function DataCleaningPanel({
  operations,
  expandedOperations,
  onToggleExpansion,
  onUpdateConfig,
  onRunCleaning,
  isProcessing,
}: {
  operations: CleaningOperation[];
  expandedOperations: Set<string>;
  onToggleExpansion: (id: string) => void;
  onUpdateConfig: (id: string, config: Record<string, unknown>) => void;
  onRunCleaning?: (id: string) => Promise<void>;
  isProcessing: boolean;
}) {
  const operationIcons: Record<CleaningOperation['type'], React.ComponentType<{ className?: string }>> = {
    missing_values: AlertCircle,
    outliers: Zap,
    duplicates: FileText,
    format: Settings,
    normalization: Activity,
    custom: Filter,
  };

  const statusColors: Record<PreprocessingStepStatus, string> = {
    pending: 'bg-gray-100 text-gray-600',
    in_progress: 'bg-blue-100 text-blue-600',
    completed: 'bg-green-100 text-green-600',
    failed: 'bg-red-100 text-red-600',
    skipped: 'bg-yellow-100 text-yellow-600',
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Filter className="h-5 w-5" />
          Data Cleaning Operations
        </CardTitle>
        <CardDescription>
          Configure and run data cleaning operations
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {operations.map((operation) => {
            const Icon = operationIcons[operation.type];
            const isExpanded = expandedOperations.has(operation.id);

            return (
              <Collapsible
                key={operation.id}
                open={isExpanded}
                onOpenChange={() => onToggleExpansion(operation.id)}
              >
                <Card>
                  <CollapsibleTrigger asChild>
                    <CardContent className="py-3 cursor-pointer hover:bg-muted/50">
                      <div className="flex items-center gap-3">
                        <Icon className="h-5 w-5 text-muted-foreground" />
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{operation.name}</span>
                            <Badge className={cn('text-xs', statusColors[operation.status])}>
                              {operation.status.replace('_', ' ')}
                            </Badge>
                            {operation.affectedRows !== undefined && operation.status === 'completed' && (
                              <span className="text-xs text-muted-foreground">
                                ({operation.affectedRows} rows affected)
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground">{operation.description}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              onRunCleaning?.(operation.id);
                            }}
                            disabled={isProcessing || operation.status === 'in_progress'}
                          >
                            {operation.status === 'in_progress' ? (
                              <RefreshCcw className="h-4 w-4 animate-spin" />
                            ) : (
                              <Play className="h-4 w-4" />
                            )}
                          </Button>
                          {isExpanded ? (
                            <ChevronDown className="h-4 w-4 text-muted-foreground" />
                          ) : (
                            <ChevronRight className="h-4 w-4 text-muted-foreground" />
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <CardContent className="pt-0 border-t">
                      <CleaningOperationConfig
                        operation={operation}
                        onUpdateConfig={(config) => onUpdateConfig(operation.id, config)}
                      />
                    </CardContent>
                  </CollapsibleContent>
                </Card>
              </Collapsible>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

// Cleaning Operation Config
function CleaningOperationConfig({
  operation,
  onUpdateConfig,
}: {
  operation: CleaningOperation;
  onUpdateConfig: (config: Record<string, unknown>) => void;
}) {
  switch (operation.type) {
    case 'missing_values':
      return (
        <div className="space-y-4 pt-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Strategy</Label>
              <Select
                value={operation.config.strategy as string || 'drop'}
                onValueChange={(v) => onUpdateConfig({ strategy: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="drop">Drop rows</SelectItem>
                  <SelectItem value="mean">Fill with mean</SelectItem>
                  <SelectItem value="median">Fill with median</SelectItem>
                  <SelectItem value="mode">Fill with mode</SelectItem>
                  <SelectItem value="constant">Fill with constant</SelectItem>
                  <SelectItem value="forward_fill">Forward fill</SelectItem>
                  <SelectItem value="backward_fill">Backward fill</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {operation.config.strategy === 'constant' && (
              <div>
                <Label>Constant Value</Label>
                <Input
                  value={operation.config.constantValue as string || ''}
                  onChange={(e) => onUpdateConfig({ constantValue: e.target.value })}
                  placeholder="Enter value"
                />
              </div>
            )}
          </div>
          <div>
            <Label>Threshold (% missing to drop column)</Label>
            <Input
              type="number"
              min={0}
              max={100}
              value={operation.config.threshold as number || 50}
              onChange={(e) => onUpdateConfig({ threshold: parseInt(e.target.value) })}
            />
          </div>
        </div>
      );

    case 'outliers':
      return (
        <div className="space-y-4 pt-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Detection Method</Label>
              <Select
                value={operation.config.method as string || 'iqr'}
                onValueChange={(v) => onUpdateConfig({ method: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="iqr">IQR (Interquartile Range)</SelectItem>
                  <SelectItem value="zscore">Z-Score</SelectItem>
                  <SelectItem value="isolation_forest">Isolation Forest</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Action</Label>
              <Select
                value={operation.config.action as string || 'flag'}
                onValueChange={(v) => onUpdateConfig({ action: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="flag">Flag only</SelectItem>
                  <SelectItem value="remove">Remove rows</SelectItem>
                  <SelectItem value="cap">Cap values</SelectItem>
                  <SelectItem value="replace_median">Replace with median</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label>Threshold (standard deviations or IQR multiplier)</Label>
            <Input
              type="number"
              step={0.1}
              min={0}
              value={operation.config.threshold as number || 1.5}
              onChange={(e) => onUpdateConfig({ threshold: parseFloat(e.target.value) })}
            />
          </div>
        </div>
      );

    case 'duplicates':
      return (
        <div className="space-y-4 pt-4">
          <div>
            <Label>Duplicate Detection Columns</Label>
            <Input
              value={operation.config.columns as string || ''}
              onChange={(e) => onUpdateConfig({ columns: e.target.value })}
              placeholder="Leave empty for all columns, or comma-separated list"
            />
          </div>
          <div>
            <Label>Keep</Label>
            <Select
              value={operation.config.keep as string || 'first'}
              onValueChange={(v) => onUpdateConfig({ keep: v })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="first">Keep first occurrence</SelectItem>
                <SelectItem value="last">Keep last occurrence</SelectItem>
                <SelectItem value="none">Remove all duplicates</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      );

    default:
      return (
        <div className="pt-4 text-sm text-muted-foreground">
          No configuration options available for this operation.
        </div>
      );
  }
}

// Validation Panel
function ValidationPanel({
  checks,
  onChecksChange,
}: {
  checks: ValidationCheck[];
  onChecksChange: (checks: ValidationCheck[]) => void;
}) {
  const statusConfig: Record<ValidationStatus, { color: string; icon: React.ComponentType<{ className?: string }> }> = {
    pending: { color: 'bg-gray-100 text-gray-600', icon: Info },
    passed: { color: 'bg-green-100 text-green-600', icon: CheckCircle },
    failed: { color: 'bg-red-100 text-red-600', icon: XCircle },
    warning: { color: 'bg-yellow-100 text-yellow-600', icon: AlertTriangle },
  };

  const passedCount = checks.filter(c => c.status === 'passed').length;
  const failedCount = checks.filter(c => c.status === 'failed').length;
  const warningCount = checks.filter(c => c.status === 'warning').length;

  return (
    <div className="space-y-4">
      {/* Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5" />
            Validation Summary
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-4 gap-4">
            <div className="text-center p-4 bg-muted rounded-lg">
              <p className="text-2xl font-bold">{checks.length}</p>
              <p className="text-xs text-muted-foreground">Total Checks</p>
            </div>
            <div className="text-center p-4 bg-green-50 rounded-lg">
              <p className="text-2xl font-bold text-green-600">{passedCount}</p>
              <p className="text-xs text-muted-foreground">Passed</p>
            </div>
            <div className="text-center p-4 bg-yellow-50 rounded-lg">
              <p className="text-2xl font-bold text-yellow-600">{warningCount}</p>
              <p className="text-xs text-muted-foreground">Warnings</p>
            </div>
            <div className="text-center p-4 bg-red-50 rounded-lg">
              <p className="text-2xl font-bold text-red-600">{failedCount}</p>
              <p className="text-xs text-muted-foreground">Failed</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Validation Checklist */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Validation Checklist</CardTitle>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[400px]">
            <div className="space-y-2">
              {checks.map((check) => {
                const { color, icon: StatusIcon } = statusConfig[check.status];

                return (
                  <Card key={check.id} className={cn(
                    check.status === 'failed' && 'border-red-200',
                    check.status === 'warning' && 'border-yellow-200'
                  )}>
                    <CardContent className="py-3">
                      <div className="flex items-start gap-3">
                        <div className={cn('p-1.5 rounded-full', color)}>
                          <StatusIcon className="h-4 w-4" />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{check.name}</span>
                            <Badge className={cn('text-xs', color)}>
                              {check.status}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground">{check.description}</p>
                          {check.message && (
                            <p className={cn(
                              'text-sm mt-1',
                              check.status === 'failed' && 'text-red-600',
                              check.status === 'warning' && 'text-yellow-600',
                              check.status === 'passed' && 'text-green-600'
                            )}>
                              {check.message}
                            </p>
                          )}
                          {check.details && check.details.length > 0 && (
                            <ul className="mt-2 text-xs text-muted-foreground list-disc list-inside">
                              {check.details.map((detail, idx) => (
                                <li key={idx}>{detail}</li>
                              ))}
                            </ul>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}

export default Stage05DataPreprocessing;
