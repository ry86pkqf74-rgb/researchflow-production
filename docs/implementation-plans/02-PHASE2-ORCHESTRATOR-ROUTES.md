# Phase 2: Orchestrator Proxy Routes

**Target:** `services/orchestrator/src/routes/conference.ts`
**Language:** TypeScript
**Estimated LOC:** ~300 lines of additions/modifications

---

## Overview

The orchestrator needs to proxy requests from the web frontend to the Python worker service. This phase completes the conference router with proper worker communication and download streaming.

---

## File 1: Modify `services/orchestrator/src/routes/conference.ts`

Add the following to the existing conference router file. Look for the existing router definition and add these routes:

```typescript
// ============================================================================
// Add these imports at the top of the file
// ============================================================================

import { Router, Request, Response } from 'express';
import axios, { AxiosError } from 'axios';
import { createReadStream, statSync, existsSync } from 'fs';
import path from 'path';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../utils/logger';
import { requireAuth, requireRole } from '../middleware/auth';
import { auditLog } from '../services/audit';
import { containsPhi } from '@researchflow/phi-engine';

// ============================================================================
// Configuration
// ============================================================================

const WORKER_BASE_URL = process.env.WORKER_SERVICE_URL || 'http://localhost:8001';
const ARTIFACTS_BASE = process.env.ARTIFACTS_PATH || '/data/artifacts/conference';
const CONFERENCE_API_TIMEOUT = 120000; // 2 minutes for material generation

// ============================================================================
// Request Validation Schemas
// ============================================================================

const DiscoverRequestSchema = z.object({
  keywords: z.array(z.string()).min(1),
  yearRange: z.array(z.number()).length(2).optional(),
  formats: z.array(z.string()).optional(),
  locationPref: z.string().optional(),
  maxResults: z.number().min(1).max(50).default(10),
  mode: z.enum(['DEMO', 'LIVE']).default('DEMO'),
});

const ExtractGuidelinesRequestSchema = z.object({
  conferenceName: z.string().min(1),
  conferenceUrl: z.string().url().optional(),
  formats: z.array(z.string()).default(['poster', 'oral']),
  mode: z.enum(['DEMO', 'LIVE']).default('DEMO'),
});

const ExportRequestSchema = z.object({
  researchId: z.string().uuid(),
  conferenceName: z.string().min(1),
  conferenceUrl: z.string().url().optional(),
  formats: z.array(z.enum(['poster', 'oral', 'symposium'])).min(1),
  title: z.string().min(1),
  authors: z.array(z.string()).optional(),
  abstract: z.string().min(10),
  sections: z.object({
    background: z.string().optional(),
    methods: z.string().optional(),
    results: z.string().optional(),
    conclusions: z.string().optional(),
  }),
  blindingMode: z.boolean().default(false),
  mode: z.enum(['DEMO', 'LIVE']).default('DEMO'),
});

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Call the Python worker service
 */
async function callWorker<T>(
  endpoint: string,
  method: 'GET' | 'POST',
  data?: unknown
): Promise<T> {
  const url = `${WORKER_BASE_URL}${endpoint}`;

  try {
    const response = await axios({
      method,
      url,
      data,
      timeout: CONFERENCE_API_TIMEOUT,
      headers: {
        'Content-Type': 'application/json',
      },
    });
    return response.data as T;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const axiosError = error as AxiosError;
      logger.error(`Worker call failed: ${endpoint}`, {
        status: axiosError.response?.status,
        data: axiosError.response?.data,
      });
      throw new Error(
        `Worker service error: ${axiosError.response?.status || 'unknown'}`
      );
    }
    throw error;
  }
}

/**
 * Check if text contains PHI before sending to external services
 */
function validateNoPhi(text: string, fieldName: string): void {
  if (containsPhi(text)) {
    throw new Error(`PHI detected in ${fieldName}. Cannot proceed.`);
  }
}

/**
 * Get MIME type for file extension
 */
function getMimeType(filename: string): string {
  const ext = path.extname(filename).toLowerCase();
  const mimeTypes: Record<string, string> = {
    '.pdf': 'application/pdf',
    '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    '.zip': 'application/zip',
    '.json': 'application/json',
    '.md': 'text/markdown',
  };
  return mimeTypes[ext] || 'application/octet-stream';
}

// ============================================================================
// Route Handlers
// ============================================================================

const router = Router();

/**
 * POST /api/ros/conference/discover
 *
 * Discover conferences matching search criteria.
 * Proxies to Python worker service.
 */
router.post('/discover', requireAuth, async (req: Request, res: Response) => {
  try {
    // Validate request
    const validatedData = DiscoverRequestSchema.parse(req.body);

    // PHI check on keywords
    validatedData.keywords.forEach((kw, i) => {
      validateNoPhi(kw, `keywords[${i}]`);
    });

    logger.info('Conference discovery request', {
      userId: req.user?.id,
      keywords: validatedData.keywords,
      mode: validatedData.mode,
    });

    // Call worker
    const workerPayload = {
      keywords: validatedData.keywords,
      year_range: validatedData.yearRange,
      formats: validatedData.formats,
      location_pref: validatedData.locationPref,
      max_results: validatedData.maxResults,
      mode: validatedData.mode,
    };

    const result = await callWorker<{
      success: boolean;
      conferences: unknown[];
      total_found: number;
      query_metadata: unknown;
    }>('/api/conference/discover', 'POST', workerPayload);

    // Audit log
    await auditLog({
      action: 'conference.discover',
      userId: req.user?.id,
      metadata: {
        keywords: validatedData.keywords,
        resultsCount: result.total_found,
        mode: validatedData.mode,
      },
    });

    res.json({
      success: true,
      data: result,
    });

  } catch (error) {
    logger.error('Conference discovery failed', { error });
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Discovery failed',
    });
  }
});

/**
 * POST /api/ros/conference/guidelines/extract
 *
 * Extract and sanitize conference submission guidelines.
 * Proxies to Python worker service.
 */
router.post('/guidelines/extract', requireAuth, async (req: Request, res: Response) => {
  try {
    // Validate request
    const validatedData = ExtractGuidelinesRequestSchema.parse(req.body);

    logger.info('Guideline extraction request', {
      userId: req.user?.id,
      conference: validatedData.conferenceName,
      mode: validatedData.mode,
    });

    // Call worker
    const workerPayload = {
      conference_name: validatedData.conferenceName,
      conference_url: validatedData.conferenceUrl,
      formats: validatedData.formats,
      mode: validatedData.mode,
    };

    const result = await callWorker<{
      success: boolean;
      conference_name: string;
      raw_text_hash: string;
      extracted_fields: unknown;
      sanitization_applied: boolean;
      mode: string;
    }>('/api/conference/extract-guidelines', 'POST', workerPayload);

    // Audit log
    await auditLog({
      action: 'conference.guidelines.extract',
      userId: req.user?.id,
      metadata: {
        conference: validatedData.conferenceName,
        sanitized: result.sanitization_applied,
        mode: validatedData.mode,
      },
    });

    res.json({
      success: true,
      data: result,
    });

  } catch (error) {
    logger.error('Guideline extraction failed', { error });
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Extraction failed',
    });
  }
});

/**
 * POST /api/ros/conference/export
 *
 * Generate conference submission materials and create bundle.
 * This is the main entry point for the conference prep workflow.
 */
router.post(
  '/export',
  requireAuth,
  requireRole(['RESEARCHER', 'ADMIN']),
  async (req: Request, res: Response) => {
    try {
      // Validate request
      const validatedData = ExportRequestSchema.parse(req.body);

      // PHI checks on user-provided content
      validateNoPhi(validatedData.title, 'title');
      validateNoPhi(validatedData.abstract, 'abstract');
      Object.entries(validatedData.sections).forEach(([key, value]) => {
        if (value) validateNoPhi(value, `sections.${key}`);
      });
      if (validatedData.authors) {
        validatedData.authors.forEach((author, i) => {
          validateNoPhi(author, `authors[${i}]`);
        });
      }

      logger.info('Conference export request', {
        userId: req.user?.id,
        researchId: validatedData.researchId,
        conference: validatedData.conferenceName,
        formats: validatedData.formats,
        mode: validatedData.mode,
      });

      // Call worker for full export
      const workerPayload = {
        research_id: validatedData.researchId,
        conference_name: validatedData.conferenceName,
        conference_url: validatedData.conferenceUrl,
        formats: validatedData.formats,
        title: validatedData.title,
        authors: validatedData.authors,
        abstract: validatedData.abstract,
        sections: validatedData.sections,
        blinding_mode: validatedData.blindingMode,
        mode: validatedData.mode,
      };

      const result = await callWorker<{
        success: boolean;
        run_id: string;
        discovery_results?: unknown;
        guidelines_extracted: unknown;
        materials_generated: unknown[];
        bundle_path: string;
        bundle_hash: string;
        download_url: string;
        checklist: unknown[];
      }>('/api/conference/export', 'POST', workerPayload);

      // Build orchestrator download URL
      const downloadUrl = `/api/ros/conference/download/${result.run_id}/conference_bundle_${result.run_id}.zip`;

      // Audit log
      await auditLog({
        action: 'conference.export',
        userId: req.user?.id,
        metadata: {
          researchId: validatedData.researchId,
          conference: validatedData.conferenceName,
          runId: result.run_id,
          formats: validatedData.formats,
          bundleHash: result.bundle_hash,
        },
      });

      res.json({
        success: true,
        data: {
          runId: result.run_id,
          guidelines: result.guidelines_extracted,
          materials: result.materials_generated,
          bundleHash: result.bundle_hash,
          downloadUrl,
          checklist: result.checklist,
        },
      });

    } catch (error) {
      logger.error('Conference export failed', { error });
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Export failed',
      });
    }
  }
);

/**
 * GET /api/ros/conference/download/:runId/:filename
 *
 * Stream a generated file to the client.
 * Includes security checks to prevent path traversal.
 */
router.get(
  '/download/:runId/:filename',
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const { runId, filename } = req.params;

      // Security: Validate runId and filename (prevent path traversal)
      if (!runId || !filename) {
        return res.status(400).json({ error: 'Missing runId or filename' });
      }

      // Reject any path traversal attempts
      if (
        runId.includes('..') || runId.includes('/') || runId.includes('\\') ||
        filename.includes('..') || filename.includes('/') || filename.includes('\\')
      ) {
        logger.warn('Path traversal attempt detected', {
          userId: req.user?.id,
          runId,
          filename,
        });
        return res.status(400).json({ error: 'Invalid path' });
      }

      // Construct file path
      const filePath = path.join(ARTIFACTS_BASE, runId, filename);

      // Verify file exists
      if (!existsSync(filePath)) {
        return res.status(404).json({ error: 'File not found' });
      }

      // Get file stats
      const stats = statSync(filePath);

      // Set headers
      const mimeType = getMimeType(filename);
      res.setHeader('Content-Type', mimeType);
      res.setHeader('Content-Length', stats.size);
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

      // Audit log
      await auditLog({
        action: 'conference.download',
        userId: req.user?.id,
        metadata: {
          runId,
          filename,
          size: stats.size,
        },
      });

      // Stream file
      const stream = createReadStream(filePath);
      stream.pipe(res);

    } catch (error) {
      logger.error('File download failed', { error });
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Download failed',
      });
    }
  }
);

/**
 * GET /api/ros/conference/export/:runId
 *
 * Get the status and metadata of a previous export.
 */
router.get(
  '/export/:runId',
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const { runId } = req.params;

      // Validate runId
      if (!runId || runId.includes('..') || runId.includes('/')) {
        return res.status(400).json({ error: 'Invalid runId' });
      }

      const manifestPath = path.join(ARTIFACTS_BASE, runId, 'manifest.json');

      if (!existsSync(manifestPath)) {
        return res.status(404).json({ error: 'Export not found' });
      }

      // Read manifest
      const manifest = require(manifestPath);

      res.json({
        success: true,
        data: {
          runId,
          manifest,
          downloadUrl: `/api/ros/conference/download/${runId}/conference_bundle_${runId}.zip`,
        },
      });

    } catch (error) {
      logger.error('Export status check failed', { error });
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Status check failed',
      });
    }
  }
);

export default router;
```

---

## File 2: Ensure Router is Mounted in `services/orchestrator/routes.ts`

Find the route mounting section and ensure the conference router is included:

```typescript
// Add import at top
import conferenceRouter from './src/routes/conference';

// Add in route mounting section (around line 2100-2200)
app.use('/api/ros/conference', conferenceRouter);
```

---

## File 3: Add Worker Service Configuration

Create or update `services/orchestrator/.env.example`:

```env
# Worker Service Configuration
WORKER_SERVICE_URL=http://localhost:8001
ARTIFACTS_PATH=/data/artifacts/conference

# Timeouts (ms)
CONFERENCE_API_TIMEOUT=120000
```

---

## File 4: Update Audit Service Interface (if needed)

If the `auditLog` function doesn't exist, create a minimal version:

```typescript
// services/orchestrator/src/services/audit.ts

interface AuditLogEntry {
  action: string;
  userId?: string;
  metadata?: Record<string, unknown>;
}

export async function auditLog(entry: AuditLogEntry): Promise<void> {
  // For now, just log to console
  // In production, this would write to a database or audit service
  console.log('[AUDIT]', JSON.stringify({
    timestamp: new Date().toISOString(),
    ...entry,
  }));
}
```

---

## Verification Commands

```bash
# Start both services
cd services/worker && uvicorn api_server:app --port 8001 &
cd services/orchestrator && npm run dev &

# Test discovery through orchestrator
curl -X POST http://localhost:3001/api/ros/conference/discover \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"keywords": ["robotic", "surgery"], "maxResults": 5, "mode": "DEMO"}'

# Test export through orchestrator
curl -X POST http://localhost:3001/api/ros/conference/export \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "researchId": "123e4567-e89b-12d3-a456-426614174000",
    "conferenceName": "SAGES",
    "formats": ["poster"],
    "title": "Robotic Surgery Outcomes",
    "abstract": "Background: This study examines...",
    "sections": {
      "background": "...",
      "methods": "...",
      "results": "...",
      "conclusions": "..."
    },
    "mode": "DEMO"
  }'
```

---

## Next Phase

Once orchestrator routes are verified, proceed to [Phase 3: Frontend API Integration](./03-PHASE3-FRONTEND-INTEGRATION.md).
