/**
 * K6 Load Testing Configuration for ResearchFlow
 *
 * This configuration defines load testing scenarios for critical API endpoints.
 * Ensures the system can handle target concurrent users with acceptable performance.
 *
 * Run with: k6 run tests/load/k6-config.js
 * Install k6: https://k6.io/docs/getting-started/installation/
 */

import http from 'k6/http';
import { check, group, sleep } from 'k6';
import { Rate, Trend, Gauge, Counter } from 'k6/metrics';

// Custom metrics
const errorRate = new Rate('errors');
const authDuration = new Trend('auth_duration');
const projectsDuration = new Trend('projects_duration');
const governanceDuration = new Trend('governance_duration');
const activeUsers = new Gauge('active_users');
const requestCount = new Counter('requests');

// Load test configuration
export const options = {
  stages: [
    // Ramp up to target
    { duration: '2m', target: 20 },  // 0 to 20 users over 2 minutes
    { duration: '3m', target: 50 },  // 20 to 50 users over 3 minutes
    { duration: '5m', target: 100 }, // 50 to 100 users over 5 minutes
    // Stay at target
    { duration: '10m', target: 100 }, // Stay at 100 users for 10 minutes
    // Ramp down
    { duration: '3m', target: 50 },  // 100 to 50 users over 3 minutes
    { duration: '2m', target: 0 },   // 50 to 0 users over 2 minutes
  ],

  // Thresholds for test pass/fail
  thresholds: {
    // API response time thresholds
    'auth_duration': ['p(95)<200', 'p(99)<500', 'avg<150'],
    'projects_duration': ['p(95)<200', 'p(99)<500', 'avg<150'],
    'governance_duration': ['p(95)<300', 'p(99)<700', 'avg<200'],

    // Error rate threshold - fail if error rate exceeds 1%
    'errors': ['rate<0.01'],

    // HTTP status code checks
    'http_req_duration': ['p(95)<500', 'p(99)<1000'],
  },

  // Virtual User (VU) limit - maximum concurrent users
  vus: 100,
  duration: '25m', // Total test duration
};

// Base URL configuration
const BASE_URL = __ENV.BASE_URL || 'http://localhost:3001';
const API_BASE = `${BASE_URL}/api`;

// Test helper functions
function checkResponse(response, expectedStatus = 200) {
  return check(response, {
    'status is correct': (r) => r.status === expectedStatus,
    'response time < 500ms': (r) => r.timings.duration < 500,
    'has content': (r) => r.body.length > 0,
  });
}

function handleError(error) {
  errorRate.add(1);
  console.error(`Request failed: ${error}`);
}

/**
 * Authentication Endpoint Load Test
 * Tests login endpoint under load
 */
export function testAuthLogin() {
  group('POST /api/auth/login', () => {
    const loginPayload = JSON.stringify({
      email: `user${Math.floor(Math.random() * 10000)}@example.com`,
      password: 'test-password-123',
    });

    const params = {
      headers: {
        'Content-Type': 'application/json',
      },
      timeout: '10s',
    };

    const response = http.post(`${API_BASE}/auth/login`, loginPayload, params);

    // Track metrics
    activeUsers.add(__VU);
    requestCount.add(1);
    authDuration.add(response.timings.duration);

    // Check response
    const passed = checkResponse(response, 200);
    if (!passed) {
      errorRate.add(1);
    }

    sleep(1);
  });
}

/**
 * Projects Endpoint Load Test
 * Tests getting projects list under load
 */
export function testGetProjects() {
  group('GET /api/projects', () => {
    const authToken = generateMockToken();

    const params = {
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json',
      },
      timeout: '10s',
    };

    const response = http.get(`${API_BASE}/projects`, params);

    // Track metrics
    activeUsers.add(__VU);
    requestCount.add(1);
    projectsDuration.add(response.timings.duration);

    // Check response
    const passed = check(response, {
      'status is 200': (r) => r.status === 200,
      'response time < 200ms': (r) => r.timings.duration < 200,
      'has projects array': (r) => r.body.includes('projects') || r.status !== 200,
    });

    if (!passed) {
      errorRate.add(1);
    }

    sleep(1);
  });
}

/**
 * Governance Endpoint Load Test
 * Tests governance/pending endpoint under load
 */
export function testGovernancePending() {
  group('GET /api/governance/pending', () => {
    const authToken = generateMockToken();

    const params = {
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json',
      },
      timeout: '10s',
    };

    const response = http.get(`${API_BASE}/governance/pending`, params);

    // Track metrics
    activeUsers.add(__VU);
    requestCount.add(1);
    governanceDuration.add(response.timings.duration);

    // Check response
    const passed = check(response, {
      'status is 200 or 401': (r) => r.status === 200 || r.status === 401,
      'response time < 300ms': (r) => r.timings.duration < 300,
    });

    if (!passed) {
      errorRate.add(1);
    }

    sleep(1);
  });
}

/**
 * Combined Realistic Workflow
 * Simulates typical user journey with multiple endpoint calls
 */
export function testRealisticWorkflow() {
  group('User Workflow', () => {
    // Step 1: Login
    const loginPayload = JSON.stringify({
      email: `user${Math.floor(Math.random() * 10000)}@example.com`,
      password: 'test-password-123',
    });

    const loginResponse = http.post(`${API_BASE}/auth/login`, loginPayload, {
      headers: { 'Content-Type': 'application/json' },
    });

    if (!checkResponse(loginResponse)) {
      errorRate.add(1);
      return; // Stop if login fails
    }

    const authToken = extractToken(loginResponse.body);
    authDuration.add(loginResponse.timings.duration);
    sleep(1);

    // Step 2: Get projects
    const projectsResponse = http.get(`${API_BASE}/projects`, {
      headers: { 'Authorization': `Bearer ${authToken}` },
    });

    if (!checkResponse(projectsResponse)) {
      errorRate.add(1);
    }

    projectsDuration.add(projectsResponse.timings.duration);
    sleep(2);

    // Step 3: Get governance status
    const govResponse = http.get(`${API_BASE}/governance/pending`, {
      headers: { 'Authorization': `Bearer ${authToken}` },
    });

    if (!checkResponse(govResponse, [200, 401])) {
      errorRate.add(1);
    }

    governanceDuration.add(govResponse.timings.duration);
    sleep(1);
  });
}

/**
 * Stress Test Scenario
 * Hits endpoints rapidly to find breaking points
 */
export function stressTest() {
  group('Stress Test - Rapid Requests', () => {
    const authToken = generateMockToken();

    // Make multiple rapid requests
    for (let i = 0; i < 5; i++) {
      const response = http.get(`${API_BASE}/projects`, {
        headers: { 'Authorization': `Bearer ${authToken}` },
      });

      if (response.status !== 200) {
        errorRate.add(1);
      }

      requestCount.add(1);
    }

    sleep(2);
  });
}

/**
 * Spike Test Scenario
 * Simulates sudden traffic spike
 */
export function spikeTest() {
  if (__VU <= 20) {
    // Only run for first 20 VUs to avoid overwhelming
    testRealisticWorkflow();
  }
}

// Helper function to generate mock auth token
function generateMockToken() {
  return 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';
}

// Helper function to extract token from response
function extractToken(responseBody) {
  try {
    const body = JSON.parse(responseBody);
    return body.token || body.access_token || generateMockToken();
  } catch {
    return generateMockToken();
  }
}

// Main default function - runs all tests
export default function () {
  // Distribute load across different endpoints
  const choice = Math.random();

  if (choice < 0.3) {
    testAuthLogin();
  } else if (choice < 0.6) {
    testGetProjects();
  } else if (choice < 0.85) {
    testGovernancePending();
  } else {
    testRealisticWorkflow();
  }
}

// Export individual functions for specific scenario testing
export { testAuthLogin as authLoadTest };
export { testGetProjects as projectsLoadTest };
export { testGovernancePending as governanceLoadTest };
export { testRealisticWorkflow as workflowTest };
export { stressTest };
export { spikeTest };
