/**
 * Submission Routes
 *
 * API endpoints for journal/conference submission tracking:
 * - POST /api/ros/submission-targets - Create target
 * - GET /api/ros/submission-targets - List targets
 * - GET /api/ros/submission-targets/:targetId - Get target
 * - POST /api/ros/submissions - Create submission
 * - GET /api/ros/submissions - List submissions
 * - GET /api/ros/submissions/:submissionId - Get submission
 * - PATCH /api/ros/submissions/:submissionId/status - Update status
 * - POST /api/ros/submissions/:submissionId/reviewer-points - Add reviewer point
 * - GET /api/ros/submissions/:submissionId/reviewer-points - List reviewer points
 * - POST /api/ros/reviewer-points/:pointId/resolve - Resolve point
 * - POST /api/ros/reviewer-points/:pointId/rebuttals - Add rebuttal
 * - GET /api/ros/reviewer-points/:pointId/rebuttals - List rebuttals
 * - POST /api/ros/submissions/:submissionId/packages - Create package
 * - GET /api/ros/submissions/:submissionId/packages - List packages
 * - GET /api/ros/submissions/stats - Get statistics
 */
import { Router, Request, Response } from "express";
import { requireRole } from "../middleware/rbac";
import { createAuditEntry } from "../services/auditService";
import * as submissionService from "../services/submissionService";
import { z } from "zod";

const router = Router();

// Validation schemas
const createTargetSchema = z.object({
  name: z.string().min(1).max(500),
  kind: z.enum(['journal', 'conference']),
  orgId: z.string().optional(),
  websiteUrl: z.string().url().optional(),
  requirementsArtifactId: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
});

const createSubmissionSchema = z.object({
  researchId: z.string().min(1),
  targetId: z.string().min(1),
  manuscriptArtifactId: z.string().optional(),
  manuscriptVersionId: z.string().optional(),
  externalTrackingId: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
});

const updateStatusSchema = z.object({
  status: z.enum(['draft', 'submitted', 'revise', 'accepted', 'rejected', 'withdrawn', 'camera_ready']),
});

const createReviewerPointSchema = z.object({
  reviewerLabel: z.string().max(50).optional(),
  body: z.string().min(1).max(10000),
  anchorData: z.record(z.unknown()).optional(),
  skipPhiCheck: z.boolean().optional(),
});

const createRebuttalSchema = z.object({
  responseBody: z.string().min(1).max(10000),
  evidenceArtifactIds: z.array(z.string()).optional(),
  manuscriptChangeRefs: z.array(z.record(z.unknown())).optional(),
  skipPhiCheck: z.boolean().optional(),
});

const createPackageSchema = z.object({
  packageType: z.string().min(1).max(50),
  artifactIds: z.array(z.string()),
  manifest: z.record(z.unknown()),
});

// ==================== SUBMISSION TARGETS ====================

/**
 * POST /api/ros/submission-targets
 * Create a new submission target.
 * RBAC: STEWARD+
 */
router.post(
  "/submission-targets",
  requireRole("STEWARD"),
  async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user?.id || "system";

      const parseResult = createTargetSchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({
          error: "Invalid request body",
          details: parseResult.error.errors,
        });
      }

      const params = parseResult.data as submissionService.CreateTargetParams;

      const target = await submissionService.createTarget({
        ...params,
        createdBy: userId,
      });

      await createAuditEntry({
        eventType: "SUBMISSION_TARGET_CREATE",
        userId,
        resourceType: "submission_target",
        resourceId: target.id,
        action: "create",
        details: { name: params.name, kind: params.kind },
      });

      res.status(201).json(target);
    } catch (error: any) {
      console.error("[submissions] Error creating target:", error);
      res.status(500).json({ error: "Failed to create submission target" });
    }
  }
);

/**
 * GET /api/ros/submission-targets
 * List submission targets.
 * RBAC: VIEWER+
 */
router.get(
  "/submission-targets",
  requireRole("VIEWER"),
  async (req: Request, res: Response) => {
    try {
      const { kind, orgId } = req.query;

      const targets = await submissionService.listTargets({
        kind: kind as submissionService.SubmissionTargetKind | undefined,
        orgId: orgId as string | undefined,
      });

      res.json({ targets, count: targets.length });
    } catch (error: any) {
      console.error("[submissions] Error listing targets:", error);
      res.status(500).json({ error: "Failed to list submission targets" });
    }
  }
);

/**
 * GET /api/ros/submission-targets/:targetId
 * Get a submission target.
 * RBAC: VIEWER+
 */
router.get(
  "/submission-targets/:targetId",
  requireRole("VIEWER"),
  async (req: Request, res: Response) => {
    try {
      const { targetId } = req.params;

      const target = await submissionService.getTarget(targetId);

      if (!target) {
        return res.status(404).json({ error: "Target not found" });
      }

      res.json(target);
    } catch (error: any) {
      console.error("[submissions] Error getting target:", error);
      res.status(500).json({ error: "Failed to get submission target" });
    }
  }
);

// ==================== SUBMISSIONS ====================

/**
 * POST /api/ros/submissions
 * Create a new submission.
 * RBAC: RESEARCHER+
 */
router.post(
  "/submissions",
  requireRole("RESEARCHER"),
  async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user?.id || "system";

      const parseResult = createSubmissionSchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({
          error: "Invalid request body",
          details: parseResult.error.errors,
        });
      }

      const params = parseResult.data as submissionService.CreateSubmissionParams;

      const result = await submissionService.createSubmission({
        ...params,
        createdBy: userId,
      });

      if (!result.success) {
        return res.status(404).json({ error: result.error });
      }

      await createAuditEntry({
        eventType: "SUBMISSION_CREATE",
        userId,
        resourceType: "submission",
        resourceId: result.submission!.id,
        action: "create",
        details: { researchId: params.researchId, targetId: params.targetId },
      });

      res.status(201).json(result.submission);
    } catch (error: any) {
      console.error("[submissions] Error creating submission:", error);
      res.status(500).json({ error: "Failed to create submission" });
    }
  }
);

/**
 * GET /api/ros/submissions
 * List submissions for a research project.
 * RBAC: VIEWER+
 */
router.get(
  "/submissions",
  requireRole("VIEWER"),
  async (req: Request, res: Response) => {
    try {
      const { researchId, status, targetId } = req.query;

      if (!researchId) {
        return res.status(400).json({ error: "researchId is required" });
      }

      const submissions = await submissionService.listSubmissions(
        researchId as string,
        {
          status: status as submissionService.SubmissionStatus | undefined,
          targetId: targetId as string | undefined,
        }
      );

      res.json({ submissions, count: submissions.length });
    } catch (error: any) {
      console.error("[submissions] Error listing submissions:", error);
      res.status(500).json({ error: "Failed to list submissions" });
    }
  }
);

/**
 * GET /api/ros/submissions/stats
 * Get submission statistics for a research project.
 * RBAC: VIEWER+
 */
router.get(
  "/submissions/stats",
  requireRole("VIEWER"),
  async (req: Request, res: Response) => {
    try {
      const { researchId } = req.query;

      if (!researchId) {
        return res.status(400).json({ error: "researchId is required" });
      }

      const stats = await submissionService.getSubmissionStats(researchId as string);

      res.json(stats);
    } catch (error: any) {
      console.error("[submissions] Error getting stats:", error);
      res.status(500).json({ error: "Failed to get submission stats" });
    }
  }
);

/**
 * GET /api/ros/submissions/:submissionId
 * Get a submission.
 * RBAC: VIEWER+
 */
router.get(
  "/submissions/:submissionId",
  requireRole("VIEWER"),
  async (req: Request, res: Response) => {
    try {
      const { submissionId } = req.params;

      const submission = await submissionService.getSubmission(submissionId);

      if (!submission) {
        return res.status(404).json({ error: "Submission not found" });
      }

      res.json(submission);
    } catch (error: any) {
      console.error("[submissions] Error getting submission:", error);
      res.status(500).json({ error: "Failed to get submission" });
    }
  }
);

/**
 * PATCH /api/ros/submissions/:submissionId/status
 * Update submission status.
 * RBAC: RESEARCHER+
 */
router.patch(
  "/submissions/:submissionId/status",
  requireRole("RESEARCHER"),
  async (req: Request, res: Response) => {
    try {
      const { submissionId } = req.params;
      const userId = (req as any).user?.id || "system";

      const parseResult = updateStatusSchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({
          error: "Invalid request body",
          details: parseResult.error.errors,
        });
      }

      const { status } = parseResult.data;

      const existing = await submissionService.getSubmission(submissionId);
      if (!existing) {
        return res.status(404).json({ error: "Submission not found" });
      }

      const updated = await submissionService.updateSubmissionStatus(
        submissionId,
        status,
        userId
      );

      await createAuditEntry({
        eventType: "SUBMISSION_STATUS_UPDATE",
        userId,
        resourceType: "submission",
        resourceId: submissionId,
        action: "update",
        details: {
          oldStatus: existing.status,
          newStatus: status,
          researchId: existing.researchId,
        },
      });

      res.json(updated);
    } catch (error: any) {
      console.error("[submissions] Error updating status:", error);
      res.status(500).json({ error: "Failed to update submission status" });
    }
  }
);

// ==================== REVIEWER POINTS ====================

/**
 * POST /api/ros/submissions/:submissionId/reviewer-points
 * Add a reviewer point with PHI scanning.
 * RBAC: RESEARCHER+
 */
router.post(
  "/submissions/:submissionId/reviewer-points",
  requireRole("RESEARCHER"),
  async (req: Request, res: Response) => {
    try {
      const { submissionId } = req.params;
      const userId = (req as any).user?.id || "system";
      const userRole = (req as any).user?.role;

      const parseResult = createReviewerPointSchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({
          error: "Invalid request body",
          details: parseResult.error.errors,
        });
      }

      const params = parseResult.data as { body: string; reviewerLabel?: string; anchorData?: Record<string, unknown>; skipPhiCheck?: boolean };

      // Only stewards can skip PHI check
      if (params.skipPhiCheck && !['STEWARD', 'ADMIN'].includes(userRole)) {
        return res.status(403).json({
          error: "Only stewards or admins can override PHI checks",
        });
      }

      const result = await submissionService.createReviewerPoint({
        submissionId,
        body: params.body,
        reviewerLabel: params.reviewerLabel,
        anchorData: params.anchorData,
        skipPhiCheck: params.skipPhiCheck,
        createdBy: userId,
      });

      if (!result.success) {
        return res.status(409).json({
          error: result.error,
          phiFindings: result.phiFindings,
        });
      }

      await createAuditEntry({
        eventType: "REVIEWER_POINT_CREATE",
        userId,
        resourceType: "reviewer_point",
        resourceId: result.point!.id,
        action: "create",
        details: {
          submissionId,
          reviewerLabel: params.reviewerLabel,
        },
      });

      res.status(201).json(result.point);
    } catch (error: any) {
      console.error("[submissions] Error creating reviewer point:", error);
      res.status(500).json({ error: "Failed to create reviewer point" });
    }
  }
);

/**
 * GET /api/ros/submissions/:submissionId/reviewer-points
 * List reviewer points for a submission.
 * RBAC: VIEWER+
 */
router.get(
  "/submissions/:submissionId/reviewer-points",
  requireRole("VIEWER"),
  async (req: Request, res: Response) => {
    try {
      const { submissionId } = req.params;
      const { status, reviewerLabel } = req.query;

      const points = await submissionService.listReviewerPoints(submissionId, {
        status: status as submissionService.ReviewerPointStatus | undefined,
        reviewerLabel: reviewerLabel as string | undefined,
      });

      res.json({ points, count: points.length });
    } catch (error: any) {
      console.error("[submissions] Error listing reviewer points:", error);
      res.status(500).json({ error: "Failed to list reviewer points" });
    }
  }
);

/**
 * POST /api/ros/reviewer-points/:pointId/resolve
 * Resolve a reviewer point.
 * RBAC: RESEARCHER+
 */
router.post(
  "/reviewer-points/:pointId/resolve",
  requireRole("RESEARCHER"),
  async (req: Request, res: Response) => {
    try {
      const { pointId } = req.params;
      const userId = (req as any).user?.id || "system";

      const existing = await submissionService.getReviewerPoint(pointId);
      if (!existing) {
        return res.status(404).json({ error: "Reviewer point not found" });
      }

      const resolved = await submissionService.resolveReviewerPoint(pointId, userId);

      await createAuditEntry({
        eventType: "REVIEWER_POINT_RESOLVE",
        userId,
        resourceType: "reviewer_point",
        resourceId: pointId,
        action: "resolve",
        details: { submissionId: existing.submissionId },
      });

      res.json(resolved);
    } catch (error: any) {
      console.error("[submissions] Error resolving reviewer point:", error);
      res.status(500).json({ error: "Failed to resolve reviewer point" });
    }
  }
);

// ==================== REBUTTALS ====================

/**
 * POST /api/ros/reviewer-points/:pointId/rebuttals
 * Add a rebuttal response with PHI scanning.
 * RBAC: RESEARCHER+
 */
router.post(
  "/reviewer-points/:pointId/rebuttals",
  requireRole("RESEARCHER"),
  async (req: Request, res: Response) => {
    try {
      const { pointId } = req.params;
      const userId = (req as any).user?.id || "system";
      const userRole = (req as any).user?.role;

      const parseResult = createRebuttalSchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({
          error: "Invalid request body",
          details: parseResult.error.errors,
        });
      }

      const params = parseResult.data as { responseBody: string; evidenceArtifactIds?: string[]; manuscriptChangeRefs?: Record<string, unknown>[]; skipPhiCheck?: boolean };

      // Only stewards can skip PHI check
      if (params.skipPhiCheck && !['STEWARD', 'ADMIN'].includes(userRole)) {
        return res.status(403).json({
          error: "Only stewards or admins can override PHI checks",
        });
      }

      const result = await submissionService.createRebuttal({
        reviewerPointId: pointId,
        responseBody: params.responseBody,
        evidenceArtifactIds: params.evidenceArtifactIds,
        manuscriptChangeRefs: params.manuscriptChangeRefs,
        skipPhiCheck: params.skipPhiCheck,
        createdBy: userId,
      });

      if (!result.success) {
        return res.status(409).json({
          error: result.error,
          phiFindings: result.phiFindings,
        });
      }

      await createAuditEntry({
        eventType: "REBUTTAL_CREATE",
        userId,
        resourceType: "rebuttal_response",
        resourceId: result.rebuttal!.id,
        action: "create",
        details: { reviewerPointId: pointId },
      });

      res.status(201).json(result.rebuttal);
    } catch (error: any) {
      console.error("[submissions] Error creating rebuttal:", error);
      res.status(500).json({ error: "Failed to create rebuttal" });
    }
  }
);

/**
 * GET /api/ros/reviewer-points/:pointId/rebuttals
 * List rebuttals for a reviewer point.
 * RBAC: VIEWER+
 */
router.get(
  "/reviewer-points/:pointId/rebuttals",
  requireRole("VIEWER"),
  async (req: Request, res: Response) => {
    try {
      const { pointId } = req.params;

      const rebuttals = await submissionService.listRebuttals(pointId);

      res.json({ rebuttals, count: rebuttals.length });
    } catch (error: any) {
      console.error("[submissions] Error listing rebuttals:", error);
      res.status(500).json({ error: "Failed to list rebuttals" });
    }
  }
);

// ==================== SUBMISSION PACKAGES ====================

/**
 * POST /api/ros/submissions/:submissionId/packages
 * Create a submission package.
 * RBAC: RESEARCHER+
 */
router.post(
  "/submissions/:submissionId/packages",
  requireRole("RESEARCHER"),
  async (req: Request, res: Response) => {
    try {
      const { submissionId } = req.params;
      const userId = (req as any).user?.id || "system";

      const parseResult = createPackageSchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({
          error: "Invalid request body",
          details: parseResult.error.errors,
        });
      }

      const params = parseResult.data as { packageType: string; artifactIds: string[]; manifest: Record<string, unknown> };

      const existing = await submissionService.getSubmission(submissionId);
      if (!existing) {
        return res.status(404).json({ error: "Submission not found" });
      }

      const pkg = await submissionService.createPackage({
        submissionId,
        packageType: params.packageType,
        artifactIds: params.artifactIds,
        manifest: params.manifest,
        createdBy: userId,
      });

      await createAuditEntry({
        eventType: "SUBMISSION_PACKAGE_CREATE",
        userId,
        resourceType: "submission_package",
        resourceId: pkg.id,
        action: "create",
        details: {
          submissionId,
          packageType: params.packageType,
          artifactCount: params.artifactIds.length,
        },
      });

      res.status(201).json(pkg);
    } catch (error: any) {
      console.error("[submissions] Error creating package:", error);
      res.status(500).json({ error: "Failed to create submission package" });
    }
  }
);

/**
 * GET /api/ros/submissions/:submissionId/packages
 * List packages for a submission.
 * RBAC: VIEWER+
 */
router.get(
  "/submissions/:submissionId/packages",
  requireRole("VIEWER"),
  async (req: Request, res: Response) => {
    try {
      const { submissionId } = req.params;

      const packages = await submissionService.listPackages(submissionId);

      res.json({ packages, count: packages.length });
    } catch (error: any) {
      console.error("[submissions] Error listing packages:", error);
      res.status(500).json({ error: "Failed to list submission packages" });
    }
  }
);

export default router;
