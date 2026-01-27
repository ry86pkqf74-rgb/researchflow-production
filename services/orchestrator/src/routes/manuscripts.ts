/**
 * Manuscript Studio - Canonical REST API Routes
 *
 * API namespace: /api/manuscripts
 *
 * Endpoints:
 * - GET    /ping                           # Health check
 * - POST   /                               # Create manuscript
 * - GET    /                               # List manuscripts
 * - GET    /:id                            # Get manuscript
 * - PATCH  /:id                            # Update manuscript
 * - DELETE /:id                            # Delete manuscript (soft)
 * - GET    /:id/sections                   # Get sections
 * - GET    /:id/doc                        # Get latest doc state
 * - POST   /:id/doc/save                   # Save doc snapshot
 * - POST   /:id/sections/:sectionId/generate   # Generate section
 * - POST   /:id/sections/:sectionId/refine     # Refine with AI (diff)
 * - POST   /:id/sections/:sectionId/validate   # Validate section
 * - POST   /:id/abstract/generate              # Generate abstract
 * - GET    /:id/events                     # Provenance log
 *
 * @module routes/manuscripts
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { db } from '../../db';
import { sql, eq, desc, and } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { createHash } from 'crypto';
import { requireRole } from '../middleware/rbac';
import { createAuditEntry } from '../services/auditService';
import { scanForPHI, PHIScanResult } from '../services/phi-scanner.service';

const router = Router();

// =============================================================================
// Validation Schemas
// =============================================================================

const createManuscriptSchema = z.object({
  title: z.string().min(1).max(500),
  researchId: z.string().uuid().optional(),
  projectId: z.string().uuid().optional(),
  templateType: z.enum([
    'imrad', 'case_report', 'systematic_review',
    'meta_analysis', 'letter', 'editorial', 'review_article'
  ]).default('imrad'),
  citationStyle: z.enum(['AMA', 'APA', 'Vancouver', 'Harvard', 'Chicago']).default('AMA'),
  targetJournal: z.string().max(200).optional(),
});

const updateManuscriptSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  status: z.enum([
    'draft', 'in_review', 'revision_requested',
    'approved', 'submitted', 'published', 'archived'
  ]).optional(),
  targetJournal: z.string().max(200).optional(),
  metadata: z.record(z.any()).optional(),
});

const saveDocSchema = z.object({
  sectionId: z.string().uuid().optional(),
  yjsState: z.string().optional(), // Base64 encoded Yjs state
  contentText: z.string(),
  changeDescription: z.string().max(500).optional(),
});

const generateSectionSchema = z.object({
  sectionType: z.enum([
    'title', 'abstract', 'introduction', 'methods',
    'results', 'discussion', 'conclusion', 'references'
  ]),
  options: z.object({
    structured: z.boolean().optional(),
    wordLimit: z.number().positive().optional(),
    journalStyle: z.string().optional(),
    instructions: z.string().max(1000).optional(),
  }).optional(),
});

const refineSectionSchema = z.object({
  selectedText: z.string().min(1),
  instruction: z.string().min(1).max(500),
  selectionStart: z.number().int().nonnegative(),
  selectionEnd: z.number().int().nonnegative(),
});

// =============================================================================
// Helper Functions
// =============================================================================

function isLiveMode(): boolean {
  const mode = process.env.GOVERNANCE_MODE || process.env.ROS_MODE || 'DEMO';
  return mode === 'LIVE';
}

function generateContentHash(content: string): string {
  return createHash('sha256').update(content).digest('hex');
}

async function logManuscriptEvent(
  manuscriptId: string,
  action: string,
  userId: string,
  details: Record<string, any>,
  previousHash?: string
): Promise<string> {
  const hashInput = JSON.stringify({ manuscriptId, action, details, previousHash, timestamp: Date.now() });
  const currentHash = generateContentHash(hashInput);

  await db.execute(sql`
    INSERT INTO manuscript_audit_log (id, manuscript_id, action, details, user_id, previous_hash, current_hash)
    VALUES (${`audit_${nanoid(12)}`}, ${manuscriptId}, ${action}, ${JSON.stringify(details)}::jsonb, ${userId}, ${previousHash || null}, ${currentHash})
  `);

  return currentHash;
}

// =============================================================================
// Routes
// =============================================================================

/**
 * GET /api/manuscripts/ping
 * Health check endpoint
 */
router.get('/ping', (req: Request, res: Response) => {
  res.json({
    status: 'ok',
    timestamp: Date.now(),
    service: 'manuscript-studio',
    mode: process.env.GOVERNANCE_MODE || 'DEMO',
  });
});

/**
 * POST /api/manuscripts
 * Create a new manuscript
 */
router.post('/', requireRole('RESEARCHER'), async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const parsed = createManuscriptSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() });
    }

    const { title, researchId, projectId, templateType, citationStyle, targetJournal } = parsed.data;
    const manuscriptId = `ms_${nanoid(12)}`;

    // Create manuscript
    await db.execute(sql`
      INSERT INTO manuscripts (id, user_id, project_id, title, template_type, citation_style, target_journal)
      VALUES (${manuscriptId}, ${userId}, ${projectId || null}, ${title}, ${templateType}, ${citationStyle}, ${targetJournal || null})
    `);

    // Create initial version
    const versionId = `ver_${nanoid(12)}`;
    const initialContent = {
      sections: {
        title: { content: title, wordCount: title.split(/\s+/).length },
        abstract: { content: '', wordCount: 0 },
        introduction: { content: '', wordCount: 0 },
        methods: { content: '', wordCount: 0 },
        results: { content: '', wordCount: 0 },
        discussion: { content: '', wordCount: 0 },
        conclusion: { content: '', wordCount: 0 },
        references: { content: '', citations: [] },
      },
    };
    const contentHash = generateContentHash(JSON.stringify(initialContent));

    await db.execute(sql`
      INSERT INTO manuscript_versions (id, manuscript_id, version_number, content, data_snapshot_hash, word_count, change_description, current_hash, created_by)
      VALUES (${versionId}, ${manuscriptId}, 1, ${JSON.stringify(initialContent)}::jsonb, ${contentHash}, 0, 'Initial creation', ${contentHash}, ${userId})
    `);

    // Update manuscript with current version
    await db.execute(sql`
      UPDATE manuscripts SET current_version_id = ${versionId} WHERE id = ${manuscriptId}
    `);

    // Audit log
    await logManuscriptEvent(manuscriptId, 'MANUSCRIPT_CREATED', userId, {
      title,
      templateType,
      citationStyle,
      researchId,
    });

    await createAuditEntry({
      eventType: 'MANUSCRIPT_CREATED',
      userId,
      resourceType: 'manuscript',
      resourceId: manuscriptId,
      action: 'create',
      details: { title, templateType },
    });

    res.status(201).json({
      id: manuscriptId,
      title,
      status: 'draft',
      templateType,
      citationStyle,
      targetJournal,
      currentVersionId: versionId,
      createdAt: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('[manuscripts] Create error:', error);
    res.status(500).json({ error: 'Failed to create manuscript' });
  }
});

/**
 * GET /api/manuscripts
 * List manuscripts for current user
 */
router.get('/', requireRole('VIEWER'), async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { status, limit = '20', offset = '0' } = req.query;

    let query = sql`
      SELECT m.*,
        (SELECT COUNT(*) FROM manuscript_versions WHERE manuscript_id = m.id) as version_count
      FROM manuscripts m
      WHERE m.user_id = ${userId}
    `;

    if (status) {
      query = sql`${query} AND m.status = ${status as string}`;
    }

    query = sql`${query} ORDER BY m.updated_at DESC LIMIT ${parseInt(limit as string)} OFFSET ${parseInt(offset as string)}`;

    const result = await db.execute(query);

    res.json({
      manuscripts: result.rows || [],
      pagination: {
        limit: parseInt(limit as string),
        offset: parseInt(offset as string),
        hasMore: (result.rows?.length || 0) === parseInt(limit as string),
      },
    });
  } catch (error: any) {
    console.error('[manuscripts] List error:', error);
    res.status(500).json({ error: 'Failed to list manuscripts' });
  }
});

/**
 * GET /api/manuscripts/:id
 * Get manuscript by ID
 */
router.get('/:id', requireRole('VIEWER'), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = (req as any).user?.id;

    const result = await db.execute(sql`
      SELECT m.*, mv.content, mv.version_number, mv.word_count
      FROM manuscripts m
      LEFT JOIN manuscript_versions mv ON m.current_version_id = mv.id
      WHERE m.id = ${id}
    `);

    if (!result.rows || result.rows.length === 0) {
      return res.status(404).json({ error: 'Manuscript not found' });
    }

    const manuscript = result.rows[0];

    // Get authors
    const authorsResult = await db.execute(sql`
      SELECT * FROM manuscript_authors WHERE manuscript_id = ${id} ORDER BY order_index
    `);

    // Get citation count
    const citationsResult = await db.execute(sql`
      SELECT COUNT(*) as count FROM manuscript_citations WHERE manuscript_id = ${id}
    `);

    res.json({
      ...manuscript,
      authors: authorsResult.rows || [],
      citationCount: parseInt(citationsResult.rows?.[0]?.count || '0'),
    });
  } catch (error: any) {
    console.error('[manuscripts] Get error:', error);
    res.status(500).json({ error: 'Failed to get manuscript' });
  }
});

/**
 * PATCH /api/manuscripts/:id
 * Update manuscript
 */
router.patch('/:id', requireRole('RESEARCHER'), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = (req as any).user?.id;

    const parsed = updateManuscriptSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() });
    }

    const updates = parsed.data;
    const updateFields: string[] = [];
    const values: any[] = [];

    if (updates.title) {
      updateFields.push('title = $' + (values.length + 1));
      values.push(updates.title);
    }
    if (updates.status) {
      updateFields.push('status = $' + (values.length + 1));
      values.push(updates.status);
    }
    if (updates.targetJournal !== undefined) {
      updateFields.push('target_journal = $' + (values.length + 1));
      values.push(updates.targetJournal);
    }
    if (updates.metadata) {
      updateFields.push('metadata = $' + (values.length + 1));
      values.push(JSON.stringify(updates.metadata));
    }

    if (updateFields.length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }

    await db.execute(sql`
      UPDATE manuscripts
      SET ${sql.raw(updateFields.join(', '))}, updated_at = NOW()
      WHERE id = ${id}
    `);

    await logManuscriptEvent(id, 'MANUSCRIPT_UPDATED', userId, updates);

    const result = await db.execute(sql`SELECT * FROM manuscripts WHERE id = ${id}`);
    res.json(result.rows?.[0] || {});
  } catch (error: any) {
    console.error('[manuscripts] Update error:', error);
    res.status(500).json({ error: 'Failed to update manuscript' });
  }
});

/**
 * GET /api/manuscripts/:id/sections
 * Get manuscript sections
 */
router.get('/:id/sections', requireRole('VIEWER'), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const result = await db.execute(sql`
      SELECT mv.content
      FROM manuscripts m
      JOIN manuscript_versions mv ON m.current_version_id = mv.id
      WHERE m.id = ${id}
    `);

    if (!result.rows || result.rows.length === 0) {
      return res.status(404).json({ error: 'Manuscript not found' });
    }

    const content = result.rows[0].content as any;
    const sections = content?.sections || {};

    res.json({
      manuscriptId: id,
      sections: Object.entries(sections).map(([type, data]: [string, any]) => ({
        type,
        content: data.content || '',
        wordCount: data.wordCount || 0,
      })),
    });
  } catch (error: any) {
    console.error('[manuscripts] Get sections error:', error);
    res.status(500).json({ error: 'Failed to get sections' });
  }
});

/**
 * GET /api/manuscripts/:id/doc
 * Get latest document state
 */
router.get('/:id/doc', requireRole('VIEWER'), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const result = await db.execute(sql`
      SELECT mv.*
      FROM manuscripts m
      JOIN manuscript_versions mv ON m.current_version_id = mv.id
      WHERE m.id = ${id}
    `);

    if (!result.rows || result.rows.length === 0) {
      return res.status(404).json({ error: 'Manuscript not found' });
    }

    res.json(result.rows[0]);
  } catch (error: any) {
    console.error('[manuscripts] Get doc error:', error);
    res.status(500).json({ error: 'Failed to get document' });
  }
});

/**
 * POST /api/manuscripts/:id/doc/save
 * Save document snapshot
 */
router.post('/:id/doc/save', requireRole('RESEARCHER'), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = (req as any).user?.id;

    const parsed = saveDocSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() });
    }

    const { sectionId, yjsState, contentText, changeDescription } = parsed.data;

    // PHI scan in LIVE mode
    if (isLiveMode()) {
      const phiResult = await scanForPHI(contentText);
      if (phiResult.hasPHI) {
        return res.status(400).json({
          error: 'PHI_DETECTED',
          message: 'Content contains PHI. Please remove or redact before saving.',
          locations: phiResult.locations?.map((loc: any) => ({
            start: loc.charStart,
            end: loc.charEnd,
            type: loc.type,
            // NO raw value returned
          })),
        });
      }
    }

    // Get current version info
    const currentResult = await db.execute(sql`
      SELECT mv.version_number, mv.current_hash
      FROM manuscripts m
      JOIN manuscript_versions mv ON m.current_version_id = mv.id
      WHERE m.id = ${id}
    `);

    if (!currentResult.rows || currentResult.rows.length === 0) {
      return res.status(404).json({ error: 'Manuscript not found' });
    }

    const currentVersion = currentResult.rows[0];
    const newVersionNumber = (currentVersion.version_number || 0) + 1;
    const newVersionId = `ver_${nanoid(12)}`;

    // Create content object
    const content = {
      text: contentText,
      yjsState: yjsState || null,
      sectionId: sectionId || null,
    };
    const contentHash = generateContentHash(JSON.stringify(content));
    const wordCount = contentText.split(/\s+/).filter(Boolean).length;

    // Insert new version
    await db.execute(sql`
      INSERT INTO manuscript_versions (id, manuscript_id, version_number, content, data_snapshot_hash, word_count, change_description, previous_hash, current_hash, created_by)
      VALUES (${newVersionId}, ${id}, ${newVersionNumber}, ${JSON.stringify(content)}::jsonb, ${contentHash}, ${wordCount}, ${changeDescription || 'Document saved'}, ${currentVersion.current_hash}, ${contentHash}, ${userId})
    `);

    // Update manuscript current version
    await db.execute(sql`
      UPDATE manuscripts SET current_version_id = ${newVersionId}, updated_at = NOW() WHERE id = ${id}
    `);

    await logManuscriptEvent(id, 'DOCUMENT_SAVED', userId, {
      versionNumber: newVersionNumber,
      wordCount,
      sectionId,
    }, currentVersion.current_hash);

    res.json({
      id: newVersionId,
      manuscriptId: id,
      versionNumber: newVersionNumber,
      wordCount,
      savedAt: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('[manuscripts] Save doc error:', error);
    res.status(500).json({ error: 'Failed to save document' });
  }
});

/**
 * POST /api/manuscripts/:id/sections/:sectionId/refine
 * Refine section with AI - returns diff, NOT overwrite
 */
router.post('/:id/sections/:sectionId/refine', requireRole('RESEARCHER'), async (req: Request, res: Response) => {
  try {
    const { id, sectionId } = req.params;
    const userId = (req as any).user?.id;

    const parsed = refineSectionSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() });
    }

    const { selectedText, instruction, selectionStart, selectionEnd } = parsed.data;

    // PHI gate in LIVE mode
    if (isLiveMode()) {
      const phiResult = await scanForPHI(selectedText);
      if (phiResult.hasPHI) {
        await logManuscriptEvent(id, 'PHI_BLOCKED', userId, {
          action: 'refine',
          sectionId,
          locationsCount: phiResult.locations?.length || 0,
        });

        return res.status(400).json({
          error: 'PHI_DETECTED',
          message: 'Selected text contains PHI. Please remove or redact before AI refinement.',
          locations: phiResult.locations?.map((loc: any) => ({
            start: loc.charStart,
            end: loc.charEnd,
            type: loc.type,
          })),
        });
      }
    }

    // TODO: Integrate with actual AI service
    // For now, return a mock diff structure
    const proposedText = `[AI Refined] ${selectedText}`;

    // Log provenance
    await logManuscriptEvent(id, 'AI_REFINE_REQUESTED', userId, {
      sectionId,
      instruction,
      inputHash: generateContentHash(selectedText),
      outputHash: generateContentHash(proposedText),
      model: 'claude-3-sonnet', // TODO: Get from AI router
    });

    // Return diff structure - NOT overwrite
    res.json({
      original: selectedText,
      proposed: proposedText,
      diff: {
        type: 'replacement',
        changes: [
          { operation: 'delete', text: selectedText },
          { operation: 'insert', text: proposedText },
        ],
      },
      selectionStart,
      selectionEnd,
      instruction,
      confidence: 0.85,
      provenanceId: `prov_${nanoid(8)}`,
    });
  } catch (error: any) {
    console.error('[manuscripts] Refine error:', error);
    res.status(500).json({ error: 'Failed to refine section' });
  }
});

/**
 * POST /api/manuscripts/:id/abstract/generate
 * Generate abstract
 */
router.post('/:id/abstract/generate', requireRole('RESEARCHER'), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = (req as any).user?.id;

    const { structured = false, wordLimit = 250 } = req.body;

    // Get manuscript content for context
    const result = await db.execute(sql`
      SELECT mv.content
      FROM manuscripts m
      JOIN manuscript_versions mv ON m.current_version_id = mv.id
      WHERE m.id = ${id}
    `);

    if (!result.rows || result.rows.length === 0) {
      return res.status(404).json({ error: 'Manuscript not found' });
    }

    // TODO: Integrate with abstractGeneratorService
    // For now, return placeholder
    const abstractContent = structured
      ? `**Background**: [Generated background]\n\n**Methods**: [Generated methods]\n\n**Results**: [Generated results]\n\n**Conclusion**: [Generated conclusion]`
      : `[Generated abstract - ${wordLimit} word limit]`;

    await logManuscriptEvent(id, 'ABSTRACT_GENERATED', userId, {
      structured,
      wordLimit,
      model: 'claude-3-sonnet',
    });

    res.json({
      content: abstractContent,
      wordCount: abstractContent.split(/\s+/).length,
      structured,
      provenanceId: `prov_${nanoid(8)}`,
    });
  } catch (error: any) {
    console.error('[manuscripts] Generate abstract error:', error);
    res.status(500).json({ error: 'Failed to generate abstract' });
  }
});

/**
 * GET /api/manuscripts/:id/events
 * Get provenance/audit log
 */
router.get('/:id/events', requireRole('VIEWER'), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { limit = '50', offset = '0' } = req.query;

    const result = await db.execute(sql`
      SELECT mal.*, u.email as user_email
      FROM manuscript_audit_log mal
      LEFT JOIN users u ON mal.user_id = u.id
      WHERE mal.manuscript_id = ${id}
      ORDER BY mal.timestamp DESC
      LIMIT ${parseInt(limit as string)} OFFSET ${parseInt(offset as string)}
    `);

    res.json({
      manuscriptId: id,
      events: result.rows || [],
      pagination: {
        limit: parseInt(limit as string),
        offset: parseInt(offset as string),
      },
    });
  } catch (error: any) {
    console.error('[manuscripts] Get events error:', error);
    res.status(500).json({ error: 'Failed to get events' });
  }
});

// =============================================================================
// Phase M3: Comments System
// =============================================================================

const createCommentSchema = z.object({
  sectionId: z.string().uuid().optional(),
  anchorStart: z.number().int().nonnegative().optional(),
  anchorEnd: z.number().int().nonnegative().optional(),
  anchorText: z.string().max(500).optional(),
  body: z.string().min(1).max(5000),
  tag: z.string().max(50).optional(),
  parentId: z.string().uuid().optional(),
});

/**
 * GET /api/manuscripts/:id/comments
 * Get comments for manuscript
 */
router.get('/:id/comments', requireRole('VIEWER'), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { status, sectionId } = req.query;

    let query = sql`
      SELECT mc.*, u.email as author_email, u.name as author_name
      FROM manuscript_comments mc
      LEFT JOIN users u ON mc.created_by = u.id
      WHERE mc.manuscript_id = ${id}
    `;

    if (status) {
      query = sql`${query} AND mc.status = ${status as string}`;
    }
    if (sectionId) {
      query = sql`${query} AND mc.section_id = ${sectionId as string}`;
    }

    query = sql`${query} ORDER BY mc.created_at ASC`;

    const result = await db.execute(query);

    // Build threaded structure
    const comments = result.rows || [];
    const rootComments = comments.filter((c: any) => !c.parent_id);
    const replies = comments.filter((c: any) => c.parent_id);

    const threaded = rootComments.map((root: any) => ({
      ...root,
      replies: replies.filter((r: any) => r.parent_id === root.id),
    }));

    res.json({
      manuscriptId: id,
      comments: threaded,
      totalCount: comments.length,
    });
  } catch (error: any) {
    console.error('[manuscripts] Get comments error:', error);
    res.status(500).json({ error: 'Failed to get comments' });
  }
});

/**
 * POST /api/manuscripts/:id/comments
 * Add comment to manuscript
 */
router.post('/:id/comments', requireRole('RESEARCHER'), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = (req as any).user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const parsed = createCommentSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() });
    }

    const { sectionId, anchorStart, anchorEnd, anchorText, body, tag, parentId } = parsed.data;
    const commentId = `cmt_${nanoid(12)}`;

    await db.execute(sql`
      INSERT INTO manuscript_comments (id, manuscript_id, section_id, anchor_start, anchor_end, anchor_text, body, tag, parent_id, created_by)
      VALUES (${commentId}, ${id}, ${sectionId || null}, ${anchorStart || null}, ${anchorEnd || null}, ${anchorText || null}, ${body}, ${tag || null}, ${parentId || null}, ${userId})
    `);

    await logManuscriptEvent(id, 'COMMENT_ADDED', userId, {
      commentId,
      sectionId,
      hasAnchor: !!(anchorStart && anchorEnd),
      tag,
      isReply: !!parentId,
    });

    const result = await db.execute(sql`
      SELECT mc.*, u.email as author_email, u.name as author_name
      FROM manuscript_comments mc
      LEFT JOIN users u ON mc.created_by = u.id
      WHERE mc.id = ${commentId}
    `);

    res.status(201).json(result.rows?.[0] || { id: commentId });
  } catch (error: any) {
    console.error('[manuscripts] Add comment error:', error);
    res.status(500).json({ error: 'Failed to add comment' });
  }
});

/**
 * POST /api/manuscripts/:id/comments/:commentId/resolve
 * Resolve a comment
 */
router.post('/:id/comments/:commentId/resolve', requireRole('RESEARCHER'), async (req: Request, res: Response) => {
  try {
    const { id, commentId } = req.params;
    const userId = (req as any).user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const result = await db.execute(sql`
      UPDATE manuscript_comments
      SET status = 'resolved', resolved_by = ${userId}, resolved_at = NOW(), updated_at = NOW()
      WHERE id = ${commentId} AND manuscript_id = ${id}
      RETURNING *
    `);

    if (!result.rows || result.rows.length === 0) {
      return res.status(404).json({ error: 'Comment not found' });
    }

    await logManuscriptEvent(id, 'COMMENT_RESOLVED', userId, { commentId });

    res.json(result.rows[0]);
  } catch (error: any) {
    console.error('[manuscripts] Resolve comment error:', error);
    res.status(500).json({ error: 'Failed to resolve comment' });
  }
});

/**
 * DELETE /api/manuscripts/:id/comments/:commentId
 * Delete a comment (soft delete - archive)
 */
router.delete('/:id/comments/:commentId', requireRole('RESEARCHER'), async (req: Request, res: Response) => {
  try {
    const { id, commentId } = req.params;
    const userId = (req as any).user?.id;

    const result = await db.execute(sql`
      UPDATE manuscript_comments
      SET status = 'archived', updated_at = NOW()
      WHERE id = ${commentId} AND manuscript_id = ${id} AND created_by = ${userId}
      RETURNING *
    `);

    if (!result.rows || result.rows.length === 0) {
      return res.status(404).json({ error: 'Comment not found or not authorized' });
    }

    await logManuscriptEvent(id, 'COMMENT_DELETED', userId, { commentId });

    res.json({ success: true, id: commentId });
  } catch (error: any) {
    console.error('[manuscripts] Delete comment error:', error);
    res.status(500).json({ error: 'Failed to delete comment' });
  }
});

export default router;
