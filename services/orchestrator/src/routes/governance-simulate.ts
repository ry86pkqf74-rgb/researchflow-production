/**
 * Governance Mode Simulation Routes
 *
 * Provides endpoints for testing governance mode transitions
 * and validating mode-specific behaviors without affecting production state.
 *
 * Tasks: 99 (Governance Mode Simulators for Transitions)
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { logAction } from '../services/auditService.js';

const router = Router();

/**
 * Governance modes
 */
type GovernanceMode = 'DEMO' | 'LIVE' | 'STANDBY';

/**
 * Simulation scenario definition
 */
interface SimulationScenario {
  id: string;
  name: string;
  description: string;
  actions: SimulationAction[];
}

/**
 * Action to simulate
 */
interface SimulationAction {
  type: 'upload' | 'export' | 'ai_call' | 'phi_access' | 'policy_edit' | 'mode_change';
  params?: Record<string, unknown>;
  expectedResult: 'allowed' | 'blocked' | 'requires_approval';
}

/**
 * Simulation result
 */
interface SimulationResult {
  scenarioId: string;
  mode: GovernanceMode;
  passed: boolean;
  results: Array<{
    action: SimulationAction;
    actualResult: 'allowed' | 'blocked' | 'requires_approval';
    passed: boolean;
    reason?: string;
  }>;
  summary: {
    total: number;
    passed: number;
    failed: number;
  };
}

/**
 * Mode-specific permissions matrix
 */
const MODE_PERMISSIONS: Record<GovernanceMode, Record<SimulationAction['type'], 'allowed' | 'blocked' | 'requires_approval'>> = {
  DEMO: {
    upload: 'allowed',
    export: 'blocked', // No exports in DEMO
    ai_call: 'allowed', // Mocked AI calls
    phi_access: 'blocked', // No PHI in DEMO
    policy_edit: 'allowed', // Can edit policies
    mode_change: 'allowed', // Can change modes
  },
  LIVE: {
    upload: 'allowed',
    export: 'requires_approval', // Requires steward approval
    ai_call: 'allowed',
    phi_access: 'requires_approval', // Audited PHI access
    policy_edit: 'requires_approval', // Steward approval
    mode_change: 'requires_approval', // Admin approval
  },
  STANDBY: {
    upload: 'blocked', // Read-only
    export: 'blocked', // No exports
    ai_call: 'blocked', // No AI
    phi_access: 'blocked', // No access
    policy_edit: 'blocked', // No changes
    mode_change: 'requires_approval', // Admin only
  },
};

/**
 * Built-in simulation scenarios
 */
const BUILT_IN_SCENARIOS: SimulationScenario[] = [
  {
    id: 'demo-mode-basic',
    name: 'DEMO Mode Basic Operations',
    description: 'Validates basic operations in DEMO mode',
    actions: [
      { type: 'upload', expectedResult: 'allowed' },
      { type: 'ai_call', expectedResult: 'allowed' },
      { type: 'export', expectedResult: 'blocked' },
      { type: 'phi_access', expectedResult: 'blocked' },
    ],
  },
  {
    id: 'live-mode-workflow',
    name: 'LIVE Mode Research Workflow',
    description: 'Validates typical research workflow in LIVE mode',
    actions: [
      { type: 'upload', expectedResult: 'allowed' },
      { type: 'ai_call', expectedResult: 'allowed' },
      { type: 'phi_access', expectedResult: 'requires_approval' },
      { type: 'export', expectedResult: 'requires_approval' },
    ],
  },
  {
    id: 'standby-mode-lockdown',
    name: 'STANDBY Mode Lockdown',
    description: 'Validates all write operations blocked in STANDBY',
    actions: [
      { type: 'upload', expectedResult: 'blocked' },
      { type: 'ai_call', expectedResult: 'blocked' },
      { type: 'export', expectedResult: 'blocked' },
      { type: 'phi_access', expectedResult: 'blocked' },
      { type: 'policy_edit', expectedResult: 'blocked' },
    ],
  },
  {
    id: 'mode-transition-demo-to-live',
    name: 'DEMO to LIVE Transition',
    description: 'Validates permission changes when transitioning from DEMO to LIVE',
    actions: [
      { type: 'mode_change', params: { from: 'DEMO', to: 'LIVE' }, expectedResult: 'allowed' },
    ],
  },
  {
    id: 'phi-protection-demo',
    name: 'PHI Protection in DEMO',
    description: 'Ensures PHI is never accessible in DEMO mode',
    actions: [
      { type: 'phi_access', params: { reason: 'analysis' }, expectedResult: 'blocked' },
      { type: 'export', params: { includeData: true }, expectedResult: 'blocked' },
    ],
  },
];

// Request schemas
const SimulateRequestSchema = z.object({
  mode: z.enum(['DEMO', 'LIVE', 'STANDBY']),
  scenarioId: z.string().optional(),
  customScenario: z.object({
    name: z.string(),
    description: z.string().optional(),
    actions: z.array(z.object({
      type: z.enum(['upload', 'export', 'ai_call', 'phi_access', 'policy_edit', 'mode_change']),
      params: z.record(z.unknown()).optional(),
      expectedResult: z.enum(['allowed', 'blocked', 'requires_approval']),
    })),
  }).optional(),
});

/**
 * Run a simulation scenario
 */
function runSimulation(mode: GovernanceMode, scenario: SimulationScenario): SimulationResult {
  const results: SimulationResult['results'] = [];
  const permissions = MODE_PERMISSIONS[mode];

  for (const action of scenario.actions) {
    // Handle mode change actions specially
    if (action.type === 'mode_change' && action.params) {
      const fromMode = action.params.from as GovernanceMode;
      const toMode = action.params.to as GovernanceMode;

      // Mode change rules:
      // DEMO -> LIVE: allowed (admin approval in production)
      // LIVE -> DEMO: allowed
      // * -> STANDBY: requires_approval
      // STANDBY -> *: requires_approval
      let actualResult: 'allowed' | 'blocked' | 'requires_approval';

      if (toMode === 'STANDBY' || fromMode === 'STANDBY') {
        actualResult = 'requires_approval';
      } else {
        actualResult = 'allowed';
      }

      results.push({
        action,
        actualResult,
        passed: actualResult === action.expectedResult,
        reason: `Mode transition ${fromMode} -> ${toMode}: ${actualResult}`,
      });
    } else {
      const actualResult = permissions[action.type];
      results.push({
        action,
        actualResult,
        passed: actualResult === action.expectedResult,
        reason: `Action ${action.type} in ${mode} mode: ${actualResult}`,
      });
    }
  }

  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;

  return {
    scenarioId: scenario.id,
    mode,
    passed: failed === 0,
    results,
    summary: {
      total: results.length,
      passed,
      failed,
    },
  };
}

/**
 * POST /api/governance/simulate
 *
 * Run a governance mode simulation
 */
router.post('/simulate', async (req: Request, res: Response) => {
  try {
    // Check role (ADMIN in LIVE, anyone in DEMO)
    const user = (req as any).user;
    const currentMode = process.env.GOVERNANCE_MODE || 'DEMO';

    if (currentMode === 'LIVE' && (!user || user.role !== 'ADMIN')) {
      return res.status(403).json({
        success: false,
        error: 'Simulation in LIVE mode requires ADMIN role',
      });
    }

    const parseResult = SimulateRequestSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        success: false,
        error: 'Invalid request body',
        details: parseResult.error.errors,
      });
    }

    const { mode, scenarioId, customScenario } = parseResult.data;

    // Get scenario
    let scenario: SimulationScenario;

    if (customScenario) {
      scenario = {
        id: 'custom',
        name: customScenario.name,
        description: customScenario.description || 'Custom simulation scenario',
        actions: customScenario.actions,
      };
    } else if (scenarioId) {
      const builtIn = BUILT_IN_SCENARIOS.find((s) => s.id === scenarioId);
      if (!builtIn) {
        return res.status(400).json({
          success: false,
          error: `Unknown scenario: ${scenarioId}`,
          availableScenarios: BUILT_IN_SCENARIOS.map((s) => ({ id: s.id, name: s.name })),
        });
      }
      scenario = builtIn;
    } else {
      return res.status(400).json({
        success: false,
        error: 'Either scenarioId or customScenario is required',
      });
    }

    // Run simulation
    const result = runSimulation(mode, scenario);

    // Log simulation
    await logAction({
      action: 'GOVERNANCE_SIMULATION',
      userId: user?.id || 'anonymous',
      resourceType: 'governance',
      resourceId: scenario.id,
      details: {
        mode,
        scenarioId: scenario.id,
        passed: result.passed,
        summary: result.summary,
      },
    });

    return res.json({
      success: true,
      result,
    });
  } catch (error) {
    console.error('Governance simulation error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error during simulation',
    });
  }
});

/**
 * GET /api/governance/simulate/scenarios
 *
 * List available simulation scenarios
 */
router.get('/simulate/scenarios', async (req: Request, res: Response) => {
  return res.json({
    success: true,
    scenarios: BUILT_IN_SCENARIOS.map((s) => ({
      id: s.id,
      name: s.name,
      description: s.description,
      actionCount: s.actions.length,
    })),
  });
});

/**
 * GET /api/governance/simulate/permissions
 *
 * Get the permission matrix for all modes
 */
router.get('/simulate/permissions', async (req: Request, res: Response) => {
  return res.json({
    success: true,
    permissions: MODE_PERMISSIONS,
  });
});

/**
 * POST /api/governance/simulate/batch
 *
 * Run multiple scenarios at once
 */
router.post('/simulate/batch', async (req: Request, res: Response) => {
  try {
    const { modes, scenarioIds } = req.body;

    if (!Array.isArray(modes) || !Array.isArray(scenarioIds)) {
      return res.status(400).json({
        success: false,
        error: 'modes and scenarioIds must be arrays',
      });
    }

    const results: SimulationResult[] = [];

    for (const mode of modes as GovernanceMode[]) {
      for (const scenarioId of scenarioIds) {
        const scenario = BUILT_IN_SCENARIOS.find((s) => s.id === scenarioId);
        if (scenario) {
          results.push(runSimulation(mode, scenario));
        }
      }
    }

    const totalPassed = results.filter((r) => r.passed).length;
    const totalFailed = results.filter((r) => !r.passed).length;

    return res.json({
      success: true,
      results,
      summary: {
        totalScenarios: results.length,
        passed: totalPassed,
        failed: totalFailed,
        passRate: results.length > 0 ? (totalPassed / results.length) * 100 : 0,
      },
    });
  } catch (error) {
    console.error('Batch simulation error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error during batch simulation',
    });
  }
});

export default router;
