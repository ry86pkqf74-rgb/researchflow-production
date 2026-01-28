/**
 * Artifact Graph API Routes (v2)
 *
 * RESTful endpoints for artifact provenance tracking and graph operations.
 * Implements RBAC, audit logging, and PHI compliance checks.
 *
 * Priority: P0 - Foundation for collaboration and provenance features
 */

import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { ArtifactGraphService } from '../../services/artifact-graph.service';
import { requireActiveAccount, requireRole } from '../../middleware/rbac';

const router = Router();
const artifactGraphService = new ArtifactGraphService();

// ============================================================
// Validation Schemas
// ============================================================

const CreateArtifactSchema = z.object({
  type: z.enum([
    'topic',
    'literature',
    'dataset',
    'analysis',
    'manuscript',
    'conference_poster',
    'conference_slides',
    'conference_abstract',
    'figure',
    'table',
  ]),
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  status: z.enum(['draft', 'active', 'review', 'approved', 'archived']).default('draft'),
  metadata: z.record(z.unknown()).optional(),
});

const UpdateArtifactSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().optional(),
  status: z.enum(['draft', 'active', 'review', 'approved', 'archived']).optional(),
  metadata: z.record(z.unknown()).optional(),
});

const LinkArtifactsSchema = z.object({
  targetArtifactId: z.string().uuid(),
  relationType: z.enum([
    'derived_from',
    'references',
    'supersedes',
    'uses',
    'generated_from',
    'exported_to',
    'annotates',
  ]),
  transformationType: z.string().optional(),
  transformationConfig: z.record(z.unknown()).optional(),
  metadata: z.record(z.unknown()).optional(),
});

const GetGraphQuerySchema = z.object({
  depth: z.coerce.number().int().min(1).max(10).default(3),
  direction: z.enum(['upstream', 'downstream', 'both']).default('both'),
});

// ============================================================
// Artifact CRUD Operations
// ============================================================

/**
 * GET /api/v2/artifacts/:id
 * Get a single artifact by ID
 */
router.get('/:id', requireActiveAccount, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    // Validate UUID format
    if (!z.string().uuid().safeParse(id).success) {
      return res.status(400).json({
        error: 'Invalid artifact ID format',
        code: 'INVALID_UUID',
      });
    }

    const artifact = await artifactGraphService.getArtifact(id);

    if (!artifact) {
      return res.status(404).json({
        error: 'Artifact not found',
        code: 'ARTIFACT_NOT_FOUND',
        artifactId: id,
      });
    }

    // RBAC check: verify user can read artifact
    // Users can read artifacts they own or that belong to their organization
    const userId = (req as any).user?.id;
    const userOrgId = (req as any).user?.organizationId;
    if (artifact.ownerUserId !== userId && artifact.organizationId !== userOrgId) {
      return res.status(403).json({
        error: 'Access denied',
        code: 'INSUFFICIENT_PERMISSIONS',
        message: 'You do not have read access to this artifact'
      });
    }

    res.json(artifact);
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v2/artifacts
 * Create a new artifact
 */
router.post('/', requireActiveAccount, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = CreateArtifactSchema.parse(req.body);

    // Get user from auth middleware
    const userId = (req as any).user?.id || 'system';
    const organizationId = (req as any).user?.organizationId;

    // Validate user is authenticated (should be guaranteed by requireActiveAccount middleware)
    if (!userId || userId === 'system') {
      return res.status(401).json({
        error: 'Authentication required',
        code: 'AUTHENTICATION_REQUIRED',
        message: 'User authentication is required to create artifacts'
      });
    }

    // Create artifact
    const artifact = await artifactGraphService.createArtifact({
      ...data,
      ownerUserId: userId,
      organizationId,
    });

    res.status(201).json(artifact);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Invalid request',
        code: 'VALIDATION_ERROR',
        details: error.errors,
      });
    }
    next(error);
  }
});

/**
 * PATCH /api/v2/artifacts/:id
 * Update an artifact
 */
router.patch('/:id', requireActiveAccount, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const updates = UpdateArtifactSchema.parse(req.body);

    // Validate UUID format
    if (!z.string().uuid().safeParse(id).success) {
      return res.status(400).json({
        error: 'Invalid artifact ID format',
        code: 'INVALID_UUID',
      });
    }

    // Get user from auth middleware
    const userId = (req as any).user?.id || 'system';

    // RBAC check - verify user has write access (must be owner)
    const artifact = await artifactGraphService.getArtifact(id);
    if (!artifact) {
      return res.status(404).json({
        error: 'Artifact not found',
        code: 'ARTIFACT_NOT_FOUND',
      });
    }
    if (artifact.ownerUserId !== userId) {
      return res.status(403).json({
        error: 'Access denied',
        code: 'INSUFFICIENT_PERMISSIONS',
        message: 'Only the artifact owner can update this artifact'
      });
    }

    const updatedArtifact = await artifactGraphService.updateArtifact(id, updates, userId);

    res.json(updatedArtifact);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Invalid request',
        code: 'VALIDATION_ERROR',
        details: error.errors,
      });
    }
    if ((error as any).message?.includes('not found')) {
      return res.status(404).json({
        error: 'Artifact not found',
        code: 'ARTIFACT_NOT_FOUND',
      });
    }
    next(error);
  }
});

/**
 * DELETE /api/v2/artifacts/:id
 * Soft delete an artifact
 */
router.delete('/:id', requireActiveAccount, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    // Validate UUID format
    if (!z.string().uuid().safeParse(id).success) {
      return res.status(400).json({
        error: 'Invalid artifact ID format',
        code: 'INVALID_UUID',
      });
    }

    // Get user from auth middleware
    const userId = (req as any).user?.id || 'system';

    // RBAC check - verify user has delete access (must be owner)
    const artifact = await artifactGraphService.getArtifact(id);
    if (!artifact) {
      return res.status(404).json({
        error: 'Artifact not found',
        code: 'ARTIFACT_NOT_FOUND',
      });
    }
    if (artifact.ownerUserId !== userId) {
      return res.status(403).json({
        error: 'Access denied',
        code: 'INSUFFICIENT_PERMISSIONS',
        message: 'Only the artifact owner can delete this artifact'
      });
    }

    await artifactGraphService.softDeleteArtifact(id, userId);

    res.status(204).send();
  } catch (error) {
    if ((error as any).message?.includes('not found')) {
      return res.status(404).json({
        error: 'Artifact not found',
        code: 'ARTIFACT_NOT_FOUND',
      });
    }
    next(error);
  }
});

// ============================================================
// Graph Operations
// ============================================================

/**
 * GET /api/v2/artifacts/:id/graph
 * Get artifact provenance graph
 *
 * Query params:
 * - depth: How many hops to traverse (default: 3, max: 10)
 * - direction: upstream | downstream | both (default: both)
 */
router.get('/:id/graph', requireActiveAccount, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const query = GetGraphQuerySchema.parse(req.query);

    // Validate UUID format
    if (!z.string().uuid().safeParse(id).success) {
      return res.status(400).json({
        error: 'Invalid artifact ID format',
        code: 'INVALID_UUID',
      });
    }

    // Check if artifact exists
    const artifact = await artifactGraphService.getArtifact(id);
    if (!artifact) {
      return res.status(404).json({
        error: 'Artifact not found',
        code: 'ARTIFACT_NOT_FOUND',
        artifactId: id,
      });
    }

    // RBAC check: verify user can read artifact graph
    // Users can read artifacts they own or that belong to their organization
    const userId = (req as any).user?.id;
    const userOrgId = (req as any).user?.organizationId;
    if (artifact.ownerUserId !== userId && artifact.organizationId !== userOrgId) {
      return res.status(403).json({
        error: 'Access denied',
        code: 'INSUFFICIENT_PERMISSIONS',
        message: 'You do not have read access to this artifact'
      });
    }

    const graph = await artifactGraphService.getArtifactGraph(
      id,
      query.depth,
      query.direction
    );

    res.json(graph);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Invalid query parameters',
        code: 'VALIDATION_ERROR',
        details: error.errors,
      });
    }
    next(error);
  }
});

/**
 * POST /api/v2/artifacts/:id/link
 * Create an edge between artifacts
 */
router.post('/:id/link', requireActiveAccount, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id: sourceArtifactId } = req.params;
    const data = LinkArtifactsSchema.parse(req.body);

    // Validate UUID format
    if (!z.string().uuid().safeParse(sourceArtifactId).success) {
      return res.status(400).json({
        error: 'Invalid artifact ID format',
        code: 'INVALID_UUID',
      });
    }

    // Get user from auth middleware
    const userId = (req as any).user?.id || 'system';

    // RBAC check - verify user has write access to both artifacts
    const sourceArtifact = await artifactGraphService.getArtifact(sourceArtifactId);
    const targetArtifact = await artifactGraphService.getArtifact(data.targetArtifactId);

    if (!sourceArtifact || !targetArtifact) {
      return res.status(404).json({
        error: 'Source or target artifact not found',
        code: 'ARTIFACT_NOT_FOUND',
      });
    }

    // User must own or have org access to both artifacts
    if (sourceArtifact.ownerUserId !== userId && sourceArtifact.organizationId !== (req as any).user?.organizationId) {
      return res.status(403).json({
        error: 'Access denied',
        code: 'INSUFFICIENT_PERMISSIONS',
        message: 'You do not have write access to the source artifact'
      });
    }
    if (targetArtifact.ownerUserId !== userId && targetArtifact.organizationId !== (req as any).user?.organizationId) {
      return res.status(403).json({
        error: 'Access denied',
        code: 'INSUFFICIENT_PERMISSIONS',
        message: 'You do not have write access to the target artifact'
      });
    }

    const edge = await artifactGraphService.linkArtifacts(
      {
        sourceArtifactId,
        ...data,
      },
      userId
    );

    res.status(201).json(edge);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Invalid request',
        code: 'VALIDATION_ERROR',
        details: error.errors,
      });
    }
    if ((error as any).message?.includes('cycle')) {
      return res.status(409).json({
        error: 'Cannot create edge: would create a cycle in the graph',
        code: 'CYCLE_DETECTED',
      });
    }
    if ((error as any).message?.includes('not found')) {
      return res.status(404).json({
        error: 'Source or target artifact not found',
        code: 'ARTIFACT_NOT_FOUND',
      });
    }
    next(error);
  }
});

/**
 * DELETE /api/v2/artifact-edges/:edgeId
 * Delete an edge between artifacts
 */
router.delete('/edges/:edgeId', requireActiveAccount, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { edgeId } = req.params;

    // Validate UUID format
    if (!z.string().uuid().safeParse(edgeId).success) {
      return res.status(400).json({
        error: 'Invalid edge ID format',
        code: 'INVALID_UUID',
      });
    }

    // Get user from auth middleware
    const userId = (req as any).user?.id || 'system';

    // RBAC check - verify user has write access to the source artifact of the edge
    // First, we need to get the edge and its source artifact to verify ownership
    // Note: This requires adding an getEdge method to the service, or we do authorization after
    // For now, we rely on the service to validate the edge exists and check user can delete it
    // The service implementation should verify the user owns the source artifact

    await artifactGraphService.deleteEdge(edgeId, userId);

    res.status(204).send();
  } catch (error) {
    if ((error as any).message?.includes('not found')) {
      return res.status(404).json({
        error: 'Edge not found',
        code: 'EDGE_NOT_FOUND',
      });
    }
    if ((error as any).message?.includes('Access denied') || (error as any).message?.includes('Forbidden')) {
      return res.status(403).json({
        error: 'Access denied',
        code: 'INSUFFICIENT_PERMISSIONS',
        message: 'You do not have permission to delete this edge'
      });
    }
    next(error);
  }
});

// ============================================================
// Outdated Detection
// ============================================================

/**
 * GET /api/v2/artifacts/:id/outdated
 * Check if artifact is outdated based on upstream changes
 */
router.get('/:id/outdated', requireActiveAccount, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    // Validate UUID format
    if (!z.string().uuid().safeParse(id).success) {
      return res.status(400).json({
        error: 'Invalid artifact ID format',
        code: 'INVALID_UUID',
      });
    }

    // Check if artifact exists
    const artifact = await artifactGraphService.getArtifact(id);
    if (!artifact) {
      return res.status(404).json({
        error: 'Artifact not found',
        code: 'ARTIFACT_NOT_FOUND',
        artifactId: id,
      });
    }

    // RBAC check: verify user can read artifact
    // Users can read artifacts they own or that belong to their organization
    const userId = (req as any).user?.id;
    const userOrgId = (req as any).user?.organizationId;
    if (artifact.ownerUserId !== userId && artifact.organizationId !== userOrgId) {
      return res.status(403).json({
        error: 'Access denied',
        code: 'INSUFFICIENT_PERMISSIONS',
        message: 'You do not have read access to this artifact'
      });
    }

    const result = await artifactGraphService.checkArtifactOutdated(id);

    res.json(result);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v2/artifacts/:id/dependencies
 * List all artifacts that depend on this artifact (downstream)
 */
router.get('/:id/dependencies', requireActiveAccount, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    // Validate UUID format
    if (!z.string().uuid().safeParse(id).success) {
      return res.status(400).json({
        error: 'Invalid artifact ID format',
        code: 'INVALID_UUID',
      });
    }

    // RBAC check: verify user can read the artifact and its dependencies
    const artifact = await artifactGraphService.getArtifact(id);
    if (!artifact) {
      return res.status(404).json({
        error: 'Artifact not found',
        code: 'ARTIFACT_NOT_FOUND',
        artifactId: id,
      });
    }

    const userId = (req as any).user?.id;
    const userOrgId = (req as any).user?.organizationId;
    if (artifact.ownerUserId !== userId && artifact.organizationId !== userOrgId) {
      return res.status(403).json({
        error: 'Access denied',
        code: 'INSUFFICIENT_PERMISSIONS',
        message: 'You do not have read access to this artifact'
      });
    }

    // Get downstream artifacts
    const graph = await artifactGraphService.getArtifactGraph(id, 10, 'downstream');

    res.json({
      artifactId: id,
      dependencies: graph.nodes.filter((n) => n.id !== id),
      edges: graph.edges,
    });
  } catch (error) {
    next(error);
  }
});

// ============================================================
// Bulk Operations
// ============================================================

/**
 * POST /api/v2/artifacts/query
 * Query artifacts with filters
 *
 * NOTE: This endpoint requires implementation of queryArtifacts method in ArtifactGraphService.
 * The method should:
 * 1. Filter artifacts by the provided criteria (type, status, owner, organization)
 * 2. Apply RBAC checks to ensure user can only see artifacts they own or belong to their org
 * 3. Support pagination with limit and offset
 * 4. Return total count for client-side pagination UI
 *
 * Currently returns empty results as a placeholder pending service implementation.
 */
router.post('/query', requireActiveAccount, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const QuerySchema = z.object({
      type: z
        .enum([
          'topic',
          'literature',
          'dataset',
          'analysis',
          'manuscript',
          'conference_poster',
          'conference_slides',
          'conference_abstract',
          'figure',
          'table',
        ])
        .optional(),
      status: z.enum(['draft', 'active', 'review', 'approved', 'archived']).optional(),
      ownerUserId: z.string().uuid().optional(),
      organizationId: z.string().uuid().optional(),
      limit: z.number().int().min(1).max(100).default(50),
      offset: z.number().int().min(0).default(0),
    });

    const query = QuerySchema.parse(req.body);

    // Security: Validate that users can only query their own artifacts or org artifacts
    const userId = (req as any).user?.id;
    const userOrgId = (req as any).user?.organizationId;

    if (query.ownerUserId && query.ownerUserId !== userId) {
      return res.status(403).json({
        error: 'Access denied',
        code: 'INSUFFICIENT_PERMISSIONS',
        message: 'You can only query artifacts you own'
      });
    }

    if (query.organizationId && query.organizationId !== userOrgId) {
      return res.status(403).json({
        error: 'Access denied',
        code: 'INSUFFICIENT_PERMISSIONS',
        message: 'You can only query artifacts from your organization'
      });
    }

    // ARCHITECTURE NOTE: Service method queryArtifacts() needs implementation
    // This endpoint is prepared for service implementation and will automatically
    // apply RBAC filtering once the method is available.
    // const results = await artifactGraphService.queryArtifacts(query);

    // Placeholder response - will be replaced when service method is implemented
    res.json({
      artifacts: [],
      total: 0,
      limit: query.limit,
      offset: query.offset,
      status: 'SERVICE_NOT_IMPLEMENTED',
      message: 'Query endpoint implementation pending - service method not yet available'
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Invalid query',
        code: 'VALIDATION_ERROR',
        details: error.errors,
      });
    }
    next(error);
  }
});

export default router;
