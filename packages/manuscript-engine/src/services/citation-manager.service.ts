/**
 * Citation Manager Service
 * Manage citations with DOI resolution and formatting
 */

import { nanoid } from 'nanoid';
import type { Citation, CitationStyle } from '../types';

/**
 * Citation Manager Service - Manage manuscript citations
 */
export class CitationManagerService {
  private static instance: CitationManagerService;
  private citations: Map<string, Citation> = new Map();

  private constructor() {}

  static getInstance(): CitationManagerService {
    if (!this.instance) {
      this.instance = new CitationManagerService();
    }
    return this.instance;
  }

  /**
   * Add citation
   */
  addCitation(citation: Omit<Citation, 'id' | 'formatted'>): Citation {
    const id = nanoid();
    const fullCitation: Citation = {
      ...citation,
      id,
      formatted: this.formatCitation(citation as Citation, 'AMA'),
    };

    this.citations.set(id, fullCitation);
    return fullCitation;
  }

  /**
   * Get citation by ID
   */
  getCitation(id: string): Citation | undefined {
    return this.citations.get(id);
  }

  /**
   * List all citations
   */
  listCitations(): Citation[] {
    return Array.from(this.citations.values());
  }

  /**
   * Format citation in specified style
   */
  formatCitation(citation: Citation, style: CitationStyle): Record<CitationStyle, string> {
    return {
      AMA: this.formatAMA(citation),
      APA: this.formatAPA(citation),
      Vancouver: this.formatVancouver(citation),
      NLM: this.formatNLM(citation),
      Chicago: this.formatChicago(citation),
    };
  }

  /**
   * Validate citation completeness
   */
  validateCitation(citation: Partial<Citation>): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!citation.title) errors.push('Title is required');
    if (!citation.authors || citation.authors.length === 0) errors.push('At least one author is required');
    if (!citation.year) errors.push('Year is required');

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Deduplicate citations
   */
  deduplicateCitations(citations: Citation[]): Citation[] {
    const seen = new Set<string>();
    const unique: Citation[] = [];

    for (const citation of citations) {
      const key = `${citation.title}-${citation.year}-${citation.authors[0]}`;
      if (!seen.has(key)) {
        seen.add(key);
        unique.push(citation);
      }
    }

    return unique;
  }

  /**
   * Format in AMA style
   */
  private formatAMA(citation: Citation): string {
    const authors = this.formatAuthorsAMA(citation.authors);
    let formatted = `${authors}. ${citation.title}.`;

    if (citation.journal) {
      formatted += ` ${citation.journal}.`;
    }

    formatted += ` ${citation.year}`;

    if (citation.volume) {
      formatted += `;${citation.volume}`;
    }

    if (citation.issue) {
      formatted += `(${citation.issue})`;
    }

    if (citation.pages) {
      formatted += `:${citation.pages}`;
    }

    formatted += '.';

    if (citation.doi) {
      formatted += ` doi:${citation.doi}`;
    }

    return formatted;
  }

  /**
   * Format in APA style
   */
  private formatAPA(citation: Citation): string {
    const authors = this.formatAuthorsAPA(citation.authors);
    let formatted = `${authors} (${citation.year}). ${citation.title}.`;

    if (citation.journal) {
      formatted += ` ${citation.journal}`;
      if (citation.volume) {
        formatted += `, ${citation.volume}`;
      }
      if (citation.issue) {
        formatted += `(${citation.issue})`;
      }
      if (citation.pages) {
        formatted += `, ${citation.pages}`;
      }
      formatted += '.';
    }

    if (citation.doi) {
      formatted += ` https://doi.org/${citation.doi}`;
    }

    return formatted;
  }

  /**
   * Format in Vancouver style
   */
  private formatVancouver(citation: Citation): string {
    const authors = this.formatAuthorsVancouver(citation.authors);
    let formatted = `${authors}. ${citation.title}.`;

    if (citation.journal) {
      formatted += ` ${this.abbreviateJournal(citation.journal)}.`;
    }

    formatted += ` ${citation.year}`;

    if (citation.volume) {
      formatted += `;${citation.volume}`;
    }

    if (citation.issue) {
      formatted += `(${citation.issue})`;
    }

    if (citation.pages) {
      formatted += `:${citation.pages}`;
    }

    formatted += '.';

    return formatted;
  }

  /**
   * Format in NLM style (similar to Vancouver)
   */
  private formatNLM(citation: Citation): string {
    return this.formatVancouver(citation);
  }

  /**
   * Format in Chicago style
   */
  private formatChicago(citation: Citation): string {
    const authors = this.formatAuthorsChicago(citation.authors);
    let formatted = `${authors}. "${citation.title}."`;

    if (citation.journal) {
      formatted += ` ${citation.journal}`;
    }

    if (citation.volume) {
      formatted += ` ${citation.volume}`;
    }

    if (citation.issue) {
      formatted += `, no. ${citation.issue}`;
    }

    formatted += ` (${citation.year})`;

    if (citation.pages) {
      formatted += `: ${citation.pages}`;
    }

    formatted += '.';

    return formatted;
  }

  /**
   * Format authors for AMA style
   */
  private formatAuthorsAMA(authors: string[]): string {
    if (authors.length === 0) return '';
    if (authors.length === 1) return authors[0];
    if (authors.length <= 6) return authors.join(', ');
    return `${authors.slice(0, 3).join(', ')}, et al`;
  }

  /**
   * Format authors for APA style
   */
  private formatAuthorsAPA(authors: string[]): string {
    if (authors.length === 0) return '';
    if (authors.length === 1) return authors[0];
    if (authors.length === 2) return `${authors[0]} & ${authors[1]}`;
    if (authors.length <= 20) {
      return `${authors.slice(0, -1).join(', ')}, & ${authors[authors.length - 1]}`;
    }
    return `${authors.slice(0, 19).join(', ')}, ... ${authors[authors.length - 1]}`;
  }

  /**
   * Format authors for Vancouver style
   */
  private formatAuthorsVancouver(authors: string[]): string {
    if (authors.length === 0) return '';
    if (authors.length <= 6) return authors.join(', ');
    return `${authors.slice(0, 6).join(', ')}, et al`;
  }

  /**
   * Format authors for Chicago style
   */
  private formatAuthorsChicago(authors: string[]): string {
    if (authors.length === 0) return '';
    if (authors.length === 1) return authors[0];
    if (authors.length === 2) return `${authors[0]} and ${authors[1]}`;
    if (authors.length === 3) return `${authors[0]}, ${authors[1]}, and ${authors[2]}`;
    return `${authors[0]} et al.`;
  }

  /**
   * Abbreviate journal name (simplified)
   */
  private abbreviateJournal(journal: string): string {
    // Simplified abbreviation - in production, use proper journal abbreviation database
    return journal
      .replace('Journal of', 'J')
      .replace('American', 'Am')
      .replace('British', 'Br')
      .replace('Medicine', 'Med')
      .replace('Surgery', 'Surg');
  }
}

/**
 * Factory function
 */
export function getCitationManager(): CitationManagerService {
  return CitationManagerService.getInstance();
}
