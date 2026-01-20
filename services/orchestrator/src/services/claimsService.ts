/**
 * Claims Service
 *
 * Manages claims and evidence linking for manuscripts:
 * - PHI scanning on claim text
 * - Evidence linking with location-only storage
 * - Coverage reporting by section
 */
import { db } from "../../db";
import { claims, claimEvidenceLinks, artifacts } from "@researchflow/core/schema";
import { eq, and, isNull, desc, sql } from "drizzle-orm";
import { nanoid } from "nanoid";
import { scan as scanPhi, hasPhi } from "@researchflow/phi-engine";
import { createHash } from "crypto";

export type ClaimStatus = 'draft' | 'verified' | 'disputed' | 'retracted';
export type EvidenceType = 'citation' | 'data_artifact' | 'figure' | 'table' | 'external_url';

export interface ClaimAnchor {
  sectionId?: string;
  sectionName?: string;
  startOffset: number;
  endOffset: number;
  textHash: string; // Hash of selected text, never raw text
}

export interface PhiFindingLocation {
  type: string;
  startOffset: number;
  endOffset: number;
  hash: string;
}

export interface CreateClaimParams {
  researchId: string;
  manuscriptArtifactId: string;
  versionId?: string;
  claimText: string;
  anchor: ClaimAnchor;
  createdBy: string;
  status?: ClaimStatus;
  metadata?: Record<string, unknown>;
  skipPhiCheck?: boolean;
}

export interface LinkEvidenceParams {
  claimId: string;
  evidenceType: EvidenceType;
  evidenceArtifactId?: string;
  citationId?: string;
  externalUrl?: string;
  locator: {
    // Location-only data, never raw text
    pageNumber?: number;
    sectionId?: string;
    rowIndex?: number;
    columnIndex?: number;
    figureId?: string;
    startOffset?: number;
    endOffset?: number;
    textHash?: string;
  };
  linkedBy: string;
  notes?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Hash text for storage (never store raw PHI).
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

/**
 * Create a new claim with PHI scanning.
 */
export async function createClaim(params: CreateClaimParams): Promise<{
  success: boolean;
  claim?: any;
  error?: string;
  phiFindings?: PhiFindingLocation[];
}> {
  // PHI scan the claim text
  if (!params.skipPhiCheck && hasPhi(params.claimText)) {
    const phiFindings = scanTextForPhiLocations(params.claimText);
    return {
      success: false,
      error: "Claim text contains PHI. Remove sensitive information or request override.",
      phiFindings,
    };
  }

  // Verify manuscript artifact exists
  const [artifact] = await db
    .select()
    .from(artifacts)
    .where(eq(artifacts.id, params.manuscriptArtifactId))
    .limit(1);

  if (!artifact) {
    return { success: false, error: "Manuscript artifact not found" };
  }

  const claimId = `claim_${nanoid(12)}`;
  const textHash = hashText(params.claimText);

  const [newClaim] = await db.insert(claims).values({
    id: claimId,
    researchId: params.researchId,
    manuscriptArtifactId: params.manuscriptArtifactId,
    versionId: params.versionId || artifact.currentVersionId,
    claimText: params.claimText,
    claimTextHash: textHash,
    anchor: {
      ...params.anchor,
      textHash: params.anchor.textHash || textHash,
    },
    status: params.status || 'draft',
    createdBy: params.createdBy,
    phiScanStatus: params.skipPhiCheck ? 'OVERRIDE' : 'PASS',
    metadata: params.metadata || {},
  }).returning();

  return { success: true, claim: newClaim };
}

/**
 * Get claims for a manuscript.
 */
export async function getClaimsForManuscript(
  manuscriptArtifactId: string,
  options?: {
    status?: ClaimStatus;
    sectionId?: string;
    includeEvidence?: boolean;
  }
): Promise<any[]> {
  let query = db
    .select()
    .from(claims)
    .where(and(
      eq(claims.manuscriptArtifactId, manuscriptArtifactId),
      isNull(claims.deletedAt)
    ))
    .orderBy(desc(claims.createdAt));

  const rows = await query;

  // Filter by status if provided
  let filtered = rows;
  if (options?.status) {
    filtered = filtered.filter(r => r.status === options.status);
  }

  // Filter by section if provided
  if (options?.sectionId) {
    filtered = filtered.filter(r => {
      const anchor = r.anchor as ClaimAnchor;
      return anchor?.sectionId === options.sectionId;
    });
  }

  // Include evidence links if requested
  if (options?.includeEvidence) {
    const claimIds = filtered.map(c => c.id);
    if (claimIds.length > 0) {
      const evidenceLinks = await db
        .select()
        .from(claimEvidenceLinks)
        .where(and(
          sql`${claimEvidenceLinks.claimId} IN (${sql.join(claimIds.map(id => sql`${id}`), sql`, `)})`,
          isNull(claimEvidenceLinks.deletedAt)
        ));

      const evidenceByClaimId = new Map<string, any[]>();
      for (const link of evidenceLinks) {
        if (!evidenceByClaimId.has(link.claimId)) {
          evidenceByClaimId.set(link.claimId, []);
        }
        evidenceByClaimId.get(link.claimId)!.push(link);
      }

      return filtered.map(claim => ({
        ...claim,
        evidenceLinks: evidenceByClaimId.get(claim.id) || [],
      }));
    }
  }

  return filtered;
}

/**
 * Get a single claim by ID.
 */
export async function getClaim(claimId: string): Promise<any | null> {
  const [claim] = await db
    .select()
    .from(claims)
    .where(and(
      eq(claims.id, claimId),
      isNull(claims.deletedAt)
    ))
    .limit(1);

  return claim || null;
}

/**
 * Update a claim's status.
 */
export async function updateClaimStatus(
  claimId: string,
  status: ClaimStatus,
  updatedBy: string
): Promise<any | null> {
  const [updated] = await db
    .update(claims)
    .set({
      status,
      updatedAt: new Date(),
      metadata: sql`jsonb_set(COALESCE(metadata, '{}'::jsonb), '{statusHistory}',
        COALESCE(metadata->'statusHistory', '[]'::jsonb) || jsonb_build_object(
          'status', ${status}::text,
          'changedBy', ${updatedBy}::text,
          'changedAt', ${new Date().toISOString()}::text
        ))`,
    })
    .where(and(
      eq(claims.id, claimId),
      isNull(claims.deletedAt)
    ))
    .returning();

  return updated || null;
}

/**
 * Link evidence to a claim.
 */
export async function linkEvidence(params: LinkEvidenceParams): Promise<{
  success: boolean;
  link?: any;
  error?: string;
}> {
  // Verify claim exists
  const claim = await getClaim(params.claimId);
  if (!claim) {
    return { success: false, error: "Claim not found" };
  }

  // Verify evidence artifact exists if provided
  if (params.evidenceArtifactId) {
    const [artifact] = await db
      .select()
      .from(artifacts)
      .where(eq(artifacts.id, params.evidenceArtifactId))
      .limit(1);

    if (!artifact) {
      return { success: false, error: "Evidence artifact not found" };
    }
  }

  const linkId = `evlink_${nanoid(12)}`;

  const [newLink] = await db.insert(claimEvidenceLinks).values({
    id: linkId,
    claimId: params.claimId,
    evidenceType: params.evidenceType,
    evidenceArtifactId: params.evidenceArtifactId,
    citationId: params.citationId,
    externalUrl: params.externalUrl,
    locator: params.locator,
    linkedBy: params.linkedBy,
    notes: params.notes,
    metadata: params.metadata || {},
  }).returning();

  return { success: true, link: newLink };
}

/**
 * Get evidence links for a claim.
 */
export async function getEvidenceForClaim(claimId: string): Promise<any[]> {
  return db
    .select()
    .from(claimEvidenceLinks)
    .where(and(
      eq(claimEvidenceLinks.claimId, claimId),
      isNull(claimEvidenceLinks.deletedAt)
    ))
    .orderBy(desc(claimEvidenceLinks.linkedAt));
}

/**
 * Remove evidence link.
 */
export async function unlinkEvidence(linkId: string): Promise<boolean> {
  const [deleted] = await db
    .update(claimEvidenceLinks)
    .set({ deletedAt: new Date() })
    .where(and(
      eq(claimEvidenceLinks.id, linkId),
      isNull(claimEvidenceLinks.deletedAt)
    ))
    .returning();

  return !!deleted;
}

/**
 * Delete a claim (soft delete).
 */
export async function deleteClaim(claimId: string): Promise<boolean> {
  const [deleted] = await db
    .update(claims)
    .set({ deletedAt: new Date() })
    .where(and(
      eq(claims.id, claimId),
      isNull(claims.deletedAt)
    ))
    .returning();

  return !!deleted;
}

/**
 * Get coverage report for a manuscript.
 * Returns counts of claims and evidence by section.
 */
export async function getCoverageReport(manuscriptArtifactId: string): Promise<{
  totalClaims: number;
  claimsWithEvidence: number;
  claimsWithoutEvidence: number;
  bySection: Array<{
    sectionId: string;
    sectionName: string;
    totalClaims: number;
    claimsWithEvidence: number;
    coveragePercent: number;
  }>;
  byStatus: Record<ClaimStatus, number>;
  evidenceTypeBreakdown: Record<EvidenceType, number>;
}> {
  // Get all claims for the manuscript
  const allClaims = await db
    .select()
    .from(claims)
    .where(and(
      eq(claims.manuscriptArtifactId, manuscriptArtifactId),
      isNull(claims.deletedAt)
    ));

  const claimIds = allClaims.map(c => c.id);

  // Get evidence links
  let evidenceLinks: any[] = [];
  if (claimIds.length > 0) {
    evidenceLinks = await db
      .select()
      .from(claimEvidenceLinks)
      .where(and(
        sql`${claimEvidenceLinks.claimId} IN (${sql.join(claimIds.map(id => sql`${id}`), sql`, `)})`,
        isNull(claimEvidenceLinks.deletedAt)
      ));
  }

  // Build sets for analysis
  const claimsWithEvidenceSet = new Set(evidenceLinks.map(e => e.claimId));

  // Group by section
  const sectionMap = new Map<string, {
    sectionId: string;
    sectionName: string;
    claims: any[];
    claimsWithEvidence: number;
  }>();

  for (const claim of allClaims) {
    const anchor = claim.anchor as ClaimAnchor;
    const sectionId = anchor?.sectionId || 'unknown';
    const sectionName = anchor?.sectionName || 'Unknown Section';

    if (!sectionMap.has(sectionId)) {
      sectionMap.set(sectionId, {
        sectionId,
        sectionName,
        claims: [],
        claimsWithEvidence: 0,
      });
    }

    const section = sectionMap.get(sectionId)!;
    section.claims.push(claim);
    if (claimsWithEvidenceSet.has(claim.id)) {
      section.claimsWithEvidence++;
    }
  }

  // Count by status
  const byStatus: Record<ClaimStatus, number> = {
    draft: 0,
    verified: 0,
    disputed: 0,
    retracted: 0,
  };
  for (const claim of allClaims) {
    const status = (claim.status as ClaimStatus) || 'draft';
    byStatus[status] = (byStatus[status] || 0) + 1;
  }

  // Count by evidence type
  const evidenceTypeBreakdown: Record<string, number> = {};
  for (const link of evidenceLinks) {
    const type = link.evidenceType || 'unknown';
    evidenceTypeBreakdown[type] = (evidenceTypeBreakdown[type] || 0) + 1;
  }

  // Build section report
  const bySection = Array.from(sectionMap.values()).map(section => ({
    sectionId: section.sectionId,
    sectionName: section.sectionName,
    totalClaims: section.claims.length,
    claimsWithEvidence: section.claimsWithEvidence,
    coveragePercent: section.claims.length > 0
      ? Math.round((section.claimsWithEvidence / section.claims.length) * 100)
      : 0,
  }));

  return {
    totalClaims: allClaims.length,
    claimsWithEvidence: claimsWithEvidenceSet.size,
    claimsWithoutEvidence: allClaims.length - claimsWithEvidenceSet.size,
    bySection,
    byStatus,
    evidenceTypeBreakdown: evidenceTypeBreakdown as Record<EvidenceType, number>,
  };
}
