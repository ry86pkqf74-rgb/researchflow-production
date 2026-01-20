/**
 * Research Brief Generator Service
 *
 * Generates enhanced research briefs from Topic Declarations using AI.
 * Supports both Quick Entry and PICO mode topics.
 *
 * Updated to use the AI Router for cost-optimized model selection.
 */

import crypto from 'crypto';
import type { Topic } from '@researchflow/core/schema';
import type {
  EnhancedResearchBrief,
  RefinementSuggestions,
  AIResearchBriefResponse,
  ResearchBriefMetadata,
} from '@researchflow/core/types/research-brief';
import type { PICOElements } from '@researchflow/core/types/topic-declaration';
import {
  getModelRouter,
  type AIRouterRequest,
  type AIRouterResponse,
  type ModelTier,
} from '@researchflow/ai-router';
import { getGovernanceMode } from '../middleware/governanceMode';
import {
  convertQuickEntryToPICO,
  detectEffectiveEntryMode,
  hasValidPICOElements,
} from './topic-converter';
import { checkAICallAllowed, getTelemetry } from '../utils/telemetry';

const PROMPT_VERSION = '2.0.0';

export interface GenerateBriefOptions {
  includeRefinements?: boolean;
  autoConvertToPICO?: boolean;
  /** Force a specific model tier */
  forceTier?: ModelTier;
  /** Skip governance mode check (for testing) */
  skipGovernanceCheck?: boolean;
}

export interface GenerateBriefResult {
  brief: Omit<EnhancedResearchBrief, 'id' | 'createdAt' | 'updatedAt'>;
  convertedPICO?: PICOElements;
  tokenUsage: { input: number; output: number; total: number };
  latencyMs: number;
  /** AI Router routing information */
  routing: {
    initialTier: ModelTier;
    finalTier: ModelTier;
    escalated: boolean;
    model: string;
  };
  /** Cost information */
  cost: {
    estimatedUsd: number;
  };
}

/**
 * Generate enhanced research brief from topic declaration
 *
 * Uses the AI Router for cost-optimized model selection with automatic
 * tier escalation on quality gate failures.
 *
 * @throws Error if governance mode is STANDBY
 */
export async function generateEnhancedResearchBrief(
  topic: Topic,
  userId: string,
  options: GenerateBriefOptions = {}
): Promise<GenerateBriefResult> {
  const startTime = Date.now();
  const telemetry = getTelemetry();
  const includeRefinements = options.includeRefinements ?? true;
  const autoConvertToPICO = options.autoConvertToPICO ?? true;

  // Check governance mode using centralized gating
  if (!options.skipGovernanceCheck) {
    const callCheck = checkAICallAllowed();
    if (!callCheck.allowed) {
      telemetry.recordBlockedCall(callCheck.reason, 'anthropic');
      throw new Error(`AI generation blocked: ${callCheck.reason.replace(/_/g, ' ')}`);
    }
  }

  // Detect entry mode and handle PICO conversion
  const entryMode = detectEffectiveEntryMode(topic);
  let convertedPICO: PICOElements | undefined;
  let effectivePICO: PICOElements;

  if (entryMode === 'pico' && hasValidPICOElements(topic)) {
    effectivePICO = topic.picoElements as PICOElements;
  } else if (autoConvertToPICO) {
    convertedPICO = convertQuickEntryToPICO(topic);
    effectivePICO = convertedPICO;
  } else {
    // Use whatever PICO we have, or create minimal one
    effectivePICO = (topic.picoElements as PICOElements) || {
      population: 'Not specified',
      intervention: 'Not specified',
      comparator: 'Not specified',
      outcomes: [],
      timeframe: 'Not specified',
    };
  }

  // Build prompt
  const { systemPrompt, userPrompt } = buildEnhancedBriefPrompt(
    topic,
    effectivePICO,
    includeRefinements
  );

  // Use AI Router for model selection and invocation
  const router = getModelRouter();

  const request: AIRouterRequest = {
    taskType: includeRefinements ? 'draft_section' : 'summarize',
    prompt: userPrompt,
    systemPrompt,
    responseFormat: 'json',
    forceTier: options.forceTier,
    metadata: {
      userId,
      researchId: topic.researchId,
      stageId: 2, // Research Brief stage
      workflowStep: 'research_brief_generation',
    },
  };

  const response: AIRouterResponse = await router.route(request);

  // Check if PHI was detected
  const phiBlocked = response.qualityGate.checks.some(
    (c) => c.name === 'phi_input_scan' && !c.passed
  );
  if (phiBlocked) {
    throw new Error('PHI detected in topic content. Please remove PHI before generating brief.');
  }

  const latencyMs = Date.now() - startTime;
  const content = response.content;

  // Parse AI response
  let parsed: AIResearchBriefResponse;
  try {
    parsed = response.parsed as AIResearchBriefResponse || JSON.parse(content);
  } catch {
    throw new Error('Failed to parse AI response as JSON');
  }

  const tokenUsage = {
    input: response.usage.inputTokens,
    output: response.usage.outputTokens,
    total: response.usage.totalTokens,
  };

  // Calculate artifact hash
  const artifactHash = crypto.createHash('sha256').update(content).digest('hex');

  // Build metadata
  const metadata: ResearchBriefMetadata = {
    modelUsed: response.routing.model,
    promptVersion: PROMPT_VERSION,
    artifactHash,
    tokenUsage,
    generationLatencyMs: latencyMs,
  };

  // Build brief object
  const brief: Omit<EnhancedResearchBrief, 'id' | 'createdAt' | 'updatedAt'> = {
    topicDeclarationId: topic.id,
    topicVersion: topic.version,
    researchId: topic.researchId,
    entryMode,
    convertedPICO: convertedPICO || undefined,

    // Core brief content
    summary: parsed.summary,
    studyObjectives: parsed.studyObjectives || [],
    population: parsed.population || effectivePICO.population,
    exposure: parsed.exposure || effectivePICO.intervention,
    comparator: parsed.comparator || effectivePICO.comparator,
    outcomes: parsed.outcomes || effectivePICO.outcomes,
    timeframe: parsed.timeframe || effectivePICO.timeframe,
    candidateEndpoints: parsed.candidateEndpoints || [],
    keyConfounders: parsed.keyConfounders || [],
    minimumDatasetFields: parsed.minimumDatasetFields || [],
    clarifyingPrompts: parsed.clarifyingPrompts || [],

    // Refinement suggestions (null if not included)
    refinementSuggestions: includeRefinements
      ? normalizeRefinementSuggestions(parsed.refinementSuggestions)
      : null,

    // Metadata
    metadata,

    // Status
    status: 'draft',
    createdBy: userId,
  };

  return {
    brief,
    convertedPICO,
    tokenUsage,
    latencyMs,
    routing: {
      initialTier: response.routing.initialTier,
      finalTier: response.routing.finalTier,
      escalated: response.routing.escalated,
      model: response.routing.model,
    },
    cost: {
      estimatedUsd: response.usage.estimatedCostUsd,
    },
  };
}

/**
 * Build the prompt for enhanced research brief generation
 *
 * Returns separate system and user prompts for better caching.
 */
function buildEnhancedBriefPrompt(
  topic: Topic,
  pico: PICOElements,
  includeRefinements: boolean
): { systemPrompt: string; userPrompt: string } {
  const exposures = (topic.exposures as string[] | null) || [];
  const covariates = (topic.covariates as string[] | null) || [];
  const keywords = (topic.keywords as string[] | null) || [];

  // Static system prompt (cacheable)
  const systemPrompt = `You are a clinical research methodology expert. Generate comprehensive research briefs from topic declarations.

IMPORTANT GUIDELINES:
- Focus on HIPAA compliance and data protection
- Ensure methodological rigor
- Consider statistical validity
- Identify potential confounders and biases

OUTPUT FORMAT:
Return valid JSON with the following structure:
{
  "summary": "string (2-3 sentences)",
  "studyObjectives": ["string (2-4 items)"],
  "population": "string (refined target population)",
  "exposure": "string (refined intervention/exposure)",
  "comparator": "string (refined comparison group)",
  "outcomes": ["string (primary and secondary outcomes)"],
  "timeframe": "string (study timeframe with justification)",
  "candidateEndpoints": [{"name": "string", "definition": "string"}],
  "keyConfounders": ["string"],
  "minimumDatasetFields": [{"field": "string", "reason": "string"}],
  "clarifyingPrompts": ["string (3-5 questions)"]${includeRefinements ? `,
  "refinementSuggestions": {
    "confounders": [{"variable": "string", "rationale": "string", "priority": "high|medium|low"}],
    "biases": [{"type": "string", "description": "string", "mitigation": "string"}],
    "missingnessRisks": [{"variable": "string", "expectedRate": "string", "strategy": "string"}],
    "alternativeDesigns": [{"design": "string", "pros": ["string"], "cons": ["string"]}]
  }` : ''}
}

Return only valid JSON. No markdown formatting.`;

  // Dynamic user prompt
  const userPrompt = `Generate a research brief from this topic declaration:

TOPIC INFORMATION:
- Title: ${topic.title}
- Description: ${topic.description || 'Not provided'}
- General Topic: ${topic.generalTopic || 'Not specified'}
- Scope: ${topic.scope || 'Not specified'}
- Dataset Source: ${topic.datasetSource || 'Not specified'}
- Constraints: ${topic.constraints || 'None specified'}

PICO ELEMENTS:
- Population: ${pico.population}
- Intervention/Exposure: ${pico.intervention}
- Comparator: ${pico.comparator}
- Outcomes: ${pico.outcomes.join(', ') || 'Not specified'}
- Timeframe: ${pico.timeframe}

ADDITIONAL CONTEXT:
- Cohort Inclusion: ${topic.cohortInclusion || 'Not specified'}
- Cohort Exclusion: ${topic.cohortExclusion || 'Not specified'}
- Exposures: ${exposures.join(', ') || 'None specified'}
- Covariates: ${covariates.join(', ') || 'None specified'}
- Keywords: ${keywords.join(', ') || 'None'}

${includeRefinements ? 'Include refinement suggestions analyzing confounders, biases, missingness risks, and alternative designs.' : ''}`;

  return { systemPrompt, userPrompt };
}

/**
 * Normalize refinement suggestions to ensure consistent structure
 */
function normalizeRefinementSuggestions(
  suggestions: Partial<RefinementSuggestions> | undefined
): RefinementSuggestions {
  return {
    confounders: suggestions?.confounders || [],
    biases: suggestions?.biases || [],
    missingnessRisks: suggestions?.missingnessRisks || [],
    alternativeDesigns: (suggestions?.alternativeDesigns || []).map((design) => ({
      design: design.design,
      pros: Array.isArray(design.pros) ? design.pros : [design.pros || ''],
      cons: Array.isArray(design.cons) ? design.cons : [design.cons || ''],
    })),
  };
}

/**
 * Validate a research brief for approval
 */
export function validateBriefForApproval(
  brief: Omit<EnhancedResearchBrief, 'id' | 'createdAt' | 'updatedAt'>
): { valid: boolean; errors: string[]; warnings: string[] } {
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

  // Warnings
  if (!brief.comparator) {
    warnings.push('No comparator specified');
  }
  if (!brief.timeframe) {
    warnings.push('No timeframe specified');
  }
  if (!brief.keyConfounders || brief.keyConfounders.length === 0) {
    warnings.push('No key confounders identified');
  }
  if (!brief.refinementSuggestions) {
    warnings.push('No refinement suggestions - consider regenerating with includeRefinements=true');
  }

  return { valid: errors.length === 0, errors, warnings };
}
