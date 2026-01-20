/**
 * Git Sync Service
 * Task 143 - Integration with version control systems like Git
 *
 * Provides:
 * - Git repository connection management
 * - Artifact synchronization to Git
 * - Commit history tracking
 * - Branch management
 */

import { z } from 'zod';
import crypto from 'crypto';

// ─────────────────────────────────────────────────────────────
// Types & Schemas
// ─────────────────────────────────────────────────────────────

export const GitProviderSchema = z.enum([
  'GITHUB',
  'GITLAB',
  'BITBUCKET',
  'AZURE_DEVOPS',
  'CUSTOM',
]);

export const GitIntegrationSchema = z.object({
  id: z.string().uuid(),
  projectId: z.string().uuid(),
  tenantId: z.string(),
  provider: GitProviderSchema,
  repoUrl: z.string().url(),
  defaultBranch: z.string().default('main'),
  pathPrefix: z.string().default('researchflow/'),
  encryptedToken: z.string(), // Would be encrypted in production
  webhookSecret: z.string().optional(),
  autoSync: z.boolean().default(false),
  syncOnPublish: z.boolean().default(true),
  lastSyncAt: z.string().datetime().optional(),
  lastSyncStatus: z.enum(['SUCCESS', 'FAILED', 'PENDING', 'NEVER']).default('NEVER'),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const SyncResultSchema = z.object({
  id: z.string(),
  integrationId: z.string(),
  commitSha: z.string().optional(),
  branch: z.string(),
  filesCreated: z.number(),
  filesUpdated: z.number(),
  filesDeleted: z.number(),
  status: z.enum(['SUCCESS', 'FAILED', 'PARTIAL']),
  errorMessage: z.string().optional(),
  syncedAt: z.string().datetime(),
  durationMs: z.number(),
});

export const SyncFileSchema = z.object({
  relativePath: z.string(),
  content: z.string().or(z.instanceof(Buffer)),
  mode: z.enum(['CREATE', 'UPDATE', 'DELETE']).default('CREATE'),
});

export type GitProvider = z.infer<typeof GitProviderSchema>;
export type GitIntegration = z.infer<typeof GitIntegrationSchema>;
export type SyncResult = z.infer<typeof SyncResultSchema>;
export type SyncFile = z.infer<typeof SyncFileSchema>;

// ─────────────────────────────────────────────────────────────
// In-Memory Storage
// ─────────────────────────────────────────────────────────────

const integrations: Map<string, GitIntegration> = new Map();
const syncHistory: SyncResult[] = [];

// ─────────────────────────────────────────────────────────────
// Integration Management
// ─────────────────────────────────────────────────────────────

export interface CreateIntegrationInput {
  projectId: string;
  tenantId: string;
  provider: GitProvider;
  repoUrl: string;
  accessToken: string;
  defaultBranch?: string;
  pathPrefix?: string;
  autoSync?: boolean;
  syncOnPublish?: boolean;
}

export function createIntegration(input: CreateIntegrationInput): GitIntegration {
  // Validate repo URL format
  const urlPattern = /^https:\/\/(github\.com|gitlab\.com|bitbucket\.org|dev\.azure\.com)\/[\w-]+\/[\w-]+/;
  if (input.provider !== 'CUSTOM' && !urlPattern.test(input.repoUrl)) {
    throw new Error('Invalid repository URL format');
  }

  // Check for existing integration
  const existing = Array.from(integrations.values()).find(
    i => i.projectId === input.projectId && i.provider === input.provider
  );
  if (existing) {
    throw new Error(`Project already has a ${input.provider} integration`);
  }

  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  const integration: GitIntegration = {
    id,
    projectId: input.projectId,
    tenantId: input.tenantId,
    provider: input.provider,
    repoUrl: input.repoUrl.replace(/\.git$/, ''),
    defaultBranch: input.defaultBranch ?? 'main',
    pathPrefix: input.pathPrefix ?? 'researchflow/',
    encryptedToken: encryptToken(input.accessToken), // Would use proper encryption
    autoSync: input.autoSync ?? false,
    syncOnPublish: input.syncOnPublish ?? true,
    lastSyncStatus: 'NEVER',
    createdAt: now,
    updatedAt: now,
  };

  integrations.set(id, integration);
  return sanitizeIntegration(integration);
}

export function getIntegration(id: string): GitIntegration | undefined {
  const integration = integrations.get(id);
  return integration ? sanitizeIntegration(integration) : undefined;
}

export function getProjectIntegrations(projectId: string): GitIntegration[] {
  return Array.from(integrations.values())
    .filter(i => i.projectId === projectId)
    .map(sanitizeIntegration);
}

export function updateIntegration(
  id: string,
  updates: Partial<Pick<GitIntegration, 'defaultBranch' | 'pathPrefix' | 'autoSync' | 'syncOnPublish'>>
): GitIntegration | undefined {
  const existing = integrations.get(id);
  if (!existing) return undefined;

  const updated: GitIntegration = {
    ...existing,
    ...updates,
    updatedAt: new Date().toISOString(),
  };

  integrations.set(id, updated);
  return sanitizeIntegration(updated);
}

export function updateIntegrationToken(
  id: string,
  newToken: string
): boolean {
  const existing = integrations.get(id);
  if (!existing) return false;

  existing.encryptedToken = encryptToken(newToken);
  existing.updatedAt = new Date().toISOString();
  integrations.set(id, existing);
  return true;
}

export function deleteIntegration(id: string): boolean {
  return integrations.delete(id);
}

// ─────────────────────────────────────────────────────────────
// Sync Operations
// ─────────────────────────────────────────────────────────────

export interface SyncOptions {
  branch?: string;
  commitMessage?: string;
  dryRun?: boolean;
  force?: boolean;
}

export async function syncToRepository(
  integrationId: string,
  files: SyncFile[],
  options: SyncOptions = {}
): Promise<SyncResult> {
  const startTime = Date.now();
  const integration = integrations.get(integrationId);

  if (!integration) {
    throw new Error('Integration not found');
  }

  const branch = options.branch ?? integration.defaultBranch;
  const resultId = crypto.randomUUID();

  // In production, this would:
  // 1. Clone/fetch the repository
  // 2. Checkout the specified branch
  // 3. Apply file changes in pathPrefix
  // 4. Commit and push

  // Mock implementation
  const created = files.filter(f => f.mode === 'CREATE').length;
  const updated = files.filter(f => f.mode === 'UPDATE').length;
  const deleted = files.filter(f => f.mode === 'DELETE').length;

  // Simulate some processing
  await new Promise(resolve => setTimeout(resolve, 100));

  const commitSha = generateMockSha();
  const durationMs = Date.now() - startTime;

  const result: SyncResult = {
    id: resultId,
    integrationId,
    commitSha: options.dryRun ? undefined : commitSha,
    branch,
    filesCreated: created,
    filesUpdated: updated,
    filesDeleted: deleted,
    status: options.dryRun ? 'SUCCESS' : 'SUCCESS',
    syncedAt: new Date().toISOString(),
    durationMs,
  };

  // Update integration status
  if (!options.dryRun) {
    integration.lastSyncAt = result.syncedAt;
    integration.lastSyncStatus = 'SUCCESS';
    integration.updatedAt = result.syncedAt;
    integrations.set(integrationId, integration);
  }

  // Store in history
  syncHistory.push(result);

  return result;
}

export function getSyncHistory(
  integrationId: string,
  limit = 20
): SyncResult[] {
  return syncHistory
    .filter(s => s.integrationId === integrationId)
    .sort((a, b) => new Date(b.syncedAt).getTime() - new Date(a.syncedAt).getTime())
    .slice(0, limit);
}

// ─────────────────────────────────────────────────────────────
// Connection Test
// ─────────────────────────────────────────────────────────────

export interface ConnectionTestResult {
  success: boolean;
  repoName?: string;
  defaultBranch?: string;
  permissions?: {
    canRead: boolean;
    canWrite: boolean;
    canAdmin: boolean;
  };
  error?: string;
}

export async function testConnection(
  provider: GitProvider,
  repoUrl: string,
  accessToken: string
): Promise<ConnectionTestResult> {
  // In production, this would make actual API calls to verify:
  // 1. Token is valid
  // 2. Repository exists and is accessible
  // 3. Token has necessary permissions

  // Mock implementation
  await new Promise(resolve => setTimeout(resolve, 200));

  // Simulate validation
  if (!accessToken || accessToken.length < 10) {
    return {
      success: false,
      error: 'Invalid access token format',
    };
  }

  const repoMatch = repoUrl.match(/\/([^/]+)\/([^/]+)$/);
  if (!repoMatch) {
    return {
      success: false,
      error: 'Invalid repository URL format',
    };
  }

  return {
    success: true,
    repoName: `${repoMatch[1]}/${repoMatch[2]}`,
    defaultBranch: 'main',
    permissions: {
      canRead: true,
      canWrite: true,
      canAdmin: false,
    },
  };
}

// ─────────────────────────────────────────────────────────────
// Artifact Export Helpers
// ─────────────────────────────────────────────────────────────

export interface ArtifactForSync {
  id: string;
  type: string;
  name: string;
  content: string | Buffer;
  extension: string;
  metadata?: Record<string, unknown>;
}

export function prepareArtifactsForSync(
  artifacts: ArtifactForSync[],
  pathPrefix: string
): SyncFile[] {
  const files: SyncFile[] = [];

  for (const artifact of artifacts) {
    // Determine subdirectory by type
    const typeDir = getTypeDirectory(artifact.type);
    const filename = sanitizeFilename(artifact.name, artifact.extension);
    const relativePath = `${pathPrefix}${typeDir}/${filename}`;

    files.push({
      relativePath,
      content: artifact.content,
      mode: 'CREATE', // Would check existing to determine CREATE vs UPDATE
    });

    // Add metadata sidecar file
    if (artifact.metadata) {
      files.push({
        relativePath: `${relativePath}.meta.json`,
        content: JSON.stringify({
          id: artifact.id,
          type: artifact.type,
          name: artifact.name,
          exportedAt: new Date().toISOString(),
          ...artifact.metadata,
        }, null, 2),
        mode: 'CREATE',
      });
    }
  }

  // Generate manifest
  files.push({
    relativePath: `${pathPrefix}manifest.json`,
    content: JSON.stringify({
      version: '1.0',
      exportedAt: new Date().toISOString(),
      artifacts: artifacts.map(a => ({
        id: a.id,
        type: a.type,
        name: a.name,
        path: `${getTypeDirectory(a.type)}/${sanitizeFilename(a.name, a.extension)}`,
      })),
    }, null, 2),
    mode: 'CREATE',
  });

  return files;
}

function getTypeDirectory(type: string): string {
  const typeMap: Record<string, string> = {
    DATASET: 'data',
    CODE: 'code',
    FIGURE: 'figures',
    TABLE: 'tables',
    DOCUMENT: 'docs',
    MODEL: 'models',
  };
  return typeMap[type] ?? 'misc';
}

function sanitizeFilename(name: string, extension: string): string {
  // Remove invalid characters
  const sanitized = name
    .toLowerCase()
    .replace(/[^a-z0-9-_.]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

  // Ensure extension
  const ext = extension.startsWith('.') ? extension : `.${extension}`;
  return sanitized.endsWith(ext) ? sanitized : `${sanitized}${ext}`;
}

// ─────────────────────────────────────────────────────────────
// Webhook Handling
// ─────────────────────────────────────────────────────────────

export interface WebhookEvent {
  provider: GitProvider;
  event: string;
  payload: Record<string, unknown>;
  signature?: string;
}

export function verifyWebhookSignature(
  integrationId: string,
  payload: string,
  signature: string
): boolean {
  const integration = integrations.get(integrationId);
  if (!integration?.webhookSecret) return false;

  // Verify HMAC signature (GitHub-style)
  const expectedSig = `sha256=${crypto
    .createHmac('sha256', integration.webhookSecret)
    .update(payload)
    .digest('hex')}`;

  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSig)
  );
}

export function processWebhookEvent(event: WebhookEvent): void {
  // Handle different webhook events
  // e.g., push events for bi-directional sync
  console.log(`Processing ${event.provider} webhook: ${event.event}`);
}

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

function encryptToken(token: string): string {
  // In production, use proper encryption (e.g., AWS KMS, Vault)
  // This is just a placeholder
  return Buffer.from(token).toString('base64');
}

function decryptToken(encrypted: string): string {
  return Buffer.from(encrypted, 'base64').toString('utf-8');
}

function sanitizeIntegration(integration: GitIntegration): GitIntegration {
  // Remove sensitive data before returning
  return {
    ...integration,
    encryptedToken: '***', // Never expose token
    webhookSecret: integration.webhookSecret ? '***' : undefined,
  };
}

function generateMockSha(): string {
  return crypto.randomBytes(20).toString('hex');
}

// ─────────────────────────────────────────────────────────────
// Exports
// ─────────────────────────────────────────────────────────────

export default {
  // Integration Management
  createIntegration,
  getIntegration,
  getProjectIntegrations,
  updateIntegration,
  updateIntegrationToken,
  deleteIntegration,

  // Sync Operations
  syncToRepository,
  getSyncHistory,

  // Connection
  testConnection,

  // Helpers
  prepareArtifactsForSync,

  // Webhooks
  verifyWebhookSignature,
  processWebhookEvent,
};
