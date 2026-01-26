/**
 * Lifecycle State Management Service
 *
 * Manages session-based lifecycle states for research workflows.
 * Tracks AI approvals, completed stages, and audit logs.
 *
 * Extracted from monolithic routes.ts for better modularity.
 *
 * @module services/lifecycleService
 */

import { z } from 'zod';

// Lifecycle states matching ros-backend/src/governance/lifecycle_states.py
export const LifecycleStateSchema = z.enum([
  'DRAFT',
  'SPEC_DEFINED',
  'EXTRACTION_COMPLETE',
  'QA_PASSED',
  'QA_FAILED',
  'LINKED',
  'ANALYSIS_READY',
  'IN_ANALYSIS',
  'ANALYSIS_COMPLETE',
  'FROZEN',
  'ARCHIVED'
]);

export type LifecycleState = z.infer<typeof LifecycleStateSchema>;

// AI-enabled stages matching client/src/lib/governance.ts
export const AI_ENABLED_STAGES = [2, 3, 4, 5, 9, 10, 11, 13, 14, 15, 16] as const;

// Stages requiring attestation gates before execution
export const ATTESTATION_REQUIRED_STAGES = [5, 9, 10, 11, 13, 14, 15] as const;

// Valid state transitions (explicit enforcement)
export const VALID_TRANSITIONS: Record<LifecycleState, LifecycleState[]> = {
  'DRAFT': ['SPEC_DEFINED'],
  'SPEC_DEFINED': ['EXTRACTION_COMPLETE'],
  'EXTRACTION_COMPLETE': ['QA_PASSED', 'QA_FAILED'],
  'QA_PASSED': ['ANALYSIS_READY'],
  'QA_FAILED': ['EXTRACTION_COMPLETE'],
  'LINKED': ['ANALYSIS_READY'],
  'ANALYSIS_READY': ['IN_ANALYSIS'],
  'IN_ANALYSIS': ['ANALYSIS_COMPLETE'],
  'ANALYSIS_COMPLETE': ['FROZEN', 'IN_ANALYSIS'],
  'FROZEN': ['ARCHIVED'],
  'ARCHIVED': []
};

// Audit log entry schema
export const AuditLogEntrySchema = z.object({
  timestamp: z.string(),
  action: z.string(),
  stageId: z.number().optional(),
  stageName: z.string().optional(),
  details: z.string().optional(),
  userId: z.string().optional(),
  metadata: z.record(z.unknown()).optional()
});

export type AuditLogEntry = z.infer<typeof AuditLogEntrySchema>;

// Session state interface
export interface SessionState {
  currentLifecycleState: LifecycleState;
  approvedAIStages: Set<number>;
  completedStages: Set<number>;
  attestedGates: Set<number>;
  auditLog: AuditLogEntry[];
  createdAt: string;
  updatedAt: string;
}

// In-memory session state storage
// In production, this would use database or Redis
const sessionStates = new Map<string, SessionState>();

/**
 * Get or create session state
 */
export function getSessionState(sessionId: string): SessionState {
  if (!sessionStates.has(sessionId)) {
    const now = new Date().toISOString();
    sessionStates.set(sessionId, {
      currentLifecycleState: 'DRAFT',
      approvedAIStages: new Set(),
      completedStages: new Set(),
      attestedGates: new Set(),
      auditLog: [],
      createdAt: now,
      updatedAt: now
    });
  }
  return sessionStates.get(sessionId)!;
}

/**
 * Get session ID from request
 */
export function getSessionId(req: any): string {
  // Use session ID from express-session if available, otherwise use a default
  return req.session?.id || req.headers['x-session-id'] || 'demo-session';
}

/**
 * Map stage ID to lifecycle state
 */
export function mapStageToLifecycleState(stageId: number): LifecycleState {
  if (stageId === 1) return 'DRAFT';
  if (stageId === 2 || stageId === 3) return 'SPEC_DEFINED';
  if (stageId === 4) return 'EXTRACTION_COMPLETE';
  if (stageId >= 5 && stageId <= 8) return 'QA_PASSED';
  if (stageId >= 9 && stageId <= 12) return 'ANALYSIS_READY';
  if (stageId === 13) return 'IN_ANALYSIS';
  if (stageId === 14) return 'ANALYSIS_COMPLETE';
  if (stageId >= 15 && stageId <= 20) return 'FROZEN';
  return 'ARCHIVED';
}

/**
 * Check if stage is AI-enabled
 */
export function isAIEnabledStage(stageId: number): boolean {
  return (AI_ENABLED_STAGES as readonly number[]).includes(stageId);
}

/**
 * Check if stage requires attestation
 */
export function requiresAttestation(stageId: number): boolean {
  return (ATTESTATION_REQUIRED_STAGES as readonly number[]).includes(stageId);
}

/**
 * Validate state transition
 */
export function isValidTransition(from: LifecycleState, to: LifecycleState): boolean {
  return VALID_TRANSITIONS[from].includes(to);
}

/**
 * Transition to new state
 */
export function transitionState(
  sessionId: string,
  newState: LifecycleState,
  userId?: string,
  details?: string
): { success: boolean; error?: string } {
  const state = getSessionState(sessionId);
  const currentState = state.currentLifecycleState;

  if (!isValidTransition(currentState, newState)) {
    return {
      success: false,
      error: `Invalid transition from ${currentState} to ${newState}`
    };
  }

  state.currentLifecycleState = newState;
  state.updatedAt = new Date().toISOString();

  // Log the transition
  addAuditLogEntry(sessionId, {
    timestamp: state.updatedAt,
    action: 'STATE_TRANSITION',
    details: `${currentState} -> ${newState}${details ? `: ${details}` : ''}`,
    userId
  });

  return { success: true };
}

/**
 * Approve AI usage for a stage
 */
export function approveAIStage(
  sessionId: string,
  stageId: number,
  stageName: string,
  userId?: string
): { success: boolean; error?: string } {
  if (!isAIEnabledStage(stageId)) {
    return {
      success: false,
      error: `Stage ${stageId} is not AI-enabled`
    };
  }

  const state = getSessionState(sessionId);
  state.approvedAIStages.add(stageId);
  state.updatedAt = new Date().toISOString();

  addAuditLogEntry(sessionId, {
    timestamp: state.updatedAt,
    action: 'AI_STAGE_APPROVED',
    stageId,
    stageName,
    userId
  });

  return { success: true };
}

/**
 * Revoke AI approval for a stage
 */
export function revokeAIStage(
  sessionId: string,
  stageId: number,
  stageName: string,
  userId?: string
): { success: boolean } {
  const state = getSessionState(sessionId);
  state.approvedAIStages.delete(stageId);
  state.updatedAt = new Date().toISOString();

  addAuditLogEntry(sessionId, {
    timestamp: state.updatedAt,
    action: 'AI_STAGE_REVOKED',
    stageId,
    stageName,
    userId
  });

  return { success: true };
}

/**
 * Check if AI is approved for a stage
 */
export function isAIApproved(sessionId: string, stageId: number): boolean {
  const state = getSessionState(sessionId);
  return state.approvedAIStages.has(stageId);
}

/**
 * Mark stage as completed
 */
export function completeStage(
  sessionId: string,
  stageId: number,
  stageName: string,
  userId?: string,
  metadata?: Record<string, unknown>
): { success: boolean } {
  const state = getSessionState(sessionId);
  state.completedStages.add(stageId);
  state.updatedAt = new Date().toISOString();

  addAuditLogEntry(sessionId, {
    timestamp: state.updatedAt,
    action: 'STAGE_COMPLETED',
    stageId,
    stageName,
    userId,
    metadata
  });

  return { success: true };
}

/**
 * Attest to a gate (pre-execution checkpoint)
 */
export function attestGate(
  sessionId: string,
  stageId: number,
  stageName: string,
  userId?: string,
  attestationText?: string
): { success: boolean; error?: string } {
  if (!requiresAttestation(stageId)) {
    return {
      success: false,
      error: `Stage ${stageId} does not require attestation`
    };
  }

  const state = getSessionState(sessionId);
  state.attestedGates.add(stageId);
  state.updatedAt = new Date().toISOString();

  addAuditLogEntry(sessionId, {
    timestamp: state.updatedAt,
    action: 'GATE_ATTESTED',
    stageId,
    stageName,
    details: attestationText,
    userId
  });

  return { success: true };
}

/**
 * Check if gate is attested
 */
export function isGateAttested(sessionId: string, stageId: number): boolean {
  const state = getSessionState(sessionId);
  return state.attestedGates.has(stageId);
}

/**
 * Add audit log entry
 */
export function addAuditLogEntry(sessionId: string, entry: AuditLogEntry): void {
  const state = getSessionState(sessionId);
  state.auditLog.push(entry);
}

/**
 * Get audit log for session
 */
export function getAuditLog(sessionId: string): AuditLogEntry[] {
  const state = getSessionState(sessionId);
  return [...state.auditLog];
}

/**
 * Get session summary
 */
export function getSessionSummary(sessionId: string): {
  sessionId: string;
  currentState: LifecycleState;
  approvedAIStages: number[];
  completedStages: number[];
  attestedGates: number[];
  auditLogCount: number;
  createdAt: string;
  updatedAt: string;
} {
  const state = getSessionState(sessionId);
  return {
    sessionId,
    currentState: state.currentLifecycleState,
    approvedAIStages: Array.from(state.approvedAIStages),
    completedStages: Array.from(state.completedStages),
    attestedGates: Array.from(state.attestedGates),
    auditLogCount: state.auditLog.length,
    createdAt: state.createdAt,
    updatedAt: state.updatedAt
  };
}

/**
 * Reset session state (for testing/demo)
 */
export function resetSession(sessionId: string): void {
  sessionStates.delete(sessionId);
}

/**
 * Express middleware for attaching lifecycle state to request
 */
export function lifecycleStateMiddleware(req: any, res: any, next: any): void {
  const sessionId = getSessionId(req);
  const state = getSessionState(sessionId);

  // Attach state to request for route handlers
  req.lifecycleState = state;
  req.sessionId = sessionId;

  next();
}

// Export the service as a singleton
export const lifecycleService = {
  getSessionState,
  getSessionId,
  mapStageToLifecycleState,
  isAIEnabledStage,
  requiresAttestation,
  isValidTransition,
  transitionState,
  approveAIStage,
  revokeAIStage,
  isAIApproved,
  completeStage,
  attestGate,
  isGateAttested,
  addAuditLogEntry,
  getAuditLog,
  getSessionSummary,
  resetSession,
  lifecycleStateMiddleware,
  AI_ENABLED_STAGES,
  ATTESTATION_REQUIRED_STAGES,
  VALID_TRANSITIONS
};

export default lifecycleService;
