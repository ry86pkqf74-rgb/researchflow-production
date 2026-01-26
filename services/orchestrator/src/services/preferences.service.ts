/**
 * User Preferences Service
 *
 * Manages user preferences including:
 * - Theme settings (light/dark/system)
 * - Layout preferences (compact/expanded)
 * - Accessibility settings
 * - Feature-specific preferences
 *
 * Tasks: UI/UX Phase 0 (User Preferences)
 */

import { z } from 'zod';

/**
 * Preference schemas
 */
export const ThemePreferenceSchema = z.enum(['light', 'dark', 'system']);
export const LayoutModeSchema = z.enum(['compact', 'expanded', 'auto']);
export const FontSizeSchema = z.enum(['small', 'medium', 'large', 'extra-large']);

export const AccessibilityPreferencesSchema = z.object({
  reducedMotion: z.boolean().default(false),
  highContrast: z.boolean().default(false),
  fontSize: FontSizeSchema.default('medium'),
  screenReaderOptimized: z.boolean().default(false),
  keyboardNavigationHints: z.boolean().default(true),
});

export const NavigationPreferencesSchema = z.object({
  sidebarCollapsed: z.boolean().default(false),
  voiceCommandsEnabled: z.boolean().default(false),
  gestureNavigationEnabled: z.boolean().default(true),
  showBreadcrumbs: z.boolean().default(true),
});

export const NotificationPreferencesSchema = z.object({
  emailNotifications: z.boolean().default(true),
  inAppNotifications: z.boolean().default(true),
  soundEnabled: z.boolean().default(false),
  jobCompletionAlerts: z.boolean().default(true),
  reviewRequestAlerts: z.boolean().default(true),
});

export const WorkflowPreferencesSchema = z.object({
  defaultStage: z.number().int().min(1).max(20).optional(),
  autoAdvanceStages: z.boolean().default(false),
  confirmBeforeAdvance: z.boolean().default(true),
  showStageHints: z.boolean().default(true),
});

export const UserPreferencesSchema = z.object({
  theme: ThemePreferenceSchema.default('system'),
  layoutMode: LayoutModeSchema.default('expanded'),
  language: z.string().default('en'),
  timezone: z.string().default('UTC'),
  accessibility: AccessibilityPreferencesSchema.default({}),
  navigation: NavigationPreferencesSchema.default({}),
  notifications: NotificationPreferencesSchema.default({}),
  workflow: WorkflowPreferencesSchema.default({}),
  customCssVars: z.record(z.string()).optional(),
  lastUpdated: z.string().optional(),
});

export type ThemePreference = z.infer<typeof ThemePreferenceSchema>;
export type LayoutMode = z.infer<typeof LayoutModeSchema>;
export type FontSize = z.infer<typeof FontSizeSchema>;
export type AccessibilityPreferences = z.infer<typeof AccessibilityPreferencesSchema>;
export type NavigationPreferences = z.infer<typeof NavigationPreferencesSchema>;
export type NotificationPreferences = z.infer<typeof NotificationPreferencesSchema>;
export type WorkflowPreferences = z.infer<typeof WorkflowPreferencesSchema>;
export type UserPreferences = z.infer<typeof UserPreferencesSchema>;

/**
 * Default preferences
 */
export const DEFAULT_PREFERENCES: UserPreferences = {
  theme: 'system',
  layoutMode: 'expanded',
  language: 'en',
  timezone: 'UTC',
  accessibility: {
    reducedMotion: false,
    highContrast: false,
    fontSize: 'medium',
    screenReaderOptimized: false,
    keyboardNavigationHints: true,
  },
  navigation: {
    sidebarCollapsed: false,
    voiceCommandsEnabled: false,
    gestureNavigationEnabled: true,
    showBreadcrumbs: true,
  },
  notifications: {
    emailNotifications: true,
    inAppNotifications: true,
    soundEnabled: false,
    jobCompletionAlerts: true,
    reviewRequestAlerts: true,
  },
  workflow: {
    autoAdvanceStages: false,
    confirmBeforeAdvance: true,
    showStageHints: true,
  },
};

/**
 * In-memory cache for preferences (should be replaced with Redis in production)
 */
const preferencesCache = new Map<string, { preferences: UserPreferences; timestamp: number }>();
const CACHE_TTL_MS = 60 * 1000; // 1 minute

/**
 * Preferences storage interface (for dependency injection)
 */
export interface PreferencesStorage {
  get(userId: string): Promise<UserPreferences | null>;
  set(userId: string, preferences: UserPreferences): Promise<void>;
  delete(userId: string): Promise<void>;
}

/**
 * In-memory storage implementation (for development/testing)
 */
class InMemoryPreferencesStorage implements PreferencesStorage {
  private store = new Map<string, UserPreferences>();

  async get(userId: string): Promise<UserPreferences | null> {
    return this.store.get(userId) || null;
  }

  async set(userId: string, preferences: UserPreferences): Promise<void> {
    this.store.set(userId, preferences);
  }

  async delete(userId: string): Promise<void> {
    this.store.delete(userId);
  }
}

/**
 * User Preferences Service
 */
export class PreferencesService {
  private storage: PreferencesStorage;

  constructor(storage?: PreferencesStorage) {
    this.storage = storage || new InMemoryPreferencesStorage();
  }

  /**
   * Get user preferences with defaults
   */
  async getPreferences(userId: string): Promise<UserPreferences> {
    // Check cache first
    const cached = preferencesCache.get(userId);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
      return cached.preferences;
    }

    // Get from storage
    const stored = await this.storage.get(userId);

    // Merge with defaults
    const preferences = stored
      ? this.mergeWithDefaults(stored)
      : { ...DEFAULT_PREFERENCES };

    // Update cache
    preferencesCache.set(userId, { preferences, timestamp: Date.now() });

    return preferences;
  }

  /**
   * Update user preferences (partial update)
   */
  async updatePreferences(
    userId: string,
    updates: Partial<UserPreferences>
  ): Promise<UserPreferences> {
    const current = await this.getPreferences(userId);

    // Deep merge updates
    const updated: UserPreferences = {
      ...current,
      ...updates,
      accessibility: {
        ...current.accessibility,
        ...(updates.accessibility || {}),
      },
      navigation: {
        ...current.navigation,
        ...(updates.navigation || {}),
      },
      notifications: {
        ...current.notifications,
        ...(updates.notifications || {}),
      },
      workflow: {
        ...current.workflow,
        ...(updates.workflow || {}),
      },
      lastUpdated: new Date().toISOString(),
    };

    // Validate
    const validated = UserPreferencesSchema.parse(updated);

    // Save to storage
    await this.storage.set(userId, validated);

    // Update cache
    preferencesCache.set(userId, { preferences: validated, timestamp: Date.now() });

    return validated;
  }

  /**
   * Reset preferences to defaults
   */
  async resetPreferences(userId: string): Promise<UserPreferences> {
    const defaults = { ...DEFAULT_PREFERENCES, lastUpdated: new Date().toISOString() };
    await this.storage.set(userId, defaults);
    preferencesCache.set(userId, { preferences: defaults, timestamp: Date.now() });
    return defaults;
  }

  /**
   * Delete user preferences
   */
  async deletePreferences(userId: string): Promise<void> {
    await this.storage.delete(userId);
    preferencesCache.delete(userId);
  }

  /**
   * Get a specific preference value
   */
  async getPreference<K extends keyof UserPreferences>(
    userId: string,
    key: K
  ): Promise<UserPreferences[K]> {
    const prefs = await this.getPreferences(userId);
    return prefs[key];
  }

  /**
   * Update a specific preference value
   */
  async setPreference<K extends keyof UserPreferences>(
    userId: string,
    key: K,
    value: UserPreferences[K]
  ): Promise<UserPreferences> {
    return this.updatePreferences(userId, { [key]: value } as Partial<UserPreferences>);
  }

  /**
   * Merge stored preferences with defaults
   */
  private mergeWithDefaults(stored: Partial<UserPreferences>): UserPreferences {
    return {
      theme: stored.theme ?? DEFAULT_PREFERENCES.theme,
      layoutMode: stored.layoutMode ?? DEFAULT_PREFERENCES.layoutMode,
      language: stored.language ?? DEFAULT_PREFERENCES.language,
      timezone: stored.timezone ?? DEFAULT_PREFERENCES.timezone,
      accessibility: {
        ...DEFAULT_PREFERENCES.accessibility,
        ...(stored.accessibility || {}),
      },
      navigation: {
        ...DEFAULT_PREFERENCES.navigation,
        ...(stored.navigation || {}),
      },
      notifications: {
        ...DEFAULT_PREFERENCES.notifications,
        ...(stored.notifications || {}),
      },
      workflow: {
        ...DEFAULT_PREFERENCES.workflow,
        ...(stored.workflow || {}),
      },
      customCssVars: stored.customCssVars,
      lastUpdated: stored.lastUpdated,
    };
  }

  /**
   * Invalidate cache for a user
   */
  invalidateCache(userId: string): void {
    preferencesCache.delete(userId);
  }

  /**
   * Clear all cached preferences
   */
  clearCache(): void {
    preferencesCache.clear();
  }
}

/**
 * Singleton instance
 */
let preferencesServiceInstance: PreferencesService | null = null;

export function getPreferencesService(): PreferencesService {
  if (!preferencesServiceInstance) {
    preferencesServiceInstance = new PreferencesService();
  }
  return preferencesServiceInstance;
}
