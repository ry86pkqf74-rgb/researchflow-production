/**
 * Paper Copilot API Routes (Track B Phase 12)
 *
 * RAG-based AI chat for paper/PDF analysis
 *
 * API namespace: /api/papers/:paperId/copilot
 *
 * Endpoints:
 * - GET    /ping                  # Health check
 * - POST   /chunk                 # Chunk and embed paper text
 * - GET    /chunks                # Get chunk count/status
 * - POST   /chat                  # Send chat message
 * - GET    /chat                  # Get chat history
 * - DELETE /chat                  # Clear chat history
 * - POST   /summarize             # Generate summary
 * - GET    /summaries             # Get cached summaries
 * - POST   /extract-claims        # Extract key claims
 * - GET    /claims                # Get extracted claims
 *
 * @module routes/paper-copilot
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { db } from '../../db';
import { sql } from 'drizzle-orm';
import { paperCopilotService } from '../services/paper-copilot.service';

const router = Router({ mergeParams: true }); // Access :paperId from parent router

// =============================================================================
// Validation Schemas
// =============================================================================

const chatMessageSchema = z.object({
  message: z.string().min(1).max(5000),
  includeHistory: z.boolean().default(true),
});

const summarizeSchema = z.object({
  type: z.enum(['abstract', 'full', 'methods', 'results', 'key_findings']).default('full'),
});

// =============================================================================
// Helper Functions
// =============================================================================

function getUserId(req: Request): string {
  return (req as any).user?.id || 'demo-user';
}

async function validatePaperAccess(paperId: string, userId: string): Promise<boolean> {
  const result = await db.execute(sql`
    SELECT id FROM papers WHERE id = ${paperId} AND user_id = ${userId}
  `);
  return result.rows.length > 0;
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
    service: 'paper-copilot',
    aiEnabled: !!process.env.OPENAI_API_KEY,
  });
});

/**
 * Chunk and embed paper text
 */
router.post('/chunk', async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const { paperId } = req.params;

    if (!await validatePaperAccess(paperId, userId)) {
      return res.status(404).json({ error: 'Paper not found' });
    }

    // Check if already processed
    const statusResult = await db.execute(sql`
      SELECT chunking_status, chunks_count FROM papers WHERE id = ${paperId}
    `);

    const status = statusResult.rows[0]?.chunking_status;
    if (status === 'processing') {
      return res.status(409).json({
        error: 'ALREADY_PROCESSING',
        message: 'Paper is already being processed',
      });
    }

    // Start async chunking (don't await)
    paperCopilotService.chunkAndEmbedPaper(paperId)
      .then(count => {
        console.log(`[paper-copilot/chunk] Paper ${paperId} chunked into ${count} chunks`);
      })
      .catch(error => {
        console.error(`[paper-copilot/chunk] Error chunking paper ${paperId}:`, error);
      });

    res.status(202).json({
      status: 'processing',
      message: 'Paper chunking started. Check /chunks endpoint for status.',
      paper_id: paperId,
    });

  } catch (error) {
    console.error('[paper-copilot/chunk] Error:', error);
    res.status(500).json({ error: 'Failed to start chunking' });
  }
});

/**
 * Get chunk status
 */
router.get('/chunks', async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const { paperId } = req.params;

    if (!await validatePaperAccess(paperId, userId)) {
      return res.status(404).json({ error: 'Paper not found' });
    }

    const result = await db.execute(sql`
      SELECT chunking_status, chunks_count, last_chunked_at
      FROM papers WHERE id = ${paperId}
    `);

    res.json({
      paper_id: paperId,
      status: result.rows[0]?.chunking_status || 'pending',
      count: result.rows[0]?.chunks_count || 0,
      last_chunked_at: result.rows[0]?.last_chunked_at,
    });

  } catch (error) {
    console.error('[paper-copilot/chunks] Error:', error);
    res.status(500).json({ error: 'Failed to get chunk status' });
  }
});

/**
 * Send chat message
 */
router.post('/chat', async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const { paperId } = req.params;
    const parsed = chatMessageSchema.safeParse(req.body);

    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() });
    }

    if (!await validatePaperAccess(paperId, userId)) {
      return res.status(404).json({ error: 'Paper not found' });
    }

    // Check if paper has been chunked
    const statusResult = await db.execute(sql`
      SELECT chunking_status, chunks_count FROM papers WHERE id = ${paperId}
    `);

    if (statusResult.rows[0]?.chunking_status !== 'ready' || statusResult.rows[0]?.chunks_count === 0) {
      return res.status(400).json({
        error: 'PAPER_NOT_READY',
        message: 'Paper has not been processed for AI chat. Call POST /chunk first.',
        chunking_status: statusResult.rows[0]?.chunking_status,
      });
    }

    const { message, includeHistory } = parsed.data;

    // Get conversation history if needed
    let history: Array<{ role: 'user' | 'assistant'; content: string }> | undefined;
    if (includeHistory) {
      const historyResult = await db.execute(sql`
        SELECT role, content FROM paper_chat_messages
        WHERE paper_id = ${paperId} AND user_id = ${userId}
        ORDER BY created_at ASC
        LIMIT 20
      `);
      history = historyResult.rows.map(r => ({
        role: r.role as 'user' | 'assistant',
        content: r.content as string,
      }));
    }

    // Call copilot service
    const response = await paperCopilotService.chat(paperId, userId, message, history);

    res.json({
      message: response.message,
      context: response.contextChunks.map(c => ({
        page: c.pageNumber,
        text: c.textContent.slice(0, 200) + '...',
        similarity: c.similarity,
      })),
      usage: {
        model: response.model,
        tokens_input: response.tokensInput,
        tokens_output: response.tokensOutput,
        latency_ms: response.latencyMs,
      },
    });

  } catch (error) {
    console.error('[paper-copilot/chat] Error:', error);
    if ((error as Error).message?.includes('API key')) {
      return res.status(503).json({ error: 'AI service not configured' });
    }
    res.status(500).json({ error: 'Failed to process chat message' });
  }
});

/**
 * Get chat history
 */
router.get('/chat', async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const { paperId } = req.params;
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);

    if (!await validatePaperAccess(paperId, userId)) {
      return res.status(404).json({ error: 'Paper not found' });
    }

    const history = await paperCopilotService.getChatHistory(paperId, userId, limit);

    res.json({
      paper_id: paperId,
      messages: history,
      count: history.length,
    });

  } catch (error) {
    console.error('[paper-copilot/chat/get] Error:', error);
    res.status(500).json({ error: 'Failed to get chat history' });
  }
});

/**
 * Clear chat history
 */
router.delete('/chat', async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const { paperId } = req.params;

    if (!await validatePaperAccess(paperId, userId)) {
      return res.status(404).json({ error: 'Paper not found' });
    }

    await db.execute(sql`
      DELETE FROM paper_chat_messages
      WHERE paper_id = ${paperId} AND user_id = ${userId}
    `);

    res.json({ success: true, message: 'Chat history cleared' });

  } catch (error) {
    console.error('[paper-copilot/chat/delete] Error:', error);
    res.status(500).json({ error: 'Failed to clear chat history' });
  }
});

/**
 * Generate summary
 */
router.post('/summarize', async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const { paperId } = req.params;
    const parsed = summarizeSchema.safeParse(req.body);

    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() });
    }

    if (!await validatePaperAccess(paperId, userId)) {
      return res.status(404).json({ error: 'Paper not found' });
    }

    const { type } = parsed.data;
    const result = await paperCopilotService.generateSummary(paperId, userId, type);

    res.json({
      paper_id: paperId,
      summary: result.summary,
      type: result.type,
      model: result.model,
    });

  } catch (error) {
    console.error('[paper-copilot/summarize] Error:', error);
    if ((error as Error).message?.includes('API key')) {
      return res.status(503).json({ error: 'AI service not configured' });
    }
    res.status(500).json({ error: 'Failed to generate summary' });
  }
});

/**
 * Get cached summaries
 */
router.get('/summaries', async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const { paperId } = req.params;

    if (!await validatePaperAccess(paperId, userId)) {
      return res.status(404).json({ error: 'Paper not found' });
    }

    const result = await db.execute(sql`
      SELECT summary_type, content, model_used, is_stale, created_at, updated_at
      FROM paper_summaries
      WHERE paper_id = ${paperId} AND user_id = ${userId}
      ORDER BY created_at DESC
    `);

    res.json({
      paper_id: paperId,
      summaries: result.rows,
    });

  } catch (error) {
    console.error('[paper-copilot/summaries] Error:', error);
    res.status(500).json({ error: 'Failed to get summaries' });
  }
});

/**
 * Extract claims
 */
router.post('/extract-claims', async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const { paperId } = req.params;

    if (!await validatePaperAccess(paperId, userId)) {
      return res.status(404).json({ error: 'Paper not found' });
    }

    const result = await paperCopilotService.extractClaims(paperId, userId);

    res.json({
      paper_id: paperId,
      claims: result.claims,
      model: result.model,
      count: result.claims.length,
    });

  } catch (error) {
    console.error('[paper-copilot/extract-claims] Error:', error);
    if ((error as Error).message?.includes('API key')) {
      return res.status(503).json({ error: 'AI service not configured' });
    }
    res.status(500).json({ error: 'Failed to extract claims' });
  }
});

/**
 * Get extracted claims
 */
router.get('/claims', async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const { paperId } = req.params;

    if (!await validatePaperAccess(paperId, userId)) {
      return res.status(404).json({ error: 'Paper not found' });
    }

    const result = await db.execute(sql`
      SELECT id, claim_text, claim_type, page_number, confidence_score,
             is_verified, verified_at, created_at
      FROM paper_claims
      WHERE paper_id = ${paperId} AND user_id = ${userId}
      ORDER BY created_at DESC
    `);

    res.json({
      paper_id: paperId,
      claims: result.rows,
      count: result.rows.length,
    });

  } catch (error) {
    console.error('[paper-copilot/claims] Error:', error);
    res.status(500).json({ error: 'Failed to get claims' });
  }
});

export default router;
