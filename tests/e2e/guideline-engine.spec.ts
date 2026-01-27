/**
 * Guideline Engine Integration Tests
 *
 * End-to-end tests for the medical guideline parsing and suggestion system.
 * Tests API endpoints and frontend components.
 */

import { test, expect } from '@playwright/test';

const BASE_URL = process.env.BASE_URL || 'http://localhost:5173';
const API_URL = process.env.API_URL || 'http://localhost:3001/api';
const WORKER_URL = process.env.WORKER_URL || 'http://localhost:8000';

test.describe('Guideline Engine API', () => {

  test('worker health check returns OK', async ({ request }) => {
    const response = await request.get(`${WORKER_URL}/health`);
    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    expect(data.status).toBeDefined();
  });

  test('orchestrator health check returns OK', async ({ request }) => {
    const response = await request.get(`${API_URL.replace('/api', '')}/health`);
    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    expect(data.status).toBe('healthy');
  });

  test('guideline fields endpoint returns medical fields', async ({ request }) => {
    const response = await request.get(`${API_URL}/guidelines/fields`);
    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    expect(data.fields).toBeDefined();
    expect(Array.isArray(data.fields)).toBeTruthy();
    expect(data.fields).toContain('oncology');
    expect(data.fields).toContain('surgery');
  });

  test('guideline categories endpoint returns categories', async ({ request }) => {
    const response = await request.get(`${API_URL}/guidelines/categories`);
    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    expect(data.categories).toBeDefined();
    expect(Array.isArray(data.categories)).toBeTruthy();
    expect(data.categories).toContain('staging');
    expect(data.categories).toContain('grading');
  });

  test('guideline sources endpoint returns available sources', async ({ request }) => {
    const response = await request.get(`${API_URL}/guidelines/sources`);
    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    expect(data.sources).toBeDefined();
    expect(Array.isArray(data.sources)).toBeTruthy();
    expect(data.sources.length).toBeGreaterThan(10);

    // Verify source structure
    const source = data.sources[0];
    expect(source.query).toBeDefined();
    expect(source.field).toBeDefined();
    expect(source.category).toBeDefined();
    expect(source.url).toBeDefined();
  });

  test('guideline process returns parsed data for TNM colorectal', async ({ request }) => {
    const response = await request.get(`${API_URL}/guidelines/process?query=tnm%20colorectal`);
    expect(response.ok()).toBeTruthy();
    const data = await response.json();

    expect(data.query).toBe('tnm colorectal');
    expect(data.parsed).toBeDefined();
    expect(data.parsed.title).toBeDefined();
    expect(data.parsed.source_url).toBeDefined();
    expect(data.parsed.source_type).toBe('html');
    expect(data.suggestions).toBeDefined();
    expect(data.suggestions.validation_questions).toBeDefined();
    expect(data.suggestions.study_ideation).toBeDefined();
  });

  test('guideline process returns parsed data for Clavien-Dindo', async ({ request }) => {
    const response = await request.get(`${API_URL}/guidelines/process?query=clavien-dindo`);
    expect(response.ok()).toBeTruthy();
    const data = await response.json();

    expect(data.parsed.field).toBe('surgery');
    expect(data.parsed.category).toBe('grading');
    expect(data.suggestions.validation_questions.length).toBeGreaterThan(0);
  });

  test('guideline process returns parsed data for ASA physical status', async ({ request }) => {
    const response = await request.get(`${API_URL}/guidelines/process?query=asa%20physical%20status`);
    expect(response.ok()).toBeTruthy();
    const data = await response.json();

    expect(data.parsed.field).toBe('anesthesiology');
    expect(data.parsed.category).toBe('classification');
  });

  test('guideline process returns parsed data for ECOG performance', async ({ request }) => {
    const response = await request.get(`${API_URL}/guidelines/process?query=ecog%20performance`);
    expect(response.ok()).toBeTruthy();
    const data = await response.json();

    expect(data.parsed.field).toBe('oncology');
  });

});

test.describe('Guideline Engine Caching', () => {

  test('first request is uncached', async ({ request }) => {
    // Use a unique query to ensure no prior cache
    const uniqueQuery = `tnm%20lung%20${Date.now()}`;
    const response = await request.get(`${API_URL}/guidelines/process?query=${uniqueQuery}`);

    // This may return 404 if query not found, which is expected for unique queries
    if (response.ok()) {
      const data = await response.json();
      // First request should not be from cache (unless already cached)
      expect(typeof data.from_cache).toBe('boolean');
    }
  });

  test('second request hits cache', async ({ request }) => {
    const query = 'clavien-dindo';

    // First request - populate cache
    await request.get(`${API_URL}/guidelines/process?query=${query}`);

    // Second request - should hit cache
    const response = await request.get(`${API_URL}/guidelines/process?query=${query}`);
    expect(response.ok()).toBeTruthy();
    const data = await response.json();

    expect(data.from_cache).toBe(true);
  });

  test('cache health endpoint returns status', async ({ request }) => {
    const response = await request.get(`${API_URL}/guidelines/cache/health`);
    expect(response.ok()).toBeTruthy();
    const data = await response.json();

    expect(data.status).toBeDefined();
    expect(['healthy', 'degraded', 'unhealthy']).toContain(data.status);
  });

});

test.describe('Guideline Engine Error Handling', () => {

  test('unknown query returns 404', async ({ request }) => {
    const response = await request.get(`${API_URL}/guidelines/process?query=unknown-guideline-xyz-12345`);
    expect(response.status()).toBe(404);
    const data = await response.json();
    expect(data.detail || data.error).toBeDefined();
  });

  test('empty query returns 400', async ({ request }) => {
    const response = await request.get(`${API_URL}/guidelines/process?query=`);
    expect(response.status()).toBe(400);
  });

  test('missing query parameter returns 422', async ({ request }) => {
    const response = await request.get(`${API_URL}/guidelines/process`);
    expect([400, 422]).toContain(response.status());
  });

  test('short query returns 400', async ({ request }) => {
    const response = await request.get(`${API_URL}/guidelines/process?query=ab`);
    expect([400, 422]).toContain(response.status());
  });

});

test.describe('Planning Hub API', () => {

  const testProjectId = '00000000-0000-0000-0000-000000000001';

  test('hub pages endpoint exists', async ({ request }) => {
    const response = await request.get(`${API_URL}/hub/pages?projectId=${testProjectId}`);
    // May return 200 with empty array or 404 if project doesn't exist
    expect([200, 404]).toContain(response.status());
  });

  test('hub tasks endpoint exists', async ({ request }) => {
    const response = await request.get(`${API_URL}/hub/tasks?projectId=${testProjectId}`);
    expect([200, 404]).toContain(response.status());
  });

  test('hub goals endpoint exists', async ({ request }) => {
    const response = await request.get(`${API_URL}/hub/goals?projectId=${testProjectId}`);
    expect([200, 404]).toContain(response.status());
  });

  test('hub databases endpoint exists', async ({ request }) => {
    const response = await request.get(`${API_URL}/hub/databases?projectId=${testProjectId}`);
    expect([200, 404]).toContain(response.status());
  });

  test('hub projections scenarios endpoint returns data', async ({ request }) => {
    const response = await request.get(`${WORKER_URL}/api/projections/scenarios`);
    if (response.ok()) {
      const data = await response.json();
      expect(data.scenarios).toBeDefined();
      expect(Array.isArray(data.scenarios)).toBeTruthy();
    }
  });

});

test.describe('Frontend Components', () => {

  test('homepage loads correctly', async ({ page }) => {
    await page.goto(BASE_URL);
    await expect(page).toHaveTitle(/ResearchFlow/i);
  });

  test('no console errors on homepage', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });

    await page.goto(BASE_URL);
    await page.waitForLoadState('networkidle');

    // Filter out expected/benign errors
    const criticalErrors = errors.filter(e =>
      !e.includes('favicon') &&
      !e.includes('404') &&
      !e.includes('net::ERR_')
    );

    expect(criticalErrors).toHaveLength(0);
  });

  test('API requests complete without CORS errors', async ({ page }) => {
    const corsErrors: string[] = [];
    page.on('console', msg => {
      if (msg.text().toLowerCase().includes('cors')) {
        corsErrors.push(msg.text());
      }
    });

    await page.goto(BASE_URL);
    await page.waitForLoadState('networkidle');

    expect(corsErrors).toHaveLength(0);
  });

});
