/**
 * Data Import Wizard Service
 * Task 144 - Data import wizards from external sources
 *
 * Provides:
 * - Multi-source data import (CSV, Excel, REDCap, S3, etc.)
 * - Schema detection and mapping
 * - PHI scanning during import
 * - Import job tracking
 */

import { z } from 'zod';
import crypto from 'crypto';

// ─────────────────────────────────────────────────────────────
// Types & Schemas
// ─────────────────────────────────────────────────────────────

export const ImportSourceTypeSchema = z.enum([
  'CSV',
  'EXCEL',
  'JSON',
  'REDCAP',
  'S3',
  'GOOGLE_DRIVE',
  'DATABASE',
  'API',
]);

export const ColumnTypeSchema = z.enum([
  'STRING',
  'NUMBER',
  'INTEGER',
  'BOOLEAN',
  'DATE',
  'DATETIME',
  'ARRAY',
  'OBJECT',
  'UNKNOWN',
]);

export const PHIStatusSchema = z.enum([
  'CLEAN',
  'DETECTED',
  'NEEDS_REVIEW',
  'SCRUBBED',
]);

export const ImportJobStatusSchema = z.enum([
  'PENDING',
  'VALIDATING',
  'MAPPING',
  'IMPORTING',
  'PHI_SCANNING',
  'COMPLETED',
  'FAILED',
  'CANCELLED',
]);

export const ColumnDefinitionSchema = z.object({
  name: z.string(),
  originalName: z.string(),
  type: ColumnTypeSchema,
  nullable: z.boolean().default(true),
  description: z.string().optional(),
  phiStatus: PHIStatusSchema.default('NEEDS_REVIEW'),
  phiCategory: z.string().optional(), // e.g., 'SSN', 'MRN', 'DOB', 'NAME'
  transform: z.enum(['NONE', 'HASH', 'REDACT', 'GENERALIZE', 'SKIP']).default('NONE'),
});

export const ImportConfigSchema = z.object({
  sourceType: ImportSourceTypeSchema,
  sourceConfig: z.record(z.unknown()), // Source-specific configuration
  targetResearchId: z.string().uuid(),
  targetArtifactName: z.string(),
  columnMappings: z.array(ColumnDefinitionSchema),
  options: z.object({
    hasHeader: z.boolean().default(true),
    delimiter: z.string().default(','),
    encoding: z.string().default('utf-8'),
    skipRows: z.number().default(0),
    maxRows: z.number().optional(),
    dateFormat: z.string().default('YYYY-MM-DD'),
    enablePHIScan: z.boolean().default(true),
    autoPHIScrub: z.boolean().default(false),
  }).default({}),
});

export const ImportJobSchema = z.object({
  id: z.string().uuid(),
  userId: z.string(),
  tenantId: z.string(),
  config: ImportConfigSchema,
  status: ImportJobStatusSchema,
  progress: z.number().min(0).max(100).default(0),
  rowsProcessed: z.number().default(0),
  rowsTotal: z.number().optional(),
  errors: z.array(z.object({
    row: z.number().optional(),
    column: z.string().optional(),
    message: z.string(),
    severity: z.enum(['ERROR', 'WARNING']),
  })).default([]),
  warnings: z.number().default(0),
  phiDetections: z.number().default(0),
  resultArtifactId: z.string().uuid().optional(),
  startedAt: z.string().datetime().optional(),
  completedAt: z.string().datetime().optional(),
  createdAt: z.string().datetime(),
});

export type ImportSourceType = z.infer<typeof ImportSourceTypeSchema>;
export type ColumnType = z.infer<typeof ColumnTypeSchema>;
export type PHIStatus = z.infer<typeof PHIStatusSchema>;
export type ImportJobStatus = z.infer<typeof ImportJobStatusSchema>;
export type ColumnDefinition = z.infer<typeof ColumnDefinitionSchema>;
export type ImportConfig = z.infer<typeof ImportConfigSchema>;
export type ImportJob = z.infer<typeof ImportJobSchema>;

// ─────────────────────────────────────────────────────────────
// In-Memory Storage
// ─────────────────────────────────────────────────────────────

const importJobs: Map<string, ImportJob> = new Map();

// ─────────────────────────────────────────────────────────────
// Source Configuration Schemas
// ─────────────────────────────────────────────────────────────

export const CSVSourceConfigSchema = z.object({
  fileContent: z.string().optional(), // Base64 or raw CSV
  fileUrl: z.string().url().optional(),
});

export const ExcelSourceConfigSchema = z.object({
  fileContent: z.string().optional(),
  fileUrl: z.string().url().optional(),
  sheetName: z.string().optional(),
  sheetIndex: z.number().default(0),
});

export const REDCapSourceConfigSchema = z.object({
  apiUrl: z.string().url(),
  token: z.string(),
  formName: z.string().optional(),
  recordIds: z.array(z.string()).optional(),
  dateRangeStart: z.string().optional(),
  dateRangeEnd: z.string().optional(),
});

export const S3SourceConfigSchema = z.object({
  bucket: z.string(),
  key: z.string(),
  region: z.string().default('us-east-1'),
  accessKeyId: z.string().optional(),
  secretAccessKey: z.string().optional(),
  useIAMRole: z.boolean().default(false),
});

export const DatabaseSourceConfigSchema = z.object({
  connectionString: z.string(),
  query: z.string(),
  parameters: z.array(z.unknown()).default([]),
});

// ─────────────────────────────────────────────────────────────
// Schema Detection
// ─────────────────────────────────────────────────────────────

export interface PreviewResult {
  columns: ColumnDefinition[];
  sampleRows: Record<string, unknown>[];
  totalRows: number;
  phiWarnings: Array<{
    column: string;
    category: string;
    confidence: number;
  }>;
}

export async function previewSource(
  sourceType: ImportSourceType,
  sourceConfig: Record<string, unknown>,
  options?: {
    sampleSize?: number;
    hasHeader?: boolean;
    delimiter?: string;
  }
): Promise<PreviewResult> {
  const sampleSize = options?.sampleSize ?? 100;

  // Mock preview based on source type
  switch (sourceType) {
    case 'CSV':
    case 'EXCEL':
      return previewFileSource(sourceConfig, sampleSize, options);
    case 'REDCAP':
      return previewREDCapSource(sourceConfig as z.infer<typeof REDCapSourceConfigSchema>, sampleSize);
    case 'S3':
      return previewS3Source(sourceConfig as z.infer<typeof S3SourceConfigSchema>, sampleSize);
    default:
      throw new Error(`Unsupported source type: ${sourceType}`);
  }
}

async function previewFileSource(
  config: Record<string, unknown>,
  sampleSize: number,
  options?: { hasHeader?: boolean; delimiter?: string }
): Promise<PreviewResult> {
  // Mock implementation - in production, parse actual file
  const columns: ColumnDefinition[] = [
    { name: 'patient_id', originalName: 'Patient ID', type: 'STRING', nullable: false, phiStatus: 'DETECTED', phiCategory: 'MRN', transform: 'HASH' },
    { name: 'admission_date', originalName: 'Admission Date', type: 'DATE', nullable: true, phiStatus: 'CLEAN', transform: 'NONE' },
    { name: 'diagnosis_code', originalName: 'Diagnosis Code', type: 'STRING', nullable: false, phiStatus: 'CLEAN', transform: 'NONE' },
    { name: 'ssn', originalName: 'SSN', type: 'STRING', nullable: true, phiStatus: 'DETECTED', phiCategory: 'SSN', transform: 'REDACT' },
    { name: 'age', originalName: 'Age', type: 'INTEGER', nullable: true, phiStatus: 'CLEAN', transform: 'NONE' },
    { name: 'lab_value', originalName: 'Lab Value', type: 'NUMBER', nullable: true, phiStatus: 'CLEAN', transform: 'NONE' },
  ];

  const sampleRows = [
    { patient_id: 'P001', admission_date: '2024-01-15', diagnosis_code: 'J18.9', ssn: '123-45-6789', age: 45, lab_value: 7.2 },
    { patient_id: 'P002', admission_date: '2024-01-16', diagnosis_code: 'I10', ssn: '987-65-4321', age: 62, lab_value: 5.8 },
    { patient_id: 'P003', admission_date: '2024-01-17', diagnosis_code: 'E11.9', ssn: null, age: 38, lab_value: 9.1 },
  ];

  return {
    columns,
    sampleRows,
    totalRows: 1500,
    phiWarnings: [
      { column: 'patient_id', category: 'MRN', confidence: 0.95 },
      { column: 'ssn', category: 'SSN', confidence: 0.99 },
    ],
  };
}

async function previewREDCapSource(
  config: z.infer<typeof REDCapSourceConfigSchema>,
  sampleSize: number
): Promise<PreviewResult> {
  // Mock REDCap preview
  return {
    columns: [
      { name: 'record_id', originalName: 'record_id', type: 'STRING', nullable: false, phiStatus: 'CLEAN', transform: 'NONE' },
      { name: 'redcap_event_name', originalName: 'redcap_event_name', type: 'STRING', nullable: true, phiStatus: 'CLEAN', transform: 'NONE' },
      { name: 'study_id', originalName: 'study_id', type: 'STRING', nullable: false, phiStatus: 'CLEAN', transform: 'NONE' },
    ],
    sampleRows: [
      { record_id: '1', redcap_event_name: 'baseline_arm_1', study_id: 'STUDY001' },
    ],
    totalRows: 250,
    phiWarnings: [],
  };
}

async function previewS3Source(
  config: z.infer<typeof S3SourceConfigSchema>,
  sampleSize: number
): Promise<PreviewResult> {
  // Mock S3 preview - would download and parse file
  return previewFileSource({}, sampleSize);
}

// ─────────────────────────────────────────────────────────────
// PHI Detection
// ─────────────────────────────────────────────────────────────

const PHI_PATTERNS: Array<{
  category: string;
  patterns: RegExp[];
  confidence: number;
}> = [
  {
    category: 'SSN',
    patterns: [/\d{3}-\d{2}-\d{4}/, /\d{9}/],
    confidence: 0.95,
  },
  {
    category: 'MRN',
    patterns: [/MRN[-:]?\s*\d+/i, /patient[-_]?id/i],
    confidence: 0.85,
  },
  {
    category: 'DOB',
    patterns: [/\b(dob|date.of.birth|birth.?date)\b/i],
    confidence: 0.90,
  },
  {
    category: 'EMAIL',
    patterns: [/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/],
    confidence: 0.95,
  },
  {
    category: 'PHONE',
    patterns: [/\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/],
    confidence: 0.90,
  },
  {
    category: 'NAME',
    patterns: [/\b(first.?name|last.?name|patient.?name|full.?name)\b/i],
    confidence: 0.80,
  },
  {
    category: 'ADDRESS',
    patterns: [/\b(address|street|city|zip.?code|postal)\b/i],
    confidence: 0.85,
  },
];

export function detectPHI(
  columnName: string,
  sampleValues: unknown[]
): { detected: boolean; category?: string; confidence: number } {
  // Check column name
  for (const pattern of PHI_PATTERNS) {
    for (const regex of pattern.patterns) {
      if (regex.test(columnName)) {
        return {
          detected: true,
          category: pattern.category,
          confidence: pattern.confidence,
        };
      }
    }
  }

  // Check sample values
  for (const value of sampleValues) {
    if (typeof value !== 'string') continue;

    for (const pattern of PHI_PATTERNS) {
      for (const regex of pattern.patterns) {
        if (regex.test(value)) {
          return {
            detected: true,
            category: pattern.category,
            confidence: pattern.confidence * 0.9, // Slightly lower confidence for value matches
          };
        }
      }
    }
  }

  return { detected: false, confidence: 0 };
}

// ─────────────────────────────────────────────────────────────
// Import Job Management
// ─────────────────────────────────────────────────────────────

export function createImportJob(
  config: ImportConfig,
  userId: string,
  tenantId: string
): ImportJob {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  const job: ImportJob = {
    id,
    userId,
    tenantId,
    config,
    status: 'PENDING',
    progress: 0,
    rowsProcessed: 0,
    errors: [],
    warnings: 0,
    phiDetections: 0,
    createdAt: now,
  };

  importJobs.set(id, job);
  return job;
}

export function getImportJob(id: string): ImportJob | undefined {
  return importJobs.get(id);
}

export function listImportJobs(
  tenantId: string,
  options?: {
    userId?: string;
    status?: ImportJobStatus;
    limit?: number;
  }
): ImportJob[] {
  let jobs = Array.from(importJobs.values())
    .filter(j => j.tenantId === tenantId);

  if (options?.userId) {
    jobs = jobs.filter(j => j.userId === options.userId);
  }

  if (options?.status) {
    jobs = jobs.filter(j => j.status === options.status);
  }

  jobs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  if (options?.limit) {
    jobs = jobs.slice(0, options.limit);
  }

  return jobs;
}

export function cancelImportJob(id: string): boolean {
  const job = importJobs.get(id);
  if (!job) return false;

  if (['COMPLETED', 'FAILED', 'CANCELLED'].includes(job.status)) {
    return false;
  }

  job.status = 'CANCELLED';
  job.completedAt = new Date().toISOString();
  importJobs.set(id, job);
  return true;
}

// ─────────────────────────────────────────────────────────────
// Import Execution
// ─────────────────────────────────────────────────────────────

export async function executeImport(jobId: string): Promise<ImportJob> {
  const job = importJobs.get(jobId);
  if (!job) {
    throw new Error('Import job not found');
  }

  if (job.status !== 'PENDING') {
    throw new Error(`Cannot execute job in status: ${job.status}`);
  }

  job.status = 'VALIDATING';
  job.startedAt = new Date().toISOString();
  importJobs.set(jobId, job);

  try {
    // Step 1: Validate configuration
    await validateImportConfig(job.config);
    updateJobProgress(job, 10, 'MAPPING');

    // Step 2: Apply column mappings
    await applyColumnMappings(job);
    updateJobProgress(job, 30, 'PHI_SCANNING');

    // Step 3: PHI scanning
    if (job.config.options.enablePHIScan) {
      const phiCount = await scanForPHI(job);
      job.phiDetections = phiCount;
    }
    updateJobProgress(job, 50, 'IMPORTING');

    // Step 4: Import data (mock)
    await simulateImport(job);
    updateJobProgress(job, 100, 'COMPLETED');

    // Create result artifact ID
    job.resultArtifactId = crypto.randomUUID();
    job.completedAt = new Date().toISOString();
    importJobs.set(jobId, job);

    return job;
  } catch (error: any) {
    job.status = 'FAILED';
    job.completedAt = new Date().toISOString();
    job.errors.push({
      message: error.message ?? 'Unknown error',
      severity: 'ERROR',
    });
    importJobs.set(jobId, job);
    return job;
  }
}

async function validateImportConfig(config: ImportConfig): Promise<void> {
  // Validate source configuration
  if (!config.sourceType) {
    throw new Error('Source type is required');
  }

  if (!config.targetResearchId) {
    throw new Error('Target research ID is required');
  }

  if (!config.targetArtifactName) {
    throw new Error('Target artifact name is required');
  }

  // Validate column mappings
  for (const col of config.columnMappings) {
    if (col.phiStatus === 'DETECTED' && col.transform === 'NONE') {
      throw new Error(`PHI detected in column "${col.name}" but no transform specified`);
    }
  }
}

async function applyColumnMappings(job: ImportJob): Promise<void> {
  // In production, validate and apply transformations
  await new Promise(resolve => setTimeout(resolve, 100));
}

async function scanForPHI(job: ImportJob): Promise<number> {
  // Mock PHI scanning
  await new Promise(resolve => setTimeout(resolve, 200));

  const detectedCount = job.config.columnMappings
    .filter(c => c.phiStatus === 'DETECTED').length;

  return detectedCount;
}

async function simulateImport(job: ImportJob): Promise<void> {
  // Simulate processing rows
  const totalRows = 1500; // Mock total
  job.rowsTotal = totalRows;

  for (let i = 0; i < totalRows; i += 100) {
    await new Promise(resolve => setTimeout(resolve, 10));
    job.rowsProcessed = Math.min(i + 100, totalRows);
    job.progress = 50 + Math.floor((job.rowsProcessed / totalRows) * 50);
    importJobs.set(job.id, job);
  }
}

function updateJobProgress(
  job: ImportJob,
  progress: number,
  status: ImportJobStatus
): void {
  job.progress = progress;
  job.status = status;
  importJobs.set(job.id, job);
}

// ─────────────────────────────────────────────────────────────
// Data Transformations
// ─────────────────────────────────────────────────────────────

export function applyTransform(
  value: unknown,
  transform: ColumnDefinition['transform']
): unknown {
  if (value === null || value === undefined) return value;

  switch (transform) {
    case 'NONE':
      return value;
    case 'HASH':
      return hashValue(String(value));
    case 'REDACT':
      return '[REDACTED]';
    case 'GENERALIZE':
      return generalizeValue(value);
    case 'SKIP':
      return undefined;
    default:
      return value;
  }
}

function hashValue(value: string): string {
  return crypto.createHash('sha256').update(value).digest('hex').substring(0, 16);
}

function generalizeValue(value: unknown): unknown {
  if (typeof value === 'number') {
    // Round to nearest 10
    return Math.round(value / 10) * 10;
  }

  if (typeof value === 'string') {
    // For dates, keep only year-month
    const dateMatch = value.match(/^(\d{4})-(\d{2})/);
    if (dateMatch) {
      return `${dateMatch[1]}-${dateMatch[2]}`;
    }
    // Truncate strings
    return value.substring(0, 3) + '***';
  }

  return value;
}

// ─────────────────────────────────────────────────────────────
// Exports
// ─────────────────────────────────────────────────────────────

export default {
  // Preview
  previewSource,
  detectPHI,

  // Job Management
  createImportJob,
  getImportJob,
  listImportJobs,
  cancelImportJob,
  executeImport,

  // Transformations
  applyTransform,
};
