/**
 * HashiCorp Vault Client for Secrets Management (Task 70)
 *
 * Provides secure secrets management with:
 * - Dynamic secrets rotation
 * - Database credential generation
 * - API key management
 * - Audit logging for secret access
 *
 * Security Model:
 * - Never logs secret values
 * - Uses AppRole authentication
 * - Supports lease renewal
 * - Automatic credential rotation
 *
 * Feature Flag: VAULT_ENABLED (default: false)
 */

import { logAction } from './audit-service';

// Configuration from environment
const VAULT_ENABLED = process.env.VAULT_ENABLED === 'true';
const VAULT_ADDR = process.env.VAULT_ADDR || 'http://vault:8200';
const VAULT_NAMESPACE = process.env.VAULT_NAMESPACE || 'researchflow';
const VAULT_ROLE_ID = process.env.VAULT_ROLE_ID || '';
const VAULT_SECRET_ID = process.env.VAULT_SECRET_ID || '';
const VAULT_TOKEN = process.env.VAULT_TOKEN || '';

// Lease renewal buffer (renew when 30% of TTL remains)
const LEASE_RENEWAL_BUFFER = 0.3;

/**
 * Vault secret response
 */
export interface VaultSecret {
  data: Record<string, string>;
  leaseId?: string;
  leaseDuration?: number;
  renewable?: boolean;
  metadata?: {
    createdTime: string;
    version: number;
  };
}

/**
 * Database credentials from Vault
 */
export interface DatabaseCredentials {
  username: string;
  password: string;
  leaseId: string;
  leaseDuration: number;
  expiresAt: Date;
}

/**
 * Vault lease tracking
 */
interface LeaseInfo {
  leaseId: string;
  expiresAt: Date;
  renewalTimer?: NodeJS.Timeout;
}

/**
 * Vault Client
 */
class VaultClient {
  private token: string | null = null;
  private tokenExpiry: Date | null = null;
  private leases: Map<string, LeaseInfo> = new Map();

  constructor() {
    if (VAULT_ENABLED && !VAULT_TOKEN && (!VAULT_ROLE_ID || !VAULT_SECRET_ID)) {
      console.warn('[VaultClient] Vault enabled but no authentication configured');
    }
  }

  /**
   * Check if Vault is enabled and configured
   */
  isEnabled(): boolean {
    return VAULT_ENABLED && (!!VAULT_TOKEN || (!!VAULT_ROLE_ID && !!VAULT_SECRET_ID));
  }

  /**
   * Authenticate with Vault using AppRole
   */
  private async authenticate(): Promise<void> {
    if (VAULT_TOKEN) {
      this.token = VAULT_TOKEN;
      return;
    }

    if (!VAULT_ROLE_ID || !VAULT_SECRET_ID) {
      throw new Error('Vault AppRole credentials not configured');
    }

    try {
      const response = await fetch(`${VAULT_ADDR}/v1/auth/approle/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(VAULT_NAMESPACE && { 'X-Vault-Namespace': VAULT_NAMESPACE }),
        },
        body: JSON.stringify({
          role_id: VAULT_ROLE_ID,
          secret_id: VAULT_SECRET_ID,
        }),
      });

      if (!response.ok) {
        throw new Error(`Vault authentication failed: ${response.status}`);
      }

      const data = await response.json();
      this.token = data.auth.client_token;
      this.tokenExpiry = new Date(Date.now() + data.auth.lease_duration * 1000);

      await logAction({
        eventType: 'VAULT',
        action: 'AUTHENTICATE',
        resourceType: 'vault',
        resourceId: 'approle',
        details: {
          leaseDuration: data.auth.lease_duration,
          renewable: data.auth.renewable,
        },
      });
    } catch (error) {
      await logAction({
        eventType: 'VAULT',
        action: 'AUTHENTICATE_FAILED',
        resourceType: 'vault',
        resourceId: 'approle',
        details: {
          error: error instanceof Error ? error.message : 'Unknown error',
        },
      });
      throw error;
    }
  }

  /**
   * Get authenticated token
   */
  private async getToken(): Promise<string> {
    if (!this.token || (this.tokenExpiry && this.tokenExpiry <= new Date())) {
      await this.authenticate();
    }
    return this.token!;
  }

  /**
   * Make authenticated request to Vault
   */
  private async request<T>(
    method: string,
    path: string,
    body?: unknown
  ): Promise<T> {
    const token = await this.getToken();

    const response = await fetch(`${VAULT_ADDR}/v1${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'X-Vault-Token': token,
        ...(VAULT_NAMESPACE && { 'X-Vault-Namespace': VAULT_NAMESPACE }),
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Vault request failed: ${response.status} - ${error}`);
    }

    return response.json();
  }

  /**
   * Read a secret from KV v2 secrets engine
   */
  async readSecret(path: string, mount: string = 'secret'): Promise<VaultSecret> {
    if (!this.isEnabled()) {
      throw new Error('Vault is not enabled');
    }

    try {
      const response = await this.request<{
        data: { data: Record<string, string>; metadata: VaultSecret['metadata'] };
      }>('GET', `/${mount}/data/${path}`);

      await logAction({
        eventType: 'VAULT',
        action: 'READ_SECRET',
        resourceType: 'secret',
        resourceId: path,
        // Never log secret values
        details: {
          mount,
          version: response.data.metadata?.version,
        },
      });

      return {
        data: response.data.data,
        metadata: response.data.metadata,
      };
    } catch (error) {
      await logAction({
        eventType: 'VAULT',
        action: 'READ_SECRET_FAILED',
        resourceType: 'secret',
        resourceId: path,
        details: {
          mount,
          error: error instanceof Error ? error.message : 'Unknown error',
        },
      });
      throw error;
    }
  }

  /**
   * Write a secret to KV v2 secrets engine
   */
  async writeSecret(
    path: string,
    data: Record<string, string>,
    mount: string = 'secret'
  ): Promise<void> {
    if (!this.isEnabled()) {
      throw new Error('Vault is not enabled');
    }

    try {
      await this.request('POST', `/${mount}/data/${path}`, { data });

      await logAction({
        eventType: 'VAULT',
        action: 'WRITE_SECRET',
        resourceType: 'secret',
        resourceId: path,
        // Never log secret values, only log key names
        details: {
          mount,
          keys: Object.keys(data),
        },
      });
    } catch (error) {
      await logAction({
        eventType: 'VAULT',
        action: 'WRITE_SECRET_FAILED',
        resourceType: 'secret',
        resourceId: path,
        details: {
          mount,
          error: error instanceof Error ? error.message : 'Unknown error',
        },
      });
      throw error;
    }
  }

  /**
   * Get dynamic database credentials
   */
  async getDatabaseCredentials(role: string = 'researchflow-app'): Promise<DatabaseCredentials> {
    if (!this.isEnabled()) {
      throw new Error('Vault is not enabled');
    }

    try {
      const response = await this.request<{
        lease_id: string;
        lease_duration: number;
        renewable: boolean;
        data: { username: string; password: string };
      }>('GET', `/database/creds/${role}`);

      const credentials: DatabaseCredentials = {
        username: response.data.username,
        password: response.data.password,
        leaseId: response.lease_id,
        leaseDuration: response.lease_duration,
        expiresAt: new Date(Date.now() + response.lease_duration * 1000),
      };

      // Track lease for renewal
      this.trackLease(response.lease_id, credentials.expiresAt);

      await logAction({
        eventType: 'VAULT',
        action: 'GET_DB_CREDENTIALS',
        resourceType: 'database',
        resourceId: role,
        // Never log credentials
        details: {
          leaseId: response.lease_id.substring(0, 8) + '...',
          leaseDuration: response.lease_duration,
        },
      });

      return credentials;
    } catch (error) {
      await logAction({
        eventType: 'VAULT',
        action: 'GET_DB_CREDENTIALS_FAILED',
        resourceType: 'database',
        resourceId: role,
        details: {
          error: error instanceof Error ? error.message : 'Unknown error',
        },
      });
      throw error;
    }
  }

  /**
   * Renew a lease
   */
  async renewLease(leaseId: string): Promise<number> {
    try {
      const response = await this.request<{
        lease_id: string;
        lease_duration: number;
        renewable: boolean;
      }>('PUT', '/sys/leases/renew', { lease_id: leaseId });

      // Update lease tracking
      const expiresAt = new Date(Date.now() + response.lease_duration * 1000);
      this.trackLease(leaseId, expiresAt);

      await logAction({
        eventType: 'VAULT',
        action: 'RENEW_LEASE',
        resourceType: 'lease',
        resourceId: leaseId.substring(0, 8) + '...',
        details: {
          newLeaseDuration: response.lease_duration,
        },
      });

      return response.lease_duration;
    } catch (error) {
      await logAction({
        eventType: 'VAULT',
        action: 'RENEW_LEASE_FAILED',
        resourceType: 'lease',
        resourceId: leaseId.substring(0, 8) + '...',
        details: {
          error: error instanceof Error ? error.message : 'Unknown error',
        },
      });
      throw error;
    }
  }

  /**
   * Revoke a lease
   */
  async revokeLease(leaseId: string): Promise<void> {
    try {
      await this.request('PUT', '/sys/leases/revoke', { lease_id: leaseId });

      // Remove from tracking
      const lease = this.leases.get(leaseId);
      if (lease?.renewalTimer) {
        clearTimeout(lease.renewalTimer);
      }
      this.leases.delete(leaseId);

      await logAction({
        eventType: 'VAULT',
        action: 'REVOKE_LEASE',
        resourceType: 'lease',
        resourceId: leaseId.substring(0, 8) + '...',
      });
    } catch (error) {
      await logAction({
        eventType: 'VAULT',
        action: 'REVOKE_LEASE_FAILED',
        resourceType: 'lease',
        resourceId: leaseId.substring(0, 8) + '...',
        details: {
          error: error instanceof Error ? error.message : 'Unknown error',
        },
      });
      throw error;
    }
  }

  /**
   * Track a lease for automatic renewal
   */
  private trackLease(leaseId: string, expiresAt: Date): void {
    // Clear existing timer
    const existing = this.leases.get(leaseId);
    if (existing?.renewalTimer) {
      clearTimeout(existing.renewalTimer);
    }

    // Calculate renewal time (when 30% of TTL remains)
    const ttlMs = expiresAt.getTime() - Date.now();
    const renewalTime = ttlMs * (1 - LEASE_RENEWAL_BUFFER);

    const renewalTimer = setTimeout(async () => {
      try {
        await this.renewLease(leaseId);
      } catch (error) {
        console.error(`[VaultClient] Failed to renew lease: ${leaseId}`, error);
      }
    }, renewalTime);

    this.leases.set(leaseId, {
      leaseId,
      expiresAt,
      renewalTimer,
    });
  }

  /**
   * Get transit-encrypted data (for sensitive field encryption)
   */
  async encrypt(plaintext: string, key: string = 'researchflow'): Promise<string> {
    if (!this.isEnabled()) {
      throw new Error('Vault is not enabled');
    }

    const response = await this.request<{
      data: { ciphertext: string };
    }>('POST', `/transit/encrypt/${key}`, {
      plaintext: Buffer.from(plaintext).toString('base64'),
    });

    return response.data.ciphertext;
  }

  /**
   * Get transit-decrypted data
   */
  async decrypt(ciphertext: string, key: string = 'researchflow'): Promise<string> {
    if (!this.isEnabled()) {
      throw new Error('Vault is not enabled');
    }

    const response = await this.request<{
      data: { plaintext: string };
    }>('POST', `/transit/decrypt/${key}`, { ciphertext });

    return Buffer.from(response.data.plaintext, 'base64').toString('utf-8');
  }

  /**
   * Rotate an encryption key
   */
  async rotateKey(key: string = 'researchflow'): Promise<void> {
    if (!this.isEnabled()) {
      throw new Error('Vault is not enabled');
    }

    await this.request('POST', `/transit/keys/${key}/rotate`);

    await logAction({
      eventType: 'VAULT',
      action: 'ROTATE_KEY',
      resourceType: 'transit_key',
      resourceId: key,
    });
  }

  /**
   * Clean up all tracked leases on shutdown
   */
  async cleanup(): Promise<void> {
    for (const [leaseId, lease] of this.leases.entries()) {
      if (lease.renewalTimer) {
        clearTimeout(lease.renewalTimer);
      }
      try {
        await this.revokeLease(leaseId);
      } catch {
        // Ignore errors during cleanup
      }
    }
    this.leases.clear();
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<{ healthy: boolean; sealed?: boolean; error?: string }> {
    if (!VAULT_ENABLED) {
      return { healthy: true, sealed: false };
    }

    try {
      const response = await fetch(`${VAULT_ADDR}/v1/sys/health`, {
        method: 'GET',
      });

      if (response.status === 200) {
        return { healthy: true, sealed: false };
      } else if (response.status === 503) {
        return { healthy: false, sealed: true };
      } else {
        return { healthy: false, error: `Unexpected status: ${response.status}` };
      }
    } catch (error) {
      return {
        healthy: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}

// Singleton instance
let vaultClient: VaultClient | null = null;

/**
 * Get the Vault client instance
 */
export function getVaultClient(): VaultClient {
  if (!vaultClient) {
    vaultClient = new VaultClient();
  }
  return vaultClient;
}

/**
 * Check if Vault is enabled
 */
export function isVaultEnabled(): boolean {
  return VAULT_ENABLED;
}

export { VaultClient };
export default getVaultClient;
