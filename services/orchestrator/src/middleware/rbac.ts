/**
 * Role-Based Access Control Middleware
 *
 * Protects API endpoints based on user roles and permissions.
 * All sensitive operations MUST use this middleware.
 *
 * Priority: P0 - CRITICAL
 */

import { Request, Response, NextFunction } from 'express';
import type {
  User as CoreUser,
  RoleName,
  Permission,
} from "@researchflow/core";
import {
  ROLES,
  ROLE_CONFIGS,
  hasPermission,
  hasMinimumRole,
  InsufficientPermissionsError
} from "@researchflow/core"
import { createLogger } from '../utils/logger';

const logger = createLogger('rbac');

export { ROLES };
export type { Permission };
export type { CoreUser as User };
export type Role = RoleName;

export function logAuditEvent(action: string, resourceType: string) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    logger.info(`Audit event: ${action}`, {
      type: 'AUDIT_EVENT',
      action,
      resourceType,
      userId: req.user?.id || 'anonymous',
      method: req.method,
      path: req.path
    });
    next();
  };
}

/**
 * Extend Express to include user type from our core package
 * This augments both Express.User and Express.Request.user
 */
declare global {
  namespace Express {
    // Augment the empty User interface from passport
    interface User extends CoreUser {}
  }
}

/**
 * Middleware to require a specific permission
 *
 * Usage:
 * router.post('/export', requirePermission('EXPORT'), async (req, res) => { ... });
 */
export function requirePermission(permission: Permission) {
  return (req: Request, res: Response, next: NextFunction): void => {
    // Check if user is authenticated
    if (!req.user) {
      res.status(401).json({
        error: 'Unauthorized',
        message: 'Authentication required',
        code: 'AUTH_REQUIRED'
      });
      return;
    }

    // Check if user has the required permission
    if (!hasPermission(req.user, permission)) {
      res.status(403).json({
        error: 'Forbidden',
        message: `Insufficient permissions: ${permission} required`,
        code: 'INSUFFICIENT_PERMISSIONS',
        required: permission,
        userRole: req.user.role,
        userPermissions: ROLE_CONFIGS[req.user.role].can
      });
      return;
    }

    // Permission granted, proceed
    next();
  };
}

/**
 * Middleware to require a minimum role level
 *
 * Usage:
 * router.post('/approve', requireRole('STEWARD'), async (req, res) => { ... });
 */
export function requireRole(minRole: RoleName) {
  return (req: Request, res: Response, next: NextFunction): void => {
    // Check if user is authenticated
    if (!req.user) {
      res.status(401).json({
        error: 'Unauthorized',
        message: 'Authentication required',
        code: 'AUTH_REQUIRED'
      });
      return;
    }

    // Check if user has minimum required role
    if (!hasMinimumRole(req.user, minRole)) {
      res.status(403).json({
        error: 'Forbidden',
        message: `Insufficient role: ${minRole} or higher required`,
        code: 'INSUFFICIENT_ROLE',
        required: minRole,
        requiredLevel: ROLE_CONFIGS[minRole].level,
        userRole: req.user.role,
        userLevel: ROLE_CONFIGS[req.user.role].level
      });
      return;
    }

    // Role requirement met, proceed
    next();
  };
}

/**
 * Middleware to require multiple permissions (AND logic)
 *
 * Usage:
 * router.post('/admin-export', requireAllPermissions(['EXPORT', 'AUDIT_EXPORT']), ...);
 */
export function requireAllPermissions(permissions: Permission[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        error: 'Unauthorized',
        message: 'Authentication required',
        code: 'AUTH_REQUIRED'
      });
      return;
    }

    const missingPermissions = permissions.filter(p => !hasPermission(req.user!, p));

    if (missingPermissions.length > 0) {
      res.status(403).json({
        error: 'Forbidden',
        message: `Missing required permissions: ${missingPermissions.join(', ')}`,
        code: 'INSUFFICIENT_PERMISSIONS',
        required: permissions,
        missing: missingPermissions,
        userRole: req.user.role
      });
      return;
    }

    next();
  };
}

/**
 * Middleware to require at least one of several permissions (OR logic)
 *
 * Usage:
 * router.get('/data', requireAnyPermission(['VIEW', 'ANALYZE']), ...);
 */
export function requireAnyPermission(permissions: Permission[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        error: 'Unauthorized',
        message: 'Authentication required',
        code: 'AUTH_REQUIRED'
      });
      return;
    }

    const hasAnyPermission = permissions.some(p => hasPermission(req.user!, p));

    if (!hasAnyPermission) {
      res.status(403).json({
        error: 'Forbidden',
        message: `At least one of these permissions required: ${permissions.join(', ')}`,
        code: 'INSUFFICIENT_PERMISSIONS',
        requiredAny: permissions,
        userRole: req.user.role
      });
      return;
    }

    next();
  };
}

/**
 * Middleware to check if user is active
 */
export function requireActiveAccount(req: Request, res: Response, next: NextFunction): void {
  if (!req.user) {
    res.status(401).json({
      error: 'Unauthorized',
      message: 'Authentication required',
      code: 'AUTH_REQUIRED'
    });
    return;
  }

  if (!req.user.isActive) {
    res.status(403).json({
      error: 'Forbidden',
      message: 'Account is inactive. Please contact administrator.',
      code: 'ACCOUNT_INACTIVE'
    });
    return;
  }

  next();
}

/**
 * Combined middleware for common pattern: active account + permission
 *
 * Usage:
 * router.post('/analyze', protect('ANALYZE'), async (req, res) => { ... });
 */
export function protect(permission: Permission) {
  return [requireActiveAccount, requirePermission(permission)];
}

/**
 * Combined middleware for common pattern: active account + role
 *
 * Usage:
 * router.post('/admin', protectWithRole('ADMIN'), async (req, res) => { ... });
 */
export function protectWithRole(minRole: RoleName) {
  return [requireActiveAccount, requireRole(minRole)];
}

/**
 * Error handler for RBAC errors
 * Add this to your Express error handling middleware
 */
export function rbacErrorHandler(err: Error, req: Request, res: Response, next: NextFunction): void {
  if (err instanceof InsufficientPermissionsError) {
    res.status(403).json({
      error: 'Forbidden',
      message: err.message,
      code: 'INSUFFICIENT_PERMISSIONS',
      required: err.required,
      actual: err.actual,
      operation: err.operation
    });
    return;
  }

  // Pass to next error handler if not an RBAC error
  next(err);
}

/**
 * Audit log middleware - logs all protected endpoint access
 */
export function auditAccess(req: Request, res: Response, next: NextFunction): void {
  if (req.user) {
    // Use debug level for access logging to reduce noise
    logger.debug(`API access`, {
      type: 'API_ACCESS',
      userId: req.user.id,
      role: req.user.role,
      method: req.method,
      path: req.path,
    });
  }

  next();
}

/**
 * Middleware to require any of the specified roles (OR logic)
 */
export function requireAnyRole(roles: RoleName[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        error: 'Unauthorized',
        message: 'Authentication required',
        code: 'AUTH_REQUIRED'
      });
      return;
    }

    const hasAnyRole = roles.includes(req.user.role);

    if (!hasAnyRole) {
      res.status(403).json({
        error: 'Forbidden',
        message: `One of these roles required: ${roles.join(', ')}`,
        code: 'INSUFFICIENT_ROLE',
        requiredAny: roles,
        userRole: req.user.role
      });
      return;
    }

    next();
  };
}

/**
 * Protected endpoints configuration
 */
interface EndpointProtection {
  minimumRole: RoleName;
  description: string;
}

export const PROTECTED_ENDPOINTS: Record<string, EndpointProtection> = {
  '/api/ai/generate': { minimumRole: ROLES.RESEARCHER, description: 'AI generation' },
  '/api/admin/users': { minimumRole: ROLES.ADMIN, description: 'User management' },
  '/api/upload/dataset': { minimumRole: ROLES.ADMIN, description: 'Dataset upload' },
  '/api/governance/approve': { minimumRole: ROLES.STEWARD, description: 'Approval workflow' },
  '/api/ros/export/data': { minimumRole: ROLES.STEWARD, description: 'Data export' }
};

/**
 * Get protection config for an endpoint
 */
export function getEndpointProtection(path: string): EndpointProtection | null {
  return PROTECTED_ENDPOINTS[path] || null;
}
