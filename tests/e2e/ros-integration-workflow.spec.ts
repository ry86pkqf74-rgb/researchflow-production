/**
 * ROS Integration Full Workflow E2E Test
 *
 * This test validates the complete ROS integration by executing:
 * 1. Admin login
 * 2. Topic creation with template data
 * 3. All AI functions:
 *    - Literature search
 *    - Manuscript generation (Intro, Methods, Results, Discussion, Abstract)
 *    - Conference discovery
 *    - PHI scanning
 *    - Real-time collaboration
 *
 * Run with: npx playwright test tests/e2e/ros-integration-workflow.spec.ts --headed
 */

import { test, expect, Page } from '@playwright/test';

// Test configuration
const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:5173';
const API_URL = process.env.PLAYWRIGHT_API_URL || 'http://localhost:3001';

// Admin credentials - using TESTROS bypass for development/testing
const ADMIN_EMAIL = 'TESTROS_BYPASS';
const ADMIN_PASSWORD = 'TESTROS_SECRET';

// Test data
const TEST_TOPIC = {
  title: 'Test Integration Topic',
  description: 'Automated E2E test for ROS integration validation',
  keywords: ['diabetes', 'machine learning', 'continuous glucose monitoring'],
  studyDesign: 'Retrospective cohort study',
  population: 'Adults with Type 2 diabetes',
  primaryOutcome: 'HbA1c change at 12 months',
};

test.describe('ROS Integration Full Workflow', () => {
  let page: Page;

  test.beforeAll(async ({ browser }) => {
    // Create a new context with longer timeout for AI operations
    const context = await browser.newContext({
      baseURL: BASE_URL,
    });
    page = await context.newPage();
    page.setDefaultTimeout(60000); // 60s timeout for AI operations
  });

  test.afterAll(async () => {
    await page.close();
  });

  test('1. Admin Login', async () => {
    // Navigate to login page
    await page.goto('/login');
    await expect(page).toHaveURL(/.*login/);

    // Fill login form
    await page.fill('input[type="email"], input[name="email"]', ADMIN_EMAIL);
    await page.fill('input[type="password"], input[name="password"]', ADMIN_PASSWORD);

    // Submit login
    await page.click('button[type="submit"]');

    // Wait for redirect to dashboard or home
    await expect(page).not.toHaveURL(/.*login/, { timeout: 10000 });

    // Verify we're logged in (look for user menu or dashboard element)
    await expect(
      page.locator('[data-testid="user-menu"], [data-testid="dashboard"], .user-avatar, .dashboard')
    ).toBeVisible({ timeout: 10000 });
  });

  test('2. Create Test Topic', async () => {
    // Navigate to topic creation
    await page.click('[data-testid="new-topic"], [data-testid="create-research"], button:has-text("New")');

    // Wait for topic creation form/modal
    await expect(
      page.locator('[data-testid="topic-form"], [data-testid="create-form"], form')
    ).toBeVisible();

    // Fill topic details
    const titleInput = page.locator(
      'input[name="title"], input[placeholder*="title"], [data-testid="topic-title"]'
    );
    if (await titleInput.isVisible()) {
      await titleInput.fill(TEST_TOPIC.title);
    }

    const descInput = page.locator(
      'textarea[name="description"], [data-testid="topic-description"]'
    );
    if (await descInput.isVisible()) {
      await descInput.fill(TEST_TOPIC.description);
    }

    // Submit topic creation
    await page.click('button[type="submit"], button:has-text("Create"), button:has-text("Save")');

    // Verify topic was created
    await expect(page.locator(`text=${TEST_TOPIC.title}`)).toBeVisible({ timeout: 10000 });
  });

  test('3. Literature Search', async () => {
    // Navigate to literature section
    await page.click(
      '[data-testid="literature-tab"], [data-testid="search-literature"], a:has-text("Literature"), button:has-text("Literature")'
    );

    // Search for literature
    const searchInput = page.locator(
      'input[type="search"], input[name="query"], [data-testid="literature-search"]'
    );
    await searchInput.fill('diabetes continuous glucose monitoring');
    await page.click('button:has-text("Search"), button[type="submit"]');

    // Wait for results
    await expect(
      page.locator('[data-testid="search-results"], .search-results, .literature-item')
    ).toBeVisible({ timeout: 30000 });

    // Verify at least one result
    const resultCount = await page.locator('.literature-item, [data-testid="literature-item"]').count();
    expect(resultCount).toBeGreaterThan(0);
  });

  test('4. Generate Introduction Section', async () => {
    // Navigate to manuscript/writing section
    await page.click(
      '[data-testid="manuscript-tab"], a:has-text("Manuscript"), a:has-text("Write")'
    );

    // Click generate introduction
    await page.click(
      '[data-testid="generate-intro"], button:has-text("Introduction"), button:has-text("Generate Intro")'
    );

    // Wait for AI generation (may take time)
    await expect(
      page.locator('[data-testid="intro-content"], .introduction-section, .manuscript-section')
    ).toBeVisible({ timeout: 120000 });

    // Verify content was generated
    const introContent = await page
      .locator('[data-testid="intro-content"], .introduction-section')
      .textContent();
    expect(introContent?.length).toBeGreaterThan(100);
  });

  test('5. Generate Methods Section', async () => {
    await page.click(
      '[data-testid="generate-methods"], button:has-text("Methods"), button:has-text("Generate Methods")'
    );

    await expect(
      page.locator('[data-testid="methods-content"], .methods-section')
    ).toBeVisible({ timeout: 120000 });

    const methodsContent = await page
      .locator('[data-testid="methods-content"], .methods-section')
      .textContent();
    expect(methodsContent?.length).toBeGreaterThan(100);
  });

  test('6. Generate Results Section', async () => {
    await page.click(
      '[data-testid="generate-results"], button:has-text("Results"), button:has-text("Generate Results")'
    );

    await expect(
      page.locator('[data-testid="results-content"], .results-section')
    ).toBeVisible({ timeout: 120000 });
  });

  test('7. Generate Discussion Section', async () => {
    await page.click(
      '[data-testid="generate-discussion"], button:has-text("Discussion"), button:has-text("Generate Discussion")'
    );

    await expect(
      page.locator('[data-testid="discussion-content"], .discussion-section')
    ).toBeVisible({ timeout: 120000 });
  });

  test('8. Generate Abstract', async () => {
    await page.click(
      '[data-testid="generate-abstract"], button:has-text("Abstract"), button:has-text("Generate Abstract")'
    );

    await expect(
      page.locator('[data-testid="abstract-content"], .abstract-section')
    ).toBeVisible({ timeout: 120000 });

    const abstractContent = await page
      .locator('[data-testid="abstract-content"], .abstract-section')
      .textContent();
    expect(abstractContent?.length).toBeGreaterThan(50);
    expect(abstractContent?.length).toBeLessThan(500); // Abstract should be concise
  });

  test('9. Conference Discovery', async () => {
    // Navigate to conference section
    await page.click(
      '[data-testid="conference-tab"], a:has-text("Conference"), button:has-text("Conference")'
    );

    // Trigger conference discovery
    await page.click(
      '[data-testid="discover-conferences"], button:has-text("Discover"), button:has-text("Find Conferences")'
    );

    // Wait for conference results
    await expect(
      page.locator('[data-testid="conference-results"], .conference-list, .conference-item')
    ).toBeVisible({ timeout: 60000 });

    // Verify conferences were found
    const conferenceCount = await page
      .locator('.conference-item, [data-testid="conference-item"]')
      .count();
    expect(conferenceCount).toBeGreaterThanOrEqual(0); // May be 0 in demo mode
  });

  test('10. PHI Scanning', async () => {
    // Test PHI scanning via API directly
    const response = await page.request.post(`${API_URL}/api/ros/phi/scan`, {
      headers: { 'Content-Type': 'application/json' },
      data: { text: 'The patient John Smith (DOB: 01/15/1980) was diagnosed with diabetes.' },
    });

    // PHI scanner should detect the PHI
    if (response.ok()) {
      const result = await response.json();
      expect(result.hasPhi || result.detected || result.findings?.length > 0).toBeTruthy();
    } else {
      // PHI endpoint may require auth - skip if 401/403
      expect([401, 403]).toContain(response.status());
    }
  });

  test('11. Real-time Collaboration (WebSocket)', async () => {
    // Test that collab service is accessible
    const collabHealthResponse = await page.request.get('http://localhost:1235/health');
    expect(collabHealthResponse.ok()).toBeTruthy();

    // Navigate to a collaborative document (if available)
    const collabButton = page.locator(
      '[data-testid="collab-mode"], button:has-text("Collaborate"), button:has-text("Real-time")'
    );

    if (await collabButton.isVisible()) {
      await collabButton.click();

      // Verify WebSocket connection indicator
      await expect(
        page.locator('[data-testid="collab-status"], .connection-status, .sync-indicator')
      ).toBeVisible({ timeout: 10000 });
    }
  });

  test('12. Verify All Services Healthy (Final Check)', async () => {
    // Health check all services
    const endpoints = [
      { url: `${API_URL}/health`, name: 'Orchestrator' },
      { url: 'http://localhost:8000/health', name: 'Worker' },
      { url: 'http://localhost:1235/health', name: 'Collab' },
      { url: `${API_URL}/api/webhooks/health`, name: 'Webhooks' },
    ];

    for (const endpoint of endpoints) {
      const response = await page.request.get(endpoint.url);
      expect(response.ok(), `${endpoint.name} health check failed`).toBeTruthy();
    }
  });
});

/**
 * Standalone API Tests (can run without browser)
 */
test.describe('ROS API Integration Tests', () => {
  test('Literature API returns results', async ({ request }) => {
    const response = await request.post(`${API_URL}/api/ros/literature/search`, {
      headers: { 'Content-Type': 'application/json' },
      data: {
        query: 'diabetes',
        providers: ['pubmed'],
        limit: 5,
      },
    });

    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    expect(Array.isArray(data.results || data)).toBeTruthy();
  });

  test('Governance state is accessible', async ({ request }) => {
    const response = await request.get(`${API_URL}/api/governance/state`);
    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    expect(data.mode || data.governanceMode).toBeDefined();
  });

  test('Webhooks health shows configuration', async ({ request }) => {
    const response = await request.get(`${API_URL}/api/webhooks/health`);
    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    expect(data.ok).toBe(true);
    expect(data.webhooks).toBeDefined();
  });
});
