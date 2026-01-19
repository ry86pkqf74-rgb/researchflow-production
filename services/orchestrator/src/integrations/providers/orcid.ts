/**
 * ORCID OAuth Provider - Task 151
 *
 * Implements OAuth 2.0 flow for ORCID authenticated iD.
 * Reference: https://info.orcid.org/documentation/api-tutorials/api-tutorial-get-and-authenticated-orcid-id/
 */

import crypto from 'crypto';
import { URLSearchParams } from 'url';
import {
  BaseProvider,
  type ProviderConfig,
  type IntegrationProviderClient,
  type OAuthTokenSet,
  type ProviderIdentity,
} from '../provider';

interface OrcidConfig extends ProviderConfig {
  /** Use sandbox for testing (default: false = production) */
  sandbox?: boolean;
}

interface OrcidTokenResponse {
  access_token: string;
  token_type: string;
  refresh_token?: string;
  expires_in?: number;
  scope: string;
  orcid: string;
  name?: string;
}

/**
 * Create ORCID provider client
 */
export function createOrcidProvider(config: OrcidConfig): IntegrationProviderClient {
  const baseUrl = config.baseUrl ?? (config.sandbox
    ? 'https://sandbox.orcid.org'
    : 'https://orcid.org');

  return {
    provider: 'orcid',

    async startOAuth({ redirectUri, scopes, state: providedState }) {
      const state = providedState ?? crypto.randomBytes(24).toString('hex');

      // ORCID scopes - /authenticate is the most common
      const scope = scopes?.join(' ') ?? '/authenticate';

      const params = new URLSearchParams({
        client_id: config.clientId,
        response_type: 'code',
        scope,
        redirect_uri: redirectUri,
        state,
      });

      return {
        state,
        authorizationUrl: `${baseUrl}/oauth/authorize?${params.toString()}`,
      };
    },

    async finishOAuth({ code, redirectUri }) {
      const body = new URLSearchParams({
        client_id: config.clientId,
        client_secret: config.clientSecret,
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
      });

      const response = await fetch(`${baseUrl}/oauth/token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': 'application/json',
        },
        body,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `ORCID token exchange failed: ${response.status} ${response.statusText} - ${errorText}`
        );
      }

      const data = await response.json() as OrcidTokenResponse;
      const orcidId = data.orcid;

      if (!orcidId) {
        throw new Error('ORCID ID not returned in token response');
      }

      return {
        tokens: {
          accessToken: data.access_token,
          refreshToken: data.refresh_token,
          scope: data.scope,
          tokenType: data.token_type,
          expiresAt: data.expires_in
            ? new Date(Date.now() + data.expires_in * 1000).toISOString()
            : undefined,
        },
        identity: {
          externalAccountId: orcidId,
          externalAccountLabel: data.name ?? orcidId,
          meta: {
            orcidId,
            name: data.name,
          },
        },
      };
    },

    async refreshToken({ refreshToken }) {
      const body = new URLSearchParams({
        client_id: config.clientId,
        client_secret: config.clientSecret,
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
      });

      const response = await fetch(`${baseUrl}/oauth/token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': 'application/json',
        },
        body,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `ORCID token refresh failed: ${response.status} ${response.statusText} - ${errorText}`
        );
      }

      const data = await response.json() as OrcidTokenResponse;

      return {
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        scope: data.scope,
        tokenType: data.token_type,
        expiresAt: data.expires_in
          ? new Date(Date.now() + data.expires_in * 1000).toISOString()
          : undefined,
      };
    },

    async revokeToken({ accessToken }) {
      if (!accessToken) return;

      const body = new URLSearchParams({
        client_id: config.clientId,
        client_secret: config.clientSecret,
        token: accessToken,
      });

      // ORCID may not have a revoke endpoint; this is a best-effort
      try {
        await fetch(`${baseUrl}/oauth/revoke`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body,
        });
      } catch {
        // Ignore revoke failures
      }
    },

    async validateConnection({ accessToken }) {
      // Fetch user info to validate token
      const response = await fetch(`${baseUrl}/oauth/userinfo`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Accept': 'application/json',
        },
      });

      if (!response.ok) {
        return { valid: false };
      }

      try {
        const data = await response.json() as { sub?: string; name?: string };
        return {
          valid: true,
          identity: {
            externalAccountId: data.sub ?? '',
            externalAccountLabel: data.name,
          },
        };
      } catch {
        return { valid: false };
      }
    },
  };
}

/**
 * Validate an ORCID ID format
 * Format: 0000-0000-0000-000X (X can be 0-9 or X)
 */
export function isValidOrcidId(orcidId: string): boolean {
  return /^\d{4}-\d{4}-\d{4}-\d{3}[\dX]$/.test(orcidId);
}

/**
 * Format ORCID ID with dashes
 */
export function formatOrcidId(orcidId: string): string {
  const digits = orcidId.replace(/-/g, '');
  if (digits.length !== 16) {
    throw new Error('Invalid ORCID ID length');
  }
  return `${digits.slice(0, 4)}-${digits.slice(4, 8)}-${digits.slice(8, 12)}-${digits.slice(12, 16)}`;
}

export default createOrcidProvider;
