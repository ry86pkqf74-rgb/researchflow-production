/**
 * Integrations Hub - Tasks 151, 159, 168, 174, 177
 *
 * Central registry for all OAuth integration providers.
 */

import {
  registerProvider,
  getProvider,
  getRegisteredProviders,
  hasProvider,
  type IntegrationProvider,
  type IntegrationProviderClient,
  type ProviderConfig,
} from './provider';

import { createOrcidProvider } from './providers/orcid';
import { createNotionProvider } from './providers/notion';
import { createSalesforceProvider } from './providers/salesforce';
import { createZoomProvider } from './providers/zoom';
import { logger } from '../logger/file-logger.js';

// Re-export types
export type {
  IntegrationProvider,
  IntegrationProviderClient,
  ProviderConfig,
};

// Re-export provider functions
export {
  registerProvider,
  getProvider,
  getRegisteredProviders,
  hasProvider,
};

// Re-export provider factories
export {
  createOrcidProvider,
  createNotionProvider,
  createSalesforceProvider,
  createZoomProvider,
};

/**
 * Initialize all configured providers
 */
export function initializeProviders(): void {
  // ORCID
  if (process.env.ORCID_CLIENT_ID && process.env.ORCID_CLIENT_SECRET) {
    const orcidProvider = createOrcidProvider({
      clientId: process.env.ORCID_CLIENT_ID,
      clientSecret: process.env.ORCID_CLIENT_SECRET,
      sandbox: process.env.ORCID_SANDBOX === 'true',
    });
    registerProvider('orcid', orcidProvider);
    logger.info('[Integrations] ORCID provider registered');
  }

  // Notion
  if (process.env.NOTION_CLIENT_ID && process.env.NOTION_CLIENT_SECRET) {
    const notionProvider = createNotionProvider({
      clientId: process.env.NOTION_CLIENT_ID,
      clientSecret: process.env.NOTION_CLIENT_SECRET,
    });
    registerProvider('notion', notionProvider);
    logger.info('[Integrations] Notion provider registered');
  }

  // Salesforce
  if (process.env.SALESFORCE_CLIENT_ID && process.env.SALESFORCE_CLIENT_SECRET) {
    const salesforceProvider = createSalesforceProvider({
      clientId: process.env.SALESFORCE_CLIENT_ID,
      clientSecret: process.env.SALESFORCE_CLIENT_SECRET,
      loginBaseUrl: process.env.SALESFORCE_LOGIN_BASE,
    });
    registerProvider('salesforce', salesforceProvider);
    logger.info('[Integrations] Salesforce provider registered');
  }

  // Zoom
  if (process.env.ZOOM_CLIENT_ID && process.env.ZOOM_CLIENT_SECRET) {
    const zoomProvider = createZoomProvider({
      clientId: process.env.ZOOM_CLIENT_ID,
      clientSecret: process.env.ZOOM_CLIENT_SECRET,
      accountId: process.env.ZOOM_ACCOUNT_ID,
      serverToServer: process.env.ZOOM_S2S === 'true',
    });
    registerProvider('zoom', zoomProvider);
    logger.info('[Integrations] Zoom provider registered');
  }

  logger.info(`[Integrations] ${getRegisteredProviders().length} providers initialized`);
}

/**
 * Get OAuth redirect URI for a provider
 */
export function getOAuthRedirectUri(provider: IntegrationProvider): string {
  const baseUrl = process.env.API_BASE_URL ?? 'http://localhost:3001';
  return `${baseUrl}/api/integrations/${provider}/callback`;
}

/**
 * Check if a provider is available
 */
export function isProviderAvailable(provider: IntegrationProvider): boolean {
  return hasProvider(provider);
}

/**
 * Get list of available providers with their status
 */
export function getProviderStatus(): Array<{
  provider: IntegrationProvider;
  available: boolean;
  configured: boolean;
}> {
  const allProviders: IntegrationProvider[] = [
    'orcid',
    'notion',
    'salesforce',
    'zoom',
    'jira',
    'zapier',
    'github',
    'google_scholar',
    'apple_health',
  ];

  return allProviders.map(provider => ({
    provider,
    available: hasProvider(provider),
    configured: hasProvider(provider),
  }));
}

export default {
  initializeProviders,
  getOAuthRedirectUri,
  isProviderAvailable,
  getProviderStatus,
  registerProvider,
  getProvider,
  getRegisteredProviders,
  hasProvider,
};
