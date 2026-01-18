/**
 * Search History Types
 * Task T37: Track literature search history for reproducibility
 */

import { z } from 'zod';

/**
 * Search database sources
 */
export const SearchDatabaseSchema = z.enum([
  'pubmed',
  'semantic_scholar',
  'arxiv',
  'google_scholar',
  'cochrane',
  'embase',
  'cinahl',
  'web_of_science',
]);
export type SearchDatabase = z.infer<typeof SearchDatabaseSchema>;

/**
 * Individual search query record
 */
export const SearchQueryRecordSchema = z.object({
  id: z.string().uuid(),
  manuscriptId: z.string().uuid(),
  database: SearchDatabaseSchema,
  query: z.string(),
  filters: z.record(z.any()).optional(), // Database-specific filters
  executedAt: z.date(),
  resultCount: z.number().int().min(0),
  citationsAdded: z.number().int().min(0), // How many results were added to manuscript
  userId: z.string().uuid(),
});
export type SearchQueryRecord = z.infer<typeof SearchQueryRecordSchema>;

/**
 * Search session (group of related queries)
 */
export const SearchSessionSchema = z.object({
  id: z.string().uuid(),
  manuscriptId: z.string().uuid(),
  name: z.string(), // e.g., "Initial literature review", "Gap analysis search"
  description: z.string().optional(),
  queries: z.array(SearchQueryRecordSchema),
  startedAt: z.date(),
  completedAt: z.date().optional(),
  totalResults: z.number().int().min(0),
  totalCitationsAdded: z.number().int().min(0),
  userId: z.string().uuid(),
});
export type SearchSession = z.infer<typeof SearchSessionSchema>;

/**
 * Search strategy (for systematic reviews)
 */
export const SearchStrategySchema = z.object({
  id: z.string().uuid(),
  manuscriptId: z.string().uuid(),
  type: z.enum(['systematic_review', 'scoping_review', 'narrative_review', 'rapid_review']),
  picoFramework: z.object({
    population: z.string().optional(),
    intervention: z.string().optional(),
    comparison: z.string().optional(),
    outcome: z.string().optional(),
  }).optional(),
  keywords: z.array(z.string()),
  meshTerms: z.array(z.string()).optional(), // Medical Subject Headings
  booleanOperators: z.string().optional(), // e.g., "(cancer OR tumor) AND (treatment OR therapy)"
  databases: z.array(SearchDatabaseSchema),
  dateRange: z.object({
    start: z.date().optional(),
    end: z.date().optional(),
  }).optional(),
  languageRestrictions: z.array(z.string()).optional(), // e.g., ['en', 'es', 'fr']
  publicationTypes: z.array(z.string()).optional(), // e.g., ['Clinical Trial', 'Meta-Analysis']
  exclusionCriteria: z.array(z.string()).optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
});
export type SearchStrategy = z.infer<typeof SearchStrategySchema>;

/**
 * Search filter configuration
 */
export const SearchFilterConfigSchema = z.object({
  dateRange: z.object({
    start: z.string().optional(), // ISO date
    end: z.string().optional(),
  }).optional(),
  publicationTypes: z.array(z.string()).optional(),
  languages: z.array(z.string()).optional(),
  studyTypes: z.array(z.string()).optional(), // RCT, cohort, case-control, etc.
  fullTextAvailable: z.boolean().optional(),
  freeFullText: z.boolean().optional(),
  humans: z.boolean().optional(), // PubMed species filter
  animals: z.boolean().optional(),
});
export type SearchFilterConfig = z.infer<typeof SearchFilterConfigSchema>;

/**
 * Search result metadata
 */
export const SearchResultMetadataSchema = z.object({
  queryId: z.string().uuid(),
  resultPosition: z.number().int().min(0), // Position in search results (1-based)
  relevanceScore: z.number().min(0).max(1).optional(), // If provided by search engine
  wasReviewed: z.boolean().default(false),
  wasIncluded: z.boolean().default(false),
  exclusionReason: z.string().optional(), // If excluded, why?
  reviewedAt: z.date().optional(),
  reviewedBy: z.string().uuid().optional(),
});
export type SearchResultMetadata = z.infer<typeof SearchResultMetadataSchema>;

/**
 * Reproducible search report (for PRISMA compliance)
 */
export const SearchReportSchema = z.object({
  manuscriptId: z.string().uuid(),
  generatedAt: z.date(),
  strategy: SearchStrategySchema,
  sessions: z.array(SearchSessionSchema),
  totalRecordsIdentified: z.number().int(),
  totalDuplicates: z.number().int(),
  totalScreened: z.number().int(),
  totalIncluded: z.number().int(),
  totalExcluded: z.number().int(),
  exclusionReasons: z.record(z.number().int()), // { "Not relevant": 50, "Wrong population": 20 }
  prismaFlowDiagram: z.string().optional(), // SVG or image data
});
export type SearchReport = z.infer<typeof SearchReportSchema>;

/**
 * Search alert/notification
 */
export const SearchAlertSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  manuscriptId: z.string().uuid(),
  database: SearchDatabaseSchema,
  query: z.string(),
  frequency: z.enum(['daily', 'weekly', 'monthly']),
  lastRun: z.date().optional(),
  nextRun: z.date(),
  isActive: z.boolean().default(true),
  createdAt: z.date(),
});
export type SearchAlert = z.infer<typeof SearchAlertSchema>;

/**
 * Search audit trail entry
 */
export const SearchAuditEntrySchema = z.object({
  id: z.string().uuid(),
  manuscriptId: z.string().uuid(),
  eventType: z.enum([
    'search_executed',
    'result_viewed',
    'citation_added',
    'citation_removed',
    'strategy_updated',
    'filter_applied',
  ]),
  userId: z.string().uuid(),
  timestamp: z.date(),
  details: z.record(z.any()),
  hash: z.string().length(64), // SHA-256 hash for audit chain
  previousHash: z.string().length(64).optional(),
});
export type SearchAuditEntry = z.infer<typeof SearchAuditEntrySchema>;

/**
 * Saved search template
 */
export const SavedSearchTemplateSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  description: z.string().optional(),
  database: SearchDatabaseSchema,
  queryTemplate: z.string(), // e.g., "({condition}) AND ({intervention})"
  placeholders: z.array(z.object({
    name: z.string(),
    description: z.string(),
    defaultValue: z.string().optional(),
  })),
  filters: SearchFilterConfigSchema.optional(),
  isPublic: z.boolean().default(false),
  createdBy: z.string().uuid(),
  createdAt: z.date(),
  usageCount: z.number().int().min(0).default(0),
});
export type SavedSearchTemplate = z.infer<typeof SavedSearchTemplateSchema>;
