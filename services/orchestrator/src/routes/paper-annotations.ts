/**
 * Paper Annotations API Routes
 *
 * Track B Phase 11: PDF Viewer with Annotations
 *
 * API namespace: /api/papers/:paperId/annotations
 *
 * Endpoints:
 * - GET    /                      # List annotations for paper
 * - POST   /                      # Create annotation
 * - GET    /:id                   # Get annotation
 * - PATCH  /:id                   # Update annotation
 * - DELETE /:id                   # Delete annotation
 * - GET    /:id/threads           # Get annotation threads
 * - POST   /:id/threads           # Add thread message
 * - PATCH  /:id/resolve           # Resolve annotation
 *
 * @module routes/paper-annotations
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { db } from '../../db';
import { sql } from 'drizzle-orm';
import { nanoid } from 'nanoid';

const router = Router({ mergeParams: true });

// =============================================================================
// Validation Schemas
// =============================================================================

const rectSchema = z.object({
  x1: z.number().min(0).max(1),
  y1: z.number().min(0).max(1),
  x2: z.number().min(0).max(1),
  y2: z.number().min(0).max(1),
  width: z.number().optional(),
  height: z.number().optional(),
});

const createAnnotationSchema = z.object({
  page_number: z.number().int().min(1),
  rect: rectSchema,
  type: z.enum(['highlight', 'underline', 'strikethrough', 'note']),
  color: z.enum(['yellow', 'green', 'blue', 'pink', 'orange', 'red', 'purple']).default('yellow'),
  selected_text: z.string().optional(),
  note_content: z.string().optional(),
});

const updateAnnotationSchema = z.object({
  color: z.enum(['yellow', 'green', 'blue', 'pink', 'orange', 'red', 'purple']).optional(),
  note_content: z.string().optional(),
});

const createThreadSchema = z.object({
  content: z.string().min(1).max(5000),
  parent_id: z.string().uuid().optional(),
});

// =============================================================================
// Helper Functions
// =============================================================================

function getUserId(req: Request): string {
  return (req as any).user?.id || 'demo-user';
}

async function verifyPaperAccess(paperId: string, userId: string): Promise<boolean> {
  const result = await db.execute(sql`
    SELECT id FROM papers WHERE id = ${paperId} AND user_id = ${userId}
  `);
  return result.rows.length > 0;
}

// =============================================================================
// Routes
// =============================================================================

/**
 * List annotations for a paper
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const { paperId } = req.params;
    const page = req.query.page ? parseInt(req.query.page as string) : undefined;

    // Verify paper access
    if (!(await verifyPaperAccess(paperId, userId))) {
      return res.status(404).json({ error: 'Paper not found' });
    }

    // Build query
    let query = sql`
      SELECT
        id, page_number, rect, type, color, selected_text, note_content,
        created_at, updated_at
      FROM paper_annotations
      WHERE paper_id = ${paperId} AND user_id = ${userId}
    `;

    if (page !== undefined) {
      query = sql`${query} AND page_number = ${page}`;
    }

    query = sql`${query} ORDER BY page_number, created_at`;

    const result = await db.execute(query);

    res.json({
      annotations: result.rows,
      paper_id: paperId,
    });

  } catch (error) {
    console.error('[annotations/list] Error:', error);
    res.status(500).json({ error: 'Failed to list annotations' });
  }
});

/**
 * Create annotation
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const { paperId } = req.params;
    const parsed = createAnnotationSchema.safeParse(req.body);

    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() });
    }

    // Verify paper access
    if (!(await verifyPaperAccess(paperId, userId))) {
      return res.status(404).json({ error: 'Paper not found' });
    }

    const { page_number, rect, type, color, selected_text, note_content } = parsed.data;
    const annotationId = nanoid(21);

    await db.execute(sql`
      INSERT INTO paper_annotations (
        id, paper_id, user_id, page_number, rect, type, color, selected_text, note_content
      ) VALUES (
        ${annotationId}, ${paperId}, ${userId}, ${page_number},
        ${JSON.stringify(rect)}, ${type}, ${color},
        ${selected_text || null}, ${note_content || null}
      )
    `);

    res.status(201).json({
      id: annotationId,
      paper_id: paperId,
      page_number,
      type,
      color,
      message: 'Annotation created',
    });

  } catch (error) {
    console.error('[annotations/create] Error:', error);
    res.status(500).json({ error: 'Failed to create annotation' });
  }
});

/**
 * Get annotation
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const { paperId, id } = req.params;

    const result = await db.execute(sql`
      SELECT * FROM paper_annotations
      WHERE id = ${id} AND paper_id = ${paperId} AND user_id = ${userId}
    `);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Annotation not found' });
    }

    res.json(result.rows[0]);

  } catch (error) {
    console.error('[annotations/get] Error:', error);
    res.status(500).json({ error: 'Failed to get annotation' });
  }
});

/**
 * Update annotation
 */
router.patch('/:id', async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const { paperId, id } = req.params;
    const parsed = updateAnnotationSchema.safeParse(req.body);

    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() });
    }

    // Verify ownership
    const existing = await db.execute(sql`
      SELECT id FROM paper_annotations
      WHERE id = ${id} AND paper_id = ${paperId} AND user_id = ${userId}
    `);

    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Annotation not found' });
    }

    const { color, note_content } = parsed.data;

    // Build update
    const updates: string[] = ['updated_at = NOW()'];
    if (color !== undefined) updates.push(`color = '${color}'`);
    if (note_content !== undefined) updates.push(`note_content = ${note_content ? `'${note_content.replace(/'/g, "''")}'` : 'NULL'}`);

    await db.execute(sql`
      UPDATE paper_annotations
      SET ${sql.raw(updates.join(', '))}
      WHERE id = ${id}
    `);

    res.json({ success: true, id });

  } catch (error) {
    console.error('[annotations/update] Error:', error);
    res.status(500).json({ error: 'Failed to update annotation' });
  }
});

/**
 * Delete annotation
 */
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const { paperId, id } = req.params;

    // Verify ownership
    const existing = await db.execute(sql`
      SELECT id FROM paper_annotations
      WHERE id = ${id} AND paper_id = ${paperId} AND user_id = ${userId}
    `);

    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Annotation not found' });
    }

    await db.execute(sql`DELETE FROM paper_annotations WHERE id = ${id}`);

    res.json({ success: true, id });

  } catch (error) {
    console.error('[annotations/delete] Error:', error);
    res.status(500).json({ error: 'Failed to delete annotation' });
  }
});

/**
 * Get annotation threads
 */
router.get('/:id/threads', async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const { paperId, id } = req.params;

    // Verify annotation access
    const annotation = await db.execute(sql`
      SELECT id FROM paper_annotations
      WHERE id = ${id} AND paper_id = ${paperId} AND user_id = ${userId}
    `);

    if (annotation.rows.length === 0) {
      return res.status(404).json({ error: 'Annotation not found' });
    }

    const threads = await db.execute(sql`
      SELECT
        t.id, t.content, t.parent_id, t.is_resolved, t.created_at, t.updated_at,
        u.first_name, u.last_name, u.email
      FROM annotation_threads t
      LEFT JOIN users u ON t.user_id = u.id
      WHERE t.annotation_id = ${id}
      ORDER BY t.created_at ASC
    `);

    res.json({
      annotation_id: id,
      threads: threads.rows,
    });

  } catch (error) {
    console.error('[annotations/threads] Error:', error);
    res.status(500).json({ error: 'Failed to get threads' });
  }
});

/**
 * Add thread message
 */
router.post('/:id/threads', async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const { paperId, id } = req.params;
    const parsed = createThreadSchema.safeParse(req.body);

    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() });
    }

    // Verify annotation access
    const annotation = await db.execute(sql`
      SELECT id FROM paper_annotations
      WHERE id = ${id} AND paper_id = ${paperId} AND user_id = ${userId}
    `);

    if (annotation.rows.length === 0) {
      return res.status(404).json({ error: 'Annotation not found' });
    }

    const { content, parent_id } = parsed.data;
    const threadId = nanoid(21);

    await db.execute(sql`
      INSERT INTO annotation_threads (id, annotation_id, user_id, parent_id, content)
      VALUES (${threadId}, ${id}, ${userId}, ${parent_id || null}, ${content})
    `);

    res.status(201).json({
      id: threadId,
      annotation_id: id,
      content,
      message: 'Thread message added',
    });

  } catch (error) {
    console.error('[annotations/addThread] Error:', error);
    res.status(500).json({ error: 'Failed to add thread message' });
  }
});

/**
 * Resolve annotation
 */
router.patch('/:id/resolve', async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const { paperId, id } = req.params;
    const { resolved } = req.body;

    // Verify ownership
    const existing = await db.execute(sql`
      SELECT id FROM paper_annotations
      WHERE id = ${id} AND paper_id = ${paperId} AND user_id = ${userId}
    `);

    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Annotation not found' });
    }

    // Update all threads for this annotation
    await db.execute(sql`
      UPDATE annotation_threads
      SET is_resolved = ${resolved !== false}, updated_at = NOW()
      WHERE annotation_id = ${id}
    `);

    res.json({ success: true, id, resolved: resolved !== false });

  } catch (error) {
    console.error('[annotations/resolve] Error:', error);
    res.status(500).json({ error: 'Failed to resolve annotation' });
  }
});

export default router;
