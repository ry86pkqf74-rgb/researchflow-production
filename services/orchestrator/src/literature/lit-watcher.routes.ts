/**
 * Literature Watcher Routes
 * Phase 2.2: API endpoints for literature monitoring
 * 
 * Endpoints:
 * - POST /api/literature/watchers - Create watcher
 * - GET /api/literature/watchers/:manuscriptId - List watchers
 * - PUT /api/literature/watchers/:id - Update watcher
 * - DELETE /api/literature/watchers/:id - Delete watcher
 * - GET /api/literature/alerts/:watcherId - Get alerts
 * - PUT /api/literature/alerts/:id/status - Update alert status
 */

import { Router, Request, Response } from 'express';
import { db } from '../../db';
import { logAction } from '../services/audit-service';
import { gapAnalysisService } from './gapanalysis.service';
import { rateLimitedFetch } from '../infra/rateLimiter';

const router = Router();

// Types
interface CreateWatcherRequest {
  manuscriptId: string;
  query: string;
  frequency?: 'daily' | 'weekly' | 'monthly';
  sources?: string[];
}

interface UpdateWatcherRequest {
  query?: string;
  frequency?: 'daily' | 'weekly' | 'monthly';
  sources?: string[];
  status?: 'active' | 'paused' | 'completed';
}

interface UpdateAlertStatusRequest {
  status: 'viewed' | 'dismissed' | 'added';
}

/**
 * Create a new literature watcher
 */
router.post('/watchers', async (req: Request, res: Response) => {
  try {
    const { manuscriptId, query, frequency = 'weekly', sources = ['pubmed', 'semantic_scholar'] } = req.body as CreateWatcherRequest;
    const userId = (req as any).user?.id;
    
    if (!manuscriptId || !query) {
      return res.status(400).json({ error: 'manuscriptId and query are required' });
    }
    
    // Calculate next run time
    const now = new Date();
    const nextRun = calculateNextRun(frequency, now);
    
    // Insert watcher
    const result = await db.query(`
      INSERT INTO lit_watchers (manuscript_id, query, frequency, sources, next_run, created_by)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `, [manuscriptId, query, frequency, sources, nextRun, userId]);
    
    const watcher = result.rows[0];
    
    // Log action
    await logAction({
      eventType: 'WATCHER_CREATED',
      action: 'CREATE',
      resourceType: 'LIT_WATCHER',
      resourceId: watcher.id,
      userId,
      details: { manuscriptId, query, frequency }
    });
    
    res.status(201).json(watcher);
  } catch (error) {
    console.error('[LitWatcher] Create failed:', error);
    res.status(500).json({ error: 'Failed to create watcher' });
  }
});

/**
 * List watchers for a manuscript
 */
router.get('/watchers/:manuscriptId', async (req: Request, res: Response) => {
  try {
    const { manuscriptId } = req.params;
    
    const result = await db.query(`
      SELECT w.*, 
             (SELECT COUNT(*) FROM lit_alerts a WHERE a.watcher_id = w.id AND a.alert_status = 'new') as new_alerts
      FROM lit_watchers w
      WHERE w.manuscript_id = $1
      ORDER BY w.created_at DESC
    `, [manuscriptId]);
    
    res.json(result.rows);
  } catch (error) {
    console.error('[LitWatcher] List failed:', error);
    res.status(500).json({ error: 'Failed to list watchers' });
  }
});

/**
 * Update a watcher
 */
router.put('/watchers/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { query, frequency, sources, status } = req.body as UpdateWatcherRequest;
    const userId = (req as any).user?.id;
    
    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;
    
    if (query !== undefined) {
      updates.push(`query = $${paramIndex++}`);
      values.push(query);
    }
    if (frequency !== undefined) {
      updates.push(`frequency = $${paramIndex++}`);
      values.push(frequency);
      // Recalculate next run if frequency changes
      updates.push(`next_run = $${paramIndex++}`);
      values.push(calculateNextRun(frequency, new Date()));
    }
    if (sources !== undefined) {
      updates.push(`sources = $${paramIndex++}`);
      values.push(sources);
    }
    if (status !== undefined) {
      updates.push(`status = $${paramIndex++}`);
      values.push(status);
    }
    
    if (updates.length === 0) {
      return res.status(400).json({ error: 'No updates provided' });
    }
    
    values.push(id);
    
    const result = await db.query(`
      UPDATE lit_watchers
      SET ${updates.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING *
    `, values);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Watcher not found' });
    }
    
    // Log action
    await logAction({
      eventType: 'WATCHER_UPDATED',
      action: 'UPDATE',
      resourceType: 'LIT_WATCHER',
      resourceId: id,
      userId,
      details: { updates: Object.keys(req.body) }
    });
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('[LitWatcher] Update failed:', error);
    res.status(500).json({ error: 'Failed to update watcher' });
  }
});

/**
 * Delete a watcher
 */
router.delete('/watchers/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = (req as any).user?.id;
    
    const result = await db.query(`
      DELETE FROM lit_watchers
      WHERE id = $1
      RETURNING id, manuscript_id
    `, [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Watcher not found' });
    }
    
    // Log action
    await logAction({
      eventType: 'WATCHER_DELETED',
      action: 'DELETE',
      resourceType: 'LIT_WATCHER',
      resourceId: id,
      userId
    });
    
    res.json({ success: true, deleted: result.rows[0] });
  } catch (error) {
    console.error('[LitWatcher] Delete failed:', error);
    res.status(500).json({ error: 'Failed to delete watcher' });
  }
});

/**
 * Get alerts for a watcher
 */
router.get('/alerts/:watcherId', async (req: Request, res: Response) => {
  try {
    const { watcherId } = req.params;
    const status = req.query.status as string | undefined;
    
    let query = `
      SELECT * FROM lit_alerts
      WHERE watcher_id = $1
    `;
    const values: any[] = [watcherId];
    
    if (status) {
      query += ` AND alert_status = $2`;
      values.push(status);
    }
    
    query += ` ORDER BY relevance_score DESC, created_at DESC`;
    
    const result = await db.query(query, values);
    
    res.json(result.rows);
  } catch (error) {
    console.error('[LitWatcher] Get alerts failed:', error);
    res.status(500).json({ error: 'Failed to get alerts' });
  }
});

/**
 * Update alert status
 */
router.put('/alerts/:id/status', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { status } = req.body as UpdateAlertStatusRequest;
    const userId = (req as any).user?.id;
    
    if (!['viewed', 'dismissed', 'added'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }
    
    const updates: Record<string, any> = {
      alert_status: status
    };
    
    if (status === 'viewed') {
      updates.acknowledged_at = new Date();
    } else if (status === 'added') {
      updates.added_to_manuscript_at = new Date();
    }
    
    const setClauses = Object.keys(updates).map((k, i) => `${k} = $${i + 1}`);
    const values = [...Object.values(updates), id];
    
    const result = await db.query(`
      UPDATE lit_alerts
      SET ${setClauses.join(', ')}
      WHERE id = $${values.length}
      RETURNING *
    `, values);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Alert not found' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('[LitWatcher] Update alert status failed:', error);
    res.status(500).json({ error: 'Failed to update alert status' });
  }
});

/**
 * Run a watcher manually (trigger immediate search)
 */
router.post('/watchers/:id/run', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = (req as any).user?.id;
    
    // Get watcher
    const watcherResult = await db.query(
      'SELECT * FROM lit_watchers WHERE id = $1',
      [id]
    );
    
    if (watcherResult.rows.length === 0) {
      return res.status(404).json({ error: 'Watcher not found' });
    }
    
    const watcher = watcherResult.rows[0];
    
    // Run the search
    const alerts = await runWatcherSearch(watcher);
    
    // Update last_run and next_run
    const nextRun = calculateNextRun(watcher.frequency, new Date());
    await db.query(`
      UPDATE lit_watchers
      SET last_run = NOW(), next_run = $1
      WHERE id = $2
    `, [nextRun, id]);
    
    // Log action
    await logAction({
      eventType: 'WATCHER_RUN',
      action: 'RUN',
      resourceType: 'LIT_WATCHER',
      resourceId: id,
      userId,
      details: { alertsFound: alerts.length }
    });
    
    res.json({
      success: true,
      alertsFound: alerts.length,
      nextRun
    });
  } catch (error) {
    console.error('[LitWatcher] Run failed:', error);
    res.status(500).json({ error: 'Failed to run watcher' });
  }
});

/**
 * Calculate next run time based on frequency
 */
function calculateNextRun(frequency: string, from: Date): Date {
  const next = new Date(from);
  
  switch (frequency) {
    case 'daily':
      next.setDate(next.getDate() + 1);
      break;
    case 'weekly':
      next.setDate(next.getDate() + 7);
      break;
    case 'monthly':
      next.setMonth(next.getMonth() + 1);
      break;
    default:
      next.setDate(next.getDate() + 7);
  }
  
  return next;
}

/**
 * Run search for a watcher and create alerts
 */
async function runWatcherSearch(watcher: any): Promise<any[]> {
  const alerts: any[] = [];
  const workerUrl = process.env.WORKER_URL || 'http://worker:8000';
  
  // Search each source
  for (const source of watcher.sources || ['pubmed']) {
    try {
      const response = await rateLimitedFetch(source, async () => {
        const res = await fetch(`${workerUrl}/api/literature/${source}/search`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            query: watcher.query,
            maxResults: 20,
            sinceDays: watcher.frequency === 'daily' ? 2 : 
                       watcher.frequency === 'weekly' ? 14 : 60
          })
        });
        return res.json();
      });
      
      // Create alerts for new papers
      for (const paper of response.results || []) {
        // Check if we already have this paper
        const existing = await db.query(`
          SELECT id FROM lit_alerts
          WHERE watcher_id = $1 AND (paper_doi = $2 OR paper_pmid = $3 OR paper_title = $4)
        `, [watcher.id, paper.doi, paper.pmid, paper.title]);
        
        if (existing.rows.length === 0) {
          const alertResult = await db.query(`
            INSERT INTO lit_alerts 
              (watcher_id, paper_title, paper_authors, paper_year, paper_doi, paper_pmid, paper_url, relevance_score, source)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            RETURNING *
          `, [
            watcher.id,
            paper.title,
            paper.authors || [],
            paper.year,
            paper.doi,
            paper.pmid,
            paper.url,
            paper.relevanceScore || 0.5,
            source
          ]);
          
          alerts.push(alertResult.rows[0]);
        }
      }
    } catch (error) {
      console.warn(`[LitWatcher] Search failed for ${source}:`, error);
    }
  }
  
  return alerts;
}

export default router;
