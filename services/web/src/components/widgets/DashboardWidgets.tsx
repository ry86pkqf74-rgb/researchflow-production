import { useState, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import {
  Activity,
  Clock,
  Cpu,
  DollarSign,
  HardDrive,
  Layers,
  MoreVertical,
  RefreshCw,
  Server,
  TrendingDown,
  TrendingUp,
  Zap,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

/**
 * Dashboard Widgets (Task 21)
 *
 * Customizable dashboard widgets for key metrics:
 * - Job queue status
 * - AI cost tracking
 * - K8s cluster status (if enabled)
 * - Storage usage
 *
 * Features:
 * - Drag-and-drop arrangement (via parent grid)
 * - Layout persistence via user preferences
 * - Refresh controls
 */

export interface WidgetProps {
  className?: string;
  onRemove?: () => void;
  refreshKey?: number;
}

// Queue Status Widget (Task 55)
export function QueueStatusWidget({ className, onRemove, refreshKey }: WidgetProps) {
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['metrics', 'queue', refreshKey],
    queryFn: async () => {
      const response = await fetch('/api/admin/queues', { credentials: 'include' });
      if (!response.ok) throw new Error('Failed to fetch queue status');
      return response.json();
    },
    refetchInterval: 10000, // Refresh every 10s
  });

  const stats = data || {
    waiting: 0,
    active: 0,
    completed: 0,
    failed: 0,
    delayed: 0,
  };

  const total = stats.waiting + stats.active + stats.delayed;

  return (
    <Card className={cn('relative', className)}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Layers className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-sm font-medium">Job Queue</CardTitle>
          </div>
          <WidgetActions onRefresh={refetch} onRemove={onRemove} />
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <WidgetSkeleton />
        ) : (
          <div className="space-y-4">
            <div className="flex items-end gap-2">
              <span className="text-3xl font-bold">{total}</span>
              <span className="text-sm text-muted-foreground mb-1">jobs queued</span>
            </div>

            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Waiting</span>
                <Badge variant="outline">{stats.waiting}</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Active</span>
                <Badge variant="default" className="bg-blue-500">{stats.active}</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Completed</span>
                <Badge variant="default" className="bg-green-500">{stats.completed}</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Failed</span>
                <Badge variant="destructive">{stats.failed}</Badge>
              </div>
            </div>

            {stats.active > 0 && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Activity className="h-3 w-3 animate-pulse text-blue-500" />
                <span>Processing...</span>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// AI Cost Widget (Task 110)
export function AICostWidget({ className, onRemove, refreshKey }: WidgetProps) {
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['metrics', 'ai-costs', refreshKey],
    queryFn: async () => {
      const response = await fetch('/api/metrics/costs', { credentials: 'include' });
      if (!response.ok) throw new Error('Failed to fetch AI costs');
      return response.json();
    },
    refetchInterval: 60000, // Refresh every minute
  });

  const costs = data || {
    today: 0,
    thisWeek: 0,
    thisMonth: 0,
    budget: 100,
    byModel: { NANO: 0, MINI: 0, FRONTIER: 0 },
    trend: 0,
  };

  const budgetUsed = (costs.thisMonth / costs.budget) * 100;
  const isOverBudget = budgetUsed > 100;

  return (
    <Card className={cn('relative', className)}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <DollarSign className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-sm font-medium">AI Costs</CardTitle>
          </div>
          <WidgetActions onRefresh={refetch} onRemove={onRemove} />
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <WidgetSkeleton />
        ) : (
          <div className="space-y-4">
            <div className="flex items-end gap-2">
              <span className="text-3xl font-bold">${costs.thisMonth.toFixed(2)}</span>
              <span className="text-sm text-muted-foreground mb-1">this month</span>
              {costs.trend !== 0 && (
                <div className={cn(
                  'flex items-center text-xs ml-auto',
                  costs.trend > 0 ? 'text-red-500' : 'text-green-500'
                )}>
                  {costs.trend > 0 ? (
                    <TrendingUp className="h-3 w-3 mr-0.5" />
                  ) : (
                    <TrendingDown className="h-3 w-3 mr-0.5" />
                  )}
                  {Math.abs(costs.trend)}%
                </div>
              )}
            </div>

            {/* Budget progress */}
            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Budget</span>
                <span className={isOverBudget ? 'text-destructive' : ''}>
                  {budgetUsed.toFixed(0)}% of ${costs.budget}
                </span>
              </div>
              <Progress
                value={Math.min(budgetUsed, 100)}
                className={cn('h-1.5', isOverBudget && '[&>div]:bg-destructive')}
              />
            </div>

            {/* By model tier */}
            <div className="grid grid-cols-3 gap-1 text-xs">
              <div className="text-center p-1.5 rounded bg-green-500/10">
                <Zap className="h-3 w-3 mx-auto text-green-500" />
                <div className="font-medium mt-1">${costs.byModel.NANO.toFixed(2)}</div>
                <div className="text-muted-foreground">NANO</div>
              </div>
              <div className="text-center p-1.5 rounded bg-blue-500/10">
                <Zap className="h-3 w-3 mx-auto text-blue-500" />
                <div className="font-medium mt-1">${costs.byModel.MINI.toFixed(2)}</div>
                <div className="text-muted-foreground">MINI</div>
              </div>
              <div className="text-center p-1.5 rounded bg-purple-500/10">
                <Zap className="h-3 w-3 mx-auto text-purple-500" />
                <div className="font-medium mt-1">${costs.byModel.FRONTIER.toFixed(2)}</div>
                <div className="text-muted-foreground">FRONTIER</div>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// K8s Status Widget (Task 89, Task 67)
export function K8sStatusWidget({ className, onRemove, refreshKey }: WidgetProps) {
  const { data, isLoading, refetch, error } = useQuery({
    queryKey: ['metrics', 'k8s', refreshKey],
    queryFn: async () => {
      const response = await fetch('/api/admin/k8s/pods', { credentials: 'include' });
      if (!response.ok) {
        if (response.status === 404) return null; // K8s not enabled
        throw new Error('Failed to fetch K8s status');
      }
      return response.json();
    },
    refetchInterval: 30000,
  });

  // K8s not available
  if (!isLoading && !data) {
    return (
      <Card className={cn('relative', className)}>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Server className="h-4 w-4 text-muted-foreground" />
              <CardTitle className="text-sm font-medium">Cluster Status</CardTitle>
            </div>
            <WidgetActions onRemove={onRemove} />
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Kubernetes monitoring not available
          </p>
        </CardContent>
      </Card>
    );
  }

  const stats = data || {
    totalPods: 0,
    runningPods: 0,
    pendingPods: 0,
    failedPods: 0,
    cpuUsage: 0,
    memoryUsage: 0,
  };

  return (
    <Card className={cn('relative', className)}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Server className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-sm font-medium">Cluster Status</CardTitle>
          </div>
          <WidgetActions onRefresh={refetch} onRemove={onRemove} />
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <WidgetSkeleton />
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="p-2 rounded bg-green-500/10">
                <div className="text-lg font-bold text-green-500">{stats.runningPods}</div>
                <div className="text-xs text-muted-foreground">Running</div>
              </div>
              <div className="p-2 rounded bg-yellow-500/10">
                <div className="text-lg font-bold text-yellow-500">{stats.pendingPods}</div>
                <div className="text-xs text-muted-foreground">Pending</div>
              </div>
              <div className="p-2 rounded bg-red-500/10">
                <div className="text-lg font-bold text-red-500">{stats.failedPods}</div>
                <div className="text-xs text-muted-foreground">Failed</div>
              </div>
            </div>

            {/* Resource usage */}
            <div className="space-y-2">
              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-1 text-muted-foreground">
                    <Cpu className="h-3 w-3" /> CPU
                  </span>
                  <span>{stats.cpuUsage}%</span>
                </div>
                <Progress value={stats.cpuUsage} className="h-1" />
              </div>
              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-1 text-muted-foreground">
                    <HardDrive className="h-3 w-3" /> Memory
                  </span>
                  <span>{stats.memoryUsage}%</span>
                </div>
                <Progress value={stats.memoryUsage} className="h-1" />
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Recent Activity Widget
export function RecentActivityWidget({ className, onRemove, refreshKey }: WidgetProps) {
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['metrics', 'activity', refreshKey],
    queryFn: async () => {
      const response = await fetch('/api/audit?limit=5', { credentials: 'include' });
      if (!response.ok) throw new Error('Failed to fetch activity');
      return response.json();
    },
    refetchInterval: 30000,
  });

  const activities = data?.items || [];

  return (
    <Card className={cn('relative', className)}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-sm font-medium">Recent Activity</CardTitle>
          </div>
          <WidgetActions onRefresh={refetch} onRemove={onRemove} />
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <WidgetSkeleton rows={4} />
        ) : activities.length === 0 ? (
          <p className="text-sm text-muted-foreground">No recent activity</p>
        ) : (
          <div className="space-y-3">
            {activities.map((activity: any, i: number) => (
              <div key={i} className="flex items-start gap-2 text-sm">
                <div className="w-2 h-2 rounded-full bg-primary mt-1.5" />
                <div className="flex-1 min-w-0">
                  <p className="truncate">{activity.action}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(activity.createdAt).toLocaleString()}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Widget utility components
function WidgetActions({
  onRefresh,
  onRemove,
}: {
  onRefresh?: () => void;
  onRemove?: () => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-6 w-6">
          <MoreVertical className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {onRefresh && (
          <DropdownMenuItem onClick={onRefresh}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </DropdownMenuItem>
        )}
        {onRemove && (
          <DropdownMenuItem onClick={onRemove} className="text-destructive">
            Remove Widget
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function WidgetSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="space-y-3">
      <Skeleton className="h-8 w-24" />
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-4 w-full" />
      ))}
    </div>
  );
}

// Widget Registry
export const DASHBOARD_WIDGETS = {
  queue: {
    id: 'queue',
    name: 'Job Queue',
    description: 'Monitor job queue status',
    component: QueueStatusWidget,
  },
  costs: {
    id: 'costs',
    name: 'AI Costs',
    description: 'Track AI model usage costs',
    component: AICostWidget,
  },
  k8s: {
    id: 'k8s',
    name: 'Cluster Status',
    description: 'Monitor Kubernetes cluster',
    component: K8sStatusWidget,
  },
  activity: {
    id: 'activity',
    name: 'Recent Activity',
    description: 'View recent actions',
    component: RecentActivityWidget,
  },
} as const;

export type WidgetId = keyof typeof DASHBOARD_WIDGETS;
