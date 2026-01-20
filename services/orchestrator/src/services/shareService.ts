/**
 * Share Service
 *
 * Manages external reviewer share links with:
 * - Secure token generation and hashing
 * - Time-limited access
 * - Permission scoping (read, comment)
 * - Token validation and revocation
 */
import { db } from "../../db";
import { artifactShares, artifacts } from "@researchflow/core/schema";
import { eq, and, isNull, gt, sql } from "drizzle-orm";
import { nanoid } from "nanoid";
import { createHash, randomBytes } from "crypto";

export type SharePermission = 'read' | 'comment';

export interface CreateShareParams {
  artifactId: string;
  permission: SharePermission;
  expiresInDays?: number; // Default 7 days
  createdBy: string;
  metadata?: Record<string, unknown>;
}

export interface ShareLink {
  id: string;
  artifactId: string;
  permission: SharePermission;
  token: string; // Raw token (only returned on creation)
  expiresAt: Date | null;
  createdBy: string;
  createdAt: Date;
}

export interface ValidatedShare {
  id: string;
  artifactId: string;
  permission: SharePermission;
  expiresAt: Date | null;
  artifact: {
    id: string;
    type: string;
    name: string;
    researchId: string;
  };
}

/**
 * Generate a secure random token.
 */
function generateToken(): string {
  return randomBytes(32).toString('base64url');
}

/**
 * Hash a token for storage.
 */
function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/**
 * Create a new share link.
 * Returns the raw token which should be sent to the reviewer.
 */
export async function createShare(params: CreateShareParams): Promise<{
  success: boolean;
  share?: ShareLink;
  error?: string;
}> {
  // Verify artifact exists
  const [artifact] = await db
    .select()
    .from(artifacts)
    .where(eq(artifacts.id, params.artifactId))
    .limit(1);

  if (!artifact) {
    return { success: false, error: "Artifact not found" };
  }

  const shareId = `share_${nanoid(12)}`;
  const token = generateToken();
  const tokenHash = hashToken(token);

  // Calculate expiration (default 7 days)
  const expiresAt = params.expiresInDays !== undefined
    ? new Date(Date.now() + params.expiresInDays * 24 * 60 * 60 * 1000)
    : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  const [newShare] = await db.insert(artifactShares).values({
    id: shareId,
    artifactId: params.artifactId,
    permission: params.permission,
    tokenHash,
    expiresAt,
    createdBy: params.createdBy,
    metadata: params.metadata || {},
  }).returning();

  return {
    success: true,
    share: {
      id: newShare.id,
      artifactId: newShare.artifactId,
      permission: newShare.permission as SharePermission,
      token, // Return raw token only on creation
      expiresAt: newShare.expiresAt,
      createdBy: newShare.createdBy,
      createdAt: newShare.createdAt,
    },
  };
}

/**
 * Validate a share token and return the share details.
 * Used to verify access when a reviewer uses a share link.
 */
export async function validateShareToken(token: string): Promise<{
  valid: boolean;
  share?: ValidatedShare;
  error?: string;
}> {
  const tokenHash = hashToken(token);

  const [share] = await db
    .select()
    .from(artifactShares)
    .where(and(
      eq(artifactShares.tokenHash, tokenHash),
      isNull(artifactShares.revokedAt)
    ))
    .limit(1);

  if (!share) {
    return { valid: false, error: "Invalid or expired share link" };
  }

  // Check expiration
  if (share.expiresAt && share.expiresAt < new Date()) {
    return { valid: false, error: "Share link has expired" };
  }

  // Get artifact details
  const [artifact] = await db
    .select()
    .from(artifacts)
    .where(eq(artifacts.id, share.artifactId))
    .limit(1);

  if (!artifact) {
    return { valid: false, error: "Artifact no longer exists" };
  }

  return {
    valid: true,
    share: {
      id: share.id,
      artifactId: share.artifactId,
      permission: share.permission as SharePermission,
      expiresAt: share.expiresAt,
      artifact: {
        id: artifact.id,
        type: artifact.type,
        name: artifact.name,
        researchId: artifact.researchId,
      },
    },
  };
}

/**
 * List active shares for an artifact.
 */
export async function listShares(artifactId: string): Promise<any[]> {
  return db
    .select({
      id: artifactShares.id,
      artifactId: artifactShares.artifactId,
      permission: artifactShares.permission,
      expiresAt: artifactShares.expiresAt,
      createdBy: artifactShares.createdBy,
      createdAt: artifactShares.createdAt,
      revokedAt: artifactShares.revokedAt,
      metadata: artifactShares.metadata,
    })
    .from(artifactShares)
    .where(eq(artifactShares.artifactId, artifactId))
    .orderBy(artifactShares.createdAt);
}

/**
 * Revoke a share link.
 */
export async function revokeShare(shareId: string): Promise<boolean> {
  const [revoked] = await db
    .update(artifactShares)
    .set({ revokedAt: new Date() })
    .where(and(
      eq(artifactShares.id, shareId),
      isNull(artifactShares.revokedAt)
    ))
    .returning();

  return !!revoked;
}

/**
 * Get a share by ID.
 */
export async function getShare(shareId: string): Promise<any | null> {
  const [share] = await db
    .select()
    .from(artifactShares)
    .where(eq(artifactShares.id, shareId))
    .limit(1);

  return share || null;
}

/**
 * Extend a share's expiration.
 */
export async function extendShare(
  shareId: string,
  additionalDays: number
): Promise<any | null> {
  const share = await getShare(shareId);
  if (!share || share.revokedAt) {
    return null;
  }

  const currentExpiry = share.expiresAt || new Date();
  const newExpiry = new Date(currentExpiry.getTime() + additionalDays * 24 * 60 * 60 * 1000);

  const [updated] = await db
    .update(artifactShares)
    .set({ expiresAt: newExpiry })
    .where(eq(artifactShares.id, shareId))
    .returning();

  return updated || null;
}

/**
 * Clean up expired shares (for scheduled jobs).
 */
export async function cleanupExpiredShares(): Promise<number> {
  const result = await db
    .update(artifactShares)
    .set({ revokedAt: new Date() })
    .where(and(
      isNull(artifactShares.revokedAt),
      sql`${artifactShares.expiresAt} < NOW()`
    ));

  return result.rowCount ?? 0;
}
