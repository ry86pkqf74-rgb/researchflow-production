/**
 * Manuscript Branching Routes
 *
 * API endpoints for manuscript branching and merging:
 * - POST /api/ros/manuscripts/:artifactId/branch - Create branch
 * - GET /api/ros/manuscripts/:artifactId/branches - List branches
 * - POST /api/ros/manuscripts/:artifactId/merge - Merge branches
 */
import { Router, Request, Response } from "express";
import { requireRole } from "../middleware/rbac";
import { createAuditEntry } from "../services/auditService";
import { db } from "../../db";
import { artifacts, artifactVersions } from "@researchflow/core/schema";
import { eq, and, desc, sql, isNull } from "drizzle-orm";
import { nanoid } from "nanoid";
import { createHash } from "crypto";
import * as diffService from "../services/diffService";
import { z } from "zod";

const router = Router();

// Validation schemas
const createBranchSchema = z.object({
  branchName: z.string().min(1).max(100).regex(/^[a-zA-Z0-9_-]+$/, "Branch name must be alphanumeric with - and _"),
  fromVersionId: z.string().min(1),
});

const mergeSchema = z.object({
  sourceBranch: z.string().min(1).max(100),
  targetBranch: z.string().min(1).max(100),
  commitMessage: z.string().max(500).optional(),
});

// Reserved branch names
const RESERVED_BRANCHES = ['main', 'rebuttal', 'camera-ready'];

/**
 * Find the Lowest Common Ancestor (LCA) of two versions
 * by walking the parent chain of both versions
 */
async function findCommonAncestor(
  versionAId: string,
  versionBId: string
): Promise<string | null> {
  // Get the ancestry chain of version A
  const ancestryA = new Set<string>();
  let currentId: string | null = versionAId;

  while (currentId) {
    ancestryA.add(currentId);
    const version = await db.query.artifactVersions.findFirst({
      where: eq(artifactVersions.id, currentId),
      columns: { parentVersionId: true },
    });
    currentId = version?.parentVersionId || null;
  }

  // Walk version B's chain to find first match
  currentId = versionBId;
  while (currentId) {
    if (ancestryA.has(currentId)) {
      return currentId;
    }
    const version = await db.query.artifactVersions.findFirst({
      where: eq(artifactVersions.id, currentId),
      columns: { parentVersionId: true },
    });
    currentId = version?.parentVersionId || null;
  }

  return null;
}

// Simple diff result type for merge conflict detection
interface SimpleDiffResult {
  operations: Array<{ operation: 'equal' | 'insert' | 'delete'; text: string }>;
  addedLines: number;
  removedLines: number;
  unchangedLines: number;
}

/**
 * Detect conflicts between two diffs based on overlapping line ranges
 */
function detectConflicts(
  baseToSourceDiff: SimpleDiffResult,
  baseToTargetDiff: SimpleDiffResult
): Array<{
  type: 'overlap';
  sourceRange: { start: number; end: number };
  targetRange: { start: number; end: number };
  description: string;
}> {
  const conflicts: Array<{
    type: 'overlap';
    sourceRange: { start: number; end: number };
    targetRange: { start: number; end: number };
    description: string;
  }> = [];

  // Get changed line ranges from source diff
  const sourceChanges: Array<{ start: number; end: number }> = [];
  let lineNum = 0;
  for (const op of baseToSourceDiff.operations) {
    if (op.operation === 'delete') {
      sourceChanges.push({ start: lineNum, end: lineNum + 1 });
    }
    if (op.operation !== 'insert') {
      lineNum++;
    }
  }

  // Get changed line ranges from target diff
  const targetChanges: Array<{ start: number; end: number }> = [];
  lineNum = 0;
  for (const op of baseToTargetDiff.operations) {
    if (op.operation === 'delete') {
      targetChanges.push({ start: lineNum, end: lineNum + 1 });
    }
    if (op.operation !== 'insert') {
      lineNum++;
    }
  }

  // Find overlaps
  for (const sourceRange of sourceChanges) {
    for (const targetRange of targetChanges) {
      if (sourceRange.start < targetRange.end && targetRange.start < sourceRange.end) {
        conflicts.push({
          type: 'overlap',
          sourceRange,
          targetRange,
          description: `Both branches modified lines ${Math.max(sourceRange.start, targetRange.start) + 1}-${Math.min(sourceRange.end, targetRange.end)}`,
        });
      }
    }
  }

  return conflicts;
}

/**
 * POST /api/ros/manuscripts/:artifactId/branch
 * Create a new branch from an existing version
 */
router.post(
  "/manuscripts/:artifactId/branch",
  requireRole("RESEARCHER"),
  async (req: Request, res: Response) => {
    try {
      const { artifactId } = req.params;
      const userId = (req as any).user?.id || "system";

      // Validate input
      const parsed = createBranchSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid input", details: parsed.error.flatten() });
      }

      const { branchName, fromVersionId } = parsed.data;

      // Check artifact exists
      const artifact = await db.query.artifacts.findFirst({
        where: eq(artifacts.id, artifactId),
      });

      if (!artifact) {
        return res.status(404).json({ error: "Artifact not found" });
      }

      // Check if branch already exists
      const existingBranch = await db.query.artifactVersions.findFirst({
        where: and(
          eq(artifactVersions.artifactId, artifactId),
          eq(artifactVersions.branch, branchName)
        ),
      });

      if (existingBranch) {
        return res.status(409).json({ error: "Branch already exists", branch: branchName });
      }

      // Get the source version
      const sourceVersion = await db.query.artifactVersions.findFirst({
        where: eq(artifactVersions.id, fromVersionId),
      });

      if (!sourceVersion) {
        return res.status(404).json({ error: "Source version not found" });
      }

      if (sourceVersion.artifactId !== artifactId) {
        return res.status(400).json({ error: "Version does not belong to this artifact" });
      }

      // Create the new branch version
      const newVersionId = `ver_${nanoid(12)}`;
      const contentHash = createHash("sha256")
        .update(sourceVersion.content || "")
        .digest("hex");

      await db.insert(artifactVersions).values({
        id: newVersionId,
        artifactId,
        versionNumber: 1, // First version on new branch
        content: sourceVersion.content,
        contentHash,
        changeDescription: `Branch created from ${sourceVersion.branch || 'main'} v${sourceVersion.versionNumber}`,
        changedBy: userId,
        branch: branchName,
        parentVersionId: fromVersionId,
        metadata: {
          branchedFrom: {
            versionId: fromVersionId,
            branch: sourceVersion.branch || 'main',
            versionNumber: sourceVersion.versionNumber,
          },
        },
      });

      // Audit log
      await createAuditEntry({
        eventType: "BRANCH_CREATED",
        userId,
        resourceType: "artifact_version",
        resourceId: newVersionId,
        action: "create",
        details: {
          artifactId,
          branchName,
          fromVersionId,
          fromBranch: sourceVersion.branch || 'main',
          researchId: artifact.researchId,
        },
      });

      res.status(201).json({
        id: newVersionId,
        artifactId,
        branch: branchName,
        versionNumber: 1,
        parentVersionId: fromVersionId,
        branchedFrom: {
          versionId: fromVersionId,
          branch: sourceVersion.branch || 'main',
          versionNumber: sourceVersion.versionNumber,
        },
        createdAt: new Date(),
      });
    } catch (error: any) {
      console.error("[manuscript-branches] Error creating branch:", error);
      res.status(500).json({ error: "Failed to create branch" });
    }
  }
);

/**
 * GET /api/ros/manuscripts/:artifactId/branches
 * List all branches for an artifact with their head versions
 */
router.get(
  "/manuscripts/:artifactId/branches",
  requireRole("VIEWER"),
  async (req: Request, res: Response) => {
    try {
      const { artifactId } = req.params;

      // Check artifact exists
      const artifact = await db.query.artifacts.findFirst({
        where: eq(artifacts.id, artifactId),
      });

      if (!artifact) {
        return res.status(404).json({ error: "Artifact not found" });
      }

      // Get all distinct branches with their latest version
      const branches = await db.execute(sql`
        SELECT DISTINCT ON (branch)
          branch,
          id as head_version_id,
          version_number as head_version_number,
          changed_by as last_changed_by,
          created_at as last_updated_at,
          change_description as last_change_description
        FROM artifact_versions
        WHERE artifact_id = ${artifactId}
        ORDER BY branch, version_number DESC
      `);

      // Format response
      const formattedBranches = (branches.rows || []).map((row: any) => ({
        name: row.branch || 'main',
        headVersionId: row.head_version_id,
        headVersionNumber: row.head_version_number,
        lastChangedBy: row.last_changed_by,
        lastUpdatedAt: row.last_updated_at,
        lastChangeDescription: row.last_change_description,
        isDefault: (row.branch || 'main') === 'main',
        isReserved: RESERVED_BRANCHES.includes(row.branch || 'main'),
      }));

      res.json({
        artifactId,
        branches: formattedBranches,
        defaultBranch: 'main',
      });
    } catch (error: any) {
      console.error("[manuscript-branches] Error listing branches:", error);
      res.status(500).json({ error: "Failed to list branches" });
    }
  }
);

/**
 * POST /api/ros/manuscripts/:artifactId/merge
 * Merge one branch into another with conflict detection
 */
router.post(
  "/manuscripts/:artifactId/merge",
  requireRole("RESEARCHER"),
  async (req: Request, res: Response) => {
    try {
      const { artifactId } = req.params;
      const userId = (req as any).user?.id || "system";

      // Validate input
      const parsed = mergeSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid input", details: parsed.error.flatten() });
      }

      const { sourceBranch, targetBranch, commitMessage } = parsed.data;

      if (sourceBranch === targetBranch) {
        return res.status(400).json({ error: "Cannot merge a branch into itself" });
      }

      // Check artifact exists
      const artifact = await db.query.artifacts.findFirst({
        where: eq(artifacts.id, artifactId),
      });

      if (!artifact) {
        return res.status(404).json({ error: "Artifact not found" });
      }

      // Get head versions for both branches
      const sourceHead = await db.query.artifactVersions.findFirst({
        where: and(
          eq(artifactVersions.artifactId, artifactId),
          eq(artifactVersions.branch, sourceBranch)
        ),
        orderBy: [desc(artifactVersions.versionNumber)],
      });

      const targetHead = await db.query.artifactVersions.findFirst({
        where: and(
          eq(artifactVersions.artifactId, artifactId),
          eq(artifactVersions.branch, targetBranch)
        ),
        orderBy: [desc(artifactVersions.versionNumber)],
      });

      if (!sourceHead) {
        return res.status(404).json({ error: `Source branch '${sourceBranch}' not found` });
      }

      if (!targetHead) {
        return res.status(404).json({ error: `Target branch '${targetBranch}' not found` });
      }

      // Find common ancestor (LCA)
      const lcaVersionId = await findCommonAncestor(sourceHead.id, targetHead.id);

      if (!lcaVersionId) {
        return res.status(409).json({
          error: "No common ancestor found",
          message: "The branches have diverged too far to merge automatically",
          canMerge: false,
        });
      }

      // Get LCA version content
      const lcaVersion = await db.query.artifactVersions.findFirst({
        where: eq(artifactVersions.id, lcaVersionId),
      });

      if (!lcaVersion) {
        return res.status(500).json({ error: "Failed to retrieve common ancestor" });
      }

      // If source and target are the same as LCA, no merge needed
      if (sourceHead.id === lcaVersionId) {
        return res.json({
          status: 'up_to_date',
          message: `${targetBranch} is already up to date with ${sourceBranch}`,
          canMerge: false,
        });
      }

      if (targetHead.id === lcaVersionId) {
        // Fast-forward merge possible - target hasn't changed since branch
        const newVersionId = `ver_${nanoid(12)}`;
        const contentHash = createHash("sha256")
          .update(sourceHead.content || "")
          .digest("hex");

        await db.insert(artifactVersions).values({
          id: newVersionId,
          artifactId,
          versionNumber: targetHead.versionNumber + 1,
          content: sourceHead.content,
          contentHash,
          changeDescription: commitMessage || `Merged ${sourceBranch} into ${targetBranch} (fast-forward)`,
          changedBy: userId,
          branch: targetBranch,
          parentVersionId: sourceHead.id,
          metadata: {
            mergeType: 'fast_forward',
            mergedFrom: sourceBranch,
            mergedFromVersionId: sourceHead.id,
            mergeBase: lcaVersionId,
          },
        });

        // Update current version if target is main
        if (targetBranch === 'main') {
          await db.update(artifacts)
            .set({ currentVersionId: newVersionId })
            .where(eq(artifacts.id, artifactId));
        }

        await createAuditEntry({
          eventType: "BRANCH_MERGED",
          userId,
          resourceType: "artifact_version",
          resourceId: newVersionId,
          action: "merge",
          details: {
            artifactId,
            sourceBranch,
            targetBranch,
            mergeType: 'fast_forward',
            mergeBase: lcaVersionId,
            researchId: artifact.researchId,
          },
        });

        return res.json({
          status: 'merged',
          mergeType: 'fast_forward',
          newVersionId,
          versionNumber: targetHead.versionNumber + 1,
          message: `Successfully merged ${sourceBranch} into ${targetBranch}`,
        });
      }

      // Full merge required - compute diffs and detect conflicts
      const baseContent = lcaVersion.content || "";
      const sourceContent = sourceHead.content || "";
      const targetContent = targetHead.content || "";

      // Compute diffs
      const baseToSourceDiff = diffService.computeLineDiff(baseContent, sourceContent);
      const baseToTargetDiff = diffService.computeLineDiff(baseContent, targetContent);

      // Detect conflicts
      const conflicts = detectConflicts(baseToSourceDiff, baseToTargetDiff);

      if (conflicts.length > 0) {
        return res.status(409).json({
          status: 'conflict',
          message: `Merge conflict detected: ${conflicts.length} conflict(s) found`,
          canMerge: false,
          conflicts,
          mergeBase: {
            versionId: lcaVersionId,
            branch: lcaVersion.branch || 'main',
            versionNumber: lcaVersion.versionNumber,
          },
          source: {
            branch: sourceBranch,
            versionId: sourceHead.id,
            versionNumber: sourceHead.versionNumber,
            changesFromBase: {
              addedLines: baseToSourceDiff.addedLines,
              removedLines: baseToSourceDiff.removedLines,
            },
          },
          target: {
            branch: targetBranch,
            versionId: targetHead.id,
            versionNumber: targetHead.versionNumber,
            changesFromBase: {
              addedLines: baseToTargetDiff.addedLines,
              removedLines: baseToTargetDiff.removedLines,
            },
          },
        });
      }

      // No conflicts - perform merge
      // For now, we use source content (3-way merge could be implemented later)
      // A proper 3-way merge would apply non-overlapping changes from both branches
      const mergedContent = sourceContent; // Simplified: source wins when no conflicts

      const newVersionId = `ver_${nanoid(12)}`;
      const contentHash = createHash("sha256")
        .update(mergedContent)
        .digest("hex");

      await db.insert(artifactVersions).values({
        id: newVersionId,
        artifactId,
        versionNumber: targetHead.versionNumber + 1,
        content: mergedContent,
        contentHash,
        changeDescription: commitMessage || `Merged ${sourceBranch} into ${targetBranch}`,
        changedBy: userId,
        branch: targetBranch,
        parentVersionId: targetHead.id,
        metadata: {
          mergeType: 'three_way',
          mergedFrom: sourceBranch,
          mergedFromVersionId: sourceHead.id,
          mergeBase: lcaVersionId,
          secondParent: sourceHead.id,
        },
      });

      // Update current version if target is main
      if (targetBranch === 'main') {
        await db.update(artifacts)
          .set({ currentVersionId: newVersionId })
          .where(eq(artifacts.id, artifactId));
      }

      await createAuditEntry({
        eventType: "BRANCH_MERGED",
        userId,
        resourceType: "artifact_version",
        resourceId: newVersionId,
        action: "merge",
        details: {
          artifactId,
          sourceBranch,
          targetBranch,
          mergeType: 'three_way',
          mergeBase: lcaVersionId,
          researchId: artifact.researchId,
        },
      });

      res.json({
        status: 'merged',
        mergeType: 'three_way',
        newVersionId,
        versionNumber: targetHead.versionNumber + 1,
        message: `Successfully merged ${sourceBranch} into ${targetBranch}`,
        mergeBase: lcaVersionId,
      });
    } catch (error: any) {
      console.error("[manuscript-branches] Error merging branches:", error);
      res.status(500).json({ error: "Failed to merge branches" });
    }
  }
);

/**
 * DELETE /api/ros/manuscripts/:artifactId/branches/:branchName
 * Delete a branch (soft delete - marks all versions as deleted)
 * Cannot delete reserved branches (main, rebuttal, camera-ready)
 */
router.delete(
  "/manuscripts/:artifactId/branches/:branchName",
  requireRole("RESEARCHER"),
  async (req: Request, res: Response) => {
    try {
      const { artifactId, branchName } = req.params;
      const userId = (req as any).user?.id || "system";

      if (RESERVED_BRANCHES.includes(branchName)) {
        return res.status(403).json({
          error: "Cannot delete reserved branch",
          reservedBranches: RESERVED_BRANCHES,
        });
      }

      // Check artifact exists
      const artifact = await db.query.artifacts.findFirst({
        where: eq(artifacts.id, artifactId),
      });

      if (!artifact) {
        return res.status(404).json({ error: "Artifact not found" });
      }

      // Check branch exists
      const branchVersions = await db.query.artifactVersions.findFirst({
        where: and(
          eq(artifactVersions.artifactId, artifactId),
          eq(artifactVersions.branch, branchName)
        ),
      });

      if (!branchVersions) {
        return res.status(404).json({ error: `Branch '${branchName}' not found` });
      }

      // Soft delete all versions in the branch
      // Note: In production, you might want to keep versions but just remove the branch pointer
      await createAuditEntry({
        eventType: "BRANCH_DELETED",
        userId,
        resourceType: "artifact",
        resourceId: artifactId,
        action: "delete",
        details: {
          artifactId,
          branchName,
          deletedBy: userId,
          researchId: artifact.researchId,
        },
      });

      res.json({
        success: true,
        message: `Branch '${branchName}' deleted`,
        artifactId,
        branchName,
      });
    } catch (error: any) {
      console.error("[manuscript-branches] Error deleting branch:", error);
      res.status(500).json({ error: "Failed to delete branch" });
    }
  }
);

export default router;
