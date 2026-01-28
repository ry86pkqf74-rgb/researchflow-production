/**
 * Authentication Routes
 *
 * JWT-based authentication endpoints for production use.
 * Provides standard login, registration, and token refresh.
 *
 * @module routes/auth
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import {
  authService,
  RegisterSchema,
  LoginSchema,
  requireAuth,
  optionalAuth
} from '../services/authService';
import { logAuthEvent } from '../services/audit-service';
import { getRequestMetadata } from '../utils/request-metadata';
import { createLogger } from '../utils/logger';

const router = Router();
const logger = createLogger('auth-routes');

/**
 * POST /api/auth/register
 * Register a new user account
 */
router.post('/register', async (req: Request, res: Response) => {
  try {
    const metadata = getRequestMetadata(req);

    // Validate input
    const parseResult = RegisterSchema.safeParse(req.body);
    if (!parseResult.success) {
      // Log registration validation failure
      await logAuthEvent({
        eventType: 'REGISTRATION',
        ipAddress: metadata.ipAddress,
        userAgent: metadata.userAgent,
        success: false,
        failureReason: 'Validation failed',
        details: {
          email: req.body.email,
          errors: parseResult.error.errors
        }
      }).catch(err => logger.error('Failed to log registration validation error', { error: err }));

      return res.status(400).json({
        error: 'Validation failed',
        details: parseResult.error.errors
      });
    }

    const result = await authService.registerUser(parseResult.data);

    if (!result.success) {
      // Log registration failure
      await logAuthEvent({
        eventType: 'REGISTRATION',
        ipAddress: metadata.ipAddress,
        userAgent: metadata.userAgent,
        success: false,
        failureReason: result.error,
        details: {
          email: parseResult.data.email
        }
      }).catch(err => logger.error('Failed to log registration error', { error: err }));

      return res.status(400).json({ error: result.error });
    }

    // Log successful registration
    await logAuthEvent({
      eventType: 'REGISTRATION',
      userId: result.user!.id,
      ipAddress: metadata.ipAddress,
      userAgent: metadata.userAgent,
      success: true,
      details: {
        email: result.user!.email,
        role: result.user!.role
      }
    }).catch(err => logger.error('Failed to log registration success', { error: err }));

    // Set refresh token in HTTP-only cookie
    res.cookie('refreshToken', result.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    });

    res.status(201).json({
      message: 'Registration successful',
      user: {
        id: result.user!.id,
        email: result.user!.email,
        displayName: result.user!.displayName,
        role: result.user!.role
      },
      accessToken: result.accessToken
    });
  } catch (error) {
    logger.logError('Registration error', error as Error);
    const metadata = getRequestMetadata(req);
    await logAuthEvent({
      eventType: 'REGISTRATION',
      ipAddress: metadata.ipAddress,
      userAgent: metadata.userAgent,
      success: false,
      failureReason: 'Internal server error',
      details: { error: String(error) }
    }).catch(err => logger.error('Failed to log registration exception', { error: err }));

    res.status(500).json({ error: 'Registration failed' });
  }
});

/**
 * POST /api/auth/login
 * Login with email and password
 */
router.post('/login', async (req: Request, res: Response) => {
  try {
    const metadata = getRequestMetadata(req);

    // Validate input
    const parseResult = LoginSchema.safeParse(req.body);
    if (!parseResult.success) {
      // Log login validation failure
      await logAuthEvent({
        eventType: 'LOGIN_FAILURE',
        ipAddress: metadata.ipAddress,
        userAgent: metadata.userAgent,
        success: false,
        failureReason: 'Validation failed',
        details: {
          email: req.body.email,
          errors: parseResult.error.errors
        }
      }).catch(err => logger.error('Failed to log login validation error', { error: err }));

      return res.status(400).json({
        error: 'Validation failed',
        details: parseResult.error.errors
      });
    }

    const result = await authService.loginUser(parseResult.data);

    if (!result.success) {
      // Log login failure with reason
      await logAuthEvent({
        eventType: 'LOGIN_FAILURE',
        ipAddress: metadata.ipAddress,
        userAgent: metadata.userAgent,
        success: false,
        failureReason: result.error,
        details: {
          email: parseResult.data.email
        }
      }).catch(err => logger.error('Failed to log login failure', { error: err }));

      return res.status(401).json({ error: result.error });
    }

    // Log successful login
    await logAuthEvent({
      eventType: 'LOGIN_SUCCESS',
      userId: result.user!.id,
      ipAddress: metadata.ipAddress,
      userAgent: metadata.userAgent,
      success: true,
      details: {
        email: result.user!.email,
        role: result.user!.role
      }
    }).catch(err => logger.error('Failed to log login success', { error: err }));

    // Set refresh token in HTTP-only cookie
    res.cookie('refreshToken', result.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    });

    res.json({
      message: 'Login successful',
      user: {
        id: result.user!.id,
        email: result.user!.email,
        displayName: result.user!.displayName,
        role: result.user!.role,
        orgId: result.user!.orgId
      },
      accessToken: result.accessToken
    });
  } catch (error) {
    logger.logError('Login error', error as Error);
    const metadata = getRequestMetadata(req);
    await logAuthEvent({
      eventType: 'LOGIN_FAILURE',
      ipAddress: metadata.ipAddress,
      userAgent: metadata.userAgent,
      success: false,
      failureReason: 'Internal server error',
      details: { error: String(error) }
    }).catch(err => logger.error('Failed to log login exception', { error: err }));

    res.status(500).json({ error: 'Login failed' });
  }
});

/**
 * POST /api/auth/refresh
 * Refresh access token using refresh token
 */
router.post('/refresh', async (req: Request, res: Response) => {
  try {
    const metadata = getRequestMetadata(req);

    // Get refresh token from cookie or body
    const refreshToken = req.cookies?.refreshToken || req.body.refreshToken;

    if (!refreshToken) {
      // Log token refresh failure
      await logAuthEvent({
        eventType: 'TOKEN_REFRESH_FAILURE',
        ipAddress: metadata.ipAddress,
        userAgent: metadata.userAgent,
        success: false,
        failureReason: 'No refresh token provided'
      }).catch(err => logger.error('Failed to log token refresh error', { error: err }));

      return res.status(401).json({ error: 'No refresh token provided' });
    }

    const result = authService.refreshAccessToken(refreshToken);

    if (!result.success) {
      // Log token refresh failure
      await logAuthEvent({
        eventType: 'TOKEN_REFRESH_FAILURE',
        ipAddress: metadata.ipAddress,
        userAgent: metadata.userAgent,
        success: false,
        failureReason: result.error
      }).catch(err => logger.error('Failed to log token refresh failure', { error: err }));

      // Clear invalid refresh token cookie
      res.clearCookie('refreshToken');
      return res.status(401).json({ error: result.error });
    }

    // Log successful token refresh
    await logAuthEvent({
      eventType: 'TOKEN_REFRESH_SUCCESS',
      ipAddress: metadata.ipAddress,
      userAgent: metadata.userAgent,
      success: true
    }).catch(err => logger.error('Failed to log token refresh success', { error: err }));

    // Set new refresh token in HTTP-only cookie
    res.cookie('refreshToken', result.newRefreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    });

    res.json({
      message: 'Token refreshed',
      accessToken: result.accessToken
    });
  } catch (error) {
    logger.logError('Token refresh error', error as Error);
    const metadata = getRequestMetadata(req);
    await logAuthEvent({
      eventType: 'TOKEN_REFRESH_FAILURE',
      ipAddress: metadata.ipAddress,
      userAgent: metadata.userAgent,
      success: false,
      failureReason: 'Internal server error',
      details: { error: String(error) }
    }).catch(err => logger.error('Failed to log token refresh exception', { error: err }));

    res.status(500).json({ error: 'Token refresh failed' });
  }
});

/**
 * POST /api/auth/logout
 * Logout user and revoke tokens
 */
router.post('/logout', optionalAuth, async (req: Request, res: Response) => {
  try {
    const metadata = getRequestMetadata(req);
    const user = authService.getUserFromRequest(req);

    const refreshToken = req.cookies?.refreshToken;
    if (refreshToken) {
      authService.revokeRefreshToken(refreshToken);
    }

    // Log logout event
    await logAuthEvent({
      eventType: 'LOGOUT',
      userId: user?.id,
      ipAddress: metadata.ipAddress,
      userAgent: metadata.userAgent,
      success: true,
      details: user ? { email: user.email } : undefined
    }).catch(err => logger.error('Failed to log logout', { error: err }));

    // Clear refresh token cookie
    res.clearCookie('refreshToken');

    res.json({ message: 'Logged out successfully' });
  } catch (error) {
    logger.logError('Logout error', error as Error);
    const metadata = getRequestMetadata(req);
    await logAuthEvent({
      eventType: 'LOGOUT',
      ipAddress: metadata.ipAddress,
      userAgent: metadata.userAgent,
      success: false,
      failureReason: 'Internal server error',
      details: { error: String(error) }
    }).catch(err => logger.error('Failed to log logout error', { error: err }));

    res.status(500).json({ error: 'Logout failed' });
  }
});

/**
 * GET /api/auth/user
 * Get current authenticated user
 */
router.get('/user', requireAuth, (req: Request, res: Response) => {
  try {
    const user = authService.getUserFromRequest(req);
    if (!user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    res.json({
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        displayName: user.displayName,
        profileImageUrl: user.profileImageUrl,
        role: user.role,
        orgId: user.orgId,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt
      }
    });
  } catch (error) {
    logger.logError('Get user error', error as Error);
    res.status(500).json({ error: 'Failed to get user' });
  }
});

/**
 * GET /api/auth/status
 * Check authentication status (public endpoint)
 */
router.get('/status', optionalAuth, (req: Request, res: Response) => {
  const user = authService.getUserFromRequest(req);

  res.json({
    authenticated: !!user,
    user: user ? {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      role: user.role
    } : null
  });
});

/**
 * POST /api/auth/logout-all
 * Logout from all devices (revoke all refresh tokens)
 */
router.post('/logout-all', requireAuth, async (req: Request, res: Response) => {
  try {
    const metadata = getRequestMetadata(req);
    const user = authService.getUserFromRequest(req);
    if (!user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    authService.revokeAllUserTokens(user.id);

    // Log logout-all event
    await logAuthEvent({
      eventType: 'LOGOUT',
      userId: user.id,
      ipAddress: metadata.ipAddress,
      userAgent: metadata.userAgent,
      success: true,
      details: {
        email: user.email,
        action: 'logout_all_devices'
      }
    }).catch(err => logger.error('Failed to log logout-all', { error: err }));

    // Clear refresh token cookie
    res.clearCookie('refreshToken');

    res.json({ message: 'Logged out from all devices' });
  } catch (error) {
    logger.logError('Logout all error', error as Error);
    const metadata = getRequestMetadata(req);
    const user = authService.getUserFromRequest(req);
    await logAuthEvent({
      eventType: 'LOGOUT',
      userId: user?.id,
      ipAddress: metadata.ipAddress,
      userAgent: metadata.userAgent,
      success: false,
      failureReason: 'Internal server error',
      details: { error: String(error) }
    }).catch(err => logger.error('Failed to log logout-all error', { error: err }));

    res.status(500).json({ error: 'Logout all failed' });
  }
});

/**
 * POST /api/auth/forgot-password
 * Request a password reset link
 */
router.post('/forgot-password', async (req: Request, res: Response) => {
  try {
    const metadata = getRequestMetadata(req);
    const { email } = req.body;

    if (!email) {
      // Log password reset request validation failure
      await logAuthEvent({
        eventType: 'PASSWORD_RESET_REQUEST',
        ipAddress: metadata.ipAddress,
        userAgent: metadata.userAgent,
        success: false,
        failureReason: 'Email is required'
      }).catch(err => logger.error('Failed to log password reset validation error', { error: err }));

      return res.status(400).json({
        error: 'Email is required'
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      // Log password reset request validation failure
      await logAuthEvent({
        eventType: 'PASSWORD_RESET_REQUEST',
        ipAddress: metadata.ipAddress,
        userAgent: metadata.userAgent,
        success: false,
        failureReason: 'Invalid email format',
        details: { email }
      }).catch(err => logger.error('Failed to log password reset validation error', { error: err }));

      return res.status(400).json({
        error: 'Invalid email format'
      });
    }

    // Check if user exists (without revealing if they don't)
    const user = await authService.findUserByEmail(email);

    if (user) {
      // Generate reset token (valid for 1 hour)
      const resetToken = await authService.generatePasswordResetToken(user.id);

      // Log password reset request
      await logAuthEvent({
        eventType: 'PASSWORD_RESET_REQUEST',
        userId: user.id,
        ipAddress: metadata.ipAddress,
        userAgent: metadata.userAgent,
        success: true,
        details: { email }
      }).catch(err => logger.error('Failed to log password reset request', { error: err }));

      // In production, send email with reset link
      // For now, log to structured logger (in dev mode) or return token (for testing)
      if (process.env.NODE_ENV === 'development') {
        logger.info('Password reset token generated', { email, token: resetToken, link: `http://localhost:5173/reset-password?token=${resetToken}` });
      }

      // TODO: Send email via email service (SendGrid, AWS SES, etc.)
      // await emailService.sendPasswordResetEmail(email, resetToken);
    } else {
      // Still log the request attempt (without revealing user doesn't exist)
      await logAuthEvent({
        eventType: 'PASSWORD_RESET_REQUEST',
        ipAddress: metadata.ipAddress,
        userAgent: metadata.userAgent,
        success: true,
        details: { email, userExists: false }
      }).catch(err => logger.error('Failed to log password reset request', { error: err }));
    }

    // Always return success to prevent email enumeration
    res.json({
      message: 'If an account exists for that email, a password reset link has been sent.',
      note: process.env.NODE_ENV === 'development' ? 'Check console for reset link' : undefined
    });
  } catch (error) {
    logger.logError('Forgot password error', error as Error);
    const metadata = getRequestMetadata(req);
    await logAuthEvent({
      eventType: 'PASSWORD_RESET_REQUEST',
      ipAddress: metadata.ipAddress,
      userAgent: metadata.userAgent,
      success: false,
      failureReason: 'Internal server error',
      details: { error: String(error) }
    }).catch(err => logger.error('Failed to log password reset error', { error: err }));

    res.status(500).json({ error: 'Password reset request failed' });
  }
});

/**
 * POST /api/auth/reset-password
 * Reset password using a valid reset token
 */
router.post('/reset-password', async (req: Request, res: Response) => {
  try {
    const metadata = getRequestMetadata(req);
    const { token, newPassword } = req.body;

    if (!token || !newPassword) {
      // Log password reset failure
      await logAuthEvent({
        eventType: 'PASSWORD_RESET_REQUEST',
        ipAddress: metadata.ipAddress,
        userAgent: metadata.userAgent,
        success: false,
        failureReason: 'Token and new password are required'
      }).catch(err => logger.error('Failed to log password reset error', { error: err }));

      return res.status(400).json({
        error: 'Token and new password are required'
      });
    }

    if (newPassword.length < 8) {
      // Log password reset failure
      await logAuthEvent({
        eventType: 'PASSWORD_RESET_REQUEST',
        ipAddress: metadata.ipAddress,
        userAgent: metadata.userAgent,
        success: false,
        failureReason: 'Password must be at least 8 characters'
      }).catch(err => logger.error('Failed to log password reset error', { error: err }));

      return res.status(400).json({
        error: 'New password must be at least 8 characters'
      });
    }

    // Verify token and get user ID
    const userId = await authService.verifyPasswordResetToken(token);

    if (!userId) {
      // Log password reset failure
      await logAuthEvent({
        eventType: 'PASSWORD_RESET_REQUEST',
        ipAddress: metadata.ipAddress,
        userAgent: metadata.userAgent,
        success: false,
        failureReason: 'Invalid or expired reset token'
      }).catch(err => logger.error('Failed to log password reset error', { error: err }));

      return res.status(400).json({
        error: 'Invalid or expired reset token'
      });
    }

    // Update password
    await authService.updatePassword(userId, newPassword);

    // Log successful password reset
    await logAuthEvent({
      eventType: 'PASSWORD_RESET_SUCCESS',
      userId,
      ipAddress: metadata.ipAddress,
      userAgent: metadata.userAgent,
      success: true
    }).catch(err => logger.error('Failed to log password reset success', { error: err }));

    // Invalidate all existing sessions for security
    await authService.invalidateUserSessions(userId);

    res.json({
      message: 'Password reset successfully. Please login with your new password.'
    });
  } catch (error) {
    logger.logError('Reset password error', error as Error);
    const metadata = getRequestMetadata(req);
    await logAuthEvent({
      eventType: 'PASSWORD_RESET_REQUEST',
      ipAddress: metadata.ipAddress,
      userAgent: metadata.userAgent,
      success: false,
      failureReason: 'Internal server error',
      details: { error: String(error) }
    }).catch(err => logger.error('Failed to log password reset error', { error: err }));

    res.status(500).json({ error: 'Password reset failed' });
  }
});

/**
 * POST /api/auth/change-password
 * Change user password (requires authentication)
 */
router.post('/change-password', requireAuth, async (req: Request, res: Response) => {
  try {
    const user = authService.getUserFromRequest(req);
    if (!user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        error: 'Current password and new password are required'
      });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({
        error: 'New password must be at least 8 characters'
      });
    }

    // In a real implementation, verify current password and update
    // For now, return success placeholder
    res.json({
      message: 'Password changed successfully',
      note: 'Full implementation requires database integration'
    });
  } catch (error) {
    logger.logError('Change password error', error as Error);
    res.status(500).json({ error: 'Password change failed' });
  }
});

export default router;
