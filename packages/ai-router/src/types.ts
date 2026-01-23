/**
 * AI Router Type Definitions
 *
 * Defines the core interfaces for multi-model AI routing with
 * cost optimization and quality gating.
 */

/**
 * Model tier classifications for cost-optimized routing
 */
export type ModelTier = 'NANO' | 'MINI' | 'FRONTIER';

/**
 * AI task types that determine model tier selection
 */
export type AITaskType =
  // NANO tier tasks (simple, fast, cheap)
  | 'classify'
  | 'extract_metadata'
  | 'policy_check'
  | 'phi_scan'
  | 'format_validate'
  // MINI tier tasks (moderate complexity)
  | 'summarize'
  | 'draft_section'
  | 'template_fill'
  | 'abstract_generate'
  // FRONTIER tier tasks (complex reasoning)
  | 'protocol_reasoning'
  | 'complex_synthesis'
  | 'final_manuscript_pass';

/**
 * Supported AI providers
 */
export type AIProvider = 'anthropic' | 'openai' | 'together';

/**
 * Model configuration for a specific tier
 */
export interface ModelConfig {
  provider: AIProvider;
  model: string;
  maxTokens: number;
  temperature: number;
  costPerMToken: {
    input: number;
    output: number;
  };
}

/**
 * AI Router configuration
 */
export interface AIRouterConfig {
  defaultTier: ModelTier;
  escalationEnabled: boolean;
  maxEscalations: number;
  anthropicApiKey?: string;
  openaiApiKey?: string;
  togetherApiKey?: string;
}

/**
 * Request to the AI router
 */
export interface AIRouterRequest {
  taskType: AITaskType;
  prompt: string;
  systemPrompt?: string;
  context?: Record<string, unknown>;
  maxTokens?: number;
  temperature?: number;
  responseFormat?: 'text' | 'json';
  /** Override the tier selection */
  forceTier?: ModelTier;
  /** Metadata for tracking */
  metadata?: {
    userId?: string;
    researchId?: string;
    stageId?: number;
    workflowStep?: string;
    sessionId?: string;
  };
}

/**
 * Response from the AI router
 */
export interface AIRouterResponse {
  content: string;
  /** Parsed JSON if responseFormat was 'json' */
  parsed?: Record<string, unknown>;
  /** Model routing information */
  routing: {
    initialTier: ModelTier;
    finalTier: ModelTier;
    escalated: boolean;
    escalationReason?: string;
    provider: AIProvider;
    model: string;
  };
  /** Token usage and cost */
  usage: {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
    estimatedCostUsd: number;
  };
  /** Quality gate results */
  qualityGate: {
    passed: boolean;
    checks: QualityCheck[];
  };
  /** Performance metrics */
  metrics: {
    latencyMs: number;
    queueTimeMs?: number;
    processingTimeMs?: number;
  };
}

/**
 * Quality check result
 * 
 * Phase 7 Enhancement: Added category and score fields for AI self-improvement loop
 */
export interface QualityCheck {
  name: string;
  passed: boolean;
  reason?: string;
  severity: 'error' | 'warning' | 'info';
  /** Category for grouping checks (Phase 7) */
  category?: 'citations' | 'coverage' | 'length' | 'confidence' | 'completeness' | 'structure' | 'format';
  /** Numeric score 0.0-1.0 for gradual feedback (Phase 7) */
  score?: number;
  /** Detailed check results (Phase 7) */
  details?: {
    expected?: unknown;
    actual?: unknown;
    missing?: string[];
    found?: string[];
  };
}

/**
 * PHI scan result for AI content
 */
export interface AIPhiScanResult {
  passed: boolean;
  findingsCount: number;
  riskLevel: 'none' | 'low' | 'medium' | 'high';
  redactedContent?: string;
  findings: Array<{
    type: string;
    startIndex: number;
    endIndex: number;
  }>;
}

/**
 * Escalation decision from quality gate
 */
export interface EscalationDecision {
  shouldEscalate: boolean;
  reason?: string;
  targetTier?: ModelTier;
}

/**
 * Task type to tier mapping configuration
 */
export const TASK_TIER_MAPPING: Record<AITaskType, ModelTier> = {
  // NANO tier tasks
  classify: 'NANO',
  extract_metadata: 'NANO',
  policy_check: 'NANO',
  phi_scan: 'NANO',
  format_validate: 'NANO',
  // MINI tier tasks
  summarize: 'MINI',
  draft_section: 'MINI',
  template_fill: 'MINI',
  abstract_generate: 'MINI',
  // FRONTIER tier tasks
  protocol_reasoning: 'FRONTIER',
  complex_synthesis: 'FRONTIER',
  final_manuscript_pass: 'FRONTIER',
};

/**
 * Model configurations by tier
 */
export const MODEL_CONFIGS: Record<ModelTier, ModelConfig> = {
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

/**
 * Tier escalation order
 */
export const TIER_ESCALATION_ORDER: ModelTier[] = ['NANO', 'MINI', 'FRONTIER'];

/**
 * AI invocation record for audit logging
 */
export interface AIInvocationRecord {
  id?: number;
  auditEventId?: number;
  provider: AIProvider;
  model: string;
  taskType: AITaskType;
  workflowStage?: number;
  inputTokenCount: number;
  outputTokenCount: number;
  latencyMs: number;
  phiScanPassed: boolean;
  modeCheckPassed: boolean;
  status: 'SUCCESS' | 'FAILED' | 'BLOCKED' | 'TIMEOUT';
  initialTier: ModelTier;
  finalTier: ModelTier;
  escalated: boolean;
  escalationReason?: string;
  qualityGatePassed: boolean;
  estimatedCostUsd: number;
  createdAt?: Date;
}

/**
 * Prompt cache key components
 */
export interface PromptCacheKey {
  tenantId?: string;
  stageId?: number;
  policyVersion?: string;
  promptName: string;
}

/**
 * Prompt cache entry
 */
export interface PromptCacheEntry {
  key: string;
  staticPrefix: string;
  dynamicSuffix?: string;
  hitCount: number;
  missCount: number;
  estimatedSavingsUsd: number;
  lastAccessedAt: Date;
}
