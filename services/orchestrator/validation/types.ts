/**
 * INF-14: Validation Suites (Pandera-style)
 * Core type definitions for runtime data validation
 */

export enum ArtifactType {
  MANUSCRIPT = 'manuscript',
  DATASET_SCHEMA = 'dataset_schema',
  CONFIG_SNAPSHOT = 'config_snapshot',
  ANALYSIS_RESULT = 'analysis_result',
  FIGURE = 'figure',
  TABLE = 'table',
  PROVENANCE_RECORD = 'provenance_record',
  AUDIT_LOG = 'audit_log',
  EXPORT_BUNDLE = 'export_bundle',
}

export interface ValidationError {
  rule: string;
  message: string;
  path?: string;
  severity: 'error' | 'warning';
  details?: Record<string, unknown>;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: string[];
  validatedAt: string;
  artifactType?: ArtifactType;
  ruleCounts: {
    total: number;
    passed: number;
    failed: number;
  };
}

export interface ValidationRule {
  name: string;
  check: (data: unknown) => boolean;
  errorMessage: string;
  severity?: 'error' | 'warning';
  path?: string;
}

export interface ValidationSuite {
  name: string;
  artifactType: ArtifactType;
  rules: ValidationRule[];
  validate: (data: unknown) => ValidationResult;
  version: string;
}

export interface ManuscriptData {
  title?: string;
  abstract?: string;
  sections?: Array<{
    name: string;
    content: string;
  }>;
  authors?: Array<{
    name: string;
    affiliation?: string;
  }>;
  references?: string[];
  keywords?: string[];
  content?: string;
}

export interface DatasetSchemaData {
  name?: string;
  columns?: Array<{
    name: string;
    type: string;
    nullable?: boolean;
    constraints?: string[];
  }>;
  primaryKey?: string | string[];
  version?: string;
  description?: string;
}

export interface ConfigSnapshotData {
  version?: string;
  environment?: string;
  settings?: Record<string, unknown>;
  features?: Record<string, boolean>;
  createdAt?: string;
  hash?: string;
}

export interface AnalysisResultData {
  analysisId?: string;
  type?: string;
  status?: string;
  results?: unknown;
  metrics?: Record<string, number>;
  executedAt?: string;
  parameters?: Record<string, unknown>;
}

export const REQUIRED_MANUSCRIPT_SECTIONS = [
  'introduction',
  'methods',
  'results',
  'discussion',
] as const;

export const VALID_COLUMN_TYPES = [
  'string',
  'integer',
  'float',
  'boolean',
  'date',
  'datetime',
  'timestamp',
  'text',
  'json',
  'array',
  'uuid',
] as const;

export const VALID_ENVIRONMENTS = [
  'development',
  'staging',
  'production',
  'test',
] as const;
