/**
 * Data Quality Types for Phase C
 *
 * Shared schemas for data quality profiling, schema inference,
 * and quality dashboard.
 */

import { z } from 'zod';

/**
 * Column type inference result
 */
export const InferredColumnType = z.enum([
  'integer',
  'float',
  'string',
  'boolean',
  'date',
  'datetime',
  'time',
  'categorical',
  'text',       // Long text / unstructured
  'json',
  'array',
  'binary',
  'unknown'
]);
export type InferredColumnType = z.infer<typeof InferredColumnType>;

/**
 * Column statistics
 */
export const ColumnStats = z.object({
  name: z.string(),
  inferredType: InferredColumnType,
  originalType: z.string().optional(), // Raw dtype from source

  // Completeness
  totalCount: z.number().int(),
  nullCount: z.number().int(),
  nullPercentage: z.number(),

  // Uniqueness
  uniqueCount: z.number().int(),
  uniquePercentage: z.number(),
  isDuplicated: z.boolean(),

  // Distribution (for numeric)
  min: z.union([z.number(), z.string()]).optional(),
  max: z.union([z.number(), z.string()]).optional(),
  mean: z.number().optional(),
  median: z.number().optional(),
  std: z.number().optional(),
  percentile25: z.number().optional(),
  percentile75: z.number().optional(),

  // Categorical stats
  topValues: z.array(z.object({
    value: z.string(),
    count: z.number().int(),
    percentage: z.number(),
  })).optional(),
  cardinality: z.number().int().optional(),

  // Pattern detection (for strings)
  sampleValues: z.array(z.string()).optional(),
  detectedPattern: z.string().optional(), // Regex or format description

  // PHI detection
  phiRisk: z.enum(['none', 'low', 'medium', 'high']).optional(),
  phiTypes: z.array(z.string()).optional(),
});
export type ColumnStats = z.infer<typeof ColumnStats>;

/**
 * Schema inference result (for Task 52)
 */
export const SchemaInferenceResult = z.object({
  datasetId: z.string().optional(),
  fileName: z.string().optional(),
  format: z.string(),

  // Row counts
  totalRows: z.number().int(),
  sampledRows: z.number().int().optional(),

  // Column information
  columns: z.array(ColumnStats),
  totalColumns: z.number().int(),

  // Overall quality scores
  completenessScore: z.number().min(0).max(100),
  uniquenessScore: z.number().min(0).max(100),

  // Detected relationships
  possiblePrimaryKeys: z.array(z.string()).optional(),
  possibleForeignKeys: z.array(z.object({
    column: z.string(),
    referencedTable: z.string().optional(),
    referencedColumn: z.string().optional(),
  })).optional(),

  // Warnings and suggestions
  warnings: z.array(z.string()),
  suggestions: z.array(z.string()),

  inferredAt: z.string(),
});
export type SchemaInferenceResult = z.infer<typeof SchemaInferenceResult>;

/**
 * Data profiling report summary (from ydata-profiling, Task 53)
 */
export const ProfilingReportSummary = z.object({
  datasetId: z.string().optional(),
  fileName: z.string().optional(),

  // Overview
  totalRows: z.number().int(),
  totalColumns: z.number().int(),
  totalMissing: z.number().int(),
  missingPercentage: z.number(),
  duplicateRows: z.number().int(),
  duplicatePercentage: z.number(),
  totalMemoryBytes: z.number().int().optional(),

  // Column type distribution
  columnTypes: z.record(InferredColumnType, z.number().int()),

  // Quality alerts
  highNullColumns: z.array(z.string()), // >50% null
  highCardinalityColumns: z.array(z.string()), // >90% unique
  constantColumns: z.array(z.string()), // Single value
  highlyCorrelatedPairs: z.array(z.object({
    column1: z.string(),
    column2: z.string(),
    correlation: z.number(),
  })).optional(),

  // Report artifact
  htmlReportPath: z.string().optional(),
  jsonReportPath: z.string().optional(),

  profiledAt: z.string(),
  profilingDurationMs: z.number().int().optional(),
});
export type ProfilingReportSummary = z.infer<typeof ProfilingReportSummary>;

/**
 * Deduplication result (for Task 57)
 */
export const DeduplicationResult = z.object({
  datasetId: z.string().optional(),

  // Counts
  originalCount: z.number().int(),
  deduplicatedCount: z.number().int(),
  removedCount: z.number().int(),
  removalPercentage: z.number(),

  // Dedup strategy used
  strategy: z.enum(['exact', 'fuzzy', 'minhash', 'semantic']),
  threshold: z.number().optional(), // For fuzzy matching

  // Dedup map
  clusters: z.array(z.object({
    keptId: z.string(),
    removedIds: z.array(z.string()),
    similarity: z.number().optional(),
  })).optional(),

  // Per-column analysis
  keyColumns: z.array(z.string()).optional(),

  deduplicatedAt: z.string(),
  durationMs: z.number().int().optional(),
});
export type DeduplicationResult = z.infer<typeof DeduplicationResult>;

/**
 * OCR extraction result (for Task 50)
 */
export const OcrExtractionResult = z.object({
  sourceFile: z.string(),
  format: z.enum(['image', 'pdf']),

  // Results
  pages: z.array(z.object({
    pageNumber: z.number().int(),
    text: z.string(),
    confidence: z.number().min(0).max(1).optional(),
    boundingBoxes: z.array(z.object({
      text: z.string(),
      x: z.number(),
      y: z.number(),
      width: z.number(),
      height: z.number(),
      confidence: z.number().optional(),
    })).optional(),
  })),

  // Aggregated
  fullText: z.string(),
  totalPages: z.number().int(),
  averageConfidence: z.number().optional(),
  language: z.string().optional(),

  extractedAt: z.string(),
  durationMs: z.number().int().optional(),
});
export type OcrExtractionResult = z.infer<typeof OcrExtractionResult>;

/**
 * Transcription result (for Task 56)
 */
export const TranscriptionResult = z.object({
  sourceFile: z.string(),
  format: z.enum(['audio', 'video']),
  durationSeconds: z.number(),

  // Full transcript
  text: z.string(),
  language: z.string(),
  languageConfidence: z.number().optional(),

  // Timestamped segments
  segments: z.array(z.object({
    start: z.number(),
    end: z.number(),
    text: z.string(),
    confidence: z.number().optional(),
    speaker: z.string().optional(), // If diarization is available
  })),

  // Model info
  model: z.string(),
  transcribedAt: z.string(),
  durationMs: z.number().int().optional(),
});
export type TranscriptionResult = z.infer<typeof TranscriptionResult>;

/**
 * Entity extraction result (for Task 51)
 */
export const EntityExtractionResult = z.object({
  sourceFile: z.string().optional(),
  sourceText: z.string().optional(),

  entities: z.array(z.object({
    text: z.string(),
    label: z.string(),          // Entity type (e.g., DISEASE, DRUG, GENE)
    start: z.number().int(),
    end: z.number().int(),
    confidence: z.number().optional(),
    normalizedForm: z.string().optional(),  // Canonical form if available
    cui: z.string().optional(), // UMLS Concept Unique Identifier
  })),

  // Counts by type
  entityCounts: z.record(z.string(), z.number().int()),

  // Model info
  model: z.string(),
  extractedAt: z.string(),
  durationMs: z.number().int().optional(),
});
export type EntityExtractionResult = z.infer<typeof EntityExtractionResult>;

/**
 * Data fusion report (for Task 54)
 */
export const DataFusionReport = z.object({
  // Source datasets
  sources: z.array(z.object({
    id: z.string(),
    name: z.string(),
    rowCount: z.number().int(),
    columnCount: z.number().int(),
  })),

  // Fusion operation
  fusionType: z.enum(['join', 'union', 'merge', 'append']),
  joinKeys: z.array(z.string()).optional(),

  // Results
  outputRowCount: z.number().int(),
  outputColumnCount: z.number().int(),

  // Schema alignment
  columnMappings: z.array(z.object({
    outputColumn: z.string(),
    sourceColumns: z.array(z.object({
      sourceId: z.string(),
      column: z.string(),
    })),
    transformApplied: z.string().optional(),
  })),

  // Data quality issues
  unmatchedRows: z.record(z.string(), z.number().int()).optional(),
  typeConflicts: z.array(z.object({
    column: z.string(),
    sourceTypes: z.record(z.string(), z.string()),
    resolvedType: z.string(),
  })).optional(),

  fusedAt: z.string(),
  durationMs: z.number().int().optional(),
});
export type DataFusionReport = z.infer<typeof DataFusionReport>;

/**
 * Quality dashboard dataset metrics
 */
export const DatasetQualityMetrics = z.object({
  datasetId: z.string(),
  datasetName: z.string(),

  // PHI status
  phiStatus: z.enum(['clean', 'detected', 'pending', 'not_scanned']),
  phiFindingsCount: z.number().int().optional(),
  phiScanAt: z.string().optional(),

  // Completeness
  completenessScore: z.number().min(0).max(100),
  totalRows: z.number().int(),
  totalColumns: z.number().int(),
  missingPercentage: z.number(),

  // Uniqueness
  uniquenessScore: z.number().min(0).max(100),
  duplicateRows: z.number().int(),

  // Schema
  hasSchemaInference: z.boolean(),
  schemaInferenceAt: z.string().optional(),

  // Profiling
  hasProfilingReport: z.boolean(),
  profilingReportUrl: z.string().optional(),
  profiledAt: z.string().optional(),

  // Deduplication
  hasDeduplication: z.boolean(),
  deduplicationAt: z.string().optional(),

  // Last updated
  lastUpdated: z.string(),
});
export type DatasetQualityMetrics = z.infer<typeof DatasetQualityMetrics>;

/**
 * Quality dashboard aggregated metrics
 */
export const QualityDashboardMetrics = z.object({
  datasets: z.array(DatasetQualityMetrics),

  // Aggregated stats
  totalDatasets: z.number().int(),
  datasetsWithPhi: z.number().int(),
  averageCompleteness: z.number(),
  averageUniqueness: z.number(),

  // Literature metrics
  literature: z.object({
    totalPapers: z.number().int(),
    indexedPapers: z.number().int(),
    lastSyncedAt: z.string().optional(),
  }).optional(),

  // Job metrics
  recentJobs: z.array(z.object({
    jobId: z.string(),
    type: z.string(),
    status: z.enum(['pending', 'running', 'completed', 'failed']),
    startedAt: z.string(),
    completedAt: z.string().optional(),
    durationMs: z.number().int().optional(),
  })).optional(),

  generatedAt: z.string(),
});
export type QualityDashboardMetrics = z.infer<typeof QualityDashboardMetrics>;
