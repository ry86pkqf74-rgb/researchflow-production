/**
 * Centralized Policy Decision Engine
 * All authorization decisions flow through this engine
 * 
 * @module @researchflow/core/policy
 */

import type { 
  PolicyEngine, 
  PolicyContext, 
  PolicyDecision, 
  UserRole,
  GovernanceMode 
} from '../types/policy';
import { 
  ROLE_PERMISSIONS, 
  DEMO_ALLOWED_ACTIONS, 
  DEMO_BLOCKED_RESOURCES,
  HIGH_RISK_ACTIONS 
} from '../types/policy';

/**
 * Check if an action is allowed in DEMO mode
 */
function isDemoAllowed(action: string, resource: string): boolean {
  // Block access to sensitive resources
  if (DEMO_BLOCKED_RESOURCES.some(r => resource.toLowerCase().includes(r))) {
    return false;
  }
  // Only allow read-only actions
  return DEMO_ALLOWED_ACTIONS.includes(action.toLowerCase());
}

/**
 * Check if a role has permission for an action in IDENTIFIED mode
 */
function isIdentifiedAllowed(role: UserRole, action: string, _resource: string): boolean {
  const allowed = ROLE_PERMISSIONS[role] || [];
  return allowed.includes('*') || allowed.includes(action.toLowerCase());
}

/**
 * Check if a role has permission for an action in PRODUCTION mode
 * Uses same role matrix as IDENTIFIED but with additional audit requirements
 */
function isProductionAllowed(role: UserRole, action: string, resource: string): boolean {
  return isIdentifiedAllowed(role, action, resource);
}

/**
 * Check if an action is high-risk and requires additional verification
 */
function isHighRiskAction(action: string): boolean {
  return HIGH_RISK_ACTIONS.includes(action.toLowerCase());
}

/**
 * Create a new Policy Decision Engine instance
 * 
 * @example
 * ```typescript
 * const engine = createPolicyEngine();
 * 
 * const decision = engine.evaluate({
 *   mode: 'IDENTIFIED',
 *   role: 'ANALYST',
 *   action: 'view',
 *   resource: 'workflow'
 * });
 * 
 * if (decision.allowed) {
 *   // Proceed with action
 * }
 * ```
 */
export function createPolicyEngine(): PolicyEngine {
  return {
    /**
     * Evaluate a policy context and return a decision
     */
    evaluate(context: PolicyContext): PolicyDecision {
      const { mode, role, action, resource } = context;
      
      // DEMO mode: Most restrictive - no auth, no real data
      if (mode === 'DEMO') {
        return {
          allowed: isDemoAllowed(action, resource),
          reason: 'DEMO mode restrictions apply',
          auditRequired: false,
        };
      }
      
      // IDENTIFIED mode: Role-based access with audit
      if (mode === 'IDENTIFIED') {
        const allowed = isIdentifiedAllowed(role, action, resource);
        return {
          allowed,
          reason: allowed ? 'Role permits action' : `Role ${role} cannot ${action} on ${resource}`,
          auditRequired: true,
        };
      }
      
      // PRODUCTION mode: Full access with strict audit and MFA for high-risk
      if (mode === 'PRODUCTION') {
        const allowed = isProductionAllowed(role, action, resource);
        return {
          allowed,
          reason: allowed ? 'Production access granted' : 'Insufficient permissions',
          auditRequired: true,
          requiresMfa: isHighRiskAction(action),
        };
      }
      
      // Unknown mode - fail closed
      return { 
        allowed: false, 
        reason: 'Unknown governance mode', 
        auditRequired: true 
      };
    },
    
    /**
     * Check if the context allows PHI (Protected Health Information) access
     * PHI access requires IDENTIFIED or PRODUCTION mode and appropriate role
     */
    canAccessPhi(context: PolicyContext): boolean {
      if (context.mode === 'DEMO') return false;
      return ['ANALYST', 'STEWARD', 'ADMIN'].includes(context.role);
    },
    
    /**
     * Check if the context allows PHI reveal (unmasking)
     * PHI reveal is more restricted than PHI access
     */
    canRevealPhi(context: PolicyContext): boolean {
      if (context.mode === 'DEMO') return false;
      if (context.mode === 'IDENTIFIED') {
        // In IDENTIFIED mode, only STEWARD and ADMIN can reveal
        return ['STEWARD', 'ADMIN'].includes(context.role);
      }
      // In PRODUCTION mode, ANALYST can also reveal
      return ['ANALYST', 'STEWARD', 'ADMIN'].includes(context.role);
    },
    
    /**
     * Check if the context allows data export
     * Export is restricted to STEWARD and ADMIN roles
     */
    canExportData(context: PolicyContext): boolean {
      if (context.mode === 'DEMO') return false;
      return ['STEWARD', 'ADMIN'].includes(context.role);
    },
    
    /**
     * Check if the context allows workflow modification
     * Only STEWARD and ADMIN can modify workflows
     */
    canModifyWorkflow(context: PolicyContext): boolean {
      return ['STEWARD', 'ADMIN'].includes(context.role);
    },
  };
}

/**
 * Default policy engine instance for convenience
 */
export const policyEngine = createPolicyEngine();
