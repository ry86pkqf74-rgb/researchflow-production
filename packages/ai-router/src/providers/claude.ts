/**
 * Claude Provider Wrapper with Notion Logging
 *
 * Wraps the Anthropic SDK to automatically log all API calls
 * to Notion for usage tracking and cost analysis.
 */

import Anthropic from '@anthropic-ai/sdk';
import type { MessageParam, MessageCreateParams, Message } from '@anthropic-ai/sdk/resources/messages';
import { logAIUsage, type AIUsageLogEntry } from '../notion/notionLogger';
import type { AITaskType, ModelTier } from '../types';

// ============================================================================
// Types
// ============================================================================

export interface ClaudeRequestOptions {
  /** Task type for routing and logging */
  taskType?: AITaskType | string;
  /** Model tier override */
  tier?: ModelTier;
  /** Research ID for tracking */
  researchId?: string;
  /** User ID for tracking */
  userId?: string;
  /** Workflow stage */
  stageId?: number;
  /** Session ID for grouping calls */
  sessionId?: string;
  /** Agent ID if called from an agent */
  agentId?: string;
  /** Tool usage plan ID for budget tracking */
  toolUsagePlanId?: string;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

export interface ClaudeResponse {
  /** The message response from Claude */
  message: Message;
  /** Usage information */
  usage: {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
    estimatedCostUsd: number;
  };
  /** Performance metrics */
  metrics: {
    latencyMs: number;
  };
}

// ============================================================================
// Cost Configuration
// ============================================================================

const CLAUDE_PRICING: Record<string, { input: number; output: number }> = {
  // Per million tokens
  'claude-opus-4-5-20251101': { input: 15.0, output: 75.0 },
  'claude-sonnet-4-5-20250929': { input: 3.0, output: 15.0 },
  'claude-haiku-4-5-20251001': { input: 0.25, output: 1.25 },
  'claude-3-5-sonnet-20241022': { input: 3.0, output: 15.0 },
  'claude-3-5-haiku-20241022': { input: 0.8, output: 4.0 },
  'claude-3-opus-20240229': { input: 15.0, output: 75.0 },
  'claude-3-sonnet-20240229': { input: 3.0, output: 15.0 },
  'claude-3-haiku-20240307': { input: 0.25, output: 1.25 },
  // Default fallback
  default: { input: 3.0, output: 15.0 },
};

function calculateCost(model: string, inputTokens: number, outputTokens: number): number {
  const pricing = CLAUDE_PRICING[model] ?? CLAUDE_PRICING['default'];
  const inputCost = (inputTokens / 1_000_000) * pricing.input;
  const outputCost = (outputTokens / 1_000_000) * pricing.output;
  return Math.round((inputCost + outputCost) * 100000) / 100000; // 5 decimal precision
}

// ============================================================================
// Claude Provider Class
// ============================================================================

export class ClaudeProvider {
  private client: Anthropic;
  private defaultModel: string;

  constructor(options?: { apiKey?: string; defaultModel?: string }) {
    this.client = new Anthropic({
      apiKey: options?.apiKey ?? process.env.ANTHROPIC_API_KEY,
    });
    this.defaultModel = options?.defaultModel ?? 'claude-sonnet-4-5-20250929';
  }

  /**
   * Create a message with automatic logging
   */
  async createMessage(
    params: Omit<MessageCreateParams, 'model'> & { model?: string },
    options: ClaudeRequestOptions = {}
  ): Promise<ClaudeResponse> {
    const model = params.model ?? this.defaultModel;
    const startTime = Date.now();
    let status: AIUsageLogEntry['status'] = 'success';
    let errorMessage: string | undefined;
    let message: Message | null = null;

    try {
      const response = await this.client.messages.create({
        ...params,
        model,
      });
      // Handle both streaming and non-streaming responses
      message = response as Message;
    } catch (error) {
      status = 'error';
      errorMessage = error instanceof Error ? error.message : String(error);
      throw error;
    } finally {
      const latencyMs = Date.now() - startTime;
      const inputTokens = message?.usage?.input_tokens ?? 0;
      const outputTokens = message?.usage?.output_tokens ?? 0;
      const totalTokens = inputTokens + outputTokens;
      const estimatedCostUsd = calculateCost(model, inputTokens, outputTokens);

      // Log to Notion
      await logAIUsage({
        provider: 'anthropic',
        model,
        taskType: options.taskType ?? 'general',
        inputTokens,
        outputTokens,
        totalTokens,
        estimatedCostUsd,
        latencyMs,
        status,
        errorMessage,
        tier: options.tier,
        researchId: options.researchId,
        userId: options.userId,
        stageId: options.stageId,
        sessionId: options.sessionId,
        agentId: options.agentId,
        toolUsagePlanId: options.toolUsagePlanId,
        metadata: options.metadata,
      });
    }

    const inputTokens = message.usage.input_tokens;
    const outputTokens = message.usage.output_tokens;

    return {
      message,
      usage: {
        inputTokens,
        outputTokens,
        totalTokens: inputTokens + outputTokens,
        estimatedCostUsd: calculateCost(model, inputTokens, outputTokens),
      },
      metrics: {
        latencyMs: Date.now() - startTime,
      },
    };
  }

  /**
   * Create a streaming message with automatic logging
   */
  async *streamMessage(
    params: Omit<MessageCreateParams, 'model' | 'stream'> & { model?: string },
    options: ClaudeRequestOptions = {}
  ): AsyncGenerator<Anthropic.MessageStreamEvent, ClaudeResponse, unknown> {
    const model = params.model ?? this.defaultModel;
    const startTime = Date.now();
    let inputTokens = 0;
    let outputTokens = 0;
    let status: AIUsageLogEntry['status'] = 'success';
    let errorMessage: string | undefined;
    let finalMessage: Message | null = null;

    try {
      const stream = await this.client.messages.create({
        ...params,
        model,
        stream: true,
      });

      for await (const event of stream) {
        yield event;

        // Track token usage from stream events
        if (event.type === 'message_start' && event.message?.usage) {
          inputTokens = event.message.usage.input_tokens;
        }
        if (event.type === 'message_delta' && (event as { usage?: { output_tokens: number } }).usage) {
          outputTokens = (event as { usage: { output_tokens: number } }).usage.output_tokens;
        }
        if (event.type === 'message_stop') {
          finalMessage = (event as unknown as { message?: Message }).message ?? null;
        }
      }
    } catch (error) {
      status = 'error';
      errorMessage = error instanceof Error ? error.message : String(error);
      throw error;
    } finally {
      const latencyMs = Date.now() - startTime;
      const totalTokens = inputTokens + outputTokens;
      const estimatedCostUsd = calculateCost(model, inputTokens, outputTokens);

      // Log to Notion
      await logAIUsage({
        provider: 'anthropic',
        model,
        taskType: options.taskType ?? 'general',
        inputTokens,
        outputTokens,
        totalTokens,
        estimatedCostUsd,
        latencyMs,
        status,
        errorMessage,
        tier: options.tier,
        researchId: options.researchId,
        userId: options.userId,
        stageId: options.stageId,
        sessionId: options.sessionId,
        agentId: options.agentId,
        toolUsagePlanId: options.toolUsagePlanId,
        metadata: options.metadata,
      });
    }

    return {
      message: finalMessage!,
      usage: {
        inputTokens,
        outputTokens,
        totalTokens: inputTokens + outputTokens,
        estimatedCostUsd: calculateCost(model, inputTokens, outputTokens),
      },
      metrics: {
        latencyMs: Date.now() - startTime,
      },
    };
  }

  /**
   * Simple text completion helper
   */
  async complete(
    prompt: string,
    options: ClaudeRequestOptions & {
      model?: string;
      maxTokens?: number;
      systemPrompt?: string;
      temperature?: number;
    } = {}
  ): Promise<{ text: string; usage: ClaudeResponse['usage']; metrics: ClaudeResponse['metrics'] }> {
    const messages: MessageParam[] = [{ role: 'user', content: prompt }];

    const response = await this.createMessage(
      {
        model: options.model,
        messages,
        max_tokens: options.maxTokens ?? 4096,
        system: options.systemPrompt,
        temperature: options.temperature,
      },
      options
    );

    const textContent = response.message.content.find((block) => block.type === 'text');
    const text = textContent && 'text' in textContent ? textContent.text : '';

    return {
      text,
      usage: response.usage,
      metrics: response.metrics,
    };
  }

  /**
   * Get the underlying Anthropic client for advanced use cases
   */
  getClient(): Anthropic {
    return this.client;
  }
}

// ============================================================================
// Singleton Factory
// ============================================================================

let providerInstance: ClaudeProvider | null = null;

/**
 * Get or create the Claude provider instance
 */
export function getClaudeProvider(options?: {
  apiKey?: string;
  defaultModel?: string;
}): ClaudeProvider {
  if (providerInstance && !options) {
    return providerInstance;
  }

  providerInstance = new ClaudeProvider(options);
  return providerInstance;
}

/**
 * Create a one-off Claude completion with logging
 */
export async function claudeComplete(
  prompt: string,
  options?: ClaudeRequestOptions & {
    model?: string;
    maxTokens?: number;
    systemPrompt?: string;
    temperature?: number;
  }
): Promise<string> {
  const provider = getClaudeProvider();
  const result = await provider.complete(prompt, options);
  return result.text;
}
