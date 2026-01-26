/**
 * Stage 06 - Analysis
 * Run computational analysis with progress tracking
 * Features: Analysis job configuration, real-time progress, resource monitoring, results preview
 */

import * as React from 'react';
import { useState, useCallback, useEffect, useRef } from 'react';
import {
  LineChart,
  Play,
  Pause,
  Square,
  RefreshCcw,
  Settings,
  Clock,
  Cpu,
  HardDrive,
  Activity,
  FileText,
  Download,
  ChevronDown,
  ChevronRight,
  Check,
  X,
  AlertTriangle,
  Terminal,
  BarChart3,
  Trash2,
  Copy,
  ExternalLink,
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
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import { ModelTierSelect, type ModelTier } from '@/components/ai';

// Analysis Job Types
export type AnalysisJobStatus =
  | 'pending'
  | 'queued'
  | 'running'
  | 'paused'
  | 'completed'
  | 'failed'
  | 'cancelled';

export type AnalysisType =
  | 'statistical'
  | 'machine_learning'
  | 'clustering'
  | 'regression'
  | 'classification'
  | 'time_series'
  | 'custom';

export interface LogEntry {
  id: string;
  timestamp: Date;
  level: 'info' | 'warn' | 'error' | 'debug';
  message: string;
  metadata?: Record<string, unknown>;
}

export interface ResourceUsage {
  cpuPercent: number;
  memoryUsedMB: number;
  memoryTotalMB: number;
  diskReadMB: number;
  diskWriteMB: number;
  gpuPercent?: number;
  gpuMemoryMB?: number;
}

export interface AnalysisMetric {
  name: string;
  value: number | string;
  unit?: string;
  description?: string;
  isHighlighted?: boolean;
}

export interface AnalysisResult {
  id: string;
  name: string;
  type: 'table' | 'chart' | 'summary' | 'file';
  data: unknown;
  createdAt: Date;
}

export interface AnalysisJobConfig {
  name: string;
  type: AnalysisType;
  inputDatasetId?: string;
  parameters: Record<string, unknown>;
  modelTier: ModelTier;
  maxDurationMinutes: number;
  notifyOnComplete: boolean;
}

export interface AnalysisJob {
  id: string;
  config: AnalysisJobConfig;
  status: AnalysisJobStatus;
  progress: number;
  currentStep?: string;
  startedAt?: Date;
  completedAt?: Date;
  estimatedTimeRemaining?: number;
  logs: LogEntry[];
  resourceUsage?: ResourceUsage;
  metrics: AnalysisMetric[];
  results: AnalysisResult[];
  error?: string;
}

interface Stage06Props {
  jobs: AnalysisJob[];
  onJobsChange: (jobs: AnalysisJob[]) => void;
  onCreateJob?: (config: AnalysisJobConfig) => Promise<AnalysisJob>;
  onStartJob?: (jobId: string) => Promise<void>;
  onPauseJob?: (jobId: string) => Promise<void>;
  onResumeJob?: (jobId: string) => Promise<void>;
  onCancelJob?: (jobId: string) => Promise<void>;
  onExportResults?: (jobId: string, format: 'json' | 'csv' | 'xlsx') => Promise<void>;
  availableDatasets?: { id: string; name: string }[];
  className?: string;
}

const DEFAULT_CONFIG: AnalysisJobConfig = {
  name: '',
  type: 'statistical',
  parameters: {},
  modelTier: 'standard',
  maxDurationMinutes: 60,
  notifyOnComplete: true,
};

export function Stage06Analysis({
  jobs,
  onJobsChange,
  onCreateJob,
  onStartJob,
  onPauseJob,
  onResumeJob,
  onCancelJob,
  onExportResults,
  availableDatasets = [],
  className,
}: Stage06Props) {
  const [selectedTab, setSelectedTab] = useState('configure');
  const [selectedJobId, setSelectedJobId] = useState<string | null>(
    jobs.find(j => j.status === 'running')?.id || jobs[0]?.id || null
  );
  const [config, setConfig] = useState<AnalysisJobConfig>(DEFAULT_CONFIG);
  const [isCreating, setIsCreating] = useState(false);
  const [logFilter, setLogFilter] = useState<'all' | 'info' | 'warn' | 'error'>('all');

  const selectedJob = jobs.find(j => j.id === selectedJobId);

  // Auto-select running job when jobs change
  useEffect(() => {
    const runningJob = jobs.find(j => j.status === 'running');
    if (runningJob && selectedJobId !== runningJob.id) {
      setSelectedJobId(runningJob.id);
      setSelectedTab('monitor');
    }
  }, [jobs, selectedJobId]);

  // Create new job
  const handleCreateJob = useCallback(async () => {
    if (!onCreateJob || !config.name.trim()) return;

    setIsCreating(true);
    try {
      const newJob = await onCreateJob(config);
      onJobsChange([...jobs, newJob]);
      setSelectedJobId(newJob.id);
      setSelectedTab('monitor');
      setConfig(DEFAULT_CONFIG);
    } finally {
      setIsCreating(false);
    }
  }, [onCreateJob, config, jobs, onJobsChange]);

  // Start job
  const handleStartJob = useCallback(async (jobId: string) => {
    if (!onStartJob) return;
    await onStartJob(jobId);
    setSelectedTab('monitor');
  }, [onStartJob]);

  // Pause job
  const handlePauseJob = useCallback(async (jobId: string) => {
    if (!onPauseJob) return;
    await onPauseJob(jobId);
  }, [onPauseJob]);

  // Resume job
  const handleResumeJob = useCallback(async (jobId: string) => {
    if (!onResumeJob) return;
    await onResumeJob(jobId);
  }, [onResumeJob]);

  // Cancel job
  const handleCancelJob = useCallback(async (jobId: string) => {
    if (!onCancelJob) return;
    await onCancelJob(jobId);
  }, [onCancelJob]);

  // Delete job from list
  const handleDeleteJob = useCallback((jobId: string) => {
    onJobsChange(jobs.filter(j => j.id !== jobId));
    if (selectedJobId === jobId) {
      setSelectedJobId(jobs.find(j => j.id !== jobId)?.id || null);
    }
  }, [jobs, onJobsChange, selectedJobId]);

  // Export results
  const handleExport = useCallback(async (jobId: string, format: 'json' | 'csv' | 'xlsx') => {
    if (!onExportResults) return;
    await onExportResults(jobId, format);
  }, [onExportResults]);

  // Update config
  const updateConfig = useCallback((updates: Partial<AnalysisJobConfig>) => {
    setConfig(prev => ({ ...prev, ...updates }));
  }, []);

  const runningJobs = jobs.filter(j => j.status === 'running');
  const completedJobs = jobs.filter(j => j.status === 'completed');
  const pendingJobs = jobs.filter(j => j.status === 'pending' || j.status === 'queued');

  return (
    <div className={cn('space-y-6', className)}>
      <Tabs value={selectedTab} onValueChange={setSelectedTab}>
        <TabsList>
          <TabsTrigger value="configure">
            <Settings className="mr-2 h-4 w-4" />
            Configure
          </TabsTrigger>
          <TabsTrigger value="monitor">
            <Activity className="mr-2 h-4 w-4" />
            Monitor
            {runningJobs.length > 0 && (
              <Badge variant="secondary" className="ml-2">
                {runningJobs.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="results">
            <BarChart3 className="mr-2 h-4 w-4" />
            Results ({completedJobs.length})
          </TabsTrigger>
          <TabsTrigger value="history">
            <Clock className="mr-2 h-4 w-4" />
            History ({jobs.length})
          </TabsTrigger>
        </TabsList>

        {/* Configure Tab */}
        <TabsContent value="configure" className="mt-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Job Configuration Panel */}
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <LineChart className="h-5 w-5" />
                  Analysis Job Configuration
                </CardTitle>
                <CardDescription>
                  Configure and launch computational analysis jobs
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Basic Configuration */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="job-name">Job Name</Label>
                    <Input
                      id="job-name"
                      placeholder="Enter analysis job name..."
                      value={config.name}
                      onChange={(e) => updateConfig({ name: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="job-type">Analysis Type</Label>
                    <Select
                      value={config.type}
                      onValueChange={(v) => updateConfig({ type: v as AnalysisType })}
                    >
                      <SelectTrigger id="job-type">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="statistical">Statistical Analysis</SelectItem>
                        <SelectItem value="machine_learning">Machine Learning</SelectItem>
                        <SelectItem value="clustering">Clustering</SelectItem>
                        <SelectItem value="regression">Regression</SelectItem>
                        <SelectItem value="classification">Classification</SelectItem>
                        <SelectItem value="time_series">Time Series</SelectItem>
                        <SelectItem value="custom">Custom Script</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Dataset Selection */}
                {availableDatasets.length > 0 && (
                  <div className="space-y-2">
                    <Label htmlFor="dataset">Input Dataset</Label>
                    <Select
                      value={config.inputDatasetId || ''}
                      onValueChange={(v) => updateConfig({ inputDatasetId: v })}
                    >
                      <SelectTrigger id="dataset">
                        <SelectValue placeholder="Select dataset..." />
                      </SelectTrigger>
                      <SelectContent>
                        {availableDatasets.map((ds) => (
                          <SelectItem key={ds.id} value={ds.id}>
                            {ds.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                <Separator />

                {/* Model and Resource Configuration */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>AI Model Tier</Label>
                    <ModelTierSelect
                      value={config.modelTier}
                      onChange={(tier) => updateConfig({ modelTier: tier })}
                    />
                    <p className="text-xs text-muted-foreground">
                      NANO tier recommended for computational analysis
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="max-duration">Max Duration (minutes)</Label>
                    <Input
                      id="max-duration"
                      type="number"
                      min={1}
                      max={480}
                      value={config.maxDurationMinutes}
                      onChange={(e) => updateConfig({ maxDurationMinutes: Number(e.target.value) })}
                    />
                  </div>
                </div>

                {/* Type-specific Parameters */}
                <AnalysisParameters
                  type={config.type}
                  parameters={config.parameters}
                  onParametersChange={(params) => updateConfig({ parameters: params })}
                />
              </CardContent>
              <CardFooter className="flex justify-between">
                <Button
                  variant="outline"
                  onClick={() => setConfig(DEFAULT_CONFIG)}
                >
                  Reset
                </Button>
                <Button
                  onClick={handleCreateJob}
                  disabled={isCreating || !config.name.trim()}
                >
                  {isCreating ? (
                    <>
                      <RefreshCcw className="mr-2 h-4 w-4 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    <>
                      <Play className="mr-2 h-4 w-4" />
                      Create & Run Analysis
                    </>
                  )}
                </Button>
              </CardFooter>
            </Card>

            {/* Quick Actions / Templates */}
            <div className="space-y-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Quick Templates</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <Button
                    variant="outline"
                    className="w-full justify-start"
                    onClick={() => updateConfig({
                      name: 'Descriptive Statistics',
                      type: 'statistical',
                      parameters: { method: 'descriptive' },
                    })}
                  >
                    <BarChart3 className="mr-2 h-4 w-4" />
                    Descriptive Statistics
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full justify-start"
                    onClick={() => updateConfig({
                      name: 'Correlation Analysis',
                      type: 'statistical',
                      parameters: { method: 'correlation' },
                    })}
                  >
                    <LineChart className="mr-2 h-4 w-4" />
                    Correlation Analysis
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full justify-start"
                    onClick={() => updateConfig({
                      name: 'Clustering Analysis',
                      type: 'clustering',
                      parameters: { algorithm: 'kmeans', k: 3 },
                    })}
                  >
                    <Activity className="mr-2 h-4 w-4" />
                    K-Means Clustering
                  </Button>
                </CardContent>
              </Card>

              {pendingJobs.length > 0 && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">Queued Jobs</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {pendingJobs.slice(0, 3).map((job) => (
                        <div
                          key={job.id}
                          className="flex items-center justify-between text-sm"
                        >
                          <span className="truncate">{job.config.name}</span>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleStartJob(job.id)}
                          >
                            <Play className="h-3 w-3" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </TabsContent>

        {/* Monitor Tab */}
        <TabsContent value="monitor" className="mt-4">
          {selectedJob && (selectedJob.status === 'running' || selectedJob.status === 'paused') ? (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Main Progress Panel */}
              <Card className="lg:col-span-2">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        {selectedJob.config.name}
                        <JobStatusBadge status={selectedJob.status} />
                      </CardTitle>
                      <CardDescription>
                        {selectedJob.currentStep || 'Initializing...'}
                      </CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                      {selectedJob.status === 'running' ? (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handlePauseJob(selectedJob.id)}
                        >
                          <Pause className="mr-1 h-4 w-4" />
                          Pause
                        </Button>
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleResumeJob(selectedJob.id)}
                        >
                          <Play className="mr-1 h-4 w-4" />
                          Resume
                        </Button>
                      )}
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => handleCancelJob(selectedJob.id)}
                      >
                        <Square className="mr-1 h-4 w-4" />
                        Cancel
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Progress Bar */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span>Progress</span>
                      <span className="font-mono">{selectedJob.progress}%</span>
                    </div>
                    <Progress value={selectedJob.progress} className="h-3" />
                    {selectedJob.estimatedTimeRemaining && (
                      <p className="text-xs text-muted-foreground">
                        Estimated time remaining: {formatDuration(selectedJob.estimatedTimeRemaining)}
                      </p>
                    )}
                  </div>

                  <Separator />

                  {/* Live Logs */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="flex items-center gap-2">
                        <Terminal className="h-4 w-4" />
                        Live Logs
                      </Label>
                      <Select
                        value={logFilter}
                        onValueChange={(v) => setLogFilter(v as typeof logFilter)}
                      >
                        <SelectTrigger className="w-24 h-8">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All</SelectItem>
                          <SelectItem value="info">Info</SelectItem>
                          <SelectItem value="warn">Warnings</SelectItem>
                          <SelectItem value="error">Errors</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <LogViewer
                      logs={selectedJob.logs}
                      filter={logFilter}
                      autoScroll
                    />
                  </div>

                  {/* Live Metrics */}
                  {selectedJob.metrics.length > 0 && (
                    <>
                      <Separator />
                      <div className="space-y-2">
                        <Label>Live Metrics</Label>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                          {selectedJob.metrics.slice(0, 8).map((metric) => (
                            <MetricCard key={metric.name} metric={metric} />
                          ))}
                        </div>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>

              {/* Resource Usage Panel */}
              <div className="space-y-4">
                <ResourceMonitor usage={selectedJob.resourceUsage} />

                {/* Running Time */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Clock className="h-4 w-4" />
                      Running Time
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <RunningTimer startedAt={selectedJob.startedAt} />
                  </CardContent>
                </Card>

                {/* Job Info */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">Job Info</CardTitle>
                  </CardHeader>
                  <CardContent className="text-sm space-y-2">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Type</span>
                      <span>{selectedJob.config.type}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Model Tier</span>
                      <span>{selectedJob.config.modelTier}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Max Duration</span>
                      <span>{selectedJob.config.maxDurationMinutes}m</span>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          ) : (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Activity className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground text-center">
                  No analysis jobs currently running
                </p>
                <Button
                  variant="outline"
                  className="mt-4"
                  onClick={() => setSelectedTab('configure')}
                >
                  Configure New Analysis
                </Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Results Tab */}
        <TabsContent value="results" className="mt-4">
          {completedJobs.length > 0 ? (
            <div className="space-y-4">
              {completedJobs.map((job) => (
                <ResultsCard
                  key={job.id}
                  job={job}
                  onExport={(format) => handleExport(job.id, format)}
                />
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <BarChart3 className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground text-center">
                  No completed analysis results yet
                </p>
                <p className="text-sm text-muted-foreground">
                  Run an analysis job to see results here
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* History Tab */}
        <TabsContent value="history" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Job History</CardTitle>
              <CardDescription>
                All analysis jobs in this research project
              </CardDescription>
            </CardHeader>
            <CardContent>
              {jobs.length > 0 ? (
                <ScrollArea className="h-[500px]">
                  <div className="space-y-2">
                    {jobs.map((job) => (
                      <JobHistoryItem
                        key={job.id}
                        job={job}
                        isSelected={selectedJobId === job.id}
                        onSelect={() => {
                          setSelectedJobId(job.id);
                          if (job.status === 'running' || job.status === 'paused') {
                            setSelectedTab('monitor');
                          } else if (job.status === 'completed') {
                            setSelectedTab('results');
                          }
                        }}
                        onDelete={() => handleDeleteJob(job.id)}
                        onStart={() => handleStartJob(job.id)}
                      />
                    ))}
                  </div>
                </ScrollArea>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Clock className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No analysis jobs yet</p>
                  <p className="text-sm">Configure and run your first analysis</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

// Analysis Parameters Component
interface AnalysisParametersProps {
  type: AnalysisType;
  parameters: Record<string, unknown>;
  onParametersChange: (params: Record<string, unknown>) => void;
}

function AnalysisParameters({
  type,
  parameters,
  onParametersChange,
}: AnalysisParametersProps) {
  const updateParam = (key: string, value: unknown) => {
    onParametersChange({ ...parameters, [key]: value });
  };

  switch (type) {
    case 'statistical':
      return (
        <div className="space-y-4">
          <Label>Statistical Method</Label>
          <Select
            value={(parameters.method as string) || 'descriptive'}
            onValueChange={(v) => updateParam('method', v)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="descriptive">Descriptive Statistics</SelectItem>
              <SelectItem value="inferential">Inferential Statistics</SelectItem>
              <SelectItem value="correlation">Correlation Analysis</SelectItem>
              <SelectItem value="anova">ANOVA</SelectItem>
              <SelectItem value="t_test">T-Test</SelectItem>
            </SelectContent>
          </Select>
        </div>
      );

    case 'clustering':
      return (
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Algorithm</Label>
            <Select
              value={(parameters.algorithm as string) || 'kmeans'}
              onValueChange={(v) => updateParam('algorithm', v)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="kmeans">K-Means</SelectItem>
                <SelectItem value="hierarchical">Hierarchical</SelectItem>
                <SelectItem value="dbscan">DBSCAN</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Number of Clusters (k)</Label>
            <Input
              type="number"
              min={2}
              max={20}
              value={(parameters.k as number) || 3}
              onChange={(e) => updateParam('k', Number(e.target.value))}
            />
          </div>
        </div>
      );

    case 'regression':
      return (
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Regression Type</Label>
            <Select
              value={(parameters.regressionType as string) || 'linear'}
              onValueChange={(v) => updateParam('regressionType', v)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="linear">Linear</SelectItem>
                <SelectItem value="logistic">Logistic</SelectItem>
                <SelectItem value="polynomial">Polynomial</SelectItem>
                <SelectItem value="ridge">Ridge</SelectItem>
                <SelectItem value="lasso">Lasso</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      );

    case 'machine_learning':
      return (
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Model</Label>
            <Select
              value={(parameters.model as string) || 'random_forest'}
              onValueChange={(v) => updateParam('model', v)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="random_forest">Random Forest</SelectItem>
                <SelectItem value="gradient_boost">Gradient Boosting</SelectItem>
                <SelectItem value="svm">SVM</SelectItem>
                <SelectItem value="neural_network">Neural Network</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Cross Validation Folds</Label>
            <Input
              type="number"
              min={2}
              max={10}
              value={(parameters.cvFolds as number) || 5}
              onChange={(e) => updateParam('cvFolds', Number(e.target.value))}
            />
          </div>
        </div>
      );

    case 'custom':
      return (
        <div className="space-y-2">
          <Label>Custom Script</Label>
          <Textarea
            placeholder="Enter your custom analysis script..."
            value={(parameters.script as string) || ''}
            onChange={(e) => updateParam('script', e.target.value)}
            rows={6}
            className="font-mono text-sm"
          />
        </div>
      );

    default:
      return null;
  }
}

// Job Status Badge
function JobStatusBadge({ status }: { status: AnalysisJobStatus }) {
  const statusConfig: Record<AnalysisJobStatus, { color: string; icon: React.ReactNode }> = {
    pending: { color: 'bg-gray-100 text-gray-700', icon: <Clock className="h-3 w-3" /> },
    queued: { color: 'bg-blue-100 text-blue-700', icon: <Clock className="h-3 w-3" /> },
    running: { color: 'bg-green-100 text-green-700', icon: <Activity className="h-3 w-3 animate-pulse" /> },
    paused: { color: 'bg-yellow-100 text-yellow-700', icon: <Pause className="h-3 w-3" /> },
    completed: { color: 'bg-emerald-100 text-emerald-700', icon: <Check className="h-3 w-3" /> },
    failed: { color: 'bg-red-100 text-red-700', icon: <X className="h-3 w-3" /> },
    cancelled: { color: 'bg-gray-100 text-gray-700', icon: <Square className="h-3 w-3" /> },
  };

  const config = statusConfig[status];

  return (
    <Badge className={cn('gap-1', config.color)}>
      {config.icon}
      {status}
    </Badge>
  );
}

// Log Viewer Component
interface LogViewerProps {
  logs: LogEntry[];
  filter: 'all' | 'info' | 'warn' | 'error';
  autoScroll?: boolean;
}

function LogViewer({ logs, filter, autoScroll }: LogViewerProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  const filteredLogs = filter === 'all'
    ? logs
    : logs.filter(l => l.level === filter);

  useEffect(() => {
    if (autoScroll && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs, autoScroll]);

  const levelColors: Record<LogEntry['level'], string> = {
    info: 'text-blue-600',
    warn: 'text-yellow-600',
    error: 'text-red-600',
    debug: 'text-gray-500',
  };

  return (
    <ScrollArea
      ref={scrollRef}
      className="h-[200px] border rounded-md bg-slate-950 p-3"
    >
      <div className="font-mono text-xs space-y-1">
        {filteredLogs.map((log) => (
          <div key={log.id} className="flex gap-2">
            <span className="text-slate-500">
              {log.timestamp.toLocaleTimeString()}
            </span>
            <span className={cn('uppercase w-12', levelColors[log.level])}>
              [{log.level}]
            </span>
            <span className="text-slate-200 flex-1">{log.message}</span>
          </div>
        ))}
        {filteredLogs.length === 0 && (
          <span className="text-slate-500">No logs to display</span>
        )}
      </div>
    </ScrollArea>
  );
}

// Resource Monitor Component
function ResourceMonitor({ usage }: { usage?: ResourceUsage }) {
  if (!usage) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Resource Usage</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Waiting for resource data...
          </p>
        </CardContent>
      </Card>
    );
  }

  const memoryPercent = (usage.memoryUsedMB / usage.memoryTotalMB) * 100;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Resource Usage</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* CPU */}
        <div className="space-y-1">
          <div className="flex items-center justify-between text-sm">
            <span className="flex items-center gap-2">
              <Cpu className="h-4 w-4 text-muted-foreground" />
              CPU
            </span>
            <span className="font-mono">{usage.cpuPercent.toFixed(1)}%</span>
          </div>
          <Progress value={usage.cpuPercent} className="h-2" />
        </div>

        {/* Memory */}
        <div className="space-y-1">
          <div className="flex items-center justify-between text-sm">
            <span className="flex items-center gap-2">
              <HardDrive className="h-4 w-4 text-muted-foreground" />
              Memory
            </span>
            <span className="font-mono">
              {usage.memoryUsedMB.toFixed(0)} / {usage.memoryTotalMB} MB
            </span>
          </div>
          <Progress value={memoryPercent} className="h-2" />
        </div>

        {/* Disk I/O */}
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">Read:</span>
            <span className="font-mono">{usage.diskReadMB.toFixed(1)} MB</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">Write:</span>
            <span className="font-mono">{usage.diskWriteMB.toFixed(1)} MB</span>
          </div>
        </div>

        {/* GPU if available */}
        {usage.gpuPercent !== undefined && (
          <div className="space-y-1">
            <div className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-2">
                <Activity className="h-4 w-4 text-muted-foreground" />
                GPU
              </span>
              <span className="font-mono">{usage.gpuPercent.toFixed(1)}%</span>
            </div>
            <Progress value={usage.gpuPercent} className="h-2" />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Metric Card Component
function MetricCard({ metric }: { metric: AnalysisMetric }) {
  return (
    <div
      className={cn(
        'p-3 rounded-lg border',
        metric.isHighlighted && 'border-primary bg-primary/5'
      )}
    >
      <p className="text-xs text-muted-foreground truncate">{metric.name}</p>
      <p className="text-lg font-semibold font-mono">
        {typeof metric.value === 'number' ? metric.value.toFixed(4) : metric.value}
        {metric.unit && (
          <span className="text-xs text-muted-foreground ml-1">{metric.unit}</span>
        )}
      </p>
    </div>
  );
}

// Running Timer Component
function RunningTimer({ startedAt }: { startedAt?: Date }) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!startedAt) return;

    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startedAt.getTime()) / 1000));
    }, 1000);

    return () => clearInterval(interval);
  }, [startedAt]);

  if (!startedAt) return <span className="text-muted-foreground">Not started</span>;

  return (
    <span className="text-2xl font-mono">
      {formatDuration(elapsed)}
    </span>
  );
}

// Results Card Component
interface ResultsCardProps {
  job: AnalysisJob;
  onExport: (format: 'json' | 'csv' | 'xlsx') => void;
}

function ResultsCard({ job, onExport }: ResultsCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="sm">
                  {isExpanded ? (
                    <ChevronDown className="h-4 w-4" />
                  ) : (
                    <ChevronRight className="h-4 w-4" />
                  )}
                </Button>
              </CollapsibleTrigger>
              <div>
                <CardTitle className="text-base">{job.config.name}</CardTitle>
                <CardDescription>
                  Completed {job.completedAt?.toLocaleString()}
                </CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Select onValueChange={(v) => onExport(v as 'json' | 'csv' | 'xlsx')}>
                <SelectTrigger className="w-32">
                  <Download className="mr-2 h-4 w-4" />
                  Export
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="json">JSON</SelectItem>
                  <SelectItem value="csv">CSV</SelectItem>
                  <SelectItem value="xlsx">Excel</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CollapsibleContent>
          <CardContent className="pt-0">
            <Separator className="mb-4" />

            {/* Key Metrics */}
            <div className="mb-4">
              <Label className="mb-2 block">Key Metrics</Label>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {job.metrics.slice(0, 8).map((metric) => (
                  <MetricCard key={metric.name} metric={metric} />
                ))}
              </div>
            </div>

            {/* Results Preview */}
            {job.results.length > 0 && (
              <div>
                <Label className="mb-2 block">Results Files</Label>
                <div className="space-y-2">
                  {job.results.map((result) => (
                    <div
                      key={result.id}
                      className="flex items-center justify-between p-2 rounded border"
                    >
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm">{result.name}</span>
                        <Badge variant="secondary" className="text-xs">
                          {result.type}
                        </Badge>
                      </div>
                      <Button variant="ghost" size="sm">
                        <ExternalLink className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}

// Job History Item Component
interface JobHistoryItemProps {
  job: AnalysisJob;
  isSelected: boolean;
  onSelect: () => void;
  onDelete: () => void;
  onStart: () => void;
}

function JobHistoryItem({
  job,
  isSelected,
  onSelect,
  onDelete,
  onStart,
}: JobHistoryItemProps) {
  return (
    <div
      className={cn(
        'flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-colors',
        isSelected && 'border-primary bg-primary/5',
        !isSelected && 'hover:bg-muted/50'
      )}
      onClick={onSelect}
    >
      <div className="flex items-center gap-3">
        <LineChart className="h-5 w-5 text-muted-foreground" />
        <div>
          <p className="font-medium">{job.config.name}</p>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>{job.config.type}</span>
            <span>-</span>
            <span>
              {job.startedAt?.toLocaleString() || 'Not started'}
            </span>
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <JobStatusBadge status={job.status} />
        {job.status === 'pending' && (
          <Button
            size="sm"
            variant="ghost"
            onClick={(e) => {
              e.stopPropagation();
              onStart();
            }}
          >
            <Play className="h-4 w-4" />
          </Button>
        )}
        {(job.status === 'completed' || job.status === 'failed' || job.status === 'cancelled') && (
          <Button
            size="sm"
            variant="ghost"
            className="text-destructive"
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
}

// Utility function to format duration
function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
}

export default Stage06Analysis;
