/**
 * Paraphrase Service
 *
 * AI-assisted paraphrasing with originality checks.
 */

import { getModelRouter, type AIRouterRequest } from '@researchflow/ai-router';
import type { ParaphraseResult, ParaphraseChange } from '../types';

export class ParaphraseService {
  private router = getModelRouter();

  /**
   * Paraphrase text while maintaining meaning
   */
  async paraphrase(
    text: string,
    options: {
      preserveKeyTerms?: string[];
      targetLength?: 'shorter' | 'same' | 'longer';
      styleGoal?: 'formal' | 'accessible' | 'technical';
    } = {}
  ): Promise<ParaphraseResult> {
    const prompt = this.buildParaphrasePrompt(text, options);

    const request: AIRouterRequest = {
      taskType: 'draft_section',
      prompt,
      systemPrompt:
        'You are an expert medical writer specializing in paraphrasing while maintaining scientific accuracy and preserving key medical terminology.',
      responseFormat: 'json',
      maxTokens: 2000,
      temperature: 0.7,
      forceTier: 'MINI',
    };

    const response = await this.router.route(request);

    if (!response.parsed) {
      throw new Error('Failed to parse paraphrase response');
    }

    const result = response.parsed as {
      paraphrased_text: string;
      preserved_key_terms: string[];
      changes: Array<{
        type: 'structure' | 'vocabulary' | 'grammar';
        description: string;
      }>;
    };

    // Calculate similarity and originality scores
    const similarityScore = await this.calculateSimilarity(text, result.paraphrased_text);
    const originalityScore = 1 - similarityScore;

    return {
      originalText: text,
      paraphrasedText: result.paraphrased_text,
      similarityScore,
      originalityScore,
      preservedKeyTerms: result.preserved_key_terms,
      changes: result.changes,
    };
  }

  /**
   * Build paraphrase prompt with options
   */
  private buildParaphrasePrompt(
    text: string,
    options: {
      preserveKeyTerms?: string[];
      targetLength?: 'shorter' | 'same' | 'longer';
      styleGoal?: 'formal' | 'accessible' | 'technical';
    }
  ): string {
    let prompt = `Paraphrase the following medical research text while maintaining scientific accuracy and meaning.\n\n`;

    prompt += `Original Text:\n${text}\n\n`;

    prompt += `Requirements:\n`;

    if (options.preserveKeyTerms && options.preserveKeyTerms.length > 0) {
      prompt += `- Preserve these key medical terms: ${options.preserveKeyTerms.join(', ')}\n`;
    } else {
      prompt += `- Preserve essential medical terminology\n`;
    }

    if (options.targetLength) {
      prompt += `- Target length: ${options.targetLength} than original\n`;
    }

    if (options.styleGoal) {
      prompt += `- Style goal: ${options.styleGoal}\n`;
    }

    prompt += `- Change sentence structure and vocabulary where appropriate\n`;
    prompt += `- Maintain all factual information\n`;
    prompt += `- Ensure high originality while preserving meaning\n\n`;

    prompt += `Respond in JSON format:
{
  "paraphrased_text": "The paraphrased text",
  "preserved_key_terms": ["list", "of", "preserved", "terms"],
  "changes": [
    {
      "type": "structure|vocabulary|grammar",
      "description": "description of change made"
    }
  ]
}`;

    return prompt;
  }

  /**
   * Calculate similarity between original and paraphrased text
   */
  private async calculateSimilarity(text1: string, text2: string): Promise<number> {
    // Simple word overlap similarity (in production, use more sophisticated methods)
    const words1 = new Set(text1.toLowerCase().match(/\b\w+\b/g) || []);
    const words2 = new Set(text2.toLowerCase().match(/\b\w+\b/g) || []);

    const intersection = new Set([...words1].filter((w) => words2.has(w)));
    const union = new Set([...words1, ...words2]);

    return intersection.size / union.size;
  }

  /**
   * Paraphrase with multiple variations
   */
  async generateVariations(
    text: string,
    count: number = 3
  ): Promise<ParaphraseResult[]> {
    const variations = await Promise.all(
      Array.from({ length: count }, (_, i) =>
        this.paraphrase(text, {
          styleGoal: i === 0 ? 'formal' : i === 1 ? 'accessible' : 'technical',
        })
      )
    );

    return variations;
  }

  /**
   * Check paraphrase originality
   */
  async checkOriginality(
    original: string,
    paraphrased: string
  ): Promise<{
    originalityScore: number;
    passed: boolean;
    similarPhrases: Array<{
      original: string;
      paraphrased: string;
      similarity: number;
    }>;
    recommendation: string;
  }> {
    const similarityScore = await this.calculateSimilarity(original, paraphrased);
    const originalityScore = 1 - similarityScore;

    // Check for similar phrases
    const originalSentences = original.split(/[.!?]+/).filter((s) => s.trim());
    const paraphrasedSentences = paraphrased.split(/[.!?]+/).filter((s) => s.trim());

    const similarPhrases: Array<{
      original: string;
      paraphrased: string;
      similarity: number;
    }> = [];

    for (const origSent of originalSentences) {
      for (const paraSent of paraphrasedSentences) {
        const sentSimilarity = await this.calculateSimilarity(origSent, paraSent);
        if (sentSimilarity > 0.7) {
          similarPhrases.push({
            original: origSent.trim(),
            paraphrased: paraSent.trim(),
            similarity: sentSimilarity,
          });
        }
      }
    }

    const passed = originalityScore >= 0.5;

    let recommendation: string;
    if (originalityScore >= 0.7) {
      recommendation = 'Excellent originality. Paraphrase is sufficiently different.';
    } else if (originalityScore >= 0.5) {
      recommendation = 'Acceptable originality. Consider varying a few more phrases.';
    } else if (originalityScore >= 0.3) {
      recommendation = 'Low originality. Significant rephrasing needed.';
    } else {
      recommendation = 'Very low originality. Text is too similar to original.';
    }

    return {
      originalityScore,
      passed,
      similarPhrases,
      recommendation,
    };
  }

  /**
   * Paraphrase with specific focus
   */
  async paraphraseFocus(
    text: string,
    focus: 'structure' | 'vocabulary' | 'both'
  ): Promise<ParaphraseResult> {
    let additionalInstructions: string;

    switch (focus) {
      case 'structure':
        additionalInstructions =
          'Focus on restructuring sentences while keeping similar vocabulary.';
        break;
      case 'vocabulary':
        additionalInstructions =
          'Focus on using different vocabulary and phrasing while keeping similar sentence structures.';
        break;
      case 'both':
        additionalInstructions = 'Change both sentence structure and vocabulary extensively.';
        break;
    }

    const prompt = `${this.buildParaphrasePrompt(text, {})}

Additional Focus: ${additionalInstructions}`;

    const request: AIRouterRequest = {
      taskType: 'draft_section',
      prompt,
      responseFormat: 'json',
      maxTokens: 2000,
      temperature: 0.7,
      forceTier: 'MINI',
    };

    const response = await this.router.route(request);

    if (!response.parsed) {
      throw new Error('Failed to parse focused paraphrase response');
    }

    const result = response.parsed as {
      paraphrased_text: string;
      preserved_key_terms: string[];
      changes: Array<{
        type: 'structure' | 'vocabulary' | 'grammar';
        description: string;
      }>;
    };

    const similarityScore = await this.calculateSimilarity(text, result.paraphrased_text);
    const originalityScore = 1 - similarityScore;

    return {
      originalText: text,
      paraphrasedText: result.paraphrased_text,
      similarityScore,
      originalityScore,
      preservedKeyTerms: result.preserved_key_terms,
      changes: result.changes,
    };
  }

  /**
   * Generate paraphrase report
   */
  generateReport(result: ParaphraseResult): string {
    let report = `Paraphrase Analysis Report\n\n`;

    report += `Similarity Score: ${(result.similarityScore * 100).toFixed(1)}%\n`;
    report += `Originality Score: ${(result.originalityScore * 100).toFixed(1)}%\n\n`;

    report += `Preserved Key Terms: ${result.preservedKeyTerms.length}\n`;
    if (result.preservedKeyTerms.length > 0) {
      report += `  ${result.preservedKeyTerms.join(', ')}\n`;
    }
    report += `\n`;

    report += `Changes Made: ${result.changes.length}\n`;
    result.changes.forEach((change, i) => {
      report += `${i + 1}. [${change.type}] ${change.description}\n`;
    });
    report += `\n`;

    report += `Original Length: ${result.originalText.split(/\s+/).length} words\n`;
    report += `Paraphrased Length: ${result.paraphrasedText.split(/\s+/).length} words\n`;

    return report;
  }
}

/**
 * Singleton instance
 */
let instance: ParaphraseService | null = null;

export function getParaphrase(): ParaphraseService {
  if (!instance) {
    instance = new ParaphraseService();
  }
  return instance;
}
