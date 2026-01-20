/**
 * Watermark Verification API Routes
 *
 * Provides endpoints for verifying AI-generated content watermarks
 * and managing watermark configuration.
 *
 * Tasks: 96-115 (AI Output Watermarking)
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { getWatermarkService, WatermarkVerification } from '@researchflow/ai-router/watermark.service';
import { logAction } from '../services/auditService.js';

const router = Router();

// Request schemas
const VerifyRequestSchema = z.object({
  content: z.union([z.string(), z.record(z.unknown())]),
});

const EmbedRequestSchema = z.object({
  content: z.union([z.string(), z.record(z.unknown())]),
  metadata: z.object({
    invocationId: z.string(),
    modelId: z.string(),
    userId: z.string().optional(),
  }),
});

/**
 * POST /api/ai/watermark/verify
 *
 * Verify if content contains a valid ResearchFlow watermark
 */
router.post('/verify', async (req: Request, res: Response) => {
  try {
    const parseResult = VerifyRequestSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        success: false,
        error: 'Invalid request body',
        details: parseResult.error.errors,
      });
    }

    const { content } = parseResult.data;
    const watermarkService = getWatermarkService();
    const verification: WatermarkVerification = watermarkService.verify(content);

    // Log verification attempt
    await logAction({
      action: 'WATERMARK_VERIFY',
      userId: (req as any).user?.id || 'anonymous',
      resourceType: 'content',
      resourceId: verification.metadata?.invocationId || 'unknown',
      details: {
        verified: verification.verified,
        confidence: verification.confidence,
        modelId: verification.metadata?.modelId,
      },
    });

    return res.json({
      success: true,
      verification: {
        verified: verification.verified,
        confidence: verification.confidence,
        error: verification.error,
        metadata: verification.metadata ? {
          invocationId: verification.metadata.invocationId,
          modelId: verification.metadata.modelId,
          timestamp: verification.metadata.timestamp
            ? new Date(verification.metadata.timestamp).toISOString()
            : null,
          version: verification.metadata.version,
        } : null,
      },
    });
  } catch (error) {
    console.error('Watermark verification error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error during verification',
    });
  }
});

/**
 * POST /api/ai/watermark/extract
 *
 * Extract watermark metadata from content without verifying signature
 */
router.post('/extract', async (req: Request, res: Response) => {
  try {
    const parseResult = VerifyRequestSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        success: false,
        error: 'Invalid request body',
        details: parseResult.error.errors,
      });
    }

    const { content } = parseResult.data;
    const watermarkService = getWatermarkService();
    const metadata = watermarkService.extract(content);

    if (!metadata) {
      return res.json({
        success: true,
        hasWatermark: false,
        metadata: null,
      });
    }

    return res.json({
      success: true,
      hasWatermark: true,
      metadata: {
        invocationId: metadata.invocationId,
        modelId: metadata.modelId,
        timestamp: metadata.timestamp
          ? new Date(metadata.timestamp).toISOString()
          : null,
        version: metadata.version,
      },
    });
  } catch (error) {
    console.error('Watermark extraction error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error during extraction',
    });
  }
});

/**
 * POST /api/ai/watermark/embed
 *
 * Manually embed a watermark in content (admin/testing use)
 * Requires STEWARD or ADMIN role
 */
router.post('/embed', async (req: Request, res: Response) => {
  try {
    // Check role
    const user = (req as any).user;
    if (!user || !['STEWARD', 'ADMIN'].includes(user.role)) {
      return res.status(403).json({
        success: false,
        error: 'Insufficient permissions. Requires STEWARD or ADMIN role.',
      });
    }

    const parseResult = EmbedRequestSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        success: false,
        error: 'Invalid request body',
        details: parseResult.error.errors,
      });
    }

    const { content, metadata } = parseResult.data;
    const watermarkService = getWatermarkService();

    const watermarkedContent = watermarkService.embed(content, {
      invocationId: metadata.invocationId,
      modelId: metadata.modelId,
      userId: metadata.userId || user.id,
      timestamp: Date.now(),
    });

    // Log embed action
    await logAction({
      action: 'WATERMARK_EMBED',
      userId: user.id,
      resourceType: 'content',
      resourceId: metadata.invocationId,
      details: {
        modelId: metadata.modelId,
        contentType: typeof content,
      },
    });

    return res.json({
      success: true,
      content: watermarkedContent,
    });
  } catch (error) {
    console.error('Watermark embed error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error during embedding',
    });
  }
});

/**
 * POST /api/ai/watermark/remove
 *
 * Remove watermark from content (for comparison/processing)
 * Returns original content without watermark
 */
router.post('/remove', async (req: Request, res: Response) => {
  try {
    const parseResult = VerifyRequestSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        success: false,
        error: 'Invalid request body',
        details: parseResult.error.errors,
      });
    }

    const { content } = parseResult.data;
    const watermarkService = getWatermarkService();
    const cleanContent = watermarkService.remove(content);

    return res.json({
      success: true,
      content: cleanContent,
    });
  } catch (error) {
    console.error('Watermark removal error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error during removal',
    });
  }
});

/**
 * GET /api/ai/watermark/status
 *
 * Get watermarking service status and configuration
 */
router.get('/status', async (req: Request, res: Response) => {
  try {
    const watermarkService = getWatermarkService();

    return res.json({
      success: true,
      status: {
        enabled: watermarkService.isEnabled(),
        version: '1.0.0',
        features: {
          json: true,
          text: true,
          verification: true,
          extraction: true,
        },
      },
    });
  } catch (error) {
    console.error('Watermark status error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
});

export default router;
