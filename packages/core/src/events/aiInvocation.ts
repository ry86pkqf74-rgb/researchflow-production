/**
 * AI Invocation Event Types
 * 
 * TypeScript types and Zod schemas for ai.invocation.completed events
 * emitted to the ros:insights Redis stream.
 * 
 * @module @researchflow/core/events/aiInvocation
 */

import { z } from 'zod';

// ============================================
// Enums
// ============================================

export const GovernanceMode = {
  DEMO: 'DEMO',
  LIVE: 'LIVE',
} as const;
export type GovernanceMode = (typeof GovernanceMode)[keyof typeof GovernanceMode];

export const ModelTier = {
  NANO: 'NANO',
  MINI: 'MINI',
  FRONTIER: 'FRONTIER',
} as const;
export type ModelTier = (typeof ModelTier)[keyof typeof ModelTier];

export const CallerService = {
  ORCHESTRATOR: 'orchestrator',
  WORKER: 'worker',
  WEB: 'web',
} as const;
export type CallerService = (typeof CallerService)[keyof typeof CallerService];

export const InvocationPurpose = {
  ROUTE: 'route',
  GENERATE: 'generate',
  RAG: 'rag',
  REFINE: 'refine',
  CLASSIFY: 'classify',
  EXTRACT: 'extract',
  SUMMARIZE: 'summarize',
  VALIDATE: 'validate',
} as const;
export type InvocationPurpose = (typeof InvocationPurpose)[keyof typeof InvocationPurpose];

export const InvocationStatus = {
  SUCCESS: 'SUCCESS',
  FAILED: 'FAILED',
  BLOCKED: 'BLOCKED',
  TIMEOUT: 'TIMEOUT',
  RATE_LIMITED: 'RATE_LIMITED',
} as const;
export type InvocationStatus = (typeof InvocationStatus)[keyof typeof InvocationStatus];

export const PhiScanStatus = {
  CLEAN: 'clean',
  FLAGGED: 'flagged',
  REDACTED: 'redacted',
  SKIPPED: 'skipped',
} as const;
export type PhiScanStatus = (typeof PhiScanStatus)[keyof typeof PhiScanStatus];

// ============================================
// Zod Schemas
// ============================================

export const PhiScanResultSchema = z.object({
  status: z.enum(['clean', 'flagged', 'redacted', 'skipped']),
  phi_types_detected: z.array(z.string()).optional(),
  confidence: z.number().min(0).max(1).optional(),
  redaction_count: z.number().int().min(0).optional(),
});

export const UsageMetricsSchema = z.object({
  input_tokens: z.number().int().min(0),
  output_tokens: z.number().int().min(0),
  total_tokens: z.number().int().min(0).optional(),
  cost_usd: z.number().min(0),
  latency_ms: z.number().int().min(0),
  time_to_first_token_ms: z.number().int().min(0).nullable().optional(),
});

export const ModelParametersSchema = z.object({
  temperature: z.number().min(0).max(2).optional(),
  max_tokens: z.number().int().min(1).optional(),
  top_p: z.number().min(0).max(1).optional(),
  stop_sequences: z.array(z.string()).optional(),
}).passthrough();

export const RoutingMetadataSchema = z.object({
  initial_tier: z.enum(['NANO', 'MINI', 'FRONTIER']).optional(),
  escalated: z.boolean().optional(),
  escalation_reason: z.string().nullable().optional(),
  quality_gate_passed: z.boolean().optional(),
  features: z.record(z.unknown()).optional(),
});

export const InvocationErrorSchema = z.object({
  code: z.string(),
  message: z.string(),
  retryable: z.boolean().optional(),
});

export const AIInvocationEventSchema = z.object({
  // Required fields
  invocation_id: z.string().uuid(),
  timestamp: z.string().datetime(),
  governance_mode: z.enum(['DEMO', 'LIVE']),
  project_id: z.string().uuid(),
  caller: z.enum(['orchestrator', 'worker', 'web']),
  tier: z.enum(['NANO', 'MINI', 'FRONTIER']),
  provider: z.string(),
  model: z.string(),

  // Optional workflow context
  run_id: z.string().uuid().nullable().optional(),
  stage: z.number().int().min(1).max(20).nullable().optional(),
  stage_name: z.string().nullable().optional(),

  // Purpose and content
  purpose: z.enum(['route', 'generate', 'rag', 'refine', 'classify', 'extract', 'summarize', 'validate']).optional(),
  prompt_ref: z.string().url().nullable().optional(),
  output_ref: z.string().url().nullable().optional(),
  prompt_redacted: z.string().max(500).nullable().optional(),
  output_redacted: z.string().max(500).nullable().optional(),

  // PHI scanning
  phi: z.object({
    input_scan: PhiScanResultSchema.optional(),
    output_scan: PhiScanResultSchema.optional(),
  }).optional(),

  // Usage metrics
  usage: UsageMetricsSchema.optional(),

  // Model parameters
  parameters: ModelParametersSchema.optional(),

  // Routing metadata
  routing: RoutingMetadataSchema.optional(),

  // Status and errors
  status: z.enum(['SUCCESS', 'FAILED', 'BLOCKED', 'TIMEOUT', 'RATE_LIMITED']).default('SUCCESS'),
  error: InvocationErrorSchema.nullable().optional(),

  // Categorization
  tags: z.array(z.string()).optional(),
  agent_id: z.string().nullable().optional(),

  // Multi-tenancy
  user_id: z.string().uuid().nullable().optional(),
  tenant_id: z.string().nullable().optional(),
});

// ============================================
// TypeScript Types (inferred from Zod)
// ============================================

export type PhiScanResult = z.infer<typeof PhiScanResultSchema>;
export type UsageMetrics = z.infer<typeof UsageMetricsSchema>;
export type ModelParameters = z.infer<typeof ModelParametersSchema>;
export type RoutingMetadata = z.infer<typeof RoutingMetadataSchema>;
export type InvocationError = z.infer<typeof InvocationErrorSchema>;
export type AIInvocationEvent = z.infer<typeof AIInvocationEventSchema>;

// Partial type for building events incrementally
export type PartialAIInvocationEvent = Partial<AIInvocationEvent> & {
  invocation_id: string;
  timestamp: string;
  governance_mode: GovernanceMode;
  project_id: string;
};

// Type for events stored in Redis stream
export type StreamedAIInvocationEvent = AIInvocationEvent & {
  stream_id: string; // Redis stream entry ID (e.g., "1704067200000-0")
};

// ============================================
// Type Guards
// ============================================

export function isAIInvocationEvent(value: unknown): value is AIInvocationEvent {
  return AIInvocationEventSchema.safeParse(value).success;
}

export function isSuccessfulInvocation(event: AIInvocationEvent): boolean {
  return event.status === 'SUCCESS';
}

export function isFailedInvocation(event: AIInvocationEvent): boolean {
  return event.status === 'FAILED' || event.status === 'TIMEOUT' || event.status === 'RATE_LIMITED';
}

export function isPhiFlagged(event: AIInvocationEvent): boolean {
  const inputFlagged = event.phi?.input_scan?.status === 'flagged';
  const outputFlagged = event.phi?.output_scan?.status === 'flagged';
  return inputFlagged || outputFlagged;
}

export function isEscalatedInvocation(event: AIInvocationEvent): boolean {
  return event.routing?.escalated === true;
}

export function isLiveMode(event: AIInvocationEvent): boolean {
  return event.governance_mode === 'LIVE';
}

// ============================================
// Helper Functions
// ============================================

/**
 * Creates a new AI invocation event with required fields and defaults
 */
export function createAIInvocationEvent(
  params: Omit<AIInvocationEvent, 'invocation_id' | 'timestamp' | 'status'> & {
    invocation_id?: string;
    timestamp?: string;
    status?: InvocationStatus;
  }
): AIInvocationEvent {
  return {
    invocation_id: params.invocation_id ?? crypto.randomUUID(),
    timestamp: params.timestamp ?? new Date().toISOString(),
    status: params.status ?? 'SUCCESS',
    ...params,
  };
}

/**
 * Calculates total cost from usage metrics
 */
export function calculateTotalCost(events: AIInvocationEvent[]): number {
  return events.reduce((total, event) => total + (event.usage?.cost_usd ?? 0), 0);
}

/**
 * Groups events by tier for reporting
 */
export function groupByTier(events: AIInvocationEvent[]): Record<ModelTier, AIInvocationEvent[]> {
  return events.reduce(
    (acc, event) => {
      acc[event.tier].push(event);
      return acc;
    },
    { NANO: [], MINI: [], FRONTIER: [] } as Record<ModelTier, AIInvocationEvent[]>
  );
}

/**
 * Filters events to only successful LIVE mode invocations (for compliance reports)
 */
export function getLiveAuditableEvents(events: AIInvocationEvent[]): AIInvocationEvent[] {
  return events.filter(
    (event) => event.governance_mode === 'LIVE' && event.status === 'SUCCESS'
  );
}

/**
 * Validates an event and returns validation errors if any
 */
export function validateAIInvocationEvent(event: unknown): {
  valid: boolean;
  errors?: z.ZodError;
  data?: AIInvocationEvent;
} {
  const result = AIInvocationEventSchema.safeParse(event);
  if (result.success) {
    return { valid: true, data: result.data };
  }
  return { valid: false, errors: result.error };
}

// Event type constant for Redis stream
export const AI_INVOCATION_EVENT_TYPE = 'ai.invocation.completed' as const;
