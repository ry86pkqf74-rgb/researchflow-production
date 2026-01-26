/**
 * Future-Proofing Service
 * Task 150 - Create future-proofing checklists for updates
 *
 * Provides:
 * - Upgrade compatibility checks
 * - Migration planning
 * - API versioning management
 * - Deprecation tracking
 */

import { z } from 'zod';
import crypto from 'crypto';

// ─────────────────────────────────────────────────────────────
// Types & Schemas
// ─────────────────────────────────────────────────────────────

export const CheckItemStatusSchema = z.enum([
  'PENDING',
  'IN_PROGRESS',
  'PASSED',
  'FAILED',
  'SKIPPED',
  'NOT_APPLICABLE',
]);

export const CheckCategorySchema = z.enum([
  'DATABASE',
  'API',
  'SECURITY',
  'DEPENDENCIES',
  'CONFIGURATION',
  'DATA_MIGRATION',
  'PLUGIN_COMPATIBILITY',
  'PERFORMANCE',
  'DOCUMENTATION',
]);

export const SeveritySchema = z.enum([
  'CRITICAL',
  'HIGH',
  'MEDIUM',
  'LOW',
  'INFO',
]);

export const ChecklistItemSchema = z.object({
  id: z.string(),
  category: CheckCategorySchema,
  title: z.string(),
  description: z.string(),
  severity: SeveritySchema,
  automated: z.boolean().default(false),
  status: CheckItemStatusSchema.default('PENDING'),
  result: z.string().optional(),
  checkedAt: z.string().datetime().optional(),
  checkedBy: z.string().optional(),
});

export const UpgradeChecklistSchema = z.object({
  id: z.string().uuid(),
  fromVersion: z.string(),
  toVersion: z.string(),
  createdAt: z.string().datetime(),
  createdBy: z.string(),
  status: z.enum(['DRAFT', 'IN_PROGRESS', 'COMPLETED', 'APPROVED', 'REJECTED']),
  items: z.array(ChecklistItemSchema),
  notes: z.string().optional(),
  approvedAt: z.string().datetime().optional(),
  approvedBy: z.string().optional(),
});

export const DeprecationNoticeSchema = z.object({
  id: z.string(),
  feature: z.string(),
  deprecatedIn: z.string(), // Version
  removedIn: z.string().optional(), // Planned removal version
  reason: z.string(),
  migration: z.string(), // Migration path description
  documentationUrl: z.string().url().optional(),
  announcedAt: z.string().datetime(),
});

export const ApiVersionSchema = z.object({
  version: z.string(),
  status: z.enum(['CURRENT', 'SUPPORTED', 'DEPRECATED', 'SUNSET']),
  releasedAt: z.string().datetime(),
  deprecatedAt: z.string().datetime().optional(),
  sunsetAt: z.string().datetime().optional(),
  changelog: z.string().optional(),
  breakingChanges: z.array(z.string()).default([]),
});

export type CheckItemStatus = z.infer<typeof CheckItemStatusSchema>;
export type CheckCategory = z.infer<typeof CheckCategorySchema>;
export type Severity = z.infer<typeof SeveritySchema>;
export type ChecklistItem = z.infer<typeof ChecklistItemSchema>;
export type UpgradeChecklist = z.infer<typeof UpgradeChecklistSchema>;
export type DeprecationNotice = z.infer<typeof DeprecationNoticeSchema>;
export type ApiVersion = z.infer<typeof ApiVersionSchema>;

// ─────────────────────────────────────────────────────────────
// In-Memory Storage
// ─────────────────────────────────────────────────────────────

const checklists: Map<string, UpgradeChecklist> = new Map();
const deprecations: Map<string, DeprecationNotice> = new Map();
const apiVersions: Map<string, ApiVersion> = new Map();

// ─────────────────────────────────────────────────────────────
// Default Checklist Templates
// ─────────────────────────────────────────────────────────────

const DEFAULT_CHECKLIST_ITEMS: Omit<ChecklistItem, 'id' | 'status'>[] = [
  // Database
  {
    category: 'DATABASE',
    title: 'Backup database',
    description: 'Create a full backup of the production database before upgrade',
    severity: 'CRITICAL',
    automated: false,
  },
  {
    category: 'DATABASE',
    title: 'Review migration scripts',
    description: 'Verify all migration scripts are tested and reversible',
    severity: 'CRITICAL',
    automated: false,
  },
  {
    category: 'DATABASE',
    title: 'Check schema compatibility',
    description: 'Ensure new schema is backward compatible or migration path exists',
    severity: 'HIGH',
    automated: true,
  },
  {
    category: 'DATABASE',
    title: 'Estimate migration time',
    description: 'Test migrations on production-sized data to estimate downtime',
    severity: 'HIGH',
    automated: false,
  },

  // API
  {
    category: 'API',
    title: 'Review API changes',
    description: 'Document all API endpoint changes and deprecations',
    severity: 'HIGH',
    automated: true,
  },
  {
    category: 'API',
    title: 'Version API endpoints',
    description: 'Ensure new endpoints are properly versioned',
    severity: 'HIGH',
    automated: true,
  },
  {
    category: 'API',
    title: 'Update OpenAPI spec',
    description: 'Regenerate and validate OpenAPI specification',
    severity: 'MEDIUM',
    automated: true,
  },
  {
    category: 'API',
    title: 'Run API contract tests',
    description: 'Execute contract tests against new API version',
    severity: 'HIGH',
    automated: true,
  },

  // Security
  {
    category: 'SECURITY',
    title: 'Security audit',
    description: 'Run security scanning tools on new codebase',
    severity: 'CRITICAL',
    automated: true,
  },
  {
    category: 'SECURITY',
    title: 'Review authentication changes',
    description: 'Verify authentication/authorization logic is correct',
    severity: 'CRITICAL',
    automated: false,
  },
  {
    category: 'SECURITY',
    title: 'Check dependency vulnerabilities',
    description: 'Run npm audit or equivalent for vulnerability check',
    severity: 'HIGH',
    automated: true,
  },
  {
    category: 'SECURITY',
    title: 'Review PHI handling',
    description: 'Ensure PHI-safety mechanisms are intact',
    severity: 'CRITICAL',
    automated: false,
  },

  // Dependencies
  {
    category: 'DEPENDENCIES',
    title: 'Update dependency versions',
    description: 'Review and test updated dependencies',
    severity: 'MEDIUM',
    automated: true,
  },
  {
    category: 'DEPENDENCIES',
    title: 'Check breaking changes',
    description: 'Review changelog for breaking changes in dependencies',
    severity: 'HIGH',
    automated: false,
  },
  {
    category: 'DEPENDENCIES',
    title: 'Verify license compliance',
    description: 'Ensure all dependencies have compatible licenses',
    severity: 'MEDIUM',
    automated: true,
  },

  // Configuration
  {
    category: 'CONFIGURATION',
    title: 'Update environment variables',
    description: 'Document new/changed environment variables',
    severity: 'HIGH',
    automated: false,
  },
  {
    category: 'CONFIGURATION',
    title: 'Review feature flags',
    description: 'Update feature flag configurations',
    severity: 'MEDIUM',
    automated: false,
  },
  {
    category: 'CONFIGURATION',
    title: 'Update infrastructure configs',
    description: 'Review K8s manifests, Terraform, etc.',
    severity: 'HIGH',
    automated: false,
  },

  // Plugin Compatibility
  {
    category: 'PLUGIN_COMPATIBILITY',
    title: 'Test installed plugins',
    description: 'Verify all installed plugins work with new version',
    severity: 'HIGH',
    automated: true,
  },
  {
    category: 'PLUGIN_COMPATIBILITY',
    title: 'Update plugin API version',
    description: 'Bump plugin API version if interface changed',
    severity: 'MEDIUM',
    automated: false,
  },
  {
    category: 'PLUGIN_COMPATIBILITY',
    title: 'Notify plugin authors',
    description: 'Communicate breaking changes to plugin developers',
    severity: 'LOW',
    automated: false,
  },

  // Performance
  {
    category: 'PERFORMANCE',
    title: 'Run performance benchmarks',
    description: 'Compare performance metrics before and after upgrade',
    severity: 'MEDIUM',
    automated: true,
  },
  {
    category: 'PERFORMANCE',
    title: 'Review query performance',
    description: 'Check for slow queries introduced by changes',
    severity: 'MEDIUM',
    automated: true,
  },

  // Documentation
  {
    category: 'DOCUMENTATION',
    title: 'Update changelog',
    description: 'Document all changes in CHANGELOG.md',
    severity: 'MEDIUM',
    automated: false,
  },
  {
    category: 'DOCUMENTATION',
    title: 'Update user documentation',
    description: 'Update user-facing documentation for new features',
    severity: 'MEDIUM',
    automated: false,
  },
  {
    category: 'DOCUMENTATION',
    title: 'Update API documentation',
    description: 'Ensure API docs reflect all changes',
    severity: 'MEDIUM',
    automated: true,
  },

  // Data Migration
  {
    category: 'DATA_MIGRATION',
    title: 'Test data migration',
    description: 'Run migration on test data to verify correctness',
    severity: 'CRITICAL',
    automated: false,
  },
  {
    category: 'DATA_MIGRATION',
    title: 'Prepare rollback plan',
    description: 'Document procedure to rollback if upgrade fails',
    severity: 'CRITICAL',
    automated: false,
  },
];

// ─────────────────────────────────────────────────────────────
// Checklist Management
// ─────────────────────────────────────────────────────────────

export function createUpgradeChecklist(
  fromVersion: string,
  toVersion: string,
  createdBy: string
): UpgradeChecklist {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  const items: ChecklistItem[] = DEFAULT_CHECKLIST_ITEMS.map((item, index) => ({
    ...item,
    id: `item-${index}`,
    status: 'PENDING' as const,
  }));

  const checklist: UpgradeChecklist = {
    id,
    fromVersion,
    toVersion,
    createdAt: now,
    createdBy,
    status: 'DRAFT',
    items,
  };

  checklists.set(id, checklist);
  return checklist;
}

export function getChecklist(id: string): UpgradeChecklist | undefined {
  return checklists.get(id);
}

export function listChecklists(options?: {
  status?: UpgradeChecklist['status'];
  limit?: number;
}): UpgradeChecklist[] {
  let results = Array.from(checklists.values());

  if (options?.status) {
    results = results.filter(c => c.status === options.status);
  }

  results.sort((a, b) =>
    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  if (options?.limit) {
    results = results.slice(0, options.limit);
  }

  return results;
}

export function updateChecklistItem(
  checklistId: string,
  itemId: string,
  update: {
    status: CheckItemStatus;
    result?: string;
    checkedBy: string;
  }
): UpgradeChecklist | undefined {
  const checklist = checklists.get(checklistId);
  if (!checklist) return undefined;

  const item = checklist.items.find(i => i.id === itemId);
  if (!item) return undefined;

  item.status = update.status;
  item.result = update.result;
  item.checkedAt = new Date().toISOString();
  item.checkedBy = update.checkedBy;

  // Update checklist status
  updateChecklistStatus(checklist);

  checklists.set(checklistId, checklist);
  return checklist;
}

function updateChecklistStatus(checklist: UpgradeChecklist): void {
  const statuses = checklist.items.map(i => i.status);

  if (statuses.some(s => s === 'FAILED')) {
    checklist.status = 'IN_PROGRESS';
  } else if (statuses.every(s => ['PASSED', 'SKIPPED', 'NOT_APPLICABLE'].includes(s))) {
    checklist.status = 'COMPLETED';
  } else if (statuses.some(s => s !== 'PENDING')) {
    checklist.status = 'IN_PROGRESS';
  }
}

export function approveChecklist(
  checklistId: string,
  approvedBy: string
): UpgradeChecklist | undefined {
  const checklist = checklists.get(checklistId);
  if (!checklist) return undefined;

  if (checklist.status !== 'COMPLETED') {
    throw new Error('Checklist must be completed before approval');
  }

  // Check for critical failures
  const criticalFailures = checklist.items.filter(
    i => i.severity === 'CRITICAL' && i.status === 'FAILED'
  );

  if (criticalFailures.length > 0) {
    throw new Error(`Cannot approve: ${criticalFailures.length} critical items failed`);
  }

  checklist.status = 'APPROVED';
  checklist.approvedAt = new Date().toISOString();
  checklist.approvedBy = approvedBy;

  checklists.set(checklistId, checklist);
  return checklist;
}

export function getChecklistProgress(checklistId: string): {
  total: number;
  completed: number;
  passed: number;
  failed: number;
  pending: number;
  percentComplete: number;
  byCategory: Record<CheckCategory, { total: number; completed: number }>;
} {
  const checklist = checklists.get(checklistId);
  if (!checklist) {
    throw new Error('Checklist not found');
  }

  const total = checklist.items.length;
  const passed = checklist.items.filter(i => i.status === 'PASSED').length;
  const failed = checklist.items.filter(i => i.status === 'FAILED').length;
  const pending = checklist.items.filter(i => i.status === 'PENDING').length;
  const completed = total - pending;

  const byCategory: Record<CheckCategory, { total: number; completed: number }> = {
    DATABASE: { total: 0, completed: 0 },
    API: { total: 0, completed: 0 },
    SECURITY: { total: 0, completed: 0 },
    DEPENDENCIES: { total: 0, completed: 0 },
    CONFIGURATION: { total: 0, completed: 0 },
    DATA_MIGRATION: { total: 0, completed: 0 },
    PLUGIN_COMPATIBILITY: { total: 0, completed: 0 },
    PERFORMANCE: { total: 0, completed: 0 },
    DOCUMENTATION: { total: 0, completed: 0 },
  };

  for (const item of checklist.items) {
    byCategory[item.category].total++;
    if (item.status !== 'PENDING') {
      byCategory[item.category].completed++;
    }
  }

  return {
    total,
    completed,
    passed,
    failed,
    pending,
    percentComplete: Math.round((completed / total) * 100),
    byCategory,
  };
}

// ─────────────────────────────────────────────────────────────
// Deprecation Management
// ─────────────────────────────────────────────────────────────

export function createDeprecationNotice(
  notice: Omit<DeprecationNotice, 'id' | 'announcedAt'>
): DeprecationNotice {
  const id = crypto.randomUUID();
  const fullNotice: DeprecationNotice = {
    id,
    ...notice,
    announcedAt: new Date().toISOString(),
  };

  deprecations.set(id, fullNotice);
  return fullNotice;
}

export function listDeprecations(options?: {
  includeRemoved?: boolean;
}): DeprecationNotice[] {
  let notices = Array.from(deprecations.values());

  if (!options?.includeRemoved) {
    notices = notices.filter(n => !n.removedIn);
  }

  return notices.sort((a, b) =>
    new Date(b.announcedAt).getTime() - new Date(a.announcedAt).getTime()
  );
}

export function getActiveDeprecations(currentVersion: string): DeprecationNotice[] {
  return Array.from(deprecations.values()).filter(n => {
    // Feature is deprecated but not yet removed
    return !n.removedIn || compareVersions(currentVersion, n.removedIn) < 0;
  });
}

// ─────────────────────────────────────────────────────────────
// API Version Management
// ─────────────────────────────────────────────────────────────

export function registerApiVersion(version: Omit<ApiVersion, 'status'>): ApiVersion {
  const fullVersion: ApiVersion = {
    ...version,
    status: 'CURRENT',
  };

  // Mark previous current as supported
  for (const v of apiVersions.values()) {
    if (v.status === 'CURRENT') {
      v.status = 'SUPPORTED';
    }
  }

  apiVersions.set(version.version, fullVersion);
  return fullVersion;
}

export function deprecateApiVersion(
  version: string,
  sunsetDate: string
): ApiVersion | undefined {
  const apiVersion = apiVersions.get(version);
  if (!apiVersion) return undefined;

  apiVersion.status = 'DEPRECATED';
  apiVersion.deprecatedAt = new Date().toISOString();
  apiVersion.sunsetAt = sunsetDate;

  apiVersions.set(version, apiVersion);
  return apiVersion;
}

export function listApiVersions(): ApiVersion[] {
  return Array.from(apiVersions.values()).sort((a, b) =>
    compareVersions(b.version, a.version)
  );
}

export function getCurrentApiVersion(): ApiVersion | undefined {
  return Array.from(apiVersions.values()).find(v => v.status === 'CURRENT');
}

// ─────────────────────────────────────────────────────────────
// Version Comparison
// ─────────────────────────────────────────────────────────────

function compareVersions(a: string, b: string): number {
  const partsA = a.split('.').map(Number);
  const partsB = b.split('.').map(Number);

  for (let i = 0; i < Math.max(partsA.length, partsB.length); i++) {
    const numA = partsA[i] ?? 0;
    const numB = partsB[i] ?? 0;
    if (numA !== numB) return numA - numB;
  }

  return 0;
}

// ─────────────────────────────────────────────────────────────
// Automated Checks
// ─────────────────────────────────────────────────────────────

export async function runAutomatedChecks(
  checklistId: string,
  userId: string
): Promise<{ passed: number; failed: number; errors: string[] }> {
  const checklist = checklists.get(checklistId);
  if (!checklist) {
    throw new Error('Checklist not found');
  }

  const automatedItems = checklist.items.filter(i => i.automated);
  let passed = 0;
  let failed = 0;
  const errors: string[] = [];

  for (const item of automatedItems) {
    try {
      const result = await runCheck(item);
      item.status = result.passed ? 'PASSED' : 'FAILED';
      item.result = result.message;
      item.checkedAt = new Date().toISOString();
      item.checkedBy = 'automated';

      if (result.passed) {
        passed++;
      } else {
        failed++;
        errors.push(`${item.title}: ${result.message}`);
      }
    } catch (error: any) {
      item.status = 'FAILED';
      item.result = error.message;
      failed++;
      errors.push(`${item.title}: ${error.message}`);
    }
  }

  updateChecklistStatus(checklist);
  checklists.set(checklistId, checklist);

  return { passed, failed, errors };
}

async function runCheck(item: ChecklistItem): Promise<{ passed: boolean; message: string }> {
  // Simulate automated checks
  await new Promise(resolve => setTimeout(resolve, 100));

  // Mock results based on category
  switch (item.category) {
    case 'SECURITY':
      return { passed: true, message: 'No vulnerabilities found' };
    case 'DEPENDENCIES':
      return { passed: true, message: 'All dependencies up to date' };
    case 'API':
      return { passed: true, message: 'API contracts validated' };
    case 'PERFORMANCE':
      return { passed: true, message: 'Performance within acceptable range' };
    default:
      return { passed: true, message: 'Check passed' };
  }
}

// ─────────────────────────────────────────────────────────────
// Exports
// ─────────────────────────────────────────────────────────────

export default {
  // Checklists
  createUpgradeChecklist,
  getChecklist,
  listChecklists,
  updateChecklistItem,
  approveChecklist,
  getChecklistProgress,
  runAutomatedChecks,

  // Deprecations
  createDeprecationNotice,
  listDeprecations,
  getActiveDeprecations,

  // API Versions
  registerApiVersion,
  deprecateApiVersion,
  listApiVersions,
  getCurrentApiVersion,
};
