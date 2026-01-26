/**
 * AI Extraction Route
 * 
 * Provides LLM-powered clinical data extraction endpoint.
 * Uses generateStructured from llm-router for governance-compliant AI calls.
 * 
 * Endpoint: POST /api/ai/extraction/generate
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { generateStructured } from '../../llm-router';
import { logAction } from '../services/audit-service';
import { asyncHandler } from '../middleware/asyncHandler';
import { scan } from '@researchflow/phi-engine';

const router = Router();

// Request schema for extraction
const ExtractionRequestSchema = z.object({
  task: z.string(),
  tier: z.enum(['NANO', 'MINI', 'FRONTIER']).optional(),
  input: z.string(),
  schema: z.record(z.unknown()).optional(),
  metadata: z.record(z.unknown()).optional(),
  return_format: z.enum(['json', 'text']).default('json'),
});

// Map tier names to model selection
const TIER_TO_MODEL: Record<string, string> = {
  NANO: 'claude-3-haiku-20240307',
  MINI: 'claude-3-5-sonnet-20241022',
  FRONTIER: 'claude-3-5-opus-20240620',
};

const TIER_TO_MAX_TOKENS: Record<string, number> = {
  NANO: 2048,
  MINI: 4096,
  FRONTIER: 8192,
};

// Cost per million tokens (rough estimates)
const TIER_COSTS: Record<string, { input: number; output: number }> = {
  NANO: { input: 0.25, output: 1.25 },
  MINI: { input: 3.00, output: 15.00 },
  FRONTIER: { input: 15.00, output: 75.00 },
};

/**
 * POST /api/ai/extraction/generate
 * 
 * Generate structured clinical extraction using LLM.
 * PHI scanning is performed before sending to LLM.
 */
router.post(
  '/generate',
  asyncHandler(async (req: Request, res: Response) => {
    const startTime = Date.now();
    const requestId = req.headers['x-request-id'] as string || `ext_${Date.now()}`;
    
    // Validate request
    const parseResult = ExtractionRequestSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        error: 'INVALID_REQUEST',
        message: 'Invalid request format',
        details: parseResult.error.issues,
        request_id: requestId,
      });
    }
    
    const { task, tier = 'MINI', input, schema, metadata, return_format } = parseResult.data;
    
    // PHI scan before sending to LLM
    try {
      const phiFindings = scan(input);  // scan() returns PhiFinding[] directly
      if (phiFindings && phiFindings.length > 0) {
        // Log PHI detection attempt
        await logAction({
          userId: req.user?.id || 'anonymous',
          action: 'PHI_BLOCKED',
          resourceType: 'ai_extraction',
          resourceId: requestId,
          metadata: {
            task,
            tier,
            phi_findings_count: phiFindings.length,
          },
        });
        
        return res.status(403).json({
          error: 'PHI_DETECTED',
          message: 'Input contains potential PHI. Sanitize data before extraction.',
          request_id: requestId,
          findings_count: phiFindings.length,
        });
      }
    } catch (phiError) {
      // If PHI scan fails, log but continue (fail-open for now)
      console.warn('[Extraction] PHI scan failed, continuing:', phiError);
    }
    
    // Build prompt for extraction
    const systemPrompt = buildExtractionPrompt(task, schema);
    
    // Generate using LLM
    try {
      const model = TIER_TO_MODEL[tier] || TIER_TO_MODEL.MINI;
      const maxTokens = TIER_TO_MAX_TOKENS[tier] || TIER_TO_MAX_TOKENS.MINI;
      
      // Use generateStructured from llm-router
      const result = await generateStructured(
        `${systemPrompt}\n\nInput:\n${input}`,
        schema ? z.object({}).passthrough() : z.string(), // Use passthrough for flexible schema
        {
          researchId: metadata?.research_id as string || 'extraction',
          stageId: metadata?.stage_id as string || 'extraction',
          stageName: task,
        },
        {
          model,
          maxTokens,
          temperature: 0.1, // Low temperature for extraction
        }
      );
      
      if (!result.success) {
        return res.status(500).json({
          error: 'GENERATION_FAILED',
          message: result.error?.message || 'LLM generation failed',
          request_id: requestId,
          tier_used: tier,
        });
      }
      
      // Calculate cost estimate
      const inputTokens = Math.ceil(input.length / 4);
      const outputTokens = Math.ceil(JSON.stringify(result.data).length / 4);
      const costs = TIER_COSTS[tier] || TIER_COSTS.MINI;
      const costUsd = (inputTokens * costs.input + outputTokens * costs.output) / 1_000_000;
      
      // Log successful extraction
      await logAction({
        userId: req.user?.id || 'anonymous',
        action: 'AI_EXTRACTION',
        resourceType: 'ai_extraction',
        resourceId: requestId,
        metadata: {
          task,
          tier,
          model,
          input_tokens: inputTokens,
          output_tokens: outputTokens,
          cost_usd: costUsd,
          duration_ms: Date.now() - startTime,
        },
      });
      
      // Return response
      return res.json({
        output: return_format === 'json' ? result.data : JSON.stringify(result.data),
        tier_used: tier,
        provider: 'anthropic',
        model,
        tokens: {
          input: inputTokens,
          output: outputTokens,
        },
        cost_usd: costUsd,
        request_id: requestId,
      });
      
    } catch (error) {
      console.error('[Extraction] Generation error:', error);
      
      return res.status(500).json({
        error: 'GENERATION_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
        request_id: requestId,
        tier_used: tier,
      });
    }
  })
);

/**
 * GET /api/ai/extraction/health
 * Health check for extraction service
 */
router.get('/health', (_req: Request, res: Response) => {
  res.json({
    status: 'healthy',
    service: 'ai-extraction',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
  });
});

/**
 * Build extraction prompt based on task type
 */
function buildExtractionPrompt(task: string, schema?: Record<string, unknown>): string {
  let prompt = 'You are a clinical data extraction assistant. ';
  
  switch (task) {
    case 'note_type_classify':
      prompt += `Classify the clinical note type. Output ONLY valid JSON with fields: note_type, rationale, confidence.
      
Valid note types: operative_note, discharge_summary, progress_note, radiology_report, pathology_report, consultation, history_and_physical, procedure_note, nursing_note, other`;
      break;
      
    case 'clinical_cell_extract':
      prompt += `Extract structured clinical information. Output ONLY valid JSON matching the schema.

RULES:
1. Never hallucinate - if information is not present, use empty arrays or null
2. Include evidence quotes for each extracted term
3. Set confidence between 0 and 1 based on certainty`;
      break;
      
    default:
      prompt += 'Process the following clinical text and extract structured data.';
  }
  
  prompt += '\n\nIMPORTANT: Output ONLY valid JSON. No markdown, no explanations, no code fences.';
  
  if (schema) {
    prompt += `\n\nExpected output schema:\n${JSON.stringify(schema, null, 2)}`;
  }
  
  return prompt;
}

export default router;
