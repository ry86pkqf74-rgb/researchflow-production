// ============================================
// ResearchFlow Authentication API Service
// ============================================
// API functions for authentication endpoints and auth header injection

import { apiClient, ApiResponse } from './client';

// Types for authentication requests and responses
export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  success: boolean;
  token: string;
  user: User;
  expires_at: string;
}

export interface User {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'researcher' | 'viewer' | 'steward';
  created_at: string;
  last_login?: string;
  organization_id?: string;
}

export interface MeResponse {
  success: boolean;
  user: User;
}

export interface RefreshTokenRequest {
  refresh_token: string;
}

export interface RefreshTokenResponse {
  token: string;
  refresh_token?: string;
  expires_at: string;
}

// ============================================
// Auth Header Injection
// ============================================

/**
 * Get authentication token from storage
 */
export function getAuthToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('authToken') || localStorage.getItem('auth_token');
}

/**
 * Get refresh token from storage
 */
export function getRefreshToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('refreshToken') || localStorage.getItem('refresh_token');
}

/**
 * Store authentication tokens
 */
export function setAuthTokens(
  accessToken: string,
  refreshToken?: string,
  expiresAt?: string
): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem('authToken', accessToken);
  if (refreshToken) {
    localStorage.setItem('refreshToken', refreshToken);
  }
  if (expiresAt) {
    localStorage.setItem('tokenExpiresAt', expiresAt);
  }
}

/**
 * Clear all authentication tokens
 */
export function clearAuthTokens(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem('authToken');
  localStorage.removeItem('auth_token');
  localStorage.removeItem('refreshToken');
  localStorage.removeItem('refresh_token');
  localStorage.removeItem('tokenExpiresAt');
}

/**
 * Build authorization header
 */
export function getAuthorizationHeader(): Record<string, string> {
  const token = getAuthToken();
  if (!token) return {};
  return { 'Authorization': `Bearer ${token}` };
}

/**
 * Check if token is expired
 */
export function isTokenExpired(): boolean {
  if (typeof window === 'undefined') return true;
  const expiresAt = localStorage.getItem('tokenExpiresAt');
  if (!expiresAt) return false;
  return new Date(expiresAt) <= new Date();
}

/**
 * Check if user is authenticated
 */
export function isAuthenticated(): boolean {
  const token = getAuthToken();
  return !!token && !isTokenExpired();
}

/**
 * Decode JWT token (basic implementation)
 */
export function decodeToken(token?: string): Record<string, unknown> | null {
  const t = token || getAuthToken();
  if (!t) return null;

  try {
    const parts = t.split('.');
    if (parts.length !== 3) return null;

    const decoded = JSON.parse(atob(parts[1]));
    return decoded;
  } catch (e) {
    console.error('Failed to decode token:', e);
    return null;
  }
}

/**
 * Get current user from token
 */
export function getCurrentUser(): User | null {
  const decoded = decodeToken();
  if (!decoded || !('user' in decoded)) return null;

  return decoded.user as User;
}

// ============================================
// Authentication API Functions
// ============================================

export const authApi = {
  /**
   * Login with email and password
   */
  login: (credentials: LoginRequest): Promise<ApiResponse<LoginResponse>> =>
    apiClient.post('/api/auth/login', credentials),

  /**
   * Logout (invalidates current token)
   */
  logout: (): Promise<ApiResponse<{ success: boolean }>> =>
    apiClient.post('/api/auth/logout'),

  /**
   * Get current user info
   */
  me: (): Promise<ApiResponse<MeResponse>> =>
    apiClient.get('/api/auth/me'),

  /**
   * Refresh authentication token
   */
  refresh: (refreshToken?: string): Promise<ApiResponse<RefreshTokenResponse>> => {
    const token = refreshToken || getRefreshToken();
    return apiClient.post('/api/auth/refresh', { refresh_token: token });
  },

  /**
   * Check if current session is valid
   */
  validate: (): Promise<ApiResponse<{ valid: boolean; user?: User }>> =>
    apiClient.get('/api/auth/validate'),

  /**
   * Get authorization header for manual header injection
   */
  getAuthHeader: (): Record<string, string> => getAuthorizationHeader(),

  /**
   * Check if user has a specific role
   */
  hasRole: (role: string | string[]): boolean => {
    const user = getCurrentUser();
    if (!user) return false;

    if (Array.isArray(role)) {
      return role.includes(user.role);
    }

    return user.role === role;
  },

  /**
   * Check if user has any of the provided permissions
   */
  hasPermission: (permissions: string | string[]): boolean => {
    const user = getCurrentUser();
    if (!user) return false;

    // Map roles to permissions
    const rolePermissions: Record<string, string[]> = {
      admin: ['*'],
      steward: ['approve', 'review', 'export'],
      researcher: ['submit', 'view'],
      viewer: ['view'],
    };

    const userPermissions = rolePermissions[user.role] || [];
    if (userPermissions.includes('*')) return true;

    if (Array.isArray(permissions)) {
      return permissions.some((p) => userPermissions.includes(p));
    }

    return userPermissions.includes(permissions);
  },
};
