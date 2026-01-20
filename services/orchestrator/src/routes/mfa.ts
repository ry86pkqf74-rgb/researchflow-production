/**
 * MFA Routes (Task 79)
 *
 * API endpoints for MFA enrollment and verification:
 * - GET /api/mfa/status - Get MFA enrollment status
 * - POST /api/mfa/enroll - Begin MFA enrollment
 * - POST /api/mfa/verify-enrollment - Complete enrollment with first code
 * - POST /api/mfa/verify - Verify MFA code during login
 * - POST /api/mfa/disable - Disable MFA
 * - POST /api/mfa/backup-codes - Regenerate backup codes
 */

import { Router, Request, Response } from 'express';
import { asyncHandler } from '../middleware/asyncHandler';
import { getMfaService, isMfaEnabled } from '../services/mfa-service';
import { logAction } from '../services/audit-service';

const router = Router();

/**
 * Get MFA status for current user
 */
router.get(
  '/status',
  asyncHandler(async (req: Request, res: Response) => {
    const userId = (req.user as any)?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const mfaService = getMfaService();
    const status = await mfaService.getEnrollmentStatus(userId);

    res.json({
      mfaEnabled: isMfaEnabled(),
      userEnrollment: status,
    });
  })
);

/**
 * Begin MFA enrollment
 */
router.post(
  '/enroll',
  asyncHandler(async (req: Request, res: Response) => {
    const userId = (req.user as any)?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    if (!isMfaEnabled()) {
      return res.status(400).json({ error: 'MFA is not enabled on this server' });
    }

    const mfaService = getMfaService();

    // Check if already enrolled
    const status = await mfaService.getEnrollmentStatus(userId);
    if (status.enabled) {
      return res.status(400).json({ error: 'MFA is already enabled for this account' });
    }

    const setup = await mfaService.beginEnrollment(userId);

    // Return setup info
    // NOTE: This is the only time the secret and backup codes are shown
    res.json({
      message: 'MFA enrollment started. Save your backup codes securely.',
      qrCodeUrl: setup.qrCodeUrl,
      manualEntryKey: setup.manualEntryKey,
      backupCodes: setup.backupCodes,
      instructions: [
        '1. Scan the QR code with your authenticator app (Google Authenticator, Authy, etc.)',
        '2. Or manually enter the key if scanning is not available',
        '3. Save your backup codes in a secure location',
        '4. Enter the 6-digit code from your app to complete enrollment',
      ],
    });
  })
);

/**
 * Complete MFA enrollment
 */
router.post(
  '/verify-enrollment',
  asyncHandler(async (req: Request, res: Response) => {
    const userId = (req.user as any)?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { code } = req.body;
    if (!code) {
      return res.status(400).json({ error: 'Verification code is required' });
    }

    const mfaService = getMfaService();
    const result = await mfaService.completeEnrollment(userId, code);

    if (!result.verified) {
      return res.status(400).json({
        error: result.error,
        attemptsRemaining: result.attemptsRemaining,
      });
    }

    res.json({
      message: 'MFA has been successfully enabled for your account',
      enabled: true,
    });
  })
);

/**
 * Verify MFA code (during login or sensitive operations)
 */
router.post(
  '/verify',
  asyncHandler(async (req: Request, res: Response) => {
    const userId = (req.user as any)?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { code } = req.body;
    if (!code) {
      return res.status(400).json({ error: 'Verification code is required' });
    }

    const mfaService = getMfaService();
    const result = await mfaService.verifyCode(userId, code);

    if (!result.verified) {
      const response: Record<string, unknown> = { error: result.error };

      if (result.attemptsRemaining !== undefined) {
        response.attemptsRemaining = result.attemptsRemaining;
      }

      if (result.lockedUntil) {
        response.lockedUntil = result.lockedUntil.toISOString();
        return res.status(423).json(response);
      }

      return res.status(400).json(response);
    }

    res.json({
      verified: true,
      message: 'MFA verification successful',
    });
  })
);

/**
 * Disable MFA
 */
router.post(
  '/disable',
  asyncHandler(async (req: Request, res: Response) => {
    const userId = (req.user as any)?.id;
    const userRole = (req.user as any)?.role;

    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { code, targetUserId } = req.body;

    // Admin can disable for another user
    const effectiveUserId = targetUserId && userRole === 'ADMIN' ? targetUserId : userId;

    if (!code) {
      return res.status(400).json({ error: 'Current MFA code is required to disable MFA' });
    }

    const mfaService = getMfaService();

    // Verify current code first (use requesting user's MFA)
    const verification = await mfaService.verifyCode(userId, code);
    if (!verification.verified) {
      return res.status(400).json({
        error: 'Invalid verification code',
        attemptsRemaining: verification.attemptsRemaining,
      });
    }

    try {
      await mfaService.disableMfa(effectiveUserId, targetUserId ? userId : undefined);

      res.json({
        message: 'MFA has been disabled',
        userId: effectiveUserId,
      });
    } catch (error) {
      return res.status(400).json({
        error: error instanceof Error ? error.message : 'Failed to disable MFA',
      });
    }
  })
);

/**
 * Regenerate backup codes
 */
router.post(
  '/backup-codes',
  asyncHandler(async (req: Request, res: Response) => {
    const userId = (req.user as any)?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { code } = req.body;
    if (!code) {
      return res.status(400).json({ error: 'Current MFA code is required' });
    }

    const mfaService = getMfaService();

    try {
      const newCodes = await mfaService.regenerateBackupCodes(userId, code);

      // This is the only time new backup codes are shown
      res.json({
        message: 'New backup codes generated. Save them securely.',
        backupCodes: newCodes,
        warning: 'Your previous backup codes are no longer valid.',
      });
    } catch (error) {
      return res.status(400).json({
        error: error instanceof Error ? error.message : 'Failed to regenerate backup codes',
      });
    }
  })
);

/**
 * Get backup codes remaining (count only)
 */
router.get(
  '/backup-codes/count',
  asyncHandler(async (req: Request, res: Response) => {
    const userId = (req.user as any)?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const mfaService = getMfaService();
    const status = await mfaService.getEnrollmentStatus(userId);

    res.json({
      backupCodesRemaining: status.backupCodesRemaining,
      warning:
        status.backupCodesRemaining <= 2
          ? 'You are running low on backup codes. Consider regenerating them.'
          : undefined,
    });
  })
);

export default router;
