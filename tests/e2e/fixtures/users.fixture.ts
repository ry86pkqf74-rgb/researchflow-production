/**
 * E2E Test User Fixtures
 *
 * Extends pattern from tests/utils/rbac-mock.ts for Playwright E2E tests.
 * These mock users are used to simulate different role-based access scenarios.
 */

export type Role = 'VIEWER' | 'ANALYST' | 'STEWARD' | 'ADMIN';

export interface E2EUser {
  id: string;
  username: string;
  role: Role;
  email: string;
  isActive: boolean;
}

/**
 * Mock users for E2E testing with different roles.
 * Matches the structure from tests/utils/rbac-mock.ts TEST_USERS.
 */
export const E2E_USERS: Record<string, E2EUser> = {
  VIEWER: {
    id: 'e2e-viewer-001',
    username: 'e2e_viewer',
    role: 'VIEWER',
    email: 'viewer@e2e.test',
    isActive: true,
  },
  ANALYST: {
    id: 'e2e-analyst-001',
    username: 'e2e_analyst',
    role: 'ANALYST',
    email: 'analyst@e2e.test',
    isActive: true,
  },
  STEWARD: {
    id: 'e2e-steward-001',
    username: 'e2e_steward',
    role: 'STEWARD',
    email: 'steward@e2e.test',
    isActive: true,
  },
  ADMIN: {
    id: 'e2e-admin-001',
    username: 'e2e_admin',
    role: 'ADMIN',
    email: 'admin@e2e.test',
    isActive: true,
  },
};

/**
 * Role hierarchy for permission checks.
 * Higher number = more permissions.
 */
export const ROLE_HIERARCHY: Record<Role, number> = {
  VIEWER: 0,
  ANALYST: 1,
  STEWARD: 2,
  ADMIN: 3,
};

/**
 * All roles for iteration in tests.
 */
export const ALL_ROLES: Role[] = ['VIEWER', 'ANALYST', 'STEWARD', 'ADMIN'];

/**
 * Check if a role has sufficient permissions for a required role.
 */
export function hasPermission(userRole: Role, requiredRole: Role): boolean {
  return ROLE_HIERARCHY[userRole] >= ROLE_HIERARCHY[requiredRole];
}
