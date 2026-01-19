/**
 * Extension Hooks System - Task 174
 *
 * Safe hook registry for extending orchestrator behavior.
 * Hooks are disabled by default unless EXTENSIONS_ENABLED=true.
 */

// Types defined locally to avoid circular dependencies

export type ExtensionHookType =
  | 'beforeJobDispatch'
  | 'afterWorkerResult'
  | 'onManifestFinalized'
  | 'onIntegrationSync'
  | 'onQuarantineApplied'
  | 'onUserAction';

export interface ExtensionHook<T = unknown, R = void> {
  name: string;
  type: ExtensionHookType;
  priority?: number;
  enabled: boolean;
  handler: (context: T) => Promise<R>;
  timeoutMs?: number;
}

export interface ExtensionConfig {
  enabled: boolean;
  allowedHooks: ExtensionHookType[];
  maxExecutionTimeMs: number;
  failOnError: boolean;
}

/**
 * Default extension configuration
 */
const defaultConfig: ExtensionConfig = {
  enabled: process.env.EXTENSIONS_ENABLED === 'true',
  allowedHooks: [
    'beforeJobDispatch',
    'afterWorkerResult',
    'onManifestFinalized',
    'onIntegrationSync',
    'onQuarantineApplied',
    'onUserAction',
  ],
  maxExecutionTimeMs: 30000,
  failOnError: false,
};

/**
 * Hook registry by type
 */
const hookRegistry = new Map<ExtensionHookType, ExtensionHook[]>();

/**
 * Current configuration
 */
let config: ExtensionConfig = { ...defaultConfig };

/**
 * Initialize the extension system
 */
export function initExtensions(customConfig?: Partial<ExtensionConfig>): void {
  config = { ...defaultConfig, ...customConfig };

  if (!config.enabled) {
    console.log('[Extensions] Extension hooks are disabled');
    return;
  }

  console.log('[Extensions] Extension hooks enabled');
  console.log('[Extensions] Allowed hooks:', config.allowedHooks.join(', '));
}

/**
 * Register a hook
 */
export function registerHook<T = unknown, R = void>(
  hook: ExtensionHook<T, R>
): void {
  if (!config.enabled) {
    console.warn(`[Extensions] Cannot register hook "${hook.name}" - extensions disabled`);
    return;
  }

  if (!config.allowedHooks.includes(hook.type)) {
    throw new Error(
      `Hook type "${hook.type}" is not allowed. Allowed: ${config.allowedHooks.join(', ')}`
    );
  }

  const hooks = hookRegistry.get(hook.type) ?? [];

  // Remove existing hook with same name
  const existingIndex = hooks.findIndex(h => h.name === hook.name);
  if (existingIndex >= 0) {
    hooks.splice(existingIndex, 1);
  }

  // Add hook and sort by priority
  hooks.push(hook as ExtensionHook);
  hooks.sort((a, b) => (a.priority ?? 100) - (b.priority ?? 100));

  hookRegistry.set(hook.type, hooks);

  console.log(
    `[Extensions] Registered hook "${hook.name}" (type: ${hook.type}, priority: ${hook.priority ?? 100})`
  );
}

/**
 * Unregister a hook by name
 */
export function unregisterHook(name: string): boolean {
  for (const [type, hooks] of hookRegistry.entries()) {
    const index = hooks.findIndex(h => h.name === name);
    if (index >= 0) {
      hooks.splice(index, 1);
      console.log(`[Extensions] Unregistered hook "${name}"`);
      return true;
    }
  }
  return false;
}

/**
 * Execute hooks of a specific type
 */
export async function executeHooks<T, R = void>(
  type: ExtensionHookType,
  context: T
): Promise<R[]> {
  if (!config.enabled) {
    return [];
  }

  const hooks = hookRegistry.get(type) ?? [];
  const enabledHooks = hooks.filter(h => h.enabled);

  if (enabledHooks.length === 0) {
    return [];
  }

  const results: R[] = [];
  const startTime = Date.now();

  for (const hook of enabledHooks) {
    // Check total execution time
    if (Date.now() - startTime > config.maxExecutionTimeMs) {
      console.warn(
        `[Extensions] Max execution time exceeded for ${type} hooks, skipping remaining`
      );
      break;
    }

    try {
      const hookTimeout = hook.timeoutMs ?? 5000;
      const result = await executeWithTimeout(
        hook.handler(context),
        hookTimeout,
        `Hook "${hook.name}" timed out after ${hookTimeout}ms`
      );
      results.push(result as R);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`[Extensions] Hook "${hook.name}" failed: ${errorMessage}`);

      if (config.failOnError || hook.timeoutMs === undefined) {
        throw error;
      }
    }
  }

  return results;
}

/**
 * Execute a promise with timeout
 */
async function executeWithTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  timeoutMessage: string
): Promise<T> {
  let timeoutId: NodeJS.Timeout;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error(timeoutMessage));
    }, timeoutMs);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    clearTimeout(timeoutId!);
  }
}

/**
 * Get all registered hooks
 */
export function getRegisteredHooks(): Map<ExtensionHookType, ExtensionHook[]> {
  return new Map(hookRegistry);
}

/**
 * Get hooks for a specific type
 */
export function getHooksForType(type: ExtensionHookType): ExtensionHook[] {
  return [...(hookRegistry.get(type) ?? [])];
}

/**
 * Check if extensions are enabled
 */
export function isExtensionsEnabled(): boolean {
  return config.enabled;
}

/**
 * Get current configuration
 */
export function getExtensionConfig(): ExtensionConfig {
  return { ...config };
}

/**
 * Clear all hooks (for testing)
 */
export function clearAllHooks(): void {
  hookRegistry.clear();
}

// ============================================================================
// Pre-defined hook contexts
// ============================================================================

export interface BeforeJobDispatchContext {
  jobId: string;
  jobType: string;
  inputs: unknown;
  userId?: string;
  workflowId?: string;
}

export interface AfterWorkerResultContext {
  jobId: string;
  jobType: string;
  success: boolean;
  result?: unknown;
  error?: Error;
  durationMs: number;
}

export interface OnManifestFinalizedContext {
  manifestId: string;
  jobId: string;
  status: string;
  qualityScore?: number;
  quarantined: boolean;
}

export interface OnIntegrationSyncContext {
  connectionId: string;
  provider: string;
  userId: string;
  itemsSynced: number;
  success: boolean;
}

export interface OnQuarantineAppliedContext {
  manifestId: string;
  reasonCodes: string[];
  triggeredRule?: string;
}

export interface OnUserActionContext {
  userId: string;
  action: string;
  resourceType?: string;
  resourceId?: string;
  metadata?: Record<string, unknown>;
}

export default {
  initExtensions,
  registerHook,
  unregisterHook,
  executeHooks,
  getRegisteredHooks,
  getHooksForType,
  isExtensionsEnabled,
  getExtensionConfig,
  clearAllHooks,
};
