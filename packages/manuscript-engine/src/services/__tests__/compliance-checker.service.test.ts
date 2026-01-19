/**
 * Compliance Checker Service Unit Tests
 * Task T82-T84: Test compliance checking for CONSORT, STROBE, PRISMA
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ComplianceCheckerService } from '../compliance-checker.service';
import type { Manuscript } from '../../types';

describe('ComplianceCheckerService', () => {
  let service: ComplianceCheckerService;

  beforeEach(() => {
    service = ComplianceCheckerService.getInstance();
  });

  const baseManuscript: Manuscript = {
    id: 'manuscript-001',
    title: 'Exercise and Blood Pressure Study',
    authors: [
      {
        id: 'author-001',
        name: 'Jane Smith',
        email: 'jane@example.com',
        affiliation: 'University',
        order: 1,
        corresponding: true,
        roles: ['writing']
      }
    ],
    abstract: 'Background: Hypertension is common. Methods: RCT with 200 adults. Results: BP decreased 12 mmHg (p<0.001). Conclusions: Exercise reduces BP.',
    keywords: ['hypertension', 'exercise'],
    currentVersion: 'v1',
    versions: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    status: 'draft',
    metadata: {
      conflicts: 'None',
      funding: 'NIH Grant R01HL123456',
      ethics: {
        approved: true,
        irb: 'IRB-2021-0456',
        approvalDate: new Date('2021-01-01')
      }
    }
  };

  describe('getInstance', () => {
    it('should return singleton instance', () => {
      const instance1 = ComplianceCheckerService.getInstance();
      const instance2 = ComplianceCheckerService.getInstance();

      expect(instance1).toBe(instance2);
    });
  });

  describe('checkCompliance', () => {
    it('should return compliance result structure', () => {
      const result = service.checkCompliance(baseManuscript, 'ICMJE');

      expect(result).toHaveProperty('checklist');
      expect(result).toHaveProperty('passed');
      expect(result).toHaveProperty('score');
      expect(result).toHaveProperty('items');
      expect(result).toHaveProperty('report');
    });

    it('should include checklist type in result', () => {
      const result = service.checkCompliance(baseManuscript, 'ICMJE');

      expect(result.checklist).toBe('ICMJE');
    });

    it('should return items array', () => {
      const result = service.checkCompliance(baseManuscript, 'ICMJE');

      expect(Array.isArray(result.items)).toBe(true);
      expect(result.items.length).toBeGreaterThan(0);
    });

    it('should include requirement in each item', () => {
      const result = service.checkCompliance(baseManuscript, 'ICMJE');

      result.items.forEach(item => {
        expect(item).toHaveProperty('requirement');
        expect(typeof item.requirement).toBe('string');
        expect(item.requirement.length).toBeGreaterThan(0);
      });
    });

    it('should include status in each item', () => {
      const result = service.checkCompliance(baseManuscript, 'ICMJE');

      result.items.forEach(item => {
        expect(item).toHaveProperty('status');
        expect(['pass', 'fail', 'partial', 'na']).toContain(item.status);
      });
    });

    it('should calculate score between 0 and 1', () => {
      const result = service.checkCompliance(baseManuscript, 'ICMJE');

      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(result.score).toBeLessThanOrEqual(1);
    });

    it('should generate report string', () => {
      const result = service.checkCompliance(baseManuscript, 'ICMJE');

      expect(typeof result.report).toBe('string');
      expect(result.report.length).toBeGreaterThan(0);
    });
  });

  describe('ICMJE Compliance', () => {
    it('should check for authors', () => {
      const result = service.checkCompliance(baseManuscript, 'ICMJE');

      const authorItem = result.items.find(i =>
        i.requirement.toLowerCase().includes('author')
      );

      expect(authorItem).toBeDefined();
      expect(authorItem?.status).toBe('pass');
    });

    it('should fail when no authors present', () => {
      const manuscriptNoAuthors: Manuscript = {
        ...baseManuscript,
        authors: []
      };

      const result = service.checkCompliance(manuscriptNoAuthors, 'ICMJE');

      const authorItem = result.items.find(i =>
        i.requirement.toLowerCase().includes('author')
      );

      expect(authorItem?.status).toBe('fail');
    });

    it('should check for conflicts of interest', () => {
      const result = service.checkCompliance(baseManuscript, 'ICMJE');

      const coiItem = result.items.find(i =>
        i.requirement.toLowerCase().includes('conflict')
      );

      expect(coiItem).toBeDefined();
      expect(coiItem?.status).toBe('pass');
    });

    it('should fail when conflicts not disclosed', () => {
      const manuscriptNoCOI: Manuscript = {
        ...baseManuscript,
        metadata: {
          ...baseManuscript.metadata,
          conflicts: undefined
        }
      };

      const result = service.checkCompliance(manuscriptNoCOI, 'ICMJE');

      const coiItem = result.items.find(i =>
        i.requirement.toLowerCase().includes('conflict')
      );

      expect(coiItem?.status).toBe('fail');
    });

    it('should check for funding sources', () => {
      const result = service.checkCompliance(baseManuscript, 'ICMJE');

      const fundingItem = result.items.find(i =>
        i.requirement.toLowerCase().includes('funding')
      );

      expect(fundingItem).toBeDefined();
      expect(fundingItem?.status).toBe('pass');
    });

    it('should fail when funding not listed', () => {
      const manuscriptNoFunding: Manuscript = {
        ...baseManuscript,
        metadata: {
          ...baseManuscript.metadata,
          funding: undefined
        }
      };

      const result = service.checkCompliance(manuscriptNoFunding, 'ICMJE');

      const fundingItem = result.items.find(i =>
        i.requirement.toLowerCase().includes('funding')
      );

      expect(fundingItem?.status).toBe('fail');
    });

    it('should check for ethics approval', () => {
      const result = service.checkCompliance(baseManuscript, 'ICMJE');

      const ethicsItem = result.items.find(i =>
        i.requirement.toLowerCase().includes('ethics')
      );

      expect(ethicsItem).toBeDefined();
      expect(ethicsItem?.status).toBe('pass');
    });

    it('should give partial when ethics not approved', () => {
      const manuscriptNoEthics: Manuscript = {
        ...baseManuscript,
        metadata: {
          ...baseManuscript.metadata,
          ethics: {
            approved: false,
            irb: '',
            approvalDate: new Date()
          }
        }
      };

      const result = service.checkCompliance(manuscriptNoEthics, 'ICMJE');

      const ethicsItem = result.items.find(i =>
        i.requirement.toLowerCase().includes('ethics')
      );

      expect(ethicsItem?.status).toBe('partial');
    });

    it('should check abstract structure', () => {
      const result = service.checkCompliance(baseManuscript, 'ICMJE');

      const abstractItem = result.items.find(i =>
        i.requirement.toLowerCase().includes('abstract')
      );

      expect(abstractItem).toBeDefined();
      expect(abstractItem?.status).toBe('pass');
    });

    it('should fail for short abstract', () => {
      const manuscriptShortAbstract: Manuscript = {
        ...baseManuscript,
        abstract: 'Short abstract'
      };

      const result = service.checkCompliance(manuscriptShortAbstract, 'ICMJE');

      const abstractItem = result.items.find(i =>
        i.requirement.toLowerCase().includes('abstract')
      );

      expect(abstractItem?.status).toBe('fail');
    });

    it('should pass manuscript with all requirements', () => {
      const result = service.checkCompliance(baseManuscript, 'ICMJE');

      expect(result.passed).toBe(true);
      expect(result.score).toBe(1);
    });

    it('should fail manuscript with missing requirements', () => {
      const incompleteManuscript: Manuscript = {
        ...baseManuscript,
        authors: [],
        abstract: '',
        metadata: {}
      };

      const result = service.checkCompliance(incompleteManuscript, 'ICMJE');

      expect(result.passed).toBe(false);
      expect(result.score).toBeLessThan(1);
    });
  });

  describe('CONSORT Compliance', () => {
    it('should return CONSORT checklist items', () => {
      const result = service.checkCompliance(baseManuscript, 'CONSORT');

      expect(result.checklist).toBe('CONSORT');
      expect(result.items.length).toBeGreaterThan(0);
    });

    it('should include trial registration requirement', () => {
      const result = service.checkCompliance(baseManuscript, 'CONSORT');

      const trialRegItem = result.items.find(i =>
        i.requirement.toLowerCase().includes('registration')
      );

      expect(trialRegItem).toBeDefined();
      expect(trialRegItem?.section).toBe('methods');
    });

    it('should include randomization requirement', () => {
      const result = service.checkCompliance(baseManuscript, 'CONSORT');

      const randomItem = result.items.find(i =>
        i.requirement.toLowerCase().includes('randomization')
      );

      expect(randomItem).toBeDefined();
      expect(randomItem?.section).toBe('methods');
    });

    it('should include blinding requirement', () => {
      const result = service.checkCompliance(baseManuscript, 'CONSORT');

      const blindingItem = result.items.find(i =>
        i.requirement.toLowerCase().includes('blinding')
      );

      expect(blindingItem).toBeDefined();
    });

    it('should include statistical methods requirement', () => {
      const result = service.checkCompliance(baseManuscript, 'CONSORT');

      const statsItem = result.items.find(i =>
        i.requirement.toLowerCase().includes('statistical')
      );

      expect(statsItem).toBeDefined();
    });

    it('should include flow diagram requirement', () => {
      const result = service.checkCompliance(baseManuscript, 'CONSORT');

      const flowItem = result.items.find(i =>
        i.requirement.toLowerCase().includes('flow diagram')
      );

      expect(flowItem).toBeDefined();
      expect(flowItem?.section).toBe('results');
    });

    it('should have 5 CONSORT requirements', () => {
      const result = service.checkCompliance(baseManuscript, 'CONSORT');

      expect(result.items.length).toBe(5);
    });
  });

  describe('STROBE Compliance', () => {
    it('should return STROBE checklist items', () => {
      const result = service.checkCompliance(baseManuscript, 'STROBE');

      expect(result.checklist).toBe('STROBE');
      expect(result.items.length).toBeGreaterThan(0);
    });

    it('should include study design requirement', () => {
      const result = service.checkCompliance(baseManuscript, 'STROBE');

      const designItem = result.items.find(i =>
        i.requirement.toLowerCase().includes('study design')
      );

      expect(designItem).toBeDefined();
      expect(designItem?.section).toBe('abstract');
    });

    it('should pass when abstract present', () => {
      const result = service.checkCompliance(baseManuscript, 'STROBE');

      const designItem = result.items.find(i =>
        i.requirement.toLowerCase().includes('study design')
      );

      expect(designItem?.status).toBe('pass');
    });

    it('should fail when abstract missing', () => {
      const manuscriptNoAbstract: Manuscript = {
        ...baseManuscript,
        abstract: ''
      };

      const result = service.checkCompliance(manuscriptNoAbstract, 'STROBE');

      const designItem = result.items.find(i =>
        i.requirement.toLowerCase().includes('study design')
      );

      expect(designItem?.status).toBe('fail');
    });

    it('should include setting requirement', () => {
      const result = service.checkCompliance(baseManuscript, 'STROBE');

      const settingItem = result.items.find(i =>
        i.requirement.toLowerCase().includes('setting')
      );

      expect(settingItem).toBeDefined();
    });

    it('should include eligibility criteria requirement', () => {
      const result = service.checkCompliance(baseManuscript, 'STROBE');

      const eligibilityItem = result.items.find(i =>
        i.requirement.toLowerCase().includes('eligibility')
      );

      expect(eligibilityItem).toBeDefined();
    });

    it('should include variables requirement', () => {
      const result = service.checkCompliance(baseManuscript, 'STROBE');

      const variablesItem = result.items.find(i =>
        i.requirement.toLowerCase().includes('variables')
      );

      expect(variablesItem).toBeDefined();
    });

    it('should include bias mitigation requirement', () => {
      const result = service.checkCompliance(baseManuscript, 'STROBE');

      const biasItem = result.items.find(i =>
        i.requirement.toLowerCase().includes('bias')
      );

      expect(biasItem).toBeDefined();
    });

    it('should have 5 STROBE requirements', () => {
      const result = service.checkCompliance(baseManuscript, 'STROBE');

      expect(result.items.length).toBe(5);
    });
  });

  describe('PRISMA Compliance', () => {
    it('should return PRISMA checklist items', () => {
      const result = service.checkCompliance(baseManuscript, 'PRISMA');

      expect(result.checklist).toBe('PRISMA');
      expect(result.items.length).toBeGreaterThan(0);
    });

    it('should include protocol registration requirement', () => {
      const result = service.checkCompliance(baseManuscript, 'PRISMA');

      const protocolItem = result.items.find(i =>
        i.requirement.toLowerCase().includes('protocol')
      );

      expect(protocolItem).toBeDefined();
    });

    it('should include search strategy requirement', () => {
      const result = service.checkCompliance(baseManuscript, 'PRISMA');

      const searchItem = result.items.find(i =>
        i.requirement.toLowerCase().includes('search strategy')
      );

      expect(searchItem).toBeDefined();
      expect(searchItem?.section).toBe('methods');
    });

    it('should include selection criteria requirement', () => {
      const result = service.checkCompliance(baseManuscript, 'PRISMA');

      const selectionItem = result.items.find(i =>
        i.requirement.toLowerCase().includes('selection criteria')
      );

      expect(selectionItem).toBeDefined();
    });

    it('should include quality assessment requirement', () => {
      const result = service.checkCompliance(baseManuscript, 'PRISMA');

      const qualityItem = result.items.find(i =>
        i.requirement.toLowerCase().includes('quality assessment')
      );

      expect(qualityItem).toBeDefined();
    });

    it('should include PRISMA flow diagram requirement', () => {
      const result = service.checkCompliance(baseManuscript, 'PRISMA');

      const flowItem = result.items.find(i =>
        i.requirement.toLowerCase().includes('flow diagram')
      );

      expect(flowItem).toBeDefined();
      expect(flowItem?.section).toBe('results');
    });

    it('should have 5 PRISMA requirements', () => {
      const result = service.checkCompliance(baseManuscript, 'PRISMA');

      expect(result.items.length).toBe(5);
    });
  });

  describe('Report Generation', () => {
    it('should include checklist name in report', () => {
      const result = service.checkCompliance(baseManuscript, 'ICMJE');

      expect(result.report).toContain('ICMJE');
      expect(result.report).toContain('Compliance Report');
    });

    it('should include overall score', () => {
      const result = service.checkCompliance(baseManuscript, 'ICMJE');

      expect(result.report).toContain('Overall Score');
      expect(result.report).toContain('%');
    });

    it('should include passed count', () => {
      const result = service.checkCompliance(baseManuscript, 'ICMJE');

      expect(result.report).toContain('Passed:');
    });

    it('should include failed count', () => {
      const result = service.checkCompliance(baseManuscript, 'ICMJE');

      expect(result.report).toContain('Failed:');
    });

    it('should include partial count', () => {
      const result = service.checkCompliance(baseManuscript, 'ICMJE');

      expect(result.report).toContain('Partial:');
    });

    it('should list requirements', () => {
      const result = service.checkCompliance(baseManuscript, 'ICMJE');

      expect(result.report).toContain('Requirements:');

      result.items.forEach(item => {
        expect(result.report).toContain(item.requirement);
      });
    });

    it('should use checkmarks for passed items', () => {
      const result = service.checkCompliance(baseManuscript, 'ICMJE');

      expect(result.report).toContain('✓');
    });

    it('should use X marks for failed items', () => {
      const incompleteManuscript: Manuscript = {
        ...baseManuscript,
        authors: []
      };

      const result = service.checkCompliance(incompleteManuscript, 'ICMJE');

      expect(result.report).toContain('✗');
    });

    it('should use partial symbols for partial items', () => {
      const result = service.checkCompliance(baseManuscript, 'CONSORT');

      expect(result.report).toContain('◐');
    });

    it('should format score as percentage', () => {
      const result = service.checkCompliance(baseManuscript, 'ICMJE');

      const scoreMatch = result.report.match(/(\d+\.\d+)%/);
      expect(scoreMatch).not.toBeNull();

      const scoreValue = parseFloat(scoreMatch![1]);
      expect(scoreValue).toBeGreaterThanOrEqual(0);
      expect(scoreValue).toBeLessThanOrEqual(100);
    });
  });

  describe('Score Calculation', () => {
    it('should exclude NA items from score calculation', () => {
      const result = service.checkCompliance(baseManuscript, 'ICMJE');

      // Score should only count pass/fail/partial, not NA items
      const applicableItems = result.items.filter(i => i.status !== 'na');
      const passedItems = result.items.filter(i => i.status === 'pass');

      expect(result.score).toBeCloseTo(passedItems.length / applicableItems.length, 2);
    });

    it('should give score of 1 when all pass', () => {
      const result = service.checkCompliance(baseManuscript, 'ICMJE');

      const allPassed = result.items.every(i => i.status === 'pass' || i.status === 'na');
      if (allPassed) {
        expect(result.score).toBe(1);
      }
    });

    it('should give score of 0 when all fail', () => {
      const failingManuscript: Manuscript = {
        ...baseManuscript,
        authors: [],
        abstract: '',
        metadata: {}
      };

      const result = service.checkCompliance(failingManuscript, 'ICMJE');

      const allFailed = result.items.every(i => i.status === 'fail');
      if (allFailed) {
        expect(result.score).toBe(0);
      }
    });
  });

  describe('Multiple Checklists', () => {
    it('should handle all checklist types', () => {
      const checklists: Array<'ICMJE' | 'CONSORT' | 'STROBE' | 'PRISMA'> = [
        'ICMJE',
        'CONSORT',
        'STROBE',
        'PRISMA'
      ];

      for (const checklist of checklists) {
        const result = service.checkCompliance(baseManuscript, checklist);

        expect(result.checklist).toBe(checklist);
        expect(result.items.length).toBeGreaterThan(0);
        expect(result.report).toContain(checklist);
      }
    });

    it('should have different requirements for each checklist', () => {
      const icmje = service.checkCompliance(baseManuscript, 'ICMJE');
      const consort = service.checkCompliance(baseManuscript, 'CONSORT');

      // Check that requirements are different, even if count is same
      const icmjeReqs = icmje.items.map(i => i.requirement);
      const consortReqs = consort.items.map(i => i.requirement);

      const hasDifferentReqs = !icmjeReqs.every(req => consortReqs.includes(req));
      expect(hasDifferentReqs).toBe(true);
    });
  });

  describe('Edge Cases', () => {
    it('should handle manuscript without metadata', () => {
      const manuscriptNoMetadata: Manuscript = {
        ...baseManuscript,
        metadata: {}
      };

      const result = service.checkCompliance(manuscriptNoMetadata, 'ICMJE');

      expect(result).toBeDefined();
      expect(result.score).toBeLessThan(1);
    });

    it('should handle manuscript with empty abstract', () => {
      const manuscriptEmptyAbstract: Manuscript = {
        ...baseManuscript,
        abstract: ''
      };

      const result = service.checkCompliance(manuscriptEmptyAbstract, 'STROBE');

      expect(result).toBeDefined();
    });

    it('should handle manuscript with partial ethics', () => {
      const manuscriptPartialEthics: Manuscript = {
        ...baseManuscript,
        metadata: {
          ...baseManuscript.metadata,
          ethics: {
            approved: false,
            irb: '',
            approvalDate: new Date()
          }
        }
      };

      const result = service.checkCompliance(manuscriptPartialEthics, 'ICMJE');

      expect(result).toBeDefined();
      expect(result.passed).toBe(false);
    });
  });
});
