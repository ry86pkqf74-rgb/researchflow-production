/**
 * Tutorial Routes (Task 108: Inline Tutorials)
 *
 * API endpoints for tutorial management and progress tracking.
 * Includes feature flag gating and org-scoping support.
 */

import express from 'express';
import { tutorialService } from '../services/tutorialService';
import { asyncHandler } from '../middleware/asyncHandler';
import { featureFlagsService } from '../services/featureFlagsService';
import { z } from 'zod';

const router = express.Router();

/**
 * Middleware to check feature flag for tutorials
 */
const requireTutorialsEnabled = asyncHandler(async (req, res, next) => {
  const orgId = req.headers['x-organization-id'] as string || null;

  const enabled = await featureFlagsService.isFlagEnabled('inline_tutorials', orgId);
  if (!enabled) {
    return res.status(403).json({
      error: 'Inline tutorials feature is currently disabled',
      code: 'FEATURE_DISABLED',
    });
  }

  next();
});

/**
 * GET /api/tutorials
 * List available tutorials for current user's org
 */
router.get(
  '/',
  requireTutorialsEnabled,
  asyncHandler(async (req, res) => {
    const orgId = req.headers['x-organization-id'] as string || null;

    const tutorials = await tutorialService.getAvailableTutorials(orgId);

    res.json({
      tutorials,
      count: tutorials.length,
    });
  })
);

/**
 * GET /api/tutorials/:key
 * Get tutorial definition (resolves org override)
 */
router.get(
  '/:key',
  requireTutorialsEnabled,
  asyncHandler(async (req, res) => {
    const { key } = req.params;
    const orgId = req.headers['x-organization-id'] as string || null;

    const tutorial = await tutorialService.getTutorial(key, orgId);

    if (!tutorial) {
      return res.status(404).json({
        error: 'Tutorial not found',
        code: 'TUTORIAL_NOT_FOUND',
        tutorialKey: key,
      });
    }

    res.json(tutorial);
  })
);

/**
 * GET /api/tutorials/:key/progress
 * Get user's progress for tutorial
 */
router.get(
  '/:key/progress',
  requireTutorialsEnabled,
  asyncHandler(async (req, res) => {
    const { key } = req.params;
    const userId = (req as any).user?.id || req.headers['x-user-id'] as string;

    if (!userId) {
      return res.status(401).json({
        error: 'User authentication required',
        code: 'UNAUTHORIZED',
      });
    }

    const progress = await tutorialService.getTutorialProgress(userId, key);

    res.json(progress || {});
  })
);

/**
 * POST /api/tutorials/:key/progress
 * Update progress for tutorial
 *
 * Body: { currentStep?: number, completed?: boolean, dismissedPermanently?: boolean }
 */
const updateProgressSchema = z.object({
  currentStep: z.number().int().min(0).optional(),
  completed: z.boolean().optional(),
  dismissedPermanently: z.boolean().optional(),
});

router.post(
  '/:key/progress',
  requireTutorialsEnabled,
  asyncHandler(async (req, res) => {
    const { key } = req.params;
    const userId = (req as any).user?.id || req.headers['x-user-id'] as string;

    if (!userId) {
      return res.status(401).json({
        error: 'User authentication required',
        code: 'UNAUTHORIZED',
      });
    }

    // Validate request body
    const validation = updateProgressSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        error: 'Invalid request body',
        details: validation.error.flatten(),
        code: 'VALIDATION_ERROR',
      });
    }

    await tutorialService.updateProgress(userId, key, validation.data);

    // Return updated progress
    const progress = await tutorialService.getTutorialProgress(userId, key);

    res.json({
      success: true,
      progress,
    });
  })
);

/**
 * POST /api/tutorials/:key/start
 * Mark tutorial as started (audit log event)
 */
router.post(
  '/:key/start',
  requireTutorialsEnabled,
  asyncHandler(async (req, res) => {
    const { key } = req.params;
    const userId = (req as any).user?.id || req.headers['x-user-id'] as string;

    if (!userId) {
      return res.status(401).json({
        error: 'User authentication required',
        code: 'UNAUTHORIZED',
      });
    }

    // Update progress with started timestamp
    await tutorialService.updateProgress(userId, key, {
      started: new Date().toISOString(),
    });

    // TODO: Add audit log entry for TUTORIAL_STARTED event

    res.json({
      success: true,
      tutorialKey: key,
      started: true,
    });
  })
);

/**
 * POST /api/tutorials/:key/complete
 * Mark tutorial as completed
 */
router.post(
  '/:key/complete',
  requireTutorialsEnabled,
  asyncHandler(async (req, res) => {
    const { key } = req.params;
    const userId = (req as any).user?.id || req.headers['x-user-id'] as string;

    if (!userId) {
      return res.status(401).json({
        error: 'User authentication required',
        code: 'UNAUTHORIZED',
      });
    }

    // Mark as completed
    await tutorialService.updateProgress(userId, key, {
      completed: true,
    });

    // TODO: Add audit log entry for TUTORIAL_COMPLETED event

    res.json({
      success: true,
      tutorialKey: key,
      completed: true,
    });
  })
);

// =====================================
// ADMIN ENDPOINTS
// =====================================

/**
 * POST /api/tutorials
 * Create new tutorial (ADMIN only)
 *
 * Body: { tutorialKey, title, description?, videoUrl?, steps[], enabled?, orgId? }
 */
const createTutorialSchema = z.object({
  tutorialKey: z.string().min(1).max(100),
  title: z.string().min(1).max(255),
  description: z.string().optional(),
  videoUrl: z.string().url().optional(),
  steps: z.array(
    z.object({
      title: z.string().min(1),
      content: z.string().min(1),
      targetSelector: z.string().optional(),
      videoUrl: z.string().url().optional(),
    })
  ),
  enabled: z.boolean().optional(),
  orgId: z.string().nullable().optional(),
});

router.post(
  '/',
  requireTutorialsEnabled,
  // TODO: Add requireRole('ADMIN') middleware
  asyncHandler(async (req, res) => {
    // Validate request body
    const validation = createTutorialSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        error: 'Invalid request body',
        details: validation.error.flatten(),
        code: 'VALIDATION_ERROR',
      });
    }

    const tutorial = await tutorialService.createTutorial(validation.data);

    res.status(201).json({
      success: true,
      tutorial,
    });
  })
);

/**
 * PUT /api/tutorials/:key
 * Update tutorial (ADMIN only)
 *
 * Body: { title?, description?, videoUrl?, steps[], enabled? }
 */
const updateTutorialSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  description: z.string().optional(),
  videoUrl: z.string().url().optional(),
  steps: z
    .array(
      z.object({
        title: z.string().min(1),
        content: z.string().min(1),
        targetSelector: z.string().optional(),
        videoUrl: z.string().url().optional(),
      })
    )
    .optional(),
  enabled: z.boolean().optional(),
});

router.put(
  '/:key',
  requireTutorialsEnabled,
  // TODO: Add requireRole('ADMIN') middleware
  asyncHandler(async (req, res) => {
    const { key } = req.params;

    // Validate request body
    const validation = updateTutorialSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        error: 'Invalid request body',
        details: validation.error.flatten(),
        code: 'VALIDATION_ERROR',
      });
    }

    const tutorial = await tutorialService.updateTutorial(key, validation.data);

    if (!tutorial) {
      return res.status(404).json({
        error: 'Tutorial not found',
        code: 'TUTORIAL_NOT_FOUND',
        tutorialKey: key,
      });
    }

    res.json({
      success: true,
      tutorial,
    });
  })
);

/**
 * DELETE /api/tutorials/:key
 * Delete tutorial (ADMIN only)
 */
router.delete(
  '/:key',
  requireTutorialsEnabled,
  // TODO: Add requireRole('ADMIN') middleware
  asyncHandler(async (req, res) => {
    const { key } = req.params;

    const deleted = await tutorialService.deleteTutorial(key);

    if (!deleted) {
      return res.status(404).json({
        error: 'Tutorial not found',
        code: 'TUTORIAL_NOT_FOUND',
        tutorialKey: key,
      });
    }

    res.json({
      success: true,
      tutorialKey: key,
      deleted: true,
    });
  })
);

export default router;
