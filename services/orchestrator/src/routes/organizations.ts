/**
 * Organizations Router (Task 81)
 *
 * API endpoints for organization management:
 * - POST /api/org - Create organization (RESEARCHER)
 * - GET /api/org - List user's organizations (RESEARCHER)
 * - GET /api/org/:orgId - Get organization details (ORG_MEMBER)
 * - PATCH /api/org/:orgId - Update organization (ORG_ADMIN)
 * - DELETE /api/org/:orgId - Delete organization (OWNER only)
 * - POST /api/org/:orgId/select - Set active org in session (ORG_MEMBER)
 * - GET /api/org/:orgId/members - List org members (ORG_MEMBER)
 *
 * SEC-003: RBAC MIDDLEWARE AUDIT
 * Enhanced with application-level role checks for sensitive operations
 */

import { Router, Request, Response } from "express";
import { eq, and, desc } from "drizzle-orm";
import { db } from "../../db";
import {
  organizations,
  orgMemberships,
  users,
  researchProjects,
} from "@researchflow/core/schema";
import { asyncHandler } from "../middleware/asyncHandler";
import {
  resolveOrgContext,
  requireOrgMember,
  requireMinOrgRole,
  requireOrgCapability,
  requireOrgId,
} from "../middleware/org-context";
import {
  createOrganizationSchema,
  updateOrganizationSchema,
  OrgRole,
} from "@researchflow/core/types/organization";
import { logAction } from "../services/audit-service";
import { requireAuth as isAuthenticated } from "../services/authService";
import { protect, logAuditEvent } from "../middleware/rbac";

const router = Router();

/**
 * Create a new organization
 * The creating user becomes the OWNER
 * SEC-003: Audit logging for org creation
 */
router.post(
  "/",
  isAuthenticated,
  logAuditEvent('CREATE', 'organization'),
  asyncHandler(async (req: Request, res: Response) => {
    const userId = (req.user as any)?.id;
    if (!userId) {
      return res.status(401).json({ error: "Authentication required" });
    }

    if (!db) {
      return res.status(503).json({ error: "Database not available" });
    }

    // Validate input
    const parsed = createOrganizationSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: "Invalid input",
        details: parsed.error.flatten(),
      });
    }

    const { name, slug, description, billingEmail, settings } = parsed.data;

    // Check if slug is already taken
    const existing = await db
      .select({ id: organizations.id })
      .from(organizations)
      .where(eq(organizations.slug, slug))
      .limit(1);

    if (existing.length > 0) {
      return res.status(409).json({
        error: "Organization slug already taken",
        code: "SLUG_TAKEN",
      });
    }

    // Create organization
    const [org] = await db
      .insert(organizations)
      .values({
        name,
        slug,
        description: description || null,
        billingEmail: billingEmail || null,
        settings: settings || {},
        subscriptionTier: "FREE",
        isActive: true,
      } as any)
      .returning();

    // Add creator as OWNER
    await db.insert(orgMemberships).values({
      orgId: org.id,
      userId,
      orgRole: "OWNER",
      isActive: true,
    } as any);

    await logAction({
      eventType: "ORG_CREATED",
      userId,
      resourceType: "organization",
      resourceId: org.id,
      action: "create",
      details: { name, slug },
    });

    res.status(201).json({
      id: org.id,
      name: org.name,
      slug: org.slug,
      description: org.description,
      subscriptionTier: org.subscriptionTier,
      isActive: org.isActive,
      createdAt: org.createdAt,
    });
  })
);

/**
 * List user's organizations
 */
router.get(
  "/",
  isAuthenticated,
  asyncHandler(async (req: Request, res: Response) => {
    const userId = (req.user as any)?.id;
    if (!userId) {
      return res.status(401).json({ error: "Authentication required" });
    }

    if (!db) {
      return res.status(503).json({ error: "Database not available" });
    }

    const results = await db
      .select({
        org: organizations,
        membership: orgMemberships,
      })
      .from(organizations)
      .innerJoin(orgMemberships, eq(organizations.id, orgMemberships.orgId))
      .where(
        and(
          eq(orgMemberships.userId, userId),
          eq(orgMemberships.isActive, true),
          eq(organizations.isActive, true)
        )
      )
      .orderBy(desc(orgMemberships.joinedAt));

    const orgs = results.map(({ org, membership }) => ({
      id: org.id,
      name: org.name,
      slug: org.slug,
      description: org.description,
      logoUrl: org.logoUrl,
      subscriptionTier: org.subscriptionTier,
      role: membership.orgRole,
      joinedAt: membership.joinedAt,
    }));

    res.json({ organizations: orgs });
  })
);

/**
 * Get organization details
 */
router.get(
  "/:orgId",
  isAuthenticated,
  resolveOrgContext(),
  requireOrgId(),
  requireOrgMember(),
  asyncHandler(async (req: Request, res: Response) => {
    const org = req.org!.org;
    const membership = req.org!.membership;

    if (!db) {
      return res.status(503).json({ error: "Database not available" });
    }

    // Get member count
    const memberCount = await db
      .select({ count: orgMemberships.id })
      .from(orgMemberships)
      .where(
        and(
          eq(orgMemberships.orgId, org.id),
          eq(orgMemberships.isActive, true)
        )
      );

    // Get project count
    const projectCount = await db
      .select({ count: researchProjects.id })
      .from(researchProjects)
      .where(eq(researchProjects.orgId, org.id));

    res.json({
      id: org.id,
      name: org.name,
      slug: org.slug,
      description: org.description,
      logoUrl: org.logoUrl,
      settings: org.settings,
      billingEmail: org.billingEmail,
      subscriptionTier: org.subscriptionTier,
      isActive: org.isActive,
      createdAt: org.createdAt,
      updatedAt: org.updatedAt,
      membership: {
        role: membership.orgRole,
        joinedAt: membership.joinedAt,
        capabilities: req.org!.capabilities,
      },
      stats: {
        memberCount: memberCount.length,
        projectCount: projectCount.length,
      },
    });
  })
);

/**
 * Update organization
 */
router.patch(
  "/:orgId",
  isAuthenticated,
  resolveOrgContext(),
  requireOrgId(),
  requireMinOrgRole("ADMIN"),
  asyncHandler(async (req: Request, res: Response) => {
    const orgId = req.params.orgId;
    const userId = (req.user as any)?.id;

    if (!db) {
      return res.status(503).json({ error: "Database not available" });
    }

    // Validate input
    const parsed = updateOrganizationSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: "Invalid input",
        details: parsed.error.flatten(),
      });
    }

    const updates: Record<string, any> = {
      updatedAt: new Date(),
    };

    if (parsed.data.name !== undefined) updates.name = parsed.data.name;
    if (parsed.data.description !== undefined) updates.description = parsed.data.description;
    if (parsed.data.logoUrl !== undefined) updates.logoUrl = parsed.data.logoUrl;
    if (parsed.data.billingEmail !== undefined) updates.billingEmail = parsed.data.billingEmail;
    if (parsed.data.settings !== undefined) updates.settings = parsed.data.settings;

    const [updated] = await db
      .update(organizations)
      .set(updates)
      .where(eq(organizations.id, orgId))
      .returning();

    await logAction({
      eventType: "ORG_UPDATED",
      userId,
      resourceType: "organization",
      resourceId: orgId,
      action: "update",
      details: { updates: Object.keys(updates) },
    });

    res.json({
      id: updated.id,
      name: updated.name,
      slug: updated.slug,
      description: updated.description,
      logoUrl: updated.logoUrl,
      settings: updated.settings,
      billingEmail: updated.billingEmail,
      updatedAt: updated.updatedAt,
    });
  })
);

/**
 * Delete organization (OWNER only)
 */
router.delete(
  "/:orgId",
  isAuthenticated,
  resolveOrgContext(),
  requireOrgId(),
  requireMinOrgRole("OWNER"),
  asyncHandler(async (req: Request, res: Response) => {
    const orgId = req.params.orgId;
    const userId = (req.user as any)?.id;

    if (!db) {
      return res.status(503).json({ error: "Database not available" });
    }

    // Soft delete - set isActive to false
    await db
      .update(organizations)
      .set({ isActive: false, updatedAt: new Date() } as any)
      .where(eq(organizations.id, orgId));

    await logAction({
      eventType: "ORG_DELETED",
      userId,
      resourceType: "organization",
      resourceId: orgId,
      action: "delete",
      details: {},
    });

    res.json({ success: true, message: "Organization deleted" });
  })
);

/**
 * Set active organization in session
 */
router.post(
  "/:orgId/select",
  isAuthenticated,
  resolveOrgContext(),
  requireOrgId(),
  requireOrgMember(),
  asyncHandler(async (req: Request, res: Response) => {
    const orgId = req.params.orgId;

    // Store selected org in session
    if (req.session) {
      (req.session as any).selectedOrgId = orgId;
    }

    res.json({
      success: true,
      selectedOrg: {
        id: req.org!.org.id,
        name: req.org!.org.name,
        slug: req.org!.org.slug,
      },
    });
  })
);

/**
 * List organization members
 */
router.get(
  "/:orgId/members",
  isAuthenticated,
  resolveOrgContext(),
  requireOrgId(),
  requireOrgMember(),
  asyncHandler(async (req: Request, res: Response) => {
    const orgId = req.params.orgId;

    if (!db) {
      return res.status(503).json({ error: "Database not available" });
    }

    const results = await db
      .select({
        membership: orgMemberships,
        user: users,
      })
      .from(orgMemberships)
      .innerJoin(users, eq(orgMemberships.userId, users.id))
      .where(
        and(
          eq(orgMemberships.orgId, orgId),
          eq(orgMemberships.isActive, true)
        )
      )
      .orderBy(desc(orgMemberships.joinedAt));

    const members = results.map(({ membership, user }) => ({
      id: membership.id,
      userId: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      profileImageUrl: user.profileImageUrl,
      role: membership.orgRole,
      joinedAt: membership.joinedAt,
    }));

    res.json({ members });
  })
);

/**
 * Update member role
 */
router.patch(
  "/:orgId/members/:memberId",
  isAuthenticated,
  resolveOrgContext(),
  requireOrgId(),
  requireOrgCapability("manage_members"),
  asyncHandler(async (req: Request, res: Response) => {
    const { orgId, memberId } = req.params;
    const { orgRole } = req.body;
    const userId = (req.user as any)?.id;

    if (!db) {
      return res.status(503).json({ error: "Database not available" });
    }

    // Validate role
    const validRoles: OrgRole[] = ["OWNER", "ADMIN", "MEMBER", "VIEWER"];
    if (!validRoles.includes(orgRole)) {
      return res.status(400).json({ error: "Invalid role" });
    }

    // Cannot change own role
    const [targetMembership] = await db
      .select()
      .from(orgMemberships)
      .where(eq(orgMemberships.id, memberId))
      .limit(1);

    if (!targetMembership) {
      return res.status(404).json({ error: "Member not found" });
    }

    if (targetMembership.userId === userId) {
      return res.status(400).json({ error: "Cannot change your own role" });
    }

    // Only OWNER can promote to OWNER or demote from OWNER
    if (
      (orgRole === "OWNER" || targetMembership.orgRole === "OWNER") &&
      req.org!.membership.orgRole !== "OWNER"
    ) {
      return res.status(403).json({
        error: "Only organization owner can manage owner roles",
      });
    }

    await db
      .update(orgMemberships)
      .set({ orgRole } as any)
      .where(eq(orgMemberships.id, memberId));

    await logAction({
      eventType: "ORG_MEMBER_ROLE_CHANGED",
      userId,
      resourceType: "org_membership",
      resourceId: memberId,
      action: "update_role",
      details: {
        orgId,
        targetUserId: targetMembership.userId,
        oldRole: targetMembership.orgRole,
        newRole: orgRole,
      },
    });

    res.json({ success: true, newRole: orgRole });
  })
);

/**
 * Remove member from organization
 */
router.delete(
  "/:orgId/members/:memberId",
  isAuthenticated,
  resolveOrgContext(),
  requireOrgId(),
  requireOrgCapability("manage_members"),
  asyncHandler(async (req: Request, res: Response) => {
    const { orgId, memberId } = req.params;
    const userId = (req.user as any)?.id;

    if (!db) {
      return res.status(503).json({ error: "Database not available" });
    }

    // Get target membership
    const [targetMembership] = await db
      .select()
      .from(orgMemberships)
      .where(eq(orgMemberships.id, memberId))
      .limit(1);

    if (!targetMembership) {
      return res.status(404).json({ error: "Member not found" });
    }

    // Cannot remove self
    if (targetMembership.userId === userId) {
      return res.status(400).json({ error: "Cannot remove yourself" });
    }

    // Cannot remove OWNER
    if (targetMembership.orgRole === "OWNER") {
      return res.status(403).json({
        error: "Cannot remove organization owner",
      });
    }

    // Soft delete
    await db
      .update(orgMemberships)
      .set({ isActive: false } as any)
      .where(eq(orgMemberships.id, memberId));

    await logAction({
      eventType: "ORG_MEMBER_REMOVED",
      userId,
      resourceType: "org_membership",
      resourceId: memberId,
      action: "remove",
      details: {
        orgId,
        targetUserId: targetMembership.userId,
      },
    });

    res.json({ success: true });
  })
);

/**
 * Get organization context for frontend (Task 102)
 * Returns org details + membership + capabilities + feature flags
 */
router.get(
  "/context",
  isAuthenticated,
  resolveOrgContext(),
  requireOrgMember(),
  asyncHandler(async (req: Request, res: Response) => {
    const { org, membership, capabilities } = req.org!;

    if (!db) {
      return res.status(503).json({ error: "Database not available" });
    }

    // Import featureFlagsService
    const { featureFlagsService } = await import('../services/featureFlagsService');

    // Get feature flags available for this tier
    const availableFlags = await featureFlagsService.getFlagsForTier(org.subscriptionTier);

    res.json({
      org: {
        id: org.id,
        name: org.name,
        slug: org.slug,
        tier: org.subscriptionTier,
        settings: org.settings,
      },
      membership: {
        role: membership.orgRole,
        joinedAt: membership.joinedAt,
        capabilities,
      },
      features: availableFlags,
    });
  })
);

export default router;
