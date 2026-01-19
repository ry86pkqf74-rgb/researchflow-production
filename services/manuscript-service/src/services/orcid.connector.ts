/**
 * ORCID Connector (Stub)
 * Task T71: Pull author information and publication history from ORCID
 */

export interface OrcidProfile {
  orcidId: string;
  givenName: string;
  familyName: string;
  creditName?: string;
  biography?: string;
  affiliations: Array<{
    organization: string;
    department?: string;
    role?: string;
    startDate?: string;
    endDate?: string;
  }>;
  works: Array<{
    title: string;
    type: string;
    publicationYear?: number;
    journal?: string;
    doi?: string;
    pmid?: string;
  }>;
  emails: string[]; // Only public emails
}

export interface OrcidPullRequest {
  orcidId: string;
  userId: string;
  includeBiography?: boolean;
  includeWorks?: boolean;
  includeAffiliations?: boolean;
}

/**
 * ORCID integration connector
 *
 * STUB: In production, this would:
 * 1. Authenticate with ORCID API using OAuth 2.0
 * 2. Fetch author profile information
 * 3. Pull publication history for citation suggestions
 * 4. Handle rate limiting and caching
 */
export class OrcidConnector {
  private readonly ORCID_API_BASE = process.env.ORCID_API_URL || 'https://pub.orcid.org/v3.0';

  /**
   * Pull profile information from ORCID
   */
  async pullProfile(request: OrcidPullRequest): Promise<OrcidProfile | null> {
    console.log('[ORCID] Profile pull requested for:', request.orcidId);

    // Validate ORCID format (0000-0000-0000-0000)
    if (!this.isValidOrcidFormat(request.orcidId)) {
      console.error('[ORCID] Invalid ORCID format:', request.orcidId);
      return null;
    }

    // STUB: Return mock profile
    // In production, implement actual ORCID API integration
    return {
      orcidId: request.orcidId,
      givenName: 'Author',
      familyName: 'Name',
      creditName: 'A. Name',
      biography: request.includeBiography ? 'Researcher in biomedical sciences.' : undefined,
      affiliations: request.includeAffiliations ? [
        {
          organization: 'Research Institution',
          department: 'Department of Medicine',
          role: 'Researcher',
        },
      ] : [],
      works: request.includeWorks ? [] : [],
      emails: [],
    };
  }

  /**
   * Search for ORCID by name or email
   */
  async searchByName(firstName: string, lastName: string): Promise<Array<{
    orcidId: string;
    displayName: string;
  }>> {
    console.log('[ORCID] Search requested for:', firstName, lastName);

    // STUB: Return empty results
    return [];
  }

  /**
   * Validate ORCID format
   */
  private isValidOrcidFormat(orcid: string): boolean {
    // ORCID format: 0000-0000-0000-000X (X can be digit or X)
    const orcidRegex = /^\d{4}-\d{4}-\d{4}-\d{3}[\dX]$/;
    return orcidRegex.test(orcid);
  }

  /**
   * Check if user has valid ORCID connection
   */
  async checkConnection(userId: string): Promise<{ connected: boolean; orcidId?: string }> {
    console.log('[ORCID] Connection check for user:', userId);

    // STUB: Return not connected
    return {
      connected: false,
    };
  }

  /**
   * Initiate OAuth flow for ORCID connection
   */
  getAuthorizationUrl(userId: string, callbackUrl: string): string {
    // STUB: Return placeholder URL
    const clientId = process.env.ORCID_CLIENT_ID || 'PLACEHOLDER';
    return `https://orcid.org/oauth/authorize?client_id=${clientId}&response_type=code&scope=/read-limited&redirect_uri=${encodeURIComponent(callbackUrl)}&state=${userId}`;
  }
}

export const orcidConnector = new OrcidConnector();
