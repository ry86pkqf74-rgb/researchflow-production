/**
 * ExtractionProgressPanel Component
 * 
 * Displays real-time progress of clinical data extraction with:
 * - Overall progress bar
 * - Per-cell status tracking
 * - PHI detection alerts
 * - Cost/token tracking
 * - Error handling
 */

import * as React from 'react';
import { useState, useEffect, useCallback } from 'react';
import {
  Loader2,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Shield,
  FileText,
  DollarSign,
  Clock,
  Pause,
  Play,
  Square,
  RefreshCw,
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
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

// Types
export interface ExtractionJob {
  id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'phi_blocked';
  rowIndex: number;
  column: string;
  tier?: string;
  startedAt?: string;
  completedAt?: string;
  error?: string;
  phiDetected?: boolean;
  tokensUsed?: number;
  costUsd?: number;
}

export interface ExtractionProgress {
  jobId: string;
  status: 'idle' | 'running' | 'paused' | 'completed' | 'error';
  totalCells: number;
  processedCells: number;
  successfulCells: number;
  failedCells: number;
  phiBlockedCells: number;
  currentTier: string;
  totalTokens: number;
  totalCostUsd: number;
  estimatedTimeRemaining?: number;
  jobs: ExtractionJob[];
}

export interface ExtractionProgressPanelProps {
  progress: ExtractionProgress;
  onPause?: () => void;
  onResume?: () => void;
  onCancel?: () => void;
  onRetryFailed?: () => void;
  showDetails?: boolean;
  className?: string;
}

const StatusIcon: React.FC<{ status: ExtractionJob['status'] }> = ({ status }) => {
  switch (status) {
    case 'pending':
      return <Clock className="h-4 w-4 text-muted-foreground" />;
    case 'processing':
      return <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />;
    case 'completed':
      return <CheckCircle2 className="h-4 w-4 text-green-500" />;
    case 'failed':
      return <XCircle className="h-4 w-4 text-red-500" />;
    case 'phi_blocked':
      return <Shield className="h-4 w-4 text-amber-500" />;
    default:
      return null;
  }
};

const StatusBadge: React.FC<{ status: ExtractionProgress['status'] }> = ({ status }) => {
  const variants: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; label: string }> = {
    idle: { variant: 'secondary', label: 'Idle' },
    running: { variant: 'default', label: 'Running' },
    paused: { variant: 'outline', label: 'Paused' },
    completed: { variant: 'secondary', label: 'Completed' },
    error: { variant: 'destructive', label: 'Error' },
  };
  
  const config = variants[status] || variants.idle;
  
  return (
    <Badge variant={config.variant} className="ml-2">
      {status === 'running' && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
      {config.label}
    </Badge>
  );
};

export function ExtractionProgressPanel({
  progress,
  onPause,
  onResume,
  onCancel,
  onRetryFailed,
  showDetails = true,
  className,
}: ExtractionProgressPanelProps) {
  const progressPercent = progress.totalCells > 0
    ? Math.round((progress.processedCells / progress.totalCells) * 100)
    : 0;
  
  const formatTime = (seconds: number): string => {
    if (seconds < 60) return `${seconds}s`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
    return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
  };
  
  const formatCost = (usd: number): string => {
    if (usd < 0.01) return `$${usd.toFixed(4)}`;
    return `$${usd.toFixed(2)}`;
  };
  
  // Get recent jobs for the activity feed
  const recentJobs = progress.jobs
    .filter(j => j.status !== 'pending')
    .slice(-10)
    .reverse();
  
  return (
    <Card className={cn("w-full", className)}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <CardTitle className="text-lg">Clinical Data Extraction</CardTitle>
            <StatusBadge status={progress.status} />
          </div>
          <div className="flex gap-2">
            {progress.status === 'running' && onPause && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="outline" size="sm" onClick={onPause}>
                      <Pause className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Pause extraction</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
            {progress.status === 'paused' && onResume && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="outline" size="sm" onClick={onResume}>
                      <Play className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Resume extraction</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
            {(progress.status === 'running' || progress.status === 'paused') && onCancel && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="outline" size="sm" onClick={onCancel}>
                      <Square className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Cancel extraction</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
            {progress.failedCells > 0 && progress.status === 'completed' && onRetryFailed && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="outline" size="sm" onClick={onRetryFailed}>
                      <RefreshCw className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Retry failed cells</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </div>
        </div>
        <CardDescription>
          Processing {progress.totalCells} cells using {progress.currentTier} tier
        </CardDescription>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Progress Bar */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span>{progress.processedCells} / {progress.totalCells} cells</span>
            <span>{progressPercent}%</span>
          </div>
          <Progress value={progressPercent} className="h-2" />
        </div>
        
        {/* Statistics Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="flex items-center gap-2 p-2 rounded-md bg-muted/50">
            <CheckCircle2 className="h-4 w-4 text-green-500" />
            <div>
              <div className="text-sm font-medium">{progress.successfulCells}</div>
              <div className="text-xs text-muted-foreground">Successful</div>
            </div>
          </div>
          
          <div className="flex items-center gap-2 p-2 rounded-md bg-muted/50">
            <XCircle className="h-4 w-4 text-red-500" />
            <div>
              <div className="text-sm font-medium">{progress.failedCells}</div>
              <div className="text-xs text-muted-foreground">Failed</div>
            </div>
          </div>
          
          <div className="flex items-center gap-2 p-2 rounded-md bg-muted/50">
            <Shield className="h-4 w-4 text-amber-500" />
            <div>
              <div className="text-sm font-medium">{progress.phiBlockedCells}</div>
              <div className="text-xs text-muted-foreground">PHI Blocked</div>
            </div>
          </div>
          
          <div className="flex items-center gap-2 p-2 rounded-md bg-muted/50">
            <DollarSign className="h-4 w-4 text-blue-500" />
            <div>
              <div className="text-sm font-medium">{formatCost(progress.totalCostUsd)}</div>
              <div className="text-xs text-muted-foreground">Total Cost</div>
            </div>
          </div>
        </div>
        
        {/* Estimated Time */}
        {progress.status === 'running' && progress.estimatedTimeRemaining && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Clock className="h-4 w-4" />
            <span>Estimated time remaining: {formatTime(progress.estimatedTimeRemaining)}</span>
          </div>
        )}
        
        {/* PHI Warning */}
        {progress.phiBlockedCells > 0 && (
          <div className="flex items-start gap-2 p-3 rounded-md bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800">
            <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5" />
            <div className="text-sm">
              <span className="font-medium text-amber-700 dark:text-amber-400">
                PHI Detected
              </span>
              <p className="text-amber-600 dark:text-amber-500 mt-1">
                {progress.phiBlockedCells} cell(s) were blocked due to PHI detection.
                Review in the Quarantine panel before proceeding.
              </p>
            </div>
          </div>
        )}
        
        {/* Activity Feed */}
        {showDetails && recentJobs.length > 0 && (
          <div className="border rounded-md">
            <div className="px-3 py-2 border-b bg-muted/30">
              <span className="text-sm font-medium">Recent Activity</span>
            </div>
            <ScrollArea className="h-[150px]">
              <div className="p-2 space-y-1">
                {recentJobs.map((job) => (
                  <div
                    key={job.id}
                    className="flex items-center gap-2 p-2 rounded-md hover:bg-muted/50 text-sm"
                  >
                    <StatusIcon status={job.status} />
                    <span className="flex-1 truncate">
                      Row {job.rowIndex + 1}, {job.column}
                    </span>
                    {job.tier && (
                      <Badge variant="outline" className="text-xs">
                        {job.tier}
                      </Badge>
                    )}
                    {job.error && (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger>
                            <AlertTriangle className="h-3 w-3 text-red-500" />
                          </TooltipTrigger>
                          <TooltipContent className="max-w-[300px]">
                            {job.error}
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    )}
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>
        )}
      </CardContent>
      
      <CardFooter className="text-xs text-muted-foreground">
        <div className="flex items-center gap-4">
          <span>Job ID: {progress.jobId}</span>
          <span>Tokens: {progress.totalTokens.toLocaleString()}</span>
        </div>
      </CardFooter>
    </Card>
  );
}

export default ExtractionProgressPanel;
