/**
 * Organization Types for Multi-tenancy (Task 81)
 *
 * Defines organization structure, roles, and capabilities
 * for multi-tenant support in ResearchFlow.
 */

import { z } from "zod";

// =====================
// ORG ROLE DEFINITIONS
// =====================

export const ORG_ROLES = ["OWNER", "ADMIN", "MEMBER", "VIEWER"] as const;
export type OrgRole = (typeof ORG_ROLES)[number];

export const ORG_ROLE_HIERARCHY: Record<OrgRole, number> = {
  VIEWER: 1,
  MEMBER: 2,
  ADMIN: 3,
  OWNER: 4,
};

// =====================
// ORG CAPABILITIES
// =====================

export const ORG_CAPABILITIES = [
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
] as const;

export type OrgCapability = (typeof ORG_CAPABILITIES)[number];

/**
 * Capabilities granted to each org role
 */
export const ORG_ROLE_CAPABILITIES: Record<OrgRole, readonly OrgCapability[]> = {
  VIEWER: ["view_research"],
  MEMBER: ["view_research", "create_research", "edit_research", "export"],
  ADMIN: [
    "view_research",
    "create_research",
    "edit_research",
    "delete_research",
    "export",
    "invite",
    "manage_members",
    "integrations",
  ],
  OWNER: [
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
  ],
};

/**
 * Check if a role has a specific capability
 */
export function orgRoleHasCapability(role: OrgRole, capability: OrgCapability): boolean {
  return ORG_ROLE_CAPABILITIES[role].includes(capability);
}

/**
 * Check if role meets minimum level
 */
export function orgRoleMeetsMinimum(role: OrgRole, minRole: OrgRole): boolean {
  return ORG_ROLE_HIERARCHY[role] >= ORG_ROLE_HIERARCHY[minRole];
}

// =====================
// SUBSCRIPTION TIERS
// =====================

export const SUBSCRIPTION_TIERS = ["FREE", "PRO", "TEAM", "ENTERPRISE"] as const;
export type SubscriptionTier = (typeof SUBSCRIPTION_TIERS)[number];

export interface TierLimits {
  maxMembers: number;
  maxProjects: number;
  aiCallsPerMonth: number;
  storageGb: number;
}

export const TIER_LIMITS: Record<SubscriptionTier, TierLimits> = {
  FREE: {
    maxMembers: 3,
    maxProjects: 5,
    aiCallsPerMonth: 100,
    storageGb: 1,
  },
  PRO: {
    maxMembers: 10,
    maxProjects: 50,
    aiCallsPerMonth: 1000,
    storageGb: 10,
  },
  TEAM: {
    maxMembers: 50,
    maxProjects: 200,
    aiCallsPerMonth: 5000,
    storageGb: 100,
  },
  ENTERPRISE: {
    maxMembers: -1, // Unlimited
    maxProjects: -1,
    aiCallsPerMonth: -1,
    storageGb: -1,
  },
};

// =====================
// ORGANIZATION TYPES
// =====================

export interface Organization {
  id: string;
  name: string;
  slug: string;
  description?: string;
  logoUrl?: string;
  settings: OrganizationSettings;
  billingEmail?: string;
  subscriptionTier: SubscriptionTier;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface OrganizationSettings {
  defaultDataClassification?: string;
  requireMfaForMembers?: boolean;
  allowedDomains?: string[];
  features?: Record<string, boolean>;
}

export interface OrgMembership {
  id: string;
  orgId: string;
  userId: string;
  orgRole: OrgRole;
  joinedAt: Date;
  invitedBy?: string;
  isActive: boolean;
}

export interface OrgInvite {
  id: string;
  orgId: string;
  email: string;
  orgRole: OrgRole;
  tokenHash: string;
  invitedBy: string;
  expiresAt: Date;
  acceptedAt?: Date;
  status: "PENDING" | "ACCEPTED" | "EXPIRED" | "REVOKED";
  createdAt: Date;
}

// =====================
// ZOD SCHEMAS
// =====================

export const organizationSettingsSchema = z.object({
  defaultDataClassification: z.string().optional(),
  requireMfaForMembers: z.boolean().optional(),
  allowedDomains: z.array(z.string()).optional(),
  features: z.record(z.boolean()).optional(),
});

export const createOrganizationSchema = z.object({
  name: z.string().min(2).max(100),
  slug: z
    .string()
    .min(2)
    .max(50)
    .regex(/^[a-z0-9-]+$/, "Slug must be lowercase alphanumeric with hyphens"),
  description: z.string().max(500).optional(),
  billingEmail: z.string().email().optional(),
  settings: organizationSettingsSchema.optional(),
});

export const updateOrganizationSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  description: z.string().max(500).optional(),
  logoUrl: z.string().url().optional(),
  billingEmail: z.string().email().optional(),
  settings: organizationSettingsSchema.optional(),
});

export const inviteMemberSchema = z.object({
  email: z.string().email(),
  orgRole: z.enum(ORG_ROLES).default("MEMBER"),
});

export const updateMemberRoleSchema = z.object({
  orgRole: z.enum(ORG_ROLES),
});

export type CreateOrganization = z.infer<typeof createOrganizationSchema>;
export type UpdateOrganization = z.infer<typeof updateOrganizationSchema>;
export type InviteMember = z.infer<typeof inviteMemberSchema>;
export type UpdateMemberRole = z.infer<typeof updateMemberRoleSchema>;

// =====================
// UTILITY TYPES
// =====================

/**
 * Organization with membership info for the current user
 */
export interface OrganizationWithMembership extends Organization {
  membership: OrgMembership;
}

/**
 * Org context attached to request by middleware
 */
export interface OrgContext {
  org: Organization;
  membership: OrgMembership;
  capabilities: OrgCapability[];
}

/**
 * Extended Express Request with org context
 */
declare global {
  namespace Express {
    interface Request {
      org?: OrgContext;
      selectedOrgId?: string;
    }
  }
}
