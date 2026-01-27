/**
 * API Client Layer
 *
 * Unified exports for all API clients.
 * Usage: import { projectsApi, tasksApi } from '@/api';
 */

export { default as api, apiFetch, type ApiError, type ApiResponse } from './client';
export { default as projectsApi, type Project, type ProjectStats, type ProjectActivity, type ProjectMember } from './projects';
export { default as tasksApi, type Task, type TaskStats, type TaskStatus, type CreateTaskInput, type UpdateTaskInput } from './tasks';
export { default as milestonesApi, type Milestone, type MilestoneStatus, type CreateMilestoneInput, type UpdateMilestoneInput } from './milestones';
export { default as calendarApi, type CalendarEvent, type CalendarEventType, type CalendarSummary } from './calendar';
export { default as workflowsApi, type Workflow, type WorkflowVersion, type WorkflowRun, type WorkflowRunStep, type WorkflowRunStats, type RunStatus } from './workflows';
export { default as searchApi, type SearchResult, type SearchResultType, type SearchSuggestion } from './search';
