// ============================================
// ResearchFlow Version Control API Service
// ============================================
// API functions for Git-based version control endpoints

import { apiClient, ApiResponse } from './client';

// Types for version control requests and responses
export interface CreateProjectRequest {
  project_id: string;
  name: string;
  owner_id?: string;
  owner_name: string;
  owner_email: string;
  description?: string;
}

export interface Project {
  project_id: string;
  name: string;
  description?: string;
  owner_id: string;
  owner_name: string;
  owner_email: string;
  created_at: string;
  last_modified: string;
  file_count: number;
  commit_count: number;
}

export interface SaveFileRequest {
  file_path: string;
  content: string;
  author_name: string;
  author_email: string;
  message: string;
}

export interface FileContent {
  file_path: string;
  content: string;
  commit_id?: string;
  author?: string;
  date?: string;
}

export interface CommitInfo {
  commit_id: string;
  message: string;
  author_name: string;
  author_email: string;
  timestamp: string;
  files_changed?: string[];
}

export interface CommitRequest {
  project_id: string;
  message: string;
  author_name: string;
  author_email: string;
  files: Array<{
    path: string;
    content: string;
  }>;
}

export interface DiffResult {
  file_path: string;
  commit_old: string;
  commit_new: string;
  diff: string;
  additions: number;
  deletions: number;
}

export interface RestoreRequest {
  file_path: string;
  commit_id: string;
  author_name: string;
  author_email: string;
  message?: string;
}

export interface FileInfo {
  name: string;
  path: string;
  type: 'file' | 'directory';
  size?: number;
  last_modified?: string;
}

// Version Control API functions
export const versionApi = {
  /**
   * Create a new project (initializes Git repo)
   */
  createProject: (data: CreateProjectRequest): Promise<ApiResponse<Project>> =>
    apiClient.post('/api/version/project/create', data),

  /**
   * Get project details
   */
  getProject: (projectId: string): Promise<ApiResponse<Project>> =>
    apiClient.get(`/api/version/project/${projectId}`),

  /**
   * List all projects (optionally filtered by owner)
   */
  listProjects: (ownerId?: string): Promise<ApiResponse<Project[]>> =>
    apiClient.get('/api/version/projects', { owner_id: ownerId }),

  /**
   * Commit changes to multiple files
   */
  commit: (request: CommitRequest): Promise<ApiResponse<CommitInfo>> =>
    apiClient.post('/api/version/commit', request),

  /**
   * Get commit history for a project
   */
  getHistory: (
    projectId: string,
    filePath?: string,
    limit?: number
  ): Promise<ApiResponse<CommitInfo[]>> =>
    apiClient.get(`/api/version/history/${projectId}`, {
      file_path: filePath,
      limit
    }),

  /**
   * Get diff between two commits
   */
  getDiff: (
    projectId: string,
    filePath: string,
    commitOld: string,
    commitNew: string
  ): Promise<ApiResponse<DiffResult>> =>
    apiClient.get(`/api/version/diff/${projectId}`, {
      file_path: filePath,
      commit_old: commitOld,
      commit_new: commitNew
    }),

  /**
   * Get file content (optionally at specific commit)
   */
  getFile: (
    projectId: string,
    filePath: string,
    commitId?: string
  ): Promise<ApiResponse<FileContent>> =>
    apiClient.get(`/api/version/file/${projectId}`, {
      file_path: filePath,
      commit_id: commitId
    }),

  /**
   * Save file with auto-commit
   */
  saveFile: (
    projectId: string,
    data: SaveFileRequest
  ): Promise<ApiResponse<CommitInfo>> =>
    apiClient.post(`/api/version/file/${projectId}`, data),

  /**
   * Restore a file to a previous version
   */
  restoreVersion: (
    projectId: string,
    data: RestoreRequest
  ): Promise<ApiResponse<CommitInfo>> =>
    apiClient.post(`/api/version/restore/${projectId}`, data),

  /**
   * List files in a project directory
   */
  listFiles: (
    projectId: string,
    directory?: string
  ): Promise<ApiResponse<FileInfo[]>> =>
    apiClient.get(`/api/version/files/${projectId}`, { directory }),
};
