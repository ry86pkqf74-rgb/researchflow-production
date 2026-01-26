/**
 * Introduction Builder Service
 * Task T43: Build structured introductions following the funnel approach
 */

export interface IntroductionBuilderRequest {
  manuscriptId: string;
  topic: string;
  researchQuestion?: string;
  studyObjective?: string;
  background?: {
    context: string[];
    significance: string[];
  };
  gap?: {
    what: string;
    why: string;
  };
  citationIds?: string[]; // Citations to include
  maxWords?: number;
  style?: 'general_to_specific' | 'problem_solution' | 'gap_focused';
}

export interface GeneratedIntroduction {
  manuscriptId: string;
  sections: IntroductionSection[];
  fullText: string;
  wordCount: number;
  citationCount: number;
  structure: 'funnel' | 'inverted_pyramid' | 'narrative';
  warnings: string[];
  suggestions: string[];
  createdAt: Date;
}

export interface IntroductionSection {
  type: 'background' | 'significance' | 'gap' | 'objective' | 'hypothesis';
  heading?: string;
  content: string;
  wordCount: number;
  paragraphCount: number;
  citationPlaceholders?: string[]; // Where citations should go
}

/**
 * Introduction Builder Service
 * Constructs well-structured introductions using the funnel approach
 */
export class IntroductionBuilderService {
  /**
   * Build a complete introduction section
   */
  async buildIntroduction(request: IntroductionBuilderRequest): Promise<GeneratedIntroduction> {
    const maxWords = request.maxWords || 800;

    const sections = await this.generateSections(request, maxWords);
    const fullText = this.assembleSections(sections);
    const wordCount = fullText.split(/\s+/).length;
    const citationCount = request.citationIds?.length || 0;

    const warnings = this.checkIntroductionQuality(sections, maxWords);
    const suggestions = this.generateSuggestions(sections);

    return {
      manuscriptId: request.manuscriptId,
      sections,
      fullText,
      wordCount,
      citationCount,
      structure: 'funnel',
      warnings,
      suggestions,
      createdAt: new Date(),
    };
  }

  /**
   * Generate introduction sections following the funnel structure
   * General context → Narrow focus → Knowledge gap → Study objective
   */
  private async generateSections(
    request: IntroductionBuilderRequest,
    maxWords: number
  ): Promise<IntroductionSection[]> {
    const sections: IntroductionSection[] = [];

    // Allocate words across sections (funnel structure)
    const wordAllocation = {
      background: Math.floor(maxWords * 0.40), // 40% - broader context
      significance: Math.floor(maxWords * 0.20), // 20% - why it matters
      gap: Math.floor(maxWords * 0.20), // 20% - what's unknown
      objective: Math.floor(maxWords * 0.20), // 20% - what we did
    };

    // Background: General context
    sections.push(
      this.generateBackgroundParagraph(request, wordAllocation.background)
    );

    // Significance: Why this topic matters
    sections.push(
      this.generateSignificanceParagraph(request, wordAllocation.significance)
    );

    // Knowledge Gap: What remains unknown
    sections.push(
      this.generateGapParagraph(request, wordAllocation.gap)
    );

    // Study Objective: What this study aims to do
    sections.push(
      this.generateObjectiveParagraph(request, wordAllocation.objective)
    );

    // Calculate actual word counts
    for (const section of sections) {
      section.wordCount = section.content.split(/\s+/).length;
      section.paragraphCount = section.content.split(/\n\n/).filter(p => p.trim().length > 0).length;
    }

    return sections;
  }

  // ========== Section Generators ==========

  /**
   * Background: General context and epidemiology
   */
  private generateBackgroundParagraph(
    request: IntroductionBuilderRequest,
    maxWords: number
  ): IntroductionSection {
    let content = '';

    if (request.background?.context && request.background.context.length > 0) {
      content = request.background.context.join(' ');
    } else {
      content = `${request.topic} is an important [clinical/research] topic affecting [population]. [Provide epidemiological data, prevalence, incidence, or burden of disease.] [1,2]`;
    }

    return {
      type: 'background',
      content,
      wordCount: 0, // Will be calculated
      paragraphCount: 0,
      citationPlaceholders: ['[1,2]'],
    };
  }

  /**
   * Significance: Why this topic matters clinically or scientifically
   */
  private generateSignificanceParagraph(
    request: IntroductionBuilderRequest,
    maxWords: number
  ): IntroductionSection {
    let content = '';

    if (request.background?.significance && request.background.significance.length > 0) {
      content = request.background.significance.join(' ');
    } else {
      content = `Understanding ${request.topic} is critical because [clinical significance, public health impact, or scientific importance]. [Describe consequences or implications.] Prior studies have demonstrated [what is currently known]. [3,4]`;
    }

    return {
      type: 'significance',
      content,
      wordCount: 0,
      paragraphCount: 0,
      citationPlaceholders: ['[3,4]'],
    };
  }

  /**
   * Knowledge Gap: What remains unknown or unclear
   */
  private generateGapParagraph(
    request: IntroductionBuilderRequest,
    maxWords: number
  ): IntroductionSection {
    let content = '';

    if (request.gap) {
      content = `However, ${request.gap.what} remains poorly understood. ${request.gap.why} [Explain why this gap exists and why it matters.] Addressing this gap is important because [clinical or research implications].`;
    } else {
      content = `However, [specific aspect of ${request.topic}] remains poorly understood. [Explain what is unknown and why it matters.] No prior studies have examined [specific gap]. [5]`;
    }

    return {
      type: 'gap',
      content,
      wordCount: 0,
      paragraphCount: 0,
      citationPlaceholders: ['[5]'],
    };
  }

  /**
   * Study Objective: What this study aims to accomplish
   */
  private generateObjectiveParagraph(
    request: IntroductionBuilderRequest,
    maxWords: number
  ): IntroductionSection {
    let content = '';

    if (request.studyObjective) {
      content = `Therefore, we aimed to ${request.studyObjective}. `;
    } else {
      content = `Therefore, we aimed to [specific, measurable objective related to the gap]. `;
    }

    if (request.researchQuestion) {
      content += `Specifically, we sought to answer the question: "${request.researchQuestion}"`;
    } else {
      content += `We hypothesized that [specific hypothesis if applicable].`;
    }

    return {
      type: 'objective',
      content,
      wordCount: 0,
      paragraphCount: 0,
      citationPlaceholders: [],
    };
  }

  // ========== Assembly & Formatting ==========

  /**
   * Assemble sections into cohesive text
   */
  private assembleSections(sections: IntroductionSection[]): string {
    // For standard introduction, combine all sections into flowing paragraphs
    return sections.map(s => s.content).join('\n\n');
  }

  /**
   * Build introduction from outline/bullets
   */
  async buildFromOutline(
    manuscriptId: string,
    outline: string[]
  ): Promise<GeneratedIntroduction> {
    // Convert bullet points to prose paragraphs
    const sections: IntroductionSection[] = outline.map((bullet, index) => {
      // Expand each bullet into a paragraph
      const content = this.expandBulletToParagraph(bullet);

      return {
        type: index === outline.length - 1 ? 'objective' : 'background',
        content,
        wordCount: content.split(/\s+/).length,
        paragraphCount: 1,
      };
    });

    const fullText = sections.map(s => s.content).join('\n\n');

    return {
      manuscriptId,
      sections,
      fullText,
      wordCount: fullText.split(/\s+/).length,
      citationCount: 0,
      structure: 'funnel',
      warnings: [],
      suggestions: [],
      createdAt: new Date(),
    };
  }

  /**
   * Expand a bullet point into a full paragraph
   */
  private expandBulletToParagraph(bullet: string): string {
    // In production, use AI to expand
    // For now, simple template
    return `${bullet} [Expand this point with supporting details and evidence. Add 2-3 more sentences to develop the idea fully. Include citations where appropriate.]`;
  }

  // ========== Quality Checks ==========

  /**
   * Check introduction quality and completeness
   */
  private checkIntroductionQuality(sections: IntroductionSection[], maxWords: number): string[] {
    const warnings: string[] = [];

    const totalWords = sections.reduce((sum, s) => sum + s.wordCount, 0);

    if (totalWords > maxWords) {
      warnings.push(`Introduction exceeds word limit: ${totalWords}/${maxWords} words`);
    }

    if (totalWords < maxWords * 0.5) {
      warnings.push(`Introduction may be too brief: ${totalWords}/${maxWords} words`);
    }

    // Check structure
    const hasBackground = sections.some(s => s.type === 'background');
    const hasGap = sections.some(s => s.type === 'gap');
    const hasObjective = sections.some(s => s.type === 'objective');

    if (!hasBackground) {
      warnings.push('Introduction missing background/context section');
    }

    if (!hasGap) {
      warnings.push('Introduction missing knowledge gap section');
    }

    if (!hasObjective) {
      warnings.push('Introduction missing study objective');
    }

    // Check for placeholders
    const fullText = sections.map(s => s.content).join(' ');
    if (fullText.includes('[') || fullText.includes(']')) {
      warnings.push('Introduction contains placeholders that need to be filled in');
    }

    // Check paragraph lengths
    for (const section of sections) {
      if (section.wordCount > 250) {
        warnings.push(`${section.type} section may be too long (${section.wordCount} words). Consider splitting into multiple paragraphs.`);
      }
    }

    return warnings;
  }

  /**
   * Generate suggestions for improvement
   */
  private generateSuggestions(sections: IntroductionSection[]): string[] {
    const suggestions: string[] = [];

    // Check funnel structure
    const wordCounts = sections.map(s => s.wordCount);
    if (wordCounts.length >= 2) {
      const firstHalf = wordCounts.slice(0, Math.ceil(wordCounts.length / 2)).reduce((a, b) => a + b, 0);
      const secondHalf = wordCounts.slice(Math.ceil(wordCounts.length / 2)).reduce((a, b) => a + b, 0);

      if (secondHalf > firstHalf * 1.5) {
        suggestions.push('Consider shortening later sections to maintain funnel structure (general → specific)');
      }
    }

    // Check citation distribution
    const totalCitationPlaceholders = sections.reduce(
      (sum, s) => sum + (s.citationPlaceholders?.length || 0),
      0
    );

    if (totalCitationPlaceholders < 5) {
      suggestions.push('Add more citations to support background and significance claims');
    }

    // Check for transition words
    const fullText = sections.map(s => s.content).join(' ');
    const hasTransitions = /however|therefore|thus|consequently|in contrast|nevertheless/.test(fullText.toLowerCase());

    if (!hasTransitions) {
      suggestions.push('Add transition words (however, therefore, thus) to improve flow between sections');
    }

    return suggestions;
  }

  /**
   * Suggest citations based on content
   */
  async suggestCitations(content: string, topic: string): Promise<string[]> {
    // In production, use literature search to find relevant citations
    // For now, return placeholder
    return [
      'Search PubMed for epidemiology of [topic]',
      'Search for recent reviews on [topic]',
      'Find seminal studies establishing [concept]',
    ];
  }
}

export const introductionBuilderService = new IntroductionBuilderService();
