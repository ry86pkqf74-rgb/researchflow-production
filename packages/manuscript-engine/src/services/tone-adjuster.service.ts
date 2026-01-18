/**
 * Tone Adjuster Service
 *
 * Adjusts writing tone to match target style (formal/semi-formal/clinical).
 */

import { getModelRouter, type AIRouterRequest } from '@researchflow/ai-router';
import type { WritingTone, ToneAdjustmentResult } from '../types';
import { WritingToneSchema } from '../types';

export class ToneAdjusterService {
  private router = getModelRouter();

  /**
   * Adjust text to target tone
   */
  async adjustTone(text: string, targetTone: WritingTone): Promise<ToneAdjustmentResult> {
    // Validate tone
    WritingToneSchema.parse(targetTone);

    // Detect current tone
    const currentTone = await this.detectTone(text);

    if (currentTone === targetTone) {
      return {
        originalText: text,
        adjustedText: text,
        targetTone,
        currentTone,
        adjustmentsMade: [],
        confidence: 1.0,
      };
    }

    // Adjust tone
    const prompt = this.buildAdjustmentPrompt(text, currentTone, targetTone);

    const request: AIRouterRequest = {
      taskType: 'draft_section',
      prompt,
      systemPrompt:
        'You are an expert medical editor specializing in tone and style adjustment for research manuscripts.',
      responseFormat: 'json',
      maxTokens: 2048,
      temperature: 0.4,
      forceTier: 'MINI',
    };

    const response = await this.router.route(request);

    if (!response.parsed) {
      throw new Error('Failed to parse tone adjustment response');
    }

    const result = response.parsed as {
      adjusted_text: string;
      adjustments_made: string[];
      confidence: number;
    };

    return {
      originalText: text,
      adjustedText: result.adjusted_text,
      targetTone,
      currentTone,
      adjustmentsMade: result.adjustments_made,
      confidence: result.confidence,
    };
  }

  /**
   * Detect the current tone of text
   */
  async detectTone(text: string): Promise<WritingTone> {
    const prompt = `Analyze the tone of the following medical research text and classify it.

Text:
${text}

Classify the tone as one of:
- formal: Highly academic, impersonal, technical
- semi-formal: Professional but approachable, balanced technical language
- clinical: Direct, precise, medically focused
- conversational: Accessible, engaging, less technical

Respond with JSON: {"tone": "formal|semi-formal|clinical|conversational", "confidence": 0.0-1.0}`;

    const request: AIRouterRequest = {
      taskType: 'classify',
      prompt,
      responseFormat: 'json',
      maxTokens: 200,
      temperature: 0.1,
      forceTier: 'NANO',
    };

    const response = await this.router.route(request);

    if (!response.parsed) {
      return 'semi-formal'; // Default
    }

    const result = response.parsed as { tone: string; confidence: number };
    return result.tone as WritingTone;
  }

  /**
   * Build tone adjustment prompt
   */
  private buildAdjustmentPrompt(
    text: string,
    currentTone: WritingTone,
    targetTone: WritingTone
  ): string {
    const toneGuidelines = {
      formal: `
- Use passive voice when appropriate
- Employ complex sentence structures
- Use technical terminology without simplification
- Maintain impersonal perspective
- Avoid contractions and colloquialisms`,
      'semi-formal': `
- Balance active and passive voice
- Use clear, well-structured sentences
- Explain technical terms when needed
- Professional but accessible
- Appropriate for broad academic audience`,
      clinical: `
- Use direct, precise language
- Focus on medical accuracy
- Employ standard clinical terminology
- Clear cause-and-effect relationships
- Objective and evidence-based`,
      conversational: `
- Use active voice predominantly
- Shorter, simpler sentences
- Explain technical concepts clearly
- More engaging and accessible
- Maintain accuracy while improving readability`,
    };

    return `Adjust the tone of this medical research text from ${currentTone} to ${targetTone}.

Original Text:
${text}

Target Tone Guidelines (${targetTone}):${toneGuidelines[targetTone]}

Instructions:
1. Preserve all factual content and medical accuracy
2. Maintain the logical structure
3. Adjust vocabulary, sentence structure, and voice to match target tone
4. List all significant adjustments made

Respond in JSON format:
{
  "adjusted_text": "The tone-adjusted text",
  "adjustments_made": ["List of key adjustments"],
  "confidence": 0.0-1.0
}`;
  }

  /**
   * Analyze tone consistency across sections
   */
  async analyzeToneConsistency(sections: Array<{
    name: string;
    content: string;
  }>): Promise<{
    consistent: boolean;
    tones: Array<{ section: string; tone: WritingTone }>;
    recommendations: string[];
  }> {
    const toneAnalysis = await Promise.all(
      sections.map(async (section) => ({
        section: section.name,
        tone: await this.detectTone(section.content),
      }))
    );

    // Check if all tones are the same
    const uniqueTones = new Set(toneAnalysis.map((t) => t.tone));
    const consistent = uniqueTones.size === 1;

    const recommendations: string[] = [];
    if (!consistent) {
      const mostCommonTone = this.getMostCommonTone(toneAnalysis.map((t) => t.tone));
      recommendations.push(
        `Consider standardizing all sections to ${mostCommonTone} tone for consistency`
      );

      toneAnalysis.forEach((analysis) => {
        if (analysis.tone !== mostCommonTone) {
          recommendations.push(
            `Section "${analysis.section}" has ${analysis.tone} tone, consider adjusting to ${mostCommonTone}`
          );
        }
      });
    }

    return {
      consistent,
      tones: toneAnalysis,
      recommendations,
    };
  }

  /**
   * Get most common tone from array
   */
  private getMostCommonTone(tones: WritingTone[]): WritingTone {
    const counts = tones.reduce((acc, tone) => {
      acc[tone] = (acc[tone] || 0) + 1;
      return acc;
    }, {} as Record<WritingTone, number>);

    return Object.entries(counts).reduce((a, b) => (b[1] > a[1] ? b : a))[0] as WritingTone;
  }

  /**
   * Batch adjust multiple sections to same tone
   */
  async adjustMultipleSections(
    sections: Array<{ name: string; content: string }>,
    targetTone: WritingTone
  ): Promise<Array<{ name: string; result: ToneAdjustmentResult }>> {
    const results = await Promise.all(
      sections.map(async (section) => ({
        name: section.name,
        result: await this.adjustTone(section.content, targetTone),
      }))
    );

    return results;
  }

  /**
   * Generate tone analysis report
   */
  generateReport(result: ToneAdjustmentResult): string {
    let report = `Tone Adjustment Report\n`;
    report += `Original Tone: ${result.currentTone}\n`;
    report += `Target Tone: ${result.targetTone}\n`;
    report += `Confidence: ${(result.confidence * 100).toFixed(1)}%\n\n`;

    if (result.adjustmentsMade.length > 0) {
      report += `Adjustments Made:\n`;
      result.adjustmentsMade.forEach((adj, i) => {
        report += `${i + 1}. ${adj}\n`;
      });
      report += `\n`;
    }

    report += `Original Word Count: ${result.originalText.split(/\s+/).length}\n`;
    report += `Adjusted Word Count: ${result.adjustedText.split(/\s+/).length}\n`;

    return report;
  }
}

/**
 * Singleton instance
 */
let instance: ToneAdjusterService | null = null;

export function getToneAdjuster(): ToneAdjusterService {
  if (!instance) {
    instance = new ToneAdjusterService();
  }
  return instance;
}
