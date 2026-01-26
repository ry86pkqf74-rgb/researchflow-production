/**
 * Keyword Generator Service
 * Task T54: Generate MeSH keywords and other terms
 */

import { extractKeywords } from '../utils/keyword-extractor';

export interface KeywordGeneratorRequest {
  manuscriptId: string;
  text: string; // Title + abstract for keyword extraction
  count?: number; // Number of keywords to generate (default: 5-8)
  includeMeSH?: boolean; // Generate MeSH terms
}

export interface GeneratedKeywords {
  manuscriptId: string;
  keywords: string[];
  meshTerms?: MeSHTerm[];
  suggestions: string[];
  createdAt: Date;
}

export interface MeSHTerm {
  term: string;
  treeNumber?: string; // MeSH tree number (e.g., C04.588.274)
  scope: string; // Definition of the term
}

/**
 * Keyword Generator Service
 * Generates keywords and MeSH terms for manuscripts
 */
export class KeywordGeneratorService {
  async generateKeywords(request: KeywordGeneratorRequest): Promise<GeneratedKeywords> {
    const count = request.count || 6;

    // Extract keywords from text using utility
    const extracted = extractKeywords(request.text, {
      maxKeywords: count,
      includeMedicalTerms: true,
    });

    const keywords = extracted.map(k => k.term);

    // Generate MeSH terms if requested
    let meshTerms: MeSHTerm[] | undefined;
    if (request.includeMeSH) {
      meshTerms = await this.generateMeSHTerms(keywords);
    }

    // Generate suggestions
    const suggestions = await this.generateSuggestions(keywords, request.text);

    return {
      manuscriptId: request.manuscriptId,
      keywords,
      meshTerms,
      suggestions,
      createdAt: new Date(),
    };
  }

  private async generateMeSHTerms(keywords: string[]): Promise<MeSHTerm[]> {
    // In production, query NLM MeSH API: https://id.nlm.nih.gov/mesh/
    // For now, return mock structure
    return keywords.slice(0, 5).map(kw => ({
      term: this.formatMeSHTerm(kw),
      treeNumber: 'C04.588.274', // Mock tree number
      scope: `Medical subject heading for ${kw}`,
    }));
  }

  private formatMeSHTerm(keyword: string): string {
    // MeSH terms are typically Title Case
    return keyword
      .split(' ')
      .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join(' ');
  }

  private async generateSuggestions(keywords: string[], text: string): Promise<string[]> {
    const suggestions: string[] = [];

    // Check if study design keyword is present
    const studyDesigns = ['cohort', 'rct', 'randomized', 'trial', 'case-control', 'cross-sectional'];
    const hasStudyDesign = keywords.some(kw =>
      studyDesigns.some(design => kw.toLowerCase().includes(design))
    );

    if (!hasStudyDesign) {
      suggestions.push('Consider adding study design keyword (e.g., cohort study, RCT)');
    }

    // Check for population descriptor
    const populations = ['adult', 'child', 'elderly', 'pediatric', 'geriatric'];
    const hasPopulation = keywords.some(kw =>
      populations.some(pop => kw.toLowerCase().includes(pop))
    );

    if (!hasPopulation) {
      suggestions.push('Consider adding population descriptor (e.g., adults, elderly)');
    }

    // Check for outcome keywords
    if (!keywords.some(kw => kw.toLowerCase().includes('outcome') || kw.toLowerCase().includes('mortality'))) {
      suggestions.push('Consider including primary outcome in keywords');
    }

    // Suggest more specific terms if too general
    const generalTerms = ['disease', 'treatment', 'health', 'patient'];
    const hasGeneralTerms = keywords.filter(kw =>
      generalTerms.some(gen => kw.toLowerCase() === gen)
    );

    if (hasGeneralTerms.length > 2) {
      suggestions.push('Use more specific medical terminology instead of general terms');
    }

    return suggestions;
  }

  /**
   * Suggest keywords based on manuscript content
   */
  async suggestFromContent(manuscriptId: string, sections: Record<string, string>): Promise<string[]> {
    // Combine all sections
    const fullText = Object.values(sections).join(' ');

    // Extract keywords
    const extracted = extractKeywords(fullText, {
      maxKeywords: 10,
      includeMedicalTerms: true,
    });

    return extracted.map(k => k.term);
  }

  /**
   * Validate keywords against journal requirements
   */
  validateKeywords(keywords: string[], journalId?: string): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Check count (most journals require 3-8 keywords)
    if (keywords.length < 3) {
      errors.push('At least 3 keywords are typically required');
    }

    if (keywords.length > 10) {
      errors.push('Most journals limit keywords to 8-10');
    }

    // Check for overly general terms
    const tooGeneral = ['medicine', 'health', 'science', 'research', 'study'];
    const generalFound = keywords.filter(kw => tooGeneral.includes(kw.toLowerCase()));

    if (generalFound.length > 0) {
      errors.push(`Avoid overly general terms: ${generalFound.join(', ')}`);
    }

    // Check for abbreviations (should be avoided)
    const hasAbbreviations = keywords.some(kw => /^[A-Z]{2,}$/.test(kw));
    if (hasAbbreviations) {
      errors.push('Avoid abbreviations in keywords; spell out terms');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }
}

export const keywordGeneratorService = new KeywordGeneratorService();
