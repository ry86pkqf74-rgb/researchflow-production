/**
 * Cumulative Data Routes
 *
 * API endpoints for managing cumulative stage data flow.
 * These endpoints ensure that data flows between workflow stages in LIVE mode.
 *
 * @module routes/cumulative-data
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import {
  getCumulativeDataService,
  WORKFLOW_STAGES,
  type StageJobPayload
} from '../services/cumulative-data.service';

const router = Router();

// Get governance mode from environment
const ROS_MODE = process.env.GOVERNANCE_MODE || process.env.ROS_MODE || 'DEMO';

// =====================
// VALIDATION SCHEMAS
// =====================

const StageSubmitSchema = z.object({
  inputData: z.record(z.unknown()).optional().default({}),
  governanceMode: z.enum(['DEMO', 'LIVE']).optional(),
});

const StageCompleteSchema = z.object({
  outputData: z.record(z.unknown()),
  artifacts: z.array(z.string()).optional().default([]),
  executionTimeMs: z.number().optional(),
});

const StageFailSchema = z.object({
  errorMessage: z.string(),
});

const PhiSchemaSchema = z.object({
  schemaName: z.string(),
  schema: z.record(z.unknown()),
});

// =====================
// ROUTES
// =====================

/**
 * GET /api/cumulative/stages
 * Get all available workflow stages
 */
router.get('/stages', (_req: Request, res: Response) => {
  res.json({
    stages: WORKFLOW_STAGES,
    totalStages: WORKFLOW_STAGES.length,
    mode: ROS_MODE,
  });
});

/**
 * GET /api/cumulative/projects/:identifier/state
 * Get the full workflow state for a project/research
 */
router.get('/projects/:identifier/state', async (req: Request, res: Response) => {
  try {
    const { identifier } = req.params;
    const service = getCumulativeDataService();

    // Determine if identifier is a projectId or researchId
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(identifier);
    const idObj = isUUID
      ? { projectId: identifier }
      : { researchId: identifier };

    const state = await service.getProjectState(idObj);

    res.json({
      ...state,
      mode: ROS_MODE,
    });
  } catch (error) {
    console.error('[CumulativeDataRoutes] Error getting project state:', error);
    res.status(500).json({ error: 'Failed to get project state' });
  }
});

/**
 * GET /api/cumulative/projects/:identifier/cumulative/:stageNumber
 * Get cumulative data available for a specific stage
 */
router.get('/projects/:identifier/cumulative/:stageNumber', async (req: Request, res: Response) => {
  try {
    const { identifier, stageNumber } = req.params;
    const stageNum = parseInt(stageNumber, 10);

    if (isNaN(stageNum) || stageNum < 1 || stageNum > 20) {
      return res.status(400).json({ error: 'Invalid stage number' });
    }

    const service = getCumulativeDataService();

    // Get or create manifest first
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(identifier);
    const idObj = isUUID
      ? { projectId: identifier }
      : { researchId: identifier };

    const userId = (req as any).user?.id || 'anonymous';
    const governanceMode = (ROS_MODE === 'LIVE' ? 'LIVE' : 'DEMO') as 'DEMO' | 'LIVE';

    const manifest = await service.getOrCreateManifest(idObj, userId, governanceMode);
    const cumulativeData = await service.getCumulativeData(manifest.id, stageNum);

    res.json({
      stageNumber: stageNum,
      cumulativeData,
      priorStagesCount: Object.keys(cumulativeData).length,
      mode: ROS_MODE,
    });
  } catch (error) {
    console.error('[CumulativeDataRoutes] Error getting cumulative data:', error);
    res.status(500).json({ error: 'Failed to get cumulative data' });
  }
});

/**
 * POST /api/cumulative/projects/:identifier/stages/:stageNumber
 * Submit a stage for processing with full cumulative context
 */
router.post('/projects/:identifier/stages/:stageNumber', async (req: Request, res: Response) => {
  try {
    const { identifier, stageNumber } = req.params;
    const stageNum = parseInt(stageNumber, 10);

    if (isNaN(stageNum) || stageNum < 1 || stageNum > 20) {
      return res.status(400).json({ error: 'Invalid stage number' });
    }

    const validation = StageSubmitSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ error: 'Invalid request body', details: validation.error.errors });
    }

    const { inputData, governanceMode: requestMode } = validation.data;
    const service = getCumulativeDataService();

    // Determine identifier type
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(identifier);
    const idObj = isUUID
      ? { projectId: identifier }
      : { researchId: identifier };

    const userId = (req as any).user?.id || 'anonymous';
    const governanceMode = requestMode || (ROS_MODE === 'LIVE' ? 'LIVE' : 'DEMO') as 'DEMO' | 'LIVE';

    // Build complete job payload with cumulative data
    const payload = await service.buildStageJobPayload(
      idObj,
      userId,
      stageNum,
      inputData,
      governanceMode
    );

    const stage = WORKFLOW_STAGES.find(s => s.number === stageNum);

    res.status(202).json({
      status: 'queued',
      message: `Stage ${stageNum} (${stage?.displayName || stage?.name}) queued for processing`,
      stageNumber: stageNum,
      stageName: stage?.name,
      manifestId: payload.manifestId,
      cumulativeDataKeys: Object.keys(payload.cumulativeData),
      phiSchemasKeys: Object.keys(payload.phiSchemas),
      governanceMode: payload.governanceMode,
      mode: ROS_MODE,
      // Include payload for direct processing (when not using job queue)
      payload,
    });
  } catch (error) {
    console.error('[CumulativeDataRoutes] Error submitting stage:', error);
    res.status(500).json({ error: 'Failed to submit stage' });
  }
});

/**
 * POST /api/cumulative/internal/stages/complete
 * Internal endpoint for worker to complete a stage
 */
router.post('/internal/stages/complete', async (req: Request, res: Response) => {
  try {
    const validation = z.object({
      manifestId: z.string().uuid(),
      stageNumber: z.number().int().min(1).max(20),
      outputData: z.record(z.unknown()),
      artifacts: z.array(z.string()).optional().default([]),
      executionTimeMs: z.number().optional(),
    }).safeParse(req.body);

    if (!validation.success) {
      return res.status(400).json({ error: 'Invalid request body', details: validation.error.errors });
    }

    const { manifestId, stageNumber, outputData, artifacts, executionTimeMs } = validation.data;
    const service = getCumulativeDataService();

    const result = await service.completeStage(
      manifestId,
      stageNumber,
      outputData,
      artifacts,
      executionTimeMs
    );

    // Get updated cumulative data for next stage
    const cumulativeData = await service.getCumulativeData(manifestId, stageNumber + 1);

    res.json({
      success: true,
      stage: result,
      cumulativeDataForNextStage: cumulativeData,
      message: `Stage ${stageNumber} completed successfully`,
    });
  } catch (error) {
    console.error('[CumulativeDataRoutes] Error completing stage:', error);
    res.status(500).json({ error: 'Failed to complete stage' });
  }
});

/**
 * POST /api/cumulative/internal/stages/fail
 * Internal endpoint for worker to report stage failure
 */
router.post('/internal/stages/fail', async (req: Request, res: Response) => {
  try {
    const validation = z.object({
      manifestId: z.string().uuid(),
      stageNumber: z.number().int().min(1).max(20),
      errorMessage: z.string(),
    }).safeParse(req.body);

    if (!validation.success) {
      return res.status(400).json({ error: 'Invalid request body', details: validation.error.errors });
    }

    const { manifestId, stageNumber, errorMessage } = validation.data;
    const service = getCumulativeDataService();

    const result = await service.failStage(manifestId, stageNumber, errorMessage);

    res.json({
      success: true,
      stage: result,
      message: `Stage ${stageNumber} marked as failed`,
    });
  } catch (error) {
    console.error('[CumulativeDataRoutes] Error failing stage:', error);
    res.status(500).json({ error: 'Failed to update stage status' });
  }
});

/**
 * POST /api/cumulative/projects/:identifier/phi-schema
 * Save a PHI schema for the project
 */
router.post('/projects/:identifier/phi-schema', async (req: Request, res: Response) => {
  try {
    const { identifier } = req.params;

    const validation = PhiSchemaSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ error: 'Invalid request body', details: validation.error.errors });
    }

    const { schemaName, schema } = validation.data;
    const service = getCumulativeDataService();

    // Get or create manifest
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(identifier);
    const idObj = isUUID
      ? { projectId: identifier }
      : { researchId: identifier };

    const userId = (req as any).user?.id || 'anonymous';
    const governanceMode = (ROS_MODE === 'LIVE' ? 'LIVE' : 'DEMO') as 'DEMO' | 'LIVE';

    const manifest = await service.getOrCreateManifest(idObj, userId, governanceMode);
    await service.savePhiSchema(manifest.id, schemaName, schema);

    res.json({
      success: true,
      message: `PHI schema '${schemaName}' saved`,
      manifestId: manifest.id,
    });
  } catch (error) {
    console.error('[CumulativeDataRoutes] Error saving PHI schema:', error);
    res.status(500).json({ error: 'Failed to save PHI schema' });
  }
});

/**
 * GET /api/cumulative/projects/:identifier/stages/:stageNumber
 * Get output for a specific completed stage
 */
router.get('/projects/:identifier/stages/:stageNumber', async (req: Request, res: Response) => {
  try {
    const { identifier, stageNumber } = req.params;
    const stageNum = parseInt(stageNumber, 10);

    if (isNaN(stageNum) || stageNum < 1 || stageNum > 20) {
      return res.status(400).json({ error: 'Invalid stage number' });
    }

    const service = getCumulativeDataService();

    // Get or create manifest
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(identifier);
    const idObj = isUUID
      ? { projectId: identifier }
      : { researchId: identifier };

    const userId = (req as any).user?.id || 'anonymous';
    const governanceMode = (ROS_MODE === 'LIVE' ? 'LIVE' : 'DEMO') as 'DEMO' | 'LIVE';

    const manifest = await service.getOrCreateManifest(idObj, userId, governanceMode);
    const stageOutput = await service.getStageOutput(manifest.id, stageNum);

    if (!stageOutput) {
      return res.status(404).json({ error: 'Stage output not found' });
    }

    const stage = WORKFLOW_STAGES.find(s => s.number === stageNum);

    res.json({
      stageNumber: stageNum,
      stageName: stage?.name,
      stageDisplayName: stage?.displayName,
      output: stageOutput,
      mode: ROS_MODE,
    });
  } catch (error) {
    console.error('[CumulativeDataRoutes] Error getting stage output:', error);
    res.status(500).json({ error: 'Failed to get stage output' });
  }
});

export default router;
