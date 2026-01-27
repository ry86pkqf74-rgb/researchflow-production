/**
 * Phase Chat Routes
 *
 * API endpoints for phase-specific chat with AI agents.
 * Maps workflow stages (1-20) to specialized agents.
 */

import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';

// Import agent registry (will be available after package link)
// For now, inline the registry to avoid build issues
const AGENT_REGISTRY: Record<string, {
  id: string;
  name: string;
  description: string;
  modelTier: string;
  phiScanRequired: boolean;
  maxTokens: number;
}> = {
  'data-extraction': {
    id: 'data-extraction',
    name: 'Data Extraction Agent',
    description: 'Extracts structured data from clinical documents',
    modelTier: 'STANDARD',
    phiScanRequired: true,
    maxTokens: 4096,
  },
  'data-validation': {
    id: 'data-validation',
    name: 'Data Validation Agent',
    description: 'Validates and cleans extracted data',
    modelTier: 'MINI',
    phiScanRequired: true,
    maxTokens: 2048,
  },
  'variable-identification': {
    id: 'variable-identification',
    name: 'Variable Identification Agent',
    description: 'Identifies key variables for analysis',
    modelTier: 'STANDARD',
    phiScanRequired: false,
    maxTokens: 4096,
  },
  'cohort-definition': {
    id: 'cohort-definition',
    name: 'Cohort Definition Agent',
    description: 'Helps define study cohorts and inclusion/exclusion criteria',
    modelTier: 'STANDARD',
    phiScanRequired: true,
    maxTokens: 4096,
  },
  'statistical-analysis': {
    id: 'statistical-analysis',
    name: 'Statistical Analysis Agent',
    description: 'Guides statistical analysis and interprets results',
    modelTier: 'FRONTIER',
    phiScanRequired: false,
    maxTokens: 8192,
  },
  'descriptive-stats': {
    id: 'descriptive-stats',
    name: 'Descriptive Statistics Agent',
    description: 'Generates summary statistics and visualizations',
    modelTier: 'MINI',
    phiScanRequired: false,
    maxTokens: 2048,
  },
  'model-builder': {
    id: 'model-builder',
    name: 'Model Building Agent',
    description: 'Assists with statistical model construction',
    modelTier: 'FRONTIER',
    phiScanRequired: false,
    maxTokens: 8192,
  },
  'results-interpreter': {
    id: 'results-interpreter',
    name: 'Results Interpreter Agent',
    description: 'Interprets statistical results and effect sizes',
    modelTier: 'STANDARD',
    phiScanRequired: false,
    maxTokens: 4096,
  },
  'manuscript-drafting': {
    id: 'manuscript-drafting',
    name: 'Manuscript Drafting Agent',
    description: 'Drafts manuscript sections following IMRaD structure',
    modelTier: 'FRONTIER',
    phiScanRequired: true,
    maxTokens: 16384,
  },
  'introduction-writer': {
    id: 'introduction-writer',
    name: 'Introduction Writer Agent',
    description: 'Crafts compelling introductions with literature context',
    modelTier: 'FRONTIER',
    phiScanRequired: false,
    maxTokens: 8192,
  },
  'methods-writer': {
    id: 'methods-writer',
    name: 'Methods Writer Agent',
    description: 'Writes detailed, reproducible methods sections',
    modelTier: 'STANDARD',
    phiScanRequired: false,
    maxTokens: 8192,
  },
  'results-writer': {
    id: 'results-writer',
    name: 'Results Writer Agent',
    description: 'Transforms statistical output into clear narrative',
    modelTier: 'STANDARD',
    phiScanRequired: false,
    maxTokens: 8192,
  },
  'discussion-writer': {
    id: 'discussion-writer',
    name: 'Discussion Writer Agent',
    description: 'Writes balanced discussions with implications',
    modelTier: 'FRONTIER',
    phiScanRequired: false,
    maxTokens: 8192,
  },
  'conference-scout': {
    id: 'conference-scout',
    name: 'Conference Scout Agent',
    description: 'Extracts submission guidelines and deadlines',
    modelTier: 'MINI',
    phiScanRequired: false,
    maxTokens: 2048,
  },
  'abstract-generator': {
    id: 'abstract-generator',
    name: 'Abstract Generator Agent',
    description: 'Generates conference abstracts within word limits',
    modelTier: 'STANDARD',
    phiScanRequired: true,
    maxTokens: 4096,
  },
  'poster-designer': {
    id: 'poster-designer',
    name: 'Poster Design Agent',
    description: 'Helps organize content for research posters',
    modelTier: 'MINI',
    phiScanRequired: false,
    maxTokens: 4096,
  },
  'presentation-prep': {
    id: 'presentation-prep',
    name: 'Presentation Prep Agent',
    description: 'Assists with slide content and speaker notes',
    modelTier: 'STANDARD',
    phiScanRequired: false,
    maxTokens: 4096,
  },
  'research-brief': {
    id: 'research-brief',
    name: 'Research Brief Agent',
    description: 'Generates research topic overviews',
    modelTier: 'MINI',
    phiScanRequired: false,
    maxTokens: 2048,
  },
};

const STAGE_TO_AGENTS: Record<number, string[]> = {
  1: ['data-extraction'],
  2: ['data-validation', 'data-extraction'],
  3: ['variable-identification', 'data-extraction'],
  4: ['cohort-definition', 'variable-identification'],
  5: ['data-validation', 'cohort-definition'],
  6: ['descriptive-stats', 'statistical-analysis'],
  7: ['statistical-analysis', 'model-builder'],
  8: ['model-builder', 'statistical-analysis'],
  9: ['results-interpreter', 'statistical-analysis'],
  10: ['results-interpreter', 'model-builder'],
  11: ['introduction-writer', 'manuscript-drafting'],
  12: ['methods-writer', 'manuscript-drafting'],
  13: ['results-writer', 'manuscript-drafting'],
  14: ['discussion-writer', 'manuscript-drafting'],
  15: ['abstract-generator', 'manuscript-drafting'],
  16: ['conference-scout', 'abstract-generator'],
  17: ['abstract-generator', 'conference-scout'],
  18: ['poster-designer', 'abstract-generator'],
  19: ['presentation-prep', 'poster-designer'],
  20: ['conference-scout', 'presentation-prep'],
};

const STAGE_DESCRIPTIONS: Record<number, string> = {
  1: 'Data collection and initial extraction',
  2: 'Data validation and cleaning',
  3: 'Variable identification',
  4: 'Cohort definition',
  5: 'Data transformation',
  6: 'Descriptive statistics',
  7: 'Inferential analysis',
  8: 'Model building',
  9: 'Results interpretation',
  10: 'Sensitivity analysis',
  11: 'Introduction drafting',
  12: 'Methods section',
  13: 'Results section',
  14: 'Discussion section',
  15: 'Abstract and final review',
  16: 'Conference identification',
  17: 'Abstract preparation',
  18: 'Poster design',
  19: 'Presentation preparation',
  20: 'Submission and follow-up',
};

function getAgentsForStage(stage: number) {
  const agentIds = STAGE_TO_AGENTS[stage] || ['research-brief'];
  return agentIds
    .map((id) => AGENT_REGISTRY[id])
    .filter((agent) => agent !== undefined);
}

const router = Router();

// Input validation schema
const PhaseChatInputSchema = z.object({
  query: z.string().min(1).max(10000),
  topic: z.string().optional(),
  context: z.record(z.unknown()).optional(),
  conversationId: z.string().optional(),
});

/**
 * GET /api/phase/:stage/agents
 * List available agents for a workflow stage
 */
router.get('/:stage/agents', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const stage = parseInt(req.params.stage, 10);

    if (isNaN(stage) || stage < 1 || stage > 20) {
      return res.status(400).json({
        error: 'Invalid stage',
        message: 'Stage must be a number between 1 and 20',
      });
    }

    const agents = getAgentsForStage(stage);

    res.json({
      stage,
      stageDescription: STAGE_DESCRIPTIONS[stage] || 'Unknown stage',
      agents: agents.map((a) => ({
        id: a.id,
        name: a.name,
        description: a.description,
        modelTier: a.modelTier,
      })),
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/phase/:stage/chat
 * Phase-specific chat endpoint
 */
router.post('/:stage/chat', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const stage = parseInt(req.params.stage, 10);

    if (isNaN(stage) || stage < 1 || stage > 20) {
      return res.status(400).json({
        error: 'Invalid stage',
        message: 'Stage must be a number between 1 and 20',
      });
    }

    const parseResult = PhaseChatInputSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        error: 'Validation error',
        details: parseResult.error.errors,
      });
    }

    const { query, topic, context, conversationId } = parseResult.data;
    const agents = getAgentsForStage(stage);

    if (agents.length === 0) {
      return res.status(400).json({
        error: 'No agents available',
        message: `No agents configured for stage ${stage}`,
      });
    }

    // Select primary agent (first one, or based on topic)
    const primaryAgent = topic
      ? agents.find((a) => a.id.includes(topic)) || agents[0]
      : agents[0];

    // Build phase context
    const phaseContext = `Current workflow stage: ${stage} - ${STAGE_DESCRIPTIONS[stage] || 'Unknown'}${topic ? `\nFocus topic: ${topic}` : ''}`;

    // Generate conversation ID if not provided
    const newConversationId = conversationId || `conv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // TODO: Integrate with actual AI provider for real responses
    // For now, return placeholder response
    res.json({
      stage,
      stageDescription: STAGE_DESCRIPTIONS[stage],
      agentUsed: primaryAgent.id,
      topic: topic || 'general',
      conversationId: newConversationId,
      response: {
        content: `[Phase ${stage} - ${primaryAgent.name}]\n\nI'm here to help with "${STAGE_DESCRIPTIONS[stage]}". You asked:\n\n"${query.substring(0, 200)}${query.length > 200 ? '...' : ''}"\n\n*This is a placeholder response. Connect to AI provider for real assistance.*\n\nContext: ${phaseContext}`,
        metadata: {
          modelTier: primaryAgent.modelTier,
          phiScanRequired: primaryAgent.phiScanRequired,
          tokensUsed: 0,
          processingTimeMs: 0,
        },
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/phase/:stage/chat/:agentId
 * Call a specific agent within a stage
 */
router.post('/:stage/chat/:agentId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const stage = parseInt(req.params.stage, 10);
    const { agentId } = req.params;

    if (isNaN(stage) || stage < 1 || stage > 20) {
      return res.status(400).json({ error: 'Invalid stage' });
    }

    const agentConfig = AGENT_REGISTRY[agentId];
    if (!agentConfig) {
      return res.status(404).json({
        error: 'Agent not found',
        message: `No agent with id "${agentId}"`,
        availableAgents: Object.keys(AGENT_REGISTRY),
      });
    }

    const parseResult = PhaseChatInputSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        error: 'Validation error',
        details: parseResult.error.errors,
      });
    }

    const { query, context, conversationId } = parseResult.data;
    const newConversationId = conversationId || `conv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // TODO: Execute specific agent with AI provider
    res.json({
      stage,
      stageDescription: STAGE_DESCRIPTIONS[stage],
      agentUsed: agentId,
      conversationId: newConversationId,
      response: {
        content: `[Specific Agent: ${agentConfig.name}]\n\nProcessing your request:\n"${query.substring(0, 200)}${query.length > 200 ? '...' : ''}"\n\n*This is a placeholder response. Connect to AI provider for real assistance.*`,
        metadata: {
          modelTier: agentConfig.modelTier,
          phiScanRequired: agentConfig.phiScanRequired,
          tokensUsed: 0,
          processingTimeMs: 0,
        },
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/phase/registry
 * Get full agent registry
 */
router.get('/registry', async (_req: Request, res: Response) => {
  res.json({
    agents: Object.values(AGENT_REGISTRY).map((a) => ({
      id: a.id,
      name: a.name,
      description: a.description,
      modelTier: a.modelTier,
    })),
    stageMappings: STAGE_TO_AGENTS,
    stageDescriptions: STAGE_DESCRIPTIONS,
  });
});

export default router;
