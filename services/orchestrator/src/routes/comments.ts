/**
 * Comments Routes
 * 
 * API endpoints for managing inline/threaded comments:
 * - POST /api/ros/comments - Create comment (PHI scanned)
 * - GET /api/ros/comments - List comments for artifact
 * - PATCH /api/ros/comments/:id - Update comment body
 * - POST /api/ros/comments/:id/resolve - Resolve comment
 * - POST /api/ros/comments/:id/unresolve - Unresolve comment
 * - POST /api/ros/comments/:id/assign - Assign comment
 * - DELETE /api/ros/comments/:id - Soft delete comment
 */
import { Router, Request, Response } from "express";
import { requireRole, logAuditEvent } from "../middleware/rbac";
import * as commentService from "../services/commentService";
import { z } from "zod";

const router = Router();

// Validation schemas
const anchorDataSchema = z.union([
  // Text selection
  z.object({
    startOffset: z.number().int().min(0),
    endOffset: z.number().int().min(0),
    selectedText: z.string().optional(),
  }),
  // Section
  z.object({
    sectionId: z.string(),
    sectionName: z.string(),
  }),
  // Table cell
  z.object({
    tableId: z.string(),
    row: z.number().int().min(0),
    col: z.number().int().min(0),
  }),
  // Figure region
  z.object({
    figureId: z.string(),
    x: z.number(),
    y: z.number(),
    width: z.number(),
    height: z.number(),
  }),
  // Slide region
  z.object({
    slideIndex: z.number().int().min(0),
    shapeId: z.string().optional(),
    x: z.number().optional(),
    y: z.number().optional(),
  }),
]);

const createCommentSchema = z.object({
  researchId: z.string().min(1),
  artifactId: z.string().min(1),
  versionId: z.string().optional(),
  parentCommentId: z.string().optional(),
  threadId: z.string().optional(),
  anchorType: z.enum([
    'text_selection',
    'entire_section',
    'table_cell',
    'figure_region',
    'slide_region'
  ]),
  anchorData: anchorDataSchema,
  body: z.string().min(1).max(10000),
  assignedTo: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
  overridePhiCheck: z.boolean().optional(),
});

const updateCommentSchema = z.object({
  body: z.string().min(1).max(10000),
  overridePhiCheck: z.boolean().optional(),
});

const listCommentsSchema = z.object({
  artifactId: z.string().min(1),
  status: z.enum(['open', 'resolved', 'all']).optional(),
  threadId: z.string().optional(),
  versionId: z.string().optional(),
});

/**
 * POST /api/ros/comments
 * Create a new comment with PHI scanning.
 * RBAC: RESEARCHER+ (or share token with comment permission)
 */
router.post(
  "/comments",
  requireRole("RESEARCHER"),
  async (req: Request, res: Response) => {
    try {
      const parseResult = createCommentSchema.safeParse(req.body);
      
      if (!parseResult.success) {
        return res.status(400).json({
          error: "Invalid request body",
          details: parseResult.error.errors,
        });
      }

      const params = parseResult.data;
      const userId = (req as any).user?.id;

      // Only stewards can override PHI check
      if (params.overridePhiCheck) {
        const userRole = (req as any).user?.role;
        if (!['STEWARD', 'ADMIN'].includes(userRole)) {
          return res.status(403).json({
            error: "Only stewards or admins can override PHI checks",
          });
        }
      }

      const result = await commentService.createComment({
        ...params,
        createdBy: userId,
      });

      if (!result.success) {
        return res.status(409).json({
          error: result.error,
          phiFindings: result.phiFindings,
        });
      }

      // Audit log
      await logAuditEvent({
        eventType: "COMMENT_CREATE",
        userId,
        resourceType: "comment",
        resourceId: result.comment!.id,
        action: "create",
        details: {
          artifactId: params.artifactId,
          threadId: result.comment!.threadId,
          anchorType: params.anchorType,
        },
        researchId: params.researchId,
      });

      res.status(201).json(result.comment);
    } catch (error: any) {
      console.error("[comments] Error creating comment:", error);
      res.status(500).json({ error: "Failed to create comment" });
    }
  }
);

/**
 * GET /api/ros/comments
 * List comments for an artifact.
 * RBAC: VIEWER+ (or share token with read permission)
 */
router.get(
  "/comments",
  requireRole("VIEWER"),
  async (req: Request, res: Response) => {
    try {
      const parseResult = listCommentsSchema.safeParse(req.query);
      
      if (!parseResult.success) {
        return res.status(400).json({
          error: "Invalid query parameters",
          details: parseResult.error.errors,
        });
      }

      const { artifactId, status, threadId, versionId } = parseResult.data;

      const comments = await commentService.listComments(artifactId, {
        status,
        threadId,
        versionId,
      });

      res.json(comments);
    } catch (error: any) {
      console.error("[comments] Error listing comments:", error);
      res.status(500).json({ error: "Failed to list comments" });
    }
  }
);

/**
 * GET /api/ros/comments/:id
 * Get a single comment.
 * RBAC: VIEWER+
 */
router.get(
  "/comments/:id",
  requireRole("VIEWER"),
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const comment = await commentService.getComment(id);

      if (!comment) {
        return res.status(404).json({ error: "Comment not found" });
      }

      res.json(comment);
    } catch (error: any) {
      console.error("[comments] Error getting comment:", error);
      res.status(500).json({ error: "Failed to get comment" });
    }
  }
);

/**
 * PATCH /api/ros/comments/:id
 * Update comment body (with PHI re-scan).
 * RBAC: RESEARCHER+ (must be creator or steward+)
 */
router.patch(
  "/comments/:id",
  requireRole("RESEARCHER"),
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const parseResult = updateCommentSchema.safeParse(req.body);

      if (!parseResult.success) {
        return res.status(400).json({
          error: "Invalid request body",
          details: parseResult.error.errors,
        });
      }

      const { body, overridePhiCheck } = parseResult.data;
      const userId = (req as any).user?.id;
      const userRole = (req as any).user?.role;

      // Check ownership or steward permission
      const existing = await commentService.getComment(id);
      if (!existing) {
        return res.status(404).json({ error: "Comment not found" });
      }

      if (existing.createdBy !== userId && !['STEWARD', 'ADMIN'].includes(userRole)) {
        return res.status(403).json({ error: "Not authorized to edit this comment" });
      }

      // Only stewards can override PHI check
      if (overridePhiCheck && !['STEWARD', 'ADMIN'].includes(userRole)) {
        return res.status(403).json({
          error: "Only stewards or admins can override PHI checks",
        });
      }

      const result = await commentService.updateComment(id, body, overridePhiCheck);

      if (!result.success) {
        return res.status(409).json({
          error: result.error,
          phiFindings: result.phiFindings,
        });
      }

      // Audit log
      await logAuditEvent({
        eventType: "COMMENT_UPDATE",
        userId,
        resourceType: "comment",
        resourceId: id,
        action: "update",
        details: { artifactId: existing.artifactId },
        researchId: existing.researchId,
      });

      res.json(result.comment);
    } catch (error: any) {
      console.error("[comments] Error updating comment:", error);
      res.status(500).json({ error: "Failed to update comment" });
    }
  }
);

/**
 * POST /api/ros/comments/:id/resolve
 * Resolve a comment thread.
 * RBAC: RESEARCHER+
 */
router.post(
  "/comments/:id/resolve",
  requireRole("RESEARCHER"),
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const userId = (req as any).user?.id;

      const existing = await commentService.getComment(id);
      if (!existing) {
        return res.status(404).json({ error: "Comment not found" });
      }

      const comment = await commentService.resolveComment(id, userId);

      // Audit log
      await logAuditEvent({
        eventType: "COMMENT_RESOLVE",
        userId,
        resourceType: "comment",
        resourceId: id,
        action: "resolve",
        details: { artifactId: existing.artifactId },
        researchId: existing.researchId,
      });

      res.json(comment);
    } catch (error: any) {
      console.error("[comments] Error resolving comment:", error);
      res.status(500).json({ error: "Failed to resolve comment" });
    }
  }
);

/**
 * POST /api/ros/comments/:id/unresolve
 * Unresolve a comment thread.
 * RBAC: RESEARCHER+
 */
router.post(
  "/comments/:id/unresolve",
  requireRole("RESEARCHER"),
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const userId = (req as any).user?.id;

      const existing = await commentService.getComment(id);
      if (!existing) {
        return res.status(404).json({ error: "Comment not found" });
      }

      const comment = await commentService.unresolveComment(id);

      // Audit log
      await logAuditEvent({
        eventType: "COMMENT_UNRESOLVE",
        userId,
        resourceType: "comment",
        resourceId: id,
        action: "unresolve",
        details: { artifactId: existing.artifactId },
        researchId: existing.researchId,
      });

      res.json(comment);
    } catch (error: any) {
      console.error("[comments] Error unresolving comment:", error);
      res.status(500).json({ error: "Failed to unresolve comment" });
    }
  }
);

/**
 * POST /api/ros/comments/:id/assign
 * Assign a comment to a user.
 * RBAC: RESEARCHER+
 */
router.post(
  "/comments/:id/assign",
  requireRole("RESEARCHER"),
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { assignedTo } = req.body;
      const userId = (req as any).user?.id;

      const existing = await commentService.getComment(id);
      if (!existing) {
        return res.status(404).json({ error: "Comment not found" });
      }

      const comment = await commentService.assignComment(id, assignedTo || null);

      // Audit log
      await logAuditEvent({
        eventType: "COMMENT_ASSIGN",
        userId,
        resourceType: "comment",
        resourceId: id,
        action: "assign",
        details: { 
          artifactId: existing.artifactId,
          assignedTo: assignedTo || null,
        },
        researchId: existing.researchId,
      });

      res.json(comment);
    } catch (error: any) {
      console.error("[comments] Error assigning comment:", error);
      res.status(500).json({ error: "Failed to assign comment" });
    }
  }
);

/**
 * DELETE /api/ros/comments/:id
 * Soft delete a comment.
 * RBAC: RESEARCHER+ (must be creator or steward+)
 */
router.delete(
  "/comments/:id",
  requireRole("RESEARCHER"),
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const userId = (req as any).user?.id;
      const userRole = (req as any).user?.role;

      // Check ownership or steward permission
      const existing = await commentService.getComment(id);
      if (!existing) {
        return res.status(404).json({ error: "Comment not found" });
      }

      if (existing.createdBy !== userId && !['STEWARD', 'ADMIN'].includes(userRole)) {
        return res.status(403).json({ error: "Not authorized to delete this comment" });
      }

      const deleted = await commentService.deleteComment(id);

      if (!deleted) {
        return res.status(404).json({ error: "Comment not found or already deleted" });
      }

      // Audit log
      await logAuditEvent({
        eventType: "COMMENT_DELETE",
        userId,
        resourceType: "comment",
        resourceId: id,
        action: "delete",
        details: { artifactId: existing.artifactId },
        researchId: existing.researchId,
      });

      res.json({ success: true });
    } catch (error: any) {
      console.error("[comments] Error deleting comment:", error);
      res.status(500).json({ error: "Failed to delete comment" });
    }
  }
);

export default router;
