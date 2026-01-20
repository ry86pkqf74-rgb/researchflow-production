/**
 * Plugin Marketplace Service
 * Task 137 - Plugin marketplace for third-party stage extensions
 *
 * Manages plugin registry, installation, and lifecycle
 * with security-first approach (integrity checks, permissions, sandboxing)
 */

import { z } from 'zod';
import crypto from 'crypto';

// ─────────────────────────────────────────────────────────────
// Types & Schemas
// ─────────────────────────────────────────────────────────────

export const PluginPermissionSchema = z.enum([
  'STAGE_EXTENSION',       // Can add custom workflow stages
  'AI_MODEL_PROVIDER',     // Can register AI model providers
  'IMPORT_CONNECTOR',      // Can import data from external sources
  'EXPORT_INTEGRATION',    // Can export data to external services
  'ARTIFACT_READ',         // Can read artifact metadata (PHI-scrubbed)
  'ARTIFACT_WRITE',        // Can create/modify artifacts
  'NOTIFICATION_SEND',     // Can send notifications
  'WEBHOOK_REGISTER',      // Can register webhooks
]);

export const PluginCategorySchema = z.enum([
  'WORKFLOW',
  'AI_MODELS',
  'DATA_IMPORT',
  'DATA_EXPORT',
  'VISUALIZATION',
  'COLLABORATION',
  'ANALYTICS',
  'UTILITIES',
]);

export const PluginStatusSchema = z.enum([
  'DRAFT',
  'PENDING_REVIEW',
  'APPROVED',
  'REJECTED',
  'DEPRECATED',
]);

export const PluginManifestSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+(\.[a-z0-9-]+)*$/), // e.g., "com.vendor.stage-x"
  name: z.string().min(3).max(100),
  version: z.string().regex(/^\d+\.\d+\.\d+(-[a-z0-9]+)?$/), // semver
  description: z.string().max(1000),
  longDescription: z.string().max(5000).optional(),
  author: z.string(),
  authorEmail: z.string().email().optional(),
  homepage: z.string().url().optional(),
  repository: z.string().url().optional(),
  license: z.string().default('MIT'),
  permissions: z.array(PluginPermissionSchema),
  category: PluginCategorySchema,
  tags: z.array(z.string()).default([]),
  entry: z.string(), // Module entry point within package
  integritySha256: z.string().optional(), // SHA-256 of bundle
  minAppVersion: z.string().optional(),
  maxAppVersion: z.string().optional(),
  configSchema: z.record(z.unknown()).optional(), // JSON Schema for configuration
  dependencies: z.array(z.string()).default([]), // Other plugin IDs
  screenshots: z.array(z.string().url()).default([]),
  icon: z.string().url().optional(),
});

export const PluginInstallSchema = z.object({
  pluginId: z.string(),
  tenantId: z.string(),
  enabled: z.boolean().default(false),
  config: z.record(z.unknown()).default({}),
  installedAt: z.string().datetime(),
  installedBy: z.string(),
  version: z.string(),
});

export const PluginAuditEventSchema = z.object({
  id: z.string(),
  pluginId: z.string(),
  tenantId: z.string().optional(),
  action: z.enum(['INSTALLED', 'UNINSTALLED', 'ENABLED', 'DISABLED', 'CONFIGURED', 'UPGRADED', 'ERROR']),
  actorId: z.string(),
  timestamp: z.string().datetime(),
  details: z.record(z.unknown()).optional(),
});

export type PluginPermission = z.infer<typeof PluginPermissionSchema>;
export type PluginCategory = z.infer<typeof PluginCategorySchema>;
export type PluginStatus = z.infer<typeof PluginStatusSchema>;
export type PluginManifest = z.infer<typeof PluginManifestSchema>;
export type PluginInstall = z.infer<typeof PluginInstallSchema>;
export type PluginAuditEvent = z.infer<typeof PluginAuditEventSchema>;

interface Plugin extends PluginManifest {
  status: PluginStatus;
  downloads: number;
  rating: number;
  ratingCount: number;
  createdAt: string;
  updatedAt: string;
  publishedAt?: string;
  verified: boolean; // Officially verified by ResearchFlow
  featured: boolean;
}

// ─────────────────────────────────────────────────────────────
// In-Memory Storage (would be DB in production)
// ─────────────────────────────────────────────────────────────

const plugins: Map<string, Plugin> = new Map();
const installs: Map<string, PluginInstall> = new Map(); // key: `${tenantId}:${pluginId}`
const auditLog: PluginAuditEvent[] = [];

// ─────────────────────────────────────────────────────────────
// Sample Plugins for Marketplace
// ─────────────────────────────────────────────────────────────

const SAMPLE_PLUGINS: Omit<Plugin, 'createdAt' | 'updatedAt'>[] = [
  {
    id: 'com.researchflow.statistical-analysis',
    name: 'Advanced Statistical Analysis',
    version: '1.2.0',
    description: 'Comprehensive statistical analysis stage with R and Python support',
    longDescription: 'Add powerful statistical analysis capabilities to your research workflows. Supports ANOVA, regression, survival analysis, and more.',
    author: 'ResearchFlow Team',
    authorEmail: 'plugins@researchflow.io',
    homepage: 'https://researchflow.io/plugins/statistical-analysis',
    license: 'MIT',
    permissions: ['STAGE_EXTENSION', 'ARTIFACT_READ', 'ARTIFACT_WRITE'],
    category: 'WORKFLOW',
    tags: ['statistics', 'r', 'python', 'analysis'],
    entry: 'dist/index.js',
    integritySha256: 'abc123def456',
    minAppVersion: '1.0.0',
    configSchema: {
      type: 'object',
      properties: {
        defaultEngine: { type: 'string', enum: ['r', 'python'], default: 'python' },
        memoryLimit: { type: 'number', default: 2048 },
      },
    },
    dependencies: [],
    screenshots: [],
    status: 'APPROVED',
    downloads: 1250,
    rating: 4.8,
    ratingCount: 89,
    publishedAt: '2024-01-15T00:00:00Z',
    verified: true,
    featured: true,
  },
  {
    id: 'com.researchflow.overleaf-sync',
    name: 'Overleaf Synchronization',
    version: '1.0.5',
    description: 'Bi-directional sync with Overleaf projects',
    author: 'ResearchFlow Team',
    license: 'MIT',
    permissions: ['EXPORT_INTEGRATION', 'IMPORT_CONNECTOR', 'ARTIFACT_READ'],
    category: 'DATA_EXPORT',
    tags: ['overleaf', 'latex', 'sync', 'manuscript'],
    entry: 'dist/index.js',
    status: 'APPROVED',
    downloads: 890,
    rating: 4.5,
    ratingCount: 45,
    publishedAt: '2024-02-01T00:00:00Z',
    verified: true,
    featured: true,
  },
  {
    id: 'com.community.chart-generator',
    name: 'Advanced Chart Generator',
    version: '2.1.0',
    description: 'Create publication-quality charts and visualizations',
    author: 'Community Contributor',
    homepage: 'https://github.com/example/chart-generator',
    license: 'Apache-2.0',
    permissions: ['ARTIFACT_READ', 'ARTIFACT_WRITE'],
    category: 'VISUALIZATION',
    tags: ['charts', 'visualization', 'figures', 'd3'],
    entry: 'dist/index.js',
    status: 'APPROVED',
    downloads: 567,
    rating: 4.2,
    ratingCount: 23,
    verified: false,
    featured: false,
  },
  {
    id: 'com.community.redcap-import',
    name: 'REDCap Data Importer',
    version: '1.3.2',
    description: 'Import research data directly from REDCap',
    author: 'Clinical Research Tools',
    license: 'MIT',
    permissions: ['IMPORT_CONNECTOR', 'ARTIFACT_WRITE'],
    category: 'DATA_IMPORT',
    tags: ['redcap', 'import', 'clinical', 'data'],
    entry: 'dist/index.js',
    status: 'APPROVED',
    downloads: 432,
    rating: 4.6,
    ratingCount: 18,
    verified: true,
    featured: false,
  },
  {
    id: 'com.ai.claude-provider',
    name: 'Claude AI Provider',
    version: '1.0.0',
    description: 'Use Anthropic Claude models in your workflows',
    author: 'AI Integrations',
    license: 'MIT',
    permissions: ['AI_MODEL_PROVIDER'],
    category: 'AI_MODELS',
    tags: ['ai', 'claude', 'anthropic', 'llm'],
    entry: 'dist/index.js',
    configSchema: {
      type: 'object',
      required: ['apiKey'],
      properties: {
        apiKey: { type: 'string', description: 'Anthropic API key' },
        defaultModel: { type: 'string', default: 'claude-3-opus-20240229' },
      },
    },
    status: 'APPROVED',
    downloads: 789,
    rating: 4.9,
    ratingCount: 56,
    verified: true,
    featured: true,
  },
  {
    id: 'com.ai.openai-provider',
    name: 'OpenAI Provider',
    version: '1.1.0',
    description: 'Use OpenAI GPT models in your workflows',
    author: 'AI Integrations',
    license: 'MIT',
    permissions: ['AI_MODEL_PROVIDER'],
    category: 'AI_MODELS',
    tags: ['ai', 'openai', 'gpt', 'llm'],
    entry: 'dist/index.js',
    configSchema: {
      type: 'object',
      required: ['apiKey'],
      properties: {
        apiKey: { type: 'string' },
        organization: { type: 'string' },
        defaultModel: { type: 'string', default: 'gpt-4-turbo' },
      },
    },
    status: 'APPROVED',
    downloads: 1123,
    rating: 4.7,
    ratingCount: 78,
    verified: true,
    featured: true,
  },
  {
    id: 'com.community.slack-notifications',
    name: 'Slack Notifications',
    version: '1.0.2',
    description: 'Send workflow notifications to Slack channels',
    author: 'Notification Tools',
    license: 'MIT',
    permissions: ['NOTIFICATION_SEND', 'WEBHOOK_REGISTER'],
    category: 'COLLABORATION',
    tags: ['slack', 'notifications', 'alerts'],
    entry: 'dist/index.js',
    configSchema: {
      type: 'object',
      required: ['webhookUrl'],
      properties: {
        webhookUrl: { type: 'string', format: 'uri' },
        channel: { type: 'string' },
      },
    },
    status: 'APPROVED',
    downloads: 345,
    rating: 4.4,
    ratingCount: 12,
    verified: false,
    featured: false,
  },
];

// ─────────────────────────────────────────────────────────────
// Initialization
// ─────────────────────────────────────────────────────────────

function initializePlugins(): void {
  if (plugins.size === 0) {
    const now = new Date().toISOString();
    for (const plugin of SAMPLE_PLUGINS) {
      plugins.set(plugin.id, {
        ...plugin,
        createdAt: now,
        updatedAt: now,
      } as Plugin);
    }
  }
}

// ─────────────────────────────────────────────────────────────
// Marketplace API
// ─────────────────────────────────────────────────────────────

export interface ListPluginsOptions {
  category?: PluginCategory;
  search?: string;
  status?: PluginStatus;
  tags?: string[];
  verified?: boolean;
  featured?: boolean;
  sortBy?: 'downloads' | 'rating' | 'name' | 'recent';
  page?: number;
  limit?: number;
}

export function listPlugins(options: ListPluginsOptions = {}): {
  items: Plugin[];
  total: number;
  page: number;
  limit: number;
} {
  initializePlugins();

  let results = Array.from(plugins.values());

  // Filter by status (default to APPROVED for public)
  const status = options.status ?? 'APPROVED';
  results = results.filter(p => p.status === status);

  // Filter by category
  if (options.category) {
    results = results.filter(p => p.category === options.category);
  }

  // Filter by search query
  if (options.search) {
    const query = options.search.toLowerCase();
    results = results.filter(p =>
      p.name.toLowerCase().includes(query) ||
      p.description.toLowerCase().includes(query) ||
      p.tags.some(t => t.toLowerCase().includes(query))
    );
  }

  // Filter by tags
  if (options.tags?.length) {
    results = results.filter(p =>
      options.tags!.some(tag => p.tags.includes(tag))
    );
  }

  // Filter by verified
  if (options.verified !== undefined) {
    results = results.filter(p => p.verified === options.verified);
  }

  // Filter by featured
  if (options.featured !== undefined) {
    results = results.filter(p => p.featured === options.featured);
  }

  // Sort
  const sortBy = options.sortBy ?? 'downloads';
  switch (sortBy) {
    case 'downloads':
      results.sort((a, b) => b.downloads - a.downloads);
      break;
    case 'rating':
      results.sort((a, b) => b.rating - a.rating);
      break;
    case 'name':
      results.sort((a, b) => a.name.localeCompare(b.name));
      break;
    case 'recent':
      results.sort((a, b) =>
        new Date(b.publishedAt ?? b.createdAt).getTime() -
        new Date(a.publishedAt ?? a.createdAt).getTime()
      );
      break;
  }

  // Pagination
  const total = results.length;
  const page = options.page ?? 1;
  const limit = options.limit ?? 20;
  const start = (page - 1) * limit;
  results = results.slice(start, start + limit);

  return { items: results, total, page, limit };
}

export function getPlugin(id: string): Plugin | undefined {
  initializePlugins();
  return plugins.get(id);
}

export function getPluginCategories(): Array<{
  id: PluginCategory;
  name: string;
  description: string;
  count: number;
}> {
  initializePlugins();

  const categoryInfo: Record<PluginCategory, { name: string; description: string }> = {
    WORKFLOW: { name: 'Workflow Extensions', description: 'Custom stages and workflow automation' },
    AI_MODELS: { name: 'AI Models', description: 'AI/ML model providers and integrations' },
    DATA_IMPORT: { name: 'Data Import', description: 'Import data from external sources' },
    DATA_EXPORT: { name: 'Data Export', description: 'Export to external platforms' },
    VISUALIZATION: { name: 'Visualization', description: 'Charts, figures, and visual tools' },
    COLLABORATION: { name: 'Collaboration', description: 'Team collaboration and communication' },
    ANALYTICS: { name: 'Analytics', description: 'Research analytics and insights' },
    UTILITIES: { name: 'Utilities', description: 'General purpose utilities' },
  };

  const approved = Array.from(plugins.values()).filter(p => p.status === 'APPROVED');

  return Object.entries(categoryInfo).map(([id, info]) => ({
    id: id as PluginCategory,
    ...info,
    count: approved.filter(p => p.category === id).length,
  }));
}

export function getFeaturedPlugins(): Plugin[] {
  initializePlugins();
  return Array.from(plugins.values())
    .filter(p => p.featured && p.status === 'APPROVED')
    .sort((a, b) => b.downloads - a.downloads)
    .slice(0, 6);
}

// ─────────────────────────────────────────────────────────────
// Installation API
// ─────────────────────────────────────────────────────────────

export function installPlugin(
  pluginId: string,
  tenantId: string,
  userId: string,
  config?: Record<string, unknown>
): PluginInstall {
  initializePlugins();

  const plugin = plugins.get(pluginId);
  if (!plugin) {
    throw new Error(`Plugin not found: ${pluginId}`);
  }

  if (plugin.status !== 'APPROVED') {
    throw new Error(`Plugin is not available for installation: ${plugin.status}`);
  }

  const key = `${tenantId}:${pluginId}`;
  if (installs.has(key)) {
    throw new Error(`Plugin already installed for tenant`);
  }

  // Validate config against schema
  if (config && plugin.configSchema) {
    // In production, use ajv for JSON Schema validation
    // For now, just basic check
    const required = (plugin.configSchema as any).required ?? [];
    for (const field of required) {
      if (!(field in config)) {
        throw new Error(`Missing required config field: ${field}`);
      }
    }
  }

  const install: PluginInstall = {
    pluginId,
    tenantId,
    enabled: false, // Disabled by default for security
    config: config ?? {},
    installedAt: new Date().toISOString(),
    installedBy: userId,
    version: plugin.version,
  };

  installs.set(key, install);

  // Update download count
  plugin.downloads++;

  // Audit log
  logAuditEvent({
    pluginId,
    tenantId,
    action: 'INSTALLED',
    actorId: userId,
    details: { version: plugin.version },
  });

  return install;
}

export function uninstallPlugin(
  pluginId: string,
  tenantId: string,
  userId: string
): boolean {
  const key = `${tenantId}:${pluginId}`;
  const existing = installs.get(key);

  if (!existing) {
    return false;
  }

  installs.delete(key);

  logAuditEvent({
    pluginId,
    tenantId,
    action: 'UNINSTALLED',
    actorId: userId,
  });

  return true;
}

export function enablePlugin(
  pluginId: string,
  tenantId: string,
  userId: string
): PluginInstall | undefined {
  const key = `${tenantId}:${pluginId}`;
  const existing = installs.get(key);

  if (!existing) {
    return undefined;
  }

  existing.enabled = true;
  installs.set(key, existing);

  logAuditEvent({
    pluginId,
    tenantId,
    action: 'ENABLED',
    actorId: userId,
  });

  return existing;
}

export function disablePlugin(
  pluginId: string,
  tenantId: string,
  userId: string
): PluginInstall | undefined {
  const key = `${tenantId}:${pluginId}`;
  const existing = installs.get(key);

  if (!existing) {
    return undefined;
  }

  existing.enabled = false;
  installs.set(key, existing);

  logAuditEvent({
    pluginId,
    tenantId,
    action: 'DISABLED',
    actorId: userId,
  });

  return existing;
}

export function configurePlugin(
  pluginId: string,
  tenantId: string,
  userId: string,
  config: Record<string, unknown>
): PluginInstall | undefined {
  const key = `${tenantId}:${pluginId}`;
  const existing = installs.get(key);

  if (!existing) {
    return undefined;
  }

  const plugin = plugins.get(pluginId);
  if (plugin?.configSchema) {
    // Validate config
    const required = (plugin.configSchema as any).required ?? [];
    for (const field of required) {
      if (!(field in config)) {
        throw new Error(`Missing required config field: ${field}`);
      }
    }
  }

  existing.config = config;
  installs.set(key, existing);

  logAuditEvent({
    pluginId,
    tenantId,
    action: 'CONFIGURED',
    actorId: userId,
    details: { configKeys: Object.keys(config) }, // Don't log actual values
  });

  return existing;
}

export function listInstalledPlugins(tenantId: string): Array<PluginInstall & { plugin: Plugin }> {
  initializePlugins();

  const results: Array<PluginInstall & { plugin: Plugin }> = [];

  for (const [key, install] of installs) {
    if (key.startsWith(`${tenantId}:`)) {
      const plugin = plugins.get(install.pluginId);
      if (plugin) {
        results.push({ ...install, plugin });
      }
    }
  }

  return results;
}

export function getInstallation(
  pluginId: string,
  tenantId: string
): PluginInstall | undefined {
  return installs.get(`${tenantId}:${pluginId}`);
}

// ─────────────────────────────────────────────────────────────
// Audit Logging
// ─────────────────────────────────────────────────────────────

function logAuditEvent(event: Omit<PluginAuditEvent, 'id' | 'timestamp'>): void {
  auditLog.push({
    id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    ...event,
  });
}

export function getPluginAuditLog(options?: {
  pluginId?: string;
  tenantId?: string;
  action?: PluginAuditEvent['action'];
  limit?: number;
}): PluginAuditEvent[] {
  let results = [...auditLog];

  if (options?.pluginId) {
    results = results.filter(e => e.pluginId === options.pluginId);
  }

  if (options?.tenantId) {
    results = results.filter(e => e.tenantId === options.tenantId);
  }

  if (options?.action) {
    results = results.filter(e => e.action === options.action);
  }

  // Sort by timestamp desc
  results.sort((a, b) =>
    new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );

  if (options?.limit) {
    results = results.slice(0, options.limit);
  }

  return results;
}

// ─────────────────────────────────────────────────────────────
// Plugin Runtime (Stage Extension API)
// ─────────────────────────────────────────────────────────────

export interface StageExtensionContext {
  projectId: string;
  tenantId: string;
  // No PHI access; only artifact IDs + pre-scrubbed metadata
  artifacts: {
    list(): Promise<Array<{ id: string; kind: string; name: string }>>;
    readText(id: string): Promise<string>; // PHI-scrubbed
    readMetadata(id: string): Promise<Record<string, unknown>>;
  };
  logger: {
    info(msg: string): void;
    warn(msg: string): void;
    error(msg: string): void;
  };
  config: Record<string, unknown>;
}

export interface StageExtension {
  id: string;
  name: string;
  run(ctx: StageExtensionContext, input: unknown): Promise<unknown>;
}

// Registry of loaded stage extensions
const stageExtensions: Map<string, StageExtension> = new Map();

export function registerStageExtension(extension: StageExtension): void {
  stageExtensions.set(extension.id, extension);
}

export function getStageExtension(id: string): StageExtension | undefined {
  return stageExtensions.get(id);
}

export function listStageExtensions(): StageExtension[] {
  return Array.from(stageExtensions.values());
}

// ─────────────────────────────────────────────────────────────
// Integrity Verification
// ─────────────────────────────────────────────────────────────

export function verifyPluginIntegrity(
  bundleContent: Buffer | string,
  expectedSha256: string
): boolean {
  const content = typeof bundleContent === 'string' ? bundleContent : bundleContent.toString();
  const actualSha = crypto.createHash('sha256').update(content).digest('hex');
  return actualSha === expectedSha256;
}

// ─────────────────────────────────────────────────────────────
// Exports
// ─────────────────────────────────────────────────────────────

export default {
  // Marketplace
  listPlugins,
  getPlugin,
  getPluginCategories,
  getFeaturedPlugins,

  // Installation
  installPlugin,
  uninstallPlugin,
  enablePlugin,
  disablePlugin,
  configurePlugin,
  listInstalledPlugins,
  getInstallation,

  // Audit
  getPluginAuditLog,

  // Runtime
  registerStageExtension,
  getStageExtension,
  listStageExtensions,

  // Security
  verifyPluginIntegrity,
};
