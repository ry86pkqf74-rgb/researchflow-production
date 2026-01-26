/**
 * Policy Decision Engine Types
 * Centralizes all authorization decisions for ResearchFlow Canvas
 */

/**
 * Governance modes - extends existing AppMode concept with IDENTIFIED
 */
export type GovernanceMode = 'DEMO' | 'IDENTIFIED' | 'PRODUCTION';

/**
 * User roles with hierarchical permissions
 */
export type UserRole = 'VIEWER' | 'ANALYST' | 'STEWARD' | 'ADMIN';

/**
 * Context for making policy decisions
 */
export interface PolicyContext {
  /** Current governance mode */
  mode: GovernanceMode;
  /** User's role in the system */
  role: UserRole;
  /** Action being requested (e.g., 'view', 'export', 'reveal_phi') */
  action: string;
  /** Resource being accessed (e.g., 'workflow', 'phi', 'audit') */
  resource: string;
  /** Optional user identifier for audit */
  userId?: string;
  /** Optional session identifier for tracking */
  sessionId?: string;
  /** Additional context metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Result of a policy evaluation
 */
export interface PolicyDecision {
  /** Whether the action is allowed */
  allowed: boolean;
  /** Human-readable reason for the decision */
  reason: string;
  /** Whether this action requires audit logging */
  auditRequired: boolean;
  /** Whether MFA is required for this action */
  requiresMfa?: boolean;
  /** Additional conditions that must be met */
  conditions?: string[];
}

/**
 * Policy Engine interface - all authorization flows through this
 */
export interface PolicyEngine {
  /** Evaluate a policy context and return a decision */
  evaluate(context: PolicyContext): PolicyDecision;
  /** Check if context allows PHI access */
  canAccessPhi(context: PolicyContext): boolean;
  /** Check if context allows PHI reveal (unmasking) */
  canRevealPhi(context: PolicyContext): boolean;
  /** Check if context allows data export */
  canExportData(context: PolicyContext): boolean;
  /** Check if context allows workflow modification */
  canModifyWorkflow(context: PolicyContext): boolean;
}

/**
 * Permission definitions for each role
 */
export const ROLE_PERMISSIONS: Record<UserRole, string[]> = {
  VIEWER: ['view', 'list'],
  ANALYST: ['view', 'list', 'search', 'analyze', 'access_phi'],
  STEWARD: ['view', 'list', 'search', 'analyze', 'access_phi', 'reveal_phi', 'export', 'modify'],
  ADMIN: ['*'],
};

/**
 * Actions allowed in DEMO mode
 */
export const DEMO_ALLOWED_ACTIONS = ['view', 'list', 'search'];

/**
 * Resources blocked in DEMO mode
 */
export const DEMO_BLOCKED_RESOURCES = ['phi', 'export', 'audit'];

/**
 * High-risk actions that require MFA in PRODUCTION mode
 */
export const HIGH_RISK_ACTIONS = ['export', 'delete', 'reveal_phi', 'modify_permissions'];
