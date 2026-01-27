/**
 * Citation Manager API Routes (Track B Phase 14)
 *
 * CRUD for citations with CSL support
 *
 * API namespace: /api/citations
 *
 * Endpoints:
 * - GET    /ping                    # Health check
 * - POST   /                        # Create citation
 * - GET    /                        # List citations
 * - GET    /:id                     # Get citation
 * - PATCH  /:id                     # Update citation
 * - DELETE /:id                     # Delete citation
 * - POST   /import/bibtex           # Import from BibTeX
 * - POST   /import/doi              # Import from DOI
 * - POST   /import/pmid             # Import from PubMed
 * - GET    /:id/format              # Format citation
 * - POST   /format-batch            # Format multiple citations
 * - GET    /styles                  # List citation styles
 * - GET    /styles/:id              # Get style details
 *
 * @module routes/citations
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { db } from '../../db';
import { sql } from 'drizzle-orm';
import { nanoid } from 'nanoid';

const router = Router();

// =============================================================================
// Validation Schemas
// =============================================================================

const authorSchema = z.object({
  family: z.string().optional(),
  given: z.string().optional(),
  literal: z.string().optional(),
  suffix: z.string().optional(),
  'non-dropping-particle': z.string().optional(),
  'dropping-particle': z.string().optional(),
});

const dateSchema = z.object({
  'date-parts': z.array(z.array(z.number())).optional(),
  literal: z.string().optional(),
  raw: z.string().optional(),
});

const createCitationSchema = z.object({
  csl_type: z.string().default('article-journal'),
  title: z.string().min(1).max(2000),
  authors: z.array(authorSchema).default([]),
  issued: dateSchema.optional(),
  container_title: z.string().max(500).optional(),
  volume: z.string().max(50).optional(),
  issue: z.string().max(50).optional(),
  page: z.string().max(100).optional(),
  publisher: z.string().max(300).optional(),
  publisher_place: z.string().max(300).optional(),
  doi: z.string().max(255).optional(),
  pmid: z.string().max(50).optional(),
  pmcid: z.string().max(50).optional(),
  isbn: z.string().max(50).optional(),
  issn: z.string().max(50).optional(),
  arxiv_id: z.string().max(100).optional(),
  url: z.string().url().optional(),
  abstract: z.string().optional(),
  note: z.string().optional(),
  paper_id: z.string().uuid().optional(),
  csl_json: z.record(z.any()).optional(),
});

const updateCitationSchema = createCitationSchema.partial();

const listCitationsSchema = z.object({
  q: z.string().optional(),
  type: z.string().optional(),
  group_id: z.string().uuid().optional(),
  favorite: z.coerce.boolean().optional(),
  sort: z.enum(['created_at', 'title', 'issued']).default('created_at'),
  order: z.enum(['asc', 'desc']).default('desc'),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

const importBibtexSchema = z.object({
  bibtex: z.string().min(1),
  group_id: z.string().uuid().optional(),
});

const importDoiSchema = z.object({
  doi: z.string().min(1),
  group_id: z.string().uuid().optional(),
});

const importPmidSchema = z.object({
  pmid: z.string().min(1),
  group_id: z.string().uuid().optional(),
});

const formatBatchSchema = z.object({
  citation_ids: z.array(z.string().uuid()).min(1).max(100),
  style_id: z.string().uuid().optional(),
  style_name: z.string().optional(),
});

// =============================================================================
// Helper Functions
// =============================================================================

function getUserId(req: Request): string {
  return (req as any).user?.id || 'demo-user';
}

/**
 * Build CSL-JSON object from citation record
 */
function buildCslJson(citation: any): any {
  const csl: any = {
    id: citation.id,
    type: citation.csl_type,
    title: citation.title,
  };

  if (citation.authors && citation.authors.length > 0) {
    csl.author = citation.authors;
  }
  if (citation.issued) {
    csl.issued = citation.issued;
  }
  if (citation.container_title) {
    csl['container-title'] = citation.container_title;
  }
  if (citation.volume) csl.volume = citation.volume;
  if (citation.issue) csl.issue = citation.issue;
  if (citation.page) csl.page = citation.page;
  if (citation.publisher) csl.publisher = citation.publisher;
  if (citation.publisher_place) csl['publisher-place'] = citation.publisher_place;
  if (citation.doi) csl.DOI = citation.doi;
  if (citation.pmid) csl.PMID = citation.pmid;
  if (citation.url) csl.URL = citation.url;
  if (citation.abstract) csl.abstract = citation.abstract;
  if (citation.note) csl.note = citation.note;

  // Merge any additional fields from csl_json
  if (citation.csl_json && typeof citation.csl_json === 'object') {
    Object.assign(csl, citation.csl_json);
  }

  return csl;
}

/**
 * Extract year from issued date
 */
function getYear(issued: any): number | null {
  if (!issued) return null;
  if (issued['date-parts'] && issued['date-parts'][0] && issued['date-parts'][0][0]) {
    return issued['date-parts'][0][0];
  }
  if (issued.literal) {
    const match = issued.literal.match(/\d{4}/);
    return match ? parseInt(match[0]) : null;
  }
  return null;
}

/**
 * Generate citation key (e.g., "Smith2024")
 */
function generateCitationKey(authors: any[], issued: any): string {
  const year = getYear(issued) || 'nd';
  if (authors && authors.length > 0) {
    const firstAuthor = authors[0];
    const name = firstAuthor.family || firstAuthor.literal?.split(' ').pop() || 'Unknown';
    return `${name}${year}`;
  }
  return `Citation${year}`;
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
    service: 'citations',
  });
});

/**
 * Create citation
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const parsed = createCitationSchema.safeParse(req.body);

    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() });
    }

    const data = parsed.data;

    // Build complete CSL-JSON
    const cslJson = {
      ...(data.csl_json || {}),
      type: data.csl_type,
      title: data.title,
    };

    const result = await db.execute(sql`
      INSERT INTO citations (
        user_id, csl_type, title, authors, issued,
        container_title, volume, issue, page, publisher, publisher_place,
        doi, pmid, pmcid, isbn, issn, arxiv_id, url,
        abstract, note, paper_id, csl_json, source
      ) VALUES (
        ${userId}, ${data.csl_type}, ${data.title},
        ${JSON.stringify(data.authors)}::jsonb,
        ${data.issued ? JSON.stringify(data.issued) : null}::jsonb,
        ${data.container_title || null}, ${data.volume || null}, ${data.issue || null},
        ${data.page || null}, ${data.publisher || null}, ${data.publisher_place || null},
        ${data.doi || null}, ${data.pmid || null}, ${data.pmcid || null},
        ${data.isbn || null}, ${data.issn || null}, ${data.arxiv_id || null}, ${data.url || null},
        ${data.abstract || null}, ${data.note || null}, ${data.paper_id || null},
        ${JSON.stringify(cslJson)}::jsonb, 'manual'
      )
      RETURNING id, created_at
    `);

    const citation = result.rows[0];
    const citationKey = generateCitationKey(data.authors, data.issued);

    res.status(201).json({
      id: citation.id,
      citation_key: citationKey,
      title: data.title,
      created_at: citation.created_at,
    });

  } catch (error) {
    console.error('[citations/create] Error:', error);
    res.status(500).json({ error: 'Failed to create citation' });
  }
});

/**
 * List citations
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const parsed = listCitationsSchema.safeParse(req.query);

    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid query', details: parsed.error.flatten() });
    }

    const { q, type, group_id, favorite, sort, order, limit, offset } = parsed.data;

    // Build query
    let conditions = sql`user_id = ${userId} AND is_archived = FALSE`;

    if (q) {
      conditions = sql`${conditions} AND to_tsvector('english', COALESCE(title, '') || ' ' || COALESCE(abstract, '')) @@ plainto_tsquery('english', ${q})`;
    }
    if (type) {
      conditions = sql`${conditions} AND csl_type = ${type}`;
    }
    if (favorite !== undefined) {
      conditions = sql`${conditions} AND is_favorite = ${favorite}`;
    }

    // If filtering by group, join with group members
    let citations;
    let countResult;

    if (group_id) {
      citations = await db.execute(sql`
        SELECT c.*, cgm.citation_key, cgm.sort_order as group_sort_order
        FROM citations c
        INNER JOIN citation_group_members cgm ON cgm.citation_id = c.id
        WHERE cgm.group_id = ${group_id} AND ${conditions}
        ORDER BY cgm.sort_order ASC, c.${sql.raw(sort)} ${sql.raw(order.toUpperCase())}
        LIMIT ${limit} OFFSET ${offset}
      `);

      countResult = await db.execute(sql`
        SELECT COUNT(*) as total
        FROM citations c
        INNER JOIN citation_group_members cgm ON cgm.citation_id = c.id
        WHERE cgm.group_id = ${group_id} AND ${conditions}
      `);
    } else {
      citations = await db.execute(sql`
        SELECT * FROM citations
        WHERE ${conditions}
        ORDER BY ${sql.raw(sort)} ${sql.raw(order.toUpperCase())}
        LIMIT ${limit} OFFSET ${offset}
      `);

      countResult = await db.execute(sql`
        SELECT COUNT(*) as total FROM citations WHERE ${conditions}
      `);
    }

    const total = parseInt(countResult.rows[0]?.total || '0');

    // Add citation keys to results
    const citationsWithKeys = citations.rows.map((c: any) => ({
      ...c,
      citation_key: c.citation_key || generateCitationKey(c.authors, c.issued),
      year: getYear(c.issued),
    }));

    res.json({
      citations: citationsWithKeys,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + citations.rows.length < total,
      },
    });

  } catch (error) {
    console.error('[citations/list] Error:', error);
    res.status(500).json({ error: 'Failed to list citations' });
  }
});

/**
 * Get citation by ID
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const { id } = req.params;

    const result = await db.execute(sql`
      SELECT * FROM citations
      WHERE id = ${id} AND user_id = ${userId}
      LIMIT 1
    `);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Citation not found' });
    }

    const citation = result.rows[0];

    // Get groups this citation belongs to
    const groups = await db.execute(sql`
      SELECT cg.id, cg.name, cgm.citation_key
      FROM citation_groups cg
      INNER JOIN citation_group_members cgm ON cgm.group_id = cg.id
      WHERE cgm.citation_id = ${id}
    `);

    res.json({
      ...citation,
      citation_key: generateCitationKey(citation.authors, citation.issued),
      year: getYear(citation.issued),
      csl: buildCslJson(citation),
      groups: groups.rows,
    });

  } catch (error) {
    console.error('[citations/get] Error:', error);
    res.status(500).json({ error: 'Failed to get citation' });
  }
});

/**
 * Update citation
 */
router.patch('/:id', async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const { id } = req.params;
    const parsed = updateCitationSchema.safeParse(req.body);

    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() });
    }

    // Check ownership
    const existing = await db.execute(sql`
      SELECT id FROM citations WHERE id = ${id} AND user_id = ${userId}
    `);

    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Citation not found' });
    }

    const data = parsed.data;
    const updates: string[] = [];
    const values: any[] = [];

    // Build update dynamically
    Object.entries(data).forEach(([key, value]) => {
      if (value !== undefined) {
        if (key === 'authors' || key === 'issued' || key === 'csl_json') {
          updates.push(`${key} = '${JSON.stringify(value)}'::jsonb`);
        } else {
          updates.push(`${key} = $${values.length + 1}`);
          values.push(value);
        }
      }
    });

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No updates provided' });
    }

    await db.execute(sql`
      UPDATE citations SET ${sql.raw(updates.join(', '))}, updated_at = NOW()
      WHERE id = ${id}
    `);

    res.json({ success: true, id });

  } catch (error) {
    console.error('[citations/update] Error:', error);
    res.status(500).json({ error: 'Failed to update citation' });
  }
});

/**
 * Delete citation
 */
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const { id } = req.params;

    const result = await db.execute(sql`
      DELETE FROM citations WHERE id = ${id} AND user_id = ${userId}
      RETURNING id
    `);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Citation not found' });
    }

    res.json({ success: true, id });

  } catch (error) {
    console.error('[citations/delete] Error:', error);
    res.status(500).json({ error: 'Failed to delete citation' });
  }
});

/**
 * Import from BibTeX
 */
router.post('/import/bibtex', async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const parsed = importBibtexSchema.safeParse(req.body);

    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() });
    }

    const { bibtex, group_id } = parsed.data;

    // TODO: Parse BibTeX using a library like bibtex-parse-js
    // For now, return a placeholder response

    res.status(202).json({
      status: 'processing',
      message: 'BibTeX import started. This feature is coming soon.',
      entries_found: 0,
    });

  } catch (error) {
    console.error('[citations/import/bibtex] Error:', error);
    res.status(500).json({ error: 'Failed to import BibTeX' });
  }
});

/**
 * Import from DOI
 */
router.post('/import/doi', async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const parsed = importDoiSchema.safeParse(req.body);

    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() });
    }

    const { doi, group_id } = parsed.data;

    // Fetch from CrossRef API
    try {
      const response = await fetch(`https://api.crossref.org/works/${encodeURIComponent(doi)}`, {
        headers: {
          'User-Agent': 'ResearchFlow/1.0 (mailto:support@researchflow.io)',
        },
      });

      if (!response.ok) {
        return res.status(404).json({ error: 'DOI not found in CrossRef' });
      }

      const data = await response.json();
      const work = data.message;

      // Map CrossRef to CSL-JSON
      const authors = (work.author || []).map((a: any) => ({
        family: a.family,
        given: a.given,
      }));

      const issued = work.issued?.['date-parts']?.[0]
        ? { 'date-parts': [work.issued['date-parts'][0]] }
        : null;

      // Create citation
      const result = await db.execute(sql`
        INSERT INTO citations (
          user_id, csl_type, title, authors, issued,
          container_title, volume, issue, page, publisher,
          doi, url, abstract, csl_json, source, source_id
        ) VALUES (
          ${userId},
          ${work.type || 'article-journal'},
          ${work.title?.[0] || 'Unknown Title'},
          ${JSON.stringify(authors)}::jsonb,
          ${issued ? JSON.stringify(issued) : null}::jsonb,
          ${work['container-title']?.[0] || null},
          ${work.volume || null},
          ${work.issue || null},
          ${work.page || null},
          ${work.publisher || null},
          ${doi},
          ${work.URL || null},
          ${work.abstract || null},
          ${JSON.stringify(work)}::jsonb,
          'crossref',
          ${doi}
        )
        RETURNING id, title, created_at
      `);

      const citation = result.rows[0];

      // Add to group if specified
      if (group_id) {
        const citationKey = generateCitationKey(authors, issued);
        await db.execute(sql`
          INSERT INTO citation_group_members (group_id, citation_id, citation_key)
          VALUES (${group_id}, ${citation.id}, ${citationKey})
          ON CONFLICT DO NOTHING
        `);
      }

      res.status(201).json({
        id: citation.id,
        title: citation.title,
        citation_key: generateCitationKey(authors, issued),
        source: 'crossref',
        created_at: citation.created_at,
      });

    } catch (fetchError) {
      console.error('[citations/import/doi] Fetch error:', fetchError);
      return res.status(502).json({ error: 'Failed to fetch DOI from CrossRef' });
    }

  } catch (error) {
    console.error('[citations/import/doi] Error:', error);
    res.status(500).json({ error: 'Failed to import from DOI' });
  }
});

/**
 * Import from PubMed ID
 */
router.post('/import/pmid', async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const parsed = importPmidSchema.safeParse(req.body);

    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() });
    }

    const { pmid, group_id } = parsed.data;

    // Fetch from NCBI E-utilities
    try {
      const response = await fetch(
        `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=pubmed&id=${pmid}&retmode=json`
      );

      if (!response.ok) {
        return res.status(404).json({ error: 'PMID not found' });
      }

      const data = await response.json();
      const article = data.result?.[pmid];

      if (!article || article.error) {
        return res.status(404).json({ error: 'PMID not found in PubMed' });
      }

      // Map PubMed to CSL-JSON
      const authors = (article.authors || []).map((a: any) => ({
        literal: a.name,
      }));

      // Parse date (format: "YYYY Mon DD" or "YYYY")
      let issued = null;
      if (article.pubdate) {
        const dateMatch = article.pubdate.match(/^(\d{4})/);
        if (dateMatch) {
          issued = { 'date-parts': [[parseInt(dateMatch[1])]] };
        }
      }

      // Create citation
      const result = await db.execute(sql`
        INSERT INTO citations (
          user_id, csl_type, title, authors, issued,
          container_title, volume, issue, page,
          pmid, doi, abstract, csl_json, source, source_id
        ) VALUES (
          ${userId},
          'article-journal',
          ${article.title || 'Unknown Title'},
          ${JSON.stringify(authors)}::jsonb,
          ${issued ? JSON.stringify(issued) : null}::jsonb,
          ${article.fulljournalname || article.source || null},
          ${article.volume || null},
          ${article.issue || null},
          ${article.pages || null},
          ${pmid},
          ${article.elocationid?.replace('doi: ', '') || null},
          ${null},
          ${JSON.stringify(article)}::jsonb,
          'pubmed',
          ${pmid}
        )
        RETURNING id, title, created_at
      `);

      const citation = result.rows[0];

      // Add to group if specified
      if (group_id) {
        const citationKey = generateCitationKey(authors, issued);
        await db.execute(sql`
          INSERT INTO citation_group_members (group_id, citation_id, citation_key)
          VALUES (${group_id}, ${citation.id}, ${citationKey})
          ON CONFLICT DO NOTHING
        `);
      }

      res.status(201).json({
        id: citation.id,
        title: citation.title,
        citation_key: generateCitationKey(authors, issued),
        source: 'pubmed',
        created_at: citation.created_at,
      });

    } catch (fetchError) {
      console.error('[citations/import/pmid] Fetch error:', fetchError);
      return res.status(502).json({ error: 'Failed to fetch from PubMed' });
    }

  } catch (error) {
    console.error('[citations/import/pmid] Error:', error);
    res.status(500).json({ error: 'Failed to import from PubMed' });
  }
});

/**
 * Format citation
 */
router.get('/:id/format', async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const { id } = req.params;
    const styleId = req.query.style_id as string;
    const styleName = req.query.style as string;

    // Get citation
    const result = await db.execute(sql`
      SELECT * FROM citations
      WHERE id = ${id} AND user_id = ${userId}
      LIMIT 1
    `);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Citation not found' });
    }

    const citation = result.rows[0];
    const csl = buildCslJson(citation);

    // TODO: Use citeproc-js or a citation formatting service
    // For now, return a simple formatted string

    const authors = citation.authors || [];
    const year = getYear(citation.issued) || 'n.d.';
    const authorStr = authors.length > 0
      ? authors.map((a: any) => a.family || a.literal || '').join(', ')
      : 'Unknown';

    // Simple APA-like format
    const bibliography = `${authorStr} (${year}). ${citation.title}. ${citation.container_title || ''}${citation.volume ? `, ${citation.volume}` : ''}${citation.issue ? `(${citation.issue})` : ''}${citation.page ? `, ${citation.page}` : ''}.${citation.doi ? ` https://doi.org/${citation.doi}` : ''}`;

    res.json({
      citation_id: id,
      style: styleName || 'apa',
      bibliography: bibliography.trim(),
      in_text: `(${authorStr.split(',')[0]}, ${year})`,
      csl: csl,
    });

  } catch (error) {
    console.error('[citations/format] Error:', error);
    res.status(500).json({ error: 'Failed to format citation' });
  }
});

/**
 * Format batch of citations
 */
router.post('/format-batch', async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const parsed = formatBatchSchema.safeParse(req.body);

    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() });
    }

    const { citation_ids, style_id, style_name } = parsed.data;

    // Get citations
    const citations = await db.execute(sql`
      SELECT * FROM citations
      WHERE id = ANY(${citation_ids}::uuid[]) AND user_id = ${userId}
    `);

    if (citations.rows.length === 0) {
      return res.status(404).json({ error: 'No citations found' });
    }

    // Format each citation (simple formatting for now)
    const formatted = citations.rows.map((citation: any) => {
      const authors = citation.authors || [];
      const year = getYear(citation.issued) || 'n.d.';
      const authorStr = authors.length > 0
        ? authors.map((a: any) => a.family || a.literal || '').join(', ')
        : 'Unknown';

      const bibliography = `${authorStr} (${year}). ${citation.title}. ${citation.container_title || ''}${citation.volume ? `, ${citation.volume}` : ''}${citation.issue ? `(${citation.issue})` : ''}${citation.page ? `, ${citation.page}` : ''}.${citation.doi ? ` https://doi.org/${citation.doi}` : ''}`;

      return {
        id: citation.id,
        bibliography: bibliography.trim(),
        in_text: `(${authorStr.split(',')[0]}, ${year})`,
      };
    });

    res.json({
      style: style_name || 'apa',
      citations: formatted,
      count: formatted.length,
    });

  } catch (error) {
    console.error('[citations/format-batch] Error:', error);
    res.status(500).json({ error: 'Failed to format citations' });
  }
});

/**
 * List citation styles
 */
router.get('/styles', async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);

    const styles = await db.execute(sql`
      SELECT id, name, short_name, description, category, csl_id, is_system, is_default
      FROM citation_styles
      WHERE is_system = TRUE OR user_id = ${userId}
      ORDER BY is_default DESC, name ASC
    `);

    res.json({
      styles: styles.rows,
      count: styles.rows.length,
    });

  } catch (error) {
    console.error('[citations/styles] Error:', error);
    res.status(500).json({ error: 'Failed to list styles' });
  }
});

/**
 * Get citation style by ID
 */
router.get('/styles/:id', async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const { id } = req.params;

    const result = await db.execute(sql`
      SELECT * FROM citation_styles
      WHERE id = ${id} AND (is_system = TRUE OR user_id = ${userId})
      LIMIT 1
    `);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Style not found' });
    }

    res.json(result.rows[0]);

  } catch (error) {
    console.error('[citations/styles/get] Error:', error);
    res.status(500).json({ error: 'Failed to get style' });
  }
});

export default router;
