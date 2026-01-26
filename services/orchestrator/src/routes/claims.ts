/**
 * Claims Routes
 *
 * API endpoints for claims and evidence linking:
 * - POST /api/ros/claims - Create claim
 * - GET /api/ros/claims - List claims for manuscript
 * - GET /api/ros/claims/:claimId - Get single claim
 * - PATCH /api/ros/claims/:claimId - Update claim status
 * - DELETE /api/ros/claims/:claimId - Delete claim
 * - POST /api/ros/claims/:claimId/evidence - Link evidence
 * - GET /api/ros/claims/:claimId/evidence - Get evidence for claim
 * - DELETE /api/ros/evidence-links/:linkId - Remove evidence link
 * - GET /api/ros/claims/coverage - Get coverage report
 */
import { Router, Request, Response } from "express";
import { requireRole } from "../middleware/rbac";
import { createAuditEntry } from "../services/auditService";
import * as claimsService from "../services/claimsService";
import { z } from "zod";

const router = Router();

// Validation schemas
const claimAnchorSchema = z.object({
  sectionId: z.string().optional(),
  sectionName: z.string().optional(),
  startOffset: z.number().int().min(0),
  endOffset: z.number().int().min(0),
  textHash: z.string().optional(),
});

const createClaimSchema = z.object({
  researchId: z.string().min(1),
  manuscriptArtifactId: z.string().min(1),
  versionId: z.string().optional(),
  claimText: z.string().min(1).max(2000),
  anchor: claimAnchorSchema,
  status: z.enum(['draft', 'verified', 'disputed', 'retracted']).optional(),
  metadata: z.record(z.unknown()).optional(),
  skipPhiCheck: z.boolean().optional(),
});

const linkEvidenceSchema = z.object({
  evidenceType: z.enum(['citation', 'data_artifact', 'figure', 'table', 'external_url']),
  evidenceArtifactId: z.string().optional(),
  citationId: z.string().optional(),
  externalUrl: z.string().url().optional(),
  locator: z.object({
    pageNumber: z.number().int().min(0).optional(),
    sectionId: z.string().optional(),
    rowIndex: z.number().int().min(0).optional(),
    columnIndex: z.number().int().min(0).optional(),
    figureId: z.string().optional(),
    startOffset: z.number().int().min(0).optional(),
    endOffset: z.number().int().min(0).optional(),
    textHash: z.string().optional(),
  }),
  notes: z.string().max(1000).optional(),
  metadata: z.record(z.unknown()).optional(),
});

const updateClaimStatusSchema = z.object({
  status: z.enum(['draft', 'verified', 'disputed', 'retracted']),
});

/**
 * POST /api/ros/claims
 * Create a new claim
 */
router.post(
  "/claims",
  requireRole("RESEARCHER"),
  async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user?.id || "system";
      const userRole = (req as any).user?.role;

      const parseResult = createClaimSchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({
          error: "Invalid request body",
          details: parseResult.error.errors,
        });
      }

      const params = parseResult.data;

      // Only stewards can skip PHI check
      if (params.skipPhiCheck && userRole !== 'STEWARD' && userRole !== 'ADMIN') {
        return res.status(403).json({
          error: "Only stewards or admins can override PHI checks",
        });
      }

      const result = await claimsService.createClaim({
        ...params as claimsService.CreateClaimParams,
        createdBy: userId,
      });

      if (!result.success) {
        return res.status(409).json({
          error: result.error,
          phiFindings: result.phiFindings,
        });
      }

      // Audit log
      await createAuditEntry({
        eventType: "CLAIM_CREATE",
        userId,
        resourceType: "claim",
        resourceId: result.claim!.id,
        action: "create",
        details: {
          manuscriptArtifactId: params.manuscriptArtifactId,
          sectionId: params.anchor.sectionId,
          researchId: params.researchId,
        },
      });

      res.status(201).json(result.claim);
    } catch (error: any) {
      console.error("[claims] Error creating claim:", error);
      res.status(500).json({ error: "Failed to create claim" });
    }
  }
);

/**
 * GET /api/ros/claims
 * List claims for a manuscript
 */
router.get(
  "/claims",
  requireRole("VIEWER"),
  async (req: Request, res: Response) => {
    try {
      const { manuscriptArtifactId, status, sectionId, includeEvidence } = req.query;

      if (!manuscriptArtifactId) {
        return res.status(400).json({ error: "manuscriptArtifactId is required" });
      }

      const claims = await claimsService.getClaimsForManuscript(
        manuscriptArtifactId as string,
        {
          status: status as claimsService.ClaimStatus | undefined,
          sectionId: sectionId as string | undefined,
          includeEvidence: includeEvidence === 'true',
        }
      );

      res.json({ claims, count: claims.length });
    } catch (error: any) {
      console.error("[claims] Error listing claims:", error);
      res.status(500).json({ error: "Failed to list claims" });
    }
  }
);

/**
 * GET /api/ros/claims/coverage
 * Get coverage report for a manuscript
 */
router.get(
  "/claims/coverage",
  requireRole("VIEWER"),
  async (req: Request, res: Response) => {
    try {
      const { manuscriptArtifactId } = req.query;

      if (!manuscriptArtifactId) {
        return res.status(400).json({ error: "manuscriptArtifactId is required" });
      }

      const report = await claimsService.getCoverageReport(manuscriptArtifactId as string);

      res.json(report);
    } catch (error: any) {
      console.error("[claims] Error getting coverage report:", error);
      res.status(500).json({ error: "Failed to get coverage report" });
    }
  }
);

/**
 * GET /api/ros/claims/:claimId
 * Get a single claim
 */
router.get(
  "/claims/:claimId",
  requireRole("VIEWER"),
  async (req: Request, res: Response) => {
    try {
      const { claimId } = req.params;

      const claim = await claimsService.getClaim(claimId);

      if (!claim) {
        return res.status(404).json({ error: "Claim not found" });
      }

      // Get evidence links
      const evidenceLinks = await claimsService.getEvidenceForClaim(claimId);

      res.json({ ...claim, evidenceLinks });
    } catch (error: any) {
      console.error("[claims] Error getting claim:", error);
      res.status(500).json({ error: "Failed to get claim" });
    }
  }
);

/**
 * PATCH /api/ros/claims/:claimId
 * Update claim status
 */
router.patch(
  "/claims/:claimId",
  requireRole("RESEARCHER"),
  async (req: Request, res: Response) => {
    try {
      const { claimId } = req.params;
      const userId = (req as any).user?.id || "system";

      const parseResult = updateClaimStatusSchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({
          error: "Invalid request body",
          details: parseResult.error.errors,
        });
      }

      const { status } = parseResult.data;

      const existing = await claimsService.getClaim(claimId);
      if (!existing) {
        return res.status(404).json({ error: "Claim not found" });
      }

      const updated = await claimsService.updateClaimStatus(claimId, status, userId);

      // Audit log
      await createAuditEntry({
        eventType: "CLAIM_STATUS_UPDATE",
        userId,
        resourceType: "claim",
        resourceId: claimId,
        action: "update",
        details: {
          oldStatus: existing.status,
          newStatus: status,
          researchId: existing.researchId,
        },
      });

      res.json(updated);
    } catch (error: any) {
      console.error("[claims] Error updating claim:", error);
      res.status(500).json({ error: "Failed to update claim" });
    }
  }
);

/**
 * DELETE /api/ros/claims/:claimId
 * Delete a claim
 */
router.delete(
  "/claims/:claimId",
  requireRole("RESEARCHER"),
  async (req: Request, res: Response) => {
    try {
      const { claimId } = req.params;
      const userId = (req as any).user?.id || "system";

      const existing = await claimsService.getClaim(claimId);
      if (!existing) {
        return res.status(404).json({ error: "Claim not found" });
      }

      const deleted = await claimsService.deleteClaim(claimId);

      if (!deleted) {
        return res.status(404).json({ error: "Claim not found or already deleted" });
      }

      // Audit log
      await createAuditEntry({
        eventType: "CLAIM_DELETE",
        userId,
        resourceType: "claim",
        resourceId: claimId,
        action: "delete",
        details: { researchId: existing.researchId },
      });

      res.json({ success: true });
    } catch (error: any) {
      console.error("[claims] Error deleting claim:", error);
      res.status(500).json({ error: "Failed to delete claim" });
    }
  }
);

/**
 * POST /api/ros/claims/:claimId/evidence
 * Link evidence to a claim
 */
router.post(
  "/claims/:claimId/evidence",
  requireRole("RESEARCHER"),
  async (req: Request, res: Response) => {
    try {
      const { claimId } = req.params;
      const userId = (req as any).user?.id || "system";

      const parseResult = linkEvidenceSchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({
          error: "Invalid request body",
          details: parseResult.error.errors,
        });
      }

      const params = parseResult.data;

      const result = await claimsService.linkEvidence({
        claimId,
        ...params,
        linkedBy: userId,
      });

      if (!result.success) {
        return res.status(400).json({ error: result.error });
      }

      const claim = await claimsService.getClaim(claimId);

      // Audit log
      await createAuditEntry({
        eventType: "EVIDENCE_LINK_CREATE",
        userId,
        resourceType: "claim_evidence_link",
        resourceId: result.link!.id,
        action: "create",
        details: {
          claimId,
          evidenceType: params.evidenceType,
          evidenceArtifactId: params.evidenceArtifactId,
          researchId: claim?.researchId,
        },
      });

      res.status(201).json(result.link);
    } catch (error: any) {
      console.error("[claims] Error linking evidence:", error);
      res.status(500).json({ error: "Failed to link evidence" });
    }
  }
);

/**
 * GET /api/ros/claims/:claimId/evidence
 * Get evidence links for a claim
 */
router.get(
  "/claims/:claimId/evidence",
  requireRole("VIEWER"),
  async (req: Request, res: Response) => {
    try {
      const { claimId } = req.params;

      const claim = await claimsService.getClaim(claimId);
      if (!claim) {
        return res.status(404).json({ error: "Claim not found" });
      }

      const evidenceLinks = await claimsService.getEvidenceForClaim(claimId);

      res.json({ evidenceLinks, count: evidenceLinks.length });
    } catch (error: any) {
      console.error("[claims] Error getting evidence:", error);
      res.status(500).json({ error: "Failed to get evidence" });
    }
  }
);

/**
 * DELETE /api/ros/evidence-links/:linkId
 * Remove an evidence link
 */
router.delete(
  "/evidence-links/:linkId",
  requireRole("RESEARCHER"),
  async (req: Request, res: Response) => {
    try {
      const { linkId } = req.params;
      const userId = (req as any).user?.id || "system";

      const deleted = await claimsService.unlinkEvidence(linkId);

      if (!deleted) {
        return res.status(404).json({ error: "Evidence link not found or already deleted" });
      }

      // Audit log
      await createAuditEntry({
        eventType: "EVIDENCE_LINK_DELETE",
        userId,
        resourceType: "claim_evidence_link",
        resourceId: linkId,
        action: "delete",
        details: {},
      });

      res.json({ success: true });
    } catch (error: any) {
      console.error("[claims] Error unlinking evidence:", error);
      res.status(500).json({ error: "Failed to unlink evidence" });
    }
  }
);

export default router;
