import { Badge } from "@/components/ui/badge";
import { GitBranch, AlertTriangle, CheckCircle, Loader2 } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useQuery } from "@tanstack/react-query";
import type { WorkflowStage } from "@packages/core/types";

interface TopicVersionBadgeProps {
  versionHash: string;
  onClick?: () => void;
  size?: "sm" | "default";
  showFullHash?: boolean;
}

export function TopicVersionBadge({
  versionHash,
  onClick,
  size = "default",
  showFullHash = false,
}: TopicVersionBadgeProps) {
  const displayHash = showFullHash ? versionHash : versionHash.slice(0, 8);
  
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Badge
          variant="outline"
          className={`gap-1 cursor-pointer bg-ros-primary/10 text-ros-primary border-ros-primary/30 ${
            size === "sm" ? "text-[10px] px-1.5 py-0.5" : "text-xs"
          }`}
          onClick={onClick}
          data-testid="badge-topic-version-hash"
        >
          <GitBranch className={size === "sm" ? "h-2.5 w-2.5" : "h-3 w-3"} />
          <span className="font-mono">{displayHash}</span>
        </Badge>
      </TooltipTrigger>
      <TooltipContent>
        <p className="text-xs">Topic Version: {versionHash}</p>
      </TooltipContent>
    </Tooltip>
  );
}

interface OutdatedCheckResponse {
  topicId: string;
  currentVersion: number;
  currentVersionTag: string;
  executedVersion: number;
  isOutdated: boolean;
  versionDelta: number;
  requiresRerun: boolean;
  mode: string;
}

interface OutdatedWarningProps {
  currentTopicVersion: string;
  stageTopicVersion: string;
  stageName?: string;
  size?: "sm" | "default";
}

export function OutdatedWarning({
  currentTopicVersion,
  stageTopicVersion,
  stageName,
  size = "default",
}: OutdatedWarningProps) {
  const isOutdated = currentTopicVersion !== stageTopicVersion;
  
  if (!isOutdated) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge
            variant="outline"
            className={`gap-1 bg-ros-success/10 text-ros-success border-ros-success/30 ${
              size === "sm" ? "text-[10px] px-1.5 py-0.5" : "text-xs"
            }`}
            data-testid="badge-stage-current"
          >
            <CheckCircle className={size === "sm" ? "h-2.5 w-2.5" : "h-3 w-3"} />
            Current
          </Badge>
        </TooltipTrigger>
        <TooltipContent>
          <p className="text-xs">Stage output is based on current topic version</p>
        </TooltipContent>
      </Tooltip>
    );
  }
  
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Badge
          variant="outline"
          className={`gap-1 bg-ros-alert/10 text-ros-alert border-ros-alert/30 ${
            size === "sm" ? "text-[10px] px-1.5 py-0.5" : "text-xs"
          }`}
          data-testid="badge-stage-outdated"
        >
          <AlertTriangle className={size === "sm" ? "h-2.5 w-2.5" : "h-3 w-3"} />
          Outdated
        </Badge>
      </TooltipTrigger>
      <TooltipContent>
        <div className="text-xs space-y-1">
          <p className="font-medium">Topic has changed since {stageName || "stage"} was executed</p>
          <p className="text-muted-foreground">
            Executed with: <span className="font-mono">{stageTopicVersion.slice(0, 8)}</span>
          </p>
          <p className="text-muted-foreground">
            Current: <span className="font-mono">{currentTopicVersion.slice(0, 8)}</span>
          </p>
        </div>
      </TooltipContent>
    </Tooltip>
  );
}

interface OutdatedWarningWithAPIProps {
  topicId: string;
  stageExecutedVersion: number;
  stageName?: string;
  size?: "sm" | "default";
}

export function OutdatedWarningWithAPI({
  topicId,
  stageExecutedVersion,
  stageName,
  size = "default",
}: OutdatedWarningWithAPIProps) {
  const { data, isLoading, error } = useQuery<OutdatedCheckResponse>({
    queryKey: ['/api/ros/topics', topicId, 'outdated-check', { stageExecutedVersion }],
    queryFn: async () => {
      const res = await fetch(
        `/api/ros/topics/${topicId}/outdated-check?stageExecutedVersion=${stageExecutedVersion}`,
        { credentials: 'include' }
      );
      if (!res.ok) throw new Error('Failed to check outdated status');
      return res.json();
    },
    enabled: !!topicId && stageExecutedVersion > 0,
    staleTime: 30000,
  });

  if (isLoading) {
    return (
      <Badge
        variant="outline"
        className={`gap-1 bg-muted text-muted-foreground border-muted ${
          size === "sm" ? "text-[10px] px-1.5 py-0.5" : "text-xs"
        }`}
        data-testid="badge-stage-loading"
      >
        <Loader2 className={`animate-spin ${size === "sm" ? "h-2.5 w-2.5" : "h-3 w-3"}`} />
        Checking
      </Badge>
    );
  }

  if (error || !data) {
    return null;
  }

  if (!data.isOutdated) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge
            variant="outline"
            className={`gap-1 bg-ros-success/10 text-ros-success border-ros-success/30 ${
              size === "sm" ? "text-[10px] px-1.5 py-0.5" : "text-xs"
            }`}
            data-testid="badge-stage-current"
          >
            <CheckCircle className={size === "sm" ? "h-2.5 w-2.5" : "h-3 w-3"} />
            Current
          </Badge>
        </TooltipTrigger>
        <TooltipContent>
          <p className="text-xs">Stage output is based on current topic version</p>
        </TooltipContent>
      </Tooltip>
    );
  }
  
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Badge
          variant="outline"
          className={`gap-1 bg-ros-alert/10 text-ros-alert border-ros-alert/30 ${
            size === "sm" ? "text-[10px] px-1.5 py-0.5" : "text-xs"
          }`}
          data-testid="badge-stage-outdated"
        >
          <AlertTriangle className={size === "sm" ? "h-2.5 w-2.5" : "h-3 w-3"} />
          Outdated
        </Badge>
      </TooltipTrigger>
      <TooltipContent>
        <div className="text-xs space-y-1">
          <p className="font-medium">Topic has changed since {stageName || "stage"} was executed</p>
          <p className="text-muted-foreground">
            Executed with: v{data.executedVersion}
          </p>
          <p className="text-muted-foreground">
            Current: v{data.currentVersion} ({data.currentVersionTag.slice(0, 8)})
          </p>
          {data.versionDelta > 1 && (
            <p className="text-ros-alert font-medium">
              {data.versionDelta} versions behind
            </p>
          )}
        </div>
      </TooltipContent>
    </Tooltip>
  );
}

interface StageVersionBadgeProps {
  stage: WorkflowStage;
  currentTopicVersion: string;
  size?: "sm" | "default";
}

export function StageVersionBadge({
  stage,
  currentTopicVersion,
  size = "default",
}: StageVersionBadgeProps) {
  if (stage.status !== "completed" || !stage.topicVersionAtExecution) {
    return null;
  }
  
  return (
    <div className="flex items-center gap-1" data-testid="stage-version-badge-container">
      <TopicVersionBadge
        versionHash={stage.topicVersionAtExecution}
        size={size}
      />
      <OutdatedWarning
        currentTopicVersion={currentTopicVersion}
        stageTopicVersion={stage.topicVersionAtExecution}
        stageName={stage.shortName}
        size={size}
      />
    </div>
  );
}

interface StageVersionBadgeWithAPIProps {
  stage: WorkflowStage;
  topicId: string;
  stageExecutedVersion?: number;
  size?: "sm" | "default";
}

export function StageVersionBadgeWithAPI({
  stage,
  topicId,
  stageExecutedVersion,
  size = "default",
}: StageVersionBadgeWithAPIProps) {
  if (stage.status !== "completed" || !stage.topicVersionAtExecution) {
    return null;
  }
  
  const execVersion = stageExecutedVersion || parseInt(stage.topicVersionAtExecution, 10) || 1;
  
  return (
    <div className="flex items-center gap-1" data-testid="stage-version-badge-api-container">
      <TopicVersionBadge
        versionHash={stage.topicVersionAtExecution}
        size={size}
      />
      <OutdatedWarningWithAPI
        topicId={topicId}
        stageExecutedVersion={execVersion}
        stageName={stage.shortName}
        size={size}
      />
    </div>
  );
}
