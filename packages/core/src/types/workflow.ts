/**
 * Workflow Event Types - Task 156
 *
 * Defines types for workflow event streaming and analytics dashboard.
 */

/**
 * Workflow event types
 */
export type WorkflowEventType =
  | 'workflow.created'
  | 'workflow.started'
  | 'workflow.completed'
  | 'workflow.failed'
  | 'workflow.cancelled'
  | 'job.created'
  | 'job.queued'
  | 'job.started'
  | 'job.progress'
  | 'job.completed'
  | 'job.failed'
  | 'job.retrying'
  | 'job.timeout'
  | 'manifest.created'
  | 'manifest.finalized'
  | 'manifest.quarantined'
  | 'manifest.released'
  | 'artifact.uploaded'
  | 'artifact.processed'
  | 'artifact.deleted'
  | 'integration.connected'
  | 'integration.synced'
  | 'integration.disconnected'
  | 'integration.error'
  | 'user.action'
  | 'system.health'
  | 'system.alert';

/**
 * Base workflow event
 */
export interface WorkflowEvent<T = unknown> {
  /** Event UUID */
  id: string;
  /** Event type */
  type: WorkflowEventType;
  /** Timestamp (ISO 8601) */
  timestamp: string;
  /** Workflow ID if applicable */
  workflowId?: string;
  /** Job ID if applicable */
  jobId?: string;
  /** User ID who triggered the event */
  userId?: string;
  /** Event-specific payload */
  payload: T;
  /** Event metadata */
  metadata?: {
    source?: string;
    version?: string;
    correlationId?: string;
    spanId?: string;
    traceId?: string;
  };
}

/**
 * Job progress payload
 */
export interface JobProgressPayload {
  /** Progress percentage (0-100) */
  progress: number;
  /** Current stage */
  stage?: string;
  /** Stage progress message */
  message?: string;
  /** Estimated time remaining in seconds */
  estimatedSecondsRemaining?: number;
  /** Items processed */
  itemsProcessed?: number;
  /** Total items */
  totalItems?: number;
}

/**
 * Job completion payload
 */
export interface JobCompletionPayload {
  /** Job duration in milliseconds */
  durationMs: number;
  /** Result manifest ID */
  manifestId?: string;
  /** Output artifact IDs */
  outputArtifactIds?: string[];
  /** Quality score */
  qualityScore?: number;
  /** Whether any warnings occurred */
  hasWarnings?: boolean;
}

/**
 * Job failure payload
 */
export interface JobFailurePayload {
  /** Error code */
  errorCode: string;
  /** Error message */
  errorMessage: string;
  /** Error stack trace (sanitized) */
  errorStack?: string;
  /** Whether error is retryable */
  retryable: boolean;
  /** Attempt number */
  attemptNumber: number;
  /** Maximum attempts */
  maxAttempts: number;
}

/**
 * System health payload
 */
export interface SystemHealthPayload {
  /** Service name */
  service: string;
  /** Health status */
  status: 'healthy' | 'degraded' | 'unhealthy';
  /** Component health checks */
  components?: Record<string, {
    status: 'healthy' | 'degraded' | 'unhealthy';
    message?: string;
    latencyMs?: number;
  }>;
  /** Queue depths */
  queueDepths?: Record<string, number>;
  /** Memory usage */
  memoryUsage?: {
    heapUsedMB: number;
    heapTotalMB: number;
    rssMB: number;
  };
  /** CPU usage percentage */
  cpuUsagePercent?: number;
}

/**
 * Workflow metrics for analytics dashboard
 */
export interface WorkflowMetrics {
  /** Time period */
  period: {
    start: string;
    end: string;
    granularity: 'minute' | 'hour' | 'day' | 'week' | 'month';
  };
  /** Throughput metrics */
  throughput: {
    jobsStarted: number;
    jobsCompleted: number;
    jobsFailed: number;
    workflowsStarted: number;
    workflowsCompleted: number;
  };
  /** Latency metrics */
  latency: {
    p50Ms: number;
    p75Ms: number;
    p90Ms: number;
    p95Ms: number;
    p99Ms: number;
    avgMs: number;
  };
  /** Error metrics */
  errors: {
    totalCount: number;
    byCode: Record<string, number>;
    byService: Record<string, number>;
  };
  /** Queue metrics */
  queues: {
    totalEnqueued: number;
    totalProcessed: number;
    avgWaitTimeMs: number;
    maxDepth: number;
    currentDepth: number;
  };
  /** Resource metrics */
  resources: {
    avgCpuPercent: number;
    avgMemoryPercent: number;
    peakMemoryMB: number;
  };
  /** Carbon metrics (Task 189) */
  carbon?: {
    totalRuntimeSeconds: number;
    totalCo2eGrams: number;
    avgCo2ePerJob: number;
  };
}

/**
 * Dashboard widget configuration
 */
export interface DashboardWidget {
  /** Widget ID */
  id: string;
  /** Widget type */
  type: 'throughput' | 'latency' | 'errors' | 'queues' | 'carbon' | 'custom';
  /** Widget title */
  title: string;
  /** Chart type */
  chartType: 'line' | 'bar' | 'area' | 'gauge' | 'table' | 'stat';
  /** Metrics to display */
  metrics: string[];
  /** Time range */
  timeRange: string;
  /** Refresh interval in seconds */
  refreshIntervalSeconds: number;
  /** Widget position */
  position: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

/**
 * Dashboard configuration
 */
export interface DashboardConfig {
  /** Dashboard ID */
  id: string;
  /** Dashboard name */
  name: string;
  /** Dashboard description */
  description?: string;
  /** Widgets */
  widgets: DashboardWidget[];
  /** Default time range */
  defaultTimeRange: string;
  /** Auto-refresh interval in seconds */
  autoRefreshSeconds?: number;
  /** Created timestamp */
  createdAt: string;
  /** Updated timestamp */
  updatedAt: string;
}

export default WorkflowEvent;
