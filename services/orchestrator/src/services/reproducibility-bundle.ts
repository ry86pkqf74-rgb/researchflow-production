/**
 * Reproducibility Bundle Export Service
 *
 * Handles the complete workflow for generating reproducibility bundles:
 * - Gathers all project data (topics, SAPs, artifacts, audit logs)
 * - Runs PHI pre-scan on all content before export
 * - Creates approval workflow for export requests
 * - Generates ZIP archive with full directory structure
 *
 * Priority: P0 - CRITICAL (Governance)
 */

import crypto from "crypto";
import archiver from "archiver";
import { eq, and, desc, asc } from "drizzle-orm";
import { db } from "../../db";
import * as schema from "@researchflow/core/schema";
import { scanForPHI, type PHIScanResult, type RiskLevel } from "../../services/phi-scanner";

// =====================
// Type Definitions
// =====================

export interface BundleRequest {
  researchId: string;
  requestedBy: string;
  requestedByRole: string;
  requestedByEmail?: string;
  requestedByName?: string;
  reason: string;
  sessionId?: string;
  includeTopics?: boolean;
  includeSAPs?: boolean;
  includeArtifacts?: boolean;
  includeAuditLogs?: boolean;
  includePrompts?: boolean;
}

export interface BundleContent {
  topics: schema.Topic[];
  statisticalPlans: schema.StatisticalPlanRecord[];
  artifacts: schema.Artifact[];
  auditLogs: Array<typeof schema.auditLogs.$inferSelect>;
  handoffPacks: schema.HandoffPackRecord[];
  researchBriefs: schema.ResearchBriefRecord[];
}

export interface PHIScanSummary {
  scannedAt: string;
  totalPatternsDetected: number;
  riskLevel: RiskLevel;
  requiresOverride: boolean;
  detailsByScan: PHIScanResult[];
  byCategory: Record<string, number>;
}

export interface BundleExportResult {
  bundleId: string;
  requestId: string;
  status: 'PENDING_APPROVAL' | 'PHI_BLOCKED' | 'READY' | 'ERROR';
  phiScanSummary?: PHIScanSummary;
  message: string;
}

export interface ApprovalResult {
  success: boolean;
  error?: string;
  code?: string;
  expiresAt?: string;
}

export interface DenialResult {
  success: boolean;
  error?: string;
  code?: string;
}

export interface OverrideResult {
  success: boolean;
  expiresAt?: string;
  conditions?: string[];
  error?: string;
  code?: string;
}

export interface RequestStatus {
  requestId: string;
  researchId: string;
  status: string;
  requestedBy: string;
  requestedAt: string;
  approvedBy?: string;
  approvedAt?: string;
  deniedReason?: string;
  expiresAt?: string;
  phiOverride?: {
    applied: boolean;
    justification?: string;
    approvedBy?: string;
    expiresAt?: string;
  };
  metadata?: Record<string, any>;
}

export interface BundleManifest {
  schemaVersion: string;
  bundleId: string;
  researchId: string;
  createdAt: string;
  createdBy: {
    userId: string;
    name?: string;
    role: string;
  };
  approval: {
    requestId: string;
    requestedAt: string;
    approvedAt: string;
    approvedBy: string;
    phiOverride?: {
      applied: boolean;
      justification?: string;
      approvedBy?: string;
      expiresAt?: string;
    };
  };
  contents: {
    topics: { count: number; versions: number[] };
    statisticalPlans: { count: number; statuses: string[] };
    artifacts: { count: number; totalSizeBytes: number };
    auditLogs: { count: number; chainVerified: boolean };
    handoffPacks: { count: number };
    researchBriefs: { count: number };
  };
  integrity: {
    manifestHash: string;
    contentHashes: Record<string, string>;
    bundleHash: string;
  };
  environment: {
    nodeVersion: string;
    rosVersion: string;
    gitSha?: string;
    gitBranch?: string;
    deploymentEnvironment: string;
  };
}

// =====================
// Data Gathering
// =====================

/**
 * Gathers all content for a research project that will be included in the bundle
 */
export async function gatherBundleContent(researchId: string): Promise<BundleContent> {
  if (!db) {
    throw new Error('Database not initialized');
  }

  // Query topics by researchId
  const topics = await db
    .select()
    .from(schema.topics)
    .where(eq(schema.topics.researchId, researchId))
    .orderBy(desc(schema.topics.version));

  // Query statistical plans
  const statisticalPlans = await db
    .select()
    .from(schema.statisticalPlans)
    .where(eq(schema.statisticalPlans.researchId, researchId))
    .orderBy(desc(schema.statisticalPlans.createdAt));

  // Query artifacts
  const artifacts = await db
    .select()
    .from(schema.artifacts)
    .where(eq(schema.artifacts.researchId, researchId))
    .orderBy(desc(schema.artifacts.createdAt));

  // Query audit logs (ordered by ID for chain verification)
  const auditLogs = await db
    .select()
    .from(schema.auditLogs)
    .where(eq(schema.auditLogs.researchId, researchId))
    .orderBy(asc(schema.auditLogs.id));

  // Query handoff packs
  const handoffPacks = await db
    .select()
    .from(schema.handoffPacks)
    .where(eq(schema.handoffPacks.researchId, researchId))
    .orderBy(desc(schema.handoffPacks.generatedAt));

  // Query research briefs
  const researchBriefs = await db
    .select()
    .from(schema.researchBriefs)
    .where(eq(schema.researchBriefs.researchId, researchId))
    .orderBy(desc(schema.researchBriefs.createdAt));

  return {
    topics,
    statisticalPlans,
    artifacts,
    auditLogs,
    handoffPacks,
    researchBriefs,
  };
}

// =====================
// PHI Scanning
// =====================

/**
 * Scans all content for PHI patterns and returns aggregated results
 */
export function scanContentForPHI(content: BundleContent): PHIScanSummary {
  const scans: PHIScanResult[] = [];

  // Scan topics
  for (const topic of content.topics) {
    const scan = scanForPHI(JSON.stringify(topic), 'export');
    scans.push(scan);
  }

  // Scan statistical plans
  for (const plan of content.statisticalPlans) {
    const scan = scanForPHI(JSON.stringify(plan), 'export');
    scans.push(scan);
  }

  // Scan artifacts (content field)
  for (const artifact of content.artifacts) {
    if (artifact.content) {
      const scan = scanForPHI(artifact.content, 'export');
      scans.push(scan);
    }
  }

  // Scan research briefs
  for (const brief of content.researchBriefs) {
    const scan = scanForPHI(JSON.stringify(brief), 'export');
    scans.push(scan);
  }

  // Scan handoff packs
  for (const pack of content.handoffPacks) {
    const scan = scanForPHI(JSON.stringify(pack.content), 'export');
    scans.push(scan);
  }

  // Aggregate results
  const totalPatterns = scans.reduce((sum, s) => sum + s.detected.length, 0);

  // Determine aggregate risk level
  const hasHigh = scans.some(s => s.riskLevel === 'high');
  const hasMedium = scans.some(s => s.riskLevel === 'medium');
  const hasLow = scans.some(s => s.riskLevel === 'low');

  const aggregateRisk: RiskLevel = hasHigh ? 'high'
    : hasMedium ? 'medium'
    : hasLow ? 'low'
    : 'none';

  // Aggregate by category
  const byCategory: Record<string, number> = {};
  for (const scan of scans) {
    for (const [cat, count] of Object.entries(scan.summary.byCategory)) {
      byCategory[cat] = (byCategory[cat] || 0) + count;
    }
  }

  return {
    scannedAt: new Date().toISOString(),
    totalPatternsDetected: totalPatterns,
    riskLevel: aggregateRisk,
    requiresOverride: aggregateRisk !== 'none',
    detailsByScan: scans,
    byCategory,
  };
}

// =====================
// Bundle Request Workflow
// =====================

/**
 * Creates a new bundle export request
 */
export async function createBundleRequest(request: BundleRequest): Promise<BundleExportResult> {
  const bundleId = crypto.randomUUID();

  try {
    if (!db) {
      throw new Error('Database not initialized');
    }

    // Gather content
    const content = await gatherBundleContent(request.researchId);

    // Scan for PHI
    const phiScanSummary = scanContentForPHI(content);

    // Determine initial status based on PHI scan
    const status = phiScanSummary.requiresOverride ? 'PHI_BLOCKED' : 'PENDING';

    // Create approval gate record
    const [gate] = await db
      .insert(schema.approvalGates)
      .values({
        operationType: 'DATA_EXPORT',
        resourceId: request.researchId,
        resourceType: 'reproducibility_bundle',
        approvalMode: 'REQUIRE_EACH',
        requestedById: request.requestedBy,
        requestedByRole: request.requestedByRole,
        requestedByEmail: request.requestedByEmail,
        requestedByName: request.requestedByName,
        status,
        reason: request.reason,
        metadata: {
          bundleId,
          bundleType: 'reproducibility',
          phiScanSummary: {
            scannedAt: phiScanSummary.scannedAt,
            totalPatternsDetected: phiScanSummary.totalPatternsDetected,
            riskLevel: phiScanSummary.riskLevel,
            requiresOverride: phiScanSummary.requiresOverride,
            byCategory: phiScanSummary.byCategory,
          },
          includeOptions: {
            topics: request.includeTopics ?? true,
            saps: request.includeSAPs ?? true,
            artifacts: request.includeArtifacts ?? true,
            auditLogs: request.includeAuditLogs ?? true,
            prompts: request.includePrompts ?? true,
          },
          contentCounts: {
            topics: content.topics.length,
            statisticalPlans: content.statisticalPlans.length,
            artifacts: content.artifacts.length,
            auditLogs: content.auditLogs.length,
            handoffPacks: content.handoffPacks.length,
            researchBriefs: content.researchBriefs.length,
          },
        },
        sessionId: request.sessionId,
      })
      .returning();

    // Create audit entry for the request
    await db.insert(schema.approvalAuditEntries).values({
      gateId: gate.id,
      action: 'CREATED',
      performedById: request.requestedBy,
      performedByRole: request.requestedByRole,
      performedByEmail: request.requestedByEmail,
      performedByName: request.requestedByName,
      details: {
        bundleId,
        phiDetected: phiScanSummary.requiresOverride,
        riskLevel: phiScanSummary.riskLevel,
      },
    });

    if (phiScanSummary.requiresOverride) {
      return {
        bundleId,
        requestId: gate.id,
        status: 'PHI_BLOCKED',
        phiScanSummary,
        message: 'PHI detected in bundle content. Request PHI override from a STEWARD to proceed.',
      };
    }

    return {
      bundleId,
      requestId: gate.id,
      status: 'PENDING_APPROVAL',
      phiScanSummary,
      message: 'Bundle export request created. Awaiting STEWARD approval.',
    };
  } catch (error) {
    console.error('Error creating bundle request:', error);
    return {
      bundleId,
      requestId: '',
      status: 'ERROR',
      message: error instanceof Error ? error.message : 'Unknown error creating bundle request',
    };
  }
}

/**
 * Approves a pending bundle export request
 */
export async function approveBundleRequest(
  requestId: string,
  userId: string,
  role: string,
  reason?: string
): Promise<ApprovalResult> {
  try {
    if (!db) {
      throw new Error('Database not initialized');
    }

    // Get the current gate
    const [gate] = await db
      .select()
      .from(schema.approvalGates)
      .where(eq(schema.approvalGates.id, requestId));

    if (!gate) {
      return { success: false, error: 'Request not found', code: 'REQUEST_NOT_FOUND' };
    }

    if (gate.status === 'PHI_BLOCKED') {
      return { success: false, error: 'PHI override required before approval', code: 'PHI_OVERRIDE_REQUIRED' };
    }

    if (gate.status !== 'PENDING') {
      return { success: false, error: `Request is not pending (current: ${gate.status})`, code: 'INVALID_STATUS' };
    }

    // Calculate expiration (24 hours from approval)
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24);

    // Update the gate
    await db
      .update(schema.approvalGates)
      .set({
        status: 'APPROVED',
        approvedById: userId,
        reviewedAt: new Date(),
        completedAt: new Date(),
        expiresAt,
        reason,
      })
      .where(eq(schema.approvalGates.id, requestId));

    // Create audit entry
    await db.insert(schema.approvalAuditEntries).values({
      gateId: requestId,
      action: 'APPROVED',
      performedById: userId,
      performedByRole: role,
      details: { reason, expiresAt: expiresAt.toISOString() },
    });

    return { success: true, expiresAt: expiresAt.toISOString() };
  } catch (error) {
    console.error('Error approving bundle request:', error);
    return { success: false, error: 'Failed to approve request', code: 'APPROVAL_FAILED' };
  }
}

/**
 * Denies a pending bundle export request
 */
export async function denyBundleRequest(
  requestId: string,
  userId: string,
  role: string,
  reason: string
): Promise<DenialResult> {
  try {
    if (!db) {
      throw new Error('Database not initialized');
    }

    // Get the current gate
    const [gate] = await db
      .select()
      .from(schema.approvalGates)
      .where(eq(schema.approvalGates.id, requestId));

    if (!gate) {
      return { success: false, error: 'Request not found', code: 'REQUEST_NOT_FOUND' };
    }

    if (!['PENDING', 'PHI_BLOCKED'].includes(gate.status)) {
      return { success: false, error: `Request cannot be denied (current: ${gate.status})`, code: 'INVALID_STATUS' };
    }

    // Update the gate
    await db
      .update(schema.approvalGates)
      .set({
        status: 'REJECTED',
        approvedById: userId,
        reviewedAt: new Date(),
        completedAt: new Date(),
        rejectionReason: reason,
      })
      .where(eq(schema.approvalGates.id, requestId));

    // Create audit entry
    await db.insert(schema.approvalAuditEntries).values({
      gateId: requestId,
      action: 'REJECTED',
      performedById: userId,
      performedByRole: role,
      details: { reason },
    });

    return { success: true };
  } catch (error) {
    console.error('Error denying bundle request:', error);
    return { success: false, error: 'Failed to deny request', code: 'DENIAL_FAILED' };
  }
}

/**
 * Requests PHI override for a blocked export
 */
export async function requestPHIOverride(
  requestId: string,
  userId: string,
  role: string,
  justification: string,
  conditions?: string[]
): Promise<OverrideResult> {
  try {
    if (!db) {
      throw new Error('Database not initialized');
    }

    // Get the current gate
    const [gate] = await db
      .select()
      .from(schema.approvalGates)
      .where(eq(schema.approvalGates.id, requestId));

    if (!gate) {
      return { success: false, error: 'Request not found', code: 'REQUEST_NOT_FOUND' };
    }

    if (gate.status !== 'PHI_BLOCKED') {
      return { success: false, error: 'Request is not PHI blocked', code: 'NOT_PHI_BLOCKED' };
    }

    // Calculate override expiration (24 hours)
    const overrideExpiresAt = new Date();
    overrideExpiresAt.setHours(overrideExpiresAt.getHours() + 24);

    const defaultConditions = [
      'Export must be logged to audit trail',
      'Data must be encrypted in transit',
      'Recipient must have signed DUA',
      'Override valid for 24 hours only',
    ];

    // Update metadata with override info
    const metadata = gate.metadata as Record<string, any> || {};
    metadata.phiOverride = {
      applied: true,
      justification,
      approvedBy: userId,
      approvedByRole: role,
      approvedAt: new Date().toISOString(),
      expiresAt: overrideExpiresAt.toISOString(),
      conditions: conditions || defaultConditions,
    };

    // Update gate to PENDING (now can be approved)
    await db
      .update(schema.approvalGates)
      .set({
        status: 'PENDING',
        isOverride: true,
        overrideJustification: justification,
        metadata,
      })
      .where(eq(schema.approvalGates.id, requestId));

    // Create audit entry
    await db.insert(schema.approvalAuditEntries).values({
      gateId: requestId,
      action: 'ESCALATED',
      performedById: userId,
      performedByRole: role,
      details: {
        overrideType: 'PHI_OVERRIDE',
        justification,
        conditions: conditions || defaultConditions,
        expiresAt: overrideExpiresAt.toISOString(),
      },
    });

    return {
      success: true,
      expiresAt: overrideExpiresAt.toISOString(),
      conditions: conditions || defaultConditions,
    };
  } catch (error) {
    console.error('Error processing PHI override:', error);
    return { success: false, error: 'Failed to process override', code: 'OVERRIDE_FAILED' };
  }
}

/**
 * Gets all pending export requests for steward approval queue
 */
export async function getPendingBundleRequests(): Promise<RequestStatus[]> {
  try {
    if (!db) {
      throw new Error('Database not initialized');
    }

    const gates = await db
      .select()
      .from(schema.approvalGates)
      .where(
        and(
          eq(schema.approvalGates.operationType, 'DATA_EXPORT'),
          eq(schema.approvalGates.resourceType, 'reproducibility_bundle'),
        )
      )
      .orderBy(desc(schema.approvalGates.requestedAt));

    // Filter to only pending and PHI_BLOCKED statuses
    const pendingGates = gates.filter(g => ['PENDING', 'PHI_BLOCKED'].includes(g.status));

    return pendingGates.map(gate => {
      const metadata = gate.metadata as Record<string, any> || {};
      return {
        requestId: gate.id,
        researchId: gate.resourceId,
        status: gate.status,
        requestedBy: gate.requestedById,
        requestedByEmail: gate.requestedByEmail || undefined,
        requestedByName: gate.requestedByName || undefined,
        requestedAt: gate.requestedAt.toISOString(),
        approvedBy: gate.approvedById || undefined,
        approvedAt: gate.reviewedAt?.toISOString(),
        deniedReason: gate.rejectionReason || undefined,
        expiresAt: gate.expiresAt?.toISOString(),
        phiOverride: metadata.phiOverride,
        metadata,
      };
    });
  } catch (error) {
    console.error('Error fetching pending bundle requests:', error);
    return [];
  }
}

/**
 * Gets all export requests for a specific project
 */
export async function getProjectBundleRequests(projectId: string): Promise<RequestStatus[]> {
  try {
    if (!db) {
      throw new Error('Database not initialized');
    }

    const gates = await db
      .select()
      .from(schema.approvalGates)
      .where(
        and(
          eq(schema.approvalGates.operationType, 'DATA_EXPORT'),
          eq(schema.approvalGates.resourceType, 'reproducibility_bundle'),
          eq(schema.approvalGates.resourceId, projectId),
        )
      )
      .orderBy(desc(schema.approvalGates.requestedAt));

    return gates.map(gate => {
      const metadata = gate.metadata as Record<string, any> || {};
      return {
        requestId: gate.id,
        researchId: gate.resourceId,
        status: gate.status,
        requestedBy: gate.requestedById,
        requestedByEmail: gate.requestedByEmail || undefined,
        requestedByName: gate.requestedByName || undefined,
        requestedAt: gate.requestedAt.toISOString(),
        approvedBy: gate.approvedById || undefined,
        approvedAt: gate.reviewedAt?.toISOString(),
        deniedReason: gate.rejectionReason || undefined,
        expiresAt: gate.expiresAt?.toISOString(),
        phiOverride: metadata.phiOverride,
        metadata,
      };
    });
  } catch (error) {
    console.error('Error fetching project bundle requests:', error);
    return [];
  }
}

/**
 * Gets the status of a bundle export request
 */
export async function getBundleRequestStatus(requestId: string): Promise<RequestStatus | null> {
  try {
    if (!db) {
      throw new Error('Database not initialized');
    }

    const [gate] = await db
      .select()
      .from(schema.approvalGates)
      .where(eq(schema.approvalGates.id, requestId));

    if (!gate) {
      return null;
    }

    const metadata = gate.metadata as Record<string, any> || {};

    return {
      requestId: gate.id,
      researchId: gate.resourceId,
      status: gate.status,
      requestedBy: gate.requestedById,
      requestedAt: gate.requestedAt.toISOString(),
      approvedBy: gate.approvedById || undefined,
      approvedAt: gate.reviewedAt?.toISOString(),
      deniedReason: gate.rejectionReason || undefined,
      expiresAt: gate.expiresAt?.toISOString(),
      phiOverride: metadata.phiOverride,
      metadata,
    };
  } catch (error) {
    console.error('Error getting bundle request status:', error);
    return null;
  }
}

// =====================
// Archive Generation
// =====================

/**
 * Verifies the audit log hash chain integrity
 */
function verifyAuditChain(auditLogs: Array<typeof schema.auditLogs.$inferSelect>): boolean {
  if (auditLogs.length === 0) return true;

  for (let i = 1; i < auditLogs.length; i++) {
    const currentLog = auditLogs[i];
    const previousLog = auditLogs[i - 1];

    // Check that previousHash matches the previous entry's hash
    if (currentLog.previousHash && previousLog.entryHash) {
      if (currentLog.previousHash !== previousLog.entryHash) {
        return false;
      }
    }
  }

  return true;
}

/**
 * Generates a README for the bundle
 */
function generateBundleReadme(manifest: BundleManifest): string {
  const phiOverrideSection = manifest.approval.phiOverride?.applied
    ? `
### PHI Override Applied
- **Justification**: ${manifest.approval.phiOverride.justification}
- **Approved By**: ${manifest.approval.phiOverride.approvedBy}
- **Expires At**: ${manifest.approval.phiOverride.expiresAt}
`
    : '';

  return `# Reproducibility Bundle

**Research ID**: ${manifest.researchId}
**Bundle ID**: ${manifest.bundleId}
**Generated**: ${manifest.createdAt}
**Generated By**: ${manifest.createdBy.name || manifest.createdBy.userId} (${manifest.createdBy.role})

## Contents

This bundle contains all artifacts necessary to reproduce the research workflow:

- **Topic Declarations**: ${manifest.contents.topics.count} version(s)
- **Statistical Analysis Plans**: ${manifest.contents.statisticalPlans.count} plan(s)
- **Artifacts**: ${manifest.contents.artifacts.count} file(s), ${(manifest.contents.artifacts.totalSizeBytes / 1024).toFixed(2)} KB
- **Audit Logs**: ${manifest.contents.auditLogs.count} entries (chain verified: ${manifest.contents.auditLogs.chainVerified ? 'YES' : 'NO'})
- **AI Generation Records**: ${manifest.contents.handoffPacks.count} records
- **Research Briefs**: ${manifest.contents.researchBriefs.count} brief(s)

## Directory Structure

\`\`\`
/manifest.json           - Bundle metadata and integrity checksums
/README.md               - This file
/topics/                 - Topic declaration versions
/statistical-plans/      - Statistical analysis plans
/artifacts/              - Research artifacts by stage
/audit-logs/             - Audit trail with hash chain
/prompts/                - AI prompt logs (handoff packs)
/research-briefs/        - Generated research briefs
/metadata/               - Environment and PHI scan reports
\`\`\`

## Integrity Verification

Bundle checksum (SHA-256): \`${manifest.integrity.bundleHash}\`

To verify: \`sha256sum reproducibility-bundle-*.zip\`

## Governance

- **Approval Status**: APPROVED
- **Request ID**: ${manifest.approval.requestId}
- **Requested At**: ${manifest.approval.requestedAt}
- **Approved By**: ${manifest.approval.approvedBy}
- **Approved At**: ${manifest.approval.approvedAt}
${phiOverrideSection}

## Environment

- **Node Version**: ${manifest.environment.nodeVersion}
- **ROS Version**: ${manifest.environment.rosVersion}
- **Deployment**: ${manifest.environment.deploymentEnvironment}
${manifest.environment.gitSha ? `- **Git SHA**: ${manifest.environment.gitSha}` : ''}
${manifest.environment.gitBranch ? `- **Git Branch**: ${manifest.environment.gitBranch}` : ''}

---

This bundle was generated from ResearchFlow Canvas v${manifest.environment.rosVersion}.
`;
}

/**
 * Generates the bundle archive
 */
export async function generateBundleArchive(
  requestId: string
): Promise<{ archive: archiver.Archiver; manifest: BundleManifest }> {
  // Get the request status
  const status = await getBundleRequestStatus(requestId);
  if (!status) {
    throw new Error('Request not found');
  }

  if (status.status !== 'APPROVED') {
    throw new Error(`Request not approved (current: ${status.status})`);
  }

  // Check expiration
  if (status.expiresAt && new Date(status.expiresAt) < new Date()) {
    throw new Error('Download link has expired');
  }

  // Gather content
  const content = await gatherBundleContent(status.researchId);
  const metadata = status.metadata || {};
  const bundleId = metadata.bundleId || crypto.randomUUID();

  // Verify audit chain
  const chainVerified = verifyAuditChain(content.auditLogs);

  // Create archive
  const archive = archiver('zip', { zlib: { level: 9 } });

  // Track content hashes
  const contentHashes: Record<string, string> = {};

  // Helper to add content and track hash
  const addContent = (content: string, filename: string) => {
    contentHashes[filename] = crypto.createHash('sha256').update(content).digest('hex');
    archive.append(content, { name: filename });
  };

  // Add topics
  for (const topic of content.topics) {
    const filename = `topics/topic-v${topic.version}-${topic.id.slice(0, 8)}.json`;
    addContent(JSON.stringify(topic, null, 2), filename);
  }

  // Add statistical plans
  for (const plan of content.statisticalPlans) {
    const filename = `statistical-plans/sap-${plan.id.slice(0, 8)}.json`;
    addContent(JSON.stringify(plan, null, 2), filename);
  }

  // Add artifacts by stage
  for (const artifact of content.artifacts) {
    const filename = `artifacts/${artifact.stageId}/${artifact.filename}`;
    addContent(artifact.content, filename);
  }

  // Add audit logs
  const auditContent = JSON.stringify({
    chainVerified,
    entries: content.auditLogs,
  }, null, 2);
  addContent(auditContent, 'audit-logs/audit-chain.json');

  // Add handoff packs (prompts)
  if (content.handoffPacks.length > 0) {
    const promptsContent = JSON.stringify(content.handoffPacks, null, 2);
    addContent(promptsContent, 'prompts/all-prompts.json');

    for (const pack of content.handoffPacks) {
      const filename = `prompts/${pack.packType}-${pack.id.slice(0, 8)}.json`;
      addContent(JSON.stringify(pack, null, 2), filename);
    }
  }

  // Add research briefs
  for (const brief of content.researchBriefs) {
    const filename = `research-briefs/brief-${brief.id.slice(0, 8)}.json`;
    addContent(JSON.stringify(brief, null, 2), filename);
  }

  // Add environment metadata
  const validDeploymentEnvs = ['development', 'staging', 'production'] as const;
  const nodeEnv = process.env.NODE_ENV || 'development';
  const deploymentEnvironment = validDeploymentEnvs.includes(nodeEnv as any)
    ? (nodeEnv as 'development' | 'staging' | 'production')
    : 'development';

  const environmentData = {
    nodeVersion: process.version,
    rosVersion: '1.0.0',
    gitSha: process.env.GIT_SHA || undefined,
    gitBranch: process.env.GIT_BRANCH || undefined,
    deploymentEnvironment,
  };
  addContent(JSON.stringify(environmentData, null, 2), 'metadata/environment.json');

  // Add PHI scan report if available
  if (metadata.phiScanSummary) {
    addContent(JSON.stringify(metadata.phiScanSummary, null, 2), 'metadata/phi-scan-report.json');
  }

  // Create manifest
  const createdAt = new Date().toISOString();
  const manifest: BundleManifest = {
    schemaVersion: '1.0.0',
    bundleId,
    researchId: status.researchId,
    createdAt,
    createdBy: {
      userId: status.requestedBy,
      role: metadata.requestedByRole || 'RESEARCHER',
    },
    approval: {
      requestId: status.requestId,
      requestedAt: status.requestedAt,
      approvedAt: status.approvedAt || createdAt,
      approvedBy: status.approvedBy || 'UNKNOWN',
      phiOverride: status.phiOverride,
    },
    contents: {
      topics: {
        count: content.topics.length,
        versions: content.topics.map(t => t.version),
      },
      statisticalPlans: {
        count: content.statisticalPlans.length,
        statuses: content.statisticalPlans.map(p => p.status),
      },
      artifacts: {
        count: content.artifacts.length,
        totalSizeBytes: content.artifacts.reduce((sum, a) => sum + a.sizeBytes, 0),
      },
      auditLogs: {
        count: content.auditLogs.length,
        chainVerified,
      },
      handoffPacks: {
        count: content.handoffPacks.length,
      },
      researchBriefs: {
        count: content.researchBriefs.length,
      },
    },
    integrity: {
      manifestHash: '', // Will be set after serialization
      contentHashes,
      bundleHash: '', // Will be set after finalization
    },
    environment: environmentData,
  };

  // Calculate manifest hash (excluding the hash fields)
  const manifestForHash = { ...manifest, integrity: { ...manifest.integrity, manifestHash: '', bundleHash: '' } };
  manifest.integrity.manifestHash = crypto.createHash('sha256')
    .update(JSON.stringify(manifestForHash))
    .digest('hex');

  // Add manifest
  const manifestContent = JSON.stringify(manifest, null, 2);
  archive.append(manifestContent, { name: 'manifest.json' });

  // Add README
  const readmeContent = generateBundleReadme(manifest);
  archive.append(readmeContent, { name: 'README.md' });

  return { archive, manifest };
}
