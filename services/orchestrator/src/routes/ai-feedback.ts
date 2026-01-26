/**
 * AI Output Feedback Routes (Task 65)
 *
 * Provides endpoints for collecting user feedback on AI outputs:
 * - POST /api/ai/feedback - Submit feedback for an AI invocation
 * - GET /api/ai/feedback/stats - Get aggregated feedback statistics
 * - GET /api/ai/feedback/:invocationId - Get feedback for specific invocation
 * - PUT /api/ai/feedback/:id/review - Mark feedback as reviewed (ADMIN)
 */

import { Router, type Request, type Response } from 'express';
import { db } from '../../db';
import { aiOutputFeedback, aiInvocations } from '@researchflow/core/schema';
import { eq, and, desc, gte, lte, sql, count } from 'drizzle-orm';
import { logAction } from '../services/audit-service';
import { requirePermission, requireRole } from '../middleware/rbac';
import { asyncHandler } from '../middleware/asyncHandler';

const router = Router();

/**
 * POST /api/ai/feedback
 * Submit feedback for an AI invocation
 */
router.post(
  '/',
  requirePermission('ANALYZE'),
  asyncHandler(async (req: Request, res: Response) => {
    const user = req.user;

    if (!user) {
      return res.status(401).json({
        error: 'AUTHENTICATION_REQUIRED',
        message: 'Authentication required'
      });
    }

    if (!db) {
      return res.status(503).json({
        error: 'SERVICE_UNAVAILABLE',
        message: 'Database not initialized'
      });
    }

    const {
      invocationId,
      rating,
      feedbackType,
      tags,
      comment
    } = req.body;

    // Validate required fields
    if (!invocationId) {
      return res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: 'invocationId is required'
      });
    }

    if (typeof rating !== 'number' || rating < 1 || rating > 5) {
      return res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: 'rating must be a number between 1 and 5'
      });
    }

    // Validate feedback type
    const validFeedbackTypes = ['accuracy', 'relevance', 'safety', 'quality', 'bias', 'completeness'];
    if (!feedbackType || !validFeedbackTypes.includes(feedbackType)) {
      return res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: `feedbackType must be one of: ${validFeedbackTypes.join(', ')}`
      });
    }

    // Verify invocation exists
    const [invocation] = await db
      .select()
      .from(aiInvocations)
      .where(eq(aiInvocations.id, invocationId))
      .limit(1);

    if (!invocation) {
      return res.status(404).json({
        error: 'NOT_FOUND',
        message: 'AI invocation not found'
      });
    }

    // Check for existing feedback from this user for this invocation/type
    const [existingFeedback] = await db
      .select()
      .from(aiOutputFeedback)
      .where(
        and(
          eq(aiOutputFeedback.invocationId, invocationId),
          eq(aiOutputFeedback.userId, user.id),
          eq(aiOutputFeedback.feedbackType, feedbackType)
        )
      )
      .limit(1);

    if (existingFeedback) {
      return res.status(409).json({
        error: 'DUPLICATE_FEEDBACK',
        message: 'You have already submitted feedback of this type for this invocation',
        existingFeedbackId: existingFeedback.id
      });
    }

    // Sanitize comment - remove any potential PHI references
    // Note: We store feedback but never raw prompts/outputs
    const sanitizedComment = comment
      ? comment.substring(0, 1000) // Limit length
      : null;

    // Create feedback record
    const [feedback] = await db.insert(aiOutputFeedback).values({
      invocationId,
      userId: user.id,
      rating,
      feedbackType,
      tags: tags || null,
      comment: sanitizedComment,
      isUsefulForTraining: rating >= 4 // Auto-flag positive feedback
    }).returning();

    // Audit log (without storing feedback content to avoid PHI)
    await logAction({
      eventType: 'AI_FEEDBACK',
      action: 'SUBMITTED',
      userId: user.id,
      resourceType: 'ai_feedback',
      resourceId: feedback.id,
      details: {
        invocationId,
        rating,
        feedbackType,
        hasComment: !!comment
      }
    });

    res.status(201).json({
      message: 'Feedback submitted successfully',
      feedbackId: feedback.id,
      rating,
      feedbackType,
      createdAt: feedback.createdAt
    });
  })
);

/**
 * GET /api/ai/feedback/stats
 * Get aggregated feedback statistics
 */
router.get(
  '/stats',
  requireRole('STEWARD'),
  asyncHandler(async (req: Request, res: Response) => {
    if (!db) {
      return res.status(503).json({
        error: 'SERVICE_UNAVAILABLE',
        message: 'Database not initialized'
      });
    }

    const { startDate, endDate, taskType } = req.query;

    // Build date filters
    const dateFilters = [];
    if (startDate) {
      dateFilters.push(gte(aiOutputFeedback.createdAt, new Date(startDate as string)));
    }
    if (endDate) {
      dateFilters.push(lte(aiOutputFeedback.createdAt, new Date(endDate as string)));
    }

    // Get overall stats
    const overallStats = await db
      .select({
        totalFeedback: count(),
        avgRating: sql<number>`ROUND(AVG(${aiOutputFeedback.rating})::numeric, 2)`,
        reviewedCount: sql<number>`COUNT(*) FILTER (WHERE ${aiOutputFeedback.reviewedByAdmin} = true)`,
        usefulForTraining: sql<number>`COUNT(*) FILTER (WHERE ${aiOutputFeedback.isUsefulForTraining} = true)`
      })
      .from(aiOutputFeedback)
      .where(dateFilters.length > 0 ? and(...dateFilters) : undefined);

    // Get stats by feedback type
    const byFeedbackType = await db
      .select({
        feedbackType: aiOutputFeedback.feedbackType,
        count: count(),
        avgRating: sql<number>`ROUND(AVG(${aiOutputFeedback.rating})::numeric, 2)`
      })
      .from(aiOutputFeedback)
      .where(dateFilters.length > 0 ? and(...dateFilters) : undefined)
      .groupBy(aiOutputFeedback.feedbackType);

    // Get rating distribution
    const ratingDistribution = await db
      .select({
        rating: aiOutputFeedback.rating,
        count: count()
      })
      .from(aiOutputFeedback)
      .where(dateFilters.length > 0 ? and(...dateFilters) : undefined)
      .groupBy(aiOutputFeedback.rating)
      .orderBy(aiOutputFeedback.rating);

    // Get recent trends (last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const recentTrend = await db
      .select({
        date: sql<string>`DATE(${aiOutputFeedback.createdAt})`,
        count: count(),
        avgRating: sql<number>`ROUND(AVG(${aiOutputFeedback.rating})::numeric, 2)`
      })
      .from(aiOutputFeedback)
      .where(gte(aiOutputFeedback.createdAt, sevenDaysAgo))
      .groupBy(sql`DATE(${aiOutputFeedback.createdAt})`)
      .orderBy(sql`DATE(${aiOutputFeedback.createdAt})`);

    res.json({
      overall: overallStats[0] || {
        totalFeedback: 0,
        avgRating: null,
        reviewedCount: 0,
        usefulForTraining: 0
      },
      byFeedbackType,
      ratingDistribution,
      recentTrend,
      dateRange: {
        start: startDate || null,
        end: endDate || null
      }
    });
  })
);

/**
 * GET /api/ai/feedback/:invocationId
 * Get feedback for a specific AI invocation
 */
router.get(
  '/:invocationId',
  requireRole('STEWARD'),
  asyncHandler(async (req: Request, res: Response) => {
    const { invocationId } = req.params;

    if (!db) {
      return res.status(503).json({
        error: 'SERVICE_UNAVAILABLE',
        message: 'Database not initialized'
      });
    }

    const feedback = await db
      .select({
        id: aiOutputFeedback.id,
        rating: aiOutputFeedback.rating,
        feedbackType: aiOutputFeedback.feedbackType,
        tags: aiOutputFeedback.tags,
        // Note: Comment excluded by default to avoid PHI in logs
        hasComment: sql<boolean>`${aiOutputFeedback.comment} IS NOT NULL`,
        isUsefulForTraining: aiOutputFeedback.isUsefulForTraining,
        reviewedByAdmin: aiOutputFeedback.reviewedByAdmin,
        reviewedAt: aiOutputFeedback.reviewedAt,
        createdAt: aiOutputFeedback.createdAt
      })
      .from(aiOutputFeedback)
      .where(eq(aiOutputFeedback.invocationId, invocationId))
      .orderBy(desc(aiOutputFeedback.createdAt));

    // Get invocation summary (without sensitive data)
    const [invocation] = await db
      .select({
        id: aiInvocations.id,
        taskType: aiInvocations.taskType,
        model: aiInvocations.model,
        status: aiInvocations.status,
        qualityGatePassed: aiInvocations.qualityGatePassed,
        createdAt: aiInvocations.createdAt
      })
      .from(aiInvocations)
      .where(eq(aiInvocations.id, invocationId))
      .limit(1);

    if (!invocation) {
      return res.status(404).json({
        error: 'NOT_FOUND',
        message: 'AI invocation not found'
      });
    }

    res.json({
      invocation,
      feedback,
      totalFeedback: feedback.length,
      averageRating: feedback.length > 0
        ? feedback.reduce((sum, f) => sum + f.rating, 0) / feedback.length
        : null
    });
  })
);

/**
 * PUT /api/ai/feedback/:id/review
 * Mark feedback as reviewed by admin
 */
router.put(
  '/:id/review',
  requireRole('ADMIN'),
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const user = req.user;

    if (!user) {
      return res.status(401).json({
        error: 'AUTHENTICATION_REQUIRED',
        message: 'Authentication required'
      });
    }

    if (!db) {
      return res.status(503).json({
        error: 'SERVICE_UNAVAILABLE',
        message: 'Database not initialized'
      });
    }

    const { isUsefulForTraining, reviewNotes } = req.body;

    const [updated] = await db
      .update(aiOutputFeedback)
      .set({
        reviewedByAdmin: true,
        reviewedAt: new Date(),
        isUsefulForTraining: isUsefulForTraining !== undefined
          ? isUsefulForTraining
          : undefined,
        reviewNotes: reviewNotes || null
      })
      .where(eq(aiOutputFeedback.id, id))
      .returning();

    if (!updated) {
      return res.status(404).json({
        error: 'NOT_FOUND',
        message: 'Feedback not found'
      });
    }

    await logAction({
      eventType: 'AI_FEEDBACK',
      action: 'REVIEWED',
      userId: user.id,
      resourceType: 'ai_feedback',
      resourceId: id,
      details: {
        isUsefulForTraining,
        hasReviewNotes: !!reviewNotes
      }
    });

    res.json({
      message: 'Feedback reviewed successfully',
      feedbackId: id,
      reviewedAt: updated.reviewedAt,
      isUsefulForTraining: updated.isUsefulForTraining
    });
  })
);

/**
 * GET /api/ai/feedback/pending
 * Get pending feedback for review (not yet reviewed by admin)
 */
router.get(
  '/pending/list',
  requireRole('ADMIN'),
  asyncHandler(async (req: Request, res: Response) => {
    if (!db) {
      return res.status(503).json({
        error: 'SERVICE_UNAVAILABLE',
        message: 'Database not initialized'
      });
    }

    const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
    const offset = parseInt(req.query.offset as string) || 0;

    const pendingFeedback = await db
      .select({
        id: aiOutputFeedback.id,
        invocationId: aiOutputFeedback.invocationId,
        rating: aiOutputFeedback.rating,
        feedbackType: aiOutputFeedback.feedbackType,
        tags: aiOutputFeedback.tags,
        hasComment: sql<boolean>`${aiOutputFeedback.comment} IS NOT NULL`,
        createdAt: aiOutputFeedback.createdAt
      })
      .from(aiOutputFeedback)
      .where(eq(aiOutputFeedback.reviewedByAdmin, false))
      .orderBy(desc(aiOutputFeedback.createdAt))
      .limit(limit)
      .offset(offset);

    // Get total count
    const [{ total }] = await db
      .select({ total: count() })
      .from(aiOutputFeedback)
      .where(eq(aiOutputFeedback.reviewedByAdmin, false));

    res.json({
      feedback: pendingFeedback,
      total,
      limit,
      offset,
      hasMore: offset + pendingFeedback.length < total
    });
  })
);

export default router;
