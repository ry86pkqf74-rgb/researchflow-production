/**
 * Salesforce OAuth Provider - Task 168
 *
 * Implements OAuth 2.0 flow for Salesforce integration.
 * Reference: https://help.salesforce.com/s/articleView?id=sf.remoteaccess_oauth_web_server_flow.htm
 */

import crypto from 'crypto';
import type {
  IntegrationProviderClient,
  OAuthTokenSet,
  ProviderIdentity,
  IntegrationSyncResult,
} from '../provider';

interface SalesforceConfig {
  clientId: string;
  clientSecret: string;
  /** Login base URL (default: https://login.salesforce.com) */
  loginBaseUrl?: string;
  /** API version (default: v59.0) */
  apiVersion?: string;
}

interface SalesforceTokenResponse {
  access_token: string;
  refresh_token?: string;
  instance_url: string;
  id: string;
  token_type: string;
  issued_at: string;
  signature: string;
  scope?: string;
}

interface SalesforceUserInfo {
  sub: string;
  name: string;
  preferred_username: string;
  email: string;
  email_verified: boolean;
  organization_id: string;
  user_id: string;
  user_type: string;
  active: boolean;
  locale: string;
  language: string;
  timezone: string;
  photos?: {
    picture?: string;
    thumbnail?: string;
  };
}

/**
 * Create Salesforce provider client
 */
export function createSalesforceProvider(config: SalesforceConfig): IntegrationProviderClient {
  const loginBaseUrl = config.loginBaseUrl ?? 'https://login.salesforce.com';
  const apiVersion = config.apiVersion ?? 'v59.0';

  return {
    provider: 'salesforce',

    async startOAuth({ redirectUri, scopes, state: providedState }) {
      const state = providedState ?? crypto.randomBytes(24).toString('hex');

      // Default scopes for typical CRM access
      const scope = scopes?.join(' ') ?? 'api refresh_token openid profile email';

      const params = new URLSearchParams({
        response_type: 'code',
        client_id: config.clientId,
        redirect_uri: redirectUri,
        scope,
        state,
        prompt: 'consent', // Always show consent screen
      });

      return {
        state,
        authorizationUrl: `${loginBaseUrl}/services/oauth2/authorize?${params.toString()}`,
      };
    },

    async finishOAuth({ code, redirectUri }) {
      const body = new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        client_id: config.clientId,
        client_secret: config.clientSecret,
        redirect_uri: redirectUri,
      });

      const response = await fetch(`${loginBaseUrl}/services/oauth2/token`, {
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
          `Salesforce token exchange failed: ${response.status} ${response.statusText} - ${errorText}`
        );
      }

      const data = await response.json() as SalesforceTokenResponse;

      // Fetch user info to get identity details
      const userInfo = await fetchSalesforceUserInfo(data.access_token, data.id);

      return {
        tokens: {
          accessToken: data.access_token,
          refreshToken: data.refresh_token,
          tokenType: data.token_type,
          scope: data.scope,
          // Salesforce tokens typically expire in 2 hours
          expiresAt: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
        },
        identity: {
          externalAccountId: userInfo.user_id,
          externalAccountLabel: userInfo.email || userInfo.preferred_username,
          meta: {
            userId: userInfo.user_id,
            organizationId: userInfo.organization_id,
            username: userInfo.preferred_username,
            email: userInfo.email,
            name: userInfo.name,
            instanceUrl: data.instance_url,
            userType: userInfo.user_type,
            active: userInfo.active,
            locale: userInfo.locale,
            timezone: userInfo.timezone,
          },
        },
      };
    },

    async refreshToken({ refreshToken }) {
      const body = new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        client_id: config.clientId,
        client_secret: config.clientSecret,
      });

      const response = await fetch(`${loginBaseUrl}/services/oauth2/token`, {
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
          `Salesforce token refresh failed: ${response.status} ${response.statusText} - ${errorText}`
        );
      }

      const data = await response.json() as SalesforceTokenResponse;

      return {
        accessToken: data.access_token,
        refreshToken: data.refresh_token ?? refreshToken, // May not return new refresh token
        tokenType: data.token_type,
        scope: data.scope,
        expiresAt: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
      };
    },

    async revokeToken({ accessToken, refreshToken }) {
      const token = accessToken ?? refreshToken;
      if (!token) return;

      const body = new URLSearchParams({ token });

      try {
        await fetch(`${loginBaseUrl}/services/oauth2/revoke`, {
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
      try {
        const response = await fetch(`${loginBaseUrl}/services/oauth2/userinfo`, {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Accept': 'application/json',
          },
        });

        if (!response.ok) {
          return { valid: false };
        }

        const data = await response.json() as SalesforceUserInfo;

        return {
          valid: data.active,
          identity: {
            externalAccountId: data.user_id,
            externalAccountLabel: data.email || data.preferred_username,
            meta: {
              organizationId: data.organization_id,
              active: data.active,
            },
          },
        };
      } catch {
        return { valid: false };
      }
    },

    async runSync({ connectionId, cursor, fullSync }) {
      const startTime = Date.now();

      // Placeholder - real implementation would:
      // 1. Get access token from connection
      // 2. Query Salesforce objects (Accounts, Contacts, etc.)
      // 3. Sync data to local storage

      return {
        success: true,
        itemsSynced: 0,
        itemsCreated: 0,
        itemsUpdated: 0,
        itemsDeleted: 0,
        nextCursor: undefined,
        hasMore: false,
        durationMs: Date.now() - startTime,
        syncedAt: new Date().toISOString(),
      };
    },
  };
}

/**
 * Fetch Salesforce user info
 */
async function fetchSalesforceUserInfo(
  accessToken: string,
  idUrl: string
): Promise<SalesforceUserInfo> {
  const response = await fetch(idUrl, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Accept': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch Salesforce user info: ${response.status}`);
  }

  return response.json() as Promise<SalesforceUserInfo>;
}

/**
 * Query Salesforce objects using SOQL
 */
export async function querySalesforce<T>(
  instanceUrl: string,
  accessToken: string,
  soql: string,
  apiVersion: string = 'v59.0'
): Promise<{
  totalSize: number;
  done: boolean;
  nextRecordsUrl?: string;
  records: T[];
}> {
  const url = `${instanceUrl}/services/data/${apiVersion}/query?q=${encodeURIComponent(soql)}`;

  const response = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Accept': 'application/json',
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Salesforce query failed: ${response.status} - ${errorText}`);
  }

  return response.json() as Promise<{
    totalSize: number;
    done: boolean;
    nextRecordsUrl?: string;
    records: T[];
  }>;
}

export default createSalesforceProvider;
