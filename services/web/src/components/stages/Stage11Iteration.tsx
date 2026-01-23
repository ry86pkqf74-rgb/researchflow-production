/**
 * Stage 11 - Iteration
 * Refine analysis with AI routing options
 * Features: Iteration history timeline, feedback integration, AI-assisted refinement,
 * model tier selection, version comparison, revert capability, iteration log export
 */

import * as React from 'react';
import { useState, useCallback, useMemo } from 'react';
import {
  RefreshCw,
  History,
  GitBranch,
  GitCompare,
  Sparkles,
  Plus,
  Trash2,
  Edit3,
  Check,
  X,
  ChevronDown,
  ChevronRight,
  Clock,
  Download,
  RotateCcw,
  ArrowRight,
  FileText,
  AlertTriangle,
  CheckCircle,
  Info,
  Zap,
  Brain,
  DollarSign,
  Target,
  TrendingUp,
  MessageSquare,
  Flag,
  Eye,
  EyeOff,
  Copy,
  MoreVertical,
  Play,
  Pause,
  FileJson,
  Filter,
  SortDesc,
  Tag,
  Layers,
  ArrowUpDown,
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
import { Textarea } from '@/components/ui/textarea';
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
import { Checkbox } from '@/components/ui/checkbox';
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { ModelTierSelect, ModelTierCards, type ModelTier } from '@/components/ai';

// ==================== Types ====================

export type IterationStatus = 'draft' | 'in_progress' | 'completed' | 'failed' | 'reverted';

export type RefinementType = 'methodology' | 'analysis' | 'interpretation' | 'visualization' | 'statistical';

export type FeedbackSeverity = 'critical' | 'major' | 'minor' | 'suggestion';

export type ChangeType = 'addition' | 'modification' | 'removal' | 'refinement';

export interface ValidationFeedback {
  id: string;
  issueId: string;
  title: string;
  description: string;
  severity: FeedbackSeverity;
  category: string;
  sourceStage: number;
  isAddressed: boolean;
  addressedInIteration?: string;
  createdAt: Date;
}

export interface IterationChange {
  id: string;
  type: ChangeType;
  category: RefinementType;
  description: string;
  affectedArtifacts: string[];
  beforeValue?: string;
  afterValue?: string;
}

export interface RefinementSuggestion {
  id: string;
  type: RefinementType;
  title: string;
  description: string;
  rationale: string;
  estimatedImpact: 'high' | 'medium' | 'low';
  estimatedEffort: 'high' | 'medium' | 'low';
  relatedFeedbackIds: string[];
  isAccepted: boolean;
  isDismissed: boolean;
  createdAt: Date;
}

export interface IterationVersion {
  id: string;
  versionNumber: number;
  name: string;
  description: string;
  status: IterationStatus;
  modelTier: ModelTier;
  changes: IterationChange[];
  addressedFeedback: string[];
  appliedSuggestions: string[];
  metrics: {
    qualityScore?: number;
    confidenceLevel?: number;
    completeness?: number;
  };
  cost: {
    inputTokens: number;
    outputTokens: number;
    totalCost: number;
  };
  parentVersionId?: string;
  createdBy: string;
  createdAt: Date;
  completedAt?: Date;
  notes?: string;
}

export interface IterationLog {
  id: string;
  projectId: string;
  versions: IterationVersion[];
  currentVersionId: string;
  totalCost: number;
  totalIterations: number;
  createdAt: Date;
  updatedAt: Date;
}

interface Stage11Props {
  iterationLog: IterationLog;
  onIterationLogChange: (log: IterationLog) => void;
  validationFeedback: ValidationFeedback[];
  onFeedbackChange: (feedback: ValidationFeedback[]) => void;
  suggestions: RefinementSuggestion[];
  onSuggestionsChange: (suggestions: RefinementSuggestion[]) => void;
  modelTier: ModelTier;
  onModelTierChange: (tier: ModelTier) => void;
  currentUserId: string;
  onGenerateSuggestions?: (feedback: ValidationFeedback[]) => Promise<RefinementSuggestion[]>;
  onRunIteration?: (version: IterationVersion) => Promise<IterationVersion>;
  onExportLog?: (format: 'json' | 'md' | 'pdf') => Promise<void>;
  onRevertToVersion?: (versionId: string) => Promise<void>;
  isProcessing?: boolean;
  className?: string;
}

// ==================== Configuration ====================

const REFINEMENT_TYPE_CONFIG: Record<RefinementType, {
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
}> = {
  methodology: {
    label: 'Methodology',
    description: 'Research design and approach refinements',
    icon: Target,
    color: 'bg-purple-100 text-purple-700 border-purple-200',
  },
  analysis: {
    label: 'Analysis',
    description: 'Data analysis and processing changes',
    icon: TrendingUp,
    color: 'bg-blue-100 text-blue-700 border-blue-200',
  },
  interpretation: {
    label: 'Interpretation',
    description: 'Results interpretation improvements',
    icon: MessageSquare,
    color: 'bg-green-100 text-green-700 border-green-200',
  },
  visualization: {
    label: 'Visualization',
    description: 'Figure and chart refinements',
    icon: Eye,
    color: 'bg-orange-100 text-orange-700 border-orange-200',
  },
  statistical: {
    label: 'Statistical',
    description: 'Statistical model adjustments',
    icon: Brain,
    color: 'bg-pink-100 text-pink-700 border-pink-200',
  },
};

const SEVERITY_CONFIG: Record<FeedbackSeverity, {
  label: string;
  color: string;
  icon: React.ComponentType<{ className?: string }>;
}> = {
  critical: { label: 'Critical', color: 'bg-red-100 text-red-700 border-red-200', icon: AlertTriangle },
  major: { label: 'Major', color: 'bg-orange-100 text-orange-700 border-orange-200', icon: Flag },
  minor: { label: 'Minor', color: 'bg-yellow-100 text-yellow-700 border-yellow-200', icon: Info },
  suggestion: { label: 'Suggestion', color: 'bg-blue-100 text-blue-700 border-blue-200', icon: Sparkles },
};

const STATUS_CONFIG: Record<IterationStatus, {
  label: string;
  color: string;
  icon: React.ComponentType<{ className?: string }>;
}> = {
  draft: { label: 'Draft', color: 'bg-gray-100 text-gray-700', icon: Edit3 },
  in_progress: { label: 'In Progress', color: 'bg-blue-100 text-blue-700', icon: RefreshCw },
  completed: { label: 'Completed', color: 'bg-green-100 text-green-700', icon: CheckCircle },
  failed: { label: 'Failed', color: 'bg-red-100 text-red-700', icon: AlertTriangle },
  reverted: { label: 'Reverted', color: 'bg-yellow-100 text-yellow-700', icon: RotateCcw },
};

const MODEL_TIER_CONFIG: Record<ModelTier, {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
}> = {
  economy: { label: 'Economy', icon: Zap, color: 'text-green-600' },
  standard: { label: 'Standard', icon: Brain, color: 'text-blue-600' },
  premium: { label: 'Premium', icon: Sparkles, color: 'text-purple-600' },
};

// ==================== Main Component ====================

export function Stage11Iteration({
  iterationLog,
  onIterationLogChange,
  validationFeedback,
  onFeedbackChange,
  suggestions,
  onSuggestionsChange,
  modelTier,
  onModelTierChange,
  currentUserId,
  onGenerateSuggestions,
  onRunIteration,
  onExportLog,
  onRevertToVersion,
  isProcessing = false,
  className,
}: Stage11Props) {
  const [selectedTab, setSelectedTab] = useState('timeline');
  const [selectedVersionId, setSelectedVersionId] = useState<string | null>(
    iterationLog.currentVersionId
  );
  const [compareVersionId, setCompareVersionId] = useState<string | null>(null);
  const [isCreatingVersion, setIsCreatingVersion] = useState(false);
  const [newVersionData, setNewVersionData] = useState<{
    name: string;
    description: string;
    selectedFeedback: string[];
    selectedSuggestions: string[];
  }>({
    name: '',
    description: '',
    selectedFeedback: [],
    selectedSuggestions: [],
  });
  const [revertDialogOpen, setRevertDialogOpen] = useState(false);
  const [versionToRevert, setVersionToRevert] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<RefinementType | 'all'>('all');
  const [showAddressed, setShowAddressed] = useState(false);

  // Get current and selected versions
  const currentVersion = iterationLog.versions.find(v => v.id === iterationLog.currentVersionId);
  const selectedVersion = iterationLog.versions.find(v => v.id === selectedVersionId);
  const compareVersion = compareVersionId
    ? iterationLog.versions.find(v => v.id === compareVersionId)
    : null;

  // Calculate statistics
  const stats = useMemo(() => {
    const versions = iterationLog.versions;
    const totalVersions = versions.length;
    const completedVersions = versions.filter(v => v.status === 'completed').length;
    const totalCost = versions.reduce((sum, v) => sum + v.cost.totalCost, 0);
    const addressedFeedback = validationFeedback.filter(f => f.isAddressed).length;
    const totalFeedback = validationFeedback.length;
    const criticalUnaddressed = validationFeedback.filter(
      f => f.severity === 'critical' && !f.isAddressed
    ).length;

    return {
      totalVersions,
      completedVersions,
      totalCost,
      addressedFeedback,
      totalFeedback,
      criticalUnaddressed,
      addressedPercent: totalFeedback > 0
        ? Math.round((addressedFeedback / totalFeedback) * 100)
        : 0,
    };
  }, [iterationLog.versions, validationFeedback]);

  // Filter feedback
  const displayedFeedback = useMemo(() => {
    return validationFeedback.filter(f => {
      if (!showAddressed && f.isAddressed) return false;
      return true;
    });
  }, [validationFeedback, showAddressed]);

  // Active suggestions
  const activeSuggestions = useMemo(() => {
    return suggestions.filter(s => !s.isAccepted && !s.isDismissed);
  }, [suggestions]);

  // Generate AI suggestions
  const handleGenerateSuggestions = useCallback(async () => {
    if (!onGenerateSuggestions) return;
    const unaddressedFeedback = validationFeedback.filter(f => !f.isAddressed);
    const newSuggestions = await onGenerateSuggestions(unaddressedFeedback);
    onSuggestionsChange([...suggestions, ...newSuggestions]);
  }, [onGenerateSuggestions, validationFeedback, suggestions, onSuggestionsChange]);

  // Accept suggestion
  const acceptSuggestion = useCallback((suggestionId: string) => {
    onSuggestionsChange(
      suggestions.map(s =>
        s.id === suggestionId ? { ...s, isAccepted: true } : s
      )
    );
    setNewVersionData(prev => ({
      ...prev,
      selectedSuggestions: [...prev.selectedSuggestions, suggestionId],
    }));
  }, [suggestions, onSuggestionsChange]);

  // Dismiss suggestion
  const dismissSuggestion = useCallback((suggestionId: string) => {
    onSuggestionsChange(
      suggestions.map(s =>
        s.id === suggestionId ? { ...s, isDismissed: true } : s
      )
    );
  }, [suggestions, onSuggestionsChange]);

  // Create new iteration version
  const createNewVersion = useCallback(() => {
    const newVersion: IterationVersion = {
      id: crypto.randomUUID(),
      versionNumber: iterationLog.versions.length + 1,
      name: newVersionData.name || `Iteration ${iterationLog.versions.length + 1}`,
      description: newVersionData.description,
      status: 'draft',
      modelTier,
      changes: [],
      addressedFeedback: newVersionData.selectedFeedback,
      appliedSuggestions: newVersionData.selectedSuggestions,
      metrics: {},
      cost: { inputTokens: 0, outputTokens: 0, totalCost: 0 },
      parentVersionId: iterationLog.currentVersionId,
      createdBy: currentUserId,
      createdAt: new Date(),
    };

    onIterationLogChange({
      ...iterationLog,
      versions: [...iterationLog.versions, newVersion],
      currentVersionId: newVersion.id,
      totalIterations: iterationLog.totalIterations + 1,
      updatedAt: new Date(),
    });

    // Mark selected feedback as addressed
    if (newVersionData.selectedFeedback.length > 0) {
      onFeedbackChange(
        validationFeedback.map(f =>
          newVersionData.selectedFeedback.includes(f.id)
            ? { ...f, isAddressed: true, addressedInIteration: newVersion.id }
            : f
        )
      );
    }

    setIsCreatingVersion(false);
    setNewVersionData({
      name: '',
      description: '',
      selectedFeedback: [],
      selectedSuggestions: [],
    });
    setSelectedVersionId(newVersion.id);
  }, [
    iterationLog,
    onIterationLogChange,
    newVersionData,
    modelTier,
    currentUserId,
    validationFeedback,
    onFeedbackChange,
  ]);

  // Run iteration
  const handleRunIteration = useCallback(async (versionId: string) => {
    if (!onRunIteration) return;
    const version = iterationLog.versions.find(v => v.id === versionId);
    if (!version) return;

    // Update status to in_progress
    onIterationLogChange({
      ...iterationLog,
      versions: iterationLog.versions.map(v =>
        v.id === versionId ? { ...v, status: 'in_progress' } : v
      ),
      updatedAt: new Date(),
    });

    try {
      const updatedVersion = await onRunIteration(version);
      onIterationLogChange({
        ...iterationLog,
        versions: iterationLog.versions.map(v =>
          v.id === versionId ? updatedVersion : v
        ),
        totalCost: iterationLog.totalCost + updatedVersion.cost.totalCost,
        updatedAt: new Date(),
      });
    } catch (error) {
      onIterationLogChange({
        ...iterationLog,
        versions: iterationLog.versions.map(v =>
          v.id === versionId ? { ...v, status: 'failed' } : v
        ),
        updatedAt: new Date(),
      });
    }
  }, [iterationLog, onIterationLogChange, onRunIteration]);

  // Revert to version
  const handleRevert = useCallback(async () => {
    if (!versionToRevert || !onRevertToVersion) return;

    await onRevertToVersion(versionToRevert);

    // Mark current version as reverted
    onIterationLogChange({
      ...iterationLog,
      versions: iterationLog.versions.map(v =>
        v.id === iterationLog.currentVersionId
          ? { ...v, status: 'reverted' }
          : v
      ),
      currentVersionId: versionToRevert,
      updatedAt: new Date(),
    });

    setRevertDialogOpen(false);
    setVersionToRevert(null);
    setSelectedVersionId(versionToRevert);
  }, [versionToRevert, onRevertToVersion, iterationLog, onIterationLogChange]);

  // Toggle feedback selection for new version
  const toggleFeedbackSelection = useCallback((feedbackId: string) => {
    setNewVersionData(prev => ({
      ...prev,
      selectedFeedback: prev.selectedFeedback.includes(feedbackId)
        ? prev.selectedFeedback.filter(id => id !== feedbackId)
        : [...prev.selectedFeedback, feedbackId],
    }));
  }, []);

  // Toggle suggestion selection for new version
  const toggleSuggestionSelection = useCallback((suggestionId: string) => {
    setNewVersionData(prev => ({
      ...prev,
      selectedSuggestions: prev.selectedSuggestions.includes(suggestionId)
        ? prev.selectedSuggestions.filter(id => id !== suggestionId)
        : [...prev.selectedSuggestions, suggestionId],
    }));
  }, []);

  return (
    <div className={cn('space-y-6', className)}>
      {/* Critical Issues Alert */}
      {stats.criticalUnaddressed > 0 && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Critical Feedback Requires Attention</AlertTitle>
          <AlertDescription>
            There are {stats.criticalUnaddressed} critical issue(s) from validation that have not been addressed.
            Consider creating a new iteration to resolve these.
          </AlertDescription>
        </Alert>
      )}

      {/* Header with Stats */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <RefreshCw className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle>Iteration Management</CardTitle>
                <CardDescription>
                  Refine your analysis based on validation feedback
                </CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                onClick={handleGenerateSuggestions}
                disabled={isProcessing || validationFeedback.filter(f => !f.isAddressed).length === 0}
              >
                {isProcessing ? (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Sparkles className="mr-2 h-4 w-4" />
                    Get Suggestions
                  </>
                )}
              </Button>
              <Button onClick={() => setIsCreatingVersion(true)}>
                <Plus className="mr-2 h-4 w-4" />
                New Iteration
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Stats Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard
              label="Total Iterations"
              value={stats.totalVersions}
              icon={Layers}
            />
            <StatCard
              label="Feedback Addressed"
              value={`${stats.addressedFeedback}/${stats.totalFeedback}`}
              subValue={`${stats.addressedPercent}%`}
              icon={CheckCircle}
            />
            <StatCard
              label="Total Cost"
              value={`$${stats.totalCost.toFixed(4)}`}
              icon={DollarSign}
            />
            <StatCard
              label="Current Version"
              value={currentVersion?.versionNumber || 1}
              subValue={currentVersion?.name}
              icon={GitBranch}
            />
          </div>

          {/* Progress Bar */}
          <div className="mt-4 space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span>Feedback Resolution Progress</span>
              <span className="font-mono">{stats.addressedPercent}%</span>
            </div>
            <Progress value={stats.addressedPercent} className="h-2" />
          </div>
        </CardContent>
      </Card>

      {/* AI Suggestions Panel */}
      {activeSuggestions.length > 0 && (
        <Card className="border-primary/50 bg-primary/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              AI Refinement Suggestions ({activeSuggestions.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="max-h-[250px]">
              <div className="space-y-3">
                {activeSuggestions.map(suggestion => (
                  <SuggestionCard
                    key={suggestion.id}
                    suggestion={suggestion}
                    isSelected={newVersionData.selectedSuggestions.includes(suggestion.id)}
                    onToggleSelect={() => toggleSuggestionSelection(suggestion.id)}
                    onAccept={() => acceptSuggestion(suggestion.id)}
                    onDismiss={() => dismissSuggestion(suggestion.id)}
                  />
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      {/* Main Tabs */}
      <Tabs value={selectedTab} onValueChange={setSelectedTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="timeline">
            <History className="mr-2 h-4 w-4" />
            Timeline
          </TabsTrigger>
          <TabsTrigger value="feedback">
            <MessageSquare className="mr-2 h-4 w-4" />
            Feedback ({displayedFeedback.length})
          </TabsTrigger>
          <TabsTrigger value="compare">
            <GitCompare className="mr-2 h-4 w-4" />
            Compare
          </TabsTrigger>
          <TabsTrigger value="export">
            <Download className="mr-2 h-4 w-4" />
            Export
          </TabsTrigger>
        </TabsList>

        {/* Timeline Tab */}
        <TabsContent value="timeline" className="mt-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Version List */}
            <Card className="lg:col-span-1">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Version History</CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[500px]">
                  <div className="space-y-2">
                    {[...iterationLog.versions].reverse().map(version => (
                      <VersionListItem
                        key={version.id}
                        version={version}
                        isSelected={selectedVersionId === version.id}
                        isCurrent={iterationLog.currentVersionId === version.id}
                        onSelect={() => setSelectedVersionId(version.id)}
                        onRun={() => handleRunIteration(version.id)}
                        onRevert={() => {
                          setVersionToRevert(version.id);
                          setRevertDialogOpen(true);
                        }}
                        canRevert={
                          version.id !== iterationLog.currentVersionId &&
                          version.status === 'completed'
                        }
                      />
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>

            {/* Version Details */}
            <Card className="lg:col-span-2">
              {selectedVersion ? (
                <>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline">v{selectedVersion.versionNumber}</Badge>
                          <Badge className={cn('text-xs', STATUS_CONFIG[selectedVersion.status].color)}>
                            {STATUS_CONFIG[selectedVersion.status].label}
                          </Badge>
                          {iterationLog.currentVersionId === selectedVersion.id && (
                            <Badge variant="default">Current</Badge>
                          )}
                        </div>
                        <CardTitle className="mt-2">{selectedVersion.name}</CardTitle>
                        <CardDescription>{selectedVersion.description}</CardDescription>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => setCompareVersionId(selectedVersion.id)}>
                            <GitCompare className="mr-2 h-4 w-4" />
                            Compare with...
                          </DropdownMenuItem>
                          <DropdownMenuItem>
                            <Copy className="mr-2 h-4 w-4" />
                            Duplicate
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          {selectedVersion.status === 'completed' &&
                            selectedVersion.id !== iterationLog.currentVersionId && (
                              <DropdownMenuItem
                                onClick={() => {
                                  setVersionToRevert(selectedVersion.id);
                                  setRevertDialogOpen(true);
                                }}
                              >
                                <RotateCcw className="mr-2 h-4 w-4" />
                                Revert to this version
                              </DropdownMenuItem>
                            )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {/* Version Metadata */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <p className="text-muted-foreground">Model Tier</p>
                        <div className="flex items-center gap-1 mt-1">
                          {React.createElement(MODEL_TIER_CONFIG[selectedVersion.modelTier].icon, {
                            className: cn('h-4 w-4', MODEL_TIER_CONFIG[selectedVersion.modelTier].color),
                          })}
                          <span className="font-medium">
                            {MODEL_TIER_CONFIG[selectedVersion.modelTier].label}
                          </span>
                        </div>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Cost</p>
                        <p className="font-mono font-medium mt-1">
                          ${selectedVersion.cost.totalCost.toFixed(4)}
                        </p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Created</p>
                        <p className="font-medium mt-1">
                          {selectedVersion.createdAt.toLocaleDateString()}
                        </p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Feedback Addressed</p>
                        <p className="font-medium mt-1">
                          {selectedVersion.addressedFeedback.length} items
                        </p>
                      </div>
                    </div>

                    <Separator />

                    {/* Metrics */}
                    {selectedVersion.metrics && Object.keys(selectedVersion.metrics).length > 0 && (
                      <>
                        <div>
                          <h4 className="font-medium mb-3">Quality Metrics</h4>
                          <div className="grid grid-cols-3 gap-4">
                            {selectedVersion.metrics.qualityScore !== undefined && (
                              <MetricCard
                                label="Quality Score"
                                value={selectedVersion.metrics.qualityScore}
                                max={100}
                              />
                            )}
                            {selectedVersion.metrics.confidenceLevel !== undefined && (
                              <MetricCard
                                label="Confidence"
                                value={selectedVersion.metrics.confidenceLevel}
                                max={100}
                              />
                            )}
                            {selectedVersion.metrics.completeness !== undefined && (
                              <MetricCard
                                label="Completeness"
                                value={selectedVersion.metrics.completeness}
                                max={100}
                              />
                            )}
                          </div>
                        </div>
                        <Separator />
                      </>
                    )}

                    {/* Changes */}
                    <div>
                      <h4 className="font-medium mb-3">Changes ({selectedVersion.changes.length})</h4>
                      {selectedVersion.changes.length > 0 ? (
                        <ScrollArea className="h-[200px]">
                          <div className="space-y-2">
                            {selectedVersion.changes.map(change => (
                              <ChangeCard key={change.id} change={change} />
                            ))}
                          </div>
                        </ScrollArea>
                      ) : (
                        <div className="text-center py-8 text-muted-foreground">
                          <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                          <p>No changes recorded for this version</p>
                        </div>
                      )}
                    </div>

                    {/* Notes */}
                    {selectedVersion.notes && (
                      <>
                        <Separator />
                        <div>
                          <h4 className="font-medium mb-2">Notes</h4>
                          <p className="text-sm text-muted-foreground">{selectedVersion.notes}</p>
                        </div>
                      </>
                    )}
                  </CardContent>
                  {selectedVersion.status === 'draft' && (
                    <CardFooter className="border-t pt-4">
                      <Button
                        className="w-full"
                        onClick={() => handleRunIteration(selectedVersion.id)}
                        disabled={isProcessing}
                      >
                        {isProcessing ? (
                          <>
                            <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                            Processing...
                          </>
                        ) : (
                          <>
                            <Play className="mr-2 h-4 w-4" />
                            Run Iteration
                          </>
                        )}
                      </Button>
                    </CardFooter>
                  )}
                </>
              ) : (
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <History className="h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">Select a version to view details</p>
                </CardContent>
              )}
            </Card>
          </div>
        </TabsContent>

        {/* Feedback Tab */}
        <TabsContent value="feedback" className="mt-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Validation Feedback</CardTitle>
                  <CardDescription>
                    Address feedback from the validation stage
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowAddressed(!showAddressed)}
                  >
                    {showAddressed ? (
                      <EyeOff className="mr-2 h-4 w-4" />
                    ) : (
                      <Eye className="mr-2 h-4 w-4" />
                    )}
                    {showAddressed ? 'Hide Addressed' : 'Show Addressed'}
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[500px]">
                <div className="space-y-3">
                  {displayedFeedback.map(feedback => (
                    <FeedbackCard
                      key={feedback.id}
                      feedback={feedback}
                      isSelected={newVersionData.selectedFeedback.includes(feedback.id)}
                      onToggleSelect={() => toggleFeedbackSelection(feedback.id)}
                      iterationVersion={
                        feedback.addressedInIteration
                          ? iterationLog.versions.find(v => v.id === feedback.addressedInIteration)
                          : undefined
                      }
                    />
                  ))}
                  {displayedFeedback.length === 0 && (
                    <div className="text-center py-12 text-muted-foreground">
                      <CheckCircle className="h-12 w-12 mx-auto mb-4 text-green-500" />
                      <p>All feedback has been addressed!</p>
                    </div>
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Compare Tab */}
        <TabsContent value="compare" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Version Comparison</CardTitle>
              <CardDescription>
                Compare changes between different iteration versions
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="space-y-2">
                  <Label>Base Version</Label>
                  <Select
                    value={selectedVersionId || ''}
                    onValueChange={setSelectedVersionId}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select version" />
                    </SelectTrigger>
                    <SelectContent>
                      {iterationLog.versions.map(v => (
                        <SelectItem key={v.id} value={v.id}>
                          v{v.versionNumber} - {v.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Compare With</Label>
                  <Select
                    value={compareVersionId || ''}
                    onValueChange={setCompareVersionId}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select version" />
                    </SelectTrigger>
                    <SelectContent>
                      {iterationLog.versions
                        .filter(v => v.id !== selectedVersionId)
                        .map(v => (
                          <SelectItem key={v.id} value={v.id}>
                            v{v.versionNumber} - {v.name}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {selectedVersion && compareVersion ? (
                <VersionComparison
                  version1={selectedVersion}
                  version2={compareVersion}
                />
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  <GitCompare className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Select two versions to compare</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Export Tab */}
        <TabsContent value="export" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Export Iteration Log</CardTitle>
              <CardDescription>
                Download the complete iteration history and audit trail
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Summary */}
              <div className="grid grid-cols-2 gap-4">
                <Card className="p-4">
                  <h4 className="font-medium mb-2">Log Summary</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Total Versions</span>
                      <span>{iterationLog.versions.length}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Current Version</span>
                      <span>v{currentVersion?.versionNumber}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Total Cost</span>
                      <span className="font-mono">${iterationLog.totalCost.toFixed(4)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Last Updated</span>
                      <span>{iterationLog.updatedAt.toLocaleDateString()}</span>
                    </div>
                  </div>
                </Card>
                <Card className="p-4">
                  <h4 className="font-medium mb-2">Resolution Status</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Total Feedback</span>
                      <span>{stats.totalFeedback}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Addressed</span>
                      <span className="text-green-600">{stats.addressedFeedback}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Pending</span>
                      <span className="text-orange-600">
                        {stats.totalFeedback - stats.addressedFeedback}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Completion</span>
                      <span>{stats.addressedPercent}%</span>
                    </div>
                  </div>
                </Card>
              </div>

              <Separator />

              {/* Export Options */}
              <div className="space-y-4">
                <h4 className="font-medium">Export Format</h4>
                <div className="grid grid-cols-3 gap-4">
                  <Button
                    variant="outline"
                    className="h-auto py-4"
                    onClick={() => onExportLog?.('json')}
                  >
                    <div className="flex flex-col items-center gap-2">
                      <FileJson className="h-8 w-8" />
                      <span>JSON</span>
                      <span className="text-xs text-muted-foreground">iteration_log.json</span>
                    </div>
                  </Button>
                  <Button
                    variant="outline"
                    className="h-auto py-4"
                    onClick={() => onExportLog?.('md')}
                  >
                    <div className="flex flex-col items-center gap-2">
                      <FileText className="h-8 w-8" />
                      <span>Markdown</span>
                      <span className="text-xs text-muted-foreground">iteration_log.md</span>
                    </div>
                  </Button>
                  <Button
                    variant="outline"
                    className="h-auto py-4"
                    onClick={() => onExportLog?.('pdf')}
                  >
                    <div className="flex flex-col items-center gap-2">
                      <Download className="h-8 w-8" />
                      <span>PDF</span>
                      <span className="text-xs text-muted-foreground">iteration_log.pdf</span>
                    </div>
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Create New Version Dialog */}
      <Dialog open={isCreatingVersion} onOpenChange={setIsCreatingVersion}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Create New Iteration</DialogTitle>
            <DialogDescription>
              Start a new iteration to refine your analysis based on validation feedback
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            <div className="space-y-2">
              <Label>Iteration Name</Label>
              <Input
                value={newVersionData.name}
                onChange={e => setNewVersionData(prev => ({ ...prev, name: e.target.value }))}
                placeholder={`Iteration ${iterationLog.versions.length + 1}`}
              />
            </div>

            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                value={newVersionData.description}
                onChange={e => setNewVersionData(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Describe the changes planned for this iteration..."
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label>Model Tier</Label>
              <ModelTierCards
                value={modelTier}
                onChange={onModelTierChange}
                showCosts
              />
            </div>

            {validationFeedback.filter(f => !f.isAddressed).length > 0 && (
              <div className="space-y-2">
                <Label>Select Feedback to Address ({newVersionData.selectedFeedback.length} selected)</Label>
                <ScrollArea className="h-[150px] border rounded-md p-2">
                  <div className="space-y-2">
                    {validationFeedback
                      .filter(f => !f.isAddressed)
                      .map(feedback => (
                        <div
                          key={feedback.id}
                          className={cn(
                            'flex items-center gap-3 p-2 rounded cursor-pointer hover:bg-muted',
                            newVersionData.selectedFeedback.includes(feedback.id) && 'bg-primary/10'
                          )}
                          onClick={() => toggleFeedbackSelection(feedback.id)}
                        >
                          <Checkbox
                            checked={newVersionData.selectedFeedback.includes(feedback.id)}
                          />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{feedback.title}</p>
                            <Badge className={cn('text-xs', SEVERITY_CONFIG[feedback.severity].color)}>
                              {feedback.severity}
                            </Badge>
                          </div>
                        </div>
                      ))}
                  </div>
                </ScrollArea>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreatingVersion(false)}>
              Cancel
            </Button>
            <Button onClick={createNewVersion}>
              <Plus className="mr-2 h-4 w-4" />
              Create Iteration
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Revert Confirmation Dialog */}
      <Dialog open={revertDialogOpen} onOpenChange={setRevertDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Revert to Previous Version</DialogTitle>
            <DialogDescription>
              Are you sure you want to revert to this version? The current version will be marked as reverted.
            </DialogDescription>
          </DialogHeader>

          {versionToRevert && (
            <div className="py-4">
              <Card className="p-4">
                <div className="flex items-center gap-3">
                  <RotateCcw className="h-8 w-8 text-yellow-600" />
                  <div>
                    <p className="font-medium">
                      {iterationLog.versions.find(v => v.id === versionToRevert)?.name}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Version {iterationLog.versions.find(v => v.id === versionToRevert)?.versionNumber}
                    </p>
                  </div>
                </div>
              </Card>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setRevertDialogOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleRevert}>
              <RotateCcw className="mr-2 h-4 w-4" />
              Revert
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ==================== Sub-Components ====================

// Stat Card
function StatCard({
  label,
  value,
  subValue,
  icon: Icon,
}: {
  label: string;
  value: string | number;
  subValue?: string;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div className="p-4 rounded-lg bg-muted/50">
      <div className="flex items-center gap-2 mb-2">
        <Icon className="h-4 w-4 text-muted-foreground" />
        <span className="text-xs text-muted-foreground">{label}</span>
      </div>
      <p className="text-xl font-bold">{value}</p>
      {subValue && <p className="text-xs text-muted-foreground">{subValue}</p>}
    </div>
  );
}

// Metric Card
function MetricCard({
  label,
  value,
  max,
}: {
  label: string;
  value: number;
  max: number;
}) {
  const percent = Math.round((value / max) * 100);

  return (
    <div className="p-3 border rounded-lg">
      <p className="text-xs text-muted-foreground mb-1">{label}</p>
      <div className="flex items-center gap-2">
        <Progress value={percent} className="h-2 flex-1" />
        <span className="text-sm font-mono font-medium">{value}%</span>
      </div>
    </div>
  );
}

// Version List Item
function VersionListItem({
  version,
  isSelected,
  isCurrent,
  onSelect,
  onRun,
  onRevert,
  canRevert,
}: {
  version: IterationVersion;
  isSelected: boolean;
  isCurrent: boolean;
  onSelect: () => void;
  onRun: () => void;
  onRevert: () => void;
  canRevert: boolean;
}) {
  const statusConfig = STATUS_CONFIG[version.status];
  const StatusIcon = statusConfig.icon;
  const TierIcon = MODEL_TIER_CONFIG[version.modelTier].icon;

  return (
    <div
      className={cn(
        'p-3 rounded-lg cursor-pointer transition-colors border',
        isSelected ? 'bg-primary/10 border-primary' : 'hover:bg-muted border-transparent'
      )}
      onClick={onSelect}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-xs">v{version.versionNumber}</Badge>
          {isCurrent && <Badge variant="default" className="text-xs">Current</Badge>}
        </div>
        <Badge className={cn('text-xs', statusConfig.color)}>
          <StatusIcon className="h-3 w-3 mr-1" />
          {statusConfig.label}
        </Badge>
      </div>
      <p className="font-medium text-sm truncate">{version.name}</p>
      <div className="flex items-center justify-between mt-2 text-xs text-muted-foreground">
        <div className="flex items-center gap-1">
          <TierIcon className={cn('h-3 w-3', MODEL_TIER_CONFIG[version.modelTier].color)} />
          <span>{MODEL_TIER_CONFIG[version.modelTier].label}</span>
        </div>
        <span>${version.cost.totalCost.toFixed(4)}</span>
      </div>
      {version.status === 'draft' && (
        <Button size="sm" className="w-full mt-2" onClick={(e) => { e.stopPropagation(); onRun(); }}>
          <Play className="h-3 w-3 mr-1" />
          Run
        </Button>
      )}
      {canRevert && (
        <Button
          size="sm"
          variant="outline"
          className="w-full mt-2"
          onClick={(e) => { e.stopPropagation(); onRevert(); }}
        >
          <RotateCcw className="h-3 w-3 mr-1" />
          Revert
        </Button>
      )}
    </div>
  );
}

// Change Card
function ChangeCard({ change }: { change: IterationChange }) {
  const typeConfig = REFINEMENT_TYPE_CONFIG[change.category];
  const TypeIcon = typeConfig.icon;

  const changeTypeLabels: Record<ChangeType, string> = {
    addition: 'Added',
    modification: 'Modified',
    removal: 'Removed',
    refinement: 'Refined',
  };

  const changeTypeColors: Record<ChangeType, string> = {
    addition: 'text-green-600',
    modification: 'text-blue-600',
    removal: 'text-red-600',
    refinement: 'text-purple-600',
  };

  return (
    <div className="p-3 border rounded-lg">
      <div className="flex items-center gap-2 mb-2">
        <div className={cn('p-1 rounded', typeConfig.color)}>
          <TypeIcon className="h-3 w-3" />
        </div>
        <span className="text-xs font-medium">{typeConfig.label}</span>
        <Badge variant="outline" className={cn('text-xs ml-auto', changeTypeColors[change.type])}>
          {changeTypeLabels[change.type]}
        </Badge>
      </div>
      <p className="text-sm">{change.description}</p>
      {change.affectedArtifacts.length > 0 && (
        <p className="text-xs text-muted-foreground mt-1">
          Affects: {change.affectedArtifacts.join(', ')}
        </p>
      )}
    </div>
  );
}

// Feedback Card
function FeedbackCard({
  feedback,
  isSelected,
  onToggleSelect,
  iterationVersion,
}: {
  feedback: ValidationFeedback;
  isSelected: boolean;
  onToggleSelect: () => void;
  iterationVersion?: IterationVersion;
}) {
  const severityConfig = SEVERITY_CONFIG[feedback.severity];
  const SeverityIcon = severityConfig.icon;

  return (
    <Card className={cn(
      'transition-colors',
      feedback.isAddressed && 'opacity-60',
      isSelected && 'border-primary bg-primary/5'
    )}>
      <CardContent className="py-3">
        <div className="flex items-start gap-3">
          {!feedback.isAddressed && (
            <Checkbox
              checked={isSelected}
              onCheckedChange={onToggleSelect}
              className="mt-1"
            />
          )}
          <div className={cn('p-1.5 rounded', severityConfig.color)}>
            <SeverityIcon className="h-4 w-4" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="font-medium text-sm">{feedback.title}</span>
              <Badge className={cn('text-xs', severityConfig.color)}>
                {severityConfig.label}
              </Badge>
              {feedback.isAddressed && (
                <Badge variant="outline" className="text-xs text-green-600">
                  <CheckCircle className="h-3 w-3 mr-1" />
                  Addressed
                </Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground">{feedback.description}</p>
            <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
              <span>Stage {feedback.sourceStage}</span>
              <span>-</span>
              <span>{feedback.category}</span>
              {iterationVersion && (
                <>
                  <span>-</span>
                  <span>Addressed in v{iterationVersion.versionNumber}</span>
                </>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// Suggestion Card
function SuggestionCard({
  suggestion,
  isSelected,
  onToggleSelect,
  onAccept,
  onDismiss,
}: {
  suggestion: RefinementSuggestion;
  isSelected: boolean;
  onToggleSelect: () => void;
  onAccept: () => void;
  onDismiss: () => void;
}) {
  const typeConfig = REFINEMENT_TYPE_CONFIG[suggestion.type];
  const TypeIcon = typeConfig.icon;

  const impactColors = {
    high: 'text-red-600',
    medium: 'text-yellow-600',
    low: 'text-green-600',
  };

  return (
    <div className={cn(
      'p-3 rounded-lg bg-background border',
      isSelected && 'border-primary bg-primary/5'
    )}>
      <div className="flex items-start gap-3">
        <Checkbox
          checked={isSelected}
          onCheckedChange={onToggleSelect}
          className="mt-1"
        />
        <div className={cn('p-1.5 rounded', typeConfig.color)}>
          <TypeIcon className="h-4 w-4" />
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-medium text-sm">{suggestion.title}</span>
            <Badge variant="outline" className="text-xs">
              {typeConfig.label}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">{suggestion.description}</p>
          <div className="flex items-center gap-4 mt-2 text-xs">
            <span>
              Impact: <span className={impactColors[suggestion.estimatedImpact]}>
                {suggestion.estimatedImpact}
              </span>
            </span>
            <span>
              Effort: <span className="text-muted-foreground">{suggestion.estimatedEffort}</span>
            </span>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onAccept}>
                  <Check className="h-4 w-4 text-green-600" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Accept suggestion</TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onDismiss}>
                  <X className="h-4 w-4 text-muted-foreground" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Dismiss suggestion</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>
    </div>
  );
}

// Version Comparison
function VersionComparison({
  version1,
  version2,
}: {
  version1: IterationVersion;
  version2: IterationVersion;
}) {
  const [older, newer] = version1.versionNumber < version2.versionNumber
    ? [version1, version2]
    : [version2, version1];

  return (
    <div className="space-y-6">
      {/* Version Headers */}
      <div className="grid grid-cols-2 gap-4">
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-2">
            <Badge variant="outline">v{older.versionNumber}</Badge>
            <Badge className={cn('text-xs', STATUS_CONFIG[older.status].color)}>
              {older.status}
            </Badge>
          </div>
          <p className="font-medium">{older.name}</p>
          <p className="text-sm text-muted-foreground">{older.createdAt.toLocaleDateString()}</p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-2">
            <Badge variant="outline">v{newer.versionNumber}</Badge>
            <Badge className={cn('text-xs', STATUS_CONFIG[newer.status].color)}>
              {newer.status}
            </Badge>
          </div>
          <p className="font-medium">{newer.name}</p>
          <p className="text-sm text-muted-foreground">{newer.createdAt.toLocaleDateString()}</p>
        </Card>
      </div>

      {/* Metrics Comparison */}
      <div>
        <h4 className="font-medium mb-3">Metrics Comparison</h4>
        <div className="grid grid-cols-3 gap-4">
          <ComparisonMetric
            label="Quality Score"
            value1={older.metrics.qualityScore}
            value2={newer.metrics.qualityScore}
          />
          <ComparisonMetric
            label="Confidence"
            value1={older.metrics.confidenceLevel}
            value2={newer.metrics.confidenceLevel}
          />
          <ComparisonMetric
            label="Completeness"
            value1={older.metrics.completeness}
            value2={newer.metrics.completeness}
          />
        </div>
      </div>

      {/* Cost Comparison */}
      <div>
        <h4 className="font-medium mb-3">Cost Comparison</h4>
        <div className="grid grid-cols-2 gap-4">
          <Card className="p-4">
            <p className="text-sm text-muted-foreground">v{older.versionNumber} Cost</p>
            <p className="text-xl font-mono font-bold">${older.cost.totalCost.toFixed(4)}</p>
          </Card>
          <Card className="p-4">
            <p className="text-sm text-muted-foreground">v{newer.versionNumber} Cost</p>
            <p className="text-xl font-mono font-bold">${newer.cost.totalCost.toFixed(4)}</p>
          </Card>
        </div>
      </div>

      {/* Changes in Newer Version */}
      <div>
        <h4 className="font-medium mb-3">
          Changes in v{newer.versionNumber} ({newer.changes.length})
        </h4>
        {newer.changes.length > 0 ? (
          <ScrollArea className="h-[200px]">
            <div className="space-y-2">
              {newer.changes.map(change => (
                <ChangeCard key={change.id} change={change} />
              ))}
            </div>
          </ScrollArea>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            <p>No changes recorded</p>
          </div>
        )}
      </div>
    </div>
  );
}

// Comparison Metric
function ComparisonMetric({
  label,
  value1,
  value2,
}: {
  label: string;
  value1?: number;
  value2?: number;
}) {
  const diff = value1 !== undefined && value2 !== undefined ? value2 - value1 : undefined;
  const isImproved = diff !== undefined && diff > 0;
  const isDegraded = diff !== undefined && diff < 0;

  return (
    <Card className="p-3">
      <p className="text-xs text-muted-foreground mb-2">{label}</p>
      <div className="flex items-center justify-between">
        <span className="text-sm font-mono">{value1 ?? '-'}%</span>
        <ArrowRight className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-mono">{value2 ?? '-'}%</span>
      </div>
      {diff !== undefined && (
        <div className={cn(
          'text-xs text-center mt-1',
          isImproved && 'text-green-600',
          isDegraded && 'text-red-600',
          !isImproved && !isDegraded && 'text-muted-foreground'
        )}>
          {diff > 0 ? '+' : ''}{diff}%
        </div>
      )}
    </Card>
  );
}

export default Stage11Iteration;
