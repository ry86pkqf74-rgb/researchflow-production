/**
 * AI Router Configuration (Phase 9)
 *
 * Centralized configuration for the AI router including:
 * - Model tier settings
 * - Quality gate configuration
 * - Auto-refinement feature flags
 * - API keys and provider settings
 *
 * Configuration is loaded from environment variables with sensible defaults.
 *
 * SAFETY INVARIANTS:
 * - API keys never logged or exposed
 * - Feature flags default to safe (disabled) state
 *
 * Last Updated: 2026-01-23
 */

import type { ModelTier, AIProvider, ModelConfig } from './types';

/**
 * Auto-refinement configuration for AI self-improvement loop
 */
export interface AutoRefineConfig {
  /** Enable the auto-refinement loop */
  enabled: boolean;
  /** Maximum refinement attempts per request */
  maxAttempts: number;
  /** Number of attempts before recommending tier escalation */
  escalationThreshold: number;
  /** Treat warnings as errors in quality checks */
  strictMode: boolean;
  /** Minimum score threshold to pass quality gate */
  minScoreThreshold: number;
}

/**
 * Quality gate configuration
 */
export interface QualityGateConfig {
  /** Enable quality gate validation */
  enabled: boolean;
  /** Enable tier escalation on quality failure */
  escalationEnabled: boolean;
  /** Maximum escalations per request */
  maxEscalations: number;
  /** Task types that require narrative checks (citations, key points, etc.) */
  narrativeTaskTypes: string[];
  /** Default minimum citations for narrative content */
  defaultMinCitations: number;
  /** Default word count bounds */
  defaultWordBounds: {
    min: number;
    max: number;
  };
}

/**
 * Provider-specific configuration
 */
export interface ProviderConfig {
  /** Anthropic API key */
  anthropicApiKey?: string;
  /** OpenAI API key */
  openaiApiKey?: string;
  /** Together AI API key */
  togetherApiKey?: string;
  /** Request timeout in milliseconds */
  requestTimeoutMs: number;
  /** Maximum retries for transient failures */
  maxRetries: number;
  /** Retry backoff multiplier */
  retryBackoffMs: number;
}

/**
 * Complete AI Router configuration
 */
export interface AIRouterFullConfig {
  /** Default model tier for unspecified tasks */
  defaultTier: ModelTier;
  /** Auto-refinement settings */
  autoRefine: AutoRefineConfig;
  /** Quality gate settings */
  qualityGate: QualityGateConfig;
  /** Provider settings */
  provider: ProviderConfig;
  /** Custom model configurations (overrides defaults) */
  modelOverrides?: Partial<Record<ModelTier, Partial<ModelConfig>>>;
  /** Enable detailed logging (not for production) */
  debugLogging: boolean;
  /** Environment name */
  environment: 'development' | 'staging' | 'production';
}

/**
 * Parse boolean from environment variable
 */
function parseBoolean(value: string | undefined, defaultValue: boolean): boolean {
  if (value === undefined || value === '') return defaultValue;
  return value.toLowerCase() === 'true' || value === '1';
}

/**
 * Parse integer from environment variable
 */
function parseInt(value: string | undefined, defaultValue: number): number {
  if (value === undefined || value === '') return defaultValue;
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? defaultValue : parsed;
}

/**
 * Parse float from environment variable
 */
function parseFloat(value: string | undefined, defaultValue: number): number {
  if (value === undefined || value === '') return defaultValue;
  const parsed = Number.parseFloat(value);
  return Number.isNaN(parsed) ? defaultValue : parsed;
}

/**
 * Load configuration from environment variables
 */
export function loadConfig(): AIRouterFullConfig {
  const env = typeof process !== 'undefined' ? process.env : {};

  return {
    defaultTier: (env.AI_DEFAULT_TIER as ModelTier) || 'MINI',
    
    autoRefine: {
      enabled: parseBoolean(env.AUTO_REFINE_ENABLED, false),
      maxAttempts: parseInt(env.MAX_REFINE_ATTEMPTS, 3),
      escalationThreshold: parseInt(env.REFINEMENT_ESCALATION_THRESHOLD, 2),
      strictMode: parseBoolean(env.QUALITY_CHECK_STRICT_MODE, false),
      minScoreThreshold: parseFloat(env.MIN_QUALITY_SCORE_THRESHOLD, 0.7),
    },
    
    qualityGate: {
      enabled: parseBoolean(env.QUALITY_GATE_ENABLED, true),
      escalationEnabled: parseBoolean(env.ESCALATION_ENABLED, true),
      maxEscalations: parseInt(env.MAX_ESCALATIONS, 2),
      narrativeTaskTypes: (env.NARRATIVE_TASK_TYPES || 'draft_section,abstract_generate,complex_synthesis').split(','),
      defaultMinCitations: parseInt(env.DEFAULT_MIN_CITATIONS, 3),
      defaultWordBounds: {
        min: parseInt(env.DEFAULT_MIN_WORDS, 100),
        max: parseInt(env.DEFAULT_MAX_WORDS, 2000),
      },
    },
    
    provider: {
      anthropicApiKey: env.ANTHROPIC_API_KEY,
      openaiApiKey: env.OPENAI_API_KEY,
      togetherApiKey: env.TOGETHER_API_KEY,
      requestTimeoutMs: parseInt(env.AI_REQUEST_TIMEOUT_MS, 120000),
      maxRetries: parseInt(env.AI_MAX_RETRIES, 3),
      retryBackoffMs: parseInt(env.AI_RETRY_BACKOFF_MS, 1000),
    },
    
    debugLogging: parseBoolean(env.AI_DEBUG_LOGGING, false),
    environment: (env.NODE_ENV as 'development' | 'staging' | 'production') || 'development',
  };
}

/**
 * Validate configuration
 */
export function validateConfig(config: AIRouterFullConfig): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Check for API key
  if (!config.provider.anthropicApiKey && !config.provider.openaiApiKey && !config.provider.togetherApiKey) {
    errors.push('At least one AI provider API key must be configured');
  }

  // Validate refinement settings
  if (config.autoRefine.maxAttempts < 1) {
    errors.push('MAX_REFINE_ATTEMPTS must be at least 1');
  }
  if (config.autoRefine.escalationThreshold < 1) {
    errors.push('REFINEMENT_ESCALATION_THRESHOLD must be at least 1');
  }
  if (config.autoRefine.escalationThreshold > config.autoRefine.maxAttempts) {
    errors.push('REFINEMENT_ESCALATION_THRESHOLD cannot exceed MAX_REFINE_ATTEMPTS');
  }

  // Validate quality gate settings
  if (config.qualityGate.maxEscalations < 0) {
    errors.push('MAX_ESCALATIONS cannot be negative');
  }
  if (config.autoRefine.minScoreThreshold < 0 || config.autoRefine.minScoreThreshold > 1) {
    errors.push('MIN_QUALITY_SCORE_THRESHOLD must be between 0 and 1');
  }

  // Validate word bounds
  if (config.qualityGate.defaultWordBounds.min > config.qualityGate.defaultWordBounds.max) {
    errors.push('DEFAULT_MIN_WORDS cannot exceed DEFAULT_MAX_WORDS');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Singleton configuration instance
 */
let configInstance: AIRouterFullConfig | null = null;

/**
 * Get the current configuration (creates if not exists)
 */
export function getConfig(): AIRouterFullConfig {
  if (!configInstance) {
    configInstance = loadConfig();
  }
  return configInstance;
}

/**
 * Reset configuration (for testing)
 */
export function resetConfig(): void {
  configInstance = null;
}

/**
 * Update configuration at runtime (partial updates)
 */
export function updateConfig(updates: Partial<AIRouterFullConfig>): AIRouterFullConfig {
  const current = getConfig();
  configInstance = {
    ...current,
    ...updates,
    autoRefine: {
      ...current.autoRefine,
      ...(updates.autoRefine || {}),
    },
    qualityGate: {
      ...current.qualityGate,
      ...(updates.qualityGate || {}),
    },
    provider: {
      ...current.provider,
      ...(updates.provider || {}),
    },
  };
  return configInstance;
}

/**
 * Check if auto-refinement is enabled
 */
export function isAutoRefineEnabled(): boolean {
  return getConfig().autoRefine.enabled;
}

/**
 * Check if a task type requires narrative quality checks
 */
export function isNarrativeTask(taskType: string): boolean {
  return getConfig().qualityGate.narrativeTaskTypes.includes(taskType);
}

/**
 * Get effective quality check options for a task
 */
export function getQualityCheckOptions(taskType: string): {
  minCitations: number;
  minWords: number;
  maxWords: number;
  checkPlaceholders: boolean;
  strictMode: boolean;
} {
  const config = getConfig();
  const isNarrative = isNarrativeTask(taskType);

  return {
    minCitations: isNarrative ? config.qualityGate.defaultMinCitations : 0,
    minWords: isNarrative ? config.qualityGate.defaultWordBounds.min : 10,
    maxWords: isNarrative ? config.qualityGate.defaultWordBounds.max : 50000,
    checkPlaceholders: true,
    strictMode: config.autoRefine.strictMode,
  };
}

/**
 * Configuration summary for logging (no secrets)
 */
export function getConfigSummary(): Record<string, unknown> {
  const config = getConfig();
  return {
    defaultTier: config.defaultTier,
    environment: config.environment,
    autoRefine: {
      enabled: config.autoRefine.enabled,
      maxAttempts: config.autoRefine.maxAttempts,
      escalationThreshold: config.autoRefine.escalationThreshold,
      strictMode: config.autoRefine.strictMode,
    },
    qualityGate: {
      enabled: config.qualityGate.enabled,
      escalationEnabled: config.qualityGate.escalationEnabled,
      maxEscalations: config.qualityGate.maxEscalations,
    },
    provider: {
      hasAnthropicKey: !!config.provider.anthropicApiKey,
      hasOpenaiKey: !!config.provider.openaiApiKey,
      hasTogetherKey: !!config.provider.togetherApiKey,
      timeoutMs: config.provider.requestTimeoutMs,
    },
  };
}
