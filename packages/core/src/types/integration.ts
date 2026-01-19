/**
 * Integration Types - Tasks 151, 159, 168, 174, 177
 *
 * Defines types for OAuth integrations and external service connections.
 */

/**
 * OAuth token set returned from provider
 */
export interface OAuthTokenSet {
  /** Access token for API calls */
  accessToken: string;
  /** Refresh token for token renewal */
  refreshToken?: string;
  /** Token expiration timestamp (ISO 8601) */
  expiresAt?: string;
  /** Granted scopes */
  scope?: string;
  /** Token type (usually 'Bearer') */
  tokenType?: string;
  /** ID token for OIDC providers */
  idToken?: string;
}

/**
 * Provider-specific identity information
 */
export interface ProviderIdentity {
  /** External account ID from provider */
  externalAccountId: string;
  /** Human-readable label (e.g., email, username) */
  externalAccountLabel?: string;
  /** Provider-specific metadata */
  meta?: Record<string, unknown>;
}

/**
 * Supported integration providers
 */
export type IntegrationProvider =
  | 'orcid'
  | 'notion'
  | 'salesforce'
  | 'zoom'
  | 'apple_health'
  | 'jira'
  | 'zapier'
  | 'github'
  | 'google_scholar';

/**
 * Integration provider client interface
 */
export interface IntegrationProviderClient {
  /** Provider identifier */
  provider: IntegrationProvider;

  /**
   * Start OAuth flow - generate authorization URL
   */
  startOAuth(params: {
    userId: string;
    redirectUri: string;
    scopes?: string[];
    state?: string;
  }): Promise<{
    authorizationUrl: string;
    state: string;
    codeVerifier?: string; // For PKCE
  }>;

  /**
   * Complete OAuth flow - exchange code for tokens
   */
  finishOAuth(params: {
    code: string;
    state: string;
    redirectUri: string;
    codeVerifier?: string;
  }): Promise<{
    tokens: OAuthTokenSet;
    identity: ProviderIdentity;
  }>;

  /**
   * Refresh expired access token
   */
  refreshToken?(params: {
    refreshToken: string;
  }): Promise<OAuthTokenSet>;

  /**
   * Revoke tokens and disconnect
   */
  revokeToken?(params: {
    accessToken?: string;
    refreshToken?: string;
  }): Promise<void>;

  /**
   * Run sync operation for this provider
   */
  runSync?(params: {
    connectionId: string;
    cursor?: string;
    fullSync?: boolean;
  }): Promise<IntegrationSyncResult>;

  /**
   * Validate connection is still active
   */
  validateConnection?(params: {
    accessToken: string;
  }): Promise<{
    valid: boolean;
    identity?: ProviderIdentity;
  }>;
}

/**
 * OAuth connection stored in database
 */
export interface OAuthConnection {
  /** Connection UUID */
  id: string;
  /** User who owns this connection */
  userId: string;
  /** Provider name */
  provider: IntegrationProvider;
  /** Connection status */
  status: 'connected' | 'disconnected' | 'expired' | 'error';
  /** External account ID */
  externalAccountId?: string;
  /** External account label */
  externalAccountLabel?: string;
  /** Encrypted token data (stored as base64) */
  tokenEncrypted: string;
  /** Provider-specific metadata */
  meta: Record<string, unknown>;
  /** Last sync timestamp */
  lastSyncAt?: string;
  /** Last sync cursor for incremental sync */
  lastSyncCursor?: string;
  /** Last error message */
  lastError?: string;
  /** Created timestamp */
  createdAt: string;
  /** Updated timestamp */
  updatedAt: string;
}

/**
 * Result of an integration sync operation
 */
export interface IntegrationSyncResult {
  /** Whether sync completed successfully */
  success: boolean;
  /** Number of items synced */
  itemsSynced: number;
  /** Number of items created */
  itemsCreated: number;
  /** Number of items updated */
  itemsUpdated: number;
  /** Number of items deleted */
  itemsDeleted: number;
  /** Cursor for next sync */
  nextCursor?: string;
  /** Whether there are more items to sync */
  hasMore: boolean;
  /** Error message if failed */
  error?: string;
  /** Sync duration in milliseconds */
  durationMs: number;
  /** Sync timestamp */
  syncedAt: string;
}

/**
 * Extension hook types (Task 174)
 */
export type ExtensionHookType =
  | 'beforeJobDispatch'
  | 'afterWorkerResult'
  | 'onManifestFinalized'
  | 'onIntegrationSync'
  | 'onQuarantineApplied'
  | 'onUserAction';

/**
 * Extension hook handler
 */
export interface ExtensionHook<T = unknown, R = void> {
  /** Hook name */
  name: string;
  /** Hook type */
  type: ExtensionHookType;
  /** Priority (lower = earlier execution) */
  priority?: number;
  /** Whether hook is enabled */
  enabled: boolean;
  /** Handler function */
  handler: (context: T) => Promise<R>;
  /** Timeout in milliseconds */
  timeoutMs?: number;
}

/**
 * Extension registry configuration
 */
export interface ExtensionConfig {
  /** Whether extensions are enabled */
  enabled: boolean;
  /** Allowed hook types */
  allowedHooks: ExtensionHookType[];
  /** Maximum execution time for all hooks */
  maxExecutionTimeMs: number;
  /** Whether to fail on hook error */
  failOnError: boolean;
}

export default IntegrationProviderClient;
