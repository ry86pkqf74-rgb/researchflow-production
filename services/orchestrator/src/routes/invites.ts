/**
 * Invites Router (Task 83)
 *
 * API endpoints for organization invite management:
 * - POST /api/org/:orgId/invites - Create invite
 * - GET /api/org/:orgId/invites - List pending invites
 * - DELETE /api/org/:orgId/invites/:inviteId - Revoke invite
 * - GET /api/invites/validate/:token - Validate invite token
 * - POST /api/invites/accept - Accept invite
 */

import { Router, Request, Response } from "express";
import { eq } from "drizzle-orm";
import { db } from "../../db";
import { organizations, users } from "@researchflow/core/schema";
import { asyncHandler } from "../middleware/asyncHandler";
import {
  resolveOrgContext,
  requireOrgId,
  requireOrgCapability,
} from "../middleware/org-context";
import { inviteMemberSchema } from "@researchflow/core/types/organization";
import { logAction } from "../services/audit-service";
import { requireAuth as isAuthenticated } from "../services/authService";
import {
  createInvite,
  validateInvite,
  acceptInvite,
  revokeInvite,
  getOrgPendingInvites,
} from "../services/inviteService";
import { sendInviteEmail, sendWelcomeEmail } from "../services/emailService";

const router = Router();

/**
 * Create an organization invite
 */
router.post(
  "/org/:orgId/invites",
  isAuthenticated,
  resolveOrgContext(),
  requireOrgId(),
  requireOrgCapability("invite"),
  asyncHandler(async (req: Request, res: Response) => {
    const orgId = req.params.orgId;
    const userId = (req.user as any)?.id;

    if (!db) {
      return res.status(503).json({ error: "Database not available" });
    }

    // Validate input
    const parsed = inviteMemberSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: "Invalid input",
        details: parsed.error.flatten(),
      });
    }

    const { email, orgRole } = parsed.data;

    // Only OWNER can invite OWNER or ADMIN roles
    const currentRole = req.org!.membership.orgRole;
    if ((orgRole === "OWNER" || orgRole === "ADMIN") && currentRole !== "OWNER") {
      return res.status(403).json({
        error: "Only organization owner can invite admin or owner roles",
      });
    }

    try {
      // Create invite
      const invite = await createInvite(orgId, email, orgRole, userId);

      // Get org name and inviter name for email
      const org = req.org!.org;
      const [inviter] = await db
        .select({ firstName: users.firstName, lastName: users.lastName })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);

      const inviterName = inviter
        ? `${inviter.firstName || ""} ${inviter.lastName || ""}`.trim() || undefined
        : undefined;

      // Send invite email
      await sendInviteEmail({
        email,
        token: invite.token,
        orgName: org.name,
        orgRole,
        inviterName,
        expiresAt: invite.expiresAt,
      });

      await logAction({
        eventType: "ORG_INVITE_CREATED",
        userId,
        resourceType: "org_invite",
        resourceId: invite.id,
        action: "create",
        details: { orgId, email, orgRole },
      });

      res.status(201).json({
        id: invite.id,
        email,
        orgRole,
        expiresAt: invite.expiresAt,
        message: "Invite sent successfully",
      });
    } catch (error: any) {
      if (error.message === "User is already a member of this organization") {
        return res.status(409).json({
          error: error.message,
          code: "ALREADY_MEMBER",
        });
      }
      throw error;
    }
  })
);

/**
 * List pending invites for an organization
 */
router.get(
  "/org/:orgId/invites",
  isAuthenticated,
  resolveOrgContext(),
  requireOrgId(),
  requireOrgCapability("invite"),
  asyncHandler(async (req: Request, res: Response) => {
    const orgId = req.params.orgId;

    const invites = await getOrgPendingInvites(orgId);

    res.json({ invites });
  })
);

/**
 * Revoke an invite
 */
router.delete(
  "/org/:orgId/invites/:inviteId",
  isAuthenticated,
  resolveOrgContext(),
  requireOrgId(),
  requireOrgCapability("invite"),
  asyncHandler(async (req: Request, res: Response) => {
    const { orgId, inviteId } = req.params;
    const userId = (req.user as any)?.id;

    await revokeInvite(inviteId, orgId);

    await logAction({
      eventType: "ORG_INVITE_REVOKED",
      userId,
      resourceType: "org_invite",
      resourceId: inviteId,
      action: "revoke",
      details: { orgId },
    });

    res.json({ success: true, message: "Invite revoked" });
  })
);

/**
 * Validate an invite token (public endpoint)
 */
router.get(
  "/invites/validate/:token",
  asyncHandler(async (req: Request, res: Response) => {
    const { token } = req.params;

    if (!db) {
      return res.status(503).json({ error: "Database not available" });
    }

    const invite = await validateInvite(token);

    if (!invite) {
      return res.status(404).json({
        error: "Invalid or expired invite",
        code: "INVITE_INVALID",
      });
    }

    // Get org details
    const [org] = await db
      .select({ name: organizations.name, slug: organizations.slug })
      .from(organizations)
      .where(eq(organizations.id, invite.orgId))
      .limit(1);

    res.json({
      valid: true,
      orgName: org?.name,
      orgSlug: org?.slug,
      email: invite.email,
      role: invite.orgRole,
      expiresAt: invite.expiresAt,
    });
  })
);

/**
 * Accept an invite
 */
router.post(
  "/invites/accept",
  isAuthenticated,
  asyncHandler(async (req: Request, res: Response) => {
    const { token } = req.body;
    const userId = (req.user as any)?.id;
    const userEmail = (req.user as any)?.email;

    if (!token) {
      return res.status(400).json({ error: "Token is required" });
    }

    if (!db) {
      return res.status(503).json({ error: "Database not available" });
    }

    // Validate invite first
    const invite = await validateInvite(token);

    if (!invite) {
      return res.status(404).json({
        error: "Invalid or expired invite",
        code: "INVITE_INVALID",
      });
    }

    // Verify email matches (case insensitive)
    if (invite.email.toLowerCase() !== userEmail?.toLowerCase()) {
      return res.status(403).json({
        error: "This invite was sent to a different email address",
        code: "EMAIL_MISMATCH",
      });
    }

    // Accept the invite
    const success = await acceptInvite(token, userId);

    if (!success) {
      return res.status(400).json({
        error: "Failed to accept invite",
        code: "ACCEPT_FAILED",
      });
    }

    // Get org details for response
    const [org] = await db
      .select({ id: organizations.id, name: organizations.name, slug: organizations.slug })
      .from(organizations)
      .where(eq(organizations.id, invite.orgId))
      .limit(1);

    // Get user details for welcome email
    const [user] = await db
      .select({ firstName: users.firstName })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    // Send welcome email
    await sendWelcomeEmail(
      userEmail,
      user?.firstName || "there",
      org?.name || "the organization"
    );

    await logAction({
      eventType: "ORG_INVITE_ACCEPTED",
      userId,
      resourceType: "org_invite",
      resourceId: invite.id,
      action: "accept",
      details: { orgId: invite.orgId, role: invite.orgRole },
    });

    res.json({
      success: true,
      message: "Invite accepted successfully",
      organization: {
        id: org?.id,
        name: org?.name,
        slug: org?.slug,
      },
      role: invite.orgRole,
    });
  })
);

export default router;
