/**
 * Workflow Stages Routes
 *
 * API endpoints for workflow stage management and navigation.
 * Extracted from monolithic routes.ts for better modularity.
 *
 * @module routes/workflow-stages
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import {
  workflowStageGroups,
  getAllStages,
  getStageById,
  getStageGroupByStageId,
  getStageName
} from '../data/workflowStages';
import {
  lifecycleService,
  AI_ENABLED_STAGES,
  ATTESTATION_REQUIRED_STAGES
} from '../services/lifecycleService';

const router = Router();

// Get governance mode from environment
const ROS_MODE = process.env.GOVERNANCE_MODE || process.env.ROS_MODE || 'STANDBY';

/**
 * GET /api/workflow/stages
 * Get all workflow stage groups with stages
 */
router.get('/stages', (req: Request, res: Response) => {
  try {
    const sessionId = lifecycleService.getSessionId(req);
    const sessionSummary = lifecycleService.getSessionSummary(sessionId);

    // Enrich stages with session-specific status
    const enrichedGroups = workflowStageGroups.map(group => ({
      ...group,
      stages: group.stages.map(stage => ({
        ...stage,
        isAIEnabled: lifecycleService.isAIEnabledStage(stage.id),
        requiresAttestation: lifecycleService.requiresAttestation(stage.id),
        aiApproved: sessionSummary.approvedAIStages.includes(stage.id),
        isCompleted: sessionSummary.completedStages.includes(stage.id),
        isAttested: sessionSummary.attestedGates.includes(stage.id)
      }))
    }));

    res.json({
      stageGroups: enrichedGroups,
      currentLifecycleState: sessionSummary.currentState,
      mode: ROS_MODE
    });
  } catch (error) {
    console.error('Error fetching workflow stages:', error);
    res.status(500).json({ error: 'Failed to fetch workflow stages' });
  }
});

/**
 * GET /api/workflow/stages/:stageId
 * Get a specific stage by ID
 */
router.get('/stages/:stageId', (req: Request, res: Response) => {
  try {
    const stageId = parseInt(req.params.stageId);
    if (isNaN(stageId)) {
      return res.status(400).json({ error: 'Invalid stage ID' });
    }

    const stage = getStageById(stageId);
    if (!stage) {
      return res.status(404).json({ error: 'Stage not found' });
    }

    const group = getStageGroupByStageId(stageId);
    const sessionId = lifecycleService.getSessionId(req);
    const sessionSummary = lifecycleService.getSessionSummary(sessionId);

    res.json({
      stage: {
        ...stage,
        isAIEnabled: lifecycleService.isAIEnabledStage(stageId),
        requiresAttestation: lifecycleService.requiresAttestation(stageId),
        aiApproved: sessionSummary.approvedAIStages.includes(stageId),
        isCompleted: sessionSummary.completedStages.includes(stageId),
        isAttested: sessionSummary.attestedGates.includes(stageId)
      },
      group: group ? { id: group.id, name: group.name } : null,
      mode: ROS_MODE
    });
  } catch (error) {
    console.error('Error fetching stage:', error);
    res.status(500).json({ error: 'Failed to fetch stage' });
  }
});

/**
 * POST /api/workflow/stages/:stageId/approve-ai
 * Approve AI usage for a specific stage
 */
router.post('/stages/:stageId/approve-ai', (req: Request, res: Response) => {
  try {
    const stageId = parseInt(req.params.stageId);
    if (isNaN(stageId)) {
      return res.status(400).json({ error: 'Invalid stage ID' });
    }

    const stageName = getStageName(stageId);
    const sessionId = lifecycleService.getSessionId(req);
    const userId = (req as any).user?.id;

    const result = lifecycleService.approveAIStage(sessionId, stageId, stageName, userId);

    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }

    res.json({
      status: 'success',
      stageId,
      stageName,
      aiApproved: true,
      message: `AI assistance approved for ${stageName}`,
      mode: ROS_MODE
    });
  } catch (error) {
    console.error('Error approving AI stage:', error);
    res.status(500).json({ error: 'Failed to approve AI stage' });
  }
});

/**
 * POST /api/workflow/stages/:stageId/revoke-ai
 * Revoke AI approval for a specific stage
 */
router.post('/stages/:stageId/revoke-ai', (req: Request, res: Response) => {
  try {
    const stageId = parseInt(req.params.stageId);
    if (isNaN(stageId)) {
      return res.status(400).json({ error: 'Invalid stage ID' });
    }

    const stageName = getStageName(stageId);
    const sessionId = lifecycleService.getSessionId(req);
    const userId = (req as any).user?.id;

    lifecycleService.revokeAIStage(sessionId, stageId, stageName, userId);

    res.json({
      status: 'success',
      stageId,
      stageName,
      aiApproved: false,
      message: `AI assistance revoked for ${stageName}`,
      mode: ROS_MODE
    });
  } catch (error) {
    console.error('Error revoking AI stage:', error);
    res.status(500).json({ error: 'Failed to revoke AI stage' });
  }
});

/**
 * POST /api/workflow/stages/:stageId/attest
 * Attest to a gate (pre-execution checkpoint)
 */
router.post('/stages/:stageId/attest', (req: Request, res: Response) => {
  try {
    const stageId = parseInt(req.params.stageId);
    if (isNaN(stageId)) {
      return res.status(400).json({ error: 'Invalid stage ID' });
    }

    const { attestationText } = req.body;
    const stageName = getStageName(stageId);
    const sessionId = lifecycleService.getSessionId(req);
    const userId = (req as any).user?.id;

    const result = lifecycleService.attestGate(sessionId, stageId, stageName, userId, attestationText);

    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }

    res.json({
      status: 'success',
      stageId,
      stageName,
      attested: true,
      message: `Gate attested for ${stageName}`,
      mode: ROS_MODE
    });
  } catch (error) {
    console.error('Error attesting gate:', error);
    res.status(500).json({ error: 'Failed to attest gate' });
  }
});

/**
 * POST /api/workflow/stages/:stageId/complete
 * Mark a stage as completed
 */
router.post('/stages/:stageId/complete', (req: Request, res: Response) => {
  try {
    const stageId = parseInt(req.params.stageId);
    if (isNaN(stageId)) {
      return res.status(400).json({ error: 'Invalid stage ID' });
    }

    const { metadata } = req.body;
    const stageName = getStageName(stageId);
    const sessionId = lifecycleService.getSessionId(req);
    const userId = (req as any).user?.id;

    // Check attestation requirement
    if (lifecycleService.requiresAttestation(stageId) &&
        !lifecycleService.isGateAttested(sessionId, stageId)) {
      return res.status(403).json({
        error: 'Stage requires attestation before completion',
        stageId,
        stageName
      });
    }

    lifecycleService.completeStage(sessionId, stageId, stageName, userId, metadata);

    res.json({
      status: 'success',
      stageId,
      stageName,
      completed: true,
      message: `Stage ${stageName} marked as completed`,
      mode: ROS_MODE
    });
  } catch (error) {
    console.error('Error completing stage:', error);
    res.status(500).json({ error: 'Failed to complete stage' });
  }
});

/**
 * GET /api/workflow/lifecycle
 * Get current lifecycle state and session summary
 */
router.get('/lifecycle', (req: Request, res: Response) => {
  try {
    const sessionId = lifecycleService.getSessionId(req);
    const summary = lifecycleService.getSessionSummary(sessionId);

    res.json({
      ...summary,
      aiEnabledStages: [...AI_ENABLED_STAGES],
      attestationRequiredStages: [...ATTESTATION_REQUIRED_STAGES],
      mode: ROS_MODE
    });
  } catch (error) {
    console.error('Error fetching lifecycle state:', error);
    res.status(500).json({ error: 'Failed to fetch lifecycle state' });
  }
});

/**
 * POST /api/workflow/lifecycle/transition
 * Transition to a new lifecycle state
 */
router.post('/lifecycle/transition', (req: Request, res: Response) => {
  try {
    const { newState, details } = req.body;
    if (!newState) {
      return res.status(400).json({ error: 'newState is required' });
    }

    const sessionId = lifecycleService.getSessionId(req);
    const userId = (req as any).user?.id;

    const result = lifecycleService.transitionState(sessionId, newState, userId, details);

    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }

    const summary = lifecycleService.getSessionSummary(sessionId);

    res.json({
      status: 'success',
      ...summary,
      message: `Transitioned to ${newState}`,
      mode: ROS_MODE
    });
  } catch (error) {
    console.error('Error transitioning state:', error);
    res.status(500).json({ error: 'Failed to transition state' });
  }
});

/**
 * GET /api/workflow/audit-log
 * Get audit log for current session
 */
router.get('/audit-log', (req: Request, res: Response) => {
  try {
    const sessionId = lifecycleService.getSessionId(req);
    const auditLog = lifecycleService.getAuditLog(sessionId);

    res.json({
      sessionId,
      entries: auditLog,
      count: auditLog.length,
      mode: ROS_MODE
    });
  } catch (error) {
    console.error('Error fetching audit log:', error);
    res.status(500).json({ error: 'Failed to fetch audit log' });
  }
});

/**
 * POST /api/workflow/reset
 * Reset session state (for testing/demo)
 */
router.post('/reset', (req: Request, res: Response) => {
  try {
    const sessionId = lifecycleService.getSessionId(req);
    lifecycleService.resetSession(sessionId);

    res.json({
      status: 'success',
      message: 'Session reset successfully',
      sessionId,
      mode: ROS_MODE
    });
  } catch (error) {
    console.error('Error resetting session:', error);
    res.status(500).json({ error: 'Failed to reset session' });
  }
});

export default router;
