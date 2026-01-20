/**
 * Share Routes
 *
 * API endpoints for external reviewer share links:
 * - POST /api/ros/shares - Create share link
 * - GET /api/ros/shares - List shares for artifact
 * - GET /api/ros/shares/:shareId - Get share details
 * - POST /api/ros/shares/:shareId/revoke - Revoke share
 * - POST /api/ros/shares/:shareId/extend - Extend expiration
 * - GET /api/ros/shares/validate - Validate token (public)
 */
import { Router, Request, Response } from "express";
import { requireRole } from "../middleware/rbac";
import { createAuditEntry } from "../services/auditService";
import * as shareService from "../services/shareService";
import { z } from "zod";

const router = Router();

// Validation schemas
const createShareSchema = z.object({
  artifactId: z.string().min(1),
  permission: z.enum(['read', 'comment']),
  expiresInDays: z.number().int().min(1).max(365).optional(),
  metadata: z.record(z.unknown()).optional(),
});

const extendShareSchema = z.object({
  additionalDays: z.number().int().min(1).max(365),
});

/**
 * POST /api/ros/shares
 * Create a new share link.
 * RBAC: RESEARCHER+
 */
router.post(
  "/shares",
  requireRole("RESEARCHER"),
  async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user?.id || "system";

      const parseResult = createShareSchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({
          error: "Invalid request body",
          details: parseResult.error.errors,
        });
      }

      const params = parseResult.data as shareService.CreateShareParams;

      const result = await shareService.createShare({
        ...params,
        createdBy: userId,
      });

      if (!result.success) {
        return res.status(404).json({ error: result.error });
      }

      // Audit log
      await createAuditEntry({
        eventType: "SHARE_CREATE",
        userId,
        resourceType: "artifact_share",
        resourceId: result.share!.id,
        action: "create",
        details: {
          artifactId: params.artifactId,
          permission: params.permission,
          expiresAt: result.share!.expiresAt?.toISOString(),
        },
      });

      res.status(201).json(result.share);
    } catch (error: any) {
      console.error("[shares] Error creating share:", error);
      res.status(500).json({ error: "Failed to create share link" });
    }
  }
);

/**
 * GET /api/ros/shares
 * List shares for an artifact.
 * RBAC: RESEARCHER+
 */
router.get(
  "/shares",
  requireRole("RESEARCHER"),
  async (req: Request, res: Response) => {
    try {
      const { artifactId } = req.query;

      if (!artifactId) {
        return res.status(400).json({ error: "artifactId is required" });
      }

      const shares = await shareService.listShares(artifactId as string);

      res.json({ shares, count: shares.length });
    } catch (error: any) {
      console.error("[shares] Error listing shares:", error);
      res.status(500).json({ error: "Failed to list shares" });
    }
  }
);

/**
 * GET /api/ros/shares/validate
 * Validate a share token (public endpoint - no auth required).
 * Used by external reviewers to verify their link.
 */
router.get(
  "/shares/validate",
  async (req: Request, res: Response) => {
    try {
      const { token } = req.query;

      if (!token || typeof token !== 'string') {
        return res.status(400).json({ error: "token is required" });
      }

      const result = await shareService.validateShareToken(token);

      if (!result.valid) {
        return res.status(401).json({ error: result.error });
      }

      res.json(result.share);
    } catch (error: any) {
      console.error("[shares] Error validating token:", error);
      res.status(500).json({ error: "Failed to validate share token" });
    }
  }
);

/**
 * GET /api/ros/shares/:shareId
 * Get share details.
 * RBAC: RESEARCHER+
 */
router.get(
  "/shares/:shareId",
  requireRole("RESEARCHER"),
  async (req: Request, res: Response) => {
    try {
      const { shareId } = req.params;

      const share = await shareService.getShare(shareId);

      if (!share) {
        return res.status(404).json({ error: "Share not found" });
      }

      res.json(share);
    } catch (error: any) {
      console.error("[shares] Error getting share:", error);
      res.status(500).json({ error: "Failed to get share" });
    }
  }
);

/**
 * POST /api/ros/shares/:shareId/revoke
 * Revoke a share link.
 * RBAC: RESEARCHER+
 */
router.post(
  "/shares/:shareId/revoke",
  requireRole("RESEARCHER"),
  async (req: Request, res: Response) => {
    try {
      const { shareId } = req.params;
      const userId = (req as any).user?.id || "system";

      const existing = await shareService.getShare(shareId);
      if (!existing) {
        return res.status(404).json({ error: "Share not found" });
      }

      const revoked = await shareService.revokeShare(shareId);

      if (!revoked) {
        return res.status(400).json({ error: "Share already revoked" });
      }

      // Audit log
      await createAuditEntry({
        eventType: "SHARE_REVOKE",
        userId,
        resourceType: "artifact_share",
        resourceId: shareId,
        action: "revoke",
        details: { artifactId: existing.artifactId },
      });

      res.json({ success: true });
    } catch (error: any) {
      console.error("[shares] Error revoking share:", error);
      res.status(500).json({ error: "Failed to revoke share" });
    }
  }
);

/**
 * POST /api/ros/shares/:shareId/extend
 * Extend a share's expiration.
 * RBAC: RESEARCHER+
 */
router.post(
  "/shares/:shareId/extend",
  requireRole("RESEARCHER"),
  async (req: Request, res: Response) => {
    try {
      const { shareId } = req.params;
      const userId = (req as any).user?.id || "system";

      const parseResult = extendShareSchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({
          error: "Invalid request body",
          details: parseResult.error.errors,
        });
      }

      const { additionalDays } = parseResult.data;

      const existing = await shareService.getShare(shareId);
      if (!existing) {
        return res.status(404).json({ error: "Share not found" });
      }

      const updated = await shareService.extendShare(shareId, additionalDays);

      if (!updated) {
        return res.status(400).json({ error: "Cannot extend revoked share" });
      }

      // Audit log
      await createAuditEntry({
        eventType: "SHARE_EXTEND",
        userId,
        resourceType: "artifact_share",
        resourceId: shareId,
        action: "extend",
        details: {
          artifactId: existing.artifactId,
          additionalDays,
          newExpiresAt: updated.expiresAt?.toISOString(),
        },
      });

      res.json(updated);
    } catch (error: any) {
      console.error("[shares] Error extending share:", error);
      res.status(500).json({ error: "Failed to extend share" });
    }
  }
);

export default router;
