/**
 * Shared Environment Variable Validation Module
 *
 * Provides Zod-based environment variable validation with:
 * - Common field schemas (port, URL, boolean, etc.)
 * - Service-specific schema factories
 * - Validation utilities with proper error formatting
 *
 * Phase 2.5-06: Create env validation shared module in packages/core
 */

import { z } from 'zod';

// ============================================================================
// Common Field Schemas
// ============================================================================

/**
 * Port number schema (1-65535)
 */
export const portSchema = z.string()
  .transform(Number)
  .pipe(z.number().int().min(1).max(65535));

/**
 * Boolean string schema (transforms "true"/"false" to boolean)
 */
export const booleanStringSchema = z.string()
  .transform(v => v.toLowerCase() === 'true');

/**
 * Optional URL schema
 */
export const optionalUrlSchema = z.string().url().optional();

/**
 * Required URL schema
 */
export const requiredUrlSchema = z.string().url();

/**
 * Redis URL schema (must start with redis://)
 */
export const redisUrlSchema = z.string()
  .regex(/^redis:\/\//, 'Must start with redis://');

/**
 * Secret string schema with minimum length
 */
export const secretSchema = (minLength: number = 32) => z.string()
  .min(minLength, `Must be at least ${minLength} characters for security`);

/**
 * Log level schema
 */
export const logLevelSchema = z.enum(['error', 'warn', 'info', 'debug', 'trace']);

/**
 * Node environment schema
 */
export const nodeEnvSchema = z.enum(['development', 'production', 'test', 'staging']);

// ============================================================================
// Common Environment Schema
// ============================================================================

/**
 * Base environment schema with fields common to all services
 */
export const baseEnvSchema = z.object({
  NODE_ENV: nodeEnvSchema.default('development'),
  LOG_LEVEL: logLevelSchema.default('info'),
});

/**
 * Common server configuration schema
 */
export const serverEnvSchema = baseEnvSchema.extend({
  PORT: portSchema.default('3000'),
});

/**
 * Common database configuration schema
 */
export const databaseEnvSchema = z.object({
  DATABASE_URL: z.string().url().optional(),
  POSTGRES_URL: z.string().url().optional(),
});

/**
 * Common Redis configuration schema
 */
export const redisEnvSchema = z.object({
  REDIS_URL: redisUrlSchema.optional(),
  REDIS_HOST: z.string().optional(),
  REDIS_PORT: portSchema.optional(),
});

/**
 * Common authentication configuration schema
 */
export const authEnvSchema = z.object({
  JWT_SECRET: secretSchema(32).optional(),
  JWT_EXPIRES_IN: z.string().default('7d'),
  SESSION_SECRET: secretSchema(32).optional(),
});

// ============================================================================
// Service-Specific Schema Factories
// ============================================================================

/**
 * Orchestrator environment schema
 */
export const orchestratorEnvSchema = serverEnvSchema
  .merge(databaseEnvSchema)
  .merge(redisEnvSchema)
  .merge(authEnvSchema)
  .extend({
    CLIENT_URL: z.string().url().default('http://localhost:5173'),
    WORKER_URL: optionalUrlSchema,
    PHI_ENGINE_URL: optionalUrlSchema,
    AI_ROUTER_URL: optionalUrlSchema,
    ANTHROPIC_API_KEY: z.string().optional(),
    OPENAI_API_KEY: z.string().optional(),
    ENABLE_RBAC: booleanStringSchema.default('true'),
    ENABLE_AUDIT_LOG: booleanStringSchema.default('true'),
    DATA_DIR: z.string().default('/data'),
    ARTIFACTS_DIR: z.string().default('/data/artifacts'),
    LOGS_DIR: z.string().default('/data/logs'),
    MANIFESTS_DIR: z.string().default('/data/manifests'),
  });

/**
 * Worker environment schema
 */
export const workerEnvSchema = serverEnvSchema
  .merge(redisEnvSchema)
  .extend({
    ORCHESTRATOR_URL: optionalUrlSchema,
    ANTHROPIC_API_KEY: z.string().optional(),
    OPENAI_API_KEY: z.string().optional(),
    WORKER_CONCURRENCY: z.string().transform(Number).pipe(z.number().int().min(1)).default('4'),
    JOB_TIMEOUT_MS: z.string().transform(Number).pipe(z.number().int().min(1000)).default('300000'),
  });

/**
 * Web (frontend) environment schema
 */
export const webEnvSchema = baseEnvSchema.extend({
  PORT: portSchema.default('5173'),
  VITE_API_URL: z.string().url().optional(),
  VITE_WS_URL: z.string().optional(),
});

// ============================================================================
// Validation Utilities
// ============================================================================

export interface ValidationResult<T> {
  success: boolean;
  data?: T;
  errors?: Array<{
    field: string;
    message: string;
  }>;
}

/**
 * Validate environment variables against a schema
 * Returns a result object instead of throwing
 */
export function validateEnvSafe<T extends z.ZodTypeAny>(
  schema: T,
  env: Record<string, string | undefined> = process.env
): ValidationResult<z.infer<T>> {
  const result = schema.safeParse(env);

  if (result.success) {
    return {
      success: true,
      data: result.data,
    };
  }

  return {
    success: false,
    errors: result.error.errors.map(err => ({
      field: err.path.join('.'),
      message: err.message,
    })),
  };
}

/**
 * Validate environment variables and throw on failure
 */
export function validateEnvStrict<T extends z.ZodTypeAny>(
  schema: T,
  env: Record<string, string | undefined> = process.env
): z.infer<T> {
  return schema.parse(env);
}

/**
 * Format validation errors for logging
 */
export function formatValidationErrors(
  errors: Array<{ field: string; message: string }>
): string {
  return errors.map(err => `  ${err.field}: ${err.message}`).join('\n');
}

/**
 * Production-specific validation rules
 * Call this after basic validation to apply stricter rules in production
 */
export function validateProductionRequirements(
  env: { NODE_ENV?: string; JWT_SECRET?: string; DATABASE_URL?: string; POSTGRES_URL?: string },
  options: {
    requireJwtSecret?: boolean;
    requireDatabase?: boolean;
    minJwtSecretLength?: number;
  } = {}
): { valid: boolean; warnings: string[]; errors: string[] } {
  const warnings: string[] = [];
  const errors: string[] = [];
  const opts = {
    requireJwtSecret: true,
    requireDatabase: true,
    minJwtSecretLength: 64,
    ...options,
  };

  if (env.NODE_ENV !== 'production') {
    return { valid: true, warnings, errors };
  }

  if (opts.requireJwtSecret && !env.JWT_SECRET) {
    errors.push('JWT_SECRET is required in production');
  }

  if (opts.requireDatabase && !env.DATABASE_URL && !env.POSTGRES_URL) {
    errors.push('DATABASE_URL or POSTGRES_URL is required in production');
  }

  if (env.JWT_SECRET && env.JWT_SECRET.length < opts.minJwtSecretLength) {
    warnings.push(`JWT_SECRET should be at least ${opts.minJwtSecretLength} characters in production`);
  }

  return {
    valid: errors.length === 0,
    warnings,
    errors,
  };
}

// ============================================================================
// Type Exports
// ============================================================================

export type OrchestratorEnv = z.infer<typeof orchestratorEnvSchema>;
export type WorkerEnv = z.infer<typeof workerEnvSchema>;
export type WebEnv = z.infer<typeof webEnvSchema>;
export type BaseEnv = z.infer<typeof baseEnvSchema>;
