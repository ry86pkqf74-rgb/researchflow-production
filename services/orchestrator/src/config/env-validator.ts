/**
 * Environment Variable Validator
 *
 * Validates all required environment variables at startup using Zod.
 * Exits the process immediately if validation fails to prevent
 * running with invalid configuration.
 *
 * Phase A - Task 15: Env Var Validation at Startup
 */

import { z } from 'zod';

const envSchema = z.object({
  // Server Configuration
  PORT: z.string()
    .transform(Number)
    .pipe(z.number().int().min(1).max(65535))
    .default('3001'),

  NODE_ENV: z.enum(['development', 'production', 'test', 'staging'])
    .default('development'),

  // Database Configuration
  DATABASE_URL: z.string().url().optional(),
  POSTGRES_URL: z.string().url().optional(),

  // Redis Configuration
  REDIS_URL: z.string()
    .regex(/^redis:\/\//, 'REDIS_URL must start with redis://')
    .optional(),
  REDIS_HOST: z.string().optional(),
  REDIS_PORT: z.string().transform(Number).pipe(z.number().min(1).max(65535)).optional(),

  // Authentication & Security
  JWT_SECRET: z.string()
    .min(32, 'JWT_SECRET must be at least 32 characters for security')
    .optional(), // Optional for development

  JWT_EXPIRES_IN: z.string().default('7d'),

  SESSION_SECRET: z.string()
    .min(32, 'SESSION_SECRET must be at least 32 characters')
    .optional(),

  // Client Configuration
  CLIENT_URL: z.string().url().default('http://localhost:5173'),

  // Service URLs
  WORKER_URL: z.string().url().optional(),
  PHI_ENGINE_URL: z.string().url().optional(),
  AI_ROUTER_URL: z.string().url().optional(),

  // API Keys (optional in development)
  ANTHROPIC_API_KEY: z.string().optional(),
  OPENAI_API_KEY: z.string().optional(),

  // Logging
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'debug', 'trace'])
    .default('info'),

  // Feature Flags
  ENABLE_RBAC: z.string().transform(v => v === 'true').default('true'),
  ENABLE_AUDIT_LOG: z.string().transform(v => v === 'true').default('true'),

  // Data Directories
  DATA_DIR: z.string().default('/data'),
  ARTIFACTS_DIR: z.string().default('/data/artifacts'),
  LOGS_DIR: z.string().default('/data/logs'),
  MANIFESTS_DIR: z.string().default('/data/manifests'),
});

export type Env = z.infer<typeof envSchema>;

let validatedEnv: Env | null = null;

/**
 * Validates environment variables and exits process on failure
 * Should be called at application startup before any other initialization
 */
export function validateEnv(): Env {
  if (validatedEnv) {
    return validatedEnv;
  }

  try {
    validatedEnv = envSchema.parse(process.env);

    // Additional validation for production
    if (validatedEnv.NODE_ENV === 'production') {
      if (!validatedEnv.JWT_SECRET) {
        throw new Error('JWT_SECRET is required in production');
      }
      if (!validatedEnv.DATABASE_URL && !validatedEnv.POSTGRES_URL) {
        throw new Error('DATABASE_URL or POSTGRES_URL is required in production');
      }
      if (validatedEnv.JWT_SECRET.length < 64) {
        console.warn('⚠️  WARNING: JWT_SECRET should be at least 64 characters in production');
      }
    }

    console.log('✅ Environment validation successful');
    console.log(`   NODE_ENV: ${validatedEnv.NODE_ENV}`);
    console.log(`   PORT: ${validatedEnv.PORT}`);
    console.log(`   LOG_LEVEL: ${validatedEnv.LOG_LEVEL}`);

    return validatedEnv;
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error('❌ Environment validation failed:');
      console.error('');

      error.errors.forEach((err) => {
        const path = err.path.join('.');
        console.error(`  ${path}: ${err.message}`);
      });

      console.error('');
      console.error('Please check your .env file and ensure all required variables are set.');
      console.error('See .env.example for reference.');
    } else {
      console.error('❌ Environment validation failed:', error);
    }

    process.exit(1);
  }
}

/**
 * Get the validated environment configuration
 * Throws if validateEnv() hasn't been called
 */
export function getEnv(): Env {
  if (!validatedEnv) {
    throw new Error('Environment not validated. Call validateEnv() first.');
  }
  return validatedEnv;
}
