import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Request, Response, NextFunction } from 'express';
import {
  requireRole,
  requirePermission,
  requireAnyRole,
  getEndpointProtection,
  PROTECTED_ENDPOINTS,
  ROLES
} from '@apps/api-node/src/middleware/rbac';
import {
  hasPermissionByRole,
  hasMinimumRoleByName,
  ROLE_HIERARCHY,
  ROLE_PERMISSIONS
} from '@packages/core/types/roles';

describe('RBAC Middleware', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockNext: NextFunction;
  let responseJson: any;

  beforeEach(() => {
    responseJson = null;
    mockRequest = {
      user: undefined,
      path: '/api/test'
    };
    mockResponse = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn((data) => {
        responseJson = data;
        return mockResponse;
      })
    };
    mockNext = vi.fn();
  });

  describe('Role Hierarchy', () => {
    it('should have VIEWER as lowest role', () => {
      expect(ROLE_HIERARCHY.VIEWER).toBe(1);
    });

    it('should have ADMIN as highest role', () => {
      expect(ROLE_HIERARCHY.ADMIN).toBe(4);
    });

    it('should have correct hierarchy order', () => {
      expect(ROLE_HIERARCHY.VIEWER).toBeLessThan(ROLE_HIERARCHY.RESEARCHER);
      expect(ROLE_HIERARCHY.RESEARCHER).toBeLessThan(ROLE_HIERARCHY.STEWARD);
      expect(ROLE_HIERARCHY.STEWARD).toBeLessThan(ROLE_HIERARCHY.ADMIN);
    });
  });

  describe('hasMinimumRoleByName', () => {
    it('should allow ADMIN to access STEWARD endpoints', () => {
      expect(hasMinimumRoleByName('ADMIN', 'STEWARD')).toBe(true);
    });

    it('should allow STEWARD to access RESEARCHER endpoints', () => {
      expect(hasMinimumRoleByName('STEWARD', 'RESEARCHER')).toBe(true);
    });

    it('should deny VIEWER access to STEWARD endpoints', () => {
      expect(hasMinimumRoleByName('VIEWER', 'STEWARD')).toBe(false);
    });

    it('should deny RESEARCHER access to STEWARD endpoints', () => {
      expect(hasMinimumRoleByName('RESEARCHER', 'STEWARD')).toBe(false);
    });

    it('should allow same role access', () => {
      expect(hasMinimumRoleByName('RESEARCHER', 'RESEARCHER')).toBe(true);
    });
  });

  describe('hasPermissionByRole', () => {
    it('should grant VIEWER basic view permissions', () => {
      expect(hasPermissionByRole('VIEWER', 'view:dashboard')).toBe(true);
      expect(hasPermissionByRole('VIEWER', 'view:datasets')).toBe(true);
    });

    it('should deny VIEWER analysis permissions', () => {
      expect(hasPermissionByRole('VIEWER', 'analyze:data')).toBe(false);
      expect(hasPermissionByRole('VIEWER', 'use:ai-features')).toBe(false);
    });

    it('should grant RESEARCHER AI feature access', () => {
      expect(hasPermissionByRole('RESEARCHER', 'use:ai-features')).toBe(true);
      expect(hasPermissionByRole('RESEARCHER', 'analyze:data')).toBe(true);
    });

    it('should deny RESEARCHER approval permissions', () => {
      expect(hasPermissionByRole('RESEARCHER', 'approve:exports')).toBe(false);
      expect(hasPermissionByRole('RESEARCHER', 'approve:ai-outputs')).toBe(false);
    });

    it('should grant STEWARD approval permissions', () => {
      expect(hasPermissionByRole('STEWARD', 'approve:exports')).toBe(true);
      expect(hasPermissionByRole('STEWARD', 'approve:ai-outputs')).toBe(true);
      expect(hasPermissionByRole('STEWARD', 'export:data')).toBe(true);
    });

    it('should deny STEWARD admin permissions', () => {
      expect(hasPermissionByRole('STEWARD', 'manage:users')).toBe(false);
      expect(hasPermissionByRole('STEWARD', 'upload:datasets')).toBe(true);
    });

    it('should grant ADMIN all permissions', () => {
      expect(hasPermissionByRole('ADMIN', 'manage:users')).toBe(true);
      expect(hasPermissionByRole('ADMIN', 'manage:system-config')).toBe(true);
      expect(hasPermissionByRole('ADMIN', 'upload:datasets')).toBe(true);
      expect(hasPermissionByRole('ADMIN', 'delete:data')).toBe(true);
    });
  });

  describe('requireRole middleware', () => {
    it('should return 401 when no user is authenticated', () => {
      const middleware = requireRole(ROLES.RESEARCHER);
      middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(responseJson.code).toBe('AUTH_REQUIRED');
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should return 403 when user role is insufficient', () => {
      mockRequest.user = { id: '1', username: 'viewer', role: 'VIEWER' };
      const middleware = requireRole(ROLES.STEWARD);
      middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(403);
      expect(responseJson.code).toBe('INSUFFICIENT_ROLE');
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should call next() when user has sufficient role', () => {
      mockRequest.user = { id: '1', username: 'admin', role: 'ADMIN' };
      const middleware = requireRole(ROLES.STEWARD);
      middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockResponse.status).not.toHaveBeenCalled();
    });

    it('should allow VIEWER to access VIEWER-level endpoints', () => {
      mockRequest.user = { id: '1', username: 'viewer', role: 'VIEWER' };
      const middleware = requireRole(ROLES.VIEWER);
      middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });
  });

  describe('requirePermission middleware', () => {
    it('should return 401 when no user is authenticated', () => {
      const middleware = requirePermission('export:data');
      middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(responseJson.code).toBe('AUTH_REQUIRED');
    });

    it('should return 403 when user lacks permission', () => {
      mockRequest.user = { id: '1', username: 'researcher', role: 'RESEARCHER' };
      const middleware = requirePermission('approve:exports');
      middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(403);
      expect(responseJson.code).toBe('INSUFFICIENT_PERMISSIONS');
    });

    it('should call next() when user has permission', () => {
      mockRequest.user = { id: '1', username: 'steward', role: 'STEWARD', email: 'steward@test.com', isActive: true };
      const middleware = requirePermission('APPROVE');
      middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });
  });

  describe('Protected Endpoints', () => {
    it('should protect export endpoints with STEWARD role', () => {
      const protection = getEndpointProtection('/api/ros/export/data');
      expect(protection).toBeDefined();
      expect(protection?.minimumRole).toBe(ROLES.STEWARD);
    });

    it('should protect AI endpoints with RESEARCHER role', () => {
      const protection = getEndpointProtection('/api/ai/generate');
      expect(protection).toBeDefined();
      expect(protection?.minimumRole).toBe(ROLES.RESEARCHER);
    });

    it('should protect admin endpoints with ADMIN role', () => {
      const protection = getEndpointProtection('/api/admin/users');
      expect(protection).toBeDefined();
      expect(protection?.minimumRole).toBe(ROLES.ADMIN);
    });

    it('should protect upload endpoints with ADMIN role', () => {
      const protection = getEndpointProtection('/api/upload/dataset');
      expect(protection).toBeDefined();
      expect(protection?.minimumRole).toBe(ROLES.ADMIN);
    });

    it('should protect governance approval with STEWARD role', () => {
      const protection = getEndpointProtection('/api/governance/approve');
      expect(protection).toBeDefined();
      expect(protection?.minimumRole).toBe(ROLES.STEWARD);
    });

    it('should return null for unprotected endpoints', () => {
      const protection = getEndpointProtection('/api/health');
      expect(protection).toBeNull();
    });
  });

  describe('AI Call Approval Gates', () => {
    it('should deny VIEWER from approving AI calls', () => {
      expect(hasPermissionByRole('VIEWER', 'approve:ai-outputs')).toBe(false);
    });

    it('should deny RESEARCHER from approving AI calls', () => {
      expect(hasPermissionByRole('RESEARCHER', 'approve:ai-outputs')).toBe(false);
    });

    it('should allow STEWARD to approve AI calls', () => {
      expect(hasPermissionByRole('STEWARD', 'approve:ai-outputs')).toBe(true);
    });

    it('should allow ADMIN to approve AI calls', () => {
      expect(hasPermissionByRole('ADMIN', 'approve:ai-outputs')).toBe(true);
    });
  });

  describe('Data Export Gates', () => {
    it('should deny VIEWER from exporting data', () => {
      expect(hasPermissionByRole('VIEWER', 'export:data')).toBe(false);
    });

    it('should deny RESEARCHER from exporting data', () => {
      expect(hasPermissionByRole('RESEARCHER', 'export:data')).toBe(false);
    });

    it('should allow STEWARD to export data', () => {
      expect(hasPermissionByRole('STEWARD', 'export:data')).toBe(true);
    });

    it('should allow ADMIN to export data', () => {
      expect(hasPermissionByRole('ADMIN', 'export:data')).toBe(true);
    });
  });
});
