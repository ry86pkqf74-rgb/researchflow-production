/**
 * Manuscript Engine Type Definitions
 * Core types for manuscript creation and management
 */

import { z } from 'zod';

// IMRaD Section Types - Extended to include all manuscript sections
export type IMRaDSection =
  | 'abstract'
  | 'introduction'
  | 'methods'
  | 'results'
  | 'discussion'
  | 'references'
  | 'title'
  | 'keywords'
  | 'acknowledgments'
  | 'appendices'
  | 'supplementary'
  | 'case_presentation'
  | 'what_is_already_known'
  | 'what_this_study_adds'
  | 'panel'
  | 'conclusion';

export type ManuscriptStatus = 'draft' | 'review' | 'approved' | 'submitted' | 'published';

export type TemplateType = 'imrad' | 'case_report' | 'systematic_review' | 'meta_analysis';

export type CitationStyle = 'AMA' | 'APA' | 'Vancouver' | 'NLM' | 'Chicago';

// Clinical Data Types
export const ClinicalDatasetSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.enum(['trial', 'observational', 'case_series', 'case_report']),
  metadata: z.object({
    studyDesign: z.string(),
    population: z.string(),
    sampleSize: z.number(),
    variables: z.array(z.string()),
    timeframe: z.string().optional(),
  }),
  data: z.array(z.record(z.unknown())),
  statistics: z.object({
    summary: z.record(z.unknown()),
    tests: z.array(z.object({
      name: z.string(),
      pValue: z.number().optional(),
      statistic: z.number().optional(),
      confidenceInterval: z.tuple([z.number(), z.number()]).optional(),
    })),
  }).optional(),
});

export type ClinicalDataset = z.infer<typeof ClinicalDatasetSchema>;

// Section Content Types
export interface SectionContent {
  section: IMRaDSection;
  content: string;
  wordCount: number;
  citations: string[];
  figures: string[];
  tables: string[];
  generatedAt: Date;
  generatedBy: 'human' | 'ai' | 'hybrid';
}

// Manuscript Version
export interface ManuscriptVersion {
  id: string;
  manuscriptId: string;
  versionNumber: number;
  content: Record<IMRaDSection, SectionContent>;
  dataSnapshotHash: string;
  createdAt: Date;
  createdBy: string;
  changeDescription: string;
}

// Manuscript
export interface Manuscript {
  id: string;
  title: string;
  status: ManuscriptStatus;
  templateType?: TemplateType;
  currentVersionId?: string;
  currentVersion?: string;  // Alias for currentVersionId
  versions?: ManuscriptVersion[];
  authors: Author[];
  abstract?: string;
  keywords: string[];
  createdAt: Date;
  updatedAt: Date;
  metadata: ManuscriptMetadata;
}

export interface Author {
  id: string;
  name: string;
  email: string;
  affiliation: string;
  orcid?: string;
  corresponding: boolean;
  order: number;
  roles?: string[];  // CRediT author contribution roles
}

export interface ManuscriptMetadata {
  journalTarget?: string;
  wordLimits?: Record<IMRaDSection, number>;
  style?: CitationStyle;
  conflicts?: string | string[];
  funding?: string | string[];
  ethics?: {
    approved: boolean;
    irbNumber?: string;
    irb?: string;  // Alias for irbNumber
    statement?: string;
    approvalDate?: Date;
  };
}

// Data Mapping
export interface DataToSectionMapping {
  section: IMRaDSection;
  dataPoints: Array<{
    datasetId: string;
    field: string;
    relevance: number;
    extractedValue: unknown;
  }>;
}

// Statistical Summary
export interface StatisticalSummary {
  descriptive: {
    mean?: number;
    median?: number;
    sd?: number;
    range?: [number, number];
    n: number;
  };
  inferential?: {
    test: string;
    pValue: number;
    statistic: number;
    confidenceInterval?: [number, number];
    effectSize?: number;
  };
  categorical?: {
    counts: Record<string, number>;
    percentages: Record<string, number>;
  };
}

// Visualization
export type ChartType = 'bar' | 'line' | 'scatter' | 'box' | 'kaplan-meier' | 'forest';

export interface VisualizationConfig {
  type: ChartType;
  title: string;
  data: unknown;
  xAxis?: string;
  yAxis?: string;
  colorScheme?: 'default' | 'colorblind-safe' | 'grayscale';
  width: number;
  height: number;
  dpi: number;
}

export interface GeneratedFigure {
  id: string;
  caption: string;
  pngData: Buffer;
  svgData?: string;
  sourceData: unknown;
  config: VisualizationConfig;
}

// Citations
export interface Citation {
  id: string;
  type: 'pubmed' | 'doi' | 'arxiv' | 'manual' | 'semantic_scholar';
  externalId: string;
  title: string;
  authors: string[];
  journal?: string;
  year: number;
  volume?: string;
  issue?: string;
  pages?: string;
  doi?: string;
  pmid?: string;
  url?: string;
  abstract?: string;
  formatted: Record<CitationStyle, string>;
}

// PHI Scan Result
export interface PHIScanResult {
  passed: boolean;
  findings: Array<{
    type: string;
    value: string;
    location: number;
    confidence: number;
  }>;
  riskLevel: 'none' | 'low' | 'medium' | 'high';
  scannedAt: Date;
}

// Validation Result
export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

// Table Templates
export interface TableTemplate {
  name: string;
  columns: Array<{
    name: string;
    type: 'string' | 'number' | 'percentage';
    formatter?: (value: unknown) => string;
  }>;
  rows: Array<Record<string, unknown>>;
  caption: string;
  notes?: string[];
}

// Compliance Check
export interface ComplianceCheckResult {
  checklist: 'ICMJE' | 'CONSORT' | 'STROBE' | 'PRISMA';
  passed: boolean;
  score: number;
  items: Array<{
    requirement: string;
    status: 'pass' | 'fail' | 'partial' | 'na';
    section?: IMRaDSection;
    details?: string;
  }>;
  report: string;
}

// Export Format
export type ExportFormat = 'docx' | 'pdf' | 'latex' | 'markdown';

export interface ExportOptions {
  format: ExportFormat;
  journalTemplate?: string;
  includeLineNumbers?: boolean;
  doubleSpaced?: boolean;
  figuresInline?: boolean;
}

// Approval Gate
export interface ApprovalRequest {
  id: string;
  manuscriptId: string;
  requestedBy: string;
  requestedAt: Date;
  approvers: string[];
  type: 'draft_finalization' | 'phi_inclusion' | 'export' | 'submission';
  status: 'pending' | 'approved' | 'rejected';
  attestations: Array<{
    approverId: string;
    decision: 'approve' | 'reject';
    reason?: string;
    decidedAt: Date;
  }>;
}

// Audit Log
export interface ManuscriptAuditEntry {
  id: string;
  manuscriptId: string;
  action: string;
  details: Record<string, unknown>;
  userId: string;
  timestamp: Date;
  previousHash: string | null;
  currentHash: string;
}
