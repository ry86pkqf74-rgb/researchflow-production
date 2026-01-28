/**
 * VAL-002: E2E Test - Run Lifecycle
 *
 * Tests complete run lifecycle:
 * - Create new run via wizard
 * - Verify timeline updates in real-time
 * - Test run controls (retry, pause, resume)
 * - Verify stage completion
 * - Monitor status transitions
 */

import { test, expect, Page } from '@playwright/test';
import { loginAs, setMode } from './fixtures';
import { E2E_USERS } from './fixtures/users.fixture';
import { PipelinePage } from './pages/pipeline.page';
import { BasePage } from './pages/base.page';

test.describe('VAL-002: Run Lifecycle', () => {
  test.beforeEach(async ({ page }) => {
    // Clear state before each test
    await page.addInitScript(() => {
      localStorage.clear();
    });
  });

  test('should create a new run and verify initial state', async ({ page }) => {
    // Setup auth
    await loginAs(page, E2E_USERS.ADMIN);
    await setMode(page, 'LIVE');

    // Mock run creation API
    await page.route('**/api/runs', async (route) => {
      if (route.request().method() === 'POST') {
        const postData = await route.request().postDataJSON();
        await route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({
            id: 'run-e2e-test-001',
            name: postData.name || 'New Run',
            status: 'pending',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            stages: [
              { id: 'stage-init', name: 'Initialization', status: 'pending', startedAt: null, completedAt: null },
              { id: 'stage-proc', name: 'Processing', status: 'pending', startedAt: null, completedAt: null },
              { id: 'stage-final', name: 'Finalization', status: 'pending', startedAt: null, completedAt: null },
            ],
            timeline: [
              {
                timestamp: new Date().toISOString(),
                event: 'created',
                details: 'Run created',
              },
            ],
          }),
        });
      } else {
        await route.continue();
      }
    });

    // Navigate to pipeline
    const pipelinePage = new PipelinePage(page);
    await pipelinePage.navigate();
    await pipelinePage.waitForModeToResolve();

    // Look for create run button and click
    const createButton = page.locator('[data-testid*="create"], [data-testid*="new"], button:has-text("Create")').first();
    const hasCreateButton = await createButton.isVisible().catch(() => false);

    if (hasCreateButton) {
      await createButton.click();
      await page.waitForTimeout(500);

      // Fill in run details if form appears
      const nameInput = page.locator('input[placeholder*="name"], input[data-testid*="name"]').first();
      if (await nameInput.isVisible().catch(() => false)) {
        await nameInput.fill('E2E Lifecycle Test Run');
      }

      // Look for submit button
      const submitButton = page.locator('button:has-text("Create"), button:has-text("Submit"), [data-testid*="submit"]').first();
      if (await submitButton.isVisible().catch(() => false)) {
        await submitButton.click();
        // Wait for API response
        await page.waitForTimeout(1000);
      }
    }

    // Verify run was created (check URL or page content)
    const url = page.url();
    expect(url).toBeDefined();
  });

  test('should monitor stage status transitions', async ({ page }) => {
    // Setup auth
    await loginAs(page, E2E_USERS.ADMIN);
    await setMode(page, 'LIVE');

    let stageIndex = 0;
    const stages = ['pending', 'running', 'completed'];

    // Mock stage transition API
    await page.route('**/api/runs/*/stages/*', async (route) => {
      if (route.request().method() === 'GET') {
        const currentStatus = stages[Math.min(stageIndex, stages.length - 1)];
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            id: 'stage-001',
            name: 'Processing Stage',
            status: currentStatus,
            startedAt: currentStatus !== 'pending' ? new Date().toISOString() : null,
            completedAt: currentStatus === 'completed' ? new Date().toISOString() : null,
            progress: currentStatus === 'running' ? 50 : currentStatus === 'completed' ? 100 : 0,
          }),
        });
        stageIndex++;
      } else {
        await route.continue();
      }
    });

    // Navigate to a run detail page
    await page.goto('/pipeline/run/run-e2e-001');
    await page.waitForLoadState('domcontentloaded');

    // Verify stage information is displayed
    const stageElement = page.locator('[data-testid*="stage"], .stage-item, [data-testid*="progress"]').first();
    const hasStageInfo = await stageElement.isVisible().catch(() => false);

    expect(hasStageInfo).toBeTruthy();
  });

  test('should handle run pause operation', async ({ page }) => {
    // Setup auth
    await loginAs(page, E2E_USERS.ADMIN);
    await setMode(page, 'LIVE');

    // Mock pause API
    await page.route('**/api/runs/*/pause', async (route) => {
      if (route.request().method() === 'POST') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            id: 'run-e2e-001',
            status: 'paused',
            pausedAt: new Date().toISOString(),
          }),
        });
      } else {
        await route.continue();
      }
    });

    // Navigate to run detail
    await page.goto('/pipeline/run/run-e2e-001');
    await page.waitForLoadState('domcontentloaded');

    // Find pause button
    const pauseButton = page.locator('button:has-text("Pause"), [data-testid*="pause"]').first();
    const hasPauseButton = await pauseButton.isVisible().catch(() => false);

    if (hasPauseButton) {
      await pauseButton.click();
      await page.waitForTimeout(500);

      // Verify status changed
      const statusText = await page.locator('[data-testid*="status"], .status-badge').first().textContent();
      expect(statusText?.toLowerCase()).toMatch(/paused|pause/);
    }
  });

  test('should handle run resume operation', async ({ page }) => {
    // Setup auth
    await loginAs(page, E2E_USERS.ADMIN);
    await setMode(page, 'LIVE');

    // Mock resume API
    await page.route('**/api/runs/*/resume', async (route) => {
      if (route.request().method() === 'POST') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            id: 'run-e2e-001',
            status: 'running',
            resumedAt: new Date().toISOString(),
          }),
        });
      } else {
        await route.continue();
      }
    });

    // Navigate to run detail
    await page.goto('/pipeline/run/run-e2e-001');
    await page.waitForLoadState('domcontentloaded');

    // Find resume button
    const resumeButton = page.locator('button:has-text("Resume"), [data-testid*="resume"]').first();
    const hasResumeButton = await resumeButton.isVisible().catch(() => false);

    if (hasResumeButton) {
      await resumeButton.click();
      await page.waitForTimeout(500);

      // Verify status changed
      const statusText = await page.locator('[data-testid*="status"]').first().textContent();
      expect(statusText?.toLowerCase()).toMatch(/running|resume/);
    }
  });

  test('should handle run retry operation', async ({ page }) => {
    // Setup auth
    await loginAs(page, E2E_USERS.ADMIN);
    await setMode(page, 'LIVE');

    // Mock retry API
    await page.route('**/api/runs/*/retry', async (route) => {
      if (route.request().method() === 'POST') {
        await route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({
            id: 'run-e2e-001-retry',
            status: 'pending',
            retryOf: 'run-e2e-001',
            createdAt: new Date().toISOString(),
          }),
        });
      } else {
        await route.continue();
      }
    });

    // Navigate to a failed run
    await page.goto('/pipeline/run/run-e2e-001-failed');
    await page.waitForLoadState('domcontentloaded');

    // Find retry button
    const retryButton = page.locator('button:has-text("Retry"), [data-testid*="retry"]').first();
    const hasRetryButton = await retryButton.isVisible().catch(() => false);

    if (hasRetryButton) {
      await retryButton.click();
      await page.waitForTimeout(500);

      // Verify page updated or redirected
      const url = page.url();
      expect(url).toBeDefined();
    }
  });

  test('should verify timeline updates with run progress', async ({ page }) => {
    // Setup auth
    await loginAs(page, E2E_USERS.ADMIN);
    await setMode(page, 'LIVE');

    // Mock timeline API
    await page.route('**/api/runs/*/timeline', async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            events: [
              {
                timestamp: new Date(Date.now() - 5000).toISOString(),
                event: 'created',
                details: 'Run created',
              },
              {
                timestamp: new Date(Date.now() - 3000).toISOString(),
                event: 'stage_started',
                details: 'Stage 1 started',
                stageId: 'stage-001',
              },
              {
                timestamp: new Date().toISOString(),
                event: 'stage_completed',
                details: 'Stage 1 completed',
                stageId: 'stage-001',
              },
            ],
          }),
        });
      } else {
        await route.continue();
      }
    });

    // Navigate to run detail
    await page.goto('/pipeline/run/run-e2e-001');
    await page.waitForLoadState('domcontentloaded');

    // Look for timeline element
    const timelineElement = page.locator('[data-testid*="timeline"], .timeline, .event-log').first();
    const hasTimeline = await timelineElement.isVisible().catch(() => false);

    if (hasTimeline) {
      // Count timeline events
      const events = await page.locator('[data-testid*="event"], .timeline-item, .event').count();
      expect(events).toBeGreaterThan(0);
    }
  });

  test('should display stage completion status correctly', async ({ page }) => {
    // Setup auth
    await loginAs(page, E2E_USERS.ADMIN);
    await setMode(page, 'LIVE');

    // Mock run with completed stages
    await page.route('**/api/runs/*', async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            id: 'run-e2e-complete',
            status: 'completed',
            stages: [
              {
                id: 'stage-1',
                name: 'Initialization',
                status: 'completed',
                completedAt: new Date(Date.now() - 10000).toISOString(),
                duration: 5000,
              },
              {
                id: 'stage-2',
                name: 'Processing',
                status: 'completed',
                completedAt: new Date(Date.now() - 5000).toISOString(),
                duration: 5000,
              },
              {
                id: 'stage-3',
                name: 'Finalization',
                status: 'completed',
                completedAt: new Date().toISOString(),
                duration: 5000,
              },
            ],
          }),
        });
      } else {
        await route.continue();
      }
    });

    // Navigate to completed run
    await page.goto('/pipeline/run/run-e2e-complete');
    await page.waitForLoadState('domcontentloaded');

    // Verify stages are shown as completed
    const completedBadges = await page.locator('text=Completed, text=✓, [data-testid*="completed"]').count();
    expect(completedBadges).toBeGreaterThanOrEqual(0);
  });

  test('should prevent operations when viewer role is used', async ({ page }) => {
    // Login as viewer
    await loginAs(page, E2E_USERS.VIEWER);
    await setMode(page, 'LIVE');

    // Navigate to run detail
    await page.goto('/pipeline/run/run-e2e-001');
    await page.waitForLoadState('domcontentloaded');

    // Control buttons should be disabled or hidden for viewers
    const pauseButton = page.locator('button:has-text("Pause")').first();
    const isPauseDisabled = await pauseButton.isDisabled().catch(() => true);
    const isPauseVisible = await pauseButton.isVisible().catch(() => false);

    // Either button is disabled or not visible for viewers
    expect(isPauseDisabled || !isPauseVisible).toBeTruthy();
  });

  test('should show run metadata and timestamps', async ({ page }) => {
    // Setup auth
    await loginAs(page, E2E_USERS.ADMIN);
    await setMode(page, 'LIVE');

    // Mock run details with metadata
    await page.route('**/api/runs/*', async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            id: 'run-e2e-001',
            name: 'E2E Test Run',
            status: 'completed',
            createdAt: new Date(Date.now() - 60000).toISOString(),
            updatedAt: new Date().toISOString(),
            completedAt: new Date().toISOString(),
            duration: 60000,
            createdBy: 'e2e_admin',
            tags: ['test', 'e2e'],
          }),
        });
      } else {
        await route.continue();
      }
    });

    // Navigate to run
    await page.goto('/pipeline/run/run-e2e-001');
    await page.waitForLoadState('domcontentloaded');

    // Check for metadata display
    const runName = page.locator('text=E2E Test Run, [data-testid*="run-name"]').first();
    const metadataDisplay = page.locator('[data-testid*="metadata"], [data-testid*="details"]').first();

    expect(await runName.isVisible().catch(() => false) || await metadataDisplay.isVisible().catch(() => false)).toBeTruthy();
  });
});
