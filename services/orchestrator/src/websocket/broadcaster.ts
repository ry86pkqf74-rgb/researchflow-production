/**
 * Run Event Broadcaster
 *
 * Publishes research run lifecycle events to EventBus, which are then
 * distributed to WebSocket clients via the WebSocketManager.
 *
 * Provides convenience functions for publishing run-related events
 * with proper schema validation and PHI-safe payloads.
 *
 * @module websocket/broadcaster
 */

import { eventBus } from '../services/event-bus';
import {
  RunCreatedEvent,
  RunStartedEvent,
  RunCompletedEvent,
  RunFailedEvent,
  StageStartedEvent,
  StageProgressEvent,
  StageCompletedEvent,
  StageFailedEvent,
  ArtifactCreatedEvent,
  GovernanceRequiredEvent,
  ApprovalGrantedEvent,
  ApprovalDeniedEvent,
} from './events';

/**
 * Run Event Broadcaster Service
 */
class RunEventBroadcaster {
  /**
   * Broadcast run.created event
   */
  broadcastRunCreated(data: {
    runId: string;
    projectId: string;
    runName: string;
    stageCount: number;
    createdBy: string;
  }): void {
    const event: RunCreatedEvent = {
      type: 'run.created',
      timestamp: new Date().toISOString(),
      payload: {
        runId: data.runId,
        projectId: data.projectId,
        runName: data.runName,
        stageCount: data.stageCount,
        createdBy: data.createdBy,
        createdAt: new Date().toISOString(),
      },
    };

    eventBus.publish({
      type: event.type,
      ts: event.timestamp,
      topic: 'jobs',
      payload: event.payload,
    });
  }

  /**
   * Broadcast run.started event
   */
  broadcastRunStarted(data: {
    runId: string;
    projectId: string;
    estimatedDuration?: number;
  }): void {
    const event: RunStartedEvent = {
      type: 'run.started',
      timestamp: new Date().toISOString(),
      payload: {
        runId: data.runId,
        projectId: data.projectId,
        startedAt: new Date().toISOString(),
        estimatedDuration: data.estimatedDuration,
      },
    };

    eventBus.publish({
      type: event.type,
      ts: event.timestamp,
      topic: 'jobs',
      payload: event.payload,
    });
  }

  /**
   * Broadcast run.completed event
   */
  broadcastRunCompleted(data: {
    runId: string;
    projectId: string;
    durationMs: number;
    stagesCompleted: number;
    artifactsGenerated?: number;
  }): void {
    const event: RunCompletedEvent = {
      type: 'run.completed',
      timestamp: new Date().toISOString(),
      payload: {
        runId: data.runId,
        projectId: data.projectId,
        completedAt: new Date().toISOString(),
        durationMs: data.durationMs,
        stagesCompleted: data.stagesCompleted,
        artifactsGenerated: data.artifactsGenerated,
      },
    };

    eventBus.publish({
      type: event.type,
      ts: event.timestamp,
      topic: 'jobs',
      payload: event.payload,
    });
  }

  /**
   * Broadcast run.failed event
   */
  broadcastRunFailed(data: {
    runId: string;
    projectId: string;
    failedStage?: string;
    errorCode: string;
    retryable?: boolean;
  }): void {
    const event: RunFailedEvent = {
      type: 'run.failed',
      timestamp: new Date().toISOString(),
      payload: {
        runId: data.runId,
        projectId: data.projectId,
        failedAt: new Date().toISOString(),
        failedStage: data.failedStage,
        errorCode: data.errorCode,
        retryable: data.retryable,
      },
    };

    eventBus.publish({
      type: event.type,
      ts: event.timestamp,
      topic: 'jobs',
      payload: event.payload,
    });
  }

  /**
   * Broadcast stage.started event
   */
  broadcastStageStarted(data: {
    runId: string;
    stageId: string;
    stageName: string;
    stageNumber: number;
    totalStages: number;
    estimatedDuration?: number;
  }): void {
    const event: StageStartedEvent = {
      type: 'stage.started',
      timestamp: new Date().toISOString(),
      payload: {
        runId: data.runId,
        stageId: data.stageId,
        stageName: data.stageName,
        stageNumber: data.stageNumber,
        totalStages: data.totalStages,
        startedAt: new Date().toISOString(),
        estimatedDuration: data.estimatedDuration,
      },
    };

    eventBus.publish({
      type: event.type,
      ts: event.timestamp,
      topic: 'jobs',
      payload: event.payload,
    });
  }

  /**
   * Broadcast stage.progress event
   */
  broadcastStageProgress(data: {
    runId: string;
    stageId: string;
    stageName: string;
    progress: number;
    statusMessage?: string;
    itemsProcessed?: number;
    itemsTotal?: number;
  }): void {
    const event: StageProgressEvent = {
      type: 'stage.progress',
      timestamp: new Date().toISOString(),
      payload: {
        runId: data.runId,
        stageId: data.stageId,
        stageName: data.stageName,
        progress: Math.min(100, Math.max(0, data.progress)),
        statusMessage: data.statusMessage,
        itemsProcessed: data.itemsProcessed,
        itemsTotal: data.itemsTotal,
      },
    };

    eventBus.publish({
      type: event.type,
      ts: event.timestamp,
      topic: 'jobs',
      payload: event.payload,
    });
  }

  /**
   * Broadcast stage.completed event
   */
  broadcastStageCompleted(data: {
    runId: string;
    stageId: string;
    stageName: string;
    stageNumber: number;
    durationMs: number;
    outputsGenerated?: number;
  }): void {
    const event: StageCompletedEvent = {
      type: 'stage.completed',
      timestamp: new Date().toISOString(),
      payload: {
        runId: data.runId,
        stageId: data.stageId,
        stageName: data.stageName,
        stageNumber: data.stageNumber,
        completedAt: new Date().toISOString(),
        durationMs: data.durationMs,
        outputsGenerated: data.outputsGenerated,
      },
    };

    eventBus.publish({
      type: event.type,
      ts: event.timestamp,
      topic: 'jobs',
      payload: event.payload,
    });
  }

  /**
   * Broadcast stage.failed event
   */
  broadcastStageFailed(data: {
    runId: string;
    stageId: string;
    stageName: string;
    stageNumber: number;
    errorCode: string;
    retriesRemaining?: number;
    retriesAttempted?: number;
  }): void {
    const event: StageFailedEvent = {
      type: 'stage.failed',
      timestamp: new Date().toISOString(),
      payload: {
        runId: data.runId,
        stageId: data.stageId,
        stageName: data.stageName,
        stageNumber: data.stageNumber,
        failedAt: new Date().toISOString(),
        errorCode: data.errorCode,
        retriesRemaining: data.retriesRemaining,
        retriesAttempted: data.retriesAttempted,
      },
    };

    eventBus.publish({
      type: event.type,
      ts: event.timestamp,
      topic: 'jobs',
      payload: event.payload,
    });
  }

  /**
   * Broadcast artifact.created event
   */
  broadcastArtifactCreated(data: {
    runId: string;
    artifactId: string;
    artifactName: string;
    artifactType: string;
    createdBy: string;
    relatedStageId?: string;
  }): void {
    const event: ArtifactCreatedEvent = {
      type: 'artifact.created',
      timestamp: new Date().toISOString(),
      payload: {
        runId: data.runId,
        artifactId: data.artifactId,
        artifactName: data.artifactName,
        artifactType: data.artifactType,
        createdAt: new Date().toISOString(),
        createdBy: data.createdBy,
        relatedStageId: data.relatedStageId,
      },
    };

    eventBus.publish({
      type: event.type,
      ts: event.timestamp,
      topic: 'jobs',
      payload: event.payload,
    });
  }

  /**
   * Broadcast governance.required event
   */
  broadcastGovernanceRequired(data: {
    runId: string;
    governanceId: string;
    stageId?: string;
    governanceType:
      | 'PHI_SCAN'
      | 'STATISTICAL_REVIEW'
      | 'ETHICS_REVIEW'
      | 'DATA_EXPORT'
      | 'CUSTOM';
    assignedTo?: string[];
    priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  }): void {
    const event: GovernanceRequiredEvent = {
      type: 'governance.required',
      timestamp: new Date().toISOString(),
      payload: {
        runId: data.runId,
        governanceId: data.governanceId,
        stageId: data.stageId,
        governanceType: data.governanceType,
        requiredAt: new Date().toISOString(),
        assignedTo: data.assignedTo,
        priority: data.priority,
      },
    };

    eventBus.publish({
      type: event.type,
      ts: event.timestamp,
      topic: 'governance',
      payload: event.payload,
    });
  }

  /**
   * Broadcast approval.granted event
   */
  broadcastApprovalGranted(data: {
    runId: string;
    approvalId: string;
    governanceId: string;
    governanceType:
      | 'PHI_SCAN'
      | 'STATISTICAL_REVIEW'
      | 'ETHICS_REVIEW'
      | 'DATA_EXPORT'
      | 'CUSTOM';
    grantedBy: string;
    notes?: string;
  }): void {
    const event: ApprovalGrantedEvent = {
      type: 'approval.granted',
      timestamp: new Date().toISOString(),
      payload: {
        runId: data.runId,
        approvalId: data.approvalId,
        governanceId: data.governanceId,
        governanceType: data.governanceType,
        grantedAt: new Date().toISOString(),
        grantedBy: data.grantedBy,
        notes: data.notes,
      },
    };

    eventBus.publish({
      type: event.type,
      ts: event.timestamp,
      topic: 'governance',
      payload: event.payload,
    });
  }

  /**
   * Broadcast approval.denied event
   */
  broadcastApprovalDenied(data: {
    runId: string;
    approvalId: string;
    governanceId: string;
    governanceType:
      | 'PHI_SCAN'
      | 'STATISTICAL_REVIEW'
      | 'ETHICS_REVIEW'
      | 'DATA_EXPORT'
      | 'CUSTOM';
    deniedBy: string;
    reason: string;
    canRetry?: boolean;
  }): void {
    const event: ApprovalDeniedEvent = {
      type: 'approval.denied',
      timestamp: new Date().toISOString(),
      payload: {
        runId: data.runId,
        approvalId: data.approvalId,
        governanceId: data.governanceId,
        governanceType: data.governanceType,
        deniedAt: new Date().toISOString(),
        deniedBy: data.deniedBy,
        reason: data.reason,
        canRetry: data.canRetry,
      },
    };

    eventBus.publish({
      type: event.type,
      ts: event.timestamp,
      topic: 'governance',
      payload: event.payload,
    });
  }
}

// Singleton instance
export const runEventBroadcaster = new RunEventBroadcaster();

export default runEventBroadcaster;
