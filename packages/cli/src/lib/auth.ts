/**
 * CLI Authentication Library (Task 91)
 *
 * Handles authentication token storage and management.
 * Stores tokens securely using the conf library.
 */

import Conf from 'conf';

interface AuthConfig {
  apiToken?: string;
  apiUrl?: string;
  selectedOrgId?: string;
  selectedOrgSlug?: string;
}

const config = new Conf<AuthConfig>({
  projectName: 'researchflow-cli',
  schema: {
    apiToken: { type: 'string' },
    apiUrl: { type: 'string', default: 'http://localhost:3001' },
    selectedOrgId: { type: 'string' },
    selectedOrgSlug: { type: 'string' },
  },
});

/**
 * Get the API URL from config or environment
 */
export function getApiUrl(): string {
  return process.env.RFC_API_URL || config.get('apiUrl') || 'http://localhost:3001';
}

/**
 * Get the stored API token
 */
export function getApiToken(): string | undefined {
  return process.env.RFC_API_TOKEN || config.get('apiToken');
}

/**
 * Store the API token
 */
export function setApiToken(token: string): void {
  config.set('apiToken', token);
}

/**
 * Clear the stored API token
 */
export function clearApiToken(): void {
  config.delete('apiToken');
}

/**
 * Get the selected organization ID
 */
export function getSelectedOrgId(): string | undefined {
  return config.get('selectedOrgId');
}

/**
 * Get the selected organization slug
 */
export function getSelectedOrgSlug(): string | undefined {
  return config.get('selectedOrgSlug');
}

/**
 * Set the selected organization
 */
export function setSelectedOrg(orgId: string, orgSlug: string): void {
  config.set('selectedOrgId', orgId);
  config.set('selectedOrgSlug', orgSlug);
}

/**
 * Clear the selected organization
 */
export function clearSelectedOrg(): void {
  config.delete('selectedOrgId');
  config.delete('selectedOrgSlug');
}

/**
 * Check if authenticated
 */
export function isAuthenticated(): boolean {
  return !!getApiToken();
}

/**
 * Get the full config path
 */
export function getConfigPath(): string {
  return config.path;
}

/**
 * Set API URL
 */
export function setApiUrl(url: string): void {
  config.set('apiUrl', url);
}
