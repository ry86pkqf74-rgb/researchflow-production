/**
 * Authentication Service
 *
 * Production-ready JWT-based authentication service.
 * Replaces Replit-specific auth for standalone deployments.
 *
 * Features:
 * - JWT token generation and verification
 * - Password hashing with bcrypt
 * - Session management
 * - Refresh token rotation
 *
 * @module services/authService
 */

import { z } from 'zod';
import crypto from 'crypto';
import type { Request, Response, NextFunction, RequestHandler } from 'express';
import type { JwtPayload } from 'jsonwebtoken';

// Import jwt and bcrypt from wrapper module
// This bypasses tsx module resolution issues with CommonJS packages
import { jwt, bcrypt } from '../../lib/crypto-deps.js';

// Import database connection
import { pool } from '../../db.js';

// Environment configuration
const JWT_SECRET = (() => {
  const secret = process.env.JWT_SECRET;

  if (process.env.NODE_ENV === 'production') {
    // In production, JWT_SECRET is REQUIRED
    if (!secret) {
      throw new Error(
        '[SECURITY] FATAL: JWT_SECRET environment variable must be set in production. ' +
        'This is required for secure JWT token signing and verification.'
      );
    }

    // In production, enforce minimum secret length for security
    if (secret.length < 32) {
      throw new Error(
        '[SECURITY] FATAL: JWT_SECRET must be at least 32 characters in production. ' +
        `Current length: ${secret.length} characters. ` +
        'Generate a strong secret using: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"'
      );
    }

    console.log('[SECURITY] JWT_SECRET validation passed: production secret configured');
    return secret;
  }

  // In development, warn if using default secret
  if (!secret) {
    console.warn(
      '[SECURITY] WARNING: Using default JWT_SECRET in development mode. ' +
      'For production, set JWT_SECRET environment variable with at least 32 characters.'
    );
    return 'development-jwt-secret-change-in-production';
  }

  // Development secret was explicitly provided
  return secret;
})();

const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '24h';
const JWT_REFRESH_EXPIRES_IN = process.env.JWT_REFRESH_EXPIRES_IN || '7d';
const BCRYPT_SALT_ROUNDS = 12;

// Admin emails - these users get ADMIN role automatically on registration/login
// Can be set via ADMIN_EMAILS env var (comma-separated) or defaults to known admins
const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || 'logan.glosser@gmail.com')
  .split(',')
  .map(email => email.trim().toLowerCase());

/**
 * Determine role based on email
 * Admin emails get 'ADMIN' role, others get 'RESEARCHER' by default
 * Uses uppercase to match core RBAC types (RoleName)
 */
function getRoleForEmail(email: string): 'ADMIN' | 'RESEARCHER' | 'STEWARD' | 'VIEWER' {
  const normalizedEmail = email.toLowerCase();
  if (ADMIN_EMAILS.includes(normalizedEmail)) {
    return 'ADMIN';
  }
  // Default to RESEARCHER for new users (not VIEWER) so they can use the app
  return 'RESEARCHER';
}

// User schema for validation
// Uses uppercase roles to match core RBAC types (RoleName)
export const UserSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  displayName: z.string().optional(),
  profileImageUrl: z.string().url().optional(),
  role: z.enum(['ADMIN', 'RESEARCHER', 'STEWARD', 'VIEWER']).default('VIEWER'),
  orgId: z.string().uuid().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime()
});

export type User = z.infer<typeof UserSchema>;

// JWT payload schema
export const JWTPayloadSchema = z.object({
  sub: z.string().uuid(),
  email: z.string().email(),
  role: z.string(),
  orgId: z.string().uuid().optional(),
  iat: z.number(),
  exp: z.number()
});

export type JWTPayload = z.infer<typeof JWTPayloadSchema>;

// Registration schema
export const RegisterSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128),
  firstName: z.string().min(1).max(100).optional(),
  lastName: z.string().min(1).max(100).optional()
});

export type RegisterInput = z.infer<typeof RegisterSchema>;

// Login schema
export const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1)
});

export type LoginInput = z.infer<typeof LoginSchema>;

// In-memory user store for development
// In production, use database
const userStore = new Map<string, {
  user: User;
  passwordHash: string;
  refreshTokens: Set<string>;
}>();

// Refresh token store
const refreshTokenStore = new Map<string, {
  userId: string;
  expiresAt: Date;
}>();

/**
 * Hash password using bcrypt
 */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_SALT_ROUNDS);
}

/**
 * Verify password against hash
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

/**
 * Generate JWT access token
 */
export function generateAccessToken(user: User): string {
  const payload = {
    sub: user.id,
    email: user.email,
    role: user.role,
    orgId: user.orgId
  };

  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN,
    issuer: 'researchflow',
    audience: 'researchflow-api'
  });
}

/**
 * Generate refresh token
 */
export function generateRefreshToken(userId: string): string {
  const token = crypto.randomBytes(64).toString('hex');
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7); // 7 days

  refreshTokenStore.set(token, {
    userId,
    expiresAt
  });

  // Add to user's refresh tokens
  const userData = getUserById(userId);
  if (userData) {
    userData.refreshTokens.add(token);
  }

  return token;
}

/**
 * Verify JWT access token
 */
export function verifyAccessToken(token: string): JWTPayload | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET, {
      issuer: 'researchflow',
      audience: 'researchflow-api'
    }) as any;

    return JWTPayloadSchema.parse({
      sub: decoded.sub,
      email: decoded.email,
      role: decoded.role,
      orgId: decoded.orgId,
      iat: decoded.iat,
      exp: decoded.exp
    });
  } catch (error) {
    return null;
  }
}

/**
 * Verify refresh token
 */
export function verifyRefreshToken(token: string): { userId: string } | null {
  const data = refreshTokenStore.get(token);
  if (!data) return null;
  if (data.expiresAt < new Date()) {
    refreshTokenStore.delete(token);
    return null;
  }
  return { userId: data.userId };
}

/**
 * Revoke refresh token
 */
export function revokeRefreshToken(token: string): void {
  const data = refreshTokenStore.get(token);
  if (data) {
    const userData = getUserById(data.userId);
    if (userData) {
      userData.refreshTokens.delete(token);
    }
    refreshTokenStore.delete(token);
  }
}

/**
 * Revoke all refresh tokens for a user
 */
export function revokeAllUserTokens(userId: string): void {
  const userData = getUserById(userId);
  if (userData) {
    for (const token of userData.refreshTokens) {
      refreshTokenStore.delete(token);
    }
    userData.refreshTokens.clear();
  }
}

/**
 * Get user by ID from store
 */
function getUserById(userId: string): typeof userStore extends Map<string, infer V> ? V : never | undefined {
  for (const [, data] of userStore) {
    if (data.user.id === userId) {
      return data;
    }
  }
  return undefined;
}

/**
 * Get user by email
 */
function getUserByEmail(email: string): typeof userStore extends Map<string, infer V> ? V : never | undefined {
  return userStore.get(email.toLowerCase());
}

/**
 * Register a new user
 */
export async function registerUser(input: RegisterInput): Promise<{
  success: boolean;
  user?: User;
  accessToken?: string;
  refreshToken?: string;
  error?: string;
}> {
  const normalizedEmail = input.email.toLowerCase();

  // Check if user exists
  if (userStore.has(normalizedEmail)) {
    return { success: false, error: 'Email already registered' };
  }

  // Hash password
  const passwordHash = await hashPassword(input.password);

  // Create user with appropriate role based on email
  const now = new Date().toISOString();
  const assignedRole = getRoleForEmail(normalizedEmail);
  const user: User = {
    id: crypto.randomUUID(),
    email: normalizedEmail,
    firstName: input.firstName,
    lastName: input.lastName,
    displayName: input.firstName && input.lastName
      ? `${input.firstName} ${input.lastName}`
      : input.firstName || normalizedEmail.split('@')[0],
    role: assignedRole,
    createdAt: now,
    updatedAt: now
  };

  console.log(`[AUTH] User registered: ${normalizedEmail} with role: ${assignedRole}`);

  // Store user in memory
  userStore.set(normalizedEmail, {
    user,
    passwordHash,
    refreshTokens: new Set()
  });

  // Persist user to database
  if (pool) {
    try {
      await pool.query(
        `INSERT INTO users (id, email, first_name, last_name, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (email) DO NOTHING`,
        [
          user.id,
          user.email,
          user.firstName || '',
          user.lastName || '',
          user.createdAt,
          user.updatedAt
        ]
      );
      console.log(`[AUTH] User persisted to database: ${user.id}`);
    } catch (error) {
      console.error(`[AUTH] Failed to persist user to database:`, error);
      // Continue anyway - user is in memory store
    }
  }

  // Generate tokens
  const accessToken = generateAccessToken(user);
  const refreshToken = generateRefreshToken(user.id);

  return {
    success: true,
    user,
    accessToken,
    refreshToken
  };
}

/**
 * Login user
 */
export async function loginUser(input: LoginInput): Promise<{
  success: boolean;
  user?: User;
  accessToken?: string;
  refreshToken?: string;
  error?: string;
}> {
  const normalizedEmail = input.email.toLowerCase();

  const userData = getUserByEmail(normalizedEmail);

  if (!userData) {
    return { success: false, error: 'Invalid email or password' };
  }

  // Verify password
  const isValid = await verifyPassword(input.password, userData.passwordHash);
  if (!isValid) {
    return { success: false, error: 'Invalid email or password' };
  }

  // Generate tokens
  const accessToken = generateAccessToken(userData.user);
  const refreshToken = generateRefreshToken(userData.user.id);

  return {
    success: true,
    user: userData.user,
    accessToken,
    refreshToken
  };
}

/**
 * Refresh access token
 */
export function refreshAccessToken(refreshToken: string): {
  success: boolean;
  accessToken?: string;
  newRefreshToken?: string;
  error?: string;
} {
  const tokenData = verifyRefreshToken(refreshToken);
  if (!tokenData) {
    return { success: false, error: 'Invalid or expired refresh token' };
  }

  const userData = getUserById(tokenData.userId);
  if (!userData) {
    return { success: false, error: 'User not found' };
  }

  // Revoke old refresh token
  revokeRefreshToken(refreshToken);

  // Generate new tokens
  const accessToken = generateAccessToken(userData.user);
  const newRefreshToken = generateRefreshToken(userData.user.id);

  return {
    success: true,
    accessToken,
    newRefreshToken
  };
}

/**
 * Get user from request
 */
export function getUserFromRequest(req: Request): User | null {
  return (req as any).user || null;
}

/**
 * Authentication middleware
 */
export const requireAuth: RequestHandler = (req: Request, res: Response, next: NextFunction) => {
  // Check Authorization header
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'No valid authorization token provided'
    });
  }

  const token = authHeader.substring(7);
  const payload = verifyAccessToken(token);

  if (!payload) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Invalid or expired token'
    });
  }

  // Find user and attach to request
  const userData = getUserById(payload.sub);
  if (!userData) {
    const allowStatelessFallback = process.env.AUTH_ALLOW_STATELESS_JWT === 'true';
    if (!allowStatelessFallback) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'User not found'
      });
    }
    // Fallback to stateless JWT payload when explicitly allowed (dev override)
    (req as any).user = {
      id: payload.sub,
      email: payload.email,
      displayName: payload.email,
      role: payload.role,
      createdAt: new Date(payload.iat * 1000).toISOString(),
      updatedAt: new Date(payload.iat * 1000).toISOString()
    } as User;
  } else {
    (req as any).user = userData.user;
  }
  (req as any).jwtPayload = payload;
  next();
};

/**
 * Optional authentication middleware
 * Attaches user if authenticated, but doesn't require it
 */
export const optionalAuth: RequestHandler = (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    const payload = verifyAccessToken(token);
    if (payload) {
      const userData = getUserById(payload.sub);
      if (userData) {
        (req as any).user = userData.user;
        (req as any).jwtPayload = payload;
      } else {
        const allowStatelessFallback = process.env.AUTH_ALLOW_STATELESS_JWT === 'true';
        if (allowStatelessFallback) {
          // Stateless fallback when explicitly allowed (dev override)
          (req as any).user = {
            id: payload.sub,
            email: payload.email,
            displayName: payload.email,
            role: payload.role,
            createdAt: new Date(payload.iat * 1000).toISOString(),
            updatedAt: new Date(payload.iat * 1000).toISOString()
          } as User;
          (req as any).jwtPayload = payload;
        }
      }
    }
  }
  next();
};

/**
 * Development fallback user
 * Used when in development mode without authentication
 */
export const devFallbackUser: User = {
  id: 'dev-user-00000000-0000-0000-0000-000000000001',
  email: 'dev@researchflow.local',
  firstName: 'Development',
  lastName: 'User',
  displayName: 'Development User',
  role: 'ADMIN',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString()
};

/**
 * Development authentication middleware
 * Uses fallback user in development, requires auth in production
 */
export const devOrRequireAuth: RequestHandler = (req: Request, res: Response, next: NextFunction) => {
  if (process.env.NODE_ENV !== 'production') {
    // Use dev fallback user
    (req as any).user = devFallbackUser;
    return next();
  }

  // In production, require authentication
  return requireAuth(req, res, next);
};

/**
 * Find user by email
 */
async function findUserByEmail(email: string): Promise<{ id: string; email: string; passwordHash: string } | null> {
  try {
    const result = await pool.query(
      'SELECT id, email, password_hash as "passwordHash" FROM users WHERE email = $1',
      [email.toLowerCase()]
    );

    if (result.rows.length === 0) {
      return null;
    }

    return result.rows[0];
  } catch (error) {
    console.error('[Auth] Error finding user by email:', error);
    return null;
  }
}

/**
 * Generate password reset token
 * Returns a secure token that expires in 1 hour
 */
async function generatePasswordResetToken(userId: string): Promise<string> {
  // Generate secure random token
  const resetToken = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

  try {
    // Store token in database
    await pool.query(
      `INSERT INTO password_reset_tokens (user_id, token, expires_at)
       VALUES ($1, $2, $3)
       ON CONFLICT (user_id)
       DO UPDATE SET token = $2, expires_at = $3, created_at = NOW()`,
      [userId, resetToken, expiresAt]
    );

    return resetToken;
  } catch (error) {
    console.error('[Auth] Error generating password reset token:', error);
    throw new Error('Failed to generate reset token');
  }
}

/**
 * Verify password reset token
 * Returns { userId, isExpired, isInvalid } for granular error handling
 */
async function verifyPasswordResetToken(token: string): Promise<{ userId: string | null; isExpired: boolean; isInvalid: boolean }> {
  try {
    const result = await pool.query(
      `SELECT user_id, expires_at
       FROM password_reset_tokens
       WHERE token = $1`,
      [token]
    );

    if (result.rows.length === 0) {
      return { userId: null, isExpired: false, isInvalid: true };
    }

    const { user_id: userId, expires_at: expiresAt } = result.rows[0];

    // Check if token has expired
    if (new Date(expiresAt) < new Date()) {
      // Delete expired token
      await pool.query('DELETE FROM password_reset_tokens WHERE token = $1', [token]);
      return { userId: null, isExpired: true, isInvalid: false };
    }

    return { userId, isExpired: false, isInvalid: false };
  } catch (error) {
    console.error('[Auth] Error verifying password reset token:', error);
    return { userId: null, isExpired: false, isInvalid: true };
  }
}

/**
 * Update user password
 */
async function updatePassword(userId: string, newPassword: string): Promise<void> {
  try {
    // Hash new password
    const passwordHash = await bcrypt.hash(newPassword, 10);

    // Update password in database
    await pool.query(
      'UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2',
      [passwordHash, userId]
    );

    // Delete used reset token
    await pool.query('DELETE FROM password_reset_tokens WHERE user_id = $1', [userId]);
  } catch (error) {
    console.error('[Auth] Error updating password:', error);
    throw new Error('Failed to update password');
  }
}

/**
 * Invalidate all user sessions
 * Revokes all refresh tokens for security after password change
 */
async function invalidateUserSessions(userId: string): Promise<void> {
  try {
    await revokeAllUserTokens(userId);
  } catch (error) {
    console.error('[Auth] Error invalidating user sessions:', error);
    throw new Error('Failed to invalidate sessions');
  }
}

// Export the service
export const authService = {
  hashPassword,
  verifyPassword,
  generateAccessToken,
  generateRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
  revokeRefreshToken,
  revokeAllUserTokens,
  registerUser,
  loginUser,
  refreshAccessToken,
  getUserFromRequest,
  requireAuth,
  optionalAuth,
  devOrRequireAuth,
  devFallbackUser,
  findUserByEmail,
  generatePasswordResetToken,
  verifyPasswordResetToken,
  updatePassword,
  invalidateUserSessions
};

export default authService;
