import { Request, Response, NextFunction } from 'express';
import { db } from '../../db';
import { approvalGates, phiIncidents } from '@researchflow/core/schema';
import { eq, and, gte } from 'drizzle-orm';
import { logAction } from '../services/audit-service';
import { scanForPhi } from '../services/phi-protection';
import type { User as CoreUser } from '@researchflow/core';

// Extend Express to include user type from our core package
// This augments the empty User interface from passport
declare global {
  namespace Express {
    interface User extends CoreUser {}
  }
}

export interface GovernanceGateOptions {
  operationType: string;
  resourceType: string;
  requiresApproval?: boolean;
  scanForPhi?: boolean;
}

/**
 * Governance gate middleware - requires approval for sensitive operations
 */
export function governanceGate(options: GovernanceGateOptions) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { operationType, resourceType, requiresApproval = true, scanForPhi: enablePhiScan = false } = options;

      // Log the attempt
      await logAction({
        eventType: 'GOVERNANCE_GATE',
        userId: req.user?.id,
        resourceType,
        action: operationType,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
        sessionId: req.headers['x-session-id'] as string,
        details: {
          path: req.path,
          method: req.method
        }
      });

      if (!db) {
        throw new Error('Database not initialized');
      }

      // PHI scanning if enabled
      if (enablePhiScan && req.body) {
        const bodyText = JSON.stringify(req.body);
        const phiResult = scanForPhi(bodyText);

        if (phiResult.detected && phiResult.riskLevel !== 'LOW') {
          // Create PHI incident
          await db.insert(phiIncidents).values({
            incidentId: `PHI-${Date.now()}`,
            severity: phiResult.riskLevel,
            description: `PHI detected in request: ${phiResult.identifiers.map(i => i.type).join(', ')}`,
            detectedBy: req.user?.id || null,
            phiType: phiResult.identifiers.map(i => i.type).join(', '),
            status: 'OPEN'
          });

          return res.status(403).json({
            error: 'PHI_DETECTED',
            message: 'Request contains protected health information',
            riskLevel: phiResult.riskLevel,
            code: 'PHI_PROTECTION_TRIGGERED'
          });
        }
      }

      // Check if approval required
      if (!requiresApproval) {
        return next();
      }

      // Create approval gate
      const [gate] = await db.insert(approvalGates).values({
        operationType,
        resourceId: req.params.id || 'pending',
        resourceType,
        approvalMode: 'REQUIRE_EACH',
        requestedById: req.user!.id,
        requestedByRole: req.user!.role,
        status: 'PENDING',
        reason: req.body.reason || 'Governance gate triggered',
        metadata: {
          path: req.path,
          method: req.method,
          body: req.body
        },
        sessionId: req.headers['x-session-id'] as string,
        ipAddress: req.ip
      }).returning();

      return res.status(202).json({
        message: 'Request pending approval',
        gateId: gate.id,
        status: 'PENDING',
        code: 'APPROVAL_REQUIRED'
      });

    } catch (error) {
      console.error('Governance gate error:', error);
      return res.status(500).json({
        error: 'GOVERNANCE_ERROR',
        message: 'Failed to process governance gate'
      });
    }
  };
}

/**
 * Check if an approval gate has been approved
 */
export async function checkApprovalStatus(gateId: string) {
  if (!db) {
    throw new Error('Database not initialized');
  }

  const [gate] = await db
    .select()
    .from(approvalGates)
    .where(eq(approvalGates.id, gateId))
    .limit(1);

  if (!gate) {
    throw new Error('Approval gate not found');
  }

  return {
    approved: gate.status === 'APPROVED',
    status: gate.status,
    approvedBy: gate.approvedById,
    approvedAt: gate.reviewedAt
  };
}

/**
 * Block operations in STANDBY mode
 */
export function blockInStandby() {
  return async (req: Request, res: Response, next: NextFunction) => {
    const mode = process.env.GOVERNANCE_MODE || 'STANDBY';
    if (mode === 'STANDBY') {
      await logAction({
        eventType: 'GOVERNANCE',
        action: 'BLOCKED_IN_STANDBY',
        userId: req.user?.id,
        resourceType: 'system',
        details: {
          attemptedEndpoint: req.path,
          method: req.method
        }
      });
      return res.status(403).json({
        error: 'System is in STANDBY mode. No data operations allowed.',
        mode: 'STANDBY',
        contact: 'system administrator'
      });
    }
    next();
  };
}

/**
 * Require approval for large datasets
 */
export function requireApprovalForLargeData(threshold = 100000) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const mode = process.env.GOVERNANCE_MODE;
    if (mode !== 'LIVE') return next();

    const estimatedRows = req.body.estimatedRows || req.headers['x-estimated-rows'];
    if (estimatedRows && Number(estimatedRows) > threshold) {
      const uploadId = req.body.uploadId || req.params.id;

      if (!uploadId) {
        return res.status(400).json({
          error: 'Upload ID is required for large dataset approval',
          code: 'MISSING_UPLOAD_ID'
        });
      }

      if (!db) {
        throw new Error('Database not initialized');
      }

      const existingApproval = await db.select()
        .from(approvalGates)
        .where(and(
          eq(approvalGates.resourceId, uploadId),
          eq(approvalGates.status, 'APPROVED')
        ))
        .limit(1);

      if (!existingApproval.length) {
        const userId = req.user?.id;
        const userRole = req.user?.role || 'VIEWER';

        if (!userId) {
          return res.status(401).json({
            error: 'Authentication required for large dataset upload',
            code: 'AUTH_REQUIRED'
          });
        }

        const [approval] = await db.insert(approvalGates).values({
          operationType: 'DATASET_MODIFICATION',
          resourceType: 'large_upload',
          resourceId: uploadId,
          requestedById: userId,
          requestedByRole: userRole,
          reason: `Dataset with ${estimatedRows} rows exceeds threshold of ${threshold}`,
          metadata: { estimatedRows: Number(estimatedRows), threshold }
        }).returning();

        await logAction({
          eventType: 'GOVERNANCE',
          action: 'APPROVAL_REQUIRED',
          userId,
          resourceType: 'upload',
          resourceId: uploadId,
          details: { reason: 'large_dataset', estimatedRows: Number(estimatedRows) }
        });

        return res.status(202).json({
          status: 'pending_approval',
          message: 'Upload requires steward approval',
          approvalId: approval.id,
          estimatedRows: Number(estimatedRows)
        });
      }
    }
    next();
  };
}

/**
 * Require PHI permissions
 */
export function requirePhiPermission() {
  return async (req: Request, res: Response, next: NextFunction) => {
    const hasPhi = req.body.classification === 'IDENTIFIED' || req.body.phiDetected === true;
    const user = req.user;

    if (hasPhi && user) {
      const userRole = user.role;
      const hasPhiPermission = ['STEWARD', 'ADMIN'].includes(userRole);

      if (!hasPhiPermission) {
        await logAction({
          eventType: 'GOVERNANCE',
          action: 'PHI_PERMISSION_DENIED',
          userId: user.id,
          resourceType: 'upload',
          details: { classification: req.body.classification, userRole }
        });
        return res.status(403).json({
          error: 'Insufficient permissions to handle PHI data',
          required: 'upload:phi-data',
          userRole
        });
      }
    }
    next();
  };
}

/**
 * Rate limiting middleware
 */
export function enforceRateLimit(resource: string) {
  return async (req: Request, res: Response, next: NextFunction) => {
    // Simple rate limiting - can be enhanced later with Redis
    const key = `rate_limit:${resource}:${req.ip || req.user?.id || 'anonymous'}`;
    // For now, just pass through - implement actual rate limiting with Redis later
    next();
  };
}