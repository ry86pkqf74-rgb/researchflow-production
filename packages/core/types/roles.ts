/**
 * Role-Based Access Control Types
 * 
 * Defines user roles, permissions, and RBAC utility functions.
 * Central source of truth for authorization throughout the system.
 */

export type RoleName = 'VIEWER' | 'RESEARCHER' | 'STEWARD' | 'ADMIN';

export type Permission = 
  | 'VIEW'
  | 'ANALYZE'
  | 'EXPORT'
  | 'APPROVE'
  | 'DRAFT'
  | 'PRESENT'
  | 'UPLOAD'
  | 'DELETE'
  | 'AUDIT_VIEW'
  | 'AUDIT_EXPORT'
  | 'PHI_VIEW'
  | 'PHI_EXPORT'
  | 'USER_MANAGE'
  | 'SYSTEM_CONFIG';

export interface RoleConfig {
  level: number;
  can: Permission[];
  description: string;
}

export const ROLE_CONFIGS: Record<RoleName, RoleConfig> = {
  VIEWER: {
    level: 1,
    can: ['VIEW', 'AUDIT_VIEW'],
    description: 'Can view dashboards and datasets, but cannot modify or analyze data'
  },
  RESEARCHER: {
    level: 2,
    can: ['VIEW', 'ANALYZE', 'DRAFT', 'UPLOAD', 'AUDIT_VIEW'],
    description: 'Can analyze data, create research sessions, and draft manuscripts using AI'
  },
  STEWARD: {
    level: 3,
    can: ['VIEW', 'ANALYZE', 'EXPORT', 'APPROVE', 'DRAFT', 'PRESENT', 'UPLOAD', 'AUDIT_VIEW', 'AUDIT_EXPORT', 'PHI_VIEW'],
    description: 'Can approve exports, manage PHI incidents, and oversee data governance'
  },
  ADMIN: {
    level: 4,
    can: ['VIEW', 'ANALYZE', 'EXPORT', 'APPROVE', 'DRAFT', 'PRESENT', 'UPLOAD', 'DELETE', 'AUDIT_VIEW', 'AUDIT_EXPORT', 'PHI_VIEW', 'PHI_EXPORT', 'USER_MANAGE', 'SYSTEM_CONFIG'],
    description: 'Full system access including user management and system configuration'
  }
};

export const ROLES = {
  VIEWER: 'VIEWER' as const,
  RESEARCHER: 'RESEARCHER' as const,
  STEWARD: 'STEWARD' as const,
  ADMIN: 'ADMIN' as const
};

export type Role = RoleName;

export const ROLE_HIERARCHY: Record<RoleName, number> = {
  VIEWER: 1,
  RESEARCHER: 2,
  STEWARD: 3,
  ADMIN: 4
};

export const ROLE_PERMISSIONS: Record<RoleName, string[]> = {
  VIEWER: [
    'view:dashboard',
    'view:datasets',
    'view:governance',
    'view:audit-log'
  ],
  RESEARCHER: [
    'view:dashboard',
    'view:datasets', 
    'view:governance',
    'view:audit-log',
    'analyze:data',
    'draft:manuscript',
    'use:ai-features',
    'create:research-session',
    'upload:datasets',
    'extract:data',
    'create:schema',
    'validate:data'
  ],
  STEWARD: [
    'view:dashboard',
    'view:datasets',
    'view:governance',
    'view:audit-log',
    'analyze:data',
    'draft:manuscript',
    'use:ai-features',
    'create:research-session',
    'approve:exports',
    'approve:ai-outputs',
    'export:data',
    'manage:phi-incidents',
    'upload:datasets',
    'upload:phi-data',
    'extract:data',
    'view:phi',
    'create:schema',
    'validate:data'
  ],
  ADMIN: [
    'view:dashboard',
    'view:datasets',
    'view:governance', 
    'view:audit-log',
    'analyze:data',
    'draft:manuscript',
    'use:ai-features',
    'create:research-session',
    'approve:exports',
    'approve:ai-outputs',
    'export:data',
    'manage:phi-incidents',
    'manage:users',
    'manage:roles',
    'manage:system-config',
    'upload:datasets',
    'delete:data',
    'upload:phi-data',
    'extract:data',
    'view:phi',
    'export:phi',
    'create:schema',
    'validate:data'
  ]
};

export const ROLE_DESCRIPTIONS: Record<RoleName, string> = {
  VIEWER: 'Can view dashboards and datasets, but cannot modify or analyze data',
  RESEARCHER: 'Can analyze data, create research sessions, and draft manuscripts using AI',
  STEWARD: 'Can approve exports, manage PHI incidents, and oversee data governance',
  ADMIN: 'Full system access including user management and system configuration'
};

export interface User {
  id: string;
  email: string;
  username?: string;
  name?: string;  // Display name (e.g., "John Doe")
  firstName?: string;
  lastName?: string;
  profileImageUrl?: string;
  role: RoleName;
  isActive: boolean;
  permissions?: string[];
  createdAt?: Date;
  updatedAt?: Date;
}

export interface UserWithRole {
  id: string;
  username: string;
  role: Role;
}

export class InsufficientPermissionsError extends Error {
  constructor(
    public readonly required: Permission | RoleName,
    public readonly actual: Permission[] | RoleName,
    public readonly operation: string
  ) {
    super(`Insufficient permissions for ${operation}: requires ${required}, has ${Array.isArray(actual) ? actual.join(', ') : actual}`);
    this.name = 'InsufficientPermissionsError';
  }
}

export function hasPermission(user: User, permission: Permission): boolean {
  const roleConfig = ROLE_CONFIGS[user.role];
  return roleConfig?.can.includes(permission) ?? false;
}

export function hasMinimumRole(user: User, minimumRole: RoleName): boolean {
  return ROLE_HIERARCHY[user.role] >= ROLE_HIERARCHY[minimumRole];
}

export function hasPermissionByRole(userRole: RoleName, permission: string): boolean {
  return ROLE_PERMISSIONS[userRole]?.includes(permission) ?? false;
}

export function hasMinimumRoleByName(userRole: RoleName, minimumRole: RoleName): boolean {
  return ROLE_HIERARCHY[userRole] >= ROLE_HIERARCHY[minimumRole];
}
