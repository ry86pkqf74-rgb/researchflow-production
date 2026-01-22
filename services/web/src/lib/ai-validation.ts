/**
 * AI Response Validation Layer
 *
 * Centralized Zod schema validation for all AI API responses.
 * Provides runtime type safety and detailed error reporting.
 */

import { z } from 'zod';
import {
  AIResearchBriefResponseSchema,
  GenerateResearchBriefResponseSchema,
} from '@packages/core/types/research-brief';

/**
 * Generic AI response wrapper schema
 */
export const AIResponseSchema = <T extends z.ZodTypeAny>(dataSchema: T) =>
  z.object({
    success: z.boolean(),
    mode: z.enum(['DEMO', 'LIVE']).optional(),
    data: dataSchema,
    error: z.string().optional(),
    approvalId: z.string().optional(),
    approvedBy: z.string().optional(),
  });

/**
 * Literature search result schema
 */
export const LiteratureSearchResultSchema = z.object({
  id: z.number().or(z.string()),
  title: z.string(),
  authors: z.array(z.string()).optional(),
  year: z.number(),
  journal: z.string().optional(),
  citations: z.number().optional(),
  relevance: z.enum(['HIGH', 'MEDIUM', 'LOW']).or(z.string()).optional(),
  abstract: z.string().optional(),
  doi: z.string().optional(),
  pmid: z.string().optional(),
});

export const LiteratureSearchResponseSchema = z.object({
  results: z.array(LiteratureSearchResultSchema),
  totalResults: z.number(),
  query: z.string().optional(),
  filters: z.record(z.unknown()).optional(),
});

export type LiteratureSearchResult = z.infer<typeof LiteratureSearchResultSchema>;
export type LiteratureSearchResponse = z.infer<typeof LiteratureSearchResponseSchema>;

/**
 * Manuscript draft schema
 */
export const ManuscriptSectionSchema = z.object({
  type: z.enum(['abstract', 'introduction', 'methods', 'results', 'discussion', 'conclusion']),
  title: z.string(),
  content: z.string(),
  wordCount: z.number().optional(),
});

export const ManuscriptDraftResponseSchema = z.object({
  text: z.string().optional(), // Full text
  sections: z.array(ManuscriptSectionSchema).optional(),
  style: z.enum(['IMRAD', 'narrative', 'structured']).optional(),
  wordCount: z.number().optional(),
  references: z.array(z.string()).optional(),
});

export type ManuscriptSection = z.infer<typeof ManuscriptSectionSchema>;
export type ManuscriptDraftResponse = z.infer<typeof ManuscriptDraftResponseSchema>;

/**
 * Statistical analysis schema
 */
export const StatisticalTestResultSchema = z.object({
  testName: z.string(),
  statistic: z.number(),
  pValue: z.number(),
  confidenceInterval: z
    .object({
      lower: z.number(),
      upper: z.number(),
      level: z.number().default(0.95),
    })
    .optional(),
  interpretation: z.string().optional(),
});

export const StatisticalAnalysisResponseSchema = z.object({
  summary: z.string().optional(),
  methods: z.array(z.string()).optional(),
  tests: z.array(StatisticalTestResultSchema).optional(),
  tables: z
    .array(
      z.object({
        title: z.string(),
        data: z.array(z.record(z.unknown())),
      })
    )
    .optional(),
  figures: z
    .array(
      z.object({
        title: z.string(),
        type: z.string(),
        data: z.unknown(),
      })
    )
    .optional(),
});

export type StatisticalTestResult = z.infer<typeof StatisticalTestResultSchema>;
export type StatisticalAnalysisResponse = z.infer<typeof StatisticalAnalysisResponseSchema>;

/**
 * Topic recommendations schema
 */
export const TopicRecommendationSchema = z.object({
  id: z.string().or(z.number()),
  title: z.string(),
  description: z.string(),
  rationale: z.string().optional(),
  priority: z.enum(['high', 'medium', 'low']).or(z.string()).optional(),
  feasibility: z.enum(['high', 'medium', 'low']).or(z.string()).optional(),
  impact: z.enum(['high', 'medium', 'low']).or(z.string()).optional(),
});

export const TopicRecommendationsResponseSchema = z.object({
  recommendations: z.array(TopicRecommendationSchema),
  totalCount: z.number().optional(),
});

export type TopicRecommendation = z.infer<typeof TopicRecommendationSchema>;
export type TopicRecommendationsResponse = z.infer<typeof TopicRecommendationsResponseSchema>;

/**
 * PHI scan result schema
 */
export const PHIScanResultSchema = z.object({
  status: z.enum(['PASS', 'FAIL', 'UNCHECKED', 'SCANNING', 'QUARANTINED']),
  detected: z.array(
    z.object({
      field: z.string(),
      type: z.string(),
      value: z.string().optional(),
      confidence: z.number().optional(),
    })
  ),
  message: z.string().optional(),
});

export type PHIScanResult = z.infer<typeof PHIScanResultSchema>;

/**
 * Registry of endpoint-specific schemas
 */
export const AI_ENDPOINT_SCHEMAS: Record<string, z.ZodTypeAny> = {
  '/api/ai/research-brief': AIResponseSchema(AIResearchBriefResponseSchema),
  'ai/research-brief': AIResearchBriefResponseSchema,
  '/api/ai/literature-search': AIResponseSchema(LiteratureSearchResponseSchema),
  'ai/literature-search': LiteratureSearchResponseSchema,
  '/api/ai/manuscript-draft': AIResponseSchema(ManuscriptDraftResponseSchema),
  'ai/manuscript-draft': ManuscriptDraftResponseSchema,
  '/api/ai/statistical-analysis': AIResponseSchema(StatisticalAnalysisResponseSchema),
  'ai/statistical-analysis': StatisticalAnalysisResponseSchema,
  '/api/ai/topic-recommendations': AIResponseSchema(TopicRecommendationsResponseSchema),
  'ai/topic-recommendations': TopicRecommendationsResponseSchema,
  '/api/phi/scan': AIResponseSchema(PHIScanResultSchema),
  'phi/scan': PHIScanResultSchema,
};

/**
 * Validation result interface
 */
export interface ValidationResult<T = unknown> {
  valid: boolean;
  data?: T;
  errors?: string[];
}

/**
 * Validate an AI response against a Zod schema
 */
export function validateAIResponse<T>(response: unknown, schema: z.ZodSchema<T>): ValidationResult<T> {
  const result = schema.safeParse(response);

  if (result.success) {
    return { valid: true, data: result.data };
  }

  const errors = result.error.errors.map((e) => {
    const path = e.path.length > 0 ? e.path.join('.') : 'root';
    return `${path}: ${e.message}`;
  });

  return {
    valid: false,
    errors,
  };
}

/**
 * Get the appropriate schema for an endpoint
 */
export function getSchemaForEndpoint(endpoint: string): z.ZodTypeAny | null {
  // Try exact match first
  if (AI_ENDPOINT_SCHEMAS[endpoint]) {
    return AI_ENDPOINT_SCHEMAS[endpoint];
  }

  // Try pattern matching
  for (const [pattern, schema] of Object.entries(AI_ENDPOINT_SCHEMAS)) {
    if (endpoint.includes(pattern) || pattern.includes(endpoint)) {
      return schema;
    }
  }

  return null;
}

/**
 * Validate endpoint response with automatic schema selection
 */
export function validateEndpointResponse<T = unknown>(
  endpoint: string,
  response: unknown
): ValidationResult<T> {
  const schema = getSchemaForEndpoint(endpoint);

  if (!schema) {
    console.warn(`[validateEndpointResponse] No schema found for endpoint: ${endpoint}`);
    return { valid: true, data: response as T }; // Pass through if no schema
  }

  return validateAIResponse<T>(response, schema);
}

/**
 * Type guard to check if a value is a valid AI response
 */
export function isValidAIResponse<T>(
  response: unknown,
  schema: z.ZodSchema<T>
): response is T {
  return schema.safeParse(response).success;
}

/**
 * Extract error messages from a validation result
 */
export function formatValidationErrors(result: ValidationResult): string {
  if (result.valid || !result.errors) {
    return '';
  }

  return result.errors.join('; ');
}
