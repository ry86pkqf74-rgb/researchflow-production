/**
 * Submission Service
 *
 * Manages journal/conference submissions and rebuttal workflow:
 * - Submission targets (journals/conferences)
 * - Submission lifecycle tracking
 * - Reviewer point capture with PHI scanning
 * - Rebuttal response management
 * - Submission package generation
 */
import { db } from "../../db";
import {
  submissions,
  submissionTargets,
  reviewerPoints,
  rebuttalResponses,
  submissionPackages,
  artifacts,
  artifactVersions,
} from "@researchflow/core/schema";
import { eq, and, isNull, desc, sql } from "drizzle-orm";
import { nanoid } from "nanoid";
import { scan as scanPhi, hasPhi } from "@researchflow/phi-engine";
import { createHash } from "crypto";

export type SubmissionStatus = 'draft' | 'submitted' | 'revise' | 'accepted' | 'rejected' | 'withdrawn' | 'camera_ready';
export type SubmissionTargetKind = 'journal' | 'conference';
export type ReviewerPointStatus = 'open' | 'resolved';

export interface PhiFindingLocation {
  type: string;
  startOffset: number;
  endOffset: number;
  hash: string;
}

export interface CreateTargetParams {
  name: string;
  kind: SubmissionTargetKind;
  orgId?: string;
  websiteUrl?: string;
  requirementsArtifactId?: string;
  metadata?: Record<string, unknown>;
  createdBy: string;
}

export interface CreateSubmissionParams {
  researchId: string;
  targetId: string;
  manuscriptArtifactId?: string;
  manuscriptVersionId?: string;
  externalTrackingId?: string;
  metadata?: Record<string, unknown>;
  createdBy: string;
}

export interface CreateReviewerPointParams {
  submissionId: string;
  reviewerLabel?: string;
  body: string;
  anchorData?: Record<string, unknown>;
  createdBy: string;
  skipPhiCheck?: boolean;
}

export interface CreateRebuttalParams {
  reviewerPointId: string;
  responseBody: string;
  evidenceArtifactIds?: string[];
  manuscriptChangeRefs?: Record<string, unknown>[];
  createdBy: string;
  skipPhiCheck?: boolean;
}

/**
 * Hash text for audit purposes.
 */
function hashText(text: string): string {
  return createHash("sha256").update(text).digest("hex").slice(0, 16);
}

/**
 * Scan text for PHI and return location-only findings.
 */
function scanTextForPhiLocations(text: string): PhiFindingLocation[] {
  const findings = scanPhi(text);
  return findings.map((f: any) => ({
    type: f.type || 'UNKNOWN',
    startOffset: f.start || 0,
    endOffset: f.end || 0,
    hash: hashText(text.slice(f.start || 0, f.end || 0)),
  }));
}

// ==================== SUBMISSION TARGETS ====================

/**
 * Create a new submission target (journal/conference).
 */
export async function createTarget(params: CreateTargetParams): Promise<any> {
  const targetId = `target_${nanoid(12)}`;

  const [target] = await db.insert(submissionTargets).values({
    id: targetId,
    name: params.name,
    kind: params.kind,
    orgId: params.orgId,
    websiteUrl: params.websiteUrl,
    requirementsArtifactId: params.requirementsArtifactId,
    metadata: params.metadata || {},
    createdBy: params.createdBy,
  }).returning();

  return target;
}

/**
 * Get submission target by ID.
 */
export async function getTarget(targetId: string): Promise<any | null> {
  const [target] = await db
    .select()
    .from(submissionTargets)
    .where(eq(submissionTargets.id, targetId))
    .limit(1);

  return target || null;
}

/**
 * List submission targets.
 */
export async function listTargets(options?: {
  kind?: SubmissionTargetKind;
  orgId?: string;
}): Promise<any[]> {
  let query = db.select().from(submissionTargets);

  const rows = await query;

  let filtered = rows;
  if (options?.kind) {
    filtered = filtered.filter(t => t.kind === options.kind);
  }
  if (options?.orgId) {
    filtered = filtered.filter(t => t.orgId === options.orgId);
  }

  return filtered;
}

// ==================== SUBMISSIONS ====================

/**
 * Create a new submission.
 */
export async function createSubmission(params: CreateSubmissionParams): Promise<{
  success: boolean;
  submission?: any;
  error?: string;
}> {
  // Verify target exists
  const target = await getTarget(params.targetId);
  if (!target) {
    return { success: false, error: "Submission target not found" };
  }

  const submissionId = `sub_${nanoid(12)}`;

  const [submission] = await db.insert(submissions).values({
    id: submissionId,
    researchId: params.researchId,
    targetId: params.targetId,
    status: 'draft',
    currentManuscriptArtifactId: params.manuscriptArtifactId,
    currentManuscriptVersionId: params.manuscriptVersionId,
    externalTrackingId: params.externalTrackingId,
    metadata: params.metadata || {},
    createdBy: params.createdBy,
  }).returning();

  return { success: true, submission };
}

/**
 * Get submission by ID.
 */
export async function getSubmission(submissionId: string): Promise<any | null> {
  const [submission] = await db
    .select()
    .from(submissions)
    .where(eq(submissions.id, submissionId))
    .limit(1);

  return submission || null;
}

/**
 * List submissions for a research project.
 */
export async function listSubmissions(researchId: string, options?: {
  status?: SubmissionStatus;
  targetId?: string;
}): Promise<any[]> {
  const rows = await db
    .select()
    .from(submissions)
    .where(eq(submissions.researchId, researchId))
    .orderBy(desc(submissions.createdAt));

  let filtered = rows;
  if (options?.status) {
    filtered = filtered.filter(s => s.status === options.status);
  }
  if (options?.targetId) {
    filtered = filtered.filter(s => s.targetId === options.targetId);
  }

  return filtered;
}

/**
 * Update submission status.
 */
export async function updateSubmissionStatus(
  submissionId: string,
  status: SubmissionStatus,
  updatedBy: string
): Promise<any | null> {
  const now = new Date();

  const updateData: Record<string, any> = {
    status,
    updatedAt: now,
  };

  // Set special timestamps based on status
  if (status === 'submitted') {
    updateData.submittedAt = now;
  } else if (['accepted', 'rejected'].includes(status)) {
    updateData.decisionAt = now;
  }

  const [updated] = await db
    .update(submissions)
    .set(updateData)
    .where(eq(submissions.id, submissionId))
    .returning();

  return updated || null;
}

/**
 * Update submission manuscript reference.
 */
export async function updateSubmissionManuscript(
  submissionId: string,
  manuscriptArtifactId: string,
  manuscriptVersionId?: string
): Promise<any | null> {
  const [updated] = await db
    .update(submissions)
    .set({
      currentManuscriptArtifactId: manuscriptArtifactId,
      currentManuscriptVersionId: manuscriptVersionId,
      updatedAt: new Date(),
    })
    .where(eq(submissions.id, submissionId))
    .returning();

  return updated || null;
}

// ==================== REVIEWER POINTS ====================

/**
 * Create a reviewer point with PHI scanning.
 */
export async function createReviewerPoint(params: CreateReviewerPointParams): Promise<{
  success: boolean;
  point?: any;
  error?: string;
  phiFindings?: PhiFindingLocation[];
}> {
  // PHI scan the body
  if (!params.skipPhiCheck && hasPhi(params.body)) {
    const phiFindings = scanTextForPhiLocations(params.body);
    return {
      success: false,
      error: "Reviewer point contains PHI. Remove sensitive information or request override.",
      phiFindings,
    };
  }

  // Verify submission exists
  const submission = await getSubmission(params.submissionId);
  if (!submission) {
    return { success: false, error: "Submission not found" };
  }

  const pointId = `rp_${nanoid(12)}`;

  const [point] = await db.insert(reviewerPoints).values({
    id: pointId,
    submissionId: params.submissionId,
    reviewerLabel: params.reviewerLabel || 'reviewer_1',
    body: params.body,
    anchorData: params.anchorData || {},
    status: 'open',
    createdBy: params.createdBy,
    phiScanStatus: params.skipPhiCheck ? 'OVERRIDE' : 'PASS',
    phiFindings: [],
  }).returning();

  return { success: true, point };
}

/**
 * List reviewer points for a submission.
 */
export async function listReviewerPoints(submissionId: string, options?: {
  status?: ReviewerPointStatus;
  reviewerLabel?: string;
}): Promise<any[]> {
  const rows = await db
    .select()
    .from(reviewerPoints)
    .where(eq(reviewerPoints.submissionId, submissionId))
    .orderBy(reviewerPoints.createdAt);

  let filtered = rows;
  if (options?.status) {
    filtered = filtered.filter(p => p.status === options.status);
  }
  if (options?.reviewerLabel) {
    filtered = filtered.filter(p => p.reviewerLabel === options.reviewerLabel);
  }

  return filtered;
}

/**
 * Get a reviewer point by ID.
 */
export async function getReviewerPoint(pointId: string): Promise<any | null> {
  const [point] = await db
    .select()
    .from(reviewerPoints)
    .where(eq(reviewerPoints.id, pointId))
    .limit(1);

  return point || null;
}

/**
 * Resolve a reviewer point.
 */
export async function resolveReviewerPoint(
  pointId: string,
  resolvedBy: string
): Promise<any | null> {
  const [resolved] = await db
    .update(reviewerPoints)
    .set({
      status: 'resolved',
      resolvedAt: new Date(),
      resolvedBy,
    })
    .where(eq(reviewerPoints.id, pointId))
    .returning();

  return resolved || null;
}

// ==================== REBUTTAL RESPONSES ====================

/**
 * Create a rebuttal response with PHI scanning.
 */
export async function createRebuttal(params: CreateRebuttalParams): Promise<{
  success: boolean;
  rebuttal?: any;
  error?: string;
  phiFindings?: PhiFindingLocation[];
}> {
  // PHI scan the response body
  if (!params.skipPhiCheck && hasPhi(params.responseBody)) {
    const phiFindings = scanTextForPhiLocations(params.responseBody);
    return {
      success: false,
      error: "Rebuttal response contains PHI. Remove sensitive information or request override.",
      phiFindings,
    };
  }

  // Verify reviewer point exists
  const point = await getReviewerPoint(params.reviewerPointId);
  if (!point) {
    return { success: false, error: "Reviewer point not found" };
  }

  const rebuttalId = `reb_${nanoid(12)}`;

  const [rebuttal] = await db.insert(rebuttalResponses).values({
    id: rebuttalId,
    reviewerPointId: params.reviewerPointId,
    responseBody: params.responseBody,
    evidenceArtifactIds: params.evidenceArtifactIds || [],
    manuscriptChangeRefs: params.manuscriptChangeRefs || [],
    createdBy: params.createdBy,
    phiScanStatus: params.skipPhiCheck ? 'OVERRIDE' : 'PASS',
  }).returning();

  return { success: true, rebuttal };
}

/**
 * List rebuttals for a reviewer point.
 */
export async function listRebuttals(reviewerPointId: string): Promise<any[]> {
  return db
    .select()
    .from(rebuttalResponses)
    .where(eq(rebuttalResponses.reviewerPointId, reviewerPointId))
    .orderBy(rebuttalResponses.createdAt);
}

/**
 * Get a rebuttal by ID.
 */
export async function getRebuttal(rebuttalId: string): Promise<any | null> {
  const [rebuttal] = await db
    .select()
    .from(rebuttalResponses)
    .where(eq(rebuttalResponses.id, rebuttalId))
    .limit(1);

  return rebuttal || null;
}

// ==================== SUBMISSION PACKAGES ====================

/**
 * Create a submission package.
 */
export async function createPackage(params: {
  submissionId: string;
  packageType: string;
  artifactIds: string[];
  manifest: Record<string, unknown>;
  createdBy: string;
}): Promise<any> {
  const packageId = `pkg_${nanoid(12)}`;

  const [pkg] = await db.insert(submissionPackages).values({
    id: packageId,
    submissionId: params.submissionId,
    packageType: params.packageType,
    artifactIds: params.artifactIds,
    manifest: params.manifest,
    createdBy: params.createdBy,
  }).returning();

  return pkg;
}

/**
 * List packages for a submission.
 */
export async function listPackages(submissionId: string): Promise<any[]> {
  return db
    .select()
    .from(submissionPackages)
    .where(eq(submissionPackages.submissionId, submissionId))
    .orderBy(desc(submissionPackages.createdAt));
}

/**
 * Get submission statistics for a research project.
 */
export async function getSubmissionStats(researchId: string): Promise<{
  total: number;
  byStatus: Record<SubmissionStatus, number>;
  byTarget: Array<{ targetId: string; targetName: string; count: number }>;
}> {
  const allSubmissions = await listSubmissions(researchId);

  const byStatus: Record<string, number> = {};
  const targetCounts: Record<string, number> = {};

  for (const sub of allSubmissions) {
    const status = sub.status || 'draft';
    byStatus[status] = (byStatus[status] || 0) + 1;
    targetCounts[sub.targetId] = (targetCounts[sub.targetId] || 0) + 1;
  }

  // Get target names
  const targetIds = Object.keys(targetCounts);
  const targets = await Promise.all(targetIds.map(id => getTarget(id)));

  const byTarget = targetIds.map((id, idx) => ({
    targetId: id,
    targetName: targets[idx]?.name || 'Unknown',
    count: targetCounts[id],
  }));

  return {
    total: allSubmissions.length,
    byStatus: byStatus as Record<SubmissionStatus, number>,
    byTarget,
  };
}
