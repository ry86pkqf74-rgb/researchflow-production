/**
 * Environment Variable Validation Schema
 *
 * Provides centralized, type-safe environment variable validation with fail-fast behavior.
 * All environment variables are validated at application startup to ensure correct
 * configuration before any code execution.
 */

import { z } from 'zod';

/**
 * Validates that a string has sufficient entropy for cryptographic use.
 * Used for JWT secrets and passwords.
 */
const entropyCheck = z.string().refine(
  (val) => val.length >= 32,
  {
    message: 'Must be at least 32 characters for cryptographic security',
  }
);

/**
 * Validates port numbers (1-65535)
 */
const portNumber = z.coerce.number().int().min(1).max(65535);

/**
 * Validates API key format (non-empty string)
 */
const apiKey = z.string().min(1, 'API key cannot be empty');

/**
 * Validates comma-separated list of URLs
 */
const urlList = z
  .string()
  .transform((val) => val.split(',').map((v) => v.trim()))
  .refine((urls) => urls.length > 0, 'Must provide at least one URL')
  .refine(
    (urls) =>
      urls.every((url) => {
        try {
          new URL(url);
          return true;
        } catch {
          return false;
        }
      }),
    'All items must be valid URLs'
  );

/**
 * Validates email addresses (simple format)
 */
const emailAddress = z.string().email();

/**
 * Validates comma-separated list of email addresses
 */
const emailList = z
  .string()
  .transform((val) => val.split(',').map((v) => v.trim()))
  .refine((emails) => emails.length > 0, 'Must provide at least one email')
  .refine(
    (emails) =>
      emails.every((email) => {
        try {
          emailAddress.parse(email);
          return true;
        } catch {
          return false;
        }
      }),
    'All items must be valid email addresses'
  );

/**
 * Main environment schema covering all critical variables
 */
export const envSchema = z.object({
  // Node Environment
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  ENVIRONMENT: z.enum(['dev', 'test', 'prod']).default('dev'),

  // Database Configuration
  DATABASE_URL: z.string().url('Invalid database URL format'),
  POSTGRES_USER: z.string().min(1, 'PostgreSQL username is required'),
  POSTGRES_PASSWORD: entropyCheck.optional(),
  POSTGRES_DB: z.string().min(1, 'PostgreSQL database name is required'),
  DB_PASSWORD: entropyCheck.optional(),

  // Redis Configuration
  REDIS_PASSWORD: entropyCheck.optional(),

  // Authentication & Security
  JWT_SECRET: entropyCheck,
  JWT_EXPIRES_IN: z.string().default('24h'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),
  AUTH_ALLOW_STATELESS_JWT: z
    .string()
    .transform((val) => val === 'true')
    .default('false'),

  // Admin Configuration
  ADMIN_EMAILS: emailList.optional(),

  // AI Provider API Keys
  OPENAI_API_KEY: apiKey.optional(),
  ANTHROPIC_API_KEY: apiKey.optional(),
  CLAUDE_API_KEY: apiKey.optional(),
  TOGETHER_API_KEY: apiKey.optional(),
  XAI_API_KEY: apiKey.optional(),
  MERCURY_API_KEY: apiKey.optional(),
  INCEPTIONLABS_API_KEY: apiKey.optional(),
  CODEX_API_KEY: apiKey.optional(),

  // Code & Integration API Keys
  SOURCEGRAPH_API_KEY: apiKey.optional(),
  FIGMA_API_KEY: apiKey.optional(),
  REPLIT_API_TOKEN: apiKey.optional(),

  // Database & Task Tracking
  NOTION_API_KEY: apiKey.optional(),
  NOTION_API_USAGE_TRACKER_DB: z.string().uuid().optional(),
  NOTION_TOOL_USAGE_PLANS_DB: z.string().uuid().optional(),

  // Literature & Research APIs
  NCBI_API_KEY: apiKey.optional(),
  SEMANTIC_SCHOLAR_API_KEY: apiKey.optional(),
  LITERATURE_CACHE_TTL: z
    .string()
    .transform(Number)
    .refine((val) => !isNaN(val) && val > 0, 'Must be a positive number')
    .default('3600'),

  // CORS & Client Configuration
  CLIENT_URL: z.string().url().optional(),
  CORS_WHITELIST: urlList.optional(),

  // Webhook Secrets
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  ZOOM_WEBHOOK_SECRET_TOKEN: z.string().optional(),
  ZOOM_VERIFICATION_TOKEN: z.string().optional(),

  // Governance Mode
  GOVERNANCE_MODE: z.enum(['LIVE', 'STANDBY']).default('LIVE'),

  // PHI Protection
  PHI_SCAN_ENABLED: z
    .string()
    .transform((val) => val === 'true')
    .default('true'),
  PHI_FAIL_CLOSED: z
    .string()
    .transform((val) => val === 'true')
    .default('true'),

  // Chat Agents Configuration
  CHAT_AGENT_MODEL: z.string().optional(),
  CHAT_AGENT_PROVIDER: z.enum(['openai', 'anthropic']).optional(),
  NEXT_PUBLIC_ENABLE_CHAT_AGENTS: z
    .string()
    .transform((val) => val === 'true')
    .default('true'),
  CHAT_AGENT_ENABLED: z
    .string()
    .transform((val) => val === 'true')
    .default('true'),

  // Dashboard Configuration
  DASHBOARD_ENABLED: z
    .string()
    .transform((val) => val === 'true')
    .default('true'),
  DASHBOARD_CALENDAR_INTEGRATION: z
    .string()
    .transform((val) => val === 'true')
    .default('true'),
  DASHBOARD_REFRESH_INTERVAL: z
    .string()
    .transform(Number)
    .refine((val) => !isNaN(val) && val > 0, 'Must be a positive number')
    .default('5000'),

  // Data Parsing
  DATA_PARSE_STRICT: z
    .string()
    .transform((val) => val === 'true')
    .default('true'),

  // Analytics Configuration
  ANALYTICS_IP_SALT: z.string().optional(),
  SENTRY_DSN: z.string().url().optional(),
  VITE_SENTRY_DSN: z.string().url().optional(),

  // Artifact & Cache Configuration
  ARTIFACTS_PATH: z.string().default('/data/artifacts'),
  CONFERENCE_CACHE_TTL: z
    .string()
    .transform(Number)
    .refine((val) => !isNaN(val) && val > 0, 'Must be a positive number')
    .default('86400'),

  // Web Search
  ENABLE_WEB_SEARCH: z
    .string()
    .transform((val) => val === 'true')
    .default('false'),

  // Large File Processing
  LARGE_FILE_BYTES: z
    .string()
    .transform(Number)
    .refine((val) => !isNaN(val) && val > 0, 'Must be a positive number')
    .default('52428800'),
  CHUNK_SIZE_ROWS: z
    .string()
    .transform(Number)
    .refine((val) => !isNaN(val) && val > 0, 'Must be a positive number')
    .default('500000'),

  // Dask Distributed Processing
  DASK_ENABLED: z
    .string()
    .transform((val) => val === 'true')
    .default('false'),
  DASK_BLOCKSIZE_BYTES: z.string().default('64MB'),
  DASK_WORKERS: z
    .string()
    .transform(Number)
    .refine((val) => !isNaN(val) && val > 0, 'Must be a positive number')
    .default('4'),
  DASK_THREADS_PER_WORKER: z
    .string()
    .transform(Number)
    .refine((val) => !isNaN(val) && val > 0, 'Must be a positive number')
    .default('2'),
  DASK_MEMORY_LIMIT: z.string().default('4GB'),
  DASK_SCHEDULER_ADDR: z.string().optional(),
  MAX_PARQUET_FILE_SIZE: z
    .string()
    .transform(Number)
    .refine((val) => !isNaN(val) && val > 0, 'Must be a positive number')
    .default('104857600'),

  // AI Self-Improvement Configuration
  AUTO_REFINE_ENABLED: z
    .string()
    .transform((val) => val === 'true')
    .default('false'),
  MAX_REFINE_ATTEMPTS: z
    .string()
    .transform(Number)
    .refine((val) => !isNaN(val) && val > 0, 'Must be a positive number')
    .default('3'),
  REFINEMENT_ESCALATION_THRESHOLD: z
    .string()
    .transform(Number)
    .refine((val) => !isNaN(val) && val > 0, 'Must be a positive number')
    .default('2'),
  QUALITY_CHECK_STRICT_MODE: z
    .string()
    .transform((val) => val === 'true')
    .default('false'),
  MIN_QUALITY_SCORE_THRESHOLD: z
    .string()
    .transform(Number)
    .refine((val) => !isNaN(val) && val >= 0 && val <= 1, 'Must be between 0 and 1')
    .default('0.7'),
  CRITIC_MODEL: z.string().optional(),
  ACTOR_MODEL: z.string().optional(),

  // Quality Gate Configuration
  QUALITY_GATE_ENABLED: z
    .string()
    .transform((val) => val === 'true')
    .default('true'),
  ESCALATION_ENABLED: z
    .string()
    .transform((val) => val === 'true')
    .default('true'),
  MAX_ESCALATIONS: z
    .string()
    .transform(Number)
    .refine((val) => !isNaN(val) && val > 0, 'Must be a positive number')
    .default('2'),

  // Narrative Quality Configuration
  NARRATIVE_TASK_TYPES: z
    .string()
    .transform((val) => val.split(',').map((v) => v.trim()))
    .default('draft_section,abstract_generate,complex_synthesis'),
  DEFAULT_MIN_CITATIONS: z
    .string()
    .transform(Number)
    .refine((val) => !isNaN(val) && val > 0, 'Must be a positive number')
    .default('3'),
  DEFAULT_MIN_WORDS: z
    .string()
    .transform(Number)
    .refine((val) => !isNaN(val) && val > 0, 'Must be a positive number')
    .default('100'),
  DEFAULT_MAX_WORDS: z
    .string()
    .transform(Number)
    .refine((val) => !isNaN(val) && val > 0, 'Must be a positive number')
    .default('2000'),

  // AI Task Configuration
  AI_DEFAULT_TIER: z
    .enum(['NANO', 'MINI', 'FRONTIER'])
    .default('MINI'),
  AI_REQUEST_TIMEOUT_MS: z
    .string()
    .transform(Number)
    .refine((val) => !isNaN(val) && val > 0, 'Must be a positive number')
    .default('120000'),
  AI_MAX_RETRIES: z
    .string()
    .transform(Number)
    .refine((val) => !isNaN(val) && val >= 0, 'Must be a non-negative number')
    .default('3'),
  AI_RETRY_BACKOFF_MS: z
    .string()
    .transform(Number)
    .refine((val) => !isNaN(val) && val > 0, 'Must be a positive number')
    .default('1000'),
  AI_DEBUG_LOGGING: z
    .string()
    .transform((val) => val === 'true')
    .default('false'),

  // Demo Mode
  DEMO_USE_REAL_GENERATION: z
    .string()
    .transform((val) => val === 'true')
    .default('false'),

  // Development / Debug
  DEBUG: z
    .string()
    .transform((val) => val === 'true')
    .default('false'),

  // Optional: AI Logging Disable
  DISABLE_AI_LOGGING: z
    .string()
    .transform((val) => val === 'true')
    .optional(),
});

/**
 * Inferred type for validated environment variables
 */
export type Env = z.infer<typeof envSchema>;

/**
 * Validates environment variables against the schema.
 * Throws on validation failure with detailed error information.
 *
 * @returns Validated and type-safe environment object
 * @throws ZodError if validation fails
 */
export function validateEnv(): Env {
  try {
    const env = envSchema.parse(process.env);
    return env;
  } catch (error) {
    if (error instanceof z.ZodError) {
      const issues = error.issues.map((issue) => {
        const path = issue.path.join('.');
        return `  ${path}: ${issue.message}`;
      });
      const message = `Environment validation failed:\n${issues.join('\n')}`;
      console.error(message);
      throw new Error(message);
    }
    throw error;
  }
}

/**
 * Validates environment variables without throwing.
 * Returns result with success flag and error details if validation fails.
 *
 * @returns Object with success flag and validated env or errors
 */
export function validateEnvSafe(): {
  success: boolean;
  data?: Env;
  errors?: Record<string, string[]>;
} {
  try {
    const data = envSchema.parse(process.env);
    return { success: true, data };
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errors: Record<string, string[]> = {};
      error.issues.forEach((issue) => {
        const path = issue.path.join('.');
        if (!errors[path]) {
          errors[path] = [];
        }
        errors[path].push(issue.message);
      });
      return { success: false, errors };
    }
    return { success: false, errors: { _general: ['Unknown validation error'] } };
  }
}

/**
 * Provides detailed validation report for debugging.
 * Useful for development and setup verification.
 *
 * @returns Validation report with all checked variables and their status
 */
export function getEnvValidationReport(): {
  timestamp: string;
  nodeEnv: string;
  validationStatus: 'PASS' | 'FAIL';
  requiredVariables: Record<string, boolean>;
  optionalVariables: Record<string, boolean>;
  issues: string[];
} {
  const result = validateEnvSafe();
  const nodeEnv = process.env.NODE_ENV || 'development';

  const requiredVariables: Record<string, boolean> = {
    NODE_ENV: !!process.env.NODE_ENV,
    DATABASE_URL: !!process.env.DATABASE_URL,
    JWT_SECRET: !!process.env.JWT_SECRET,
    POSTGRES_USER: !!process.env.POSTGRES_USER,
    POSTGRES_DB: !!process.env.POSTGRES_DB,
  };

  const optionalVariables: Record<string, boolean> = {
    OPENAI_API_KEY: !!process.env.OPENAI_API_KEY,
    ANTHROPIC_API_KEY: !!process.env.ANTHROPIC_API_KEY,
    NOTION_API_KEY: !!process.env.NOTION_API_KEY,
  };

  const issues = result.errors ? Object.entries(result.errors).map(([key, msgs]) => `${key}: ${msgs.join(', ')}`) : [];

  return {
    timestamp: new Date().toISOString(),
    nodeEnv,
    validationStatus: result.success ? 'PASS' : 'FAIL',
    requiredVariables,
    optionalVariables,
    issues,
  };
}
