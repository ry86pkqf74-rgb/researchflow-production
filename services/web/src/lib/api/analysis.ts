// ============================================
// ResearchFlow Analysis API Service
// ============================================
// API functions for statistical analysis endpoints

import { apiClient, ApiResponse } from './client';

// Types for analysis requests and responses
export interface DescriptiveRequest {
  dataset_id: string;
  columns: string[];
}

export interface InferentialRequest {
  dataset_id: string;
  test_type: 'ttest' | 'paired_ttest' | 'anova' | 'chi_square' | 'mann_whitney' | 'wilcoxon' | 'kruskal_wallis';
  group_column?: string;
  value_column?: string;
  columns?: string[];
  alpha?: number;
}

export interface RegressionRequest {
  dataset_id: string;
  regression_type: 'linear' | 'logistic' | 'cox';
  dependent_variable: string;
  independent_variables: string[];
  time_column?: string;
  event_column?: string;
}

export interface SurvivalRequest {
  dataset_id: string;
  analysis_type: 'kaplan_meier' | 'log_rank' | 'cox';
  time_column: string;
  event_column: string;
  group_column?: string;
  covariates?: string[];
}

export interface AnalysisRunRequest {
  analysis_type: 'descriptive' | 'inferential' | 'regression' | 'survival';
  dataset_id: string;
  variables?: Record<string, unknown>;
  options?: Record<string, unknown>;
}

export interface SAPRequest {
  dataset_id: string;
  tests: Array<{
    name: string;
    type: string;
    variables: Record<string, unknown>;
    options?: Record<string, unknown>;
  }>;
  alpha?: number;
  correction?: 'none' | 'bonferroni' | 'holm' | 'fdr';
}

export interface Dataset {
  id: string;
  name: string;
  description?: string;
  row_count: number;
  column_count: number;
  columns: string[];
  created_at: string;
}

export interface DatasetSchema {
  columns: Array<{
    name: string;
    type: string;
    nullable: boolean;
    unique_values?: number;
    sample_values?: unknown[];
  }>;
}

export interface AnalysisResult {
  success: boolean;
  analysis_type: string;
  results: Record<string, unknown>;
  execution_time_ms?: number;
  error?: string;
}

export interface SAPResult {
  success: boolean;
  total_tests: number;
  completed_tests: number;
  results: Array<{
    test_name: string;
    test_type: string;
    success: boolean;
    result?: Record<string, unknown>;
    error?: string;
  }>;
  execution_time_ms: number;
}

// Analysis API functions
export const analysisApi = {
  /**
   * Run a general analysis
   */
  run: (request: AnalysisRunRequest): Promise<ApiResponse<AnalysisResult>> =>
    apiClient.post('/api/analysis/run', request),

  /**
   * Run descriptive analysis
   */
  descriptive: (request: DescriptiveRequest): Promise<ApiResponse<AnalysisResult>> =>
    apiClient.post('/api/analysis/descriptive', request),

  /**
   * Run inferential analysis (t-test, ANOVA, chi-square, etc.)
   */
  inferential: (request: InferentialRequest): Promise<ApiResponse<AnalysisResult>> =>
    apiClient.post('/api/analysis/inferential', request),

  /**
   * Run survival analysis (Kaplan-Meier, log-rank, Cox)
   */
  survival: (request: SurvivalRequest): Promise<ApiResponse<AnalysisResult>> =>
    apiClient.post('/api/analysis/survival', request),

  /**
   * Run regression analysis (linear, logistic, Cox)
   */
  regression: (request: RegressionRequest): Promise<ApiResponse<AnalysisResult>> =>
    apiClient.post('/api/analysis/regression', request),

  /**
   * Execute a Statistical Analysis Plan (SAP)
   */
  executeSAP: (request: SAPRequest): Promise<ApiResponse<SAPResult>> =>
    apiClient.post('/api/analysis/sap/execute', request),

  /**
   * Get list of available datasets
   */
  getDatasets: (): Promise<ApiResponse<Dataset[]>> =>
    apiClient.get('/api/datasets'),

  /**
   * Get schema for a specific dataset
   */
  getDatasetSchema: (id: string): Promise<ApiResponse<DatasetSchema>> =>
    apiClient.get(`/api/datasets/${id}/schema`),

  /**
   * Get dataset preview (first N rows)
   */
  getDatasetPreview: (id: string, limit?: number): Promise<ApiResponse<{ columns: string[]; rows: unknown[][] }>> =>
    apiClient.get(`/api/datasets/${id}/preview`, { limit }),
};
