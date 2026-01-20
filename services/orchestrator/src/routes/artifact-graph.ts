/**
 * Artifact Graph Routes
 * 
 * API endpoints for managing artifact provenance graph:
 * - GET /api/ros/artifacts/:artifactId/graph - Get artifact graph
 * - POST /api/ros/artifact-edges - Create edge
 * - DELETE /api/ros/artifact-edges/:edgeId - Delete edge (soft delete)
 * - GET /api/ros/artifact-edges - List edges for research
 */
import { Router, Request, Response } from "express";
import { requireRole, logAuditEvent } from "../middleware/rbac";
import * as artifactGraphService from "../services/artifactGraphService";
import { z } from "zod";

const router = Router();

// Validation schemas
const createEdgeSchema = z.object({
  researchId: z.string().min(1),
  sourceArtifactId: z.string().min(1),
  targetArtifactId: z.string().min(1),
  relationType: z.enum([
    'derived_from',
    'references',
    'supersedes',
    'uses',
    'generated_from',
    'exported_to',
    'annotates'
  ]),
  transformationType: z.string().optional(),
  transformationConfig: z.record(z.unknown()).optional(),
  sourceVersionId: z.string().optional(),
  targetVersionId: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
});

const graphQuerySchema = z.object({
  depth: z.coerce.number().int().min(1).max(10).optional().default(3),
  direction: z.enum(['upstream', 'downstream', 'both']).optional().default('both'),
});

/**
 * GET /api/ros/artifacts/:artifactId/graph
 * Get the artifact graph for a given artifact.
 * RBAC: VIEWER+
 */
router.get(
  "/artifacts/:artifactId/graph",
  requireRole("VIEWER"),
  async (req: Request, res: Response) => {
    try {
      const { artifactId } = req.params;
      const queryResult = graphQuerySchema.safeParse(req.query);
      
      if (!queryResult.success) {
        return res.status(400).json({ 
          error: "Invalid query parameters",
          details: queryResult.error.errors 
        });
      }

      const { depth, direction } = queryResult.data;
      
      const graph = await artifactGraphService.getGraph(artifactId, {
        depth,
        direction,
      });

      res.json(graph);
    } catch (error: any) {
      console.error("[artifact-graph] Error getting graph:", error);
      res.status(500).json({ error: "Failed to get artifact graph" });
    }
  }
);

/**
 * POST /api/ros/artifact-edges
 * Create a new artifact edge.
 * RBAC: RESEARCHER+
 */
router.post(
  "/artifact-edges",
  requireRole("RESEARCHER"),
  async (req: Request, res: Response) => {
    try {
      const parseResult = createEdgeSchema.safeParse(req.body);
      
      if (!parseResult.success) {
        return res.status(400).json({
          error: "Invalid request body",
          details: parseResult.error.errors,
        });
      }

      const params = parseResult.data;
      const result = await artifactGraphService.createEdge(params);

      if (!result.success) {
        return res.status(409).json({ error: result.error });
      }

      // Audit log
      await logAuditEvent({
        eventType: "ARTIFACT_EDGE_CREATE",
        userId: (req as any).user?.id,
        resourceType: "artifact_edge",
        resourceId: result.id,
        action: "create",
        details: {
          sourceArtifactId: params.sourceArtifactId,
          targetArtifactId: params.targetArtifactId,
          relationType: params.relationType,
        },
        researchId: params.researchId,
      });

      res.status(201).json({ id: result.id, success: true });
    } catch (error: any) {
      console.error("[artifact-graph] Error creating edge:", error);
      res.status(500).json({ error: "Failed to create artifact edge" });
    }
  }
);

/**
 * DELETE /api/ros/artifact-edges/:edgeId
 * Soft delete an artifact edge.
 * RBAC: RESEARCHER+
 */
router.delete(
  "/artifact-edges/:edgeId",
  requireRole("RESEARCHER"),
  async (req: Request, res: Response) => {
    try {
      const { edgeId } = req.params;
      
      // Get edge details for audit log
      const edge = await artifactGraphService.getEdge(edgeId);
      if (!edge) {
        return res.status(404).json({ error: "Edge not found" });
      }

      const deleted = await artifactGraphService.deleteEdge(edgeId);
      
      if (!deleted) {
        return res.status(404).json({ error: "Edge not found or already deleted" });
      }

      // Audit log
      await logAuditEvent({
        eventType: "ARTIFACT_EDGE_DELETE",
        userId: (req as any).user?.id,
        resourceType: "artifact_edge",
        resourceId: edgeId,
        action: "delete",
        details: {
          sourceArtifactId: edge.sourceArtifactId,
          targetArtifactId: edge.targetArtifactId,
          relationType: edge.relationType,
        },
      });

      res.json({ success: true });
    } catch (error: any) {
      console.error("[artifact-graph] Error deleting edge:", error);
      res.status(500).json({ error: "Failed to delete artifact edge" });
    }
  }
);

/**
 * GET /api/ros/artifact-edges
 * List edges for a research project.
 * RBAC: VIEWER+
 */
router.get(
  "/artifact-edges",
  requireRole("VIEWER"),
  async (req: Request, res: Response) => {
    try {
      const researchId = req.query.researchId as string;
      const relationType = req.query.relationType as string | undefined;

      if (!researchId) {
        return res.status(400).json({ error: "researchId query parameter is required" });
      }

      const edges = await artifactGraphService.listEdges(researchId, {
        relationType: relationType as any,
      });

      res.json(edges);
    } catch (error: any) {
      console.error("[artifact-graph] Error listing edges:", error);
      res.status(500).json({ error: "Failed to list artifact edges" });
    }
  }
);

/**
 * GET /api/ros/artifact-edges/:edgeId
 * Get a single edge by ID.
 * RBAC: VIEWER+
 */
router.get(
  "/artifact-edges/:edgeId",
  requireRole("VIEWER"),
  async (req: Request, res: Response) => {
    try {
      const { edgeId } = req.params;
      const edge = await artifactGraphService.getEdge(edgeId);

      if (!edge) {
        return res.status(404).json({ error: "Edge not found" });
      }

      res.json(edge);
    } catch (error: any) {
      console.error("[artifact-graph] Error getting edge:", error);
      res.status(500).json({ error: "Failed to get artifact edge" });
    }
  }
);

export default router;
