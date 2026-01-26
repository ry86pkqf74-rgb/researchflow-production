/**
 * Abstract Generator Service
 * Task T42: Generate structured abstracts from manuscript data
 */

export interface AbstractGeneratorRequest {
  manuscriptId: string;
  style: 'structured' | 'unstructured' | 'journal_specific';
  journalTemplate?: string; // e.g., 'nejm', 'jama'
  autofill?: {
    studyDesign?: string;
    sampleSize?: number;
    primaryOutcome?: string;
    mainFinding?: string;
  };
  maxWords?: number;
}

export interface GeneratedAbstract {
  manuscriptId: string;
  style: 'structured' | 'unstructured' | 'journal_specific';
  sections: AbstractSection[];
  wordCount: number;
  text: string; // Full abstract as single string
  warnings: string[];
  createdAt: Date;
}

export interface AbstractSection {
  heading: 'background' | 'methods' | 'results' | 'conclusions' | 'objective';
  content: string;
  wordCount: number;
  suggestions?: string[];
}

/**
 * Abstract Generator Service
 * Generates structured abstracts following journal guidelines
 */
export class AbstractGeneratorService {
  /**
   * Generate an abstract from manuscript data and user input
   */
  async generateAbstract(request: AbstractGeneratorRequest): Promise<GeneratedAbstract> {
    const maxWords = request.maxWords || 300;

    let sections: AbstractSection[];

    switch (request.style) {
      case 'structured':
        sections = await this.generateStructuredAbstract(request, maxWords);
        break;
      case 'unstructured':
        sections = await this.generateUnstructuredAbstract(request, maxWords);
        break;
      case 'journal_specific':
        sections = await this.generateJournalSpecificAbstract(request, maxWords);
        break;
    }

    const text = this.formatAbstractText(sections, request.style);
    const wordCount = text.split(/\s+/).length;
    const warnings = this.checkAbstractQuality(sections, maxWords);

    return {
      manuscriptId: request.manuscriptId,
      style: request.style,
      sections,
      wordCount,
      text,
      warnings,
      createdAt: new Date(),
    };
  }

  /**
   * Generate structured abstract (Background, Methods, Results, Conclusions)
   */
  private async generateStructuredAbstract(
    request: AbstractGeneratorRequest,
    maxWords: number
  ): Promise<AbstractSection[]> {
    // Allocate words across sections (typical distribution)
    const wordAllocation = {
      background: Math.floor(maxWords * 0.20), // 20%
      methods: Math.floor(maxWords * 0.25), // 25%
      results: Math.floor(maxWords * 0.35), // 35%
      conclusions: Math.floor(maxWords * 0.20), // 20%
    };

    const sections: AbstractSection[] = [];

    // Background section
    sections.push({
      heading: 'background',
      content: this.generateBackgroundSection(request, wordAllocation.background),
      wordCount: 0, // Will be calculated
      suggestions: ['State the clinical problem and why it matters'],
    });

    // Methods section
    sections.push({
      heading: 'methods',
      content: this.generateMethodsSection(request, wordAllocation.methods),
      wordCount: 0,
      suggestions: ['Include study design, setting, sample size, and main interventions'],
    });

    // Results section
    sections.push({
      heading: 'results',
      content: this.generateResultsSection(request, wordAllocation.results),
      wordCount: 0,
      suggestions: ['Report specific numbers with confidence intervals and p-values'],
    });

    // Conclusions section
    sections.push({
      heading: 'conclusions',
      content: this.generateConclusionsSection(request, wordAllocation.conclusions),
      wordCount: 0,
      suggestions: ['State main finding and its implications. Avoid overstating results.'],
    });

    // Calculate word counts
    for (const section of sections) {
      section.wordCount = section.content.split(/\s+/).length;
    }

    return sections;
  }

  /**
   * Generate unstructured (narrative) abstract
   */
  private async generateUnstructuredAbstract(
    request: AbstractGeneratorRequest,
    maxWords: number
  ): Promise<AbstractSection[]> {
    // Single narrative section combining all elements
    const content = this.generateNarrativeAbstract(request, maxWords);

    return [
      {
        heading: 'background', // Use background as default heading
        content,
        wordCount: content.split(/\s+/).length,
        suggestions: [
          'Narrative abstracts should flow smoothly from context to findings to implications',
        ],
      },
    ];
  }

  /**
   * Generate journal-specific abstract
   */
  private async generateJournalSpecificAbstract(
    request: AbstractGeneratorRequest,
    maxWords: number
  ): Promise<AbstractSection[]> {
    // Different journals have different requirements
    switch (request.journalTemplate) {
      case 'nejm':
        return this.generateNEJMAbstract(request, 250); // NEJM: 250 words max
      case 'jama':
        return this.generateJAMAAbstract(request, 350); // JAMA: 350 words max
      case 'lancet':
        return this.generateLancetAbstract(request, 300); // Lancet: 300 words max
      default:
        return this.generateStructuredAbstract(request, maxWords);
    }
  }

  // ========== Section Generators ==========

  private generateBackgroundSection(request: AbstractGeneratorRequest, maxWords: number): string {
    // In production, this would use AI or templates
    // For now, generate placeholder with autofill data
    const autofill = request.autofill;

    return `[Background: Describe the clinical or research problem. Context and significance. Why this study was needed.]`;
  }

  private generateMethodsSection(request: AbstractGeneratorRequest, maxWords: number): string {
    const autofill = request.autofill;

    let content = '';

    if (autofill?.studyDesign) {
      content += `We conducted a ${autofill.studyDesign}`;
    } else {
      content += `[Study design]`;
    }

    if (autofill?.sampleSize) {
      content += ` with ${autofill.sampleSize} participants.`;
    } else {
      content += ` with [N] participants.`;
    }

    if (autofill?.primaryOutcome) {
      content += ` The primary outcome was ${autofill.primaryOutcome}.`;
    } else {
      content += ` The primary outcome was [outcome].`;
    }

    content += ` [Statistical methods used.]`;

    return content;
  }

  private generateResultsSection(request: AbstractGeneratorRequest, maxWords: number): string {
    const autofill = request.autofill;

    if (autofill?.mainFinding) {
      return `${autofill.mainFinding} [Include specific numbers, percentages, confidence intervals, and p-values.]`;
    }

    return `[Primary outcome]: [Intervention group] vs [Control group]: [Statistic] (95% CI [X-Y], p=[value]). [Secondary outcomes and adverse events.]`;
  }

  private generateConclusionsSection(request: AbstractGeneratorRequest, maxWords: number): string {
    return `[State main finding concisely. Clinical or research implications. Limitations if space permits.]`;
  }

  private generateNarrativeAbstract(request: AbstractGeneratorRequest, maxWords: number): string {
    return `[Narrative abstract combining background, methods, results, and conclusions in a flowing paragraph. Include key findings with statistics. End with main takeaway.]`;
  }

  // ========== Journal-Specific Generators ==========

  private generateNEJMAbstract(request: AbstractGeneratorRequest, maxWords: number): Promise<AbstractSection[]> {
    // NEJM uses Background, Methods, Results, Conclusions format
    // More concise than standard
    return this.generateStructuredAbstract(request, maxWords);
  }

  private generateJAMAAbstract(request: AbstractGeneratorRequest, maxWords: number): Promise<AbstractSection[]> {
    // JAMA uses Importance, Objective, Design/Setting/Participants, Exposures, Main Outcomes, Results, Conclusions
    const sections: AbstractSection[] = [
      {
        heading: 'objective',
        content: '[What question did this study address?]',
        wordCount: 0,
        suggestions: ['Start with "To determine..." or "To compare..."'],
      },
      {
        heading: 'background',
        content: '[Why is this study important?]',
        wordCount: 0,
        suggestions: ['1-2 sentences on significance'],
      },
      {
        heading: 'methods',
        content: this.generateMethodsSection(request, Math.floor(maxWords * 0.3)),
        wordCount: 0,
      },
      {
        heading: 'results',
        content: this.generateResultsSection(request, Math.floor(maxWords * 0.35)),
        wordCount: 0,
      },
      {
        heading: 'conclusions',
        content: this.generateConclusionsSection(request, Math.floor(maxWords * 0.20)),
        wordCount: 0,
      },
    ];

    for (const section of sections) {
      section.wordCount = section.content.split(/\s+/).length;
    }

    return Promise.resolve(sections);
  }

  private generateLancetAbstract(request: AbstractGeneratorRequest, maxWords: number): Promise<AbstractSection[]> {
    // Lancet uses Background, Methods, Findings, Interpretation
    const sections: AbstractSection[] = [
      {
        heading: 'background',
        content: this.generateBackgroundSection(request, Math.floor(maxWords * 0.20)),
        wordCount: 0,
      },
      {
        heading: 'methods',
        content: this.generateMethodsSection(request, Math.floor(maxWords * 0.25)),
        wordCount: 0,
      },
      {
        heading: 'results',
        content: this.generateResultsSection(request, Math.floor(maxWords * 0.35)),
        wordCount: 0,
      },
      {
        heading: 'conclusions',
        content: `${this.generateConclusionsSection(request, Math.floor(maxWords * 0.20))} [Funding source.]`,
        wordCount: 0,
        suggestions: ['Lancet requires funding source statement in abstract'],
      },
    ];

    for (const section of sections) {
      section.wordCount = section.content.split(/\s+/).length;
    }

    return Promise.resolve(sections);
  }

  // ========== Formatting ==========

  private formatAbstractText(sections: AbstractSection[], style: 'structured' | 'unstructured' | 'journal_specific'): string {
    if (style === 'unstructured') {
      return sections[0].content;
    }

    // Structured format with headings
    return sections
      .map(section => {
        const heading = this.capitalizeFirstLetter(section.heading);
        return `${heading}: ${section.content}`;
      })
      .join('\n\n');
  }

  private capitalizeFirstLetter(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  // ========== Quality Checks ==========

  private checkAbstractQuality(sections: AbstractSection[], maxWords: number): string[] {
    const warnings: string[] = [];

    const totalWords = sections.reduce((sum, s) => sum + s.wordCount, 0);

    if (totalWords > maxWords) {
      warnings.push(`Abstract exceeds word limit: ${totalWords}/${maxWords} words`);
    }

    if (totalWords < maxWords * 0.7) {
      warnings.push(`Abstract may be too short: ${totalWords}/${maxWords} words`);
    }

    // Check for placeholders
    const fullText = sections.map(s => s.content).join(' ');
    if (fullText.includes('[') || fullText.includes(']')) {
      warnings.push('Abstract contains placeholders that need to be filled in');
    }

    // Check for abbreviations (should be avoided in abstracts)
    const abbreviationPattern = /\b[A-Z]{2,}\b/g;
    const abbreviations = fullText.match(abbreviationPattern);
    if (abbreviations && abbreviations.length > 2) {
      warnings.push('Minimize abbreviations in abstracts (found ' + abbreviations.length + ')');
    }

    return warnings;
  }

  /**
   * Extract abstract from existing manuscript text
   */
  async extractAbstractFromManuscript(manuscriptText: string): Promise<GeneratedAbstract> {
    // In production, use NLP to extract existing abstract
    // For now, return placeholder
    return {
      manuscriptId: 'unknown',
      style: 'structured',
      sections: [],
      wordCount: 0,
      text: '',
      warnings: ['Abstract extraction not yet implemented'],
      createdAt: new Date(),
    };
  }
}

export const abstractGeneratorService = new AbstractGeneratorService();
