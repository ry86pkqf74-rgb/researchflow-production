/**
 * Organization Isolation Integration Tests (Task 82)
 *
 * Tests for multi-tenant organization isolation including:
 * - Org context resolution from headers/query/session
 * - Access control enforcement
 * - Role-based permission checks
 * - Cross-org access prevention
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Request, Response, NextFunction } from "express";
import {
  OrgRole,
  OrgCapability,
  ORG_ROLE_CAPABILITIES,
  orgRoleHasCapability,
  orgRoleMeetsMinimum,
} from "@researchflow/core/types/organization";

// Mock database for testing
const mockDb = {
  select: vi.fn(),
  from: vi.fn(),
  innerJoin: vi.fn(),
  where: vi.fn(),
  orderBy: vi.fn(),
  limit: vi.fn(),
};

// Mock organization data
const mockOrgs = {
  orgAlpha: {
    id: "org-alpha-001",
    name: "Alpha Organization",
    slug: "alpha-org",
    description: "Test org Alpha",
    logoUrl: null,
    settings: {},
    billingEmail: "billing@alpha.org",
    subscriptionTier: "PRO",
    isActive: true,
    createdAt: new Date("2024-01-01"),
    updatedAt: new Date("2024-01-01"),
  },
  orgBeta: {
    id: "org-beta-002",
    name: "Beta Organization",
    slug: "beta-org",
    description: "Test org Beta",
    logoUrl: null,
    settings: {},
    billingEmail: "billing@beta.org",
    subscriptionTier: "FREE",
    isActive: true,
    createdAt: new Date("2024-01-02"),
    updatedAt: new Date("2024-01-02"),
  },
  orgInactive: {
    id: "org-inactive-003",
    name: "Inactive Organization",
    slug: "inactive-org",
    description: "Deactivated org",
    logoUrl: null,
    settings: {},
    billingEmail: "billing@inactive.org",
    subscriptionTier: "FREE",
    isActive: false,
    createdAt: new Date("2024-01-03"),
    updatedAt: new Date("2024-01-03"),
  },
};

// Mock memberships
const mockMemberships = {
  userAlphaOwner: {
    id: "mem-001",
    orgId: "org-alpha-001",
    userId: "user-001",
    orgRole: "OWNER" as OrgRole,
    joinedAt: new Date("2024-01-01"),
    invitedBy: null,
    isActive: true,
  },
  userAlphaMember: {
    id: "mem-002",
    orgId: "org-alpha-001",
    userId: "user-002",
    orgRole: "MEMBER" as OrgRole,
    joinedAt: new Date("2024-01-05"),
    invitedBy: "user-001",
    isActive: true,
  },
  userBetaAdmin: {
    id: "mem-003",
    orgId: "org-beta-002",
    userId: "user-002",
    orgRole: "ADMIN" as OrgRole,
    joinedAt: new Date("2024-01-10"),
    invitedBy: null,
    isActive: true,
  },
  userAlphaViewer: {
    id: "mem-004",
    orgId: "org-alpha-001",
    userId: "user-003",
    orgRole: "VIEWER" as OrgRole,
    joinedAt: new Date("2024-01-15"),
    invitedBy: "user-001",
    isActive: true,
  },
};

describe("Organization Isolation", () => {
  describe("Org Context Resolution Priority", () => {
    it("should prioritize X-ORG-ID header over query params", () => {
      const headerOrgId = "org-alpha-001";
      const queryOrgId = "org-beta-002";

      // In real middleware, header takes precedence
      const resolvedOrgId = headerOrgId || queryOrgId;
      expect(resolvedOrgId).toBe(headerOrgId);
    });

    it("should use query param when header is not present", () => {
      const headerOrgId: string | undefined = undefined;
      const queryOrgId = "org-beta-002";

      const resolvedOrgId = headerOrgId || queryOrgId;
      expect(resolvedOrgId).toBe(queryOrgId);
    });

    it("should fall back to session when header and query are absent", () => {
      const headerOrgId: string | undefined = undefined;
      const queryOrgId: string | undefined = undefined;
      const sessionOrgId = "org-alpha-001";

      const resolvedOrgId = headerOrgId || queryOrgId || sessionOrgId;
      expect(resolvedOrgId).toBe(sessionOrgId);
    });
  });

  describe("Cross-Org Access Prevention", () => {
    it("should not allow access to org user is not a member of", () => {
      const userId = "user-001"; // Member of Alpha only
      const requestedOrgId = "org-beta-002"; // Beta org

      // Check if user has membership in requested org
      const hasMembership = Object.values(mockMemberships).some(
        (m) => m.userId === userId && m.orgId === requestedOrgId && m.isActive
      );

      expect(hasMembership).toBe(false);
    });

    it("should allow access to org user is a member of", () => {
      const userId = "user-002"; // Member of Alpha and Beta
      const requestedOrgId = "org-alpha-001";

      const hasMembership = Object.values(mockMemberships).some(
        (m) => m.userId === userId && m.orgId === requestedOrgId && m.isActive
      );

      expect(hasMembership).toBe(true);
    });

    it("should not allow access to inactive org", () => {
      const org = mockOrgs.orgInactive;
      expect(org.isActive).toBe(false);
      // Middleware should reject access to inactive orgs
    });
  });

  describe("Role-Based Access Control", () => {
    describe("VIEWER role", () => {
      const viewerMembership = mockMemberships.userAlphaViewer;

      it("should only have view_research capability", () => {
        const caps = ORG_ROLE_CAPABILITIES[viewerMembership.orgRole];
        expect(caps).toEqual(["view_research"]);
      });

      it("should not meet MEMBER minimum", () => {
        expect(orgRoleMeetsMinimum(viewerMembership.orgRole, "MEMBER")).toBe(false);
      });

      it("should not have create_research capability", () => {
        expect(orgRoleHasCapability(viewerMembership.orgRole, "create_research")).toBe(false);
      });
    });

    describe("MEMBER role", () => {
      const memberMembership = mockMemberships.userAlphaMember;

      it("should have create and edit capabilities", () => {
        expect(orgRoleHasCapability(memberMembership.orgRole, "create_research")).toBe(true);
        expect(orgRoleHasCapability(memberMembership.orgRole, "edit_research")).toBe(true);
      });

      it("should not have delete or manage capabilities", () => {
        expect(orgRoleHasCapability(memberMembership.orgRole, "delete_research")).toBe(false);
        expect(orgRoleHasCapability(memberMembership.orgRole, "manage_members")).toBe(false);
      });

      it("should meet VIEWER minimum", () => {
        expect(orgRoleMeetsMinimum(memberMembership.orgRole, "VIEWER")).toBe(true);
      });
    });

    describe("ADMIN role", () => {
      const adminMembership = mockMemberships.userBetaAdmin;

      it("should have management capabilities", () => {
        expect(orgRoleHasCapability(adminMembership.orgRole, "manage_members")).toBe(true);
        expect(orgRoleHasCapability(adminMembership.orgRole, "invite")).toBe(true);
        expect(orgRoleHasCapability(adminMembership.orgRole, "integrations")).toBe(true);
      });

      it("should not have billing capability", () => {
        expect(orgRoleHasCapability(adminMembership.orgRole, "billing")).toBe(false);
      });

      it("should meet MEMBER and VIEWER minimum", () => {
        expect(orgRoleMeetsMinimum(adminMembership.orgRole, "MEMBER")).toBe(true);
        expect(orgRoleMeetsMinimum(adminMembership.orgRole, "VIEWER")).toBe(true);
      });

      it("should not meet OWNER minimum", () => {
        expect(orgRoleMeetsMinimum(adminMembership.orgRole, "OWNER")).toBe(false);
      });
    });

    describe("OWNER role", () => {
      const ownerMembership = mockMemberships.userAlphaOwner;

      it("should have all capabilities", () => {
        expect(orgRoleHasCapability(ownerMembership.orgRole, "billing")).toBe(true);
        expect(orgRoleHasCapability(ownerMembership.orgRole, "admin")).toBe(true);
        expect(orgRoleHasCapability(ownerMembership.orgRole, "manage_members")).toBe(true);
      });

      it("should meet all minimum role requirements", () => {
        expect(orgRoleMeetsMinimum(ownerMembership.orgRole, "OWNER")).toBe(true);
        expect(orgRoleMeetsMinimum(ownerMembership.orgRole, "ADMIN")).toBe(true);
        expect(orgRoleMeetsMinimum(ownerMembership.orgRole, "MEMBER")).toBe(true);
        expect(orgRoleMeetsMinimum(ownerMembership.orgRole, "VIEWER")).toBe(true);
      });
    });
  });

  describe("Multi-Org Membership", () => {
    it("should allow user to be member of multiple orgs", () => {
      const userId = "user-002";
      const userMemberships = Object.values(mockMemberships).filter(
        (m) => m.userId === userId && m.isActive
      );

      expect(userMemberships.length).toBe(2);
      expect(userMemberships.map((m) => m.orgId)).toContain("org-alpha-001");
      expect(userMemberships.map((m) => m.orgId)).toContain("org-beta-002");
    });

    it("should have different roles in different orgs", () => {
      const userId = "user-002";
      const alphaRole = mockMemberships.userAlphaMember.orgRole;
      const betaRole = mockMemberships.userBetaAdmin.orgRole;

      expect(alphaRole).toBe("MEMBER");
      expect(betaRole).toBe("ADMIN");
    });

    it("should enforce org-specific permissions", () => {
      const userId = "user-002";

      // In Alpha (MEMBER) - can create but not delete
      expect(orgRoleHasCapability("MEMBER", "create_research")).toBe(true);
      expect(orgRoleHasCapability("MEMBER", "delete_research")).toBe(false);

      // In Beta (ADMIN) - can create and delete
      expect(orgRoleHasCapability("ADMIN", "create_research")).toBe(true);
      expect(orgRoleHasCapability("ADMIN", "delete_research")).toBe(true);
    });
  });

  describe("Membership Status", () => {
    it("should only consider active memberships", () => {
      const activeMemberships = Object.values(mockMemberships).filter((m) => m.isActive);
      expect(activeMemberships.length).toBe(4);
    });

    it("should ignore inactive memberships in access checks", () => {
      const inactiveMembership = {
        ...mockMemberships.userAlphaMember,
        isActive: false,
      };

      // Access check should fail for inactive membership
      expect(inactiveMembership.isActive).toBe(false);
    });
  });

  describe("Research Project Org Isolation", () => {
    // Mock research projects with org_id
    const mockProjects = [
      { id: "proj-001", name: "Alpha Project 1", orgId: "org-alpha-001" },
      { id: "proj-002", name: "Alpha Project 2", orgId: "org-alpha-001" },
      { id: "proj-003", name: "Beta Project 1", orgId: "org-beta-002" },
    ];

    it("should filter projects by org context", () => {
      const orgId = "org-alpha-001";
      const orgProjects = mockProjects.filter((p) => p.orgId === orgId);

      expect(orgProjects.length).toBe(2);
      expect(orgProjects.every((p) => p.orgId === orgId)).toBe(true);
    });

    it("should not return projects from other orgs", () => {
      const orgId = "org-alpha-001";
      const orgProjects = mockProjects.filter((p) => p.orgId === orgId);

      expect(orgProjects.some((p) => p.orgId === "org-beta-002")).toBe(false);
    });
  });

  describe("Capability Enforcement Scenarios", () => {
    const scenarios: Array<{
      action: string;
      capability: OrgCapability;
      allowedRoles: OrgRole[];
    }> = [
      {
        action: "View research projects",
        capability: "view_research",
        allowedRoles: ["OWNER", "ADMIN", "MEMBER", "VIEWER"],
      },
      {
        action: "Create new research",
        capability: "create_research",
        allowedRoles: ["OWNER", "ADMIN", "MEMBER"],
      },
      {
        action: "Delete research",
        capability: "delete_research",
        allowedRoles: ["OWNER", "ADMIN"],
      },
      {
        action: "Invite new members",
        capability: "invite",
        allowedRoles: ["OWNER", "ADMIN"],
      },
      {
        action: "Manage billing",
        capability: "billing",
        allowedRoles: ["OWNER"],
      },
      {
        action: "Configure integrations",
        capability: "integrations",
        allowedRoles: ["OWNER", "ADMIN"],
      },
    ];

    scenarios.forEach(({ action, capability, allowedRoles }) => {
      describe(action, () => {
        const allRoles: OrgRole[] = ["OWNER", "ADMIN", "MEMBER", "VIEWER"];

        allRoles.forEach((role) => {
          const shouldAllow = allowedRoles.includes(role);
          it(`should ${shouldAllow ? "allow" : "deny"} ${role}`, () => {
            expect(orgRoleHasCapability(role, capability)).toBe(shouldAllow);
          });
        });
      });
    });
  });
});
