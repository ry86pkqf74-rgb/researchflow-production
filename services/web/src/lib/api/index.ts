// ============================================
// ResearchFlow API - Main Export
// ============================================
// Re-exports all API services for convenient imports

// Core API client
export { apiClient, type ApiResponse, type ApiError, type ClientConfig } from './client';

// API services
export { analysisApi } from './analysis';
export { versionApi } from './version';
export { authApi } from './auth';

// Retry logic
export {
  retryWithBackoff,
  retryableFetch,
  createRetryableFunction,
  isRetryable,
  calculateBackoffDelay,
  Retryable,
  RetryManager,
  useRetry,
  DEFAULT_RETRY_CONFIG,
  type RetryConfig,
  type RetryableError,
  type RetryState,
} from './retry';

// Re-export auth utilities
export {
  getAuthToken,
  getRefreshToken,
  setAuthTokens,
  clearAuthTokens,
  getAuthorizationHeader,
  isTokenExpired,
  isAuthenticated,
  decodeToken,
  getCurrentUser,
  type RefreshTokenRequest,
  type RefreshTokenResponse,
} from './auth';

// Re-export types
export type {
  DescriptiveRequest,
  InferentialRequest,
  RegressionRequest,
  SurvivalRequest,
  AnalysisRunRequest,
  SAPRequest,
  Dataset,
  DatasetSchema,
  AnalysisResult,
  SAPResult,
} from './analysis';

export type {
  CreateProjectRequest,
  Project,
  SaveFileRequest,
  FileContent,
  CommitInfo,
  CommitRequest,
  DiffResult,
  RestoreRequest,
  FileInfo,
} from './version';

export type {
  LoginRequest,
  LoginResponse,
  User,
  MeResponse,
} from './auth';
