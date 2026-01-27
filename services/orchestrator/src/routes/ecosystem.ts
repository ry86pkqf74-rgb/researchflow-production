/**
 * Ecosystem Integrations API Routes (Track B Phase 17)
 *
 * External service integrations including ORCID, Zotero, Mendeley
 *
 * API namespace: /api/ecosystem
 *
 * Endpoints:
 * - GET    /ping                        # Health check
 * - GET    /services                    # List available services
 * - GET    /services/:name/status       # Get service status
 * - GET    /integrations                # List user integrations
 * - POST   /integrations/:service       # Connect service
 * - DELETE /integrations/:service       # Disconnect service
 * - POST   /integrations/:service/sync  # Trigger sync
 * - GET    /orcid/profile               # Get ORCID profile
 * - POST   /orcid/connect               # Connect ORCID
 * - GET    /webhooks                    # List webhooks
 * - POST   /webhooks                    # Create webhook
 * - PATCH  /webhooks/:id                # Update webhook
 * - DELETE /webhooks/:id                # Delete webhook
 * - GET    /import-export/jobs          # List import/export jobs
 * - POST   /import                      # Start import
 * - POST   /export                      # Start export
 *
 * @module routes/ecosystem
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { db } from '../../db';
import { sql } from 'drizzle-orm';

const router = Router();

// =============================================================================
// Configuration
// =============================================================================

const SUPPORTED_SERVICES = [
  { name: 'orcid', label: 'ORCID', type: 'oauth', description: 'Researcher identifier' },
  { name: 'zotero', label: 'Zotero', type: 'oauth', description: 'Reference manager' },
  { name: 'mendeley', label: 'Mendeley', type: 'oauth', description: 'Reference manager' },
  { name: 'crossref', label: 'CrossRef', type: 'api', description: 'DOI metadata' },
  { name: 'pubmed', label: 'PubMed', type: 'api', description: 'Biomedical literature' },
  { name: 'semantic_scholar', label: 'Semantic Scholar', type: 'api', description: 'AI-powered research tool' },
  { name: 'openalex', label: 'OpenAlex', type: 'api', description: 'Open research catalog' },
  { name: 'unpaywall', label: 'Unpaywall', type: 'api', description: 'Open access finder' },
];

// =============================================================================
// Validation Schemas
// =============================================================================

const connectServiceSchema = z.object({
  code: z.string().optional(), // OAuth code
  api_key: z.string().optional(), // For API key services
  settings: z.record(z.any()).optional(),
});

const createWebhookSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().optional(),
  direction: z.enum(['incoming', 'outgoing']),
  target_url: z.string().url().optional(),
  http_method: z.enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']).default('POST'),
  headers: z.record(z.string()).optional(),
  auth_type: z.enum(['none', 'basic', 'bearer', 'custom']).default('none'),
  trigger_events: z.array(z.string()).optional(),
});

const updateWebhookSchema = createWebhookSchema.partial().extend({
  is_active: z.boolean().optional(),
});

const startImportSchema = z.object({
  source_type: z.enum(['zotero', 'mendeley', 'bibtex', 'ris', 'endnote', 'csv']),
  file_content: z.string().optional(), // For file uploads
  collection_id: z.string().uuid().optional(), // Target collection
  options: z.record(z.any()).optional(),
});

const startExportSchema = z.object({
  target_type: z.enum(['bibtex', 'ris', 'endnote', 'csv', 'json']),
  citation_ids: z.array(z.string().uuid()).optional(),
  collection_id: z.string().uuid().optional(),
  include_abstracts: z.boolean().default(true),
  include_notes: z.boolean().default(false),
});

// =============================================================================
// Helper Functions
// =============================================================================

function getUserId(req: Request): string {
  return (req as any).user?.id || 'demo-user';
}

/**
 * Generate webhook URL for incoming webhooks
 */
function generateWebhookUrl(webhookId: string): string {
  const baseUrl = process.env.BASE_URL || 'http://localhost:3001';
  return `${baseUrl}/api/webhooks/incoming/${webhookId}`;
}

/**
 * Generate webhook secret
 */
function generateWebhookSecret(): string {
  return require('crypto').randomBytes(32).toString('hex');
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
    service: 'ecosystem',
    supported_services: SUPPORTED_SERVICES.map(s => s.name),
  });
});

/**
 * List available services
 */
router.get('/services', (_req: Request, res: Response) => {
  res.json({
    services: SUPPORTED_SERVICES,
  });
});

/**
 * Get service status
 */
router.get('/services/:name/status', async (req: Request, res: Response) => {
  try {
    const { name } = req.params;

    const service = SUPPORTED_SERVICES.find(s => s.name === name);
    if (!service) {
      return res.status(404).json({ error: 'Service not found' });
    }

    // Get cached status
    const status = await db.execute(sql`
      SELECT * FROM service_status_cache WHERE service_name = ${name}
    `);

    if (status.rows.length === 0) {
      return res.json({
        service: name,
        is_available: true,
        last_checked_at: null,
        message: 'Status not yet checked',
      });
    }

    res.json({
      service: name,
      ...status.rows[0],
    });

  } catch (error) {
    console.error('[ecosystem/services/status] Error:', error);
    res.status(500).json({ error: 'Failed to get service status' });
  }
});

/**
 * List user integrations
 */
router.get('/integrations', async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);

    const integrations = await db.execute(sql`
      SELECT id, service_name, service_user_id, is_active,
             last_sync_at, sync_status, items_synced, settings,
             created_at, updated_at
      FROM user_integrations
      WHERE user_id = ${userId}
      ORDER BY service_name
    `);

    // Add service info
    const result = integrations.rows.map((int: any) => {
      const service = SUPPORTED_SERVICES.find(s => s.name === int.service_name);
      return {
        ...int,
        service_label: service?.label,
        service_type: service?.type,
      };
    });

    res.json({
      integrations: result,
      count: result.length,
    });

  } catch (error) {
    console.error('[ecosystem/integrations] Error:', error);
    res.status(500).json({ error: 'Failed to list integrations' });
  }
});

/**
 * Connect service
 */
router.post('/integrations/:service', async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const { service } = req.params;
    const parsed = connectServiceSchema.safeParse(req.body);

    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() });
    }

    const serviceInfo = SUPPORTED_SERVICES.find(s => s.name === service);
    if (!serviceInfo) {
      return res.status(404).json({ error: 'Service not supported' });
    }

    const { code, api_key, settings } = parsed.data;

    // For OAuth services, exchange code for tokens
    // For API key services, validate and store key
    // This is a placeholder - actual implementation depends on each service

    let accessToken = null;
    let refreshToken = null;
    let tokenExpires = null;
    let serviceUserId = null;

    if (serviceInfo.type === 'oauth' && code) {
      // TODO: Exchange OAuth code for tokens
      // This would call the service's token endpoint
      accessToken = 'placeholder_token';
      serviceUserId = 'placeholder_user';
    }

    // Upsert integration
    const result = await db.execute(sql`
      INSERT INTO user_integrations (
        user_id, service_name, service_user_id,
        access_token, refresh_token, token_expires_at,
        api_key, settings, is_active
      ) VALUES (
        ${userId}, ${service}, ${serviceUserId},
        ${accessToken}, ${refreshToken}, ${tokenExpires},
        ${api_key || null}, ${settings ? JSON.stringify(settings) : '{}'}::jsonb, TRUE
      )
      ON CONFLICT (user_id, service_name) DO UPDATE SET
        service_user_id = EXCLUDED.service_user_id,
        access_token = EXCLUDED.access_token,
        refresh_token = EXCLUDED.refresh_token,
        token_expires_at = EXCLUDED.token_expires_at,
        api_key = EXCLUDED.api_key,
        settings = EXCLUDED.settings,
        is_active = TRUE,
        updated_at = NOW()
      RETURNING id, service_name, is_active, created_at
    `);

    res.status(201).json({
      integration: result.rows[0],
      message: `Connected to ${serviceInfo.label}`,
    });

  } catch (error) {
    console.error('[ecosystem/integrations/connect] Error:', error);
    res.status(500).json({ error: 'Failed to connect service' });
  }
});

/**
 * Disconnect service
 */
router.delete('/integrations/:service', async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const { service } = req.params;

    const result = await db.execute(sql`
      DELETE FROM user_integrations
      WHERE user_id = ${userId} AND service_name = ${service}
      RETURNING id
    `);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Integration not found' });
    }

    res.json({ success: true, service });

  } catch (error) {
    console.error('[ecosystem/integrations/disconnect] Error:', error);
    res.status(500).json({ error: 'Failed to disconnect service' });
  }
});

/**
 * Trigger sync
 */
router.post('/integrations/:service/sync', async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const { service } = req.params;

    // Check integration exists
    const integration = await db.execute(sql`
      SELECT id, is_active FROM user_integrations
      WHERE user_id = ${userId} AND service_name = ${service}
    `);

    if (integration.rows.length === 0) {
      return res.status(404).json({ error: 'Integration not found' });
    }

    if (!integration.rows[0].is_active) {
      return res.status(400).json({ error: 'Integration is not active' });
    }

    // Update sync status
    await db.execute(sql`
      UPDATE user_integrations SET
        sync_status = 'syncing',
        updated_at = NOW()
      WHERE id = ${integration.rows[0].id}
    `);

    // Start async sync (placeholder)
    // In production, this would trigger a background job
    setTimeout(async () => {
      await db.execute(sql`
        UPDATE user_integrations SET
          sync_status = 'completed',
          last_sync_at = NOW(),
          updated_at = NOW()
        WHERE id = ${integration.rows[0].id}
      `);
    }, 2000);

    res.status(202).json({
      status: 'syncing',
      message: 'Sync started',
      service,
    });

  } catch (error) {
    console.error('[ecosystem/integrations/sync] Error:', error);
    res.status(500).json({ error: 'Failed to start sync' });
  }
});

/**
 * Get ORCID profile
 */
router.get('/orcid/profile', async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);

    const profile = await db.execute(sql`
      SELECT * FROM orcid_profiles WHERE user_id = ${userId}
    `);

    if (profile.rows.length === 0) {
      return res.status(404).json({ error: 'ORCID not connected' });
    }

    res.json(profile.rows[0]);

  } catch (error) {
    console.error('[ecosystem/orcid/profile] Error:', error);
    res.status(500).json({ error: 'Failed to get ORCID profile' });
  }
});

/**
 * Connect ORCID (OAuth callback handler)
 */
router.post('/orcid/connect', async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const { code } = req.body;

    if (!code) {
      return res.status(400).json({ error: 'Authorization code required' });
    }

    // TODO: Exchange code for tokens with ORCID
    // Then fetch profile data
    // This is a placeholder

    const orcidId = '0000-0000-0000-0000'; // Placeholder
    const profileData = {
      given_names: 'John',
      family_name: 'Doe',
    };

    // Upsert ORCID profile
    const result = await db.execute(sql`
      INSERT INTO orcid_profiles (
        user_id, orcid_id, given_names, family_name, last_synced_at
      ) VALUES (
        ${userId}, ${orcidId}, ${profileData.given_names}, ${profileData.family_name}, NOW()
      )
      ON CONFLICT (user_id) DO UPDATE SET
        orcid_id = EXCLUDED.orcid_id,
        given_names = EXCLUDED.given_names,
        family_name = EXCLUDED.family_name,
        last_synced_at = NOW(),
        updated_at = NOW()
      RETURNING id, orcid_id
    `);

    res.status(201).json({
      orcid_id: result.rows[0].orcid_id,
      message: 'ORCID connected successfully',
    });

  } catch (error) {
    console.error('[ecosystem/orcid/connect] Error:', error);
    res.status(500).json({ error: 'Failed to connect ORCID' });
  }
});

/**
 * List webhooks
 */
router.get('/webhooks', async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);

    const webhooks = await db.execute(sql`
      SELECT id, name, description, direction, target_url, http_method,
             is_active, trigger_events, total_calls, successful_calls,
             failed_calls, last_called_at, created_at
      FROM webhook_configs
      WHERE user_id = ${userId}
      ORDER BY created_at DESC
    `);

    res.json({
      webhooks: webhooks.rows,
      count: webhooks.rows.length,
    });

  } catch (error) {
    console.error('[ecosystem/webhooks] Error:', error);
    res.status(500).json({ error: 'Failed to list webhooks' });
  }
});

/**
 * Create webhook
 */
router.post('/webhooks', async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const parsed = createWebhookSchema.safeParse(req.body);

    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() });
    }

    const data = parsed.data;
    const webhookSecret = data.direction === 'incoming' ? generateWebhookSecret() : null;

    const result = await db.execute(sql`
      INSERT INTO webhook_configs (
        user_id, name, description, direction, target_url, http_method,
        headers, auth_type, trigger_events, webhook_secret
      ) VALUES (
        ${userId}, ${data.name}, ${data.description || null}, ${data.direction},
        ${data.target_url || null}, ${data.http_method},
        ${data.headers ? JSON.stringify(data.headers) : '{}'}::jsonb,
        ${data.auth_type},
        ${data.trigger_events ? JSON.stringify(data.trigger_events) : '[]'}::jsonb,
        ${webhookSecret}
      )
      RETURNING id, name, direction, webhook_secret, created_at
    `);

    const webhook = result.rows[0];

    // Add webhook URL for incoming webhooks
    if (data.direction === 'incoming') {
      webhook.webhook_url = generateWebhookUrl(webhook.id);
    }

    res.status(201).json(webhook);

  } catch (error) {
    console.error('[ecosystem/webhooks/create] Error:', error);
    res.status(500).json({ error: 'Failed to create webhook' });
  }
});

/**
 * Update webhook
 */
router.patch('/webhooks/:id', async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const { id } = req.params;
    const parsed = updateWebhookSchema.safeParse(req.body);

    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() });
    }

    // Check ownership
    const existing = await db.execute(sql`
      SELECT id FROM webhook_configs WHERE id = ${id} AND user_id = ${userId}
    `);

    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Webhook not found' });
    }

    const data = parsed.data;
    const updates: string[] = [];

    Object.entries(data).forEach(([key, value]) => {
      if (value !== undefined) {
        if (key === 'headers' || key === 'trigger_events') {
          updates.push(`${key} = '${JSON.stringify(value)}'::jsonb`);
        } else if (typeof value === 'string') {
          updates.push(`${key} = '${value}'`);
        } else if (typeof value === 'boolean') {
          updates.push(`${key} = ${value}`);
        }
      }
    });

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No updates provided' });
    }

    await db.execute(sql`
      UPDATE webhook_configs SET ${sql.raw(updates.join(', '))}, updated_at = NOW()
      WHERE id = ${id}
    `);

    res.json({ success: true, id });

  } catch (error) {
    console.error('[ecosystem/webhooks/update] Error:', error);
    res.status(500).json({ error: 'Failed to update webhook' });
  }
});

/**
 * Delete webhook
 */
router.delete('/webhooks/:id', async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const { id } = req.params;

    const result = await db.execute(sql`
      DELETE FROM webhook_configs WHERE id = ${id} AND user_id = ${userId}
      RETURNING id
    `);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Webhook not found' });
    }

    res.json({ success: true, id });

  } catch (error) {
    console.error('[ecosystem/webhooks/delete] Error:', error);
    res.status(500).json({ error: 'Failed to delete webhook' });
  }
});

/**
 * List import/export jobs
 */
router.get('/import-export/jobs', async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const jobType = req.query.type as string;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const offset = parseInt(req.query.offset as string) || 0;

    let conditions = sql`user_id = ${userId}`;

    if (jobType) {
      conditions = sql`${conditions} AND job_type = ${jobType}`;
    }

    const jobs = await db.execute(sql`
      SELECT * FROM import_export_jobs
      WHERE ${conditions}
      ORDER BY created_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `);

    res.json({
      jobs: jobs.rows,
      count: jobs.rows.length,
    });

  } catch (error) {
    console.error('[ecosystem/import-export/jobs] Error:', error);
    res.status(500).json({ error: 'Failed to list jobs' });
  }
});

/**
 * Start import
 */
router.post('/import', async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const parsed = startImportSchema.safeParse(req.body);

    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() });
    }

    const { source_type, file_content, collection_id, options } = parsed.data;

    // Create job
    const result = await db.execute(sql`
      INSERT INTO import_export_jobs (
        user_id, job_type, source_type, status, started_at
      ) VALUES (
        ${userId}, 'import', ${source_type}, 'processing', NOW()
      )
      RETURNING id
    `);

    const jobId = result.rows[0].id;

    // Start async import (placeholder)
    setTimeout(async () => {
      await db.execute(sql`
        UPDATE import_export_jobs SET
          status = 'completed',
          processed_items = 0,
          successful_items = 0,
          completed_at = NOW()
        WHERE id = ${jobId}
      `);
    }, 3000);

    res.status(202).json({
      job_id: jobId,
      status: 'processing',
      message: 'Import started',
    });

  } catch (error) {
    console.error('[ecosystem/import] Error:', error);
    res.status(500).json({ error: 'Failed to start import' });
  }
});

/**
 * Start export
 */
router.post('/export', async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const parsed = startExportSchema.safeParse(req.body);

    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() });
    }

    const { target_type, citation_ids, collection_id, include_abstracts, include_notes } = parsed.data;

    // Create job
    const result = await db.execute(sql`
      INSERT INTO import_export_jobs (
        user_id, job_type, target_type, status, started_at
      ) VALUES (
        ${userId}, 'export', ${target_type}, 'processing', NOW()
      )
      RETURNING id
    `);

    const jobId = result.rows[0].id;

    // Start async export (placeholder)
    setTimeout(async () => {
      await db.execute(sql`
        UPDATE import_export_jobs SET
          status = 'completed',
          output_filename = ${'export_' + jobId + '.' + target_type},
          processed_items = 0,
          successful_items = 0,
          completed_at = NOW()
        WHERE id = ${jobId}
      `);
    }, 2000);

    res.status(202).json({
      job_id: jobId,
      status: 'processing',
      message: 'Export started',
    });

  } catch (error) {
    console.error('[ecosystem/export] Error:', error);
    res.status(500).json({ error: 'Failed to start export' });
  }
});

export default router;
