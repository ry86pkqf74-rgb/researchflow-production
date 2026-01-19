/**
 * Phase A - Task 12: Ollama provider for local AI fallback
 *
 * Provides fallback to local Ollama models when:
 * 1. External API keys are missing
 * 2. AI_ROUTER_FORCE_LOCAL=true
 * 3. External providers fail with 401/429/5xx errors
 */

export interface OllamaChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface OllamaChatRequest {
  model: string;
  messages: OllamaChatMessage[];
  temperature?: number;
  max_tokens?: number;
  stream?: boolean;
}

export interface OllamaChatResponse {
  model: string;
  created_at: string;
  message: {
    role: string;
    content: string;
  };
  done: boolean;
  total_duration?: number;
  load_duration?: number;
  prompt_eval_count?: number;
  eval_count?: number;
}

export interface OllamaConfig {
  baseUrl: string;
  model: string;
  timeout: number;
}

/**
 * Get Ollama configuration from environment
 */
export function getOllamaConfig(): OllamaConfig {
  return {
    baseUrl: process.env.OLLAMA_BASE_URL || 'http://ollama:11434',
    model: process.env.OLLAMA_MODEL || 'llama3.1',
    timeout: parseInt(process.env.OLLAMA_TIMEOUT || '60000', 10),
  };
}

/**
 * Check if Ollama should be used as fallback
 */
export function shouldUseOllama(): boolean {
  // Force local mode
  if (process.env.AI_ROUTER_FORCE_LOCAL === 'true') {
    return true;
  }

  // No external API keys configured
  const hasOpenAI = !!process.env.OPENAI_API_KEY;
  const hasAnthropic = !!process.env.ANTHROPIC_API_KEY;

  return !hasOpenAI && !hasAnthropic;
}

/**
 * Check if Ollama is available
 */
export async function isOllamaAvailable(): Promise<boolean> {
  const config = getOllamaConfig();

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(`${config.baseUrl}/api/tags`, {
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Send chat request to Ollama
 */
export async function ollamaChat(
  request: OllamaChatRequest
): Promise<OllamaChatResponse> {
  const config = getOllamaConfig();
  const model = request.model || config.model;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), config.timeout);

  try {
    const response = await fetch(`${config.baseUrl}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages: request.messages,
        options: {
          temperature: request.temperature ?? 0.7,
          num_predict: request.max_tokens ?? 2048,
        },
        stream: false,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`ollama_error:${response.status}:${errorText}`);
    }

    const data = await response.json();
    return data as OllamaChatResponse;
  } catch (error) {
    clearTimeout(timeoutId);

    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('ollama_timeout');
    }

    throw error;
  }
}

/**
 * Convert Ollama response to standard format
 */
export function normalizeOllamaResponse(response: OllamaChatResponse): {
  content: string;
  model: string;
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
} {
  return {
    content: response.message.content,
    model: response.model,
    usage: {
      promptTokens: response.prompt_eval_count || 0,
      completionTokens: response.eval_count || 0,
      totalTokens: (response.prompt_eval_count || 0) + (response.eval_count || 0),
    },
  };
}

/**
 * Check if an error is retryable and should fallback to Ollama
 */
export function shouldFallbackToOllama(error: Error): boolean {
  const message = error.message.toLowerCase();

  // Rate limit errors
  if (message.includes('429') || message.includes('rate limit')) {
    return true;
  }

  // Authentication errors (API key issues)
  if (message.includes('401') || message.includes('403') || message.includes('unauthorized')) {
    return true;
  }

  // Server errors
  if (message.includes('500') || message.includes('502') || message.includes('503') || message.includes('504')) {
    return true;
  }

  // Timeout errors
  if (message.includes('timeout') || message.includes('ETIMEDOUT')) {
    return true;
  }

  return false;
}
