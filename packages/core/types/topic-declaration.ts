import { z } from 'zod';

/**
 * Topic Declaration Types
 *
 * Supports two entry modes:
 * 1. Quick Entry Mode - User-friendly for rapid topic definition
 * 2. Structured PICO Mode - Rigorous for formal protocols (IRB, SAP)
 */

// Entry mode type
export const TOPIC_ENTRY_MODES = ['quick', 'pico'] as const;
export type TopicEntryMode = (typeof TOPIC_ENTRY_MODES)[number];

// PICO Elements schema
export const PICOElementsSchema = z.object({
  population: z.string().describe('Target population description (PICO P)'),
  intervention: z.string().describe('Intervention or exposure of interest (PICO I)'),
  comparator: z.string().describe('Comparison group (PICO C)'),
  outcomes: z.array(z.string()).describe('Primary and secondary outcomes (PICO O)'),
  timeframe: z.string().describe('Study timeframe'),
});

export type PICOElements = z.infer<typeof PICOElementsSchema>;

// Quick Entry Fields schema
export const QuickEntryFieldsSchema = z.object({
  generalTopic: z.string().describe('General research topic or area'),
  scope: z.string().describe('Study scope and boundaries'),
  datasetSource: z.string().describe('Dataset or data source'),
  cohortInclusion: z.string().describe('Cohort inclusion criteria'),
  cohortExclusion: z.string().describe('Cohort exclusion criteria'),
  exposures: z.array(z.string()).describe('Exposure variables'),
  outcomes: z.array(z.string()).describe('Outcome variables'),
  covariates: z.array(z.string()).describe('Covariate variables'),
  constraints: z.string().describe('Study constraints or limitations'),
});

export type QuickEntryFields = z.infer<typeof QuickEntryFieldsSchema>;

// Full Topic Declaration schema
export const TopicDeclarationSchema = z.object({
  id: z.string().uuid(),
  version: z.number().int().positive(),
  researchId: z.string(),
  entryMode: z.enum(TOPIC_ENTRY_MODES),
  title: z.string(),
  description: z.string().optional(),

  // Quick Entry fields (always stored, may be empty for PICO mode)
  generalTopic: z.string().default(''),
  scope: z.string().default(''),
  datasetSource: z.string().default(''),
  cohortInclusion: z.string().default(''),
  cohortExclusion: z.string().default(''),
  exposures: z.array(z.string()).default([]),
  outcomes: z.array(z.string()).default([]),
  covariates: z.array(z.string()).default([]),
  constraints: z.string().default(''),

  // PICO fields (populated when entryMode='pico' or after conversion)
  picoElements: PICOElementsSchema.optional(),

  // Keywords for search/categorization
  keywords: z.array(z.string()).optional(),

  // Metadata
  status: z.enum(['DRAFT', 'LOCKED', 'SUPERSEDED']),
  versionHash: z.string(),
  contentHash: z.string().optional(),
  previousVersionId: z.string().uuid().optional(),
  versionHistory: z.any().optional(),
  createdBy: z.string(),
  lockedAt: z.string().datetime().optional(),
  lockedBy: z.string().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type TopicDeclaration = z.infer<typeof TopicDeclarationSchema>;

// Create/Insert Topic Declaration schema (for API requests)
export const CreateTopicDeclarationSchema = TopicDeclarationSchema.omit({
  id: true,
  version: true,
  versionHash: true,
  createdAt: true,
  updatedAt: true,
  status: true,
  previousVersionId: true,
  versionHistory: true,
  lockedAt: true,
  lockedBy: true,
}).extend({
  entryMode: z.enum(TOPIC_ENTRY_MODES).default('quick'),
});

export type CreateTopicDeclaration = z.infer<typeof CreateTopicDeclarationSchema>;

// Update Topic Declaration schema
export const UpdateTopicDeclarationSchema = CreateTopicDeclarationSchema.partial().extend({
  id: z.string().uuid(),
});

export type UpdateTopicDeclaration = z.infer<typeof UpdateTopicDeclarationSchema>;

// PICO Conversion Request schema
export const PICOConversionRequestSchema = z.object({
  // Optional overrides for conversion (if not provided, derived from Quick Entry fields)
  comparator: z.string().optional(),
  timeframe: z.string().optional(),
  population: z.string().optional(),
  intervention: z.string().optional(),
});

export type PICOConversionRequest = z.infer<typeof PICOConversionRequestSchema>;

// PICO Conversion Response schema
export const PICOConversionResponseSchema = z.object({
  success: z.boolean(),
  topic: TopicDeclarationSchema.optional(),
  picoElements: PICOElementsSchema.optional(),
  message: z.string().optional(),
  error: z.string().optional(),
});

export type PICOConversionResponse = z.infer<typeof PICOConversionResponseSchema>;

/**
 * Convert Quick Entry fields to structured PICO format
 * This is a type-only signature; implementation is in the service layer
 */
export interface PICOConversionOptions {
  population?: string;
  intervention?: string;
  comparator?: string;
  timeframe?: string;
}

/**
 * Topic Declaration for SAP generation
 * Subset of fields needed by the SAP generator
 */
export interface TopicDeclarationForSAP {
  id: string;
  version: number;
  researchQuestion: string;
  population: string;
  outcomes: string[];
  exposures: string[];
  covariates: string[];
  studyDesign?: string;
  timeframe?: string;
}

/**
 * Convert a TopicDeclaration to the format needed for SAP generation
 */
export function toTopicDeclarationForSAP(topic: TopicDeclaration): TopicDeclarationForSAP {
  const pico = topic.picoElements;

  return {
    id: topic.id,
    version: topic.version,
    researchQuestion: topic.description || topic.generalTopic || topic.title,
    population: pico?.population || topic.cohortInclusion || '',
    outcomes: pico?.outcomes || topic.outcomes,
    exposures: topic.exposures.length > 0 ? topic.exposures : (pico?.intervention ? [pico.intervention] : []),
    covariates: topic.covariates,
    studyDesign: topic.scope || undefined,
    timeframe: pico?.timeframe || undefined,
  };
}

/**
 * Check if a topic has valid PICO elements
 */
export function hasPICOElements(topic: TopicDeclaration): boolean {
  const pico = topic.picoElements;
  if (!pico) return false;

  return Boolean(
    pico.population &&
    pico.intervention &&
    pico.comparator &&
    pico.outcomes?.length > 0 &&
    pico.timeframe
  );
}

/**
 * Check if a topic has valid Quick Entry fields
 */
export function hasQuickEntryFields(topic: TopicDeclaration): boolean {
  return Boolean(
    topic.generalTopic ||
    topic.cohortInclusion ||
    topic.exposures?.length > 0 ||
    topic.outcomes?.length > 0
  );
}
