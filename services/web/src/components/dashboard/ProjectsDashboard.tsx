/**
 * Projects Dashboard Component
 *
 * Main dashboard view showing all projects with stats,
 * recent activity, and quick actions.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { projectsApi, tasksApi, workflowsApi, type Project, type TaskStats, type WorkflowRunStats } from '@/api';

interface ProjectCardProps {
  project: Project;
  stats?: TaskStats | null;
  onClick: () => void;
}

function ProjectCard({ project, stats, onClick }: ProjectCardProps) {
  const completionRate = stats && stats.total_count > 0
    ? Math.round((stats.done_count / stats.total_count) * 100)
    : 0;

  return (
    <div
      onClick={onClick}
      className="bg-white rounded-xl border border-gray-200 p-6 hover:shadow-md hover:border-gray-300 transition-all cursor-pointer group"
    >
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white font-semibold">
            {project.name[0]?.toUpperCase() || 'P'}
          </div>
          <div>
            <h3 className="font-semibold text-gray-900 group-hover:text-blue-600 transition-colors">
              {project.name}
            </h3>
            <p className="text-xs text-gray-500">
              {new Date(project.created_at).toLocaleDateString()}
            </p>
          </div>
        </div>
        <span className={`px-2 py-1 text-xs rounded-full ${
          project.status === 'active' ? 'bg-green-100 text-green-700' :
          project.status === 'completed' ? 'bg-blue-100 text-blue-700' :
          'bg-gray-100 text-gray-700'
        }`}>
          {project.status}
        </span>
      </div>

      {project.description && (
        <p className="text-sm text-gray-600 mb-4 line-clamp-2">
          {project.description}
        </p>
      )}

      {stats && (
        <div className="space-y-3">
          {/* Progress Bar */}
          <div>
            <div className="flex justify-between text-xs text-gray-600 mb-1">
              <span>Progress</span>
              <span>{completionRate}%</span>
            </div>
            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-500 rounded-full transition-all"
                style={{ width: `${completionRate}%` }}
              />
            </div>
          </div>

          {/* Stats Row */}
          <div className="grid grid-cols-3 gap-2 pt-2 border-t border-gray-100">
            <div className="text-center">
              <div className="text-lg font-semibold text-gray-900">{stats.total_count}</div>
              <div className="text-xs text-gray-500">Tasks</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-semibold text-green-600">{stats.done_count}</div>
              <div className="text-xs text-gray-500">Done</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-semibold text-amber-600">{stats.in_progress_count}</div>
              <div className="text-xs text-gray-500">Active</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

interface ProjectsDashboardProps {
  onProjectSelect?: (projectId: string) => void;
}

export function ProjectsDashboard({ onProjectSelect }: ProjectsDashboardProps) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectStats, setProjectStats] = useState<Record<string, TaskStats>>({});
  const [workflowStats, setWorkflowStats] = useState<WorkflowRunStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'active' | 'completed' | 'archived'>('all');

  // Fetch projects and stats
  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const [projectsResult, runStatsResult] = await Promise.all([
        projectsApi.list({ limit: 100 }),
        workflowsApi.getRunStats({ days: 30 }),
      ]);

      if (projectsResult.error) {
        setError(projectsResult.error.error);
        return;
      }

      if (projectsResult.data) {
        setProjects(projectsResult.data.projects);

        // Fetch stats for each project in parallel
        const statsPromises = projectsResult.data.projects.map(async (project) => {
          const statsResult = await tasksApi.getStats(project.id);
          if (statsResult.data) {
            return { projectId: project.id, stats: statsResult.data.stats };
          }
          return null;
        });

        const statsResults = await Promise.all(statsPromises);
        const statsMap: Record<string, TaskStats> = {};
        statsResults.forEach((result) => {
          if (result) {
            statsMap[result.projectId] = result.stats;
          }
        });
        setProjectStats(statsMap);
      }

      if (runStatsResult.data) {
        setWorkflowStats(runStatsResult.data.stats);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load projects');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Filter projects
  const filteredProjects = projects.filter((project) => {
    if (filter === 'all') return true;
    return project.status === filter;
  });

  // Calculate aggregate stats
  const totalTasks = Object.values(projectStats).reduce((sum, s) => sum + s.total_count, 0);
  const completedTasks = Object.values(projectStats).reduce((sum, s) => sum + s.done_count, 0);
  const overdueTasks = Object.values(projectStats).reduce((sum, s) => sum + s.overdue_count, 0);

  const handleProjectClick = (projectId: string) => {
    if (onProjectSelect) {
      onProjectSelect(projectId);
    } else {
      window.location.href = `/hub/${projectId}`;
    }
  };

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
        <button
          onClick={fetchData}
          className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
        >
          Try Again
        </button>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Projects</h1>
          <p className="text-gray-500 mt-1">
            {projects.length} project{projects.length !== 1 ? 's' : ''} total
          </p>
        </div>
        <button
          onClick={() => window.location.href = '/projects/new'}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          New Project
        </button>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="text-2xl font-bold text-gray-900">{projects.length}</div>
          <div className="text-sm text-gray-500">Total Projects</div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="text-2xl font-bold text-blue-600">{totalTasks}</div>
          <div className="text-sm text-gray-500">Total Tasks</div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="text-2xl font-bold text-green-600">{completedTasks}</div>
          <div className="text-sm text-gray-500">Completed Tasks</div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className={`text-2xl font-bold ${overdueTasks > 0 ? 'text-red-600' : 'text-gray-900'}`}>
            {overdueTasks}
          </div>
          <div className="text-sm text-gray-500">Overdue Tasks</div>
        </div>
      </div>

      {/* Workflow Stats */}
      {workflowStats && (
        <div className="bg-gradient-to-r from-indigo-500 to-purple-600 rounded-xl p-6 text-white">
          <h2 className="text-lg font-semibold mb-4">Workflow Activity (Last 30 Days)</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <div className="text-3xl font-bold">{workflowStats.total_runs}</div>
              <div className="text-indigo-100">Total Runs</div>
            </div>
            <div>
              <div className="text-3xl font-bold">{workflowStats.completed_count}</div>
              <div className="text-indigo-100">Completed</div>
            </div>
            <div>
              <div className="text-3xl font-bold">{workflowStats.failed_count}</div>
              <div className="text-indigo-100">Failed</div>
            </div>
            <div>
              <div className="text-3xl font-bold">
                {workflowStats.success_rate ? `${workflowStats.success_rate}%` : 'N/A'}
              </div>
              <div className="text-indigo-100">Success Rate</div>
            </div>
          </div>
        </div>
      )}

      {/* Filter Tabs */}
      <div className="flex gap-2 border-b border-gray-200">
        {(['all', 'active', 'completed', 'archived'] as const).map((status) => (
          <button
            key={status}
            onClick={() => setFilter(status)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              filter === status
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {status.charAt(0).toUpperCase() + status.slice(1)}
            {status !== 'all' && (
              <span className="ml-2 px-1.5 py-0.5 text-xs bg-gray-100 rounded-full">
                {projects.filter(p => status === 'all' || p.status === status).length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Projects Grid */}
      {filteredProjects.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <svg className="w-12 h-12 mx-auto mb-4 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
          </svg>
          <p>No {filter === 'all' ? '' : filter} projects found</p>
          {filter !== 'all' && (
            <button
              onClick={() => setFilter('all')}
              className="mt-2 text-blue-600 hover:underline"
            >
              Show all projects
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredProjects.map((project) => (
            <ProjectCard
              key={project.id}
              project={project}
              stats={projectStats[project.id]}
              onClick={() => handleProjectClick(project.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default ProjectsDashboard;
