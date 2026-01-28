/**
 * OpenAI Provider Wrapper with Notion Logging
 *
 * Wraps the OpenAI SDK to automatically log all API calls
 * to Notion for usage tracking and cost analysis.
 */

import OpenAI from 'openai';
import type {
  ChatCompletionCreateParams,
  ChatCompletionMessageParam,
  ChatCompletion,
} from 'openai/resources/chat/completions';
import { logAIUsage, type AIUsageLogEntry } from '../notion/notionLogger';
import type { AITaskType, ModelTier } from '../types';

// ============================================================================
// Types
// ============================================================================

export interface OpenAIRequestOptions {
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

export interface OpenAIResponse {
  /** The chat completion response */
  completion: ChatCompletion;
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

const OPENAI_PRICING: Record<string, { input: number; output: number }> = {
  // Per million tokens
  'gpt-4o': { input: 2.5, output: 10.0 },
  'gpt-4o-2024-11-20': { input: 2.5, output: 10.0 },
  'gpt-4o-mini': { input: 0.15, output: 0.6 },
  'gpt-4o-mini-2024-07-18': { input: 0.15, output: 0.6 },
  'gpt-4-turbo': { input: 10.0, output: 30.0 },
  'gpt-4-turbo-2024-04-09': { input: 10.0, output: 30.0 },
  'gpt-4': { input: 30.0, output: 60.0 },
  'gpt-4-32k': { input: 60.0, output: 120.0 },
  'gpt-3.5-turbo': { input: 0.5, output: 1.5 },
  'gpt-3.5-turbo-0125': { input: 0.5, output: 1.5 },
  'o1': { input: 15.0, output: 60.0 },
  'o1-2024-12-17': { input: 15.0, output: 60.0 },
  'o1-mini': { input: 3.0, output: 12.0 },
  'o1-mini-2024-09-12': { input: 3.0, output: 12.0 },
  'o1-preview': { input: 15.0, output: 60.0 },
  'o3-mini': { input: 1.1, output: 4.4 },
  // Default fallback
  default: { input: 2.5, output: 10.0 },
};

function calculateCost(model: string, inputTokens: number, outputTokens: number): number {
  // Normalize model name (remove date suffixes for lookup)
  const baseModel = model.replace(/-\d{4}-\d{2}-\d{2}$/, '');
  const pricing = OPENAI_PRICING[model] ?? OPENAI_PRICING[baseModel] ?? OPENAI_PRICING['default'];
  const inputCost = (inputTokens / 1_000_000) * pricing.input;
  const outputCost = (outputTokens / 1_000_000) * pricing.output;
  return Math.round((inputCost + outputCost) * 100000) / 100000; // 5 decimal precision
}

// ============================================================================
// OpenAI Provider Class
// ============================================================================

export class OpenAIProvider {
  private client: OpenAI;
  private defaultModel: string;

  constructor(options?: { apiKey?: string; defaultModel?: string; baseURL?: string }) {
    this.client = new OpenAI({
      apiKey: options?.apiKey ?? process.env.OPENAI_API_KEY,
      baseURL: options?.baseURL,
    });
    this.defaultModel = options?.defaultModel ?? 'gpt-4o';
  }

  /**
   * Create a chat completion with automatic logging
   */
  async createChatCompletion(
    params: Omit<ChatCompletionCreateParams, 'model'> & { model?: string },
    options: OpenAIRequestOptions = {}
  ): Promise<OpenAIResponse> {
    const model = params.model ?? this.defaultModel;
    const startTime = Date.now();
    let status: AIUsageLogEntry['status'] = 'success';
    let errorMessage: string | undefined;
    let completion: ChatCompletion | null = null;

    try {
      completion = await this.client.chat.completions.create({
        ...params,
        model,
      }) as ChatCompletion;
    } catch (error) {
      status = 'error';
      errorMessage = error instanceof Error ? error.message : String(error);
      throw error;
    } finally {
      const latencyMs = Date.now() - startTime;
      const inputTokens = completion?.usage?.prompt_tokens ?? 0;
      const outputTokens = completion?.usage?.completion_tokens ?? 0;
      const totalTokens = inputTokens + outputTokens;
      const estimatedCostUsd = calculateCost(model, inputTokens, outputTokens);

      // Log to Notion
      await logAIUsage({
        provider: 'openai',
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

    const inputTokens = completion.usage?.prompt_tokens ?? 0;
    const outputTokens = completion.usage?.completion_tokens ?? 0;

    return {
      completion,
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
   * Create a streaming chat completion with automatic logging
   */
  async *streamChatCompletion(
    params: Omit<ChatCompletionCreateParams, 'model' | 'stream'> & { model?: string },
    options: OpenAIRequestOptions = {}
  ): AsyncGenerator<OpenAI.Chat.Completions.ChatCompletionChunk, OpenAIResponse, unknown> {
    const model = params.model ?? this.defaultModel;
    const startTime = Date.now();
    let inputTokens = 0;
    let outputTokens = 0;
    let status: AIUsageLogEntry['status'] = 'success';
    let errorMessage: string | undefined;
    let content = '';

    try {
      const stream = await this.client.chat.completions.create({
        ...params,
        model,
        stream: true,
        stream_options: { include_usage: true },
      });

      for await (const chunk of stream) {
        yield chunk;

        // Track content for token estimation
        const delta = chunk.choices[0]?.delta?.content;
        if (delta) {
          content += delta;
        }

        // Get usage from final chunk if available
        if (chunk.usage) {
          inputTokens = chunk.usage.prompt_tokens;
          outputTokens = chunk.usage.completion_tokens;
        }
      }

      // Estimate tokens if not provided
      if (outputTokens === 0) {
        outputTokens = Math.ceil(content.length / 4); // Rough estimate
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
        provider: 'openai',
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

    // Return final response summary
    return {
      completion: {
        id: 'stream',
        object: 'chat.completion',
        created: Math.floor(Date.now() / 1000),
        model,
        choices: [
          {
            index: 0,
            message: { role: 'assistant', content },
            finish_reason: 'stop',
          },
        ],
        usage: {
          prompt_tokens: inputTokens,
          completion_tokens: outputTokens,
          total_tokens: inputTokens + outputTokens,
        },
      } as ChatCompletion,
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
    options: OpenAIRequestOptions & {
      model?: string;
      maxTokens?: number;
      systemPrompt?: string;
      temperature?: number;
    } = {}
  ): Promise<{ text: string; usage: OpenAIResponse['usage']; metrics: OpenAIResponse['metrics'] }> {
    const messages: ChatCompletionMessageParam[] = [];

    if (options.systemPrompt) {
      messages.push({ role: 'system', content: options.systemPrompt });
    }
    messages.push({ role: 'user', content: prompt });

    const response = await this.createChatCompletion(
      {
        model: options.model,
        messages,
        max_tokens: options.maxTokens ?? 4096,
        temperature: options.temperature,
      },
      options
    );

    const text = response.completion.choices[0]?.message?.content ?? '';

    return {
      text,
      usage: response.usage,
      metrics: response.metrics,
    };
  }

  /**
   * JSON mode completion
   */
  async completeJSON<T = unknown>(
    prompt: string,
    options: OpenAIRequestOptions & {
      model?: string;
      maxTokens?: number;
      systemPrompt?: string;
      temperature?: number;
    } = {}
  ): Promise<{ data: T; usage: OpenAIResponse['usage']; metrics: OpenAIResponse['metrics'] }> {
    const messages: ChatCompletionMessageParam[] = [];

    const systemPrompt = options.systemPrompt
      ? `${options.systemPrompt}\n\nRespond with valid JSON only.`
      : 'Respond with valid JSON only.';

    messages.push({ role: 'system', content: systemPrompt });
    messages.push({ role: 'user', content: prompt });

    const response = await this.createChatCompletion(
      {
        model: options.model,
        messages,
        max_tokens: options.maxTokens ?? 4096,
        temperature: options.temperature ?? 0,
        response_format: { type: 'json_object' },
      },
      options
    );

    const text = response.completion.choices[0]?.message?.content ?? '{}';
    const data = JSON.parse(text) as T;

    return {
      data,
      usage: response.usage,
      metrics: response.metrics,
    };
  }

  /**
   * Get the underlying OpenAI client for advanced use cases
   */
  getClient(): OpenAI {
    return this.client;
  }
}

// ============================================================================
// Singleton Factory
// ============================================================================

let providerInstance: OpenAIProvider | null = null;

/**
 * Get or create the OpenAI provider instance
 */
export function getOpenAIProvider(options?: {
  apiKey?: string;
  defaultModel?: string;
  baseURL?: string;
}): OpenAIProvider {
  if (providerInstance && !options) {
    return providerInstance;
  }

  providerInstance = new OpenAIProvider(options);
  return providerInstance;
}

/**
 * Create a one-off OpenAI completion with logging
 */
export async function openaiComplete(
  prompt: string,
  options?: OpenAIRequestOptions & {
    model?: string;
    maxTokens?: number;
    systemPrompt?: string;
    temperature?: number;
  }
): Promise<string> {
  const provider = getOpenAIProvider();
  const result = await provider.complete(prompt, options);
  return result.text;
}

/**
 * Create a one-off OpenAI JSON completion with logging
 */
export async function openaiCompleteJSON<T = unknown>(
  prompt: string,
  options?: OpenAIRequestOptions & {
    model?: string;
    maxTokens?: number;
    systemPrompt?: string;
    temperature?: number;
  }
): Promise<T> {
  const provider = getOpenAIProvider();
  const result = await provider.completeJSON<T>(prompt, options);
  return result.data;
}
