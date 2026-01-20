/**
 * AI Provider Service
 * Task 141 - Extensibility hooks for custom AI models
 *
 * Manages AI model provider registration, routing, and invocation
 * with support for custom/third-party providers
 */

import { z } from 'zod';
import crypto from 'crypto';

// ─────────────────────────────────────────────────────────────
// Types & Schemas
// ─────────────────────────────────────────────────────────────

export const ModelCapabilitySchema = z.enum([
  'CHAT',       // Conversational AI
  'EMBEDDINGS', // Text embeddings
  'RERANK',     // Reranking for search
  'TOOLS',      // Function/tool calling
  'VISION',     // Image understanding
  'CODE',       // Code generation
]);

export const ProviderStatusSchema = z.enum([
  'ACTIVE',
  'INACTIVE',
  'ERROR',
  'RATE_LIMITED',
  'DEGRADED',
]);

export const AuthTypeSchema = z.enum([
  'API_KEY',
  'OAUTH',
  'BASIC',
  'CUSTOM',
  'NONE',
]);

export const AiProviderSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/), // e.g., "openai", "anthropic", "custom-vendor"
  displayName: z.string(),
  description: z.string().optional(),
  capabilities: z.array(ModelCapabilitySchema),
  models: z.array(z.object({
    id: z.string(),
    name: z.string(),
    capabilities: z.array(ModelCapabilitySchema),
    contextWindow: z.number().optional(),
    maxOutputTokens: z.number().optional(),
    inputCostPer1k: z.number().optional(), // USD per 1k tokens
    outputCostPer1k: z.number().optional(),
  })),
  authType: AuthTypeSchema,
  baseUrl: z.string().url().optional(),
  status: ProviderStatusSchema.default('INACTIVE'),
  isBuiltIn: z.boolean().default(false),
  isCustom: z.boolean().default(false),
  configSchema: z.record(z.unknown()).optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const ProviderConfigSchema = z.object({
  providerId: z.string(),
  tenantId: z.string(),
  enabled: z.boolean().default(false),
  credentials: z.record(z.unknown()), // Encrypted in storage
  settings: z.record(z.unknown()).default({}),
  defaultModel: z.string().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const InvokeRequestSchema = z.object({
  capability: ModelCapabilitySchema,
  providerId: z.string().optional(), // If not specified, use default for capability
  model: z.string().optional(), // If not specified, use provider default
  messages: z.array(z.object({
    role: z.enum(['system', 'user', 'assistant']),
    content: z.string(),
  })).optional(),
  prompt: z.string().optional(),
  temperature: z.number().min(0).max(2).optional(),
  maxTokens: z.number().optional(),
  tools: z.array(z.unknown()).optional(),
});

export const InvokeResponseSchema = z.object({
  providerId: z.string(),
  model: z.string(),
  outputText: z.string().optional(),
  embeddings: z.array(z.number()).optional(),
  toolCalls: z.array(z.unknown()).optional(),
  usage: z.object({
    inputTokens: z.number(),
    outputTokens: z.number(),
    totalTokens: z.number(),
    costUsd: z.number().optional(),
  }).optional(),
  latencyMs: z.number(),
  raw: z.unknown().optional(),
});

export type ModelCapability = z.infer<typeof ModelCapabilitySchema>;
export type ProviderStatus = z.infer<typeof ProviderStatusSchema>;
export type AuthType = z.infer<typeof AuthTypeSchema>;
export type AiProvider = z.infer<typeof AiProviderSchema>;
export type ProviderConfig = z.infer<typeof ProviderConfigSchema>;
export type InvokeRequest = z.infer<typeof InvokeRequestSchema>;
export type InvokeResponse = z.infer<typeof InvokeResponseSchema>;

// ─────────────────────────────────────────────────────────────
// In-Memory Storage (would be DB in production)
// ─────────────────────────────────────────────────────────────

const providers: Map<string, AiProvider> = new Map();
const configs: Map<string, ProviderConfig> = new Map(); // key: `${tenantId}:${providerId}`

// Invocation handler registry (for custom providers)
type InvokeHandler = (
  request: InvokeRequest,
  config: ProviderConfig,
  provider: AiProvider
) => Promise<InvokeResponse>;

const invokeHandlers: Map<string, InvokeHandler> = new Map();

// ─────────────────────────────────────────────────────────────
// Built-in Providers
// ─────────────────────────────────────────────────────────────

const BUILTIN_PROVIDERS: Omit<AiProvider, 'createdAt' | 'updatedAt'>[] = [
  {
    id: 'anthropic',
    displayName: 'Anthropic',
    description: 'Claude models from Anthropic',
    capabilities: ['CHAT', 'TOOLS', 'VISION', 'CODE'],
    models: [
      {
        id: 'claude-3-opus-20240229',
        name: 'Claude 3 Opus',
        capabilities: ['CHAT', 'TOOLS', 'VISION', 'CODE'],
        contextWindow: 200000,
        maxOutputTokens: 4096,
        inputCostPer1k: 0.015,
        outputCostPer1k: 0.075,
      },
      {
        id: 'claude-3-sonnet-20240229',
        name: 'Claude 3 Sonnet',
        capabilities: ['CHAT', 'TOOLS', 'VISION', 'CODE'],
        contextWindow: 200000,
        maxOutputTokens: 4096,
        inputCostPer1k: 0.003,
        outputCostPer1k: 0.015,
      },
      {
        id: 'claude-3-haiku-20240307',
        name: 'Claude 3 Haiku',
        capabilities: ['CHAT', 'TOOLS', 'VISION'],
        contextWindow: 200000,
        maxOutputTokens: 4096,
        inputCostPer1k: 0.00025,
        outputCostPer1k: 0.00125,
      },
    ],
    authType: 'API_KEY',
    baseUrl: 'https://api.anthropic.com',
    status: 'ACTIVE',
    isBuiltIn: true,
    isCustom: false,
    configSchema: {
      type: 'object',
      required: ['apiKey'],
      properties: {
        apiKey: { type: 'string', description: 'Anthropic API key' },
      },
    },
  },
  {
    id: 'openai',
    displayName: 'OpenAI',
    description: 'GPT models from OpenAI',
    capabilities: ['CHAT', 'EMBEDDINGS', 'TOOLS', 'VISION', 'CODE'],
    models: [
      {
        id: 'gpt-4-turbo',
        name: 'GPT-4 Turbo',
        capabilities: ['CHAT', 'TOOLS', 'VISION', 'CODE'],
        contextWindow: 128000,
        maxOutputTokens: 4096,
        inputCostPer1k: 0.01,
        outputCostPer1k: 0.03,
      },
      {
        id: 'gpt-4o',
        name: 'GPT-4o',
        capabilities: ['CHAT', 'TOOLS', 'VISION', 'CODE'],
        contextWindow: 128000,
        maxOutputTokens: 4096,
        inputCostPer1k: 0.005,
        outputCostPer1k: 0.015,
      },
      {
        id: 'gpt-3.5-turbo',
        name: 'GPT-3.5 Turbo',
        capabilities: ['CHAT', 'TOOLS'],
        contextWindow: 16384,
        maxOutputTokens: 4096,
        inputCostPer1k: 0.0005,
        outputCostPer1k: 0.0015,
      },
      {
        id: 'text-embedding-3-large',
        name: 'Text Embedding 3 Large',
        capabilities: ['EMBEDDINGS'],
        contextWindow: 8191,
        inputCostPer1k: 0.00013,
      },
    ],
    authType: 'API_KEY',
    baseUrl: 'https://api.openai.com',
    status: 'ACTIVE',
    isBuiltIn: true,
    isCustom: false,
    configSchema: {
      type: 'object',
      required: ['apiKey'],
      properties: {
        apiKey: { type: 'string', description: 'OpenAI API key' },
        organization: { type: 'string', description: 'Organization ID (optional)' },
      },
    },
  },
  {
    id: 'together',
    displayName: 'Together AI',
    description: 'Open source models via Together AI',
    capabilities: ['CHAT', 'EMBEDDINGS', 'CODE'],
    models: [
      {
        id: 'mistralai/Mixtral-8x7B-Instruct-v0.1',
        name: 'Mixtral 8x7B',
        capabilities: ['CHAT', 'CODE'],
        contextWindow: 32768,
        inputCostPer1k: 0.0006,
        outputCostPer1k: 0.0006,
      },
      {
        id: 'meta-llama/Llama-3-70b-chat-hf',
        name: 'Llama 3 70B',
        capabilities: ['CHAT', 'CODE'],
        contextWindow: 8192,
        inputCostPer1k: 0.0009,
        outputCostPer1k: 0.0009,
      },
      {
        id: 'codellama/CodeLlama-34b-Instruct-hf',
        name: 'Code Llama 34B',
        capabilities: ['CODE'],
        contextWindow: 16384,
        inputCostPer1k: 0.0008,
        outputCostPer1k: 0.0008,
      },
    ],
    authType: 'API_KEY',
    baseUrl: 'https://api.together.xyz',
    status: 'ACTIVE',
    isBuiltIn: true,
    isCustom: false,
    configSchema: {
      type: 'object',
      required: ['apiKey'],
      properties: {
        apiKey: { type: 'string', description: 'Together AI API key' },
      },
    },
  },
  {
    id: 'cohere',
    displayName: 'Cohere',
    description: 'Embeddings and reranking from Cohere',
    capabilities: ['CHAT', 'EMBEDDINGS', 'RERANK'],
    models: [
      {
        id: 'command-r-plus',
        name: 'Command R+',
        capabilities: ['CHAT'],
        contextWindow: 128000,
        inputCostPer1k: 0.003,
        outputCostPer1k: 0.015,
      },
      {
        id: 'embed-english-v3.0',
        name: 'Embed English v3',
        capabilities: ['EMBEDDINGS'],
        contextWindow: 512,
        inputCostPer1k: 0.0001,
      },
      {
        id: 'rerank-english-v3.0',
        name: 'Rerank English v3',
        capabilities: ['RERANK'],
        inputCostPer1k: 0.001,
      },
    ],
    authType: 'API_KEY',
    baseUrl: 'https://api.cohere.ai',
    status: 'ACTIVE',
    isBuiltIn: true,
    isCustom: false,
    configSchema: {
      type: 'object',
      required: ['apiKey'],
      properties: {
        apiKey: { type: 'string', description: 'Cohere API key' },
      },
    },
  },
];

// ─────────────────────────────────────────────────────────────
// Initialization
// ─────────────────────────────────────────────────────────────

function initializeProviders(): void {
  if (providers.size === 0) {
    const now = new Date().toISOString();
    for (const provider of BUILTIN_PROVIDERS) {
      providers.set(provider.id, {
        ...provider,
        createdAt: now,
        updatedAt: now,
      });
    }
  }
}

// ─────────────────────────────────────────────────────────────
// Provider Registry API
// ─────────────────────────────────────────────────────────────

export function listProviders(options?: {
  capability?: ModelCapability;
  includeCustom?: boolean;
}): AiProvider[] {
  initializeProviders();

  let results = Array.from(providers.values());

  if (options?.capability) {
    results = results.filter(p =>
      p.capabilities.includes(options.capability!)
    );
  }

  if (options?.includeCustom === false) {
    results = results.filter(p => !p.isCustom);
  }

  return results.sort((a, b) => a.displayName.localeCompare(b.displayName));
}

export function getProvider(id: string): AiProvider | undefined {
  initializeProviders();
  return providers.get(id);
}

export function registerCustomProvider(
  provider: Omit<AiProvider, 'createdAt' | 'updatedAt' | 'isBuiltIn' | 'isCustom'>,
  handler?: InvokeHandler
): AiProvider {
  initializeProviders();

  if (providers.has(provider.id)) {
    throw new Error(`Provider already exists: ${provider.id}`);
  }

  const now = new Date().toISOString();
  const newProvider: AiProvider = {
    ...provider,
    isBuiltIn: false,
    isCustom: true,
    createdAt: now,
    updatedAt: now,
  };

  providers.set(provider.id, newProvider);

  if (handler) {
    invokeHandlers.set(provider.id, handler);
  }

  return newProvider;
}

export function unregisterCustomProvider(id: string): boolean {
  const provider = providers.get(id);
  if (!provider || provider.isBuiltIn) {
    return false;
  }

  providers.delete(id);
  invokeHandlers.delete(id);
  return true;
}

export function updateProviderStatus(
  id: string,
  status: ProviderStatus
): AiProvider | undefined {
  const provider = providers.get(id);
  if (!provider) return undefined;

  provider.status = status;
  provider.updatedAt = new Date().toISOString();
  providers.set(id, provider);
  return provider;
}

// ─────────────────────────────────────────────────────────────
// Provider Configuration API
// ─────────────────────────────────────────────────────────────

export function configureProvider(
  providerId: string,
  tenantId: string,
  credentials: Record<string, unknown>,
  settings?: Record<string, unknown>
): ProviderConfig {
  initializeProviders();

  const provider = providers.get(providerId);
  if (!provider) {
    throw new Error(`Provider not found: ${providerId}`);
  }

  // Validate credentials against schema
  if (provider.configSchema) {
    const required = (provider.configSchema as any).required ?? [];
    for (const field of required) {
      if (!(field in credentials)) {
        throw new Error(`Missing required credential: ${field}`);
      }
    }
  }

  const key = `${tenantId}:${providerId}`;
  const now = new Date().toISOString();

  const existing = configs.get(key);
  const config: ProviderConfig = {
    providerId,
    tenantId,
    enabled: existing?.enabled ?? false,
    credentials, // Would be encrypted in production
    settings: settings ?? existing?.settings ?? {},
    defaultModel: (settings?.defaultModel as string) ?? provider.models[0]?.id,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };

  configs.set(key, config);
  return config;
}

export function getProviderConfig(
  providerId: string,
  tenantId: string
): ProviderConfig | undefined {
  return configs.get(`${tenantId}:${providerId}`);
}

export function enableProviderForTenant(
  providerId: string,
  tenantId: string
): ProviderConfig | undefined {
  const key = `${tenantId}:${providerId}`;
  const config = configs.get(key);
  if (!config) return undefined;

  config.enabled = true;
  config.updatedAt = new Date().toISOString();
  configs.set(key, config);
  return config;
}

export function disableProviderForTenant(
  providerId: string,
  tenantId: string
): ProviderConfig | undefined {
  const key = `${tenantId}:${providerId}`;
  const config = configs.get(key);
  if (!config) return undefined;

  config.enabled = false;
  config.updatedAt = new Date().toISOString();
  configs.set(key, config);
  return config;
}

export function listTenantProviders(tenantId: string): Array<{
  provider: AiProvider;
  config?: ProviderConfig;
}> {
  initializeProviders();

  return Array.from(providers.values()).map(provider => ({
    provider,
    config: configs.get(`${tenantId}:${provider.id}`),
  }));
}

// ─────────────────────────────────────────────────────────────
// Model Selection & Routing
// ─────────────────────────────────────────────────────────────

export function findBestProvider(
  tenantId: string,
  capability: ModelCapability,
  preferredProviderId?: string
): { provider: AiProvider; config: ProviderConfig; model: string } | undefined {
  initializeProviders();

  // If preferred provider specified and available, use it
  if (preferredProviderId) {
    const provider = providers.get(preferredProviderId);
    const config = configs.get(`${tenantId}:${preferredProviderId}`);

    if (provider && config?.enabled && provider.capabilities.includes(capability)) {
      const model = config.defaultModel ?? provider.models.find(m =>
        m.capabilities.includes(capability)
      )?.id;

      if (model) {
        return { provider, config, model };
      }
    }
  }

  // Otherwise, find first enabled provider with capability
  for (const provider of providers.values()) {
    if (!provider.capabilities.includes(capability)) continue;
    if (provider.status !== 'ACTIVE') continue;

    const config = configs.get(`${tenantId}:${provider.id}`);
    if (!config?.enabled) continue;

    const model = config.defaultModel ?? provider.models.find(m =>
      m.capabilities.includes(capability)
    )?.id;

    if (model) {
      return { provider, config, model };
    }
  }

  return undefined;
}

export function getModelInfo(providerId: string, modelId: string): {
  id: string;
  name: string;
  capabilities: ModelCapability[];
  contextWindow?: number;
  maxOutputTokens?: number;
} | undefined {
  const provider = providers.get(providerId);
  if (!provider) return undefined;

  const model = provider.models.find(m => m.id === modelId);
  if (!model) return undefined;

  return {
    id: model.id,
    name: model.name,
    capabilities: model.capabilities,
    contextWindow: model.contextWindow,
    maxOutputTokens: model.maxOutputTokens,
  };
}

// ─────────────────────────────────────────────────────────────
// Model Invocation
// ─────────────────────────────────────────────────────────────

export async function invoke(
  tenantId: string,
  request: InvokeRequest
): Promise<InvokeResponse> {
  initializeProviders();

  const startTime = Date.now();

  // Find provider and model
  const selection = findBestProvider(
    tenantId,
    request.capability,
    request.providerId
  );

  if (!selection) {
    throw new Error(`No provider available for capability: ${request.capability}`);
  }

  const { provider, config, model } = selection;
  const selectedModel = request.model ?? model;

  // Check for custom handler
  const handler = invokeHandlers.get(provider.id);
  if (handler) {
    return handler(request, config, provider);
  }

  // Mock response for built-in providers (in production, call actual APIs)
  const latencyMs = Date.now() - startTime + Math.random() * 100;

  const response: InvokeResponse = {
    providerId: provider.id,
    model: selectedModel,
    latencyMs,
  };

  if (request.capability === 'CHAT') {
    response.outputText = `[Mock ${provider.displayName} response for model ${selectedModel}]`;
    response.usage = {
      inputTokens: 100,
      outputTokens: 50,
      totalTokens: 150,
    };
  } else if (request.capability === 'EMBEDDINGS') {
    // Generate mock embeddings (1536 dimensions like OpenAI ada)
    response.embeddings = Array(1536).fill(0).map(() => Math.random() * 2 - 1);
    response.usage = {
      inputTokens: 100,
      outputTokens: 0,
      totalTokens: 100,
    };
  }

  return response;
}

// ─────────────────────────────────────────────────────────────
// Usage Tracking
// ─────────────────────────────────────────────────────────────

interface UsageRecord {
  id: string;
  tenantId: string;
  providerId: string;
  model: string;
  capability: ModelCapability;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  timestamp: string;
}

const usageRecords: UsageRecord[] = [];

export function recordUsage(
  tenantId: string,
  response: InvokeResponse
): void {
  if (!response.usage) return;

  const provider = providers.get(response.providerId);
  const model = provider?.models.find(m => m.id === response.model);

  let costUsd = 0;
  if (model) {
    costUsd =
      (response.usage.inputTokens / 1000 * (model.inputCostPer1k ?? 0)) +
      (response.usage.outputTokens / 1000 * (model.outputCostPer1k ?? 0));
  }

  usageRecords.push({
    id: crypto.randomUUID(),
    tenantId,
    providerId: response.providerId,
    model: response.model,
    capability: 'CHAT', // Would come from request
    inputTokens: response.usage.inputTokens,
    outputTokens: response.usage.outputTokens,
    costUsd,
    timestamp: new Date().toISOString(),
  });
}

export function getUsageSummary(
  tenantId: string,
  options?: { startDate?: string; endDate?: string }
): {
  totalTokens: number;
  totalCostUsd: number;
  byProvider: Record<string, { tokens: number; costUsd: number }>;
} {
  let records = usageRecords.filter(r => r.tenantId === tenantId);

  if (options?.startDate) {
    records = records.filter(r => r.timestamp >= options.startDate!);
  }

  if (options?.endDate) {
    records = records.filter(r => r.timestamp <= options.endDate!);
  }

  const byProvider: Record<string, { tokens: number; costUsd: number }> = {};
  let totalTokens = 0;
  let totalCostUsd = 0;

  for (const record of records) {
    const tokens = record.inputTokens + record.outputTokens;
    totalTokens += tokens;
    totalCostUsd += record.costUsd;

    if (!byProvider[record.providerId]) {
      byProvider[record.providerId] = { tokens: 0, costUsd: 0 };
    }
    byProvider[record.providerId].tokens += tokens;
    byProvider[record.providerId].costUsd += record.costUsd;
  }

  return { totalTokens, totalCostUsd, byProvider };
}

// ─────────────────────────────────────────────────────────────
// Exports
// ─────────────────────────────────────────────────────────────

export default {
  // Registry
  listProviders,
  getProvider,
  registerCustomProvider,
  unregisterCustomProvider,
  updateProviderStatus,

  // Configuration
  configureProvider,
  getProviderConfig,
  enableProviderForTenant,
  disableProviderForTenant,
  listTenantProviders,

  // Selection
  findBestProvider,
  getModelInfo,

  // Invocation
  invoke,

  // Usage
  recordUsage,
  getUsageSummary,
};
