/**
 * Literature Notes API Routes (Track B Phase 13)
 *
 * Notes for literature review - standalone, collection-linked, or paper-linked
 *
 * API namespace: /api/notes
 *
 * Endpoints:
 * - GET    /ping                # Health check
 * - POST   /                    # Create note
 * - GET    /                    # List notes
 * - GET    /:id                 # Get note
 * - PATCH  /:id                 # Update note
 * - DELETE /:id                 # Delete note
 *
 * @module routes/literature-notes
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { db } from '../../db';
import { sql } from 'drizzle-orm';

const router = Router();

// =============================================================================
// Validation Schemas
// =============================================================================

const createNoteSchema = z.object({
  title: z.string().max(300).optional(),
  content: z.string().min(1),
  content_format: z.enum(['markdown', 'html', 'plaintext']).default('markdown'),
  collection_id: z.string().uuid().optional(),
  paper_id: z.string().optional(),
  tags: z.array(z.string().max(50)).max(20).optional(),
});

const updateNoteSchema = z.object({
  title: z.string().max(300).nullable().optional(),
  content: z.string().min(1).optional(),
  content_format: z.enum(['markdown', 'html', 'plaintext']).optional(),
  collection_id: z.string().uuid().nullable().optional(),
  paper_id: z.string().nullable().optional(),
  tags: z.array(z.string().max(50)).max(20).optional(),
  is_archived: z.boolean().optional(),
  is_pinned: z.boolean().optional(),
});

const listNotesSchema = z.object({
  collection_id: z.string().uuid().optional(),
  paper_id: z.string().optional(),
  tag: z.string().optional(),
  include_archived: z.coerce.boolean().default(false),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

// =============================================================================
// Helper Functions
// =============================================================================

function getUserId(req: Request): string {
  return (req as any).user?.id || 'demo-user';
}

// =============================================================================
// Routes
// =============================================================================

/**
 * Health check
 */
router.get('/ping', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    timestamp: Date.now(),
    service: 'literature-notes',
  });
});

/**
 * Create note
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const parsed = createNoteSchema.safeParse(req.body);

    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() });
    }

    const { title, content, content_format, collection_id, paper_id, tags } = parsed.data;

    // Verify collection ownership if provided
    if (collection_id) {
      const collection = await db.execute(sql`
        SELECT id FROM collections WHERE id = ${collection_id}::uuid AND user_id = ${userId}
      `);
      if (collection.rows.length === 0) {
        return res.status(400).json({ error: 'Collection not found' });
      }
    }

    // Verify paper ownership if provided
    if (paper_id) {
      const paper = await db.execute(sql`
        SELECT id FROM papers WHERE id = ${paper_id} AND user_id = ${userId}
      `);
      if (paper.rows.length === 0) {
        return res.status(400).json({ error: 'Paper not found' });
      }
    }

    const result = await db.execute(sql`
      INSERT INTO literature_notes (
        user_id, title, content, content_format, collection_id, paper_id, tags
      ) VALUES (
        ${userId}, ${title || null}, ${content}, ${content_format},
        ${collection_id || null}::uuid, ${paper_id || null}::uuid,
        ${JSON.stringify(tags || [])}::jsonb
      )
      RETURNING *
    `);

    res.status(201).json(result.rows[0]);

  } catch (error) {
    console.error('[notes/create] Error:', error);
    res.status(500).json({ error: 'Failed to create note' });
  }
});

/**
 * List notes
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const parsed = listNotesSchema.safeParse(req.query);

    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid query', details: parsed.error.flatten() });
    }

    const { collection_id, paper_id, tag, include_archived, limit, offset } = parsed.data;

    let conditions = sql`user_id = ${userId}`;

    if (!include_archived) {
      conditions = sql`${conditions} AND is_archived = FALSE`;
    }

    if (collection_id) {
      conditions = sql`${conditions} AND collection_id = ${collection_id}::uuid`;
    }

    if (paper_id) {
      conditions = sql`${conditions} AND paper_id = ${paper_id}::uuid`;
    }

    if (tag) {
      conditions = sql`${conditions} AND tags @> ${JSON.stringify([tag])}::jsonb`;
    }

    const notes = await db.execute(sql`
      SELECT
        n.*,
        c.name as collection_name,
        p.title as paper_title
      FROM literature_notes n
      LEFT JOIN collections c ON c.id = n.collection_id
      LEFT JOIN papers p ON p.id = n.paper_id
      WHERE ${conditions}
      ORDER BY n.is_pinned DESC, n.updated_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `);

    // Get total count
    const countResult = await db.execute(sql`
      SELECT COUNT(*) as total FROM literature_notes WHERE ${conditions}
    `);

    const total = parseInt(countResult.rows[0]?.total || '0');

    res.json({
      notes: notes.rows,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + notes.rows.length < total,
      },
    });

  } catch (error) {
    console.error('[notes/list] Error:', error);
    res.status(500).json({ error: 'Failed to list notes' });
  }
});

/**
 * Get note
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const { id } = req.params;

    const result = await db.execute(sql`
      SELECT
        n.*,
        c.name as collection_name,
        p.title as paper_title,
        p.authors as paper_authors
      FROM literature_notes n
      LEFT JOIN collections c ON c.id = n.collection_id
      LEFT JOIN papers p ON p.id = n.paper_id
      WHERE n.id = ${id}::uuid AND n.user_id = ${userId}
    `);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Note not found' });
    }

    res.json(result.rows[0]);

  } catch (error) {
    console.error('[notes/get] Error:', error);
    res.status(500).json({ error: 'Failed to get note' });
  }
});

/**
 * Update note
 */
router.patch('/:id', async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const { id } = req.params;
    const parsed = updateNoteSchema.safeParse(req.body);

    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() });
    }

    // Check ownership
    const existing = await db.execute(sql`
      SELECT id FROM literature_notes WHERE id = ${id}::uuid AND user_id = ${userId}
    `);

    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Note not found' });
    }

    const updates = parsed.data;
    const setClauses: string[] = [];

    if (updates.title !== undefined) {
      setClauses.push(`title = ${updates.title === null ? 'NULL' : `'${updates.title}'`}`);
    }
    if (updates.content !== undefined) {
      setClauses.push(`content = '${updates.content.replace(/'/g, "''")}'`);
    }
    if (updates.content_format !== undefined) {
      setClauses.push(`content_format = '${updates.content_format}'`);
    }
    if (updates.collection_id !== undefined) {
      setClauses.push(`collection_id = ${updates.collection_id === null ? 'NULL' : `'${updates.collection_id}'::uuid`}`);
    }
    if (updates.paper_id !== undefined) {
      setClauses.push(`paper_id = ${updates.paper_id === null ? 'NULL' : `'${updates.paper_id}'::uuid`}`);
    }
    if (updates.tags !== undefined) {
      setClauses.push(`tags = '${JSON.stringify(updates.tags)}'::jsonb`);
    }
    if (updates.is_archived !== undefined) {
      setClauses.push(`is_archived = ${updates.is_archived}`);
    }
    if (updates.is_pinned !== undefined) {
      setClauses.push(`is_pinned = ${updates.is_pinned}`);
    }

    if (setClauses.length === 0) {
      return res.status(400).json({ error: 'No updates provided' });
    }

    const result = await db.execute(sql`
      UPDATE literature_notes SET
        ${sql.raw(setClauses.join(', '))},
        updated_at = NOW()
      WHERE id = ${id}::uuid
      RETURNING *
    `);

    res.json(result.rows[0]);

  } catch (error) {
    console.error('[notes/update] Error:', error);
    res.status(500).json({ error: 'Failed to update note' });
  }
});

/**
 * Delete note
 */
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const { id } = req.params;

    const existing = await db.execute(sql`
      SELECT id FROM literature_notes WHERE id = ${id}::uuid AND user_id = ${userId}
    `);

    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Note not found' });
    }

    await db.execute(sql`
      DELETE FROM literature_notes WHERE id = ${id}::uuid
    `);

    res.json({ success: true, id });

  } catch (error) {
    console.error('[notes/delete] Error:', error);
    res.status(500).json({ error: 'Failed to delete note' });
  }
});

export default router;
