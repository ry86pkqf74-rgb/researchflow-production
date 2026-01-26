/**
 * User Preferences API Routes
 *
 * Provides endpoints for managing user preferences including
 * theme, layout, accessibility, and notification settings.
 *
 * Tasks: UI/UX Phase 0 (User Preferences API)
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import {
  getPreferencesService,
  UserPreferencesSchema,
  DEFAULT_PREFERENCES,
} from '../services/preferences.service.js';
import { logAction } from '../services/auditService.js';

const router = Router();

// Partial update schema
const UpdatePreferencesSchema = UserPreferencesSchema.partial();

/**
 * GET /api/me/preferences
 *
 * Get current user's preferences
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user?.id) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
      });
    }

    const service = getPreferencesService();
    const preferences = await service.getPreferences(user.id);

    return res.json({
      success: true,
      preferences,
    });
  } catch (error) {
    console.error('Get preferences error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to retrieve preferences',
    });
  }
});

/**
 * PUT /api/me/preferences
 *
 * Update current user's preferences (full replace)
 */
router.put('/', async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user?.id) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
      });
    }

    const parseResult = UserPreferencesSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        success: false,
        error: 'Invalid preferences',
        details: parseResult.error.errors,
      });
    }

    const service = getPreferencesService();
    const preferences = await service.updatePreferences(user.id, parseResult.data);

    // Log the update
    await logAction({
      action: 'PREFERENCES_UPDATE',
      userId: user.id,
      resourceType: 'preferences',
      resourceId: user.id,
      details: {
        type: 'full_update',
      },
    });

    return res.json({
      success: true,
      preferences,
    });
  } catch (error) {
    console.error('Update preferences error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to update preferences',
    });
  }
});

/**
 * PATCH /api/me/preferences
 *
 * Partially update current user's preferences
 */
router.patch('/', async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user?.id) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
      });
    }

    const parseResult = UpdatePreferencesSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        success: false,
        error: 'Invalid preferences update',
        details: parseResult.error.errors,
      });
    }

    const service = getPreferencesService();
    const preferences = await service.updatePreferences(user.id, parseResult.data);

    // Log the update
    await logAction({
      action: 'PREFERENCES_UPDATE',
      userId: user.id,
      resourceType: 'preferences',
      resourceId: user.id,
      details: {
        type: 'partial_update',
        fields: Object.keys(parseResult.data),
      },
    });

    return res.json({
      success: true,
      preferences,
    });
  } catch (error) {
    console.error('Patch preferences error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to update preferences',
    });
  }
});

/**
 * POST /api/me/preferences/reset
 *
 * Reset preferences to defaults
 */
router.post('/reset', async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user?.id) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
      });
    }

    const service = getPreferencesService();
    const preferences = await service.resetPreferences(user.id);

    // Log the reset
    await logAction({
      action: 'PREFERENCES_RESET',
      userId: user.id,
      resourceType: 'preferences',
      resourceId: user.id,
      details: {},
    });

    return res.json({
      success: true,
      preferences,
      message: 'Preferences reset to defaults',
    });
  } catch (error) {
    console.error('Reset preferences error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to reset preferences',
    });
  }
});

/**
 * GET /api/me/preferences/defaults
 *
 * Get default preference values
 */
router.get('/defaults', async (req: Request, res: Response) => {
  return res.json({
    success: true,
    defaults: DEFAULT_PREFERENCES,
  });
});

/**
 * GET /api/me/preferences/:key
 *
 * Get a specific preference value
 */
router.get('/:key', async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user?.id) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
      });
    }

    const { key } = req.params;

    // Validate key
    const validKeys = Object.keys(DEFAULT_PREFERENCES);
    if (!validKeys.includes(key)) {
      return res.status(400).json({
        success: false,
        error: `Invalid preference key: ${key}`,
        validKeys,
      });
    }

    const service = getPreferencesService();
    const value = await service.getPreference(user.id, key as keyof typeof DEFAULT_PREFERENCES);

    return res.json({
      success: true,
      key,
      value,
    });
  } catch (error) {
    console.error('Get preference error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to retrieve preference',
    });
  }
});

/**
 * PUT /api/me/preferences/:key
 *
 * Update a specific preference value
 */
router.put('/:key', async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user?.id) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
      });
    }

    const { key } = req.params;
    const { value } = req.body;

    // Validate key
    const validKeys = Object.keys(DEFAULT_PREFERENCES);
    if (!validKeys.includes(key)) {
      return res.status(400).json({
        success: false,
        error: `Invalid preference key: ${key}`,
        validKeys,
      });
    }

    if (value === undefined) {
      return res.status(400).json({
        success: false,
        error: 'Value is required',
      });
    }

    const service = getPreferencesService();
    const preferences = await service.setPreference(
      user.id,
      key as keyof typeof DEFAULT_PREFERENCES,
      value
    );

    // Log the update
    await logAction({
      action: 'PREFERENCES_UPDATE',
      userId: user.id,
      resourceType: 'preferences',
      resourceId: user.id,
      details: {
        type: 'single_key_update',
        key,
      },
    });

    return res.json({
      success: true,
      key,
      value: preferences[key as keyof typeof preferences],
      preferences,
    });
  } catch (error) {
    console.error('Update preference error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to update preference',
    });
  }
});

export default router;
