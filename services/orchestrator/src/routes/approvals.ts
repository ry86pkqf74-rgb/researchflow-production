/**
 * Manuscript Approvals Routes
 *
 * Implements governance gates for LIVE mode exports and external API calls.
 * In LIVE mode, exports require explicit approval before proceeding.
 */

import { Router, Request, Response, NextFunction } from 'express';
import { v4 as uuid } from 'uuid';
import { createAuditEvent } from '../services/revisionsService';
import type {
  ApprovalRequest,
  ApprovalResponse,
  GovernanceGateResult,
} from '../../../../shared/contracts/audit';
import type { GovernanceMode } from '../../../../shared/contracts/manuscripts';

const router = Router();

// In-memory store for development
const approvalStore = new Map<
  string,
  ApprovalResponse & { manuscriptId: string; action: string; requestedBy: string; reason: string }
>();
const manuscriptModes = new Map<string, GovernanceMode>();

/**
 * Set governance mode for a manuscript (for testing/demo purposes)
 */
export function setManuscriptMode(manuscriptId: string, mode: GovernanceMode): void {
  manuscriptModes.set(manuscriptId, mode);
}

/**
 * Get governance mode for a manuscript
 */
export function getManuscriptMode(manuscriptId: string): GovernanceMode {
  return manuscriptModes.get(manuscriptId) || (process.env.GOVERNANCE_MODE as GovernanceMode) || 'DEMO';
}

/**
 * Check if an action is allowed based on governance mode and approval status
 */
export async function checkGovernanceGate(
  manuscriptId: string,
  action: 'EXPORT' | 'EXTERNAL_API' | 'PUBLISH',
  actor: string
): Promise<GovernanceGateResult> {
  const mode = getManuscriptMode(manuscriptId);

  // STANDBY mode blocks all external actions
  if (mode === 'STANDBY') {
    return {
      allowed: false,
      reason: 'System is in STANDBY mode. No exports or external calls allowed.',
    };
  }

  // DEMO mode allows all actions (on synthetic data)
  if (mode === 'DEMO') {
    // Log audit event
    const event = await createAuditEvent(manuscriptId, 'EXTERNAL_API_CALL', actor, {
      action,
      mode: 'DEMO',
      allowed: true,
    });

    return {
      allowed: true,
      auditEventId: event.id,
    };
  }

  // LIVE mode requires explicit approval
  if (mode === 'LIVE') {
    // Check for existing approved approval request
    const existingApproval = Array.from(approvalStore.values()).find(
      (a) =>
        a.manuscriptId === manuscriptId &&
        a.action === action &&
        a.status === 'APPROVED'
    );

    if (existingApproval) {
      return {
        allowed: true,
        auditEventId: existingApproval.id,
      };
    }

    // Check for pending approval
    const pendingApproval = Array.from(approvalStore.values()).find(
      (a) =>
        a.manuscriptId === manuscriptId &&
        a.action === action &&
        a.status === 'PENDING'
    );

    if (pendingApproval) {
      return {
        allowed: false,
        reason: 'Approval pending. Please wait for approval before proceeding.',
        requiredApprovals: [pendingApproval.id],
      };
    }

    // No approval exists - action blocked
    return {
      allowed: false,
      reason: `LIVE mode requires approval for ${action}. Please submit an approval request.`,
    };
  }

  return { allowed: false, reason: 'Unknown governance mode' };
}

/**
 * POST /api/manuscripts/:id/approvals
 *
 * Request approval for an action (LIVE mode only)
 */
router.post(
  '/:id/approvals',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const manuscriptId = req.params.id;
      const { action, reason, metadata } = req.body as Omit<ApprovalRequest, 'manuscriptId' | 'requestedBy'>;

      if (!action || !reason) {
        return res.status(400).json({ error: 'action and reason are required' });
      }

      if (!['EXPORT', 'EXTERNAL_API', 'PUBLISH'].includes(action)) {
        return res.status(400).json({ error: 'Invalid action. Must be EXPORT, EXTERNAL_API, or PUBLISH' });
      }

      const mode = getManuscriptMode(manuscriptId);
      const requestedBy = (req as any).user?.id || 'anonymous';

      // In DEMO mode, auto-approve
      if (mode === 'DEMO') {
        const approval: ApprovalResponse & { manuscriptId: string; action: string; requestedBy: string; reason: string } = {
          id: uuid(),
          status: 'APPROVED',
          approvedBy: 'system',
          approvedAt: new Date().toISOString(),
          manuscriptId,
          action,
          requestedBy,
          reason,
        };

        approvalStore.set(approval.id, approval);

        await createAuditEvent(manuscriptId, 'APPROVAL_GRANTED', 'system', {
          approvalId: approval.id,
          action,
          mode: 'DEMO',
          autoApproved: true,
        });

        return res.status(201).json(approval);
      }

      // LIVE mode - create pending approval
      const approval: ApprovalResponse & { manuscriptId: string; action: string; requestedBy: string; reason: string } = {
        id: uuid(),
        status: 'PENDING',
        manuscriptId,
        action,
        requestedBy,
        reason,
      };

      approvalStore.set(approval.id, approval);

      await createAuditEvent(manuscriptId, 'APPROVAL_REQUESTED', requestedBy, {
        approvalId: approval.id,
        action,
        reason,
        metadata,
      });

      return res.status(201).json(approval);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/manuscripts/:id/approvals
 *
 * List approval requests for a manuscript
 */
router.get(
  '/:id/approvals',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const manuscriptId = req.params.id;
      const status = req.query.status as string;

      let approvals = Array.from(approvalStore.values())
        .filter((a) => a.manuscriptId === manuscriptId);

      if (status) {
        approvals = approvals.filter((a) => a.status === status);
      }

      return res.json({ approvals });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/manuscripts/:id/approvals/:approvalId/approve
 *
 * Approve an approval request (admin only)
 */
router.post(
  '/:id/approvals/:approvalId/approve',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { approvalId } = req.params;
      const approval = approvalStore.get(approvalId);

      if (!approval) {
        return res.status(404).json({ error: 'Approval not found' });
      }

      if (approval.status !== 'PENDING') {
        return res.status(409).json({ error: 'Approval is not pending' });
      }

      const approvedBy = (req as any).user?.id || 'admin';

      approval.status = 'APPROVED';
      approval.approvedBy = approvedBy;
      approval.approvedAt = new Date().toISOString();

      await createAuditEvent(approval.manuscriptId, 'APPROVAL_GRANTED', approvedBy, {
        approvalId: approval.id,
        action: approval.action,
        requestedBy: approval.requestedBy,
      });

      return res.json(approval);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/manuscripts/:id/approvals/:approvalId/deny
 *
 * Deny an approval request (admin only)
 */
router.post(
  '/:id/approvals/:approvalId/deny',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { approvalId } = req.params;
      const { reason } = req.body;
      const approval = approvalStore.get(approvalId);

      if (!approval) {
        return res.status(404).json({ error: 'Approval not found' });
      }

      if (approval.status !== 'PENDING') {
        return res.status(409).json({ error: 'Approval is not pending' });
      }

      const deniedBy = (req as any).user?.id || 'admin';

      approval.status = 'DENIED';
      approval.denialReason = reason;

      await createAuditEvent(approval.manuscriptId, 'APPROVAL_DENIED', deniedBy, {
        approvalId: approval.id,
        action: approval.action,
        requestedBy: approval.requestedBy,
        denialReason: reason,
      });

      return res.json(approval);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/manuscripts/:id/governance
 *
 * Get governance status for a manuscript
 */
router.get(
  '/:id/governance',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const manuscriptId = req.params.id;
      const mode = getManuscriptMode(manuscriptId);

      const pendingApprovals = Array.from(approvalStore.values())
        .filter((a) => a.manuscriptId === manuscriptId && a.status === 'PENDING');

      const approvedActions = Array.from(approvalStore.values())
        .filter((a) => a.manuscriptId === manuscriptId && a.status === 'APPROVED')
        .map((a) => a.action);

      return res.json({
        manuscriptId,
        mode,
        pendingApprovals: pendingApprovals.length,
        approvedActions,
        canExport: mode === 'DEMO' || approvedActions.includes('EXPORT'),
        canCallExternalApi: mode === 'DEMO' || approvedActions.includes('EXTERNAL_API'),
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * PUT /api/manuscripts/:id/governance/mode
 *
 * Set governance mode for a manuscript (admin only)
 */
router.put(
  '/:id/governance/mode',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const manuscriptId = req.params.id;
      const { mode } = req.body as { mode: GovernanceMode };

      if (!['STANDBY', 'DEMO', 'LIVE'].includes(mode)) {
        return res.status(400).json({ error: 'Invalid mode. Must be STANDBY, DEMO, or LIVE' });
      }

      setManuscriptMode(manuscriptId, mode);

      return res.json({ manuscriptId, mode });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
export { checkGovernanceGate, getManuscriptMode, setManuscriptMode };
