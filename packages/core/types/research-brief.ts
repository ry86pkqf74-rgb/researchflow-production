import { z } from 'zod';

/**
 * Enhanced Research Brief Types
 *
 * AI-generated research brief with:
 * - Connection to Topic Declaration
 * - Version tracking
 * - Refinement suggestions (confounders, biases, missingness, alternative designs)
 * - Generation metadata
 */

// Priority levels for refinement suggestions
export const PRIORITY_LEVELS = ['high', 'medium', 'low'] as const;
export type PriorityLevel = (typeof PRIORITY_LEVELS)[number];

// Research Brief status
export const RESEARCH_BRIEF_STATUSES = ['draft', 'reviewed', 'approved'] as const;
export type ResearchBriefStatus = (typeof RESEARCH_BRIEF_STATUSES)[number];

// Confounder suggestion
export const ConfounderSuggestionSchema = z.object({
  variable: z.string().describe('Name of the potential confounding variable'),
  rationale: z.string().describe('Why this variable is a potential confounder'),
  priority: z.enum(PRIORITY_LEVELS).describe('Priority level for addressing this confounder'),
});

export type ConfounderSuggestion = z.infer<typeof ConfounderSuggestionSchema>;

// Bias suggestion
export const BiasSuggestionSchema = z.object({
  type: z.string().describe('Type of bias (e.g., selection bias, information bias, confounding)'),
  description: z.string().describe('Description of the potential bias'),
  mitigation: z.string().describe('Suggested strategy to mitigate this bias'),
});

export type BiasSuggestion = z.infer<typeof BiasSuggestionSchema>;

// Missingness risk
export const MissingnessRiskSchema = z.object({
  variable: z.string().describe('Variable at risk of missing data'),
  expectedRate: z.string().describe('Expected missingness rate (e.g., "15-20%")'),
  strategy: z.string().describe('Strategy to handle missing data'),
});

export type MissingnessRisk = z.infer<typeof MissingnessRiskSchema>;

// Alternative design
export const AlternativeDesignSchema = z.object({
  design: z.string().describe('Name of the alternative study design'),
  pros: z.array(z.string()).describe('Advantages of this design'),
  cons: z.array(z.string()).describe('Disadvantages of this design'),
});

export type AlternativeDesign = z.infer<typeof AlternativeDesignSchema>;

// Refinement suggestions container
export const RefinementSuggestionsSchema = z.object({
  confounders: z.array(ConfounderSuggestionSchema).describe('Potential confounding variables'),
  biases: z.array(BiasSuggestionSchema).describe('Potential sources of bias'),
  missingnessRisks: z.array(MissingnessRiskSchema).describe('Variables at risk of missing data'),
  alternativeDesigns: z.array(AlternativeDesignSchema).describe('Alternative study designs to consider'),
});

export type RefinementSuggestions = z.infer<typeof RefinementSuggestionsSchema>;

// Candidate endpoint
export const CandidateEndpointSchema = z.object({
  name: z.string().describe('Endpoint name'),
  definition: z.string().describe('Operational definition of the endpoint'),
});

export type CandidateEndpoint = z.infer<typeof CandidateEndpointSchema>;

// Minimum dataset field
export const MinimumDatasetFieldSchema = z.object({
  field: z.string().describe('Field name'),
  reason: z.string().describe('Reason why this field is required'),
});

export type MinimumDatasetField = z.infer<typeof MinimumDatasetFieldSchema>;

// Research brief metadata
export const ResearchBriefMetadataSchema = z.object({
  modelUsed: z.string().describe('AI model used for generation'),
  promptVersion: z.string().describe('Version of the prompt template'),
  artifactHash: z.string().describe('SHA-256 hash of the generated content'),
  tokenUsage: z.object({
    input: z.number().int().nonnegative(),
    output: z.number().int().nonnegative(),
    total: z.number().int().nonnegative(),
  }).optional(),
  generationLatencyMs: z.number().int().nonnegative().optional(),
});

export type ResearchBriefMetadata = z.infer<typeof ResearchBriefMetadataSchema>;

// Full Enhanced Research Brief schema
export const EnhancedResearchBriefSchema = z.object({
  id: z.string().uuid(),
  topicDeclarationId: z.string().uuid().describe('ID of the linked Topic Declaration'),
  topicVersion: z.number().int().positive().describe('Version of the Topic at generation time'),
  researchId: z.string().describe('Research project ID'),

  // Entry mode info (preserved from topic)
  entryMode: z.enum(['quick', 'pico']).optional(),
  convertedPICO: z.object({
    population: z.string(),
    intervention: z.string(),
    comparator: z.string(),
    outcomes: z.array(z.string()),
    timeframe: z.string(),
  }).optional().describe('PICO elements (auto-converted from Quick Entry if applicable)'),

  // Core brief content
  summary: z.string().optional().describe('Brief summary of the research question and design'),
  studyObjectives: z.array(z.string()).describe('Clear study objectives'),
  population: z.string().describe('Target population description'),
  exposure: z.string().describe('Intervention or exposure of interest'),
  comparator: z.string().describe('Comparison group'),
  outcomes: z.array(z.string()).describe('Primary and secondary outcomes'),
  timeframe: z.string().describe('Study timeframe'),
  candidateEndpoints: z.array(CandidateEndpointSchema).describe('Measurable endpoints'),
  keyConfounders: z.array(z.string()).describe('Key confounding variables'),
  minimumDatasetFields: z.array(MinimumDatasetFieldSchema).describe('Required dataset fields'),
  clarifyingPrompts: z.array(z.string()).describe('Questions to refine the research scope'),

  // AI-generated refinement suggestions
  refinementSuggestions: RefinementSuggestionsSchema.nullable().optional(),

  // Metadata
  metadata: ResearchBriefMetadataSchema,

  // Status tracking
  status: z.enum(RESEARCH_BRIEF_STATUSES).default('draft'),
  createdBy: z.string(),
  approvedBy: z.string().optional(),
  approvedAt: z.string().datetime().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime().optional(),
});

export type EnhancedResearchBrief = z.infer<typeof EnhancedResearchBriefSchema>;

// Request schema for generating a research brief
export const GenerateResearchBriefRequestSchema = z.object({
  topicDeclarationId: z.string().uuid().describe('ID of the Topic Declaration to generate brief from'),
  includeRefinements: z.boolean().default(true).describe('Whether to include refinement suggestions'),
  autoConvertToPICO: z.boolean().default(true).describe('Auto-convert Quick Entry to PICO if applicable'),
});

export type GenerateResearchBriefRequest = z.infer<typeof GenerateResearchBriefRequestSchema>;

// Response schema for generate endpoint
export const GenerateResearchBriefResponseSchema = z.object({
  success: z.boolean(),
  brief: EnhancedResearchBriefSchema.optional(),
  artifactId: z.string().uuid().optional(),
  message: z.string().optional(),
  error: z.string().optional(),
});

export type GenerateResearchBriefResponse = z.infer<typeof GenerateResearchBriefResponseSchema>;

// Validation result
export interface ResearchBriefValidationResult {
  valid: boolean;
  errors: string[];
  warnings?: string[];
}

/**
 * Validate a research brief for completeness before approval
 */
export function validateResearchBrief(brief: EnhancedResearchBrief): ResearchBriefValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Required fields
  if (!brief.studyObjectives || brief.studyObjectives.length === 0) {
    errors.push('At least one study objective is required');
  }
  if (!brief.population) {
    errors.push('Population must be specified');
  }
  if (!brief.exposure) {
    errors.push('Exposure/intervention must be specified');
  }
  if (!brief.outcomes || brief.outcomes.length === 0) {
    errors.push('At least one outcome must be specified');
  }
  if (!brief.candidateEndpoints || brief.candidateEndpoints.length === 0) {
    errors.push('At least one candidate endpoint is required');
  }

  // Warnings for optional but recommended fields
  if (!brief.comparator) {
    warnings.push('No comparator specified - consider adding one');
  }
  if (!brief.timeframe) {
    warnings.push('No timeframe specified - consider adding one');
  }
  if (!brief.keyConfounders || brief.keyConfounders.length === 0) {
    warnings.push('No key confounders identified - review for potential confounding');
  }
  if (!brief.refinementSuggestions) {
    warnings.push('No refinement suggestions - consider regenerating with includeRefinements=true');
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings: warnings.length > 0 ? warnings : undefined,
  };
}

/**
 * AI Response structure (what we expect from the LLM)
 */
export const AIResearchBriefResponseSchema = z.object({
  summary: z.string().optional(),
  studyObjectives: z.array(z.string()),
  population: z.string(),
  exposure: z.string(),
  comparator: z.string(),
  outcomes: z.array(z.string()),
  timeframe: z.string(),
  candidateEndpoints: z.array(CandidateEndpointSchema),
  keyConfounders: z.array(z.string()),
  minimumDatasetFields: z.array(MinimumDatasetFieldSchema),
  clarifyingPrompts: z.array(z.string()),
  refinementSuggestions: RefinementSuggestionsSchema.optional(),
});

export type AIResearchBriefResponse = z.infer<typeof AIResearchBriefResponseSchema>;
