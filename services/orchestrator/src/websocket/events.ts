/**
 * WebSocket Event Types & Schemas
 *
 * Defines all WebSocket event types used throughout ResearchFlow.
 * Events are PHI-safe and include only metadata, IDs, and status information.
 *
 * Event Categories:
 * - run.* : Research run lifecycle events
 * - stage.* : Workflow stage progression events
 * - artifact.* : Artifact creation and modification
 * - governance.* : Governance and approval events
 *
 * @module websocket/events
 */

import { z } from 'zod';

/**
 * Base WebSocket message schema
 */
export const WebSocketMessageSchema = z.object({
  id: z.string().optional(),
  type: z.string(),
  timestamp: z.string().datetime(),
  payload: z.record(z.unknown()),
});

export type WebSocketMessage = z.infer<typeof WebSocketMessageSchema>;

// =============================================================================
// RUN EVENTS
// =============================================================================

/**
 * run.created - Fired when a new research run is created
 */
export const RunCreatedEventSchema = z.object({
  type: z.literal('run.created'),
  timestamp: z.string().datetime(),
  payload: z.object({
    runId: z.string(),
    projectId: z.string(),
    runName: z.string(),
    stageCount: z.number().int().min(1),
    createdBy: z.string(),
    createdAt: z.string().datetime(),
  }),
});

export type RunCreatedEvent = z.infer<typeof RunCreatedEventSchema>;

/**
 * run.started - Fired when a research run starts executing
 */
export const RunStartedEventSchema = z.object({
  type: z.literal('run.started'),
  timestamp: z.string().datetime(),
  payload: z.object({
    runId: z.string(),
    projectId: z.string(),
    startedAt: z.string().datetime(),
    estimatedDuration: z.number().int().min(0).optional(),
  }),
});

export type RunStartedEvent = z.infer<typeof RunStartedEventSchema>;

/**
 * run.completed - Fired when a research run completes successfully
 */
export const RunCompletedEventSchema = z.object({
  type: z.literal('run.completed'),
  timestamp: z.string().datetime(),
  payload: z.object({
    runId: z.string(),
    projectId: z.string(),
    completedAt: z.string().datetime(),
    durationMs: z.number().int().min(0),
    stagesCompleted: z.number().int().min(0),
    artifactsGenerated: z.number().int().min(0).optional(),
  }),
});

export type RunCompletedEvent = z.infer<typeof RunCompletedEventSchema>;

/**
 * run.failed - Fired when a research run fails
 */
export const RunFailedEventSchema = z.object({
  type: z.literal('run.failed'),
  timestamp: z.string().datetime(),
  payload: z.object({
    runId: z.string(),
    projectId: z.string(),
    failedAt: z.string().datetime(),
    failedStage: z.string().optional(),
    errorCode: z.string(), // Never include full error messages to avoid PHI leak
    retryable: z.boolean().optional(),
  }),
});

export type RunFailedEvent = z.infer<typeof RunFailedEventSchema>;

// =============================================================================
// STAGE EVENTS
// =============================================================================

/**
 * stage.started - Fired when a workflow stage begins
 */
export const StageStartedEventSchema = z.object({
  type: z.literal('stage.started'),
  timestamp: z.string().datetime(),
  payload: z.object({
    runId: z.string(),
    stageId: z.string(),
    stageName: z.string(),
    stageNumber: z.number().int().min(1),
    totalStages: z.number().int().min(1),
    startedAt: z.string().datetime(),
    estimatedDuration: z.number().int().min(0).optional(),
  }),
});

export type StageStartedEvent = z.infer<typeof StageStartedEventSchema>;

/**
 * stage.progress - Fired to update stage progress
 */
export const StageProgressEventSchema = z.object({
  type: z.literal('stage.progress'),
  timestamp: z.string().datetime(),
  payload: z.object({
    runId: z.string(),
    stageId: z.string(),
    stageName: z.string(),
    progress: z.number().int().min(0).max(100), // 0-100 percentage
    statusMessage: z.string().optional(),
    itemsProcessed: z.number().int().min(0).optional(),
    itemsTotal: z.number().int().min(0).optional(),
  }),
});

export type StageProgressEvent = z.infer<typeof StageProgressEventSchema>;

/**
 * stage.completed - Fired when a workflow stage completes
 */
export const StageCompletedEventSchema = z.object({
  type: z.literal('stage.completed'),
  timestamp: z.string().datetime(),
  payload: z.object({
    runId: z.string(),
    stageId: z.string(),
    stageName: z.string(),
    stageNumber: z.number().int().min(1),
    completedAt: z.string().datetime(),
    durationMs: z.number().int().min(0),
    outputsGenerated: z.number().int().min(0).optional(),
  }),
});

export type StageCompletedEvent = z.infer<typeof StageCompletedEventSchema>;

/**
 * stage.failed - Fired when a workflow stage fails
 */
export const StageFailedEventSchema = z.object({
  type: z.literal('stage.failed'),
  timestamp: z.string().datetime(),
  payload: z.object({
    runId: z.string(),
    stageId: z.string(),
    stageName: z.string(),
    stageNumber: z.number().int().min(1),
    failedAt: z.string().datetime(),
    errorCode: z.string(),
    retriesRemaining: z.number().int().min(0).optional(),
    retriesAttempted: z.number().int().min(0).optional(),
  }),
});

export type StageFailedEvent = z.infer<typeof StageFailedEventSchema>;

// =============================================================================
// ARTIFACT EVENTS
// =============================================================================

/**
 * artifact.created - Fired when a new artifact is created
 */
export const ArtifactCreatedEventSchema = z.object({
  type: z.literal('artifact.created'),
  timestamp: z.string().datetime(),
  payload: z.object({
    runId: z.string(),
    artifactId: z.string(),
    artifactName: z.string(),
    artifactType: z.string(), // e.g., 'analysis', 'dataset', 'report'
    createdAt: z.string().datetime(),
    createdBy: z.string(),
    relatedStageId: z.string().optional(),
  }),
});

export type ArtifactCreatedEvent = z.infer<typeof ArtifactCreatedEventSchema>;

// =============================================================================
// GOVERNANCE EVENTS
// =============================================================================

/**
 * governance.required - Fired when governance approval is required
 */
export const GovernanceRequiredEventSchema = z.object({
  type: z.literal('governance.required'),
  timestamp: z.string().datetime(),
  payload: z.object({
    runId: z.string(),
    governanceId: z.string(),
    stageId: z.string().optional(),
    governanceType: z.enum([
      'PHI_SCAN',
      'STATISTICAL_REVIEW',
      'ETHICS_REVIEW',
      'DATA_EXPORT',
      'CUSTOM',
    ]),
    requiredAt: z.string().datetime(),
    assignedTo: z.string().array().optional(),
    priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).optional(),
  }),
});

export type GovernanceRequiredEvent = z.infer<
  typeof GovernanceRequiredEventSchema
>;

/**
 * approval.granted - Fired when an approval is granted
 */
export const ApprovalGrantedEventSchema = z.object({
  type: z.literal('approval.granted'),
  timestamp: z.string().datetime(),
  payload: z.object({
    runId: z.string(),
    approvalId: z.string(),
    governanceId: z.string(),
    governanceType: z.enum([
      'PHI_SCAN',
      'STATISTICAL_REVIEW',
      'ETHICS_REVIEW',
      'DATA_EXPORT',
      'CUSTOM',
    ]),
    grantedAt: z.string().datetime(),
    grantedBy: z.string(),
    notes: z.string().optional(),
  }),
});

export type ApprovalGrantedEvent = z.infer<typeof ApprovalGrantedEventSchema>;

/**
 * approval.denied - Fired when an approval is denied
 */
export const ApprovalDeniedEventSchema = z.object({
  type: z.literal('approval.denied'),
  timestamp: z.string().datetime(),
  payload: z.object({
    runId: z.string(),
    approvalId: z.string(),
    governanceId: z.string(),
    governanceType: z.enum([
      'PHI_SCAN',
      'STATISTICAL_REVIEW',
      'ETHICS_REVIEW',
      'DATA_EXPORT',
      'CUSTOM',
    ]),
    deniedAt: z.string().datetime(),
    deniedBy: z.string(),
    reason: z.string(),
    canRetry: z.boolean().optional(),
  }),
});

export type ApprovalDeniedEvent = z.infer<typeof ApprovalDeniedEventSchema>;

// =============================================================================
// UNION TYPE FOR ALL EVENTS
// =============================================================================

export const AnyWebSocketEventSchema = z.union([
  RunCreatedEventSchema,
  RunStartedEventSchema,
  RunCompletedEventSchema,
  RunFailedEventSchema,
  StageStartedEventSchema,
  StageProgressEventSchema,
  StageCompletedEventSchema,
  StageFailedEventSchema,
  ArtifactCreatedEventSchema,
  GovernanceRequiredEventSchema,
  ApprovalGrantedEventSchema,
  ApprovalDeniedEventSchema,
]);

export type AnyWebSocketEvent = z.infer<typeof AnyWebSocketEventSchema>;

/**
 * Type guard to validate WebSocket events at runtime
 */
export function isValidWebSocketEvent(event: unknown): event is AnyWebSocketEvent {
  try {
    AnyWebSocketEventSchema.parse(event);
    return true;
  } catch {
    return false;
  }
}

/**
 * Type guard for specific event types
 */
export function getEventType(
  event: AnyWebSocketEvent
): AnyWebSocketEvent['type'] {
  return event.type;
}

/**
 * Event category mapping for subscriptions
 */
export const EventCategories = {
  RUN_EVENTS: [
    'run.created',
    'run.started',
    'run.completed',
    'run.failed',
  ] as const,
  STAGE_EVENTS: [
    'stage.started',
    'stage.progress',
    'stage.completed',
    'stage.failed',
  ] as const,
  ARTIFACT_EVENTS: ['artifact.created'] as const,
  GOVERNANCE_EVENTS: [
    'governance.required',
    'approval.granted',
    'approval.denied',
  ] as const,
  ALL_EVENTS: [
    'run.created',
    'run.started',
    'run.completed',
    'run.failed',
    'stage.started',
    'stage.progress',
    'stage.completed',
    'stage.failed',
    'artifact.created',
    'governance.required',
    'approval.granted',
    'approval.denied',
  ] as const,
} as const;

export type EventCategory = keyof typeof EventCategories;
