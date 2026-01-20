/**
 * Manuscript Engine Type Definitions
 * Core types for manuscript creation and management
 */

import { z } from 'zod';
import type { IMRaDSection } from './imrad.types';

// Note: IMRaDSection is imported from imrad.types.ts and used here
// The type is exported from imrad.types.ts which is re-exported via index.ts

export type ManuscriptStatus = 'draft' | 'review' | 'approved' | 'submitted' | 'published';

export type TemplateType = 'imrad' | 'case_report' | 'systematic_review' | 'meta_analysis';

// Bibliography formatting style (different from in-text citation style in citation-inserter.types)
export type BibliographyStyle = 'AMA' | 'APA' | 'Vancouver' | 'NLM' | 'Chicago';
/** @deprecated Use BibliographyStyle instead */
export type CitationStyleLegacy = BibliographyStyle;

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
  templateType: TemplateType;
  currentVersionId: string;
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
}

export interface ManuscriptMetadata {
  journalTarget?: string;
  wordLimits?: Record<IMRaDSection, number>;
  style: BibliographyStyle;
  conflicts: string[];
  funding: string[];
  ethics?: {
    approved: boolean;
    irbNumber?: string;
    statement: string;
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

// Legacy Citation - use Citation from citation.types instead
export interface LegacyCitation {
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
  formatted: Record<BibliographyStyle, string>;
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
