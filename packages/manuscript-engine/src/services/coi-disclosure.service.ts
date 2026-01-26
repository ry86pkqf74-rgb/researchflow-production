/**
 * Conflict of Interest Disclosure Service
 * Task T55: ICMJE COI disclosure generation
 */

export interface COIDisclosureRequest {
  manuscriptId: string;
  authors: AuthorCOI[];
  studyFunding?: string[];
}

export interface AuthorCOI {
  name: string;
  hasConflict: boolean;
  disclosures?: {
    financialRelationships?: string[];
    intellectualProperty?: string[];
    otherRelationships?: string[];
  };
}

export interface GeneratedCOIDisclosure {
  manuscriptId: string;
  icmjeCompliant: boolean;
  fullStatement: string;
  individualDisclosures: string[];
  fundingStatement: string;
  createdAt: Date;
}

/**
 * COI Disclosure Service
 * Generates ICMJE-compliant conflict of interest disclosures
 */
export class COIDisclosureService {
  async generateDisclosure(request: COIDisclosureRequest): Promise<GeneratedCOIDisclosure> {
    const authorsWithConflicts = request.authors.filter(a => a.hasConflict);
    const individualDisclosures: string[] = [];

    for (const author of request.authors) {
      if (author.hasConflict && author.disclosures) {
        const disclosure = this.formatIndividualDisclosure(author);
        individualDisclosures.push(disclosure);
      }
    }

    const fullStatement = this.generateFullStatement(request.authors, authorsWithConflicts);
    const fundingStatement = this.generateFundingStatement(request.studyFunding);

    return {
      manuscriptId: request.manuscriptId,
      icmjeCompliant: true,
      fullStatement: fullStatement + '\n\n' + fundingStatement,
      individualDisclosures,
      fundingStatement,
      createdAt: new Date(),
    };
  }

  private formatIndividualDisclosure(author: AuthorCOI): string {
    const parts: string[] = [author.name + ':'];

    if (author.disclosures?.financialRelationships && author.disclosures.financialRelationships.length > 0) {
      parts.push('Financial relationships: ' + author.disclosures.financialRelationships.join('; '));
    }

    if (author.disclosures?.intellectualProperty && author.disclosures.intellectualProperty.length > 0) {
      parts.push('Intellectual property: ' + author.disclosures.intellectualProperty.join('; '));
    }

    if (author.disclosures?.otherRelationships && author.disclosures.otherRelationships.length > 0) {
      parts.push('Other relationships: ' + author.disclosures.otherRelationships.join('; '));
    }

    return parts.join(' ');
  }

  private generateFullStatement(allAuthors: AuthorCOI[], withConflicts: AuthorCOI[]): string {
    if (withConflicts.length === 0) {
      return 'All authors have completed the ICMJE uniform disclosure form and declare: no support from any organisation for the submitted work; no financial relationships with any organisations that might have an interest in the submitted work in the previous three years; no other relationships or activities that could appear to have influenced the submitted work.';
    }

    const conflictNames = withConflicts.map(a => a.name).join(', ');
    return `Conflicts of Interest: ${conflictNames} report conflicts as described below. All other authors declare no conflicts of interest.`;
  }

  private generateFundingStatement(funding?: string[]): string {
    if (!funding || funding.length === 0) {
      return 'No funding was received for this work.';
    }

    return 'Funding: This work was supported by ' + funding.join('; ') + '.';
  }

  /**
   * Generate ICMJE-compliant COI form content
   */
  generateICMJEForm(author: AuthorCOI): string {
    const formUrl = 'http://www.icmje.org/coi_disclosure.pdf';

    let content = `ICMJE Conflict of Interest Disclosure Form\n\n`;
    content += `Author: ${author.name}\n\n`;

    if (!author.hasConflict) {
      content += 'No conflicts of interest to disclose.\n';
    } else if (author.disclosures) {
      content += 'Conflicts of Interest:\n\n';

      if (author.disclosures.financialRelationships) {
        content += 'Financial Relationships:\n';
        author.disclosures.financialRelationships.forEach(rel => {
          content += `- ${rel}\n`;
        });
        content += '\n';
      }

      if (author.disclosures.intellectualProperty) {
        content += 'Intellectual Property:\n';
        author.disclosures.intellectualProperty.forEach(ip => {
          content += `- ${ip}\n`;
        });
        content += '\n';
      }

      if (author.disclosures.otherRelationships) {
        content += 'Other Relationships:\n';
        author.disclosures.otherRelationships.forEach(rel => {
          content += `- ${rel}\n`;
        });
      }
    }

    content += `\nFor complete disclosure form, visit: ${formUrl}`;

    return content;
  }

  /**
   * Check if disclosure is complete
   */
  validateDisclosure(disclosure: COIDisclosureRequest): { complete: boolean; missing: string[] } {
    const missing: string[] = [];

    // Check that all authors have disclosure status
    for (const author of disclosure.authors) {
      if (author.hasConflict && !author.disclosures) {
        missing.push(`${author.name}: Conflict marked but details not provided`);
      }
    }

    // Check funding statement
    if (!disclosure.studyFunding || disclosure.studyFunding.length === 0) {
      missing.push('Funding statement not provided');
    }

    return {
      complete: missing.length === 0,
      missing,
    };
  }
}

export const coiDisclosureService = new COIDisclosureService();
