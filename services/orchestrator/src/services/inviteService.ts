/**
 * Invite Service (Task 83)
 *
 * Handles organization invite token generation and validation.
 * Uses cryptographically secure tokens with SHA-256 hashing.
 */

import crypto from "crypto";
import { db } from "../../db";
import { eq, and, gt, lt } from "drizzle-orm";
import { orgInvites, orgMemberships, users } from "@researchflow/core/schema";
import { OrgRole } from "@researchflow/core/types/organization";

const INVITE_TOKEN_BYTES = 32;
const DEFAULT_EXPIRY_HOURS = parseInt(process.env.INVITE_EXPIRY_HOURS || "168", 10); // 7 days

export interface InviteResult {
  id: string;
  token: string; // Plain token for the invite URL
  expiresAt: Date;
}

export interface ValidatedInvite {
  id: string;
  orgId: string;
  email: string;
  orgRole: OrgRole;
  invitedBy: string;
  expiresAt: Date;
}

/**
 * Generate a cryptographically secure token
 */
function generateToken(): string {
  return crypto.randomBytes(INVITE_TOKEN_BYTES).toString("hex");
}

/**
 * Hash a token for secure storage
 */
function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

/**
 * Create a new organization invite
 */
export async function createInvite(
  orgId: string,
  email: string,
  orgRole: OrgRole,
  invitedBy: string,
  expiryHours: number = DEFAULT_EXPIRY_HOURS
): Promise<InviteResult> {
  if (!db) {
    throw new Error("Database not available");
  }

  // Check if there's already a pending invite for this email/org
  const existing = await db
    .select()
    .from(orgInvites)
    .where(
      and(
        eq(orgInvites.orgId, orgId),
        eq(orgInvites.email, email.toLowerCase()),
        eq(orgInvites.status, "PENDING")
      )
    )
    .limit(1);

  if (existing.length > 0) {
    // Revoke existing invite
    await db
      .update(orgInvites)
      .set({ status: "REVOKED" } as any)
      .where(eq(orgInvites.id, existing[0].id));
  }

  // Check if user is already a member
  const normalizedEmail = email.toLowerCase();
  const existingUser = await db
    .select()
    .from(users)
    .where(eq(users.email, normalizedEmail))
    .limit(1);

  if (existingUser.length > 0) {
    const existingMembership = await db
      .select()
      .from(orgMemberships)
      .where(
        and(
          eq(orgMemberships.orgId, orgId),
          eq(orgMemberships.userId, existingUser[0].id),
          eq(orgMemberships.isActive, true)
        )
      )
      .limit(1);

    if (existingMembership.length > 0) {
      throw new Error("User is already a member of this organization");
    }
  }

  // Generate token and hash
  const token = generateToken();
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + expiryHours * 60 * 60 * 1000);

  // Create invite record
  const [invite] = await db
    .insert(orgInvites)
    .values({
      orgId,
      email: normalizedEmail,
      orgRole,
      tokenHash,
      invitedBy,
      expiresAt,
      status: "PENDING",
    } as any)
    .returning();

  return {
    id: invite.id,
    token,
    expiresAt,
  };
}

/**
 * Validate an invite token
 */
export async function validateInvite(token: string): Promise<ValidatedInvite | null> {
  if (!db) {
    throw new Error("Database not available");
  }

  const tokenHash = hashToken(token);

  const [invite] = await db
    .select()
    .from(orgInvites)
    .where(
      and(
        eq(orgInvites.tokenHash, tokenHash),
        eq(orgInvites.status, "PENDING"),
        gt(orgInvites.expiresAt, new Date())
      )
    )
    .limit(1);

  if (!invite) {
    return null;
  }

  return {
    id: invite.id,
    orgId: invite.orgId,
    email: invite.email,
    orgRole: invite.orgRole as OrgRole,
    invitedBy: invite.invitedBy,
    expiresAt: invite.expiresAt,
  };
}

/**
 * Accept an invite - create membership and update invite status
 */
export async function acceptInvite(token: string, userId: string): Promise<boolean> {
  if (!db) {
    throw new Error("Database not available");
  }

  const invite = await validateInvite(token);
  if (!invite) {
    return false;
  }

  // Create membership
  await db.insert(orgMemberships).values({
    orgId: invite.orgId,
    userId,
    orgRole: invite.orgRole,
    invitedBy: invite.invitedBy,
    isActive: true,
  } as any);

  // Update invite status
  await db
    .update(orgInvites)
    .set({
      status: "ACCEPTED",
      acceptedAt: new Date(),
    } as any)
    .where(eq(orgInvites.id, invite.id));

  return true;
}

/**
 * Revoke an invite
 */
export async function revokeInvite(inviteId: string, orgId: string): Promise<boolean> {
  if (!db) {
    throw new Error("Database not available");
  }

  const result = await db
    .update(orgInvites)
    .set({ status: "REVOKED" } as any)
    .where(and(eq(orgInvites.id, inviteId), eq(orgInvites.orgId, orgId)));

  return true;
}

/**
 * Get pending invites for an organization
 */
export async function getOrgPendingInvites(orgId: string) {
  if (!db) {
    throw new Error("Database not available");
  }

  return db
    .select({
      id: orgInvites.id,
      email: orgInvites.email,
      orgRole: orgInvites.orgRole,
      invitedBy: orgInvites.invitedBy,
      expiresAt: orgInvites.expiresAt,
      createdAt: orgInvites.createdAt,
    })
    .from(orgInvites)
    .where(
      and(
        eq(orgInvites.orgId, orgId),
        eq(orgInvites.status, "PENDING"),
        gt(orgInvites.expiresAt, new Date())
      )
    );
}

/**
 * Mark expired invites
 */
export async function expireStaleInvites(): Promise<number> {
  if (!db) {
    throw new Error("Database not available");
  }

  const result = await db
    .update(orgInvites)
    .set({ status: "EXPIRED" } as any)
    .where(
      and(
        eq(orgInvites.status, "PENDING"),
        lt(orgInvites.expiresAt, new Date())
      )
    );

  return 0; // Drizzle doesn't return affected rows easily
}
