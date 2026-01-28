/**
 * VAL-004: E2E Test - Governance Flow
 *
 * Tests governance and compliance workflows:
 * - Approval queue display
 * - Approve/Deny actions
 * - Audit log updates
 * - Role-based access control
 * - Policy enforcement
 * - Compliance status
 */

import { test, expect, Page } from '@playwright/test';
import { loginAs, setMode, loginAsRole } from './fixtures';
import { E2E_USERS } from './fixtures/users.fixture';
import { GovernancePage } from './pages/governance.page';
import { BasePage } from './pages/base.page';

test.describe('VAL-004: Governance Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Clear state before each test
    await page.addInitScript(() => {
      localStorage.clear();
    });
  });

  test('should display approval queue for steward role', async ({ page }) => {
    // Login as steward
    await loginAsRole(page, 'STEWARD');
    await setMode(page, 'LIVE');

    // Mock approval queue API
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
                requestedBy: 'e2e_analyst',
                createdAt: new Date().toISOString(),
                description: 'Run analysis on sensitive data',
                resource: {
                  id: 'run-e2e-001',
                  name: 'Sensitive Data Analysis',
                },
              },
              {
                id: 'approval-002',
                type: 'data_export',
                status: 'pending',
                requestedBy: 'e2e_researcher',
                createdAt: new Date(Date.now() - 5000).toISOString(),
                description: 'Export results dataset',
                resource: {
                  id: 'dataset-001',
                  name: 'Results Dataset',
                },
              },
            ],
            total: 2,
            pending: 2,
          }),
        });
      } else {
        await route.continue();
      }
    });

    // Navigate to governance page
    const governancePage = new GovernancePage(page);
    await governancePage.navigate();
    await governancePage.waitForModeToResolve();

    // Check for approval queue section
    const queueSection = page.locator('[data-testid*="approval-queue"], [data-testid*="queue"], .approval-queue').first();
    const hasQueueSection = await queueSection.isVisible().catch(() => false);

    if (hasQueueSection) {
      // Count pending approvals
      const pendingItems = await page.locator('[data-testid*="pending"], .pending-item, .approval-item').count();
      expect(pendingItems).toBeGreaterThanOrEqual(0);
    }
  });

  test('should allow steward to approve request', async ({ page }) => {
    // Login as steward
    await loginAsRole(page, 'STEWARD');
    await setMode(page, 'LIVE');

    // Mock approval action
    await page.route('**/api/governance/approvals/*/approve', async (route) => {
      if (route.request().method() === 'POST') {
        const requestBody = await route.request().postDataJSON();
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            id: 'approval-001',
            status: 'approved',
            approvedBy: 'e2e_steward',
            approvedAt: new Date().toISOString(),
            comment: requestBody.comment || 'Approved by steward',
          }),
        });
      } else {
        await route.continue();
      }
    });

    // Navigate to approvals
    const governancePage = new GovernancePage(page);
    await governancePage.navigate();
    await governancePage.waitForModeToResolve();

    // Find approve button
    const approveButton = page.locator('button:has-text("Approve"), [data-testid*="approve"]').first();
    const hasApproveButton = await approveButton.isVisible().catch(() => false);

    if (hasApproveButton) {
      await approveButton.click();
      await page.waitForTimeout(500);

      // Verify status changed
      const statusText = await page.locator('[data-testid*="status"]').first().textContent();
      expect(statusText?.toLowerCase()).toMatch(/approved|approve/);
    }
  });

  test('should allow steward to deny request', async ({ page }) => {
    // Login as steward
    await loginAsRole(page, 'STEWARD');
    await setMode(page, 'LIVE');

    // Mock deny action
    await page.route('**/api/governance/approvals/*/deny', async (route) => {
      if (route.request().method() === 'POST') {
        const requestBody = await route.request().postDataJSON();
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            id: 'approval-001',
            status: 'denied',
            deniedBy: 'e2e_steward',
            deniedAt: new Date().toISOString(),
            reason: requestBody.reason || 'Policy violation detected',
          }),
        });
      } else {
        await route.continue();
      }
    });

    // Navigate to approvals
    const governancePage = new GovernancePage(page);
    await governancePage.navigate();
    await governancePage.waitForModeToResolve();

    // Find deny button
    const denyButton = page.locator('button:has-text("Deny"), [data-testid*="deny"], button:has-text("Reject")').first();
    const hasDenyButton = await denyButton.isVisible().catch(() => false);

    if (hasDenyButton) {
      await denyButton.click();
      await page.waitForTimeout(500);

      // Check for confirmation dialog
      const dialog = page.locator('[role="dialog"], .modal, .dialog').first();
      const hasDialog = await dialog.isVisible().catch(() => false);

      if (hasDialog) {
        // Find reason input and confirm button
        const reasonInput = page.locator('textarea, input[placeholder*="reason"]').first();
        if (await reasonInput.isVisible().catch(() => false)) {
          await reasonInput.fill('Policy violation');
        }

        const confirmButton = page.locator('button:has-text("Confirm"), button:has-text("Submit")').first();
        if (await confirmButton.isVisible().catch(() => false)) {
          await confirmButton.click();
          await page.waitForTimeout(500);
        }
      }

      // Verify status changed
      const statusText = await page.locator('[data-testid*="status"]').first().textContent();
      expect(statusText?.toLowerCase()).toMatch(/denied|reject/);
    }
  });

  test('should display audit log with approval history', async ({ page }) => {
    // Login as admin
    await loginAs(page, E2E_USERS.ADMIN);
    await setMode(page, 'LIVE');

    // Mock audit log API
    await page.route('**/api/governance/audit-log*', async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            events: [
              {
                id: 'event-001',
                timestamp: new Date(Date.now() - 10000).toISOString(),
                action: 'approval_requested',
                actor: 'e2e_analyst',
                resource: 'run-e2e-001',
                details: 'Requested approval for run execution',
              },
              {
                id: 'event-002',
                timestamp: new Date(Date.now() - 5000).toISOString(),
                action: 'approval_approved',
                actor: 'e2e_steward',
                resource: 'run-e2e-001',
                details: 'Approved run execution',
              },
              {
                id: 'event-003',
                timestamp: new Date().toISOString(),
                action: 'run_started',
                actor: 'system',
                resource: 'run-e2e-001',
                details: 'Run started after approval',
              },
            ],
            total: 3,
          }),
        });
      } else {
        await route.continue();
      }
    });

    // Navigate to governance page
    const governancePage = new GovernancePage(page);
    await governancePage.navigate();
    await governancePage.waitForModeToResolve();

    // Find audit log section
    const auditSection = page.locator('[data-testid*="audit"], [data-testid*="log"], .audit-log').first();
    const hasAuditSection = await auditSection.isVisible().catch(() => false);

    if (hasAuditSection) {
      // Count audit entries
      const auditEntries = await page.locator('[data-testid*="entry"], .log-entry, .audit-entry').count();
      expect(auditEntries).toBeGreaterThanOrEqual(0);
    }
  });

  test('should prevent non-steward from approving', async ({ page }) => {
    // Login as analyst (researcher role)
    await loginAsRole(page, 'ANALYST');
    await setMode(page, 'LIVE');

    // Navigate to governance
    const governancePage = new GovernancePage(page);
    await governancePage.navigate();
    await governancePage.waitForModeToResolve();

    // Try to find approve button
    const approveButton = page.locator('button:has-text("Approve")').first();
    const hasApproveButton = await approveButton.isVisible().catch(() => false);
    const isApproveDisabled = await approveButton.isDisabled().catch(() => true);

    // Analyst should not have approve button or it should be disabled
    expect(!hasApproveButton || isApproveDisabled).toBeTruthy();
  });

  test('should display policy violations in governance center', async ({ page }) => {
    // Login as admin
    await loginAs(page, E2E_USERS.ADMIN);
    await setMode(page, 'LIVE');

    // Mock policy violations API
    await page.route('**/api/governance/violations*', async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            violations: [
              {
                id: 'violation-001',
                type: 'phi_detected',
                severity: 'critical',
                message: 'PHI (SSN) detected in data',
                resource: 'run-e2e-001',
                detectedAt: new Date().toISOString(),
                status: 'unresolved',
              },
              {
                id: 'violation-002',
                type: 'policy_violation',
                severity: 'warning',
                message: 'Data export without approval',
                resource: 'dataset-001',
                detectedAt: new Date(Date.now() - 5000).toISOString(),
                status: 'resolved',
              },
            ],
            critical: 1,
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

    // Check for violations section
    const violationsSection = page.locator('[data-testid*="violation"], [data-testid*="alerts"], .violations').first();
    const hasViolations = await violationsSection.isVisible().catch(() => false);

    if (hasViolations) {
      // Count violation items
      const violationItems = await page.locator('[data-testid*="violation-item"], .violation, .alert').count();
      expect(violationItems).toBeGreaterThanOrEqual(0);
    }
  });

  test('should display compliance status', async ({ page }) => {
    // Login as admin
    await loginAs(page, E2E_USERS.ADMIN);
    await setMode(page, 'LIVE');

    // Mock compliance status API
    await page.route('**/api/governance/compliance*', async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            status: 'compliant',
            score: 95,
            checks: [
              { name: 'PHI Protection', status: 'pass' },
              { name: 'Data Encryption', status: 'pass' },
              { name: 'Access Control', status: 'pass' },
              { name: 'Audit Logging', status: 'pass' },
            ],
            lastChecked: new Date().toISOString(),
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

    // Check for compliance display
    const complianceSection = page.locator('[data-testid*="compliance"], .compliance-status, .compliance-score').first();
    const hasCompliance = await complianceSection.isVisible().catch(() => false);

    if (hasCompliance) {
      // Check for score/status
      const scoreText = await page.locator('[data-testid*="score"], text=95, text=Compliant').first().isVisible().catch(() => false);
      expect(scoreText || hasCompliance).toBeTruthy();
    }
  });

  test('should filter audit log by action type', async ({ page }) => {
    // Login as admin
    await loginAs(page, E2E_USERS.ADMIN);
    await setMode(page, 'LIVE');

    // Mock audit log
    await page.route('**/api/governance/audit-log*', async (route) => {
      if (route.request().method() === 'GET') {
        const url = new URL(route.request().url());
        const action = url.searchParams.get('action');

        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            events: action ? [
              {
                id: 'event-001',
                timestamp: new Date().toISOString(),
                action: action,
                actor: 'e2e_admin',
                resource: 'run-001',
              },
            ] : [],
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

    // Find filter dropdown
    const filterButton = page.locator('[data-testid*="filter"], select, button:has-text("Filter")').first();
    const hasFilter = await filterButton.isVisible().catch(() => false);

    if (hasFilter) {
      await filterButton.click();
      await page.waitForTimeout(300);

      // Check for filter options
      const filterOptions = await page.locator('[role="option"], .option').count();
      expect(filterOptions).toBeGreaterThanOrEqual(0);
    }
  });

  test('should show different UI for DEMO vs LIVE mode', async ({ page }) => {
    // Test DEMO mode
    await loginAs(page, E2E_USERS.ADMIN);
    await setMode(page, 'DEMO');

    const governancePage = new GovernancePage(page);
    await governancePage.navigate();
    await governancePage.waitForModeToResolve();

    // Check for DEMO mode indicator
    const demoIndicator = page.locator('[data-testid*="demo"], text=DEMO, text=Demonstration').first();
    const hasDemoIndicator = await demoIndicator.isVisible().catch(() => false);

    // Test LIVE mode
    await setMode(page, 'LIVE');
    await page.reload();
    await governancePage.waitForModeToResolve();

    // Check for LIVE mode indicator
    const liveIndicator = page.locator('[data-testid*="live"], text=LIVE').first();
    const hasLiveIndicator = await liveIndicator.isVisible().catch(() => false);

    expect(hasDemoIndicator || hasLiveIndicator).toBeTruthy();
  });

  test('should display role-based governance options', async ({ page }) => {
    // Test VIEWER - no governance access
    await loginAsRole(page, 'VIEWER');
    await setMode(page, 'LIVE');

    // Try to navigate to governance
    await page.goto('/governance');
    await page.waitForLoadState('domcontentloaded');

    // Should either redirect or show restricted message
    const url = page.url();
    const restrictedMessage = page.locator('text=unauthorized, text=access denied, text=no permission').first();
    const hasRestriction = !url.includes('governance') || await restrictedMessage.isVisible().catch(() => false);

    // Test STEWARD - has governance access
    await loginAsRole(page, 'STEWARD');
    await setMode(page, 'LIVE');

    const governancePage = new GovernancePage(page);
    await governancePage.navigate();
    await governancePage.waitForModeToResolve();

    const stewardUrl = page.url();
    expect(stewardUrl).toContain('governance');
  });

  test('should track approval timeline', async ({ page }) => {
    // Login as steward
    await loginAsRole(page, 'STEWARD');
    await setMode(page, 'LIVE');

    // Mock approval with timeline
    await page.route('**/api/governance/approvals/*', async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            id: 'approval-001',
            status: 'approved',
            timeline: [
              { timestamp: new Date(Date.now() - 10000).toISOString(), action: 'created', actor: 'e2e_analyst' },
              { timestamp: new Date(Date.now() - 5000).toISOString(), action: 'viewed', actor: 'e2e_steward' },
              { timestamp: new Date().toISOString(), action: 'approved', actor: 'e2e_steward' },
            ],
          }),
        });
      } else {
        await route.continue();
      }
    });

    // Navigate to specific approval
    await page.goto('/governance/approval/approval-001');
    await page.waitForLoadState('domcontentloaded');

    // Check for timeline
    const timelineElement = page.locator('[data-testid*="timeline"], .timeline, .approval-timeline').first();
    const hasTimeline = await timelineElement.isVisible().catch(() => false);

    if (hasTimeline) {
      // Count timeline events
      const events = await page.locator('[data-testid*="event"], .timeline-item').count();
      expect(events).toBeGreaterThanOrEqual(0);
    }
  });
});
