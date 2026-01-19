/**
 * Extension Manager
 * Task 185: Plugin/extension system for custom workflows
 */

import crypto from 'crypto';

interface ExtensionManifest {
  id: string;
  name: string;
  version: string;
  description: string;
  author: string;
  homepage?: string;
  repository?: string;
  main: string;
  permissions: ExtensionPermission[];
  hooks?: string[];
  settings?: ExtensionSetting[];
}

interface ExtensionPermission {
  name: string;
  description: string;
  required: boolean;
}

interface ExtensionSetting {
  key: string;
  type: 'string' | 'number' | 'boolean' | 'select';
  label: string;
  description?: string;
  default?: unknown;
  options?: { label: string; value: string }[];
}

interface ExtensionInstance {
  manifest: ExtensionManifest;
  enabled: boolean;
  installedAt: Date;
  settings: Record<string, unknown>;
  grantedPermissions: string[];
}

interface ExtensionHook {
  name: string;
  handler: (context: HookContext) => Promise<HookResult>;
}

interface HookContext {
  event: string;
  data: Record<string, unknown>;
  extensionId: string;
}

interface HookResult {
  success: boolean;
  data?: Record<string, unknown>;
  error?: string;
}

// Extension store
const extensionStore = new Map<string, ExtensionInstance>();
const hookRegistry = new Map<string, ExtensionHook[]>();

// Built-in extension hooks
const AVAILABLE_HOOKS = [
  'research:created',
  'research:updated',
  'research:completed',
  'research:failed',
  'job:started',
  'job:completed',
  'artifact:created',
  'manuscript:generated',
  'user:login',
  'integration:connected',
] as const;

/**
 * Install an extension
 */
export function installExtension(
  manifest: ExtensionManifest,
  grantedPermissions: string[]
): ExtensionInstance {
  const instance: ExtensionInstance = {
    manifest,
    enabled: true,
    installedAt: new Date(),
    settings: {},
    grantedPermissions,
  };

  // Set default settings
  if (manifest.settings) {
    for (const setting of manifest.settings) {
      if (setting.default !== undefined) {
        instance.settings[setting.key] = setting.default;
      }
    }
  }

  extensionStore.set(manifest.id, instance);
  return instance;
}

/**
 * Uninstall an extension
 */
export function uninstallExtension(extensionId: string): boolean {
  // Remove hooks
  for (const [hookName, hooks] of hookRegistry) {
    const filtered = hooks.filter((h) => {
      const parts = h.name.split(':');
      return parts[0] !== extensionId;
    });
    hookRegistry.set(hookName, filtered);
  }

  return extensionStore.delete(extensionId);
}

/**
 * Enable/disable an extension
 */
export function setExtensionEnabled(extensionId: string, enabled: boolean): boolean {
  const instance = extensionStore.get(extensionId);
  if (!instance) return false;

  instance.enabled = enabled;
  extensionStore.set(extensionId, instance);
  return true;
}

/**
 * Get an extension
 */
export function getExtension(extensionId: string): ExtensionInstance | undefined {
  return extensionStore.get(extensionId);
}

/**
 * List all extensions
 */
export function listExtensions(): ExtensionInstance[] {
  return Array.from(extensionStore.values());
}

/**
 * Update extension settings
 */
export function updateExtensionSettings(
  extensionId: string,
  settings: Record<string, unknown>
): ExtensionInstance | undefined {
  const instance = extensionStore.get(extensionId);
  if (!instance) return undefined;

  instance.settings = { ...instance.settings, ...settings };
  extensionStore.set(extensionId, instance);
  return instance;
}

/**
 * Register a hook handler
 */
export function registerHook(
  extensionId: string,
  hookName: string,
  handler: (context: HookContext) => Promise<HookResult>
): void {
  const extension = extensionStore.get(extensionId);
  if (!extension || !extension.enabled) {
    throw new Error(`Extension ${extensionId} is not installed or disabled`);
  }

  const hooks = hookRegistry.get(hookName) || [];
  hooks.push({
    name: `${extensionId}:${hookName}`,
    handler,
  });
  hookRegistry.set(hookName, hooks);
}

/**
 * Unregister a hook handler
 */
export function unregisterHook(extensionId: string, hookName: string): void {
  const hooks = hookRegistry.get(hookName);
  if (!hooks) return;

  const filtered = hooks.filter((h) => h.name !== `${extensionId}:${hookName}`);
  hookRegistry.set(hookName, filtered);
}

/**
 * Trigger hooks for an event
 */
export async function triggerHooks(
  hookName: string,
  data: Record<string, unknown>
): Promise<HookResult[]> {
  const hooks = hookRegistry.get(hookName) || [];
  const results: HookResult[] = [];

  for (const hook of hooks) {
    const extensionId = hook.name.split(':')[0];
    const extension = extensionStore.get(extensionId);

    if (!extension || !extension.enabled) continue;

    try {
      const result = await hook.handler({
        event: hookName,
        data,
        extensionId,
      });
      results.push(result);
    } catch (error: any) {
      results.push({
        success: false,
        error: error.message,
      });
    }
  }

  return results;
}

/**
 * Get available hooks
 */
export function getAvailableHooks(): readonly string[] {
  return AVAILABLE_HOOKS;
}

/**
 * Validate extension manifest
 */
export function validateManifest(manifest: unknown): manifest is ExtensionManifest {
  if (!manifest || typeof manifest !== 'object') return false;

  const m = manifest as Record<string, unknown>;

  return (
    typeof m.id === 'string' &&
    typeof m.name === 'string' &&
    typeof m.version === 'string' &&
    typeof m.description === 'string' &&
    typeof m.author === 'string' &&
    typeof m.main === 'string' &&
    Array.isArray(m.permissions)
  );
}

/**
 * Generate extension ID
 */
export function generateExtensionId(name: string, author: string): string {
  const base = `${author}/${name}`.toLowerCase().replace(/[^a-z0-9/-]/g, '-');
  const hash = crypto.createHash('sha256').update(base).digest('hex').slice(0, 8);
  return `${base}-${hash}`;
}

export type { ExtensionManifest, ExtensionInstance, ExtensionHook, HookContext, HookResult };
