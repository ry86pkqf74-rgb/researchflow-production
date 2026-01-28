/**
 * Run Timeline Component (Phase 4C - RUN-002)
 *
 * Displays all 20 stages of a research run with status indicators.
 * Shows stage progression, duration, and artifact count.
 * Stages are clickable for detailed inspection.
 *
 * Features:
 * - 20-stage timeline visualization
 * - Status icons (pending/running/completed/failed/skipped)
 * - Duration display for completed stages
 * - Artifact count per stage
 * - Clickable stages with callbacks
 * - Responsive horizontal timeline
 */

import React, { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import {
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  SkipForward,
  Zap,
} from 'lucide-react';

export type StageStatusType = 'pending' | 'running' | 'completed' | 'failed' | 'skipped';

export interface TimelineStage {
  id: number;
  name: string;
  status: StageStatusType;
  startedAt?: string;
  completedAt?: string;
  duration?: number; // in milliseconds
  artifactCount: number;
  progress?: number; // 0-100 for running stages
}

interface RunTimelineProps {
  stages: TimelineStage[];
  currentStageId?: number;
  onStageClick?: (stageId: number) => void;
  className?: string;
}

const stageIcons: Record<StageStatusType, React.ReactNode> = {
  pending: <Clock className="h-4 w-4" />,
  running: <Zap className="h-4 w-4 animate-pulse" />,
  completed: <CheckCircle2 className="h-4 w-4" />,
  failed: <XCircle className="h-4 w-4" />,
  skipped: <SkipForward className="h-4 w-4" />,
};

const statusColors: Record<StageStatusType, string> = {
  pending: 'bg-gray-100 text-gray-700 border-gray-300',
  running: 'bg-blue-100 text-blue-700 border-blue-300 ring-2 ring-blue-200',
  completed: 'bg-green-100 text-green-700 border-green-300',
  failed: 'bg-red-100 text-red-700 border-red-300',
  skipped: 'bg-gray-50 text-gray-500 border-gray-200',
};

const statusIconColors: Record<StageStatusType, string> = {
  pending: 'text-gray-500',
  running: 'text-blue-600',
  completed: 'text-green-600',
  failed: 'text-red-600',
  skipped: 'text-gray-400',
};

function formatDuration(milliseconds: number): string {
  const seconds = Math.floor(milliseconds / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ${seconds % 60}s`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ${minutes % 60}m`;
}

export function RunTimeline({
  stages,
  currentStageId,
  onStageClick,
  className,
}: RunTimelineProps) {
  const [selectedStageId, setSelectedStageId] = useState<number | undefined>(currentStageId);

  const handleStageClick = (stageId: number) => {
    setSelectedStageId(stageId);
    onStageClick?.(stageId);
  };

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">Run Timeline</CardTitle>
      </CardHeader>
      <CardContent>
        <ScrollArea className="w-full">
          <div className="flex gap-2 pb-4 min-w-max px-1">
            {stages.map((stage) => (
              <button
                key={stage.id}
                onClick={() => handleStageClick(stage.id)}
                className={cn(
                  'flex flex-col items-center gap-1.5 p-3 rounded-lg border transition-all duration-200',
                  'hover:shadow-md hover:scale-105 active:scale-95',
                  statusColors[stage.status],
                  selectedStageId === stage.id && 'ring-2 ring-offset-2 ring-blue-500'
                )}
              >
                {/* Stage Icon */}
                <div className={statusIconColors[stage.status]}>
                  {stageIcons[stage.status]}
                </div>

                {/* Stage Name/Number */}
                <div className="text-center">
                  <p className="text-xs font-semibold whitespace-nowrap max-w-[80px] truncate">
                    Stage {stage.id}
                  </p>
                </div>

                {/* Progress for running stages */}
                {stage.status === 'running' && stage.progress !== undefined && (
                  <div className="w-full bg-white/50 rounded h-1">
                    <div
                      className="bg-blue-600 h-full rounded transition-all duration-300"
                      style={{ width: `${stage.progress}%` }}
                    />
                  </div>
                )}

                {/* Duration for completed/failed stages */}
                {(stage.status === 'completed' || stage.status === 'failed') &&
                  stage.duration && (
                    <Badge variant="secondary" className="text-xs">
                      {formatDuration(stage.duration)}
                    </Badge>
                  )}

                {/* Artifact count */}
                {stage.artifactCount > 0 && (
                  <Badge variant="outline" className="text-xs">
                    {stage.artifactCount} artifact{stage.artifactCount > 1 ? 's' : ''}
                  </Badge>
                )}
              </button>
            ))}
          </div>
        </ScrollArea>

        {/* Selected Stage Details */}
        {selectedStageId !== undefined && (
          <div className="mt-4 pt-4 border-t">
            {(() => {
              const stage = stages.find((s) => s.id === selectedStageId);
              if (!stage) return null;

              return (
                <div className="space-y-2 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">Stage {stage.id}</span>
                    <Badge variant="outline">
                      {stage.status.charAt(0).toUpperCase() + stage.status.slice(1)}
                    </Badge>
                  </div>

                  {stage.startedAt && (
                    <p className="text-gray-600">
                      Started: {new Date(stage.startedAt).toLocaleTimeString()}
                    </p>
                  )}

                  {stage.completedAt && (
                    <p className="text-gray-600">
                      Completed: {new Date(stage.completedAt).toLocaleTimeString()}
                    </p>
                  )}

                  {stage.duration && (
                    <p className="text-gray-600">
                      Duration: {formatDuration(stage.duration)}
                    </p>
                  )}

                  {stage.artifactCount > 0 && (
                    <p className="text-gray-600">
                      Artifacts: {stage.artifactCount}
                    </p>
                  )}

                  {stage.status === 'running' && stage.progress !== undefined && (
                    <div className="space-y-1">
                      <p className="text-gray-600">Progress: {stage.progress}%</p>
                      <div className="bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-blue-600 h-full rounded-full transition-all duration-300"
                          style={{ width: `${stage.progress}%` }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default RunTimeline;
