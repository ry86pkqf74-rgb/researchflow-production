/**
 * ResearchFlow Load Test Suite
 *
 * Uses k6 (https://k6.io/) for load testing
 *
 * Usage:
 *   # Install k6: https://k6.io/docs/getting-started/installation/
 *   k6 run tests/perf/load_test.js
 *
 *   # With custom base URL:
 *   k6 run -e BASE_URL=http://localhost:3001 tests/perf/load_test.js
 *
 *   # With more VUs:
 *   k6 run --vus 50 --duration 5m tests/perf/load_test.js
 */

import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';

// Custom metrics
const errorRate = new Rate('errors');
const healthCheckDuration = new Trend('health_check_duration');
const apiLatency = new Trend('api_latency');
const throughput = new Counter('requests_total');

// Test configuration
export const options = {
  // Stages for ramping up/down
  stages: [
    { duration: '30s', target: 10 },  // Ramp up to 10 users
    { duration: '1m', target: 10 },   // Stay at 10 users
    { duration: '30s', target: 20 },  // Ramp up to 20 users
    { duration: '1m', target: 20 },   // Stay at 20 users
    { duration: '30s', target: 0 },   // Ramp down
  ],

  // Thresholds for pass/fail
  thresholds: {
    http_req_duration: ['p(95)<500', 'p(99)<1000'], // 95% under 500ms, 99% under 1s
    errors: ['rate<0.1'],                            // Error rate under 10%
    health_check_duration: ['p(99)<100'],            // Health checks under 100ms
    http_req_failed: ['rate<0.05'],                  // Less than 5% failed requests
  },
};

// Configuration
const BASE_URL = __ENV.BASE_URL || 'http://localhost:3001';
const WORKER_URL = __ENV.WORKER_URL || 'http://localhost:8000';

// Helper function to check response
function checkResponse(res, name) {
  const success = check(res, {
    [`${name} - status is 200`]: (r) => r.status === 200,
    [`${name} - response time OK`]: (r) => r.timings.duration < 1000,
  });

  errorRate.add(!success);
  throughput.add(1);

  return success;
}

// Default function - main test scenario
export default function () {
  group('Health Checks', function () {
    // Orchestrator health check
    const orchestratorHealth = http.get(`${BASE_URL}/health`);
    healthCheckDuration.add(orchestratorHealth.timings.duration);
    checkResponse(orchestratorHealth, 'Orchestrator Health');

    // Worker health check
    const workerHealth = http.get(`${WORKER_URL}/health`);
    healthCheckDuration.add(workerHealth.timings.duration);
    checkResponse(workerHealth, 'Worker Health');
  });

  sleep(1);

  group('API Endpoints', function () {
    // Test topics endpoint
    const topicsRes = http.get(`${BASE_URL}/api/topics`);
    apiLatency.add(topicsRes.timings.duration);
    checkResponse(topicsRes, 'Get Topics');

    sleep(0.5);

    // Test ROS mode check
    const modeRes = http.get(`${BASE_URL}/api/ros/mode`);
    apiLatency.add(modeRes.timings.duration);
    checkResponse(modeRes, 'ROS Mode');

    sleep(0.5);
  });

  group('Conference Discovery (DEMO)', function () {
    const payload = JSON.stringify({
      keywords: ['machine learning', 'healthcare'],
      max_candidates: 5,
      min_relevance_score: 0.3,
    });

    const params = {
      headers: {
        'Content-Type': 'application/json',
      },
    };

    const discoverRes = http.post(
      `${BASE_URL}/api/ros/conference/discover`,
      payload,
      params
    );

    apiLatency.add(discoverRes.timings.duration);
    checkResponse(discoverRes, 'Conference Discovery');
  });

  sleep(2);
}

// Smoke test - quick sanity check
export function smoke() {
  const res = http.get(`${BASE_URL}/health`);
  check(res, {
    'smoke test - health endpoint': (r) => r.status === 200,
  });
}

// Stress test - push to limits
export function stress() {
  // More aggressive testing
  for (let i = 0; i < 5; i++) {
    http.get(`${BASE_URL}/health`);
    http.get(`${BASE_URL}/api/topics`);
    http.get(`${BASE_URL}/api/ros/mode`);
  }
  sleep(0.1);
}

// Soak test - long duration
export function soak() {
  // Designed for extended runs
  group('Soak Test Iteration', function () {
    const healthRes = http.get(`${BASE_URL}/health`);
    checkResponse(healthRes, 'Soak Health Check');

    sleep(5); // Longer sleep for soak tests
  });
}

// Handle test summary
export function handleSummary(data) {
  return {
    'tests/perf/summary.json': JSON.stringify(data, null, 2),
    stdout: textSummary(data, { indent: '  ', enableColors: true }),
  };
}

// Text summary helper
function textSummary(data, opts) {
  const { indent = '', enableColors = false } = opts || {};
  const green = enableColors ? '\x1b[32m' : '';
  const red = enableColors ? '\x1b[31m' : '';
  const reset = enableColors ? '\x1b[0m' : '';

  let summary = '\n';
  summary += `${indent}╔══════════════════════════════════════════════════╗\n`;
  summary += `${indent}║           ResearchFlow Load Test Results          ║\n`;
  summary += `${indent}╠══════════════════════════════════════════════════╣\n`;

  // Key metrics
  if (data.metrics) {
    const httpReqs = data.metrics.http_reqs;
    const httpDuration = data.metrics.http_req_duration;
    const errors = data.metrics.errors;

    if (httpReqs) {
      summary += `${indent}║ Total Requests: ${String(httpReqs.values.count).padStart(28)} ║\n`;
      summary += `${indent}║ Requests/sec:   ${String(httpReqs.values.rate.toFixed(2)).padStart(28)} ║\n`;
    }

    if (httpDuration) {
      summary += `${indent}║ Avg Duration:   ${String(httpDuration.values.avg.toFixed(2) + 'ms').padStart(28)} ║\n`;
      summary += `${indent}║ P95 Duration:   ${String(httpDuration.values['p(95)'].toFixed(2) + 'ms').padStart(28)} ║\n`;
      summary += `${indent}║ P99 Duration:   ${String(httpDuration.values['p(99)'].toFixed(2) + 'ms').padStart(28)} ║\n`;
    }

    if (errors) {
      const errorRateValue = errors.values.rate * 100;
      const color = errorRateValue > 10 ? red : green;
      summary += `${indent}║ Error Rate:     ${color}${String(errorRateValue.toFixed(2) + '%').padStart(28)}${reset} ║\n`;
    }
  }

  summary += `${indent}╚══════════════════════════════════════════════════╝\n`;

  // Thresholds
  if (data.thresholds) {
    summary += `\n${indent}Thresholds:\n`;
    for (const [name, threshold] of Object.entries(data.thresholds)) {
      const status = threshold.ok ? `${green}✓ PASS${reset}` : `${red}✗ FAIL${reset}`;
      summary += `${indent}  ${name}: ${status}\n`;
    }
  }

  return summary;
}
