/**
 * Hub Calendar API Routes
 *
 * Unified calendar view for tasks, milestones, goals, and custom events.
 */

import { Router, Request, Response, NextFunction } from 'express';
import { Pool } from 'pg';
import { z } from 'zod';

const router = Router();

// Get database pool from app context
const getPool = (req: Request): Pool => {
  return (req.app as any).locals?.pool || (req as any).pool;
};

// Validation schemas
const EventTypeSchema = z.enum(['task_due', 'milestone', 'goal', 'meeting', 'deadline', 'custom']);

const CreateEventSchema = z.object({
  projectId: z.string().uuid(),
  title: z.string().min(1).max(500),
  description: z.string().max(5000).optional(),
  eventType: EventTypeSchema,
  startTime: z.string().datetime(),
  endTime: z.string().datetime().optional().nullable(),
  allDay: z.boolean().optional().default(false),
  color: z.string().max(20).optional(),
  metadata: z.record(z.any()).optional().default({}),
});

const UpdateEventSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  description: z.string().max(5000).optional().nullable(),
  startTime: z.string().datetime().optional(),
  endTime: z.string().datetime().optional().nullable(),
  allDay: z.boolean().optional(),
  color: z.string().max(20).optional().nullable(),
  metadata: z.record(z.any()).optional(),
});

const CalendarQuerySchema = z.object({
  projectId: z.string().uuid(),
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
  eventTypes: z.string().optional(), // comma-separated list
});

/**
 * GET /api/hub/calendar
 * Get calendar events for a date range
 */
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { projectId, startDate, endDate, eventTypes } = req.query;

    if (!projectId || !startDate || !endDate) {
      return res.status(400).json({
        error: 'projectId, startDate, and endDate are required',
      });
    }

    const pool = getPool(req);
    if (!pool) {
      return res.status(503).json({ error: 'Database connection not available' });
    }

    let query = `
      SELECT * FROM calendar_events
      WHERE project_id = $1
        AND start_time >= $2
        AND start_time <= $3
    `;
    const params: any[] = [projectId, startDate, endDate];
    let paramIndex = 4;

    if (eventTypes) {
      const types = (eventTypes as string).split(',').map(t => t.trim());
      query += ` AND event_type = ANY($${paramIndex++})`;
      params.push(types);
    }

    query += ' ORDER BY start_time ASC';

    const result = await pool.query(query, params);

    // Group by date for easier frontend rendering
    const eventsByDate: Record<string, any[]> = {};
    for (const event of result.rows) {
      const dateKey = new Date(event.start_time).toISOString().split('T')[0];
      if (!eventsByDate[dateKey]) {
        eventsByDate[dateKey] = [];
      }
      eventsByDate[dateKey].push(event);
    }

    res.json({
      events: result.rows,
      eventsByDate,
      total: result.rowCount,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/hub/calendar/upcoming
 * Get upcoming events for a project (next 30 days by default)
 */
router.get('/upcoming', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { projectId, days = '30', limit = '20' } = req.query;

    if (!projectId) {
      return res.status(400).json({ error: 'projectId is required' });
    }

    const pool = getPool(req);
    if (!pool) {
      return res.status(503).json({ error: 'Database connection not available' });
    }

    const daysNum = parseInt(days as string) || 30;
    const limitNum = Math.min(parseInt(limit as string) || 20, 100);

    const result = await pool.query(
      `SELECT * FROM calendar_events
       WHERE project_id = $1
         AND start_time >= NOW()
         AND start_time <= NOW() + INTERVAL '${daysNum} days'
       ORDER BY start_time ASC
       LIMIT $2`,
      [projectId, limitNum]
    );

    res.json({ events: result.rows, total: result.rowCount });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/hub/calendar/summary
 * Get calendar summary stats for a project
 */
router.get('/summary', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { projectId } = req.query;

    if (!projectId) {
      return res.status(400).json({ error: 'projectId is required' });
    }

    const pool = getPool(req);
    if (!pool) {
      return res.status(503).json({ error: 'Database connection not available' });
    }

    const result = await pool.query(
      `SELECT
        COUNT(*) FILTER (WHERE event_type = 'task_due') as task_count,
        COUNT(*) FILTER (WHERE event_type = 'milestone') as milestone_count,
        COUNT(*) FILTER (WHERE event_type = 'goal') as goal_count,
        COUNT(*) FILTER (WHERE event_type = 'meeting') as meeting_count,
        COUNT(*) FILTER (WHERE event_type = 'deadline') as deadline_count,
        COUNT(*) FILTER (WHERE event_type = 'custom') as custom_count,
        COUNT(*) FILTER (WHERE start_time < NOW()) as past_count,
        COUNT(*) FILTER (WHERE start_time >= NOW() AND start_time < NOW() + INTERVAL '7 days') as this_week_count,
        COUNT(*) FILTER (WHERE start_time >= NOW() AND start_time < NOW() + INTERVAL '30 days') as this_month_count,
        COUNT(*) as total_count
       FROM calendar_events
       WHERE project_id = $1`,
      [projectId]
    );

    res.json({ summary: result.rows[0] });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/hub/calendar
 * Create a custom calendar event
 */
router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = CreateEventSchema.parse(req.body);
    const userId = (req as any).user?.id || 'system';

    const pool = getPool(req);
    if (!pool) {
      return res.status(503).json({ error: 'Database connection not available' });
    }

    const result = await pool.query(
      `INSERT INTO calendar_events (
        project_id, title, description, event_type, start_time,
        end_time, all_day, color, metadata, created_by
      )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`,
      [
        input.projectId,
        input.title,
        input.description || null,
        input.eventType,
        input.startTime,
        input.endTime || null,
        input.allDay,
        input.color || null,
        JSON.stringify(input.metadata),
        userId,
      ]
    );

    res.status(201).json({ event: result.rows[0] });
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    next(error);
  }
});

/**
 * GET /api/hub/calendar/:eventId
 * Get a specific calendar event
 */
router.get('/:eventId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { eventId } = req.params;

    const pool = getPool(req);
    if (!pool) {
      return res.status(503).json({ error: 'Database connection not available' });
    }

    const result = await pool.query(
      'SELECT * FROM calendar_events WHERE id = $1',
      [eventId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Event not found' });
    }

    res.json({ event: result.rows[0] });
  } catch (error) {
    next(error);
  }
});

/**
 * PATCH /api/hub/calendar/:eventId
 * Update a calendar event (only custom events can be directly modified)
 */
router.patch('/:eventId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { eventId } = req.params;
    const input = UpdateEventSchema.parse(req.body);

    const pool = getPool(req);
    if (!pool) {
      return res.status(503).json({ error: 'Database connection not available' });
    }

    // Check if this is a custom event (only custom events can be modified directly)
    const existing = await pool.query(
      'SELECT * FROM calendar_events WHERE id = $1',
      [eventId]
    );

    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Event not found' });
    }

    if (existing.rows[0].source_type && existing.rows[0].event_type !== 'custom') {
      return res.status(400).json({
        error: 'Cannot modify auto-generated events. Update the source (task/milestone/goal) instead.',
      });
    }

    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    const fields = ['title', 'description', 'startTime', 'endTime', 'allDay', 'color', 'metadata'];
    const dbFields: Record<string, string> = {
      startTime: 'start_time',
      endTime: 'end_time',
      allDay: 'all_day',
    };

    for (const field of fields) {
      if ((input as any)[field] !== undefined) {
        const dbField = dbFields[field] || field.toLowerCase();
        updates.push(`${dbField} = $${paramIndex++}`);

        let value = (input as any)[field];
        if (field === 'metadata') {
          value = JSON.stringify(value);
        }
        values.push(value);
      }
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    values.push(eventId);

    const result = await pool.query(
      `UPDATE calendar_events SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
      values
    );

    res.json({ event: result.rows[0] });
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    next(error);
  }
});

/**
 * DELETE /api/hub/calendar/:eventId
 * Delete a calendar event (only custom events can be deleted directly)
 */
router.delete('/:eventId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { eventId } = req.params;

    const pool = getPool(req);
    if (!pool) {
      return res.status(503).json({ error: 'Database connection not available' });
    }

    // Check if this is a custom event
    const existing = await pool.query(
      'SELECT * FROM calendar_events WHERE id = $1',
      [eventId]
    );

    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Event not found' });
    }

    if (existing.rows[0].source_type && existing.rows[0].event_type !== 'custom') {
      return res.status(400).json({
        error: 'Cannot delete auto-generated events. Delete the source (task/milestone/goal) instead.',
      });
    }

    await pool.query('DELETE FROM calendar_events WHERE id = $1', [eventId]);

    res.json({ success: true, deletedId: eventId });
  } catch (error) {
    next(error);
  }
});

export default router;
