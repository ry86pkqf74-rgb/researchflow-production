/**
 * Task Board Routes (Task 88)
 * Kanban-style task management API endpoints
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import * as taskBoardService from '../services/taskBoardService';

const router = Router();

// ---------------------------------------------------------------------------
// Board Routes
// ---------------------------------------------------------------------------

/**
 * POST /api/research/:researchId/boards
 * Create a new task board
 */
router.post('/research/:researchId/boards', async (req: Request, res: Response) => {
  try {
    const { researchId } = req.params;
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { name, description } = z.object({
      name: z.string().min(1).max(100),
      description: z.string().max(500).optional(),
    }).parse(req.body);

    const board = taskBoardService.createBoard(researchId, name, userId, description);
    return res.status(201).json(board);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    console.error('Create board error:', error);
    return res.status(500).json({ error: 'Failed to create board' });
  }
});

/**
 * GET /api/research/:researchId/boards
 * List boards for a research project
 */
router.get('/research/:researchId/boards', async (req: Request, res: Response) => {
  try {
    const { researchId } = req.params;
    const boards = taskBoardService.getBoardsByResearch(researchId);
    return res.json({ boards });
  } catch (error) {
    console.error('List boards error:', error);
    return res.status(500).json({ error: 'Failed to list boards' });
  }
});

/**
 * GET /api/boards/:boardId
 * Get board details with full view data
 */
router.get('/boards/:boardId', async (req: Request, res: Response) => {
  try {
    const { boardId } = req.params;
    const viewData = taskBoardService.getBoardViewData(boardId);

    if (!viewData) {
      return res.status(404).json({ error: 'Board not found' });
    }

    return res.json(viewData);
  } catch (error) {
    console.error('Get board error:', error);
    return res.status(500).json({ error: 'Failed to get board' });
  }
});

/**
 * PATCH /api/boards/:boardId
 * Update board settings
 */
router.patch('/boards/:boardId', async (req: Request, res: Response) => {
  try {
    const { boardId } = req.params;

    const updates = z.object({
      name: z.string().min(1).max(100).optional(),
      description: z.string().max(500).optional(),
      columns: z.array(taskBoardService.TaskStatusSchema).optional(),
    }).parse(req.body);

    const board = taskBoardService.updateBoard(boardId, updates);

    if (!board) {
      return res.status(404).json({ error: 'Board not found' });
    }

    return res.json(board);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    console.error('Update board error:', error);
    return res.status(500).json({ error: 'Failed to update board' });
  }
});

/**
 * DELETE /api/boards/:boardId
 * Archive a board
 */
router.delete('/boards/:boardId', async (req: Request, res: Response) => {
  try {
    const { boardId } = req.params;
    const success = taskBoardService.archiveBoard(boardId);

    if (!success) {
      return res.status(404).json({ error: 'Board not found' });
    }

    return res.status(204).send();
  } catch (error) {
    console.error('Archive board error:', error);
    return res.status(500).json({ error: 'Failed to archive board' });
  }
});

/**
 * GET /api/boards/:boardId/analytics
 * Get board analytics
 */
router.get('/boards/:boardId/analytics', async (req: Request, res: Response) => {
  try {
    const { boardId } = req.params;
    const board = taskBoardService.getBoard(boardId);

    if (!board) {
      return res.status(404).json({ error: 'Board not found' });
    }

    const analytics = taskBoardService.getBoardAnalytics(boardId);
    return res.json(analytics);
  } catch (error) {
    console.error('Get analytics error:', error);
    return res.status(500).json({ error: 'Failed to get analytics' });
  }
});

// ---------------------------------------------------------------------------
// Task Routes
// ---------------------------------------------------------------------------

/**
 * POST /api/boards/:boardId/tasks
 * Create a new task
 */
router.post('/boards/:boardId/tasks', async (req: Request, res: Response) => {
  try {
    const { boardId } = req.params;
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const input = taskBoardService.CreateTaskSchema.parse({
      ...req.body,
      boardId,
    });

    const task = taskBoardService.createTask(input, userId);
    return res.status(201).json(task);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    if (error instanceof Error && error.message.includes('PHI')) {
      return res.status(400).json({ error: error.message });
    }
    console.error('Create task error:', error);
    return res.status(500).json({ error: 'Failed to create task' });
  }
});

/**
 * GET /api/boards/:boardId/tasks
 * List tasks for a board
 */
router.get('/boards/:boardId/tasks', async (req: Request, res: Response) => {
  try {
    const { boardId } = req.params;
    const { status, assignee } = req.query;

    let tasks = taskBoardService.getTasksByBoard(boardId);

    if (status && typeof status === 'string') {
      tasks = tasks.filter(t => t.status === status);
    }

    if (assignee && typeof assignee === 'string') {
      tasks = tasks.filter(t => t.assigneeId === assignee);
    }

    return res.json({ tasks });
  } catch (error) {
    console.error('List tasks error:', error);
    return res.status(500).json({ error: 'Failed to list tasks' });
  }
});

/**
 * GET /api/tasks/:taskId
 * Get task details
 */
router.get('/tasks/:taskId', async (req: Request, res: Response) => {
  try {
    const { taskId } = req.params;
    const task = taskBoardService.getTask(taskId);

    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    const history = taskBoardService.getTaskHistory(taskId);
    return res.json({ task, history });
  } catch (error) {
    console.error('Get task error:', error);
    return res.status(500).json({ error: 'Failed to get task' });
  }
});

/**
 * PATCH /api/tasks/:taskId
 * Update task
 */
router.patch('/tasks/:taskId', async (req: Request, res: Response) => {
  try {
    const { taskId } = req.params;
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const input = taskBoardService.UpdateTaskSchema.parse(req.body);
    const task = taskBoardService.updateTask(taskId, input, userId);

    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    return res.json(task);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    if (error instanceof Error && error.message.includes('PHI')) {
      return res.status(400).json({ error: error.message });
    }
    console.error('Update task error:', error);
    return res.status(500).json({ error: 'Failed to update task' });
  }
});

/**
 * POST /api/tasks/:taskId/move
 * Move task to different column/position
 */
router.post('/tasks/:taskId/move', async (req: Request, res: Response) => {
  try {
    const { taskId } = req.params;
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const input = taskBoardService.MoveTaskSchema.parse(req.body);
    const task = taskBoardService.moveTask(taskId, input, userId);

    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    return res.json(task);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    console.error('Move task error:', error);
    return res.status(500).json({ error: 'Failed to move task' });
  }
});

/**
 * DELETE /api/tasks/:taskId
 * Delete task
 */
router.delete('/tasks/:taskId', async (req: Request, res: Response) => {
  try {
    const { taskId } = req.params;
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const success = taskBoardService.deleteTask(taskId, userId);

    if (!success) {
      return res.status(404).json({ error: 'Task not found' });
    }

    return res.status(204).send();
  } catch (error) {
    console.error('Delete task error:', error);
    return res.status(500).json({ error: 'Failed to delete task' });
  }
});

/**
 * GET /api/tasks/by-artifact/:artifactId
 * Get tasks linked to an artifact
 */
router.get('/tasks/by-artifact/:artifactId', async (req: Request, res: Response) => {
  try {
    const { artifactId } = req.params;
    const tasks = taskBoardService.getTasksByArtifact(artifactId);
    return res.json({ tasks });
  } catch (error) {
    console.error('Get tasks by artifact error:', error);
    return res.status(500).json({ error: 'Failed to get tasks' });
  }
});

// ---------------------------------------------------------------------------
// Label Routes
// ---------------------------------------------------------------------------

/**
 * POST /api/boards/:boardId/labels
 * Create a label
 */
router.post('/boards/:boardId/labels', async (req: Request, res: Response) => {
  try {
    const { boardId } = req.params;

    const { name, color } = z.object({
      name: z.string().max(50),
      color: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
    }).parse(req.body);

    const label = taskBoardService.createLabel(boardId, name, color);
    return res.status(201).json(label);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    console.error('Create label error:', error);
    return res.status(500).json({ error: 'Failed to create label' });
  }
});

/**
 * GET /api/boards/:boardId/labels
 * List labels for a board
 */
router.get('/boards/:boardId/labels', async (req: Request, res: Response) => {
  try {
    const { boardId } = req.params;
    const labels = taskBoardService.getLabelsByBoard(boardId);
    return res.json({ labels });
  } catch (error) {
    console.error('List labels error:', error);
    return res.status(500).json({ error: 'Failed to list labels' });
  }
});

/**
 * DELETE /api/labels/:labelId
 * Delete a label
 */
router.delete('/labels/:labelId', async (req: Request, res: Response) => {
  try {
    const { labelId } = req.params;
    const success = taskBoardService.deleteLabel(labelId);

    if (!success) {
      return res.status(404).json({ error: 'Label not found' });
    }

    return res.status(204).send();
  } catch (error) {
    console.error('Delete label error:', error);
    return res.status(500).json({ error: 'Failed to delete label' });
  }
});

export default router;
