/**
 * Workflow Stages Page Object Model
 *
 * Selectors and actions for the 20-stage workflow page.
 * Updated to match the official stage definitions in stages.ts.
 */

import { Page, Locator } from '@playwright/test';
import { BasePage } from './base.page';

/**
 * Stage status types matching the application.
 */
export type StageStatus = 'AVAILABLE' | 'REQUIRES_APPROVAL' | 'LOCKED' | 'COMING_SOON' | 'COMPLETED';

/**
 * Stage category types matching stages.ts.
 */
export type StageCategory = 'discovery' | 'collection' | 'analysis' | 'validation' | 'dissemination';

/**
 * Stage information.
 */
export interface StageInfo {
  number: number;
  name: string;
  category: StageCategory;
  status?: StageStatus;
  requiresPhi: boolean;
  optional: boolean;
}

/**
 * The 20 workflow stages organized by category.
 * Matches the official definition in services/web/src/workflow/stages.ts
 */
export const WORKFLOW_STAGES: Record<StageCategory, StageInfo[]> = {
  discovery: [
    { number: 1, name: 'Hypothesis Generation', category: 'discovery', requiresPhi: false, optional: false },
    { number: 2, name: 'Literature Review', category: 'discovery', requiresPhi: false, optional: false },
    { number: 3, name: 'Experimental Design', category: 'discovery', requiresPhi: false, optional: false },
  ],
  collection: [
    { number: 4, name: 'Data Collection', category: 'collection', requiresPhi: true, optional: false },
    { number: 5, name: 'Data Preprocessing', category: 'collection', requiresPhi: true, optional: false },
  ],
  analysis: [
    { number: 6, name: 'Analysis', category: 'analysis', requiresPhi: false, optional: false },
    { number: 7, name: 'Statistical Modeling', category: 'analysis', requiresPhi: false, optional: false },
    { number: 8, name: 'Visualization', category: 'analysis', requiresPhi: false, optional: false },
    { number: 11, name: 'Iteration', category: 'analysis', requiresPhi: false, optional: true },
  ],
  validation: [
    { number: 9, name: 'Interpretation', category: 'validation', requiresPhi: false, optional: false },
    { number: 10, name: 'Validation', category: 'validation', requiresPhi: false, optional: false },
    { number: 13, name: 'Internal Review', category: 'validation', requiresPhi: false, optional: true },
    { number: 14, name: 'Ethical Review', category: 'validation', requiresPhi: true, optional: false },
  ],
  dissemination: [
    { number: 12, name: 'Documentation', category: 'dissemination', requiresPhi: true, optional: false },
    { number: 15, name: 'Artifact Bundling', category: 'dissemination', requiresPhi: true, optional: false },
    { number: 16, name: 'Collaboration Handoff', category: 'dissemination', requiresPhi: true, optional: true },
    { number: 17, name: 'Archiving', category: 'dissemination', requiresPhi: false, optional: false },
    { number: 18, name: 'Impact Assessment', category: 'dissemination', requiresPhi: false, optional: true },
    { number: 19, name: 'Dissemination', category: 'dissemination', requiresPhi: true, optional: false },
    { number: 20, name: 'Conference Preparation', category: 'dissemination', requiresPhi: true, optional: false },
  ],
};

/**
 * Get all stages as a flat array.
 */
export function getAllStages(): StageInfo[] {
  return Object.values(WORKFLOW_STAGES).flat().sort((a, b) => a.number - b.number);
}

/**
 * Stages that require PHI gate passage.
 */
export const PHI_REQUIRED_STAGES = [4, 5, 12, 14, 15, 16, 19, 20];

/**
 * Optional stages that can be skipped.
 */
export const OPTIONAL_STAGES = [11, 13, 16, 18];

/**
 * Total number of stages.
 */
export const TOTAL_STAGES = 20;

/**
 * Category display names.
 */
export const CATEGORY_NAMES: Record<StageCategory, string> = {
  discovery: 'Discovery',
  collection: 'Collection',
  analysis: 'Analysis',
  validation: 'Validation',
  dissemination: 'Dissemination',
};

export class WorkflowPage extends BasePage {
  constructor(page: Page) {
    super(page);
  }

  /**
   * Navigate to the workflow stages page.
   */
  async navigate(): Promise<void> {
    await this.goto('/workflow');
    await this.waitForModeToResolve();
  }

  /**
   * Get a stage card by stage number.
   */
  getStageCard(stageNumber: number): Locator {
    return this.page.locator(`[data-testid="card-stage-${stageNumber}"]`);
  }

  /**
   * Get the action button for a stage.
   */
  getStageActionButton(stageNumber: number): Locator {
    return this.page.locator(`[data-testid="button-stage-${stageNumber}-action"]`);
  }

  /**
   * Get the status badge for a stage.
   */
  getStageBadge(stageNumber: number): Locator {
    return this.page.locator(`[data-testid="badge-stage-${stageNumber}-status"]`);
  }

  /**
   * Get the PHI gate badge for a stage.
   */
  getPhiGateBadge(stageNumber: number): Locator {
    return this.page.locator(`[data-testid="badge-phi-gate-${stageNumber}"]`);
  }

  /**
   * Count the total number of visible stage cards.
   */
  async countVisibleStages(): Promise<number> {
    const cards = this.page.locator('[data-testid^="card-stage-"]');
    return cards.count();
  }

  /**
   * Check if a stage is visible.
   */
  async isStageVisible(stageNumber: number): Promise<boolean> {
    const card = this.getStageCard(stageNumber);
    return card.isVisible().catch(() => false);
  }

  /**
   * Check if a stage has an action button (clickable).
   */
  async isStageClickable(stageNumber: number): Promise<boolean> {
    const button = this.getStageActionButton(stageNumber);
    const isVisible = await button.isVisible().catch(() => false);
    if (!isVisible) return false;

    const isDisabled = await button.isDisabled().catch(() => true);
    return !isDisabled;
  }

  /**
   * Click on a stage to navigate to it.
   */
  async clickStage(stageNumber: number): Promise<void> {
    const button = this.getStageActionButton(stageNumber);
    await button.click();
    await this.waitForNavigation();
  }

  /**
   * Get the status of a stage from its badge.
   */
  async getStageStatus(stageNumber: number): Promise<StageStatus | null> {
    const badge = this.getStageBadge(stageNumber);
    if (!(await badge.isVisible().catch(() => false))) {
      // Try getting status from card text
      const card = this.getStageCard(stageNumber);
      const text = (await card.textContent())?.toUpperCase() || '';

      if (text.includes('AVAILABLE')) return 'AVAILABLE';
      if (text.includes('APPROVAL')) return 'REQUIRES_APPROVAL';
      if (text.includes('LOCKED')) return 'LOCKED';
      if (text.includes('COMING')) return 'COMING_SOON';
      if (text.includes('COMPLETED')) return 'COMPLETED';

      return null;
    }

    const text = (await badge.textContent())?.toUpperCase() || '';

    if (text.includes('AVAILABLE')) return 'AVAILABLE';
    if (text.includes('APPROVAL')) return 'REQUIRES_APPROVAL';
    if (text.includes('LOCKED')) return 'LOCKED';
    if (text.includes('COMING')) return 'COMING_SOON';
    if (text.includes('COMPLETED')) return 'COMPLETED';

    return null;
  }

  /**
   * Check if a stage shows the PHI gate indicator.
   */
  async hasPhiGateIndicator(stageNumber: number): Promise<boolean> {
    const badge = this.getPhiGateBadge(stageNumber);
    const hasBadge = await badge.isVisible().catch(() => false);

    if (hasBadge) return true;

    // Also check for PHI text in the card
    const card = this.getStageCard(stageNumber);
    const cardText = (await card.textContent())?.toLowerCase() || '';
    return cardText.includes('phi') || cardText.includes('scan');
  }

  /**
   * Get all stages with their visibility status.
   */
  async getAllStagesVisibility(): Promise<Map<number, boolean>> {
    const visibility = new Map<number, boolean>();

    for (let i = 1; i <= TOTAL_STAGES; i++) {
      visibility.set(i, await this.isStageVisible(i));
    }

    return visibility;
  }

  /**
   * Get a category section container.
   */
  getCategorySection(category: StageCategory): Locator {
    return this.page.locator(`[data-testid="category-${category}"]`);
  }

  /**
   * Count stages in a specific category.
   */
  async countStagesInCategory(category: StageCategory): Promise<number> {
    const section = this.getCategorySection(category);
    const cards = section.locator('[data-testid^="card-stage-"]');
    return cards.count().catch(() => 0);
  }

  /**
   * Verify all PHI-required stages have PHI gate indicators.
   */
  async verifyPhiGateIndicators(): Promise<{ stageNumber: number; hasBadge: boolean }[]> {
    const results: { stageNumber: number; hasBadge: boolean }[] = [];

    for (const stageNumber of PHI_REQUIRED_STAGES) {
      const hasBadge = await this.hasPhiGateIndicator(stageNumber);
      results.push({ stageNumber, hasBadge });
    }

    return results;
  }

  /**
   * Get stage info by number.
   */
  getStageInfo(stageNumber: number): StageInfo | undefined {
    return getAllStages().find((s) => s.number === stageNumber);
  }

  /**
   * Check if a stage is optional.
   */
  isOptionalStage(stageNumber: number): boolean {
    return OPTIONAL_STAGES.includes(stageNumber);
  }

  /**
   * Check if a stage requires PHI scanning.
   */
  requiresPhiScan(stageNumber: number): boolean {
    return PHI_REQUIRED_STAGES.includes(stageNumber);
  }

  /**
   * Get stages by category.
   */
  getStagesByCategory(category: StageCategory): StageInfo[] {
    return WORKFLOW_STAGES[category];
  }

  /**
   * Scroll to a specific stage.
   */
  async scrollToStage(stageNumber: number): Promise<void> {
    const card = this.getStageCard(stageNumber);
    await card.scrollIntoViewIfNeeded();
  }

  /**
   * Verify all 20 stages are visible.
   */
  async verifyAllStagesVisible(): Promise<boolean> {
    const visibility = await this.getAllStagesVisibility();

    for (let i = 1; i <= TOTAL_STAGES; i++) {
      if (!visibility.get(i)) {
        // Try scrolling to it
        await this.scrollToStage(i);
        const isVisible = await this.isStageVisible(i);
        if (!isVisible) return false;
      }
    }

    return true;
  }
}
