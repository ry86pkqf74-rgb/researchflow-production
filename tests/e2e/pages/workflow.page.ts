/**
 * Workflow Stages Page Object Model
 *
 * Selectors and actions for the 19-stage workflow page.
 */

import { Page, Locator } from '@playwright/test';
import { BasePage } from './base.page';

/**
 * Stage status types matching the application.
 */
export type StageStatus = 'AVAILABLE' | 'REQUIRES_APPROVAL' | 'LOCKED' | 'COMING_SOON' | 'COMPLETED';

/**
 * Stage information.
 */
export interface StageInfo {
  number: number;
  name: string;
  status: StageStatus;
  requiresPhi: boolean;
}

/**
 * The 19 workflow stages organized by phase.
 */
export const WORKFLOW_STAGES = {
  // Phase 3: Data Preparation (Stages 1-4)
  dataPreparation: [
    { number: 1, name: 'Topic Declaration' },
    { number: 2, name: 'Literature Search' },
    { number: 3, name: 'IRB Proposal' },
    { number: 4, name: 'Planned Extraction' },
  ],
  // Phase 3: Data Processing (Stages 5-8)
  dataProcessing: [
    { number: 5, name: 'PHI Scanning' },
    { number: 6, name: 'Schema Extraction' },
    { number: 7, name: 'Final Scrubbing' },
    { number: 8, name: 'Data Validation' },
  ],
  // Phase 4: Analysis & Ideation (Stages 9-11)
  analysis: [
    { number: 9, name: 'Summary Characteristics' },
    { number: 10, name: 'Literature Gap Analysis' },
    { number: 11, name: 'Manuscript Ideation' },
  ],
  // Phase 4: Manuscript Development (Stages 12-14)
  manuscript: [
    { number: 12, name: 'Manuscript Selection' },
    { number: 13, name: 'Statistical Analysis' },
    { number: 14, name: 'Manuscript Drafting' },
  ],
  // Phase 5: Finalization (Stages 15-16)
  finalization: [
    { number: 15, name: 'Polish Manuscript' },
    { number: 16, name: 'Submission Readiness' },
  ],
  // Phase 5: Conference Readiness (Stages 17-19)
  conference: [
    { number: 17, name: 'Poster Preparation' },
    { number: 18, name: 'Symposium Materials' },
    { number: 19, name: 'Presentation Preparation' },
  ],
};

/**
 * Stages that require PHI gate passage.
 */
export const PHI_REQUIRED_STAGES = [9, 13, 14, 17, 18, 19];

/**
 * Total number of stages.
 */
export const TOTAL_STAGES = 19;

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
    return badge.isVisible().catch(() => false);
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
   * Get a phase group container.
   */
  getPhaseGroup(phaseName: string): Locator {
    return this.page.locator(`[data-testid="phase-${phaseName.toLowerCase().replace(/\s+/g, '-')}"]`);
  }

  /**
   * Count stages in a specific phase group.
   */
  async countStagesInPhase(phaseName: string): Promise<number> {
    const phase = this.getPhaseGroup(phaseName);
    const cards = phase.locator('[data-testid^="card-stage-"]');
    return cards.count();
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
}
