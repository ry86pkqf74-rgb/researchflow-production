/**
 * Acknowledgments Service
 * Task T48: Generate acknowledgments section (funding, contributors, ethics)
 */

export interface AcknowledgmentsRequest {
  manuscriptId: string;
  funding?: FundingSource[];
  contributors?: Contributor[];
  ethicsApproval?: EthicsApproval;
  dataAvailability?: string;
  conflictOfInterest?: ConflictOfInterest[];
}

export interface FundingSource {
  agency: string;
  grantNumber?: string;
  recipient?: string; // PI name
  role?: 'sponsored' | 'supported' | 'funded';
}

export interface Contributor {
  name: string;
  affiliation?: string;
  role: 'data_collection' | 'statistical_analysis' | 'manuscript_review' | 'technical_support' | 'other';
  description?: string;
}

export interface EthicsApproval {
  institution: string;
  irbNumber: string;
  approvalDate?: Date;
  consentWaived?: boolean;
  consentType?: 'written' | 'verbal' | 'implied';
}

export interface ConflictOfInterest {
  authorName: string;
  hasConflict: boolean;
  description?: string; // If conflict exists
}

export interface GeneratedAcknowledgments {
  manuscriptId: string;
  sections: {
    funding: string;
    contributors: string;
    ethics: string;
    dataAvailability: string;
    conflictOfInterest: string;
  };
  fullText: string;
  wordCount: number;
  createdAt: Date;
}

/**
 * Acknowledgments Service
 * Generates properly formatted acknowledgments section
 */
export class AcknowledgmentsService {
  /**
   * Generate complete acknowledgments section
   */
  async generateAcknowledgments(request: AcknowledgmentsRequest): Promise<GeneratedAcknowledgments> {
    const sections = {
      funding: this.generateFundingSection(request.funding),
      contributors: this.generateContributorsSection(request.contributors),
      ethics: this.generateEthicsSection(request.ethicsApproval),
      dataAvailability: this.generateDataAvailabilitySection(request.dataAvailability),
      conflictOfInterest: this.generateConflictSection(request.conflictOfInterest),
    };

    const fullText = Object.entries(sections)
      .filter(([_, value]) => value.trim().length > 0)
      .map(([key, value]) => `### ${this.formatSectionTitle(key)}\n\n${value}`)
      .join('\n\n');

    const wordCount = fullText.split(/\s+/).length;

    return {
      manuscriptId: request.manuscriptId,
      sections,
      fullText,
      wordCount,
      createdAt: new Date(),
    };
  }

  // ========== Section Generators ==========

  private generateFundingSection(funding?: FundingSource[]): string {
    if (!funding || funding.length === 0) {
      return 'This research received no specific grant from any funding agency in the public, commercial, or not-for-profit sectors.';
    }

    const fundingStatements = funding.map(f => {
      let statement = `This work was ${f.role || 'supported'} by ${f.agency}`;

      if (f.grantNumber) {
        statement += ` (grant number ${f.grantNumber})`;
      }

      if (f.recipient) {
        statement += ` to ${f.recipient}`;
      }

      return statement + '.';
    });

    return fundingStatements.join(' ');
  }

  private generateContributorsSection(contributors?: Contributor[]): string {
    if (!contributors || contributors.length === 0) {
      return '';
    }

    const byRole: Record<string, string[]> = {};

    for (const contributor of contributors) {
      const roleKey = contributor.role;
      if (!byRole[roleKey]) {
        byRole[roleKey] = [];
      }

      let entry = contributor.name;
      if (contributor.affiliation) {
        entry += ` (${contributor.affiliation})`;
      }
      if (contributor.description) {
        entry += ` - ${contributor.description}`;
      }

      byRole[roleKey].push(entry);
    }

    const sections: string[] = [];

    if (byRole.data_collection) {
      sections.push(`The authors thank ${byRole.data_collection.join(', ')} for assistance with data collection.`);
    }

    if (byRole.statistical_analysis) {
      sections.push(`The authors acknowledge ${byRole.statistical_analysis.join(', ')} for statistical analysis support.`);
    }

    if (byRole.manuscript_review) {
      sections.push(`The authors thank ${byRole.manuscript_review.join(', ')} for critical review of the manuscript.`);
    }

    if (byRole.technical_support) {
      sections.push(`Technical support was provided by ${byRole.technical_support.join(', ')}.`);
    }

    if (byRole.other) {
      sections.push(`The authors acknowledge ${byRole.other.join(', ')}.`);
    }

    return sections.join(' ');
  }

  private generateEthicsSection(ethics?: EthicsApproval): string {
    if (!ethics) {
      return 'This study was approved by the Institutional Review Board at [Institution] (IRB #[number]).';
    }

    let statement = `This study was approved by the Institutional Review Board at ${ethics.institution} (IRB #${ethics.irbNumber}`;

    if (ethics.approvalDate) {
      const dateStr = ethics.approvalDate.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
      statement += `, approved ${dateStr}`;
    }

    statement += ').';

    // Consent statement
    if (ethics.consentWaived) {
      statement += ' The requirement for informed consent was waived due to the retrospective nature of the study and use of de-identified data.';
    } else if (ethics.consentType) {
      const consentTypes = {
        written: 'Written informed consent was obtained from all participants.',
        verbal: 'Verbal informed consent was obtained from all participants.',
        implied: 'Informed consent was implied by return of the questionnaire.',
      };
      statement += ' ' + consentTypes[ethics.consentType];
    } else {
      statement += ' Informed consent was obtained from all participants.';
    }

    return statement;
  }

  private generateDataAvailabilitySection(dataAvailability?: string): string {
    if (!dataAvailability) {
      return 'The data that support the findings of this study are available from the corresponding author upon reasonable request.';
    }

    return dataAvailability;
  }

  private generateConflictSection(conflicts?: ConflictOfInterest[]): string {
    if (!conflicts || conflicts.length === 0) {
      return 'The authors declare no conflicts of interest.';
    }

    const authorsWithConflicts = conflicts.filter(c => c.hasConflict);

    if (authorsWithConflicts.length === 0) {
      return 'The authors declare no conflicts of interest.';
    }

    const statements = authorsWithConflicts.map(c => {
      return `${c.authorName}: ${c.description || 'Has conflicts to declare'}`;
    });

    return 'Conflicts of Interest: ' + statements.join('; ') + '.';
  }

  // ========== Helpers ==========

  private formatSectionTitle(key: string): string {
    const titles: Record<string, string> = {
      funding: 'Funding',
      contributors: 'Acknowledgments',
      ethics: 'Ethics Approval',
      dataAvailability: 'Data Availability',
      conflictOfInterest: 'Conflicts of Interest',
    };

    return titles[key] || key;
  }

  /**
   * Generate ICMJE-compliant COI disclosure
   */
  generateICMJEDisclosure(conflicts: ConflictOfInterest[]): string {
    // ICMJE Form template
    const formUrl = 'http://www.icmje.org/coi_disclosure.pdf';

    return `All authors have completed the ICMJE uniform disclosure form at ${formUrl} and declare: ${this.generateConflictSection(conflicts)}`;
  }

  /**
   * Generate CRediT author contribution statement
   */
  generateCRediTStatement(contributions: Record<string, string[]>): string {
    // CRediT roles: Conceptualization, Data curation, Formal analysis, Funding acquisition,
    // Investigation, Methodology, Project administration, Resources, Software, Supervision,
    // Validation, Visualization, Writing – original draft, Writing – review & editing

    const statements = Object.entries(contributions).map(([role, authors]) => {
      return `${role}: ${authors.join(', ')}`;
    });

    return statements.join('; ') + '.';
  }
}

export const acknowledgmentsService = new AcknowledgmentsService();
