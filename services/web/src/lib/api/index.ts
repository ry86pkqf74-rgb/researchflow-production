// ============================================
// ResearchFlow API - Main Export
// ============================================
// Re-exports all API services for convenient imports

export { apiClient, type ApiResponse, type ApiError } from './client';
export { analysisApi } from './analysis';
export { versionApi } from './version';
export { authApi } from './auth';

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
