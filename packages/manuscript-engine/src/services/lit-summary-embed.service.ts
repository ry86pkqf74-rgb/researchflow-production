/**
 * Literature Summary Embedding Service
 * Task T33: Embed literature summaries in manuscript sections
 */

import type { Citation } from '../types/citation.types';

export interface LitSummaryEmbedRequest {
  manuscriptId: string;
  sectionId: string;
  citationIds: string[];
  summaryStyle: 'narrative' | 'comparative' | 'bulleted' | 'table';
  position: 'beginning' | 'end' | 'custom';
  customPosition?: {
    paragraphIndex: number;
    sentenceIndex: number;
  };
}

export interface EmbeddedLitSummary {
  id: string;
  manuscriptId: string;
  sectionId: string;
  content: string; // Generated summary text
  citations: Citation[];
  style: LitSummaryEmbedRequest['summaryStyle'];
  wordCount: number;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Literature Summary Embedding Service
 * Generates and embeds formatted literature summaries in manuscript sections
 */
export class LitSummaryEmbedService {
  /**
   * Embed a literature summary in a manuscript section
   */
  async embedSummary(request: LitSummaryEmbedRequest): Promise<EmbeddedLitSummary> {
    // Fetch full citation data
    const citations = await this.fetchCitations(request.citationIds);

    // Generate summary based on style
    const content = this.generateSummary(citations, request.summaryStyle);

    const embedded: EmbeddedLitSummary = {
      id: this.generateId(),
      manuscriptId: request.manuscriptId,
      sectionId: request.sectionId,
      content,
      citations,
      style: request.summaryStyle,
      wordCount: content.split(/\s+/).length,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // In production, insert into manuscript at specified position
    await this.insertIntoManuscript(embedded, request.position, request.customPosition);

    return embedded;
  }

  /**
   * Generate literature summary based on style
   */
  private generateSummary(citations: Citation[], style: LitSummaryEmbedRequest['summaryStyle']): string {
    switch (style) {
      case 'narrative':
        return this.generateNarrativeSummary(citations);
      case 'comparative':
        return this.generateComparativeSummary(citations);
      case 'bulleted':
        return this.generateBulletedSummary(citations);
      case 'table':
        return this.generateTableSummary(citations);
    }
  }

  /**
   * Narrative summary: Flowing prose describing the literature
   */
  private generateNarrativeSummary(citations: Citation[]): string {
    const paragraphs: string[] = [];

    // Group by theme/topic (simple keyword clustering)
    const groups = this.groupByTheme(citations);

    for (const [theme, cites] of Object.entries(groups)) {
      const sentences: string[] = [];

      for (const cite of cites) {
        const authorList = this.formatAuthors(cite.authors, 'short');
        const finding = cite.abstract?.split('.')[0] || 'examined this topic'; // First sentence as proxy

        sentences.push(`${authorList} (${cite.year}) ${finding}.`);
      }

      // Combine sentences into paragraph
      const intro = `Research on ${theme} has shown: `;
      paragraphs.push(intro + sentences.join(' '));
    }

    return paragraphs.join('\n\n');
  }

  /**
   * Comparative summary: Highlights similarities and differences
   */
  private generateComparativeSummary(citations: Citation[]): string {
    if (citations.length < 2) {
      return this.generateNarrativeSummary(citations);
    }

    const sections: string[] = [];

    // Identify consensus findings
    const consensus = this.findConsensusFindings(citations);
    if (consensus.length > 0) {
      sections.push('**Areas of Consensus:**\n' + consensus.map(c => `- ${c}`).join('\n'));
    }

    // Identify conflicting findings
    const conflicts = this.findConflictingFindings(citations);
    if (conflicts.length > 0) {
      sections.push('**Conflicting Evidence:**\n' + conflicts.map(c => `- ${c}`).join('\n'));
    }

    // Methodological differences
    const methodDiffs = this.summarizeMethodologicalDifferences(citations);
    if (methodDiffs) {
      sections.push('**Methodological Considerations:**\n' + methodDiffs);
    }

    return sections.join('\n\n');
  }

  /**
   * Bulleted summary: Key findings as bullet points
   */
  private generateBulletedSummary(citations: Citation[]): string {
    const bullets = citations.map(cite => {
      const authors = this.formatAuthors(cite.authors, 'short');
      const keyFinding = cite.abstract?.split('.')[0] || 'Examined this topic';

      return `- **${authors} (${cite.year})**: ${keyFinding} [${cite.id}]`;
    });

    return bullets.join('\n');
  }

  /**
   * Table summary: Tabular format for systematic comparison
   */
  private generateTableSummary(citations: Citation[]): string {
    // Generate markdown table
    const headers = ['Study', 'Year', 'Design', 'Sample Size', 'Key Finding'];
    const rows = citations.map(cite => {
      const authors = this.formatAuthors(cite.authors, 'short');
      const design = this.inferStudyDesign(cite);
      const sampleSize = this.extractSampleSize(cite);
      const keyFinding = cite.abstract?.split('.')[0]?.substring(0, 100) || 'See citation';

      return [authors, cite.year.toString(), design, sampleSize, keyFinding];
    });

    // Format as markdown table
    let table = '| ' + headers.join(' | ') + ' |\n';
    table += '| ' + headers.map(() => '---').join(' | ') + ' |\n';

    for (const row of rows) {
      table += '| ' + row.join(' | ') + ' |\n';
    }

    return table;
  }

  /**
   * Group citations by theme/topic (simple keyword clustering)
   */
  private groupByTheme(citations: Citation[]): Record<string, Citation[]> {
    const groups: Record<string, Citation[]> = {};

    for (const cite of citations) {
      // Extract potential theme from title or keywords
      const theme = cite.keywords?.[0] || this.extractThemeFromTitle(cite.title);

      if (!groups[theme]) {
        groups[theme] = [];
      }
      groups[theme].push(cite);
    }

    return groups;
  }

  private extractThemeFromTitle(title: string): string {
    // Extract key noun phrases (simple approach)
    const words = title.toLowerCase().split(/\s+/);
    const stopWords = ['the', 'a', 'an', 'of', 'in', 'on', 'for', 'with'];

    const contentWords = words.filter(w => !stopWords.includes(w) && w.length > 4);

    return contentWords.slice(0, 2).join(' ') || 'general research';
  }

  private findConsensusFindings(citations: Citation[]): string[] {
    // Simplified: Would use NLP to identify common findings
    return ['Multiple studies reported similar outcomes', 'Consistent methodology across studies'];
  }

  private findConflictingFindings(citations: Citation[]): string[] {
    // Simplified: Would analyze abstracts for contradictory language
    if (citations.length >= 3) {
      return ['Some variation in reported effect sizes', 'Differences in subgroup analyses'];
    }
    return [];
  }

  private summarizeMethodologicalDifferences(citations: Citation[]): string {
    const designs = citations.map(c => this.inferStudyDesign(c));
    const uniqueDesigns = [...new Set(designs)];

    if (uniqueDesigns.length > 1) {
      return `Studies employed diverse methodologies including ${uniqueDesigns.join(', ')}.`;
    }

    return '';
  }

  private inferStudyDesign(citation: Citation): string {
    const abstract = citation.abstract?.toLowerCase() || '';

    if (abstract.includes('randomized')) return 'RCT';
    if (abstract.includes('cohort')) return 'Cohort';
    if (abstract.includes('case-control')) return 'Case-Control';
    if (abstract.includes('meta-analysis')) return 'Meta-Analysis';
    if (abstract.includes('systematic review')) return 'Systematic Review';

    return 'Observational';
  }

  private extractSampleSize(citation: Citation): string {
    const abstract = citation.abstract || '';
    const match = abstract.match(/n\s*=\s*(\d+)/i) || abstract.match(/(\d+)\s+patients/i);

    return match ? match[1] : 'NR';
  }

  private formatAuthors(authors: Citation['authors'], style: 'short' | 'full'): string {
    if (authors.length === 0) return 'Unknown';

    if (style === 'short') {
      if (authors.length === 1) {
        return authors[0].lastName;
      } else if (authors.length === 2) {
        return `${authors[0].lastName} & ${authors[1].lastName}`;
      } else {
        return `${authors[0].lastName} et al.`;
      }
    }

    // Full
    return authors.map(a => `${a.lastName}, ${a.initials || a.firstName?.[0] || ''}`).join(', ');
  }

  private async fetchCitations(citationIds: string[]): Promise<Citation[]> {
    // In production, query database for citations
    // For now, return mock structure
    return [];
  }

  private async insertIntoManuscript(
    summary: EmbeddedLitSummary,
    position: LitSummaryEmbedRequest['position'],
    customPosition?: LitSummaryEmbedRequest['customPosition']
  ): Promise<void> {
    // In production, insert into manuscript document at specified position
    console.log(`Inserting literature summary at ${position}`);
  }

  private generateId(): string {
    return `lit-summary-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}

export const litSummaryEmbedService = new LitSummaryEmbedService();
