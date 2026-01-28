/**
 * Stage Detail Panel (Phase 4C - RUN-003)
 *
 * Displays detailed information about a specific run stage.
 * Shows inputs, outputs, progress bar, and error messages.
 *
 * Features:
 * - Stage metadata (name, status, duration)
 * - Input parameters display
 * - Output artifacts listing
 * - Progress bar with percentage
 * - Error details for failed stages
 * - Expandable sections for detailed data
 */

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { cn } from '@/lib/utils';
import {
  ChevronDown,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Code2,
  FileText,
} from 'lucide-react';

export type StageStatusType = 'pending' | 'running' | 'completed' | 'failed' | 'skipped';

export interface StageInput {
  name: string;
  type: string;
  value: string;
  description?: string;
}

export interface StageOutput {
  id: string;
  name: string;
  type: string;
  size: number;
  createdAt: string;
  url?: string;
}

export interface StageDetailData {
  id: number;
  name: string;
  description?: string;
  status: StageStatusType;
  startedAt?: string;
  completedAt?: string;
  duration?: number; // milliseconds
  progress?: number; // 0-100
  inputs: StageInput[];
  outputs: StageOutput[];
  error?: string;
  logs?: string[];
}

interface StageDetailProps {
  stage?: StageDetailData;
  isLoading?: boolean;
  className?: string;
}

function formatDuration(milliseconds: number): string {
  const seconds = Math.floor(milliseconds / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ${seconds % 60}s`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ${minutes % 60}m`;
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}

const statusBadgeVariant: Record<StageStatusType, 'default' | 'secondary' | 'outline' | 'destructive'> = {
  pending: 'outline',
  running: 'default',
  completed: 'default',
  failed: 'destructive',
  skipped: 'secondary',
};

export function StageDetail({ stage, isLoading, className }: StageDetailProps) {
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(['outputs'])
  );

  const toggleSection = (section: string) => {
    const next = new Set(expandedSections);
    if (next.has(section)) {
      next.delete(section);
    } else {
      next.add(section);
    }
    setExpandedSections(next);
  };

  if (isLoading) {
    return (
      <Card className={className}>
        <CardContent className="flex items-center justify-center p-8">
          <div className="text-center">
            <div className="animate-spin h-8 w-8 border-4 border-gray-300 border-t-blue-600 rounded-full mx-auto mb-2" />
            <p className="text-sm text-gray-600">Loading stage details...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!stage) {
    return (
      <Card className={className}>
        <CardContent className="flex items-center justify-center p-8">
          <p className="text-sm text-gray-600">Select a stage to view details</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <CardTitle className="text-lg">Stage {stage.id}: {stage.name}</CardTitle>
            {stage.description && (
              <p className="text-sm text-gray-600 mt-1">{stage.description}</p>
            )}
          </div>
          <Badge variant={statusBadgeVariant[stage.status]}>
            {stage.status.charAt(0).toUpperCase() + stage.status.slice(1)}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Timeline Info */}
        <div className="grid grid-cols-3 gap-3 text-sm">
          {stage.startedAt && (
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-gray-500" />
              <div>
                <p className="text-xs text-gray-600">Started</p>
                <p className="font-medium text-xs">
                  {new Date(stage.startedAt).toLocaleTimeString()}
                </p>
              </div>
            </div>
          )}

          {stage.completedAt && (
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <div>
                <p className="text-xs text-gray-600">Completed</p>
                <p className="font-medium text-xs">
                  {new Date(stage.completedAt).toLocaleTimeString()}
                </p>
              </div>
            </div>
          )}

          {stage.duration && (
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-gray-500" />
              <div>
                <p className="text-xs text-gray-600">Duration</p>
                <p className="font-medium text-xs">{formatDuration(stage.duration)}</p>
              </div>
            </div>
          )}
        </div>

        {/* Progress Bar */}
        {stage.status === 'running' && stage.progress !== undefined && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">Progress</p>
              <p className="text-sm text-gray-600">{stage.progress}%</p>
            </div>
            <Progress value={stage.progress} className="h-2" />
          </div>
        )}

        {/* Error Alert */}
        {stage.error && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Stage Failed</AlertTitle>
            <AlertDescription className="mt-2">{stage.error}</AlertDescription>
          </Alert>
        )}

        {/* Inputs Section */}
        {stage.inputs.length > 0 && (
          <Collapsible
            open={expandedSections.has('inputs')}
            onOpenChange={() => toggleSection('inputs')}
          >
            <CollapsibleTrigger asChild>
              <button className="flex w-full items-center justify-between p-3 rounded-lg border hover:bg-gray-50 transition-colors">
                <div className="flex items-center gap-2">
                  <Code2 className="h-4 w-4 text-gray-600" />
                  <span className="font-medium text-sm">
                    Inputs ({stage.inputs.length})
                  </span>
                </div>
                <ChevronDown
                  className={cn(
                    'h-4 w-4 transition-transform',
                    expandedSections.has('inputs') && 'rotate-180'
                  )}
                />
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent className="border-t p-3 space-y-3">
              {stage.inputs.map((input, idx) => (
                <div key={idx} className="space-y-1">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium">{input.name}</p>
                    <Badge variant="outline" className="text-xs">
                      {input.type}
                    </Badge>
                  </div>
                  {input.description && (
                    <p className="text-xs text-gray-600">{input.description}</p>
                  )}
                  <pre className="bg-gray-50 p-2 rounded text-xs overflow-x-auto border">
                    {input.value}
                  </pre>
                </div>
              ))}
            </CollapsibleContent>
          </Collapsible>
        )}

        {/* Outputs Section */}
        {stage.outputs.length > 0 && (
          <Collapsible
            open={expandedSections.has('outputs')}
            onOpenChange={() => toggleSection('outputs')}
          >
            <CollapsibleTrigger asChild>
              <button className="flex w-full items-center justify-between p-3 rounded-lg border hover:bg-gray-50 transition-colors">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-gray-600" />
                  <span className="font-medium text-sm">
                    Outputs ({stage.outputs.length})
                  </span>
                </div>
                <ChevronDown
                  className={cn(
                    'h-4 w-4 transition-transform',
                    expandedSections.has('outputs') && 'rotate-180'
                  )}
                />
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent className="border-t p-3 space-y-2">
              {stage.outputs.map((output) => (
                <div
                  key={output.id}
                  className="flex items-center justify-between p-2 rounded border bg-gray-50 hover:bg-gray-100 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{output.name}</p>
                    <p className="text-xs text-gray-600">
                      {output.type} • {formatFileSize(output.size)}
                    </p>
                  </div>
                  {output.url && (
                    <a
                      href={output.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-blue-600 hover:underline ml-2"
                    >
                      View
                    </a>
                  )}
                </div>
              ))}
            </CollapsibleContent>
          </Collapsible>
        )}

        {/* Logs Section */}
        {stage.logs && stage.logs.length > 0 && (
          <Collapsible
            open={expandedSections.has('logs')}
            onOpenChange={() => toggleSection('logs')}
          >
            <CollapsibleTrigger asChild>
              <button className="flex w-full items-center justify-between p-3 rounded-lg border hover:bg-gray-50 transition-colors">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-gray-600" />
                  <span className="font-medium text-sm">
                    Logs ({stage.logs.length} lines)
                  </span>
                </div>
                <ChevronDown
                  className={cn(
                    'h-4 w-4 transition-transform',
                    expandedSections.has('logs') && 'rotate-180'
                  )}
                />
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent className="border-t p-3">
              <pre className="bg-gray-900 text-gray-100 p-3 rounded text-xs overflow-x-auto max-h-96">
                {stage.logs.join('\n')}
              </pre>
            </CollapsibleContent>
          </Collapsible>
        )}
      </CardContent>
    </Card>
  );
}

export default StageDetail;
