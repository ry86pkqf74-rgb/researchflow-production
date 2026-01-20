/**
 * Job Events Service
 *
 * Publishes realtime events for job status changes via EventBus.
 * Integrates with the SSE stream for client notifications.
 *
 * @module services/job-events
 */

import { eventBus } from './event-bus';

/**
 * Publish job started event
 *
 * @param jobId - Job ID
 * @param researchId - Associated research ID (optional)
 */
export function publishJobStarted(jobId: string, researchId?: string): void {
  eventBus.publishJobEvent('job.started', {
    jobId,
    researchId,
    timestamp: new Date().toISOString(),
  });
}

/**
 * Publish job progress event
 *
 * @param jobId - Job ID
 * @param progress - Progress percentage (0-100)
 * @param stage - Current stage name (optional)
 */
export function publishJobProgress(
  jobId: string,
  progress: number,
  stage?: string
): void {
  eventBus.publishJobEvent('job.progress', {
    jobId,
    progress: Math.min(100, Math.max(0, progress)),
    stage,
    timestamp: new Date().toISOString(),
  });
}

/**
 * Publish job completed event
 *
 * @param jobId - Job ID
 * @param researchId - Associated research ID (optional)
 */
export function publishJobCompleted(jobId: string, researchId?: string): void {
  eventBus.publishJobEvent('job.completed', {
    jobId,
    researchId,
    timestamp: new Date().toISOString(),
  });
}

/**
 * Publish job failed event
 *
 * @param jobId - Job ID
 * @param errorCode - Error code (not error message, to avoid PHI leak)
 */
export function publishJobFailed(jobId: string, errorCode?: string): void {
  eventBus.publishJobEvent('job.failed', {
    jobId,
    errorCode: errorCode || 'UNKNOWN_ERROR',
    timestamp: new Date().toISOString(),
  });
}

// Export as a service object
export const jobEventsService = {
  publishJobStarted,
  publishJobProgress,
  publishJobCompleted,
  publishJobFailed,
};
