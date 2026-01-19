/**
 * API Types for Manuscript Service
 */

import { z } from 'zod';

// Create Manuscript Request
export const CreateManuscriptRequestSchema = z.object({
  researchId: z.string().uuid(),
  title: z.string().min(1).max(500),
  templateType: z.enum(['research_article', 'case_report', 'review', 'letter', 'meta_analysis']).default('research_article'),
  journalTarget: z.string().optional(),
  wordLimits: z.object({
    total: z.number().max(15000).optional(),
    abstract: z.number().max(500).optional(),
    introduction: z.number().max(2000).optional(),
    methods: z.number().max(5000).optional(),
    results: z.number().max(5000).optional(),
    discussion: z.number().max(3000).optional(),
  }).optional(),
  style: z.enum(['ama', 'apa', 'vancouver', 'chicago', 'custom']).default('ama'),
});

export type CreateManuscriptRequest = z.infer<typeof CreateManuscriptRequestSchema>;

// Manuscript Content Schema
export const ManuscriptContentSchema = z.object({
  title: z.string(),
  metadata: z.object({
    authors: z.array(z.object({
      name: z.string(),
      affiliation: z.string().optional(),
      email: z.string().email().optional(),
      orcid: z.string().optional(),
      isCorresponding: z.boolean().default(false),
    })).optional(),
    keywords: z.array(z.string()).optional(),
    journalTarget: z.string().optional(),
    templateType: z.string().optional(),
  }),
  sections: z.object({
    abstract: z.string().optional(),
    introduction: z.string().optional(),
    methods: z.string().optional(),
    results: z.string().optional(),
    discussion: z.string().optional(),
    conclusion: z.string().optional(),
    acknowledgements: z.string().optional(),
  }),
  citations: z.array(z.object({
    id: z.string(),
    type: z.string(),
    title: z.string(),
    authors: z.array(z.string()),
    year: z.number(),
    journal: z.string().optional(),
    doi: z.string().optional(),
    pmid: z.string().optional(),
  })).optional(),
  figures: z.array(z.object({
    id: z.string(),
    caption: z.string(),
    type: z.string(),
    artifactId: z.string().optional(),
  })).optional(),
  tables: z.array(z.object({
    id: z.string(),
    caption: z.string(),
    content: z.string().optional(),
    artifactId: z.string().optional(),
  })).optional(),
});

export type ManuscriptContent = z.infer<typeof ManuscriptContentSchema>;

// Manuscript Response
export const ManuscriptResponseSchema = z.object({
  id: z.string().uuid(),
  researchId: z.string().uuid(),
  artifactId: z.string().uuid(),
  currentVersionId: z.string().uuid().optional(),
  versionNumber: z.number(),
  content: ManuscriptContentSchema,
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type ManuscriptResponse = z.infer<typeof ManuscriptResponseSchema>;

// Version Response
export const VersionResponseSchema = z.object({
  id: z.string().uuid(),
  artifactId: z.string().uuid(),
  versionNumber: z.number(),
  changeDescription: z.string().optional(),
  changedBy: z.string().uuid().optional(),
  createdAt: z.date(),
  contentHash: z.string().optional(),
});

export type VersionResponse = z.infer<typeof VersionResponseSchema>;

// Diff Response (Task 64)
export const DiffLineSchema = z.object({
  type: z.enum(['added', 'removed', 'unchanged']),
  content: z.string(),
  lineNumber: z.number().optional(),
  oldLineNumber: z.number().optional(),
  newLineNumber: z.number().optional(),
});

export const DiffResponseSchema = z.object({
  fromVersionId: z.string().uuid(),
  toVersionId: z.string().uuid(),
  manuscriptId: z.string().uuid(),
  comparisonId: z.string().uuid(),
  diff: z.array(DiffLineSchema),
  summary: z.object({
    addedLines: z.number(),
    removedLines: z.number(),
    unchangedLines: z.number(),
    addedWords: z.number(),
    removedWords: z.number(),
  }),
  createdAt: z.date(),
});

export type DiffResponse = z.infer<typeof DiffResponseSchema>;

// Export Options
export const ExportOptionsSchema = z.object({
  format: z.enum(['pdf', 'docx', 'latex', 'markdown', 'html']),
  blinded: z.boolean().default(false),
  includeLineNumbers: z.boolean().default(false),
  doubleSpaced: z.boolean().default(true),
  includeSupplementary: z.boolean().default(false),
});

export type ExportOptions = z.infer<typeof ExportOptionsSchema>;

// PHI Scan Response (GOVERNANCE: no PHI values)
export const PhiScanResponseSchema = z.object({
  passed: z.boolean(),
  manuscriptId: z.string(),
  scanTimestamp: z.date(),
  totalScanned: z.number(),
  detections: z.array(z.object({
    section: z.string(),
    type: z.string(),
    startIndex: z.number(),
    endIndex: z.number(),
    severity: z.enum(['critical', 'high', 'medium']),
    recommendation: z.string(),
    detectionId: z.string(),
    // NOTE: No 'context' or 'value' field - GOVERNANCE requirement
  })),
  blocked: z.boolean(),
  requiresApproval: z.boolean(),
});

export type PhiScanResponse = z.infer<typeof PhiScanResponseSchema>;

// User context from gateway
export interface UserContext {
  userId: string;
  role: string;
  permissions?: string[];
}
