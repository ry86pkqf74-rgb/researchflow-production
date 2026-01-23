/**
 * RIS Export Routes
 *
 * Provides endpoints for exporting literature references to RIS format
 * for import into reference managers (Zotero, EndNote, Mendeley).
 *
 * Based on integrations_4.pdf specification.
 */

import { Router, type Request, type Response } from 'express';
import { requirePermission } from '../middleware/rbac';
import { asyncHandler } from '../middleware/asyncHandler';
import { logAction } from '../services/audit-service';

const router = Router();

/**
 * RIS field escape - removes CR/LF characters
 */
function risEscape(s: string | null | undefined): string {
  if (!s) return '';
  return s.replace(//g, ' ').replace(/
/g, ' ').trim();
}

/**
 * Convert article to RIS format
 */
function toRisArticle(article: {
  title: string;
  authors: string[];
  year?: string | number;
  journal?: string;
  venue?: string;
  abstract?: string;
  doi?: string;
  pmid?: string;
  url?: string;
  volume?: string;
  issue?: string;
  pages?: string;
  keywords?: string[];
}): string {
  const lines: string[] = [];

  // Type (Journal Article)
  lines.push('TY  - JOUR');

  // Authors
  for (const author of article.authors || []) {
    lines.push(`AU  - ${risEscape(author)}`);
  }

  // Year
  if (article.year) {
    lines.push(`PY  - ${risEscape(String(article.year))}`);
  }

  // Title
  lines.push(`TI  - ${risEscape(article.title)}`);

  // Journal
  const journal = article.journal || article.venue;
  if (journal) {
    lines.push(`JO  - ${risEscape(journal)}`);
  }

  // Volume, Issue, Pages
  if (article.volume) lines.push(`VL  - ${risEscape(article.volume)}`);
  if (article.issue) lines.push(`IS  - ${risEscape(article.issue)}`);
  if (article.pages) lines.push(`SP  - ${risEscape(article.pages)}`);

  // DOI
  if (article.doi) {
    lines.push(`DO  - ${risEscape(article.doi)}`);
  }

  // PMID
  if (article.pmid) {
    lines.push(`AN  - ${risEscape(article.pmid)}`);
  }

  // URL
  if (article.url) {
    lines.push(`UR  - ${risEscape(article.url)}`);
  }

  // Abstract
  if (article.abstract) {
    lines.push(`AB  - ${risEscape(article.abstract)}`);
  }

  // Keywords
  if (article.keywords) {
    for (const kw of article.keywords) {
      lines.push(`KW  - ${risEscape(kw)}`);
    }
  }

  // End of reference
  lines.push('ER  -');

  // RIS uses CRLF
  return lines.join('
') + '
';
}

/**
 * POST /api/export/ris
 * Export articles to RIS format
 *
 * Request body:
 * {
 *   articles: Array<{
 *     title: string;
 *     authors: string[];
 *     year?: number | string;
 *     journal?: string;
 *     abstract?: string;
 *     doi?: string;
 *     pmid?: string;
 *     url?: string;
 *   }>;
 *   filename?: string;
 * }
 */
router.post(
  '/ris',
  requirePermission('ANALYZE'),
  asyncHandler(async (req: Request, res: Response) => {
    const user = req.user;

    if (!user) {
      return res.status(401).json({
        error: 'AUTHENTICATION_REQUIRED',
        message: 'Authentication required'
      });
    }

    const { articles, filename = 'export.ris' } = req.body;

    if (!articles || !Array.isArray(articles)) {
      return res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: 'articles array is required'
      });
    }

    if (articles.length === 0) {
      return res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: 'At least one article is required'
      });
    }

    // Validate articles have required fields
    for (let i = 0; i < articles.length; i++) {
      const article = articles[i];
      if (!article.title) {
        return res.status(400).json({
          error: 'VALIDATION_ERROR',
          message: `Article ${i} is missing required 'title' field`
        });
      }
      if (!article.authors || !Array.isArray(article.authors)) {
        return res.status(400).json({
          error: 'VALIDATION_ERROR',
          message: `Article ${i} is missing required 'authors' array`
        });
      }
    }

    // Convert to RIS
    const risEntries = articles.map(toRisArticle);
    const risContent = risEntries.join('
');

    // Log export
    await logAction({
      userId: user.id,
      action: 'EXPORT_RIS',
      resourceType: 'literature',
      resourceId: `export_${Date.now()}`,
      metadata: {
        articleCount: articles.length,
        filename
      }
    });

    // Return as downloadable file
    res.setHeader('Content-Type', 'application/x-research-info-systems');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(risContent);
  })
);

/**
 * GET /api/export/ris/sample
 * Get a sample RIS export (for testing)
 */
router.get(
  '/ris/sample',
  asyncHandler(async (_req: Request, res: Response) => {
    const sampleArticle = {
      title: 'Sample Article for RIS Export Testing',
      authors: ['Doe, Jane', 'Smith, John'],
      year: 2025,
      journal: 'Journal of Research',
      doi: '10.1234/example',
      pmid: '12345678',
      abstract: 'This is a sample abstract for testing RIS export functionality.'
    };

    const risContent = toRisArticle(sampleArticle);

    res.setHeader('Content-Type', 'application/x-research-info-systems');
    res.setHeader('Content-Disposition', 'attachment; filename="sample.ris"');
    res.send(risContent);
  })
);

export default router;
