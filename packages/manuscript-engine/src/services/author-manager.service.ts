/**
 * Author Manager Service
 * Task T58: Manage author metadata (ORCID, affiliations)
 */

export interface AuthorManagerRequest {
  manuscriptId: string;
  authors: AuthorDetails[];
}

export interface AuthorDetails {
  id?: string;
  firstName: string;
  middleName?: string;
  lastName: string;
  suffix?: string; // MD, PhD, etc.
  email: string;
  orcid?: string;
  affiliations: Affiliation[];
  correspondingAuthor?: boolean;
  contributions?: string[]; // CRediT roles
}

export interface Affiliation {
  id: string;
  institution: string;
  department?: string;
  city: string;
  state?: string;
  country: string;
  postalCode?: string;
}

export interface ManagedAuthors {
  manuscriptId: string;
  authors: AuthorDetails[];
  correspondingAuthor: AuthorDetails;
  affiliations: Affiliation[];
  formatted: {
    byline: string;
    affiliationList: string;
    correspondenceBlock: string;
    contributionStatement: string;
  };
  validationErrors: string[];
  createdAt: Date;
}

/**
 * Author Manager Service
 * Manages author metadata and formatting
 */
export class AuthorManagerService {
  async manageAuthors(request: AuthorManagerRequest): Promise<ManagedAuthors> {
    const validationErrors = this.validateAuthors(request.authors);

    const correspondingAuthor = request.authors.find(a => a.correspondingAuthor) || request.authors[0];

    // Collect unique affiliations
    const affiliations = this.extractUniqueAffiliations(request.authors);

    // Format author list
    const byline = this.formatByline(request.authors, affiliations);
    const affiliationList = this.formatAffiliationList(affiliations);
    const correspondenceBlock = this.formatCorrespondenceBlock(correspondingAuthor);
    const contributionStatement = this.formatContributionStatement(request.authors);

    return {
      manuscriptId: request.manuscriptId,
      authors: request.authors,
      correspondingAuthor,
      affiliations,
      formatted: {
        byline,
        affiliationList,
        correspondenceBlock,
        contributionStatement,
      },
      validationErrors,
      createdAt: new Date(),
    };
  }

  private validateAuthors(authors: AuthorDetails[]): string[] {
    const errors: string[] = [];

    if (authors.length === 0) {
      errors.push('At least one author is required');
      return errors;
    }

    for (const author of authors) {
      const authorName = `${author.firstName} ${author.lastName}`;

      // Validate ORCID format
      if (author.orcid && !this.isValidORCID(author.orcid)) {
        errors.push(`Invalid ORCID for ${authorName}: ${author.orcid}`);
      }

      // Check for affiliations
      if (!author.affiliations || author.affiliations.length === 0) {
        errors.push(`No affiliation provided for ${authorName}`);
      }

      // Validate email
      if (!this.isValidEmail(author.email)) {
        errors.push(`Invalid email for ${authorName}: ${author.email}`);
      }
    }

    // Check for corresponding author
    const correspondingCount = authors.filter(a => a.correspondingAuthor).length;
    if (correspondingCount === 0) {
      errors.push('No corresponding author designated (first author will be used)');
    } else if (correspondingCount > 1) {
      errors.push(`Multiple corresponding authors designated (${correspondingCount})`);
    }

    return errors;
  }

  private isValidORCID(orcid: string): boolean {
    // ORCID format: 0000-0002-1825-0097
    return /^\d{4}-\d{4}-\d{4}-\d{3}[\dX]$/.test(orcid);
  }

  private isValidEmail(email: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  private extractUniqueAffiliations(authors: AuthorDetails[]): Affiliation[] {
    const affiliationMap = new Map<string, Affiliation>();

    for (const author of authors) {
      for (const affiliation of author.affiliations) {
        if (!affiliationMap.has(affiliation.id)) {
          affiliationMap.set(affiliation.id, affiliation);
        }
      }
    }

    return Array.from(affiliationMap.values());
  }

  private formatByline(authors: AuthorDetails[], affiliations: Affiliation[]): string {
    return authors
      .map(author => {
        const name = this.formatAuthorName(author);
        const affiliationNumbers = author.affiliations
          .map(aff => affiliations.findIndex(a => a.id === aff.id) + 1)
          .join(',');

        let formatted = name;
        if (affiliationNumbers) {
          formatted += `^${affiliationNumbers}`;
        }

        if (author.correspondingAuthor) {
          formatted += '*';
        }

        return formatted;
      })
      .join(', ');
  }

  private formatAuthorName(author: AuthorDetails): string {
    let name = author.firstName;

    if (author.middleName) {
      name += ` ${author.middleName}`;
    }

    name += ` ${author.lastName}`;

    if (author.suffix) {
      name += `, ${author.suffix}`;
    }

    return name;
  }

  private formatAffiliationList(affiliations: Affiliation[]): string {
    return affiliations
      .map((aff, index) => {
        const parts: string[] = [];

        if (aff.department) {
          parts.push(aff.department);
        }

        parts.push(aff.institution);
        parts.push(aff.city);

        if (aff.state) {
          parts.push(aff.state);
        }

        parts.push(aff.country);

        return `${index + 1}. ${parts.join(', ')}`;
      })
      .join('\n');
  }

  private formatCorrespondenceBlock(author: AuthorDetails): string {
    let block = `*Correspondence to: ${this.formatAuthorName(author)}\n`;
    block += `Email: ${author.email}\n`;

    if (author.orcid) {
      block += `ORCID: https://orcid.org/${author.orcid}`;
    }

    return block;
  }

  private formatContributionStatement(authors: AuthorDetails[]): string {
    // CRediT (Contributor Roles Taxonomy) statement
    const roleMap = new Map<string, string[]>();

    for (const author of authors) {
      if (author.contributions) {
        for (const role of author.contributions) {
          if (!roleMap.has(role)) {
            roleMap.set(role, []);
          }
          const initials = this.getInitials(author);
          roleMap.get(role)!.push(initials);
        }
      }
    }

    if (roleMap.size === 0) {
      return 'Author contributions not specified.';
    }

    const statements: string[] = [];

    for (const [role, authorInitials] of roleMap) {
      statements.push(`${role}: ${authorInitials.join(', ')}`);
    }

    return 'Author Contributions: ' + statements.join('; ') + '.';
  }

  private getInitials(author: AuthorDetails): string {
    const first = author.firstName.charAt(0);
    const last = author.lastName.charAt(0);

    if (author.middleName) {
      const middle = author.middleName.charAt(0);
      return `${first}${middle}${last}`;
    }

    return `${first}${last}`;
  }

  /**
   * Generate CRediT taxonomy roles
   */
  getCRediTRoles(): string[] {
    return [
      'Conceptualization',
      'Data curation',
      'Formal analysis',
      'Funding acquisition',
      'Investigation',
      'Methodology',
      'Project administration',
      'Resources',
      'Software',
      'Supervision',
      'Validation',
      'Visualization',
      'Writing – original draft',
      'Writing – review & editing',
    ];
  }

  /**
   * Lookup ORCID from name (would use ORCID API in production)
   */
  async lookupORCID(firstName: string, lastName: string): Promise<string[]> {
    // In production, query ORCID public API
    // For now, return empty array
    return [];
  }
}

export const authorManagerService = new AuthorManagerService();
