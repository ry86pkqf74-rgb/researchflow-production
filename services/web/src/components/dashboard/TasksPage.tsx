/**
 * Tasks Page Component
 *
 * Comprehensive task management view with filtering, sorting,
 * and kanban-style board view.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { tasksApi, type Task, type TaskStatus, type TaskStats } from '@/api';

// Status configuration
const STATUS_CONFIG: Record<TaskStatus, { label: string; color: string; bgColor: string }> = {
  todo: { label: 'To Do', color: 'text-gray-700', bgColor: 'bg-gray-100' },
  in_progress: { label: 'In Progress', color: 'text-blue-700', bgColor: 'bg-blue-100' },
  blocked: { label: 'Blocked', color: 'text-red-700', bgColor: 'bg-red-100' },
  in_review: { label: 'In Review', color: 'text-purple-700', bgColor: 'bg-purple-100' },
  done: { label: 'Done', color: 'text-green-700', bgColor: 'bg-green-100' },
  cancelled: { label: 'Cancelled', color: 'text-gray-500', bgColor: 'bg-gray-100' },
};

const PRIORITY_LABELS = ['None', 'Low', 'Medium', 'High', 'Critical', 'Urgent'];

interface TaskCardProps {
  task: Task;
  onStatusChange: (taskId: string, status: TaskStatus) => void;
  onEdit: (task: Task) => void;
}

function TaskCard({ task, onStatusChange, onEdit }: TaskCardProps) {
  const isOverdue = task.due_date && new Date(task.due_date) < new Date() && task.status !== 'done';
  const statusConfig = STATUS_CONFIG[task.status];

  return (
    <div
      className={`bg-white rounded-lg border p-4 hover:shadow-md transition-shadow cursor-pointer ${
        isOverdue ? 'border-red-200' : 'border-gray-200'
      }`}
      onClick={() => onEdit(task)}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <h4 className="font-medium text-gray-900 line-clamp-2">{task.title}</h4>
        {task.priority > 0 && (
          <span className={`shrink-0 px-2 py-0.5 text-xs rounded-full ${
            task.priority >= 4 ? 'bg-red-100 text-red-700' :
            task.priority >= 3 ? 'bg-amber-100 text-amber-700' :
            'bg-gray-100 text-gray-600'
          }`}>
            {PRIORITY_LABELS[task.priority]}
          </span>
        )}
      </div>

      {task.description && (
        <p className="text-sm text-gray-500 line-clamp-2 mb-3">{task.description}</p>
      )}

      <div className="flex items-center justify-between text-xs">
        <select
          value={task.status}
          onChange={(e) => {
            e.stopPropagation();
            onStatusChange(task.id, e.target.value as TaskStatus);
          }}
          onClick={(e) => e.stopPropagation()}
          className={`px-2 py-1 rounded-full text-xs border-0 ${statusConfig.bgColor} ${statusConfig.color} cursor-pointer`}
        >
          {Object.entries(STATUS_CONFIG).map(([value, config]) => (
            <option key={value} value={value}>{config.label}</option>
          ))}
        </select>

        {task.due_date && (
          <span className={`${isOverdue ? 'text-red-600 font-medium' : 'text-gray-500'}`}>
            {isOverdue ? 'Overdue: ' : 'Due: '}
            {new Date(task.due_date).toLocaleDateString()}
          </span>
        )}
      </div>

      {task.estimated_hours && (
        <div className="mt-2 text-xs text-gray-400">
          Est: {task.estimated_hours}h
          {task.actual_hours && ` / Actual: ${task.actual_hours}h`}
        </div>
      )}
    </div>
  );
}

interface TaskColumnProps {
  status: TaskStatus;
  tasks: Task[];
  onStatusChange: (taskId: string, status: TaskStatus) => void;
  onEdit: (task: Task) => void;
  onDrop: (taskId: string, newStatus: TaskStatus) => void;
}

function TaskColumn({ status, tasks, onStatusChange, onEdit, onDrop }: TaskColumnProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const config = STATUS_CONFIG[status];

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const taskId = e.dataTransfer.getData('taskId');
    if (taskId) {
      onDrop(taskId, status);
    }
  };

  return (
    <div
      className={`flex-1 min-w-[280px] max-w-[350px] bg-gray-50 rounded-xl p-4 ${
        isDragOver ? 'ring-2 ring-blue-400' : ''
      }`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className={`px-2 py-1 rounded-full text-xs font-medium ${config.bgColor} ${config.color}`}>
            {config.label}
          </span>
          <span className="text-sm text-gray-500">{tasks.length}</span>
        </div>
      </div>

      <div className="space-y-3">
        {tasks.map((task) => (
          <div
            key={task.id}
            draggable
            onDragStart={(e) => {
              e.dataTransfer.setData('taskId', task.id);
            }}
          >
            <TaskCard
              task={task}
              onStatusChange={onStatusChange}
              onEdit={onEdit}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

interface TasksPageProps {
  projectId: string;
  onTaskEdit?: (task: Task) => void;
}

export function TasksPage({ projectId, onTaskEdit }: TasksPageProps) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [stats, setStats] = useState<TaskStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<'board' | 'list'>('board');
  const [filterStatus, setFilterStatus] = useState<TaskStatus | 'all'>('all');
  const [sortBy, setSortBy] = useState<'due_date' | 'priority' | 'created_at'>('priority');

  // Fetch tasks
  const fetchTasks = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const [tasksResult, statsResult] = await Promise.all([
        tasksApi.list({ projectId }),
        tasksApi.getStats(projectId),
      ]);

      if (tasksResult.error) {
        setError(tasksResult.error.error);
        return;
      }

      if (tasksResult.data) {
        setTasks(tasksResult.data.tasks);
      }

      if (statsResult.data) {
        setStats(statsResult.data.stats);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load tasks');
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  // Handle status change
  const handleStatusChange = async (taskId: string, newStatus: TaskStatus) => {
    // Optimistic update
    setTasks(prev => prev.map(t =>
      t.id === taskId ? { ...t, status: newStatus } : t
    ));

    const result = await tasksApi.updateStatus(taskId, newStatus);
    if (result.error) {
      // Revert on error
      fetchTasks();
    } else {
      // Update stats
      const statsResult = await tasksApi.getStats(projectId);
      if (statsResult.data) {
        setStats(statsResult.data.stats);
      }
    }
  };

  // Handle task edit
  const handleTaskEdit = (task: Task) => {
    if (onTaskEdit) {
      onTaskEdit(task);
    }
  };

  // Filter and sort tasks
  const filteredTasks = tasks
    .filter(task => filterStatus === 'all' || task.status === filterStatus)
    .sort((a, b) => {
      switch (sortBy) {
        case 'due_date':
          if (!a.due_date) return 1;
          if (!b.due_date) return -1;
          return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
        case 'priority':
          return b.priority - a.priority;
        case 'created_at':
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        default:
          return 0;
      }
    });

  // Group tasks by status for board view
  const tasksByStatus = Object.keys(STATUS_CONFIG).reduce((acc, status) => {
    acc[status as TaskStatus] = filteredTasks.filter(t => t.status === status);
    return acc;
  }, {} as Record<TaskStatus, Task[]>);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] text-gray-500">
        <p className="mb-4">{error}</p>
        <button onClick={fetchTasks} className="text-blue-600 hover:underline">
          Try Again
        </button>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Tasks</h1>
          {stats && (
            <p className="text-gray-500 mt-1">
              {stats.done_count} of {stats.total_count} completed
              {stats.overdue_count > 0 && (
                <span className="text-red-600 ml-2">• {stats.overdue_count} overdue</span>
              )}
            </p>
          )}
        </div>
        <div className="flex items-center gap-3">
          {/* View Toggle */}
          <div className="flex bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => setView('board')}
              className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                view === 'board' ? 'bg-white shadow text-gray-900' : 'text-gray-600'
              }`}
            >
              Board
            </button>
            <button
              onClick={() => setView('list')}
              className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                view === 'list' ? 'bg-white shadow text-gray-900' : 'text-gray-600'
              }`}
            >
              List
            </button>
          </div>

          {/* Sort */}
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white"
          >
            <option value="priority">Sort by Priority</option>
            <option value="due_date">Sort by Due Date</option>
            <option value="created_at">Sort by Created</option>
          </select>

          {/* New Task */}
          <button
            onClick={() => {
              // Open create task modal
            }}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            New Task
          </button>
        </div>
      </div>

      {/* Stats Bar */}
      {stats && (
        <div className="grid grid-cols-6 gap-3">
          {Object.entries(STATUS_CONFIG).map(([status, config]) => {
            const count = stats[`${status}_count` as keyof TaskStats] as number || 0;
            return (
              <button
                key={status}
                onClick={() => setFilterStatus(filterStatus === status ? 'all' : status as TaskStatus)}
                className={`p-3 rounded-lg border transition-all ${
                  filterStatus === status
                    ? 'border-blue-300 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className={`text-xl font-bold ${config.color}`}>{count}</div>
                <div className="text-xs text-gray-500">{config.label}</div>
              </button>
            );
          })}
        </div>
      )}

      {/* Board View */}
      {view === 'board' && (
        <div className="flex gap-4 overflow-x-auto pb-4">
          {(Object.entries(STATUS_CONFIG) as [TaskStatus, typeof STATUS_CONFIG[TaskStatus]][])
            .filter(([status]) => status !== 'cancelled')
            .map(([status]) => (
              <TaskColumn
                key={status}
                status={status}
                tasks={tasksByStatus[status]}
                onStatusChange={handleStatusChange}
                onEdit={handleTaskEdit}
                onDrop={handleStatusChange}
              />
            ))}
        </div>
      )}

      {/* List View */}
      {view === 'list' && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Title</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Priority</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Due Date</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Est. Hours</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredTasks.map((task) => {
                const config = STATUS_CONFIG[task.status];
                const isOverdue = task.due_date && new Date(task.due_date) < new Date() && task.status !== 'done';
                return (
                  <tr
                    key={task.id}
                    onClick={() => handleTaskEdit(task)}
                    className="hover:bg-gray-50 cursor-pointer"
                  >
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900">{task.title}</div>
                      {task.description && (
                        <div className="text-sm text-gray-500 truncate max-w-md">{task.description}</div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded-full text-xs ${config.bgColor} ${config.color}`}>
                        {config.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">
                      {task.priority > 0 ? PRIORITY_LABELS[task.priority] : '-'}
                    </td>
                    <td className={`px-4 py-3 text-sm ${isOverdue ? 'text-red-600 font-medium' : 'text-gray-500'}`}>
                      {task.due_date ? new Date(task.due_date).toLocaleDateString() : '-'}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">
                      {task.estimated_hours || '-'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {filteredTasks.length === 0 && (
            <div className="p-8 text-center text-gray-500">
              No tasks found
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default TasksPage;
