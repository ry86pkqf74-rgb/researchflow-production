import { z, ZodSchema } from "zod";
import { v4 as uuidv4 } from "uuid";
import crypto from "crypto";
import {
  HandoffPackSchema,
  HandoffPackType,
  HandoffPackMetadataSchema,
  ValidationResultSchema,
  StructuredGenerationRequest,
  StructuredGenerationResponse,
  HandoffPack,
  ValidationResult
} from "@researchflow/core/types/handoff-pack.schema";
import { scan, redact } from "@researchflow/phi-engine";
import { getModelRouter } from "@researchflow/ai-router";
import type { AITaskType } from "@researchflow/ai-router";
import { recordAIRequest, recordAIEscalation } from "./src/services/metrics.service";

// Initialize ai-router (replaces direct OpenAI client)
// Phase B: All LLM calls routed through ai-router for centralized routing,
// cost optimization, PHI scanning, and tier escalation
const aiRouter = getModelRouter();

interface TokenUsage {
  input: number;
  output: number;
  total: number;
}

interface GenerationContext {
  researchId: string;
  stageId: string;
  stageName: string;
  previousPacks?: string[];
  additionalContext?: Record<string, unknown>;
}

interface GenerationOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  retryOnValidationFailure?: boolean;
  maxRetries?: number;
}

function computeHash(content: string): string {
  return crypto.createHash("sha256").update(content).digest("hex");
}

function validateAgainstSchema<T>(
  data: unknown,
  schema: ZodSchema<T>
): ValidationResult {
  const result = schema.safeParse(data);
  
  if (result.success) {
    return {
      isValid: true,
      errors: [],
      warnings: []
    };
  }
  
  const errors = result.error.issues.map((issue) => ({
    path: issue.path.join("."),
    message: issue.message,
    code: issue.code
  }));
  
  return {
    isValid: false,
    errors,
    warnings: []
  };
}

export async function generateStructured<T>(
  task: string,
  schema: ZodSchema<T>,
  context: GenerationContext,
  options: GenerationOptions = {}
): Promise<StructuredGenerationResponse> {
  const startTime = Date.now();
  const {
    model = "gpt-4o",
    temperature = 0.7,
    maxTokens = 4000,
    retryOnValidationFailure = true,
    maxRetries = 3
  } = options;

  let retryCount = 0;
  let lastError: Error | null = null;
  let lastValidationResult: ValidationResult | null = null;

  const schemaDescription = JSON.stringify(schema._def, null, 2);
  const promptHash = computeHash(task + schemaDescription);

  while (retryCount <= maxRetries) {
    try {
      const systemPrompt = `You are a structured data generator for a medical research platform.
Your task is to generate valid JSON that strictly conforms to the provided schema.
CRITICAL: Your response must be valid JSON only, no markdown code blocks.

Schema requirements:
${schemaDescription}

Previous validation errors (if any):
${lastValidationResult?.errors.map(e => `- ${e.path}: ${e.message}`).join("\n") || "None"}`;

      // Phase B: Route through ai-router instead of direct OpenAI client
      // Maps stage IDs to ai-router task types for appropriate model selection
      const taskType = mapStageToTaskType(context.stageId);

      const routerResponse = await aiRouter.route({
        prompt: task,
        systemPrompt,
        taskType,
        responseFormat: 'json',
        temperature,
        maxTokens,
        metadata: {
          stageId: parseInt(context.stageId, 10) || undefined,
          workflowStep: context.stageName,
          researchId: context.researchId,
        },
      });

      // Check if routing failed (PHI detected or all tiers failed)
      if (!routerResponse.qualityGate.passed && routerResponse.content === '') {
        throw new Error(
          routerResponse.qualityGate.checks
            .filter(c => !c.passed)
            .map(c => c.reason)
            .join('; ') || 'AI routing failed'
        );
      }

      const content = routerResponse.content || "{}";

      const tokenUsage: TokenUsage = {
        input: routerResponse.usage.inputTokens,
        output: routerResponse.usage.outputTokens,
        total: routerResponse.usage.totalTokens
      };

      // Use the model that was actually used (may have escalated)
      const actualModel = routerResponse.routing.model;

      // Phase C: Record AI metrics for Prometheus
      recordAIRequest(
        routerResponse.routing.provider,
        actualModel,
        routerResponse.routing.finalTier,
        taskType,
        'success',
        routerResponse.usage.inputTokens,
        routerResponse.usage.outputTokens,
        routerResponse.usage.estimatedCostUsd,
        routerResponse.metrics.latencyMs
      );

      // Record escalation if it happened
      if (routerResponse.routing.escalated) {
        recordAIEscalation(
          routerResponse.routing.initialTier,
          routerResponse.routing.finalTier,
          routerResponse.routing.escalationReason || 'quality_gate'
        );
      }

      const parsedContent = JSON.parse(content);
      const validationResult = validateAgainstSchema(parsedContent, schema);

      if (validationResult.isValid) {
        const responseHash = computeHash(content);
        const latencyMs = routerResponse.metrics.latencyMs;
        // Use cost from ai-router (already calculated with tier-specific pricing)
        const cost = routerResponse.usage.estimatedCostUsd;

        const pack: HandoffPack = {
          version: "1.0.0",
          packId: uuidv4(),
          type: inferPackType(context.stageId),
          metadata: {
            stageId: context.stageId,
            stageName: context.stageName,
            researchId: context.researchId,
            sessionId: uuidv4(),
            generatedAt: new Date().toISOString(),
            modelId: actualModel,
            modelVersion: getModelVersion(actualModel),
            promptHash,
            responseHash,
            tokenUsage,
            latencyMs,
            cost
          },
          content: parsedContent,
          contentSchema: schemaDescription,
          validation: validationResult,
          createdAt: new Date().toISOString()
        };

        // Log prompt for reproducibility bundle
        const promptLog: PromptLog = {
          id: uuidv4(),
          stageId: context.stageId,
          stageName: context.stageName,
          promptTemplate: task,
          renderedPrompt: task,
          systemPrompt,
          variables: context.additionalContext || {},
          timestamp: new Date().toISOString(),
          modelUsed: actualModel,
          tokenCount: tokenUsage,
          cost,
          responseHash
        };
        logPrompt(context.researchId, promptLog);

        return {
          success: true,
          pack,
          retryCount,
          totalLatencyMs: Date.now() - startTime
        };
      }

      lastValidationResult = validationResult;
      
      if (!retryOnValidationFailure) {
        break;
      }
      
      retryCount++;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      retryCount++;
    }
  }

  return {
    success: false,
    error: {
      code: lastValidationResult ? "VALIDATION_FAILED" : "GENERATION_FAILED",
      message: lastError?.message || "Failed to generate valid structured output",
      details: lastValidationResult?.errors || undefined
    },
    retryCount,
    totalLatencyMs: Date.now() - startTime
  };
}

function inferPackType(stageId: string): HandoffPackType {
  const stageMapping: Record<string, HandoffPackType> = {
    "1": "RESEARCH_BRIEF",
    "2": "LITERATURE_SEARCH",
    "3": "IRB_PROPOSAL",
    "10": "GAP_ANALYSIS",
    "11": "MANUSCRIPT_DRAFT",
    "12": "JOURNAL_RECOMMENDATION",
    "13": "STATISTICAL_PLAN",
    "4": "DATA_EXTRACTION",
    "9": "SUMMARY_STATISTICS"
  };
  
  return stageMapping[stageId] || "CUSTOM";
}

function calculateCost(model: string, usage: TokenUsage): number {
  const pricing: Record<string, { input: number; output: number }> = {
    "gpt-4o": { input: 0.005, output: 0.015 },
    "gpt-4o-mini": { input: 0.00015, output: 0.0006 },
    "gpt-4-turbo": { input: 0.01, output: 0.03 }
  };
  
  const modelPricing = pricing[model] || pricing["gpt-4o"];
  const inputCost = (usage.input / 1000) * modelPricing.input;
  const outputCost = (usage.output / 1000) * modelPricing.output;
  
  return parseFloat((inputCost + outputCost).toFixed(6));
}

function getModelVersion(model: string): string {
  const versions: Record<string, string> = {
    "gpt-4o": "2024-08-06",
    "gpt-4o-mini": "2024-07-18",
    "gpt-4-turbo": "2024-04-09",
    // Anthropic models
    "claude-3-5-sonnet-20241022": "2024-10-22",
    "claude-3-5-haiku-20241022": "2024-10-22",
    "claude-3-opus-20240229": "2024-02-29",
  };
  return versions[model] || "unknown";
}

/**
 * Map workflow stage IDs to ai-router task types
 * Phase B: Enables appropriate model tier selection based on task complexity
 *
 * Task types map to tiers:
 * - NANO: classify, extract_metadata, policy_check, phi_scan, format_validate
 * - MINI: summarize, draft_section, template_fill, abstract_generate
 * - FRONTIER: protocol_reasoning, complex_synthesis, final_manuscript_pass
 */
function mapStageToTaskType(stageId: string): AITaskType {
  const stageMapping: Record<string, AITaskType> = {
    // Simple tasks -> NANO tier
    "1": "classify",              // Topic Declaration - classification
    "9": "summarize",             // Summary Statistics -> MINI tier

    // Medium complexity -> MINI tier
    "2": "summarize",             // Literature Search - summarization
    "4": "extract_metadata",      // Data Extraction -> NANO tier
    "10": "draft_section",        // Gap Analysis - section drafting

    // Complex tasks -> FRONTIER tier
    "3": "protocol_reasoning",    // IRB Proposal - needs careful reasoning
    "11": "final_manuscript_pass", // Manuscript Draft - complex writing
    "12": "complex_synthesis",    // Journal Recommendation - synthesis
    "13": "protocol_reasoning",   // Statistical Plan - needs precision
  };

  return stageMapping[stageId] || "draft_section";
}

export interface PromptLog {
  id: string;
  stageId: string;
  stageName: string;
  promptTemplate: string;
  renderedPrompt: string;
  systemPrompt?: string;
  variables: Record<string, unknown>;
  timestamp: string;
  modelUsed: string;
  tokenCount: TokenUsage;
  cost: number;
  responseHash: string;
  phiDetected?: boolean;
  phiRedacted?: number;
}

const promptLogs: Map<string, PromptLog[]> = new Map();

export function logPrompt(researchId: string, log: PromptLog): void {
  // Scan prompt and response for PHI
  const promptFindings = scan(log.renderedPrompt);
  const systemPromptFindings = log.systemPrompt ? scan(log.systemPrompt) : [];

  // Redact PHI if detected
  const redactedLog = {
    ...log,
    renderedPrompt: promptFindings.length > 0 ? redact(log.renderedPrompt) : log.renderedPrompt,
    systemPrompt: log.systemPrompt && systemPromptFindings.length > 0
      ? redact(log.systemPrompt)
      : log.systemPrompt,
    phiDetected: promptFindings.length > 0 || systemPromptFindings.length > 0,
    phiRedacted: promptFindings.length + systemPromptFindings.length
  };

  // Log PHI detection to console for audit trail
  if (redactedLog.phiDetected) {
    console.warn('[PHI DETECTION] PHI detected in LLM prompt/response:', {
      researchId,
      stageId: log.stageId,
      stageName: log.stageName,
      promptFindings: promptFindings.length,
      systemPromptFindings: systemPromptFindings.length,
      totalRedacted: redactedLog.phiRedacted,
      timestamp: new Date().toISOString()
    });
  }

  const logs = promptLogs.get(researchId) || [];
  logs.push(redactedLog);
  promptLogs.set(researchId, logs);
}

export function getPromptLogs(researchId: string): PromptLog[] {
  return promptLogs.get(researchId) || [];
}

export function clearPromptLogs(researchId: string): void {
  promptLogs.delete(researchId);
}

export { validateAgainstSchema, computeHash };
