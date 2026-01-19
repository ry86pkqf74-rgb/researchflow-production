/**
 * Zoom OAuth Provider - Task 177
 *
 * Implements OAuth 2.0 flow for Zoom integration.
 * Supports both OAuth and Server-to-Server OAuth.
 * Reference: https://developers.zoom.us/docs/integrations/oauth/
 */

import crypto from 'crypto';
import type {
  IntegrationProviderClient,
  OAuthTokenSet,
  ProviderIdentity,
  IntegrationSyncResult,
} from '../provider';

interface ZoomConfig {
  clientId: string;
  clientSecret: string;
  /** Account ID for Server-to-Server OAuth */
  accountId?: string;
  /** Use Server-to-Server OAuth instead of user OAuth */
  serverToServer?: boolean;
}

interface ZoomTokenResponse {
  access_token: string;
  token_type: string;
  refresh_token?: string;
  expires_in: number;
  scope: string;
}

interface ZoomUserInfo {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  type: number;
  role_name: string;
  pmi: number;
  use_pmi: boolean;
  personal_meeting_url: string;
  timezone: string;
  verified: number;
  dept: string;
  created_at: string;
  last_login_time: string;
  status: string;
  pic_url?: string;
  account_id: string;
  account_number: number;
}

/**
 * Create Zoom provider client (User OAuth)
 */
export function createZoomProvider(config: ZoomConfig): IntegrationProviderClient {
  const ZOOM_AUTH_URL = 'https://zoom.us/oauth/authorize';
  const ZOOM_TOKEN_URL = 'https://zoom.us/oauth/token';
  const ZOOM_API_URL = 'https://api.zoom.us/v2';

  if (config.serverToServer) {
    return createZoomS2SProvider(config);
  }

  return {
    provider: 'zoom',

    async startOAuth({ redirectUri, scopes, state: providedState }) {
      const state = providedState ?? crypto.randomBytes(24).toString('hex');

      const params = new URLSearchParams({
        response_type: 'code',
        client_id: config.clientId,
        redirect_uri: redirectUri,
        state,
      });

      return {
        state,
        authorizationUrl: `${ZOOM_AUTH_URL}?${params.toString()}`,
      };
    },

    async finishOAuth({ code, redirectUri }) {
      // Zoom uses Basic Auth for token exchange
      const credentials = Buffer.from(
        `${config.clientId}:${config.clientSecret}`
      ).toString('base64');

      const body = new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
      });

      const response = await fetch(ZOOM_TOKEN_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${credentials}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `Zoom token exchange failed: ${response.status} ${response.statusText} - ${errorText}`
        );
      }

      const data = await response.json() as ZoomTokenResponse;

      // Fetch user info
      const userInfo = await fetchZoomUserInfo(data.access_token);

      return {
        tokens: {
          accessToken: data.access_token,
          refreshToken: data.refresh_token,
          tokenType: data.token_type,
          scope: data.scope,
          expiresAt: new Date(Date.now() + data.expires_in * 1000).toISOString(),
        },
        identity: {
          externalAccountId: userInfo.id,
          externalAccountLabel: userInfo.email,
          meta: {
            zoomUserId: userInfo.id,
            email: userInfo.email,
            firstName: userInfo.first_name,
            lastName: userInfo.last_name,
            accountId: userInfo.account_id,
            type: userInfo.type,
            roleName: userInfo.role_name,
            timezone: userInfo.timezone,
            status: userInfo.status,
            pmi: userInfo.pmi,
            personalMeetingUrl: userInfo.personal_meeting_url,
          },
        },
      };
    },

    async refreshToken({ refreshToken }) {
      const credentials = Buffer.from(
        `${config.clientId}:${config.clientSecret}`
      ).toString('base64');

      const body = new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
      });

      const response = await fetch(ZOOM_TOKEN_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${credentials}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `Zoom token refresh failed: ${response.status} ${response.statusText} - ${errorText}`
        );
      }

      const data = await response.json() as ZoomTokenResponse;

      return {
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        tokenType: data.token_type,
        scope: data.scope,
        expiresAt: new Date(Date.now() + data.expires_in * 1000).toISOString(),
      };
    },

    async revokeToken({ accessToken }) {
      if (!accessToken) return;

      const credentials = Buffer.from(
        `${config.clientId}:${config.clientSecret}`
      ).toString('base64');

      try {
        await fetch(`${ZOOM_TOKEN_URL}/revoke?token=${accessToken}`, {
          method: 'POST',
          headers: {
            'Authorization': `Basic ${credentials}`,
          },
        });
      } catch {
        // Ignore revoke failures
      }
    },

    async validateConnection({ accessToken }) {
      try {
        const userInfo = await fetchZoomUserInfo(accessToken);

        return {
          valid: userInfo.status === 'active',
          identity: {
            externalAccountId: userInfo.id,
            externalAccountLabel: userInfo.email,
            meta: {
              status: userInfo.status,
              accountId: userInfo.account_id,
            },
          },
        };
      } catch {
        return { valid: false };
      }
    },

    async runSync({ connectionId, cursor, fullSync }) {
      const startTime = Date.now();

      // Placeholder - real implementation would sync meetings, recordings, etc.
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
 * Create Zoom Server-to-Server OAuth provider
 * For server integrations without user interaction
 */
function createZoomS2SProvider(config: ZoomConfig): IntegrationProviderClient {
  const ZOOM_S2S_TOKEN_URL = 'https://zoom.us/oauth/token';

  if (!config.accountId) {
    throw new Error('accountId is required for Server-to-Server OAuth');
  }

  return {
    provider: 'zoom',

    async startOAuth() {
      // S2S doesn't have user authorization flow
      throw new Error('Server-to-Server OAuth does not support user authorization flow');
    },

    async finishOAuth() {
      // For S2S, we get the token directly
      const credentials = Buffer.from(
        `${config.clientId}:${config.clientSecret}`
      ).toString('base64');

      const body = new URLSearchParams({
        grant_type: 'account_credentials',
        account_id: config.accountId!,
      });

      const response = await fetch(ZOOM_S2S_TOKEN_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${credentials}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `Zoom S2S token request failed: ${response.status} - ${errorText}`
        );
      }

      const data = await response.json() as ZoomTokenResponse;

      return {
        tokens: {
          accessToken: data.access_token,
          tokenType: data.token_type,
          scope: data.scope,
          expiresAt: new Date(Date.now() + data.expires_in * 1000).toISOString(),
        },
        identity: {
          externalAccountId: config.accountId!,
          externalAccountLabel: `Zoom Account ${config.accountId}`,
          meta: {
            accountId: config.accountId,
            type: 'server_to_server',
          },
        },
      };
    },

    async refreshToken() {
      // S2S tokens are short-lived, get a new one
      const result = await this.finishOAuth({
        code: '',
        state: '',
        redirectUri: '',
      });
      return result.tokens;
    },

    async validateConnection({ accessToken }) {
      try {
        // Use the users API to validate
        const response = await fetch('https://api.zoom.us/v2/users?page_size=1', {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
          },
        });

        return {
          valid: response.ok,
          identity: {
            externalAccountId: config.accountId!,
            externalAccountLabel: `Zoom Account ${config.accountId}`,
          },
        };
      } catch {
        return { valid: false };
      }
    },

    runSync: undefined,
  };
}

/**
 * Fetch Zoom user info
 */
async function fetchZoomUserInfo(accessToken: string): Promise<ZoomUserInfo> {
  const response = await fetch('https://api.zoom.us/v2/users/me', {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch Zoom user info: ${response.status}`);
  }

  return response.json() as Promise<ZoomUserInfo>;
}

/**
 * List Zoom meetings
 */
export async function listZoomMeetings(
  accessToken: string,
  userId: string = 'me',
  options: {
    type?: 'scheduled' | 'live' | 'upcoming';
    pageSize?: number;
    nextPageToken?: string;
  } = {}
): Promise<{
  page_size: number;
  total_records: number;
  next_page_token?: string;
  meetings: Array<{
    id: number;
    uuid: string;
    topic: string;
    type: number;
    start_time: string;
    duration: number;
    timezone: string;
    join_url: string;
  }>;
}> {
  const params = new URLSearchParams({
    type: options.type ?? 'scheduled',
    page_size: String(options.pageSize ?? 30),
  });

  if (options.nextPageToken) {
    params.set('next_page_token', options.nextPageToken);
  }

  const response = await fetch(
    `https://api.zoom.us/v2/users/${userId}/meetings?${params.toString()}`,
    {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to list Zoom meetings: ${response.status} - ${errorText}`);
  }

  return response.json() as Promise<{
    page_size: number;
    total_records: number;
    next_page_token?: string;
    meetings: Array<{
      id: number;
      uuid: string;
      topic: string;
      type: number;
      start_time: string;
      duration: number;
      timezone: string;
      join_url: string;
    }>;
  }>;
}

export default createZoomProvider;
