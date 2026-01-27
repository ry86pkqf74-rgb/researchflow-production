/**
 * Hub Pages API Routes
 *
 * CRUD operations for Notion-like pages with hierarchical structure
 * and rich content blocks.
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
const CreatePageSchema = z.object({
  projectId: z.string().uuid(),
  parentId: z.string().uuid().nullable().optional(),
  title: z.string().min(1).max(500),
  icon: z.string().max(10).optional(),
  blocks: z.array(z.any()).optional().default([]),
});

const UpdatePageSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  icon: z.string().max(10).optional(),
  coverUrl: z.string().url().optional(),
  blocks: z.array(z.any()).optional(),
  isArchived: z.boolean().optional(),
});

/**
 * GET /api/hub/pages
 * List pages for a project
 */
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { projectId, parentId, includeArchived } = req.query;

    if (!projectId) {
      return res.status(400).json({ error: 'projectId is required' });
    }

    const pool = getPool(req);
    if (!pool) {
      return res.status(503).json({ error: 'Database connection not available' });
    }

    let query = `
      SELECT * FROM hub_pages
      WHERE project_id = $1
    `;
    const params: any[] = [projectId];

    if (parentId !== undefined) {
      if (parentId === 'null' || parentId === '') {
        query += ' AND parent_id IS NULL';
      } else {
        query += ' AND parent_id = $2';
        params.push(parentId);
      }
    }

    if (includeArchived !== 'true') {
      query += ' AND is_archived = FALSE';
    }

    query += ' ORDER BY created_at DESC';

    const result = await pool.query(query, params);
    res.json({ pages: result.rows, total: result.rowCount });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/hub/pages
 * Create a new page
 */
router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = CreatePageSchema.parse(req.body);
    const userId = (req as any).user?.id || 'system';

    const pool = getPool(req);
    if (!pool) {
      return res.status(503).json({ error: 'Database connection not available' });
    }

    const result = await pool.query(
      `INSERT INTO hub_pages (project_id, parent_id, title, icon, blocks, created_by)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [input.projectId, input.parentId || null, input.title, input.icon, JSON.stringify(input.blocks), userId]
    );

    res.status(201).json({ page: result.rows[0] });
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    next(error);
  }
});

/**
 * GET /api/hub/pages/:pageId
 * Get a specific page
 */
router.get('/:pageId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { pageId } = req.params;

    const pool = getPool(req);
    if (!pool) {
      return res.status(503).json({ error: 'Database connection not available' });
    }

    const result = await pool.query(
      'SELECT * FROM hub_pages WHERE id = $1',
      [pageId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Page not found' });
    }

    // Get child pages
    const children = await pool.query(
      'SELECT id, title, icon FROM hub_pages WHERE parent_id = $1 AND is_archived = FALSE ORDER BY created_at',
      [pageId]
    );

    res.json({
      page: result.rows[0],
      children: children.rows,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * PATCH /api/hub/pages/:pageId
 * Update a page
 */
router.patch('/:pageId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { pageId } = req.params;
    const input = UpdatePageSchema.parse(req.body);

    const pool = getPool(req);
    if (!pool) {
      return res.status(503).json({ error: 'Database connection not available' });
    }

    // Build dynamic update
    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (input.title !== undefined) {
      updates.push(`title = $${paramIndex++}`);
      values.push(input.title);
    }
    if (input.icon !== undefined) {
      updates.push(`icon = $${paramIndex++}`);
      values.push(input.icon);
    }
    if (input.coverUrl !== undefined) {
      updates.push(`cover_url = $${paramIndex++}`);
      values.push(input.coverUrl);
    }
    if (input.blocks !== undefined) {
      updates.push(`blocks = $${paramIndex++}`);
      values.push(JSON.stringify(input.blocks));
    }
    if (input.isArchived !== undefined) {
      updates.push(`is_archived = $${paramIndex++}`);
      values.push(input.isArchived);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    values.push(pageId);

    const result = await pool.query(
      `UPDATE hub_pages SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
      values
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Page not found' });
    }

    res.json({ page: result.rows[0] });
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    next(error);
  }
});

/**
 * DELETE /api/hub/pages/:pageId
 * Archive (soft delete) a page
 */
router.delete('/:pageId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { pageId } = req.params;

    const pool = getPool(req);
    if (!pool) {
      return res.status(503).json({ error: 'Database connection not available' });
    }

    const result = await pool.query(
      'UPDATE hub_pages SET is_archived = TRUE WHERE id = $1 RETURNING id',
      [pageId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Page not found' });
    }

    res.json({ success: true, archivedId: pageId });
  } catch (error) {
    next(error);
  }
});

export default router;
