import { z } from "zod";

export const HandoffPackType = z.enum([
  "RESEARCH_BRIEF",
  "LITERATURE_SEARCH",
  "GAP_ANALYSIS",
  "STUDY_CARDS",
  "MANUSCRIPT_DRAFT",
  "JOURNAL_RECOMMENDATION",
  "IRB_PROPOSAL",
  "STATISTICAL_PLAN",
  "DATA_EXTRACTION",
  "SUMMARY_STATISTICS",
  "CUSTOM"
]);
export type HandoffPackType = z.infer<typeof HandoffPackType>;

export const ValidationResultSchema = z.object({
  isValid: z.boolean(),
  errors: z.array(z.object({
    path: z.string(),
    message: z.string(),
    code: z.string()
  })),
  warnings: z.array(z.object({
    path: z.string(),
    message: z.string(),
    code: z.string()
  }))
});
export type ValidationResult = z.infer<typeof ValidationResultSchema>;

export const HandoffPackMetadataSchema = z.object({
  stageId: z.string(),
  stageName: z.string(),
  researchId: z.string(),
  sessionId: z.string(),
  generatedAt: z.string().datetime(),
  modelId: z.string(),
  modelVersion: z.string().optional(),
  promptHash: z.string(),
  responseHash: z.string(),
  tokenUsage: z.object({
    input: z.number(),
    output: z.number(),
    total: z.number()
  }),
  latencyMs: z.number(),
  cost: z.number(),
  approvalGateId: z.string().optional(),
  parentPackId: z.string().optional(),
  tags: z.array(z.string()).optional()
});
export type HandoffPackMetadata = z.infer<typeof HandoffPackMetadataSchema>;

export const HandoffPackSchema = z.object({
  version: z.string().regex(/^\d+\.\d+\.\d+$/, "Must be semver format"),
  packId: z.string().uuid(),
  type: HandoffPackType,
  metadata: HandoffPackMetadataSchema,
  content: z.unknown(),
  contentSchema: z.string(),
  validation: ValidationResultSchema,
  signature: z.string().optional(),
  createdAt: z.string().datetime(),
  expiresAt: z.string().datetime().optional()
});
export type HandoffPack = z.infer<typeof HandoffPackSchema>;

export const StructuredGenerationRequestSchema = z.object({
  task: z.string(),
  schema: z.unknown(),
  context: z.object({
    researchId: z.string(),
    stageId: z.string(),
    stageName: z.string(),
    previousPacks: z.array(z.string()).optional(),
    additionalContext: z.record(z.unknown()).optional()
  }),
  options: z.object({
    model: z.string().optional(),
    temperature: z.number().min(0).max(2).optional(),
    maxTokens: z.number().optional(),
    retryOnValidationFailure: z.boolean().default(true),
    maxRetries: z.number().min(1).max(5).default(3)
  }).optional()
});
export type StructuredGenerationRequest = z.infer<typeof StructuredGenerationRequestSchema>;

export const StructuredGenerationResponseSchema = z.object({
  success: z.boolean(),
  pack: HandoffPackSchema.optional(),
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.unknown().optional()
  }).optional(),
  retryCount: z.number(),
  totalLatencyMs: z.number()
});
export type StructuredGenerationResponse = z.infer<typeof StructuredGenerationResponseSchema>;

export const ResearchBriefContentSchema = z.object({
  title: z.string(),
  population: z.string(),
  intervention: z.string(),
  comparison: z.string(),
  outcome: z.string(),
  researchQuestion: z.string(),
  hypothesis: z.string().optional(),
  objectives: z.array(z.string()),
  keywords: z.array(z.string()),
  suggestedMethods: z.array(z.string()).optional()
});
export type ResearchBriefContent = z.infer<typeof ResearchBriefContentSchema>;

export const LiteratureSearchContentSchema = z.object({
  searchStrategy: z.object({
    databases: z.array(z.string()),
    dateRange: z.object({
      start: z.string(),
      end: z.string()
    }),
    searchTerms: z.array(z.object({
      term: z.string(),
      field: z.string(),
      operator: z.enum(["AND", "OR", "NOT"]).optional()
    })),
    filters: z.array(z.string()).optional()
  }),
  results: z.array(z.object({
    pmid: z.string().optional(),
    doi: z.string().optional(),
    title: z.string(),
    authors: z.array(z.string()),
    journal: z.string(),
    year: z.number(),
    abstract: z.string().optional(),
    relevanceScore: z.number().min(0).max(1),
    citationCount: z.number().optional()
  })),
  summary: z.object({
    totalFound: z.number(),
    included: z.number(),
    excluded: z.number(),
    topThemes: z.array(z.string())
  })
});
export type LiteratureSearchContent = z.infer<typeof LiteratureSearchContentSchema>;

export const GapAnalysisContentSchema = z.object({
  existingEvidence: z.array(z.object({
    topic: z.string(),
    strength: z.enum(["STRONG", "MODERATE", "WEAK", "CONFLICTING"]),
    summary: z.string(),
    sources: z.array(z.string())
  })),
  identifiedGaps: z.array(z.object({
    gapId: z.string(),
    description: z.string(),
    significance: z.enum(["HIGH", "MEDIUM", "LOW"]),
    researchOpportunity: z.string(),
    suggestedApproach: z.string().optional()
  })),
  recommendations: z.array(z.string()),
  priorityRanking: z.array(z.object({
    gapId: z.string(),
    rank: z.number(),
    rationale: z.string()
  }))
});
export type GapAnalysisContent = z.infer<typeof GapAnalysisContentSchema>;
