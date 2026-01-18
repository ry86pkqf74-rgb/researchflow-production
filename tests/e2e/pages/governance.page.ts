/**
 * Governance Page Object Model
 *
 * Selectors and actions for the governance dashboard page.
 */

import { Page, Locator } from '@playwright/test';
import { BasePage } from './base.page';

export class GovernancePage extends BasePage {
  // Tab selectors
  readonly tabStatus: Locator;
  readonly tabPolicy: Locator;
  readonly tabPhiIncident: Locator;
  readonly tabAudit: Locator;

  // Card selectors
  readonly cardSystemMode: Locator;
  readonly cardActiveFlags: Locator;
  readonly cardOperationsTable: Locator;
  readonly cardPhiResponse: Locator;
  readonly cardIncidentLog: Locator;
  readonly cardAuditLog: Locator;

  // Mode display
  readonly textCurrentMode: Locator;

  // Buttons
  readonly buttonBackHome: Locator;
  readonly buttonExportAudit: Locator;

  constructor(page: Page) {
    super(page);

    // Tabs
    this.tabStatus = page.locator('[data-testid="tab-status"]');
    this.tabPolicy = page.locator('[data-testid="tab-policy"]');
    this.tabPhiIncident = page.locator('[data-testid="tab-phi-incident"]');
    this.tabAudit = page.locator('[data-testid="tab-audit"]');

    // Cards
    this.cardSystemMode = page.locator('[data-testid="card-system-mode"]');
    this.cardActiveFlags = page.locator('[data-testid="card-active-flags"]');
    this.cardOperationsTable = page.locator('[data-testid="card-operations-table"]');
    this.cardPhiResponse = page.locator('[data-testid="card-phi-response"]');
    this.cardIncidentLog = page.locator('[data-testid="card-incident-log"]');
    this.cardAuditLog = page.locator('[data-testid="card-audit-log"]');

    // Mode text
    this.textCurrentMode = page.locator('[data-testid="text-current-mode"]');

    // Buttons
    this.buttonBackHome = page.locator('[data-testid="button-back-home"]');
    this.buttonExportAudit = page.locator('[data-testid="button-export-audit"]');
  }

  /**
   * Navigate to the governance page.
   */
  async navigate(): Promise<void> {
    await this.goto('/governance');
    await this.waitForModeToResolve();
  }

  /**
   * Get the displayed current mode text.
   */
  async getModeText(): Promise<string> {
    await this.textCurrentMode.waitFor({ state: 'visible', timeout: 5000 });
    return (await this.textCurrentMode.textContent()) || '';
  }

  /**
   * Click on a specific tab.
   */
  async clickTab(tab: 'status' | 'policy' | 'phi-incident' | 'audit'): Promise<void> {
    const tabMap = {
      status: this.tabStatus,
      policy: this.tabPolicy,
      'phi-incident': this.tabPhiIncident,
      audit: this.tabAudit,
    };

    await tabMap[tab].click();
  }

  /**
   * Get a feature flag element by name.
   */
  getFlag(flagName: string): Locator {
    return this.page.locator(`[data-testid="flag-${flagName.toLowerCase()}"]`);
  }

  /**
   * Check if a specific flag is enabled (visible and toggled on).
   */
  async isFlagEnabled(flagName: string): Promise<boolean> {
    const flag = this.getFlag(flagName);
    if (!(await flag.isVisible().catch(() => false))) {
      return false;
    }
    // Check for enabled state (could be a switch, checkbox, or badge)
    const isChecked = await flag.getAttribute('data-state');
    return isChecked === 'checked' || isChecked === 'on';
  }

  /**
   * Get an operation row by operation name.
   */
  getOperation(operationName: string): Locator {
    return this.page.locator(`[data-testid="operation-${operationName.toLowerCase().replace(/\s+/g, '-')}"]`);
  }

  /**
   * Check if the operations table shows an operation as allowed.
   */
  async isOperationAllowed(operationName: string): Promise<boolean> {
    const operation = this.getOperation(operationName);
    if (!(await operation.isVisible().catch(() => false))) {
      return false;
    }
    // Look for checkmark or "allowed" indicator
    const allowedIndicator = operation.locator('[data-testid$="-allowed"]');
    return allowedIndicator.isVisible().catch(() => false);
  }

  /**
   * Get a PHI checklist step by step number.
   */
  getPhiStep(stepNumber: number): Locator {
    return this.page.locator(`[data-testid="step-${stepNumber}"]`);
  }

  /**
   * Toggle a PHI checklist step checkbox.
   */
  async togglePhiStep(stepNumber: number): Promise<void> {
    const checkbox = this.page.locator(`[data-testid="checkbox-step-${stepNumber}"]`);
    await checkbox.click();
  }

  /**
   * Get a specific incident from the incident log.
   */
  getIncident(incidentId: string): Locator {
    return this.page.locator(`[data-testid="incident-${incidentId}"]`);
  }

  /**
   * Click the export audit button.
   */
  async exportAudit(): Promise<void> {
    await this.clickTab('audit');
    await this.buttonExportAudit.click();
  }

  /**
   * Go back to home page.
   */
  async goBack(): Promise<void> {
    await this.buttonBackHome.click();
    await this.waitForNavigation();
  }
}
