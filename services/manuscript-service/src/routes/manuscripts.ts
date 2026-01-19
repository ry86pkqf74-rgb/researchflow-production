/**
 * Manuscript Routes
 * API endpoints for manuscript CRUD and job operations
 */

import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';
import { requireUserContext } from '../auth';
import { manuscriptStore } from '../services/manuscript-store';
import { diffService } from '../services/diff.service';
import { sanitizePhiFindings } from '../services/phi-sanitize';
import {
  addManuscriptJob,
  getJobStatus,
  getQueueStats,
} from '../queues/manuscript.queue';
import {
  CreateManuscriptRequestSchema,
  ExportOptionsSchema,
} from '../types/api.types';
import {
  ManuscriptJobType,
  GenerateOutlineJobSchema,
  DraftIntroJobSchema,
  ExportJobSchema,
  PeerReviewJobSchema,
  PlagiarismCheckJobSchema,
  ClaimVerifyJobSchema,
} from '../types/job.types';

const router = Router();

// Apply user context requirement to all routes
router.use(requireUserContext);

/**
 * POST /api/manuscripts
 * Create a new manuscript
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const validation = CreateManuscriptRequestSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        error: 'Invalid request',
        details: validation.error.errors,
      });
    }

    const { researchId, title, templateType, journalTarget, wordLimits, style } = validation.data;

    const result = await manuscriptStore.createManuscript({
      researchId,
      userId: req.userContext!.userId,
      title,
      templateType,
      journalTarget,
      wordLimits,
    });

    res.status(201).json({
      success: true,
      manuscriptId: result.artifactId,
      versionId: result.versionId,
    });
  } catch (error) {
    console.error('[Manuscripts] Create error:', error);
    res.status(500).json({
      error: 'Failed to create manuscript',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/manuscripts/:id
 * Get manuscript by ID
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const manuscript = await manuscriptStore.getManuscript(req.params.id);

    if (!manuscript) {
      return res.status(404).json({ error: 'Manuscript not found' });
    }

    res.json({
      id: manuscript.artifactId,
      researchId: manuscript.researchId,
      currentVersionId: manuscript.currentVersionId,
      versionNumber: manuscript.versionNumber,
      content: manuscript.content,
      createdAt: manuscript.createdAt,
      updatedAt: manuscript.updatedAt,
    });
  } catch (error) {
    console.error('[Manuscripts] Get error:', error);
    res.status(500).json({
      error: 'Failed to get manuscript',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/manuscripts/:id/versions
 * Get version history
 */
router.get('/:id/versions', async (req: Request, res: Response) => {
  try {
    const versions = await manuscriptStore.getVersionHistory(req.params.id);
    res.json({ versions });
  } catch (error) {
    console.error('[Manuscripts] Versions error:', error);
    res.status(500).json({
      error: 'Failed to get versions',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/manuscripts/:id/diff
 * Get diff between versions
 */
router.get('/:id/diff', async (req: Request, res: Response) => {
  try {
    const { fromVersionId, toVersionId } = req.query;

    if (!fromVersionId || !toVersionId) {
      return res.status(400).json({
        error: 'fromVersionId and toVersionId query parameters required',
      });
    }

    // Get both versions
    const [fromVersion, toVersion] = await Promise.all([
      manuscriptStore.getVersion(fromVersionId as string),
      manuscriptStore.getVersion(toVersionId as string),
    ]);

    if (!fromVersion || !toVersion) {
      return res.status(404).json({ error: 'Version not found' });
    }

    // Generate diff
    const diffResult = diffService.generateDiff(fromVersion.content, toVersion.content);

    // Store comparison
    const comparisonId = await manuscriptStore.storeComparison({
      artifactId: req.params.id,
      fromVersionId: fromVersionId as string,
      toVersionId: toVersionId as string,
      comparisonData: diffResult,
      userId: req.userContext!.userId,
    });

    res.json({
      fromVersionId,
      toVersionId,
      manuscriptId: req.params.id,
      comparisonId,
      diff: diffResult.diff,
      summary: diffResult.summary,
      createdAt: new Date(),
    });
  } catch (error) {
    console.error('[Manuscripts] Diff error:', error);
    res.status(500).json({
      error: 'Failed to generate diff',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * POST /api/manuscripts/:id/outline
 * Enqueue outline generation job
 */
router.post('/:id/outline', async (req: Request, res: Response) => {
  try {
    const validation = z.object({
      templateType: z.enum(['research_article', 'case_report', 'review', 'letter', 'meta_analysis']).optional(),
      journalTarget: z.string().optional(),
    }).safeParse(req.body);

    if (!validation.success) {
      return res.status(400).json({
        error: 'Invalid request',
        details: validation.error.errors,
      });
    }

    const jobId = await addManuscriptJob({
      type: ManuscriptJobType.GENERATE_OUTLINE,
      manuscriptId: req.params.id,
      userId: req.userContext!.userId,
      templateType: validation.data.templateType || 'research_article',
      journalTarget: validation.data.journalTarget,
    });

    res.status(202).json({
      success: true,
      jobId,
      status: 'pending',
      message: 'Outline generation job queued',
    });
  } catch (error) {
    console.error('[Manuscripts] Outline error:', error);
    res.status(500).json({
      error: 'Failed to queue outline job',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * POST /api/manuscripts/:id/intro
 * Enqueue introduction draft job
 */
router.post('/:id/intro', async (req: Request, res: Response) => {
  try {
    const validation = z.object({
      section: z.enum(['abstract', 'introduction', 'methods', 'results', 'discussion', 'conclusion']).default('introduction'),
      wordLimit: z.number().max(3000).optional(),
      literatureIds: z.array(z.string()).optional(),
    }).safeParse(req.body);

    if (!validation.success) {
      return res.status(400).json({
        error: 'Invalid request',
        details: validation.error.errors,
      });
    }

    const jobId = await addManuscriptJob({
      type: ManuscriptJobType.DRAFT_INTRO_WITH_LIT,
      manuscriptId: req.params.id,
      userId: req.userContext!.userId,
      section: validation.data.section,
      wordLimit: validation.data.wordLimit,
      literatureIds: validation.data.literatureIds,
    });

    res.status(202).json({
      success: true,
      jobId,
      status: 'pending',
      message: `${validation.data.section} draft job queued`,
    });
  } catch (error) {
    console.error('[Manuscripts] Intro error:', error);
    res.status(500).json({
      error: 'Failed to queue draft job',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * POST /api/manuscripts/:id/review
 * Enqueue peer review simulation job
 */
router.post('/:id/review', async (req: Request, res: Response) => {
  try {
    const validation = z.object({
      reviewerProfiles: z.array(z.enum(['methodology', 'clinical', 'statistical', 'general'])).optional(),
      focusSections: z.array(z.string()).optional(),
    }).safeParse(req.body);

    if (!validation.success) {
      return res.status(400).json({
        error: 'Invalid request',
        details: validation.error.errors,
      });
    }

    const jobId = await addManuscriptJob({
      type: ManuscriptJobType.SIMULATE_PEER_REVIEW,
      manuscriptId: req.params.id,
      userId: req.userContext!.userId,
      reviewerProfiles: validation.data.reviewerProfiles || ['methodology', 'clinical'],
      focusSections: validation.data.focusSections,
    });

    res.status(202).json({
      success: true,
      jobId,
      status: 'pending',
      message: 'Peer review simulation job queued',
    });
  } catch (error) {
    console.error('[Manuscripts] Review error:', error);
    res.status(500).json({
      error: 'Failed to queue review job',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * POST /api/manuscripts/:id/export
 * Enqueue export job (with PHI scan gate)
 */
router.post('/:id/export', async (req: Request, res: Response) => {
  try {
    const validation = ExportOptionsSchema.safeParse(req.body);

    if (!validation.success) {
      return res.status(400).json({
        error: 'Invalid request',
        details: validation.error.errors,
      });
    }

    // Get manuscript to verify it exists and get researchId
    const manuscript = await manuscriptStore.getManuscript(req.params.id);
    if (!manuscript) {
      return res.status(404).json({ error: 'Manuscript not found' });
    }

    const jobId = await addManuscriptJob({
      type: ManuscriptJobType.EXPORT_MANUSCRIPT,
      manuscriptId: req.params.id,
      userId: req.userContext!.userId,
      researchId: manuscript.researchId,
      format: validation.data.format,
      blinded: validation.data.blinded,
      includeLineNumbers: validation.data.includeLineNumbers,
      doubleSpaced: validation.data.doubleSpaced,
    });

    res.status(202).json({
      success: true,
      jobId,
      status: 'pending',
      message: 'Export job queued (PHI scan will be performed)',
    });
  } catch (error) {
    console.error('[Manuscripts] Export error:', error);
    res.status(500).json({
      error: 'Failed to queue export job',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * POST /api/manuscripts/:id/plagiarism
 * Enqueue plagiarism check job
 */
router.post('/:id/plagiarism', async (req: Request, res: Response) => {
  try {
    const validation = z.object({
      checkScope: z.enum(['full', 'introduction', 'methods', 'discussion']).optional(),
      checkAgainst: z.enum(['existing_citations', 'pubmed_corpus', 'manuscript_database', 'all']).optional(),
    }).safeParse(req.body);

    if (!validation.success) {
      return res.status(400).json({
        error: 'Invalid request',
        details: validation.error.errors,
      });
    }

    const jobId = await addManuscriptJob({
      type: ManuscriptJobType.PLAGIARISM_CHECK,
      manuscriptId: req.params.id,
      userId: req.userContext!.userId,
      checkScope: validation.data.checkScope || 'full',
      checkAgainst: validation.data.checkAgainst || 'all',
    });

    res.status(202).json({
      success: true,
      jobId,
      status: 'pending',
      message: 'Plagiarism check job queued',
    });
  } catch (error) {
    console.error('[Manuscripts] Plagiarism error:', error);
    res.status(500).json({
      error: 'Failed to queue plagiarism job',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * POST /api/manuscripts/:id/comments/summarize
 * Enqueue comment summarization job
 */
router.post('/:id/comments/summarize', async (req: Request, res: Response) => {
  try {
    const validation = z.object({
      comments: z.array(z.object({
        section: z.string(),
        comment: z.string(),
        type: z.enum(['major', 'minor', 'suggestion']).optional(),
      })),
    }).safeParse(req.body);

    if (!validation.success) {
      return res.status(400).json({
        error: 'Invalid request',
        details: validation.error.errors,
      });
    }

    const jobId = await addManuscriptJob({
      type: ManuscriptJobType.SUMMARIZE_COMMENTS,
      manuscriptId: req.params.id,
      userId: req.userContext!.userId,
      metadata: { comments: validation.data.comments },
    } as any);

    res.status(202).json({
      success: true,
      jobId,
      status: 'pending',
      message: 'Comment summarization job queued',
    });
  } catch (error) {
    console.error('[Manuscripts] Summarize error:', error);
    res.status(500).json({
      error: 'Failed to queue summarize job',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/manuscripts/jobs/:jobId
 * Get job status
 */
router.get('/jobs/:jobId', async (req: Request, res: Response) => {
  try {
    const status = getJobStatus(req.params.jobId);

    if (!status) {
      return res.status(404).json({ error: 'Job not found' });
    }

    res.json(status);
  } catch (error) {
    console.error('[Manuscripts] Job status error:', error);
    res.status(500).json({
      error: 'Failed to get job status',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/manuscripts/queue/stats
 * Get queue statistics
 */
router.get('/queue/stats', async (req: Request, res: Response) => {
  try {
    const stats = await getQueueStats();
    res.json(stats);
  } catch (error) {
    console.error('[Manuscripts] Queue stats error:', error);
    res.status(500).json({
      error: 'Failed to get queue stats',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;
