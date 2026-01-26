/**
 * Organization Context Middleware (Task 81)
 *
 * Resolves organization context from request and attaches it to req.org.
 * Resolution order:
 * 1. X-ORG-ID header
 * 2. orgId query parameter
 * 3. Session-selected org
 * 4. User's default org (first active membership)
 */

import { Request, Response, NextFunction, RequestHandler } from "express";
import { eq, and } from "drizzle-orm";
import { db } from "../../db";
import {
  organizations,
  orgMemberships,
  OrganizationRecord,
  OrgMembershipRecord,
} from "@researchflow/core/schema";
import {
  OrgContext,
  OrgRole,
  OrgCapability,
  ORG_ROLE_CAPABILITIES,
  orgRoleHasCapability,
  orgRoleMeetsMinimum,
} from "@researchflow/core/types/organization";
import { logAction } from "../services/audit-service";

/**
 * Resolve organization context from request
 * Attaches org context to req.org if found and user is member
 */
export function resolveOrgContext(): RequestHandler {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = (req.user as any)?.id;

      if (!userId) {
        // No user, no org context needed
        return next();
      }

      if (!db) {
        console.warn("[org-context] Database not available");
        return next();
      }

      // Resolution order: header > query > session > default
      let orgId =
        (req.headers["x-org-id"] as string) ||
        (req.query.orgId as string) ||
        (req.session as any)?.selectedOrgId;

      let org: OrganizationRecord | undefined;
      let membership: OrgMembershipRecord | undefined;

      if (orgId) {
        // Try to find specific org and verify membership
        const result = await db
          .select({
            org: organizations,
            membership: orgMemberships,
          })
          .from(organizations)
          .innerJoin(orgMemberships, eq(organizations.id, orgMemberships.orgId))
          .where(
            and(
              eq(organizations.id, orgId),
              eq(orgMemberships.userId, userId),
              eq(orgMemberships.isActive, true),
              eq(organizations.isActive, true)
            )
          )
          .limit(1);

        if (result.length > 0) {
          org = result[0].org;
          membership = result[0].membership;
        }
      }

      // If no specific org or not a member, get user's default org
      if (!org) {
        const result = await db
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
          .orderBy(orgMemberships.joinedAt)
          .limit(1);

        if (result.length > 0) {
          org = result[0].org;
          membership = result[0].membership;
        }
      }

      if (org && membership) {
        // Attach org context to request
        const orgRole = membership.orgRole as OrgRole;
        const capabilities = ORG_ROLE_CAPABILITIES[orgRole] || [];

        req.org = {
          org: {
            id: org.id,
            name: org.name,
            slug: org.slug,
            description: org.description || undefined,
            logoUrl: org.logoUrl || undefined,
            settings: (org.settings as any) || {},
            billingEmail: org.billingEmail || undefined,
            subscriptionTier: org.subscriptionTier as any,
            isActive: org.isActive,
            createdAt: org.createdAt,
            updatedAt: org.updatedAt,
          },
          membership: {
            id: membership.id,
            orgId: membership.orgId,
            userId: membership.userId,
            orgRole,
            joinedAt: membership.joinedAt,
            invitedBy: membership.invitedBy || undefined,
            isActive: membership.isActive,
          },
          capabilities: capabilities as OrgCapability[],
        };

        req.selectedOrgId = org.id;
      }

      next();
    } catch (error) {
      console.error("[org-context] Error resolving org context:", error);
      next();
    }
  };
}

/**
 * Require user to be a member of the resolved organization
 */
export function requireOrgMember(): RequestHandler {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (!req.org) {
      return res.status(403).json({
        error: "Organization membership required",
        code: "ORG_MEMBERSHIP_REQUIRED",
      });
    }
    next();
  };
}

/**
 * Require user to have a minimum org role
 */
export function requireMinOrgRole(minRole: OrgRole): RequestHandler {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (!req.org) {
      return res.status(403).json({
        error: "Organization membership required",
        code: "ORG_MEMBERSHIP_REQUIRED",
      });
    }

    const userRole = req.org.membership.orgRole;
    if (!orgRoleMeetsMinimum(userRole, minRole)) {
      await logAction({
        eventType: "ORG_ACCESS_DENIED",
        userId: req.org.membership.userId,
        resourceType: "organization",
        resourceId: req.org.org.id,
        action: "access_denied",
        details: {
          requiredRole: minRole,
          userRole,
          path: req.path,
        },
      });

      return res.status(403).json({
        error: `Organization ${minRole} role or higher required`,
        code: "ORG_ROLE_INSUFFICIENT",
        requiredRole: minRole,
        currentRole: userRole,
      });
    }
    next();
  };
}

/**
 * Require user to have a specific org capability
 */
export function requireOrgCapability(capability: OrgCapability): RequestHandler {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (!req.org) {
      return res.status(403).json({
        error: "Organization membership required",
        code: "ORG_MEMBERSHIP_REQUIRED",
      });
    }

    const userRole = req.org.membership.orgRole;
    if (!orgRoleHasCapability(userRole, capability)) {
      await logAction({
        eventType: "ORG_CAPABILITY_DENIED",
        userId: req.org.membership.userId,
        resourceType: "organization",
        resourceId: req.org.org.id,
        action: "capability_denied",
        details: {
          requiredCapability: capability,
          userRole,
          userCapabilities: req.org.capabilities,
          path: req.path,
        },
      });

      return res.status(403).json({
        error: `Organization capability '${capability}' required`,
        code: "ORG_CAPABILITY_MISSING",
        requiredCapability: capability,
        currentRole: userRole,
      });
    }
    next();
  };
}

/**
 * Require the request to have a specific org ID (for org-specific routes)
 */
export function requireOrgId(): RequestHandler {
  return async (req: Request, res: Response, next: NextFunction) => {
    const orgId = req.params.orgId || req.body?.orgId;

    if (!orgId) {
      return res.status(400).json({
        error: "Organization ID required",
        code: "ORG_ID_REQUIRED",
      });
    }

    // Verify the user has access to this specific org
    if (req.org && req.org.org.id !== orgId) {
      // User is trying to access a different org than their resolved one
      // Check if they have membership in the requested org
      const userId = (req.user as any)?.id;
      if (!userId || !db) {
        return res.status(403).json({
          error: "Access denied to this organization",
          code: "ORG_ACCESS_DENIED",
        });
      }

      const result = await db
        .select({
          org: organizations,
          membership: orgMemberships,
        })
        .from(organizations)
        .innerJoin(orgMemberships, eq(organizations.id, orgMemberships.orgId))
        .where(
          and(
            eq(organizations.id, orgId),
            eq(orgMemberships.userId, userId),
            eq(orgMemberships.isActive, true),
            eq(organizations.isActive, true)
          )
        )
        .limit(1);

      if (result.length === 0) {
        return res.status(403).json({
          error: "Access denied to this organization",
          code: "ORG_ACCESS_DENIED",
        });
      }

      // Update req.org to the requested org
      const org = result[0].org;
      const membership = result[0].membership;
      const orgRole = membership.orgRole as OrgRole;

      req.org = {
        org: {
          id: org.id,
          name: org.name,
          slug: org.slug,
          description: org.description || undefined,
          logoUrl: org.logoUrl || undefined,
          settings: (org.settings as any) || {},
          billingEmail: org.billingEmail || undefined,
          subscriptionTier: org.subscriptionTier as any,
          isActive: org.isActive,
          createdAt: org.createdAt,
          updatedAt: org.updatedAt,
        },
        membership: {
          id: membership.id,
          orgId: membership.orgId,
          userId: membership.userId,
          orgRole,
          joinedAt: membership.joinedAt,
          invitedBy: membership.invitedBy || undefined,
          isActive: membership.isActive,
        },
        capabilities: ORG_ROLE_CAPABILITIES[orgRole] as OrgCapability[],
      };
    }

    next();
  };
}
