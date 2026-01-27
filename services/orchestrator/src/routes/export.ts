/**
 * Manuscript Export API Routes (Track B Phase 15)
 *
 * Export manuscripts to various formats using Pandoc
 *
 * API namespace: /api/export
 *
 * Endpoints:
 * - GET    /ping                        # Health check
 * - GET    /templates                   # List export templates
 * - GET    /templates/:id               # Get template details
 * - POST   /templates                   # Create custom template
 * - PATCH  /templates/:id               # Update template
 * - DELETE /templates/:id               # Delete template
 * - POST   /manuscripts/:id             # Export manuscript
 * - GET    /jobs                        # List export jobs
 * - GET    /jobs/:id                    # Get job status
 * - GET    /jobs/:id/download           # Download exported file
 * - DELETE /jobs/:id                    # Cancel/delete job
 * - GET    /presets                     # List user presets
 * - POST   /presets                     # Save preset
 * - GET    /journals                    # Search journals
 * - GET    /journals/:id                # Get journal requirements
 *
 * @module routes/export
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { db } from '../../db';
import { sql } from 'drizzle-orm';
import path from 'path';
import fs from 'fs/promises';

const router = Router();

// =============================================================================
// Configuration
// =============================================================================

const EXPORT_DIR = process.env.EXPORT_DIR || '/app/exports';
const EXPORT_URL_BASE = process.env.EXPORT_URL_BASE || '/api/export/jobs';
const EXPORT_EXPIRY_HOURS = 24;

// Ensure export directory exists
fs.mkdir(EXPORT_DIR, { recursive: true }).catch(console.error);

// =============================================================================
// Validation Schemas
// =============================================================================

const createTemplateSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().optional(),
  output_format: z.enum(['docx', 'pdf', 'latex', 'html', 'md', 'odt']),
  template_type: z.enum(['builtin', 'custom', 'journal']).default('custom'),
  template_content: z.string().optional(),
  citation_style_id: z.string().uuid().optional(),
  csl_name: z.string().optional(),
  journal_name: z.string().optional(),
  page_size: z.enum(['letter', 'a4', 'custom']).default('letter'),
  margins: z.object({
    top: z.number(),
    bottom: z.number(),
    left: z.number(),
    right: z.number(),
  }).optional(),
  font_family: z.string().default('Times New Roman'),
  font_size: z.number().int().min(8).max(24).default(12),
  line_spacing: z.number().min(1).max(3).default(2),
  include_abstract: z.boolean().default(true),
  include_keywords: z.boolean().default(true),
  include_references: z.boolean().default(true),
  number_sections: z.boolean().default(true),
});

const updateTemplateSchema = createTemplateSchema.partial();

const exportManuscriptSchema = z.object({
  template_id: z.string().uuid().optional(),
  output_format: z.enum(['docx', 'pdf', 'latex', 'html', 'md', 'odt']).default('docx'),
  citation_style: z.string().optional(),
  include_track_changes: z.boolean().default(false),
  include_comments: z.boolean().default(false),
  include_supplementary: z.boolean().default(false),
  custom_options: z.record(z.any()).optional(),
});

const createPresetSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().optional(),
  template_id: z.string().uuid().optional(),
  output_format: z.enum(['docx', 'pdf', 'latex', 'html', 'md', 'odt']),
  options_override: z.record(z.any()).optional(),
  is_default: z.boolean().default(false),
});

const searchJournalsSchema = z.object({
  q: z.string().optional(),
  category: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

// =============================================================================
// Helper Functions
// =============================================================================

function getUserId(req: Request): string {
  return (req as any).user?.id || 'demo-user';
}

/**
 * Generate unique filename for export
 */
function generateExportFilename(manuscriptTitle: string, format: string): string {
  const safeName = manuscriptTitle
    .replace(/[^a-zA-Z0-9\s-]/g, '')
    .replace(/\s+/g, '_')
    .slice(0, 50);
  const timestamp = Date.now();
  return `${safeName}_${timestamp}.${format}`;
}

/**
 * Simulate Pandoc export (placeholder for actual implementation)
 */
async function runPandocExport(
  manuscriptId: string,
  content: string,
  format: string,
  options: any
): Promise<{ path: string; size: number }> {
  // In production, this would:
  // 1. Call Pandoc with appropriate options
  // 2. Apply template and citation style
  // 3. Generate output file

  // For now, create a placeholder file
  const filename = `export_${manuscriptId}_${Date.now()}.${format}`;
  const outputPath = path.join(EXPORT_DIR, filename);

  // Write placeholder content
  const placeholder = `Exported manuscript content (${format} format)\n\n${content.slice(0, 1000)}...`;
  await fs.writeFile(outputPath, placeholder);

  const stats = await fs.stat(outputPath);
  return { path: outputPath, size: stats.size };
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
    service: 'export',
    pandoc_available: true, // TODO: Check actual Pandoc availability
  });
});

/**
 * List export templates
 */
router.get('/templates', async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const format = req.query.format as string;
    const category = req.query.category as string;

    let conditions = sql`(is_system = TRUE OR user_id = ${userId})`;

    if (format) {
      conditions = sql`${conditions} AND output_format = ${format}`;
    }
    if (category) {
      conditions = sql`${conditions} AND category = ${category}`;
    }

    const templates = await db.execute(sql`
      SELECT id, name, description, output_format, template_type,
             page_size, font_family, font_size, line_spacing,
             journal_name, is_system, is_default, category,
             created_at, updated_at
      FROM export_templates
      WHERE ${conditions}
      ORDER BY is_default DESC, is_system DESC, name ASC
    `);

    res.json({
      templates: templates.rows,
      count: templates.rows.length,
    });

  } catch (error) {
    console.error('[export/templates] Error:', error);
    res.status(500).json({ error: 'Failed to list templates' });
  }
});

/**
 * Get template by ID
 */
router.get('/templates/:id', async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const { id } = req.params;

    const result = await db.execute(sql`
      SELECT * FROM export_templates
      WHERE id = ${id} AND (is_system = TRUE OR user_id = ${userId})
      LIMIT 1
    `);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Template not found' });
    }

    res.json(result.rows[0]);

  } catch (error) {
    console.error('[export/templates/get] Error:', error);
    res.status(500).json({ error: 'Failed to get template' });
  }
});

/**
 * Create custom template
 */
router.post('/templates', async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const parsed = createTemplateSchema.safeParse(req.body);

    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() });
    }

    const data = parsed.data;

    const result = await db.execute(sql`
      INSERT INTO export_templates (
        user_id, name, description, output_format, template_type, template_content,
        citation_style_id, csl_name, journal_name,
        page_size, margins, font_family, font_size, line_spacing,
        include_abstract, include_keywords, include_references, number_sections
      ) VALUES (
        ${userId}, ${data.name}, ${data.description || null}, ${data.output_format},
        ${data.template_type}, ${data.template_content || null},
        ${data.citation_style_id || null}, ${data.csl_name || null}, ${data.journal_name || null},
        ${data.page_size}, ${data.margins ? JSON.stringify(data.margins) : null}::jsonb,
        ${data.font_family}, ${data.font_size}, ${data.line_spacing},
        ${data.include_abstract}, ${data.include_keywords}, ${data.include_references},
        ${data.number_sections}
      )
      RETURNING id, name, output_format, created_at
    `);

    res.status(201).json(result.rows[0]);

  } catch (error) {
    console.error('[export/templates/create] Error:', error);
    res.status(500).json({ error: 'Failed to create template' });
  }
});

/**
 * Update template
 */
router.patch('/templates/:id', async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const { id } = req.params;
    const parsed = updateTemplateSchema.safeParse(req.body);

    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() });
    }

    // Check ownership (can't update system templates)
    const existing = await db.execute(sql`
      SELECT id, is_system FROM export_templates
      WHERE id = ${id} AND user_id = ${userId}
    `);

    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Template not found or cannot be modified' });
    }

    // Build update query dynamically
    const data = parsed.data;
    const updates: string[] = [];

    Object.entries(data).forEach(([key, value]) => {
      if (value !== undefined) {
        if (key === 'margins') {
          updates.push(`${key} = '${JSON.stringify(value)}'::jsonb`);
        } else if (typeof value === 'string') {
          updates.push(`${key} = '${value}'`);
        } else {
          updates.push(`${key} = ${value}`);
        }
      }
    });

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No updates provided' });
    }

    await db.execute(sql`
      UPDATE export_templates
      SET ${sql.raw(updates.join(', '))}, updated_at = NOW()
      WHERE id = ${id}
    `);

    res.json({ success: true, id });

  } catch (error) {
    console.error('[export/templates/update] Error:', error);
    res.status(500).json({ error: 'Failed to update template' });
  }
});

/**
 * Delete template
 */
router.delete('/templates/:id', async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const { id } = req.params;

    const result = await db.execute(sql`
      DELETE FROM export_templates
      WHERE id = ${id} AND user_id = ${userId} AND is_system = FALSE
      RETURNING id
    `);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Template not found or cannot be deleted' });
    }

    res.json({ success: true, id });

  } catch (error) {
    console.error('[export/templates/delete] Error:', error);
    res.status(500).json({ error: 'Failed to delete template' });
  }
});

/**
 * Export manuscript
 */
router.post('/manuscripts/:manuscriptId', async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const { manuscriptId } = req.params;
    const parsed = exportManuscriptSchema.safeParse(req.body);

    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() });
    }

    // Verify manuscript access
    const manuscript = await db.execute(sql`
      SELECT id, title, content, user_id FROM manuscripts
      WHERE id = ${manuscriptId} AND user_id = ${userId}
      LIMIT 1
    `);

    if (manuscript.rows.length === 0) {
      return res.status(404).json({ error: 'Manuscript not found' });
    }

    const ms = manuscript.rows[0];
    const options = parsed.data;

    // Create export job
    const jobResult = await db.execute(sql`
      INSERT INTO export_jobs (
        user_id, manuscript_id, template_id, output_format,
        export_options, status, started_at
      ) VALUES (
        ${userId}, ${manuscriptId}, ${options.template_id || null},
        ${options.output_format}, ${JSON.stringify(options)}::jsonb,
        'processing', NOW()
      )
      RETURNING id
    `);

    const jobId = jobResult.rows[0].id;

    // Start async export (don't await)
    (async () => {
      try {
        const filename = generateExportFilename(ms.title || 'manuscript', options.output_format);
        const { path: outputPath, size } = await runPandocExport(
          manuscriptId,
          ms.content || '',
          options.output_format,
          options
        );

        // Update job with success
        await db.execute(sql`
          UPDATE export_jobs SET
            status = 'completed',
            output_filename = ${filename},
            output_path = ${outputPath},
            output_size_bytes = ${size},
            output_url = ${`${EXPORT_URL_BASE}/${jobId}/download`},
            output_expires_at = NOW() + INTERVAL '${sql.raw(String(EXPORT_EXPIRY_HOURS))} hours',
            completed_at = NOW(),
            processing_time_ms = EXTRACT(MILLISECONDS FROM (NOW() - started_at))::INTEGER,
            progress = 100
          WHERE id = ${jobId}
        `);

        console.log(`[export] Job ${jobId} completed: ${filename}`);

      } catch (err: any) {
        // Update job with failure
        await db.execute(sql`
          UPDATE export_jobs SET
            status = 'failed',
            error_code = 'EXPORT_FAILED',
            error_message = ${err.message || 'Unknown error'},
            completed_at = NOW()
          WHERE id = ${jobId}
        `);

        console.error(`[export] Job ${jobId} failed:`, err);
      }
    })();

    res.status(202).json({
      job_id: jobId,
      status: 'processing',
      message: 'Export started. Poll /jobs/:id for status.',
      poll_url: `${EXPORT_URL_BASE}/${jobId}`,
    });

  } catch (error) {
    console.error('[export/manuscripts] Error:', error);
    res.status(500).json({ error: 'Failed to start export' });
  }
});

/**
 * List export jobs
 */
router.get('/jobs', async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const offset = parseInt(req.query.offset as string) || 0;

    const jobs = await db.execute(sql`
      SELECT ej.*, m.title as manuscript_title
      FROM export_jobs ej
      LEFT JOIN manuscripts m ON m.id = ej.manuscript_id
      WHERE ej.user_id = ${userId}
      ORDER BY ej.created_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `);

    const countResult = await db.execute(sql`
      SELECT COUNT(*) as total FROM export_jobs WHERE user_id = ${userId}
    `);

    res.json({
      jobs: jobs.rows,
      pagination: {
        total: parseInt(countResult.rows[0]?.total || '0'),
        limit,
        offset,
      },
    });

  } catch (error) {
    console.error('[export/jobs] Error:', error);
    res.status(500).json({ error: 'Failed to list jobs' });
  }
});

/**
 * Get job status
 */
router.get('/jobs/:id', async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const { id } = req.params;

    const result = await db.execute(sql`
      SELECT ej.*, m.title as manuscript_title
      FROM export_jobs ej
      LEFT JOIN manuscripts m ON m.id = ej.manuscript_id
      WHERE ej.id = ${id} AND ej.user_id = ${userId}
      LIMIT 1
    `);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Job not found' });
    }

    res.json(result.rows[0]);

  } catch (error) {
    console.error('[export/jobs/get] Error:', error);
    res.status(500).json({ error: 'Failed to get job status' });
  }
});

/**
 * Download exported file
 */
router.get('/jobs/:id/download', async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const { id } = req.params;

    const result = await db.execute(sql`
      SELECT output_path, output_filename, output_expires_at, status
      FROM export_jobs
      WHERE id = ${id} AND user_id = ${userId}
      LIMIT 1
    `);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Job not found' });
    }

    const job = result.rows[0];

    if (job.status !== 'completed') {
      return res.status(400).json({ error: 'Export not completed' });
    }

    if (job.output_expires_at && new Date(job.output_expires_at) < new Date()) {
      return res.status(410).json({ error: 'Download link expired' });
    }

    // Check if file exists
    try {
      await fs.access(job.output_path);
    } catch {
      return res.status(404).json({ error: 'File not found' });
    }

    res.download(job.output_path, job.output_filename);

  } catch (error) {
    console.error('[export/jobs/download] Error:', error);
    res.status(500).json({ error: 'Failed to download file' });
  }
});

/**
 * Delete/cancel job
 */
router.delete('/jobs/:id', async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const { id } = req.params;

    // Get job to delete file
    const job = await db.execute(sql`
      SELECT output_path FROM export_jobs
      WHERE id = ${id} AND user_id = ${userId}
    `);

    if (job.rows.length === 0) {
      return res.status(404).json({ error: 'Job not found' });
    }

    // Delete file if exists
    if (job.rows[0].output_path) {
      await fs.unlink(job.rows[0].output_path).catch(() => {});
    }

    // Delete job record
    await db.execute(sql`DELETE FROM export_jobs WHERE id = ${id}`);

    res.json({ success: true, id });

  } catch (error) {
    console.error('[export/jobs/delete] Error:', error);
    res.status(500).json({ error: 'Failed to delete job' });
  }
});

/**
 * List user presets
 */
router.get('/presets', async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);

    const presets = await db.execute(sql`
      SELECT ep.*, et.name as template_name
      FROM export_presets ep
      LEFT JOIN export_templates et ON et.id = ep.template_id
      WHERE ep.user_id = ${userId}
      ORDER BY ep.is_default DESC, ep.use_count DESC
    `);

    res.json({
      presets: presets.rows,
      count: presets.rows.length,
    });

  } catch (error) {
    console.error('[export/presets] Error:', error);
    res.status(500).json({ error: 'Failed to list presets' });
  }
});

/**
 * Create preset
 */
router.post('/presets', async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const parsed = createPresetSchema.safeParse(req.body);

    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() });
    }

    const data = parsed.data;

    // If setting as default, unset other defaults
    if (data.is_default) {
      await db.execute(sql`
        UPDATE export_presets SET is_default = FALSE WHERE user_id = ${userId}
      `);
    }

    const result = await db.execute(sql`
      INSERT INTO export_presets (
        user_id, name, description, template_id, output_format,
        options_override, is_default
      ) VALUES (
        ${userId}, ${data.name}, ${data.description || null},
        ${data.template_id || null}, ${data.output_format},
        ${data.options_override ? JSON.stringify(data.options_override) : '{}'}::jsonb,
        ${data.is_default}
      )
      RETURNING id, name, output_format, is_default, created_at
    `);

    res.status(201).json(result.rows[0]);

  } catch (error) {
    console.error('[export/presets/create] Error:', error);
    res.status(500).json({ error: 'Failed to create preset' });
  }
});

/**
 * Search journals
 */
router.get('/journals', async (req: Request, res: Response) => {
  try {
    const parsed = searchJournalsSchema.safeParse(req.query);

    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid query', details: parsed.error.flatten() });
    }

    const { q, category, limit, offset } = parsed.data;

    let conditions = sql`1=1`;

    if (q) {
      conditions = sql`${conditions} AND to_tsvector('english', journal_name || ' ' || COALESCE(publisher, '')) @@ plainto_tsquery('english', ${q})`;
    }
    if (category) {
      conditions = sql`${conditions} AND categories @> ${JSON.stringify([category])}::jsonb`;
    }

    const journals = await db.execute(sql`
      SELECT id, journal_name, journal_abbrev, issn, publisher,
             citation_style, impact_factor, categories, subject_areas
      FROM journal_requirements
      WHERE ${conditions}
      ORDER BY impact_factor DESC NULLS LAST, journal_name ASC
      LIMIT ${limit} OFFSET ${offset}
    `);

    res.json({
      journals: journals.rows,
      count: journals.rows.length,
    });

  } catch (error) {
    console.error('[export/journals] Error:', error);
    res.status(500).json({ error: 'Failed to search journals' });
  }
});

/**
 * Get journal requirements
 */
router.get('/journals/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const result = await db.execute(sql`
      SELECT * FROM journal_requirements WHERE id = ${id} LIMIT 1
    `);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Journal not found' });
    }

    res.json(result.rows[0]);

  } catch (error) {
    console.error('[export/journals/get] Error:', error);
    res.status(500).json({ error: 'Failed to get journal' });
  }
});

export default router;
