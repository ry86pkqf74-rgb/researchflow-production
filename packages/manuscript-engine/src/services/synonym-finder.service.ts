/**
 * Synonym Finder Service
 *
 * Medical terminology-aware synonym suggestions.
 */

import { getModelRouter, type AIRouterRequest } from '@researchflow/ai-router';
import type { SynonymSuggestion } from '../types';

export class SynonymFinderService {
  private router = getModelRouter();

  /**
   * Find medical synonyms for a word or phrase
   */
  async findSynonyms(
    word: string,
    context: string
  ): Promise<SynonymSuggestion> {
    const prompt = `Find medically appropriate synonyms for the word/phrase "${word}" in the following context:

Context: ${context}

Provide synonyms that:
1. Are medically accurate
2. Maintain the same level of specificity
3. Fit the context appropriately
4. Include standard medical terminology

Respond in JSON format:
{
  "word": "${word}",
  "synonyms": [
    {
      "term": "synonym",
      "medically_preferred": true/false,
      "context": "brief explanation of usage",
      "similarity": 0.0-1.0
    }
  ]
}`;

    const request: AIRouterRequest = {
      taskType: 'extract_metadata',
      prompt,
      responseFormat: 'json',
      maxTokens: 1000,
      temperature: 0.3,
      forceTier: 'NANO',
    };

    const response = await this.router.route(request);

    if (!response.parsed) {
      throw new Error('Failed to parse synonym response');
    }

    const result = response.parsed as {
      word: string;
      synonyms: Array<{
        term: string;
        medically_preferred: boolean;
        context: string;
        similarity: number;
      }>;
    };

    return {
      word: result.word,
      synonyms: result.synonyms.map((s) => ({
        term: s.term,
        medicallyPreferred: s.medically_preferred,
        context: s.context,
        similarity: s.similarity,
      })),
    };
  }

  /**
   * Find synonyms for multiple words in text
   */
  async findSynonymsInText(
    text: string,
    targetWords: string[]
  ): Promise<SynonymSuggestion[]> {
    const results = await Promise.all(
      targetWords.map((word) => this.findSynonyms(word, text))
    );
    return results;
  }

  /**
   * Suggest vocabulary improvements for text
   */
  async suggestVocabularyImprovements(text: string): Promise<{
    suggestions: Array<{
      original: string;
      position: number;
      replacements: Array<{
        term: string;
        reason: string;
        medicallyPreferred: boolean;
      }>;
    }>;
    overallScore: number;
  }> {
    const prompt = `Analyze the vocabulary in this medical research text and suggest improvements. Focus on:
1. Non-standard terminology that should use medical standards
2. Vague terms that could be more specific
3. Repetitive word usage that could benefit from variation

Text:
${text}

Respond in JSON format:
{
  "suggestions": [
    {
      "original": "word to replace",
      "position": 0,
      "replacements": [
        {
          "term": "suggested replacement",
          "reason": "why this is better",
          "medically_preferred": true/false
        }
      ]
    }
  ],
  "overall_score": 0.0-1.0
}`;

    const request: AIRouterRequest = {
      taskType: 'draft_section',
      prompt,
      responseFormat: 'json',
      maxTokens: 1500,
      temperature: 0.3,
      forceTier: 'MINI',
    };

    const response = await this.router.route(request);

    if (!response.parsed) {
      throw new Error('Failed to parse vocabulary improvements');
    }

    const result = response.parsed as {
      suggestions: Array<{
        original: string;
        position: number;
        replacements: Array<{
          term: string;
          reason: string;
          medically_preferred: boolean;
        }>;
      }>;
      overall_score: number;
    };

    return {
      suggestions: result.suggestions.map((s) => ({
        original: s.original,
        position: s.position,
        replacements: s.replacements.map((r) => ({
          term: r.term,
          reason: r.reason,
          medicallyPreferred: r.medically_preferred,
        })),
      })),
      overallScore: result.overall_score,
    };
  }

  /**
   * Check for repetitive vocabulary
   */
  async checkRepetition(text: string): Promise<{
    repetitiveWords: Array<{
      word: string;
      count: number;
      positions: number[];
      suggestions: string[];
    }>;
    repetitionScore: number;
  }> {
    // Extract word frequencies
    const words = text.toLowerCase().match(/\b\w+\b/g) || [];
    const wordFreq = new Map<string, number[]>();

    words.forEach((word, index) => {
      if (word.length > 4) {
        // Only track words longer than 4 characters
        if (!wordFreq.has(word)) {
          wordFreq.set(word, []);
        }
        wordFreq.get(word)!.push(index);
      }
    });

    // Find repetitive words (used more than 3 times)
    const repetitive = Array.from(wordFreq.entries())
      .filter(([_, positions]) => positions.length > 3)
      .map(([word, positions]) => ({ word, positions }));

    if (repetitive.length === 0) {
      return {
        repetitiveWords: [],
        repetitionScore: 1.0,
      };
    }

    // Get synonyms for repetitive words
    const results = await Promise.all(
      repetitive.map(async ({ word, positions }) => {
        const synonymResult = await this.findSynonyms(word, text);
        return {
          word,
          count: positions.length,
          positions,
          suggestions: synonymResult.synonyms.map((s) => s.term),
        };
      })
    );

    // Calculate repetition score
    const totalWords = words.length;
    const repetitiveCount = repetitive.reduce((sum, r) => sum + r.positions.length, 0);
    const repetitionScore = 1 - Math.min(repetitiveCount / totalWords, 0.5) * 2;

    return {
      repetitiveWords: results,
      repetitionScore,
    };
  }

  /**
   * Replace word with synonym in text
   */
  replaceWithSynonym(
    text: string,
    word: string,
    synonym: string,
    position?: number
  ): string {
    if (position !== undefined) {
      // Replace at specific position
      const before = text.substring(0, position);
      const after = text.substring(position + word.length);
      return before + synonym + after;
    } else {
      // Replace first occurrence
      return text.replace(new RegExp(`\\b${word}\\b`, 'i'), synonym);
    }
  }

  /**
   * Generate vocabulary report
   */
  generateReport(improvements: {
    suggestions: Array<{
      original: string;
      position: number;
      replacements: Array<{
        term: string;
        reason: string;
        medicallyPreferred: boolean;
      }>;
    }>;
    overallScore: number;
  }): string {
    let report = `Vocabulary Analysis Report\n`;
    report += `Overall Score: ${(improvements.overallScore * 100).toFixed(1)}%\n\n`;

    if (improvements.suggestions.length === 0) {
      report += `No vocabulary improvements suggested. Terminology is appropriate.\n`;
    } else {
      report += `Suggested Improvements: ${improvements.suggestions.length}\n\n`;

      improvements.suggestions.forEach((suggestion, i) => {
        report += `${i + 1}. "${suggestion.original}" (position ${suggestion.position})\n`;
        suggestion.replacements.forEach((replacement) => {
          const preferred = replacement.medicallyPreferred ? '[PREFERRED]' : '';
          report += `   → ${replacement.term} ${preferred}\n`;
          report += `      ${replacement.reason}\n`;
        });
        report += `\n`;
      });
    }

    return report;
  }
}

/**
 * Singleton instance
 */
let instance: SynonymFinderService | null = null;

export function getSynonymFinder(): SynonymFinderService {
  if (!instance) {
    instance = new SynonymFinderService();
  }
  return instance;
}
