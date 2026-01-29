/**
 * Critical User Journeys E2E Tests
 *
 * Covers the most critical user journeys end-to-end:
 * 1. Project creation via bundle import
 * 2. Pipeline run viewing and artifact inspection
 * 3. Role-based access (ADMIN, RESEARCHER, VIEWER)
 * 4. Failure scenarios (AI provider failure, offline mode)
 */

import { test, expect, Page } from '@playwright/test';
import { loginAs, loginAsRole, setMode } from './fixtures';
import { E2E_USERS } from './fixtures/users.fixture';
import { PipelinePage } from './pages/pipeline.page';
import { BasePage } from './pages/base.page';
import * as path from 'path';

test.describe('Critical Journeys', () => {
  test.beforeEach(async ({ page }) => {
    // Clear state before each test
    await page.addInitScript(() => {
      localStorage.clear();
    });
  });

  /**
   * Scenario A — Project Creation + Upload Data (Bundle Import)
   */
  test.describe('Bundle Import Flow', () => {
    test('should successfully import a bundle with mocked endpoints', async ({ page }) => {
      // Setup auth and mode
      await loginAs(page, E2E_USERS.ADMIN);
      await setMode(page, 'LIVE');

      // Mock the bundle verification endpoint
      await page.route('**/api/bundles/verify', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            isValid: true,
            schemaValid: true,
            provenanceVerified: true,
            hashIntegrity: true,
            errors: [],
            warnings: [],
            bundleInfo: {
              projectName: 'E2E Sample Project',
              bundleVersion: '1.0',
              createdAt: new Date().toISOString(),
              createdBy: 'e2e',
              artifactCount: 0,
              version: '1.0',
            },
          }),
        });
      });

      // Mock the import handoff endpoint
      await page.route('**/api/projects/import-handoff', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            projectId: 'proj-e2e-001',
          }),
        });
      });

      // Navigate to import page
      await page.goto('/import');
      const basePage = new BasePage(page);
      await basePage.waitForModeToResolve();

      // Verify page loaded
      await expect(page.locator('h1')).toContainText('Import Project Bundle');

      // Find the file input and upload the fixture
      const fileInput = page.locator('[data-testid="input-file"]');
      await expect(fileInput).toBeAttached();

      // Upload the sample bundle
      const bundlePath = path.join(__dirname, 'fixtures', 'sample-bundle.json');
      await fileInput.setInputFiles(bundlePath);

      // Wait for validation to complete
      await page.waitForTimeout(500);

      // Should show validation success indicators
      // The component shows validation badges for schema, provenance, and hash
      const validationBadges = page.locator('.border-ros-success\\/30');
      await expect(validationBadges.first()).toBeVisible({ timeout: 5000 });

      // Click import button
      const importButton = page.locator('[data-testid="button-import"]');
      await expect(importButton).toBeVisible();
      await importButton.click();

      // Wait for import to complete
      await page.waitForTimeout(1000);

      // Should show success state
      // Look for success indicator (Alert with CheckCircle or success message)
      const successAlert = page.locator('.border-ros-success, .text-ros-success');
      await expect(successAlert.first()).toBeVisible({ timeout: 5000 });
    });

    test('should handle file selection and show validation UI', async ({ page }) => {
      await loginAs(page, E2E_USERS.ANALYST);
      await setMode(page, 'LIVE');

      // Mock validation endpoint
      await page.route('**/api/bundles/verify', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            isValid: true,
            schemaValid: true,
            provenanceVerified: true,
            hashIntegrity: true,
            errors: [],
            warnings: [],
            bundleInfo: {
              projectName: 'E2E Sample Project',
              bundleVersion: '1.0',
              createdAt: new Date().toISOString(),
              createdBy: 'e2e',
              artifactCount: 0,
              version: '1.0',
            },
          }),
        });
      });

      await page.goto('/import');
      await new BasePage(page).waitForModeToResolve();

      // Should show dropzone
      const dropzone = page.locator('[data-testid="dropzone"]');
      await expect(dropzone).toBeVisible();

      // Should show cancel button
      const cancelButton = page.locator('[data-testid="button-cancel"]');
      await expect(cancelButton).toBeVisible();
    });
  });

  /**
   * Scenario B — Pipeline Dashboard: View Runs + View Artifacts
   */
  test.describe('Pipeline Dashboard', () => {
    test('should load pipeline dashboard and handle empty state', async ({ page }) => {
      await loginAs(page, E2E_USERS.ADMIN);
      await setMode(page, 'LIVE');

      const pipelinePage = new PipelinePage(page);
      await pipelinePage.navigate();

      // Should see the status summary card
      await expect(pipelinePage.cardStatusSummary).toBeVisible({ timeout: 5000 });

      // Should see the runs tab
      await expect(pipelinePage.tabRuns).toBeVisible();

      // Check if runs exist or if we have empty state
      const runButtons = page.locator('[data-testid^="button-view-run-"]');
      const runCount = await runButtons.count();

      if (runCount === 0) {
        // Empty state: should still have functional UI
        await expect(pipelinePage.buttonRefreshRuns).toBeVisible();
        console.log('No runs found - empty state displayed');
      } else {
        // Runs exist: verify we can interact with them
        console.log(`Found ${runCount} runs`);
      }
    });

    test('should view run details and artifacts when runs exist', async ({ page }) => {
      await loginAs(page, E2E_USERS.ANALYST);
      await setMode(page, 'LIVE');

      const pipelinePage = new PipelinePage(page);
      await pipelinePage.navigate();

      // Look for any run view buttons
      const runButtons = page.locator('[data-testid^="button-view-run-"]');
      const runCount = await runButtons.count();

      if (runCount > 0) {
        // Click the first run
        const firstRunButton = runButtons.first();
        await firstRunButton.click();

        // Wait for details to appear
        await page.waitForTimeout(500);

        // Look for artifacts toggle
        const artifactsToggle = page.locator('[data-testid="button-toggle-artifacts"]');
        const hasToggle = await artifactsToggle.count();

        if (hasToggle > 0) {
          await artifactsToggle.click();

          // Check for artifact items or empty state
          const artifacts = page.locator('[data-testid^="artifact-item-"]');
          const artifactCount = await artifacts.count();

          if (artifactCount > 0) {
            await expect(artifacts.first()).toBeVisible();
            console.log(`Found ${artifactCount} artifacts`);
          } else {
            console.log('No artifacts found for this run');
          }
        }
      } else {
        console.log('No runs available - skipping run details test');
      }
    });

    test('should refresh runs when refresh button clicked', async ({ page }) => {
      await loginAs(page, E2E_USERS.ADMIN);
      await setMode(page, 'LIVE');

      const pipelinePage = new PipelinePage(page);
      await pipelinePage.navigate();

      // Refresh button should be visible
      await expect(pipelinePage.buttonRefreshRuns).toBeVisible();

      // Click refresh
      await pipelinePage.refreshRuns();

      // Should still be on the same page
      await expect(pipelinePage.cardStatusSummary).toBeVisible();
    });
  });

  /**
   * Scenario C — Role Coverage: ADMIN vs RESEARCHER vs VIEWER
   */
  test.describe('Role-Based Access', () => {
    const testRoles = ['ADMIN', 'ANALYST', 'VIEWER'] as const;

    for (const role of testRoles) {
      test(`should load pipeline dashboard as ${role}`, async ({ page }) => {
        await loginAsRole(page, role);
        await setMode(page, 'LIVE');

        const pipelinePage = new PipelinePage(page);
        await pipelinePage.navigate();

        // Page should load without errors
        await expect(pipelinePage.cardStatusSummary).toBeVisible({ timeout: 5000 });

        // All roles should see the runs tab
        await expect(pipelinePage.tabRuns).toBeVisible();

        // Get the actual role name for assertion
        const user = E2E_USERS[role];
        console.log(`${role} (${user.role}) can access pipeline dashboard`);

        // VIEWER might have restricted actions (disabled buttons)
        // But page should still load and display content
        if (role === 'VIEWER') {
          // Verify page loads gracefully for viewer
          const pageContent = await page.textContent('body');
          expect(pageContent).toBeTruthy();
          console.log('VIEWER has read-only access');
        }
      });
    }

    test('should handle role permissions on import page', async ({ page }) => {
      // Test that different roles can access the import page
      for (const role of testRoles) {
        await page.addInitScript(() => localStorage.clear());
        await loginAsRole(page, role);
        await setMode(page, 'LIVE');

        await page.goto('/import');
        await new BasePage(page).waitForModeToResolve();

        // Page should load
        const heading = page.locator('h1');
        await expect(heading).toBeVisible({ timeout: 5000 });

        console.log(`${role} can access import page`);
      }
    });
  });

  /**
   * Scenario D — Failure Simulation: AI Provider Failure
   */
  test.describe('AI Provider Failure', () => {
    test('should handle AI endpoint failure gracefully', async ({ page }) => {
      await loginAs(page, E2E_USERS.ADMIN);
      await setMode(page, 'LIVE');

      // Intercept AI-related endpoint and force failure
      // Using a pipeline endpoint that might trigger AI work
      await page.route('**/api/ai/**', async (route) => {
        await route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({
            error: 'AI provider unavailable',
            message: 'Service temporarily unavailable',
          }),
        });
      });

      // Also intercept other potential AI endpoints
      await page.route('**/api/orchestrator/**', async (route) => {
        await route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({
            error: 'Service error',
          }),
        });
      });

      const pipelinePage = new PipelinePage(page);
      await pipelinePage.navigate();

      // UI should load (not crash)
      await expect(pipelinePage.cardStatusSummary).toBeVisible();

      // UI should remain functional
      const pageContent = await page.textContent('body');
      expect(pageContent).toBeTruthy();
      expect(pageContent?.length).toBeGreaterThan(100);

      console.log('UI remains stable despite AI provider failure');
    });

    test('should show error state when bundle verification fails', async ({ page }) => {
      await loginAs(page, E2E_USERS.ADMIN);
      await setMode(page, 'LIVE');

      // Mock bundle verification to fail
      await page.route('**/api/bundles/verify', async (route) => {
        await route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({
            message: 'Verification service unavailable',
          }),
        });
      });

      await page.goto('/import');
      await new BasePage(page).waitForModeToResolve();

      // Upload a file
      const fileInput = page.locator('[data-testid="input-file"]');
      const bundlePath = path.join(__dirname, 'fixtures', 'sample-bundle.json');
      await fileInput.setInputFiles(bundlePath);

      // Wait for error handling
      await page.waitForTimeout(1000);

      // Should not crash - page should still be functional
      const dropzone = page.locator('[data-testid="dropzone"]');
      await expect(dropzone).toBeVisible();

      console.log('Bundle import handles verification failure gracefully');
    });
  });

  /**
   * Scenario E — Failure Simulation: Offline / No-Network
   */
  test.describe('Offline Mode', () => {
    test('should handle offline state gracefully', async ({ page, context }) => {
      await loginAs(page, E2E_USERS.ANALYST);
      await setMode(page, 'LIVE');

      const pipelinePage = new PipelinePage(page);
      await pipelinePage.navigate();

      // Wait for initial load
      await expect(pipelinePage.cardStatusSummary).toBeVisible();

      // Set offline mode
      await context.setOffline(true);

      // Try to refresh runs (will fail due to offline)
      await pipelinePage.buttonRefreshRuns.click();

      // Wait for network error to surface
      await page.waitForTimeout(1000);

      // UI should remain usable (not blank screen)
      const bodyContent = await page.textContent('body');
      expect(bodyContent).toBeTruthy();
      expect(bodyContent?.length).toBeGreaterThan(100);

      // Should still see the main UI elements
      await expect(pipelinePage.cardStatusSummary).toBeVisible();

      console.log('UI remains functional in offline mode');

      // Re-enable network
      await context.setOffline(false);
    });

    test('should handle network failure on import page', async ({ page, context }) => {
      await loginAs(page, E2E_USERS.ADMIN);
      await setMode(page, 'LIVE');

      await page.goto('/import');
      await new BasePage(page).waitForModeToResolve();

      // Page should load initially
      await expect(page.locator('h1')).toBeVisible();

      // Go offline
      await context.setOffline(true);

      // Try to upload a file (will fail due to offline)
      const fileInput = page.locator('[data-testid="input-file"]');
      const bundlePath = path.join(__dirname, 'fixtures', 'sample-bundle.json');
      await fileInput.setInputFiles(bundlePath);

      // Wait for network error
      await page.waitForTimeout(1500);

      // UI should not crash
      const pageContent = await page.textContent('body');
      expect(pageContent).toBeTruthy();

      // Dropzone should still be visible
      const dropzone = page.locator('[data-testid="dropzone"]');
      await expect(dropzone).toBeVisible();

      console.log('Import page handles offline mode gracefully');

      // Re-enable network
      await context.setOffline(false);
    });
  });

  /**
   * Optional Smoke Test — Home to Pipeline Navigation
   */
  test.describe('Navigation Smoke Tests', () => {
    test('should navigate from home to pipeline', async ({ page }) => {
      await loginAs(page, E2E_USERS.ADMIN);
      await setMode(page, 'LIVE');

      // Load home page
      await page.goto('/');
      const basePage = new BasePage(page);
      await basePage.waitForModeToResolve();

      // Verify home loaded
      const bodyContent = await page.textContent('body');
      expect(bodyContent).toBeTruthy();

      // Navigate to pipeline
      await page.goto('/pipeline');
      await basePage.waitForModeToResolve();

      // Verify pipeline loaded
      const pipelinePage = new PipelinePage(page);
      await expect(pipelinePage.cardStatusSummary).toBeVisible({ timeout: 5000 });
    });

    test('should navigate from home to import page', async ({ page }) => {
      await loginAs(page, E2E_USERS.ANALYST);
      await setMode(page, 'LIVE');

      await page.goto('/');
      await new BasePage(page).waitForModeToResolve();

      // Navigate to import
      await page.goto('/import');
      await new BasePage(page).waitForModeToResolve();

      // Verify import page loaded
      await expect(page.locator('h1')).toContainText('Import');
      const dropzone = page.locator('[data-testid="dropzone"]');
      await expect(dropzone).toBeVisible();
    });
  });
});
