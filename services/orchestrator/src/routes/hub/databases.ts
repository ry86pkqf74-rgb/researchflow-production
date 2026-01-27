/**
 * Hub Databases API Routes
 *
 * CRUD operations for Notion-like databases with customizable
 * properties and records.
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
const PropertySchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(100),
  type: z.enum(['title', 'text', 'number', 'select', 'multi_select', 'date', 'person', 'checkbox', 'url', 'email', 'relation', 'formula', 'status']),
  options: z.any().optional(),
  config: z.any().optional(),
});

const CreateDatabaseSchema = z.object({
  projectId: z.string().uuid(),
  title: z.string().min(1).max(500),
  description: z.string().max(2000).optional(),
  properties: z.array(PropertySchema).optional().default([]),
  defaultView: z.enum(['table', 'calendar', 'gallery', 'list']).optional().default('table'),
});

const UpdateDatabaseSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  description: z.string().max(2000).optional(),
  properties: z.array(PropertySchema).optional(),
  defaultView: z.enum(['table', 'calendar', 'gallery', 'list']).optional(),
  isArchived: z.boolean().optional(),
});

const CreateRecordSchema = z.object({
  properties: z.record(z.any()).optional().default({}),
});

/**
 * GET /api/hub/databases
 * List databases for a project
 */
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
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
      `SELECT * FROM hub_databases
       WHERE project_id = $1 AND is_archived = FALSE
       ORDER BY created_at DESC`,
      [projectId]
    );

    res.json({ databases: result.rows, total: result.rowCount });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/hub/databases
 * Create a new database
 */
router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = CreateDatabaseSchema.parse(req.body);
    const userId = (req as any).user?.id || 'system';

    const pool = getPool(req);
    if (!pool) {
      return res.status(503).json({ error: 'Database connection not available' });
    }

    const result = await pool.query(
      `INSERT INTO hub_databases (project_id, title, description, properties, default_view, created_by)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [input.projectId, input.title, input.description, JSON.stringify(input.properties), input.defaultView, userId]
    );

    res.status(201).json({ database: result.rows[0] });
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    next(error);
  }
});

/**
 * GET /api/hub/databases/:databaseId
 * Get a specific database with its records
 */
router.get('/:databaseId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { databaseId } = req.params;
    const { limit = '100', offset = '0' } = req.query;

    const pool = getPool(req);
    if (!pool) {
      return res.status(503).json({ error: 'Database connection not available' });
    }

    const dbResult = await pool.query(
      'SELECT * FROM hub_databases WHERE id = $1',
      [databaseId]
    );

    if (dbResult.rows.length === 0) {
      return res.status(404).json({ error: 'Database not found' });
    }

    // Get records
    const recordsResult = await pool.query(
      `SELECT * FROM hub_records
       WHERE database_id = $1 AND is_archived = FALSE
       ORDER BY created_at DESC
       LIMIT $2 OFFSET $3`,
      [databaseId, parseInt(limit as string), parseInt(offset as string)]
    );

    // Get total count
    const countResult = await pool.query(
      'SELECT COUNT(*) FROM hub_records WHERE database_id = $1 AND is_archived = FALSE',
      [databaseId]
    );

    res.json({
      database: dbResult.rows[0],
      records: recordsResult.rows,
      pagination: {
        total: parseInt(countResult.rows[0].count),
        limit: parseInt(limit as string),
        offset: parseInt(offset as string),
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * PATCH /api/hub/databases/:databaseId
 * Update a database
 */
router.patch('/:databaseId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { databaseId } = req.params;
    const input = UpdateDatabaseSchema.parse(req.body);

    const pool = getPool(req);
    if (!pool) {
      return res.status(503).json({ error: 'Database connection not available' });
    }

    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (input.title !== undefined) {
      updates.push(`title = $${paramIndex++}`);
      values.push(input.title);
    }
    if (input.description !== undefined) {
      updates.push(`description = $${paramIndex++}`);
      values.push(input.description);
    }
    if (input.properties !== undefined) {
      updates.push(`properties = $${paramIndex++}`);
      values.push(JSON.stringify(input.properties));
    }
    if (input.defaultView !== undefined) {
      updates.push(`default_view = $${paramIndex++}`);
      values.push(input.defaultView);
    }
    if (input.isArchived !== undefined) {
      updates.push(`is_archived = $${paramIndex++}`);
      values.push(input.isArchived);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    values.push(databaseId);

    const result = await pool.query(
      `UPDATE hub_databases SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
      values
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Database not found' });
    }

    res.json({ database: result.rows[0] });
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    next(error);
  }
});

/**
 * DELETE /api/hub/databases/:databaseId
 * Archive a database
 */
router.delete('/:databaseId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { databaseId } = req.params;

    const pool = getPool(req);
    if (!pool) {
      return res.status(503).json({ error: 'Database connection not available' });
    }

    const result = await pool.query(
      'UPDATE hub_databases SET is_archived = TRUE WHERE id = $1 RETURNING id',
      [databaseId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Database not found' });
    }

    res.json({ success: true, archivedId: databaseId });
  } catch (error) {
    next(error);
  }
});

// =============================================================================
// Records sub-routes
// =============================================================================

/**
 * POST /api/hub/databases/:databaseId/records
 * Create a new record in a database
 */
router.post('/:databaseId/records', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { databaseId } = req.params;
    const input = CreateRecordSchema.parse(req.body);
    const userId = (req as any).user?.id || 'system';

    const pool = getPool(req);
    if (!pool) {
      return res.status(503).json({ error: 'Database connection not available' });
    }

    // Verify database exists
    const dbCheck = await pool.query('SELECT id FROM hub_databases WHERE id = $1', [databaseId]);
    if (dbCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Database not found' });
    }

    const result = await pool.query(
      `INSERT INTO hub_records (database_id, properties, created_by)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [databaseId, JSON.stringify(input.properties), userId]
    );

    res.status(201).json({ record: result.rows[0] });
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    next(error);
  }
});

/**
 * PATCH /api/hub/databases/:databaseId/records/:recordId
 * Update a record
 */
router.patch('/:databaseId/records/:recordId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { databaseId, recordId } = req.params;
    const { properties } = req.body;

    if (!properties) {
      return res.status(400).json({ error: 'properties is required' });
    }

    const pool = getPool(req);
    if (!pool) {
      return res.status(503).json({ error: 'Database connection not available' });
    }

    const result = await pool.query(
      `UPDATE hub_records SET properties = $1 WHERE id = $2 AND database_id = $3 RETURNING *`,
      [JSON.stringify(properties), recordId, databaseId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Record not found' });
    }

    res.json({ record: result.rows[0] });
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /api/hub/databases/:databaseId/records/:recordId
 * Archive a record
 */
router.delete('/:databaseId/records/:recordId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { databaseId, recordId } = req.params;

    const pool = getPool(req);
    if (!pool) {
      return res.status(503).json({ error: 'Database connection not available' });
    }

    const result = await pool.query(
      'UPDATE hub_records SET is_archived = TRUE WHERE id = $1 AND database_id = $2 RETURNING id',
      [recordId, databaseId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Record not found' });
    }

    res.json({ success: true, archivedId: recordId });
  } catch (error) {
    next(error);
  }
});

export default router;
