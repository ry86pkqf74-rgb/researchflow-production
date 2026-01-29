/**
 * ResearchFlow Insight Event Types
 * Phase 6: Observability & Transparency
 * 
 * These types define the event contracts for the InsightsBus system.
 * All events are designed to be PHI-safe (no raw patient data).
 */

import { z } from 'zod';

// Import base types from schema (these are exported via schema.ts in index.ts)
import {
  INSIGHT_CATEGORIES,
  INSIGHT_SOURCES,
  INSIGHT_SEVERITIES,
  type InsightCategory,
  type InsightSource,
  type InsightSeverity,
} from './schema';

// Note: INSIGHT_* constants are NOT re-exported here to avoid duplicate exports
// Consumers should import them from the main package or from './schema'

// =====================
// BASE EVENT SCHEMA
// =====================

export const BaseInsightEventSchema = z.object({
  id: z.string().uuid(),
  timestamp: z.string().datetime(),
  category: z.enum(INSIGHT_CATEGORIES),
  source: z.enum(INSIGHT_SOURCES),
  eventType: z.string().min(1).max(100),
  severity: z.enum(INSIGHT_SEVERITIES).default('info'),
  
  // Context identifiers (all optional)
  runId: z.string().optional(),
  researchId: z.string().optional(),
  userId: z.string().optional(),
  sessionId: z.string().optional(),
  
  // Tracing support
  traceId: z.string().max(64).optional(),
  spanId: z.string().max(32).optional(),
  parentSpanId: z.string().max(32).optional(),
  
  // Metadata
  durationMs: z.number().int().nonnegative().optional(),
  metadata: z.record(z.unknown()).default({}),
});

export type BaseInsightEvent = z.infer<typeof BaseInsightEventSchema>;

// =====================
// AI INVOCATION EVENT
// Tracks AI model calls with full context
// =====================

export const AIInvocationEventSchema = BaseInsightEventSchema.extend({
  category: z.literal('trace'),
  eventType: z.literal('ai.invocation'),
  payload: z.object({
    provider: z.string(),
    model: z.string(),
    taskType: z.string(),
    workflowStage: z.number().int().optional(),
    
    // Token metrics (no content)
    promptTokenCount: z.number().int().nonnegative(),
    responseTokenCount: z.number().int().nonnegative(),
    
    // Hashes for verification (no content)
    promptHash: z.string(),
    responseHash: z.string(),
    
    // Tier escalation
    initialTier: z.string(),
    finalTier: z.string(),
    escalated: z.boolean().default(false),
    escalationReason: z.string().optional(),
    
    // Quality gates
    qualityGatePassed: z.boolean(),
    phiScanPassed: z.boolean(),
    
    // Cost tracking
    estimatedCostUsd: z.string().optional(),
    
    // Status
    status: z.enum(['success', 'failed', 'blocked', 'timeout']),
    errorMessage: z.string().optional(),
  }),
});

export type AIInvocationEvent = z.infer<typeof AIInvocationEventSchema>;

// =====================
// STAGE TRANSITION EVENT
// Tracks workflow stage changes
// =====================

export const StageTransitionEventSchema = BaseInsightEventSchema.extend({
  category: z.literal('trace'),
  eventType: z.literal('workflow.stage_transition'),
  payload: z.object({
    fromStage: z.number().int().nonnegative(),
    toStage: z.number().int().nonnegative(),
    fromStageName: z.string(),
    toStageName: z.string(),
    transitionType: z.enum(['manual', 'automatic', 'rollback', 'skip']),
    
    // Governance context
    governanceMode: z.enum(['DEMO', 'LIVE']),
    approvalRequired: z.boolean(),
    approvalId: z.string().optional(),
    
    // Timing
    stageDurationMs: z.number().int().nonnegative().optional(),
    
    // Artifacts produced (IDs only)
    artifactsProduced: z.array(z.string()).default([]),
  }),
});

export type StageTransitionEvent = z.infer<typeof StageTransitionEventSchema>;

// =====================
// DATA ACCESS EVENT
// PHI/data access audit logs
// =====================

export const DataAccessEventSchema = BaseInsightEventSchema.extend({
  category: z.literal('audit'),
  eventType: z.literal('data.access'),
  payload: z.object({
    accessType: z.enum(['read', 'write', 'delete', 'export', 'share']),
    resourceType: z.enum(['dataset', 'artifact', 'manuscript', 'analysis', 'phi_data']),
    resourceId: z.string(),
    
    // Classification
    dataClassification: z.enum(['SYNTHETIC', 'DEIDENTIFIED', 'IDENTIFIED', 'UNKNOWN']),
    phiRiskLevel: z.enum(['none', 'low', 'medium', 'high']).optional(),
    
    // Governance
    governanceMode: z.enum(['DEMO', 'LIVE']),
    approvalRequired: z.boolean(),
    approvalId: z.string().optional(),
    
    // Access context
    accessReason: z.string().optional(),
    ipAddress: z.string().optional(),
    userAgent: z.string().optional(),
    
    // Result
    accessGranted: z.boolean(),
    denyReason: z.string().optional(),
  }),
});

export type DataAccessEvent = z.infer<typeof DataAccessEventSchema>;

// =====================
// PERFORMANCE METRIC EVENT
// Timing and performance metrics
// =====================

export const PerformanceMetricEventSchema = BaseInsightEventSchema.extend({
  category: z.literal('metric'),
  eventType: z.literal('performance.metric'),
  payload: z.object({
    metricName: z.string(),
    metricType: z.enum(['counter', 'gauge', 'histogram', 'timing']),
    value: z.number(),
    unit: z.string().optional(),
    
    // Dimensions for grouping
    dimensions: z.record(z.string()).default({}),
    
    // Aggregation hints
    aggregation: z.enum(['sum', 'avg', 'min', 'max', 'p50', 'p95', 'p99']).optional(),
    
    // Thresholds
    warningThreshold: z.number().optional(),
    criticalThreshold: z.number().optional(),
    thresholdBreached: z.boolean().default(false),
  }),
});

export type PerformanceMetricEvent = z.infer<typeof PerformanceMetricEventSchema>;

// =====================
// USER ACTION EVENT
// User interaction tracking
// =====================

export const UserActionEventSchema = BaseInsightEventSchema.extend({
  category: z.literal('trace'),
  eventType: z.literal('user.action'),
  payload: z.object({
    actionType: z.string(), // e.g., 'button_click', 'form_submit', 'navigation'
    actionTarget: z.string(), // e.g., 'approve_button', 'export_form'
    
    // UI context
    pageRoute: z.string().optional(),
    componentName: z.string().optional(),
    
    // Result
    actionResult: z.enum(['success', 'failure', 'cancelled', 'pending']),
    errorCode: z.string().optional(),
    
    // Feature flag context
    experimentVariant: z.string().optional(),
    featureFlags: z.array(z.string()).default([]),
  }),
});

export type UserActionEvent = z.infer<typeof UserActionEventSchema>;

// =====================
// SYSTEM ALERT EVENT
// System-level alerts and notifications
// =====================

export const SystemAlertEventSchema = BaseInsightEventSchema.extend({
  category: z.literal('alert'),
  eventType: z.literal('system.alert'),
  severity: z.enum(['warning', 'error', 'critical']),
  payload: z.object({
    alertName: z.string(),
    alertCode: z.string(),
    description: z.string(),
    
    // Alert context
    affectedService: z.string(),
    affectedResource: z.string().optional(),
    
    // Thresholds
    currentValue: z.number().optional(),
    thresholdValue: z.number().optional(),
    
    // Actions
    suggestedAction: z.string().optional(),
    autoRemediated: z.boolean().default(false),
    remediationResult: z.string().optional(),
    
    // Escalation
    escalationLevel: z.number().int().min(0).max(5).default(0),
    notificationsSent: z.array(z.string()).default([]),
  }),
});

export type SystemAlertEvent = z.infer<typeof SystemAlertEventSchema>;

// =====================
// GOVERNANCE EVENT
// Mode changes and policy updates
// =====================

export const GovernanceEventSchema = BaseInsightEventSchema.extend({
  category: z.literal('audit'),
  eventType: z.literal('governance.change'),
  payload: z.object({
    changeType: z.enum(['mode_switch', 'policy_update', 'flag_toggle', 'approval_decision']),
    
    // Mode changes
    previousMode: z.enum(['DEMO', 'LIVE']).optional(),
    newMode: z.enum(['DEMO', 'LIVE']).optional(),
    
    // Policy/flag changes
    policyKey: z.string().optional(),
    previousValue: z.unknown().optional(),
    newValue: z.unknown().optional(),
    
    // Approval context
    approvalId: z.string().optional(),
    approvalDecision: z.enum(['approved', 'rejected', 'escalated']).optional(),
    approverRole: z.string().optional(),
    
    // Justification
    reason: z.string().optional(),
    justification: z.string().optional(),
  }),
});

export type GovernanceEvent = z.infer<typeof GovernanceEventSchema>;

// =====================
// UNION TYPE FOR ALL EVENTS
// =====================

export const InsightEventSchema = z.discriminatedUnion('eventType', [
  AIInvocationEventSchema,
  StageTransitionEventSchema,
  DataAccessEventSchema,
  PerformanceMetricEventSchema,
  UserActionEventSchema,
  SystemAlertEventSchema,
  GovernanceEventSchema,
]);

// Note: Named InsightEventPayload to avoid conflict with InsightEvent from schema.ts (database type)
export type InsightEventPayload = z.infer<typeof InsightEventSchema>;

// =====================
// EVENT FACTORY HELPERS
// =====================

export function createInsightEvent<T extends BaseInsightEvent>(
  event: Omit<T, 'id' | 'timestamp'>
): T {
  return {
    ...event,
    id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
  } as T;
}

// =====================
// SUBSCRIPTION FILTER TYPE
// =====================

export interface InsightSubscriptionFilter {
  categories?: InsightCategory[];
  sources?: InsightSource[];
  eventTypes?: string[];
  severities?: InsightSeverity[];
  researchIds?: string[];
  runIds?: string[];
  userIds?: string[];
}

// =====================
// ALERT CONFIGURATION TYPE
// =====================

export interface InsightAlertConfig {
  id: string;
  name: string;
  description?: string;
  category: InsightCategory;
  eventType?: string;
  condition: {
    field: string;
    operator: 'gt' | 'gte' | 'lt' | 'lte' | 'eq' | 'neq' | 'contains' | 'matches';
    value: string | number | boolean;
  };
  threshold?: {
    count: number;
    windowSeconds: number;
  };
  actions: Array<{
    type: 'email' | 'slack' | 'webhook' | 'pagerduty' | 'in_app';
    config: Record<string, unknown>;
  }>;
  cooldownSeconds: number;
  enabled: boolean;
}

// =====================
// EXPORT ALL (types only - schemas already exported inline)
// =====================

// Type exports are handled by the inline type definitions
// Schema exports are handled by the inline const exports
