/**
 * Analysis Planning Routes
 *
 * API endpoints for analysis plan CRUD, approval, and execution.
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { planningService } from '../services/planning';
import { asyncHandler } from '../middleware/asyncHandler';

const router = Router();

// ===== VALIDATION SCHEMAS =====

const createPlanSchema = z.object({
  datasetId: z.string().min(1),
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  researchQuestion: z.string().min(10).max(2000),
  planType: z
    .enum(['statistical', 'exploratory', 'comparative', 'predictive'])
    .optional(),
  constraints: z
    .object({
      maxRows: z.number().positive().optional(),
      samplingRate: z.number().min(0).max(1).optional(),
      excludedColumns: z.array(z.string()).optional(),
      timeLimitSeconds: z.number().positive().optional(),
      requireApproval: z.boolean().optional(),
    })
    .optional(),
  projectId: z.string().optional(),
  datasetMetadata: z
    .object({
      name: z.string(),
      rowCount: z.number().optional(),
      columns: z.array(
        z.object({
          name: z.string(),
          type: z.string(),
          nullable: z.boolean().optional(),
          cardinality: z.number().optional(),
        })
      ),
    })
    .optional(),
});

const approvePlanSchema = z.object({
  approved: z.boolean(),
  reason: z.string().optional(),
});

const runPlanSchema = z.object({
  executionMode: z.enum(['full', 'dry_run']).optional(),
  configOverrides: z.record(z.any()).optional(),
});

// ===== MIDDLEWARE =====

// Conditional auth - requires auth in LIVE mode, allows anonymous in DEMO
function conditionalAuth(req: Request, res: Response, next: Function) {
  const mode = process.env.GOVERNANCE_MODE || 'DEMO';
  if (mode === 'DEMO') {
    // Set demo user if not authenticated
    if (!(req as any).user) {
      (req as any).user = { id: 'demo-user', role: 'ADMIN' };
    }
    return next();
  }
  // In LIVE mode, require auth
  if (!(req as any).user) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  next();
}

// Require specific roles
function requireRole(roles: string[]) {
  return (req: Request, res: Response, next: Function) => {
    const user = (req as any).user;
    if (!user || !roles.includes(user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    next();
  };
}

// ===== ROUTES =====

/**
 * POST /api/analysis/plans - Create new plan
 */
router.post(
  '/plans',
  conditionalAuth,
  asyncHandler(async (req: Request, res: Response) => {
    const body = createPlanSchema.parse(req.body);
    const userId = (req as any).user?.id || 'demo-user';

    const result = await planningService.createPlan(body, userId);

    res.status(201).json({
      plan: result.plan,
      job: result.job,
      phiWarning: result.phiWarning,
      message: 'Plan creation started. Poll job for status.',
    });
  })
);

/**
 * GET /api/analysis/plans - List user's plans
 */
router.get(
  '/plans',
  conditionalAuth,
  asyncHandler(async (req: Request, res: Response) => {
    const userId = (req as any).user?.id || 'demo-user';
    const projectId = req.query.projectId as string | undefined;

    const plans = await planningService.listPlans(userId, projectId);
    res.json({ plans });
  })
);

/**
 * GET /api/analysis/plans/:planId - Get plan details
 */
router.get(
  '/plans/:planId',
  conditionalAuth,
  asyncHandler(async (req: Request, res: Response) => {
    const plan = await planningService.getPlan(req.params.planId);
    if (!plan) {
      return res.status(404).json({ error: 'Plan not found' });
    }

    // Also get jobs and artifacts
    const jobs = await planningService.getJobsByPlan(req.params.planId);
    const artifacts = await planningService.getArtifacts({
      planId: req.params.planId,
    });

    res.json({ plan, jobs, artifacts });
  })
);

/**
 * POST /api/analysis/plans/:planId/approve - Approve or reject plan
 */
router.post(
  '/plans/:planId/approve',
  conditionalAuth,
  requireRole(['STEWARD', 'ADMIN']),
  asyncHandler(async (req: Request, res: Response) => {
    const body = approvePlanSchema.parse(req.body);
    const approverId = (req as any).user.id;

    let plan;
    if (body.approved) {
      plan = await planningService.approvePlan(req.params.planId, approverId);
    } else {
      plan = await planningService.rejectPlan(
        req.params.planId,
        body.reason || 'No reason provided'
      );
    }

    res.json({ plan, message: body.approved ? 'Plan approved' : 'Plan rejected' });
  })
);

/**
 * POST /api/analysis/plans/:planId/run - Run plan
 */
router.post(
  '/plans/:planId/run',
  conditionalAuth,
  asyncHandler(async (req: Request, res: Response) => {
    const body = runPlanSchema.parse(req.body);
    const userId = (req as any).user?.id || 'demo-user';

    const job = await planningService.runPlan(req.params.planId, userId, body);
    res.json({ job, message: 'Plan execution started' });
  })
);

/**
 * GET /api/jobs/:jobId - Get job status
 */
router.get(
  '/jobs/:jobId',
  conditionalAuth,
  asyncHandler(async (req: Request, res: Response) => {
    const job = await planningService.getJob(req.params.jobId);
    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    const events = await planningService.getJobEvents(req.params.jobId);
    res.json({ job, events });
  })
);

/**
 * GET /api/jobs/:jobId/events - SSE stream for job events
 */
router.get('/jobs/:jobId/events', conditionalAuth, async (req: Request, res: Response) => {
  const job = await planningService.getJob(req.params.jobId);
  if (!job) {
    return res.status(404).json({ error: 'Job not found' });
  }

  // Set SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');

  // Send initial status
  res.write(`data: ${JSON.stringify({ type: 'status', job })}\n\n`);

  let lastEventTime = new Date(0);

  // Poll for updates
  const interval = setInterval(async () => {
    try {
      const updatedJob = await planningService.getJob(req.params.jobId);
      const events = await planningService.getJobEvents(
        req.params.jobId,
        lastEventTime
      );

      if (events.length > 0) {
        lastEventTime = new Date(events[events.length - 1].timestamp);
      }

      res.write(
        `data: ${JSON.stringify({ type: 'update', job: updatedJob, events })}\n\n`
      );

      if (
        updatedJob?.status === 'completed' ||
        updatedJob?.status === 'failed' ||
        updatedJob?.status === 'cancelled'
      ) {
        clearInterval(interval);
        res.end();
      }
    } catch (err) {
      clearInterval(interval);
      res.end();
    }
  }, 2000);

  req.on('close', () => {
    clearInterval(interval);
  });
});

/**
 * GET /api/artifacts - List artifacts
 */
router.get(
  '/artifacts',
  conditionalAuth,
  asyncHandler(async (req: Request, res: Response) => {
    const { jobId, planId, type } = req.query;
    const artifacts = await planningService.getArtifacts({
      jobId: jobId as string,
      planId: planId as string,
      type: type as string,
    });
    res.json({ artifacts });
  })
);

export default router;
