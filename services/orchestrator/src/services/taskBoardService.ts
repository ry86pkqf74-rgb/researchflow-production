/**
 * Task Board Service (Task 88)
 * Kanban-style task management tied to research artifacts
 *
 * Security: No PHI in task titles/descriptions - validated on creation
 */

import { z } from 'zod';
import crypto from 'crypto';

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

export const TaskStatusSchema = z.enum([
  'BACKLOG',
  'TODO',
  'IN_PROGRESS',
  'IN_REVIEW',
  'BLOCKED',
  'DONE',
  'ARCHIVED'
]);
export type TaskStatus = z.infer<typeof TaskStatusSchema>;

export const TaskPrioritySchema = z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']);
export type TaskPriority = z.infer<typeof TaskPrioritySchema>;

export const TaskLabelSchema = z.object({
  id: z.string().uuid(),
  name: z.string().max(50),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
  boardId: z.string().uuid(),
});
export type TaskLabel = z.infer<typeof TaskLabelSchema>;

export const TaskSchema = z.object({
  id: z.string().uuid(),
  boardId: z.string().uuid(),
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  status: TaskStatusSchema,
  priority: TaskPrioritySchema,
  assigneeId: z.string().uuid().optional(),
  reporterId: z.string().uuid(),
  artifactIds: z.array(z.string().uuid()).default([]),
  labelIds: z.array(z.string().uuid()).default([]),
  dueDate: z.string().datetime().optional(),
  estimatedHours: z.number().min(0).max(1000).optional(),
  order: z.number().int().min(0),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  completedAt: z.string().datetime().optional(),
});
export type Task = z.infer<typeof TaskSchema>;

export const TaskBoardSchema = z.object({
  id: z.string().uuid(),
  researchId: z.string().uuid(),
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  columns: z.array(TaskStatusSchema).default(['BACKLOG', 'TODO', 'IN_PROGRESS', 'IN_REVIEW', 'DONE']),
  createdBy: z.string().uuid(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  isArchived: z.boolean().default(false),
});
export type TaskBoard = z.infer<typeof TaskBoardSchema>;

export const CreateTaskSchema = z.object({
  boardId: z.string().uuid(),
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  status: TaskStatusSchema.default('BACKLOG'),
  priority: TaskPrioritySchema.default('MEDIUM'),
  assigneeId: z.string().uuid().optional(),
  artifactIds: z.array(z.string().uuid()).optional(),
  labelIds: z.array(z.string().uuid()).optional(),
  dueDate: z.string().datetime().optional(),
  estimatedHours: z.number().min(0).max(1000).optional(),
});
export type CreateTaskInput = z.infer<typeof CreateTaskSchema>;

export const UpdateTaskSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).optional(),
  status: TaskStatusSchema.optional(),
  priority: TaskPrioritySchema.optional(),
  assigneeId: z.string().uuid().nullable().optional(),
  artifactIds: z.array(z.string().uuid()).optional(),
  labelIds: z.array(z.string().uuid()).optional(),
  dueDate: z.string().datetime().nullable().optional(),
  estimatedHours: z.number().min(0).max(1000).nullable().optional(),
  order: z.number().int().min(0).optional(),
});
export type UpdateTaskInput = z.infer<typeof UpdateTaskSchema>;

export const MoveTaskSchema = z.object({
  status: TaskStatusSchema,
  order: z.number().int().min(0),
});
export type MoveTaskInput = z.infer<typeof MoveTaskSchema>;

// ---------------------------------------------------------------------------
// PHI Detection (simple keyword-based - production would use ML)
// ---------------------------------------------------------------------------

const PHI_PATTERNS = [
  /\b\d{3}-\d{2}-\d{4}\b/,                    // SSN
  /\b\d{9}\b/,                                 // SSN without dashes
  /\b[A-Z]{1,2}\d{6,8}\b/i,                   // MRN patterns
  /\bMRN[:\s]?\d+/i,                          // Explicit MRN
  /\bpatient\s+(id|identifier)[:\s]?\w+/i,   // Patient ID
  /\bDOB[:\s]?\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}/i, // Date of birth
  /\b\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4}\b/,     // Date patterns (potential DOB)
];

function containsPHI(text: string): boolean {
  for (const pattern of PHI_PATTERNS) {
    if (pattern.test(text)) {
      return true;
    }
  }
  return false;
}

function validateNoPHI(title: string, description?: string): void {
  if (containsPHI(title)) {
    throw new Error('Task title may contain PHI. Please remove sensitive information.');
  }
  if (description && containsPHI(description)) {
    throw new Error('Task description may contain PHI. Please remove sensitive information.');
  }
}

// ---------------------------------------------------------------------------
// In-Memory Storage (would be database in production)
// ---------------------------------------------------------------------------

const boards = new Map<string, TaskBoard>();
const tasks = new Map<string, Task>();
const labels = new Map<string, TaskLabel>();
const taskHistory = new Map<string, Array<{ timestamp: string; action: string; userId: string; changes: Record<string, unknown> }>>();

// ---------------------------------------------------------------------------
// Board Operations
// ---------------------------------------------------------------------------

export function createBoard(
  researchId: string,
  name: string,
  createdBy: string,
  description?: string
): TaskBoard {
  const now = new Date().toISOString();
  const board: TaskBoard = {
    id: crypto.randomUUID(),
    researchId,
    name,
    description,
    columns: ['BACKLOG', 'TODO', 'IN_PROGRESS', 'IN_REVIEW', 'DONE'],
    createdBy,
    createdAt: now,
    updatedAt: now,
    isArchived: false,
  };

  boards.set(board.id, board);
  return board;
}

export function getBoard(boardId: string): TaskBoard | undefined {
  return boards.get(boardId);
}

export function getBoardsByResearch(researchId: string): TaskBoard[] {
  return Array.from(boards.values())
    .filter(b => b.researchId === researchId && !b.isArchived)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export function updateBoard(
  boardId: string,
  updates: Partial<Pick<TaskBoard, 'name' | 'description' | 'columns'>>
): TaskBoard | undefined {
  const board = boards.get(boardId);
  if (!board) return undefined;

  const updated = {
    ...board,
    ...updates,
    updatedAt: new Date().toISOString(),
  };

  boards.set(boardId, updated);
  return updated;
}

export function archiveBoard(boardId: string): boolean {
  const board = boards.get(boardId);
  if (!board) return false;

  board.isArchived = true;
  board.updatedAt = new Date().toISOString();
  boards.set(boardId, board);
  return true;
}

// ---------------------------------------------------------------------------
// Task Operations
// ---------------------------------------------------------------------------

export function createTask(input: CreateTaskInput, reporterId: string): Task {
  const validated = CreateTaskSchema.parse(input);
  validateNoPHI(validated.title, validated.description);

  const board = boards.get(validated.boardId);
  if (!board) {
    throw new Error('Board not found');
  }

  // Calculate order (append to end of status column)
  const tasksInColumn = getTasksByStatus(validated.boardId, validated.status);
  const maxOrder = tasksInColumn.reduce((max, t) => Math.max(max, t.order), -1);

  const now = new Date().toISOString();
  const task: Task = {
    id: crypto.randomUUID(),
    boardId: validated.boardId,
    title: validated.title,
    description: validated.description,
    status: validated.status,
    priority: validated.priority,
    assigneeId: validated.assigneeId,
    reporterId,
    artifactIds: validated.artifactIds || [],
    labelIds: validated.labelIds || [],
    dueDate: validated.dueDate,
    estimatedHours: validated.estimatedHours,
    order: maxOrder + 1,
    createdAt: now,
    updatedAt: now,
    completedAt: undefined,
  };

  tasks.set(task.id, task);

  // Initialize history
  taskHistory.set(task.id, [{
    timestamp: now,
    action: 'CREATED',
    userId: reporterId,
    changes: { initial: true },
  }]);

  return task;
}

export function getTask(taskId: string): Task | undefined {
  return tasks.get(taskId);
}

export function getTasksByBoard(boardId: string): Task[] {
  return Array.from(tasks.values())
    .filter(t => t.boardId === boardId)
    .sort((a, b) => a.order - b.order);
}

export function getTasksByStatus(boardId: string, status: TaskStatus): Task[] {
  return getTasksByBoard(boardId).filter(t => t.status === status);
}

export function getTasksByAssignee(boardId: string, assigneeId: string): Task[] {
  return getTasksByBoard(boardId).filter(t => t.assigneeId === assigneeId);
}

export function getTasksByArtifact(artifactId: string): Task[] {
  return Array.from(tasks.values())
    .filter(t => t.artifactIds.includes(artifactId));
}

export function updateTask(
  taskId: string,
  input: UpdateTaskInput,
  userId: string
): Task | undefined {
  const task = tasks.get(taskId);
  if (!task) return undefined;

  const validated = UpdateTaskSchema.parse(input);

  if (validated.title) {
    validateNoPHI(validated.title);
  }
  if (validated.description) {
    validateNoPHI(validated.description);
  }

  const now = new Date().toISOString();
  const changes: Record<string, unknown> = {};

  // Track changes for history
  for (const [key, value] of Object.entries(validated)) {
    if (value !== undefined && task[key as keyof Task] !== value) {
      changes[key] = { from: task[key as keyof Task], to: value };
    }
  }

  const updated: Task = {
    ...task,
    ...validated,
    updatedAt: now,
    completedAt: validated.status === 'DONE' && task.status !== 'DONE'
      ? now
      : (validated.status && validated.status !== 'DONE' ? undefined : task.completedAt),
  };

  tasks.set(taskId, updated);

  // Log history
  const history = taskHistory.get(taskId) || [];
  history.push({
    timestamp: now,
    action: 'UPDATED',
    userId,
    changes,
  });
  taskHistory.set(taskId, history);

  return updated;
}

export function moveTask(
  taskId: string,
  input: MoveTaskInput,
  userId: string
): Task | undefined {
  const task = tasks.get(taskId);
  if (!task) return undefined;

  const validated = MoveTaskSchema.parse(input);
  const now = new Date().toISOString();

  // Reorder tasks in destination column
  const tasksInDestColumn = getTasksByStatus(task.boardId, validated.status)
    .filter(t => t.id !== taskId);

  // Insert at new position
  tasksInDestColumn.splice(validated.order, 0, task);
  tasksInDestColumn.forEach((t, idx) => {
    t.order = idx;
    tasks.set(t.id, t);
  });

  const updated: Task = {
    ...task,
    status: validated.status,
    order: validated.order,
    updatedAt: now,
    completedAt: validated.status === 'DONE' && task.status !== 'DONE'
      ? now
      : (validated.status !== 'DONE' ? undefined : task.completedAt),
  };

  tasks.set(taskId, updated);

  // Log history
  const history = taskHistory.get(taskId) || [];
  history.push({
    timestamp: now,
    action: 'MOVED',
    userId,
    changes: {
      status: { from: task.status, to: validated.status },
      order: { from: task.order, to: validated.order },
    },
  });
  taskHistory.set(taskId, history);

  return updated;
}

export function deleteTask(taskId: string, userId: string): boolean {
  const task = tasks.get(taskId);
  if (!task) return false;

  const history = taskHistory.get(taskId) || [];
  history.push({
    timestamp: new Date().toISOString(),
    action: 'DELETED',
    userId,
    changes: {},
  });
  taskHistory.set(taskId, history);

  tasks.delete(taskId);
  return true;
}

export function getTaskHistory(taskId: string): Array<{ timestamp: string; action: string; userId: string; changes: Record<string, unknown> }> {
  return taskHistory.get(taskId) || [];
}

// ---------------------------------------------------------------------------
// Label Operations
// ---------------------------------------------------------------------------

export function createLabel(
  boardId: string,
  name: string,
  color: string
): TaskLabel {
  const label: TaskLabel = {
    id: crypto.randomUUID(),
    boardId,
    name,
    color,
  };

  labels.set(label.id, label);
  return label;
}

export function getLabelsByBoard(boardId: string): TaskLabel[] {
  return Array.from(labels.values()).filter(l => l.boardId === boardId);
}

export function deleteLabel(labelId: string): boolean {
  // Remove label from all tasks
  for (const task of tasks.values()) {
    task.labelIds = task.labelIds.filter(id => id !== labelId);
    tasks.set(task.id, task);
  }

  return labels.delete(labelId);
}

// ---------------------------------------------------------------------------
// Analytics
// ---------------------------------------------------------------------------

export interface BoardAnalytics {
  totalTasks: number;
  tasksByStatus: Record<TaskStatus, number>;
  tasksByPriority: Record<TaskPriority, number>;
  overdueCount: number;
  completedThisWeek: number;
  averageCompletionTime: number | null; // in hours
  assigneeWorkload: Record<string, number>;
}

export function getBoardAnalytics(boardId: string): BoardAnalytics {
  const boardTasks = getTasksByBoard(boardId);
  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const tasksByStatus: Record<TaskStatus, number> = {
    BACKLOG: 0,
    TODO: 0,
    IN_PROGRESS: 0,
    IN_REVIEW: 0,
    BLOCKED: 0,
    DONE: 0,
    ARCHIVED: 0,
  };

  const tasksByPriority: Record<TaskPriority, number> = {
    LOW: 0,
    MEDIUM: 0,
    HIGH: 0,
    URGENT: 0,
  };

  const assigneeWorkload: Record<string, number> = {};
  let overdueCount = 0;
  let completedThisWeek = 0;
  const completionTimes: number[] = [];

  for (const task of boardTasks) {
    tasksByStatus[task.status]++;
    tasksByPriority[task.priority]++;

    if (task.assigneeId) {
      assigneeWorkload[task.assigneeId] = (assigneeWorkload[task.assigneeId] || 0) + 1;
    }

    if (task.dueDate && new Date(task.dueDate) < now && task.status !== 'DONE') {
      overdueCount++;
    }

    if (task.completedAt && new Date(task.completedAt) > weekAgo) {
      completedThisWeek++;

      // Calculate completion time
      const created = new Date(task.createdAt).getTime();
      const completed = new Date(task.completedAt).getTime();
      completionTimes.push((completed - created) / (1000 * 60 * 60)); // hours
    }
  }

  return {
    totalTasks: boardTasks.length,
    tasksByStatus,
    tasksByPriority,
    overdueCount,
    completedThisWeek,
    averageCompletionTime: completionTimes.length > 0
      ? completionTimes.reduce((a, b) => a + b, 0) / completionTimes.length
      : null,
    assigneeWorkload,
  };
}

// ---------------------------------------------------------------------------
// Board View Data
// ---------------------------------------------------------------------------

export interface BoardViewData {
  board: TaskBoard;
  columns: Array<{
    status: TaskStatus;
    tasks: Task[];
  }>;
  labels: TaskLabel[];
  analytics: BoardAnalytics;
}

export function getBoardViewData(boardId: string): BoardViewData | undefined {
  const board = boards.get(boardId);
  if (!board) return undefined;

  const allTasks = getTasksByBoard(boardId);
  const columns = board.columns.map(status => ({
    status,
    tasks: allTasks.filter(t => t.status === status).sort((a, b) => a.order - b.order),
  }));

  return {
    board,
    columns,
    labels: getLabelsByBoard(boardId),
    analytics: getBoardAnalytics(boardId),
  };
}
