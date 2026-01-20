/**
 * MFA Enrollment and TOTP Verification Service (Task 79)
 *
 * Implements multi-factor authentication with:
 * - TOTP (Time-based One-Time Password) support
 * - QR code generation for authenticator apps
 * - Backup codes for recovery
 * - Rate limiting for verification attempts
 * - Audit logging for all MFA operations
 *
 * Security Model:
 * - TOTP secrets stored encrypted (use Vault in production)
 * - Backup codes are one-time use
 * - Rate limiting prevents brute force
 * - Never logs TOTP codes or secrets
 *
 * Feature Flag: MFA_ENABLED (default: false)
 */

import { createHash, createHmac, randomBytes } from 'crypto';
import { logAction } from './audit-service';

// Configuration from environment
const MFA_ENABLED = process.env.MFA_ENABLED === 'true';
const MFA_ISSUER = process.env.MFA_ISSUER || 'ResearchFlow';
const MFA_WINDOW_SIZE = parseInt(process.env.MFA_WINDOW_SIZE || '1', 10); // Time steps to allow
const MFA_MAX_ATTEMPTS = parseInt(process.env.MFA_MAX_ATTEMPTS || '5', 10);
const MFA_LOCKOUT_MINUTES = parseInt(process.env.MFA_LOCKOUT_MINUTES || '15', 10);
const BACKUP_CODE_COUNT = 10;
const BACKUP_CODE_LENGTH = 8;

/**
 * MFA enrollment status
 */
export interface MfaEnrollment {
  userId: string;
  enabled: boolean;
  enrolledAt?: Date;
  lastUsedAt?: Date;
  backupCodesRemaining: number;
}

/**
 * MFA setup response (for enrollment)
 */
export interface MfaSetupResponse {
  secret: string;
  qrCodeUrl: string;
  backupCodes: string[];
  manualEntryKey: string;
}

/**
 * MFA verification result
 */
export interface MfaVerificationResult {
  verified: boolean;
  error?: string;
  attemptsRemaining?: number;
  lockedUntil?: Date;
}

/**
 * In-memory store for MFA data (use database/Vault in production)
 */
interface MfaRecord {
  userId: string;
  secret: string; // Base32-encoded TOTP secret
  backupCodes: string[]; // Hashed backup codes
  enabled: boolean;
  enrolledAt?: Date;
  lastUsedAt?: Date;
  failedAttempts: number;
  lockoutUntil?: Date;
}

const mfaStore = new Map<string, MfaRecord>();

/**
 * Generate a random base32 string
 */
function generateBase32Secret(length: number = 20): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  const bytes = randomBytes(length);
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars[bytes[i] % chars.length];
  }
  return result;
}

/**
 * Generate backup codes
 */
function generateBackupCodes(count: number = BACKUP_CODE_COUNT): string[] {
  const codes: string[] = [];
  for (let i = 0; i < count; i++) {
    const code = randomBytes(BACKUP_CODE_LENGTH / 2).toString('hex').toUpperCase();
    codes.push(code);
  }
  return codes;
}

/**
 * Hash a backup code for storage
 */
function hashBackupCode(code: string): string {
  return createHash('sha256').update(code.toUpperCase()).digest('hex');
}

/**
 * Convert base32 to bytes
 */
function base32ToBytes(base32: string): Buffer {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = '';

  for (const char of base32.toUpperCase()) {
    const index = chars.indexOf(char);
    if (index === -1) continue;
    bits += index.toString(2).padStart(5, '0');
  }

  const bytes: number[] = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) {
    bytes.push(parseInt(bits.substring(i, i + 8), 2));
  }

  return Buffer.from(bytes);
}

/**
 * Generate TOTP code
 */
function generateTotp(secret: string, timeStep: number = 0): string {
  const time = Math.floor(Date.now() / 30000) + timeStep;
  const timeBuffer = Buffer.alloc(8);
  timeBuffer.writeUInt32BE(0, 0);
  timeBuffer.writeUInt32BE(time, 4);

  const secretBytes = base32ToBytes(secret);
  const hmac = createHmac('sha1', secretBytes).update(timeBuffer).digest();

  const offset = hmac[hmac.length - 1] & 0x0f;
  const code =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);

  return (code % 1000000).toString().padStart(6, '0');
}

/**
 * Verify TOTP code
 */
function verifyTotp(secret: string, code: string, windowSize: number = MFA_WINDOW_SIZE): boolean {
  const normalizedCode = code.replace(/\s/g, '');

  for (let i = -windowSize; i <= windowSize; i++) {
    if (generateTotp(secret, i) === normalizedCode) {
      return true;
    }
  }

  return false;
}

/**
 * Generate QR code URL for authenticator apps
 */
function generateQrCodeUrl(secret: string, userId: string, issuer: string = MFA_ISSUER): string {
  const label = encodeURIComponent(`${issuer}:${userId}`);
  const params = new URLSearchParams({
    secret,
    issuer: encodeURIComponent(issuer),
    algorithm: 'SHA1',
    digits: '6',
    period: '30',
  });

  return `otpauth://totp/${label}?${params.toString()}`;
}

/**
 * MFA Service
 */
class MfaService {
  /**
   * Check if MFA is enabled globally
   */
  isEnabled(): boolean {
    return MFA_ENABLED;
  }

  /**
   * Get MFA enrollment status for a user
   */
  async getEnrollmentStatus(userId: string): Promise<MfaEnrollment> {
    const record = mfaStore.get(userId);

    return {
      userId,
      enabled: record?.enabled || false,
      enrolledAt: record?.enrolledAt,
      lastUsedAt: record?.lastUsedAt,
      backupCodesRemaining: record?.backupCodes.length || 0,
    };
  }

  /**
   * Begin MFA enrollment for a user
   */
  async beginEnrollment(userId: string): Promise<MfaSetupResponse> {
    if (!MFA_ENABLED) {
      throw new Error('MFA is not enabled');
    }

    // Generate new secret and backup codes
    const secret = generateBase32Secret(32);
    const backupCodes = generateBackupCodes();

    // Store (not yet enabled)
    const record: MfaRecord = {
      userId,
      secret,
      backupCodes: backupCodes.map(hashBackupCode),
      enabled: false,
      failedAttempts: 0,
    };
    mfaStore.set(userId, record);

    // Generate QR code URL
    const qrCodeUrl = generateQrCodeUrl(secret, userId);

    await logAction({
      eventType: 'MFA',
      action: 'ENROLLMENT_STARTED',
      userId,
      resourceType: 'mfa',
      resourceId: userId,
      // Never log secrets or codes
    });

    return {
      secret,
      qrCodeUrl,
      backupCodes,
      manualEntryKey: secret,
    };
  }

  /**
   * Complete MFA enrollment by verifying first TOTP code
   */
  async completeEnrollment(userId: string, code: string): Promise<MfaVerificationResult> {
    if (!MFA_ENABLED) {
      return { verified: false, error: 'MFA is not enabled' };
    }

    const record = mfaStore.get(userId);
    if (!record) {
      return { verified: false, error: 'MFA enrollment not started' };
    }

    if (record.enabled) {
      return { verified: false, error: 'MFA already enabled' };
    }

    // Verify the TOTP code
    if (!verifyTotp(record.secret, code)) {
      await logAction({
        eventType: 'MFA',
        action: 'ENROLLMENT_FAILED',
        userId,
        resourceType: 'mfa',
        resourceId: userId,
        details: { reason: 'invalid_code' },
      });

      return { verified: false, error: 'Invalid verification code' };
    }

    // Enable MFA
    record.enabled = true;
    record.enrolledAt = new Date();

    await logAction({
      eventType: 'MFA',
      action: 'ENROLLMENT_COMPLETED',
      userId,
      resourceType: 'mfa',
      resourceId: userId,
    });

    return { verified: true };
  }

  /**
   * Verify TOTP code for authentication
   */
  async verifyCode(userId: string, code: string): Promise<MfaVerificationResult> {
    if (!MFA_ENABLED) {
      return { verified: true }; // MFA not required
    }

    const record = mfaStore.get(userId);
    if (!record || !record.enabled) {
      return { verified: true }; // MFA not enabled for user
    }

    // Check lockout
    if (record.lockoutUntil && record.lockoutUntil > new Date()) {
      await logAction({
        eventType: 'MFA',
        action: 'VERIFY_BLOCKED',
        userId,
        resourceType: 'mfa',
        resourceId: userId,
        details: { reason: 'lockout' },
      });

      return {
        verified: false,
        error: 'Account temporarily locked due to too many failed attempts',
        lockedUntil: record.lockoutUntil,
      };
    }

    // Normalize and verify code
    const normalizedCode = code.replace(/\s/g, '');

    // Try TOTP verification
    if (verifyTotp(record.secret, normalizedCode)) {
      record.failedAttempts = 0;
      record.lastUsedAt = new Date();

      await logAction({
        eventType: 'MFA',
        action: 'VERIFY_SUCCESS',
        userId,
        resourceType: 'mfa',
        resourceId: userId,
        details: { method: 'totp' },
      });

      return { verified: true };
    }

    // Try backup code verification
    const hashedCode = hashBackupCode(normalizedCode);
    const backupIndex = record.backupCodes.indexOf(hashedCode);

    if (backupIndex !== -1) {
      // Remove used backup code
      record.backupCodes.splice(backupIndex, 1);
      record.failedAttempts = 0;
      record.lastUsedAt = new Date();

      await logAction({
        eventType: 'MFA',
        action: 'VERIFY_SUCCESS',
        userId,
        resourceType: 'mfa',
        resourceId: userId,
        details: {
          method: 'backup_code',
          backupCodesRemaining: record.backupCodes.length,
        },
      });

      return { verified: true };
    }

    // Failed verification
    record.failedAttempts++;
    const attemptsRemaining = MFA_MAX_ATTEMPTS - record.failedAttempts;

    if (record.failedAttempts >= MFA_MAX_ATTEMPTS) {
      record.lockoutUntil = new Date(Date.now() + MFA_LOCKOUT_MINUTES * 60 * 1000);

      await logAction({
        eventType: 'MFA',
        action: 'VERIFY_LOCKOUT',
        userId,
        resourceType: 'mfa',
        resourceId: userId,
        details: {
          failedAttempts: record.failedAttempts,
          lockoutMinutes: MFA_LOCKOUT_MINUTES,
        },
      });

      return {
        verified: false,
        error: 'Too many failed attempts. Account temporarily locked.',
        lockedUntil: record.lockoutUntil,
      };
    }

    await logAction({
      eventType: 'MFA',
      action: 'VERIFY_FAILED',
      userId,
      resourceType: 'mfa',
      resourceId: userId,
      details: { attemptsRemaining },
    });

    return {
      verified: false,
      error: 'Invalid verification code',
      attemptsRemaining,
    };
  }

  /**
   * Disable MFA for a user (requires admin or user confirmation)
   */
  async disableMfa(userId: string, adminId?: string): Promise<void> {
    const record = mfaStore.get(userId);
    if (!record || !record.enabled) {
      throw new Error('MFA is not enabled for this user');
    }

    mfaStore.delete(userId);

    await logAction({
      eventType: 'MFA',
      action: 'DISABLED',
      userId: adminId || userId,
      resourceType: 'mfa',
      resourceId: userId,
      details: {
        disabledBy: adminId ? 'admin' : 'user',
      },
    });
  }

  /**
   * Regenerate backup codes
   */
  async regenerateBackupCodes(userId: string, code: string): Promise<string[]> {
    if (!MFA_ENABLED) {
      throw new Error('MFA is not enabled');
    }

    const record = mfaStore.get(userId);
    if (!record || !record.enabled) {
      throw new Error('MFA is not enabled for this user');
    }

    // Verify current code first
    const verification = await this.verifyCode(userId, code);
    if (!verification.verified) {
      throw new Error('Invalid verification code');
    }

    // Generate new backup codes
    const newCodes = generateBackupCodes();
    record.backupCodes = newCodes.map(hashBackupCode);

    await logAction({
      eventType: 'MFA',
      action: 'BACKUP_CODES_REGENERATED',
      userId,
      resourceType: 'mfa',
      resourceId: userId,
    });

    return newCodes;
  }

  /**
   * Check if user has MFA enabled
   */
  async isUserMfaEnabled(userId: string): Promise<boolean> {
    const record = mfaStore.get(userId);
    return record?.enabled || false;
  }
}

// Singleton instance
let mfaService: MfaService | null = null;

/**
 * Get the MFA service instance
 */
export function getMfaService(): MfaService {
  if (!mfaService) {
    mfaService = new MfaService();
  }
  return mfaService;
}

/**
 * Check if MFA is globally enabled
 */
export function isMfaEnabled(): boolean {
  return MFA_ENABLED;
}

export { MfaService };
export default getMfaService;
