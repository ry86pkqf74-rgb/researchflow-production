/**
 * Notification Preferences Manager
 * Task 182: Customizable notification preferences
 */

interface NotificationChannel {
  email: boolean;
  inApp: boolean;
  push: boolean;
  slack?: boolean;
}

interface NotificationPreferences {
  userId: string;
  channels: NotificationChannel;
  events: {
    researchComplete: boolean;
    researchFailed: boolean;
    jobStarted: boolean;
    jobCompleted: boolean;
    dailyDigest: boolean;
    weeklyReport: boolean;
    mentionsAndComments: boolean;
    teamUpdates: boolean;
  };
  quietHours: {
    enabled: boolean;
    startTime: string; // HH:mm format
    endTime: string;
    timezone: string;
  };
  digest: {
    enabled: boolean;
    frequency: 'daily' | 'weekly';
    dayOfWeek?: number; // 0-6 for weekly
    timeOfDay: string; // HH:mm format
  };
  updatedAt: Date;
}

// In-memory store for notification preferences
const preferencesStore = new Map<string, NotificationPreferences>();

/**
 * Default notification preferences
 */
function getDefaultPreferences(userId: string): NotificationPreferences {
  return {
    userId,
    channels: {
      email: true,
      inApp: true,
      push: true,
      slack: false,
    },
    events: {
      researchComplete: true,
      researchFailed: true,
      jobStarted: false,
      jobCompleted: true,
      dailyDigest: false,
      weeklyReport: true,
      mentionsAndComments: true,
      teamUpdates: true,
    },
    quietHours: {
      enabled: false,
      startTime: '22:00',
      endTime: '08:00',
      timezone: 'UTC',
    },
    digest: {
      enabled: true,
      frequency: 'weekly',
      dayOfWeek: 1, // Monday
      timeOfDay: '09:00',
    },
    updatedAt: new Date(),
  };
}

/**
 * Get notification preferences for a user
 */
export function getNotificationPreferences(userId: string): NotificationPreferences {
  const existing = preferencesStore.get(userId);
  if (existing) return existing;

  const defaults = getDefaultPreferences(userId);
  preferencesStore.set(userId, defaults);
  return defaults;
}

/**
 * Update notification preferences
 */
export function updateNotificationPreferences(
  userId: string,
  updates: Partial<Omit<NotificationPreferences, 'userId' | 'updatedAt'>>
): NotificationPreferences {
  const current = getNotificationPreferences(userId);

  const updated: NotificationPreferences = {
    ...current,
    ...updates,
    channels: { ...current.channels, ...updates.channels },
    events: { ...current.events, ...updates.events },
    quietHours: { ...current.quietHours, ...updates.quietHours },
    digest: { ...current.digest, ...updates.digest },
    userId,
    updatedAt: new Date(),
  };

  preferencesStore.set(userId, updated);
  return updated;
}

/**
 * Check if notifications should be delivered during quiet hours
 */
export function isQuietHours(userId: string): boolean {
  const prefs = getNotificationPreferences(userId);

  if (!prefs.quietHours.enabled) return false;

  const now = new Date();
  const currentTime = now.toLocaleTimeString('en-US', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    timeZone: prefs.quietHours.timezone,
  });

  const { startTime, endTime } = prefs.quietHours;

  // Handle overnight quiet hours
  if (startTime > endTime) {
    return currentTime >= startTime || currentTime < endTime;
  }

  return currentTime >= startTime && currentTime < endTime;
}

/**
 * Check if user wants notifications for a specific event
 */
export function shouldNotify(
  userId: string,
  eventType: keyof NotificationPreferences['events'],
  channel: keyof NotificationChannel
): boolean {
  const prefs = getNotificationPreferences(userId);

  // Check if event is enabled
  if (!prefs.events[eventType]) return false;

  // Check if channel is enabled
  if (!prefs.channels[channel]) return false;

  // Check quiet hours (except for in-app which should still accumulate)
  if (channel !== 'inApp' && isQuietHours(userId)) {
    return false;
  }

  return true;
}

/**
 * Get users who should receive a notification for an event
 */
export function getUsersForNotification(
  userIds: string[],
  eventType: keyof NotificationPreferences['events'],
  channel: keyof NotificationChannel
): string[] {
  return userIds.filter((userId) => shouldNotify(userId, eventType, channel));
}

export type { NotificationPreferences, NotificationChannel };
