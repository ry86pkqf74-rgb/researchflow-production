/**
 * Run Detail Page (Phase 4C - RUN-007)
 *
 * Complete view of a single research run with 3-column layout:
 * - Left: Run Timeline with all 20 stages
 * - Center: Stage Detail Panel with inputs/outputs
 * - Right: Artifacts and Logs tabs
 *
 * Real-time updates via useRunEvents hook.
 * Uses TanStack Query for initial data and WebSocket for live updates.
 *
 * Features:
 * - Real-time stage updates
 * - Side-by-side timeline and details
 * - Tab switcher for logs/artifacts
 * - Run control buttons (pause/resume/retry/fork)
 * - Enhanced mode banner at top
 * - Responsive on smaller screens
 */

import React, { useEffect, useState } from 'react';
import { useRoute, useLocation } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  RunTimeline,
  StageDetail,
  LogConsole,
  LiveArtifacts,
  RunControls,
  type TimelineStage,
  type StageDetailData,
  type LogEntry,
  type Artifact,
} from '@/components/runs';
import { useRunEvents } from '@/hooks/useRunEvents';
import { ArrowLeft, AlertTriangle, Loader2 } from 'lucide-react';

interface RunData {
  id: string;
  projectId: string;
  status: 'pending' | 'running' | 'paused' | 'completed' | 'failed' | 'cancelled';
  currentStageId: number;
  progress: number;
  startedAt?: string;
  completedAt?: string;
  createdBy: string;
}

interface RunDetailPageProps {
  params?: { runId: string };
}

export default function RunDetailPage() {
  const [match, params] = useRoute('/runs/:runId');
  const [, navigate] = useLocation();
  const runId = (params as any)?.runId;

  const [selectedStageId, setSelectedStageId] = useState<number>();
  const [stages, setStages] = useState<TimelineStage[]>([]);
  const [stageDetails, setStageDetails] = useState<StageDetailData | undefined>();
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [artifacts, setArtifacts] = useState<Artifact[]>([]);
  const [activeTab, setActiveTab] = useState<'logs' | 'artifacts'>('artifacts');

  // Fetch initial run data
  const { data: run, isLoading, error } = useQuery<RunData>({
    queryKey: ['run', runId],
    queryFn: async () => {
      const response = await fetch(`/api/runs/${runId}`, { credentials: 'include' });
      if (!response.ok) throw new Error('Failed to fetch run');
      return response.json();
    },
    enabled: !!runId,
    refetchInterval: 5000, // Fallback polling
  });

  // Subscribe to run events via WebSocket
  const { isConnected, subscribe } = useRunEvents({
    runId,
    autoConnect: true,
  });

  // Set up WebSocket event listeners
  useEffect(() => {
    if (!runId || !isConnected) return;

    // Subscribe to stage updates
    const unsubscribeStage = subscribe('run.stage.updated', (event: any) => {
      const stage = event.payload;
      setStages((prev) =>
        prev.map((s) => (s.id === stage.id ? { ...s, ...stage } : s))
      );
    });

    // Subscribe to log events
    const unsubscribeLogs = subscribe('run.log', (event: any) => {
      const logEntry = event.payload;
      setLogs((prev) => [...prev, logEntry]);
    });

    // Subscribe to artifact created events
    const unsubscribeArtifact = subscribe('run.artifact.created', (event: any) => {
      const artifact = event.payload;
      setArtifacts((prev) => [...prev, artifact]);
    });

    // Subscribe to run completed event
    const unsubscribeComplete = subscribe('run.completed', (event: any) => {
      if (run) {
        // Update run status
      }
    });

    return () => {
      unsubscribeStage();
      unsubscribeLogs();
      unsubscribeArtifact();
      unsubscribeComplete();
    };
  }, [runId, isConnected, subscribe, run]);

  // Fetch initial stages when run loads
  useEffect(() => {
    if (!run) return;

    const fetchStages = async () => {
      try {
        const response = await fetch(`/api/runs/${runId}/stages`, {
          credentials: 'include',
        });
        if (!response.ok) throw new Error('Failed to fetch stages');
        const data = await response.json();
        setStages(data);
        if (data.length > 0) {
          setSelectedStageId(data[0].id);
        }
      } catch (err) {
        console.error('Failed to fetch stages:', err);
      }
    };

    fetchStages();
  }, [run, runId]);

  // Fetch stage details when selected stage changes
  useEffect(() => {
    if (!selectedStageId || !runId) return;

    const fetchStageDetail = async () => {
      try {
        const response = await fetch(
          `/api/runs/${runId}/stages/${selectedStageId}`,
          { credentials: 'include' }
        );
        if (!response.ok) throw new Error('Failed to fetch stage details');
        const data = await response.json();
        setStageDetails(data);
      } catch (err) {
        console.error('Failed to fetch stage details:', err);
      }
    };

    fetchStageDetail();
  }, [selectedStageId, runId]);

  if (!match) return null;

  if (!runId) {
    return (
      <div className="flex items-center justify-center h-96">
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>Invalid run ID</AlertDescription>
        </Alert>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-3 text-blue-600" />
          <p className="text-gray-600">Loading run details...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <Button
          variant="outline"
          size="sm"
          onClick={() => navigate('/runs')}
          className="mb-6"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Runs
        </Button>
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            {error instanceof Error
              ? error.message
              : 'Failed to load run details'}
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  if (!run) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate('/runs')}
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Runs
              </Button>
              <div>
                <h1 className="text-2xl font-bold">Run {runId}</h1>
                <p className="text-sm text-gray-600">
                  Started by {run.createdBy} • {run.progress}% complete
                </p>
              </div>
            </div>
            <RunControls
              status={run.status}
              onResume={() => console.log('Resume')}
              onPause={() => console.log('Pause')}
              onRetry={() => console.log('Retry')}
              onFork={() => console.log('Fork')}
            />
          </div>
        </div>
      </div>

      {/* Connection Status */}
      {!isConnected && (
        <Alert className="max-w-7xl mx-auto m-6 border-yellow-200 bg-yellow-50 text-yellow-800">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            Live updates are currently unavailable. Data will be refreshed automatically.
          </AlertDescription>
        </Alert>
      )}

      {/* Main Content - 3 Column Layout */}
      <div className="max-w-7xl mx-auto p-6">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Left Column - Timeline */}
          <div className="lg:col-span-1">
            <RunTimeline
              stages={stages}
              currentStageId={selectedStageId}
              onStageClick={setSelectedStageId}
            />
          </div>

          {/* Center Column - Stage Details */}
          <div className="lg:col-span-2">
            <StageDetail
              stage={stageDetails}
              isLoading={!stageDetails && selectedStageId !== undefined}
            />
          </div>

          {/* Right Column - Artifacts/Logs */}
          <div className="lg:col-span-1">
            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
              <TabsList className="grid w-full grid-cols-2 mb-4">
                <TabsTrigger value="artifacts">Artifacts</TabsTrigger>
                <TabsTrigger value="logs">Logs</TabsTrigger>
              </TabsList>

              <TabsContent value="artifacts" className="m-0">
                <LiveArtifacts artifacts={artifacts} />
              </TabsContent>

              <TabsContent value="logs" className="m-0">
                <LogConsole
                  logs={logs}
                  onClear={() => setLogs([])}
                />
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </div>
    </div>
  );
}
