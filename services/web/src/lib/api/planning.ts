/**
 * Planning API Client
 *
 * Client-side API for the agentic analysis planning system.
 */

import { apiClient, ApiResponse } from './client';

// ===== TYPES =====

export type PlanType = 'statistical' | 'exploratory' | 'comparative' | 'predictive';
export type PlanStatus = 'draft' | 'pending_approval' | 'approved' | 'rejected' | 'running' | 'completed' | 'failed';
export type JobType = 'plan_build' | 'plan_run';
export type JobStatus = 'pending' | 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';
export type ArtifactType = 'table' | 'figure' | 'report' | 'manifest' | 'log' | 'data' | 'other';

export interface PlanConstraints {
  maxRows?: number;
  samplingRate?: number;
  excludedColumns?: string[];
  timeLimitSeconds?: number;
  requireApproval?: boolean;
}

export interface PlanStage {
  stageId: string;
  stageType: 'extraction' | 'transform' | 'analysis' | 'validation' | 'output';
  name: string;
  description?: string;
  config: Record<string, unknown>;
  dependsOn?: string[];
}

export interface StatisticalMethod {
  method: string;
  rationale: string;
  assumptions: string[];
  variables: {
    dependent?: string;
    independent?: string[];
    covariates?: string[];
  };
}

export interface PlanSpec {
  version: string;
  generatedAt: string;
  stages: PlanStage[];
  statisticalMethods?: StatisticalMethod[];
  expectedOutputs?: Array<{ name: string; type: string; description?: string }>;
}

export interface AnalysisPlan {
  id: string;
  projectId?: string;
  datasetId: string;
  name: string;
  description?: string;
  researchQuestion: string;
  planType: PlanType;
  constraints: PlanConstraints;
  planSpec: PlanSpec;
  status: PlanStatus;
  requiresApproval: boolean;
  approvedBy?: string;
  approvedAt?: string;
  rejectionReason?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface AnalysisJob {
  id: string;
  planId: string;
  jobType: JobType;
  status: JobStatus;
  progress: number;
  currentStage?: string;
  stagesCompleted: string[];
  result?: Record<string, unknown>;
  errorMessage?: string;
  errorDetails?: Record<string, unknown>;
  startedAt?: string;
  completedAt?: string;
  startedBy: string;
  createdAt: string;
}

export interface AnalysisArtifact {
  id: string;
  jobId: string;
  planId: string;
  artifactType: ArtifactType;
  name: string;
  description?: string;
  filePath?: string;
  fileSize?: number;
  mimeType?: string;
  inlineData?: Record<string, unknown>;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface JobEvent {
  type: string;
  data: Record<string, unknown>;
  timestamp: string;
}

// ===== REQUEST TYPES =====

export interface CreatePlanRequest {
  datasetId: string;
  name: string;
  description?: string;
  researchQuestion: string;
  planType?: PlanType;
  constraints?: PlanConstraints;
  projectId?: string;
  datasetMetadata?: {
    name: string;
    rowCount?: number;
    columns: Array<{
      name: string;
      type: string;
      nullable?: boolean;
      cardinality?: number;
    }>;
  };
}

export interface ApprovePlanRequest {
  approved: boolean;
  reason?: string;
}

export interface RunPlanRequest {
  executionMode?: 'full' | 'dry_run';
  configOverrides?: Record<string, unknown>;
}

// ===== API FUNCTIONS =====

export const planningApi = {
  /**
   * Create a new analysis plan.
   */
  createPlan: (request: CreatePlanRequest): Promise<ApiResponse<{ plan: AnalysisPlan; job: AnalysisJob; phiWarning?: string }>> =>
    apiClient.post('/api/analysis/plans', request),

  /**
   * List user's plans.
   */
  listPlans: (projectId?: string): Promise<ApiResponse<{ plans: AnalysisPlan[] }>> =>
    apiClient.get('/api/analysis/plans', projectId ? { projectId } : {}),

  /**
   * Get plan details with jobs and artifacts.
   */
  getPlan: (planId: string): Promise<ApiResponse<{ plan: AnalysisPlan; jobs?: AnalysisJob[]; artifacts?: AnalysisArtifact[] }>> =>
    apiClient.get(`/api/analysis/plans/${planId}`),

  /**
   * Approve or reject a plan.
   */
  approvePlan: (planId: string, request: ApprovePlanRequest): Promise<ApiResponse<{ plan: AnalysisPlan }>> =>
    apiClient.post(`/api/analysis/plans/${planId}/approve`, request),

  /**
   * Run an approved plan.
   */
  runPlan: (planId: string, request?: RunPlanRequest): Promise<ApiResponse<{ job: AnalysisJob }>> =>
    apiClient.post(`/api/analysis/plans/${planId}/run`, request || {}),

  /**
   * Get job status.
   */
  getJob: (jobId: string): Promise<ApiResponse<{ job: AnalysisJob; events?: JobEvent[] }>> =>
    apiClient.get(`/api/analysis/jobs/${jobId}`),

  /**
   * Subscribe to job events via SSE.
   */
  subscribeToJobEvents: (
    jobId: string,
    onEvent: (event: { type: string; job: AnalysisJob; events?: JobEvent[] }) => void,
    onError?: (error: Error) => void
  ): (() => void) => {
    const baseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';
    const eventSource = new EventSource(`${baseUrl}/api/analysis/jobs/${jobId}/events`);

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        onEvent(data);
      } catch (err) {
        console.error('Failed to parse SSE event:', err);
      }
    };

    eventSource.onerror = (err) => {
      console.error('SSE error:', err);
      onError?.(new Error('SSE connection failed'));
      eventSource.close();
    };

    // Return cleanup function
    return () => {
      eventSource.close();
    };
  },

  /**
   * List artifacts.
   */
  listArtifacts: (filters?: { jobId?: string; planId?: string; type?: string }): Promise<ApiResponse<{ artifacts: AnalysisArtifact[] }>> =>
    apiClient.get('/api/analysis/artifacts', filters || {}),
};

export default planningApi;
