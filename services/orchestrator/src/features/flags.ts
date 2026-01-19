/**
 * Feature Flags Service
 * Task 175: Feature flags for gradual rollouts
 */

interface FeatureFlag {
  name: string;
  enabled: boolean;
  description?: string;
  percentage?: number;
  allowedUsers?: string[];
  allowedOrgs?: string[];
  startDate?: Date;
  endDate?: Date;
  metadata?: Record<string, unknown>;
}

interface FlagContext {
  userId?: string;
  orgId?: string;
  environment?: string;
  attributes?: Record<string, unknown>;
}

// In-memory store for feature flags
const flagStore = new Map<string, FeatureFlag>();

// Default flags
const defaultFlags: FeatureFlag[] = [
  {
    name: 'ai_research_assistant',
    enabled: true,
    description: 'AI-powered research assistance',
    percentage: 100,
  },
  {
    name: 'advanced_analytics',
    enabled: true,
    description: 'Advanced analytics dashboard',
    percentage: 100,
  },
  {
    name: 'notion_integration',
    enabled: true,
    description: 'Notion integration for notes',
    percentage: 100,
  },
  {
    name: 'slack_notifications',
    enabled: true,
    description: 'Slack notification integration',
    percentage: 100,
  },
  {
    name: 'github_tracking',
    enabled: true,
    description: 'GitHub issue tracking',
    percentage: 100,
  },
  {
    name: 'zoom_collaboration',
    enabled: false,
    description: 'Zoom meeting integration',
    percentage: 50,
  },
  {
    name: 'offline_mode',
    enabled: true,
    description: 'Offline dashboard caching',
    percentage: 100,
  },
  {
    name: 'dark_mode',
    enabled: true,
    description: 'Dark mode theme support',
    percentage: 100,
  },
  {
    name: 'pwa_install',
    enabled: true,
    description: 'PWA install prompt',
    percentage: 100,
  },
  {
    name: 'extension_system',
    enabled: false,
    description: 'Extension marketplace',
    percentage: 0,
  },
  {
    name: 'quantum_computing',
    enabled: false,
    description: 'Quantum computing stubs',
    percentage: 0,
  },
  {
    name: 'ipfs_storage',
    enabled: false,
    description: 'IPFS distributed storage',
    percentage: 0,
  },
];

// Initialize default flags
defaultFlags.forEach((flag) => flagStore.set(flag.name, flag));

/**
 * Check if a feature flag is enabled
 */
export function isFeatureEnabled(flagName: string, context?: FlagContext): boolean {
  const flag = flagStore.get(flagName);

  if (!flag) {
    return false;
  }

  if (!flag.enabled) {
    return false;
  }

  // Check date range
  const now = new Date();
  if (flag.startDate && now < flag.startDate) {
    return false;
  }
  if (flag.endDate && now > flag.endDate) {
    return false;
  }

  // Check user/org allowlists
  if (context?.userId && flag.allowedUsers?.length) {
    if (flag.allowedUsers.includes(context.userId)) {
      return true;
    }
  }

  if (context?.orgId && flag.allowedOrgs?.length) {
    if (flag.allowedOrgs.includes(context.orgId)) {
      return true;
    }
  }

  // Check percentage rollout
  if (flag.percentage !== undefined && flag.percentage < 100) {
    if (context?.userId) {
      const hash = hashString(context.userId + flagName);
      return (hash % 100) < flag.percentage;
    }
    return Math.random() * 100 < flag.percentage;
  }

  return true;
}

/**
 * Get all feature flags
 */
export function getAllFlags(): FeatureFlag[] {
  return Array.from(flagStore.values());
}

/**
 * Get a specific feature flag
 */
export function getFlag(flagName: string): FeatureFlag | undefined {
  return flagStore.get(flagName);
}

/**
 * Set a feature flag
 */
export function setFlag(flag: FeatureFlag): void {
  flagStore.set(flag.name, flag);
}

/**
 * Update a feature flag
 */
export function updateFlag(
  flagName: string,
  updates: Partial<Omit<FeatureFlag, 'name'>>
): FeatureFlag | undefined {
  const existing = flagStore.get(flagName);
  if (!existing) {
    return undefined;
  }

  const updated = { ...existing, ...updates };
  flagStore.set(flagName, updated);
  return updated;
}

/**
 * Delete a feature flag
 */
export function deleteFlag(flagName: string): boolean {
  return flagStore.delete(flagName);
}

/**
 * Evaluate multiple flags for a context
 */
export function evaluateFlags(
  flagNames: string[],
  context?: FlagContext
): Record<string, boolean> {
  const results: Record<string, boolean> = {};
  for (const name of flagNames) {
    results[name] = isFeatureEnabled(name, context);
  }
  return results;
}

/**
 * Get all enabled flags for a context
 */
export function getEnabledFlags(context?: FlagContext): string[] {
  const enabled: string[] = [];
  for (const [name] of flagStore) {
    if (isFeatureEnabled(name, context)) {
      enabled.push(name);
    }
  }
  return enabled;
}

/**
 * Simple hash function for consistent percentage rollout
 */
function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash);
}

export type { FeatureFlag, FlagContext };
