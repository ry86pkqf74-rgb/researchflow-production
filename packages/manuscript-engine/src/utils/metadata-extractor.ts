export interface AuthorMetadata {
  firstName: string;
  lastName: string;
  email: string;
  orcid?: string;
  affiliations: string[];
  isCorresponding: boolean;
}

export interface InstitutionMetadata {
  name: string;
  department?: string;
  city: string;
  country: string;
}

export interface StudyMetadata {
  title: string;
  studyType: string;
  registrationNumber?: string;
  ethicsApproval?: string;
  fundingSources?: string[];
  keywords: string[];
}

export class MetadataExtractor {
  extractAuthors(input: string): AuthorMetadata[] {
    // Parse author string format: "LastName FM1, LastName2 FM2"
    const authors: AuthorMetadata[] = [];
    const authorEntries = input.split(/,\s*/);

    for (const entry of authorEntries) {
      const match = entry.match(/^(.+?)\s+([A-Z]{1,3})$/);
      if (match) {
        const [, lastName, initials] = match;
        authors.push({
          firstName: initials,
          lastName: lastName.trim(),
          email: '',
          affiliations: [],
          isCorresponding: false
        });
      }
    }

    return authors;
  }

  validateORCID(orcid: string): boolean {
    // ORCID format: 0000-0002-1825-0097
    const orcidPattern = /^\d{4}-\d{4}-\d{4}-\d{3}[\dX]$/;
    return orcidPattern.test(orcid);
  }

  parseAffiliation(affiliation: string): InstitutionMetadata | null {
    // Very basic parsing - in production would use NLP
    const parts = affiliation.split(',').map(p => p.trim());
    if (parts.length < 2) return null;

    return {
      name: parts[0],
      department: parts.length > 3 ? parts[1] : undefined,
      city: parts[parts.length - 2],
      country: parts[parts.length - 1]
    };
  }

  extractStudyMetadata(manuscript: {
    title: string;
    content: Record<string, string>;
  }): StudyMetadata {
    const methods = manuscript.content['methods'] || '';

    return {
      title: manuscript.title,
      studyType: this.detectStudyType(methods),
      registrationNumber: this.extractRegistrationNumber(methods),
      ethicsApproval: this.extractEthicsApproval(methods),
      fundingSources: this.extractFunding(manuscript.content['acknowledgments'] || ''),
      keywords: []
    };
  }

  private detectStudyType(methods: string): string {
    const types = [
      { pattern: /randomized controlled trial|rct/i, type: 'RCT' },
      { pattern: /cohort study/i, type: 'Cohort' },
      { pattern: /case-control/i, type: 'Case-Control' },
      { pattern: /cross-sectional/i, type: 'Cross-Sectional' },
      { pattern: /systematic review/i, type: 'Systematic Review' },
      { pattern: /meta-analysis/i, type: 'Meta-Analysis' }
    ];

    for (const { pattern, type } of types) {
      if (pattern.test(methods)) return type;
    }

    return 'Observational';
  }

  private extractRegistrationNumber(text: string): string | undefined {
    const match = text.match(/NCT\d{8}|ISRCTN\d{8}/);
    return match ? match[0] : undefined;
  }

  private extractEthicsApproval(text: string): string | undefined {
    const match = text.match(/IRB[^\s,.]*/i);
    return match ? match[0] : undefined;
  }

  private extractFunding(text: string): string[] | undefined {
    // Simple pattern matching - in production would be more sophisticated
    const sources: string[] = [];
    const patterns = [
      /NIH\s+grant\s+[\w-]+/gi,
      /NSF\s+grant\s+[\w-]+/gi,
      /funded by\s+([^.]+)/gi
    ];

    for (const pattern of patterns) {
      const matches = text.matchAll(pattern);
      for (const match of matches) {
        sources.push(match[0]);
      }
    }

    return sources.length > 0 ? sources : undefined;
  }
}

export const metadataExtractor = new MetadataExtractor();
