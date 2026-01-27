/**
 * Planning Types
 *
 * TypeScript types for the agentic planning system.
 */

// ===== ENUMS =====

export type PlanType = 'statistical' | 'exploratory' | 'comparative' | 'predictive';
export type PlanStatus = 'draft' | 'pending_approval' | 'approved' | 'rejected' | 'running' | 'completed' | 'failed';
export type JobType = 'plan_build' | 'plan_run';
export type JobStatus = 'pending' | 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';
export type ArtifactType = 'table' | 'figure' | 'report' | 'manifest' | 'log' | 'data' | 'other';
export type StageType = 'extraction' | 'transform' | 'analysis' | 'validation' | 'output';

// ===== CONSTRAINTS =====

export interface PlanConstraints {
  maxRows?: number;
  samplingRate?: number;
  excludedColumns?: string[];
  timeLimitSeconds?: number;
  requireApproval?: boolean;
}

// ===== PLAN SPEC =====

export interface PlanStage {
  stageId: string;
  stageType: StageType;
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

// ===== ENTITIES =====

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

// ===== API REQUEST TYPES =====

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

// ===== API RESPONSE TYPES =====

export interface CreatePlanResponse {
  plan: AnalysisPlan;
  job: AnalysisJob;
  message: string;
}

export interface GetPlanResponse {
  plan: AnalysisPlan;
  jobs?: AnalysisJob[];
  artifacts?: AnalysisArtifact[];
}

export interface ListPlansResponse {
  plans: AnalysisPlan[];
}

export interface GetJobResponse {
  job: AnalysisJob;
  events?: JobEvent[];
}

export interface ListArtifactsResponse {
  artifacts: AnalysisArtifact[];
}
