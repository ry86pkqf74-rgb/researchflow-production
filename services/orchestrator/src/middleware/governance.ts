/**
 * Governance Middleware
 *
 * Re-exports authentication and authorization middleware for convenience.
 */

import { Request, Response, NextFunction } from 'express';
import { mockAuthMiddleware } from './auth';

/**
 * Require authentication middleware
 * Ensures request has valid user context
 */
export function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  // Use mock auth middleware for now
  mockAuthMiddleware(req, res, (err?: any) => {
    if (err) {
      return next(err);
    }

    if (!req.user) {
      res.status(401).json({
        error: 'Authentication required',
        code: 'AUTH_REQUIRED'
      });
      return;
    }

    next();
  });
}

/**
 * Alias for requireAuth - some routes may use this name
 */
export const requireAuthentication = requireAuth;

// Re-export other auth utilities
export { mockAuthMiddleware, getMockUser, setMockUserRole } from './auth';
