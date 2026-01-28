import express from 'express';
import { featureFlagsService } from '../services/featureFlagsService';
import { db } from '../lib/db';
import { featureFlags, experiments } from '@researchflow/core/types/schema';
import { eq } from 'drizzle-orm';
import { asyncHandler } from '../middleware/asyncHandler';
import { requireRole } from '../middleware/rbac';
import { z } from 'zod';

const router = express.Router();

/**
 * GET /api/experiments/:key/variant
 * Get the variant assignment for the current user in an experiment
 *
 * Returns: { experimentKey: string, variant: string }
 */
router.get('/:key/variant',
  asyncHandler(async (req, res) => {
    const { key } = req.params;

    // Extract user ID from session (assuming req.user from auth middleware)
    const userId = req.user?.id || req.sessionID || 'anonymous';

    const variant = await featureFlagsService.getExperimentVariant(key, userId);

    res.json({
      experimentKey: key,
      variant,
    });
  })
);

/**
 * GET /api/experiments/:key
 * Get experiment metadata (status, description, etc.)
 *
 * Returns: Experiment object or 404
 */
router.get('/:key',
  asyncHandler(async (req, res) => {
    const { key } = req.params;

    const experiment = await featureFlagsService.getExperiment(key);

    if (!experiment) {
      return res.status(404).json({
        error: 'Experiment not found',
        code: 'EXPERIMENT_NOT_FOUND',
      });
    }

    // Don't expose sensitive variant weights to clients
    const publicExperiment = {
      experimentKey: experiment.experimentKey,
      name: experiment.name,
      description: experiment.description,
      status: experiment.status,
      startDate: experiment.startDate,
      endDate: experiment.endDate,
    };

    res.json(publicExperiment);
  })
);

/**
 * POST /api/experiments
 * Create a new experiment (ADMIN only)
 *
 * Body: { experimentKey, name, description, variants: [{ key, weight }], startDate?, endDate? }
 */
router.post('/',
  requireRole('ADMIN'),
  asyncHandler(async (req, res) => {
    const createExperimentSchema = z.object({
      experimentKey: z.string().min(1).max(100),
      name: z.string().min(1).max(255),
      description: z.string().optional(),
      variants: z.array(z.object({
        key: z.string().min(1),
        weight: z.number().int().min(0).max(100),
      })),
      startDate: z.string().datetime().optional(),
      endDate: z.string().datetime().optional(),
    });

    const data = createExperimentSchema.parse(req.body);

    // Validate that weights sum to 100
    const totalWeight = data.variants.reduce((sum, v) => sum + v.weight, 0);
    if (totalWeight !== 100) {
      return res.status(400).json({
        error: 'Variant weights must sum to 100',
        code: 'INVALID_WEIGHTS',
      });
    }

    // Check if experiment key already exists
    const existing = await db.select()
      .from(experiments)
      .where(eq(experiments.experimentKey, data.experimentKey))
      .limit(1);

    if (existing.length > 0) {
      return res.status(409).json({
        error: 'Experiment key already exists',
        code: 'DUPLICATE_KEY',
      });
    }

    // Create experiment
    const [newExperiment] = await db.insert(experiments).values({
      experimentKey: data.experimentKey,
      name: data.name,
      description: data.description,
      variants: data.variants,
      status: 'DRAFT',
      startDate: data.startDate ? new Date(data.startDate) : null,
      endDate: data.endDate ? new Date(data.endDate) : null,
    }).returning();

    res.status(201).json(newExperiment);
  })
);

/**
 * PATCH /api/experiments/:key/status
 * Update experiment status (ADMIN only)
 *
 * Body: { status: 'DRAFT' | 'RUNNING' | 'PAUSED' | 'COMPLETE' }
 */
router.patch('/:key/status',
  requireRole('ADMIN'),
  asyncHandler(async (req, res) => {
    const { key } = req.params;

    const updateStatusSchema = z.object({
      status: z.enum(['DRAFT', 'RUNNING', 'PAUSED', 'COMPLETE']),
    });

    const { status } = updateStatusSchema.parse(req.body);

    const [updatedExperiment] = await db.update(experiments)
      .set({ status, updatedAt: new Date() })
      .where(eq(experiments.experimentKey, key))
      .returning();

    if (!updatedExperiment) {
      return res.status(404).json({
        error: 'Experiment not found',
        code: 'EXPERIMENT_NOT_FOUND',
      });
    }

    res.json(updatedExperiment);
  })
);

/**
 * GET /api/feature-flags
 * Get all feature flags (public endpoint)
 *
 * Returns: Array of enabled feature flags
 */
router.get('/flags',
  asyncHandler(async (req, res) => {
    const enabledFlags = await featureFlagsService.getAllEnabled();

    // Filter to only return relevant info
    const publicFlags = enabledFlags.map(flag => ({
      flagKey: flag.flagKey,
      description: flag.description,
      tierRequired: flag.tierRequired,
    }));

    res.json(publicFlags);
  })
);

/**
 * GET /api/feature-flags/:key
 * Check if a specific feature flag is enabled
 *
 * Returns: { flagKey: string, enabled: boolean }
 */
router.get('/flags/:key',
  asyncHandler(async (req, res) => {
    const { key } = req.params;

    const enabled = await featureFlagsService.isFlagEnabled(key);

    res.json({
      flagKey: key,
      enabled,
    });
  })
);

/**
 * POST /api/feature-flags
 * Create or update a feature flag (ADMIN only)
 *
 * Body: { flagKey, enabled, description?, tierRequired? }
 */
router.post('/flags',
  requireRole('ADMIN'),
  asyncHandler(async (req, res) => {
    const createFlagSchema = z.object({
      flagKey: z.string().min(1).max(100),
      enabled: z.boolean(),
      description: z.string().optional(),
      tierRequired: z.enum(['FREE', 'PRO', 'TEAM', 'ENTERPRISE']).optional(),
    });

    const data = createFlagSchema.parse(req.body);

    // Upsert feature flag
    const [flag] = await db.insert(featureFlags)
      .values({
        flagKey: data.flagKey,
        enabled: data.enabled,
        description: data.description,
        tierRequired: data.tierRequired,
      })
      .onConflictDoUpdate({
        target: featureFlags.flagKey,
        set: {
          enabled: data.enabled,
          description: data.description,
          tierRequired: data.tierRequired,
          updatedAt: new Date(),
        },
      })
      .returning();

    // Clear cache after update
    featureFlagsService.clearCache();

    res.json(flag);
  })
);

/**
 * DELETE /api/feature-flags/:key/cache
 * Clear the feature flag cache (ADMIN only)
 *
 * Useful after manual database updates
 */
router.delete('/flags/:key/cache',
  requireRole('ADMIN'),
  asyncHandler(async (req, res) => {
    featureFlagsService.clearCache();

    res.json({
      success: true,
      message: 'Feature flag cache cleared',
    });
  })
);

export default router;
