/**
 * Citation Formatter Service
 * Task T38: Format citations in AMA, APA, Vancouver, and other styles
 */

import type { Citation } from '../types/citation.types';

export type CitationFormat = 'ama' | 'apa' | 'vancouver' | 'chicago' | 'mla' | 'nature' | 'ieee';

export interface FormattedCitation {
  citationId: string;
  format: CitationFormat;
  text: string;
  inText: string; // In-text citation format (e.g., "[1]" or "(Smith, 2023)")
  bibliography: string; // Full bibliographic entry
}

/**
 * Citation Formatter Service
 * Formats citations according to major academic styles
 */
export class CitationFormatterService {
  /**
   * Format a citation in the specified style
   */
  format(citation: Citation, format: CitationFormat): FormattedCitation {
    const bibliography = this.formatBibliography(citation, format);
    const inText = this.formatInText(citation, format);

    return {
      citationId: citation.id,
      format,
      text: bibliography,
      inText,
      bibliography,
    };
  }

  /**
   * Format multiple citations
   */
  formatMultiple(citations: Citation[], format: CitationFormat): FormattedCitation[] {
    return citations.map(c => this.format(c, format));
  }

  /**
   * Generate bibliography entry
   */
  private formatBibliography(citation: Citation, format: CitationFormat): string {
    switch (format) {
      case 'ama':
        return this.formatAMA(citation);
      case 'apa':
        return this.formatAPA(citation);
      case 'vancouver':
        return this.formatVancouver(citation);
      case 'chicago':
        return this.formatChicago(citation);
      case 'mla':
        return this.formatMLA(citation);
      case 'nature':
        return this.formatNature(citation);
      case 'ieee':
        return this.formatIEEE(citation);
    }
  }

  /**
   * Generate in-text citation
   */
  private formatInText(citation: Citation, format: CitationFormat): string {
    switch (format) {
      case 'ama':
      case 'vancouver':
      case 'nature':
      case 'ieee':
        // Numbered styles - in production, would get actual number from citation list
        return '[1]';

      case 'apa':
      case 'chicago':
      case 'mla':
        // Author-year styles
        const authors = this.formatAuthorsShort(citation.authors);
        return `(${authors}, ${citation.year})`;
    }
  }

  // ========== AMA (American Medical Association) Style ==========
  private formatAMA(citation: Citation): string {
    const authors = this.formatAuthorsAMA(citation.authors);
    const title = citation.title;
    const journal = citation.journal ? `*${citation.journal}*. ` : '';
    const year = citation.year;
    const volume = citation.volume || '';
    const issue = citation.issue ? `(${citation.issue})` : '';
    const pages = citation.pages ? `:${citation.pages}` : '';
    const doi = citation.doi ? ` doi:${citation.doi}` : '';

    return `${authors}. ${title}. ${journal}${year};${volume}${issue}${pages}.${doi}`;
  }

  private formatAuthorsAMA(authors: Citation['authors']): string {
    if (authors.length === 0) return 'Unknown';

    const formatted = authors.map(a => {
      const initials = a.initials || (a.firstName ? a.firstName[0] : '');
      return `${a.lastName} ${initials}`;
    });

    if (formatted.length <= 6) {
      return formatted.join(', ');
    }

    // >6 authors: list first 3, then "et al"
    return formatted.slice(0, 3).join(', ') + ', et al';
  }

  // ========== APA (American Psychological Association) Style ==========
  private formatAPA(citation: Citation): string {
    const authors = this.formatAuthorsAPA(citation.authors);
    const year = citation.year;
    const title = citation.title;
    const journal = citation.journal ? `*${citation.journal}*` : '';
    const volume = citation.volume ? `, *${citation.volume}*` : '';
    const issue = citation.issue ? `(${citation.issue})` : '';
    const pages = citation.pages ? `, ${citation.pages}` : '';
    const doi = citation.doi ? `. https://doi.org/${citation.doi}` : '';

    return `${authors} (${year}). ${title}. ${journal}${volume}${issue}${pages}${doi}`;
  }

  private formatAuthorsAPA(authors: Citation['authors']): string {
    if (authors.length === 0) return 'Unknown';

    const formatted = authors.map(a => {
      const initials = a.initials || (a.firstName ? a.firstName[0] : '');
      return `${a.lastName}, ${initials}.`;
    });

    if (formatted.length === 1) {
      return formatted[0];
    } else if (formatted.length === 2) {
      return `${formatted[0]} & ${formatted[1]}`;
    } else if (formatted.length <= 20) {
      const last = formatted[formatted.length - 1];
      const rest = formatted.slice(0, -1).join(', ');
      return `${rest}, & ${last}`;
    } else {
      // >20 authors: list first 19, ellipsis, then last
      const first19 = formatted.slice(0, 19).join(', ');
      const last = formatted[formatted.length - 1];
      return `${first19}, ... ${last}`;
    }
  }

  // ========== Vancouver Style ==========
  private formatVancouver(citation: Citation): string {
    const authors = this.formatAuthorsVancouver(citation.authors);
    const title = citation.title;
    const journal = citation.journal || '';
    const year = citation.year;
    const volume = citation.volume || '';
    const issue = citation.issue ? `(${citation.issue})` : '';
    const pages = citation.pages ? `:${citation.pages}` : '';

    return `${authors}. ${title}. ${journal}. ${year};${volume}${issue}${pages}.`;
  }

  private formatAuthorsVancouver(authors: Citation['authors']): string {
    if (authors.length === 0) return 'Unknown';

    const formatted = authors.map(a => {
      const initials = a.initials || (a.firstName ? a.firstName[0] : '');
      return `${a.lastName} ${initials}`;
    });

    if (formatted.length <= 6) {
      return formatted.join(', ');
    }

    return formatted.slice(0, 6).join(', ') + ', et al';
  }

  // ========== Chicago Style ==========
  private formatChicago(citation: Citation): string {
    const authors = this.formatAuthorsChicago(citation.authors);
    const title = `"${citation.title}"`;
    const journal = citation.journal ? `*${citation.journal}*` : '';
    const volume = citation.volume ? ` ${citation.volume}` : '';
    const issue = citation.issue ? `, no. ${citation.issue}` : '';
    const year = citation.year;
    const pages = citation.pages ? `: ${citation.pages}` : '';
    const doi = citation.doi ? `. https://doi.org/${citation.doi}` : '';

    return `${authors}. ${title}. ${journal}${volume}${issue} (${year})${pages}${doi}.`;
  }

  private formatAuthorsChicago(authors: Citation['authors']): string {
    if (authors.length === 0) return 'Unknown';

    if (authors.length === 1) {
      const a = authors[0];
      const firstName = a.firstName || a.initials || '';
      return `${a.lastName}, ${firstName}`;
    } else if (authors.length === 2) {
      const a1 = authors[0];
      const a2 = authors[1];
      const firstName1 = a1.firstName || a1.initials || '';
      const firstName2 = a2.firstName || a2.initials || '';
      return `${a1.lastName}, ${firstName1}, and ${a2.lastName}, ${firstName2}`;
    } else if (authors.length <= 10) {
      const first = authors[0];
      const firstName = first.firstName || first.initials || '';
      const rest = authors.slice(1).map(a => {
        const fn = a.firstName || a.initials || '';
        return `${fn} ${a.lastName}`;
      });
      return `${first.lastName}, ${firstName}, ${rest.join(', ')}`;
    } else {
      const first = authors[0];
      const firstName = first.firstName || first.initials || '';
      return `${first.lastName}, ${firstName}, et al`;
    }
  }

  // ========== MLA Style ==========
  private formatMLA(citation: Citation): string {
    const authors = this.formatAuthorsMLA(citation.authors);
    const title = `"${citation.title}"`;
    const journal = citation.journal ? `*${citation.journal}*` : '';
    const volume = citation.volume ? `, vol. ${citation.volume}` : '';
    const issue = citation.issue ? `, no. ${citation.issue}` : '';
    const year = citation.year;
    const pages = citation.pages ? `, pp. ${citation.pages}` : '';
    const doi = citation.doi ? `. doi:${citation.doi}` : '';

    return `${authors}. ${title}. ${journal}${volume}${issue}, ${year}${pages}${doi}.`;
  }

  private formatAuthorsMLA(authors: Citation['authors']): string {
    if (authors.length === 0) return 'Unknown';

    if (authors.length === 1) {
      const a = authors[0];
      const firstName = a.firstName || a.initials || '';
      return `${a.lastName}, ${firstName}`;
    } else if (authors.length === 2) {
      const a1 = authors[0];
      const a2 = authors[1];
      const firstName1 = a1.firstName || a1.initials || '';
      const firstName2 = a2.firstName || a2.initials || '';
      return `${a1.lastName}, ${firstName1}, and ${firstName2} ${a2.lastName}`;
    } else {
      const first = authors[0];
      const firstName = first.firstName || first.initials || '';
      return `${first.lastName}, ${firstName}, et al`;
    }
  }

  // ========== Nature Style ==========
  private formatNature(citation: Citation): string {
    const authors = this.formatAuthorsNature(citation.authors);
    const title = citation.title;
    const journal = citation.journal ? `*${citation.journal}* ` : '';
    const volume = citation.volume ? `**${citation.volume}**` : '';
    const pages = citation.pages ? `, ${citation.pages}` : '';
    const year = citation.year;

    return `${authors}. ${title}. ${journal}${volume}${pages} (${year}).`;
  }

  private formatAuthorsNature(authors: Citation['authors']): string {
    if (authors.length === 0) return 'Unknown';

    const formatted = authors.map(a => {
      const initials = a.initials || (a.firstName ? a.firstName[0] : '');
      return `${a.lastName}, ${initials}.`;
    });

    return formatted.join(', ');
  }

  // ========== IEEE Style ==========
  private formatIEEE(citation: Citation): string {
    const authors = this.formatAuthorsIEEE(citation.authors);
    const title = `"${citation.title}"`;
    const journal = citation.journal ? `*${citation.journal}*` : '';
    const volume = citation.volume ? `, vol. ${citation.volume}` : '';
    const issue = citation.issue ? `, no. ${citation.issue}` : '';
    const pages = citation.pages ? `, pp. ${citation.pages}` : '';
    const year = citation.year;

    return `${authors}, ${title}, ${journal}${volume}${issue}${pages}, ${year}.`;
  }

  private formatAuthorsIEEE(authors: Citation['authors']): string {
    if (authors.length === 0) return 'Unknown';

    const formatted = authors.map(a => {
      const initials = a.initials || (a.firstName ? a.firstName[0] : '');
      return `${initials}. ${a.lastName}`;
    });

    return formatted.join(', ');
  }

  // ========== Helper Methods ==========

  private formatAuthorsShort(authors: Citation['authors']): string {
    if (authors.length === 0) return 'Unknown';
    if (authors.length === 1) return authors[0].lastName;
    if (authors.length === 2) return `${authors[0].lastName} & ${authors[1].lastName}`;
    return `${authors[0].lastName} et al.`;
  }
}

export const citationFormatterService = new CitationFormatterService();
