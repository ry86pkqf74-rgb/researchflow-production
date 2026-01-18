import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { SystemStatusCard } from "@/components/ui/system-status-card";
import { DatasetStatusCard, type Dataset } from "@/components/ui/dataset-status-card";
import { ProgressStepper, type PhaseGroupInfo } from "@/components/ui/progress-stepper";
import { CostUsagePanel } from "@/components/ui/cost-usage-panel";
import { PanelLeft, X, Hash, Clock } from "lucide-react";
import { cn } from "@/lib/utils";

interface WorkflowSidebarProps {
  phases: PhaseGroupInfo[];
  currentStageId?: number;
  dataset?: Dataset | null;
  onStageSelect?: (stageId: number) => void;
  isOpen: boolean;
  onToggle: () => void;
}

// Helper function to calculate overall completion percentage
function calculateOverallProgress(phases: PhaseGroupInfo[]): number {
  const totalStages = phases.reduce((sum, phase) => sum + phase.stages.length, 0);
  if (totalStages === 0) return 0;

  const completedStages = phases.reduce((sum, phase) => {
    return (
      sum +
      phase.stages.filter((stage) => stage.status === "completed").length
    );
  }, 0);

  return Math.round((completedStages / totalStages) * 100);
}

// Helper function to get total and completed stage counts
function getStageCounts(phases: PhaseGroupInfo[]): { completed: number; total: number } {
  const total = phases.reduce((sum, phase) => sum + phase.stages.length, 0);
  const completed = phases.reduce((sum, phase) => {
    return (
      sum +
      phase.stages.filter((stage) => stage.status === "completed").length
    );
  }, 0);
  return { completed, total };
}

// Helper function to calculate phase completion percentage
function getPhaseProgress(phase: PhaseGroupInfo): number {
  if (phase.stages.length === 0) return 0;
  const completed = phase.stages.filter((s) => s.status === "completed").length;
  return Math.round((completed / phase.stages.length) * 100);
}

// Helper function to determine phase status color
function getPhaseStatusColor(phase: PhaseGroupInfo): "default" | "secondary" | "destructive" | "outline" {
  const progress = getPhaseProgress(phase);
  const hasActiveStage = phase.stages.some((s) => s.status === "active");

  if (progress === 100) {
    return "default"; // Green in Tailwind (primary color)
  } else if (progress > 0 || hasActiveStage) {
    return "secondary"; // Yellow/warning for in-progress
  } else {
    return "outline"; // Gray for not started
  }
}

export function WorkflowSidebar({
  phases,
  currentStageId,
  dataset,
  onStageSelect,
  isOpen,
  onToggle,
}: WorkflowSidebarProps) {
  const [researchId, setResearchId] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sessionStart] = useState(() => new Date().toISOString());

  useEffect(() => {
    // Generate research ID on mount via ROS backend
    const generateIds = async () => {
      try {
        const res = await fetch("/api/ros/research/generate-id", { method: "POST" });
        const data = await res.json();
        setResearchId(data.research_id);
        setSessionId(data.session_id);
      } catch {
        // Fallback to client-side generation
        const timestamp = new Date().toISOString().replace(/[-:TZ.]/g, "").slice(0, 14);
        const uniqueSuffix = Math.random().toString(36).substring(2, 8).toUpperCase();
        setResearchId(`ROS-${timestamp}-${uniqueSuffix}`);
        setSessionId(`SES-${Math.random().toString(36).substring(2, 10).toUpperCase()}`);
      }
    };
    generateIds();
  }, []);

  return (
    <>
      {/* Toggle button when sidebar is closed */}
      {!isOpen && (
        <Button
          variant="outline"
          size="icon"
          onClick={onToggle}
          className="fixed left-4 top-20 z-40 bg-card shadow-md"
          data-testid="button-workflow-sidebar-toggle"
        >
          <PanelLeft className="h-4 w-4" />
        </Button>
      )}

      {/* Sidebar panel */}
      <div
        className={cn(
          "fixed left-0 top-0 z-40 h-full bg-card border-r shadow-lg transition-all duration-300 ease-in-out",
          isOpen ? "w-[280px] translate-x-0" : "w-0 -translate-x-full"
        )}
        data-testid="workflow-sidebar"
      >
        <div className="flex h-full flex-col">
          {/* Header */}
          <div className="flex items-center justify-between border-b p-4">
            <h2 className="text-sm font-semibold">Workflow Status</h2>
            <Button
              variant="ghost"
              size="icon"
              onClick={onToggle}
              data-testid="button-workflow-sidebar-close"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Scrollable content area */}
          <ScrollArea className="flex-1 p-4">
            <div className="space-y-4">
              {/* System Status Card - compact */}
              <div data-testid="sidebar-system-status">
                <SystemStatusCard variant="compact" />
              </div>

              {/* Dataset Status Card - compact with operations */}
              {dataset && (
                <div data-testid="sidebar-dataset-status">
                  <DatasetStatusCard variant="compact" dataset={dataset} showOperations />
                </div>
              )}

              {/* Progress Stepper - compact */}
              <div data-testid="sidebar-progress-stepper">
                <ProgressStepper
                  phases={phases}
                  currentStageId={currentStageId}
                  onStageSelect={onStageSelect}
                  variant="compact"
                />
              </div>

              {/* Cost & Usage Panel */}
              <div data-testid="sidebar-cost-usage">
                <CostUsagePanel variant="compact" />
              </div>

              {/* Workflow Progress Card */}
              <Card data-testid="card-workflow-progress">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Workflow Progress</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Overall Progress Bar */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium">Overall Progress</span>
                      <span className="text-xs font-semibold">
                        {calculateOverallProgress(phases)}%
                      </span>
                    </div>
                    <Progress
                      value={calculateOverallProgress(phases)}
                      className="h-2"
                      data-testid="progress-overall"
                    />
                  </div>

                  {/* Stage Count */}
                  <div className="rounded-sm bg-secondary/50 px-3 py-2">
                    <div className="text-xs text-muted-foreground mb-1">Stages Completed</div>
                    <div className="text-sm font-semibold" data-testid="text-stages-completed">
                      {getStageCounts(phases).completed} of {getStageCounts(phases).total}
                    </div>
                  </div>

                  {/* Phase-Level Progress */}
                  <div className="space-y-2">
                    <div className="text-xs font-medium text-muted-foreground">By Phase</div>
                    <div className="space-y-2">
                      {phases.map((phase) => {
                        const completedInPhase = phase.stages.filter(
                          (s) => s.status === "completed"
                        ).length;
                        const statusColor = getPhaseStatusColor(phase);

                        return (
                          <div
                            key={phase.id}
                            className="flex items-center justify-between gap-2"
                            data-testid={`phase-progress-${phase.id}`}
                          >
                            <span className="text-xs truncate flex-1">{phase.shortName}</span>
                            <Badge
                              variant={statusColor}
                              className="text-xs whitespace-nowrap"
                              data-testid={`badge-phase-${phase.id}`}
                            >
                              {completedInPhase}/{phase.stages.length}
                            </Badge>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Session Stats with Research-ID */}
              <Card data-testid="card-session-stats">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Hash className="h-4 w-4" />
                    Session Info
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {researchId && (
                    <div className="space-y-1">
                      <div className="text-xs text-muted-foreground" data-testid="label-research-id">Research ID</div>
                      <Badge variant="outline" className="font-mono text-xs" data-testid="badge-research-id">
                        {researchId}
                      </Badge>
                    </div>
                  )}
                  {sessionId && (
                    <div className="space-y-1">
                      <div className="text-xs text-muted-foreground" data-testid="label-session-id">Session</div>
                      <Badge variant="secondary" className="font-mono text-xs" data-testid="badge-session-id">
                        {sessionId}
                      </Badge>
                    </div>
                  )}
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground pt-1" data-testid="text-session-start">
                    <Clock className="h-3 w-3" />
                    Started: {new Date(sessionStart).toLocaleTimeString()}
                  </div>
                </CardContent>
              </Card>
            </div>
          </ScrollArea>

          {/* Footer with close button */}
          <div className="border-t p-4">
            <Button
              variant="outline"
              className="w-full"
              onClick={onToggle}
              data-testid="button-workflow-sidebar-close-bottom"
            >
              Close Panel
            </Button>
          </div>
        </div>
      </div>

      {/* Overlay when sidebar is open (for mobile) */}
      {isOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/20 md:hidden"
          onClick={onToggle}
          data-testid="workflow-sidebar-overlay"
        />
      )}
    </>
  );
}
