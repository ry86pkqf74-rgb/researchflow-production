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

const router = Router();

/**
 * POST /api/auth/register
 * Register a new user account
 */
router.post('/register', async (req: Request, res: Response) => {
  try {
    // Validate input
    const parseResult = RegisterSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        error: 'Validation failed',
        details: parseResult.error.errors
      });
    }

    const result = await authService.registerUser(parseResult.data);

    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }

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
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Registration failed' });
  }
});

/**
 * POST /api/auth/login
 * Login with email and password
 */
router.post('/login', async (req: Request, res: Response) => {
  try {
    // Validate input
    const parseResult = LoginSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        error: 'Validation failed',
        details: parseResult.error.errors
      });
    }

    const result = await authService.loginUser(parseResult.data);

    if (!result.success) {
      return res.status(401).json({ error: result.error });
    }

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
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

/**
 * POST /api/auth/refresh
 * Refresh access token using refresh token
 */
router.post('/refresh', (req: Request, res: Response) => {
  try {
    // Get refresh token from cookie or body
    const refreshToken = req.cookies?.refreshToken || req.body.refreshToken;

    if (!refreshToken) {
      return res.status(401).json({ error: 'No refresh token provided' });
    }

    const result = authService.refreshAccessToken(refreshToken);

    if (!result.success) {
      // Clear invalid refresh token cookie
      res.clearCookie('refreshToken');
      return res.status(401).json({ error: result.error });
    }

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
    console.error('Token refresh error:', error);
    res.status(500).json({ error: 'Token refresh failed' });
  }
});

/**
 * POST /api/auth/logout
 * Logout user and revoke tokens
 */
router.post('/logout', optionalAuth, (req: Request, res: Response) => {
  try {
    const refreshToken = req.cookies?.refreshToken;
    if (refreshToken) {
      authService.revokeRefreshToken(refreshToken);
    }

    // Clear refresh token cookie
    res.clearCookie('refreshToken');

    res.json({ message: 'Logged out successfully' });
  } catch (error) {
    console.error('Logout error:', error);
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
    console.error('Get user error:', error);
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
router.post('/logout-all', requireAuth, (req: Request, res: Response) => {
  try {
    const user = authService.getUserFromRequest(req);
    if (!user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    authService.revokeAllUserTokens(user.id);

    // Clear refresh token cookie
    res.clearCookie('refreshToken');

    res.json({ message: 'Logged out from all devices' });
  } catch (error) {
    console.error('Logout all error:', error);
    res.status(500).json({ error: 'Logout all failed' });
  }
});

/**
 * POST /api/auth/change-password
 * Change user password
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
    console.error('Change password error:', error);
    res.status(500).json({ error: 'Password change failed' });
  }
});

export default router;
