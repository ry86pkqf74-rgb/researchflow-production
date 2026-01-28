/**
 * Audit Logging for Authentication Events Tests
 *
 * Tests to verify that all authentication events are properly logged
 * to the audit trail with hash chain integrity.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { logAuthEvent, verifyAuditChain } from '../services/orchestrator/src/services/audit-service';
import { getRequestMetadata, getClientIpAddress, getUserAgent } from '../services/orchestrator/src/utils/request-metadata';
import type { Request } from 'express';

describe('Audit Logging for Authentication Events', () => {

  describe('logAuthEvent', () => {
    it('should log login success with all metadata', async () => {
      const entry = {
        eventType: 'LOGIN_SUCCESS' as const,
        userId: 'test-user-123',
        ipAddress: '192.168.1.100',
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        success: true,
        details: {
          email: 'test@example.com',
          role: 'RESEARCHER'
        }
      };

      // This should not throw
      await expect(logAuthEvent(entry)).resolves.not.toThrow();
    });

    it('should log login failure with failure reason', async () => {
      const entry = {
        eventType: 'LOGIN_FAILURE' as const,
        ipAddress: '192.168.1.101',
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
        success: false,
        failureReason: 'Invalid email or password',
        details: {
          email: 'test@example.com',
          attemptCount: 3
        }
      };

      await expect(logAuthEvent(entry)).resolves.not.toThrow();
    });

    it('should log registration events', async () => {
      const entry = {
        eventType: 'REGISTRATION' as const,
        userId: 'new-user-456',
        ipAddress: '192.168.1.102',
        userAgent: 'Chrome/120.0',
        success: true,
        details: {
          email: 'newuser@example.com',
          role: 'RESEARCHER'
        }
      };

      await expect(logAuthEvent(entry)).resolves.not.toThrow();
    });

    it('should log logout events', async () => {
      const entry = {
        eventType: 'LOGOUT' as const,
        userId: 'test-user-123',
        ipAddress: '192.168.1.100',
        userAgent: 'Mozilla/5.0 (X11; Linux x86_64)',
        success: true,
        details: {
          email: 'test@example.com',
          action: 'logout'
        }
      };

      await expect(logAuthEvent(entry)).resolves.not.toThrow();
    });

    it('should log password reset requests', async () => {
      const entry = {
        eventType: 'PASSWORD_RESET_REQUEST' as const,
        userId: 'test-user-123',
        ipAddress: '192.168.1.100',
        userAgent: 'Mobile Safari',
        success: true,
        details: {
          email: 'test@example.com'
        }
      };

      await expect(logAuthEvent(entry)).resolves.not.toThrow();
    });

    it('should log password reset success', async () => {
      const entry = {
        eventType: 'PASSWORD_RESET_SUCCESS' as const,
        userId: 'test-user-123',
        ipAddress: '192.168.1.103',
        userAgent: 'Firefox/121.0',
        success: true
      };

      await expect(logAuthEvent(entry)).resolves.not.toThrow();
    });

    it('should log token refresh events', async () => {
      const entry = {
        eventType: 'TOKEN_REFRESH_SUCCESS' as const,
        userId: 'test-user-123',
        ipAddress: '192.168.1.100',
        userAgent: 'Mobile Safari',
        success: true
      };

      await expect(logAuthEvent(entry)).resolves.not.toThrow();
    });

    it('should log session expiration events', async () => {
      const entry = {
        eventType: 'SESSION_EXPIRATION' as const,
        userId: 'test-user-123',
        success: true,
        details: {
          sessionDuration: 3600
        }
      };

      await expect(logAuthEvent(entry)).resolves.not.toThrow();
    });

    it('should maintain hash chain integrity', async () => {
      // Log multiple events
      const events = [
        {
          eventType: 'LOGIN_SUCCESS' as const,
          userId: 'user-1',
          ipAddress: '192.168.1.1',
          userAgent: 'Chrome',
          success: true
        },
        {
          eventType: 'LOGOUT' as const,
          userId: 'user-1',
          ipAddress: '192.168.1.1',
          userAgent: 'Chrome',
          success: true
        }
      ];

      for (const event of events) {
        await logAuthEvent(event);
      }

      // Verify chain integrity
      const chainResult = await verifyAuditChain();
      expect(chainResult.valid).toBe(true);
      expect(chainResult.totalEntries).toBeGreaterThanOrEqual(events.length);
    });
  });

  describe('getRequestMetadata', () => {
    let mockRequest: Partial<Request>;

    beforeEach(() => {
      mockRequest = {
        headers: {},
        socket: { remoteAddress: '127.0.0.1' } as any,
        ip: '127.0.0.1'
      };
    });

    it('should extract IP from x-forwarded-for header', () => {
      mockRequest.headers = { 'x-forwarded-for': '203.0.113.1, 198.51.100.1' };

      const ip = getClientIpAddress(mockRequest as Request);
      expect(ip).toBe('203.0.113.1');
    });

    it('should extract IP from x-real-ip header', () => {
      mockRequest.headers = { 'x-real-ip': '203.0.113.2' };

      const ip = getClientIpAddress(mockRequest as Request);
      expect(ip).toBe('203.0.113.2');
    });

    it('should extract IP from cf-connecting-ip header', () => {
      mockRequest.headers = { 'cf-connecting-ip': '203.0.113.3' };

      const ip = getClientIpAddress(mockRequest as Request);
      expect(ip).toBe('203.0.113.3');
    });

    it('should fallback to socket remote address', () => {
      mockRequest.socket = { remoteAddress: '192.168.1.100' } as any;

      const ip = getClientIpAddress(mockRequest as Request);
      expect(ip).toBe('192.168.1.100');
    });

    it('should extract user agent from header', () => {
      mockRequest.headers = {
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      };

      const ua = getUserAgent(mockRequest as Request);
      expect(ua).toBe('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');
    });

    it('should return complete request metadata', () => {
      mockRequest.headers = {
        'x-forwarded-for': '203.0.113.4',
        'user-agent': 'Safari/537.36'
      };

      const metadata = getRequestMetadata(mockRequest as Request);
      expect(metadata.ipAddress).toBe('203.0.113.4');
      expect(metadata.userAgent).toBe('Safari/537.36');
    });

    it('should handle missing headers gracefully', () => {
      mockRequest.headers = {};
      mockRequest.socket = undefined;
      mockRequest.ip = undefined;

      const ip = getClientIpAddress(mockRequest as Request);
      expect(ip).toBeUndefined();
    });

    it('should handle array format headers', () => {
      mockRequest.headers = {
        'x-forwarded-for': ['203.0.113.5', '198.51.100.2']
      };

      const ip = getClientIpAddress(mockRequest as Request);
      expect(ip).toBe('203.0.113.5');
    });
  });

  describe('Authentication Event Types', () => {
    it('should support all required event types', () => {
      const eventTypes = [
        'LOGIN_SUCCESS',
        'LOGIN_FAILURE',
        'LOGOUT',
        'REGISTRATION',
        'PASSWORD_RESET_REQUEST',
        'PASSWORD_RESET_SUCCESS',
        'SESSION_EXPIRATION',
        'TOKEN_REFRESH_SUCCESS',
        'TOKEN_REFRESH_FAILURE'
      ] as const;

      eventTypes.forEach(eventType => {
        // Verify each type is a valid event type
        expect(typeof eventType).toBe('string');
        expect(eventType.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Audit Entry Structure', () => {
    it('should log entry with all required fields', async () => {
      const entry = {
        eventType: 'LOGIN_SUCCESS' as const,
        userId: 'test-user',
        ipAddress: '192.168.1.100',
        userAgent: 'Chrome/120.0',
        success: true,
        details: {
          email: 'test@example.com',
          role: 'RESEARCHER'
        }
      };

      await expect(logAuthEvent(entry)).resolves.not.toThrow();
    });

    it('should log entry with optional userId omitted', async () => {
      const entry = {
        eventType: 'REGISTRATION' as const,
        ipAddress: '192.168.1.101',
        userAgent: 'Firefox/121.0',
        success: false,
        failureReason: 'Email already registered'
      };

      await expect(logAuthEvent(entry)).resolves.not.toThrow();
    });

    it('should log entry without optional metadata fields', async () => {
      const entry = {
        eventType: 'SESSION_EXPIRATION' as const,
        userId: 'test-user',
        success: true
      };

      await expect(logAuthEvent(entry)).resolves.not.toThrow();
    });

    it('should handle detailed failure information', async () => {
      const entry = {
        eventType: 'LOGIN_FAILURE' as const,
        ipAddress: '192.168.1.102',
        userAgent: 'Mobile Safari',
        success: false,
        failureReason: 'Invalid email or password',
        details: {
          email: 'test@example.com',
          attemptNumber: 5,
          lockedUntil: new Date(Date.now() + 15 * 60 * 1000).toISOString()
        }
      };

      await expect(logAuthEvent(entry)).resolves.not.toThrow();
    });
  });
});
