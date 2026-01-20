/**
 * Artifact Versions Routes
 * 
 * API endpoints for version management:
 * - GET /api/ros/artifacts/:artifactId/versions - List versions
 * - POST /api/ros/artifacts/:artifactId/versions - Create version
 * - POST /api/ros/artifacts/:artifactId/compare - Compare versions
 * - POST /api/ros/artifacts/:artifactId/restore/:versionId - Restore version
 * - GET /api/ros/artifacts/:artifactId/versions/:versionId/diff - Get diff
 */
import { Router, Request, Response } from "express";
import { requireRole } from "../middleware/rbac";
import { createAuditEntry } from "../services/auditService";
import { db } from "../../db";
import { artifacts, artifactVersions } from "@researchflow/core/schema";
import { eq, and, desc } from "drizzle-orm";
import { nanoid } from "nanoid";
import { createHash } from "crypto";
import * as diffService from "../services/diffService";
import { z } from "zod";

const router = Router();

// Validation schemas
const createVersionSchema = z.object({
  content: z.string().min(1),
  changeDescription: z.string().min(1).max(500),
  branch: z.string().max(100).optional().default('main'),
  parentVersionId: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
});

const compareVersionsSchema = z.object({
  fromVersionId: z.string().min(1),
  toVersionId: z.string().min(1),
  includeText: z.boolean().optional().default(false),
});

const listVersionsSchema = z.object({
  branch: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional().default(50),
  offset: z.coerce.number().int().min(0).optional().default(0),
});

/**
 * GET /api/ros/artifacts/:artifactId/versions
 * List versions for an artifact.
 * RBAC: VIEWER+
 */
router.get(
  "/artifacts/:artifactId/versions",
  requireRole("VIEWER"),
  async (req: Request, res: Response) => {
    try {
      const { artifactId } = req.params;
      const parseResult = listVersionsSchema.safeParse(req.query);

      if (!parseResult.success) {
        return res.status(400).json({
          error: "Invalid query parameters",
          details: parseResult.error.errors,
        });
      }

      const { branch, limit, offset } = parseResult.data;

      let query = db
        .select({
          id: artifactVersions.id,
          artifactId: artifactVersions.artifactId,
          versionNumber: artifactVersions.versionNumber,
          sizeBytes: artifactVersions.sizeBytes,
          sha256Hash: artifactVersions.sha256Hash,
          createdBy: artifactVersions.createdBy,
          changeDescription: artifactVersions.changeDescription,
          branch: artifactVersions.branch,
          parentVersionId: artifactVersions.parentVersionId,
          metadata: artifactVersions.metadata,
          createdAt: artifactVersions.createdAt,
        })
        .from(artifactVersions)
        .where(eq(artifactVersions.artifactId, artifactId))
        .orderBy(desc(artifactVersions.versionNumber))
        .limit(limit)
        .offset(offset);

      const rows = await query;

      // Filter by branch if specified
      const filtered = branch 
        ? rows.filter(r => r.branch === branch)
        : rows;

      res.json({
        versions: filtered,
        total: rows.length,
        limit,
        offset,
      });
    } catch (error: any) {
      console.error("[artifact-versions] Error listing versions:", error);
      res.status(500).json({ error: "Failed to list versions" });
    }
  }
);

/**
 * GET /api/ros/artifacts/:artifactId/versions/:versionId
 * Get a specific version (without content by default).
 * RBAC: VIEWER+
 */
router.get(
  "/artifacts/:artifactId/versions/:versionId",
  requireRole("VIEWER"),
  async (req: Request, res: Response) => {
    try {
      const { artifactId, versionId } = req.params;
      const includeContent = req.query.includeContent === 'true';

      const [version] = await db
        .select()
        .from(artifactVersions)
        .where(and(
          eq(artifactVersions.id, versionId),
          eq(artifactVersions.artifactId, artifactId)
        ))
        .limit(1);

      if (!version) {
        return res.status(404).json({ error: "Version not found" });
      }

      const result: any = {
        id: version.id,
        artifactId: version.artifactId,
        versionNumber: version.versionNumber,
        sizeBytes: version.sizeBytes,
        sha256Hash: version.sha256Hash,
        createdBy: version.createdBy,
        changeDescription: version.changeDescription,
        branch: version.branch,
        parentVersionId: version.parentVersionId,
        metadata: version.metadata,
        createdAt: version.createdAt,
      };

      if (includeContent) {
        result.content = version.content;
      }

      res.json(result);
    } catch (error: any) {
      console.error("[artifact-versions] Error getting version:", error);
      res.status(500).json({ error: "Failed to get version" });
    }
  }
);

/**
 * POST /api/ros/artifacts/:artifactId/versions
 * Create a new version.
 * RBAC: RESEARCHER+
 */
router.post(
  "/artifacts/:artifactId/versions",
  requireRole("RESEARCHER"),
  async (req: Request, res: Response) => {
    try {
      const { artifactId } = req.params;
      const parseResult = createVersionSchema.safeParse(req.body);

      if (!parseResult.success) {
        return res.status(400).json({
          error: "Invalid request body",
          details: parseResult.error.errors,
        });
      }

      const { content, changeDescription, branch, parentVersionId, metadata } = parseResult.data;
      const userId = (req as any).user?.id;

      // Verify artifact exists
      const [artifact] = await db
        .select()
        .from(artifacts)
        .where(eq(artifacts.id, artifactId))
        .limit(1);

      if (!artifact) {
        return res.status(404).json({ error: "Artifact not found" });
      }

      // Get next version number for this branch
      const [latestVersion] = await db
        .select({ versionNumber: artifactVersions.versionNumber })
        .from(artifactVersions)
        .where(eq(artifactVersions.artifactId, artifactId))
        .orderBy(desc(artifactVersions.versionNumber))
        .limit(1);

      const nextVersionNumber = (latestVersion?.versionNumber || 0) + 1;

      // Compute hash and size
      const contentBuffer = Buffer.from(content, 'utf-8');
      const sha256Hash = createHash('sha256').update(contentBuffer).digest('hex');
      const sizeBytes = contentBuffer.length;

      const versionId = nanoid();

      await db.insert(artifactVersions).values({
        id: versionId,
        artifactId,
        versionNumber: nextVersionNumber,
        content,
        sizeBytes,
        sha256Hash,
        createdBy: userId,
        changeDescription,
        branch,
        parentVersionId: parentVersionId || null,
        metadata: metadata || {},
      });

      // Update artifact's current version if this is main branch
      if (branch === 'main') {
        await db
          .update(artifacts)
          .set({ currentVersionId: versionId })
          .where(eq(artifacts.id, artifactId));
      }

      // Audit log
      await createAuditEntry({
        eventType: "ARTIFACT_VERSION_CREATE",
        userId,
        resourceType: "artifact_version",
        resourceId: versionId,
        action: "create",
        details: {
          artifactId,
          versionNumber: nextVersionNumber,
          branch,
          sizeBytes,
          researchId: artifact.researchId,
        },
      });

      res.status(201).json({
        id: versionId,
        artifactId,
        versionNumber: nextVersionNumber,
        sizeBytes,
        sha256Hash,
        branch,
        changeDescription,
        createdAt: new Date(),
      });
    } catch (error: any) {
      console.error("[artifact-versions] Error creating version:", error);
      res.status(500).json({ error: "Failed to create version" });
    }
  }
);

/**
 * POST /api/ros/artifacts/:artifactId/compare
 * Compare two versions.
 * RBAC: VIEWER+
 */
router.post(
  "/artifacts/:artifactId/compare",
  requireRole("VIEWER"),
  async (req: Request, res: Response) => {
    try {
      const { artifactId } = req.params;
      const parseResult = compareVersionsSchema.safeParse(req.body);

      if (!parseResult.success) {
        return res.status(400).json({
          error: "Invalid request body",
          details: parseResult.error.errors,
        });
      }

      const { fromVersionId, toVersionId, includeText } = parseResult.data;
      const userId = (req as any).user?.id;

      // Compute diff
      const diffResult = await diffService.computeDiff(fromVersionId, toVersionId);

      if (!diffResult) {
        return res.status(404).json({ error: "One or both versions not found" });
      }

      // Store comparison
      await diffService.storeComparison(
        artifactId,
        fromVersionId,
        toVersionId,
        diffResult,
        userId
      );

      // Get unified diff hunks if requested
      let hunks;
      if (includeText) {
        const userRole = (req as any).user?.role;
        // Only include text if user is STEWARD+ and content doesn't have PHI
        const canSeeText = ['STEWARD', 'ADMIN'].includes(userRole) || !diffResult.containsPhi;
        hunks = await diffService.getUnifiedDiff(fromVersionId, toVersionId, {
          includeText: canSeeText,
        });
      }

      res.json({
        ...diffResult,
        hunks,
      });
    } catch (error: any) {
      console.error("[artifact-versions] Error comparing versions:", error);
      res.status(500).json({ error: "Failed to compare versions" });
    }
  }
);

/**
 * POST /api/ros/artifacts/:artifactId/restore/:versionId
 * Restore a previous version (creates new version with same content).
 * RBAC: RESEARCHER+
 */
router.post(
  "/artifacts/:artifactId/restore/:versionId",
  requireRole("RESEARCHER"),
  async (req: Request, res: Response) => {
    try {
      const { artifactId, versionId } = req.params;
      const userId = (req as any).user?.id;

      // Get the version to restore
      const [versionToRestore] = await db
        .select()
        .from(artifactVersions)
        .where(and(
          eq(artifactVersions.id, versionId),
          eq(artifactVersions.artifactId, artifactId)
        ))
        .limit(1);

      if (!versionToRestore) {
        return res.status(404).json({ error: "Version not found" });
      }

      // Get artifact for research ID
      const [artifact] = await db
        .select()
        .from(artifacts)
        .where(eq(artifacts.id, artifactId))
        .limit(1);

      if (!artifact) {
        return res.status(404).json({ error: "Artifact not found" });
      }

      // Get next version number
      const [latestVersion] = await db
        .select({ versionNumber: artifactVersions.versionNumber })
        .from(artifactVersions)
        .where(eq(artifactVersions.artifactId, artifactId))
        .orderBy(desc(artifactVersions.versionNumber))
        .limit(1);

      const nextVersionNumber = (latestVersion?.versionNumber || 0) + 1;
      const newVersionId = nanoid();

      // Create new version with restored content
      await db.insert(artifactVersions).values({
        id: newVersionId,
        artifactId,
        versionNumber: nextVersionNumber,
        content: versionToRestore.content,
        sizeBytes: versionToRestore.sizeBytes,
        sha256Hash: versionToRestore.sha256Hash,
        createdBy: userId,
        changeDescription: `Restored from version ${versionToRestore.versionNumber}`,
        branch: versionToRestore.branch || 'main',
        parentVersionId: artifact.currentVersionId,
        metadata: {
          restoredFrom: versionId,
          restoredFromVersion: versionToRestore.versionNumber,
        },
      });

      // Update artifact's current version
      await db
        .update(artifacts)
        .set({ currentVersionId: newVersionId })
        .where(eq(artifacts.id, artifactId));

      // Audit log
      await createAuditEntry({
        eventType: "ARTIFACT_VERSION_RESTORE",
        userId,
        resourceType: "artifact_version",
        resourceId: newVersionId,
        action: "restore",
        details: {
          artifactId,
          restoredFromVersionId: versionId,
          restoredFromVersion: versionToRestore.versionNumber,
          newVersionNumber: nextVersionNumber,
          researchId: artifact.researchId,
        },
      });

      res.status(201).json({
        id: newVersionId,
        artifactId,
        versionNumber: nextVersionNumber,
        restoredFrom: versionId,
        restoredFromVersion: versionToRestore.versionNumber,
        branch: versionToRestore.branch || 'main',
        createdAt: new Date(),
      });
    } catch (error: any) {
      console.error("[artifact-versions] Error restoring version:", error);
      res.status(500).json({ error: "Failed to restore version" });
    }
  }
);

export default router;
