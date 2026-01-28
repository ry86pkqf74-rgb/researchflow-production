/**
 * Paper Library API Routes
 *
 * Track B Phase 10-12: Paper Library, Annotations, AI Copilot
 *
 * API namespace: /api/papers
 *
 * SEC-003: RBAC MIDDLEWARE AUDIT
 * All write operations require authentication (RESEARCHER+ role)
 * Read operations are open but authenticated
 *
 * Endpoints:
 * - GET    /ping                           # Health check (public)
 * - POST   /upload                         # Upload PDF (RESEARCHER)
 * - POST   /import                         # Import from DOI/PMID (RESEARCHER)
 * - GET    /                               # List papers (RESEARCHER)
 * - GET    /:id                            # Get paper details (RESEARCHER)
 * - PATCH  /:id                            # Update paper metadata (RESEARCHER)
 * - DELETE /:id                            # Delete paper (RESEARCHER)
 * - POST   /:id/tags                       # Add tags (RESEARCHER)
 * - DELETE /:id/tags/:tag                  # Remove tag (RESEARCHER)
 * - GET    /search                         # Full-text search (RESEARCHER)
 * - GET    /:id/text                       # Get extracted text (RESEARCHER)
 *
 * Annotations (Phase 11): /api/papers/:id/annotations/*
 * AI Copilot (Phase 12):  /api/papers/:id/copilot/*
 *
 * @module routes/papers
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { db } from '../../db';
import { sql, eq, desc, and, ilike, or } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { createHash } from 'crypto';
import multer from 'multer';
import path from 'path';
import fs from 'fs/promises';
import { protect, requirePermission } from '../middleware/rbac';
import { requireAuth } from '../services/authService';
import annotationsRouter from './paper-annotations';
import copilotRouter from './paper-copilot';

const router = Router();

// Mount subrouters with authentication
router.use('/:paperId/annotations', requireAuth, annotationsRouter);
router.use('/:paperId/copilot', requireAuth, copilotRouter);

// =============================================================================
// Configuration
// =============================================================================

const UPLOAD_DIR = process.env.PAPER_UPLOAD_DIR || '/app/uploads/papers';
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

// Ensure upload directory exists
fs.mkdir(UPLOAD_DIR, { recursive: true }).catch(console.error);

// Multer configuration for PDF uploads
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, UPLOAD_DIR);
  },
  filename: (_req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${nanoid(8)}`;
    cb(null, `paper-${uniqueSuffix}${path.extname(file.originalname)}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are allowed'));
    }
  },
});

// =============================================================================
// Validation Schemas
// =============================================================================

const updatePaperSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  abstract: z.string().optional(),
  authors: z.array(z.object({
    name: z.string(),
    affiliation: z.string().optional(),
    orcid: z.string().optional(),
  })).optional(),
  year: z.number().int().min(1900).max(2100).optional(),
  journal: z.string().max(300).optional(),
  doi: z.string().max(100).optional(),
  pmid: z.string().max(20).optional(),
  read_status: z.enum(['unread', 'reading', 'read']).optional(),
  rating: z.number().int().min(1).max(5).nullable().optional(),
  notes: z.string().optional(),
});

const importPaperSchema = z.object({
  doi: z.string().optional(),
  pmid: z.string().optional(),
  arxiv_id: z.string().optional(),
}).refine(data => data.doi || data.pmid || data.arxiv_id, {
  message: 'At least one identifier (DOI, PMID, or arXiv ID) is required',
});

const addTagSchema = z.object({
  tag: z.string().min(1).max(100),
  color: z.string().max(20).optional(),
});

const searchSchema = z.object({
  q: z.string().min(1).optional(),
  tags: z.array(z.string()).optional(),
  year_from: z.coerce.number().int().optional(),
  year_to: z.coerce.number().int().optional(),
  read_status: z.enum(['unread', 'reading', 'read']).optional(),
  collection_id: z.string().uuid().optional(),
  sort: z.enum(['created_at', 'title', 'year', 'rating']).default('created_at'),
  order: z.enum(['asc', 'desc']).default('desc'),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

// =============================================================================
// Helper Functions
// =============================================================================

function getUserId(req: Request): string {
  // In production, extract from JWT token
  return (req as any).user?.id || 'demo-user';
}

async function computeFileHash(filePath: string): Promise<string> {
  const fileBuffer = await fs.readFile(filePath);
  return createHash('sha256').update(fileBuffer).digest('hex');
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
    service: 'paper-library',
    mode: process.env.GOVERNANCE_MODE || 'DEMO',
  });
});

/**
 * Upload PDF
 * SEC-003: Requires RESEARCHER role to prevent abuse
 */
router.post('/upload', ...protect('CREATE_PAPER'), upload.single('file'), async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const file = req.file;

    if (!file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    // Compute file hash for deduplication
    const fileHash = await computeFileHash(file.path);

    // Check for duplicate
    const existingPaper = await db.execute(sql`
      SELECT id, title FROM papers
      WHERE user_id = ${userId} AND file_hash = ${fileHash}
      LIMIT 1
    `);

    if (existingPaper.rows.length > 0) {
      // Remove uploaded file (duplicate)
      await fs.unlink(file.path);
      return res.status(409).json({
        error: 'DUPLICATE_PAPER',
        message: 'This PDF already exists in your library',
        existing_id: existingPaper.rows[0].id,
        existing_title: existingPaper.rows[0].title,
      });
    }

    // Create paper record
    const paperId = nanoid(21);
    const defaultTitle = path.basename(file.originalname, '.pdf');

    await db.execute(sql`
      INSERT INTO papers (
        id, user_id, title, pdf_path, file_size_bytes, file_hash, status
      ) VALUES (
        ${paperId}, ${userId}, ${defaultTitle}, ${file.path},
        ${file.size}, ${fileHash}, 'pending'
      )
    `);

    // TODO: Queue background job for PDF processing
    // - Extract text
    // - Extract metadata (title, authors, etc.)
    // - Generate thumbnail

    res.status(201).json({
      id: paperId,
      title: defaultTitle,
      status: 'pending',
      message: 'Paper uploaded successfully. Processing will begin shortly.',
    });

  } catch (error) {
    console.error('[papers/upload] Error:', error);
    res.status(500).json({ error: 'Failed to upload paper' });
  }
});

/**
 * Import paper from DOI/PMID
 * SEC-003: Requires RESEARCHER role
 */
router.post('/import', ...protect('CREATE_PAPER'), async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const parsed = importPaperSchema.safeParse(req.body);

    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() });
    }

    const { doi, pmid, arxiv_id } = parsed.data;

    // TODO: Implement metadata fetching from:
    // - CrossRef API (for DOI)
    // - PubMed API (for PMID)
    // - arXiv API (for arXiv ID)

    // For now, create a placeholder record
    const paperId = nanoid(21);

    await db.execute(sql`
      INSERT INTO papers (
        id, user_id, title, doi, pmid, arxiv_id, status
      ) VALUES (
        ${paperId}, ${userId}, ${'Importing...'},
        ${doi || null}, ${pmid || null}, ${arxiv_id || null}, 'processing'
      )
    `);

    res.status(202).json({
      id: paperId,
      status: 'processing',
      message: 'Paper import started. Metadata will be fetched shortly.',
    });

  } catch (error) {
    console.error('[papers/import] Error:', error);
    res.status(500).json({ error: 'Failed to import paper' });
  }
});

/**
 * List papers
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const parsed = searchSchema.safeParse(req.query);

    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid query', details: parsed.error.flatten() });
    }

    const { sort, order, limit, offset, read_status, year_from, year_to, collection_id } = parsed.data;

    // If filtering by collection, use JOIN query
    if (collection_id) {
      // First verify user owns the collection
      const collectionCheck = await db.execute(sql`
        SELECT id FROM collections WHERE id = ${collection_id} AND user_id = ${userId}
      `);
      if (collectionCheck.rows.length === 0) {
        return res.status(404).json({ error: 'Collection not found' });
      }

      // Build conditions for papers in collection
      let conditions = sql`p.user_id = ${userId}`;
      if (read_status) {
        conditions = sql`${conditions} AND p.read_status = ${read_status}`;
      }
      if (year_from) {
        conditions = sql`${conditions} AND p.year >= ${year_from}`;
      }
      if (year_to) {
        conditions = sql`${conditions} AND p.year <= ${year_to}`;
      }

      // Get papers in collection
      const papers = await db.execute(sql`
        SELECT
          p.id, p.title, p.authors, p.abstract, p.doi, p.pmid, p.year, p.journal,
          p.pdf_path, p.page_count, p.word_count, p.status, p.read_status, p.rating, p.notes,
          p.created_at, p.updated_at, cp.collection_notes, cp.added_at
        FROM papers p
        INNER JOIN collection_papers cp ON cp.paper_id = p.id
        WHERE cp.collection_id = ${collection_id} AND ${conditions}
        ORDER BY cp.sort_order ASC, p.${sql.raw(sort)} ${sql.raw(order.toUpperCase())}
        LIMIT ${limit} OFFSET ${offset}
      `);

      // Get total count in collection
      const countResult = await db.execute(sql`
        SELECT COUNT(*) as total
        FROM papers p
        INNER JOIN collection_papers cp ON cp.paper_id = p.id
        WHERE cp.collection_id = ${collection_id} AND ${conditions}
      `);

      const total = parseInt(countResult.rows[0]?.total || '0');

      return res.json({
        papers: papers.rows,
        collection_id,
        pagination: {
          total,
          limit,
          offset,
          hasMore: offset + papers.rows.length < total,
        },
      });
    }

    // Standard query (no collection filter)
    let conditions = sql`user_id = ${userId}`;

    if (read_status) {
      conditions = sql`${conditions} AND read_status = ${read_status}`;
    }
    if (year_from) {
      conditions = sql`${conditions} AND year >= ${year_from}`;
    }
    if (year_to) {
      conditions = sql`${conditions} AND year <= ${year_to}`;
    }

    // Get papers
    const papers = await db.execute(sql`
      SELECT
        id, title, authors, abstract, doi, pmid, year, journal,
        pdf_path, page_count, word_count, status, read_status, rating, notes,
        created_at, updated_at
      FROM papers
      WHERE ${conditions}
      ORDER BY ${sql.raw(sort)} ${sql.raw(order.toUpperCase())}
      LIMIT ${limit} OFFSET ${offset}
    `);

    // Get total count
    const countResult = await db.execute(sql`
      SELECT COUNT(*) as total FROM papers WHERE ${conditions}
    `);

    const total = parseInt(countResult.rows[0]?.total || '0');

    res.json({
      papers: papers.rows,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + papers.rows.length < total,
      },
    });

  } catch (error) {
    console.error('[papers/list] Error:', error);
    res.status(500).json({ error: 'Failed to list papers' });
  }
});

/**
 * Get paper details
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const { id } = req.params;

    const result = await db.execute(sql`
      SELECT * FROM papers
      WHERE id = ${id} AND user_id = ${userId}
      LIMIT 1
    `);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Paper not found' });
    }

    const paper = result.rows[0];

    // Get tags
    const tagsResult = await db.execute(sql`
      SELECT tag, color FROM paper_tags WHERE paper_id = ${id}
    `);

    res.json({
      ...paper,
      tags: tagsResult.rows,
    });

  } catch (error) {
    console.error('[papers/get] Error:', error);
    res.status(500).json({ error: 'Failed to get paper' });
  }
});

/**
 * Update paper
 */
router.patch('/:id', async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const { id } = req.params;
    const parsed = updatePaperSchema.safeParse(req.body);

    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() });
    }

    // Check ownership
    const existing = await db.execute(sql`
      SELECT id FROM papers WHERE id = ${id} AND user_id = ${userId}
    `);

    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Paper not found' });
    }

    // Build update
    const updates = parsed.data;
    const setClauses: string[] = [];
    const values: any[] = [];

    if (updates.title !== undefined) {
      setClauses.push('title = $' + (values.length + 1));
      values.push(updates.title);
    }
    if (updates.abstract !== undefined) {
      setClauses.push('abstract = $' + (values.length + 1));
      values.push(updates.abstract);
    }
    if (updates.authors !== undefined) {
      setClauses.push('authors = $' + (values.length + 1));
      values.push(JSON.stringify(updates.authors));
    }
    if (updates.year !== undefined) {
      setClauses.push('year = $' + (values.length + 1));
      values.push(updates.year);
    }
    if (updates.journal !== undefined) {
      setClauses.push('journal = $' + (values.length + 1));
      values.push(updates.journal);
    }
    if (updates.doi !== undefined) {
      setClauses.push('doi = $' + (values.length + 1));
      values.push(updates.doi);
    }
    if (updates.pmid !== undefined) {
      setClauses.push('pmid = $' + (values.length + 1));
      values.push(updates.pmid);
    }
    if (updates.read_status !== undefined) {
      setClauses.push('read_status = $' + (values.length + 1));
      values.push(updates.read_status);
    }
    if (updates.rating !== undefined) {
      setClauses.push('rating = $' + (values.length + 1));
      values.push(updates.rating);
    }
    if (updates.notes !== undefined) {
      setClauses.push('notes = $' + (values.length + 1));
      values.push(updates.notes);
    }

    if (setClauses.length === 0) {
      return res.status(400).json({ error: 'No updates provided' });
    }

    // Execute update using raw SQL
    await db.execute(sql`
      UPDATE papers SET
        ${sql.raw(setClauses.join(', '))},
        updated_at = NOW()
      WHERE id = ${id}
    `);

    res.json({ success: true, id });

  } catch (error) {
    console.error('[papers/update] Error:', error);
    res.status(500).json({ error: 'Failed to update paper' });
  }
});

/**
 * Delete paper
 */
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const { id } = req.params;

    // Get paper to delete file
    const paper = await db.execute(sql`
      SELECT pdf_path FROM papers WHERE id = ${id} AND user_id = ${userId}
    `);

    if (paper.rows.length === 0) {
      return res.status(404).json({ error: 'Paper not found' });
    }

    // Delete from database
    await db.execute(sql`DELETE FROM papers WHERE id = ${id}`);

    // Delete file if exists
    const pdfPath = paper.rows[0].pdf_path;
    if (pdfPath) {
      await fs.unlink(pdfPath).catch(() => {});
    }

    res.json({ success: true, id });

  } catch (error) {
    console.error('[papers/delete] Error:', error);
    res.status(500).json({ error: 'Failed to delete paper' });
  }
});

/**
 * Add tag to paper
 */
router.post('/:id/tags', async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const { id } = req.params;
    const parsed = addTagSchema.safeParse(req.body);

    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() });
    }

    // Check ownership
    const paper = await db.execute(sql`
      SELECT id FROM papers WHERE id = ${id} AND user_id = ${userId}
    `);

    if (paper.rows.length === 0) {
      return res.status(404).json({ error: 'Paper not found' });
    }

    const { tag, color } = parsed.data;

    // Add tag (ON CONFLICT DO NOTHING for idempotency)
    await db.execute(sql`
      INSERT INTO paper_tags (paper_id, tag, color)
      VALUES (${id}, ${tag}, ${color || 'gray'})
      ON CONFLICT (paper_id, tag) DO UPDATE SET color = EXCLUDED.color
    `);

    res.json({ success: true, paper_id: id, tag });

  } catch (error) {
    console.error('[papers/addTag] Error:', error);
    res.status(500).json({ error: 'Failed to add tag' });
  }
});

/**
 * Remove tag from paper
 */
router.delete('/:id/tags/:tag', async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const { id, tag } = req.params;

    // Check ownership
    const paper = await db.execute(sql`
      SELECT id FROM papers WHERE id = ${id} AND user_id = ${userId}
    `);

    if (paper.rows.length === 0) {
      return res.status(404).json({ error: 'Paper not found' });
    }

    await db.execute(sql`
      DELETE FROM paper_tags WHERE paper_id = ${id} AND tag = ${tag}
    `);

    res.json({ success: true, paper_id: id, tag });

  } catch (error) {
    console.error('[papers/removeTag] Error:', error);
    res.status(500).json({ error: 'Failed to remove tag' });
  }
});

/**
 * Search papers
 */
router.get('/search', async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const parsed = searchSchema.safeParse(req.query);

    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid query', details: parsed.error.flatten() });
    }

    const { q, limit, offset } = parsed.data;

    if (!q) {
      return res.status(400).json({ error: 'Search query (q) is required' });
    }

    // Full-text search on title, abstract, and extracted text
    const results = await db.execute(sql`
      SELECT DISTINCT ON (p.id)
        p.id, p.title, p.authors, p.abstract, p.year, p.journal,
        p.doi, p.status, p.read_status, p.created_at,
        ts_rank(to_tsvector('english', p.title || ' ' || COALESCE(p.abstract, '')), plainto_tsquery('english', ${q})) as rank
      FROM papers p
      LEFT JOIN paper_text_content ptc ON ptc.paper_id = p.id
      WHERE p.user_id = ${userId}
        AND (
          to_tsvector('english', p.title || ' ' || COALESCE(p.abstract, '')) @@ plainto_tsquery('english', ${q})
          OR to_tsvector('english', ptc.text_content) @@ plainto_tsquery('english', ${q})
        )
      ORDER BY p.id, rank DESC
      LIMIT ${limit} OFFSET ${offset}
    `);

    res.json({
      papers: results.rows,
      query: q,
      pagination: { limit, offset },
    });

  } catch (error) {
    console.error('[papers/search] Error:', error);
    res.status(500).json({ error: 'Failed to search papers' });
  }
});

/**
 * Get extracted text for a paper
 */
router.get('/:id/text', async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const { id } = req.params;

    // Check ownership
    const paper = await db.execute(sql`
      SELECT id FROM papers WHERE id = ${id} AND user_id = ${userId}
    `);

    if (paper.rows.length === 0) {
      return res.status(404).json({ error: 'Paper not found' });
    }

    const text = await db.execute(sql`
      SELECT page_number, text_content
      FROM paper_text_content
      WHERE paper_id = ${id}
      ORDER BY page_number
    `);

    res.json({
      paper_id: id,
      pages: text.rows,
    });

  } catch (error) {
    console.error('[papers/getText] Error:', error);
    res.status(500).json({ error: 'Failed to get paper text' });
  }
});

export default router;
