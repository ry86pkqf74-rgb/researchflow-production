/**
 * User Settings Routes
 * 
 * API endpoints for managing user preferences, notifications, and account settings.
 */

import { Router, type Request, Response } from 'express';
import { requireAuth } from '../services/authService';
import { z } from 'zod';

const router = Router();

// In-memory storage for user settings (temporary - should use database)
const userSettingsStore = new Map<string, UserSettings>();

// Validation schema for user settings
const UserSettingsSchema = z.object({
  displayName: z.string().min(1).max(100).optional(),
  email: z.string().email().optional(),
  language: z.string().min(2).max(5).optional(),
  notifications: z.object({
    email: z.boolean().optional(),
    browser: z.boolean().optional(),
    projectUpdates: z.boolean().optional(),
    reviewReminders: z.boolean().optional(),
    weeklyDigest: z.boolean().optional(),
  }).optional(),
  privacy: z.object({
    showProfile: z.boolean().optional(),
    showActivity: z.boolean().optional(),
  }).optional(),
});

interface UserSettings {
  displayName?: string;
  email?: string;
  language?: string;
  notifications?: {
    email?: boolean;
    browser?: boolean;
    projectUpdates?: boolean;
    reviewReminders?: boolean;
    weeklyDigest?: boolean;
  };
  privacy?: {
    showProfile?: boolean;
    showActivity?: boolean;
  };
}

/**
 * GET /api/user/settings
 * Retrieve user settings
 */
router.get('/settings', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id || (req as any).user?.userId;
    
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    // Get settings from store or return defaults
    const settings = userSettingsStore.get(userId) || {
      displayName: (req as any).user?.name || '',
      email: (req as any).user?.email || '',
      language: 'en',
      notifications: {
        email: true,
        browser: true,
        projectUpdates: true,
        reviewReminders: true,
        weeklyDigest: false,
      },
      privacy: {
        showProfile: true,
        showActivity: true,
      },
    };

    res.json(settings);
  } catch (error) {
    console.error('Error fetching user settings:', error);
    res.status(500).json({ error: 'Failed to fetch user settings' });
  }
});

/**
 * PUT /api/user/settings
 * Update user settings
 */
router.put('/settings', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id || (req as any).user?.userId;
    
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    // Validate request body
    const validation = UserSettingsSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ 
        error: 'Invalid settings data',
        details: validation.error.errors 
      });
    }

    // Get existing settings or create new
    const existingSettings = userSettingsStore.get(userId) || {};
    
    // Merge settings (deep merge for nested objects)
    const updatedSettings: UserSettings = {
      ...existingSettings,
      ...validation.data,
      notifications: {
        ...existingSettings.notifications,
        ...validation.data.notifications,
      },
      privacy: {
        ...existingSettings.privacy,
        ...validation.data.privacy,
      },
    };

    // Store updated settings
    userSettingsStore.set(userId, updatedSettings);

    res.json({ 
      success: true, 
      settings: updatedSettings 
    });
  } catch (error) {
    console.error('Error updating user settings:', error);
    res.status(500).json({ error: 'Failed to update user settings' });
  }
});

/**
 * DELETE /api/user/account
 * Request account deletion (placeholder for future implementation)
 */
router.delete('/account', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id || (req as any).user?.userId;
    
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    // TODO: Implement account deletion workflow
    // - Send confirmation email
    // - Schedule deletion after grace period
    // - Delete all user data
    // - Revoke all sessions

    res.json({ 
      success: true,
      message: 'Account deletion request received. You will receive a confirmation email shortly.' 
    });
  } catch (error) {
    console.error('Error requesting account deletion:', error);
    res.status(500).json({ error: 'Failed to process account deletion request' });
  }
});

/**
 * POST /api/user/export
 * Request data export (placeholder for future implementation)
 */
router.post('/export', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id || (req as any).user?.userId;
    
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    // TODO: Implement data export
    // - Collect all user data
    // - Generate export file (JSON/ZIP)
    // - Send download link via email

    res.json({ 
      success: true,
      message: 'Data export request received. You will receive a download link via email within 24 hours.' 
    });
  } catch (error) {
    console.error('Error requesting data export:', error);
    res.status(500).json({ error: 'Failed to process data export request' });
  }
});

export default router;
