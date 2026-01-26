/**
 * Sentence Builder Service
 *
 * Constructs data-driven sentences for results sections.
 */

import { getModelRouter, type AIRouterRequest } from '@researchflow/ai-router';
import type { SentenceConstructionRequest } from '../types';
import { SentenceConstructionRequestSchema } from '../types';

export class SentenceBuilderService {
  private router = getModelRouter();

  /**
   * Build a sentence from structured data
   */
  async buildSentence(request: SentenceConstructionRequest): Promise<{
    sentence: string;
    dataPoints: string[];
    confidence: number;
  }> {
    // Validate request
    SentenceConstructionRequestSchema.parse(request);

    const prompt = this.buildPrompt(request);

    const aiRequest: AIRouterRequest = {
      taskType: 'draft_section',
      prompt,
      systemPrompt: `You are an expert medical writer specializing in ${request.targetSection} sections. Convert structured data into clear, accurate sentences appropriate for research manuscripts.`,
      responseFormat: 'json',
      maxTokens: 500,
      temperature: 0.4,
      forceTier: 'MINI',
    };

    const response = await this.router.route(aiRequest);

    if (!response.parsed) {
      throw new Error('Failed to parse sentence builder response');
    }

    const result = response.parsed as {
      sentence: string;
      data_points: string[];
      confidence: number;
    };

    // Apply length constraint if specified
    let sentence = result.sentence;
    if (request.maxLength && sentence.split(/\s+/).length > request.maxLength) {
      sentence = await this.shortenSentence(sentence, request.maxLength);
    }

    return {
      sentence,
      dataPoints: result.data_points,
      confidence: result.confidence,
    };
  }

  /**
   * Build prompt for sentence construction
   */
  private buildPrompt(request: SentenceConstructionRequest): string {
    const dataJson = JSON.stringify(request.data, null, 2);

    return `Construct a well-written sentence for the ${request.targetSection} section based on this data.

Data:
${dataJson}

Context: ${request.context}

Requirements:
- Tone: ${request.tone}
- Section: ${request.targetSection}
${request.maxLength ? `- Maximum length: ${request.maxLength} words` : ''}
- Use precise medical terminology
- Integrate data naturally into prose
- Ensure statistical accuracy

Respond in JSON format:
{
  "sentence": "The constructed sentence",
  "data_points": ["list", "of", "data points", "included"],
  "confidence": 0.0-1.0
}`;
  }

  /**
   * Shorten sentence to meet length constraint
   */
  private async shortenSentence(sentence: string, maxLength: number): Promise<string> {
    const prompt = `Shorten this sentence to maximum ${maxLength} words while preserving all key information:

"${sentence}"

Return only the shortened sentence.`;

    const request: AIRouterRequest = {
      taskType: 'draft_section',
      prompt,
      maxTokens: 200,
      temperature: 0.3,
      forceTier: 'NANO',
    };

    const response = await this.router.route(request);
    return response.content.trim();
  }

  /**
   * Build multiple sentences from dataset
   */
  async buildParagraphFromData(
    dataset: Record<string, unknown>[],
    context: string,
    section: SentenceConstructionRequest['targetSection'],
    tone: SentenceConstructionRequest['tone']
  ): Promise<{
    paragraph: string;
    sentences: Array<{
      sentence: string;
      dataSource: Record<string, unknown>;
    }>;
  }> {
    const sentenceResults = await Promise.all(
      dataset.map((data) =>
        this.buildSentence({
          data,
          context,
          targetSection: section,
          tone,
        })
      )
    );

    const sentences = sentenceResults.map((result, i) => ({
      sentence: result.sentence,
      dataSource: dataset[i],
    }));

    const paragraph = sentences.map((s) => s.sentence).join(' ');

    return {
      paragraph,
      sentences,
    };
  }

  /**
   * Build statistical results sentence
   */
  async buildStatisticalSentence(stats: {
    comparison: string;
    value1: number;
    value2?: number;
    pValue?: number;
    confidenceInterval?: { lower: number; upper: number };
    metric: string;
    unit?: string;
  }): Promise<string> {
    const data = {
      comparison: stats.comparison,
      value1: stats.value1,
      value2: stats.value2,
      p_value: stats.pValue,
      confidence_interval: stats.confidenceInterval,
      metric: stats.metric,
      unit: stats.unit,
    };

    const result = await this.buildSentence({
      data,
      context: 'Statistical comparison for results section',
      targetSection: 'results',
      tone: 'formal',
    });

    return result.sentence;
  }

  /**
   * Build demographic description
   */
  async buildDemographicSentence(demographics: {
    n: number;
    meanAge?: number;
    ageSD?: number;
    ageRange?: { min: number; max: number };
    femalePct?: number;
    ethnicity?: Record<string, number>;
  }): Promise<string> {
    const result = await this.buildSentence({
      data: demographics,
      context: 'Patient demographics for methods or results section',
      targetSection: 'methods',
      tone: 'clinical',
    });

    return result.sentence;
  }

  /**
   * Build comparison sentence (e.g., treatment vs control)
   */
  async buildComparisonSentence(comparison: {
    group1Name: string;
    group1Value: number;
    group2Name: string;
    group2Value: number;
    metric: string;
    unit?: string;
    significant: boolean;
    pValue?: number;
  }): Promise<string> {
    const result = await this.buildSentence({
      data: comparison,
      context: 'Comparison between study groups',
      targetSection: 'results',
      tone: 'formal',
    });

    return result.sentence;
  }

  /**
   * Build trend description sentence
   */
  async buildTrendSentence(trend: {
    metric: string;
    direction: 'increase' | 'decrease' | 'stable';
    magnitude?: number;
    timepoints: string[];
    values: number[];
    unit?: string;
  }): Promise<string> {
    const result = await this.buildSentence({
      data: trend,
      context: 'Temporal trend for results section',
      targetSection: 'results',
      tone: 'formal',
    });

    return result.sentence;
  }

  /**
   * Build correlation sentence
   */
  async buildCorrelationSentence(correlation: {
    variable1: string;
    variable2: string;
    coefficient: number;
    pValue: number;
    direction: 'positive' | 'negative';
    strength: 'weak' | 'moderate' | 'strong';
  }): Promise<string> {
    const result = await this.buildSentence({
      data: correlation,
      context: 'Correlation analysis for results section',
      targetSection: 'results',
      tone: 'formal',
    });

    return result.sentence;
  }
}

/**
 * Singleton instance
 */
let instance: SentenceBuilderService | null = null;

export function getSentenceBuilder(): SentenceBuilderService {
  if (!instance) {
    instance = new SentenceBuilderService();
  }
  return instance;
}
