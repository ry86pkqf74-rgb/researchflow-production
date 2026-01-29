/**
 * Transparency Database Types
 * 
 * TypeScript interfaces for the transparency foundation tables.
 * Matches migration 0029_transparency_foundation.sql
 * 
 * @module @researchflow/core/types/transparency
 */

import { z } from 'zod';

// ============================================
// Enums
// ============================================

export type GovernanceMode = 'DEMO' | 'LIVE' | 'OFFLINE';
export type PhiScanStatus = 'pending' | 'clean' | 'flagged' | 'redacted' | 'failed';
export type DatasetFormat = 'csv' | 'parquet' | 'ndjson' | 'dicom' | 'xlsx' | 'json' | 'hl7' | 'fhir';
export type AccessType = 'read' | 'download' | 'export' | 'transform' | 'delete' | 'share';
export type PhiExposureRisk = 'none' | 'low' | 'medium' | 'high';
export type StageStatus = 'pending' | 'running' | 'completed' | 'failed' | 'skipped' | 'paused' | 'cancelled';
export type ModelTier = 'NANO' | 'MINI' | 'FRONTIER';

// ============================================
// Dataset Types
// ============================================

export interface DatasetColumnSchema {
  name: string;
  type: string;
  nullable: boolean;
  phi_risk?: PhiExposureRisk;
}

export interface DatasetSchema {
  columns: DatasetColumnSchema[];
  row_count?: number;
}

export interface Dataset {
  id: string; // UUID
  uri: string;
  format: DatasetFormat;
  size_bytes: number;
  sha256?: string;
  row_count?: number;
  governance_mode: GovernanceMode;
  phi_scan_status: PhiScanStatus;
  phi_scan_result?: Record<string, unknown>;
  partition_count: number;
  partition_schema?: Record<string, unknown>;
  detected_schema?: DatasetSchema;
  column_count?: number;
  owner_id?: string;
  project_id?: string;
  tenant_id?: string;
  is_archived: boolean;
  archived_at?: string;
  expires_at?: string;
  created_at: string;
  updated_at: string;
  created_by?: string;
  name?: string;
  description?: string;
  tags?: string[];
  metadata?: Record<string, unknown>;
}

export interface CreateDatasetInput {
  uri: string;
  format: DatasetFormat;
  size_bytes: number;
  sha256?: string;
  row_count?: number;
  governance_mode?: GovernanceMode;
  project_id?: string;
  name?: string;
  description?: string;
  tags?: string[];
  metadata?: Record<string, unknown>;
}

// ============================================
// Dataset Access Log Types
// ============================================

export interface DatasetAccessLog {
  id: number;
  dataset_id: string;
  user_id?: string;
  service_name?: string;
  ip_address?: string;
  access_type: AccessType;
  rows_accessed?: number;
  columns_accessed?: string[];
  purpose?: string;
  run_id?: string;
  stage?: number;
  governance_mode: GovernanceMode;
  phi_exposure_risk?: PhiExposureRisk;
  success: boolean;
  error_message?: string;
  duration_ms?: number;
  accessed_at: string;
  session_id?: string;
  request_id?: string;
}

export interface LogDatasetAccessInput {
  dataset_id: string;
  access_type: AccessType;
  governance_mode: GovernanceMode;
  user_id?: string;
  service_name?: string;
  rows_accessed?: number;
  columns_accessed?: string[];
  purpose?: string;
  run_id?: string;
  stage?: number;
  success?: boolean;
  error_message?: string;
}

// ============================================
// Workflow Stage Run Types
// ============================================

export interface WorkflowStageRun {
  id: string; // UUID
  run_id: string;
  stage_number: number;
  stage_name?: string;
  status: StageStatus;
  progress_percent: number;
  items_total?: number;
  items_processed: number;
  items_failed: number;
  checkpoint_data?: Record<string, unknown>;
  checkpoint_version: number;
  last_checkpoint_at?: string;
  started_at?: string;
  completed_at?: string;
  duration_ms?: number;
  attempt_number: number;
  max_attempts: number;
  last_error?: string;
  ai_call_count: number;
  ai_cost_usd: number;
  ai_latency_total_ms: number;
  input_ref?: string;
  output_ref?: string;
  governance_mode: GovernanceMode;
  project_id?: string;
  user_id?: string;
  tenant_id?: string;
  created_at: string;
  updated_at: string;
  metadata?: Record<string, unknown>;
}

export interface CreateStageRunInput {
  run_id: string;
  stage_number: number;
  stage_name?: string;
  governance_mode: GovernanceMode;
  items_total?: number;
  project_id?: string;
  user_id?: string;
  input_ref?: string;
  metadata?: Record<string, unknown>;
}

export interface UpdateStageRunInput {
  status?: StageStatus;
  progress_percent?: number;
  items_processed?: number;
  items_failed?: number;
  checkpoint_data?: Record<string, unknown>;
  last_error?: string;
  ai_call_count?: number;
  ai_cost_usd?: number;
  ai_latency_total_ms?: number;
  output_ref?: string;
}

// ============================================
// Transparency Report Types
// ============================================

export interface LatencyPercentiles {
  p50: number;
  p90: number;
  p95: number;
  p99: number;
}

export interface StageSummary {
  stage: number;
  stage_name: string;
  call_count: number;
  cost_usd: number;
  avg_latency_ms: number;
  status: StageStatus;
}

export interface ExpensiveCall {
  invocation_id: string;
  model: string;
  provider: string;
  cost_usd: number;
  latency_ms: number;
  purpose?: string;
  stage?: number;
}

export interface PhiSummary {
  scans_total: number;
  flags_total: number;
  redactions_total: number;
  types_detected: string[];
}

export interface TransparencyReport {
  id: string; // UUID
  run_id: string;
  project_id?: string;
  project_name?: string;
  governance_mode: GovernanceMode;
  
  // Summary metrics
  total_ai_calls: number;
  total_cost_usd: number;
  total_latency_ms: number;
  avg_latency_ms?: number;
  
  // Breakdowns
  calls_by_tier: Record<ModelTier, number>;
  calls_by_provider: Record<string, number>;
  latency_percentiles?: LatencyPercentiles;
  
  // PHI summary
  phi_scans_total: number;
  phi_flags_total: number;
  phi_redactions_total: number;
  phi_types_detected?: string[];
  
  // Details
  stage_breakdown?: StageSummary[];
  top_expensive_calls?: ExpensiveCall[];
  recommendations?: string[];
  
  // Full report content
  report_markdown?: string;
  report_html?: string;
  
  // Audit
  generated_at: string;
  generated_by?: string;
  report_version: number;
}

export interface GenerateReportInput {
  run_id: string;
  project_id?: string;
  project_name?: string;
  governance_mode: GovernanceMode;
  include_markdown?: boolean;
  include_html?: boolean;
}

// ============================================
// LIT Bundle Types
// ============================================

export interface LITExample {
  id: string;
  prompt_redacted: string;
  response_redacted: string;
  model: string;
  provider: string;
  tier: ModelTier;
  stage?: number;
  stage_name?: string;
  purpose?: string;
  latency_ms?: number;
  labels?: string[];
}

export interface LITBundle {
  id: string; // UUID
  run_id: string;
  project_id?: string;
  example_count: number;
  stages_covered: number[];
  models_included: string[];
  default_model?: string;
  bundle_uri?: string;
  bundle_size_bytes?: number;
  governance_mode: GovernanceMode;
  redaction_applied: boolean;
  created_at: string;
  created_by?: string;
  metadata?: Record<string, unknown>;
  
  // In-memory only (not persisted)
  examples?: LITExample[];
}

export interface GenerateLITBundleInput {
  run_id: string;
  project_id?: string;
  governance_mode: GovernanceMode;
  max_examples?: number;
  stages?: number[];
}

// ============================================
// Zod Schemas for Validation
// ============================================

export const DatasetSchemaZ = z.object({
  uri: z.string().min(1),
  format: z.enum(['csv', 'parquet', 'ndjson', 'dicom', 'xlsx', 'json', 'hl7', 'fhir']),
  size_bytes: z.number().int().min(0),
  sha256: z.string().length(64).optional(),
  governance_mode: z.enum(['DEMO', 'LIVE']).default('DEMO'),
  project_id: z.string().optional(),
  name: z.string().optional(),
  description: z.string().optional(),
});

export const StageRunSchemaZ = z.object({
  run_id: z.string().uuid(),
  stage_number: z.number().int().min(1).max(20),
  stage_name: z.string().optional(),
  governance_mode: z.enum(['DEMO', 'LIVE', 'OFFLINE']),
  items_total: z.number().int().min(0).optional(),
  project_id: z.string().optional(),
});

export const TransparencyReportSchemaZ = z.object({
  run_id: z.string().uuid(),
  project_id: z.string().optional(),
  project_name: z.string().optional(),
  governance_mode: z.enum(['DEMO', 'LIVE']),
  total_ai_calls: z.number().int().min(0),
  total_cost_usd: z.number().min(0),
  total_latency_ms: z.number().int().min(0),
  calls_by_tier: z.record(z.number()),
  calls_by_provider: z.record(z.number()),
});

// ============================================
// Utility Types
// ============================================

export type DatasetWithAccess = Dataset & {
  recent_access: DatasetAccessLog[];
  access_count: number;
};

export type RunProgress = {
  run_id: string;
  stages: WorkflowStageRun[];
  current_stage: number;
  overall_progress: number;
  estimated_completion?: string;
};

export type TransparencySummary = Pick<TransparencyReport, 
  'total_ai_calls' | 'total_cost_usd' | 'avg_latency_ms' | 'calls_by_tier'
>;
