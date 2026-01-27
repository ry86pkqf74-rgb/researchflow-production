/**
 * Guidelines API Routes
 *
 * REST endpoints for the Guidelines Engine.
 */

import { Router, Request, Response, NextFunction } from 'express';
import { Pool } from 'pg';
import { GuidelinesRepository } from '../repositories/guidelines.repository';
import { GuidelinesService } from '../services/guidelines.service';
import {
  SearchSystemCardsRequest,
  CalculateScoreRequest,
  GenerateBlueprintRequest,
  CompareVersionsRequest,
} from '../types/guidelines';

// Create router
const router = Router();

// Initialize repository and service (pool will be injected)
let repository: GuidelinesRepository;
let service: GuidelinesService;

/**
 * Initialize the guidelines routes with a database pool
 */
export function initializeGuidelinesRoutes(pool: Pool): void {
  repository = new GuidelinesRepository(pool);
  service = new GuidelinesService(repository);
}

// =============================================================================
// SYSTEM CARDS
// =============================================================================

/**
 * Search system cards
 * GET /api/guidelines/search
 */
router.get('/search', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const params: SearchSystemCardsRequest = {
      query: req.query.query as string,
      type: req.query.type as SearchSystemCardsRequest['type'],
      specialty: req.query.specialty as string,
      intendedUse: req.query.intendedUse as SearchSystemCardsRequest['intendedUse'],
      status: req.query.status as SearchSystemCardsRequest['status'],
      verified: req.query.verified === 'true' ? true : req.query.verified === 'false' ? false : undefined,
      limit: req.query.limit ? parseInt(req.query.limit as string, 10) : undefined,
      offset: req.query.offset ? parseInt(req.query.offset as string, 10) : undefined,
    };

    const result = await repository.searchSystemCards(params);
    res.json({
      ...result,
      limit: params.limit || 50,
      offset: params.offset || 0,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Get system card by ID with full details
 * GET /api/guidelines/:id
 */
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const details = await service.getSystemCardWithDetails(req.params.id);
    if (!details) {
      return res.status(404).json({ error: 'System card not found' });
    }
    res.json(details);
  } catch (error) {
    next(error);
  }
});

/**
 * Get system card by name
 * GET /api/guidelines/by-name/:name
 */
router.get('/by-name/:name', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const systemCard = await service.getSystemCardByName(req.params.name);
    if (!systemCard) {
      return res.status(404).json({ error: 'System card not found' });
    }

    const details = await service.getSystemCardWithDetails(systemCard.id);
    res.json(details);
  } catch (error) {
    next(error);
  }
});

/**
 * Get version history for a system card
 * GET /api/guidelines/:id/versions
 */
router.get('/:id/versions', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const versions = await repository.getVersionHistory(req.params.id);
    res.json({ versions });
  } catch (error) {
    next(error);
  }
});

/**
 * Get evidence statements for a system card
 * GET /api/guidelines/:id/evidence
 */
router.get('/:id/evidence', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const evidence = await repository.getEvidenceForSystemCard(req.params.id);
    res.json({ evidence });
  } catch (error) {
    next(error);
  }
});

/**
 * Get rule specs for a system card
 * GET /api/guidelines/:id/rules
 */
router.get('/:id/rules', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const rules = await repository.getRuleSpecsForSystemCard(req.params.id);
    res.json({ rules });
  } catch (error) {
    next(error);
  }
});

// =============================================================================
// CALCULATIONS
// =============================================================================

/**
 * Calculate score/stage using a system card's rules
 * POST /api/guidelines/calculate
 */
router.post('/calculate', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const request: CalculateScoreRequest = {
      systemCardId: req.body.systemCardId,
      inputs: req.body.inputs,
      context: req.body.context,
    };

    if (!request.systemCardId) {
      return res.status(400).json({ error: 'systemCardId is required' });
    }
    if (!request.inputs || typeof request.inputs !== 'object') {
      return res.status(400).json({ error: 'inputs object is required' });
    }

    // Get user ID from auth context if available
    const userId = (req as any).user?.id;

    const result = await service.calculateScore(request, userId);
    res.json(result);
  } catch (error: any) {
    if (error.message.includes('not found') || error.message.includes('Missing required')) {
      return res.status(400).json({ error: error.message });
    }
    next(error);
  }
});

/**
 * Get calculation history for a system card
 * GET /api/guidelines/:id/calculations
 */
router.get('/:id/calculations', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.query.userId as string;
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 100;

    const history = await repository.getCalculatorHistory(req.params.id, userId, limit);
    res.json({ calculations: history });
  } catch (error) {
    next(error);
  }
});

// =============================================================================
// VERSION COMPARISON
// =============================================================================

/**
 * Compare two versions of a system card
 * POST /api/guidelines/compare
 */
router.post('/compare', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const request: CompareVersionsRequest = {
      systemCardIdA: req.body.systemCardIdA,
      systemCardIdB: req.body.systemCardIdB,
    };

    if (!request.systemCardIdA || !request.systemCardIdB) {
      return res.status(400).json({ error: 'Both systemCardIdA and systemCardIdB are required' });
    }

    const comparison = await service.compareVersions(request);
    res.json(comparison);
  } catch (error: any) {
    if (error.message.includes('not found')) {
      return res.status(404).json({ error: error.message });
    }
    next(error);
  }
});

// =============================================================================
// SUMMARIZATION
// =============================================================================

/**
 * Get a summary of a guideline/scoring system
 * POST /api/guidelines/:id/summarize
 */
router.post('/:id/summarize', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { query } = req.body;
    const summary = await service.summarizeGuideline(req.params.id, query);
    res.json({ summary });
  } catch (error: any) {
    if (error.message.includes('not found')) {
      return res.status(404).json({ error: error.message });
    }
    next(error);
  }
});

// =============================================================================
// VALIDATION BLUEPRINTS
// =============================================================================

/**
 * Generate a validation blueprint for a scoring system
 * POST /api/guidelines/ideate
 */
router.post('/ideate', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const request: GenerateBlueprintRequest = {
      systemCardId: req.body.systemCardId,
      studyIntent: req.body.studyIntent,
      additionalContext: req.body.additionalContext,
      targetPopulation: req.body.targetPopulation,
      availableData: req.body.availableData,
    };

    if (!request.systemCardId) {
      return res.status(400).json({ error: 'systemCardId is required' });
    }
    if (!request.studyIntent) {
      return res.status(400).json({ error: 'studyIntent is required' });
    }

    // Get user ID from auth context
    const userId = (req as any).user?.id || 'anonymous';

    const blueprint = await service.generateValidationBlueprint(request, userId);
    res.json(blueprint);
  } catch (error: any) {
    if (error.message.includes('not found')) {
      return res.status(404).json({ error: error.message });
    }
    next(error);
  }
});

/**
 * Get user's validation blueprints
 * GET /api/guidelines/blueprints/mine
 */
router.get('/blueprints/mine', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const blueprints = await repository.listBlueprintsForUser(userId);
    res.json({ blueprints });
  } catch (error) {
    next(error);
  }
});

/**
 * Get blueprints for a system card
 * GET /api/guidelines/:id/blueprints
 */
router.get('/:id/blueprints', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const blueprints = await repository.listBlueprintsForSystemCard(req.params.id);
    res.json({ blueprints });
  } catch (error) {
    next(error);
  }
});

/**
 * Get a specific blueprint
 * GET /api/guidelines/blueprints/:blueprintId
 */
router.get('/blueprints/:blueprintId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const blueprint = await repository.getValidationBlueprint(req.params.blueprintId);
    if (!blueprint) {
      return res.status(404).json({ error: 'Blueprint not found' });
    }
    res.json(blueprint);
  } catch (error) {
    next(error);
  }
});

/**
 * Update a blueprint
 * PATCH /api/guidelines/blueprints/:blueprintId
 */
router.patch('/blueprints/:blueprintId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const updated = await repository.updateValidationBlueprint(req.params.blueprintId, req.body);
    if (!updated) {
      return res.status(404).json({ error: 'Blueprint not found' });
    }
    res.json(updated);
  } catch (error) {
    next(error);
  }
});

/**
 * Export blueprint to manuscript format
 * POST /api/guidelines/blueprints/:blueprintId/export
 */
router.post(
  '/blueprints/:blueprintId/export',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const blueprint = await repository.getValidationBlueprint(req.params.blueprintId);
      if (!blueprint) {
        return res.status(404).json({ error: 'Blueprint not found' });
      }

      // Generate manuscript sections from blueprint
      const sections = {
        methods: generateMethodsSection(blueprint),
        limitations: blueprint.limitations?.join('\n') || '',
        reportingChecklist: blueprint.reportingChecklist.join(', '),
      };

      res.json({ sections, blueprint });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * Generate methods section from blueprint
 */
function generateMethodsSection(blueprint: any): string {
  let methods = '## Methods\n\n';

  // Study Design
  methods += '### Study Design\n';
  methods += `This study is a ${blueprint.studyIntent.replace(/_/g, ' ')} study.\n\n`;

  if (blueprint.researchAims.length > 0) {
    methods += '**Aims:**\n';
    blueprint.researchAims.forEach((aim: string, i: number) => {
      methods += `${i + 1}. ${aim}\n`;
    });
    methods += '\n';
  }

  // Participants
  methods += '### Participants\n';
  if (blueprint.inclusionCriteria.length > 0) {
    methods += '**Inclusion Criteria:**\n';
    blueprint.inclusionCriteria.forEach((c: string) => {
      methods += `- ${c}\n`;
    });
    methods += '\n';
  }
  if (blueprint.exclusionCriteria.length > 0) {
    methods += '**Exclusion Criteria:**\n';
    blueprint.exclusionCriteria.forEach((c: string) => {
      methods += `- ${c}\n`;
    });
    methods += '\n';
  }

  // Variables
  methods += '### Variables\n';
  if (blueprint.dataDictionary.length > 0) {
    blueprint.dataDictionary.forEach((v: any) => {
      methods += `- **${v.variable}** (${v.type}): ${v.description || 'No description'}\n`;
    });
    methods += '\n';
  }

  // Statistical Analysis
  methods += '### Statistical Analysis\n';
  if (blueprint.analysisPlan.length > 0) {
    blueprint.analysisPlan.forEach((a: any) => {
      methods += `**${a.method}:** ${a.rationale}\n`;
    });
    methods += '\n';
  }

  return methods;
}

// =============================================================================
// ADMIN ENDPOINTS (for seeding/management)
// =============================================================================

/**
 * Create a new system card (admin)
 * POST /api/guidelines/admin/system-cards
 */
router.post('/admin/system-cards', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const systemCard = await repository.createSystemCard(req.body);
    res.status(201).json(systemCard);
  } catch (error) {
    next(error);
  }
});

/**
 * Create a rule spec for a system card (admin)
 * POST /api/guidelines/admin/rule-specs
 */
router.post('/admin/rule-specs', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const ruleSpec = await repository.createRuleSpec(req.body);
    res.status(201).json(ruleSpec);
  } catch (error) {
    next(error);
  }
});

/**
 * Create evidence statement (admin)
 * POST /api/guidelines/admin/evidence
 */
router.post('/admin/evidence', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const evidence = await repository.createEvidenceStatement(req.body);
    res.status(201).json(evidence);
  } catch (error) {
    next(error);
  }
});

export default router;
