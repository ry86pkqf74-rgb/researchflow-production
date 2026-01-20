/**
 * AI Router Routes (Tasks 64-68)
 *
 * Provides intelligent AI model routing with:
 * - Model tier selection based on task complexity and budget
 * - Cost estimation and budget tracking
 * - Governance mode aware routing (DEMO vs LIVE)
 * - PHI-compliant model selection
 */

import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { logAction } from '../services/audit-service';
import { requirePermission } from '../middleware/rbac';
import { asyncHandler } from '../middleware/asyncHandler';

const router = Router();

// Model tier definitions
const MODEL_TIERS = {
  economy: {
    id: 'economy',
    name: 'Economy',
    description: 'Fast and cost-effective for simple tasks',
    costPerInputToken: 0.0001,
    costPerOutputToken: 0.00015,
    maxTokens: 4096,
    latency: 'low',
    quality: 'good',
    capabilities: ['text_generation', 'basic_analysis', 'summarization'],
    phiCompliant: false,
    models: ['claude-3-haiku-20240307'],
  },
  standard: {
    id: 'standard',
    name: 'Standard',
    description: 'Balanced performance for most research tasks',
    costPerInputToken: 0.001,
    costPerOutputToken: 0.0015,
    maxTokens: 32768,
    latency: 'medium',
    quality: 'better',
    capabilities: ['advanced_analysis', 'code_generation', 'research_synthesis', 'citation_analysis'],
    phiCompliant: true,
    models: ['claude-3-5-sonnet-20241022'],
  },
  premium: {
    id: 'premium',
    name: 'Premium',
    description: 'Maximum capability for complex research',
    costPerInputToken: 0.01,
    costPerOutputToken: 0.015,
    maxTokens: 200000,
    latency: 'high',
    quality: 'best',
    capabilities: ['deep_analysis', 'multi_step_reasoning', 'creative_synthesis', 'phi_processing', 'long_context'],
    phiCompliant: true,
    models: ['claude-3-5-opus-20240620'],
  },
} as const;

type ModelTier = keyof typeof MODEL_TIERS;

// Task type to recommended tier mapping
const TASK_TIER_MAPPING: Record<string, { recommended: ModelTier; minimum: ModelTier }> = {
  hypothesis_generation: { recommended: 'standard', minimum: 'economy' },
  literature_search: { recommended: 'economy', minimum: 'economy' },
  data_analysis: { recommended: 'standard', minimum: 'standard' },
  statistical_analysis: { recommended: 'premium', minimum: 'standard' },
  manuscript_drafting: { recommended: 'standard', minimum: 'standard' },
  manuscript_revision: { recommended: 'standard', minimum: 'economy' },
  citation_formatting: { recommended: 'economy', minimum: 'economy' },
  phi_redaction: { recommended: 'premium', minimum: 'premium' },
  ethical_review: { recommended: 'premium', minimum: 'standard' },
  claim_verification: { recommended: 'standard', minimum: 'standard' },
  summarization: { recommended: 'economy', minimum: 'economy' },
  code_generation: { recommended: 'standard', minimum: 'economy' },
  figure_generation: { recommended: 'standard', minimum: 'standard' },
};

// Schemas
const RouteRequestSchema = z.object({
  taskType: z.string(),
  estimatedInputTokens: z.number().positive(),
  estimatedOutputTokens: z.number().positive().optional(),
  governanceMode: z.enum(['DEMO', 'LIVE']),
  preferredTier: z.enum(['economy', 'standard', 'premium']).optional(),
  budgetLimit: z.number().positive().optional(),
  requirePhiCompliance: z.boolean().optional(),
  stageId: z.number().int().positive().optional(),
});

const CostEstimateSchema = z.object({
  tier: z.enum(['economy', 'standard', 'premium']),
  inputTokens: z.number().positive(),
  outputTokens: z.number().positive(),
});

/**
 * GET /api/ai/router/tiers
 * Get available model tiers and their configurations
 */
router.get(
  '/tiers',
  asyncHandler(async (req: Request, res: Response) => {
    const { governanceMode } = req.query;

    let tiers = Object.values(MODEL_TIERS);

    // Filter by PHI compliance if in LIVE mode
    if (governanceMode === 'LIVE') {
      tiers = tiers.filter((tier) => tier.phiCompliant);
    }

    res.json({
      tiers: tiers.map((tier) => ({
        id: tier.id,
        name: tier.name,
        description: tier.description,
        costPerInputToken: tier.costPerInputToken,
        costPerOutputToken: tier.costPerOutputToken,
        maxTokens: tier.maxTokens,
        latency: tier.latency,
        quality: tier.quality,
        capabilities: tier.capabilities,
        phiCompliant: tier.phiCompliant,
      })),
      defaultTier: governanceMode === 'LIVE' ? 'standard' : 'economy',
    });
  })
);

/**
 * POST /api/ai/router/route
 * Get routing recommendation for a task
 */
router.post(
  '/route',
  requirePermission('ANALYZE'),
  asyncHandler(async (req: Request, res: Response) => {
    const user = req.user;

    if (!user) {
      return res.status(401).json({
        error: 'AUTHENTICATION_REQUIRED',
        message: 'Authentication required',
      });
    }

    const validation = RouteRequestSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: 'Invalid request body',
        details: validation.error.flatten(),
      });
    }

    const {
      taskType,
      estimatedInputTokens,
      estimatedOutputTokens = Math.round(estimatedInputTokens * 0.5),
      governanceMode,
      preferredTier,
      budgetLimit,
      requirePhiCompliance,
      stageId,
    } = validation.data;

    // Get task mapping or use defaults
    const taskMapping = TASK_TIER_MAPPING[taskType] || {
      recommended: 'standard',
      minimum: 'economy',
    };

    // Determine effective minimum tier based on requirements
    let effectiveMinimumTier: ModelTier = taskMapping.minimum;

    // PHI compliance requirement
    if (requirePhiCompliance || governanceMode === 'LIVE') {
      if (!MODEL_TIERS[effectiveMinimumTier].phiCompliant) {
        effectiveMinimumTier = 'standard';
      }
    }

    // Calculate costs for each tier
    const tierCosts: Record<ModelTier, { inputCost: number; outputCost: number; totalCost: number }> = {} as any;

    for (const [tierId, tier] of Object.entries(MODEL_TIERS)) {
      const inputCost = estimatedInputTokens * tier.costPerInputToken;
      const outputCost = estimatedOutputTokens * tier.costPerOutputToken;
      tierCosts[tierId as ModelTier] = {
        inputCost,
        outputCost,
        totalCost: inputCost + outputCost,
      };
    }

    // Select recommended tier
    let selectedTier: ModelTier = preferredTier || taskMapping.recommended;

    // Check budget constraint
    if (budgetLimit && tierCosts[selectedTier].totalCost > budgetLimit) {
      // Find the highest tier within budget
      const tiersInBudget = (['economy', 'standard', 'premium'] as ModelTier[])
        .filter((tier) => tierCosts[tier].totalCost <= budgetLimit)
        .filter((tier) => MODEL_TIERS[tier].phiCompliant || !requirePhiCompliance);

      if (tiersInBudget.length > 0) {
        selectedTier = tiersInBudget[tiersInBudget.length - 1];
      } else {
        return res.status(400).json({
          error: 'BUDGET_INSUFFICIENT',
          message: 'Budget is insufficient for any compliant model tier',
          lowestCost: tierCosts[effectiveMinimumTier].totalCost,
          budgetLimit,
        });
      }
    }

    // Ensure minimum tier requirements are met
    const tierOrder: ModelTier[] = ['economy', 'standard', 'premium'];
    const selectedTierIndex = tierOrder.indexOf(selectedTier);
    const minimumTierIndex = tierOrder.indexOf(effectiveMinimumTier);

    if (selectedTierIndex < minimumTierIndex) {
      selectedTier = effectiveMinimumTier;
    }

    const selectedTierConfig = MODEL_TIERS[selectedTier];

    // Log routing decision
    await logAction({
      eventType: 'AI_ROUTING',
      action: 'ROUTE_SELECTED',
      userId: user.id,
      resourceType: 'ai_router',
      resourceId: `route_${Date.now()}`,
      details: {
        taskType,
        selectedTier,
        governanceMode,
        estimatedCost: tierCosts[selectedTier].totalCost,
        stageId,
      },
    });

    res.json({
      selectedTier,
      model: selectedTierConfig.models[0],
      tierConfig: {
        name: selectedTierConfig.name,
        description: selectedTierConfig.description,
        maxTokens: selectedTierConfig.maxTokens,
        phiCompliant: selectedTierConfig.phiCompliant,
      },
      costEstimate: tierCosts[selectedTier],
      allTierCosts: tierCosts,
      recommendation: {
        taskType,
        recommendedTier: taskMapping.recommended,
        minimumTier: effectiveMinimumTier,
        reason: getRecommendationReason(taskType, selectedTier, taskMapping.recommended, governanceMode),
      },
      constraints: {
        budgetLimit,
        requirePhiCompliance,
        governanceMode,
      },
    });
  })
);

/**
 * POST /api/ai/router/estimate
 * Get cost estimate for a specific tier
 */
router.post(
  '/estimate',
  asyncHandler(async (req: Request, res: Response) => {
    const validation = CostEstimateSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: 'Invalid request body',
        details: validation.error.flatten(),
      });
    }

    const { tier, inputTokens, outputTokens } = validation.data;
    const tierConfig = MODEL_TIERS[tier];

    const inputCost = inputTokens * tierConfig.costPerInputToken;
    const outputCost = outputTokens * tierConfig.costPerOutputToken;

    res.json({
      tier,
      tokens: {
        input: inputTokens,
        output: outputTokens,
        total: inputTokens + outputTokens,
      },
      cost: {
        input: inputCost,
        output: outputCost,
        total: inputCost + outputCost,
      },
      rates: {
        inputPerToken: tierConfig.costPerInputToken,
        outputPerToken: tierConfig.costPerOutputToken,
      },
    });
  })
);

/**
 * GET /api/ai/router/task-types
 * Get supported task types and their tier mappings
 */
router.get(
  '/task-types',
  asyncHandler(async (req: Request, res: Response) => {
    res.json({
      taskTypes: Object.entries(TASK_TIER_MAPPING).map(([taskType, mapping]) => ({
        taskType,
        recommendedTier: mapping.recommended,
        minimumTier: mapping.minimum,
        description: getTaskTypeDescription(taskType),
      })),
    });
  })
);

/**
 * GET /api/ai/router/capabilities
 * Get capabilities by tier
 */
router.get(
  '/capabilities',
  asyncHandler(async (req: Request, res: Response) => {
    const allCapabilities = new Set<string>();
    const capabilityTiers: Record<string, ModelTier[]> = {};

    for (const [tierId, tier] of Object.entries(MODEL_TIERS)) {
      for (const capability of tier.capabilities) {
        allCapabilities.add(capability);
        if (!capabilityTiers[capability]) {
          capabilityTiers[capability] = [];
        }
        capabilityTiers[capability].push(tierId as ModelTier);
      }
    }

    res.json({
      capabilities: Array.from(allCapabilities).map((capability) => ({
        name: capability,
        availableIn: capabilityTiers[capability],
        minimumTier: capabilityTiers[capability][0],
      })),
    });
  })
);

// Helper functions
function getRecommendationReason(
  taskType: string,
  selectedTier: ModelTier,
  recommendedTier: ModelTier,
  governanceMode: string
): string {
  if (selectedTier === recommendedTier) {
    return `${MODEL_TIERS[selectedTier].name} tier is optimal for ${taskType.replace(/_/g, ' ')} tasks.`;
  }

  if (governanceMode === 'LIVE' && !MODEL_TIERS[recommendedTier].phiCompliant) {
    return `Upgraded to ${MODEL_TIERS[selectedTier].name} tier for PHI compliance in LIVE mode.`;
  }

  const tierOrder: ModelTier[] = ['economy', 'standard', 'premium'];
  if (tierOrder.indexOf(selectedTier) < tierOrder.indexOf(recommendedTier)) {
    return `Using ${MODEL_TIERS[selectedTier].name} tier due to budget constraints. Consider ${MODEL_TIERS[recommendedTier].name} for better results.`;
  }

  return `Using ${MODEL_TIERS[selectedTier].name} tier based on preference.`;
}

function getTaskTypeDescription(taskType: string): string {
  const descriptions: Record<string, string> = {
    hypothesis_generation: 'Generate and refine research hypotheses',
    literature_search: 'Search and analyze academic literature',
    data_analysis: 'Analyze research data and datasets',
    statistical_analysis: 'Perform statistical tests and analysis',
    manuscript_drafting: 'Draft manuscript sections',
    manuscript_revision: 'Revise and improve manuscript content',
    citation_formatting: 'Format and validate citations',
    phi_redaction: 'Detect and redact protected health information',
    ethical_review: 'Review content for ethical compliance',
    claim_verification: 'Verify research claims and statements',
    summarization: 'Summarize documents and content',
    code_generation: 'Generate analysis code and scripts',
    figure_generation: 'Generate data visualizations',
  };
  return descriptions[taskType] || 'General research task';
}

export default router;
