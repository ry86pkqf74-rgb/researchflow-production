/**
 * Configuration Module
 *
 * Exports environment validation and configuration utilities.
 */

export {
  envSchema,
  validateEnv,
  validateEnvSafe,
  getEnvValidationReport,
  type Env,
} from './env-schema';
