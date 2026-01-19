/**
 * Internal Service Auth Middleware
 * Validates x-service-token and extracts user context from headers
 *
 * SECURITY: This service does NOT handle browser auth directly.
 * All requests come through the orchestrator gateway which handles user auth
 * and passes user context via headers.
 */

import { Request, Response, NextFunction } from 'express';
import type { UserContext } from './types/api.types';

// Extend Express Request to include user context
declare global {
  namespace Express {
    interface Request {
      userContext?: UserContext;
    }
  }
}

/**
 * Validate internal service token
 * CRITICAL: Never trust user-provided body for identity/role
 */
export function serviceAuthMiddleware(req: Request, res: Response, next: NextFunction): void {
  const serviceToken = req.headers['x-service-token'] as string;
  const expectedToken = process.env.MANUSCRIPT_SERVICE_TOKEN;

  // In development, allow requests without token if not configured
  if (!expectedToken && process.env.NODE_ENV === 'development') {
    console.warn('[Auth] No MANUSCRIPT_SERVICE_TOKEN configured - allowing request in development');
    extractUserContext(req);
    return next();
  }

  if (!serviceToken) {
    res.status(401).json({
      error: 'Missing service token',
      code: 'AUTH_MISSING_TOKEN',
    });
    return;
  }

  if (serviceToken !== expectedToken) {
    res.status(403).json({
      error: 'Invalid service token',
      code: 'AUTH_INVALID_TOKEN',
    });
    return;
  }

  // Extract user context from headers (set by orchestrator gateway)
  extractUserContext(req);
  next();
}

/**
 * Extract user context from gateway headers
 * NEVER trust user-provided body for identity/role
 */
function extractUserContext(req: Request): void {
  const userId = req.headers['x-user-id'] as string;
  const userRole = req.headers['x-user-role'] as string;
  const permissions = req.headers['x-user-permissions'] as string;

  if (userId) {
    req.userContext = {
      userId,
      role: userRole || 'user',
      permissions: permissions ? permissions.split(',') : undefined,
    };
  }
}

/**
 * Require user context middleware
 * Use after serviceAuthMiddleware to ensure user context is present
 */
export function requireUserContext(req: Request, res: Response, next: NextFunction): void {
  if (!req.userContext?.userId) {
    res.status(401).json({
      error: 'User context required',
      code: 'AUTH_NO_USER_CONTEXT',
    });
    return;
  }
  next();
}

/**
 * Require specific role middleware factory
 */
export function requireRole(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.userContext) {
      res.status(401).json({
        error: 'User context required',
        code: 'AUTH_NO_USER_CONTEXT',
      });
      return;
    }

    if (!roles.includes(req.userContext.role)) {
      res.status(403).json({
        error: `Insufficient permissions. Required role: ${roles.join(' or ')}`,
        code: 'AUTH_INSUFFICIENT_ROLE',
      });
      return;
    }

    next();
  };
}
