/**
 * Literature Types for Phase C
 *
 * Shared schemas for literature search, indexing, and analysis across
 * orchestrator, worker, and web UI services.
 */

import { z } from 'zod';

/**
 * Supported literature search providers
 */
export const LiteratureProvider = z.enum([
  'pubmed',
  'semantic_scholar',
  'arxiv'
]);
export type LiteratureProvider = z.infer<typeof LiteratureProvider>;

/**
 * Author information from literature sources
 */
export const LiteratureAuthor = z.object({
  name: z.string(),
  affiliation: z.string().optional(),
  orcid: z.string().optional(),
});
export type LiteratureAuthor = z.infer<typeof LiteratureAuthor>;

/**
 * Core literature item schema - unified across all providers
 */
export const LiteratureItem = z.object({
  // Internal tracking
  id: z.string(),
  provider: LiteratureProvider,

  // Core metadata
  title: z.string(),
  abstract: z.string().optional(),
  authors: z.array(LiteratureAuthor),
  year: z.number().int().optional(),
  venue: z.string().optional(), // Journal name or conference

  // External identifiers
  doi: z.string().optional(),
  pmid: z.string().optional(),        // PubMed ID
  pmcid: z.string().optional(),       // PubMed Central ID
  arxivId: z.string().optional(),     // arXiv identifier
  s2PaperId: z.string().optional(),   // Semantic Scholar Paper ID

  // URLs
  urls: z.array(z.string()),
  pdfUrl: z.string().optional(),

  // Metadata
  fetchedAt: z.string(),              // ISO 8601 timestamp
  keywords: z.array(z.string()).optional(),
  meshTerms: z.array(z.string()).optional(), // PubMed MeSH terms
  publicationTypes: z.array(z.string()).optional(),
  license: z.string().optional(),

  // Metrics (if available from provider)
  citationCount: z.number().int().optional(),
  influentialCitationCount: z.number().int().optional(), // S2 specific

  // Search relevance (set by search engine)
  relevanceScore: z.number().min(0).max(1).optional(),

  // For vector indexing
  embedding: z.array(z.number()).optional(),
  snippets: z.array(z.string()).optional(),
});
export type LiteratureItem = z.infer<typeof LiteratureItem>;

/**
 * Literature search request
 */
export const LiteratureSearchRequest = z.object({
  query: z.string().min(1),
  providers: z.array(LiteratureProvider).default(['pubmed']),
  limit: z.number().int().min(1).max(100).default(20),
  offset: z.number().int().min(0).default(0),

  // Optional filters
  yearStart: z.number().int().optional(),
  yearEnd: z.number().int().optional(),
  publicationTypes: z.array(z.string()).optional(),

  // Caching control
  useCache: z.boolean().default(true),
  cacheTtlSeconds: z.number().int().optional(),
});
export type LiteratureSearchRequest = z.infer<typeof LiteratureSearchRequest>;

/**
 * Literature search response
 */
export const LiteratureSearchResponse = z.object({
  items: z.array(LiteratureItem),
  total: z.number().int(),
  query: z.string(),
  providers: z.array(LiteratureProvider),

  // Caching metadata
  cached: z.boolean(),
  cachedAt: z.string().optional(),

  // Performance metadata
  searchDurationMs: z.number().int().optional(),
  providerResults: z.record(LiteratureProvider, z.object({
    count: z.number().int(),
    total: z.number().int(),
    durationMs: z.number().int().optional(),
    error: z.string().optional(),
  })).optional(),
});
export type LiteratureSearchResponse = z.infer<typeof LiteratureSearchResponse>;

/**
 * Semantic search request (for vector DB queries)
 */
export const SemanticSearchRequest = z.object({
  query: z.string().min(1),
  k: z.number().int().min(1).max(100).default(10),

  // Optional metadata filters
  providers: z.array(LiteratureProvider).optional(),
  yearStart: z.number().int().optional(),
  yearEnd: z.number().int().optional(),

  // Threshold for similarity score
  minScore: z.number().min(0).max(1).optional(),
});
export type SemanticSearchRequest = z.infer<typeof SemanticSearchRequest>;

/**
 * Semantic search result
 */
export const SemanticSearchResult = z.object({
  item: LiteratureItem,
  score: z.number().min(0).max(1),
  matchedSnippet: z.string().optional(),
});
export type SemanticSearchResult = z.infer<typeof SemanticSearchResult>;

/**
 * Semantic search response
 */
export const SemanticSearchResponse = z.object({
  results: z.array(SemanticSearchResult),
  query: z.string(),
  queryEmbedding: z.array(z.number()).optional(),
  searchDurationMs: z.number().int().optional(),
});
export type SemanticSearchResponse = z.infer<typeof SemanticSearchResponse>;

/**
 * Literature indexing job request
 */
export const LiteratureIndexingRequest = z.object({
  items: z.array(LiteratureItem),
  collection: z.string().default('literature'),
  upsert: z.boolean().default(true),
});
export type LiteratureIndexingRequest = z.infer<typeof LiteratureIndexingRequest>;

/**
 * Literature summarization request
 */
export const LiteratureSummarizationRequest = z.object({
  items: z.array(LiteratureItem),
  options: z.object({
    includeMethodsSummary: z.boolean().default(true),
    includeFindings: z.boolean().default(true),
    includeLimitations: z.boolean().default(true),
    maxPapersForSynthesis: z.number().int().default(20),
    synthesisStyle: z.enum(['narrative', 'bullet_points', 'structured']).default('structured'),
  }).default({}),
});
export type LiteratureSummarizationRequest = z.infer<typeof LiteratureSummarizationRequest>;

/**
 * Per-paper summary
 */
export const PaperSummary = z.object({
  paperId: z.string(),
  title: z.string(),
  methods: z.string().optional(),
  population: z.string().optional(),
  outcomes: z.string().optional(),
  keyFindings: z.array(z.string()),
  limitations: z.array(z.string()).optional(),
});
export type PaperSummary = z.infer<typeof PaperSummary>;

/**
 * Literature summarization result
 */
export const LiteratureSummarizationResult = z.object({
  paperSummaries: z.array(PaperSummary),
  synthesis: z.object({
    themes: z.array(z.object({
      theme: z.string(),
      description: z.string(),
      supportingPapers: z.array(z.string()),
    })),
    contradictions: z.array(z.object({
      topic: z.string(),
      positions: z.array(z.object({
        position: z.string(),
        supportingPapers: z.array(z.string()),
      })),
    })).optional(),
    gaps: z.array(z.string()).optional(),
    overallSummary: z.string(),
  }),
  generatedAt: z.string(),
});
export type LiteratureSummarizationResult = z.infer<typeof LiteratureSummarizationResult>;

/**
 * Literature matrix row (for Task 46)
 */
export const LiteratureMatrixRow = z.object({
  paperId: z.string(),
  title: z.string(),
  authors: z.string(), // Formatted author list
  year: z.number().int().optional(),
  venue: z.string().optional(),
  studyDesign: z.string().optional(),
  population: z.string().optional(),
  sampleSize: z.string().optional(),
  intervention: z.string().optional(),
  comparator: z.string().optional(),
  outcomes: z.string().optional(),
  keyFindings: z.string().optional(),
  limitations: z.string().optional(),
  qualityScore: z.number().optional(),
  relevanceToUser: z.string().optional(),
});
export type LiteratureMatrixRow = z.infer<typeof LiteratureMatrixRow>;

/**
 * Gap analysis request (for Task 47)
 */
export const GapAnalysisRequest = z.object({
  userDataSchema: z.object({
    columns: z.array(z.string()),
    sampleValues: z.record(z.string(), z.array(z.unknown())).optional(),
    description: z.string().optional(),
  }),
  literatureItems: z.array(LiteratureItem),
  options: z.object({
    useLlmAnalysis: z.boolean().default(false),
    identifyNovelty: z.boolean().default(true),
    identifyGaps: z.boolean().default(true),
  }).default({}),
});
export type GapAnalysisRequest = z.infer<typeof GapAnalysisRequest>;

/**
 * Gap analysis result
 */
export const GapAnalysisResult = z.object({
  noveltyVariables: z.array(z.object({
    variable: z.string(),
    reason: z.string(),
    literatureCoverage: z.enum(['none', 'rare', 'limited']),
  })),
  gapVariables: z.array(z.object({
    variable: z.string(),
    reason: z.string(),
    frequencyInLiterature: z.enum(['common', 'standard', 'universal']),
  })),
  unaddressedSubgroups: z.array(z.object({
    subgroup: z.string(),
    reason: z.string(),
  })).optional(),
  recommendations: z.array(z.string()),
  summary: z.string(),
  generatedAt: z.string(),
});
export type GapAnalysisResult = z.infer<typeof GapAnalysisResult>;

/**
 * Keyword extraction result (for Task 45)
 */
export const KeywordExtractionResult = z.object({
  keywords: z.array(z.object({
    keyword: z.string(),
    score: z.number().min(0).max(1),
    source: z.enum(['column_name', 'categorical_value', 'text_field', 'metadata']),
    context: z.string().optional(),
  })),
  extractedAt: z.string(),
});
export type KeywordExtractionResult = z.infer<typeof KeywordExtractionResult>;
