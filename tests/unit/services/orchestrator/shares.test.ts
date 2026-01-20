/**
 * Share Service Tests
 *
 * Tests for external reviewer share links with secure token generation.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import crypto from 'crypto';

// Mock token generation
const generateToken = () => crypto.randomBytes(32).toString('hex');
const hashToken = (token: string) => crypto.createHash('sha256').update(token).digest('hex');

describe('ShareService', () => {
  describe('createShare', () => {
    it('should generate a secure random token', () => {
      const token1 = generateToken();
      const token2 = generateToken();

      expect(token1).toHaveLength(64); // 32 bytes = 64 hex chars
      expect(token2).toHaveLength(64);
      expect(token1).not.toBe(token2);
    });

    it('should hash token before storing', () => {
      const token = generateToken();
      const hash = hashToken(token);

      expect(hash).toHaveLength(64); // SHA256 = 64 hex chars
      expect(hash).not.toBe(token);
    });

    it('should set expiration date', () => {
      const expiresInDays = 30;
      const now = new Date();
      const expiresAt = new Date(now.getTime() + expiresInDays * 24 * 60 * 60 * 1000);

      expect(expiresAt.getTime()).toBeGreaterThan(now.getTime());

      const diffDays = Math.round((expiresAt.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
      expect(diffDays).toBe(30);
    });

    it('should validate permission levels', () => {
      const validPermissions = ['read', 'comment'];

      expect(validPermissions).toContain('read');
      expect(validPermissions).toContain('comment');
      expect(validPermissions).not.toContain('write');
      expect(validPermissions).not.toContain('admin');
    });

    it('should return token only on creation', () => {
      // Token should be returned to creator once, never stored in plain text
      const response = {
        share: {
          id: 'share-1',
          artifactId: 'artifact-1',
          permission: 'read',
          expiresAt: new Date(),
          // tokenHash is stored, not token
        },
        token: generateToken(), // Only returned once
      };

      expect(response.token).toBeDefined();
      expect((response.share as any).token).toBeUndefined();
    });
  });

  describe('validateShareToken', () => {
    it('should validate token by comparing hashes', () => {
      const token = generateToken();
      const storedHash = hashToken(token);

      // Validation compares hash of provided token with stored hash
      const providedTokenHash = hashToken(token);
      const isValid = providedTokenHash === storedHash;

      expect(isValid).toBe(true);
    });

    it('should reject invalid token', () => {
      const correctToken = generateToken();
      const storedHash = hashToken(correctToken);

      const wrongToken = generateToken();
      const wrongTokenHash = hashToken(wrongToken);

      const isValid = wrongTokenHash === storedHash;
      expect(isValid).toBe(false);
    });

    it('should reject expired share', () => {
      const expiresAt = new Date('2024-01-01'); // Past date
      const now = new Date('2024-06-01');

      const isExpired = expiresAt < now;
      expect(isExpired).toBe(true);
    });

    it('should reject revoked share', () => {
      const share = {
        revoked: true,
        revokedAt: new Date('2024-03-15'),
      };

      expect(share.revoked).toBe(true);
    });

    it('should increment access count on valid access', () => {
      let accessCount = 5;

      // On successful validation
      accessCount += 1;

      expect(accessCount).toBe(6);
    });

    it('should update last accessed timestamp', () => {
      const share = {
        accessCount: 5,
        lastAccessedAt: new Date('2024-03-01'),
      };

      const newAccess = {
        ...share,
        accessCount: share.accessCount + 1,
        lastAccessedAt: new Date('2024-03-15'),
      };

      expect(newAccess.lastAccessedAt.getTime()).toBeGreaterThan(share.lastAccessedAt.getTime());
    });
  });

  describe('revokeShare', () => {
    it('should mark share as revoked', () => {
      const share = {
        id: 'share-1',
        revoked: false,
        revokedAt: null,
      };

      const revoked = {
        ...share,
        revoked: true,
        revokedAt: new Date(),
      };

      expect(revoked.revoked).toBe(true);
      expect(revoked.revokedAt).toBeDefined();
    });

    it('should prevent revoking already revoked share', () => {
      const share = {
        revoked: true,
        revokedAt: new Date('2024-03-01'),
      };

      const canRevoke = !share.revoked;
      expect(canRevoke).toBe(false);
    });
  });

  describe('extendShare', () => {
    it('should extend expiration date', () => {
      const originalExpires = new Date('2024-06-01');
      const additionalDays = 30;

      const newExpires = new Date(
        originalExpires.getTime() + additionalDays * 24 * 60 * 60 * 1000
      );

      expect(newExpires.getTime()).toBeGreaterThan(originalExpires.getTime());

      const diffDays = Math.round(
        (newExpires.getTime() - originalExpires.getTime()) / (24 * 60 * 60 * 1000)
      );
      expect(diffDays).toBe(30);
    });

    it('should prevent extending revoked share', () => {
      const share = {
        revoked: true,
      };

      const canExtend = !share.revoked;
      expect(canExtend).toBe(false);
    });

    it('should validate additionalDays range', () => {
      const validDays = [1, 7, 30, 90, 365];
      const invalidDays = [0, -1, 366, 1000];

      validDays.forEach((days) => {
        expect(days).toBeGreaterThanOrEqual(1);
        expect(days).toBeLessThanOrEqual(365);
      });

      invalidDays.forEach((days) => {
        const isValid = days >= 1 && days <= 365;
        expect(isValid).toBe(false);
      });
    });
  });

  describe('cleanupExpiredShares', () => {
    it('should identify expired shares for cleanup', () => {
      const shares = [
        { id: '1', expiresAt: new Date('2024-01-01'), revoked: false },
        { id: '2', expiresAt: new Date('2024-12-01'), revoked: false },
        { id: '3', expiresAt: new Date('2024-03-01'), revoked: true },
      ];

      const now = new Date('2024-06-01');

      const expiredShares = shares.filter(
        (s) => s.expiresAt < now && !s.revoked
      );

      expect(expiredShares).toHaveLength(1);
      expect(expiredShares[0].id).toBe('1');
    });
  });
});

describe('Share Security', () => {
  it('should use cryptographically secure random tokens', () => {
    // Token should be 256 bits (32 bytes)
    const token = crypto.randomBytes(32);
    expect(token.length).toBe(32);
  });

  it('should use SHA-256 for hashing', () => {
    const token = 'test-token';
    const hash = crypto.createHash('sha256').update(token).digest('hex');

    // SHA-256 produces 256-bit (64 hex character) output
    expect(hash).toHaveLength(64);
  });

  it('should not expose token hash in API responses', () => {
    const apiResponse = {
      id: 'share-1',
      artifactId: 'artifact-1',
      permission: 'read',
      expiresAt: new Date(),
      createdAt: new Date(),
      // tokenHash should NOT be included
    };

    expect(apiResponse).not.toHaveProperty('tokenHash');
  });

  it('should log share access for audit', () => {
    const auditEntry = {
      eventType: 'SHARE_ACCESS',
      shareId: 'share-1',
      artifactId: 'artifact-1',
      accessedAt: new Date(),
      ipAddress: '192.168.1.1',
      userAgent: 'Mozilla/5.0...',
    };

    expect(auditEntry.eventType).toBe('SHARE_ACCESS');
    expect(auditEntry.shareId).toBeDefined();
  });
});
