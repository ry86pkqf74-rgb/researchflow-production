/**
 * Integration Provider Interface - Task 151, 159, 168, 177
 *
 * Unified interface for OAuth integrations with external services.
 */

// Import types from core package
import type {
  IntegrationProvider,
  IntegrationProviderClient,
  OAuthTokenSet,
  ProviderIdentity,
  IntegrationSyncResult,
} from '@researchflow/core/src/types/integration';

// Re-export types for backwards compatibility
export type {
  IntegrationProvider,
  IntegrationProviderClient,
  OAuthTokenSet,
  ProviderIdentity,
  IntegrationSyncResult,
};

/**
 * Provider configuration
 */
export interface ProviderConfig {
  clientId: string;
  clientSecret: string;
  baseUrl?: string;
  scopes?: string[];
  additionalParams?: Record<string, string>;
}

/**
 * Provider registry
 */
const providers = new Map<IntegrationProvider, IntegrationProviderClient>();

/**
 * Register a provider client
 */
export function registerProvider(
  name: IntegrationProvider,
  client: IntegrationProviderClient
): void {
  providers.set(name, client);
}

/**
 * Get a registered provider client
 */
export function getProvider(name: IntegrationProvider): IntegrationProviderClient | undefined {
  return providers.get(name);
}

/**
 * Get all registered provider names
 */
export function getRegisteredProviders(): IntegrationProvider[] {
  return Array.from(providers.keys());
}

/**
 * Check if a provider is registered
 */
export function hasProvider(name: IntegrationProvider): boolean {
  return providers.has(name);
}

/**
 * Base provider class with common functionality
 */
export abstract class BaseProvider implements IntegrationProviderClient {
  abstract provider: IntegrationProvider;

  protected config: ProviderConfig;
  protected baseUrl: string;

  constructor(config: ProviderConfig) {
    this.config = config;
    this.baseUrl = config.baseUrl || '';
  }

  abstract startOAuth(params: {
    userId: string;
    redirectUri: string;
    scopes?: string[];
    state?: string;
  }): Promise<{
    authorizationUrl: string;
    state: string;
    codeVerifier?: string;
  }>;

  abstract finishOAuth(params: {
    code: string;
    state: string;
    redirectUri: string;
    codeVerifier?: string;
  }): Promise<{
    tokens: OAuthTokenSet;
    identity: ProviderIdentity;
  }>;

  /**
   * Generate a cryptographically secure state parameter
   */
  protected generateState(): string {
    const crypto = require('crypto');
    return crypto.randomBytes(24).toString('hex');
  }

  /**
   * Generate PKCE code verifier and challenge
   */
  protected generatePKCE(): { codeVerifier: string; codeChallenge: string } {
    const crypto = require('crypto');
    const codeVerifier = crypto.randomBytes(32).toString('base64url');
    const codeChallenge = crypto
      .createHash('sha256')
      .update(codeVerifier)
      .digest('base64url');
    return { codeVerifier, codeChallenge };
  }

  /**
   * Make HTTP request to provider API
   */
  protected async fetchProvider<T>(
    url: string,
    options: RequestInit = {}
  ): Promise<T> {
    const response = await fetch(url, {
      ...options,
      headers: {
        'Accept': 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Provider API error: ${response.status} ${response.statusText} - ${errorText}`
      );
    }

    return response.json() as Promise<T>;
  }
}

export default providers;
