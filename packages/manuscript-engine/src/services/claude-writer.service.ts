/**
 * Claude Writer Service
 *
 * Uses Claude API for reasoned paragraph generation with chain-of-thought.
 */

import { getModelRouter, type AIRouterRequest } from '@researchflow/ai-router';
import type { ManuscriptSection, WritingTone } from '../types';
import { WritingToneSchema } from '../types';

export interface ParagraphRequest {
  topic: string;
  context: string;
  keyPoints: string[];
  section: ManuscriptSection;
  tone: WritingTone;
  targetLength?: number;
}

export interface ReasonedParagraph {
  paragraph: string;
  reasoning: {
    approach: string;
    keyDecisions: string[];
    evidenceUsed: string[];
  };
  metadata: {
    wordCount: number;
    sentenceCount: number;
    coherenceScore: number;
  };
}

export class ClaudeWriterService {
  private router = getModelRouter();

  /**
   * Generate a reasoned paragraph using Claude's chain-of-thought
   */
  async generateParagraph(request: ParagraphRequest): Promise<ReasonedParagraph> {
    // Validate tone
    WritingToneSchema.parse(request.tone);

    const prompt = this.buildParagraphPrompt(request);

    const aiRequest: AIRouterRequest = {
      taskType: 'draft_section',
      prompt,
      systemPrompt: `You are an expert medical writer with deep knowledge of ${request.section} sections in research manuscripts. Use chain-of-thought reasoning to construct well-argued paragraphs.`,
      responseFormat: 'json',
      maxTokens: 1500,
      temperature: 0.6,
      forceTier: 'MINI', // Use Claude for reasoning
    };

    const response = await this.router.route(aiRequest);

    if (!response.parsed) {
      throw new Error('Failed to parse Claude response');
    }

    const result = response.parsed as {
      reasoning: {
        approach: string;
        key_decisions: string[];
        evidence_used: string[];
      };
      paragraph: string;
    };

    const wordCount = result.paragraph.split(/\s+/).length;
    const sentenceCount = result.paragraph.split(/[.!?]+/).filter((s) => s.trim()).length;

    return {
      paragraph: result.paragraph,
      reasoning: {
        approach: result.reasoning.approach,
        keyDecisions: result.reasoning.key_decisions,
        evidenceUsed: result.reasoning.evidence_used,
      },
      metadata: {
        wordCount,
        sentenceCount,
        coherenceScore: this.calculateCoherenceScore(result.paragraph),
      },
    };
  }

  /**
   * Build paragraph generation prompt with reasoning instructions
   */
  private buildParagraphPrompt(request: ParagraphRequest): string {
    const keyPointsList = request.keyPoints.map((p, i) => `${i + 1}. ${p}`).join('\n');
    const lengthConstraint = request.targetLength
      ? `approximately ${request.targetLength} words`
      : '150-200 words';

    return `Generate a well-structured paragraph for the ${request.section} section of a medical research manuscript.

Topic: ${request.topic}

Context: ${request.context}

Key Points to Address:
${keyPointsList}

Requirements:
- Tone: ${request.tone}
- Length: ${lengthConstraint}
- Use clear, precise medical terminology
- Maintain logical flow between sentences
- Support claims with the provided context

Please respond in JSON format:
{
  "reasoning": {
    "approach": "Explain your approach to structuring this paragraph",
    "key_decisions": ["List key decisions made in crafting the paragraph"],
    "evidence_used": ["List evidence or context used"]
  },
  "paragraph": "The generated paragraph text"
}`;
  }

  /**
   * Calculate coherence score based on transitions and flow
   */
  private calculateCoherenceScore(paragraph: string): number {
    const sentences = paragraph.split(/[.!?]+/).filter((s) => s.trim());

    if (sentences.length < 2) return 1.0;

    // Transition words that indicate good flow
    const transitionWords = [
      'however',
      'moreover',
      'furthermore',
      'additionally',
      'consequently',
      'therefore',
      'thus',
      'meanwhile',
      'subsequently',
      'similarly',
      'conversely',
      'nevertheless',
    ];

    let transitionCount = 0;
    sentences.forEach((sentence) => {
      const lowerSentence = sentence.toLowerCase();
      if (transitionWords.some((word) => lowerSentence.includes(word))) {
        transitionCount++;
      }
    });

    // Score based on transition usage (normalized)
    const transitionScore = Math.min(transitionCount / (sentences.length - 1), 1.0);

    // Score based on sentence length consistency (less variation = better flow)
    const lengths = sentences.map((s) => s.split(/\s+/).length);
    const avgLength = lengths.reduce((a, b) => a + b, 0) / lengths.length;
    const variance = lengths.reduce((sum, len) => sum + Math.pow(len - avgLength, 2), 0) / lengths.length;
    const consistencyScore = 1 - Math.min(Math.sqrt(variance) / avgLength, 1);

    // Combined score
    return (transitionScore * 0.6 + consistencyScore * 0.4);
  }

  /**
   * Expand a brief point into a full paragraph
   */
  async expandPoint(
    point: string,
    context: string,
    section: ManuscriptSection,
    tone: WritingTone
  ): Promise<ReasonedParagraph> {
    return this.generateParagraph({
      topic: point,
      context,
      keyPoints: [point],
      section,
      tone,
      targetLength: 150,
    });
  }

  /**
   * Merge multiple paragraphs with smooth transitions
   */
  async mergeParagraphs(
    paragraphs: string[],
    section: ManuscriptSection
  ): Promise<{ mergedText: string; transitionsAdded: number }> {
    if (paragraphs.length <= 1) {
      return { mergedText: paragraphs[0] || '', transitionsAdded: 0 };
    }

    const prompt = `Merge the following paragraphs into a cohesive section with smooth transitions. Preserve all key content while improving flow.

Paragraphs to merge:
${paragraphs.map((p, i) => `\nParagraph ${i + 1}:\n${p}`).join('\n')}

Provide the merged text with natural transitions between ideas.`;

    const request: AIRouterRequest = {
      taskType: 'draft_section',
      prompt,
      systemPrompt: `You are an expert editor specializing in ${section} sections. Create smooth, logical transitions between paragraphs.`,
      maxTokens: 2000,
      temperature: 0.5,
      forceTier: 'MINI',
    };

    const response = await this.router.route(request);

    // Count transitions added (simplified heuristic)
    const originalTransitions = this.countTransitions(paragraphs.join(' '));
    const newTransitions = this.countTransitions(response.content);

    return {
      mergedText: response.content,
      transitionsAdded: Math.max(0, newTransitions - originalTransitions),
    };
  }

  /**
   * Count transition words in text
   */
  private countTransitions(text: string): number {
    const transitionWords = [
      'however',
      'moreover',
      'furthermore',
      'additionally',
      'consequently',
      'therefore',
      'thus',
      'meanwhile',
      'subsequently',
    ];

    const lowerText = text.toLowerCase();
    return transitionWords.filter((word) => lowerText.includes(word)).length;
  }
}

/**
 * Singleton instance
 */
let instance: ClaudeWriterService | null = null;

export function getClaudeWriter(): ClaudeWriterService {
  if (!instance) {
    instance = new ClaudeWriterService();
  }
  return instance;
}
