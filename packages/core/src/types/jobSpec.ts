/**
 * Job Specification Types - Task 199 Thresholds
 *
 * Defines job thresholds for quality control, PII risk scoring,
 * and duplication detection enforcement.
 */

export interface JobThresholds {
  /** Minimum field confidence score (0..1) - quarantine if below */
  minFieldConfidence?: number;
  /** Maximum duplication rate (0..1) - warn/quarantine if exceeded */
  maxDuplicationRate?: number;
  /** Maximum PII risk score (0..1) - quarantine if exceeded */
  maxPiiRiskScore?: number;
  /** Maximum uncertainty score (0..1) - require review if exceeded */
  maxUncertaintyScore?: number;
  /** Minimum extraction completeness (0..1) */
  minExtractionCompleteness?: number;
}

export interface JobRetryPolicy {
  /** Maximum number of retry attempts */
  maxAttempts: number;
  /** Backoff strategy */
  backoff: {
    type: 'fixed' | 'exponential' | 'custom';
    delayMs: number;
    maxDelayMs?: number;
    multiplier?: number;
  };
  /** Retry on specific error codes */
  retryOn?: string[];
  /** Do not retry on specific error codes */
  noRetryOn?: string[];
}

export interface JobPriority {
  /** Priority level (higher = more urgent) */
  level: number;
  /** Priority queue name override */
  queue?: string;
  /** Deadline for completion */
  deadline?: string;
}

export interface JobSpec {
  /** Unique job identifier */
  id: string;
  /** Job type (e.g., 'extraction', 'validation', 'analysis') */
  type: string;
  /** Job version for schema evolution */
  version?: string;
  /** Input data/configuration */
  inputs: unknown;
  /** Quality thresholds for this job */
  thresholds?: JobThresholds;
  /** Retry policy */
  retry?: JobRetryPolicy;
  /** Priority configuration */
  priority?: JobPriority;
  /** Tags for filtering/grouping */
  tags?: string[];
  /** Workflow ID if part of a workflow */
  workflowId?: string;
  /** Parent job ID if this is a child job */
  parentJobId?: string;
  /** Timeout in milliseconds */
  timeoutMs?: number;
  /** Whether to enable detailed tracing */
  tracingEnabled?: boolean;
  /** Custom metadata */
  metadata?: Record<string, unknown>;
  /** Created timestamp */
  createdAt: string;
  /** Updated timestamp */
  updatedAt?: string;
}

export interface JobSpecValidationResult {
  valid: boolean;
  errors?: Array<{
    path: string;
    message: string;
    code: string;
  }>;
  warnings?: Array<{
    path: string;
    message: string;
    code: string;
  }>;
}

/**
 * Validate job thresholds are within valid ranges
 */
export function validateJobThresholds(thresholds: JobThresholds): JobSpecValidationResult {
  const errors: Array<{ path: string; message: string; code: string }> = [];

  const validateRange = (value: number | undefined, field: string) => {
    if (value !== undefined && (value < 0 || value > 1)) {
      errors.push({
        path: `thresholds.${field}`,
        message: `${field} must be between 0 and 1`,
        code: 'INVALID_RANGE',
      });
    }
  };

  validateRange(thresholds.minFieldConfidence, 'minFieldConfidence');
  validateRange(thresholds.maxDuplicationRate, 'maxDuplicationRate');
  validateRange(thresholds.maxPiiRiskScore, 'maxPiiRiskScore');
  validateRange(thresholds.maxUncertaintyScore, 'maxUncertaintyScore');
  validateRange(thresholds.minExtractionCompleteness, 'minExtractionCompleteness');

  return {
    valid: errors.length === 0,
    errors: errors.length > 0 ? errors : undefined,
  };
}

export default JobSpec;
