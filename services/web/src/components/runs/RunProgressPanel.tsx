import { useState, useEffect, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { getStage, type StageId, type StageStatus } from '@/workflow/stages';
import { cn } from '@/lib/utils';
import {
  Loader2,
  CheckCircle,
  XCircle,
  Clock,
  SkipForward,
  ChevronDown,
  Play,
  Pause,
  RotateCcw,
  Download,
  AlertTriangle,
} from 'lucide-react';

/**
 * Run Progress Panel (Task 8, Task 24)
 *
 * Real-time progress indicators for long-running workflow executions:
 * - Overall progress bar
 * - Per-stage status indicators
 * - SSE/polling for live updates
 * - Recovery controls for interrupted runs
 */

export interface StageProgress {
  stageId: StageId;
  status: StageStatus;
  progress?: number;
  startedAt?: string;
  completedAt?: string;
  error?: string;
  logs?: string[];
}

export interface RunProgress {
  runId: string;
  projectId: string;
  status: 'pending' | 'running' | 'paused' | 'completed' | 'failed' | 'cancelled';
  currentStage?: StageId;
  progress: number;
  stages: StageProgress[];
  startedAt?: string;
  estimatedCompletion?: string;
  error?: string;
}

interface RunProgressPanelProps {
  runId: string;
  /** Use SSE for real-time updates */
  useSSE?: boolean;
  /** Polling interval in ms (fallback) */
  pollInterval?: number;
  /** Show detailed logs */
  showLogs?: boolean;
  /** Callback when run completes */
  onComplete?: (run: RunProgress) => void;
  /** Callback when run fails */
  onFail?: (run: RunProgress, error: string) => void;
  className?: string;
}

const statusIcons: Record<StageStatus, typeof CheckCircle> = {
  pending: Clock,
  in_progress: Loader2,
  completed: CheckCircle,
  failed: XCircle,
  skipped: SkipForward,
};

const statusColors: Record<StageStatus, string> = {
  pending: 'text-muted-foreground',
  in_progress: 'text-blue-500',
  completed: 'text-green-500',
  failed: 'text-red-500',
  skipped: 'text-gray-400',
};

export function RunProgressPanel({
  runId,
  useSSE = true,
  pollInterval = 5000,
  showLogs = false,
  onComplete,
  onFail,
  className,
}: RunProgressPanelProps) {
  const [expandedStages, setExpandedStages] = useState<Set<number>>(new Set());

  // Fetch initial run state and poll for updates
  const { data: run, refetch } = useQuery<RunProgress>({
    queryKey: ['run', runId],
    queryFn: async () => {
      const response = await fetch(`/api/runs/${runId}`, { credentials: 'include' });
      if (!response.ok) throw new Error('Failed to fetch run');
      return response.json();
    },
    refetchInterval: useSSE ? false : pollInterval,
  });

  // SSE connection for real-time updates
  useEffect(() => {
    if (!useSSE || !runId) return;

    const eventSource = new EventSource(`/api/runs/${runId}/events`);

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        // Update local state or refetch
        refetch();
      } catch (error) {
        console.error('Failed to parse SSE event:', error);
      }
    };

    eventSource.onerror = () => {
      // Fall back to polling on SSE error
      eventSource.close();
    };

    return () => {
      eventSource.close();
    };
  }, [runId, useSSE, refetch]);

  // Handle completion/failure callbacks
  useEffect(() => {
    if (!run) return;

    if (run.status === 'completed' && onComplete) {
      onComplete(run);
    } else if (run.status === 'failed' && onFail && run.error) {
      onFail(run, run.error);
    }
  }, [run?.status, onComplete, onFail]);

  const toggleStage = useCallback((stageId: number) => {
    setExpandedStages((prev) => {
      const next = new Set(prev);
      if (next.has(stageId)) {
        next.delete(stageId);
      } else {
        next.add(stageId);
      }
      return next;
    });
  }, []);

  if (!run) {
    return (
      <Card className={className}>
        <CardContent className="flex items-center justify-center p-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  const isRunning = run.status === 'running';
  const isPaused = run.status === 'paused';
  const isTerminal = ['completed', 'failed', 'cancelled'].includes(run.status);

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">Run Progress</CardTitle>
          <Badge
            variant={
              run.status === 'completed'
                ? 'default'
                : run.status === 'failed'
                ? 'destructive'
                : 'outline'
            }
          >
            {run.status.charAt(0).toUpperCase() + run.status.slice(1)}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Overall progress */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Overall Progress</span>
            <span className="font-medium">{Math.round(run.progress)}%</span>
          </div>
          <Progress value={run.progress} className="h-2" />
          {run.estimatedCompletion && isRunning && (
            <p className="text-xs text-muted-foreground">
              Estimated completion: {new Date(run.estimatedCompletion).toLocaleTimeString()}
            </p>
          )}
        </div>

        {/* Error banner */}
        {run.error && (
          <div className="flex items-start gap-2 p-3 bg-destructive/10 text-destructive rounded-md">
            <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
            <div className="text-sm">
              <p className="font-medium">Run failed</p>
              <p className="text-sm opacity-80">{run.error}</p>
            </div>
          </div>
        )}

        {/* Stage list */}
        <ScrollArea className="h-[300px]">
          <div className="space-y-2">
            {run.stages.map((stageProgress) => {
              const stage = getStage(stageProgress.stageId);
              const StatusIcon = statusIcons[stageProgress.status];
              const isExpanded = expandedStages.has(stageProgress.stageId);

              return (
                <Collapsible
                  key={stageProgress.stageId}
                  open={isExpanded}
                  onOpenChange={() => toggleStage(stageProgress.stageId)}
                >
                  <div
                    className={cn(
                      'rounded-md border p-3',
                      stageProgress.status === 'in_progress' && 'border-blue-500/50 bg-blue-500/5',
                      stageProgress.status === 'failed' && 'border-red-500/50 bg-red-500/5'
                    )}
                  >
                    <CollapsibleTrigger asChild>
                      <button className="flex w-full items-center gap-3 text-left">
                        <StatusIcon
                          className={cn(
                            'h-4 w-4',
                            statusColors[stageProgress.status],
                            stageProgress.status === 'in_progress' && 'animate-spin'
                          )}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium truncate">
                              Stage {stageProgress.stageId}: {stage.name}
                            </span>
                            {stageProgress.progress !== undefined &&
                              stageProgress.status === 'in_progress' && (
                                <span className="text-xs text-muted-foreground">
                                  {stageProgress.progress}%
                                </span>
                              )}
                          </div>
                          {stageProgress.status === 'in_progress' && stageProgress.progress !== undefined && (
                            <Progress value={stageProgress.progress} className="h-1 mt-1" />
                          )}
                        </div>
                        <ChevronDown
                          className={cn(
                            'h-4 w-4 text-muted-foreground transition-transform',
                            isExpanded && 'rotate-180'
                          )}
                        />
                      </button>
                    </CollapsibleTrigger>

                    <CollapsibleContent>
                      <div className="mt-3 pt-3 border-t space-y-2 text-sm">
                        {stageProgress.startedAt && (
                          <p className="text-muted-foreground">
                            Started: {new Date(stageProgress.startedAt).toLocaleString()}
                          </p>
                        )}
                        {stageProgress.completedAt && (
                          <p className="text-muted-foreground">
                            Completed: {new Date(stageProgress.completedAt).toLocaleString()}
                          </p>
                        )}
                        {stageProgress.error && (
                          <p className="text-destructive">{stageProgress.error}</p>
                        )}
                        {showLogs && stageProgress.logs && stageProgress.logs.length > 0 && (
                          <div className="mt-2">
                            <p className="text-xs font-medium mb-1">Logs:</p>
                            <pre className="text-xs bg-muted p-2 rounded overflow-x-auto max-h-32">
                              {stageProgress.logs.join('\n')}
                            </pre>
                          </div>
                        )}
                      </div>
                    </CollapsibleContent>
                  </div>
                </Collapsible>
              );
            })}
          </div>
        </ScrollArea>

        {/* Action buttons */}
        <div className="flex items-center gap-2 pt-2 border-t">
          {isRunning && (
            <Button variant="outline" size="sm">
              <Pause className="h-4 w-4 mr-1" />
              Pause
            </Button>
          )}
          {isPaused && (
            <Button variant="outline" size="sm">
              <Play className="h-4 w-4 mr-1" />
              Resume
            </Button>
          )}
          {run.status === 'failed' && (
            <Button variant="outline" size="sm">
              <RotateCcw className="h-4 w-4 mr-1" />
              Retry Failed Stage
            </Button>
          )}
          <Button variant="ghost" size="sm" className="ml-auto">
            <Download className="h-4 w-4 mr-1" />
            Download Logs
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Run Recovery Panel (Task 24)
 *
 * UI for recovering interrupted workflows:
 * - Resume from last stage
 * - Restart specific stage
 * - Download diagnostic logs
 */
export function RunRecoveryPanel({
  runId,
  className,
}: {
  runId: string;
  className?: string;
}) {
  const { data: run } = useQuery<RunProgress>({
    queryKey: ['run', runId],
  });

  if (!run || !['failed', 'cancelled', 'paused'].includes(run.status)) {
    return null;
  }

  const lastCompletedStage = run.stages
    .filter((s) => s.status === 'completed')
    .pop();

  const failedStage = run.stages.find((s) => s.status === 'failed');

  return (
    <Card className={cn('border-yellow-500/50', className)}>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-yellow-500" />
          <CardTitle className="text-lg">Run Interrupted</CardTitle>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          This run was interrupted. You can recover by resuming from the last successful
          checkpoint or restarting a specific stage.
        </p>

        {run.error && (
          <div className="p-3 bg-destructive/10 text-destructive rounded-md text-sm">
            <p className="font-medium">Error Details</p>
            <p>{run.error}</p>
          </div>
        )}

        <div className="space-y-2">
          <p className="text-sm font-medium">Recovery Options</p>

          <div className="grid gap-2">
            {lastCompletedStage && (
              <Button variant="outline" className="justify-start">
                <Play className="h-4 w-4 mr-2" />
                Resume from Stage {lastCompletedStage.stageId + 1}
              </Button>
            )}

            {failedStage && (
              <Button variant="outline" className="justify-start">
                <RotateCcw className="h-4 w-4 mr-2" />
                Retry Stage {failedStage.stageId}: {getStage(failedStage.stageId).name}
              </Button>
            )}

            <Button variant="outline" className="justify-start">
              <RotateCcw className="h-4 w-4 mr-2" />
              Restart Entire Run
            </Button>

            <Button variant="ghost" className="justify-start">
              <Download className="h-4 w-4 mr-2" />
              Download Diagnostic Logs
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
