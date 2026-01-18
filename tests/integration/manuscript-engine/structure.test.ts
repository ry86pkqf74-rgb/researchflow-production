/**
 * Structure Building Integration Tests
 * Task T60: Full IMRaD assembly and structure tests
 */

import { describe, it, expect, beforeAll } from '@jest/globals';
import { IMRAD_TEMPLATE, getTemplateById, listTemplates } from '../../../packages/manuscript-engine/src/templates/imrad-templates';
import { NEJM_TEMPLATE, JAMA_TEMPLATE, LANCET_TEMPLATE, BMJ_TEMPLATE, getJournalTemplate } from '../../../packages/manuscript-engine/src/templates/journal-templates';
import { abstractGeneratorService } from '../../../packages/manuscript-engine/src/services/abstract-generator.service';
import { introductionBuilderService } from '../../../packages/manuscript-engine/src/services/introduction-builder.service';
import { methodsPopulatorService } from '../../../packages/manuscript-engine/src/services/methods-populator.service';
import { resultsScaffoldService } from '../../../packages/manuscript-engine/src/services/results-scaffold.service';
import { discussionBuilderService } from '../../../packages/manuscript-engine/src/services/discussion-builder.service';
import { referencesBuilderService } from '../../../packages/manuscript-engine/src/services/references-builder.service';
import { acknowledgmentsService } from '../../../packages/manuscript-engine/src/services/acknowledgments.service';
import { wordCountTrackerService } from '../../../packages/manuscript-engine/src/services/word-count-tracker.service';
import { outlineExpanderService } from '../../../packages/manuscript-engine/src/services/outline-expander.service';
import { keywordGeneratorService } from '../../../packages/manuscript-engine/src/services/keyword-generator.service';
import { coiDisclosureService } from '../../../packages/manuscript-engine/src/services/coi-disclosure.service';
import { appendicesBuilderService } from '../../../packages/manuscript-engine/src/services/appendices-builder.service';
import { titleGeneratorService } from '../../../packages/manuscript-engine/src/services/title-generator.service';
import { authorManagerService } from '../../../packages/manuscript-engine/src/services/author-manager.service';
import { branchManagerService } from '../../../packages/manuscript-engine/src/services/branch-manager.service';

describe('Phase 3: Structure Building Integration', () => {
  const mockManuscriptId = 'manuscript-test-structure';

  describe('T41: IMRaD Templates', () => {
    it('loads standard IMRaD template', () => {
      expect(IMRAD_TEMPLATE.id).toBe('imrad-standard');
      expect(IMRAD_TEMPLATE.type).toBe('imrad');
      expect(IMRAD_TEMPLATE.sections.length).toBeGreaterThan(0);
    });

    it('gets template by ID', () => {
      const template = getTemplateById('imrad-standard');
      expect(template).toBeDefined();
      expect(template?.name).toBe('Standard IMRaD Article');
    });

    it('lists all templates', () => {
      const templates = listTemplates();
      expect(templates.length).toBeGreaterThanOrEqual(3);
      expect(templates.some(t => t.id === 'imrad-standard')).toBe(true);
    });

    it('has required sections in IMRaD template', () => {
      const requiredSections = ['title', 'abstract', 'introduction', 'methods', 'results', 'discussion', 'references'];
      expect(IMRAD_TEMPLATE.requiredSections).toEqual(expect.arrayContaining(requiredSections));
    });

    it('has word limits defined', () => {
      expect(IMRAD_TEMPLATE.wordLimits.abstract).toBeDefined();
      expect(IMRAD_TEMPLATE.wordLimits.total).toBeDefined();
    });
  });

  describe('T42: Abstract Generator', () => {
    it('generates structured abstract', async () => {
      const abstract = await abstractGeneratorService.generateAbstract({
        manuscriptId: mockManuscriptId,
        style: 'structured',
        maxWords: 300,
        autofill: {
          studyDesign: 'retrospective cohort study',
          sampleSize: 500,
          primaryOutcome: 'mortality',
        },
      });

      expect(abstract.style).toBe('structured');
      expect(abstract.sections.length).toBe(4); // Background, Methods, Results, Conclusions
      expect(abstract.wordCount).toBeLessThanOrEqual(300);
    });

    it('generates unstructured abstract', async () => {
      const abstract = await abstractGeneratorService.generateAbstract({
        manuscriptId: mockManuscriptId,
        style: 'unstructured',
        maxWords: 250,
      });

      expect(abstract.style).toBe('unstructured');
      expect(abstract.sections.length).toBe(1);
    });

    it('generates journal-specific abstract', async () => {
      const abstract = await abstractGeneratorService.generateAbstract({
        manuscriptId: mockManuscriptId,
        style: 'journal_specific',
        journalTemplate: 'nejm',
        maxWords: 250,
      });

      expect(abstract.style).toBe('journal_specific');
      expect(abstract.wordCount).toBeLessThanOrEqual(250);
    });

    it('checks abstract quality', async () => {
      const abstract = await abstractGeneratorService.generateAbstract({
        manuscriptId: mockManuscriptId,
        style: 'structured',
        maxWords: 300,
      });

      expect(abstract.warnings).toBeDefined();
      expect(Array.isArray(abstract.warnings)).toBe(true);
    });
  });

  describe('T43: Introduction Builder', () => {
    it('builds structured introduction', async () => {
      const intro = await introductionBuilderService.buildIntroduction({
        manuscriptId: mockManuscriptId,
        topic: 'Cancer Treatment Outcomes',
        studyObjective: 'evaluate treatment efficacy',
        maxWords: 800,
      });

      expect(intro.sections.length).toBeGreaterThanOrEqual(3);
      expect(intro.structure).toBe('funnel');
      expect(intro.wordCount).toBeLessThanOrEqual(800);
    });

    it('includes required section types', async () => {
      const intro = await introductionBuilderService.buildIntroduction({
        manuscriptId: mockManuscriptId,
        topic: 'Test Topic',
        maxWords: 600,
      });

      const sectionTypes = intro.sections.map(s => s.type);
      expect(sectionTypes).toContain('background');
      expect(sectionTypes).toContain('objective');
    });

    it('builds introduction from outline', async () => {
      const outline = [
        'Cancer is a major public health concern',
        'Treatment options have evolved',
        'Gaps remain in understanding outcomes',
      ];

      const intro = await introductionBuilderService.buildFromOutline(mockManuscriptId, outline);

      expect(intro.sections.length).toBe(outline.length);
    });
  });

  describe('T44-T48: Section Builders', () => {
    it('populates methods section', async () => {
      const methods = await methodsPopulatorService.populateMethods({
        manuscriptId: mockManuscriptId,
        datasetIds: ['dataset-1'],
        studyDesign: 'retrospective cohort study',
      });

      expect(methods.sections).toBeDefined();
      expect(methods.sections.studyDesign).toContain('cohort');
      expect(methods.fullText.length).toBeGreaterThan(0);
    });

    it('creates results scaffold', async () => {
      const scaffold = await resultsScaffoldService.createScaffold({
        manuscriptId: mockManuscriptId,
        datasetIds: ['dataset-1'],
        primaryOutcome: 'mortality',
        includeFlowDiagram: true,
        includeBaselineTable: true,
      });

      expect(scaffold.outline.length).toBeGreaterThan(0);
      expect(scaffold.suggestedFigures.length).toBeGreaterThan(0);
      expect(scaffold.suggestedTables.length).toBeGreaterThan(0);
    });

    it('builds discussion section', async () => {
      const discussion = await discussionBuilderService.buildDiscussion({
        manuscriptId: mockManuscriptId,
        mainFinding: 'Treatment improved outcomes',
        studyStrengths: ['Large sample size', 'Prospective design'],
        studyLimitations: ['Single center', 'Retrospective'],
      });

      expect(discussion.sections.length).toBe(6);
      expect(discussion.sections.some(s => s.type === 'key_findings')).toBe(true);
      expect(discussion.sections.some(s => s.type === 'limitations')).toBe(true);
    });

    it('builds references section', async () => {
      const references = await referencesBuilderService.buildReferences({
        manuscriptId: mockManuscriptId,
        citationIds: ['cit-1', 'cit-2', 'cit-3'],
        format: 'ama',
      });

      expect(references.totalReferences).toBe(3);
      expect(references.references.length).toBe(3);
      expect(references.fullText.length).toBeGreaterThan(0);
    });

    it('generates acknowledgments', async () => {
      const acknowledgments = await acknowledgmentsService.generateAcknowledgments({
        manuscriptId: mockManuscriptId,
        funding: [{ agency: 'NIH', grantNumber: 'R01-12345', role: 'funded' }],
        ethicsApproval: {
          institution: 'Test University',
          irbNumber: 'IRB-2023-001',
        },
      });

      expect(acknowledgments.sections.funding).toContain('NIH');
      expect(acknowledgments.sections.ethics).toContain('IRB-2023-001');
    });
  });

  describe('T50-T51: Support Services', () => {
    it('tracks word counts', () => {
      const report = wordCountTrackerService.trackWordCount({
        manuscriptId: mockManuscriptId,
        sections: [
          { sectionId: 'abstract', sectionType: 'abstract', content: 'This is a test abstract with some words.' },
          { sectionId: 'intro', sectionType: 'introduction', content: 'This is an introduction section.' },
        ],
        limits: {
          abstract: { max: 300 },
          introduction: { max: 800 },
          total: { max: 5000 },
        },
      });

      expect(report.sections.length).toBe(2);
      expect(report.totalWords).toBeGreaterThan(0);
      expect(report.withinLimits).toBeDefined();
    });

    it('expands outline to prose', async () => {
      const expanded = await outlineExpanderService.expandOutline({
        manuscriptId: mockManuscriptId,
        outline: [
          { id: '1', level: 1, text: 'Main point one', children: [] },
          { id: '2', level: 1, text: 'Main point two', children: [] },
        ],
        style: 'formal',
      });

      expect(expanded.paragraphs.length).toBe(2);
      expect(expanded.wordCount).toBeGreaterThan(10); // Should be expanded
      expect(expanded.expansionRatio).toBeGreaterThan(1);
    });
  });

  describe('T53: Journal Templates', () => {
    it('loads NEJM template', () => {
      expect(NEJM_TEMPLATE.id).toBe('nejm-original-article');
      expect(NEJM_TEMPLATE.wordLimits.abstract?.max).toBe(250);
      expect(NEJM_TEMPLATE.wordLimits.total?.max).toBe(3000);
    });

    it('loads JAMA template', () => {
      expect(JAMA_TEMPLATE.id).toBe('jama-original-investigation');
      expect(JAMA_TEMPLATE.wordLimits.abstract?.max).toBe(350);
    });

    it('loads Lancet template', () => {
      expect(LANCET_TEMPLATE.id).toBe('lancet-article');
      expect(LANCET_TEMPLATE.wordLimits.total?.max).toBe(4500);
    });

    it('loads BMJ template', () => {
      expect(BMJ_TEMPLATE.id).toBe('bmj-research');
      expect(BMJ_TEMPLATE.wordLimits.abstract?.max).toBe(300);
    });

    it('gets journal template by ID', () => {
      const template = getJournalTemplate('nejm');
      expect(template).toBeDefined();
      expect(template?.name).toBe('NEJM Original Article');
    });
  });

  describe('T54-T59: Additional Support Services', () => {
    it('generates keywords', async () => {
      const keywords = await keywordGeneratorService.generateKeywords({
        manuscriptId: mockManuscriptId,
        text: 'Cancer treatment outcomes in elderly patients with advanced disease',
        count: 5,
        includeMeSH: true,
      });

      expect(keywords.keywords.length).toBeGreaterThan(0);
      expect(keywords.meshTerms).toBeDefined();
      expect(keywords.suggestions.length).toBeGreaterThan(0);
    });

    it('generates COI disclosure', async () => {
      const disclosure = await coiDisclosureService.generateDisclosure({
        manuscriptId: mockManuscriptId,
        authors: [
          { name: 'John Smith', hasConflict: false },
          {
            name: 'Jane Doe',
            hasConflict: true,
            disclosures: {
              financialRelationships: ['Consultant for PharmaCo'],
            },
          },
        ],
        studyFunding: ['NIH R01-12345'],
      });

      expect(disclosure.icmjeCompliant).toBe(true);
      expect(disclosure.fullStatement).toContain('Jane Doe');
      expect(disclosure.fundingStatement).toContain('NIH');
    });

    it('builds appendices', async () => {
      const appendices = await appendicesBuilderService.buildAppendices({
        manuscriptId: mockManuscriptId,
        appendices: [
          {
            id: 'app-1',
            type: 'supplementary_table',
            title: 'Supplementary Results',
            description: 'Additional analysis results',
          },
          {
            id: 'app-2',
            type: 'supplementary_figure',
            title: 'Kaplan-Meier Curves',
            description: 'Survival analysis',
          },
        ],
      });

      expect(appendices.appendices.length).toBe(2);
      expect(appendices.tableOfContents).toContain('Supplementary');
    });

    it('generates title options', async () => {
      const titles = await titleGeneratorService.generateTitles({
        manuscriptId: mockManuscriptId,
        mainFinding: 'Treatment improves survival',
        studyDesign: 'retrospective cohort study',
        population: 'elderly patients',
        maxLength: 150,
      });

      expect(titles.titles.length).toBeGreaterThan(0);
      expect(titles.recommendations.length).toBeGreaterThan(0);
      expect(titles.titles[0].wordCount).toBeLessThanOrEqual(20);
    });

    it('manages author metadata', async () => {
      const authors = await authorManagerService.manageAuthors({
        manuscriptId: mockManuscriptId,
        authors: [
          {
            firstName: 'John',
            lastName: 'Smith',
            email: 'john@example.com',
            orcid: '0000-0002-1825-0097',
            affiliations: [
              {
                id: 'aff-1',
                institution: 'Test University',
                city: 'Boston',
                state: 'MA',
                country: 'USA',
              },
            ],
            correspondingAuthor: true,
          },
        ],
      });

      expect(authors.authors.length).toBe(1);
      expect(authors.correspondingAuthor).toBeDefined();
      expect(authors.formatted.byline).toContain('John Smith');
      expect(authors.formatted.correspondenceBlock).toContain('john@example.com');
    });

    it('manages manuscript branches', async () => {
      const branch = await branchManagerService.createBranch({
        manuscriptId: mockManuscriptId,
        branchName: 'revision-1',
        parentBranch: 'main',
      });

      expect(branch.branchName).toBe('revision-1');
      expect(branch.status).toBe('active');
      expect(branch.versionHash).toBeDefined();

      const branches = await branchManagerService.listBranches(mockManuscriptId);
      expect(branches.some(b => b.branchName === 'revision-1')).toBe(true);
    });
  });

  describe('Full IMRaD Assembly', () => {
    it('assembles complete manuscript structure', async () => {
      // Generate abstract
      const abstract = await abstractGeneratorService.generateAbstract({
        manuscriptId: mockManuscriptId,
        style: 'structured',
        maxWords: 300,
      });

      // Build introduction
      const introduction = await introductionBuilderService.buildIntroduction({
        manuscriptId: mockManuscriptId,
        topic: 'Cancer Treatment',
        maxWords: 800,
      });

      // Populate methods
      const methods = await methodsPopulatorService.populateMethods({
        manuscriptId: mockManuscriptId,
        datasetIds: ['dataset-1'],
        studyDesign: 'cohort study',
      });

      // Create results scaffold
      const results = await resultsScaffoldService.createScaffold({
        manuscriptId: mockManuscriptId,
        datasetIds: ['dataset-1'],
        primaryOutcome: 'survival',
      });

      // Build discussion
      const discussion = await discussionBuilderService.buildDiscussion({
        manuscriptId: mockManuscriptId,
        mainFinding: 'Treatment improved outcomes',
      });

      // Build references
      const references = await referencesBuilderService.buildReferences({
        manuscriptId: mockManuscriptId,
        citationIds: ['cit-1', 'cit-2'],
        format: 'ama',
      });

      // Verify all components generated
      expect(abstract).toBeDefined();
      expect(introduction).toBeDefined();
      expect(methods).toBeDefined();
      expect(results).toBeDefined();
      expect(discussion).toBeDefined();
      expect(references).toBeDefined();

      // Track overall word count
      const wordCountReport = wordCountTrackerService.trackWordCount({
        manuscriptId: mockManuscriptId,
        sections: [
          { sectionId: 'abstract', sectionType: 'abstract', content: abstract.text },
          { sectionId: 'intro', sectionType: 'introduction', content: introduction.fullText },
          { sectionId: 'methods', sectionType: 'methods', content: methods.fullText },
          { sectionId: 'results', sectionType: 'results', content: results.fullText },
          { sectionId: 'discussion', sectionType: 'discussion', content: discussion.fullText },
        ],
        limits: IMRAD_TEMPLATE.wordLimits,
      });

      expect(wordCountReport.totalWords).toBeGreaterThan(0);
    });

    it('applies journal-specific template constraints', () => {
      // NEJM has stricter limits
      expect(NEJM_TEMPLATE.wordLimits.total?.max).toBeLessThan(IMRAD_TEMPLATE.wordLimits.total?.max || Infinity);

      // All journal templates have required sections
      expect(NEJM_TEMPLATE.requiredSections.length).toBeGreaterThan(0);
      expect(JAMA_TEMPLATE.requiredSections.length).toBeGreaterThan(0);
      expect(LANCET_TEMPLATE.requiredSections.length).toBeGreaterThan(0);
      expect(BMJ_TEMPLATE.requiredSections.length).toBeGreaterThan(0);
    });
  });
});
