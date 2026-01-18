/**
 * MSW Request Handlers for E2E Tests
 *
 * These handlers intercept API requests during E2E tests,
 * allowing tests to run without a real database.
 */

import { http, HttpResponse } from 'msw';
import { E2E_USERS, E2EUser } from '../fixtures/users.fixture';
import { createMockScanResult, MOCK_PHI, ALL_MOCK_PHI } from '../fixtures/phi-data.fixture';

// Store for test state that can be modified during tests
let currentUser: E2EUser | null = null;
let currentMode: 'DEMO' | 'LIVE' = 'DEMO';
let pendingApprovals: Array<{
  id: string;
  type: string;
  status: 'PENDING' | 'APPROVED' | 'DENIED';
  requestedBy: string;
  justification?: string;
}> = [];

/**
 * Set the current user for mock responses.
 */
export function setMockUser(user: E2EUser | null): void {
  currentUser = user;
}

/**
 * Set the current governance mode for mock responses.
 */
export function setMockMode(mode: 'DEMO' | 'LIVE'): void {
  currentMode = mode;
}

/**
 * Reset all mock state to defaults.
 */
export function resetMockState(): void {
  currentUser = null;
  currentMode = 'DEMO';
  pendingApprovals = [];
}

/**
 * Add a pending approval for testing approval flows.
 */
export function addPendingApproval(approval: typeof pendingApprovals[0]): void {
  pendingApprovals.push(approval);
}

/**
 * MSW request handlers for API endpoints.
 */
export const handlers = [
  // Authentication endpoints
  http.get('/api/auth/user', () => {
    if (!currentUser) {
      return HttpResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }
    return HttpResponse.json(currentUser);
  }),

  http.post('/api/logout', () => {
    currentUser = null;
    currentMode = 'DEMO';
    return HttpResponse.json({ success: true });
  }),

  // Governance endpoints
  http.get('/api/governance/mode', () => {
    return HttpResponse.json({ mode: currentMode });
  }),

  http.post('/api/governance/mode', async ({ request }) => {
    // Only ADMIN can change mode
    if (!currentUser || currentUser.role !== 'ADMIN') {
      return HttpResponse.json(
        { error: 'Insufficient permissions', code: 'INSUFFICIENT_ROLE' },
        { status: 403 }
      );
    }

    const body = await request.json() as { mode: 'DEMO' | 'LIVE' };
    currentMode = body.mode;
    return HttpResponse.json({ mode: currentMode });
  }),

  http.get('/api/governance/state', () => {
    return HttpResponse.json({
      mode: currentMode,
      flags: {
        ALLOW_UPLOADS: currentMode === 'LIVE',
        ALLOW_EXPORTS: currentMode === 'LIVE',
        ALLOW_LLM_CALLS: currentMode === 'LIVE',
        REQUIRE_PHI_SCAN: true,
      },
      user: currentUser,
      timestamp: new Date().toISOString(),
    });
  }),

  http.get('/api/governance/approvals', () => {
    return HttpResponse.json({ approvals: pendingApprovals });
  }),

  http.post('/api/governance/approvals/:approvalId/approve', async ({ params, request }) => {
    if (!currentUser || !['STEWARD', 'ADMIN'].includes(currentUser.role)) {
      return HttpResponse.json(
        { error: 'Insufficient permissions', code: 'INSUFFICIENT_ROLE' },
        { status: 403 }
      );
    }

    const { approvalId } = params;
    const approval = pendingApprovals.find((a) => a.id === approvalId);
    if (approval) {
      approval.status = 'APPROVED';
    }

    return HttpResponse.json({ success: true, approval });
  }),

  http.post('/api/governance/approvals/:approvalId/deny', async ({ params }) => {
    if (!currentUser || !['STEWARD', 'ADMIN'].includes(currentUser.role)) {
      return HttpResponse.json(
        { error: 'Insufficient permissions', code: 'INSUFFICIENT_ROLE' },
        { status: 403 }
      );
    }

    const { approvalId } = params;
    const approval = pendingApprovals.find((a) => a.id === approvalId);
    if (approval) {
      approval.status = 'DENIED';
    }

    return HttpResponse.json({ success: true, approval });
  }),

  // PHI scanning endpoints
  http.post('/api/ros/phi/scan', async () => {
    // Simulate PHI scan - in DEMO mode, always return clean
    if (currentMode === 'DEMO') {
      return HttpResponse.json(createMockScanResult('PASS', []));
    }

    // In LIVE mode, return mock PHI detection
    return HttpResponse.json(
      createMockScanResult('FAIL', [MOCK_PHI.ssn, MOCK_PHI.mrn])
    );
  }),

  http.post('/api/ros/phi/override', async ({ request }) => {
    if (!currentUser || !['STEWARD', 'ADMIN'].includes(currentUser.role)) {
      return HttpResponse.json(
        { error: 'Insufficient permissions', code: 'INSUFFICIENT_ROLE' },
        { status: 403 }
      );
    }

    const body = await request.json() as { justification?: string };
    if (!body.justification || body.justification.length < 20) {
      return HttpResponse.json(
        { error: 'Justification must be at least 20 characters' },
        { status: 400 }
      );
    }

    return HttpResponse.json({
      success: true,
      status: 'OVERRIDDEN',
      overriddenBy: currentUser.id,
      justification: body.justification,
    });
  }),

  http.post('/api/audit/phi-reveal', async () => {
    // Log PHI reveal attempt
    return HttpResponse.json({ logged: true });
  }),

  // Pipeline endpoints
  http.get('/api/ros/pipeline/runs', () => {
    return HttpResponse.json({
      runs: [
        {
          id: 'run-001',
          status: 'completed',
          stage: 9,
          startedAt: new Date(Date.now() - 3600000).toISOString(),
          completedAt: new Date().toISOString(),
        },
        {
          id: 'run-002',
          status: 'pending',
          stage: 1,
          startedAt: null,
          completedAt: null,
        },
      ],
    });
  }),

  http.get('/api/ros/pipeline/run/:runId', ({ params }) => {
    const { runId } = params;
    return HttpResponse.json({
      id: runId,
      status: 'completed',
      stage: 9,
      artifacts: [],
      logs: [],
    });
  }),

  // System status
  http.get('/api/ros/status', () => {
    return HttpResponse.json({
      status: 'healthy',
      mode: currentMode,
      version: '1.0.0',
      uptime: 3600,
    });
  }),

  // Protected route examples for testing RBAC
  http.post('/api/ros/artifacts', async () => {
    if (!currentUser) {
      return HttpResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }
    if (!['RESEARCHER', 'STEWARD', 'ADMIN'].includes(currentUser.role)) {
      return HttpResponse.json(
        { error: 'Insufficient permissions', required: 'RESEARCHER', userRole: currentUser.role },
        { status: 403 }
      );
    }
    return HttpResponse.json({ success: true, artifactId: 'artifact-001' });
  }),

  http.post('/api/governance/approve', async () => {
    if (!currentUser) {
      return HttpResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }
    if (!['STEWARD', 'ADMIN'].includes(currentUser.role)) {
      return HttpResponse.json(
        { error: 'Insufficient permissions', required: 'STEWARD', userRole: currentUser.role },
        { status: 403 }
      );
    }
    return HttpResponse.json({ success: true });
  }),
];
