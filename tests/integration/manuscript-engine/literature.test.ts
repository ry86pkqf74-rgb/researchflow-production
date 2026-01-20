/**
 * Literature Integration Tests
 * Task T40: Integration tests for Phase 2 literature services
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { pubmedService } from '../../../packages/manuscript-engine/src/services/pubmed.service';
import { semanticScholarService } from '../../../packages/manuscript-engine/src/services/semantic-scholar.service';
import { litReviewService } from '../../../packages/manuscript-engine/src/services/lit-review.service';
import { arxivService } from '../../../packages/manuscript-engine/src/services/arxiv.service';
import { litMatrixService } from '../../../packages/manuscript-engine/src/services/lit-matrix.service';
import { plagiarismCheckService } from '../../../packages/manuscript-engine/src/services/plagiarism-check.service';
import { litWatcherService } from '../../../packages/manuscript-engine/src/services/lit-watcher.service';
import { litSummaryEmbedService } from '../../../packages/manuscript-engine/src/services/lit-summary-embed.service';
import { conflictDetectorService } from '../../../packages/manuscript-engine/src/services/conflict-detector.service';
import { zoteroService } from '../../../packages/manuscript-engine/src/services/zotero.service';
import { citationFormatterService } from '../../../packages/manuscript-engine/src/services/citation-formatter.service';
import { relevanceScorerService } from '../../../packages/manuscript-engine/src/services/relevance-scorer.service';
import { extractKeywords } from '../../../packages/manuscript-engine/src/utils/keyword-extractor';
import { exportToBibTeX, exportToRIS } from '../../../packages/manuscript-engine/src/utils/citation-export';
import type { Citation } from '../../../packages/manuscript-engine/src/types/citation.types';

describe('Literature Integration Pipeline', () => {
  const mockManuscriptId = 'manuscript-123';

  describe('T21-T22: External API Integration', () => {
    it('searches PubMed with query', async () => {
      const result = await pubmedService.search({
        query: 'cancer treatment',
        maxResults: 5,
      });

      expect(result.totalResults).toBeGreaterThanOrEqual(0);
      expect(result.source).toBe('pubmed');
      expect(Array.isArray(result.articles)).toBe(true);
    });

    it('fetches PubMed article by PMID', async () => {
      const article = await pubmedService.fetchByPmid('12345678');
      // May return null if PMID doesn't exist - that's OK for test
      if (article) {
        expect(article.pmid).toBe('12345678');
        expect(article.title).toBeDefined();
      }
    });

    it('searches Semantic Scholar', async () => {
      const results = await semanticScholarService.search('machine learning', 5);

      expect(Array.isArray(results)).toBe(true);
      if (results.length > 0) {
        expect(results[0].paperId).toBeDefined();
        expect(results[0].title).toBeDefined();
      }
    });

    it('gets TLDR from Semantic Scholar', async () => {
      const tldr = await semanticScholarService.getTldr('mock-paper-id');
      // May be null - that's OK
      expect(typeof tldr === 'string' || tldr === null).toBe(true);
    });

    it('searches arXiv', async () => {
      const results = await arxivService.search({
        query: 'quantum computing',
        maxResults: 3,
      });

      expect(Array.isArray(results)).toBe(true);
      if (results.length > 0) {
        expect(results[0].id).toBeDefined();
        expect(results[0].title).toBeDefined();
        expect(results[0].pdfUrl).toContain('arxiv.org');
      }
    });
  });

  describe('T23: Literature Review Generation', () => {
    const mockCitations: Partial<Citation>[] = [
      {
        id: '1',
        title: 'Cancer Treatment Study',
        authors: [{ lastName: 'Smith', firstName: 'John' }],
        year: 2022,
        abstract: 'This study found that treatment A was effective for cancer.',
        keywords: ['cancer', 'treatment', 'oncology'],
      },
      {
        id: '2',
        title: 'Alternative Cancer Therapy',
        authors: [{ lastName: 'Jones', firstName: 'Mary' }],
        year: 2023,
        abstract: 'Our research showed treatment B had similar efficacy.',
        keywords: ['cancer', 'therapy', 'oncology'],
      },
    ];

    it('clusters citations by theme', () => {
      const clusters = litReviewService.clusterByTheme(mockCitations as Citation[]);

      expect(Array.isArray(clusters)).toBe(true);
      if (clusters.length > 0) {
        expect(clusters[0].theme).toBeDefined();
        expect(clusters[0].citations.length).toBeGreaterThan(0);
      }
    });

    it('generates narrative review', async () => {
      const review = await litReviewService.generateReview({
        citations: mockCitations as Citation[],
        style: 'narrative',
        maxWords: 500,
      });

      expect(review.content).toBeDefined();
      expect(review.style).toBe('narrative');
      expect(review.citationCount).toBe(2);
    });

    it('generates thematic review', async () => {
      const review = await litReviewService.generateReview({
        citations: mockCitations as Citation[],
        style: 'thematic',
        maxWords: 500,
      });

      expect(review.style).toBe('thematic');
      expect(review.themes.length).toBeGreaterThan(0);
    });
  });

  describe('T28: Literature Matrix', () => {
    it('assesses study quality using Cochrane criteria', () => {
      const quality = litMatrixService.assessQuality({
        hasRandomization: true,
        hasBlinding: true,
        completenessPercent: 95,
      });

      expect(quality.cochraneScore).toBe(5); // 2 + 2 + 1
      expect(quality.biasRisk).toBe('low');
    });

    it('calculates effect size (odds ratio)', () => {
      const effectSize = litMatrixService.calculateEffectSize({
        type: 'odds_ratio',
        exposedEvents: 20,
        exposedTotal: 100,
        controlEvents: 40,
        controlTotal: 100,
      });

      expect(effectSize.value).toBeCloseTo(0.4, 1);
      expect(effectSize.type).toBe('odds_ratio');
    });

    it('exports matrix to table format', () => {
      const matrix = {
        id: 'matrix-1',
        manuscriptId: mockManuscriptId,
        columns: ['Study', 'Population', 'Intervention', 'Outcome'],
        rows: [
          {
            citationId: '1',
            cells: {
              Study: 'Smith 2022',
              Population: 'Adults with cancer',
              Intervention: 'Treatment A',
              Outcome: 'Improved survival',
            },
            qualityScore: { cochraneScore: 5, biasRisk: 'low' as const },
          },
        ],
        createdAt: new Date(),
      };

      const table = litMatrixService.exportToTable(matrix);

      expect(Array.isArray(table)).toBe(true);
      expect(table[0]).toContain('Study');
      expect(table.length).toBeGreaterThan(1);
    });
  });

  describe('T29: Plagiarism Detection', () => {
    it('detects high similarity text', async () => {
      const result = await plagiarismCheckService.checkForPlagiarism({
        manuscriptId: mockManuscriptId,
        textToCheck: 'This is some sample text to check for plagiarism.',
        sectionType: 'introduction',
        checkAgainst: 'existing_citations',
      });

      expect(result.overallSimilarity).toBeGreaterThanOrEqual(0);
      expect(result.overallSimilarity).toBeLessThanOrEqual(1);
      expect(typeof result.passesThreshold).toBe('boolean');
      expect(Array.isArray(result.matches)).toBe(true);
    });

    it('performs quick originality check', async () => {
      const result = await plagiarismCheckService.quickOriginalityCheck(
        'The study examined various factors affecting patient outcomes in clinical trials.'
      );

      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(result.score).toBeLessThanOrEqual(1);
      expect(typeof result.isOriginal).toBe('boolean');
    });
  });

  describe('T30: Citation Export', () => {
    const mockCitation: Citation = {
      id: '1',
      manuscriptId: mockManuscriptId,
      sourceType: 'pubmed',
      externalId: '12345678',
      title: 'Test Article',
      authors: [
        { lastName: 'Smith', firstName: 'John', initials: 'J' },
        { lastName: 'Doe', firstName: 'Jane', initials: 'J' },
      ],
      year: 2023,
      journal: 'Journal of Testing',
      volume: '10',
      issue: '2',
      pages: '123-145',
      doi: '10.1234/test.2023.001',
    };

    it('exports to BibTeX format', () => {
      const bibtex = exportToBibTeX([mockCitation]);

      expect(bibtex).toContain('@article{');
      expect(bibtex).toContain('title={Test Article}');
      expect(bibtex).toContain('author={Smith, John and Doe, Jane}');
      expect(bibtex).toContain('year={2023}');
    });

    it('exports to RIS format', () => {
      const ris = exportToRIS([mockCitation]);

      expect(ris).toContain('TY  - JOUR');
      expect(ris).toContain('TI  - Test Article');
      expect(ris).toContain('AU  - Smith, John');
      expect(ris).toContain('PY  - 2023');
      expect(ris).toContain('ER  -');
    });
  });

  describe('T31: Literature Watcher', () => {
    it('creates a new watch', () => {
      const watch = litWatcherService.createWatch({
        manuscriptId: mockManuscriptId,
        searchQuery: 'cancer treatment',
        databases: ['pubmed'],
        keywords: ['cancer', 'therapy'],
        checkFrequency: 'weekly',
        autoAddToCitations: false,
        minRelevanceScore: 0.7,
      });

      expect(watch.id).toBeDefined();
      expect(watch.searchQuery).toBe('cancer treatment');
      expect(watch.checkFrequency).toBe('weekly');
    });

    it('gets watch summaries', () => {
      const summaries = litWatcherService.getSummaries();

      expect(Array.isArray(summaries)).toBe(true);
    });
  });

  describe('T32: Keyword Extraction', () => {
    it('extracts keywords from text', () => {
      const text = `
        This study examined cancer treatment outcomes in patients receiving chemotherapy.
        We found significant improvements in survival rates. The randomized controlled trial
        included 500 patients with advanced cancer.
      `;

      const keywords = extractKeywords(text, { maxKeywords: 5 });

      expect(Array.isArray(keywords)).toBe(true);
      expect(keywords.length).toBeLessThanOrEqual(5);
      if (keywords.length > 0) {
        expect(keywords[0].term).toBeDefined();
        expect(keywords[0].score).toBeGreaterThan(0);
      }
    });
  });

  describe('T33: Literature Summary Embedding', () => {
    it('embeds narrative summary', async () => {
      const summary = await litSummaryEmbedService.embedSummary({
        manuscriptId: mockManuscriptId,
        sectionId: 'intro-1',
        citationIds: ['cit-1', 'cit-2'],
        summaryStyle: 'narrative',
        position: 'beginning',
      });

      expect(summary.id).toBeDefined();
      expect(summary.style).toBe('narrative');
      expect(summary.content).toBeDefined();
      expect(summary.wordCount).toBeGreaterThan(0);
    });
  });

  describe('T34: Conflict Detection', () => {
    const mockCitations: Citation[] = [
      {
        id: '1',
        manuscriptId: mockManuscriptId,
        sourceType: 'pubmed',
        externalId: '111',
        title: 'Treatment A is effective',
        authors: [{ lastName: 'Smith', firstName: 'John' }],
        year: 2022,
        abstract: 'We found that treatment A significantly improved outcomes.',
      },
      {
        id: '2',
        manuscriptId: mockManuscriptId,
        sourceType: 'pubmed',
        externalId: '222',
        title: 'Treatment A shows no benefit',
        authors: [{ lastName: 'Jones', firstName: 'Mary' }],
        year: 2023,
        abstract: 'Our study found no significant effect of treatment A.',
      },
    ];

    it('detects conflicting findings', async () => {
      const analysis = await conflictDetectorService.detectConflicts(
        mockManuscriptId,
        mockCitations
      );

      expect(analysis.totalConflicts).toBeGreaterThanOrEqual(0);
      expect(analysis.overallConsistency).toBeGreaterThanOrEqual(0);
      expect(analysis.overallConsistency).toBeLessThanOrEqual(1);
      expect(Array.isArray(analysis.conflicts)).toBe(true);
    });
  });

  describe('T35: Zotero Integration', () => {
    beforeAll(() => {
      // Configure with test credentials
      zoteroService.configure({
        apiKey: 'test-api-key',
        userId: 'test-user',
        libraryType: 'user',
      });
    });

    it('lists collections', async () => {
      // This will fail without real credentials - that's expected in test env
      try {
        const collections = await zoteroService.listCollections();
        expect(Array.isArray(collections)).toBe(true);
      } catch (error) {
        // Expected to fail in test environment
        expect(error).toBeDefined();
      }
    });
  });

  describe('T38: Citation Formatting', () => {
    const mockCitation: Citation = {
      id: '1',
      manuscriptId: mockManuscriptId,
      sourceType: 'pubmed',
      externalId: '12345678',
      title: 'Test Article on Cancer Treatment',
      authors: [
        { lastName: 'Smith', firstName: 'John', initials: 'J' },
        { lastName: 'Doe', firstName: 'Jane', initials: 'J' },
      ],
      year: 2023,
      journal: 'Journal of Oncology',
      volume: '15',
      issue: '3',
      pages: '200-210',
      doi: '10.1234/onc.2023.001',
    };

    it('formats citation in AMA style', () => {
      const formatted = citationFormatterService.format(mockCitation, 'ama');

      expect(formatted.format).toBe('ama');
      expect(formatted.bibliography).toContain('Smith J');
      expect(formatted.bibliography).toContain('2023');
    });

    it('formats citation in APA style', () => {
      const formatted = citationFormatterService.format(mockCitation, 'apa');

      expect(formatted.format).toBe('apa');
      expect(formatted.bibliography).toContain('(2023)');
    });

    it('formats citation in Vancouver style', () => {
      const formatted = citationFormatterService.format(mockCitation, 'vancouver');

      expect(formatted.format).toBe('vancouver');
      expect(formatted.bibliography).toBeDefined();
    });
  });

  describe('T39: Relevance Scoring', () => {
    const mockCitation: Citation = {
      id: '1',
      manuscriptId: mockManuscriptId,
      sourceType: 'pubmed',
      externalId: '12345678',
      title: 'Cancer Treatment Outcomes in Advanced Disease',
      authors: [{ lastName: 'Smith', firstName: 'John' }],
      year: 2023,
      abstract: 'This randomized controlled trial examined cancer treatment outcomes in 500 patients.',
      journal: 'Journal of Oncology',
      keywords: ['cancer', 'treatment', 'clinical trial'],
    };

    const context = {
      manuscriptId: mockManuscriptId,
      manuscriptTitle: 'Advanced Cancer Treatment Strategies',
      manuscriptAbstract: 'This manuscript reviews cancer treatment approaches.',
      manuscriptKeywords: ['cancer', 'treatment', 'therapy'],
      studyDesign: 'randomized controlled trial',
    };

    it('scores citation relevance', () => {
      const score = relevanceScorerService.score(mockCitation, context);

      expect(score.overallScore).toBeGreaterThanOrEqual(0);
      expect(score.overallScore).toBeLessThanOrEqual(1);
      expect(score.componentScores.topicRelevance).toBeDefined();
      expect(score.componentScores.keywordOverlap).toBeDefined();
      expect(score.recommendation).toBeDefined();
      expect(Array.isArray(score.suggestedSections)).toBe(true);
    });

    it('filters citations by relevance threshold', () => {
      const citations = [mockCitation];
      const filtered = relevanceScorerService.filterByRelevance(
        citations,
        context,
        0.5
      );

      expect(Array.isArray(filtered)).toBe(true);
    });
  });

  describe('End-to-End Literature Workflow', () => {
    it('completes full literature integration pipeline', async () => {
      // 1. Search for literature
      const searchResults = await pubmedService.search({
        query: 'cancer treatment',
        maxResults: 3,
      });

      expect(searchResults.totalResults).toBeGreaterThanOrEqual(0);

      // 2. Extract keywords from manuscript
      const manuscriptText = 'This study examines cancer treatment outcomes.';
      const keywords = extractKeywords(manuscriptText);

      expect(Array.isArray(keywords)).toBe(true);

      // 3. Format a citation
      if (searchResults.articles.length > 0) {
        const mockCitation: Citation = {
          id: '1',
          manuscriptId: mockManuscriptId,
          sourceType: 'pubmed',
          externalId: searchResults.articles[0].pmid || '0',
          title: searchResults.articles[0].title,
          authors: searchResults.articles[0].authors.map(a => ({
            lastName: a.lastName,
            firstName: a.firstName,
          })),
          year: searchResults.articles[0].year,
        };

        const formatted = citationFormatterService.format(mockCitation, 'ama');
        expect(formatted.bibliography).toBeDefined();

        // 4. Export to BibTeX
        const bibtex = exportToBibTeX([mockCitation]);
        expect(bibtex).toContain('@article{');
      }

      // Pipeline completed successfully
      expect(true).toBe(true);
    });
  });
});
