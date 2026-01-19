/**
 * Manuscript Engine Types
 * Barrel export for all type definitions
 */

// Export all from manuscript.types (base types)
export * from './manuscript.types';

// Export from imrad.types (excluding IMRaDSection which is re-exported from manuscript.types)
export {
  TemplatePlaceholder,
  IMRaDTemplate,
  BackgroundSection,
  RationaleSection,
  ObjectivesSection,
  IntroductionParts,
  MethodsContent,
  ResultsContent,
  DiscussionParts,
  GapAnalysis,
  StudyDesign,
  WordCountConfig,
  DEFAULT_WORD_LIMITS,
  SectionOutline,
  ManuscriptScaffold,
  WordCountLimits,
} from './imrad.types';

// Export from citation.types (with renamed Citation to avoid conflict)
export {
  CitationSourceTypeSchema,
  CitationSourceType,
  CitationSchema as DetailedCitationSchema,
  Citation as DetailedCitation,
  LitSearchResultSchema,
  LitSearchResult,
} from './citation.types';

export * from './data-filter.types';

// Export from citation-inserter.types (with renamed CitationStyle/CitationSuggestion to avoid conflicts)
export {
  CitationInsertionPositionSchema,
  CitationInsertionPosition,
  CitationStyleSchema as DisplayCitationStyleSchema,
  CitationStyle as DisplayCitationStyle,
  CitationInsertionRequestSchema,
  CitationInsertionRequest,
  BatchCitationInsertionSchema,
  BatchCitationInsertion,
  CitationSuggestionSchema as InlineCitationSuggestionSchema,
  CitationSuggestion as InlineCitationSuggestion,
  CitationMarkerProps,
  CitationTooltipDataSchema,
  CitationTooltipData,
  CitationInsertionValidationSchema,
  CitationInsertionValidation,
  CitationContextSchema,
  CitationContext,
  CitationOperationSchema,
  CitationOperation,
  CitationHistoryEntrySchema,
  CitationHistoryEntry,
  CitationConflictSchema,
  CitationConflict,
  AutoCitationConfigSchema,
  AutoCitationConfig,
} from './citation-inserter.types';

export * from './search-history.types';
export * from './figure-table-inserter.types';
export * from './section-reorder.types';
export * from './collaborative-editor.types';
export * from './co-writer-mode.types';
