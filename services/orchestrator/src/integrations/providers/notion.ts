/**
 * Notion OAuth Provider - Task 159
 *
 * Implements OAuth 2.0 flow for Notion integration.
 * Reference: https://developers.notion.com/docs/authorization
 * Token endpoint: https://api.notion.com/v1/oauth/token
 */

import crypto from 'crypto';
import type {
  IntegrationProviderClient,
  OAuthTokenSet,
  ProviderIdentity,
  IntegrationSyncResult,
} from '../provider';
import { logger } from '../../logger/file-logger.js';

interface NotionConfig {
  clientId: string;
  clientSecret: string;
  redirectUri?: string;
}

interface NotionTokenResponse {
  access_token: string;
  token_type: string;
  bot_id: string;
  workspace_id: string;
  workspace_name?: string;
  workspace_icon?: string;
  owner: {
    type: 'user' | 'workspace';
    user?: {
      id: string;
      name?: string;
      avatar_url?: string;
      type: string;
      person?: { email?: string };
    };
  };
  duplicated_template_id?: string;
}

interface NotionSearchResponse {
  object: 'list';
  results: Array<{
    id: string;
    object: string;
    created_time: string;
    last_edited_time: string;
    properties?: Record<string, unknown>;
    title?: Array<{ plain_text: string }>;
  }>;
  next_cursor: string | null;
  has_more: boolean;
}

/**
 * Create Notion provider client
 */
export function createNotionProvider(config: NotionConfig): IntegrationProviderClient {
  const NOTION_AUTH_URL = 'https://api.notion.com/v1/oauth/authorize';
  const NOTION_TOKEN_URL = 'https://api.notion.com/v1/oauth/token';
  const NOTION_API_URL = 'https://api.notion.com/v1';

  return {
    provider: 'notion',

    async startOAuth({ redirectUri, state: providedState }) {
      const state = providedState ?? crypto.randomBytes(24).toString('hex');

      const params = new URLSearchParams({
        client_id: config.clientId,
        response_type: 'code',
        owner: 'user',
        redirect_uri: redirectUri,
        state,
      });

      return {
        state,
        authorizationUrl: `${NOTION_AUTH_URL}?${params.toString()}`,
      };
    },

    async finishOAuth({ code, redirectUri }) {
      // Notion uses Basic Auth for token exchange
      const credentials = Buffer.from(
        `${config.clientId}:${config.clientSecret}`
      ).toString('base64');

      const response = await fetch(NOTION_TOKEN_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${credentials}`,
          'Content-Type': 'application/json',
          'Notion-Version': '2022-06-28',
        },
        body: JSON.stringify({
          grant_type: 'authorization_code',
          code,
          redirect_uri: redirectUri,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `Notion token exchange failed: ${response.status} ${response.statusText} - ${errorText}`
        );
      }

      const data = await response.json() as NotionTokenResponse;

      // Notion tokens don't expire by default
      const identity: ProviderIdentity = {
        externalAccountId: data.workspace_id,
        externalAccountLabel: data.workspace_name ?? data.workspace_id,
        meta: {
          botId: data.bot_id,
          workspaceId: data.workspace_id,
          workspaceName: data.workspace_name,
          workspaceIcon: data.workspace_icon,
          ownerType: data.owner.type,
          ownerUserId: data.owner.user?.id,
          ownerUserName: data.owner.user?.name,
          ownerEmail: data.owner.user?.person?.email,
        },
      };

      return {
        tokens: {
          accessToken: data.access_token,
          tokenType: data.token_type,
          // Notion tokens don't have refresh tokens or expiry by default
        },
        identity,
      };
    },

    // Notion doesn't support token refresh - tokens are long-lived
    refreshToken: undefined,

    async revokeToken({ accessToken }) {
      // Notion doesn't have a revoke endpoint
      // Users must revoke access through Notion settings
      logger.info('[Notion] Token revocation not supported - user must revoke in Notion settings');
    },

    async validateConnection({ accessToken }) {
      const response = await fetch(`${NOTION_API_URL}/users/me`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Notion-Version': '2022-06-28',
        },
      });

      if (!response.ok) {
        return { valid: false };
      }

      try {
        const data = await response.json() as {
          id: string;
          name?: string;
          type: string;
          bot?: { owner: { workspace: boolean; user?: { id: string } } };
        };

        return {
          valid: true,
          identity: {
            externalAccountId: data.id,
            externalAccountLabel: data.name ?? data.id,
            meta: { type: data.type },
          },
        };
      } catch {
        return { valid: false };
      }
    },

    async runSync({ connectionId, cursor, fullSync }) {
      // This would need the access token from the connection
      // For now, return a placeholder implementation
      const startTime = Date.now();

      try {
        // In a real implementation, fetch the access token from the connection
        // and use it to search/sync pages from Notion

        // Placeholder response
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
      } catch (error) {
        return {
          success: false,
          itemsSynced: 0,
          itemsCreated: 0,
          itemsUpdated: 0,
          itemsDeleted: 0,
          hasMore: false,
          error: error instanceof Error ? error.message : String(error),
          durationMs: Date.now() - startTime,
          syncedAt: new Date().toISOString(),
        };
      }
    },
  };
}

/**
 * Search Notion workspace
 */
export async function searchNotion(
  accessToken: string,
  options: {
    query?: string;
    filter?: { property: string; value: string };
    startCursor?: string;
    pageSize?: number;
  } = {}
): Promise<NotionSearchResponse> {
  const response = await fetch('https://api.notion.com/v1/search', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'Notion-Version': '2022-06-28',
    },
    body: JSON.stringify({
      query: options.query,
      filter: options.filter,
      start_cursor: options.startCursor,
      page_size: options.pageSize ?? 100,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Notion search failed: ${response.status} - ${errorText}`);
  }

  return response.json() as Promise<NotionSearchResponse>;
}

export default createNotionProvider;
