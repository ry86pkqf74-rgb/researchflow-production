/**
 * Peer Review Service Unit Tests
 * Task T81: Test peer review simulation functionality
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { PeerReviewService, REVIEW_CRITERIA } from '../peer-review.service';
import type { PeerReviewResult } from '../peer-review.service';

describe('PeerReviewService', () => {
  let service: PeerReviewService;

  beforeEach(() => {
    service = new PeerReviewService();
  });

  // Sample manuscript for testing
  const sampleManuscript = {
    title: 'Exercise Reduces Blood Pressure: A Randomized Trial',
    abstract: 'Background: Hypertension is common. Methods: RCT with 200 adults. Results: BP decreased 12 mmHg (p<0.001). Conclusions: Exercise reduces BP.',
    introduction: 'Hypertension affects 1 billion people worldwide. Exercise is first-line treatment.',
    methods: `
      Study Design: Parallel-group RCT at University Medical Center, 2022-2023.
      IRB approval: Protocol #2021-0456.

      Participants: Adults 40-70 years with stage 1 hypertension (SBP 130-139 mmHg).
      Randomization: 1:1 using computer-generated numbers.

      Intervention: Supervised aerobic exercise 3x/week for 12 weeks.

      Outcomes: Primary - change in systolic BP at 12 weeks.

      Statistics: Sample size 80/group for 10 mmHg difference, 80% power, alpha=0.05.
      Analysis by intention-to-treat. ANCOVA adjusting for baseline.
    `,
    results: `
      Participants: Of 312 screened, 200 randomized (100 per group).

      Primary Outcome: SBP decreased from 136.4 to 124.1 mmHg in exercise group,
      135.8 to 133.7 mmHg in control. Between-group difference -10.2 mmHg
      (95% CI: -13.8 to -6.6, p<0.001).

      Secondary Outcomes: DBP decreased 5.3 mmHg more in exercise group
      (95% CI: -7.8 to -2.8, p<0.001).
    `,
    discussion: `
      Supervised exercise significantly reduced blood pressure.
      The 10 mmHg SBP reduction is clinically meaningful.

      Limitations: single-center design, 12-week duration. Longer follow-up needed.

      Conclusion: Supervised exercise is effective for blood pressure control.
    `,
    references: 'Smith et al. (2020). Exercise and hypertension. NEJM.',
    acknowledgments: 'Funded by NIH grant R01HL123456.'
  };

  describe('simulateReview', () => {
    it('should simulate comprehensive peer review', async () => {
      const result = await service.simulateReview(sampleManuscript, {
        studyType: 'RCT',
        sampleSize: 200,
        hasEthicsApproval: true,
        hasCOI: false
      });

      expect(result).toBeDefined();
      expect(result.overallScore).toBeGreaterThan(0);
      expect(result.overallScore).toBeLessThanOrEqual(10);
      expect(result.recommendation).toBeDefined();
      expect(['accept', 'minor_revision', 'major_revision', 'reject']).toContain(result.recommendation);
      expect(result.categoryScores).toBeDefined();
      expect(result.comments).toBeDefined();
      expect(Array.isArray(result.comments)).toBe(true);
      expect(result.strengthsSummary).toBeDefined();
      expect(result.weaknessesSummary).toBeDefined();
    });

    it('should evaluate methodology category', async () => {
      const result = await service.simulateReview(sampleManuscript, {
        studyType: 'RCT',
        sampleSize: 200,
        hasEthicsApproval: true
      });

      expect(result.categoryScores.methodology).toBeDefined();
      expect(result.categoryScores.methodology).toBeGreaterThan(0);
      expect(result.categoryScores.methodology).toBeLessThanOrEqual(10);
    });

    it('should identify missing sample size', async () => {
      const incompleteManuscript = {
        ...sampleManuscript,
        methods: 'We did a study with participants.'
      };

      const result = await service.simulateReview(incompleteManuscript, {
        studyType: 'RCT',
        sampleSize: 0
      });

      const methodologyComments = result.comments.filter(c => c.category === 'methodology');
      expect(methodologyComments.length).toBeGreaterThan(0);

      const sampleSizeComment = methodologyComments.find(c =>
        c.comment.toLowerCase().includes('sample size')
      );
      expect(sampleSizeComment).toBeDefined();
      expect(sampleSizeComment?.severity).toBe('major');
    });

    it('should identify missing statistical methods', async () => {
      const incompleteManuscript = {
        ...sampleManuscript,
        methods: 'We recruited 200 participants and gave them exercise.'
      };

      const result = await service.simulateReview(incompleteManuscript, {
        studyType: 'RCT',
        sampleSize: 200
      });

      const statsComment = result.comments.find(c =>
        c.comment.toLowerCase().includes('statistical')
      );
      expect(statsComment).toBeDefined();
      expect(statsComment?.severity).toBe('major');
    });

    it('should flag missing ethics approval', async () => {
      const result = await service.simulateReview(
        {
          ...sampleManuscript,
          methods: 'We recruited 200 participants. Analysis by ANCOVA.'
        },
        {
          studyType: 'RCT',
          sampleSize: 200,
          hasEthicsApproval: false
        }
      );

      const ethicsComment = result.comments.find(c =>
        c.comment.toLowerCase().includes('ethical') ||
        c.comment.toLowerCase().includes('irb')
      );
      expect(ethicsComment).toBeDefined();
      expect(ethicsComment?.severity).toBe('major');
    });

    it('should evaluate results section', async () => {
      const result = await service.simulateReview(sampleManuscript, {
        studyType: 'RCT',
        sampleSize: 200
      });

      expect(result.categoryScores.results).toBeDefined();

      // Good results section should have high score
      expect(result.categoryScores.results).toBeGreaterThan(6);
    });

    it('should flag results lacking statistics', async () => {
      const weakResults = {
        ...sampleManuscript,
        results: 'Blood pressure went down in the exercise group. It was better than control.'
      };

      const result = await service.simulateReview(weakResults, {
        studyType: 'RCT',
        sampleSize: 200
      });

      const resultsComment = result.comments.find(c =>
        c.category === 'results' && c.comment.toLowerCase().includes('statistical')
      );
      expect(resultsComment).toBeDefined();
    });

    it('should evaluate discussion section', async () => {
      const result = await service.simulateReview(sampleManuscript, {
        studyType: 'RCT',
        sampleSize: 200
      });

      expect(result.categoryScores.discussion).toBeDefined();
    });

    it('should flag missing limitations', async () => {
      const noLimitations = {
        ...sampleManuscript,
        discussion: 'Exercise reduces blood pressure. This is important for public health.'
      };

      const result = await service.simulateReview(noLimitations, {
        studyType: 'RCT',
        sampleSize: 200
      });

      const limitationsComment = result.comments.find(c =>
        c.comment.toLowerCase().includes('limitation')
      );
      expect(limitationsComment).toBeDefined();
      expect(limitationsComment?.severity).toBe('major');
    });

    it('should evaluate writing quality by word count', async () => {
      const result = await service.simulateReview(sampleManuscript, {
        studyType: 'RCT',
        sampleSize: 200
      });

      expect(result.categoryScores.writing).toBeDefined();
    });

    it('should flag very short manuscripts', async () => {
      const shortManuscript = {
        title: 'Short Study',
        abstract: 'We did a study.',
        introduction: 'Background.',
        methods: 'Methods here.',
        results: 'Results here.',
        discussion: 'Discussion.'
      };

      const result = await service.simulateReview(shortManuscript, {
        studyType: 'RCT',
        sampleSize: 50
      });

      const lengthComment = result.comments.find(c =>
        c.category === 'writing' && c.comment.toLowerCase().includes('short')
      );
      expect(lengthComment).toBeDefined();
    });

    it('should calculate weighted overall score correctly', async () => {
      const result = await service.simulateReview(sampleManuscript, {
        studyType: 'RCT',
        sampleSize: 200,
        hasEthicsApproval: true
      });

      // Overall score should be weighted average of category scores
      const expectedScore =
        (result.categoryScores.originality || 5) * 0.15 +
        (result.categoryScores.methodology || 5) * 0.25 +
        (result.categoryScores.results || 5) * 0.20 +
        (result.categoryScores.discussion || 5) * 0.15 +
        (result.categoryScores.writing || 5) * 0.10 +
        (result.categoryScores.ethics || 5) * 0.15;

      expect(result.overallScore).toBeCloseTo(expectedScore, 1);
    });

    it('should recommend accept for high scores with no major issues', async () => {
      const excellentManuscript = {
        ...sampleManuscript,
        methods: `
          Study Design: Multi-center RCT, 2022-2023.
          IRB approval: Protocol #2021-0456.

          Participants: 500 adults with hypertension.
          Randomization: Computer-generated, stratified by age and sex.

          Intervention: Supervised exercise 3x/week for 12 weeks.

          Outcomes: Primary - SBP at 12 weeks. Secondary - DBP, QoL.

          Statistics: Power analysis, ITT analysis, ANCOVA, sensitivity analysis.
        `
      };

      const result = await service.simulateReview(excellentManuscript, {
        studyType: 'RCT',
        sampleSize: 500,
        hasEthicsApproval: true
      });

      expect(result.overallScore).toBeGreaterThan(6);
      // Should be accept or minor_revision for good methodology and stats
      expect(['accept', 'minor_revision']).toContain(result.recommendation);
    });

    it('should recommend major revision for multiple issues', async () => {
      const poorManuscript = {
        title: 'Study',
        abstract: 'We did a study and found results.',
        introduction: 'Background information.',
        methods: 'We enrolled some patients.',
        results: 'The treatment worked.',
        discussion: 'Our results are important.'
      };

      const result = await service.simulateReview(poorManuscript, {
        studyType: 'RCT',
        sampleSize: 0
      });

      const majorComments = result.comments.filter(c => c.severity === 'major');
      expect(majorComments.length).toBeGreaterThan(0);
      expect(['major_revision', 'reject']).toContain(result.recommendation);
    });

    it('should limit strengths and weaknesses to 5 items', async () => {
      const result = await service.simulateReview(sampleManuscript, {
        studyType: 'RCT',
        sampleSize: 200,
        hasEthicsApproval: true
      });

      expect(result.strengthsSummary.length).toBeLessThanOrEqual(5);
      expect(result.weaknessesSummary.length).toBeLessThanOrEqual(5);
    });
  });

  describe('generateReviewerLetter', () => {
    it('should generate formatted reviewer letter', async () => {
      const review = await service.simulateReview(sampleManuscript, {
        studyType: 'RCT',
        sampleSize: 200,
        hasEthicsApproval: true
      });

      const letter = service.generateReviewerLetter(review);

      expect(letter).toBeDefined();
      expect(typeof letter).toBe('string');
      expect(letter.length).toBeGreaterThan(100);
      expect(letter).toContain('Dear Authors');
      expect(letter).toContain('Summary');
      expect(letter).toContain('Overall Score');
    });

    it('should include recommendation in letter', async () => {
      const review = await service.simulateReview(sampleManuscript, {
        studyType: 'RCT',
        sampleSize: 200,
        hasEthicsApproval: true
      });

      const letter = service.generateReviewerLetter(review);

      expect(letter).toContain('recommendation');
    });

    it('should include strengths if present', async () => {
      const review: PeerReviewResult = {
        overallScore: 8.5,
        recommendation: 'accept',
        comments: [],
        strengthsSummary: ['Clear methodology', 'Robust statistics'],
        weaknessesSummary: [],
        categoryScores: { methodology: 9, results: 8 }
      };

      const letter = service.generateReviewerLetter(review);

      expect(letter).toContain('Strengths');
      expect(letter).toContain('Clear methodology');
      expect(letter).toContain('Robust statistics');
    });

    it('should include weaknesses if present', async () => {
      const review: PeerReviewResult = {
        overallScore: 6.0,
        recommendation: 'minor_revision',
        comments: [],
        strengthsSummary: [],
        weaknessesSummary: ['Missing limitations', 'Sample size small'],
        categoryScores: { methodology: 6, results: 6 }
      };

      const letter = service.generateReviewerLetter(review);

      expect(letter).toContain('Areas for Improvement');
      expect(letter).toContain('Missing limitations');
      expect(letter).toContain('Sample size small');
    });

    it('should include major comments section', async () => {
      const review = await service.simulateReview(
        {
          ...sampleManuscript,
          methods: 'We did a study with some people.'
        },
        {
          studyType: 'RCT',
          sampleSize: 0
        }
      );

      const letter = service.generateReviewerLetter(review);

      const majorComments = review.comments.filter(c => c.severity === 'major');
      if (majorComments.length > 0) {
        expect(letter).toContain('Major Comments');
      }
    });

    it('should include minor comments section if present', async () => {
      const review = await service.simulateReview(sampleManuscript, {
        studyType: 'RCT',
        sampleSize: 200,
        hasEthicsApproval: true
      });

      const letter = service.generateReviewerLetter(review);

      const minorComments = review.comments.filter(c => c.severity === 'minor');
      if (minorComments.length > 0) {
        expect(letter).toContain('Minor Comments');
      }
    });

    it('should format recommendation properly', async () => {
      const testCases = [
        { recommendation: 'accept' as const, expected: 'Accept' },
        { recommendation: 'minor_revision' as const, expected: 'Minor Revision' },
        { recommendation: 'major_revision' as const, expected: 'Major Revision' },
        { recommendation: 'reject' as const, expected: 'Reject' }
      ];

      for (const testCase of testCases) {
        const review: PeerReviewResult = {
          overallScore: 7.0,
          recommendation: testCase.recommendation,
          comments: [],
          strengthsSummary: [],
          weaknessesSummary: [],
          categoryScores: {}
        };

        const letter = service.generateReviewerLetter(review);
        expect(letter).toContain(testCase.expected);
      }
    });

    it('should sign letter as AI Reviewer', async () => {
      const review = await service.simulateReview(sampleManuscript, {
        studyType: 'RCT',
        sampleSize: 200
      });

      const letter = service.generateReviewerLetter(review);
      expect(letter).toContain('AI Reviewer');
    });
  });

  describe('REVIEW_CRITERIA', () => {
    it('should have 6 evaluation categories', () => {
      expect(REVIEW_CRITERIA).toBeDefined();
      expect(REVIEW_CRITERIA.length).toBe(6);
    });

    it('should include all required categories', () => {
      const categories = REVIEW_CRITERIA.map(c => c.category);

      expect(categories).toContain('originality');
      expect(categories).toContain('methodology');
      expect(categories).toContain('results');
      expect(categories).toContain('discussion');
      expect(categories).toContain('writing');
      expect(categories).toContain('ethics');
    });

    it('should have weights that sum to 1.0', () => {
      const totalWeight = REVIEW_CRITERIA.reduce((sum, c) => sum + c.weight, 0);
      expect(totalWeight).toBeCloseTo(1.0, 2);
    });

    it('should have questions for each category', () => {
      REVIEW_CRITERIA.forEach(criteria => {
        expect(criteria.questions).toBeDefined();
        expect(Array.isArray(criteria.questions)).toBe(true);
        expect(criteria.questions.length).toBeGreaterThan(0);
      });
    });

    it('should weight methodology highest', () => {
      const methodology = REVIEW_CRITERIA.find(c => c.category === 'methodology');
      expect(methodology?.weight).toBe(0.25);

      // Should be the highest weight
      const maxWeight = Math.max(...REVIEW_CRITERIA.map(c => c.weight));
      expect(methodology?.weight).toBe(maxWeight);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty manuscript', async () => {
      const emptyManuscript = {
        title: '',
        abstract: '',
        introduction: '',
        methods: '',
        results: '',
        discussion: ''
      };

      const result = await service.simulateReview(emptyManuscript, {
        studyType: 'RCT',
        sampleSize: 0
      });

      expect(result).toBeDefined();
      expect(result.overallScore).toBeLessThan(7);
      // Empty manuscript should get major revision or reject
      expect(['major_revision', 'reject']).toContain(result.recommendation);
    });

    it('should handle very long manuscript', async () => {
      const longText = 'This is a very detailed manuscript. '.repeat(500);
      const longManuscript = {
        ...sampleManuscript,
        introduction: longText,
        methods: longText,
        results: longText
      };

      const result = await service.simulateReview(longManuscript, {
        studyType: 'RCT',
        sampleSize: 200
      });

      expect(result).toBeDefined();

      // Should have comments about the long manuscript
      const lengthComment = result.comments.find(c =>
        c.category === 'writing' && (
          c.comment.toLowerCase().includes('length') ||
          c.comment.toLowerCase().includes('long') ||
          c.comment.toLowerCase().includes('words')
        )
      );
      // May or may not generate length comment depending on word count threshold
      if (lengthComment) {
        expect(lengthComment.severity).toBe('minor');
      }
    });

    it('should assign unique IDs to comments', async () => {
      const result = await service.simulateReview(
        {
          ...sampleManuscript,
          methods: 'Brief methods section.'
        },
        {
          studyType: 'RCT',
          sampleSize: 0
        }
      );

      const ids = result.comments.map(c => c.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);
    });
  });
});
