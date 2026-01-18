"use client"

import * as React from "react"
import { CheckCircle2, Circle } from "lucide-react"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { ScrollArea } from "@/components/ui/scroll-area"
import { PhiStatusBadge } from "@/components/ui/phi-gate"
import { StageVersionBadge } from "@/components/ui/topic-version-badge"
import { stageRequiresPhiGate, type PhiStatus } from "@/lib/governance"

// Types
export interface WorkflowStageInfo {
  id: number
  name: string
  shortName: string
  status: "completed" | "active" | "pending"
  topicVersionAtExecution?: string
}

export interface PhaseGroupInfo {
  id: string
  name: string
  shortName: string
  isOptional: boolean
  stages: WorkflowStageInfo[]
}

export interface ProgressStepperProps {
  phases: PhaseGroupInfo[]
  currentStageId?: number
  phiStatus?: PhiStatus
  currentTopicVersion?: string
  onStageSelect?: (stageId: number) => void
  variant?: "compact" | "detailed"
}

// Helper function to calculate completion percentage
export function calculateCompletionPercentage(phases: PhaseGroupInfo[]): number {
  const totalStages = phases.reduce((sum, phase) => sum + phase.stages.length, 0)
  if (totalStages === 0) return 0

  const completedStages = phases.reduce((sum, phase) => {
    return (
      sum +
      phase.stages.filter((stage) => stage.status === "completed").length
    )
  }, 0)

  return Math.round((completedStages / totalStages) * 100)
}

// CompletionBadge sub-component
interface CompletionBadgeProps {
  phases: PhaseGroupInfo[]
}

function CompletionBadge({ phases }: CompletionBadgeProps) {
  const totalStages = phases.reduce((sum, phase) => sum + phase.stages.length, 0)
  const completedStages = phases.reduce((sum, phase) => {
    return (
      sum +
      phase.stages.filter((stage) => stage.status === "completed").length
    )
  }, 0)
  const percentage = calculateCompletionPercentage(phases)

  return (
    <Badge
      variant="secondary"
      className="flex items-center gap-2 whitespace-nowrap"
      data-testid="badge-completion"
    >
      <span className="text-xs font-semibold">
        {completedStages} of {totalStages} complete ({percentage}%)
      </span>
    </Badge>
  )
}

// StageIndicator sub-component
interface StageIndicatorProps {
  stage: WorkflowStageInfo
  isActive?: boolean
  phiStatus?: PhiStatus
  currentTopicVersion?: string
  onClick?: () => void
}

function StageIndicator({
  stage,
  isActive = false,
  phiStatus,
  currentTopicVersion,
  onClick,
}: StageIndicatorProps) {
  const isCompleted = stage.status === "completed"
  const isPending = stage.status === "pending"
  const showPhiBadge = isCompleted && stageRequiresPhiGate(stage.id) && phiStatus
  const showVersionBadge = isCompleted && stage.id >= 2 && currentTopicVersion

  return (
    <button
      onClick={onClick}
      className="flex flex-col items-center gap-2 focus:outline-none"
      data-testid={`stage-${stage.id}`}
      aria-label={`Stage ${stage.id}: ${stage.name}`}
    >
      <div
        className={cn(
          "relative flex items-center justify-center transition-all duration-200",
          isCompleted
            ? "h-10 w-10"
            : isActive
              ? "h-12 w-12"
              : "h-10 w-10"
        )}
      >
        {isCompleted && (
          <CheckCircle2
            className="h-full w-full text-ros-success"
            data-testid={`icon-completed-${stage.id}`}
            strokeWidth={1.5}
          />
        )}
        {isActive && (
          <>
            <Circle
              className="absolute h-full w-full text-ros-workflow animate-pulse"
              strokeWidth={2}
              fill="currentColor"
              data-testid={`icon-active-${stage.id}`}
            />
            <Circle
              className="absolute h-6 w-6 text-ros-workflow"
              strokeWidth={2}
              fill="white"
            />
          </>
        )}
        {isPending && (
          <Circle
            className="h-full w-full text-gray-400"
            strokeWidth={2}
            data-testid={`icon-pending-${stage.id}`}
          />
        )}
      </div>
      <div className="text-center">
        <p className="text-xs font-semibold leading-none">{stage.shortName}</p>
        {showPhiBadge && (
          <div className="mt-1">
            <PhiStatusBadge status={phiStatus} size="sm" showLabel={false} />
          </div>
        )}
        {showVersionBadge && (
          <div className="mt-1">
            <StageVersionBadge
              stage={{
                id: stage.id,
                name: stage.name,
                shortName: stage.shortName,
                description: "",
                status: stage.status,
                icon: "",
                outputs: [],
                duration: "",
                topicVersionAtExecution: stage.topicVersionAtExecution,
              }}
              currentTopicVersion={currentTopicVersion}
              size="sm"
            />
          </div>
        )}
      </div>
    </button>
  )
}

// PhaseGroup component for detailed view
interface PhaseGroupProps {
  phase: PhaseGroupInfo
  currentStageId?: number
  phiStatus?: PhiStatus
  currentTopicVersion?: string
  onStageSelect?: (stageId: number) => void
  variant?: "compact" | "detailed"
}

function PhaseGroup({
  phase,
  currentStageId,
  phiStatus,
  currentTopicVersion,
  onStageSelect,
  variant = "detailed",
}: PhaseGroupProps) {
  const completedStages = phase.stages.filter(
    (s) => s.status === "completed"
  ).length

  return (
    <div
      className="space-y-3 rounded-lg border border-gray-200 p-4"
      data-testid={`phase-group-${phase.id}`}
    >
      <div className="flex items-center justify-between">
        <div>
          <h4 className="text-sm font-semibold leading-none">{phase.name}</h4>
          <p className="mt-1 text-xs text-gray-600">
            {completedStages}/{phase.stages.length} complete
          </p>
        </div>
        {phase.isOptional && (
          <Badge variant="outline" className="text-xs">
            Optional
          </Badge>
        )}
      </div>

      {variant === "detailed" && (
        <div
          className="grid gap-3 pt-2"
          style={{
            gridTemplateColumns: `repeat(auto-fit, minmax(60px, 1fr))`,
          }}
        >
          {phase.stages.map((stage) => (
            <StageIndicator
              key={stage.id}
              stage={stage}
              isActive={currentStageId === stage.id}
              phiStatus={phiStatus}
              currentTopicVersion={currentTopicVersion}
              onClick={() => onStageSelect?.(stage.id)}
            />
          ))}
        </div>
      )}

      {variant === "compact" && (
        <div className="flex gap-2 pt-2">
          {phase.stages.map((stage) => (
            <button
              key={stage.id}
              onClick={() => onStageSelect?.(stage.id)}
              data-testid={`stage-compact-${stage.id}`}
              className="focus:outline-none"
            >
              <div
                className={cn(
                  "h-2 w-2 rounded-full transition-all duration-200",
                  stage.status === "completed" && "bg-ros-success",
                  stage.status === "active" && "bg-ros-workflow",
                  stage.status === "pending" && "bg-gray-400"
                )}
              />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// Main ProgressStepper component
const ProgressStepper = React.forwardRef<
  HTMLDivElement,
  ProgressStepperProps
>(
  (
    {
      phases,
      currentStageId,
      phiStatus,
      currentTopicVersion = "abc123def456",
      onStageSelect,
      variant = "detailed",
    },
    ref
  ) => {
    const completionPercentage = calculateCompletionPercentage(phases)

    return (
      <div
        ref={ref}
        className="space-y-4 w-full"
        data-testid="progress-stepper"
      >
        {/* Progress Bar and Completion Badge */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">Workflow Progress</h3>
            <CompletionBadge phases={phases} />
          </div>
          <Progress
            value={completionPercentage}
            className="h-2"
            data-testid="progress-bar"
          />
        </div>

        {/* Phases Container */}
        <ScrollArea className="h-auto max-h-[500px] rounded-md border border-gray-200 p-4">
          <div className="space-y-3" data-testid="phases-container">
            {phases.map((phase) => (
              <PhaseGroup
                key={phase.id}
                phase={phase}
                currentStageId={currentStageId}
                phiStatus={phiStatus}
                currentTopicVersion={currentTopicVersion}
                onStageSelect={onStageSelect}
                variant={variant}
              />
            ))}
          </div>
        </ScrollArea>

        {/* Summary */}
        <div className="rounded-lg bg-gray-50 p-3">
          <p className="text-xs text-gray-600">
            <span className="font-semibold">{completionPercentage}%</span> of
            workflow complete
          </p>
        </div>
      </div>
    )
  }
)

ProgressStepper.displayName = "ProgressStepper"

export { ProgressStepper, CompletionBadge, StageIndicator, PhaseGroup }
