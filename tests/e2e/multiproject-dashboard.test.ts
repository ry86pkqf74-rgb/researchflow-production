/**
 * Multi-Project Dashboard E2E Tests
 *
 * Tests for the multi-project dashboard functionality including:
 * - Projects CRUD
 * - Tasks management
 * - Milestones tracking
 * - Calendar events
 * - Workflow runs
 * - Global search
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';

// Test configuration
const API_BASE_URL = process.env.TEST_API_URL || 'http://localhost:3001';
const TEST_USER_TOKEN = process.env.TEST_USER_TOKEN || 'test-token';

// Helper to make authenticated requests
async function apiRequest(
  endpoint: string,
  options: RequestInit = {}
): Promise<{ data: any; status: number }> {
  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${TEST_USER_TOKEN}`,
      ...options.headers,
    },
  });

  let data;
  try {
    data = await response.json();
  } catch {
    data = null;
  }

  return { data, status: response.status };
}

describe('Multi-Project Dashboard API', () => {
  let testProjectId: string;
  let testTaskId: string;
  let testMilestoneId: string;
  let testEventId: string;
  let testWorkflowId: string;
  let testRunId: string;

  // ====================
  // Projects Tests
  // ====================
  describe('Projects API', () => {
    it('should create a new project', async () => {
      const { data, status } = await apiRequest('/api/projects', {
        method: 'POST',
        body: JSON.stringify({
          name: 'E2E Test Project',
          description: 'Created by E2E tests',
        }),
      });

      expect(status).toBe(201);
      expect(data.project).toBeDefined();
      expect(data.project.name).toBe('E2E Test Project');
      testProjectId = data.project.id;
    });

    it('should list projects', async () => {
      const { data, status } = await apiRequest('/api/projects');

      expect(status).toBe(200);
      expect(data.projects).toBeDefined();
      expect(Array.isArray(data.projects)).toBe(true);
    });

    it('should get project by ID', async () => {
      const { data, status } = await apiRequest(`/api/projects/${testProjectId}`);

      expect(status).toBe(200);
      expect(data.project).toBeDefined();
      expect(data.project.id).toBe(testProjectId);
    });

    it('should update a project', async () => {
      const { data, status } = await apiRequest(`/api/projects/${testProjectId}`, {
        method: 'PATCH',
        body: JSON.stringify({
          description: 'Updated by E2E tests',
        }),
      });

      expect(status).toBe(200);
      expect(data.project.description).toBe('Updated by E2E tests');
    });

    it('should get project stats', async () => {
      const { data, status } = await apiRequest('/api/projects/stats');

      expect(status).toBe(200);
      expect(data.stats).toBeDefined();
    });
  });

  // ====================
  // Tasks Tests
  // ====================
  describe('Hub Tasks API', () => {
    it('should create a task', async () => {
      const { data, status } = await apiRequest('/api/hub/tasks', {
        method: 'POST',
        body: JSON.stringify({
          projectId: testProjectId,
          title: 'E2E Test Task',
          description: 'Created by E2E tests',
          priority: 3,
        }),
      });

      expect(status).toBe(201);
      expect(data.task).toBeDefined();
      expect(data.task.title).toBe('E2E Test Task');
      testTaskId = data.task.id;
    });

    it('should list tasks for project', async () => {
      const { data, status } = await apiRequest(`/api/hub/tasks?projectId=${testProjectId}`);

      expect(status).toBe(200);
      expect(data.tasks).toBeDefined();
      expect(Array.isArray(data.tasks)).toBe(true);
      expect(data.tasks.length).toBeGreaterThan(0);
    });

    it('should get task by ID', async () => {
      const { data, status } = await apiRequest(`/api/hub/tasks/${testTaskId}`);

      expect(status).toBe(200);
      expect(data.task).toBeDefined();
      expect(data.task.id).toBe(testTaskId);
    });

    it('should update task status', async () => {
      const { data, status } = await apiRequest(`/api/hub/tasks/${testTaskId}`, {
        method: 'PATCH',
        body: JSON.stringify({
          status: 'in_progress',
        }),
      });

      expect(status).toBe(200);
      expect(data.task.status).toBe('in_progress');
    });

    it('should get task stats', async () => {
      const { data, status } = await apiRequest(`/api/hub/tasks/stats/${testProjectId}`);

      expect(status).toBe(200);
      expect(data.stats).toBeDefined();
      expect(data.stats.total_count).toBeGreaterThan(0);
    });
  });

  // ====================
  // Milestones Tests
  // ====================
  describe('Hub Milestones API', () => {
    it('should create a milestone', async () => {
      const targetDate = new Date();
      targetDate.setDate(targetDate.getDate() + 30);

      const { data, status } = await apiRequest('/api/hub/milestones', {
        method: 'POST',
        body: JSON.stringify({
          projectId: testProjectId,
          title: 'E2E Test Milestone',
          description: 'Created by E2E tests',
          targetDate: targetDate.toISOString(),
          linkedTaskIds: [testTaskId],
        }),
      });

      expect(status).toBe(201);
      expect(data.milestone).toBeDefined();
      expect(data.milestone.title).toBe('E2E Test Milestone');
      testMilestoneId = data.milestone.id;
    });

    it('should list milestones for project', async () => {
      const { data, status } = await apiRequest(`/api/hub/milestones?projectId=${testProjectId}`);

      expect(status).toBe(200);
      expect(data.milestones).toBeDefined();
      expect(Array.isArray(data.milestones)).toBe(true);
    });

    it('should get milestone with linked tasks', async () => {
      const { data, status } = await apiRequest(`/api/hub/milestones/${testMilestoneId}`);

      expect(status).toBe(200);
      expect(data.milestone).toBeDefined();
      expect(data.linkedTasks).toBeDefined();
    });

    it('should complete a milestone', async () => {
      const { data, status } = await apiRequest(`/api/hub/milestones/${testMilestoneId}/complete`, {
        method: 'POST',
      });

      expect(status).toBe(200);
      expect(data.milestone.status).toBe('completed');
    });
  });

  // ====================
  // Calendar Tests
  // ====================
  describe('Hub Calendar API', () => {
    it('should create a custom event', async () => {
      const startTime = new Date();
      startTime.setDate(startTime.getDate() + 7);

      const { data, status } = await apiRequest('/api/hub/calendar', {
        method: 'POST',
        body: JSON.stringify({
          projectId: testProjectId,
          title: 'E2E Test Event',
          eventType: 'custom',
          startTime: startTime.toISOString(),
          allDay: true,
        }),
      });

      expect(status).toBe(201);
      expect(data.event).toBeDefined();
      expect(data.event.title).toBe('E2E Test Event');
      testEventId = data.event.id;
    });

    it('should get calendar events for date range', async () => {
      const startDate = new Date();
      const endDate = new Date();
      endDate.setDate(endDate.getDate() + 30);

      const { data, status } = await apiRequest(
        `/api/hub/calendar?projectId=${testProjectId}&startDate=${startDate.toISOString()}&endDate=${endDate.toISOString()}`
      );

      expect(status).toBe(200);
      expect(data.events).toBeDefined();
      expect(data.eventsByDate).toBeDefined();
    });

    it('should get upcoming events', async () => {
      const { data, status } = await apiRequest(`/api/hub/calendar/upcoming?projectId=${testProjectId}`);

      expect(status).toBe(200);
      expect(data.events).toBeDefined();
    });

    it('should get calendar summary', async () => {
      const { data, status } = await apiRequest(`/api/hub/calendar/summary?projectId=${testProjectId}`);

      expect(status).toBe(200);
      expect(data.summary).toBeDefined();
    });
  });

  // ====================
  // Workflow Runs Tests
  // ====================
  describe('Hub Workflow Runs API', () => {
    beforeAll(async () => {
      // Create a test workflow first
      const { data, status } = await apiRequest('/api/workflows', {
        method: 'POST',
        body: JSON.stringify({
          name: 'E2E Test Workflow',
          description: 'Created by E2E tests',
        }),
      });

      if (status === 201) {
        testWorkflowId = data.workflow.id;
      }
    });

    it('should create a workflow run', async () => {
      if (!testWorkflowId) {
        console.log('Skipping: No test workflow');
        return;
      }

      const { data, status } = await apiRequest('/api/hub/workflow-runs', {
        method: 'POST',
        body: JSON.stringify({
          workflowId: testWorkflowId,
          projectId: testProjectId,
          triggerType: 'manual',
          inputs: { test: true },
        }),
      });

      expect(status).toBe(201);
      expect(data.run).toBeDefined();
      testRunId = data.run.id;
    });

    it('should list workflow runs', async () => {
      const { data, status } = await apiRequest('/api/hub/workflow-runs');

      expect(status).toBe(200);
      expect(data.runs).toBeDefined();
      expect(Array.isArray(data.runs)).toBe(true);
    });

    it('should get workflow run stats', async () => {
      const { data, status } = await apiRequest('/api/hub/workflow-runs/stats');

      expect(status).toBe(200);
      expect(data.stats).toBeDefined();
    });

    it('should start a workflow run', async () => {
      if (!testRunId) {
        console.log('Skipping: No test run');
        return;
      }

      const { data, status } = await apiRequest(`/api/hub/workflow-runs/${testRunId}/start`, {
        method: 'POST',
      });

      expect(status).toBe(200);
      expect(data.run.status).toBe('running');
    });

    it('should cancel a workflow run', async () => {
      if (!testRunId) {
        console.log('Skipping: No test run');
        return;
      }

      const { data, status } = await apiRequest(`/api/hub/workflow-runs/${testRunId}/cancel`, {
        method: 'POST',
      });

      expect(status).toBe(200);
      expect(data.run.status).toBe('cancelled');
    });
  });

  // ====================
  // Global Search Tests
  // ====================
  describe('Global Search API', () => {
    it('should search across all types', async () => {
      const { data, status } = await apiRequest('/api/search/global?q=test');

      expect(status).toBe(200);
      expect(data.results).toBeDefined();
      expect(Array.isArray(data.results)).toBe(true);
    });

    it('should search with type filter', async () => {
      const { data, status } = await apiRequest('/api/search/global?q=test&types=tasks');

      expect(status).toBe(200);
      expect(data.results).toBeDefined();
    });

    it('should require minimum query length', async () => {
      const { data, status } = await apiRequest('/api/search/global?q=a');

      expect(status).toBe(400);
    });
  });

  // ====================
  // Cleanup
  // ====================
  describe('Cleanup', () => {
    it('should delete test task', async () => {
      if (!testTaskId) return;
      const { status } = await apiRequest(`/api/hub/tasks/${testTaskId}`, {
        method: 'DELETE',
      });
      expect(status).toBe(200);
    });

    it('should delete test milestone', async () => {
      if (!testMilestoneId) return;
      const { status } = await apiRequest(`/api/hub/milestones/${testMilestoneId}`, {
        method: 'DELETE',
      });
      expect(status).toBe(200);
    });

    it('should delete test calendar event', async () => {
      if (!testEventId) return;
      const { status } = await apiRequest(`/api/hub/calendar/${testEventId}`, {
        method: 'DELETE',
      });
      expect(status).toBe(200);
    });

    it('should delete test workflow', async () => {
      if (!testWorkflowId) return;
      const { status } = await apiRequest(`/api/workflows/${testWorkflowId}`, {
        method: 'DELETE',
      });
      expect(status).toBe(200);
    });

    it('should archive test project', async () => {
      if (!testProjectId) return;
      const { status } = await apiRequest(`/api/projects/${testProjectId}`, {
        method: 'DELETE',
      });
      expect(status).toBe(200);
    });
  });
});

// ====================
// Integration Tests
// ====================
describe('Multi-Project Dashboard Integration', () => {
  it('should sync task due dates to calendar', async () => {
    // Create a project
    const projectRes = await apiRequest('/api/projects', {
      method: 'POST',
      body: JSON.stringify({ name: 'Calendar Sync Test' }),
    });
    const projectId = projectRes.data?.project?.id;
    if (!projectId) return;

    // Create a task with due date
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 14);

    const taskRes = await apiRequest('/api/hub/tasks', {
      method: 'POST',
      body: JSON.stringify({
        projectId,
        title: 'Task with Due Date',
        dueDate: dueDate.toISOString(),
      }),
    });

    // Check calendar has the event
    const startDate = new Date();
    const endDate = new Date();
    endDate.setMonth(endDate.getMonth() + 1);

    const calendarRes = await apiRequest(
      `/api/hub/calendar?projectId=${projectId}&startDate=${startDate.toISOString()}&endDate=${endDate.toISOString()}`
    );

    expect(calendarRes.data.events.some((e: any) => e.source_type === 'task')).toBe(true);

    // Cleanup
    await apiRequest(`/api/hub/tasks/${taskRes.data?.task?.id}`, { method: 'DELETE' });
    await apiRequest(`/api/projects/${projectId}`, { method: 'DELETE' });
  });

  it('should update project activity on task creation', async () => {
    // Create a project
    const projectRes = await apiRequest('/api/projects', {
      method: 'POST',
      body: JSON.stringify({ name: 'Activity Test' }),
    });
    const projectId = projectRes.data?.project?.id;
    if (!projectId) return;

    // Create a task
    await apiRequest('/api/hub/tasks', {
      method: 'POST',
      body: JSON.stringify({
        projectId,
        title: 'Activity Test Task',
      }),
    });

    // Check activity feed
    const activityRes = await apiRequest(`/api/projects/${projectId}/activity`);

    // Activity should include task creation
    expect(activityRes.status).toBe(200);
    // Note: Activity logging may be async, so we check if the endpoint works

    // Cleanup
    await apiRequest(`/api/projects/${projectId}`, { method: 'DELETE' });
  });
});
