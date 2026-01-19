/**
 * Environment Variable Validator
 *
 * Validates all required environment variables at startup using Zod.
 * Exits the process immediately if validation fails to prevent
 * running with invalid configuration.
 *
 * Phase A - Task 15: Env Var Validation at Startup
 * Phase 2.5-06: Updated to use shared validation module from @researchflow/core
 */

import { z } from 'zod';
import { logger } from '../logger/file-logger.js';
import {
  orchestratorEnvSchema,
  validateEnvSafe,
  validateProductionRequirements,
  formatValidationErrors,
  type OrchestratorEnv,
} from '@researchflow/core';

// Extend the base orchestrator schema with service-specific fields
const envSchema = orchestratorEnvSchema.extend({
  // Override PORT default for orchestrator
  PORT: z.string()
    .transform(Number)
    .pipe(z.number().int().min(1).max(65535))
    .default('3001'),
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
        logger.warn('WARNING: JWT_SECRET should be at least 64 characters in production');
      }
    }

    logger.info('Environment validation successful');
    logger.info(`NODE_ENV: ${validatedEnv.NODE_ENV}`);
    logger.info(`PORT: ${validatedEnv.PORT}`);
    logger.info(`LOG_LEVEL: ${validatedEnv.LOG_LEVEL}`);

    return validatedEnv;
  } catch (error) {
    if (error instanceof z.ZodError) {
      logger.error('Environment validation failed:');

      error.errors.forEach((err) => {
        const path = err.path.join('.');
        logger.error(`  ${path}: ${err.message}`);
      });

      logger.error('Please check your .env file and ensure all required variables are set.');
      logger.error('See .env.example for reference.');
    } else {
      logger.error('Environment validation failed:', error);
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
