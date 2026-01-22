import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ArrowLeft,
  Activity,
  GitBranch,
  RefreshCw,
  Clock,
  CheckCircle2,
  XCircle,
  Loader2,
  FileBox,
  ExternalLink,
} from "lucide-react";
import { Link } from "wouter";
import { PipelineStatusCard } from "@/components/ui/pipeline-status-card";
import { ProvenanceSummary } from "@/components/ui/provenance-summary";
import type { RunManifest } from "@packages/core/types/run-manifest";

interface ProvenanceEntry {
  artifactId: string;
  filename: string;
  sha256: string;
  sizeBytes: number;
  createdAt: string;
  createdBy: string;
  lineageParent?: string | null;
}

interface PipelineRunDetails extends RunManifest {
  provenance: ProvenanceEntry[];
}

interface PipelineRunsResponse {
  runs: RunManifest[];
  mode: string;
}

interface PipelineRunDetailsResponse {
  run: PipelineRunDetails;
  mode: string;
}

const STATUS_COUNTS_ICONS = {
  pending: Clock,
  running: Loader2,
  completed: CheckCircle2,
  failed: XCircle,
};

function StatusSummaryCard({ runs }: { runs: RunManifest[] }) {
  const counts = {
    pending: runs.filter((r) => r.status === "pending").length,
    running: runs.filter((r) => r.status === "running").length,
    completed: runs.filter((r) => r.status === "completed").length,
    failed: runs.filter((r) => r.status === "failed").length,
  };

  return (
    <Card data-testid="card-status-summary">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Activity className="h-4 w-4" />
          Pipeline Status Overview
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {(Object.entries(counts) as [keyof typeof counts, number][]).map(
            ([status, count]) => {
              const Icon = STATUS_COUNTS_ICONS[status];
              const colorMap = {
                pending: "text-amber-500",
                running: "text-ros-primary",
                completed: "text-ros-success",
                failed: "text-ros-alert",
              };
              return (
                <div
                  key={status}
                  className="text-center p-3 rounded-lg bg-muted/50"
                  data-testid={`status-count-${status}`}
                >
                  <Icon
                    className={`h-5 w-5 mx-auto mb-1 ${colorMap[status]} ${
                      status === "running" ? "animate-spin" : ""
                    }`}
                  />
                  <div className="text-2xl font-bold">{count}</div>
                  <div className="text-xs text-muted-foreground capitalize">
                    {status}
                  </div>
                </div>
              );
            }
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-32 w-full" />
      <div className="grid gap-4">
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    </div>
  );
}

export default function PipelineDashboard() {
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("runs");

  const {
    data: runsData,
    isLoading: runsLoading,
    refetch: refetchRuns,
  } = useQuery<PipelineRunsResponse>({
    queryKey: ["/api/ros/pipeline/runs"],
  });

  const {
    data: runDetailsData,
    isLoading: detailsLoading,
  } = useQuery<PipelineRunDetailsResponse>({
    queryKey: ["/api/ros/pipeline/run", selectedRunId],
    enabled: !!selectedRunId,
  });

  const runs = runsData?.runs || [];
  const currentMode = runsData?.mode || "STANDBY";
  const isStandbyMode = currentMode === "STANDBY";

  const handleSelectRun = (runId: string) => {
    setSelectedRunId(runId);
    setActiveTab("details");
  };

  const handleBackToRuns = () => {
    setSelectedRunId(null);
    setActiveTab("runs");
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-6 py-8 max-w-5xl">
        <div className="flex items-center gap-4 mb-8">
          <Link href="/workflow">
            <Button variant="ghost" size="icon" data-testid="button-back-home">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div className="flex-1">
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Activity className="h-6 w-6 text-ros-primary" />
              Pipeline Dashboard
            </h1>
            <p className="text-muted-foreground">
              Monitor pipeline execution status and artifact provenance
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge
              variant="outline"
              className={
                isStandbyMode
                  ? "bg-amber-500/10 text-amber-600 border-amber-500/30"
                  : "bg-ros-success/10 text-ros-success border-ros-success/30"
              }
              data-testid="badge-current-mode"
            >
              {currentMode}
            </Badge>
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetchRuns()}
              data-testid="button-refresh-runs"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-6 flex-wrap">
            <TabsTrigger value="runs" data-testid="tab-runs">
              <FileBox className="h-4 w-4 mr-2" />
              Pipeline Runs
            </TabsTrigger>
            <TabsTrigger
              value="details"
              disabled={!selectedRunId}
              data-testid="tab-details"
            >
              <GitBranch className="h-4 w-4 mr-2" />
              Run Details
            </TabsTrigger>
          </TabsList>

          <TabsContent value="runs" className="space-y-6">
            {runsLoading ? (
              <LoadingSkeleton />
            ) : (
              <>
                <StatusSummaryCard runs={runs} />

                {runs.length > 0 ? (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h2 className="text-lg font-semibold">Recent Runs</h2>
                      <span className="text-sm text-muted-foreground">
                        {runs.length} run{runs.length !== 1 ? "s" : ""}
                      </span>
                    </div>
                    <ScrollArea className="h-[600px] pr-4">
                      <div className="space-y-4">
                        {runs.map((run) => (
                          <PipelineStatusCard
                            key={run.runId}
                            run={run}
                            onSelect={handleSelectRun}
                            isSelected={run.runId === selectedRunId}
                          />
                        ))}
                      </div>
                    </ScrollArea>
                  </div>
                ) : (
                  <Card>
                    <CardContent className="py-12 text-center">
                      <Activity className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
                      <h3 className="text-lg font-medium mb-2">
                        No Pipeline Runs
                      </h3>
                      <p className="text-muted-foreground text-sm mb-4">
                        Pipeline runs will appear here once execution begins.
                      </p>
                      <Link href="/workflow">
                        <Button variant="outline" data-testid="link-start-workflow">
                          <ExternalLink className="h-4 w-4 mr-2" />
                          Start Workflow
                        </Button>
                      </Link>
                    </CardContent>
                  </Card>
                )}
              </>
            )}
          </TabsContent>

          <TabsContent value="details" className="space-y-6">
            {selectedRunId ? (
              <>
                <div className="flex items-center gap-2 mb-4">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleBackToRuns}
                    data-testid="button-back-to-runs"
                  >
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Back to Runs
                  </Button>
                </div>

                {detailsLoading ? (
                  <LoadingSkeleton />
                ) : runDetailsData?.run ? (
                  <div className="grid gap-6">
                    <PipelineStatusCard
                      run={runDetailsData.run}
                      isSelected
                    />
                    <ProvenanceSummary
                      entries={runDetailsData.run.provenance || []}
                      runId={runDetailsData.run.runId}
                      pipelineVersion={runDetailsData.run.pipelineVersion}
                      isStandbyMode={isStandbyMode}
                    />

                    <Card data-testid="card-workflow-links">
                      <CardHeader>
                        <CardTitle className="text-base flex items-center gap-2">
                          <ExternalLink className="h-4 w-4" />
                          Workflow Stage Links
                        </CardTitle>
                        <CardDescription>
                          Navigate to specific stages in the workflow
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="flex flex-wrap gap-2">
                          <Link href="/workflow">
                            <Button variant="outline" size="sm" data-testid="link-stage-topic">
                              Topic Declaration
                            </Button>
                          </Link>
                          <Link href="/workflow">
                            <Button variant="outline" size="sm" data-testid="link-stage-literature">
                              Literature Search
                            </Button>
                          </Link>
                          <Link href="/workflow">
                            <Button variant="outline" size="sm" data-testid="link-stage-irb">
                              IRB Proposal
                            </Button>
                          </Link>
                          <Link href="/workflow">
                            <Button variant="outline" size="sm" data-testid="link-stage-validation">
                              Data Validation
                            </Button>
                          </Link>
                          <Link href="/workflow">
                            <Button variant="outline" size="sm" data-testid="link-stage-analysis">
                              Statistical Analysis
                            </Button>
                          </Link>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                ) : (
                  <Card>
                    <CardContent className="py-12 text-center">
                      <XCircle className="h-12 w-12 mx-auto mb-4 text-ros-alert/50" />
                      <h3 className="text-lg font-medium mb-2">
                        Run Not Found
                      </h3>
                      <p className="text-muted-foreground text-sm">
                        The selected pipeline run could not be loaded.
                      </p>
                    </CardContent>
                  </Card>
                )}
              </>
            ) : (
              <Card>
                <CardContent className="py-12 text-center">
                  <GitBranch className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
                  <h3 className="text-lg font-medium mb-2">
                    Select a Run
                  </h3>
                  <p className="text-muted-foreground text-sm">
                    Choose a pipeline run from the list to view details.
                  </p>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
