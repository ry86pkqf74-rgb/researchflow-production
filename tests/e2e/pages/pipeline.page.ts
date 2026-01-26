/**
 * Pipeline Dashboard Page Object Model
 *
 * Selectors and actions for the pipeline dashboard page.
 */

import { Page, Locator } from '@playwright/test';
import { BasePage } from './base.page';

export class PipelinePage extends BasePage {
  // Main elements
  readonly cardStatusSummary: Locator;
  readonly badgeCurrentMode: Locator;
  readonly buttonRefreshRuns: Locator;
  readonly buttonBackHome: Locator;

  // Tabs
  readonly tabRuns: Locator;
  readonly tabDetails: Locator;

  // Status counts
  readonly statusCountPending: Locator;
  readonly statusCountRunning: Locator;
  readonly statusCountCompleted: Locator;
  readonly statusCountFailed: Locator;

  // Workflow links
  readonly cardWorkflowLinks: Locator;
  readonly linkStartWorkflow: Locator;
  readonly buttonBackToRuns: Locator;

  constructor(page: Page) {
    super(page);

    // Main elements
    this.cardStatusSummary = page.locator('[data-testid="card-status-summary"]');
    this.badgeCurrentMode = page.locator('[data-testid="badge-current-mode"]');
    this.buttonRefreshRuns = page.locator('[data-testid="button-refresh-runs"]');
    this.buttonBackHome = page.locator('[data-testid="button-back-home"]');

    // Tabs
    this.tabRuns = page.locator('[data-testid="tab-runs"]');
    this.tabDetails = page.locator('[data-testid="tab-details"]');

    // Status counts
    this.statusCountPending = page.locator('[data-testid="status-count-pending"]');
    this.statusCountRunning = page.locator('[data-testid="status-count-running"]');
    this.statusCountCompleted = page.locator('[data-testid="status-count-completed"]');
    this.statusCountFailed = page.locator('[data-testid="status-count-failed"]');

    // Workflow links
    this.cardWorkflowLinks = page.locator('[data-testid="card-workflow-links"]');
    this.linkStartWorkflow = page.locator('[data-testid="link-start-workflow"]');
    this.buttonBackToRuns = page.locator('[data-testid="button-back-to-runs"]');
  }

  /**
   * Navigate to the pipeline dashboard.
   */
  async navigate(): Promise<void> {
    await this.goto('/pipeline');
    await this.waitForModeToResolve();
  }

  /**
   * Get the status count for a specific status.
   */
  async getStatusCount(status: 'pending' | 'running' | 'completed' | 'failed'): Promise<number> {
    const countMap = {
      pending: this.statusCountPending,
      running: this.statusCountRunning,
      completed: this.statusCountCompleted,
      failed: this.statusCountFailed,
    };

    const element = countMap[status];
    const text = await element.textContent();
    return parseInt(text || '0', 10);
  }

  /**
   * Click the refresh button.
   */
  async refreshRuns(): Promise<void> {
    await this.buttonRefreshRuns.click();
    // Wait for refresh to complete
    await this.page.waitForTimeout(500);
  }

  /**
   * Click on the runs tab.
   */
  async clickRunsTab(): Promise<void> {
    await this.tabRuns.click();
  }

  /**
   * Click on the details tab.
   */
  async clickDetailsTab(): Promise<void> {
    await this.tabDetails.click();
  }

  /**
   * Get a specific pipeline run by ID.
   */
  getRun(runId: string): Locator {
    return this.page.locator(`[data-testid="run-${runId}"]`);
  }

  /**
   * Click on a pipeline run to view details.
   */
  async clickRun(runId: string): Promise<void> {
    const run = this.getRun(runId);
    await run.click();
  }

  /**
   * Get a stage link button.
   */
  getStageLink(stageName: string): Locator {
    return this.page.locator(`[data-testid="link-stage-${stageName}"]`);
  }

  /**
   * Click a stage link.
   */
  async clickStageLink(stageName: string): Promise<void> {
    const link = this.getStageLink(stageName);
    await link.click();
    await this.waitForNavigation();
  }

  /**
   * Start a new workflow.
   */
  async startWorkflow(): Promise<void> {
    await this.linkStartWorkflow.click();
    await this.waitForNavigation();
  }

  /**
   * Go back to runs list.
   */
  async backToRuns(): Promise<void> {
    await this.buttonBackToRuns.click();
  }

  /**
   * Go back to home page.
   */
  async goBack(): Promise<void> {
    await this.buttonBackHome.click();
    await this.waitForNavigation();
  }

  /**
   * Get the current mode badge text.
   */
  async getModeBadgeText(): Promise<string> {
    return (await this.badgeCurrentMode.textContent()) || '';
  }
}
