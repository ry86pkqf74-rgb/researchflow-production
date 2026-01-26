/**
 * Compliance Checker Service
 * Validate manuscripts against publishing standards
 */

import type { Manuscript, ComplianceCheckResult, IMRaDSection } from '../types';

type ChecklistType = 'ICMJE' | 'CONSORT' | 'STROBE' | 'PRISMA';

interface ComplianceItem {
  requirement: string;
  section?: IMRaDSection;
  check: (manuscript: Manuscript) => 'pass' | 'fail' | 'partial' | 'na';
}

/**
 * Compliance Checker Service - Validate against publishing standards
 */
export class ComplianceCheckerService {
  private static instance: ComplianceCheckerService;

  private constructor() {}

  static getInstance(): ComplianceCheckerService {
    if (!this.instance) {
      this.instance = new ComplianceCheckerService();
    }
    return this.instance;
  }

  /**
   * Check compliance against specified checklist
   */
  checkCompliance(manuscript: Manuscript, checklist: ChecklistType): ComplianceCheckResult {
    const items = this.getChecklistItems(checklist);
    const results = items.map(item => ({
      requirement: item.requirement,
      status: item.check(manuscript),
      section: item.section,
    }));

    const passed = results.every(r => r.status === 'pass' || r.status === 'na');
    const score = results.filter(r => r.status === 'pass').length / results.filter(r => r.status !== 'na').length;

    return {
      checklist,
      passed,
      score,
      items: results,
      report: this.generateReport(checklist, results, score),
    };
  }

  /**
   * Get checklist items for specified standard
   */
  private getChecklistItems(checklist: ChecklistType): ComplianceItem[] {
    switch (checklist) {
      case 'ICMJE':
        return this.getICMJEItems();
      case 'CONSORT':
        return this.getCONSORTItems();
      case 'STROBE':
        return this.getSTROBEItems();
      case 'PRISMA':
        return this.getPRISMAItems();
      default:
        return [];
    }
  }

  /**
   * ICMJE (International Committee of Medical Journal Editors) requirements
   */
  private getICMJEItems(): ComplianceItem[] {
    return [
      {
        requirement: 'All authors meet authorship criteria',
        check: (m) => m.authors.length > 0 ? 'pass' : 'fail',
      },
      {
        requirement: 'Conflicts of interest disclosed',
        check: (m) => m.metadata.conflicts !== undefined ? 'pass' : 'fail',
      },
      {
        requirement: 'Funding sources listed',
        check: (m) => m.metadata.funding !== undefined ? 'pass' : 'fail',
      },
      {
        requirement: 'Ethics approval documented',
        section: 'methods',
        check: (m) => m.metadata.ethics?.approved ? 'pass' : 'partial',
      },
      {
        requirement: 'Abstract structured appropriately',
        section: 'abstract',
        check: (m) => m.abstract && m.abstract.length > 100 ? 'pass' : 'fail',
      },
    ];
  }

  /**
   * CONSORT (Consolidated Standards of Reporting Trials) for RCTs
   */
  private getCONSORTItems(): ComplianceItem[] {
    return [
      {
        requirement: 'Trial registration number included',
        section: 'methods',
        check: () => 'partial', // Would check for registration number in methods
      },
      {
        requirement: 'Randomization method described',
        section: 'methods',
        check: () => 'partial',
      },
      {
        requirement: 'Blinding procedures detailed',
        section: 'methods',
        check: () => 'partial',
      },
      {
        requirement: 'Statistical methods pre-specified',
        section: 'methods',
        check: () => 'partial',
      },
      {
        requirement: 'Flow diagram present (screening, enrollment, analysis)',
        section: 'results',
        check: () => 'partial',
      },
    ];
  }

  /**
   * STROBE (Strengthening the Reporting of Observational Studies) requirements
   */
  private getSTROBEItems(): ComplianceItem[] {
    return [
      {
        requirement: 'Study design identified in title/abstract',
        section: 'abstract',
        check: (m) => m.abstract ? 'pass' : 'fail',
      },
      {
        requirement: 'Setting and dates specified',
        section: 'methods',
        check: () => 'partial',
      },
      {
        requirement: 'Eligibility criteria defined',
        section: 'methods',
        check: () => 'partial',
      },
      {
        requirement: 'Variables precisely defined',
        section: 'methods',
        check: () => 'partial',
      },
      {
        requirement: 'Bias mitigation described',
        section: 'methods',
        check: () => 'partial',
      },
    ];
  }

  /**
   * PRISMA (Preferred Reporting Items for Systematic Reviews) requirements
   */
  private getPRISMAItems(): ComplianceItem[] {
    return [
      {
        requirement: 'Protocol registered',
        check: () => 'partial',
      },
      {
        requirement: 'Search strategy detailed',
        section: 'methods',
        check: () => 'partial',
      },
      {
        requirement: 'Selection criteria defined',
        section: 'methods',
        check: () => 'partial',
      },
      {
        requirement: 'Quality assessment performed',
        section: 'methods',
        check: () => 'partial',
      },
      {
        requirement: 'PRISMA flow diagram included',
        section: 'results',
        check: () => 'partial',
      },
    ];
  }

  /**
   * Generate compliance report
   */
  private generateReport(
    checklist: ChecklistType,
    results: Array<{ requirement: string; status: string }>,
    score: number
  ): string {
    let report = `${checklist} Compliance Report\n\n`;
    report += `Overall Score: ${(score * 100).toFixed(1)}%\n\n`;

    const passed = results.filter(r => r.status === 'pass').length;
    const failed = results.filter(r => r.status === 'fail').length;
    const partial = results.filter(r => r.status === 'partial').length;

    report += `Passed: ${passed}\n`;
    report += `Failed: ${failed}\n`;
    report += `Partial: ${partial}\n\n`;

    report += 'Requirements:\n';
    for (const result of results) {
      const icon = result.status === 'pass' ? '✓' : result.status === 'fail' ? '✗' : '◐';
      report += `${icon} ${result.requirement}\n`;
    }

    return report;
  }
}

/**
 * Factory function
 */
export function getComplianceChecker(): ComplianceCheckerService {
  return ComplianceCheckerService.getInstance();
}
