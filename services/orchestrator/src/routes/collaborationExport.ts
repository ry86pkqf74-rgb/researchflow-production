/**
 * Collaboration Export Routes (Task 93)
 * Export collaboration logs with hash chain verification
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import * as collaborationExportService from '../services/collaborationExportService';

const router = Router();

// ---------------------------------------------------------------------------
// Export Routes
// ---------------------------------------------------------------------------

/**
 * POST /api/research/:researchId/collaboration/export
 * Export collaboration log
 */
router.post('/research/:researchId/collaboration/export', async (req: Request, res: Response) => {
  try {
    const { researchId } = req.params;
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const options = collaborationExportService.ExportOptionsSchema.parse({
      ...req.body,
      researchId,
    });

    const exportLog = collaborationExportService.exportCollaborationLog(options, userId);

    // Format based on requested format
    const format = options.format || 'json';
    const formatted = collaborationExportService.formatExport(exportLog, format);

    // Set appropriate content type
    const contentTypes: Record<string, string> = {
      json: 'application/json',
      jsonl: 'application/x-ndjson',
      csv: 'text/csv',
    };

    res.setHeader('Content-Type', contentTypes[format] || 'application/json');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="collaboration-${researchId}-${exportLog.exportId}.${format}"`
    );

    return res.send(formatted);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    console.error('Export error:', error);
    return res.status(500).json({ error: 'Failed to export collaboration log' });
  }
});

/**
 * GET /api/research/:researchId/collaboration/summary
 * Get collaboration summary
 */
router.get('/research/:researchId/collaboration/summary', async (req: Request, res: Response) => {
  try {
    const { researchId } = req.params;
    const { startDate, endDate } = req.query;

    const summary = collaborationExportService.getCollaborationSummary(
      researchId,
      startDate as string | undefined,
      endDate as string | undefined
    );

    return res.json(summary);
  } catch (error) {
    console.error('Get summary error:', error);
    return res.status(500).json({ error: 'Failed to get summary' });
  }
});

/**
 * GET /api/research/:researchId/collaboration/events
 * Get collaboration events (paginated)
 */
router.get('/research/:researchId/collaboration/events', async (req: Request, res: Response) => {
  try {
    const { researchId } = req.params;

    const options = z.object({
      startDate: z.string().datetime().optional(),
      endDate: z.string().datetime().optional(),
      eventTypes: z.string().transform(s => s.split(',') as collaborationExportService.CollaborationEventType[]).optional(),
      actorIds: z.string().transform(s => s.split(',')).optional(),
      includePresence: z.string().transform(s => s === 'true').optional(),
    }).parse(req.query);

    const events = collaborationExportService.getEvents({
      researchId,
      ...options,
    });

    return res.json({
      events,
      total: events.length,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    console.error('Get events error:', error);
    return res.status(500).json({ error: 'Failed to get events' });
  }
});

// ---------------------------------------------------------------------------
// Verification Routes
// ---------------------------------------------------------------------------

/**
 * POST /api/collaboration/verify
 * Verify an exported collaboration log
 */
router.post('/collaboration/verify', async (req: Request, res: Response) => {
  try {
    const { exportedLog } = z.object({
      exportedLog: z.string(),
    }).parse(req.body);

    const result = collaborationExportService.verifyExportedLog(exportedLog);

    return res.json({
      valid: result.valid,
      researchId: result.log?.researchId,
      eventCount: result.log?.events.length || 0,
      chainIntegrity: result.log?.chainIntegrity,
      errors: result.errors,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    console.error('Verify error:', error);
    return res.status(500).json({ error: 'Failed to verify log' });
  }
});

/**
 * POST /api/research/:researchId/collaboration/verify-chain
 * Verify hash chain integrity for a research project
 */
router.post('/research/:researchId/collaboration/verify-chain', async (req: Request, res: Response) => {
  try {
    const { researchId } = req.params;

    const events = collaborationExportService.getEvents({ researchId, includePresence: false });
    const result = collaborationExportService.verifyHashChain(events);

    return res.json({
      researchId,
      ...result,
    });
  } catch (error) {
    console.error('Verify chain error:', error);
    return res.status(500).json({ error: 'Failed to verify chain' });
  }
});

// ---------------------------------------------------------------------------
// Recording Routes (for internal use / hooks)
// ---------------------------------------------------------------------------

/**
 * POST /api/collaboration/events
 * Record a collaboration event
 * (Typically called internally by other services)
 */
router.post('/collaboration/events', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const input = z.object({
      researchId: z.string().uuid(),
      artifactId: z.string().uuid().optional(),
      type: collaborationExportService.CollaborationEventTypeSchema,
      targetId: z.string().uuid().optional(),
      actorRole: z.string().optional(),
      metadata: z.record(z.unknown()).optional(),
    }).parse(req.body);

    const event = collaborationExportService.recordCollaborationEvent({
      ...input,
      actorId: userId,
    });

    return res.status(201).json(event);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    console.error('Record event error:', error);
    return res.status(500).json({ error: 'Failed to record event' });
  }
});

export default router;
