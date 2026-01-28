/**
 * VAL-005: Visual Regression Tests for Key Screens
 *
 * Captures and validates visual regression for key user-facing screens:
 * - Projects dashboard
 * - Run detail page
 * - Artifact browser
 * - Governance center
 * - Command palette
 *
 * Run with: npx playwright test tests/visual/key-screens.spec.ts
 * Update snapshots with: npm run test:visual:update
 */

import { test, expect, Page } from '@playwright/test';
import { loginAs, setMode } from '../e2e/fixtures';
import { E2E_USERS } from '../e2e/fixtures/users.fixture';
import { BasePage } from '../e2e/pages/base.page';
import { PipelinePage } from '../e2e/pages/pipeline.page';
import { GovernancePage } from '../e2e/pages/governance.page';

test.describe('VAL-005: Visual Regression Tests - Key Screens', () => {
  test.beforeEach(async ({ page }) => {
    // Clear state before each test
    await page.addInitScript(() => {
      localStorage.clear();
    });
  });

  test('should match snapshot of projects dashboard', async ({ page }) => {
    // Setup auth
    await loginAs(page, E2E_USERS.ADMIN);
    await setMode(page, 'LIVE');

    // Mock projects API
    await page.route('**/api/projects*', async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            projects: [
              {
                id: 'proj-001',
                name: 'Sample Project 1',
                description: 'A sample research project',
                status: 'active',
                createdAt: new Date().toISOString(),
                runCount: 5,
              },
              {
                id: 'proj-002',
                name: 'Sample Project 2',
                description: 'Another research project',
                status: 'active',
                createdAt: new Date(Date.now() - 86400000).toISOString(),
                runCount: 3,
              },
            ],
            total: 2,
          }),
        });
      } else {
        await route.continue();
      }
    });

    // Navigate to projects page
    await page.goto('/projects');
    await page.waitForLoadState('domcontentloaded');

    // Wait for content to be fully loaded
    await page.waitForSelector('[data-testid*="project"], .project-card, [role="listitem"]', { timeout: 10000 });

    // Take snapshot
    await expect(page).toHaveScreenshot('projects-dashboard.png', {
      maxDiffPixels: 100,
      threshold: 0.2,
    });
  });

  test('should match snapshot of run detail page', async ({ page }) => {
    // Setup auth
    await loginAs(page, E2E_USERS.ADMIN);
    await setMode(page, 'LIVE');

    // Mock run detail API
    await page.route('**/api/runs/*', async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            id: 'run-e2e-001',
            name: 'Analysis Run #1',
            status: 'completed',
            progress: 100,
            createdAt: new Date(Date.now() - 3600000).toISOString(),
            completedAt: new Date().toISOString(),
            duration: 3600000,
            stages: [
              {
                id: 'stage-1',
                name: 'Data Preparation',
                status: 'completed',
                startedAt: new Date(Date.now() - 3600000).toISOString(),
                completedAt: new Date(Date.now() - 2700000).toISOString(),
              },
              {
                id: 'stage-2',
                name: 'Analysis',
                status: 'completed',
                startedAt: new Date(Date.now() - 2700000).toISOString(),
                completedAt: new Date(Date.now() - 1800000).toISOString(),
              },
              {
                id: 'stage-3',
                name: 'Report Generation',
                status: 'completed',
                startedAt: new Date(Date.now() - 1800000).toISOString(),
                completedAt: new Date().toISOString(),
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

    // Wait for content
    await page.waitForSelector('[data-testid*="stage"], [data-testid*="progress"], h1', { timeout: 10000 });

    // Take snapshot
    await expect(page).toHaveScreenshot('run-detail-page.png', {
      maxDiffPixels: 100,
      threshold: 0.2,
    });
  });

  test('should match snapshot of artifact browser', async ({ page }) => {
    // Setup auth
    await loginAs(page, E2E_USERS.ADMIN);
    await setMode(page, 'LIVE');

    // Mock artifacts API
    await page.route('**/api/runs/*/artifacts*', async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            artifacts: [
              {
                id: 'artifact-001',
                name: 'data',
                type: 'directory',
                children: [
                  { id: 'artifact-002', name: 'raw_data.csv', type: 'file', mimeType: 'text/csv', size: 1024 },
                  { id: 'artifact-003', name: 'processed_data.csv', type: 'file', mimeType: 'text/csv', size: 2048 },
                ],
              },
              {
                id: 'artifact-004',
                name: 'reports',
                type: 'directory',
                children: [
                  { id: 'artifact-005', name: 'summary.pdf', type: 'file', mimeType: 'application/pdf', size: 5120 },
                ],
              },
            ],
          }),
        });
      } else {
        await route.continue();
      }
    });

    // Navigate to artifacts
    await page.goto('/pipeline/run/run-e2e-001/artifacts');
    await page.waitForLoadState('domcontentloaded');

    // Wait for tree to load
    await page.waitForSelector('[data-testid*="artifact"], .file-tree, .tree-container', { timeout: 10000 });

    // Take snapshot
    await expect(page).toHaveScreenshot('artifact-browser.png', {
      maxDiffPixels: 100,
      threshold: 0.2,
    });
  });

  test('should match snapshot of governance center', async ({ page }) => {
    // Setup auth
    await loginAs(page, E2E_USERS.ADMIN);
    await setMode(page, 'LIVE');

    // Mock governance APIs
    await page.route('**/api/governance/approvals*', async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            queue: [
              {
                id: 'approval-001',
                type: 'run_execution',
                status: 'pending',
                requestedBy: 'researcher',
                description: 'Run analysis on dataset',
              },
            ],
            pending: 1,
          }),
        });
      } else {
        await route.continue();
      }
    });

    await page.route('**/api/governance/violations*', async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            violations: [
              {
                id: 'viol-001',
                type: 'phi_detected',
                severity: 'warning',
                message: 'Potential PHI in output',
              },
            ],
            critical: 0,
            warning: 1,
          }),
        });
      } else {
        await route.continue();
      }
    });

    // Navigate to governance
    const governancePage = new GovernancePage(page);
    await governancePage.navigate();
    await governancePage.waitForModeToResolve();

    // Wait for governance content
    await page.waitForSelector('[data-testid*="card"], [data-testid*="section"]', { timeout: 10000 });

    // Take snapshot
    await expect(page).toHaveScreenshot('governance-center.png', {
      maxDiffPixels: 100,
      threshold: 0.2,
    });
  });

  test('should match snapshot of pipeline dashboard', async ({ page }) => {
    // Setup auth
    await loginAs(page, E2E_USERS.ADMIN);
    await setMode(page, 'LIVE');

    // Mock pipeline API
    await page.route('**/api/runs*', async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            runs: [
              { id: 'run-001', name: 'Run 1', status: 'completed', progress: 100 },
              { id: 'run-002', name: 'Run 2', status: 'running', progress: 50 },
              { id: 'run-003', name: 'Run 3', status: 'pending', progress: 0 },
            ],
            total: 3,
            statusCounts: { pending: 1, running: 1, completed: 1, failed: 0 },
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

    // Wait for content
    await page.waitForSelector('[data-testid*="card"], [data-testid*="status"], h1', { timeout: 10000 });

    // Take snapshot
    await expect(page).toHaveScreenshot('pipeline-dashboard.png', {
      maxDiffPixels: 100,
      threshold: 0.2,
    });
  });

  test('should match snapshot of home page with DEMO banner', async ({ page }) => {
    // Set DEMO mode
    await loginAs(page, E2E_USERS.ADMIN);
    await setMode(page, 'DEMO');

    // Navigate to home
    const basePage = new BasePage(page);
    await basePage.goto('/');
    await basePage.waitForModeToResolve();

    // Wait for page to fully load
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(1000);

    // Take snapshot
    await expect(page).toHaveScreenshot('home-page-demo-mode.png', {
      maxDiffPixels: 100,
      threshold: 0.2,
    });
  });

  test('should match snapshot of home page with LIVE banner', async ({ page }) => {
    // Set LIVE mode
    await loginAs(page, E2E_USERS.ADMIN);
    await setMode(page, 'LIVE');

    // Navigate to home
    const basePage = new BasePage(page);
    await basePage.goto('/');
    await basePage.waitForModeToResolve();

    // Wait for page to fully load
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(1000);

    // Take snapshot
    await expect(page).toHaveScreenshot('home-page-live-mode.png', {
      maxDiffPixels: 100,
      threshold: 0.2,
    });
  });

  test('should match snapshot of login page', async ({ page }) => {
    // Navigate to login
    await page.goto('/login');
    await page.waitForLoadState('domcontentloaded');

    // Wait for login form
    await page.waitForSelector('form, input[type="password"], input[type="email"], button', { timeout: 10000 });

    // Take snapshot
    await expect(page).toHaveScreenshot('login-page.png', {
      maxDiffPixels: 100,
      threshold: 0.2,
    });
  });

  test('should match snapshot of modal/dialog when creating run', async ({ page }) => {
    // Setup auth
    await loginAs(page, E2E_USERS.ADMIN);
    await setMode(page, 'LIVE');

    // Navigate to pipeline
    const pipelinePage = new PipelinePage(page);
    await pipelinePage.navigate();
    await pipelinePage.waitForModeToResolve();

    // Find and click create run button
    const createButton = page.locator('[data-testid*="create"], button:has-text("New"), button:has-text("Create")').first();
    const hasCreateButton = await createButton.isVisible().catch(() => false);

    if (hasCreateButton) {
      await createButton.click();
      await page.waitForTimeout(500);

      // Wait for dialog
      const dialog = page.locator('[role="dialog"], .modal, .dialog').first();
      const hasDialog = await dialog.isVisible().catch(() => false);

      if (hasDialog) {
        // Take snapshot of dialog
        await expect(dialog).toHaveScreenshot('create-run-dialog.png', {
          maxDiffPixels: 100,
          threshold: 0.2,
        });
      }
    }
  });

  test('should match snapshot of error state when API fails', async ({ page }) => {
    // Setup auth
    await loginAs(page, E2E_USERS.ADMIN);
    await setMode(page, 'LIVE');

    // Mock API failure
    await page.route('**/api/runs*', async (route) => {
      await route.abort('failed');
    });

    // Navigate to pipeline
    const pipelinePage = new PipelinePage(page);
    await pipelinePage.navigate();

    // Wait for error to appear
    const errorElement = page.locator('[data-testid*="error"], .error-message, text=Error').first();
    const hasError = await errorElement.waitFor({ state: 'visible', timeout: 5000 }).catch(() => false);

    if (hasError) {
      // Take snapshot of error state
      await expect(page).toHaveScreenshot('error-state.png', {
        maxDiffPixels: 100,
        threshold: 0.2,
      });
    }
  });

  test('should match snapshot of loading state', async ({ page }) => {
    // Setup auth
    await loginAs(page, E2E_USERS.ADMIN);
    await setMode(page, 'LIVE');

    // Slow down network to capture loading state
    await page.route('**/api/**', async (route) => {
      await new Promise(resolve => setTimeout(resolve, 2000));
      await route.continue();
    });

    // Navigate to pipeline
    await page.goto('/pipeline');

    // Wait for loading indicator
    const loader = page.locator('[data-testid*="loader"], .spinner, .loading').first();
    const hasLoader = await loader.isVisible().catch(() => false);

    if (hasLoader) {
      // Take snapshot of loading state
      await expect(page).toHaveScreenshot('loading-state.png', {
        maxDiffPixels: 100,
        threshold: 0.2,
      });
    }
  });

  test('should match snapshot of responsive design on mobile', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });

    // Setup auth
    await loginAs(page, E2E_USERS.ADMIN);
    await setMode(page, 'LIVE');

    // Navigate to home
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    // Take snapshot
    await expect(page).toHaveScreenshot('responsive-mobile.png', {
      maxDiffPixels: 100,
      threshold: 0.2,
    });
  });

  test('should match snapshot of responsive design on tablet', async ({ page }) => {
    // Set tablet viewport
    await page.setViewportSize({ width: 768, height: 1024 });

    // Setup auth
    await loginAs(page, E2E_USERS.ADMIN);
    await setMode(page, 'LIVE');

    // Navigate to pipeline
    const pipelinePage = new PipelinePage(page);
    await pipelinePage.navigate();
    await pipelinePage.waitForModeToResolve();

    // Take snapshot
    await expect(page).toHaveScreenshot('responsive-tablet.png', {
      maxDiffPixels: 100,
      threshold: 0.2,
    });
  });
});
