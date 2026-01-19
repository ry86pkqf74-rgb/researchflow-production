/**
 * Research Brief API Routes
 *
 * Endpoints for generating and managing enhanced research briefs.
 * Supports both Quick Entry and PICO mode topics.
 */

import { Router, Request, Response } from 'express';
import { eq, desc } from 'drizzle-orm';
import { v4 as uuid } from 'uuid';
import { db } from '../../db';
import { researchBriefs, topics, artifacts } from '@researchflow/core/schema';
import {
  generateEnhancedResearchBrief,
  validateBriefForApproval,
} from '../services/research-brief-generator';
import { blockAIInDemo } from '../../middleware/mode-guard';
import { requireRole, logAuditEvent, ROLES } from '../middleware/rbac';
import { asyncHandler } from '../middleware/errorHandler';
import type { GenerateResearchBriefRequest } from '@researchflow/core/types/research-brief';

const router = Router();

/**
 * Generate new Research Brief from Topic Declaration
 * POST /api/research-briefs/generate
 */
router.post(
  '/generate',
  requireRole(ROLES.RESEARCHER),
  blockAIInDemo,
  logAuditEvent('RESEARCH_BRIEF_GENERATE', 'research-brief'),
  asyncHandler(async (req: Request, res: Response) => {
    const {
      topicDeclarationId,
      includeRefinements = true,
      autoConvertToPICO = true,
    }: GenerateResearchBriefRequest = req.body;
    const userId = req.user?.id || 'anonymous';

    if (!db) {
      throw new Error('Database not initialized');
    }

    if (!topicDeclarationId) {
      return res.status(400).json({
        error: 'topicDeclarationId is required',
        code: 'MISSING_TOPIC_ID',
      });
    }

    // Fetch topic declaration
    const topic = await db.query.topics.findFirst({
      where: eq(topics.id, topicDeclarationId),
    });

    if (!topic) {
      return res.status(404).json({
        error: 'Topic declaration not found',
        code: 'TOPIC_NOT_FOUND',
        topicDeclarationId,
      });
    }

    // Generate brief
    const { brief, convertedPICO, tokenUsage, latencyMs } = await generateEnhancedResearchBrief(
      topic,
      userId,
      { includeRefinements, autoConvertToPICO }
    );

    // Save to database
    const briefId = uuid();
    await db.insert(researchBriefs).values({
      id: briefId,
      topicId: topic.id,
      topicVersion: topic.version,
      researchId: topic.researchId,
      entryMode: brief.entryMode,
      convertedPico: convertedPICO || null,
      summary: brief.summary || null,
      studyObjectives: brief.studyObjectives,
      population: brief.population,
      exposure: brief.exposure,
      comparator: brief.comparator || null,
      outcomes: brief.outcomes,
      timeframe: brief.timeframe || null,
      candidateEndpoints: brief.candidateEndpoints,
      keyConfounders: brief.keyConfounders,
      minimumDatasetFields: brief.minimumDatasetFields,
      clarifyingPrompts: brief.clarifyingPrompts,
      refinementSuggestions: brief.refinementSuggestions,
      modelUsed: brief.metadata.modelUsed,
      promptVersion: brief.metadata.promptVersion,
      artifactHash: brief.metadata.artifactHash,
      tokenUsageInput: tokenUsage.input,
      tokenUsageOutput: tokenUsage.output,
      generationLatencyMs: latencyMs,
      status: 'draft',
      createdBy: userId,
    } as any);

    // Create artifact for reproducibility
    const briefContent = JSON.stringify(brief, null, 2);
    const artifactId = uuid();
    await db.insert(artifacts).values({
      id: artifactId,
      researchId: topic.researchId,
      stageId: 'research_brief',
      artifactType: 'analysis_output',
      filename: `research_brief_${briefId}.json`,
      mimeType: 'application/json',
      content: briefContent,
      sizeBytes: Buffer.byteLength(briefContent, 'utf8'),
      sha256Hash: brief.metadata.artifactHash,
      createdBy: userId,
      currentVersionId: null,
    } as any);

    res.json({
      success: true,
      brief: { id: briefId, ...brief },
      artifactId,
      message: 'Research brief generated successfully. Review and modify as needed.',
    });
  })
);

/**
 * Get Research Brief by ID
 * GET /api/research-briefs/:id
 */
router.get(
  '/:id',
  requireRole(ROLES.VIEWER),
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;

    if (!db) {
      throw new Error('Database not initialized');
    }

    const brief = await db.query.researchBriefs.findFirst({
      where: eq(researchBriefs.id, id),
    });

    if (!brief) {
      return res.status(404).json({
        error: 'Research brief not found',
        code: 'BRIEF_NOT_FOUND',
        briefId: id,
      });
    }

    res.json(brief);
  })
);

/**
 * Get all Research Briefs for a research project
 * GET /api/research-briefs/research/:researchId
 */
router.get(
  '/research/:researchId',
  requireRole(ROLES.VIEWER),
  asyncHandler(async (req: Request, res: Response) => {
    const { researchId } = req.params;

    if (!db) {
      throw new Error('Database not initialized');
    }

    const briefs = await db.query.researchBriefs.findMany({
      where: eq(researchBriefs.researchId, researchId),
      orderBy: [desc(researchBriefs.createdAt)],
    });

    res.json({
      researchId,
      briefs,
      total: briefs.length,
    });
  })
);

/**
 * Get all Research Briefs for a Topic
 * GET /api/research-briefs/topic/:topicId
 */
router.get(
  '/topic/:topicId',
  requireRole(ROLES.VIEWER),
  asyncHandler(async (req: Request, res: Response) => {
    const { topicId } = req.params;

    if (!db) {
      throw new Error('Database not initialized');
    }

    const briefs = await db.query.researchBriefs.findMany({
      where: eq(researchBriefs.topicId, topicId),
      orderBy: [desc(researchBriefs.createdAt)],
    });

    res.json({
      topicId,
      briefs,
      total: briefs.length,
    });
  })
);

/**
 * Validate Research Brief for approval
 * GET /api/research-briefs/:id/validate
 */
router.get(
  '/:id/validate',
  requireRole(ROLES.RESEARCHER),
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;

    if (!db) {
      throw new Error('Database not initialized');
    }

    const brief = await db.query.researchBriefs.findFirst({
      where: eq(researchBriefs.id, id),
    });

    if (!brief) {
      return res.status(404).json({
        error: 'Research brief not found',
        code: 'BRIEF_NOT_FOUND',
        briefId: id,
      });
    }

    // Convert DB record to brief format for validation
    const briefForValidation = {
      topicDeclarationId: brief.topicId,
      topicVersion: brief.topicVersion,
      researchId: brief.researchId,
      entryMode: brief.entryMode as 'quick' | 'pico' | undefined,
      convertedPICO: brief.convertedPico as any,
      summary: brief.summary || undefined,
      studyObjectives: brief.studyObjectives as string[],
      population: brief.population,
      exposure: brief.exposure,
      comparator: brief.comparator || '',
      outcomes: brief.outcomes as string[],
      timeframe: brief.timeframe || '',
      candidateEndpoints: brief.candidateEndpoints as any[],
      keyConfounders: brief.keyConfounders as string[],
      minimumDatasetFields: brief.minimumDatasetFields as any[],
      clarifyingPrompts: brief.clarifyingPrompts as string[],
      refinementSuggestions: brief.refinementSuggestions as any,
      metadata: {
        modelUsed: brief.modelUsed,
        promptVersion: brief.promptVersion,
        artifactHash: brief.artifactHash,
        tokenUsage: brief.tokenUsageInput
          ? {
              input: brief.tokenUsageInput,
              output: brief.tokenUsageOutput || 0,
              total: (brief.tokenUsageInput || 0) + (brief.tokenUsageOutput || 0),
            }
          : undefined,
        generationLatencyMs: brief.generationLatencyMs || undefined,
      },
      status: brief.status as 'draft' | 'reviewed' | 'approved',
      createdBy: brief.createdBy,
    };

    const validation = validateBriefForApproval(briefForValidation);

    res.json({
      briefId: id,
      ...validation,
    });
  })
);

/**
 * Approve Research Brief
 * POST /api/research-briefs/:id/approve
 */
router.post(
  '/:id/approve',
  requireRole(ROLES.STEWARD),
  logAuditEvent('RESEARCH_BRIEF_APPROVE', 'research-brief'),
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const userId = req.user?.id || 'system';

    if (!db) {
      throw new Error('Database not initialized');
    }

    const brief = await db.query.researchBriefs.findFirst({
      where: eq(researchBriefs.id, id),
    });

    if (!brief) {
      return res.status(404).json({
        error: 'Research brief not found',
        code: 'BRIEF_NOT_FOUND',
        briefId: id,
      });
    }

    if (brief.status === 'approved') {
      return res.status(400).json({
        error: 'Research brief already approved',
        code: 'ALREADY_APPROVED',
      });
    }

    // Update status
    await db
      .update(researchBriefs)
      .set({
        status: 'approved',
        approvedBy: userId,
        approvedAt: new Date(),
        updatedAt: new Date(),
      } as any)
      .where(eq(researchBriefs.id, id));

    res.json({
      success: true,
      message: 'Research brief approved',
      briefId: id,
      approvedBy: userId,
      approvedAt: new Date().toISOString(),
    });
  })
);

/**
 * Mark Research Brief as reviewed
 * POST /api/research-briefs/:id/review
 */
router.post(
  '/:id/review',
  requireRole(ROLES.RESEARCHER),
  logAuditEvent('RESEARCH_BRIEF_REVIEW', 'research-brief'),
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const userId = req.user?.id || 'system';

    if (!db) {
      throw new Error('Database not initialized');
    }

    const brief = await db.query.researchBriefs.findFirst({
      where: eq(researchBriefs.id, id),
    });

    if (!brief) {
      return res.status(404).json({
        error: 'Research brief not found',
        code: 'BRIEF_NOT_FOUND',
        briefId: id,
      });
    }

    if (brief.status === 'approved') {
      return res.status(400).json({
        error: 'Cannot change status of approved brief',
        code: 'ALREADY_APPROVED',
      });
    }

    // Update status
    await db
      .update(researchBriefs)
      .set({
        status: 'reviewed',
        updatedAt: new Date(),
      } as any)
      .where(eq(researchBriefs.id, id));

    res.json({
      success: true,
      message: 'Research brief marked as reviewed',
      briefId: id,
      reviewedBy: userId,
    });
  })
);

/**
 * Delete Research Brief (draft only)
 * DELETE /api/research-briefs/:id
 */
router.delete(
  '/:id',
  requireRole(ROLES.RESEARCHER),
  logAuditEvent('RESEARCH_BRIEF_DELETE', 'research-brief'),
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;

    if (!db) {
      throw new Error('Database not initialized');
    }

    const brief = await db.query.researchBriefs.findFirst({
      where: eq(researchBriefs.id, id),
    });

    if (!brief) {
      return res.status(404).json({
        error: 'Research brief not found',
        code: 'BRIEF_NOT_FOUND',
        briefId: id,
      });
    }

    if (brief.status === 'approved') {
      return res.status(400).json({
        error: 'Cannot delete approved research brief',
        code: 'CANNOT_DELETE_APPROVED',
      });
    }

    // Delete from database (cascade will handle artifacts)
    await db.delete(researchBriefs).where(eq(researchBriefs.id, id));

    res.json({
      success: true,
      message: 'Research brief deleted',
      briefId: id,
    });
  })
);

export default router;
