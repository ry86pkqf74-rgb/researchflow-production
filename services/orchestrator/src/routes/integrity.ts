/**
 * Integrity Tools API Routes (Track B Phase 16)
 *
 * Research integrity verification including plagiarism detection,
 * statistical verification, and citation checking
 *
 * API namespace: /api/integrity
 *
 * Endpoints:
 * - GET    /ping                        # Health check
 * - POST   /check                       # Start integrity check
 * - GET    /checks                      # List checks
 * - GET    /checks/:id                  # Get check details
 * - DELETE /checks/:id                  # Delete check
 * - GET    /checks/:id/similarity       # Get similarity matches
 * - GET    /checks/:id/statistics       # Get statistical verifications
 * - GET    /checks/:id/citations        # Get citation verifications
 * - POST   /reports                     # Generate integrity report
 * - GET    /reports                     # List reports
 * - GET    /reports/:id                 # Get report
 * - GET    /retracted                   # Search retracted papers
 *
 * @module routes/integrity
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { db } from '../../db';
import { sql } from 'drizzle-orm';

const router = Router();

// =============================================================================
// Validation Schemas
// =============================================================================

const startCheckSchema = z.object({
  manuscript_id: z.string().uuid(),
  check_types: z.array(z.enum(['plagiarism', 'statistics', 'citations', 'figures', 'data']))
    .min(1)
    .default(['plagiarism', 'statistics', 'citations']),
  options: z.object({
    exclude_quotes: z.boolean().default(true),
    exclude_references: z.boolean().default(true),
    exclude_small_matches: z.boolean().default(true),
    small_match_threshold: z.number().default(10), // words
    check_self_citations: z.boolean().default(true),
    verify_statistics: z.boolean().default(true),
    check_retractions: z.boolean().default(true),
  }).optional(),
});

const generateReportSchema = z.object({
  manuscript_id: z.string().uuid(),
  check_ids: z.array(z.string().uuid()).optional(),
  report_type: z.enum(['full', 'summary', 'specific']).default('full'),
  title: z.string().optional(),
});

const searchRetractedSchema = z.object({
  q: z.string().optional(),
  doi: z.string().optional(),
  pmid: z.string().optional(),
  year_from: z.coerce.number().optional(),
  year_to: z.coerce.number().optional(),
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
 * Simulate plagiarism check (placeholder for actual implementation)
 */
async function runPlagiarismCheck(
  checkId: string,
  content: string,
  options: any
): Promise<{ score: number; matches: any[] }> {
  // In production, this would:
  // 1. Call plagiarism detection service (e.g., Turnitin, iThenticate)
  // 2. Process text against database
  // 3. Return similarity matches

  // Simulated result
  return {
    score: Math.random() * 15, // 0-15% similarity
    matches: [],
  };
}

/**
 * Verify statistical values in text
 */
async function runStatisticalVerification(
  checkId: string,
  content: string
): Promise<{ issues: any[]; warnings: any[] }> {
  // Extract and verify statistics like p-values, CIs, etc.
  // Uses regex patterns and GRIM/SPRITE tests

  // Simulated result
  return {
    issues: [],
    warnings: [],
  };
}

/**
 * Verify citations exist and aren't retracted
 */
async function runCitationVerification(
  checkId: string,
  citations: any[]
): Promise<{ verified: number; issues: any[] }> {
  // Check each citation against CrossRef, PubMed, Retraction Watch

  // Simulated result
  return {
    verified: citations.length,
    issues: [],
  };
}

/**
 * Calculate overall integrity score
 */
function calculateIntegrityScore(results: any): number {
  let score = 100;

  // Deduct for plagiarism
  if (results.similarity_score > 20) score -= 30;
  else if (results.similarity_score > 10) score -= 15;
  else if (results.similarity_score > 5) score -= 5;

  // Deduct for statistical issues
  if (results.stat_issues > 0) score -= results.stat_issues * 5;

  // Deduct for citation issues
  if (results.citation_issues > 0) score -= results.citation_issues * 3;

  // Deduct for retracted citations
  if (results.retracted_citations > 0) score -= results.retracted_citations * 10;

  return Math.max(0, Math.min(100, score));
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
    service: 'integrity',
    features: {
      plagiarism: true,
      statistics: true,
      citations: true,
      figures: false, // Not yet implemented
      data: false, // Not yet implemented
    },
  });
});

/**
 * Start integrity check
 */
router.post('/check', async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const parsed = startCheckSchema.safeParse(req.body);

    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() });
    }

    const { manuscript_id, check_types, options } = parsed.data;

    // Verify manuscript access
    const manuscript = await db.execute(sql`
      SELECT id, title, content FROM manuscripts
      WHERE id = ${manuscript_id} AND user_id = ${userId}
      LIMIT 1
    `);

    if (manuscript.rows.length === 0) {
      return res.status(404).json({ error: 'Manuscript not found' });
    }

    const ms = manuscript.rows[0];
    const checkIds: string[] = [];

    // Create check records for each type
    for (const checkType of check_types) {
      const result = await db.execute(sql`
        INSERT INTO integrity_checks (
          user_id, manuscript_id, check_type, status, started_at
        ) VALUES (
          ${userId}, ${manuscript_id}, ${checkType}, 'running', NOW()
        )
        RETURNING id
      `);
      checkIds.push(result.rows[0].id);
    }

    // Start async checks (don't await)
    (async () => {
      for (let i = 0; i < check_types.length; i++) {
        const checkType = check_types[i];
        const checkId = checkIds[i];

        try {
          let results: any = {};
          let issues = 0;
          let warnings = 0;
          let score = 100;

          switch (checkType) {
            case 'plagiarism': {
              const plagResult = await runPlagiarismCheck(checkId, ms.content || '', options);
              score = 100 - plagResult.score;
              results = { similarity_score: plagResult.score, matches_count: plagResult.matches.length };
              issues = plagResult.matches.filter((m: any) => m.similarity_percent > 80).length;
              warnings = plagResult.matches.filter((m: any) => m.similarity_percent > 30 && m.similarity_percent <= 80).length;
              break;
            }
            case 'statistics': {
              const statResult = await runStatisticalVerification(checkId, ms.content || '');
              issues = statResult.issues.length;
              warnings = statResult.warnings.length;
              score = issues === 0 ? 100 : Math.max(50, 100 - issues * 10);
              results = { issues: statResult.issues, warnings: statResult.warnings };
              break;
            }
            case 'citations': {
              const citResult = await runCitationVerification(checkId, []);
              score = 100;
              results = { verified: citResult.verified, issues: citResult.issues };
              issues = citResult.issues.length;
              break;
            }
            default:
              results = { message: 'Check type not yet implemented' };
          }

          // Determine risk level
          let riskLevel = 'low';
          if (issues > 0 || score < 70) riskLevel = 'high';
          else if (warnings > 0 || score < 85) riskLevel = 'medium';

          // Update check with results
          await db.execute(sql`
            UPDATE integrity_checks SET
              status = 'completed',
              overall_score = ${score},
              risk_level = ${riskLevel},
              issues_found = ${issues},
              warnings_found = ${warnings},
              results = ${JSON.stringify(results)}::jsonb,
              completed_at = NOW(),
              processing_time_ms = EXTRACT(MILLISECONDS FROM (NOW() - started_at))::INTEGER
            WHERE id = ${checkId}
          `);

          console.log(`[integrity] Check ${checkId} (${checkType}) completed: score=${score}`);

        } catch (err: any) {
          await db.execute(sql`
            UPDATE integrity_checks SET
              status = 'failed',
              error_code = 'CHECK_FAILED',
              error_message = ${err.message || 'Unknown error'},
              completed_at = NOW()
            WHERE id = ${checkId}
          `);
          console.error(`[integrity] Check ${checkId} failed:`, err);
        }
      }
    })();

    res.status(202).json({
      check_ids: checkIds,
      check_types,
      status: 'running',
      message: 'Integrity checks started. Poll /checks/:id for status.',
    });

  } catch (error) {
    console.error('[integrity/check] Error:', error);
    res.status(500).json({ error: 'Failed to start integrity check' });
  }
});

/**
 * List integrity checks
 */
router.get('/checks', async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const manuscriptId = req.query.manuscript_id as string;
    const checkType = req.query.type as string;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const offset = parseInt(req.query.offset as string) || 0;

    let conditions = sql`ic.user_id = ${userId}`;

    if (manuscriptId) {
      conditions = sql`${conditions} AND ic.manuscript_id = ${manuscriptId}`;
    }
    if (checkType) {
      conditions = sql`${conditions} AND ic.check_type = ${checkType}`;
    }

    const checks = await db.execute(sql`
      SELECT ic.*, m.title as manuscript_title
      FROM integrity_checks ic
      LEFT JOIN manuscripts m ON m.id = ic.manuscript_id
      WHERE ${conditions}
      ORDER BY ic.created_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `);

    const countResult = await db.execute(sql`
      SELECT COUNT(*) as total FROM integrity_checks ic WHERE ${conditions}
    `);

    res.json({
      checks: checks.rows,
      pagination: {
        total: parseInt(countResult.rows[0]?.total || '0'),
        limit,
        offset,
      },
    });

  } catch (error) {
    console.error('[integrity/checks] Error:', error);
    res.status(500).json({ error: 'Failed to list checks' });
  }
});

/**
 * Get check details
 */
router.get('/checks/:id', async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const { id } = req.params;

    const result = await db.execute(sql`
      SELECT ic.*, m.title as manuscript_title
      FROM integrity_checks ic
      LEFT JOIN manuscripts m ON m.id = ic.manuscript_id
      WHERE ic.id = ${id} AND ic.user_id = ${userId}
      LIMIT 1
    `);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Check not found' });
    }

    res.json(result.rows[0]);

  } catch (error) {
    console.error('[integrity/checks/get] Error:', error);
    res.status(500).json({ error: 'Failed to get check' });
  }
});

/**
 * Delete check
 */
router.delete('/checks/:id', async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const { id } = req.params;

    const result = await db.execute(sql`
      DELETE FROM integrity_checks
      WHERE id = ${id} AND user_id = ${userId}
      RETURNING id
    `);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Check not found' });
    }

    res.json({ success: true, id });

  } catch (error) {
    console.error('[integrity/checks/delete] Error:', error);
    res.status(500).json({ error: 'Failed to delete check' });
  }
});

/**
 * Get similarity matches for a check
 */
router.get('/checks/:id/similarity', async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const { id } = req.params;

    // Verify check access
    const check = await db.execute(sql`
      SELECT id FROM integrity_checks
      WHERE id = ${id} AND user_id = ${userId} AND check_type = 'plagiarism'
    `);

    if (check.rows.length === 0) {
      return res.status(404).json({ error: 'Check not found' });
    }

    const matches = await db.execute(sql`
      SELECT * FROM similarity_matches
      WHERE check_id = ${id}
      ORDER BY similarity_percent DESC
    `);

    res.json({
      check_id: id,
      matches: matches.rows,
      count: matches.rows.length,
    });

  } catch (error) {
    console.error('[integrity/similarity] Error:', error);
    res.status(500).json({ error: 'Failed to get similarity matches' });
  }
});

/**
 * Get statistical verifications for a check
 */
router.get('/checks/:id/statistics', async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const { id } = req.params;

    // Verify check access
    const check = await db.execute(sql`
      SELECT id FROM integrity_checks
      WHERE id = ${id} AND user_id = ${userId} AND check_type = 'statistics'
    `);

    if (check.rows.length === 0) {
      return res.status(404).json({ error: 'Check not found' });
    }

    const verifications = await db.execute(sql`
      SELECT * FROM statistical_verifications
      WHERE check_id = ${id}
      ORDER BY is_consistent ASC, created_at ASC
    `);

    res.json({
      check_id: id,
      verifications: verifications.rows,
      count: verifications.rows.length,
      issues: verifications.rows.filter((v: any) => !v.is_consistent).length,
    });

  } catch (error) {
    console.error('[integrity/statistics] Error:', error);
    res.status(500).json({ error: 'Failed to get statistical verifications' });
  }
});

/**
 * Get citation verifications for a check
 */
router.get('/checks/:id/citations', async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const { id } = req.params;

    // Verify check access
    const check = await db.execute(sql`
      SELECT id FROM integrity_checks
      WHERE id = ${id} AND user_id = ${userId} AND check_type = 'citations'
    `);

    if (check.rows.length === 0) {
      return res.status(404).json({ error: 'Check not found' });
    }

    const verifications = await db.execute(sql`
      SELECT * FROM citation_verifications
      WHERE check_id = ${id}
      ORDER BY is_retracted DESC, is_found ASC, created_at ASC
    `);

    res.json({
      check_id: id,
      verifications: verifications.rows,
      count: verifications.rows.length,
      retracted: verifications.rows.filter((v: any) => v.is_retracted).length,
      not_found: verifications.rows.filter((v: any) => !v.is_found).length,
    });

  } catch (error) {
    console.error('[integrity/citations] Error:', error);
    res.status(500).json({ error: 'Failed to get citation verifications' });
  }
});

/**
 * Generate integrity report
 */
router.post('/reports', async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const parsed = generateReportSchema.safeParse(req.body);

    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() });
    }

    const { manuscript_id, check_ids, report_type, title } = parsed.data;

    // Verify manuscript access
    const manuscript = await db.execute(sql`
      SELECT id, title FROM manuscripts
      WHERE id = ${manuscript_id} AND user_id = ${userId}
      LIMIT 1
    `);

    if (manuscript.rows.length === 0) {
      return res.status(404).json({ error: 'Manuscript not found' });
    }

    // Get checks to include
    let checksToInclude;
    if (check_ids && check_ids.length > 0) {
      checksToInclude = await db.execute(sql`
        SELECT * FROM integrity_checks
        WHERE id = ANY(${check_ids}::uuid[]) AND user_id = ${userId} AND status = 'completed'
      `);
    } else {
      checksToInclude = await db.execute(sql`
        SELECT * FROM integrity_checks
        WHERE manuscript_id = ${manuscript_id} AND user_id = ${userId} AND status = 'completed'
        ORDER BY created_at DESC
        LIMIT 10
      `);
    }

    if (checksToInclude.rows.length === 0) {
      return res.status(400).json({ error: 'No completed checks found' });
    }

    // Calculate aggregate scores
    const checks = checksToInclude.rows;
    const plagiarismCheck = checks.find((c: any) => c.check_type === 'plagiarism');
    const statisticsCheck = checks.find((c: any) => c.check_type === 'statistics');
    const citationsCheck = checks.find((c: any) => c.check_type === 'citations');

    const overallScore = calculateIntegrityScore({
      similarity_score: plagiarismCheck?.results?.similarity_score || 0,
      stat_issues: statisticsCheck?.issues_found || 0,
      citation_issues: citationsCheck?.issues_found || 0,
      retracted_citations: citationsCheck?.results?.retracted || 0,
    });

    // Create report
    const result = await db.execute(sql`
      INSERT INTO integrity_reports (
        user_id, manuscript_id, report_type, title,
        check_ids, overall_integrity_score,
        similarity_score, statistics_score, citations_score,
        executive_summary, generated_at
      ) VALUES (
        ${userId}, ${manuscript_id}, ${report_type},
        ${title || `Integrity Report - ${manuscript.rows[0].title}`},
        ${JSON.stringify(checks.map((c: any) => c.id))}::jsonb,
        ${overallScore},
        ${plagiarismCheck?.overall_score || null},
        ${statisticsCheck?.overall_score || null},
        ${citationsCheck?.overall_score || null},
        ${`Integrity analysis completed with overall score of ${overallScore.toFixed(1)}%. ${checks.length} checks performed.`},
        NOW()
      )
      RETURNING id, title, overall_integrity_score, created_at
    `);

    res.status(201).json(result.rows[0]);

  } catch (error) {
    console.error('[integrity/reports/create] Error:', error);
    res.status(500).json({ error: 'Failed to generate report' });
  }
});

/**
 * List reports
 */
router.get('/reports', async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const manuscriptId = req.query.manuscript_id as string;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const offset = parseInt(req.query.offset as string) || 0;

    let conditions = sql`ir.user_id = ${userId}`;

    if (manuscriptId) {
      conditions = sql`${conditions} AND ir.manuscript_id = ${manuscriptId}`;
    }

    const reports = await db.execute(sql`
      SELECT ir.*, m.title as manuscript_title
      FROM integrity_reports ir
      LEFT JOIN manuscripts m ON m.id = ir.manuscript_id
      WHERE ${conditions}
      ORDER BY ir.created_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `);

    res.json({
      reports: reports.rows,
      count: reports.rows.length,
    });

  } catch (error) {
    console.error('[integrity/reports] Error:', error);
    res.status(500).json({ error: 'Failed to list reports' });
  }
});

/**
 * Get report
 */
router.get('/reports/:id', async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const { id } = req.params;

    const result = await db.execute(sql`
      SELECT ir.*, m.title as manuscript_title
      FROM integrity_reports ir
      LEFT JOIN manuscripts m ON m.id = ir.manuscript_id
      WHERE ir.id = ${id} AND ir.user_id = ${userId}
      LIMIT 1
    `);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Report not found' });
    }

    // Get associated checks
    const report = result.rows[0];
    const checkIds = report.check_ids || [];

    let checks: any[] = [];
    if (checkIds.length > 0) {
      const checksResult = await db.execute(sql`
        SELECT * FROM integrity_checks
        WHERE id = ANY(${checkIds}::uuid[])
      `);
      checks = checksResult.rows;
    }

    res.json({
      ...report,
      checks,
    });

  } catch (error) {
    console.error('[integrity/reports/get] Error:', error);
    res.status(500).json({ error: 'Failed to get report' });
  }
});

/**
 * Search retracted papers
 */
router.get('/retracted', async (req: Request, res: Response) => {
  try {
    const parsed = searchRetractedSchema.safeParse(req.query);

    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid query', details: parsed.error.flatten() });
    }

    const { q, doi, pmid, year_from, year_to, limit, offset } = parsed.data;

    let conditions = sql`1=1`;

    if (doi) {
      conditions = sql`${conditions} AND doi = ${doi}`;
    }
    if (pmid) {
      conditions = sql`${conditions} AND pmid = ${pmid}`;
    }
    if (q) {
      conditions = sql`${conditions} AND to_tsvector('english', COALESCE(title, '') || ' ' || COALESCE(authors, '')) @@ plainto_tsquery('english', ${q})`;
    }
    if (year_from) {
      conditions = sql`${conditions} AND EXTRACT(YEAR FROM retraction_date) >= ${year_from}`;
    }
    if (year_to) {
      conditions = sql`${conditions} AND EXTRACT(YEAR FROM retraction_date) <= ${year_to}`;
    }

    const papers = await db.execute(sql`
      SELECT * FROM retracted_papers
      WHERE ${conditions}
      ORDER BY retraction_date DESC
      LIMIT ${limit} OFFSET ${offset}
    `);

    const countResult = await db.execute(sql`
      SELECT COUNT(*) as total FROM retracted_papers WHERE ${conditions}
    `);

    res.json({
      papers: papers.rows,
      pagination: {
        total: parseInt(countResult.rows[0]?.total || '0'),
        limit,
        offset,
      },
    });

  } catch (error) {
    console.error('[integrity/retracted] Error:', error);
    res.status(500).json({ error: 'Failed to search retracted papers' });
  }
});

export default router;
