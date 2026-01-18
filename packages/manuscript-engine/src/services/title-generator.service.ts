/**
 * Title Generator Service
 * Task T57: Generate title options for manuscripts
 */

export interface TitleGeneratorRequest {
  manuscriptId: string;
  mainFinding: string;
  studyDesign: string;
  population?: string;
  intervention?: string;
  style?: 'declarative' | 'descriptive' | 'question';
  maxLength?: number; // Character limit
}

export interface GeneratedTitles {
  manuscriptId: string;
  titles: TitleOption[];
  recommendations: string[];
  createdAt: Date;
}

export interface TitleOption {
  text: string;
  length: number;
  wordCount: number;
  style: 'declarative' | 'descriptive' | 'question';
  score: number; // 0-1 quality score
  pros: string[];
  cons: string[];
}

/**
 * Title Generator Service
 * Generates title options following journal guidelines
 */
export class TitleGeneratorService {
  async generateTitles(request: TitleGeneratorRequest): Promise<GeneratedTitles> {
    const maxLength = request.maxLength || 150;
    const titles: TitleOption[] = [];

    // Generate declarative title (states main finding)
    titles.push(this.generateDeclarativeTitle(request, maxLength));

    // Generate descriptive title (describes study)
    titles.push(this.generateDescriptiveTitle(request, maxLength));

    // Generate question format
    titles.push(this.generateQuestionTitle(request, maxLength));

    // Generate variations
    titles.push(...this.generateVariations(request, maxLength));

    // Sort by score
    titles.sort((a, b) => b.score - a.score);

    const recommendations = this.generateRecommendations(titles);

    return {
      manuscriptId: request.manuscriptId,
      titles: titles.slice(0, 5), // Return top 5
      recommendations,
      createdAt: new Date(),
    };
  }

  private generateDeclarativeTitle(request: TitleGeneratorRequest, maxLength: number): TitleOption {
    // Declarative: States the main finding
    const title = `${request.mainFinding} in ${request.population || 'Patients'}: ${request.studyDesign}`;

    return this.evaluateTitle(title, 'declarative', maxLength);
  }

  private generateDescriptiveTitle(request: TitleGeneratorRequest, maxLength: number): TitleOption {
    // Descriptive: Describes what was studied
    let title: string;

    if (request.intervention) {
      title = `${request.intervention} for ${request.population || 'Patients'}: A ${request.studyDesign}`;
    } else {
      title = `${request.studyDesign} of ${request.mainFinding} in ${request.population || 'Patients'}`;
    }

    return this.evaluateTitle(title, 'descriptive', maxLength);
  }

  private generateQuestionTitle(request: TitleGeneratorRequest, maxLength: number): TitleOption {
    // Question format
    let title: string;

    if (request.intervention) {
      title = `Does ${request.intervention} Improve Outcomes in ${request.population || 'Patients'}?`;
    } else {
      title = `What is the Effect of ${request.mainFinding}?`;
    }

    return this.evaluateTitle(title, 'question', maxLength);
  }

  private generateVariations(request: TitleGeneratorRequest, maxLength: number): TitleOption[] {
    const variations: TitleOption[] = [];

    // Short declarative
    const shortTitle = `${request.mainFinding} in ${request.population || 'Patients'}`;
    variations.push(this.evaluateTitle(shortTitle, 'declarative', maxLength));

    // With colon structure
    if (request.intervention) {
      const colonTitle = `${request.intervention}: ${request.mainFinding} in a ${request.studyDesign}`;
      variations.push(this.evaluateTitle(colonTitle, 'declarative', maxLength));
    }

    return variations;
  }

  private evaluateTitle(text: string, style: TitleOption['style'], maxLength: number): TitleOption {
    const length = text.length;
    const wordCount = text.split(/\s+/).length;

    let score = 1.0;
    const pros: string[] = [];
    const cons: string[] = [];

    // Check length
    if (length > maxLength) {
      score -= 0.3;
      cons.push(`Exceeds ${maxLength} character limit`);
    } else if (length > maxLength * 0.9) {
      score -= 0.1;
      cons.push('Near character limit');
    } else {
      pros.push('Appropriate length');
    }

    // Check word count (ideal: 10-15 words)
    if (wordCount <= 15) {
      pros.push('Concise');
    } else if (wordCount <= 20) {
      score -= 0.1;
      cons.push('Slightly long');
    } else {
      score -= 0.2;
      cons.push('Too wordy');
    }

    // Check for abbreviations (should avoid)
    if (/\b[A-Z]{2,}\b/.test(text)) {
      score -= 0.15;
      cons.push('Contains abbreviations (avoid in titles)');
    } else {
      pros.push('No abbreviations');
    }

    // Style-specific scoring
    if (style === 'declarative') {
      pros.push('States main finding (preferred by high-impact journals)');
      score += 0.1;
    } else if (style === 'question') {
      score -= 0.05;
      cons.push('Question format less common in medical journals');
    }

    // Check specificity
    if (text.includes('Patients') && !text.includes('specific population')) {
      score -= 0.05;
      cons.push('Consider specifying population more precisely');
    }

    return {
      text,
      length,
      wordCount,
      style,
      score: Math.max(0, Math.min(1, score)),
      pros,
      cons,
    };
  }

  private generateRecommendations(titles: TitleOption[]): string[] {
    const recommendations: string[] = [
      'Declarative titles (stating main finding) work best for high-impact journals (NEJM, Lancet, JAMA)',
      'Descriptive titles are safest for most journals',
      'Avoid abbreviations in titles unless universally recognized (DNA, HIV)',
      'Keep under 15 words when possible',
      'Specify population precisely (e.g., "older adults" not "patients")',
      'For RCTs, include study design in title or subtitle',
    ];

    // Check if any title has issues
    const hasLengthIssues = titles.some(t => t.cons.some(c => c.includes('character limit')));
    if (hasLengthIssues) {
      recommendations.push('Shorten title by removing unnecessary words ("study of", "analysis of", etc.)');
    }

    return recommendations;
  }

  /**
   * Suggest title improvements
   */
  suggestImprovements(title: string): string[] {
    const suggestions: string[] = [];

    // Check for common issues
    const lower = title.toLowerCase();

    if (lower.startsWith('a study of') || lower.startsWith('an analysis of')) {
      suggestions.push('Remove "A study of" or "An analysis of" - implied by context');
    }

    if (lower.includes('the effect of')) {
      suggestions.push('Consider more specific wording than "the effect of"');
    }

    if (title.split(':').length > 2) {
      suggestions.push('Avoid multiple colons; use only one to separate main title from subtitle');
    }

    if (/\?$/.test(title)) {
      suggestions.push('Question titles are less common; consider declarative format');
    }

    return suggestions;
  }
}

export const titleGeneratorService = new TitleGeneratorService();
