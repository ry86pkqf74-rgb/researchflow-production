/**
 * Mock Authentication Middleware
 *
 * Development-only middleware that sets req.user for RBAC testing.
 * In production, replace with real authentication (JWT, OAuth, etc.)
 *
 * Priority: P0 - CRITICAL (Phase 2 Integration)
 */

import { Request, Response, NextFunction } from 'express';
import type { User as CoreUser } from "@researchflow/core";

// Mock user for development
const mockUser: CoreUser = {
  id: 'user-dev-001',
  email: 'steward@researchflow.dev',
  name: 'Development Steward',
  role: 'STEWARD',
  createdAt: new Date('2024-01-01'),
  isActive: true
};

// Extend Express to include user type from our core package
// This augments the empty User interface from passport
declare global {
  namespace Express {
    interface User extends CoreUser {}
  }
}

/**
 * Mock authentication middleware for development
 * Sets req.user so RBAC middleware can check permissions
 */
export function mockAuthMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  // In development, always set mock user
  if (process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test') {
    req.user = mockUser;
    next();
    return;
  }

  // In production, would validate JWT/session here
  // For now, reject all requests in production mode without real auth
  res.status(401).json({
    error: 'Authentication required',
    code: 'AUTH_REQUIRED',
    message: 'Production authentication not yet implemented'
  });
}

/**
 * Get mock user for testing (exported for use in tests)
 */
export function getMockUser(): CoreUser {
  return { ...mockUser };
}

/**
 * Set mock user role (for testing different permission levels)
 */
export function setMockUserRole(role: CoreUser['role']): void {
  mockUser.role = role;
}