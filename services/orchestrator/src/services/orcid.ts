/**
 * ORCID Integration Service
 *
 * Provides integration with ORCID (Open Researcher and Contributor ID) for:
 * - Author metadata retrieval (name, affiliations, works)
 * - OAuth 2.0 token exchange for ownership verification
 * - Sandbox vs production environment support
 *
 * Configuration:
 * - ORCID_CLIENT_ID: OAuth client ID
 * - ORCID_CLIENT_SECRET: OAuth client secret
 * - ORCID_SANDBOX: Set to 'true' for sandbox environment (default: false)
 *
 * Priority: P1 - Important (Phase 3 Integration)
 */

import { createGovernanceLogEntry } from '../../utils/governance-log';

// ORCID API configuration
const ORCID_SANDBOX_BASE_URL = 'https://sandbox.orcid.org';
const ORCID_PRODUCTION_BASE_URL = 'https://orcid.org';
const ORCID_SANDBOX_API_URL = 'https://api.sandbox.orcid.org/v3.0';
const ORCID_PRODUCTION_API_URL = 'https://api.orcid.org/v3.0';

/**
 * ORCID configuration status
 */
export interface OrcidConfigStatus {
  configured: boolean;
  sandbox: boolean;
  baseUrl: string;
  apiUrl: string;
  message: string;
}

/**
 * ORCID author metadata
 */
export interface OrcidAuthorMetadata {
  orcidId: string;
  name: {
    givenNames: string | null;
    familyName: string | null;
    creditName: string | null;
  };
  affiliations: OrcidAffiliation[];
  works: OrcidWork[];
  fetchedAt: string;
}

/**
 * ORCID affiliation data
 */
export interface OrcidAffiliation {
  type: 'employment' | 'education' | 'distinction' | 'membership' | 'service' | 'invited-position' | 'qualification';
  organizationName: string;
  role: string | null;
  department: string | null;
  startDate: string | null;
  endDate: string | null;
  current: boolean;
}

/**
 * ORCID work/publication data
 */
export interface OrcidWork {
  putCode: number;
  title: string;
  type: string;
  publicationDate: string | null;
  journalTitle: string | null;
  doi: string | null;
  url: string | null;
}

/**
 * OAuth token response
 */
export interface OrcidTokenResponse {
  accessToken: string;
  tokenType: string;
  refreshToken?: string;
  expiresIn: number;
  scope: string;
  orcid: string;
  name?: string;
}

/**
 * ORCID verification result
 */
export interface OrcidVerificationResult {
  verified: boolean;
  orcidId: string;
  name?: string;
  error?: string;
  verifiedAt?: string;
}

/**
 * Error thrown when ORCID is not configured
 */
export class OrcidNotConfiguredError extends Error {
  constructor() {
    super('ORCID integration is not configured. Set ORCID_CLIENT_ID and ORCID_CLIENT_SECRET environment variables.');
    this.name = 'OrcidNotConfiguredError';
  }
}

/**
 * Error thrown for ORCID API failures
 */
export class OrcidApiError extends Error {
  statusCode: number;

  constructor(message: string, statusCode: number) {
    super(message);
    this.name = 'OrcidApiError';
    this.statusCode = statusCode;
  }
}

/**
 * ORCID Service
 * Singleton service for ORCID integration
 */
export class OrcidService {
  private static instance: OrcidService;
  private clientId: string | undefined;
  private clientSecret: string | undefined;
  private sandbox: boolean;
  private baseUrl: string;
  private apiUrl: string;

  private constructor() {
    this.clientId = process.env.ORCID_CLIENT_ID;
    this.clientSecret = process.env.ORCID_CLIENT_SECRET;
    this.sandbox = process.env.ORCID_SANDBOX === 'true';
    this.baseUrl = this.sandbox ? ORCID_SANDBOX_BASE_URL : ORCID_PRODUCTION_BASE_URL;
    this.apiUrl = this.sandbox ? ORCID_SANDBOX_API_URL : ORCID_PRODUCTION_API_URL;
  }

  /**
   * Get singleton instance
   */
  static getInstance(): OrcidService {
    if (!OrcidService.instance) {
      OrcidService.instance = new OrcidService();
    }
    return OrcidService.instance;
  }

  /**
   * Reset the singleton instance (useful for testing)
   */
  static resetInstance(): void {
    OrcidService.instance = undefined as any;
  }

  /**
   * Check if ORCID integration is configured
   */
  isConfigured(): boolean {
    return !!(this.clientId && this.clientSecret);
  }

  /**
   * Get configuration status
   */
  getConfigStatus(): OrcidConfigStatus {
    const configured = this.isConfigured();
    return {
      configured,
      sandbox: this.sandbox,
      baseUrl: this.baseUrl,
      apiUrl: this.apiUrl,
      message: configured
        ? `ORCID integration configured for ${this.sandbox ? 'sandbox' : 'production'} environment`
        : 'ORCID integration not configured. Set ORCID_CLIENT_ID and ORCID_CLIENT_SECRET environment variables.'
    };
  }

  /**
   * Get the OAuth authorization URL
   */
  getAuthorizationUrl(redirectUri: string, state: string, scope: string = '/authenticate'): string {
    if (!this.isConfigured()) {
      throw new OrcidNotConfiguredError();
    }

    const params = new URLSearchParams({
      client_id: this.clientId!,
      response_type: 'code',
      scope,
      redirect_uri: redirectUri,
      state
    });

    return `${this.baseUrl}/oauth/authorize?${params.toString()}`;
  }

  /**
   * Exchange authorization code for access token
   */
  async exchangeCodeForToken(code: string, redirectUri: string): Promise<OrcidTokenResponse> {
    if (!this.isConfigured()) {
      throw new OrcidNotConfiguredError();
    }

    const tokenUrl = `${this.baseUrl}/oauth/token`;

    const params = new URLSearchParams({
      client_id: this.clientId!,
      client_secret: this.clientSecret!,
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri
    });

    try {
      const response = await fetch(tokenUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': 'application/json'
        },
        body: params.toString()
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new OrcidApiError(`Token exchange failed: ${errorText}`, response.status);
      }

      const data = await response.json();

      // Log successful token exchange
      createGovernanceLogEntry(
        'ORCID_VERIFIED',
        'ORCID ownership verified via OAuth',
        {
          resourceType: 'orcid',
          resourceId: data.orcid,
          details: {
            orcidId: data.orcid,
            name: data.name,
            scope: data.scope
          }
        }
      );

      return {
        accessToken: data.access_token,
        tokenType: data.token_type,
        refreshToken: data.refresh_token,
        expiresIn: data.expires_in,
        scope: data.scope,
        orcid: data.orcid,
        name: data.name
      };
    } catch (error) {
      if (error instanceof OrcidApiError) {
        throw error;
      }
      throw new OrcidApiError(`Failed to exchange code for token: ${(error as Error).message}`, 500);
    }
  }

  /**
   * Fetch author metadata by ORCID ID
   */
  async fetchAuthorMetadata(orcidId: string, accessToken?: string): Promise<OrcidAuthorMetadata> {
    // Validate ORCID ID format (0000-0000-0000-0000)
    const orcidPattern = /^\d{4}-\d{4}-\d{4}-\d{3}[\dX]$/;
    if (!orcidPattern.test(orcidId)) {
      throw new OrcidApiError(`Invalid ORCID ID format: ${orcidId}`, 400);
    }

    const headers: Record<string, string> = {
      'Accept': 'application/json'
    };

    if (accessToken) {
      headers['Authorization'] = `Bearer ${accessToken}`;
    }

    try {
      // Fetch person data (name)
      const personResponse = await fetch(`${this.apiUrl}/${orcidId}/person`, { headers });

      if (!personResponse.ok) {
        if (personResponse.status === 404) {
          throw new OrcidApiError(`ORCID ID not found: ${orcidId}`, 404);
        }
        throw new OrcidApiError(`Failed to fetch person data: ${personResponse.statusText}`, personResponse.status);
      }

      const personData = await personResponse.json();

      // Fetch employments/affiliations
      const employmentsResponse = await fetch(`${this.apiUrl}/${orcidId}/employments`, { headers });
      const employmentsData = employmentsResponse.ok ? await employmentsResponse.json() : null;

      // Fetch educations
      const educationsResponse = await fetch(`${this.apiUrl}/${orcidId}/educations`, { headers });
      const educationsData = educationsResponse.ok ? await educationsResponse.json() : null;

      // Fetch works
      const worksResponse = await fetch(`${this.apiUrl}/${orcidId}/works`, { headers });
      const worksData = worksResponse.ok ? await worksResponse.json() : null;

      // Parse name
      const name = {
        givenNames: personData?.name?.['given-names']?.value || null,
        familyName: personData?.name?.['family-name']?.value || null,
        creditName: personData?.name?.['credit-name']?.value || null
      };

      // Parse affiliations
      const affiliations: OrcidAffiliation[] = [];

      if (employmentsData?.['affiliation-group']) {
        for (const group of employmentsData['affiliation-group']) {
          for (const summary of group.summaries || []) {
            const emp = summary['employment-summary'];
            if (emp) {
              affiliations.push({
                type: 'employment',
                organizationName: emp.organization?.name || 'Unknown',
                role: emp['role-title'] || null,
                department: emp['department-name'] || null,
                startDate: this.parseOrcidDate(emp['start-date']),
                endDate: this.parseOrcidDate(emp['end-date']),
                current: !emp['end-date']
              });
            }
          }
        }
      }

      if (educationsData?.['affiliation-group']) {
        for (const group of educationsData['affiliation-group']) {
          for (const summary of group.summaries || []) {
            const edu = summary['education-summary'];
            if (edu) {
              affiliations.push({
                type: 'education',
                organizationName: edu.organization?.name || 'Unknown',
                role: edu['role-title'] || null,
                department: edu['department-name'] || null,
                startDate: this.parseOrcidDate(edu['start-date']),
                endDate: this.parseOrcidDate(edu['end-date']),
                current: !edu['end-date']
              });
            }
          }
        }
      }

      // Parse works (limit to first 20 for performance)
      const works: OrcidWork[] = [];

      if (worksData?.group) {
        const workGroups = worksData.group.slice(0, 20);
        for (const group of workGroups) {
          const workSummary = group['work-summary']?.[0];
          if (workSummary) {
            works.push({
              putCode: workSummary['put-code'],
              title: workSummary.title?.title?.value || 'Untitled',
              type: workSummary.type || 'other',
              publicationDate: this.parseOrcidDate(workSummary['publication-date']),
              journalTitle: workSummary['journal-title']?.value || null,
              doi: this.extractDoi(workSummary['external-ids']),
              url: workSummary.url?.value || null
            });
          }
        }
      }

      const metadata: OrcidAuthorMetadata = {
        orcidId,
        name,
        affiliations,
        works,
        fetchedAt: new Date().toISOString()
      };

      // Log successful fetch
      createGovernanceLogEntry(
        'ORCID_FETCHED',
        'ORCID author metadata fetched',
        {
          resourceType: 'orcid',
          resourceId: orcidId,
          details: {
            orcidId,
            hasName: !!(name.givenNames || name.familyName || name.creditName),
            affiliationCount: affiliations.length,
            workCount: works.length
          }
        }
      );

      return metadata;
    } catch (error) {
      if (error instanceof OrcidApiError) {
        throw error;
      }
      throw new OrcidApiError(`Failed to fetch author metadata: ${(error as Error).message}`, 500);
    }
  }

  /**
   * Verify ORCID ownership via OAuth callback
   */
  async verifyOwnership(code: string, redirectUri: string): Promise<OrcidVerificationResult> {
    try {
      const tokenResponse = await this.exchangeCodeForToken(code, redirectUri);

      return {
        verified: true,
        orcidId: tokenResponse.orcid,
        name: tokenResponse.name,
        verifiedAt: new Date().toISOString()
      };
    } catch (error) {
      return {
        verified: false,
        orcidId: '',
        error: (error as Error).message
      };
    }
  }

  /**
   * Parse ORCID date format
   */
  private parseOrcidDate(dateObj: any): string | null {
    if (!dateObj) return null;

    const year = dateObj.year?.value;
    const month = dateObj.month?.value;
    const day = dateObj.day?.value;

    if (!year) return null;

    if (month && day) {
      return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    } else if (month) {
      return `${year}-${month.padStart(2, '0')}`;
    }
    return year;
  }

  /**
   * Extract DOI from external IDs
   */
  private extractDoi(externalIds: any): string | null {
    if (!externalIds?.['external-id']) return null;

    for (const extId of externalIds['external-id']) {
      if (extId['external-id-type'] === 'doi') {
        return extId['external-id-value'];
      }
    }
    return null;
  }
}

// Export singleton instance getter
export function getOrcidService(): OrcidService {
  return OrcidService.getInstance();
}

// Export constants for testing
export const ORCID_URLS = {
  SANDBOX_BASE: ORCID_SANDBOX_BASE_URL,
  PRODUCTION_BASE: ORCID_PRODUCTION_BASE_URL,
  SANDBOX_API: ORCID_SANDBOX_API_URL,
  PRODUCTION_API: ORCID_PRODUCTION_API_URL
};
