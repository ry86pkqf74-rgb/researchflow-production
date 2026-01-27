// ============================================
// ResearchFlow Authentication API Service
// ============================================
// API functions for authentication endpoints

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
  role: 'admin' | 'researcher' | 'viewer';
  created_at: string;
  last_login?: string;
}

export interface MeResponse {
  success: boolean;
  user: User;
}

// Authentication API functions
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
  refresh: (): Promise<ApiResponse<{ token: string; expires_at: string }>> =>
    apiClient.post('/api/auth/refresh'),

  /**
   * Check if current session is valid
   */
  validate: (): Promise<ApiResponse<{ valid: boolean; user?: User }>> =>
    apiClient.get('/api/auth/validate'),
};
