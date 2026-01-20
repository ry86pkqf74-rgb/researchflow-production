/**
 * Organization RBAC Unit Tests (Task 82)
 *
 * Tests for organization role-based access control including:
 * - Role hierarchy validation
 * - Capability checking
 * - Zod schema validation
 */

import { describe, it, expect } from "vitest";
import {
  ORG_ROLES,
  OrgRole,
  ORG_ROLE_HIERARCHY,
  ORG_CAPABILITIES,
  OrgCapability,
  ORG_ROLE_CAPABILITIES,
  orgRoleHasCapability,
  orgRoleMeetsMinimum,
  SUBSCRIPTION_TIERS,
  TIER_LIMITS,
  createOrganizationSchema,
  updateOrganizationSchema,
  inviteMemberSchema,
  updateMemberRoleSchema,
} from "@researchflow/core/types/organization";

describe("Organization RBAC", () => {
  describe("ORG_ROLES", () => {
    it("should have exactly 4 roles", () => {
      expect(ORG_ROLES).toHaveLength(4);
    });

    it("should contain all expected roles", () => {
      expect(ORG_ROLES).toContain("OWNER");
      expect(ORG_ROLES).toContain("ADMIN");
      expect(ORG_ROLES).toContain("MEMBER");
      expect(ORG_ROLES).toContain("VIEWER");
    });
  });

  describe("ORG_ROLE_HIERARCHY", () => {
    it("should define hierarchy for all roles", () => {
      expect(ORG_ROLE_HIERARCHY.OWNER).toBeDefined();
      expect(ORG_ROLE_HIERARCHY.ADMIN).toBeDefined();
      expect(ORG_ROLE_HIERARCHY.MEMBER).toBeDefined();
      expect(ORG_ROLE_HIERARCHY.VIEWER).toBeDefined();
    });

    it("should have OWNER at the top", () => {
      expect(ORG_ROLE_HIERARCHY.OWNER).toBeGreaterThan(ORG_ROLE_HIERARCHY.ADMIN);
    });

    it("should have ADMIN above MEMBER", () => {
      expect(ORG_ROLE_HIERARCHY.ADMIN).toBeGreaterThan(ORG_ROLE_HIERARCHY.MEMBER);
    });

    it("should have MEMBER above VIEWER", () => {
      expect(ORG_ROLE_HIERARCHY.MEMBER).toBeGreaterThan(ORG_ROLE_HIERARCHY.VIEWER);
    });

    it("should have correct hierarchy order: OWNER > ADMIN > MEMBER > VIEWER", () => {
      const sortedRoles = Object.entries(ORG_ROLE_HIERARCHY)
        .sort(([, a], [, b]) => b - a)
        .map(([role]) => role);

      expect(sortedRoles).toEqual(["OWNER", "ADMIN", "MEMBER", "VIEWER"]);
    });
  });

  describe("ORG_CAPABILITIES", () => {
    it("should have exactly 10 capabilities", () => {
      expect(ORG_CAPABILITIES).toHaveLength(10);
    });

    it("should contain all expected capabilities", () => {
      const expectedCapabilities = [
        "view_research",
        "create_research",
        "edit_research",
        "delete_research",
        "export",
        "invite",
        "manage_members",
        "billing",
        "integrations",
        "admin",
      ];

      expectedCapabilities.forEach((cap) => {
        expect(ORG_CAPABILITIES).toContain(cap);
      });
    });
  });

  describe("ORG_ROLE_CAPABILITIES", () => {
    it("should define capabilities for all roles", () => {
      ORG_ROLES.forEach((role) => {
        expect(ORG_ROLE_CAPABILITIES[role]).toBeDefined();
        expect(Array.isArray(ORG_ROLE_CAPABILITIES[role])).toBe(true);
      });
    });

    it("VIEWER should only have view_research capability", () => {
      expect(ORG_ROLE_CAPABILITIES.VIEWER).toEqual(["view_research"]);
    });

    it("MEMBER should have basic capabilities", () => {
      const memberCaps = ORG_ROLE_CAPABILITIES.MEMBER;
      expect(memberCaps).toContain("view_research");
      expect(memberCaps).toContain("create_research");
      expect(memberCaps).toContain("edit_research");
      expect(memberCaps).toContain("export");
      expect(memberCaps).not.toContain("delete_research");
      expect(memberCaps).not.toContain("billing");
    });

    it("ADMIN should have management capabilities", () => {
      const adminCaps = ORG_ROLE_CAPABILITIES.ADMIN;
      expect(adminCaps).toContain("view_research");
      expect(adminCaps).toContain("delete_research");
      expect(adminCaps).toContain("invite");
      expect(adminCaps).toContain("manage_members");
      expect(adminCaps).toContain("integrations");
      expect(adminCaps).not.toContain("billing");
    });

    it("OWNER should have all capabilities", () => {
      const ownerCaps = ORG_ROLE_CAPABILITIES.OWNER;
      expect(ownerCaps).toContain("view_research");
      expect(ownerCaps).toContain("create_research");
      expect(ownerCaps).toContain("delete_research");
      expect(ownerCaps).toContain("billing");
      expect(ownerCaps).toContain("admin");
    });

    it("OWNER should have superset of ADMIN capabilities", () => {
      const adminCaps = new Set(ORG_ROLE_CAPABILITIES.ADMIN);
      const ownerCaps = new Set(ORG_ROLE_CAPABILITIES.OWNER);

      adminCaps.forEach((cap) => {
        expect(ownerCaps.has(cap)).toBe(true);
      });
    });
  });

  describe("orgRoleHasCapability", () => {
    it("should return true for valid role-capability pairs", () => {
      expect(orgRoleHasCapability("VIEWER", "view_research")).toBe(true);
      expect(orgRoleHasCapability("MEMBER", "create_research")).toBe(true);
      expect(orgRoleHasCapability("ADMIN", "manage_members")).toBe(true);
      expect(orgRoleHasCapability("OWNER", "billing")).toBe(true);
    });

    it("should return false for invalid role-capability pairs", () => {
      expect(orgRoleHasCapability("VIEWER", "create_research")).toBe(false);
      expect(orgRoleHasCapability("VIEWER", "billing")).toBe(false);
      expect(orgRoleHasCapability("MEMBER", "delete_research")).toBe(false);
      expect(orgRoleHasCapability("ADMIN", "billing")).toBe(false);
    });

    it("should correctly check all capabilities for VIEWER", () => {
      expect(orgRoleHasCapability("VIEWER", "view_research")).toBe(true);
      expect(orgRoleHasCapability("VIEWER", "create_research")).toBe(false);
      expect(orgRoleHasCapability("VIEWER", "edit_research")).toBe(false);
      expect(orgRoleHasCapability("VIEWER", "delete_research")).toBe(false);
      expect(orgRoleHasCapability("VIEWER", "export")).toBe(false);
      expect(orgRoleHasCapability("VIEWER", "invite")).toBe(false);
      expect(orgRoleHasCapability("VIEWER", "manage_members")).toBe(false);
      expect(orgRoleHasCapability("VIEWER", "billing")).toBe(false);
      expect(orgRoleHasCapability("VIEWER", "integrations")).toBe(false);
      expect(orgRoleHasCapability("VIEWER", "admin")).toBe(false);
    });

    it("should correctly check all capabilities for OWNER", () => {
      ORG_CAPABILITIES.forEach((cap) => {
        expect(orgRoleHasCapability("OWNER", cap)).toBe(true);
      });
    });
  });

  describe("orgRoleMeetsMinimum", () => {
    it("should return true when role equals minimum", () => {
      expect(orgRoleMeetsMinimum("VIEWER", "VIEWER")).toBe(true);
      expect(orgRoleMeetsMinimum("MEMBER", "MEMBER")).toBe(true);
      expect(orgRoleMeetsMinimum("ADMIN", "ADMIN")).toBe(true);
      expect(orgRoleMeetsMinimum("OWNER", "OWNER")).toBe(true);
    });

    it("should return true when role exceeds minimum", () => {
      expect(orgRoleMeetsMinimum("OWNER", "VIEWER")).toBe(true);
      expect(orgRoleMeetsMinimum("OWNER", "MEMBER")).toBe(true);
      expect(orgRoleMeetsMinimum("OWNER", "ADMIN")).toBe(true);
      expect(orgRoleMeetsMinimum("ADMIN", "VIEWER")).toBe(true);
      expect(orgRoleMeetsMinimum("ADMIN", "MEMBER")).toBe(true);
      expect(orgRoleMeetsMinimum("MEMBER", "VIEWER")).toBe(true);
    });

    it("should return false when role is below minimum", () => {
      expect(orgRoleMeetsMinimum("VIEWER", "MEMBER")).toBe(false);
      expect(orgRoleMeetsMinimum("VIEWER", "ADMIN")).toBe(false);
      expect(orgRoleMeetsMinimum("VIEWER", "OWNER")).toBe(false);
      expect(orgRoleMeetsMinimum("MEMBER", "ADMIN")).toBe(false);
      expect(orgRoleMeetsMinimum("MEMBER", "OWNER")).toBe(false);
      expect(orgRoleMeetsMinimum("ADMIN", "OWNER")).toBe(false);
    });
  });
});

describe("Subscription Tiers", () => {
  describe("SUBSCRIPTION_TIERS", () => {
    it("should have exactly 4 tiers", () => {
      expect(SUBSCRIPTION_TIERS).toHaveLength(4);
    });

    it("should contain all expected tiers", () => {
      expect(SUBSCRIPTION_TIERS).toContain("FREE");
      expect(SUBSCRIPTION_TIERS).toContain("PRO");
      expect(SUBSCRIPTION_TIERS).toContain("TEAM");
      expect(SUBSCRIPTION_TIERS).toContain("ENTERPRISE");
    });
  });

  describe("TIER_LIMITS", () => {
    it("should define limits for all tiers", () => {
      SUBSCRIPTION_TIERS.forEach((tier) => {
        expect(TIER_LIMITS[tier]).toBeDefined();
        expect(TIER_LIMITS[tier].maxMembers).toBeDefined();
        expect(TIER_LIMITS[tier].maxProjects).toBeDefined();
        expect(TIER_LIMITS[tier].aiCallsPerMonth).toBeDefined();
        expect(TIER_LIMITS[tier].storageGb).toBeDefined();
      });
    });

    it("FREE tier should have restrictive limits", () => {
      expect(TIER_LIMITS.FREE.maxMembers).toBe(3);
      expect(TIER_LIMITS.FREE.maxProjects).toBe(5);
      expect(TIER_LIMITS.FREE.aiCallsPerMonth).toBe(100);
      expect(TIER_LIMITS.FREE.storageGb).toBe(1);
    });

    it("ENTERPRISE tier should have unlimited (-1) values", () => {
      expect(TIER_LIMITS.ENTERPRISE.maxMembers).toBe(-1);
      expect(TIER_LIMITS.ENTERPRISE.maxProjects).toBe(-1);
      expect(TIER_LIMITS.ENTERPRISE.aiCallsPerMonth).toBe(-1);
      expect(TIER_LIMITS.ENTERPRISE.storageGb).toBe(-1);
    });

    it("should have increasing limits from FREE to TEAM", () => {
      expect(TIER_LIMITS.PRO.maxMembers).toBeGreaterThan(TIER_LIMITS.FREE.maxMembers);
      expect(TIER_LIMITS.TEAM.maxMembers).toBeGreaterThan(TIER_LIMITS.PRO.maxMembers);
      expect(TIER_LIMITS.PRO.maxProjects).toBeGreaterThan(TIER_LIMITS.FREE.maxProjects);
      expect(TIER_LIMITS.TEAM.maxProjects).toBeGreaterThan(TIER_LIMITS.PRO.maxProjects);
    });
  });
});

describe("Zod Schemas", () => {
  describe("createOrganizationSchema", () => {
    it("should validate valid organization creation", () => {
      const validOrg = {
        name: "Test Organization",
        slug: "test-org",
        description: "A test organization",
        billingEmail: "billing@test.org",
      };

      const result = createOrganizationSchema.safeParse(validOrg);
      expect(result.success).toBe(true);
    });

    it("should validate minimal organization creation", () => {
      const minimalOrg = {
        name: "Te",
        slug: "te",
      };

      const result = createOrganizationSchema.safeParse(minimalOrg);
      expect(result.success).toBe(true);
    });

    it("should reject invalid slug format", () => {
      const invalidOrg = {
        name: "Test Organization",
        slug: "Test_Org!", // Invalid: uppercase and special chars
      };

      const result = createOrganizationSchema.safeParse(invalidOrg);
      expect(result.success).toBe(false);
    });

    it("should reject name too short", () => {
      const invalidOrg = {
        name: "T",
        slug: "test-org",
      };

      const result = createOrganizationSchema.safeParse(invalidOrg);
      expect(result.success).toBe(false);
    });

    it("should reject invalid email", () => {
      const invalidOrg = {
        name: "Test Organization",
        slug: "test-org",
        billingEmail: "not-an-email",
      };

      const result = createOrganizationSchema.safeParse(invalidOrg);
      expect(result.success).toBe(false);
    });

    it("should accept settings with valid structure", () => {
      const validOrg = {
        name: "Test Organization",
        slug: "test-org",
        settings: {
          defaultDataClassification: "INTERNAL",
          requireMfaForMembers: true,
          allowedDomains: ["test.org", "example.com"],
          features: { darkMode: true },
        },
      };

      const result = createOrganizationSchema.safeParse(validOrg);
      expect(result.success).toBe(true);
    });
  });

  describe("updateOrganizationSchema", () => {
    it("should validate partial update", () => {
      const partialUpdate = {
        name: "Updated Name",
      };

      const result = updateOrganizationSchema.safeParse(partialUpdate);
      expect(result.success).toBe(true);
    });

    it("should validate empty update", () => {
      const emptyUpdate = {};

      const result = updateOrganizationSchema.safeParse(emptyUpdate);
      expect(result.success).toBe(true);
    });

    it("should validate logoUrl", () => {
      const withLogo = {
        logoUrl: "https://example.com/logo.png",
      };

      const result = updateOrganizationSchema.safeParse(withLogo);
      expect(result.success).toBe(true);
    });

    it("should reject invalid logoUrl", () => {
      const invalidLogo = {
        logoUrl: "not-a-url",
      };

      const result = updateOrganizationSchema.safeParse(invalidLogo);
      expect(result.success).toBe(false);
    });
  });

  describe("inviteMemberSchema", () => {
    it("should validate invite with email and role", () => {
      const validInvite = {
        email: "newmember@example.com",
        orgRole: "MEMBER" as const,
      };

      const result = inviteMemberSchema.safeParse(validInvite);
      expect(result.success).toBe(true);
    });

    it("should default role to MEMBER if not provided", () => {
      const inviteWithoutRole = {
        email: "newmember@example.com",
      };

      const result = inviteMemberSchema.safeParse(inviteWithoutRole);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.orgRole).toBe("MEMBER");
      }
    });

    it("should reject invalid email", () => {
      const invalidInvite = {
        email: "not-an-email",
        orgRole: "MEMBER" as const,
      };

      const result = inviteMemberSchema.safeParse(invalidInvite);
      expect(result.success).toBe(false);
    });

    it("should reject invalid role", () => {
      const invalidRole = {
        email: "member@example.com",
        orgRole: "SUPERADMIN",
      };

      const result = inviteMemberSchema.safeParse(invalidRole);
      expect(result.success).toBe(false);
    });
  });

  describe("updateMemberRoleSchema", () => {
    it("should validate valid role update", () => {
      const validUpdate = { orgRole: "ADMIN" as const };

      const result = updateMemberRoleSchema.safeParse(validUpdate);
      expect(result.success).toBe(true);
    });

    it("should accept all valid roles", () => {
      ORG_ROLES.forEach((role) => {
        const result = updateMemberRoleSchema.safeParse({ orgRole: role });
        expect(result.success).toBe(true);
      });
    });

    it("should reject invalid role", () => {
      const invalidRole = { orgRole: "INVALID_ROLE" };

      const result = updateMemberRoleSchema.safeParse(invalidRole);
      expect(result.success).toBe(false);
    });
  });
});
