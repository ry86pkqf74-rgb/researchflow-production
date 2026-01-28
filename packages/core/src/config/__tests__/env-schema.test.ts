/**
 * Environment Schema Validation Tests
 *
 * Tests for environment variable validation schema.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { envSchema, validateEnv, validateEnvSafe, getEnvValidationReport } from '../env-schema';
import { z } from 'zod';

describe('envSchema', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    // Save original environment
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    // Restore original environment
    process.env = originalEnv;
  });

  describe('Core Environment Variables', () => {
    it('should validate NODE_ENV enum values', () => {
      process.env.NODE_ENV = 'production';
      const result = envSchema.safeParse(process.env);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.NODE_ENV).toBe('production');
      }
    });

    it('should reject invalid NODE_ENV values', () => {
      process.env.NODE_ENV = 'staging';
      const result = envSchema.safeParse(process.env);
      expect(result.success).toBe(false);
    });

    it('should default NODE_ENV to development', () => {
      delete process.env.NODE_ENV;
      const result = envSchema.safeParse(process.env);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.NODE_ENV).toBe('development');
      }
    });
  });

  describe('Database Configuration', () => {
    it('should validate DATABASE_URL as valid URL', () => {
      process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/dbname';
      const result = envSchema.safeParse(process.env);
      expect(result.success).toBe(true);
    });

    it('should reject invalid DATABASE_URL', () => {
      process.env.DATABASE_URL = 'not-a-url';
      const result = envSchema.safeParse(process.env);
      expect(result.success).toBe(false);
    });

    it('should require POSTGRES_USER', () => {
      delete process.env.POSTGRES_USER;
      const result = envSchema.safeParse(process.env);
      expect(result.success).toBe(false);
    });

    it('should validate POSTGRES_PASSWORD entropy if provided', () => {
      process.env.POSTGRES_PASSWORD = 'short';
      const result = envSchema.safeParse(process.env);
      expect(result.success).toBe(false);

      process.env.POSTGRES_PASSWORD = 'a'.repeat(32);
      const result2 = envSchema.safeParse(process.env);
      expect(result2.success).toBe(true);
    });
  });

  describe('Authentication & Security', () => {
    it('should require JWT_SECRET', () => {
      delete process.env.JWT_SECRET;
      const result = envSchema.safeParse(process.env);
      expect(result.success).toBe(false);
    });

    it('should enforce JWT_SECRET entropy (32+ chars)', () => {
      process.env.JWT_SECRET = 'tooshort';
      const result = envSchema.safeParse(process.env);
      expect(result.success).toBe(false);

      process.env.JWT_SECRET = 'a'.repeat(32);
      const result2 = envSchema.safeParse(process.env);
      expect(result2.success).toBe(true);
    });

    it('should parse JWT_EXPIRES_IN with default', () => {
      delete process.env.JWT_EXPIRES_IN;
      const result = envSchema.safeParse(process.env);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.JWT_EXPIRES_IN).toBe('24h');
      }
    });

    it('should convert AUTH_ALLOW_STATELESS_JWT to boolean', () => {
      process.env.AUTH_ALLOW_STATELESS_JWT = 'true';
      const result = envSchema.safeParse(process.env);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.AUTH_ALLOW_STATELESS_JWT).toBe(true);
      }
    });
  });

  describe('Admin Emails Validation', () => {
    it('should parse comma-separated admin emails', () => {
      process.env.ADMIN_EMAILS = 'admin1@example.com,admin2@example.com';
      const result = envSchema.safeParse(process.env);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.ADMIN_EMAILS).toEqual(['admin1@example.com', 'admin2@example.com']);
      }
    });

    it('should reject invalid email addresses', () => {
      process.env.ADMIN_EMAILS = 'notanemail,valid@example.com';
      const result = envSchema.safeParse(process.env);
      expect(result.success).toBe(false);
    });

    it('should be optional', () => {
      delete process.env.ADMIN_EMAILS;
      const result = envSchema.safeParse(process.env);
      expect(result.success).toBe(true);
    });
  });

  describe('API Keys Validation', () => {
    it('should accept optional API keys if provided', () => {
      process.env.OPENAI_API_KEY = 'sk-test-key';
      const result = envSchema.safeParse(process.env);
      expect(result.success).toBe(true);
    });

    it('should reject empty API keys', () => {
      process.env.OPENAI_API_KEY = '';
      const result = envSchema.safeParse(process.env);
      expect(result.success).toBe(false);
    });

    it('should allow all API keys to be undefined', () => {
      delete process.env.OPENAI_API_KEY;
      delete process.env.ANTHROPIC_API_KEY;
      const result = envSchema.safeParse(process.env);
      expect(result.success).toBe(true);
    });
  });

  describe('Numeric Configurations', () => {
    it('should parse numeric strings to numbers', () => {
      process.env.LARGE_FILE_BYTES = '52428800';
      const result = envSchema.safeParse(process.env);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.LARGE_FILE_BYTES).toBe(52428800);
      }
    });

    it('should use default numeric values when not provided', () => {
      delete process.env.CHUNK_SIZE_ROWS;
      const result = envSchema.safeParse(process.env);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.CHUNK_SIZE_ROWS).toBe(500000);
      }
    });

    it('should reject non-numeric values for numeric fields', () => {
      process.env.AI_MAX_RETRIES = 'not-a-number';
      const result = envSchema.safeParse(process.env);
      expect(result.success).toBe(false);
    });
  });

  describe('Boolean Conversions', () => {
    it('should convert "true" string to boolean true', () => {
      process.env.ENABLE_WEB_SEARCH = 'true';
      const result = envSchema.safeParse(process.env);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.ENABLE_WEB_SEARCH).toBe(true);
      }
    });

    it('should convert non-"true" to false', () => {
      process.env.ENABLE_WEB_SEARCH = 'false';
      const result = envSchema.safeParse(process.env);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.ENABLE_WEB_SEARCH).toBe(false);
      }
    });

    it('should use default boolean values', () => {
      delete process.env.PHI_SCAN_ENABLED;
      const result = envSchema.safeParse(process.env);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.PHI_SCAN_ENABLED).toBe(true);
      }
    });
  });

  describe('Enum Validations', () => {
    it('should validate GOVERNANCE_MODE enum', () => {
      process.env.GOVERNANCE_MODE = 'LIVE';
      const result = envSchema.safeParse(process.env);
      expect(result.success).toBe(true);

      process.env.GOVERNANCE_MODE = 'STANDBY';
      const result2 = envSchema.safeParse(process.env);
      expect(result2.success).toBe(true);
    });

    it('should reject invalid GOVERNANCE_MODE', () => {
      process.env.GOVERNANCE_MODE = 'INVALID';
      const result = envSchema.safeParse(process.env);
      expect(result.success).toBe(false);
    });

    it('should validate CHAT_AGENT_PROVIDER enum', () => {
      process.env.CHAT_AGENT_PROVIDER = 'openai';
      const result = envSchema.safeParse(process.env);
      expect(result.success).toBe(true);

      process.env.CHAT_AGENT_PROVIDER = 'anthropic';
      const result2 = envSchema.safeParse(process.env);
      expect(result2.success).toBe(true);
    });

    it('should validate AI_DEFAULT_TIER enum', () => {
      process.env.AI_DEFAULT_TIER = 'MINI';
      const result = envSchema.safeParse(process.env);
      expect(result.success).toBe(true);
    });
  });

  describe('Range Validations', () => {
    it('should validate quality score threshold 0-1', () => {
      process.env.MIN_QUALITY_SCORE_THRESHOLD = '0.7';
      const result = envSchema.safeParse(process.env);
      expect(result.success).toBe(true);

      process.env.MIN_QUALITY_SCORE_THRESHOLD = '1.5';
      const result2 = envSchema.safeParse(process.env);
      expect(result2.success).toBe(false);
    });

    it('should require positive numbers for counts', () => {
      process.env.AI_MAX_RETRIES = '0';
      const result = envSchema.safeParse(process.env);
      expect(result.success).toBe(false); // Must be > 0 for retries

      process.env.AI_MAX_RETRIES = '3';
      const result2 = envSchema.safeParse(process.env);
      expect(result2.success).toBe(true);
    });
  });

  describe('CORS Whitelist Validation', () => {
    it('should parse comma-separated URL list', () => {
      process.env.CORS_WHITELIST = 'https://example.com,https://api.example.com';
      const result = envSchema.safeParse(process.env);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.CORS_WHITELIST).toEqual(['https://example.com', 'https://api.example.com']);
      }
    });

    it('should reject invalid URLs in list', () => {
      process.env.CORS_WHITELIST = 'not-a-url,https://valid.com';
      const result = envSchema.safeParse(process.env);
      expect(result.success).toBe(false);
    });

    it('should be optional', () => {
      delete process.env.CORS_WHITELIST;
      const result = envSchema.safeParse(process.env);
      expect(result.success).toBe(true);
    });
  });

  describe('UUID Validations', () => {
    it('should validate UUID format for database IDs', () => {
      process.env.NOTION_API_USAGE_TRACKER_DB = '96fe5bba-d3fe-4384-ae9c-0def8a83424d';
      const result = envSchema.safeParse(process.env);
      expect(result.success).toBe(true);
    });

    it('should reject invalid UUID format', () => {
      process.env.NOTION_API_USAGE_TRACKER_DB = 'not-a-uuid';
      const result = envSchema.safeParse(process.env);
      expect(result.success).toBe(false);
    });

    it('should be optional', () => {
      delete process.env.NOTION_API_USAGE_TRACKER_DB;
      const result = envSchema.safeParse(process.env);
      expect(result.success).toBe(true);
    });
  });

  describe('validateEnv function', () => {
    it('should throw ZodError on validation failure', () => {
      process.env.NODE_ENV = 'invalid';
      expect(() => validateEnv()).toThrow();
    });

    it('should return validated env object on success', () => {
      process.env.NODE_ENV = 'production';
      process.env.POSTGRES_USER = 'user';
      process.env.POSTGRES_DB = 'db';
      process.env.DATABASE_URL = 'postgresql://user:pass@localhost/db';
      process.env.JWT_SECRET = 'a'.repeat(32);

      const env = validateEnv();
      expect(env.NODE_ENV).toBe('production');
      expect(env.JWT_SECRET).toBe('a'.repeat(32));
    });

    it('should include validation error messages', () => {
      process.env.JWT_SECRET = 'tooshort';
      try {
        validateEnv();
        expect.fail('Should have thrown');
      } catch (error) {
        if (error instanceof Error) {
          expect(error.message).toContain('JWT_SECRET');
          expect(error.message).toContain('32');
        }
      }
    });
  });

  describe('validateEnvSafe function', () => {
    it('should return success true on valid env', () => {
      process.env.POSTGRES_USER = 'user';
      process.env.POSTGRES_DB = 'db';
      process.env.DATABASE_URL = 'postgresql://user:pass@localhost/db';
      process.env.JWT_SECRET = 'a'.repeat(32);

      const result = validateEnvSafe();
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
    });

    it('should return success false and errors on validation failure', () => {
      process.env.JWT_SECRET = 'tooshort';
      process.env.NODE_ENV = 'invalid';

      const result = validateEnvSafe();
      expect(result.success).toBe(false);
      expect(result.errors).toBeDefined();
      expect(Object.keys(result.errors || {})).toContain('JWT_SECRET');
    });

    it('should not throw', () => {
      process.env.JWT_SECRET = 'tooshort';
      expect(() => validateEnvSafe()).not.toThrow();
    });
  });

  describe('getEnvValidationReport function', () => {
    it('should return PASS status on valid env', () => {
      process.env.POSTGRES_USER = 'user';
      process.env.POSTGRES_DB = 'db';
      process.env.DATABASE_URL = 'postgresql://user:pass@localhost/db';
      process.env.JWT_SECRET = 'a'.repeat(32);

      const report = getEnvValidationReport();
      expect(report.validationStatus).toBe('PASS');
      expect(report.issues.length).toBe(0);
    });

    it('should return FAIL status on invalid env', () => {
      process.env.JWT_SECRET = 'tooshort';
      const report = getEnvValidationReport();
      expect(report.validationStatus).toBe('FAIL');
      expect(report.issues.length).toBeGreaterThan(0);
    });

    it('should include timestamp and nodeEnv', () => {
      process.env.NODE_ENV = 'production';
      const report = getEnvValidationReport();

      expect(report.timestamp).toBeDefined();
      expect(report.nodeEnv).toBe('production');
      expect(new Date(report.timestamp).getTime()).toBeGreaterThan(0);
    });

    it('should track required and optional variables', () => {
      process.env.POSTGRES_USER = 'user';
      process.env.POSTGRES_DB = 'db';
      process.env.DATABASE_URL = 'postgresql://user:pass@localhost/db';
      process.env.JWT_SECRET = 'a'.repeat(32);

      const report = getEnvValidationReport();

      expect(report.requiredVariables.NODE_ENV).toBeDefined();
      expect(report.requiredVariables.DATABASE_URL).toBeDefined();
      expect(report.optionalVariables.OPENAI_API_KEY).toBeDefined();
    });
  });

  describe('Type Safety', () => {
    it('should infer correct types for validated env', () => {
      process.env.POSTGRES_USER = 'user';
      process.env.POSTGRES_DB = 'db';
      process.env.DATABASE_URL = 'postgresql://user:pass@localhost/db';
      process.env.JWT_SECRET = 'a'.repeat(32);

      const env = validateEnv();

      // These should all be correctly typed
      const nodeEnv: 'development' | 'production' | 'test' = env.NODE_ENV;
      const jwt: string = env.JWT_SECRET;
      const openaiKey: string | undefined = env.OPENAI_API_KEY;
      const debugFlag: boolean = env.DEBUG;

      expect(nodeEnv).toBeDefined();
      expect(jwt).toBeDefined();
    });
  });

  describe('Complex Scenario', () => {
    it('should validate production configuration', () => {
      process.env.NODE_ENV = 'production';
      process.env.ENVIRONMENT = 'prod';
      process.env.DATABASE_URL = 'postgresql://prod_user:secure_pass@prod-db.example.com/prod_db';
      process.env.POSTGRES_USER = 'prod_user';
      process.env.POSTGRES_DB = 'prod_db';
      process.env.JWT_SECRET = 'x'.repeat(64);
      process.env.GOVERNANCE_MODE = 'LIVE';
      process.env.PHI_FAIL_CLOSED = 'true';
      process.env.OPENAI_API_KEY = 'sk-prod-key';
      process.env.CORS_WHITELIST = 'https://app.example.com,https://api.example.com';
      process.env.ADMIN_EMAILS = 'admin@example.com,support@example.com';

      const result = validateEnvSafe();
      expect(result.success).toBe(true);

      if (result.success) {
        expect(result.data.NODE_ENV).toBe('production');
        expect(result.data.GOVERNANCE_MODE).toBe('LIVE');
        expect(result.data.PHI_FAIL_CLOSED).toBe(true);
        expect(result.data.CORS_WHITELIST).toHaveLength(2);
        expect(result.data.ADMIN_EMAILS).toHaveLength(2);
      }
    });

    it('should validate development configuration with minimal setup', () => {
      process.env.NODE_ENV = 'development';
      process.env.DATABASE_URL = 'postgresql://localhost/dev_db';
      process.env.POSTGRES_USER = 'dev_user';
      process.env.POSTGRES_DB = 'dev_db';
      process.env.JWT_SECRET = 'a'.repeat(32);
      process.env.DEBUG = 'true';

      const result = validateEnvSafe();
      expect(result.success).toBe(true);

      if (result.success) {
        expect(result.data.DEBUG).toBe(true);
        expect(result.data.GOVERNANCE_MODE).toBe('LIVE'); // default
      }
    });
  });
});
