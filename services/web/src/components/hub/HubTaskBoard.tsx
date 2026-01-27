/**
 * HubTaskBoard Component
 *
 * Kanban-style task board for Planning Hub tasks.
 * Displays tasks organized by status with drag-and-drop support.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Plus,
  MoreHorizontal,
  Calendar,
  Clock,
  User,
  AlertTriangle,
  CheckCircle2,
  Circle,
  Loader2,
  Filter,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

type TaskStatus = 'todo' | 'in_progress' | 'blocked' | 'in_review' | 'done' | 'cancelled';

interface HubTask {
  id: string;
  project_id: string;
  title: string;
  description?: string;
  status: TaskStatus;
  priority: number;
  assignee_id?: string;
  due_date?: string;
  estimated_hours?: number;
  actual_hours?: number;
  created_at: string;
  updated_at: string;
}

interface HubTaskBoardProps {
  projectId: string;
  onTaskSelect?: (task: HubTask) => void;
  className?: string;
}

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';

const STATUS_COLUMNS: { status: TaskStatus; label: string; color: string }[] = [
  { status: 'todo', label: 'To Do', color: 'bg-gray-100' },
  { status: 'in_progress', label: 'In Progress', color: 'bg-blue-100' },
  { status: 'blocked', label: 'Blocked', color: 'bg-red-100' },
  { status: 'in_review', label: 'In Review', color: 'bg-yellow-100' },
  { status: 'done', label: 'Done', color: 'bg-green-100' },
];

const PRIORITY_LABELS: Record<number, { label: string; color: string }> = {
  0: { label: 'None', color: 'text-gray-400' },
  1: { label: 'Low', color: 'text-blue-500' },
  2: { label: 'Medium', color: 'text-yellow-500' },
  3: { label: 'High', color: 'text-orange-500' },
  4: { label: 'Urgent', color: 'text-red-500' },
  5: { label: 'Critical', color: 'text-red-700' },
};

export function HubTaskBoard({ projectId, onTaskSelect, className = '' }: HubTaskBoardProps) {
  const [tasks, setTasks] = useState<HubTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newTask, setNewTask] = useState({
    title: '',
    description: '',
    priority: 2,
    status: 'todo' as TaskStatus,
  });

  // Fetch tasks
  const fetchTasks = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE}/api/hub/tasks?projectId=${projectId}`);
      if (!response.ok) throw new Error('Failed to fetch tasks');
      const data = await response.json();
      setTasks(data.tasks || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  // Create task
  const handleCreateTask = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/hub/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          title: newTask.title,
          description: newTask.description,
          priority: newTask.priority,
          status: newTask.status,
        }),
      });

      if (!response.ok) throw new Error('Failed to create task');

      setShowCreateDialog(false);
      setNewTask({ title: '', description: '', priority: 2, status: 'todo' });
      fetchTasks();
    } catch (err: any) {
      setError(err.message);
    }
  };

  // Update task status
  const handleStatusChange = async (taskId: string, newStatus: TaskStatus) => {
    try {
      const response = await fetch(`${API_BASE}/api/hub/tasks/${taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });

      if (!response.ok) throw new Error('Failed to update task');
      fetchTasks();
    } catch (err: any) {
      setError(err.message);
    }
  };

  // Delete task
  const handleDeleteTask = async (taskId: string) => {
    if (!confirm('Are you sure you want to delete this task?')) return;

    try {
      const response = await fetch(`${API_BASE}/api/hub/tasks/${taskId}`, {
        method: 'DELETE',
      });

      if (!response.ok) throw new Error('Failed to delete task');
      fetchTasks();
    } catch (err: any) {
      setError(err.message);
    }
  };

  // Group tasks by status
  const tasksByStatus = STATUS_COLUMNS.reduce((acc, { status }) => {
    acc[status] = tasks.filter(t => t.status === status);
    return acc;
  }, {} as Record<TaskStatus, HubTask[]>);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Task Board</h2>
          <p className="text-sm text-muted-foreground">{tasks.length} tasks total</p>
        </div>
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              New Task
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New Task</DialogTitle>
              <DialogDescription>Add a new task to your project board.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Title</label>
                <Input
                  placeholder="Task title"
                  value={newTask.title}
                  onChange={e => setNewTask(prev => ({ ...prev, title: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Description</label>
                <Textarea
                  placeholder="Task description (optional)"
                  value={newTask.description}
                  onChange={e => setNewTask(prev => ({ ...prev, description: e.target.value }))}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Priority</label>
                  <Select
                    value={String(newTask.priority)}
                    onValueChange={v => setNewTask(prev => ({ ...prev, priority: Number(v) }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(PRIORITY_LABELS).map(([value, { label }]) => (
                        <SelectItem key={value} value={value}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Status</label>
                  <Select
                    value={newTask.status}
                    onValueChange={v => setNewTask(prev => ({ ...prev, status: v as TaskStatus }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {STATUS_COLUMNS.map(({ status, label }) => (
                        <SelectItem key={status} value={status}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
                Cancel
              </Button>
              <Button onClick={handleCreateTask} disabled={!newTask.title.trim()}>
                Create Task
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Error Display */}
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          {error}
        </div>
      )}

      {/* Kanban Board */}
      <div className="grid grid-cols-5 gap-4 overflow-x-auto">
        {STATUS_COLUMNS.map(({ status, label, color }) => (
          <div key={status} className={`${color} rounded-lg p-3 min-h-[400px]`}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-medium text-sm">{label}</h3>
              <Badge variant="secondary">{tasksByStatus[status]?.length || 0}</Badge>
            </div>

            <div className="space-y-2">
              {tasksByStatus[status]?.map(task => (
                <Card
                  key={task.id}
                  className="cursor-pointer hover:shadow-md transition-shadow"
                  onClick={() => onTaskSelect?.(task)}
                >
                  <CardContent className="p-3">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h4 className="font-medium text-sm line-clamp-2">{task.title}</h4>
                        {task.description && (
                          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                            {task.description}
                          </p>
                        )}
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0"
                            onClick={e => e.stopPropagation()}
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {STATUS_COLUMNS.filter(s => s.status !== status).map(s => (
                            <DropdownMenuItem
                              key={s.status}
                              onClick={e => {
                                e.stopPropagation();
                                handleStatusChange(task.id, s.status);
                              }}
                            >
                              Move to {s.label}
                            </DropdownMenuItem>
                          ))}
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-red-600"
                            onClick={e => {
                              e.stopPropagation();
                              handleDeleteTask(task.id);
                            }}
                          >
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>

                    <div className="flex items-center gap-2 mt-2 flex-wrap">
                      {task.priority > 0 && (
                        <Badge
                          variant="outline"
                          className={`text-xs ${PRIORITY_LABELS[task.priority]?.color}`}
                        >
                          {PRIORITY_LABELS[task.priority]?.label}
                        </Badge>
                      )}
                      {task.due_date && (
                        <Badge variant="outline" className="text-xs">
                          <Calendar className="h-3 w-3 mr-1" />
                          {new Date(task.due_date).toLocaleDateString()}
                        </Badge>
                      )}
                      {task.estimated_hours && (
                        <Badge variant="outline" className="text-xs">
                          <Clock className="h-3 w-3 mr-1" />
                          {task.estimated_hours}h
                        </Badge>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default HubTaskBoard;
