/**
 * Tutorial Sandbox Routes
 * Task 145 - Embed tutorial code sandboxes
 */

import { Router, Request, Response } from 'express';
import {
  listTutorials,
  getTutorial,
  getSnippet,
  getTutorialCategories,
  executeCode,
  getExecutionHistory,
  getUserProgress,
  getDemoDataset,
  listDemoDatasets,
} from '../services/tutorialSandboxService';

export const tutorialSandboxRouter = Router();

// ─────────────────────────────────────────────────────────────
// Tutorial Discovery
// ─────────────────────────────────────────────────────────────

/**
 * GET /api/tutorials/sandbox
 * List tutorials with sandbox support
 */
tutorialSandboxRouter.get('/', (req: Request, res: Response) => {
  try {
    const category = req.query.category as string | undefined;
    const difficulty = req.query.difficulty as string | undefined;

    const tutorials = listTutorials({ category, difficulty });

    // Return summary without full snippets
    const summaries = tutorials.map(t => ({
      id: t.id,
      title: t.title,
      description: t.description,
      category: t.category,
      difficulty: t.difficulty,
      estimatedMinutes: t.estimatedMinutes,
      prerequisites: t.prerequisites,
      snippetCount: t.snippets.length,
      languages: [...new Set(t.snippets.map(s => s.language))],
    }));

    res.json(summaries);
  } catch (error) {
    console.error('Error listing tutorials:', error);
    res.status(500).json({ error: 'Failed to list tutorials' });
  }
});

/**
 * GET /api/tutorials/sandbox/categories
 * List tutorial categories
 */
tutorialSandboxRouter.get('/categories', (_req: Request, res: Response) => {
  try {
    const categories = getTutorialCategories();
    res.json(categories);
  } catch (error) {
    console.error('Error listing categories:', error);
    res.status(500).json({ error: 'Failed to list categories' });
  }
});

/**
 * GET /api/tutorials/sandbox/:id
 * Get tutorial details with snippets
 */
tutorialSandboxRouter.get('/:id', (req: Request, res: Response) => {
  try {
    const tutorial = getTutorial(req.params.id);
    if (!tutorial) {
      return res.status(404).json({ error: 'Tutorial not found' });
    }
    res.json(tutorial);
  } catch (error) {
    console.error('Error getting tutorial:', error);
    res.status(500).json({ error: 'Failed to get tutorial' });
  }
});

/**
 * GET /api/tutorials/sandbox/:tutorialId/snippets/:snippetId
 * Get a specific snippet
 */
tutorialSandboxRouter.get('/:tutorialId/snippets/:snippetId', (req: Request, res: Response) => {
  try {
    const snippet = getSnippet(req.params.tutorialId, req.params.snippetId);
    if (!snippet) {
      return res.status(404).json({ error: 'Snippet not found' });
    }
    res.json(snippet);
  } catch (error) {
    console.error('Error getting snippet:', error);
    res.status(500).json({ error: 'Failed to get snippet' });
  }
});

// ─────────────────────────────────────────────────────────────
// Code Execution
// ─────────────────────────────────────────────────────────────

/**
 * POST /api/tutorials/sandbox/:tutorialId/snippets/:snippetId/execute
 * Execute code in sandbox
 */
tutorialSandboxRouter.post('/:tutorialId/snippets/:snippetId/execute', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId ?? 'demo-user';
    const { code } = req.body;

    if (!code) {
      return res.status(400).json({ error: 'Code is required' });
    }

    const result = await executeCode({
      tutorialId: req.params.tutorialId,
      snippetId: req.params.snippetId,
      code,
      userId,
    });

    res.json(result);
  } catch (error: any) {
    console.error('Error executing code:', error);
    res.status(400).json({ error: error.message ?? 'Execution failed' });
  }
});

// ─────────────────────────────────────────────────────────────
// Progress Tracking
// ─────────────────────────────────────────────────────────────

/**
 * GET /api/tutorials/sandbox/progress
 * Get user's overall progress
 */
tutorialSandboxRouter.get('/progress/me', (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId ?? 'demo-user';
    const progress = getUserProgress(userId);
    res.json(progress);
  } catch (error) {
    console.error('Error getting progress:', error);
    res.status(500).json({ error: 'Failed to get progress' });
  }
});

/**
 * GET /api/tutorials/sandbox/:id/progress
 * Get user's progress for a specific tutorial
 */
tutorialSandboxRouter.get('/:id/progress', (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId ?? 'demo-user';
    const progress = getUserProgress(userId, req.params.id);
    res.json(progress);
  } catch (error) {
    console.error('Error getting progress:', error);
    res.status(500).json({ error: 'Failed to get progress' });
  }
});

/**
 * GET /api/tutorials/sandbox/history
 * Get execution history
 */
tutorialSandboxRouter.get('/history/me', (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId ?? 'demo-user';
    const snippetId = req.query.snippetId as string | undefined;
    const limit = parseInt(req.query.limit as string) || 20;

    const history = getExecutionHistory(userId, { snippetId, limit });
    res.json(history);
  } catch (error) {
    console.error('Error getting history:', error);
    res.status(500).json({ error: 'Failed to get history' });
  }
});

// ─────────────────────────────────────────────────────────────
// Demo Data
// ─────────────────────────────────────────────────────────────

/**
 * GET /api/tutorials/sandbox/datasets
 * List available demo datasets
 */
tutorialSandboxRouter.get('/datasets/available', (_req: Request, res: Response) => {
  try {
    const datasets = listDemoDatasets();
    res.json(datasets);
  } catch (error) {
    console.error('Error listing datasets:', error);
    res.status(500).json({ error: 'Failed to list datasets' });
  }
});

/**
 * GET /api/tutorials/sandbox/datasets/:name
 * Get a demo dataset
 */
tutorialSandboxRouter.get('/datasets/:name', (req: Request, res: Response) => {
  try {
    const dataset = getDemoDataset(req.params.name);
    if (!dataset) {
      return res.status(404).json({ error: 'Dataset not found' });
    }
    res.json(dataset);
  } catch (error) {
    console.error('Error getting dataset:', error);
    res.status(500).json({ error: 'Failed to get dataset' });
  }
});

export default tutorialSandboxRouter;
