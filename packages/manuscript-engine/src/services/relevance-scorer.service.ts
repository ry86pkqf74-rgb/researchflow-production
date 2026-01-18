/**
 * Relevance Scorer Service
 * Task T39: Score citation relevance to manuscript content
 */

import type { Citation } from '../types/citation.types';

export interface RelevanceScore {
  citationId: string;
  manuscriptId: string;
  overallScore: number; // 0-1
  componentScores: {
    topicRelevance: number; // How well topic matches manuscript
    methodologicalRelevance: number; // Appropriate study design
    recency: number; // How recent the publication is
    impactFactor: number; // Journal quality/citation count
    keywordOverlap: number; // Keyword matching score
  };
  reasoning: string[];
  recommendation: 'highly_relevant' | 'relevant' | 'marginally_relevant' | 'not_relevant';
  suggestedSections: string[]; // Which manuscript sections should cite this
}

export interface RelevanceScoringContext {
  manuscriptId: string;
  manuscriptTitle: string;
  manuscriptAbstract: string;
  manuscriptKeywords: string[];
  researchQuestion?: string;
  studyDesign?: string;
  targetJournal?: string;
}

/**
 * Relevance Scorer Service
 * Uses multi-factor scoring to assess citation relevance
 */
export class RelevanceScorerService {
  /**
   * Score a citation's relevance to the manuscript
   */
  score(citation: Citation, context: RelevanceScoringContext): RelevanceScore {
    // Calculate component scores
    const topicRelevance = this.scoreTopicRelevance(citation, context);
    const methodologicalRelevance = this.scoreMethodologicalRelevance(citation, context);
    const recency = this.scoreRecency(citation);
    const impactFactor = this.scoreImpact(citation);
    const keywordOverlap = this.scoreKeywordOverlap(citation, context);

    // Weighted average for overall score
    const weights = {
      topicRelevance: 0.35,
      methodologicalRelevance: 0.20,
      recency: 0.15,
      impactFactor: 0.15,
      keywordOverlap: 0.15,
    };

    const overallScore =
      topicRelevance * weights.topicRelevance +
      methodologicalRelevance * weights.methodologicalRelevance +
      recency * weights.recency +
      impactFactor * weights.impactFactor +
      keywordOverlap * weights.keywordOverlap;

    // Generate reasoning
    const reasoning = this.generateReasoning({
      topicRelevance,
      methodologicalRelevance,
      recency,
      impactFactor,
      keywordOverlap,
    });

    // Determine recommendation
    const recommendation = this.determineRecommendation(overallScore);

    // Suggest sections where this citation would fit
    const suggestedSections = this.suggestSections(citation, context, overallScore);

    return {
      citationId: citation.id,
      manuscriptId: context.manuscriptId,
      overallScore,
      componentScores: {
        topicRelevance,
        methodologicalRelevance,
        recency,
        impactFactor,
        keywordOverlap,
      },
      reasoning,
      recommendation,
      suggestedSections,
    };
  }

  /**
   * Score multiple citations and rank by relevance
   */
  scoreMultiple(
    citations: Citation[],
    context: RelevanceScoringContext
  ): RelevanceScore[] {
    return citations
      .map(c => this.score(c, context))
      .sort((a, b) => b.overallScore - a.overallScore);
  }

  /**
   * Filter citations by minimum relevance threshold
   */
  filterByRelevance(
    citations: Citation[],
    context: RelevanceScoringContext,
    minScore: number = 0.5
  ): Citation[] {
    const scored = this.scoreMultiple(citations, context);
    const relevantIds = new Set(
      scored.filter(s => s.overallScore >= minScore).map(s => s.citationId)
    );

    return citations.filter(c => relevantIds.has(c.id));
  }

  // ========== Component Scoring Methods ==========

  /**
   * Score topic relevance using text similarity
   */
  private scoreTopicRelevance(citation: Citation, context: RelevanceScoringContext): number {
    const citationText = `${citation.title} ${citation.abstract || ''}`.toLowerCase();
    const manuscriptText = `${context.manuscriptTitle} ${context.manuscriptAbstract}`.toLowerCase();

    // Extract meaningful words (>3 chars, not common stopwords)
    const citationWords = this.extractContentWords(citationText);
    const manuscriptWords = this.extractContentWords(manuscriptText);

    // Calculate Jaccard similarity
    const intersection = new Set([...citationWords].filter(w => manuscriptWords.has(w)));
    const union = new Set([...citationWords, ...manuscriptWords]);

    const jaccardSimilarity = union.size > 0 ? intersection.size / union.size : 0;

    // Boost if title words match
    const titleBoost = this.calculateTitleOverlap(citation.title, context.manuscriptTitle);

    return Math.min(1.0, jaccardSimilarity * 2 + titleBoost * 0.3);
  }

  /**
   * Score methodological relevance
   */
  private scoreMethodologicalRelevance(citation: Citation, context: RelevanceScoringContext): number {
    if (!context.studyDesign) return 0.5; // Neutral if no design specified

    const citationAbstract = citation.abstract?.toLowerCase() || '';
    const targetDesign = context.studyDesign.toLowerCase();

    // Check if citation uses similar methodology
    if (citationAbstract.includes(targetDesign)) {
      return 1.0; // Perfect match
    }

    // Check for related study designs
    const designHierarchy: Record<string, string[]> = {
      'randomized controlled trial': ['rct', 'randomized', 'controlled trial'],
      'meta-analysis': ['systematic review', 'meta-analysis'],
      'cohort': ['cohort study', 'prospective', 'longitudinal'],
      'case-control': ['case-control', 'retrospective'],
    };

    for (const [design, variants] of Object.entries(designHierarchy)) {
      if (targetDesign.includes(design)) {
        const hasVariant = variants.some(v => citationAbstract.includes(v));
        if (hasVariant) return 0.8; // Good match
      }
    }

    return 0.5; // Neutral
  }

  /**
   * Score recency (newer is better, with decay)
   */
  private scoreRecency(citation: Citation): number {
    const currentYear = new Date().getFullYear();
    const yearsOld = currentYear - citation.year;

    if (yearsOld <= 2) return 1.0; // Very recent
    if (yearsOld <= 5) return 0.9;
    if (yearsOld <= 10) return 0.7;
    if (yearsOld <= 15) return 0.5;
    if (yearsOld <= 20) return 0.3;
    return 0.1; // >20 years old
  }

  /**
   * Score impact (based on journal and citation count)
   */
  private scoreImpact(citation: Citation): number {
    // In production, would look up actual journal impact factors and citation counts
    // For now, use heuristic based on journal name

    const highImpactJournals = new Set([
      'nature',
      'science',
      'cell',
      'lancet',
      'new england journal of medicine',
      'nejm',
      'jama',
      'bmj',
    ]);

    const journal = citation.journal?.toLowerCase() || '';

    for (const highImpact of highImpactJournals) {
      if (journal.includes(highImpact)) {
        return 1.0;
      }
    }

    // Medium impact if peer-reviewed journal
    if (citation.journal) {
      return 0.6;
    }

    // Lower score for non-journal sources
    if (citation.sourceType === 'arxiv') return 0.4;
    if (citation.sourceType === 'url') return 0.2;

    return 0.5; // Default
  }

  /**
   * Score keyword overlap
   */
  private scoreKeywordOverlap(citation: Citation, context: RelevanceScoringContext): number {
    const citationKeywords = new Set(
      (citation.keywords || []).map(k => k.toLowerCase())
    );
    const manuscriptKeywords = new Set(
      context.manuscriptKeywords.map(k => k.toLowerCase())
    );

    if (citationKeywords.size === 0 || manuscriptKeywords.size === 0) {
      return 0.5; // Neutral if keywords missing
    }

    const intersection = new Set(
      [...citationKeywords].filter(k => manuscriptKeywords.has(k))
    );

    return intersection.size / Math.max(manuscriptKeywords.size, 1);
  }

  // ========== Helper Methods ==========

  private extractContentWords(text: string): Set<string> {
    const stopWords = new Set([
      'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
      'of', 'with', 'by', 'from', 'as', 'is', 'was', 'are', 'were',
    ]);

    const words = text
      .split(/\s+/)
      .map(w => w.replace(/[^\w]/g, '').toLowerCase())
      .filter(w => w.length > 3 && !stopWords.has(w));

    return new Set(words);
  }

  private calculateTitleOverlap(citationTitle: string, manuscriptTitle: string): number {
    const citationWords = this.extractContentWords(citationTitle.toLowerCase());
    const manuscriptWords = this.extractContentWords(manuscriptTitle.toLowerCase());

    const intersection = new Set(
      [...citationWords].filter(w => manuscriptWords.has(w))
    );

    return intersection.size / Math.max(manuscriptWords.size, 1);
  }

  private generateReasoning(scores: RelevanceScore['componentScores']): string[] {
    const reasoning: string[] = [];

    if (scores.topicRelevance > 0.7) {
      reasoning.push('Strong topical alignment with manuscript');
    } else if (scores.topicRelevance < 0.3) {
      reasoning.push('Limited topical overlap with manuscript');
    }

    if (scores.methodologicalRelevance > 0.7) {
      reasoning.push('Methodologically aligned with study design');
    }

    if (scores.recency > 0.8) {
      reasoning.push('Recent publication (within 2 years)');
    } else if (scores.recency < 0.3) {
      reasoning.push('Older publication (may need supplementing with recent work)');
    }

    if (scores.impactFactor > 0.8) {
      reasoning.push('Published in high-impact journal');
    }

    if (scores.keywordOverlap > 0.5) {
      reasoning.push('High keyword overlap');
    }

    return reasoning;
  }

  private determineRecommendation(score: number): RelevanceScore['recommendation'] {
    if (score >= 0.75) return 'highly_relevant';
    if (score >= 0.50) return 'relevant';
    if (score >= 0.30) return 'marginally_relevant';
    return 'not_relevant';
  }

  private suggestSections(
    citation: Citation,
    context: RelevanceScoringContext,
    score: number
  ): string[] {
    const sections: string[] = [];

    const abstract = citation.abstract?.toLowerCase() || '';
    const title = citation.title.toLowerCase();

    // Introduction section - if foundational or background
    if (
      abstract.includes('background') ||
      abstract.includes('introduction') ||
      title.includes('review')
    ) {
      sections.push('introduction');
    }

    // Methods section - if methodological
    if (
      abstract.includes('method') ||
      abstract.includes('protocol') ||
      abstract.includes('design')
    ) {
      sections.push('methods');
    }

    // Results section - if reporting findings
    if (abstract.includes('result') || abstract.includes('finding')) {
      sections.push('results');
    }

    // Discussion section - if comparative or interpretive
    if (
      abstract.includes('discussion') ||
      abstract.includes('implication') ||
      score > 0.6 // Highly relevant citations go in discussion
    ) {
      sections.push('discussion');
    }

    return sections.length > 0 ? sections : ['introduction']; // Default to introduction
  }
}

export const relevanceScorerService = new RelevanceScorerService();
