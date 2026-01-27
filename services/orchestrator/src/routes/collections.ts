/**
 * Collections API Routes (Track B Phase 13)
 *
 * Literature Review Workspace - Collections for organizing papers
 *
 * API namespace: /api/collections
 *
 * Endpoints:
 * - GET    /ping                        # Health check
 * - POST   /                            # Create collection
 * - GET    /                            # List collections
 * - GET    /:id                         # Get collection with papers
 * - PATCH  /:id                         # Update collection
 * - DELETE /:id                         # Delete collection
 * - POST   /:id/papers                  # Add paper to collection
 * - DELETE /:id/papers/:paperId         # Remove paper from collection
 * - PATCH  /:id/papers/:paperId         # Update paper in collection
 * - POST   /:id/reorder                 # Reorder papers in collection
 *
 * @module routes/collections
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { db } from '../../db';
import { sql } from 'drizzle-orm';

const router = Router();

// =============================================================================
// Validation Schemas
// =============================================================================

const createCollectionSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().optional(),
  color: z.enum(['blue', 'green', 'red', 'yellow', 'purple', 'pink', 'orange', 'gray']).default('blue'),
  icon: z.string().max(50).optional(),
  parent_id: z.string().uuid().optional(),
});

const updateCollectionSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().optional(),
  color: z.enum(['blue', 'green', 'red', 'yellow', 'purple', 'pink', 'orange', 'gray']).optional(),
  icon: z.string().max(50).optional(),
  parent_id: z.string().uuid().nullable().optional(),
  is_archived: z.boolean().optional(),
  is_pinned: z.boolean().optional(),
  sort_order: z.number().int().optional(),
});

const addPaperSchema = z.object({
  paper_id: z.string(),
  collection_notes: z.string().optional(),
});

const updatePaperInCollectionSchema = z.object({
  collection_notes: z.string().optional(),
  sort_order: z.number().int().optional(),
});

const reorderPapersSchema = z.object({
  paper_ids: z.array(z.string()),
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
    service: 'collections',
  });
});

/**
 * Create collection
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const parsed = createCollectionSchema.safeParse(req.body);

    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() });
    }

    const { name, description, color, icon, parent_id } = parsed.data;

    // If parent_id provided, verify it exists and belongs to user
    if (parent_id) {
      const parent = await db.execute(sql`
        SELECT id FROM collections WHERE id = ${parent_id}::uuid AND user_id = ${userId}
      `);
      if (parent.rows.length === 0) {
        return res.status(400).json({ error: 'Parent collection not found' });
      }
    }

    // Get max sort_order for user's collections
    const maxOrder = await db.execute(sql`
      SELECT COALESCE(MAX(sort_order), 0) + 1 as next_order
      FROM collections WHERE user_id = ${userId} AND parent_id IS NOT DISTINCT FROM ${parent_id || null}::uuid
    `);

    const result = await db.execute(sql`
      INSERT INTO collections (
        user_id, name, description, color, icon, parent_id, sort_order
      ) VALUES (
        ${userId}, ${name}, ${description || null}, ${color},
        ${icon || null}, ${parent_id || null}::uuid, ${maxOrder.rows[0].next_order}
      )
      RETURNING id, name, description, color, icon, parent_id, sort_order, created_at
    `);

    res.status(201).json(result.rows[0]);

  } catch (error) {
    console.error('[collections/create] Error:', error);
    res.status(500).json({ error: 'Failed to create collection' });
  }
});

/**
 * List collections
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const includeArchived = req.query.include_archived === 'true';
    const parentId = req.query.parent_id as string | undefined;

    let conditions = sql`user_id = ${userId}`;

    if (!includeArchived) {
      conditions = sql`${conditions} AND is_archived = FALSE`;
    }

    if (parentId === 'null' || parentId === '') {
      conditions = sql`${conditions} AND parent_id IS NULL`;
    } else if (parentId) {
      conditions = sql`${conditions} AND parent_id = ${parentId}::uuid`;
    }

    const collections = await db.execute(sql`
      SELECT
        c.id, c.name, c.description, c.color, c.icon,
        c.parent_id, c.sort_order, c.is_archived, c.is_pinned,
        c.created_at, c.updated_at,
        (SELECT COUNT(*) FROM collection_papers cp WHERE cp.collection_id = c.id) as paper_count,
        (SELECT COUNT(*) FROM collections child WHERE child.parent_id = c.id) as child_count
      FROM collections c
      WHERE ${conditions}
      ORDER BY c.is_pinned DESC, c.sort_order ASC, c.name ASC
    `);

    res.json({
      collections: collections.rows,
      count: collections.rows.length,
    });

  } catch (error) {
    console.error('[collections/list] Error:', error);
    res.status(500).json({ error: 'Failed to list collections' });
  }
});

/**
 * Get collection with papers
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const { id } = req.params;

    const collection = await db.execute(sql`
      SELECT * FROM collections
      WHERE id = ${id}::uuid AND user_id = ${userId}
    `);

    if (collection.rows.length === 0) {
      return res.status(404).json({ error: 'Collection not found' });
    }

    // Get papers in collection
    const papers = await db.execute(sql`
      SELECT
        p.id, p.title, p.authors, p.year, p.journal, p.doi,
        p.read_status, p.rating, p.status,
        cp.sort_order, cp.collection_notes, cp.added_at
      FROM papers p
      INNER JOIN collection_papers cp ON cp.paper_id = p.id
      WHERE cp.collection_id = ${id}::uuid
      ORDER BY cp.sort_order ASC, cp.added_at DESC
    `);

    // Get child collections
    const children = await db.execute(sql`
      SELECT id, name, color, icon,
        (SELECT COUNT(*) FROM collection_papers WHERE collection_id = collections.id) as paper_count
      FROM collections
      WHERE parent_id = ${id}::uuid AND user_id = ${userId}
      ORDER BY sort_order ASC, name ASC
    `);

    res.json({
      ...collection.rows[0],
      papers: papers.rows,
      paper_count: papers.rows.length,
      children: children.rows,
    });

  } catch (error) {
    console.error('[collections/get] Error:', error);
    res.status(500).json({ error: 'Failed to get collection' });
  }
});

/**
 * Update collection
 */
router.patch('/:id', async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const { id } = req.params;
    const parsed = updateCollectionSchema.safeParse(req.body);

    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() });
    }

    // Check ownership
    const existing = await db.execute(sql`
      SELECT id FROM collections WHERE id = ${id}::uuid AND user_id = ${userId}
    `);

    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Collection not found' });
    }

    const updates = parsed.data;
    const setClauses: string[] = [];

    if (updates.name !== undefined) setClauses.push(`name = '${updates.name}'`);
    if (updates.description !== undefined) setClauses.push(`description = ${updates.description ? `'${updates.description}'` : 'NULL'}`);
    if (updates.color !== undefined) setClauses.push(`color = '${updates.color}'`);
    if (updates.icon !== undefined) setClauses.push(`icon = ${updates.icon ? `'${updates.icon}'` : 'NULL'}`);
    if (updates.is_archived !== undefined) setClauses.push(`is_archived = ${updates.is_archived}`);
    if (updates.is_pinned !== undefined) setClauses.push(`is_pinned = ${updates.is_pinned}`);
    if (updates.sort_order !== undefined) setClauses.push(`sort_order = ${updates.sort_order}`);

    if (updates.parent_id !== undefined) {
      if (updates.parent_id === null) {
        setClauses.push(`parent_id = NULL`);
      } else {
        // Prevent circular reference
        if (updates.parent_id === id) {
          return res.status(400).json({ error: 'Collection cannot be its own parent' });
        }
        setClauses.push(`parent_id = '${updates.parent_id}'::uuid`);
      }
    }

    if (setClauses.length === 0) {
      return res.status(400).json({ error: 'No updates provided' });
    }

    await db.execute(sql`
      UPDATE collections SET
        ${sql.raw(setClauses.join(', '))},
        updated_at = NOW()
      WHERE id = ${id}::uuid
    `);

    // Return updated collection
    const updated = await db.execute(sql`
      SELECT * FROM collections WHERE id = ${id}::uuid
    `);

    res.json(updated.rows[0]);

  } catch (error) {
    console.error('[collections/update] Error:', error);
    res.status(500).json({ error: 'Failed to update collection' });
  }
});

/**
 * Delete collection
 */
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const { id } = req.params;

    const existing = await db.execute(sql`
      SELECT id FROM collections WHERE id = ${id}::uuid AND user_id = ${userId}
    `);

    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Collection not found' });
    }

    // Delete (CASCADE will handle collection_papers)
    await db.execute(sql`
      DELETE FROM collections WHERE id = ${id}::uuid
    `);

    res.json({ success: true, id });

  } catch (error) {
    console.error('[collections/delete] Error:', error);
    res.status(500).json({ error: 'Failed to delete collection' });
  }
});

/**
 * Add paper to collection
 */
router.post('/:id/papers', async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const { id } = req.params;
    const parsed = addPaperSchema.safeParse(req.body);

    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() });
    }

    // Verify collection ownership
    const collection = await db.execute(sql`
      SELECT id FROM collections WHERE id = ${id}::uuid AND user_id = ${userId}
    `);

    if (collection.rows.length === 0) {
      return res.status(404).json({ error: 'Collection not found' });
    }

    // Verify paper ownership
    const { paper_id, collection_notes } = parsed.data;
    const paper = await db.execute(sql`
      SELECT id FROM papers WHERE id = ${paper_id} AND user_id = ${userId}
    `);

    if (paper.rows.length === 0) {
      return res.status(404).json({ error: 'Paper not found' });
    }

    // Get max sort_order
    const maxOrder = await db.execute(sql`
      SELECT COALESCE(MAX(sort_order), 0) + 1 as next_order
      FROM collection_papers WHERE collection_id = ${id}::uuid
    `);

    // Add to collection (ON CONFLICT to handle duplicates)
    await db.execute(sql`
      INSERT INTO collection_papers (
        collection_id, paper_id, sort_order, collection_notes, added_by
      ) VALUES (
        ${id}::uuid, ${paper_id}::uuid, ${maxOrder.rows[0].next_order},
        ${collection_notes || null}, ${userId}
      )
      ON CONFLICT (collection_id, paper_id) DO UPDATE SET
        collection_notes = COALESCE(EXCLUDED.collection_notes, collection_papers.collection_notes)
    `);

    res.status(201).json({
      success: true,
      collection_id: id,
      paper_id,
    });

  } catch (error) {
    console.error('[collections/addPaper] Error:', error);
    res.status(500).json({ error: 'Failed to add paper to collection' });
  }
});

/**
 * Remove paper from collection
 */
router.delete('/:id/papers/:paperId', async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const { id, paperId } = req.params;

    // Verify collection ownership
    const collection = await db.execute(sql`
      SELECT id FROM collections WHERE id = ${id}::uuid AND user_id = ${userId}
    `);

    if (collection.rows.length === 0) {
      return res.status(404).json({ error: 'Collection not found' });
    }

    await db.execute(sql`
      DELETE FROM collection_papers
      WHERE collection_id = ${id}::uuid AND paper_id = ${paperId}::uuid
    `);

    res.json({ success: true, collection_id: id, paper_id: paperId });

  } catch (error) {
    console.error('[collections/removePaper] Error:', error);
    res.status(500).json({ error: 'Failed to remove paper from collection' });
  }
});

/**
 * Update paper in collection
 */
router.patch('/:id/papers/:paperId', async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const { id, paperId } = req.params;
    const parsed = updatePaperInCollectionSchema.safeParse(req.body);

    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() });
    }

    // Verify collection ownership
    const collection = await db.execute(sql`
      SELECT id FROM collections WHERE id = ${id}::uuid AND user_id = ${userId}
    `);

    if (collection.rows.length === 0) {
      return res.status(404).json({ error: 'Collection not found' });
    }

    const { collection_notes, sort_order } = parsed.data;
    const setClauses: string[] = [];

    if (collection_notes !== undefined) {
      setClauses.push(`collection_notes = ${collection_notes ? `'${collection_notes}'` : 'NULL'}`);
    }
    if (sort_order !== undefined) {
      setClauses.push(`sort_order = ${sort_order}`);
    }

    if (setClauses.length === 0) {
      return res.status(400).json({ error: 'No updates provided' });
    }

    await db.execute(sql`
      UPDATE collection_papers SET
        ${sql.raw(setClauses.join(', '))}
      WHERE collection_id = ${id}::uuid AND paper_id = ${paperId}::uuid
    `);

    res.json({ success: true });

  } catch (error) {
    console.error('[collections/updatePaper] Error:', error);
    res.status(500).json({ error: 'Failed to update paper in collection' });
  }
});

/**
 * Reorder papers in collection
 */
router.post('/:id/reorder', async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const { id } = req.params;
    const parsed = reorderPapersSchema.safeParse(req.body);

    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() });
    }

    // Verify collection ownership
    const collection = await db.execute(sql`
      SELECT id FROM collections WHERE id = ${id}::uuid AND user_id = ${userId}
    `);

    if (collection.rows.length === 0) {
      return res.status(404).json({ error: 'Collection not found' });
    }

    const { paper_ids } = parsed.data;

    // Update sort_order for each paper
    for (let i = 0; i < paper_ids.length; i++) {
      await db.execute(sql`
        UPDATE collection_papers
        SET sort_order = ${i}
        WHERE collection_id = ${id}::uuid AND paper_id = ${paper_ids[i]}::uuid
      `);
    }

    res.json({ success: true, order: paper_ids });

  } catch (error) {
    console.error('[collections/reorder] Error:', error);
    res.status(500).json({ error: 'Failed to reorder papers' });
  }
});

export default router;
