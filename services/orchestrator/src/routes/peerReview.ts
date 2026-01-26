/**
 * Peer Review Routes (Task 87)
 * Formal peer review system with scored rubrics
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import * as peerReviewService from '../services/peerReviewService';

const router = Router();

// ---------------------------------------------------------------------------
// Rubric Routes
// ---------------------------------------------------------------------------

/**
 * GET /api/rubrics/templates
 * Get available rubric templates
 */
router.get('/rubrics/templates', async (req: Request, res: Response) => {
  try {
    const templates = peerReviewService.getRubricTemplates();
    return res.json({ templates });
  } catch (error) {
    console.error('Get templates error:', error);
    return res.status(500).json({ error: 'Failed to get templates' });
  }
});

/**
 * GET /api/research/:researchId/rubrics
 * Get rubrics for a research project
 */
router.get('/research/:researchId/rubrics', async (req: Request, res: Response) => {
  try {
    const { researchId } = req.params;
    const rubrics = peerReviewService.getResearchRubrics(researchId);
    return res.json({ rubrics });
  } catch (error) {
    console.error('Get rubrics error:', error);
    return res.status(500).json({ error: 'Failed to get rubrics' });
  }
});

/**
 * POST /api/research/:researchId/rubrics
 * Create a rubric
 */
router.post('/research/:researchId/rubrics', async (req: Request, res: Response) => {
  try {
    const { researchId } = req.params;
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const input = z.object({
      name: z.string().max(200),
      description: z.string().max(1000).optional(),
      criteria: z.array(z.object({
        name: z.string().max(200),
        description: z.string().max(1000).optional(),
        type: peerReviewService.RubricCriterionTypeSchema,
        weight: z.number().min(0).max(100).default(1),
        required: z.boolean().default(true),
        order: z.number().int().min(0),
        scaleMin: z.number().optional(),
        scaleMax: z.number().optional(),
        scaleLabels: z.record(z.number(), z.string()).optional(),
        gradeOptions: z.array(z.string()).optional(),
        checklistItems: z.array(z.string()).optional(),
      })),
    }).parse(req.body);

    const rubric = peerReviewService.createRubric({
      ...input,
      researchId,
      isTemplate: false,
    }, userId);

    return res.status(201).json(rubric);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    console.error('Create rubric error:', error);
    return res.status(500).json({ error: 'Failed to create rubric' });
  }
});

/**
 * POST /api/research/:researchId/rubrics/from-template
 * Create rubric from template
 */
router.post('/research/:researchId/rubrics/from-template', async (req: Request, res: Response) => {
  try {
    const { researchId } = req.params;
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { templateId } = z.object({
      templateId: z.string().uuid(),
    }).parse(req.body);

    const rubric = peerReviewService.copyRubricFromTemplate(templateId, researchId, userId);

    if (!rubric) {
      return res.status(404).json({ error: 'Template not found' });
    }

    return res.status(201).json(rubric);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    console.error('Copy template error:', error);
    return res.status(500).json({ error: 'Failed to copy template' });
  }
});

/**
 * GET /api/rubrics/:rubricId
 * Get rubric details
 */
router.get('/rubrics/:rubricId', async (req: Request, res: Response) => {
  try {
    const { rubricId } = req.params;
    const rubric = peerReviewService.getRubric(rubricId);

    if (!rubric) {
      return res.status(404).json({ error: 'Rubric not found' });
    }

    return res.json(rubric);
  } catch (error) {
    console.error('Get rubric error:', error);
    return res.status(500).json({ error: 'Failed to get rubric' });
  }
});

// ---------------------------------------------------------------------------
// Assignment Routes
// ---------------------------------------------------------------------------

/**
 * POST /api/submissions/:submissionId/review-assignments
 * Create review assignment
 */
router.post('/submissions/:submissionId/review-assignments', async (req: Request, res: Response) => {
  try {
    const { submissionId } = req.params;
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const input = z.object({
      reviewerId: z.string().uuid(),
      rubricId: z.string().uuid(),
      blindMode: peerReviewService.ReviewBlindModeSchema.optional(),
      dueDate: z.string().datetime().optional(),
    }).parse(req.body);

    const assignment = peerReviewService.createReviewAssignment(
      submissionId,
      input.reviewerId,
      input.rubricId,
      userId,
      { blindMode: input.blindMode, dueDate: input.dueDate }
    );

    return res.status(201).json(assignment);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    console.error('Create assignment error:', error);
    return res.status(500).json({ error: 'Failed to create assignment' });
  }
});

/**
 * GET /api/submissions/:submissionId/review-assignments
 * Get assignments for submission
 */
router.get('/submissions/:submissionId/review-assignments', async (req: Request, res: Response) => {
  try {
    const { submissionId } = req.params;
    const assignments = peerReviewService.getAssignmentsBySubmission(submissionId);
    return res.json({ assignments });
  } catch (error) {
    console.error('Get assignments error:', error);
    return res.status(500).json({ error: 'Failed to get assignments' });
  }
});

/**
 * GET /api/me/review-assignments
 * Get current user's review assignments
 */
router.get('/me/review-assignments', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const assignments = peerReviewService.getAssignmentsByReviewer(userId);
    return res.json({ assignments });
  } catch (error) {
    console.error('Get my assignments error:', error);
    return res.status(500).json({ error: 'Failed to get assignments' });
  }
});

/**
 * GET /api/review-assignments/:assignmentId
 * Get assignment details
 */
router.get('/review-assignments/:assignmentId', async (req: Request, res: Response) => {
  try {
    const { assignmentId } = req.params;
    const userId = req.user?.id;
    const isEditor = req.user?.role === 'STEWARD' || req.user?.role === 'ADMIN';

    const assignment = peerReviewService.getAssignment(assignmentId);
    if (!assignment) {
      return res.status(404).json({ error: 'Assignment not found' });
    }

    const rubric = peerReviewService.getRubric(assignment.rubricId);
    const score = peerReviewService.getReviewScore(assignmentId);
    const reviewerInfo = peerReviewService.getReviewerDisplayInfo(assignment, userId!, isEditor);

    return res.json({
      assignment,
      rubric,
      score,
      reviewer: reviewerInfo,
    });
  } catch (error) {
    console.error('Get assignment error:', error);
    return res.status(500).json({ error: 'Failed to get assignment' });
  }
});

/**
 * POST /api/review-assignments/:assignmentId/start
 * Start a review
 */
router.post('/review-assignments/:assignmentId/start', async (req: Request, res: Response) => {
  try {
    const { assignmentId } = req.params;
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const assignment = peerReviewService.startReview(assignmentId, userId);
    if (!assignment) {
      return res.status(404).json({ error: 'Assignment not found or cannot be started' });
    }

    return res.json(assignment);
  } catch (error) {
    console.error('Start review error:', error);
    return res.status(500).json({ error: 'Failed to start review' });
  }
});

/**
 * POST /api/review-assignments/:assignmentId/decline
 * Decline a review
 */
router.post('/review-assignments/:assignmentId/decline', async (req: Request, res: Response) => {
  try {
    const { assignmentId } = req.params;
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { reason } = z.object({
      reason: z.string().max(500).optional(),
    }).parse(req.body);

    const assignment = peerReviewService.declineReview(assignmentId, userId, reason);
    if (!assignment) {
      return res.status(404).json({ error: 'Assignment not found or cannot be declined' });
    }

    return res.json(assignment);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    console.error('Decline review error:', error);
    return res.status(500).json({ error: 'Failed to decline review' });
  }
});

// ---------------------------------------------------------------------------
// Score Routes
// ---------------------------------------------------------------------------

/**
 * PUT /api/review-assignments/:assignmentId/score
 * Save review score (draft or final)
 */
router.put('/review-assignments/:assignmentId/score', async (req: Request, res: Response) => {
  try {
    const { assignmentId } = req.params;
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const input = z.object({
      scores: z.array(peerReviewService.CriterionScoreSchema),
      overallComment: z.string().max(5000).optional(),
      confidentialComment: z.string().max(2000).optional(),
      recommendation: z.enum(['ACCEPT', 'MINOR_REVISION', 'MAJOR_REVISION', 'REJECT', 'ABSTAIN']).optional(),
      confidenceLevel: z.enum(['LOW', 'MEDIUM', 'HIGH']).optional(),
    }).parse(req.body);

    const score = peerReviewService.saveReviewScore(assignmentId, userId, input);
    if (!score) {
      return res.status(404).json({ error: 'Assignment not found or not authorized' });
    }

    return res.json(score);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    console.error('Save score error:', error);
    return res.status(500).json({ error: 'Failed to save score' });
  }
});

/**
 * POST /api/review-assignments/:assignmentId/submit
 * Submit completed review
 */
router.post('/review-assignments/:assignmentId/submit', async (req: Request, res: Response) => {
  try {
    const { assignmentId } = req.params;
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const result = peerReviewService.submitReviewScore(assignmentId, userId);
    if (!result) {
      return res.status(400).json({ error: 'Review is incomplete or cannot be submitted' });
    }

    return res.json(result);
  } catch (error) {
    console.error('Submit review error:', error);
    return res.status(500).json({ error: 'Failed to submit review' });
  }
});

// ---------------------------------------------------------------------------
// Summary Routes
// ---------------------------------------------------------------------------

/**
 * GET /api/submissions/:submissionId/review-summary
 * Get aggregated review summary
 */
router.get('/submissions/:submissionId/review-summary', async (req: Request, res: Response) => {
  try {
    const { submissionId } = req.params;
    const summary = peerReviewService.getReviewSummary(submissionId);

    if (!summary) {
      return res.status(404).json({ error: 'No reviews found' });
    }

    return res.json(summary);
  } catch (error) {
    console.error('Get summary error:', error);
    return res.status(500).json({ error: 'Failed to get review summary' });
  }
});

export default router;
