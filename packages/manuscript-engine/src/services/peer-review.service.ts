/**
 * Peer Review Simulation Service
 * Task T81: Simulate peer review process
 */

import type { IMRaDSection } from '../types/imrad.types';

export interface ReviewCriteria {
  category: string;
  weight: number;
  questions: string[];
}

export interface ReviewComment {
  id: string;
  section: IMRaDSection;
  severity: 'major' | 'minor' | 'suggestion';
  category: string;
  comment: string;
  suggestion?: string;
  lineReference?: number;
}

export interface PeerReviewResult {
  overallScore: number; // 1-10
  recommendation: 'accept' | 'minor_revision' | 'major_revision' | 'reject';
  comments: ReviewComment[];
  strengthsSummary: string[];
  weaknessesSummary: string[];
  categoryScores: Record<string, number>;
}

export const REVIEW_CRITERIA: ReviewCriteria[] = [
  {
    category: 'originality',
    weight: 0.15,
    questions: [
      'Does the study address a novel research question?',
      'Does it add to existing knowledge?',
      'Is the approach innovative?'
    ]
  },
  {
    category: 'methodology',
    weight: 0.25,
    questions: [
      'Is the study design appropriate?',
      'Are methods described in sufficient detail?',
      'Is the sample size adequate?',
      'Are potential biases addressed?'
    ]
  },
  {
    category: 'results',
    weight: 0.20,
    questions: [
      'Are results clearly presented?',
      'Are statistics appropriate?',
      'Are figures/tables informative?',
      'Is data interpretation accurate?'
    ]
  },
  {
    category: 'discussion',
    weight: 0.15,
    questions: [
      'Are findings adequately discussed?',
      'Is context with literature appropriate?',
      'Are limitations addressed?',
      'Are conclusions supported by data?'
    ]
  },
  {
    category: 'writing',
    weight: 0.10,
    questions: [
      'Is the writing clear and concise?',
      'Is terminology appropriate?',
      'Is the structure logical?'
    ]
  },
  {
    category: 'ethics',
    weight: 0.15,
    questions: [
      'Is ethical approval documented?',
      'Is informed consent addressed?',
      'Are conflicts of interest disclosed?',
      'Is data handling appropriate?'
    ]
  }
];

export class PeerReviewService {
  /**
   * Simulate peer review of manuscript
   */
  async simulateReview(
    manuscript: Record<string, string>,
    metadata: {
      studyType: string;
      sampleSize?: number;
      hasEthicsApproval?: boolean;
      hasCOI?: boolean;
    }
  ): Promise<PeerReviewResult> {
    const comments: ReviewComment[] = [];
    const categoryScores: Record<string, number> = {};
    const strengths: string[] = [];
    const weaknesses: string[] = [];

    // Evaluate each category
    for (const criteria of REVIEW_CRITERIA) {
      const { score, sectionComments, categoryStrengths, categoryWeaknesses} =
        this.evaluateCategory(criteria, manuscript, metadata);

      categoryScores[criteria.category] = score;
      comments.push(...sectionComments);
      strengths.push(...categoryStrengths);
      weaknesses.push(...categoryWeaknesses);
    }

    // Calculate overall score
    const overallScore = this.calculateOverallScore(categoryScores);
    const recommendation = this.determineRecommendation(overallScore, comments);

    return {
      overallScore,
      recommendation,
      comments,
      strengthsSummary: strengths.slice(0, 5),
      weaknessesSummary: weaknesses.slice(0, 5),
      categoryScores
    };
  }

  /**
   * Generate reviewer-style feedback letter
   */
  generateReviewerLetter(result: PeerReviewResult): string {
    const sections: string[] = [];

    sections.push('Dear Authors,\\n');
    sections.push(`Thank you for submitting your manuscript for review. My recommendation is: **${this.formatRecommendation(result.recommendation)}**.\\n`);

    sections.push('## Summary');
    sections.push(`Overall Score: ${result.overallScore.toFixed(1)}/10\\n`);

    if (result.strengthsSummary.length > 0) {
      sections.push('## Strengths');
      result.strengthsSummary.forEach((s, i) => sections.push(`${i + 1}. ${s}`));
      sections.push('');
    }

    if (result.weaknessesSummary.length > 0) {
      sections.push('## Areas for Improvement');
      result.weaknessesSummary.forEach((w, i) => sections.push(`${i + 1}. ${w}`));
      sections.push('');
    }

    const majorComments = result.comments.filter(c => c.severity === 'major');
    if (majorComments.length > 0) {
      sections.push('## Major Comments (Must Address)');
      majorComments.forEach((c, i) => {
        sections.push(`**${i + 1}. [${String(c.section).toUpperCase()}]** ${c.comment}`);
        if (c.suggestion) sections.push(`   *Suggestion: ${c.suggestion}*`);
      });
      sections.push('');
    }

    const minorComments = result.comments.filter(c => c.severity === 'minor');
    if (minorComments.length > 0) {
      sections.push('## Minor Comments');
      minorComments.forEach((c, i) => {
        sections.push(`${i + 1}. [${c.section}] ${c.comment}`);
      });
      sections.push('');
    }

    sections.push('Sincerely,\\nAI Reviewer');

    return sections.join('\\n');
  }

  private evaluateCategory(
    criteria: ReviewCriteria,
    manuscript: Record<string, string>,
    metadata: Record<string, unknown>
  ): {
    score: number;
    sectionComments: ReviewComment[];
    categoryStrengths: string[];
    categoryWeaknesses: string[];
  } {
    const comments: ReviewComment[] = [];
    const strengths: string[] = [];
    const weaknesses: string[] = [];
    let score = 7;

    switch (criteria.category) {
      case 'methodology':
        const methodsText = manuscript.methods || '';

        if (!/\\d+\\s*(patients?|participants?|subjects?)/i.test(methodsText)) {
          comments.push({
            id: crypto.randomUUID(),
            section: 'methods' as IMRaDSection,
            severity: 'major',
            category: 'methodology',
            comment: 'Sample size is not clearly stated.',
            suggestion: 'Add explicit statement of total sample size.'
          });
          score -= 1;
          weaknesses.push('Sample size reporting needs improvement');
        } else {
          strengths.push('Sample size clearly documented');
        }

        if (!/statistical|analysis|regression/i.test(methodsText)) {
          comments.push({
            id: crypto.randomUUID(),
            section: 'methods' as IMRaDSection,
            severity: 'major',
            category: 'methodology',
            comment: 'Statistical methods are not described.',
            suggestion: 'Add a statistical analysis subsection.'
          });
          score -= 1.5;
        }

        if (!metadata.hasEthicsApproval && !/IRB|ethics/i.test(methodsText)) {
          comments.push({
            id: crypto.randomUUID(),
            section: 'methods' as IMRaDSection,
            severity: 'major',
            category: 'methodology',
            comment: 'No mention of ethical approval.',
            suggestion: 'Add IRB/ethics approval statement.'
          });
          score -= 1;
        }
        break;

      case 'results':
        const resultsText = manuscript.results || '';

        if (!/p\\s*[<>=]|95%\\s*CI|\\bOR\\b|\\bRR\\b/i.test(resultsText)) {
          comments.push({
            id: crypto.randomUUID(),
            section: 'results' as IMRaDSection,
            severity: 'minor',
            category: 'results',
            comment: 'Results lack statistical measures.',
            suggestion: 'Include effect sizes with 95% CIs.'
          });
          score -= 0.5;
        } else {
          strengths.push('Appropriate statistical reporting');
        }
        break;

      case 'discussion':
        const discussionText = manuscript.discussion || '';

        if (!/limitation|weakness/i.test(discussionText)) {
          comments.push({
            id: crypto.randomUUID(),
            section: 'discussion' as IMRaDSection,
            severity: 'major',
            category: 'discussion',
            comment: 'No limitations section identified.',
            suggestion: 'Add paragraph discussing study limitations.'
          });
          score -= 1;
          weaknesses.push('Missing limitations discussion');
        } else {
          strengths.push('Limitations acknowledged');
        }
        break;

      case 'writing':
        const totalWords = Object.values(manuscript).join(' ').split(/\\s+/).filter(w => w.length > 0).length;

        if (totalWords < 2000) {
          comments.push({
            id: crypto.randomUUID(),
            section: 'introduction' as IMRaDSection,
            severity: 'minor',
            category: 'writing',
            comment: `Manuscript appears short (${totalWords} words).`
          });
        } else if (totalWords > 6000) {
          comments.push({
            id: crypto.randomUUID(),
            section: 'introduction' as IMRaDSection,
            severity: 'minor',
            category: 'writing',
            comment: `Manuscript is lengthy (${totalWords} words).`
          });
        } else {
          strengths.push('Appropriate manuscript length');
        }
        break;
    }

    return {
      score: Math.max(1, Math.min(10, score)),
      sectionComments: comments,
      categoryStrengths: strengths,
      categoryWeaknesses: weaknesses
    };
  }

  private calculateOverallScore(categoryScores: Record<string, number>): number {
    let weightedSum = 0;
    let totalWeight = 0;

    for (const criteria of REVIEW_CRITERIA) {
      const score = categoryScores[criteria.category] || 5;
      weightedSum += score * criteria.weight;
      totalWeight += criteria.weight;
    }

    return weightedSum / totalWeight;
  }

  private determineRecommendation(
    score: number,
    comments: ReviewComment[]
  ): PeerReviewResult['recommendation'] {
    const majorCount = comments.filter(c => c.severity === 'major').length;

    if (score >= 8 && majorCount === 0) return 'accept';
    if (score >= 6 && majorCount <= 2) return 'minor_revision';
    if (score >= 4 || majorCount <= 5) return 'major_revision';
    return 'reject';
  }

  private formatRecommendation(rec: PeerReviewResult['recommendation']): string {
    const mapping = {
      accept: 'Accept',
      minor_revision: 'Minor Revision',
      major_revision: 'Major Revision',
      reject: 'Reject'
    };
    return mapping[rec];
  }
}

export const peerReviewService = new PeerReviewService();
