/**
 * Version Control Routes
 *
 * Phase 5.5: Git-based version tracking for statistical analysis and manuscripts.
 * Provides REST API for project creation, commits, history, diffs, and file operations.
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { config } from '../config/env';
import { logAction } from '../services/audit-service';
import { asyncHandler } from '../middleware/asyncHandler';
import { requirePermission } from '../middleware/rbac';

const router = Router();

// Worker service URL
const WORKER_URL = config.workerUrl;

// Request schemas
const ProjectCreateSchema = z.object({
  project_id: z.string().min(1).max(100),
  name: z.string().min(1).max(200),
  description: z.string().optional(),
  owner_id: z.string().min(1),
  owner_name: z.string().min(1),
  owner_email: z.string().email(),
});

const CommitMetadataSchema = z.object({
  what_changed: z.string().min(1),
  why_changed: z.string().optional(),
  linked_analysis_id: z.string().optional(),
  linked_manuscript_id: z.string().optional(),
  tags: z.array(z.string()).optional(),
});

const CommitRequestSchema = z.object({
  project_id: z.string().min(1),
  file_paths: z.array(z.string()).min(1),
  message: z.string().min(1),
  metadata: CommitMetadataSchema.optional(),
  author_name: z.string().min(1),
  author_email: z.string().email(),
});

const SaveFileRequestSchema = z.object({
  file_path: z.string().min(1),
  content: z.string(),
  author_name: z.string().min(1),
  author_email: z.string().email(),
  message: z.string().optional(),
  metadata: CommitMetadataSchema.optional(),
  auto_commit: z.boolean().default(true),
});

const DiffRequestSchema = z.object({
  project_id: z.string().min(1),
  file_path: z.string().optional(),
  commit_old: z.string().min(1),
  commit_new: z.string().default('HEAD'),
});

const RestoreRequestSchema = z.object({
  project_id: z.string().min(1),
  file_path: z.string().min(1),
  commit_sha: z.string().min(1),
  create_backup: z.boolean().default(true),
  author_name: z.string().min(1),
  author_email: z.string().email(),
});

const ListFilesRequestSchema = z.object({
  directory: z.string().optional(),
  category: z.enum(['stats', 'manuscripts', 'data', 'outputs', 'config', 'other']).optional(),
});

/**
 * GET /api/version/status
 *
 * Check version control service availability.
 */
router.get(
  '/status',
  asyncHandler(async (_req: Request, res: Response) => {
    try {
      const workerResponse = await fetch(`${WORKER_URL}/api/version/status`, {
        method: 'GET',
        signal: AbortSignal.timeout(5000),
      });

      if (!workerResponse.ok) {
        return res.status(workerResponse.status).json({
          error: 'SERVICE_ERROR',
          message: 'Version control service error',
        });
      }

      const status = await workerResponse.json();
      return res.json(status);
    } catch (error) {
      return res.status(503).json({
        error: 'SERVICE_UNAVAILABLE',
        message: error instanceof Error ? error.message : 'Service unavailable',
      });
    }
  })
);

/**
 * POST /api/version/project/create
 *
 * Create a new version-controlled project.
 */
router.post(
  '/project/create',
  requirePermission('CREATE'),
  asyncHandler(async (req: Request, res: Response) => {
    const parseResult = ProjectCreateSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        error: 'INVALID_REQUEST',
        message: 'Invalid project creation request',
        details: parseResult.error.issues,
      });
    }

    try {
      const workerResponse = await fetch(`${WORKER_URL}/api/version/project/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(parseResult.data),
      });

      if (!workerResponse.ok) {
        const errorText = await workerResponse.text();
        return res.status(workerResponse.status).json({
          error: 'CREATE_FAILED',
          message: errorText,
        });
      }

      const result = await workerResponse.json();

      // Log project creation
      await logAction({
        userId: req.user?.id || parseResult.data.owner_id,
        action: 'CREATE_VERSION_PROJECT',
        resourceType: 'version_project',
        resourceId: parseResult.data.project_id,
        metadata: {
          project_name: parseResult.data.name,
        },
      });

      return res.json(result);
    } catch (error) {
      return res.status(503).json({
        error: 'SERVICE_UNAVAILABLE',
        message: error instanceof Error ? error.message : 'Service unavailable',
      });
    }
  })
);

/**
 * GET /api/version/project/:projectId
 *
 * Get project information.
 */
router.get(
  '/project/:projectId',
  asyncHandler(async (req: Request, res: Response) => {
    const { projectId } = req.params;

    try {
      const workerResponse = await fetch(`${WORKER_URL}/api/version/project/${projectId}`, {
        method: 'GET',
      });

      if (!workerResponse.ok) {
        const errorText = await workerResponse.text();
        return res.status(workerResponse.status).json({
          error: 'NOT_FOUND',
          message: errorText,
        });
      }

      const result = await workerResponse.json();
      return res.json(result);
    } catch (error) {
      return res.status(503).json({
        error: 'SERVICE_UNAVAILABLE',
        message: error instanceof Error ? error.message : 'Service unavailable',
      });
    }
  })
);

/**
 * GET /api/version/projects
 *
 * List all projects.
 */
router.get(
  '/projects',
  asyncHandler(async (_req: Request, res: Response) => {
    try {
      const workerResponse = await fetch(`${WORKER_URL}/api/version/projects`, {
        method: 'GET',
      });

      if (!workerResponse.ok) {
        const errorText = await workerResponse.text();
        return res.status(workerResponse.status).json({
          error: 'LIST_FAILED',
          message: errorText,
        });
      }

      const result = await workerResponse.json();
      return res.json(result);
    } catch (error) {
      return res.status(503).json({
        error: 'SERVICE_UNAVAILABLE',
        message: error instanceof Error ? error.message : 'Service unavailable',
      });
    }
  })
);

/**
 * POST /api/version/commit
 *
 * Create a commit.
 */
router.post(
  '/commit',
  requirePermission('WRITE'),
  asyncHandler(async (req: Request, res: Response) => {
    const parseResult = CommitRequestSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        error: 'INVALID_REQUEST',
        message: 'Invalid commit request',
        details: parseResult.error.issues,
      });
    }

    try {
      const workerResponse = await fetch(`${WORKER_URL}/api/version/commit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(parseResult.data),
      });

      if (!workerResponse.ok) {
        const errorText = await workerResponse.text();
        return res.status(workerResponse.status).json({
          error: 'COMMIT_FAILED',
          message: errorText,
        });
      }

      const result = await workerResponse.json();

      // Log commit
      await logAction({
        userId: req.user?.id || 'anonymous',
        action: 'VERSION_COMMIT',
        resourceType: 'version_project',
        resourceId: parseResult.data.project_id,
        metadata: {
          files_count: parseResult.data.file_paths.length,
          commit_sha: result.commit?.commit_sha,
        },
      });

      return res.json(result);
    } catch (error) {
      return res.status(503).json({
        error: 'SERVICE_UNAVAILABLE',
        message: error instanceof Error ? error.message : 'Service unavailable',
      });
    }
  })
);

/**
 * GET /api/version/history/:projectId
 *
 * Get commit history.
 */
router.get(
  '/history/:projectId',
  asyncHandler(async (req: Request, res: Response) => {
    const { projectId } = req.params;
    const { file_path, limit, offset } = req.query;

    const queryParams = new URLSearchParams();
    if (file_path) queryParams.set('file_path', String(file_path));
    if (limit) queryParams.set('limit', String(limit));
    if (offset) queryParams.set('offset', String(offset));

    try {
      const url = `${WORKER_URL}/api/version/history/${projectId}${queryParams.toString() ? '?' + queryParams.toString() : ''}`;
      const workerResponse = await fetch(url, { method: 'GET' });

      if (!workerResponse.ok) {
        const errorText = await workerResponse.text();
        return res.status(workerResponse.status).json({
          error: 'HISTORY_FAILED',
          message: errorText,
        });
      }

      const result = await workerResponse.json();
      return res.json(result);
    } catch (error) {
      return res.status(503).json({
        error: 'SERVICE_UNAVAILABLE',
        message: error instanceof Error ? error.message : 'Service unavailable',
      });
    }
  })
);

/**
 * POST /api/version/diff
 *
 * Get diff between versions.
 */
router.post(
  '/diff',
  asyncHandler(async (req: Request, res: Response) => {
    const parseResult = DiffRequestSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        error: 'INVALID_REQUEST',
        message: 'Invalid diff request',
        details: parseResult.error.issues,
      });
    }

    try {
      const workerResponse = await fetch(`${WORKER_URL}/api/version/diff`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(parseResult.data),
      });

      if (!workerResponse.ok) {
        const errorText = await workerResponse.text();
        return res.status(workerResponse.status).json({
          error: 'DIFF_FAILED',
          message: errorText,
        });
      }

      const result = await workerResponse.json();
      return res.json(result);
    } catch (error) {
      return res.status(503).json({
        error: 'SERVICE_UNAVAILABLE',
        message: error instanceof Error ? error.message : 'Service unavailable',
      });
    }
  })
);

/**
 * POST /api/version/restore
 *
 * Restore a file to a previous version.
 */
router.post(
  '/restore',
  requirePermission('WRITE'),
  asyncHandler(async (req: Request, res: Response) => {
    const parseResult = RestoreRequestSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        error: 'INVALID_REQUEST',
        message: 'Invalid restore request',
        details: parseResult.error.issues,
      });
    }

    try {
      const workerResponse = await fetch(`${WORKER_URL}/api/version/restore`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(parseResult.data),
      });

      if (!workerResponse.ok) {
        const errorText = await workerResponse.text();
        return res.status(workerResponse.status).json({
          error: 'RESTORE_FAILED',
          message: errorText,
        });
      }

      const result = await workerResponse.json();

      // Log restore
      await logAction({
        userId: req.user?.id || 'anonymous',
        action: 'VERSION_RESTORE',
        resourceType: 'version_project',
        resourceId: parseResult.data.project_id,
        metadata: {
          file_path: parseResult.data.file_path,
          restored_from: parseResult.data.commit_sha,
        },
      });

      return res.json(result);
    } catch (error) {
      return res.status(503).json({
        error: 'SERVICE_UNAVAILABLE',
        message: error instanceof Error ? error.message : 'Service unavailable',
      });
    }
  })
);

/**
 * POST /api/version/file/:projectId
 *
 * Save a file with auto-commit.
 */
router.post(
  '/file/:projectId',
  requirePermission('WRITE'),
  asyncHandler(async (req: Request, res: Response) => {
    const { projectId } = req.params;
    const parseResult = SaveFileRequestSchema.safeParse(req.body);

    if (!parseResult.success) {
      return res.status(400).json({
        error: 'INVALID_REQUEST',
        message: 'Invalid save file request',
        details: parseResult.error.issues,
      });
    }

    try {
      const workerResponse = await fetch(`${WORKER_URL}/api/version/file/${projectId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(parseResult.data),
      });

      if (!workerResponse.ok) {
        const errorText = await workerResponse.text();
        return res.status(workerResponse.status).json({
          error: 'SAVE_FAILED',
          message: errorText,
        });
      }

      const result = await workerResponse.json();

      // Log file save
      await logAction({
        userId: req.user?.id || 'anonymous',
        action: 'VERSION_SAVE_FILE',
        resourceType: 'version_project',
        resourceId: projectId,
        metadata: {
          file_path: parseResult.data.file_path,
          auto_commit: parseResult.data.auto_commit,
        },
      });

      return res.json(result);
    } catch (error) {
      return res.status(503).json({
        error: 'SERVICE_UNAVAILABLE',
        message: error instanceof Error ? error.message : 'Service unavailable',
      });
    }
  })
);

/**
 * GET /api/version/file/:projectId/*
 *
 * Read a file, optionally from specific commit.
 */
router.get(
  '/file/:projectId/*',
  asyncHandler(async (req: Request, res: Response) => {
    const { projectId } = req.params;
    const filePath = req.params[0]; // Wildcard capture
    const { commit_sha } = req.query;

    const queryParams = new URLSearchParams();
    if (commit_sha) queryParams.set('commit_sha', String(commit_sha));

    try {
      const url = `${WORKER_URL}/api/version/file/${projectId}/${filePath}${queryParams.toString() ? '?' + queryParams.toString() : ''}`;
      const workerResponse = await fetch(url, { method: 'GET' });

      if (!workerResponse.ok) {
        const errorText = await workerResponse.text();
        return res.status(workerResponse.status).json({
          error: 'READ_FAILED',
          message: errorText,
        });
      }

      const result = await workerResponse.json();
      return res.json(result);
    } catch (error) {
      return res.status(503).json({
        error: 'SERVICE_UNAVAILABLE',
        message: error instanceof Error ? error.message : 'Service unavailable',
      });
    }
  })
);

/**
 * POST /api/version/files/:projectId
 *
 * List files in a project.
 */
router.post(
  '/files/:projectId',
  asyncHandler(async (req: Request, res: Response) => {
    const { projectId } = req.params;
    const parseResult = ListFilesRequestSchema.safeParse(req.body);

    try {
      const workerResponse = await fetch(`${WORKER_URL}/api/version/files/${projectId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(parseResult.success ? parseResult.data : {}),
      });

      if (!workerResponse.ok) {
        const errorText = await workerResponse.text();
        return res.status(workerResponse.status).json({
          error: 'LIST_FAILED',
          message: errorText,
        });
      }

      const result = await workerResponse.json();
      return res.json(result);
    } catch (error) {
      return res.status(503).json({
        error: 'SERVICE_UNAVAILABLE',
        message: error instanceof Error ? error.message : 'Service unavailable',
      });
    }
  })
);

/**
 * GET /api/version/health
 *
 * Health check for version control service.
 */
router.get('/health', async (_req: Request, res: Response) => {
  let workerStatus = 'unknown';

  try {
    const workerResponse = await fetch(`${WORKER_URL}/api/version/status`, {
      method: 'GET',
      signal: AbortSignal.timeout(5000),
    });
    workerStatus = workerResponse.ok ? 'healthy' : 'unhealthy';
  } catch {
    workerStatus = 'unreachable';
  }

  res.json({
    status: 'healthy',
    service: 'version-control',
    worker_url: WORKER_URL,
    worker_status: workerStatus,
    timestamp: new Date().toISOString(),
  });
});

export default router;
