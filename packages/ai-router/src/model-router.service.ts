/**
 * Model Router Service
 *
 * Implements cost-optimized model selection with automatic tier escalation.
 * Routes AI requests to appropriate models based on task complexity.
 */

import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import type {
  ModelTier,
  AITaskType,
  AIProvider,
  AIRouterConfig,
  AIRouterRequest,
  AIRouterResponse,
  AIInvocationRecord,
  EscalationDecision,
} from './types';
import {
  MODEL_CONFIGS,
  TASK_TIER_MAPPING,
  TIER_ESCALATION_ORDER,
} from './types';
import { QualityGateService } from './quality-gate.service';
import { PhiGateService } from './phi-gate.service';

/**
 * Check if AI calls are allowed based on governance mode.
 * Returns { allowed: true } or { allowed: false, reason: string }
 */
function checkModeGating(): { allowed: true } | { allowed: false; reason: string } {
  const rosMode = process.env.ROS_MODE?.toUpperCase();
  const governanceMode = process.env.GOVERNANCE_MODE?.toUpperCase();
  const noNetwork = process.env.NO_NETWORK === 'true';

  // STANDBY mode blocks all AI calls
  if (rosMode === 'STANDBY' || governanceMode === 'STANDBY') {
    return { allowed: false, reason: 'System is in STANDBY mode - AI calls blocked' };
  }

  // NO_NETWORK blocks all external calls
  if (noNetwork) {
    return { allowed: false, reason: 'NO_NETWORK mode enabled - external AI calls blocked' };
  }

  return { allowed: true };
}

/**
 * Model Router Service
 *
 * Routes AI requests to the appropriate model tier based on task type,
 * with automatic escalation on quality gate failures.
 */
export class ModelRouterService {
  private anthropic: Anthropic | null = null;
  private openai: OpenAI | null = null;
  private qualityGate: QualityGateService;
  private phiGate: PhiGateService;
  private config: AIRouterConfig;

  constructor(config: Partial<AIRouterConfig> = {}) {
    this.config = {
      defaultTier: config.defaultTier || 'MINI',
      escalationEnabled: config.escalationEnabled ?? true,
      maxEscalations: config.maxEscalations ?? 2,
      anthropicApiKey: config.anthropicApiKey || process.env.ANTHROPIC_API_KEY,
      openaiApiKey: config.openaiApiKey || process.env.OPENAI_API_KEY,
      togetherApiKey: config.togetherApiKey || process.env.TOGETHER_API_KEY,
    };

    // Initialize providers
    if (this.config.anthropicApiKey) {
      this.anthropic = new Anthropic({
        apiKey: this.config.anthropicApiKey,
      });
    }

    if (this.config.openaiApiKey) {
      this.openai = new OpenAI({
        apiKey: this.config.openaiApiKey,
      });
    }

    this.qualityGate = new QualityGateService();
    this.phiGate = new PhiGateService();
  }

  /**
   * Route an AI request to the appropriate model
   */
  async route(request: AIRouterRequest): Promise<AIRouterResponse> {
    const startTime = Date.now();

    // Determine initial tier
    const initialTier = request.forceTier || this.selectTier(request.taskType);
    let currentTier = initialTier;
    let escalationCount = 0;
    let escalationReason: string | undefined;
    let lastError: Error | undefined;

    // Mode gating check - block AI calls in STANDBY or NO_NETWORK mode
    const modeCheck = checkModeGating();
    if (modeCheck.allowed === false) {
      return this.createBlockedResponse(
        request,
        initialTier,
        startTime,
        modeCheck.reason
      );
    }

    // PHI scan input
    const inputPhiResult = this.phiGate.scanContent(request.prompt);
    if (!inputPhiResult.passed) {
      return this.createBlockedResponse(
        request,
        initialTier,
        startTime,
        `PHI detected in input: ${inputPhiResult.findingsCount} findings`
      );
    }

    // Attempt with escalation loop
    while (escalationCount <= this.config.maxEscalations) {
      try {
        const response = await this.invokeModel(request, currentTier);

        // PHI scan output
        const outputPhiResult = this.phiGate.scanContent(response.content);
        if (!outputPhiResult.passed) {
          // Redact and return with warning
          response.content = outputPhiResult.redactedContent || response.content;
          response.qualityGate.checks.push({
            name: 'phi_output_scan',
            passed: false,
            reason: `PHI detected in output, ${outputPhiResult.findingsCount} items redacted`,
            severity: 'warning',
          });
        }

        // Quality gate check
        const qualityResult = this.qualityGate.validate(
          response.content,
          request.taskType,
          request.responseFormat
        );

        response.qualityGate = qualityResult;

        // Check if escalation needed
        if (!qualityResult.passed && this.config.escalationEnabled) {
          const escalation = this.qualityGate.shouldEscalate(
            qualityResult,
            currentTier,
            escalationCount
          );

          if (escalation.shouldEscalate && escalation.targetTier) {
            escalationReason = escalation.reason;
            currentTier = escalation.targetTier;
            escalationCount++;
            continue;
          }
        }

        // Success - update routing info
        response.routing = {
          initialTier,
          finalTier: currentTier,
          escalated: escalationCount > 0,
          escalationReason,
          provider: MODEL_CONFIGS[currentTier].provider,
          model: MODEL_CONFIGS[currentTier].model,
        };

        response.metrics.latencyMs = Date.now() - startTime;

        return response;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        // Try escalation on error
        if (this.config.escalationEnabled && escalationCount < this.config.maxEscalations) {
          const nextTier = this.getNextTier(currentTier);
          if (nextTier) {
            escalationReason = `Error: ${lastError.message}`;
            currentTier = nextTier;
            escalationCount++;
            continue;
          }
        }

        // No more escalation options
        break;
      }
    }

    // All attempts failed
    return this.createFailedResponse(
      request,
      initialTier,
      currentTier,
      startTime,
      lastError?.message || 'Unknown error',
      escalationCount > 0,
      escalationReason
    );
  }

  /**
   * Select the appropriate tier for a task type
   */
  selectTier(taskType: AITaskType): ModelTier {
    return TASK_TIER_MAPPING[taskType] || this.config.defaultTier;
  }

  /**
   * Get the next tier in the escalation order
   */
  private getNextTier(currentTier: ModelTier): ModelTier | null {
    const currentIndex = TIER_ESCALATION_ORDER.indexOf(currentTier);
    if (currentIndex === -1 || currentIndex >= TIER_ESCALATION_ORDER.length - 1) {
      return null;
    }
    return TIER_ESCALATION_ORDER[currentIndex + 1];
  }

  /**
   * Invoke the model for a specific tier
   */
  private async invokeModel(
    request: AIRouterRequest,
    tier: ModelTier
  ): Promise<AIRouterResponse> {
    const config = MODEL_CONFIGS[tier];
    const startTime = Date.now();

    if (config.provider === 'anthropic') {
      return this.invokeAnthropic(request, config, tier);
    } else if (config.provider === 'openai') {
      return this.invokeOpenAI(request, config, tier);
    }

    throw new Error(`Unsupported provider: ${config.provider}`);
  }

  /**
   * Invoke Anthropic API
   */
  private async invokeAnthropic(
    request: AIRouterRequest,
    config: typeof MODEL_CONFIGS[ModelTier],
    tier: ModelTier
  ): Promise<AIRouterResponse> {
    if (!this.anthropic) {
      throw new Error('Anthropic client not initialized');
    }

    const startTime = Date.now();

    const response = await this.anthropic.messages.create({
      model: config.model,
      max_tokens: request.maxTokens || config.maxTokens,
      temperature: request.temperature ?? config.temperature,
      system: request.systemPrompt,
      messages: [
        {
          role: 'user',
          content: request.prompt,
        },
      ],
    });

    const content = response.content[0]?.type === 'text'
      ? response.content[0].text
      : '';

    const inputTokens = response.usage?.input_tokens || 0;
    const outputTokens = response.usage?.output_tokens || 0;

    const estimatedCostUsd =
      (inputTokens / 1_000_000) * config.costPerMToken.input +
      (outputTokens / 1_000_000) * config.costPerMToken.output;

    let parsed: Record<string, unknown> | undefined;
    if (request.responseFormat === 'json') {
      try {
        parsed = JSON.parse(content);
      } catch {
        // JSON parsing failed, will be caught by quality gate
      }
    }

    return {
      content,
      parsed,
      routing: {
        initialTier: tier,
        finalTier: tier,
        escalated: false,
        provider: 'anthropic',
        model: config.model,
      },
      usage: {
        inputTokens,
        outputTokens,
        totalTokens: inputTokens + outputTokens,
        estimatedCostUsd,
      },
      qualityGate: {
        passed: true,
        checks: [],
      },
      metrics: {
        latencyMs: Date.now() - startTime,
      },
    };
  }

  /**
   * Invoke OpenAI API (fallback provider)
   */
  private async invokeOpenAI(
    request: AIRouterRequest,
    config: typeof MODEL_CONFIGS[ModelTier],
    tier: ModelTier
  ): Promise<AIRouterResponse> {
    if (!this.openai) {
      throw new Error('OpenAI client not initialized');
    }

    const startTime = Date.now();

    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [];

    if (request.systemPrompt) {
      messages.push({
        role: 'system',
        content: request.systemPrompt,
      });
    }

    messages.push({
      role: 'user',
      content: request.prompt,
    });

    const response = await this.openai.chat.completions.create({
      model: config.model,
      max_tokens: request.maxTokens || config.maxTokens,
      temperature: request.temperature ?? config.temperature,
      messages,
      response_format: request.responseFormat === 'json'
        ? { type: 'json_object' }
        : undefined,
    });

    const content = response.choices[0]?.message?.content || '';
    const inputTokens = response.usage?.prompt_tokens || 0;
    const outputTokens = response.usage?.completion_tokens || 0;

    const estimatedCostUsd =
      (inputTokens / 1_000_000) * config.costPerMToken.input +
      (outputTokens / 1_000_000) * config.costPerMToken.output;

    let parsed: Record<string, unknown> | undefined;
    if (request.responseFormat === 'json') {
      try {
        parsed = JSON.parse(content);
      } catch {
        // JSON parsing failed
      }
    }

    return {
      content,
      parsed,
      routing: {
        initialTier: tier,
        finalTier: tier,
        escalated: false,
        provider: 'openai',
        model: config.model,
      },
      usage: {
        inputTokens,
        outputTokens,
        totalTokens: inputTokens + outputTokens,
        estimatedCostUsd,
      },
      qualityGate: {
        passed: true,
        checks: [],
      },
      metrics: {
        latencyMs: Date.now() - startTime,
      },
    };
  }

  /**
   * Create a blocked response (e.g., PHI detected)
   */
  private createBlockedResponse(
    request: AIRouterRequest,
    tier: ModelTier,
    startTime: number,
    reason: string
  ): AIRouterResponse {
    return {
      content: '',
      routing: {
        initialTier: tier,
        finalTier: tier,
        escalated: false,
        provider: MODEL_CONFIGS[tier].provider,
        model: MODEL_CONFIGS[tier].model,
      },
      usage: {
        inputTokens: 0,
        outputTokens: 0,
        totalTokens: 0,
        estimatedCostUsd: 0,
      },
      qualityGate: {
        passed: false,
        checks: [
          {
            name: 'phi_input_scan',
            passed: false,
            reason,
            severity: 'error',
          },
        ],
      },
      metrics: {
        latencyMs: Date.now() - startTime,
      },
    };
  }

  /**
   * Create a failed response
   */
  private createFailedResponse(
    request: AIRouterRequest,
    initialTier: ModelTier,
    finalTier: ModelTier,
    startTime: number,
    errorMessage: string,
    escalated: boolean,
    escalationReason?: string
  ): AIRouterResponse {
    return {
      content: '',
      routing: {
        initialTier,
        finalTier,
        escalated,
        escalationReason,
        provider: MODEL_CONFIGS[finalTier].provider,
        model: MODEL_CONFIGS[finalTier].model,
      },
      usage: {
        inputTokens: 0,
        outputTokens: 0,
        totalTokens: 0,
        estimatedCostUsd: 0,
      },
      qualityGate: {
        passed: false,
        checks: [
          {
            name: 'invocation',
            passed: false,
            reason: errorMessage,
            severity: 'error',
          },
        ],
      },
      metrics: {
        latencyMs: Date.now() - startTime,
      },
    };
  }

  /**
   * Create an invocation record for audit logging
   */
  createInvocationRecord(
    request: AIRouterRequest,
    response: AIRouterResponse,
    phiScanPassed: boolean,
    modeCheckPassed: boolean
  ): AIInvocationRecord {
    const allChecksPassed = response.qualityGate.checks.every(c => c.passed);

    return {
      provider: response.routing.provider,
      model: response.routing.model,
      taskType: request.taskType,
      workflowStage: request.metadata?.stageId,
      inputTokenCount: response.usage.inputTokens,
      outputTokenCount: response.usage.outputTokens,
      latencyMs: response.metrics.latencyMs,
      phiScanPassed,
      modeCheckPassed,
      status: allChecksPassed ? 'SUCCESS' : 'FAILED',
      initialTier: response.routing.initialTier,
      finalTier: response.routing.finalTier,
      escalated: response.routing.escalated,
      escalationReason: response.routing.escalationReason,
      qualityGatePassed: response.qualityGate.passed,
      estimatedCostUsd: response.usage.estimatedCostUsd,
    };
  }

  /**
   * Calculate cost from token usage
   */
  calculateCost(
    tier: ModelTier,
    inputTokens: number,
    outputTokens: number
  ): number {
    const config = MODEL_CONFIGS[tier];
    return (
      (inputTokens / 1_000_000) * config.costPerMToken.input +
      (outputTokens / 1_000_000) * config.costPerMToken.output
    );
  }

  /**
   * Get model configuration for a tier
   */
  getModelConfig(tier: ModelTier): typeof MODEL_CONFIGS[ModelTier] {
    return MODEL_CONFIGS[tier];
  }
}

/**
 * Create a singleton instance with default configuration
 */
let defaultInstance: ModelRouterService | null = null;

export function getModelRouter(config?: Partial<AIRouterConfig>): ModelRouterService {
  if (!defaultInstance || config) {
    defaultInstance = new ModelRouterService(config);
  }
  return defaultInstance;
}
