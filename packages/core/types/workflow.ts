/**
 * Workflow Definition Types
 * Defines the structure for custom workflow DAGs
 * 
 * @packageDocumentation
 */

import { z } from 'zod';

// =====================
// NODE TYPES
// =====================

export const WORKFLOW_NODE_TYPES = ['stage', 'gate', 'branch', 'parallel', 'merge'] as const;
export type WorkflowNodeType = (typeof WORKFLOW_NODE_TYPES)[number];

export const GATE_TYPES = ['ai_approval', 'phi_check', 'attestation'] as const;
export type GateType = (typeof GATE_TYPES)[number];

export const EDGE_CONDITION_KINDS = ['always', 'on_success', 'on_failure', 'expr'] as const;
export type EdgeConditionKind = (typeof EDGE_CONDITION_KINDS)[number];

// =====================
// WORKFLOW NODE
// =====================

export interface WorkflowNode {
  id: string;
  type: WorkflowNodeType;
  label: string;
  /** For 'stage' type: maps to worker stage registry (1-20) */
  stageId?: number;
  /** For 'gate' type: specifies the gate check type */
  gateType?: GateType;
  /** Stage-specific configuration */
  config?: Record<string, unknown>;
  /** Position for UI rendering */
  position?: { x: number; y: number };
}

// =====================
// WORKFLOW EDGE
// =====================

export interface EdgeCondition {
  kind: EdgeConditionKind;
  /** Restricted expression (no eval) - only for 'expr' kind */
  expr?: string;
}

export interface WorkflowEdge {
  id: string;
  from: string;
  to: string;
  condition?: EdgeCondition;
}

// =====================
// WORKFLOW DEFINITION
// =====================

export interface WorkflowDefinition {
  schemaVersion: '1.0';
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  entryNodeId: string;
  metadata?: Record<string, unknown>;
}

// =====================
// WORKFLOW POLICY
// =====================

export interface WorkflowPolicy {
  /** Who can edit workflow definition */
  editRoles: Array<'ADMIN' | 'STEWARD'>;
  /** Who can run workflows */
  runRoles: Array<'ADMIN' | 'STEWARD' | 'RESEARCHER'>;
  /** Stages requiring AI approval in LIVE mode */
  requiresAiApprovalStages?: number[];
  /** Stages requiring attestation in LIVE mode */
  requiresAttestationStages?: number[];
  /** Allowed governance modes for execution */
  allowedModes?: Array<'DEMO' | 'LIVE' | 'STANDBY'>;
}

// =====================
// COMPILED WORKFLOW (for execution)
// =====================

export interface CompiledStep {
  nodeId: string;
  stageId?: number;
  gateType?: string;
  dependsOn: string[];
  condition?: EdgeCondition;
  parallelGroup?: string;
}

export interface CompiledWorkflow {
  workflowId: string;
  version: number;
  steps: CompiledStep[];
  entryNodeId: string;
  metadata?: Record<string, unknown>;
}

// =====================
// WORKFLOW STATUS
// =====================

export const WORKFLOW_STATUSES = ['draft', 'published', 'archived'] as const;
export type WorkflowStatus = (typeof WORKFLOW_STATUSES)[number];

export const RUN_STATUSES = ['running', 'paused', 'completed', 'failed'] as const;
export type RunStatus = (typeof RUN_STATUSES)[number];

// =====================
// ZOD SCHEMAS (for validation)
// =====================

export const WorkflowNodeSchema = z.object({
  id: z.string().min(1),
  type: z.enum(WORKFLOW_NODE_TYPES),
  label: z.string().min(1),
  stageId: z.number().int().min(1).max(20).optional(),
  gateType: z.enum(GATE_TYPES).optional(),
  config: z.record(z.unknown()).optional(),
  position: z.object({ x: z.number(), y: z.number() }).optional(),
});

export const EdgeConditionSchema = z.object({
  kind: z.enum(EDGE_CONDITION_KINDS),
  expr: z.string().optional(),
});

export const WorkflowEdgeSchema = z.object({
  id: z.string().min(1),
  from: z.string().min(1),
  to: z.string().min(1),
  condition: EdgeConditionSchema.optional(),
});

export const WorkflowDefinitionSchema = z.object({
  schemaVersion: z.literal('1.0'),
  nodes: z.array(WorkflowNodeSchema).min(1),
  edges: z.array(WorkflowEdgeSchema),
  entryNodeId: z.string().min(1),
  metadata: z.record(z.unknown()).optional(),
});

export const WorkflowPolicySchema = z.object({
  editRoles: z.array(z.enum(['ADMIN', 'STEWARD'])),
  runRoles: z.array(z.enum(['ADMIN', 'STEWARD', 'RESEARCHER'])),
  requiresAiApprovalStages: z.array(z.number().int().min(1).max(20)).optional(),
  requiresAttestationStages: z.array(z.number().int().min(1).max(20)).optional(),
  allowedModes: z.array(z.enum(['DEMO', 'LIVE', 'STANDBY'])).optional(),
});

// =====================
// TYPE EXPORTS
// =====================

export type ValidatedWorkflowNode = z.infer<typeof WorkflowNodeSchema>;
export type ValidatedWorkflowEdge = z.infer<typeof WorkflowEdgeSchema>;
export type ValidatedWorkflowDefinition = z.infer<typeof WorkflowDefinitionSchema>;
export type ValidatedWorkflowPolicy = z.infer<typeof WorkflowPolicySchema>;
