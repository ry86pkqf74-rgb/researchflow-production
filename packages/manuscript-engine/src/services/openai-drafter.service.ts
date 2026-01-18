/**
 * OpenAI Drafter Service
 *
 * Uses OpenAI GPT models for initial draft generation through AI Router.
 */

import { getModelRouter, type AIRouterRequest } from '@researchflow/ai-router';
import type { ManuscriptSection, SectionPromptContext } from '../types';
import { SectionPromptContextSchema } from '../types';

export class OpenAIDrafterService {
  private router = getModelRouter();

  /**
   * Generate a draft section using OpenAI
   */
  async generateDraft(
    section: ManuscriptSection,
    context: SectionPromptContext
  ): Promise<{
    draft: string;
    metadata: {
      wordCount: number;
      paragraphCount: number;
      estimatedCost: number;
    };
  }> {
    // Validate input
    SectionPromptContextSchema.parse(context);

    // Build prompt based on section type
    const prompt = this.buildSectionPrompt(section, context);

    const request: AIRouterRequest = {
      taskType: 'draft_section',
      prompt,
      systemPrompt: `You are an expert medical writer specializing in ${context.studyType} research manuscripts. Generate clear, accurate, and well-structured content for academic publication.`,
      maxTokens: 2048,
      temperature: 0.7,
      metadata: {
        stageId: 4, // Writing stage
        workflowStep: `draft_${section}`,
      },
    };

    const response = await this.router.route(request);

    if (!response.qualityGate.passed) {
      throw new Error(
        `Quality gate failed: ${response.qualityGate.checks
          .filter((c) => !c.passed)
          .map((c) => c.reason)
          .join(', ')}`
      );
    }

    const draft = response.content;
    const wordCount = draft.split(/\s+/).length;
    const paragraphCount = draft.split(/\n\n+/).filter((p) => p.trim()).length;

    return {
      draft,
      metadata: {
        wordCount,
        paragraphCount,
        estimatedCost: response.usage.estimatedCostUsd,
      },
    };
  }

  /**
   * Build section-specific prompt
   */
  private buildSectionPrompt(section: ManuscriptSection, context: SectionPromptContext): string {
    const baseContext = `Study Type: ${context.studyType}\n`;

    let prompt = baseContext;

    if (context.objective) {
      prompt += `Objective: ${context.objective}\n`;
    }

    if (context.methodology) {
      prompt += `Methodology: ${context.methodology}\n`;
    }

    if (context.keyFindings && context.keyFindings.length > 0) {
      prompt += `Key Findings:\n${context.keyFindings.map((f) => `- ${f}`).join('\n')}\n`;
    }

    if (context.existingContent) {
      prompt += `\nExisting Content:\n${context.existingContent}\n\n`;
    }

    prompt += `\nPlease generate a well-structured ${section} section for this medical research manuscript. `;
    prompt += `Follow academic writing conventions and ensure the content is appropriate for peer-reviewed publication.`;

    return prompt;
  }

  /**
   * Refine an existing draft
   */
  async refineDraft(
    originalDraft: string,
    refinementInstructions: string
  ): Promise<{
    refinedDraft: string;
    changes: string[];
  }> {
    const request: AIRouterRequest = {
      taskType: 'draft_section',
      prompt: `Original Draft:\n${originalDraft}\n\nRefinement Instructions:\n${refinementInstructions}\n\nPlease refine the draft according to the instructions while maintaining academic tone and accuracy.`,
      systemPrompt:
        'You are an expert medical editor. Refine the provided draft while preserving key content and improving clarity, structure, and academic style.',
      maxTokens: 2048,
      temperature: 0.5,
    };

    const response = await this.router.route(request);

    return {
      refinedDraft: response.content,
      changes: this.identifyChanges(originalDraft, response.content),
    };
  }

  /**
   * Identify key changes between drafts
   */
  private identifyChanges(original: string, refined: string): string[] {
    const changes: string[] = [];

    const originalWordCount = original.split(/\s+/).length;
    const refinedWordCount = refined.split(/\s+/).length;

    if (Math.abs(refinedWordCount - originalWordCount) > 10) {
      changes.push(
        `Word count changed from ${originalWordCount} to ${refinedWordCount}`
      );
    }

    // Simple heuristic - in production, use proper diff algorithm
    if (original !== refined) {
      changes.push('Content structure and phrasing refined');
    }

    return changes;
  }
}

/**
 * Singleton instance
 */
let instance: OpenAIDrafterService | null = null;

export function getOpenAIDrafter(): OpenAIDrafterService {
  if (!instance) {
    instance = new OpenAIDrafterService();
  }
  return instance;
}
