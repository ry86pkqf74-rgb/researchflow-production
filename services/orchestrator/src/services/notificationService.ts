/**
 * Notification Service (Task 82)
 * Centralized notification management for in-app, email, and webhook delivery
 *
 * Security: No PHI in notification content - only references/IDs
 */

import { z } from 'zod';
import crypto from 'crypto';

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

export const NotificationTypeSchema = z.enum([
  // Comments & Collaboration
  'COMMENT_ADDED',
  'COMMENT_REPLY',
  'COMMENT_MENTION',
  'COMMENT_RESOLVED',

  // Claims & Evidence
  'CLAIM_CREATED',
  'CLAIM_DISPUTED',
  'CLAIM_VERIFIED',
  'EVIDENCE_LINKED',

  // Reviews & Submissions
  'REVIEW_REQUESTED',
  'REVIEW_COMPLETED',
  'SUBMISSION_STATUS_CHANGE',
  'REVIEWER_FEEDBACK',

  // Tasks
  'TASK_ASSIGNED',
  'TASK_DUE_SOON',
  'TASK_OVERDUE',
  'TASK_COMPLETED',
  'TASK_MENTIONED',

  // Shares & Access
  'SHARE_CREATED',
  'SHARE_REVOKED',
  'SHARE_EXPIRING',
  'ACCESS_GRANTED',
  'ACCESS_REVOKED',

  // System
  'SYSTEM_ANNOUNCEMENT',
  'MAINTENANCE_SCHEDULED',
  'EXPORT_READY',
  'IMPORT_COMPLETED',
]);
export type NotificationType = z.infer<typeof NotificationTypeSchema>;

export const NotificationPrioritySchema = z.enum(['LOW', 'NORMAL', 'HIGH', 'URGENT']);
export type NotificationPriority = z.infer<typeof NotificationPrioritySchema>;

export const DeliveryChannelSchema = z.enum(['IN_APP', 'EMAIL', 'SLACK', 'WEBHOOK']);
export type DeliveryChannel = z.infer<typeof DeliveryChannelSchema>;

export const NotificationSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  type: NotificationTypeSchema,
  priority: NotificationPrioritySchema,
  title: z.string().max(200),
  body: z.string().max(1000),
  actionUrl: z.string().url().optional(),
  actionLabel: z.string().max(50).optional(),
  resourceType: z.string().optional(), // e.g., 'comment', 'task', 'submission'
  resourceId: z.string().uuid().optional(),
  metadata: z.record(z.unknown()).optional(),
  read: z.boolean().default(false),
  readAt: z.string().datetime().optional(),
  dismissed: z.boolean().default(false),
  dismissedAt: z.string().datetime().optional(),
  deliveredChannels: z.array(DeliveryChannelSchema).default([]),
  createdAt: z.string().datetime(),
  expiresAt: z.string().datetime().optional(),
});
export type Notification = z.infer<typeof NotificationSchema>;

export const NotificationPreferencesSchema = z.object({
  userId: z.string().uuid(),

  // Channel preferences by notification type
  channelPreferences: z.record(NotificationTypeSchema, z.object({
    enabled: z.boolean().default(true),
    channels: z.array(DeliveryChannelSchema).default(['IN_APP']),
  })).optional(),

  // Global settings
  emailEnabled: z.boolean().default(true),
  slackEnabled: z.boolean().default(false),
  webhookEnabled: z.boolean().default(false),
  webhookUrl: z.string().url().optional(),

  // Digest settings
  digestEnabled: z.boolean().default(false),
  digestFrequency: z.enum(['DAILY', 'WEEKLY']).default('DAILY'),
  digestTime: z.string().regex(/^\d{2}:\d{2}$/).default('09:00'), // HH:mm

  // Quiet hours
  quietHoursEnabled: z.boolean().default(false),
  quietHoursStart: z.string().regex(/^\d{2}:\d{2}$/).default('22:00'),
  quietHoursEnd: z.string().regex(/^\d{2}:\d{2}$/).default('07:00'),

  updatedAt: z.string().datetime(),
});
export type NotificationPreferences = z.infer<typeof NotificationPreferencesSchema>;

export const CreateNotificationSchema = z.object({
  userId: z.string().uuid(),
  type: NotificationTypeSchema,
  priority: NotificationPrioritySchema.default('NORMAL'),
  title: z.string().max(200),
  body: z.string().max(1000),
  actionUrl: z.string().url().optional(),
  actionLabel: z.string().max(50).optional(),
  resourceType: z.string().optional(),
  resourceId: z.string().uuid().optional(),
  metadata: z.record(z.unknown()).optional(),
  expiresAt: z.string().datetime().optional(),
});
export type CreateNotificationInput = z.infer<typeof CreateNotificationSchema>;

// ---------------------------------------------------------------------------
// In-Memory Storage (would be database in production)
// ---------------------------------------------------------------------------

const notifications = new Map<string, Notification>();
const preferences = new Map<string, NotificationPreferences>();
const pendingDigests = new Map<string, Notification[]>();

// ---------------------------------------------------------------------------
// Notification Operations
// ---------------------------------------------------------------------------

export async function createNotification(input: CreateNotificationInput): Promise<Notification> {
  const validated = CreateNotificationSchema.parse(input);

  const notification: Notification = {
    id: crypto.randomUUID(),
    userId: validated.userId,
    type: validated.type,
    priority: validated.priority,
    title: validated.title,
    body: validated.body,
    actionUrl: validated.actionUrl,
    actionLabel: validated.actionLabel,
    resourceType: validated.resourceType,
    resourceId: validated.resourceId,
    metadata: validated.metadata,
    read: false,
    dismissed: false,
    deliveredChannels: ['IN_APP'], // Always deliver in-app
    createdAt: new Date().toISOString(),
    expiresAt: validated.expiresAt,
  };

  notifications.set(notification.id, notification);

  // Check preferences and deliver to other channels
  const userPrefs = preferences.get(validated.userId);
  if (userPrefs) {
    await deliverToChannels(notification, userPrefs);
  }

  return notification;
}

export function getNotification(notificationId: string): Notification | undefined {
  return notifications.get(notificationId);
}

export function getUserNotifications(
  userId: string,
  options?: {
    unreadOnly?: boolean;
    type?: NotificationType;
    limit?: number;
    offset?: number;
  }
): { notifications: Notification[]; total: number; unreadCount: number } {
  let userNotifications = Array.from(notifications.values())
    .filter(n => n.userId === userId && !n.dismissed)
    .filter(n => !n.expiresAt || new Date(n.expiresAt) > new Date());

  const unreadCount = userNotifications.filter(n => !n.read).length;

  if (options?.unreadOnly) {
    userNotifications = userNotifications.filter(n => !n.read);
  }

  if (options?.type) {
    userNotifications = userNotifications.filter(n => n.type === options.type);
  }

  // Sort by priority (urgent first) then by date (newest first)
  const priorityOrder: Record<NotificationPriority, number> = {
    URGENT: 0,
    HIGH: 1,
    NORMAL: 2,
    LOW: 3,
  };

  userNotifications.sort((a, b) => {
    const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
    if (priorityDiff !== 0) return priorityDiff;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  const total = userNotifications.length;

  if (options?.offset) {
    userNotifications = userNotifications.slice(options.offset);
  }

  if (options?.limit) {
    userNotifications = userNotifications.slice(0, options.limit);
  }

  return { notifications: userNotifications, total, unreadCount };
}

export function markAsRead(notificationId: string, userId: string): Notification | undefined {
  const notification = notifications.get(notificationId);
  if (!notification || notification.userId !== userId) return undefined;

  notification.read = true;
  notification.readAt = new Date().toISOString();
  notifications.set(notificationId, notification);

  return notification;
}

export function markAllAsRead(userId: string): number {
  const now = new Date().toISOString();
  let count = 0;

  for (const notification of notifications.values()) {
    if (notification.userId === userId && !notification.read) {
      notification.read = true;
      notification.readAt = now;
      notifications.set(notification.id, notification);
      count++;
    }
  }

  return count;
}

export function dismissNotification(notificationId: string, userId: string): boolean {
  const notification = notifications.get(notificationId);
  if (!notification || notification.userId !== userId) return false;

  notification.dismissed = true;
  notification.dismissedAt = new Date().toISOString();
  notifications.set(notificationId, notification);

  return true;
}

export function dismissAllRead(userId: string): number {
  const now = new Date().toISOString();
  let count = 0;

  for (const notification of notifications.values()) {
    if (notification.userId === userId && notification.read && !notification.dismissed) {
      notification.dismissed = true;
      notification.dismissedAt = now;
      notifications.set(notification.id, notification);
      count++;
    }
  }

  return count;
}

// ---------------------------------------------------------------------------
// Preference Operations
// ---------------------------------------------------------------------------

export function getPreferences(userId: string): NotificationPreferences {
  const existing = preferences.get(userId);
  if (existing) return existing;

  // Return defaults
  const defaults: NotificationPreferences = {
    userId,
    emailEnabled: true,
    slackEnabled: false,
    webhookEnabled: false,
    digestEnabled: false,
    digestFrequency: 'DAILY',
    digestTime: '09:00',
    quietHoursEnabled: false,
    quietHoursStart: '22:00',
    quietHoursEnd: '07:00',
    updatedAt: new Date().toISOString(),
  };

  return defaults;
}

export function updatePreferences(
  userId: string,
  updates: Partial<Omit<NotificationPreferences, 'userId' | 'updatedAt'>>
): NotificationPreferences {
  const existing = getPreferences(userId);

  const updated: NotificationPreferences = {
    ...existing,
    ...updates,
    userId,
    updatedAt: new Date().toISOString(),
  };

  preferences.set(userId, updated);
  return updated;
}

// ---------------------------------------------------------------------------
// Delivery Functions
// ---------------------------------------------------------------------------

async function deliverToChannels(
  notification: Notification,
  prefs: NotificationPreferences
): Promise<void> {
  // Check quiet hours
  if (prefs.quietHoursEnabled && isQuietHours(prefs)) {
    if (notification.priority !== 'URGENT') {
      // Queue for digest instead
      queueForDigest(notification);
      return;
    }
  }

  // Check type-specific preferences
  const typePrefs = prefs.channelPreferences?.[notification.type];
  if (typePrefs && !typePrefs.enabled) {
    return; // User disabled this notification type
  }

  const channels = typePrefs?.channels || ['IN_APP'];

  // Deliver to each enabled channel
  for (const channel of channels) {
    switch (channel) {
      case 'EMAIL':
        if (prefs.emailEnabled) {
          await deliverEmail(notification);
          notification.deliveredChannels.push('EMAIL');
        }
        break;

      case 'SLACK':
        if (prefs.slackEnabled) {
          await deliverSlack(notification);
          notification.deliveredChannels.push('SLACK');
        }
        break;

      case 'WEBHOOK':
        if (prefs.webhookEnabled && prefs.webhookUrl) {
          await deliverWebhook(notification, prefs.webhookUrl);
          notification.deliveredChannels.push('WEBHOOK');
        }
        break;
    }
  }

  notifications.set(notification.id, notification);
}

function isQuietHours(prefs: NotificationPreferences): boolean {
  const now = new Date();
  const hours = now.getHours();
  const minutes = now.getMinutes();
  const currentTime = hours * 60 + minutes;

  const [startH, startM] = prefs.quietHoursStart.split(':').map(Number);
  const [endH, endM] = prefs.quietHoursEnd.split(':').map(Number);
  const startTime = startH * 60 + startM;
  const endTime = endH * 60 + endM;

  // Handle overnight quiet hours (e.g., 22:00 to 07:00)
  if (startTime > endTime) {
    return currentTime >= startTime || currentTime < endTime;
  }

  return currentTime >= startTime && currentTime < endTime;
}

function queueForDigest(notification: Notification): void {
  const existing = pendingDigests.get(notification.userId) || [];
  existing.push(notification);
  pendingDigests.set(notification.userId, existing);
}

// Placeholder delivery functions (would integrate with actual services)
async function deliverEmail(notification: Notification): Promise<void> {
  // In production: integrate with email service (SendGrid, SES, etc.)
  console.log(`[EMAIL] Would send to user ${notification.userId}: ${notification.title}`);
}

async function deliverSlack(notification: Notification): Promise<void> {
  // In production: integrate with Slack webhook
  console.log(`[SLACK] Would send to user ${notification.userId}: ${notification.title}`);
}

async function deliverWebhook(notification: Notification, webhookUrl: string): Promise<void> {
  // In production: POST to webhook URL
  console.log(`[WEBHOOK] Would POST to ${webhookUrl}: ${notification.title}`);
}

// ---------------------------------------------------------------------------
// Bulk Notification Helpers
// ---------------------------------------------------------------------------

export async function notifyCommentMention(
  mentionedUserIds: string[],
  commenterId: string,
  artifactId: string,
  commentId: string
): Promise<Notification[]> {
  const created: Notification[] = [];

  for (const userId of mentionedUserIds) {
    if (userId === commenterId) continue; // Don't notify self

    const notification = await createNotification({
      userId,
      type: 'COMMENT_MENTION',
      priority: 'HIGH',
      title: 'You were mentioned in a comment',
      body: 'Someone mentioned you in a comment. Click to view.',
      actionUrl: `/artifacts/${artifactId}/comments/${commentId}`,
      actionLabel: 'View Comment',
      resourceType: 'comment',
      resourceId: commentId,
      metadata: { artifactId, commenterId },
    });

    created.push(notification);
  }

  return created;
}

export async function notifyTaskAssignment(
  assigneeId: string,
  taskId: string,
  taskTitle: string,
  assignerId: string
): Promise<Notification> {
  return createNotification({
    userId: assigneeId,
    type: 'TASK_ASSIGNED',
    priority: 'NORMAL',
    title: 'New task assigned to you',
    body: `You have been assigned: ${taskTitle}`,
    actionUrl: `/tasks/${taskId}`,
    actionLabel: 'View Task',
    resourceType: 'task',
    resourceId: taskId,
    metadata: { assignerId },
  });
}

export async function notifyReviewRequest(
  reviewerId: string,
  submissionId: string,
  submissionTitle: string,
  requesterId: string
): Promise<Notification> {
  return createNotification({
    userId: reviewerId,
    type: 'REVIEW_REQUESTED',
    priority: 'HIGH',
    title: 'Review requested',
    body: `Your review is requested for: ${submissionTitle}`,
    actionUrl: `/submissions/${submissionId}/review`,
    actionLabel: 'Start Review',
    resourceType: 'submission',
    resourceId: submissionId,
    metadata: { requesterId },
  });
}

export async function notifyDueSoonTasks(
  userId: string,
  tasks: Array<{ id: string; title: string; dueDate: string }>
): Promise<Notification> {
  const taskList = tasks.map(t => t.title).join(', ');

  return createNotification({
    userId,
    type: 'TASK_DUE_SOON',
    priority: 'HIGH',
    title: `${tasks.length} task(s) due soon`,
    body: `The following tasks are due soon: ${taskList}`,
    actionUrl: '/tasks?filter=due_soon',
    actionLabel: 'View Tasks',
    metadata: { taskIds: tasks.map(t => t.id) },
  });
}

// ---------------------------------------------------------------------------
// Cleanup & Maintenance
// ---------------------------------------------------------------------------

export function cleanupExpiredNotifications(): number {
  const now = new Date();
  let count = 0;

  for (const [id, notification] of notifications.entries()) {
    if (notification.expiresAt && new Date(notification.expiresAt) < now) {
      notifications.delete(id);
      count++;
    }
  }

  return count;
}

export function getNotificationStats(userId: string): {
  total: number;
  unread: number;
  byType: Record<NotificationType, number>;
  byPriority: Record<NotificationPriority, number>;
} {
  const userNotifications = Array.from(notifications.values())
    .filter(n => n.userId === userId && !n.dismissed);

  const byType = {} as Record<NotificationType, number>;
  const byPriority = {} as Record<NotificationPriority, number>;

  for (const n of userNotifications) {
    byType[n.type] = (byType[n.type] || 0) + 1;
    byPriority[n.priority] = (byPriority[n.priority] || 0) + 1;
  }

  return {
    total: userNotifications.length,
    unread: userNotifications.filter(n => !n.read).length,
    byType,
    byPriority,
  };
}
