/**
 * Ethics Gate Middleware (Task 62)
 *
 * Extends governance gates with AI-specific ethics approval requirements.
 * Triggers BEFORE any AI generation job is queued or executed.
 *
 * Risk-based approval:
 * - Low risk (DEMO + no PHI): Requires user confirmation, auto-approve
 * - Medium risk (LIVE or PHI detected): Requires STEWARD approval
 * - High risk (LIVE + PHI medium/high): Requires escalated STEWARD approval
 */

import { Request, Response, NextFunction } from 'express';
import { db } from '../../db';
import { ethicsApprovals, auditLogs } from '@researchflow/core/schema';
import { eq, and, gte } from 'drizzle-orm';
import { logAction } from '../services/audit-service';
import { scanForPhi } from '../services/phi-protection';
import type { User as CoreUser } from '@researchflow/core';

// Re-use Express User augmentation from governance-gates
declare global {
  namespace Express {
    interface User extends CoreUser {}
  }
}

export interface EthicsGateOptions {
  taskType: string;
  ethicsCategory?: 'bias_review' | 'data_usage' | 'patient_impact' | 'model_safety' | 'consent_verification';
  requireConfirmation?: boolean;
  scanForPhi?: boolean;
  bypassForRoles?: string[];
}

export interface EthicsCheckResult {
  approved: boolean;
  approvalId?: string;
  reason?: string;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  requiresStewardApproval: boolean;
}

/**
 * Assess risk level based on governance mode, PHI risk, and operation type
 */
function assessRiskLevel(
  governanceMode: string,
  phiRiskLevel: string | null,
  taskType: string
): 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' {
  // Critical risk: LIVE mode with high PHI risk
  if (governanceMode === 'LIVE' && phiRiskLevel === 'HIGH') {
    return 'CRITICAL';
  }

  // High risk: LIVE mode with medium PHI risk, or high-risk task types
  const highRiskTasks = ['protocol_reasoning', 'complex_synthesis', 'manuscript_generate'];
  if (governanceMode === 'LIVE' && (phiRiskLevel === 'MEDIUM' || highRiskTasks.includes(taskType))) {
    return 'HIGH';
  }

  // Medium risk: LIVE mode or any PHI detected
  if (governanceMode === 'LIVE' || phiRiskLevel) {
    return 'MEDIUM';
  }

  // Low risk: DEMO mode with no PHI
  return 'LOW';
}

/**
 * Check for existing valid ethics approval
 */
async function checkExistingApproval(
  userId: string,
  taskType: string,
  ethicsCategory: string
): Promise<{ exists: boolean; approvalId?: string }> {
  if (!db) {
    return { exists: false };
  }

  const now = new Date();
  const [existingApproval] = await db
    .select()
    .from(ethicsApprovals)
    .where(
      and(
        eq(ethicsApprovals.requestedById, userId),
        eq(ethicsApprovals.taskType, taskType),
        eq(ethicsApprovals.ethicsCategory, ethicsCategory),
        eq(ethicsApprovals.status, 'APPROVED'),
        gte(ethicsApprovals.validUntil, now)
      )
    )
    .limit(1);

  return {
    exists: !!existingApproval,
    approvalId: existingApproval?.id
  };
}

/**
 * Create a new ethics approval request
 */
async function createEthicsApproval(
  userId: string,
  userRole: string,
  taskType: string,
  ethicsCategory: string,
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL',
  governanceMode: string,
  phiRiskLevel: string | null,
  justification?: string
): Promise<string> {
  if (!db) {
    throw new Error('Database not initialized');
  }

  // Calculate validity period based on risk level
  const validityHours = parseInt(process.env.ETHICS_APPROVAL_VALIDITY_HOURS || '24', 10);
  const validUntil = new Date();
  validUntil.setHours(validUntil.getHours() + validityHours);

  // Auto-approve for low risk
  const autoApprove = riskLevel === 'LOW';

  const [approval] = await db.insert(ethicsApprovals).values({
    taskType,
    ethicsCategory,
    riskLevel,
    requestedById: userId,
    requestedByRole: userRole,
    status: autoApprove ? 'APPROVED' : 'PENDING',
    governanceMode,
    phiRiskLevel,
    justification,
    riskAssessment: {
      governanceMode,
      phiRiskLevel,
      taskType,
      assessedAt: new Date().toISOString()
    },
    validUntil: autoApprove ? validUntil : null,
    reviewedAt: autoApprove ? new Date() : null,
    approvedById: autoApprove ? userId : null // Self-approved for low risk
  }).returning();

  return approval.id;
}

/**
 * Ethics gate middleware - requires ethics approval before AI operations
 */
export function ethicsGate(options: EthicsGateOptions) {
  return async (req: Request, res: Response, next: NextFunction) => {
    // Check if ethics gate is enabled
    if (process.env.ETHICS_GATE_ENABLED !== 'true') {
      return next();
    }

    try {
      const {
        taskType,
        ethicsCategory = 'model_safety',
        requireConfirmation = true,
        scanForPhi: enablePhiScan = true,
        bypassForRoles = []
      } = options;

      const user = req.user;

      if (!user) {
        return res.status(401).json({
          error: 'AUTHENTICATION_REQUIRED',
          message: 'Authentication required for AI operations'
        });
      }

      // Allow bypass for specified roles (e.g., ADMIN for testing)
      if (bypassForRoles.includes(user.role)) {
        await logAction({
          eventType: 'ETHICS_GATE',
          action: 'BYPASSED',
          userId: user.id,
          resourceType: 'ai_operation',
          details: {
            taskType,
            reason: 'role_bypass',
            role: user.role
          }
        });
        return next();
      }

      // Check for PHI in request
      let phiRiskLevel: string | null = null;
      if (enablePhiScan && req.body) {
        const bodyText = JSON.stringify(req.body);
        const phiResult = scanForPhi(bodyText);
        if (phiResult.detected) {
          phiRiskLevel = phiResult.riskLevel;
        }
      }

      // Get governance mode
      const governanceMode = process.env.GOVERNANCE_MODE || 'DEMO';

      // Assess risk level
      const riskLevel = assessRiskLevel(governanceMode, phiRiskLevel, taskType);

      // Check for existing valid approval
      const existingApproval = await checkExistingApproval(user.id, taskType, ethicsCategory);

      if (existingApproval.exists) {
        // Has valid approval, proceed
        await logAction({
          eventType: 'ETHICS_GATE',
          action: 'EXISTING_APPROVAL_USED',
          userId: user.id,
          resourceType: 'ethics_approval',
          resourceId: existingApproval.approvalId,
          details: {
            taskType,
            ethicsCategory,
            riskLevel
          }
        });

        // Attach approval ID to request for tracking
        (req as any).ethicsApprovalId = existingApproval.approvalId;
        return next();
      }

      // Create new approval request
      const justification = req.body.ethicsJustification || req.headers['x-ethics-justification'] as string;
      const confirmed = req.body.ethicsConfirmed === true || req.headers['x-ethics-confirmed'] === 'true';
      const confirmationSatisfied = !requireConfirmation || confirmed;

      // For low risk, require explicit confirmation if enabled
      if (riskLevel === 'LOW' && requireConfirmation && !confirmed) {
        return res.status(412).json({
          error: 'ETHICS_CONFIRMATION_REQUIRED',
          message: 'Please confirm that this AI operation complies with ethics guidelines',
          code: 'ETHICS_CONFIRMATION_NEEDED',
          riskLevel,
          taskType,
          instructions: 'Set ethicsConfirmed: true in request body or x-ethics-confirmed: true header'
        });
      }

      // Create the approval record
      const approvalId = await createEthicsApproval(
        user.id,
        user.role,
        taskType,
        ethicsCategory,
        riskLevel,
        governanceMode,
        phiRiskLevel,
        justification
      );

      // Log the gate creation
      await logAction({
        eventType: 'ETHICS_GATE',
        action: 'GATE_CREATED',
        userId: user.id,
        resourceType: 'ethics_approval',
        resourceId: approvalId,
        details: {
          taskType,
          ethicsCategory,
          riskLevel,
          governanceMode,
          phiRiskLevel,
          autoApproved: riskLevel === 'LOW'
        }
      });

      // For low risk with confirmation, auto-approve and proceed
      if (riskLevel === 'LOW' && confirmationSatisfied) {
        await logAction({
          eventType: 'ETHICS_GATE',
          action: 'AUTO_APPROVED',
          userId: user.id,
          resourceType: 'ethics_approval',
          resourceId: approvalId,
          details: { taskType, riskLevel }
        });

        (req as any).ethicsApprovalId = approvalId;
        return next();
      }

      // For medium/high/critical risk, require steward approval
      return res.status(202).json({
        message: 'Ethics approval required',
        approvalId,
        status: 'PENDING',
        code: 'ETHICS_APPROVAL_REQUIRED',
        riskLevel,
        taskType,
        ethicsCategory,
        requiresStewardApproval: riskLevel !== 'LOW',
        instructions: riskLevel === 'LOW'
          ? 'Low risk operation requires user confirmation'
          : 'This operation requires STEWARD approval due to risk level'
      });

    } catch (error) {
      console.error('Ethics gate error:', error);

      await logAction({
        eventType: 'ETHICS_GATE',
        action: 'ERROR',
        userId: req.user?.id,
        resourceType: 'ai_operation',
        details: {
          error: error instanceof Error ? error.message : 'Unknown error',
          taskType: options.taskType
        }
      });

      return res.status(500).json({
        error: 'ETHICS_GATE_ERROR',
        message: 'Failed to process ethics gate'
      });
    }
  };
}

/**
 * Check ethics approval status
 */
export async function checkEthicsApprovalStatus(approvalId: string): Promise<EthicsCheckResult> {
  if (!db) {
    throw new Error('Database not initialized');
  }

  const [approval] = await db
    .select()
    .from(ethicsApprovals)
    .where(eq(ethicsApprovals.id, approvalId))
    .limit(1);

  if (!approval) {
    return {
      approved: false,
      reason: 'Approval not found',
      riskLevel: 'HIGH',
      requiresStewardApproval: true
    };
  }

  const isValid = approval.validUntil ? new Date(approval.validUntil) > new Date() : false;

  return {
    approved: approval.status === 'APPROVED' && isValid,
    approvalId: approval.id,
    reason: approval.status === 'REJECTED'
      ? 'Ethics approval was rejected'
      : approval.status === 'PENDING'
      ? 'Ethics approval is pending'
      : !isValid
      ? 'Ethics approval has expired'
      : undefined,
    riskLevel: approval.riskLevel as 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL',
    requiresStewardApproval: approval.riskLevel !== 'LOW'
  };
}

/**
 * Approve an ethics request (for STEWARD/ADMIN use)
 */
export async function approveEthicsRequest(
  approvalId: string,
  approverId: string,
  conditions?: Record<string, unknown>
): Promise<boolean> {
  if (!db) {
    throw new Error('Database not initialized');
  }

  const validityHours = parseInt(process.env.ETHICS_APPROVAL_VALIDITY_HOURS || '24', 10);
  const validUntil = new Date();
  validUntil.setHours(validUntil.getHours() + validityHours);

  await db
    .update(ethicsApprovals)
    .set({
      status: 'APPROVED',
      approvedById: approverId,
      reviewedAt: new Date(),
      validUntil,
      conditions: conditions || {}
    })
    .where(eq(ethicsApprovals.id, approvalId));

  await logAction({
    eventType: 'ETHICS_GATE',
    action: 'APPROVED',
    userId: approverId,
    resourceType: 'ethics_approval',
    resourceId: approvalId,
    details: { conditions }
  });

  return true;
}

/**
 * Reject an ethics request (for STEWARD/ADMIN use)
 */
export async function rejectEthicsRequest(
  approvalId: string,
  rejecterId: string,
  reason: string
): Promise<boolean> {
  if (!db) {
    throw new Error('Database not initialized');
  }

  await db
    .update(ethicsApprovals)
    .set({
      status: 'REJECTED',
      approvedById: rejecterId,
      reviewedAt: new Date(),
      justification: reason
    })
    .where(eq(ethicsApprovals.id, approvalId));

  await logAction({
    eventType: 'ETHICS_GATE',
    action: 'REJECTED',
    userId: rejecterId,
    resourceType: 'ethics_approval',
    resourceId: approvalId,
    details: { reason }
  });

  return true;
}

/**
 * Middleware to require consent before operations
 */
export function requireConsent(consentTypes: string[]) {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (process.env.GDPR_CONSENT_REQUIRED !== 'true') {
      return next();
    }

    const user = req.user;
    if (!user) {
      return res.status(401).json({
        error: 'AUTHENTICATION_REQUIRED',
        message: 'Authentication required'
      });
    }

    // Check consent status - this will be implemented in consent routes
    // For now, pass through if consent checking is not fully implemented
    return next();
  };
}
