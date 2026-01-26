/**
 * Project Store
 *
 * Zustand store for managing research projects and workflows.
 * Provides state management for the Research Project Manager feature.
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type {
  Project,
  ProjectWithWorkflows,
  Workflow,
  CreateProjectInput,
  UpdateProjectInput,
  CreateWorkflowInput,
  UpdateWorkflowInput,
  ProjectStats,
  RecentActivity,
} from '@/types/project';

// ============================================================================
// Store State Interface
// ============================================================================

interface ProjectState {
  // Data
  projects: Project[];
  currentProject: ProjectWithWorkflows | null;
  currentWorkflow: Workflow | null;
  stats: ProjectStats | null;
  recentActivity: RecentActivity[];

  // UI State
  isLoading: boolean;
  isCreating: boolean;
  error: string | null;

  // Filters
  statusFilter: 'all' | 'active' | 'archived' | 'completed';
  sortBy: 'recent' | 'name' | 'created';
  searchQuery: string;

  // Actions - Projects
  fetchProjects: () => Promise<void>;
  fetchProjectById: (id: string) => Promise<void>;
  createProject: (data: CreateProjectInput) => Promise<Project>;
  updateProject: (id: string, data: UpdateProjectInput) => Promise<void>;
  deleteProject: (id: string) => Promise<void>;
  setCurrentProject: (project: ProjectWithWorkflows | null) => void;

  // Actions - Workflows
  createWorkflow: (projectId: string, data: CreateWorkflowInput) => Promise<Workflow>;
  updateWorkflow: (projectId: string, workflowId: string, data: UpdateWorkflowInput) => Promise<void>;
  deleteWorkflow: (projectId: string, workflowId: string) => Promise<void>;
  setCurrentWorkflow: (workflow: Workflow | null) => void;

  // Actions - Stats
  fetchStats: () => Promise<void>;
  fetchRecentActivity: () => Promise<void>;

  // Actions - Filters
  setStatusFilter: (filter: 'all' | 'active' | 'archived' | 'completed') => void;
  setSortBy: (sort: 'recent' | 'name' | 'created') => void;
  setSearchQuery: (query: string) => void;

  // Actions - Error handling
  clearError: () => void;
}

// ============================================================================
// Mock Data (for development/demo mode)
// ============================================================================

const USE_MOCK = true; // Toggle for development

const mockProjects: Project[] = [
  {
    id: 'proj-1',
    name: 'Cardiovascular Outcomes Study',
    description: 'Systematic review of cardiovascular outcomes in diabetic patients',
    createdAt: '2025-01-15T10:00:00Z',
    updatedAt: '2025-01-20T14:30:00Z',
    createdBy: 'user-1',
    status: 'active',
    workflowCount: 3,
    settings: {
      aiMode: 'REQUIRE_EACH',
      phiProtection: 'strict',
      governanceLevel: 'full',
    },
    collaborators: [
      { userId: 'user-1', email: 'researcher@example.com', name: 'Dr. Smith', role: 'owner', addedAt: '2025-01-15T10:00:00Z' },
    ],
  },
  {
    id: 'proj-2',
    name: 'Gene Expression Analysis',
    description: 'RNA-seq analysis of tumor samples',
    createdAt: '2025-01-10T09:00:00Z',
    updatedAt: '2025-01-18T11:00:00Z',
    createdBy: 'user-1',
    status: 'active',
    workflowCount: 2,
    settings: {
      aiMode: 'REQUIRE_ONCE',
      phiProtection: 'standard',
      governanceLevel: 'enhanced',
    },
    collaborators: [],
  },
  {
    id: 'proj-3',
    name: 'Drug Interaction Meta-Analysis',
    description: 'Comprehensive meta-analysis of drug interactions',
    createdAt: '2024-12-01T08:00:00Z',
    updatedAt: '2025-01-05T16:00:00Z',
    createdBy: 'user-1',
    status: 'completed',
    workflowCount: 5,
    settings: {
      aiMode: 'AUTO',
      phiProtection: 'standard',
      governanceLevel: 'basic',
    },
    collaborators: [],
  },
];

const mockWorkflows: Workflow[] = [
  {
    id: 'wf-1',
    projectId: 'proj-1',
    name: 'Literature Search',
    description: 'Initial literature search and screening',
    createdAt: '2025-01-15T10:30:00Z',
    updatedAt: '2025-01-20T14:30:00Z',
    status: 'in_progress',
    currentStage: 3,
    totalStages: 8,
    progress: 37,
    stages: [],
    artifacts: [],
    auditLog: [],
  },
  {
    id: 'wf-2',
    projectId: 'proj-1',
    name: 'Data Extraction',
    description: 'Extract data from selected studies',
    createdAt: '2025-01-16T09:00:00Z',
    updatedAt: '2025-01-19T11:00:00Z',
    status: 'draft',
    currentStage: 0,
    totalStages: 8,
    progress: 0,
    stages: [],
    artifacts: [],
    auditLog: [],
  },
];

const mockStats: ProjectStats = {
  totalProjects: 3,
  activeProjects: 2,
  completedProjects: 1,
  archivedProjects: 0,
  totalWorkflows: 10,
  activeWorkflows: 5,
  completedWorkflows: 5,
};

const mockRecentActivity: RecentActivity[] = [
  {
    id: 'act-1',
    type: 'workflow_created',
    projectId: 'proj-1',
    projectName: 'Cardiovascular Outcomes Study',
    workflowId: 'wf-2',
    workflowName: 'Data Extraction',
    timestamp: '2025-01-16T09:00:00Z',
    actor: 'Dr. Smith',
  },
  {
    id: 'act-2',
    type: 'stage_completed',
    projectId: 'proj-1',
    projectName: 'Cardiovascular Outcomes Study',
    workflowId: 'wf-1',
    workflowName: 'Literature Search',
    timestamp: '2025-01-20T14:30:00Z',
    actor: 'Dr. Smith',
  },
];

// ============================================================================
// Store Implementation
// ============================================================================

export const useProjectStore = create<ProjectState>()(
  persist(
    (set, get) => ({
      // Initial state
      projects: [],
      currentProject: null,
      currentWorkflow: null,
      stats: null,
      recentActivity: [],
      isLoading: false,
      isCreating: false,
      error: null,
      statusFilter: 'all',
      sortBy: 'recent',
      searchQuery: '',

      // Fetch all projects
      fetchProjects: async () => {
        set({ isLoading: true, error: null });
        try {
          if (USE_MOCK) {
            await new Promise((resolve) => setTimeout(resolve, 500));
            set({ projects: mockProjects, isLoading: false });
            return;
          }

          const response = await fetch('/api/projects');
          if (!response.ok) throw new Error('Failed to fetch projects');
          const data = await response.json();
          set({ projects: data.projects, isLoading: false });
        } catch (error) {
          set({ error: (error as Error).message, isLoading: false });
        }
      },

      // Fetch single project with workflows
      fetchProjectById: async (id: string) => {
        set({ isLoading: true, error: null });
        try {
          if (USE_MOCK) {
            await new Promise((resolve) => setTimeout(resolve, 300));
            const project = mockProjects.find((p) => p.id === id);
            if (!project) throw new Error('Project not found');
            const workflows = mockWorkflows.filter((w) => w.projectId === id);
            set({
              currentProject: { ...project, workflows },
              isLoading: false,
            });
            return;
          }

          const response = await fetch(`/api/projects/${id}`);
          if (!response.ok) throw new Error('Failed to fetch project');
          const data = await response.json();
          set({ currentProject: data.project, isLoading: false });
        } catch (error) {
          set({ error: (error as Error).message, isLoading: false });
        }
      },

      // Create new project
      createProject: async (data: CreateProjectInput) => {
        set({ isCreating: true, error: null });
        try {
          if (USE_MOCK) {
            await new Promise((resolve) => setTimeout(resolve, 500));
            const newProject: Project = {
              id: `proj-${Date.now()}`,
              name: data.name,
              description: data.description || '',
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
              createdBy: 'user-1',
              status: 'active',
              workflowCount: 0,
              settings: {
                aiMode: data.settings?.aiMode || 'REQUIRE_EACH',
                phiProtection: data.settings?.phiProtection || 'strict',
                governanceLevel: data.settings?.governanceLevel || 'full',
              },
              collaborators: [],
            };
            set((state) => ({
              projects: [newProject, ...state.projects],
              isCreating: false,
            }));
            return newProject;
          }

          const response = await fetch('/api/projects', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
          });
          if (!response.ok) throw new Error('Failed to create project');
          const newProject = await response.json();
          set((state) => ({
            projects: [newProject, ...state.projects],
            isCreating: false,
          }));
          return newProject;
        } catch (error) {
          set({ error: (error as Error).message, isCreating: false });
          throw error;
        }
      },

      // Update project
      updateProject: async (id: string, data: UpdateProjectInput) => {
        set({ error: null });
        try {
          if (USE_MOCK) {
            await new Promise((resolve) => setTimeout(resolve, 300));
            set((state) => ({
              projects: state.projects.map((p) =>
                p.id === id ? { ...p, ...data, updatedAt: new Date().toISOString() } : p
              ),
              currentProject:
                state.currentProject?.id === id
                  ? { ...state.currentProject, ...data, updatedAt: new Date().toISOString() }
                  : state.currentProject,
            }));
            return;
          }

          const response = await fetch(`/api/projects/${id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
          });
          if (!response.ok) throw new Error('Failed to update project');
          const updated = await response.json();
          set((state) => ({
            projects: state.projects.map((p) => (p.id === id ? updated : p)),
            currentProject: state.currentProject?.id === id ? { ...state.currentProject, ...updated } : state.currentProject,
          }));
        } catch (error) {
          set({ error: (error as Error).message });
        }
      },

      // Delete project
      deleteProject: async (id: string) => {
        set({ error: null });
        try {
          if (USE_MOCK) {
            await new Promise((resolve) => setTimeout(resolve, 300));
            set((state) => ({
              projects: state.projects.filter((p) => p.id !== id),
              currentProject: state.currentProject?.id === id ? null : state.currentProject,
            }));
            return;
          }

          const response = await fetch(`/api/projects/${id}`, { method: 'DELETE' });
          if (!response.ok) throw new Error('Failed to delete project');
          set((state) => ({
            projects: state.projects.filter((p) => p.id !== id),
            currentProject: state.currentProject?.id === id ? null : state.currentProject,
          }));
        } catch (error) {
          set({ error: (error as Error).message });
        }
      },

      setCurrentProject: (project) => set({ currentProject: project }),

      // Create workflow
      createWorkflow: async (projectId: string, data: CreateWorkflowInput) => {
        set({ isCreating: true, error: null });
        try {
          if (USE_MOCK) {
            await new Promise((resolve) => setTimeout(resolve, 500));
            const newWorkflow: Workflow = {
              id: `wf-${Date.now()}`,
              projectId,
              name: data.name,
              description: data.description || '',
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
              status: 'draft',
              currentStage: 0,
              totalStages: 8,
              progress: 0,
              stages: [],
              artifacts: [],
              auditLog: [],
            };
            set((state) => ({
              currentProject: state.currentProject
                ? {
                    ...state.currentProject,
                    workflows: [...state.currentProject.workflows, newWorkflow],
                    workflowCount: state.currentProject.workflowCount + 1,
                  }
                : null,
              isCreating: false,
            }));
            return newWorkflow;
          }

          const response = await fetch(`/api/projects/${projectId}/workflows`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
          });
          if (!response.ok) throw new Error('Failed to create workflow');
          const newWorkflow = await response.json();
          set((state) => ({
            currentProject: state.currentProject
              ? {
                  ...state.currentProject,
                  workflows: [...state.currentProject.workflows, newWorkflow],
                  workflowCount: state.currentProject.workflowCount + 1,
                }
              : null,
            isCreating: false,
          }));
          return newWorkflow;
        } catch (error) {
          set({ error: (error as Error).message, isCreating: false });
          throw error;
        }
      },

      // Update workflow
      updateWorkflow: async (projectId: string, workflowId: string, data: UpdateWorkflowInput) => {
        set({ error: null });
        try {
          if (USE_MOCK) {
            await new Promise((resolve) => setTimeout(resolve, 300));
            set((state) => ({
              currentProject: state.currentProject
                ? {
                    ...state.currentProject,
                    workflows: state.currentProject.workflows.map((w) =>
                      w.id === workflowId ? { ...w, ...data, updatedAt: new Date().toISOString() } : w
                    ),
                  }
                : null,
            }));
            return;
          }

          const response = await fetch(`/api/projects/${projectId}/workflows/${workflowId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
          });
          if (!response.ok) throw new Error('Failed to update workflow');
          const updated = await response.json();
          set((state) => ({
            currentProject: state.currentProject
              ? {
                  ...state.currentProject,
                  workflows: state.currentProject.workflows.map((w) => (w.id === workflowId ? updated : w)),
                }
              : null,
          }));
        } catch (error) {
          set({ error: (error as Error).message });
        }
      },

      // Delete workflow
      deleteWorkflow: async (projectId: string, workflowId: string) => {
        set({ error: null });
        try {
          if (USE_MOCK) {
            await new Promise((resolve) => setTimeout(resolve, 300));
            set((state) => ({
              currentProject: state.currentProject
                ? {
                    ...state.currentProject,
                    workflows: state.currentProject.workflows.filter((w) => w.id !== workflowId),
                    workflowCount: state.currentProject.workflowCount - 1,
                  }
                : null,
            }));
            return;
          }

          const response = await fetch(`/api/projects/${projectId}/workflows/${workflowId}`, {
            method: 'DELETE',
          });
          if (!response.ok) throw new Error('Failed to delete workflow');
          set((state) => ({
            currentProject: state.currentProject
              ? {
                  ...state.currentProject,
                  workflows: state.currentProject.workflows.filter((w) => w.id !== workflowId),
                  workflowCount: state.currentProject.workflowCount - 1,
                }
              : null,
          }));
        } catch (error) {
          set({ error: (error as Error).message });
        }
      },

      setCurrentWorkflow: (workflow) => set({ currentWorkflow: workflow }),

      // Fetch stats
      fetchStats: async () => {
        try {
          if (USE_MOCK) {
            await new Promise((resolve) => setTimeout(resolve, 200));
            set({ stats: mockStats });
            return;
          }

          const response = await fetch('/api/projects/stats');
          if (!response.ok) throw new Error('Failed to fetch stats');
          const stats = await response.json();
          set({ stats });
        } catch (error) {
          console.error('Failed to fetch stats:', error);
        }
      },

      // Fetch recent activity
      fetchRecentActivity: async () => {
        try {
          if (USE_MOCK) {
            await new Promise((resolve) => setTimeout(resolve, 200));
            set({ recentActivity: mockRecentActivity });
            return;
          }

          const response = await fetch('/api/projects/activity');
          if (!response.ok) throw new Error('Failed to fetch activity');
          const activity = await response.json();
          set({ recentActivity: activity });
        } catch (error) {
          console.error('Failed to fetch activity:', error);
        }
      },

      // Filter actions
      setStatusFilter: (filter) => set({ statusFilter: filter }),
      setSortBy: (sort) => set({ sortBy: sort }),
      setSearchQuery: (query) => set({ searchQuery: query }),

      // Clear error
      clearError: () => set({ error: null }),
    }),
    {
      name: 'project-store',
      partialize: (state) => ({
        statusFilter: state.statusFilter,
        sortBy: state.sortBy,
      }),
    }
  )
);

// ============================================================================
// Selectors
// ============================================================================

export const useFilteredProjects = () => {
  const projects = useProjectStore((state) => state.projects);
  const statusFilter = useProjectStore((state) => state.statusFilter);
  const sortBy = useProjectStore((state) => state.sortBy);
  const searchQuery = useProjectStore((state) => state.searchQuery);

  return projects
    .filter((project) => {
      // Status filter
      if (statusFilter !== 'all' && project.status !== statusFilter) {
        return false;
      }
      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        return (
          project.name.toLowerCase().includes(query) ||
          project.description.toLowerCase().includes(query)
        );
      }
      return true;
    })
    .sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return a.name.localeCompare(b.name);
        case 'created':
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        case 'recent':
        default:
          return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
      }
    });
};
