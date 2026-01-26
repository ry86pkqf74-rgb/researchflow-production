/**
 * Transition Suggester Service
 *
 * Suggests context-aware transitions between sentences and paragraphs.
 */

import { getModelRouter, type AIRouterRequest } from '@researchflow/ai-router';
import type { TransitionSuggestion } from '../types';

export class TransitionSuggesterService {
  private router = getModelRouter();

  /**
   * Suggest transitions for a text
   */
  async suggestTransitions(text: string): Promise<TransitionSuggestion[]> {
    const paragraphs = this.splitIntoParagraphs(text);

    if (paragraphs.length <= 1) {
      return [];
    }

    const suggestions: TransitionSuggestion[] = [];

    // Analyze transitions between paragraphs
    for (let i = 0; i < paragraphs.length - 1; i++) {
      const currentParagraph = paragraphs[i];
      const nextParagraph = paragraphs[i + 1];

      const suggestion = await this.suggestTransitionBetween(
        currentParagraph,
        nextParagraph,
        this.getPosition(text, paragraphs, i + 1)
      );

      if (suggestion) {
        suggestions.push(suggestion);
      }
    }

    return suggestions;
  }

  /**
   * Suggest transition between two paragraphs
   */
  private async suggestTransitionBetween(
    paragraph1: string,
    paragraph2: string,
    position: number
  ): Promise<TransitionSuggestion | null> {
    const prompt = `Analyze the flow between these two paragraphs from a medical research manuscript and suggest an improved transition if needed.

Paragraph 1:
${paragraph1}

Paragraph 2:
${paragraph2}

Evaluate:
1. Is the current transition effective?
2. What is the logical relationship between these paragraphs?
3. What transition would improve coherence?

Respond in JSON format:
{
  "needs_improvement": true/false,
  "current_transition": "first few words of paragraph 2",
  "suggested_transition": "improved transition text",
  "reasoning": "why this transition is better",
  "coherence_score": 0.0-1.0
}`;

    const request: AIRouterRequest = {
      taskType: 'draft_section',
      prompt,
      systemPrompt:
        'You are an expert medical editor specializing in manuscript flow and coherence.',
      responseFormat: 'json',
      maxTokens: 800,
      temperature: 0.3,
      forceTier: 'MINI',
    };

    const response = await this.router.route(request);

    if (!response.parsed) {
      return null;
    }

    const result = response.parsed as {
      needs_improvement: boolean;
      current_transition: string;
      suggested_transition: string;
      reasoning: string;
      coherence_score: number;
    };

    if (!result.needs_improvement) {
      return null;
    }

    return {
      position,
      currentText: result.current_transition,
      suggestedTransition: result.suggested_transition,
      reasoning: result.reasoning,
      coherenceScore: result.coherence_score,
    };
  }

  /**
   * Apply transition suggestions to text
   */
  async applyTransitions(
    text: string,
    suggestions: TransitionSuggestion[]
  ): Promise<string> {
    // Sort suggestions by position in reverse order
    const sorted = [...suggestions].sort((a, b) => b.position - a.position);

    let modifiedText = text;

    for (const suggestion of sorted) {
      // Find the current text and replace with suggestion
      const before = modifiedText.substring(0, suggestion.position);
      const after = modifiedText.substring(
        suggestion.position + suggestion.currentText.length
      );
      modifiedText = before + suggestion.suggestedTransition + after;
    }

    return modifiedText;
  }

  /**
   * Analyze overall coherence of text
   */
  async analyzeCoherence(text: string): Promise<{
    overallScore: number;
    paragraphScores: number[];
    weakTransitions: TransitionSuggestion[];
    strengths: string[];
    improvements: string[];
  }> {
    const suggestions = await this.suggestTransitions(text);
    const paragraphs = this.splitIntoParagraphs(text);

    // Calculate paragraph-level coherence scores
    const paragraphScores = await this.calculateParagraphScores(paragraphs);

    // Overall score is average of paragraph scores minus penalty for weak transitions
    const avgParagraphScore =
      paragraphScores.reduce((a, b) => a + b, 0) / (paragraphScores.length || 1);
    const weakTransitionPenalty = suggestions.length * 0.05;
    const overallScore = Math.max(0, avgParagraphScore - weakTransitionPenalty);

    return {
      overallScore,
      paragraphScores,
      weakTransitions: suggestions,
      strengths: this.identifyStrengths(text, suggestions),
      improvements: suggestions.map((s) => s.reasoning),
    };
  }

  /**
   * Calculate coherence scores for individual paragraphs
   */
  private async calculateParagraphScores(paragraphs: string[]): Promise<number[]> {
    return paragraphs.map((p) => {
      const sentences = p.split(/[.!?]+/).filter((s) => s.trim());
      if (sentences.length < 2) return 1.0;

      // Simple heuristic: check for transition words and sentence flow
      const transitionWords = [
        'however',
        'moreover',
        'furthermore',
        'therefore',
        'consequently',
        'additionally',
      ];
      const hasTransitions = sentences.some((s) =>
        transitionWords.some((w) => s.toLowerCase().includes(w))
      );

      return hasTransitions ? 0.9 : 0.7;
    });
  }

  /**
   * Identify strengths in text coherence
   */
  private identifyStrengths(text: string, weakTransitions: TransitionSuggestion[]): string[] {
    const paragraphs = this.splitIntoParagraphs(text);
    const strengths: string[] = [];

    if (paragraphs.length > 0) {
      strengths.push(`Document contains ${paragraphs.length} well-structured paragraphs`);
    }

    const strongTransitions = paragraphs.length - 1 - weakTransitions.length;
    if (strongTransitions > 0) {
      strengths.push(
        `${strongTransitions} effective transitions between paragraphs`
      );
    }

    return strengths;
  }

  /**
   * Split text into paragraphs
   */
  private splitIntoParagraphs(text: string): string[] {
    return text.split(/\n\n+/).filter((p) => p.trim().length > 0);
  }

  /**
   * Get position of paragraph in text
   */
  private getPosition(text: string, paragraphs: string[], index: number): number {
    let position = 0;
    for (let i = 0; i < index && i < paragraphs.length; i++) {
      position += paragraphs[i].length + 2; // +2 for \n\n
    }
    return position;
  }

  /**
   * Generate transition report
   */
  generateReport(analysis: {
    overallScore: number;
    weakTransitions: TransitionSuggestion[];
    strengths: string[];
    improvements: string[];
  }): string {
    let report = `Coherence Analysis Report\n`;
    report += `Overall Score: ${(analysis.overallScore * 100).toFixed(1)}%\n\n`;

    if (analysis.strengths.length > 0) {
      report += `Strengths:\n`;
      analysis.strengths.forEach((s) => {
        report += `- ${s}\n`;
      });
      report += `\n`;
    }

    if (analysis.weakTransitions.length > 0) {
      report += `Weak Transitions Identified: ${analysis.weakTransitions.length}\n\n`;
      analysis.weakTransitions.forEach((t, i) => {
        report += `${i + 1}. Position ${t.position}\n`;
        report += `   Current: "${t.currentText}"\n`;
        report += `   Suggested: "${t.suggestedTransition}"\n`;
        report += `   Reason: ${t.reasoning}\n\n`;
      });
    }

    return report;
  }
}

/**
 * Singleton instance
 */
let instance: TransitionSuggesterService | null = null;

export function getTransitionSuggester(): TransitionSuggesterService {
  if (!instance) {
    instance = new TransitionSuggesterService();
  }
  return instance;
}
