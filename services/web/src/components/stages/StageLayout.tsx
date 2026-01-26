/**
 * Stage Layout Component
 * Provides consistent layout for all 20 workflow stages
 * Tasks 41-60 - Individual stage UI implementations
 */

import * as React from 'react';
import { ReactNode, useMemo } from 'react';
import { useLocation, Link } from 'wouter';
import {
  ArrowLeft,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Play,
  Pause,
  CheckCircle,
  AlertTriangle,
  Info,
  Settings,
  HelpCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { STAGES, type StageId, type StageDefinition } from '@/workflow/stages';
import { StageErrorBoundary } from '@/components/errors';

// Stage status types
export type StageStatus = 'not_started' | 'in_progress' | 'completed' | 'error' | 'blocked';

export interface StageState {
  status: StageStatus;
  progress?: number;
  lastRunAt?: Date;
  errorMessage?: string;
  artifacts?: Array<{ id: string; name: string; type: string }>;
}

// Stage layout props
interface StageLayoutProps {
  stageId: StageId;
  state?: StageState;
  children: ReactNode;
  inputPanel?: ReactNode;
  outputPanel?: ReactNode;
  settingsPanel?: ReactNode;
  onRun?: () => void;
  onCancel?: () => void;
  isRunning?: boolean;
  governanceMode: 'DEMO' | 'LIVE';
  className?: string;
}

export function StageLayout({
  stageId,
  state = { status: 'not_started' },
  children,
  inputPanel,
  outputPanel,
  settingsPanel,
  onRun,
  onCancel,
  isRunning = false,
  governanceMode,
  className,
}: StageLayoutProps) {
  const [, navigate] = useLocation();
  const stage = STAGES[stageId];

  const prevStage = stageId > 1 ? STAGES[(stageId - 1) as StageId] : null;
  const nextStage = stageId < 20 ? STAGES[(stageId + 1) as StageId] : null;

  const statusConfig = useMemo(() => {
    const configs: Record<StageStatus, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline'; icon: React.ComponentType<{ className?: string }> }> = {
      not_started: { label: 'Not Started', variant: 'secondary', icon: Info },
      in_progress: { label: 'In Progress', variant: 'default', icon: Play },
      completed: { label: 'Completed', variant: 'outline', icon: CheckCircle },
      error: { label: 'Error', variant: 'destructive', icon: AlertTriangle },
      blocked: { label: 'Blocked', variant: 'secondary', icon: AlertTriangle },
    };
    return configs[state.status];
  }, [state.status]);

  const StatusIcon = statusConfig.icon;
  const StageIcon = stage.icon;

  // Check if PHI scan is required and if we're in LIVE mode
  const phiWarning = governanceMode === 'LIVE' && stage.requiresPhiScan;

  return (
    <StageErrorBoundary stageId={stageId} stageName={stage.name}>
      <div className={cn('space-y-6', className)}>
        {/* Stage Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            {prevStage && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => navigate(`/workflow/stage/${stageId - 1}`)}
                    >
                      <ChevronLeft className="h-5 w-5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    Stage {stageId - 1}: {prevStage.name}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}

            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <StageIcon className="h-6 w-6 text-primary" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline">Stage {stageId}</Badge>
                  <Badge variant={statusConfig.variant} className="gap-1">
                    <StatusIcon className="h-3 w-3" />
                    {statusConfig.label}
                  </Badge>
                  <Badge variant={governanceMode === 'LIVE' ? 'destructive' : 'secondary'}>
                    {governanceMode}
                  </Badge>
                </div>
                <h1 className="text-2xl font-bold mt-1">{stage.name}</h1>
                <p className="text-muted-foreground">{stage.description}</p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {settingsPanel && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="outline" size="icon">
                      <Settings className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Stage Settings</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}

            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="outline" size="icon">
                    <HelpCircle className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">
                  <p className="font-medium">{stage.name}</p>
                  <p className="text-sm mt-1">{stage.description}</p>
                  {stage.estimatedDuration && (
                    <p className="text-xs mt-2 text-muted-foreground">
                      Estimated duration: {stage.estimatedDuration}
                    </p>
                  )}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>

            {nextStage && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => navigate(`/workflow/stage/${stageId + 1}`)}
                    >
                      <ChevronRight className="h-5 w-5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    Stage {stageId + 1}: {nextStage.name}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </div>
        </div>

        {/* PHI Warning for LIVE mode */}
        {phiWarning && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>PHI Compliance Required</AlertTitle>
            <AlertDescription>
              This stage processes potentially sensitive data. All outputs will be scanned for PHI before export.
              You are operating in LIVE mode with real data.
            </AlertDescription>
          </Alert>
        )}

        {/* Progress Bar (if in progress) */}
        {state.status === 'in_progress' && state.progress !== undefined && (
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Processing...</span>
              <span>{state.progress}%</span>
            </div>
            <Progress value={state.progress} />
          </div>
        )}

        {/* Error Alert */}
        {state.status === 'error' && state.errorMessage && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Stage Error</AlertTitle>
            <AlertDescription>{state.errorMessage}</AlertDescription>
          </Alert>
        )}

        {/* Main Content Tabs */}
        <Tabs defaultValue="main" className="w-full">
          <TabsList>
            <TabsTrigger value="main">Main</TabsTrigger>
            {inputPanel && <TabsTrigger value="input">Input</TabsTrigger>}
            {outputPanel && <TabsTrigger value="output">Output</TabsTrigger>}
            {settingsPanel && <TabsTrigger value="settings">Settings</TabsTrigger>}
          </TabsList>

          <TabsContent value="main" className="mt-4">
            {children}
          </TabsContent>

          {inputPanel && (
            <TabsContent value="input" className="mt-4">
              {inputPanel}
            </TabsContent>
          )}

          {outputPanel && (
            <TabsContent value="output" className="mt-4">
              {outputPanel}
            </TabsContent>
          )}

          {settingsPanel && (
            <TabsContent value="settings" className="mt-4">
              {settingsPanel}
            </TabsContent>
          )}
        </Tabs>

        {/* Action Footer */}
        <Card>
          <CardContent className="flex items-center justify-between py-4">
            <div className="flex items-center gap-4">
              {prevStage && (
                <Button
                  variant="outline"
                  onClick={() => navigate(`/workflow/stage/${stageId - 1}`)}
                >
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Previous: {prevStage.name}
                </Button>
              )}
            </div>

            <div className="flex items-center gap-2">
              {isRunning ? (
                <Button variant="destructive" onClick={onCancel}>
                  <Pause className="mr-2 h-4 w-4" />
                  Cancel
                </Button>
              ) : (
                onRun && (
                  <Button onClick={onRun} disabled={state.status === 'blocked'}>
                    <Play className="mr-2 h-4 w-4" />
                    Run Stage
                  </Button>
                )
              )}

              {nextStage && state.status === 'completed' && (
                <Button onClick={() => navigate(`/workflow/stage/${stageId + 1}`)}>
                  Next: {nextStage.name}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </StageErrorBoundary>
  );
}

// Stage mini card for sidebar navigation
interface StageMiniCardProps {
  stageId: StageId;
  isActive?: boolean;
  state?: StageState;
  onClick?: () => void;
}

export function StageMiniCard({ stageId, isActive, state, onClick }: StageMiniCardProps) {
  const stage = STAGES[stageId];
  const StageIcon = stage.icon;

  const statusColors: Record<StageStatus, string> = {
    not_started: 'bg-muted',
    in_progress: 'bg-blue-500',
    completed: 'bg-green-500',
    error: 'bg-red-500',
    blocked: 'bg-yellow-500',
  };

  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full flex items-center gap-3 p-3 rounded-lg text-left transition-colors',
        isActive ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'
      )}
    >
      <div className={cn('p-1.5 rounded', isActive ? 'bg-primary-foreground/20' : 'bg-muted')}>
        <StageIcon className="h-4 w-4" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{stage.name}</p>
        <p className="text-xs opacity-70">Stage {stageId}</p>
      </div>
      {state && (
        <div className={cn('h-2 w-2 rounded-full', statusColors[state.status])} />
      )}
    </button>
  );
}

// Stage sidebar for workflow navigation
interface StageSidebarProps {
  currentStageId: StageId;
  stageStates?: Record<StageId, StageState>;
  onStageSelect: (stageId: StageId) => void;
  className?: string;
}

export function StageSidebar({
  currentStageId,
  stageStates = {} as Record<StageId, StageState>,
  onStageSelect,
  className,
}: StageSidebarProps) {
  const stageIds = Object.keys(STAGES).map(Number) as StageId[];

  const stagesByCategory = useMemo(() => {
    const categories: Record<string, StageId[]> = {
      discovery: [],
      analysis: [],
      synthesis: [],
      validation: [],
      publication: [],
    };

    stageIds.forEach((id) => {
      const stage = STAGES[id];
      if (stage.category && categories[stage.category]) {
        categories[stage.category].push(id);
      }
    });

    return categories;
  }, [stageIds]);

  const categoryLabels: Record<string, string> = {
    discovery: 'Discovery',
    analysis: 'Analysis',
    synthesis: 'Synthesis',
    validation: 'Validation',
    publication: 'Publication',
  };

  return (
    <div className={cn('space-y-4', className)}>
      {Object.entries(stagesByCategory).map(([category, ids]) => (
        ids.length > 0 && (
          <div key={category}>
            <h3 className="text-xs font-semibold text-muted-foreground uppercase mb-2">
              {categoryLabels[category]}
            </h3>
            <div className="space-y-1">
              {ids.map((id) => (
                <StageMiniCard
                  key={id}
                  stageId={id}
                  isActive={currentStageId === id}
                  state={stageStates[id]}
                  onClick={() => onStageSelect(id)}
                />
              ))}
            </div>
          </div>
        )
      ))}
    </div>
  );
}

// Stage completion summary
interface StageCompletionSummaryProps {
  stageStates: Record<StageId, StageState>;
  className?: string;
}

export function StageCompletionSummary({
  stageStates,
  className,
}: StageCompletionSummaryProps) {
  const stats = useMemo(() => {
    const stageIds = Object.keys(STAGES).map(Number) as StageId[];
    const total = stageIds.length;
    let completed = 0;
    let inProgress = 0;
    let errors = 0;

    stageIds.forEach((id) => {
      const state = stageStates[id];
      if (state?.status === 'completed') completed++;
      else if (state?.status === 'in_progress') inProgress++;
      else if (state?.status === 'error') errors++;
    });

    return { total, completed, inProgress, errors };
  }, [stageStates]);

  const completionPercentage = Math.round((stats.completed / stats.total) * 100);

  return (
    <Card className={className}>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Workflow Progress</CardTitle>
        <CardDescription>
          {stats.completed} of {stats.total} stages completed
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Progress value={completionPercentage} />
        <div className="grid grid-cols-3 gap-2 text-center">
          <div>
            <p className="text-2xl font-bold text-green-600">{stats.completed}</p>
            <p className="text-xs text-muted-foreground">Completed</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-blue-600">{stats.inProgress}</p>
            <p className="text-xs text-muted-foreground">In Progress</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-red-600">{stats.errors}</p>
            <p className="text-xs text-muted-foreground">Errors</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
