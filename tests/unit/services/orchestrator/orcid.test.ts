/**
 * ORCID Service Tests
 *
 * Tests for the ORCID integration service including:
 * - Configuration status handling
 * - Sandbox vs production URL selection
 * - Audit event logging
 * - Error handling
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  OrcidService,
  getOrcidService,
  OrcidNotConfiguredError,
  OrcidApiError,
  ORCID_URLS
} from '@apps/api-node/src/services/orcid';

// Mock the governance log module
vi.mock('@apps/api-node/utils/governance-log', () => ({
  createGovernanceLogEntry: vi.fn(() => ({
    id: 'test-log-id',
    eventType: 'ORCID_FETCHED',
    severity: 'INFO',
    timestamp: new Date().toISOString(),
    action: 'test action',
    entryHash: 'test-hash',
    immutable: false
  }))
}));

// Import the mocked module
import { createGovernanceLogEntry } from '@apps/api-node/utils/governance-log';

describe('OrcidService', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    // Reset environment variables before each test
    delete process.env.ORCID_CLIENT_ID;
    delete process.env.ORCID_CLIENT_SECRET;
    delete process.env.ORCID_SANDBOX;

    // Reset singleton instance
    OrcidService.resetInstance();

    // Clear all mocks
    vi.clearAllMocks();
  });

  afterEach(() => {
    // Restore original environment
    process.env = { ...originalEnv };
    OrcidService.resetInstance();
  });

  describe('Configuration Status', () => {
    it('should return unconfigured status when environment variables are not set', () => {
      const service = getOrcidService();
      const status = service.getConfigStatus();

      expect(status.configured).toBe(false);
      expect(status.message).toContain('not configured');
      expect(status.message).toContain('ORCID_CLIENT_ID');
      expect(status.message).toContain('ORCID_CLIENT_SECRET');
    });

    it('should return unconfigured when only CLIENT_ID is set', () => {
      process.env.ORCID_CLIENT_ID = 'test-client-id';
      OrcidService.resetInstance();

      const service = getOrcidService();
      const status = service.getConfigStatus();

      expect(status.configured).toBe(false);
      expect(service.isConfigured()).toBe(false);
    });

    it('should return unconfigured when only CLIENT_SECRET is set', () => {
      process.env.ORCID_CLIENT_SECRET = 'test-client-secret';
      OrcidService.resetInstance();

      const service = getOrcidService();
      const status = service.getConfigStatus();

      expect(status.configured).toBe(false);
      expect(service.isConfigured()).toBe(false);
    });

    it('should return configured status when both CLIENT_ID and CLIENT_SECRET are set', () => {
      process.env.ORCID_CLIENT_ID = 'test-client-id';
      process.env.ORCID_CLIENT_SECRET = 'test-client-secret';
      OrcidService.resetInstance();

      const service = getOrcidService();
      const status = service.getConfigStatus();

      expect(status.configured).toBe(true);
      expect(status.message).toContain('configured');
      expect(service.isConfigured()).toBe(true);
    });

    it('should not fail unrelated flows when unconfigured', () => {
      const service = getOrcidService();

      // These should not throw, just return status
      expect(() => service.getConfigStatus()).not.toThrow();
      expect(() => service.isConfigured()).not.toThrow();

      const status = service.getConfigStatus();
      expect(status).toBeDefined();
      expect(status.configured).toBe(false);
    });
  });

  describe('Sandbox vs Production URL Selection', () => {
    it('should use production URLs by default', () => {
      process.env.ORCID_CLIENT_ID = 'test-client-id';
      process.env.ORCID_CLIENT_SECRET = 'test-client-secret';
      // ORCID_SANDBOX not set
      OrcidService.resetInstance();

      const service = getOrcidService();
      const status = service.getConfigStatus();

      expect(status.sandbox).toBe(false);
      expect(status.baseUrl).toBe(ORCID_URLS.PRODUCTION_BASE);
      expect(status.apiUrl).toBe(ORCID_URLS.PRODUCTION_API);
      expect(status.message).toContain('production');
    });

    it('should use sandbox URLs when ORCID_SANDBOX=true', () => {
      process.env.ORCID_CLIENT_ID = 'test-client-id';
      process.env.ORCID_CLIENT_SECRET = 'test-client-secret';
      process.env.ORCID_SANDBOX = 'true';
      OrcidService.resetInstance();

      const service = getOrcidService();
      const status = service.getConfigStatus();

      expect(status.sandbox).toBe(true);
      expect(status.baseUrl).toBe(ORCID_URLS.SANDBOX_BASE);
      expect(status.apiUrl).toBe(ORCID_URLS.SANDBOX_API);
      expect(status.message).toContain('sandbox');
    });

    it('should use production URLs when ORCID_SANDBOX=false', () => {
      process.env.ORCID_CLIENT_ID = 'test-client-id';
      process.env.ORCID_CLIENT_SECRET = 'test-client-secret';
      process.env.ORCID_SANDBOX = 'false';
      OrcidService.resetInstance();

      const service = getOrcidService();
      const status = service.getConfigStatus();

      expect(status.sandbox).toBe(false);
      expect(status.baseUrl).toBe(ORCID_URLS.PRODUCTION_BASE);
      expect(status.apiUrl).toBe(ORCID_URLS.PRODUCTION_API);
    });

    it('should use production URLs for any value other than "true"', () => {
      process.env.ORCID_CLIENT_ID = 'test-client-id';
      process.env.ORCID_CLIENT_SECRET = 'test-client-secret';
      process.env.ORCID_SANDBOX = 'yes'; // Not exactly 'true'
      OrcidService.resetInstance();

      const service = getOrcidService();
      const status = service.getConfigStatus();

      expect(status.sandbox).toBe(false);
      expect(status.baseUrl).toBe(ORCID_URLS.PRODUCTION_BASE);
    });

    it('should have correct URL constants', () => {
      expect(ORCID_URLS.SANDBOX_BASE).toBe('https://sandbox.orcid.org');
      expect(ORCID_URLS.PRODUCTION_BASE).toBe('https://orcid.org');
      expect(ORCID_URLS.SANDBOX_API).toBe('https://api.sandbox.orcid.org/v3.0');
      expect(ORCID_URLS.PRODUCTION_API).toBe('https://api.orcid.org/v3.0');
    });
  });

  describe('Authorization URL Generation', () => {
    it('should throw OrcidNotConfiguredError when not configured', () => {
      const service = getOrcidService();

      expect(() =>
        service.getAuthorizationUrl('https://example.com/callback', 'test-state')
      ).toThrow(OrcidNotConfiguredError);
    });

    it('should generate correct authorization URL when configured', () => {
      process.env.ORCID_CLIENT_ID = 'test-client-id';
      process.env.ORCID_CLIENT_SECRET = 'test-client-secret';
      OrcidService.resetInstance();

      const service = getOrcidService();
      const authUrl = service.getAuthorizationUrl(
        'https://example.com/callback',
        'test-state'
      );

      expect(authUrl).toContain('https://orcid.org/oauth/authorize');
      expect(authUrl).toContain('client_id=test-client-id');
      expect(authUrl).toContain('response_type=code');
      expect(authUrl).toContain('redirect_uri=https%3A%2F%2Fexample.com%2Fcallback');
      expect(authUrl).toContain('state=test-state');
      expect(authUrl).toContain('scope=%2Fauthenticate');
    });

    it('should use sandbox URL when configured for sandbox', () => {
      process.env.ORCID_CLIENT_ID = 'test-client-id';
      process.env.ORCID_CLIENT_SECRET = 'test-client-secret';
      process.env.ORCID_SANDBOX = 'true';
      OrcidService.resetInstance();

      const service = getOrcidService();
      const authUrl = service.getAuthorizationUrl(
        'https://example.com/callback',
        'test-state'
      );

      expect(authUrl).toContain('https://sandbox.orcid.org/oauth/authorize');
    });

    it('should support custom scopes', () => {
      process.env.ORCID_CLIENT_ID = 'test-client-id';
      process.env.ORCID_CLIENT_SECRET = 'test-client-secret';
      OrcidService.resetInstance();

      const service = getOrcidService();
      const authUrl = service.getAuthorizationUrl(
        'https://example.com/callback',
        'test-state',
        '/read-limited'
      );

      expect(authUrl).toContain('scope=%2Fread-limited');
    });
  });

  describe('Error Handling', () => {
    it('should throw OrcidNotConfiguredError for token exchange when not configured', async () => {
      const service = getOrcidService();

      await expect(
        service.exchangeCodeForToken('test-code', 'https://example.com/callback')
      ).rejects.toThrow(OrcidNotConfiguredError);
    });

    it('should validate ORCID ID format', async () => {
      const service = getOrcidService();

      // Invalid formats
      await expect(service.fetchAuthorMetadata('invalid')).rejects.toThrow(OrcidApiError);
      await expect(service.fetchAuthorMetadata('1234-5678-9012-3456')).rejects.toThrow(); // Should pass format check but fail on API
      await expect(service.fetchAuthorMetadata('0000-0000-0000-000')).rejects.toThrow(OrcidApiError); // Too short
    });

    it('should accept valid ORCID ID formats', async () => {
      const service = getOrcidService();

      // Mock fetch to avoid actual API calls
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'Not Found'
      });

      // Valid formats (will fail on API call, but format validation should pass)
      await expect(service.fetchAuthorMetadata('0000-0000-0000-0000')).rejects.toThrow(OrcidApiError);
      await expect(service.fetchAuthorMetadata('0000-0000-0000-000X')).rejects.toThrow(OrcidApiError);

      // The errors should be about not finding the ORCID, not format
      try {
        await service.fetchAuthorMetadata('0000-0000-0000-0000');
      } catch (error) {
        expect((error as OrcidApiError).message).not.toContain('Invalid ORCID ID format');
      }
    });

    it('OrcidNotConfiguredError should have correct name', () => {
      const error = new OrcidNotConfiguredError();
      expect(error.name).toBe('OrcidNotConfiguredError');
      expect(error.message).toContain('not configured');
    });

    it('OrcidApiError should have correct properties', () => {
      const error = new OrcidApiError('Test error', 404);
      expect(error.name).toBe('OrcidApiError');
      expect(error.message).toBe('Test error');
      expect(error.statusCode).toBe(404);
    });
  });

  describe('Audit Event Logging', () => {
    beforeEach(() => {
      process.env.ORCID_CLIENT_ID = 'test-client-id';
      process.env.ORCID_CLIENT_SECRET = 'test-client-secret';
      OrcidService.resetInstance();
    });

    it('should log ORCID_FETCHED event on successful metadata fetch', async () => {
      const service = getOrcidService();

      // Mock successful API responses
      global.fetch = vi.fn()
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            name: {
              'given-names': { value: 'John' },
              'family-name': { value: 'Doe' }
            }
          })
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ 'affiliation-group': [] })
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ 'affiliation-group': [] })
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ group: [] })
        });

      await service.fetchAuthorMetadata('0000-0002-1825-0097');

      expect(createGovernanceLogEntry).toHaveBeenCalledWith(
        'ORCID_FETCHED',
        'ORCID author metadata fetched',
        expect.objectContaining({
          resourceType: 'orcid',
          resourceId: '0000-0002-1825-0097',
          details: expect.objectContaining({
            orcidId: '0000-0002-1825-0097'
          })
        })
      );
    });

    it('should log ORCID_VERIFIED event on successful token exchange', async () => {
      const service = getOrcidService();

      // Mock successful token exchange
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          access_token: 'test-token',
          token_type: 'bearer',
          expires_in: 3600,
          scope: '/authenticate',
          orcid: '0000-0002-1825-0097',
          name: 'John Doe'
        })
      });

      await service.exchangeCodeForToken('test-code', 'https://example.com/callback');

      expect(createGovernanceLogEntry).toHaveBeenCalledWith(
        'ORCID_VERIFIED',
        'ORCID ownership verified via OAuth',
        expect.objectContaining({
          resourceType: 'orcid',
          resourceId: '0000-0002-1825-0097',
          details: expect.objectContaining({
            orcidId: '0000-0002-1825-0097',
            name: 'John Doe',
            scope: '/authenticate'
          })
        })
      );
    });
  });

  describe('Singleton Pattern', () => {
    it('should return the same instance on multiple calls', () => {
      const instance1 = getOrcidService();
      const instance2 = getOrcidService();

      expect(instance1).toBe(instance2);
    });

    it('should return different instance after reset', () => {
      const instance1 = getOrcidService();
      OrcidService.resetInstance();
      const instance2 = getOrcidService();

      expect(instance1).not.toBe(instance2);
    });
  });

  describe('Fetch Author Metadata', () => {
    beforeEach(() => {
      process.env.ORCID_CLIENT_ID = 'test-client-id';
      process.env.ORCID_CLIENT_SECRET = 'test-client-secret';
      OrcidService.resetInstance();
    });

    it('should fetch and parse author metadata correctly', async () => {
      const service = getOrcidService();

      // Mock API responses
      global.fetch = vi.fn()
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            name: {
              'given-names': { value: 'Jane' },
              'family-name': { value: 'Smith' },
              'credit-name': { value: 'J. Smith, PhD' }
            }
          })
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            'affiliation-group': [{
              summaries: [{
                'employment-summary': {
                  organization: { name: 'Test University' },
                  'role-title': 'Professor',
                  'department-name': 'Computer Science',
                  'start-date': { year: { value: '2020' }, month: { value: '01' } }
                }
              }]
            }]
          })
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            'affiliation-group': [{
              summaries: [{
                'education-summary': {
                  organization: { name: 'Harvard' },
                  'role-title': 'PhD Student',
                  'start-date': { year: { value: '2015' } },
                  'end-date': { year: { value: '2019' } }
                }
              }]
            }]
          })
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            group: [{
              'work-summary': [{
                'put-code': 12345,
                title: { title: { value: 'Test Publication' } },
                type: 'journal-article',
                'publication-date': { year: { value: '2023' }, month: { value: '06' } },
                'journal-title': { value: 'Nature' },
                'external-ids': {
                  'external-id': [
                    { 'external-id-type': 'doi', 'external-id-value': '10.1234/test' }
                  ]
                }
              }]
            }]
          })
        });

      const metadata = await service.fetchAuthorMetadata('0000-0002-1825-0097');

      expect(metadata.orcidId).toBe('0000-0002-1825-0097');
      expect(metadata.name.givenNames).toBe('Jane');
      expect(metadata.name.familyName).toBe('Smith');
      expect(metadata.name.creditName).toBe('J. Smith, PhD');

      expect(metadata.affiliations).toHaveLength(2);
      expect(metadata.affiliations[0].type).toBe('employment');
      expect(metadata.affiliations[0].organizationName).toBe('Test University');
      expect(metadata.affiliations[0].role).toBe('Professor');
      expect(metadata.affiliations[0].current).toBe(true);

      expect(metadata.affiliations[1].type).toBe('education');
      expect(metadata.affiliations[1].organizationName).toBe('Harvard');
      expect(metadata.affiliations[1].current).toBe(false);

      expect(metadata.works).toHaveLength(1);
      expect(metadata.works[0].title).toBe('Test Publication');
      expect(metadata.works[0].type).toBe('journal-article');
      expect(metadata.works[0].doi).toBe('10.1234/test');
      expect(metadata.works[0].journalTitle).toBe('Nature');

      expect(metadata.fetchedAt).toBeDefined();
    });

    it('should handle 404 errors for non-existent ORCID IDs', async () => {
      const service = getOrcidService();

      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'Not Found'
      });

      await expect(
        service.fetchAuthorMetadata('0000-0000-0000-0000')
      ).rejects.toThrow(OrcidApiError);

      try {
        await service.fetchAuthorMetadata('0000-0000-0000-0000');
      } catch (error) {
        expect((error as OrcidApiError).statusCode).toBe(404);
        expect((error as OrcidApiError).message).toContain('not found');
      }
    });

    it('should handle network errors gracefully', async () => {
      const service = getOrcidService();

      global.fetch = vi.fn().mockRejectedValueOnce(new Error('Network error'));

      await expect(
        service.fetchAuthorMetadata('0000-0002-1825-0097')
      ).rejects.toThrow(OrcidApiError);
    });

    it('should handle missing optional data gracefully', async () => {
      const service = getOrcidService();

      // Mock minimal API response
      global.fetch = vi.fn()
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            name: {
              'given-names': { value: 'Test' }
              // Missing family-name and credit-name
            }
          })
        })
        .mockResolvedValueOnce({
          ok: false, // Employments not available
          status: 403
        })
        .mockResolvedValueOnce({
          ok: false, // Educations not available
          status: 403
        })
        .mockResolvedValueOnce({
          ok: false, // Works not available
          status: 403
        });

      const metadata = await service.fetchAuthorMetadata('0000-0002-1825-0097');

      expect(metadata.name.givenNames).toBe('Test');
      expect(metadata.name.familyName).toBeNull();
      expect(metadata.name.creditName).toBeNull();
      expect(metadata.affiliations).toEqual([]);
      expect(metadata.works).toEqual([]);
    });
  });

  describe('Verify Ownership', () => {
    beforeEach(() => {
      process.env.ORCID_CLIENT_ID = 'test-client-id';
      process.env.ORCID_CLIENT_SECRET = 'test-client-secret';
      OrcidService.resetInstance();
    });

    it('should return verified result on successful token exchange', async () => {
      const service = getOrcidService();

      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          access_token: 'test-token',
          token_type: 'bearer',
          expires_in: 3600,
          scope: '/authenticate',
          orcid: '0000-0002-1825-0097',
          name: 'Test User'
        })
      });

      const result = await service.verifyOwnership('test-code', 'https://example.com/callback');

      expect(result.verified).toBe(true);
      expect(result.orcidId).toBe('0000-0002-1825-0097');
      expect(result.name).toBe('Test User');
      expect(result.verifiedAt).toBeDefined();
      expect(result.error).toBeUndefined();
    });

    it('should return unverified result on failed token exchange', async () => {
      const service = getOrcidService();

      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: false,
        status: 401,
        text: () => Promise.resolve('Invalid code')
      });

      const result = await service.verifyOwnership('invalid-code', 'https://example.com/callback');

      expect(result.verified).toBe(false);
      expect(result.orcidId).toBe('');
      expect(result.error).toBeDefined();
    });
  });
});
