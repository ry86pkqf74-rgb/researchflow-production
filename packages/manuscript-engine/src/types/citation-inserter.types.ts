/**
 * Citation Inserter UI Component Types
 * Task T26: Frontend types for in-text citation insertion
 */

import { z } from 'zod';

/**
 * Citation insertion position within manuscript text
 */
export const CitationInsertionPositionSchema = z.object({
  sectionId: z.string().uuid(),
  paragraphIndex: z.number().int().min(0),
  sentenceIndex: z.number().int().min(0),
  characterOffset: z.number().int().min(0),
});
export type CitationInsertionPosition = z.infer<typeof CitationInsertionPositionSchema>;

/**
 * Citation display style configuration
 */
export const CitationStyleSchema = z.enum([
  'superscript_number',     // [1]
  'author_year',            // (Smith 2023)
  'author_year_full',       // (Smith, Jones, and Brown 2023)
  'number_parentheses',     // (1)
  'footnote',               // Creates footnote at page bottom
  'endnote',                // Groups at manuscript end
]);
export type CitationStyle = z.infer<typeof CitationStyleSchema>;

/**
 * Citation insertion request
 */
export const CitationInsertionRequestSchema = z.object({
  manuscriptId: z.string().uuid(),
  citationId: z.string().uuid(),
  position: CitationInsertionPositionSchema,
  style: CitationStyleSchema,
  citationText: z.string().optional(), // Override auto-generated citation text
  groupWithPrevious: z.boolean().default(false), // e.g., [1-3] instead of [1][2][3]
});
export type CitationInsertionRequest = z.infer<typeof CitationInsertionRequestSchema>;

/**
 * Batch citation insertion (for inserting multiple citations at once)
 */
export const BatchCitationInsertionSchema = z.object({
  manuscriptId: z.string().uuid(),
  insertions: z.array(CitationInsertionRequestSchema).min(1).max(50),
  renumberExisting: z.boolean().default(true), // Renumber all citations after insertion
});
export type BatchCitationInsertion = z.infer<typeof BatchCitationInsertionSchema>;

/**
 * Citation suggestion from AI
 */
export const CitationSuggestionSchema = z.object({
  id: z.string().uuid(),
  sentenceText: z.string(),
  position: CitationInsertionPositionSchema,
  suggestedCitations: z.array(z.object({
    citationId: z.string().uuid(),
    relevanceScore: z.number().min(0).max(1), // 0-1 confidence
    reason: z.string(), // Why this citation is suggested
    excerpt: z.string().optional(), // Relevant excerpt from cited paper
  })).min(1).max(5),
  status: z.enum(['pending', 'accepted', 'rejected', 'modified']),
  createdAt: z.date(),
});
export type CitationSuggestion = z.infer<typeof CitationSuggestionSchema>;

/**
 * In-text citation display component props
 */
export interface CitationMarkerProps {
  citationId: string;
  displayText: string; // e.g., "[1]" or "(Smith 2023)"
  style: CitationStyle;
  onClick?: () => void;
  isHovered?: boolean;
  isSelected?: boolean;
}

/**
 * Citation tooltip data (shown on hover)
 */
export const CitationTooltipDataSchema = z.object({
  authors: z.string(), // Formatted author list
  title: z.string(),
  journal: z.string().optional(),
  year: z.number().int(),
  doi: z.string().optional(),
  abstract: z.string().optional(),
});
export type CitationTooltipData = z.infer<typeof CitationTooltipDataSchema>;

/**
 * Citation insertion validation result
 */
export const CitationInsertionValidationSchema = z.object({
  valid: z.boolean(),
  errors: z.array(z.string()),
  warnings: z.array(z.string()),
  suggestions: z.array(z.string()), // e.g., "Consider grouping with citation [2]"
});
export type CitationInsertionValidation = z.infer<typeof CitationInsertionValidationSchema>;

/**
 * Citation context (surrounding text)
 */
export const CitationContextSchema = z.object({
  citationId: z.string().uuid(),
  precedingText: z.string(), // 100 chars before
  followingText: z.string(), // 100 chars after
  fullSentence: z.string(),
  sectionTitle: z.string(),
  contextRelevance: z.number().min(0).max(1), // How relevant is citation to context
});
export type CitationContext = z.infer<typeof CitationContextSchema>;

/**
 * Bulk citation operations
 */
export const CitationOperationSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('insert'),
    request: CitationInsertionRequestSchema,
  }),
  z.object({
    type: z.literal('delete'),
    citationId: z.string().uuid(),
    position: CitationInsertionPositionSchema,
  }),
  z.object({
    type: z.literal('move'),
    citationId: z.string().uuid(),
    fromPosition: CitationInsertionPositionSchema,
    toPosition: CitationInsertionPositionSchema,
  }),
  z.object({
    type: z.literal('update_style'),
    citationId: z.string().uuid(),
    newStyle: CitationStyleSchema,
  }),
]);
export type CitationOperation = z.infer<typeof CitationOperationSchema>;

/**
 * Citation insertion history (for undo/redo)
 */
export const CitationHistoryEntrySchema = z.object({
  id: z.string().uuid(),
  manuscriptId: z.string().uuid(),
  operation: CitationOperationSchema,
  timestamp: z.date(),
  userId: z.string().uuid(),
  canUndo: z.boolean(),
});
export type CitationHistoryEntry = z.infer<typeof CitationHistoryEntrySchema>;

/**
 * Citation conflict detection
 */
export const CitationConflictSchema = z.object({
  type: z.enum([
    'duplicate_citation',      // Same paper cited multiple times nearby
    'conflicting_findings',    // Two citations contradict each other
    'outdated_citation',       // Cited paper superseded by newer research
    'missing_citation',        // Statement needs citation but lacks one
    'irrelevant_citation',     // Citation doesn't support claim
  ]),
  severity: z.enum(['error', 'warning', 'info']),
  location: CitationInsertionPositionSchema,
  citationIds: z.array(z.string().uuid()),
  message: z.string(),
  suggestedAction: z.string().optional(),
});
export type CitationConflict = z.infer<typeof CitationConflictSchema>;

/**
 * Auto-citation suggestion configuration
 */
export const AutoCitationConfigSchema = z.object({
  enabled: z.boolean().default(true),
  minRelevanceScore: z.number().min(0).max(1).default(0.7),
  maxSuggestionsPerSentence: z.number().int().min(1).max(10).default(3),
  suggestForSections: z.array(z.string()).default(['introduction', 'discussion']),
  excludePatterns: z.array(z.string()).optional(), // Regex patterns to exclude
});
export type AutoCitationConfig = z.infer<typeof AutoCitationConfigSchema>;
