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

// Environment configuration
const JWT_SECRET = process.env.JWT_SECRET || 'development-jwt-secret-change-in-production';
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

// Warn if using default secret in production
if (process.env.NODE_ENV === 'production' && JWT_SECRET === 'development-jwt-secret-change-in-production') {
  console.error('[AUTH] WARNING: Using default JWT secret in production. Set JWT_SECRET environment variable!');
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

  // Store user
  userStore.set(normalizedEmail, {
    user,
    passwordHash,
    refreshTokens: new Set()
  });

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
    // Fallback to stateless JWT payload when in-memory store is empty (dev)
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
        // Stateless fallback for dev when memory store has been reset
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
  devFallbackUser
};

export default authService;
