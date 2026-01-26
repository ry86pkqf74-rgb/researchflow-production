/**
 * Notification Routes (Task 82)
 * In-app notification center API endpoints
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import * as notificationService from '../services/notificationService';

const router = Router();

// ---------------------------------------------------------------------------
// Notification Routes
// ---------------------------------------------------------------------------

/**
 * GET /api/me/notifications
 * Get current user's notifications
 */
router.get('/me/notifications', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const options = z.object({
      unreadOnly: z.string().transform(v => v === 'true').optional(),
      type: notificationService.NotificationTypeSchema.optional(),
      limit: z.string().transform(Number).optional(),
      offset: z.string().transform(Number).optional(),
    }).parse(req.query);

    const result = notificationService.getUserNotifications(userId, {
      unreadOnly: options.unreadOnly,
      type: options.type,
      limit: options.limit,
      offset: options.offset,
    });

    return res.json(result);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    console.error('Get notifications error:', error);
    return res.status(500).json({ error: 'Failed to get notifications' });
  }
});

/**
 * GET /api/me/notifications/stats
 * Get notification statistics
 */
router.get('/me/notifications/stats', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const stats = notificationService.getNotificationStats(userId);
    return res.json(stats);
  } catch (error) {
    console.error('Get notification stats error:', error);
    return res.status(500).json({ error: 'Failed to get notification stats' });
  }
});

/**
 * POST /api/me/notifications/:notificationId/read
 * Mark notification as read
 */
router.post('/me/notifications/:notificationId/read', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { notificationId } = req.params;
    const notification = notificationService.markAsRead(notificationId, userId);

    if (!notification) {
      return res.status(404).json({ error: 'Notification not found' });
    }

    return res.json(notification);
  } catch (error) {
    console.error('Mark as read error:', error);
    return res.status(500).json({ error: 'Failed to mark as read' });
  }
});

/**
 * POST /api/me/notifications/read-all
 * Mark all notifications as read
 */
router.post('/me/notifications/read-all', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const count = notificationService.markAllAsRead(userId);
    return res.json({ markedAsRead: count });
  } catch (error) {
    console.error('Mark all as read error:', error);
    return res.status(500).json({ error: 'Failed to mark all as read' });
  }
});

/**
 * POST /api/me/notifications/:notificationId/dismiss
 * Dismiss a notification
 */
router.post('/me/notifications/:notificationId/dismiss', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { notificationId } = req.params;
    const success = notificationService.dismissNotification(notificationId, userId);

    if (!success) {
      return res.status(404).json({ error: 'Notification not found' });
    }

    return res.status(204).send();
  } catch (error) {
    console.error('Dismiss notification error:', error);
    return res.status(500).json({ error: 'Failed to dismiss notification' });
  }
});

/**
 * POST /api/me/notifications/dismiss-read
 * Dismiss all read notifications
 */
router.post('/me/notifications/dismiss-read', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const count = notificationService.dismissAllRead(userId);
    return res.json({ dismissed: count });
  } catch (error) {
    console.error('Dismiss read error:', error);
    return res.status(500).json({ error: 'Failed to dismiss read notifications' });
  }
});

// ---------------------------------------------------------------------------
// Preference Routes
// ---------------------------------------------------------------------------

/**
 * GET /api/me/notification-preferences
 * Get notification preferences
 */
router.get('/me/notification-preferences', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const preferences = notificationService.getPreferences(userId);
    return res.json(preferences);
  } catch (error) {
    console.error('Get preferences error:', error);
    return res.status(500).json({ error: 'Failed to get preferences' });
  }
});

/**
 * PATCH /api/me/notification-preferences
 * Update notification preferences
 */
router.patch('/me/notification-preferences', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const updates = z.object({
      emailEnabled: z.boolean().optional(),
      slackEnabled: z.boolean().optional(),
      webhookEnabled: z.boolean().optional(),
      webhookUrl: z.string().url().optional(),
      digestEnabled: z.boolean().optional(),
      digestFrequency: z.enum(['DAILY', 'WEEKLY']).optional(),
      digestTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
      quietHoursEnabled: z.boolean().optional(),
      quietHoursStart: z.string().regex(/^\d{2}:\d{2}$/).optional(),
      quietHoursEnd: z.string().regex(/^\d{2}:\d{2}$/).optional(),
    }).parse(req.body);

    const preferences = notificationService.updatePreferences(userId, updates);
    return res.json(preferences);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    console.error('Update preferences error:', error);
    return res.status(500).json({ error: 'Failed to update preferences' });
  }
});

// ---------------------------------------------------------------------------
// Admin Routes (for system notifications)
// ---------------------------------------------------------------------------

/**
 * POST /api/admin/notifications
 * Create a notification (admin/system use)
 */
router.post('/admin/notifications', async (req: Request, res: Response) => {
  try {
    // Check for admin role
    const userRole = req.user?.role;
    if (userRole !== 'ADMIN' && userRole !== 'STEWARD') {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const input = notificationService.CreateNotificationSchema.parse(req.body);
    const notification = await notificationService.createNotification(input);

    return res.status(201).json(notification);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    console.error('Create notification error:', error);
    return res.status(500).json({ error: 'Failed to create notification' });
  }
});

/**
 * POST /api/admin/notifications/cleanup
 * Cleanup expired notifications
 */
router.post('/admin/notifications/cleanup', async (req: Request, res: Response) => {
  try {
    const userRole = req.user?.role;
    if (userRole !== 'ADMIN') {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const count = notificationService.cleanupExpiredNotifications();
    return res.json({ cleaned: count });
  } catch (error) {
    console.error('Cleanup error:', error);
    return res.status(500).json({ error: 'Failed to cleanup notifications' });
  }
});

export default router;
