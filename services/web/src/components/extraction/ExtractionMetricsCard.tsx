/**
 * ExtractionMetricsCard Component
 * 
 * Displays extraction accuracy and performance metrics:
 * - Precision, recall, F1 by category
 * - Latency statistics
 * - Cost breakdown
 * - Tier comparison
 */

import * as React from 'react';
import { useMemo } from 'react';
import {
  BarChart3,
  Target,
  Clock,
  DollarSign,
  TrendingUp,
  AlertCircle,
  CheckCircle2,
  Zap,
  Info,
} from 'lucide-react';
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
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import { cn } from '@/lib/utils';

// Types
export interface CategoryMetrics {
  category: string;
  truePositives: number;
  falsePositives: number;
  falseNegatives: number;
  precision: number;
  recall: number;
  f1: number;
}

export interface PerformanceMetrics {
  totalLatencyMs: number;
  avgLatencyMs: number;
  minLatencyMs: number;
  maxLatencyMs: number;
  p95LatencyMs: number;
}

export interface CostMetrics {
  totalCostUsd: number;
  costPerNote: number;
  totalInputTokens: number;
  totalOutputTokens: number;
}

export interface ExtractionMetrics {
  benchmarkId: string;
  tier: string;
  startedAt: string;
  completedAt: string;
  totalNotes: number;
  successful: number;
  failed: number;
  categoryMetrics: CategoryMetrics[];
  overallPrecision: number;
  overallRecall: number;
  overallF1: number;
  performance: PerformanceMetrics;
  cost: CostMetrics;
}

export interface ExtractionMetricsCardProps {
  metrics: ExtractionMetrics;
  compareWith?: ExtractionMetrics;
  className?: string;
}

// Metric bar component
const MetricBar: React.FC<{
  label: string;
  value: number;
  color?: string;
  showValue?: boolean;
}> = ({ label, value, color = 'bg-primary', showValue = true }) => {
  const percent = Math.round(value * 100);
  
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-sm">
        <span className="text-muted-foreground">{label}</span>
        {showValue && <span className="font-medium">{percent}%</span>}
      </div>
      <Progress value={percent} className={cn('h-2', color)} />
    </div>
  );
};

// Score badge component
const ScoreBadge: React.FC<{ value: number; label: string }> = ({ value, label }) => {
  const percent = Math.round(value * 100);
  
  const getColor = (v: number) => {
    if (v >= 0.9) return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
    if (v >= 0.7) return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
    if (v >= 0.5) return 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200';
    return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
  };
  
  return (
    <div className="text-center p-3 rounded-lg bg-muted/30">
      <div className={cn('text-2xl font-bold mb-1', getColor(value).split(' ')[1])}>
        {percent}%
      </div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  );
};

// Category row component
const CategoryRow: React.FC<{
  metrics: CategoryMetrics;
  compare?: CategoryMetrics;
}> = ({ metrics, compare }) => {
  const formatPercent = (v: number) => `${Math.round(v * 100)}%`;
  
  const getDelta = (current: number, previous?: number) => {
    if (previous === undefined) return null;
    const delta = current - previous;
    if (Math.abs(delta) < 0.01) return null;
    return delta;
  };
  
  const DeltaIndicator: React.FC<{ delta: number | null }> = ({ delta }) => {
    if (delta === null) return null;
    const isPositive = delta > 0;
    return (
      <span className={cn(
        'text-xs ml-1',
        isPositive ? 'text-green-600' : 'text-red-600'
      )}>
        {isPositive ? '↑' : '↓'}{Math.abs(Math.round(delta * 100))}%
      </span>
    );
  };
  
  return (
    <tr className="border-b hover:bg-muted/30">
      <td className="py-2 px-3 font-medium capitalize">{metrics.category}</td>
      <td className="py-2 px-3 text-center">
        {formatPercent(metrics.precision)}
        <DeltaIndicator delta={getDelta(metrics.precision, compare?.precision)} />
      </td>
      <td className="py-2 px-3 text-center">
        {formatPercent(metrics.recall)}
        <DeltaIndicator delta={getDelta(metrics.recall, compare?.recall)} />
      </td>
      <td className="py-2 px-3 text-center font-medium">
        {formatPercent(metrics.f1)}
        <DeltaIndicator delta={getDelta(metrics.f1, compare?.f1)} />
      </td>
      <td className="py-2 px-3 text-center text-muted-foreground text-sm">
        {metrics.truePositives}/{metrics.truePositives + metrics.falseNegatives}
      </td>
    </tr>
  );
};

// Performance stats component
const PerformanceStats: React.FC<{ performance: PerformanceMetrics }> = ({ performance }) => {
  const formatMs = (ms: number) => {
    if (ms < 1000) return `${Math.round(ms)}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  };
  
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      <div className="p-3 rounded-lg bg-muted/30 text-center">
        <div className="text-xs text-muted-foreground mb-1">Avg Latency</div>
        <div className="text-lg font-semibold">{formatMs(performance.avgLatencyMs)}</div>
      </div>
      <div className="p-3 rounded-lg bg-muted/30 text-center">
        <div className="text-xs text-muted-foreground mb-1">P95 Latency</div>
        <div className="text-lg font-semibold">{formatMs(performance.p95LatencyMs)}</div>
      </div>
      <div className="p-3 rounded-lg bg-muted/30 text-center">
        <div className="text-xs text-muted-foreground mb-1">Min</div>
        <div className="text-lg font-semibold">{formatMs(performance.minLatencyMs)}</div>
      </div>
      <div className="p-3 rounded-lg bg-muted/30 text-center">
        <div className="text-xs text-muted-foreground mb-1">Max</div>
        <div className="text-lg font-semibold">{formatMs(performance.maxLatencyMs)}</div>
      </div>
    </div>
  );
};

// Cost breakdown component
const CostBreakdown: React.FC<{ cost: CostMetrics; totalNotes: number }> = ({ cost, totalNotes }) => {
  const formatCost = (usd: number) => {
    if (usd < 0.01) return `$${usd.toFixed(4)}`;
    return `$${usd.toFixed(2)}`;
  };
  
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="p-4 rounded-lg border bg-green-50 dark:bg-green-950/20">
          <div className="flex items-center gap-2 text-green-700 dark:text-green-400">
            <DollarSign className="h-4 w-4" />
            <span className="text-sm font-medium">Total Cost</span>
          </div>
          <div className="text-2xl font-bold text-green-800 dark:text-green-300 mt-1">
            {formatCost(cost.totalCostUsd)}
          </div>
        </div>
        <div className="p-4 rounded-lg border">
          <div className="flex items-center gap-2 text-muted-foreground">
            <BarChart3 className="h-4 w-4" />
            <span className="text-sm font-medium">Cost per Note</span>
          </div>
          <div className="text-2xl font-bold mt-1">
            {formatCost(cost.costPerNote)}
          </div>
        </div>
      </div>
      
      <div className="p-3 rounded-lg bg-muted/30">
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Input Tokens</span>
          <span className="font-medium">{cost.totalInputTokens.toLocaleString()}</span>
        </div>
        <div className="flex justify-between text-sm mt-1">
          <span className="text-muted-foreground">Output Tokens</span>
          <span className="font-medium">{cost.totalOutputTokens.toLocaleString()}</span>
        </div>
        <div className="flex justify-between text-sm mt-1 pt-1 border-t">
          <span className="text-muted-foreground">Total Tokens</span>
          <span className="font-medium">
            {(cost.totalInputTokens + cost.totalOutputTokens).toLocaleString()}
          </span>
        </div>
      </div>
    </div>
  );
};

export function ExtractionMetricsCard({
  metrics,
  compareWith,
  className,
}: ExtractionMetricsCardProps) {
  // Find matching category for comparison
  const findCompareCategory = (category: string) => {
    return compareWith?.categoryMetrics.find(c => c.category === category);
  };
  
  // Success rate
  const successRate = metrics.totalNotes > 0
    ? metrics.successful / metrics.totalNotes
    : 0;
  
  return (
    <Card className={cn("w-full", className)}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            <CardTitle className="text-lg">Extraction Metrics</CardTitle>
          </div>
          <Badge variant="outline">{metrics.tier}</Badge>
        </div>
        <CardDescription>
          Benchmark: {metrics.benchmarkId}
          {compareWith && (
            <span className="ml-2 text-blue-600">
              (comparing with {compareWith.tier})
            </span>
          )}
        </CardDescription>
      </CardHeader>
      
      <CardContent>
        <Tabs defaultValue="accuracy" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="accuracy" className="text-xs">
              <Target className="h-4 w-4 mr-1" />
              Accuracy
            </TabsTrigger>
            <TabsTrigger value="performance" className="text-xs">
              <Clock className="h-4 w-4 mr-1" />
              Performance
            </TabsTrigger>
            <TabsTrigger value="cost" className="text-xs">
              <DollarSign className="h-4 w-4 mr-1" />
              Cost
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="accuracy" className="space-y-4 mt-4">
            {/* Overall Scores */}
            <div className="grid grid-cols-3 gap-4">
              <ScoreBadge value={metrics.overallPrecision} label="Precision" />
              <ScoreBadge value={metrics.overallRecall} label="Recall" />
              <ScoreBadge value={metrics.overallF1} label="F1 Score" />
            </div>
            
            {/* Success Rate */}
            <div className="p-3 rounded-lg bg-muted/30">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-muted-foreground">Processing Success Rate</span>
                <span className="text-sm font-medium">
                  {metrics.successful}/{metrics.totalNotes} ({Math.round(successRate * 100)}%)
                </span>
              </div>
              <Progress value={successRate * 100} className="h-2" />
              {metrics.failed > 0 && (
                <div className="flex items-center gap-1 mt-2 text-xs text-amber-600">
                  <AlertCircle className="h-3 w-3" />
                  {metrics.failed} extraction(s) failed
                </div>
              )}
            </div>
            
            {/* Category Breakdown */}
            <div className="border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="py-2 px-3 text-left font-medium">Category</th>
                    <th className="py-2 px-3 text-center font-medium">
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger className="flex items-center justify-center gap-1">
                            Precision
                            <Info className="h-3 w-3" />
                          </TooltipTrigger>
                          <TooltipContent>
                            Of items extracted, how many were correct
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </th>
                    <th className="py-2 px-3 text-center font-medium">
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger className="flex items-center justify-center gap-1">
                            Recall
                            <Info className="h-3 w-3" />
                          </TooltipTrigger>
                          <TooltipContent>
                            Of true items, how many were found
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </th>
                    <th className="py-2 px-3 text-center font-medium">F1</th>
                    <th className="py-2 px-3 text-center font-medium">Coverage</th>
                  </tr>
                </thead>
                <tbody>
                  {metrics.categoryMetrics.map((cat) => (
                    <CategoryRow
                      key={cat.category}
                      metrics={cat}
                      compare={findCompareCategory(cat.category)}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          </TabsContent>
          
          <TabsContent value="performance" className="mt-4">
            <PerformanceStats performance={metrics.performance} />
            
            {/* Throughput */}
            <div className="mt-4 p-4 rounded-lg border">
              <div className="flex items-center gap-2 mb-2">
                <Zap className="h-4 w-4 text-amber-500" />
                <span className="font-medium">Throughput</span>
              </div>
              <div className="text-2xl font-bold">
                {metrics.performance.avgLatencyMs > 0
                  ? Math.round(1000 / metrics.performance.avgLatencyMs * 60)
                  : 0}{' '}
                <span className="text-sm font-normal text-muted-foreground">
                  notes/minute
                </span>
              </div>
            </div>
          </TabsContent>
          
          <TabsContent value="cost" className="mt-4">
            <CostBreakdown cost={metrics.cost} totalNotes={metrics.totalNotes} />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}

export default ExtractionMetricsCard;
