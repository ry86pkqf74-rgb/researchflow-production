/**
 * RBAC Test Utilities
 * INF-12: Mock utilities for testing role-based access control
 * 
 * Provides helpers to simulate authenticated requests with different roles
 * for integration testing without real authentication.
 */

import type { Request, Response, NextFunction } from 'express';
import type { Role } from '../../packages/core/types/roles';

export interface MockUser {
  id: string;
  username: string;
  role: Role;
  email: string;
  isActive: boolean;
}

export const TEST_USERS: Record<Role, MockUser> = {
  VIEWER: { id: 'test-viewer-001', username: 'test_viewer', role: 'VIEWER', email: 'viewer@test.com', isActive: true },
  RESEARCHER: { id: 'test-researcher-001', username: 'test_researcher', role: 'RESEARCHER', email: 'researcher@test.com', isActive: true },
  STEWARD: { id: 'test-steward-001', username: 'test_steward', role: 'STEWARD', email: 'steward@test.com', isActive: true },
  ADMIN: { id: 'test-admin-001', username: 'test_admin', role: 'ADMIN', email: 'admin@test.com', isActive: true },
};

/**
 * Creates middleware that injects a mock user with specified role
 */
export function mockAuthMiddleware(role: Role) {
  return (req: Request, _res: Response, next: NextFunction) => {
    req.user = TEST_USERS[role];
    next();
  };
}

/**
 * Creates middleware that simulates unauthenticated request
 */
export function noAuthMiddleware() {
  return (_req: Request, _res: Response, next: NextFunction) => {
    next();
  };
}

/**
 * Helper to set role header for development-mode auth override
 */
export function getRoleHeader(role: Role): Record<string, string> {
  return { 'x-user-role': role };
}

/**
 * Gets expected status code for role attempting protected action
 */
export function getExpectedStatus(userRole: Role | null, requiredRole: Role): number {
  if (!userRole) return 401;
  
  const roleHierarchy: Record<Role, number> = {
    VIEWER: 0,
    RESEARCHER: 1,
    STEWARD: 2,
    ADMIN: 3,
  };
  
  return roleHierarchy[userRole] >= roleHierarchy[requiredRole] ? 200 : 403;
}

/**
 * All roles for iteration in tests
 */
export const ALL_ROLES: Role[] = ['VIEWER', 'RESEARCHER', 'STEWARD', 'ADMIN'];

/**
 * Protected endpoints with their minimum required roles
 */
export const PROTECTED_ROUTES = {
  artifactCreate: { path: '/api/ros/artifacts', method: 'POST', minRole: 'RESEARCHER' as Role },
  artifactRead: { path: '/api/ros/artifacts/:researchId', method: 'GET', minRole: 'VIEWER' as Role },
  artifactVersion: { path: '/api/ros/artifacts/:id/versions', method: 'POST', minRole: 'RESEARCHER' as Role },
  reproducibilityExport: { path: '/api/ros/export/reproducibility-bundle/:researchId', method: 'GET', minRole: 'RESEARCHER' as Role },
  aiGenerate: { path: '/api/ai/generate-brief', method: 'POST', minRole: 'RESEARCHER' as Role },
  governanceApprove: { path: '/api/governance/approve', method: 'POST', minRole: 'STEWARD' as Role },
} as const;
