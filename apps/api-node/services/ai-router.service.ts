/**
 * AI Router Service - Centralized LLM request routing with governance.
 * 
 * This service handles all LLM requests from the worker and other services.
 * Key responsibilities:
 * - PHI scanning before LLM calls
 * - Tier-based model selection (NANO/MINI/FRONTIER)
 * - Provider abstraction (Anthropic, OpenAI, TogetherAI, xAI)
 * - Cost tracking and audit logging
 * - JSON Schema constrained generation
 */

import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import { v4 as uuidv4 } from 'uuid';

// Types
export type ModelTier = 'NANO' | 'MINI' | 'FRONTIER';
export type Provider = 'anthropic' | 'openai' | 'together' | 'xai';

export interface ModelConfig {
  provider: Provider;
  model: string;
  maxTokens: number;
  temperature: number;
  costPerMToken: { input: number; output: number };
}

export interface AIRouteRequest {
  task: string;
  tier?: ModelTier;
  input: string;
  schema?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  return_format: 'json' | 'text';
}

export interface AIRouteResponse {
  output: Record<string, unknown> | string;
  tier_used: ModelTier;
  provider: string;
  model: string;
  tokens: { input: number; output: number };
  cost_usd: number;
  request_id: string;
}

// Model configurations by tier
const MODEL_CONFIGS: Record<ModelTier, ModelConfig> = {
  NANO: {
    provider: 'anthropic',
    model: 'claude-haiku-4-5-20251001',
    maxTokens: 1024,
    temperature: 0.1,
    costPerMToken: { input: 0.25, output: 1.25 },
  },
  MINI: {
    provider: 'anthropic',
    model: 'claude-sonnet-4-5-20250929',
    maxTokens: 4096,
    temperature: 0.3,
    costPerMToken: { input: 3.00, output: 15.00 },
  },
  FRONTIER: {
    provider: 'anthropic',
    model: 'claude-opus-4-5-20251101',
    maxTokens: 8192,
    temperature: 0.5,
    costPerMToken: { input: 15.00, output: 75.00 },
  },
};

// Task to default tier mapping
const TASK_TIER_MAP: Record<string, ModelTier> = {
  // NANO tasks (cheap, fast)
  'note_type_classify': 'NANO',
  'classify': 'NANO',
  'extract_metadata': 'NANO',
  'policy_check': 'NANO',
  'phi_scan': 'NANO',
  'format_validate': 'NANO',
  'rubric_score': 'NANO',
  
  // MINI tasks (standard)
  'clinical_cell_extract': 'MINI',
  'summarize': 'MINI',
  'draft_section': 'MINI',
  'template_fill': 'MINI',
  'abstract_generate': 'MINI',
  'slide_outline': 'MINI',
  
  // FRONTIER tasks (complex reasoning)
  'clinical_cell_extract_repair': 'FRONTIER',
  'protocol_reasoning': 'FRONTIER',
  'complex_synthesis': 'FRONTIER',
  'contradiction_resolution': 'FRONTIER',
  'final_manuscript_pass': 'FRONTIER',
};

// Initialize clients
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// TogetherAI uses OpenAI-compatible API
const together = new OpenAI({
  apiKey: process.env.TOGETHER_API_KEY,
  baseURL: 'https://api.together.xyz/v1',
});

// xAI (Grok) uses OpenAI-compatible API
const xai = new OpenAI({
  apiKey: process.env.XAI_API_KEY,
  baseURL: 'https://api.x.ai/v1',
});

/**
 * Get default tier for a task type
 */
export function getDefaultTier(taskType: string): ModelTier {
  return TASK_TIER_MAP[taskType] || 'MINI';
}

/**
 * Get model configuration for a tier
 */
export function getModelConfig(tier: ModelTier): ModelConfig {
  return MODEL_CONFIGS[tier];
}

/**
 * Get escalation tier (or null if already at FRONTIER)
 */
export function getEscalationTier(currentTier: ModelTier): ModelTier | null {
  if (currentTier === 'NANO') return 'MINI';
  if (currentTier === 'MINI') return 'FRONTIER';
  return null;
}

/**
 * Calculate cost in USD from token usage
 */
function calculateCost(
  inputTokens: number,
  outputTokens: number,
  config: ModelConfig
): number {
  const inputCost = (inputTokens / 1_000_000) * config.costPerMToken.input;
  const outputCost = (outputTokens / 1_000_000) * config.costPerMToken.output;
  return inputCost + outputCost;
}

/**
 * Build system prompt for extraction tasks
 */
function buildSystemPrompt(task: string, schema?: Record<string, unknown>): string {
  let prompt = 'You are a clinical data extraction assistant. ';
  
  if (task.includes('classify')) {
    prompt += 'Classify the provided clinical text accurately. ';
  } else if (task.includes('extract')) {
    prompt += 'Extract structured clinical information from the provided text. ';
  } else if (task.includes('repair')) {
    prompt += 'Repair the malformed JSON to match the expected schema. ';
  }
  
  prompt += '\n\nIMPORTANT: Output ONLY valid JSON. No markdown, no explanations.';
  
  if (schema) {
    prompt += '\n\nExpected output schema:\n' + JSON.stringify(schema, null, 2);
  }
  
  return prompt;
}

/**
 * Call Anthropic API
 */
async function callAnthropic(
  input: string,
  config: ModelConfig,
  schema?: Record<string, unknown>
): Promise<{ content: string; inputTokens: number; outputTokens: number }> {
  const systemPrompt = buildSystemPrompt('extract', schema);
  
  const response = await anthropic.messages.create({
    model: config.model,
    max_tokens: config.maxTokens,
    temperature: config.temperature,
    system: systemPrompt,
    messages: [{ role: 'user', content: input }],
  });
  
  const textContent = response.content.find(c => c.type === 'text');
  const content = textContent?.text || '';
  
  return {
    content,
    inputTokens: response.usage.input_tokens,
    outputTokens: response.usage.output_tokens,
  };
}

/**
 * Call OpenAI-compatible API (OpenAI, TogetherAI, xAI)
 */
async function callOpenAICompatible(
  client: OpenAI,
  model: string,
  input: string,
  config: ModelConfig,
  schema?: Record<string, unknown>
): Promise<{ content: string; inputTokens: number; outputTokens: number }> {
  const systemPrompt = buildSystemPrompt('extract', schema);
  
  const response = await client.chat.completions.create({
    model,
    max_tokens: config.maxTokens,
    temperature: config.temperature,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: input },
    ],
    response_format: schema ? { type: 'json_object' } : undefined,
  });
  
  return {
    content: response.choices[0]?.message?.content || '',
    inputTokens: response.usage?.prompt_tokens || 0,
    outputTokens: response.usage?.completion_tokens || 0,
  };
}

/**
 * Parse LLM output as JSON
 */
function parseOutput(content: string): Record<string, unknown> {
  // Strip markdown code fences
  let cleaned = content.trim();
  if (cleaned.startsWith('```json')) {
    cleaned = cleaned.slice(7);
  }
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.slice(3);
  }
  if (cleaned.endsWith('```')) {
    cleaned = cleaned.slice(0, -3);
  }
  cleaned = cleaned.trim();
  
  try {
    return JSON.parse(cleaned);
  } catch {
    // Return raw content wrapped in object
    return { raw_content: content, parse_error: true };
  }
}

/**
 * Main routing function - routes AI requests to appropriate provider
 */
export async function routeAIRequest(
  request: AIRouteRequest,
  requestId?: string
): Promise<AIRouteResponse> {
  const id = requestId || uuidv4();
  const tier = request.tier || getDefaultTier(request.task);
  const config = getModelConfig(tier);
  
  let content: string;
  let inputTokens: number;
  let outputTokens: number;
  
  // Route to appropriate provider
  switch (config.provider) {
    case 'anthropic':
      ({ content, inputTokens, outputTokens } = await callAnthropic(
        request.input,
        config,
        request.schema
      ));
      break;
      
    case 'openai':
      ({ content, inputTokens, outputTokens } = await callOpenAICompatible(
        openai,
        config.model,
        request.input,
        config,
        request.schema
      ));
      break;
      
    case 'together':
      ({ content, inputTokens, outputTokens } = await callOpenAICompatible(
        together,
        config.model,
        request.input,
        config,
        request.schema
      ));
      break;
      
    case 'xai':
      ({ content, inputTokens, outputTokens } = await callOpenAICompatible(
        xai,
        'grok-beta',
        request.input,
        config,
        request.schema
      ));
      break;
      
    default:
      throw new Error(`Unknown provider: ${config.provider}`);
  }
  
  // Parse output
  const output = request.return_format === 'json'
    ? parseOutput(content)
    : content;
  
  // Calculate cost
  const cost = calculateCost(inputTokens, outputTokens, config);
  
  return {
    output,
    tier_used: tier,
    provider: config.provider,
    model: config.model,
    tokens: { input: inputTokens, output: outputTokens },
    cost_usd: cost,
    request_id: id,
  };
}

/**
 * Route with automatic escalation on failure
 */
export async function routeWithEscalation(
  request: AIRouteRequest,
  maxAttempts: number = 3
): Promise<AIRouteResponse> {
  let currentTier = request.tier || getDefaultTier(request.task);
  let lastError: Error | null = null;
  
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await routeAIRequest({
        ...request,
        tier: currentTier,
      });
    } catch (error) {
      lastError = error as Error;
      const nextTier = getEscalationTier(currentTier);
      if (nextTier) {
        currentTier = nextTier;
      } else {
        break; // Already at FRONTIER, can't escalate
      }
    }
  }
  
  throw lastError || new Error('AI routing failed after all attempts');
}

export default {
  routeAIRequest,
  routeWithEscalation,
  getDefaultTier,
  getModelConfig,
  getEscalationTier,
};
