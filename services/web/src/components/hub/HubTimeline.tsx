/**
 * HubTimeline Component
 *
 * Timeline projection visualization for Planning Hub.
 * Shows projected completion dates, critical path, and deadline risks.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useParams } from 'wouter';
import {
  Calendar,
  Clock,
  AlertTriangle,
  CheckCircle2,
  Circle,
  Loader2,
  RefreshCw,
  ChevronRight,
  TrendingUp,
  Target,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';

interface ProjectionResult {
  projectedCompletionDate: string | null;
  criticalPathTasks: Array<{
    taskId: string;
    title: string;
    projectedEnd: string;
  }>;
  deadlineRisks: Array<{
    entityType: string;
    entityId: string;
    entityTitle: string;
    deadline: string;
    projectedDate: string;
    daysOverdue: number;
    riskLevel: 'low' | 'medium' | 'high' | 'critical';
  }>;
  stageProjections: Array<{
    stageId: string;
    stageName: string;
    status: string;
    estimatedStart: string;
    estimatedEnd: string;
    durationDays: number;
  }>;
  summary: {
    totalTasks: number;
    completedTasks: number;
    overdueTasks: number;
    blockedTasks: number;
    averageVelocity: number;
  };
  generatedAt: string;
}

interface ProjectionRun {
  id: string;
  project_id: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  started_at: string;
  completed_at?: string;
}

interface HubTimelineProps {
  projectId?: string;
  className?: string;
}

export function HubTimeline({ projectId: propProjectId, className = '' }: HubTimelineProps) {
  const params = useParams<{ projectId?: string }>();
  const projectId = propProjectId || params.projectId;

  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [latestRun, setLatestRun] = useState<ProjectionRun | null>(null);
  const [results, setResults] = useState<ProjectionResult | null>(null);

  // Fetch latest projection
  const fetchLatestProjection = useCallback(async () => {
    if (!projectId) return;

    try {
      const token = localStorage.getItem('jwt_token');
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
      };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const res = await fetch(
        `${API_BASE}/api/hub/projections/latest/${projectId}`,
        { headers }
      );

      if (res.ok) {
        const data = await res.json();
        setLatestRun(data.run);
        setResults(data.output?.results || null);
      }
    } catch (err) {
      console.error('Failed to fetch projection:', err);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    fetchLatestProjection();
  }, [fetchLatestProjection]);

  // Run new projection
  const runProjection = async () => {
    if (!projectId || running) return;

    setRunning(true);
    setError(null);

    try {
      const token = localStorage.getItem('jwt_token');
      const res = await fetch(`${API_BASE}/api/hub/projections`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token && { Authorization: `Bearer ${token}` }),
        },
        body: JSON.stringify({
          projectId,
          includeGoals: true,
          includeTasks: true,
          includeWorkflowStages: true,
        }),
      });

      if (res.ok) {
        const run = await res.json();
        setLatestRun(run);

        // Poll for completion
        pollForCompletion(run.id);
      } else {
        setError('Failed to start projection');
        setRunning(false);
      }
    } catch (err) {
      console.error('Failed to run projection:', err);
      setError('Failed to run projection');
      setRunning(false);
    }
  };

  // Poll for projection completion
  const pollForCompletion = async (runId: string) => {
    const poll = async () => {
      try {
        const token = localStorage.getItem('jwt_token');
        const res = await fetch(`${API_BASE}/api/hub/projections/${runId}`, {
          headers: {
            'Content-Type': 'application/json',
            ...(token && { Authorization: `Bearer ${token}` }),
          },
        });

        if (res.ok) {
          const data = await res.json();
          setLatestRun(data.run);

          if (data.run.status === 'completed') {
            setResults(data.output?.results || null);
            setRunning(false);
          } else if (data.run.status === 'failed') {
            setError(data.output?.error || 'Projection failed');
            setRunning(false);
          } else {
            // Still running, poll again
            setTimeout(poll, 2000);
          }
        }
      } catch (err) {
        console.error('Failed to poll projection:', err);
        setRunning(false);
      }
    };

    poll();
  };

  const getRiskColor = (level: string) => {
    switch (level) {
      case 'low':
        return 'bg-blue-100 text-blue-800';
      case 'medium':
        return 'bg-yellow-100 text-yellow-800';
      case 'high':
        return 'bg-orange-100 text-orange-800';
      case 'critical':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  if (!projectId) {
    return (
      <div className={`p-6 ${className}`}>
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Clock className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Project Selected</h3>
            <p className="text-muted-foreground text-center mb-4">
              Select a project to view timeline projections.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (loading) {
    return (
      <div className={`p-6 space-y-6 ${className}`}>
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-10 w-32" />
        </div>
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className={`p-6 space-y-6 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Timeline Projections</h1>
          <p className="text-muted-foreground">
            {latestRun?.completed_at
              ? `Last updated ${new Date(latestRun.completed_at).toLocaleString()}`
              : 'No projections run yet'}
          </p>
        </div>
        <Button onClick={runProjection} disabled={running}>
          {running ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Running...
            </>
          ) : (
            <>
              <RefreshCw className="w-4 h-4 mr-2" /> Run Projection
            </>
          )}
        </Button>
      </div>

      {error && (
        <Card className="border-destructive">
          <CardContent className="py-4">
            <p className="text-destructive">{error}</p>
          </CardContent>
        </Card>
      )}

      {!results && !running && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <TrendingUp className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Projections Yet</h3>
            <p className="text-muted-foreground text-center mb-4">
              Run a projection to see timeline estimates based on your tasks and goals.
            </p>
            <Button onClick={runProjection}>
              <RefreshCw className="w-4 h-4 mr-2" /> Run First Projection
            </Button>
          </CardContent>
        </Card>
      )}

      {results && (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">
                  Projected Completion
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {results.projectedCompletionDate
                    ? new Date(results.projectedCompletionDate).toLocaleDateString()
                    : 'N/A'}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Task Progress</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {results.summary.completedTasks}/{results.summary.totalTasks}
                </div>
                <Progress
                  value={
                    results.summary.totalTasks > 0
                      ? (results.summary.completedTasks / results.summary.totalTasks) * 100
                      : 0
                  }
                  className="mt-2"
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Velocity</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {results.summary.averageVelocity.toFixed(1)}
                </div>
                <p className="text-xs text-muted-foreground">tasks/week</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">At Risk</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-yellow-600">
                  {results.deadlineRisks.length}
                </div>
                <p className="text-xs text-muted-foreground">deadlines</p>
              </CardContent>
            </Card>
          </div>

          {/* Deadline Risks */}
          {results.deadlineRisks.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-yellow-500" />
                  Deadline Risks
                </CardTitle>
                <CardDescription>Items at risk of missing their deadlines</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {results.deadlineRisks.map((risk) => (
                    <div
                      key={`${risk.entityType}-${risk.entityId}`}
                      className="flex items-center justify-between p-3 border rounded-lg"
                    >
                      <div className="flex items-center gap-3">
                        {risk.entityType === 'goal' ? (
                          <Target className="w-5 h-5 text-muted-foreground" />
                        ) : (
                          <CheckCircle2 className="w-5 h-5 text-muted-foreground" />
                        )}
                        <div>
                          <p className="font-medium">{risk.entityTitle}</p>
                          <p className="text-sm text-muted-foreground">
                            Due: {new Date(risk.deadline).toLocaleDateString()} →
                            Projected: {new Date(risk.projectedDate).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      <Badge className={getRiskColor(risk.riskLevel)}>
                        {risk.daysOverdue}d late
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Critical Path */}
          {results.criticalPathTasks.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Critical Path</CardTitle>
                <CardDescription>
                  Tasks that determine the project completion date
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {results.criticalPathTasks.map((task, i) => (
                    <div
                      key={task.taskId}
                      className="flex items-center gap-3 p-2 rounded-lg hover:bg-accent"
                    >
                      <div className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-medium">
                        {i + 1}
                      </div>
                      <div className="flex-1">
                        <p className="font-medium">{task.title}</p>
                        <p className="text-xs text-muted-foreground">
                          Projected: {new Date(task.projectedEnd).toLocaleDateString()}
                        </p>
                      </div>
                      {i < results.criticalPathTasks.length - 1 && (
                        <ChevronRight className="w-4 h-4 text-muted-foreground" />
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Stage Timeline */}
          {results.stageProjections.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Stage Timeline</CardTitle>
                <CardDescription>Estimated schedule for workflow stages</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="relative">
                  <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-border" />
                  <div className="space-y-4 pl-10">
                    {results.stageProjections.map((stage) => (
                      <div key={stage.stageId} className="relative">
                        <div className="absolute -left-6 top-1 w-3 h-3 rounded-full bg-primary" />
                        <div className="p-3 border rounded-lg">
                          <p className="font-medium">{stage.stageName}</p>
                          <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Calendar className="w-4 h-4" />
                              {new Date(stage.estimatedStart).toLocaleDateString()} -{' '}
                              {new Date(stage.estimatedEnd).toLocaleDateString()}
                            </span>
                            <span className="flex items-center gap-1">
                              <Clock className="w-4 h-4" />
                              {stage.durationDays} days
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}

export default HubTimeline;
