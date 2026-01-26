/**
 * References Builder Service
 * Task T47: Auto-compile references section
 */

import type { Citation } from '../types/citation.types';
import { citationFormatterService, type CitationFormat } from './citation-formatter.service';

export interface ReferencesBuilderRequest {
  manuscriptId: string;
  citationIds: string[];
  format: CitationFormat; // AMA, APA, Vancouver, etc.
  includeAbstracts?: boolean;
  groupBySection?: boolean;
}

export interface BuiltReferences {
  manuscriptId: string;
  format: CitationFormat;
  totalReferences: number;
  references: FormattedReference[];
  fullText: string;
  warnings: string[];
  statistics: ReferenceStatistics;
  createdAt: Date;
}

export interface FormattedReference {
  number: number;
  citationId: string;
  text: string;
  doi?: string;
  pmid?: string;
  url?: string;
  inTextOccurrences: number; // How many times cited in manuscript
}

export interface ReferenceStatistics {
  totalReferences: number;
  bySourceType: Record<string, number>; // pubmed: 10, doi: 5, etc.
  byYear: Record<string, number>; // 2023: 5, 2022: 8, etc.
  averageAge: number; // Years old
  oldestYear: number;
  newestYear: number;
}

/**
 * References Builder Service
 * Automatically compiles and formats reference list
 */
export class ReferencesBuilderService {
  /**
   * Build complete references section
   */
  async buildReferences(request: ReferencesBuilderRequest): Promise<BuiltReferences> {
    // Fetch citations
    const citations = await this.fetchCitations(request.citationIds);

    // Format each citation
    const references: FormattedReference[] = [];
    for (let i = 0; i < citations.length; i++) {
      const citation = citations[i];
      const formatted = citationFormatterService.format(citation, request.format);

      references.push({
        number: i + 1,
        citationId: citation.id,
        text: formatted.bibliography,
        doi: citation.doi,
        pmid: citation.sourceType === 'pubmed' ? citation.externalId : undefined,
        url: citation.url,
        inTextOccurrences: await this.countInTextOccurrences(request.manuscriptId, citation.id),
      });
    }

    // Generate full text
    const fullText = this.formatReferenceList(references, request.format);

    // Calculate statistics
    const statistics = this.calculateStatistics(citations);

    // Generate warnings
    const warnings = this.generateWarnings(references, citations);

    return {
      manuscriptId: request.manuscriptId,
      format: request.format,
      totalReferences: references.length,
      references,
      fullText,
      warnings,
      statistics,
      createdAt: new Date(),
    };
  }

  /**
   * Check for missing or duplicate citations
   */
  async validateReferences(manuscriptId: string, citationIds: string[]): Promise<{
    missingInText: string[]; // Citations in references but not cited in text
    missingFromReferences: string[]; // Citations in text but not in references
    duplicates: string[]; // Duplicate citations
    uncitedReferences: string[]; // References with 0 in-text occurrences
  }> {
    // In production, scan manuscript text for citation markers
    // For now, return empty arrays
    return {
      missingInText: [],
      missingFromReferences: [],
      duplicates: [],
      uncitedReferences: [],
    };
  }

  /**
   * Renumber citations after edits
   */
  async renumberCitations(manuscriptId: string): Promise<{ oldNumber: number; newNumber: number }[]> {
    // Scan manuscript text for citation order
    // Return mapping of old → new numbers
    return [];
  }

  // ========== Private Methods ==========

  private async fetchCitations(citationIds: string[]): Promise<Citation[]> {
    // In production, fetch from database
    // For now, return mock citations
    return citationIds.map((id, index) => ({
      id,
      manuscriptId: 'mock',
      sourceType: 'pubmed',
      externalId: `${12345678 + index}`,
      title: `Citation ${index + 1}`,
      authors: [{ lastName: 'Author', firstName: 'First' }],
      year: 2023 - (index % 5),
      journal: 'Journal Name',
    })) as Citation[];
  }

  private async countInTextOccurrences(manuscriptId: string, citationId: string): Promise<number> {
    // In production, scan manuscript text
    return 1; // Placeholder
  }

  private formatReferenceList(references: FormattedReference[], format: CitationFormat): string {
    switch (format) {
      case 'ama':
      case 'vancouver':
      case 'nature':
      case 'ieee':
        // Numbered format
        return references.map(ref => `${ref.number}. ${ref.text}`).join('\n\n');

      case 'apa':
      case 'chicago':
      case 'mla':
        // Alphabetical format (no numbers)
        return references.map(ref => ref.text).join('\n\n');

      default:
        return references.map(ref => `${ref.number}. ${ref.text}`).join('\n\n');
    }
  }

  private calculateStatistics(citations: Citation[]): ReferenceStatistics {
    const bySourceType: Record<string, number> = {};
    const byYear: Record<string, number> = {};
    const years: number[] = [];

    for (const citation of citations) {
      // By source type
      bySourceType[citation.sourceType] = (bySourceType[citation.sourceType] || 0) + 1;

      // By year
      const year = citation.year.toString();
      byYear[year] = (byYear[year] || 0) + 1;
      years.push(citation.year);
    }

    const currentYear = new Date().getFullYear();
    const averageAge = years.reduce((sum, year) => sum + (currentYear - year), 0) / years.length;

    return {
      totalReferences: citations.length,
      bySourceType,
      byYear,
      averageAge,
      oldestYear: Math.min(...years),
      newestYear: Math.max(...years),
    };
  }

  private generateWarnings(references: FormattedReference[], citations: Citation[]): string[] {
    const warnings: string[] = [];

    // Check for uncited references
    const uncited = references.filter(r => r.inTextOccurrences === 0);
    if (uncited.length > 0) {
      warnings.push(`${uncited.length} references are not cited in the manuscript text`);
    }

    // Check for very old references
    const currentYear = new Date().getFullYear();
    const oldReferences = citations.filter(c => currentYear - c.year > 10);
    if (oldReferences.length > citations.length * 0.5) {
      warnings.push('Over 50% of references are more than 10 years old. Consider citing more recent literature.');
    }

    // Check for missing DOIs
    const missingDOI = citations.filter(c => !c.doi);
    if (missingDOI.length > citations.length * 0.3) {
      warnings.push(`${missingDOI.length} references missing DOI. Add DOIs when available.`);
    }

    return warnings;
  }
}

export const referencesBuilderService = new ReferencesBuilderService();
