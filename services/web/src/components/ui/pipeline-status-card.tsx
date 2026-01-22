import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  CheckCircle2,
  XCircle,
  Clock,
  Loader2,
  ChevronDown,
  ChevronRight,
  FileBox,
  ExternalLink,
} from "lucide-react";
import { Link } from "wouter";
import type { RunManifest, ManifestEntry } from "@packages/core/types/run-manifest";

interface PipelineStatusCardProps {
  run: RunManifest;
  onSelect?: (runId: string) => void;
  isSelected?: boolean;
}

const STATUS_CONFIG: Record<string, {
  icon: typeof Clock;
  label: string;
  color: string;
  bgColor: string;
  borderColor: string;
  iconClass?: string;
}> = {
  pending: {
    icon: Clock,
    label: "Pending",
    color: "text-amber-500",
    bgColor: "bg-amber-500/10",
    borderColor: "border-amber-500/30",
  },
  running: {
    icon: Loader2,
    label: "Running",
    color: "text-ros-primary",
    bgColor: "bg-ros-primary/10",
    borderColor: "border-ros-primary/30",
    iconClass: "animate-spin",
  },
  completed: {
    icon: CheckCircle2,
    label: "Completed",
    color: "text-ros-success",
    bgColor: "bg-ros-success/10",
    borderColor: "border-ros-success/30",
  },
  failed: {
    icon: XCircle,
    label: "Failed",
    color: "text-ros-alert",
    bgColor: "bg-ros-alert/10",
    borderColor: "border-ros-alert/30",
  },
};

function formatDate(dateString: string | null): string {
  if (!dateString) return "—";
  return new Date(dateString).toLocaleString();
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat(formatBytes(bytes, 1).split(" ")[0])} ${sizes[i]}`;
}

function ArtifactItem({ artifact }: { artifact: ManifestEntry }) {
  return (
    <div
      className="flex items-center justify-between py-2 px-3 rounded-md bg-muted/50"
      data-testid={`artifact-item-${artifact.artifactId}`}
    >
      <div className="flex items-center gap-2 min-w-0">
        <FileBox className="h-4 w-4 text-muted-foreground flex-shrink-0" />
        <div className="min-w-0">
          <p className="text-sm font-medium truncate">{artifact.filename}</p>
          <p className="text-xs text-muted-foreground font-mono truncate">
            {artifact.sha256.slice(0, 16)}...
          </p>
        </div>
      </div>
      <Badge variant="outline" className="text-xs ml-2 flex-shrink-0">
        {formatBytes(artifact.sizeBytes)}
      </Badge>
    </div>
  );
}

export function PipelineStatusCard({
  run,
  onSelect,
  isSelected = false,
}: PipelineStatusCardProps) {
  const [isArtifactsOpen, setIsArtifactsOpen] = useState(false);
  const statusConfig = STATUS_CONFIG[run.status];
  const StatusIcon = statusConfig.icon;

  const validatedCount = run.artifacts.length;
  const totalSize = run.artifacts.reduce((acc, a) => acc + a.sizeBytes, 0);

  return (
    <Card
      className={`transition-all ${isSelected ? "ring-2 ring-ros-primary" : ""}`}
      data-testid={`pipeline-status-card-${run.runId}`}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <CardTitle className="text-base flex items-center gap-2 flex-wrap">
              <span className="font-mono text-sm truncate">{run.runId}</span>
              <Badge
                variant="outline"
                className={`${statusConfig.bgColor} ${statusConfig.color} ${statusConfig.borderColor}`}
                data-testid={`status-badge-${run.status}`}
              >
                <StatusIcon
                  className={`h-3 w-3 mr-1 ${statusConfig.iconClass || ""}`}
                />
                {statusConfig.label}
              </Badge>
            </CardTitle>
            <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground flex-wrap">
              <span>Started: {formatDate(run.startedAt)}</span>
              {run.completedAt && (
                <span>Completed: {formatDate(run.completedAt)}</span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {onSelect && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => onSelect(run.runId)}
                data-testid={`button-view-run-${run.runId}`}
              >
                View Details
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-4 flex-wrap">
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge variant="secondary" className="text-xs">
                v{run.pipelineVersion}
              </Badge>
            </TooltipTrigger>
            <TooltipContent>Pipeline Version</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge variant="outline" className="text-xs">
                {run.config.ros_mode}
              </Badge>
            </TooltipTrigger>
            <TooltipContent>ROS Mode</TooltipContent>
          </Tooltip>
          {run.config.mock_only && (
            <Badge variant="outline" className="text-xs bg-amber-500/10 text-amber-600 border-amber-500/30">
              Mock Only
            </Badge>
          )}
          {run.config.no_network && (
            <Badge variant="outline" className="text-xs">
              Offline
            </Badge>
          )}
        </div>

        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Validation Summary</span>
          <Badge
            variant="outline"
            className={
              validatedCount > 0
                ? "bg-ros-success/10 text-ros-success border-ros-success/30"
                : "bg-muted"
            }
            data-testid="validation-summary-badge"
          >
            {validatedCount} artifact{validatedCount !== 1 ? "s" : ""} • {formatBytes(totalSize)}
          </Badge>
        </div>

        {run.artifacts.length > 0 && (
          <Collapsible open={isArtifactsOpen} onOpenChange={setIsArtifactsOpen}>
            <CollapsibleTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="w-full justify-between"
                data-testid="button-toggle-artifacts"
              >
                <span className="flex items-center gap-2">
                  <FileBox className="h-4 w-4" />
                  Artifacts ({run.artifacts.length})
                </span>
                {isArtifactsOpen ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-2 mt-2">
              {run.artifacts.map((artifact) => (
                <ArtifactItem key={artifact.artifactId} artifact={artifact} />
              ))}
            </CollapsibleContent>
          </Collapsible>
        )}

        {run.deterministicHash && (
          <div className="pt-2 border-t">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Deterministic Hash</span>
              <code className="font-mono text-muted-foreground">
                {run.deterministicHash.slice(0, 16)}...
              </code>
            </div>
          </div>
        )}

        <div className="pt-2 border-t">
          <Link href="/">
            <Button variant="ghost" size="sm" className="text-xs gap-1" data-testid="link-workflow-stages">
              <ExternalLink className="h-3 w-3" />
              View Workflow Stages
            </Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
