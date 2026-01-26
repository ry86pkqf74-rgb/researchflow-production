/**
 * Environment Configuration Helper
 *
 * Centralized, type-safe environment variable access with defaults.
 * See docs/configuration/env-vars.md for the full registry.
 */

/**
 * Get a string environment variable with optional default
 */
export function getEnvString(key: string, defaultValue: string): string {
  return process.env[key] ?? defaultValue;
}

/**
 * Get a required string environment variable (throws if missing)
 */
export function getEnvStringRequired(key: string): string {
  const value = process.env[key];
  if (value === undefined || value === '') {
    throw new Error(`Required environment variable ${key} is not set`);
  }
  return value;
}

/**
 * Get an integer environment variable with default
 */
export function getEnvInt(key: string, defaultValue: number): number {
  const value = process.env[key];
  if (value === undefined || value === '') {
    return defaultValue;
  }
  const parsed = parseInt(value, 10);
  if (isNaN(parsed)) {
    console.warn(`Invalid integer for ${key}: "${value}", using default: ${defaultValue}`);
    return defaultValue;
  }
  return parsed;
}

/**
 * Get a float environment variable with default
 */
export function getEnvFloat(key: string, defaultValue: number): number {
  const value = process.env[key];
  if (value === undefined || value === '') {
    return defaultValue;
  }
  const parsed = parseFloat(value);
  if (isNaN(parsed)) {
    console.warn(`Invalid float for ${key}: "${value}", using default: ${defaultValue}`);
    return defaultValue;
  }
  return parsed;
}

/**
 * Get a boolean environment variable with default
 * Truthy: "true", "1", "yes", "on" (case-insensitive)
 * Falsy: "false", "0", "no", "off" (case-insensitive)
 */
export function getEnvBool(key: string, defaultValue: boolean): boolean {
  const value = process.env[key];
  if (value === undefined || value === '') {
    return defaultValue;
  }
  const lower = value.toLowerCase();
  if (['true', '1', 'yes', 'on'].includes(lower)) {
    return true;
  }
  if (['false', '0', 'no', 'off'].includes(lower)) {
    return false;
  }
  console.warn(`Invalid boolean for ${key}: "${value}", using default: ${defaultValue}`);
  return defaultValue;
}

/**
 * Get an enum environment variable with default
 */
export function getEnvEnum<T extends string>(
  key: string,
  allowedValues: readonly T[],
  defaultValue: T
): T {
  const value = process.env[key] as T | undefined;
  if (value === undefined || value === '') {
    return defaultValue;
  }
  if (!allowedValues.includes(value)) {
    console.warn(
      `Invalid value for ${key}: "${value}", allowed: [${allowedValues.join(', ')}], using default: ${defaultValue}`
    );
    return defaultValue;
  }
  return value;
}

/**
 * Governance modes
 */
export const GOVERNANCE_MODES = ['DEMO', 'LIVE'] as const;
export type GovernanceMode = typeof GOVERNANCE_MODES[number];

/**
 * Cache backends
 */
export const CACHE_BACKENDS = ['memory', 'redis'] as const;
export type CacheBackend = typeof CACHE_BACKENDS[number];

/**
 * Log levels
 */
export const LOG_LEVELS = ['debug', 'info', 'warn', 'error'] as const;
export type LogLevel = typeof LOG_LEVELS[number];

/**
 * Centralized configuration object
 * Access via: import { config } from './config/env';
 */
export const config = {
  // Core
  nodeEnv: getEnvString('NODE_ENV', 'development'),
  port: getEnvInt('PORT', 3001),

  // Governance
  governanceMode: getEnvEnum('GOVERNANCE_MODE', GOVERNANCE_MODES, 'DEMO'),

  // Database
  databaseUrl: getEnvString('DATABASE_URL', 'postgresql://ros:ros@postgres:5432/ros'),

  // Redis
  redisUrl: getEnvString('REDIS_URL', 'redis://redis:6379'),

  // Worker
  workerUrl: getEnvString('WORKER_URL', 'http://worker:8000'),
  workerCallbackUrl: getEnvString('WORKER_CALLBACK_URL', 'http://worker:8000'),

  // ROS Proxy (Phase 03)
  rosProxyEnabled: getEnvBool('ROS_PROXY_ENABLED', true),
  rosProxyTimeoutMs: getEnvInt('ROS_PROXY_TIMEOUT_MS', 120000),

  // JWT/Session
  jwtSecret: getEnvString('JWT_SECRET', 'dev-secret-change-in-production'),
  sessionSecret: getEnvString('SESSION_SECRET', 'dev-session-secret'),
  jwtExpiration: getEnvString('JWT_EXPIRATION', '24h'),

  // AI Integration
  aiDefaultTier: getEnvString('AI_DEFAULT_TIER', 'MINI'),
  aiEnablePromptCache: getEnvBool('AI_ENABLE_PROMPT_CACHE', true),
  aiCacheTtlSeconds: getEnvInt('AI_CACHE_TTL_SECONDS', 3600),

  // AI Response Cache (Phase 04)
  aiResponseCacheEnabled: getEnvBool('AI_RESPONSE_CACHE_ENABLED', true),
  aiResponseCacheTtlSeconds: getEnvInt('AI_RESPONSE_CACHE_TTL_SECONDS', 21600),
  aiResponseCacheBackend: getEnvEnum('AI_RESPONSE_CACHE_BACKEND', CACHE_BACKENDS, 'memory'),

  // AI Streaming (Phase 07)
  aiStreamingEnabled: getEnvBool('AI_STREAMING_ENABLED', false),
  aiStreamingIdleTimeoutMs: getEnvInt('AI_STREAMING_IDLE_TIMEOUT_MS', 30000),

  // PHI Safety
  phiScanEnabled: getEnvBool('PHI_SCAN_ENABLED', true),
  phiRevealTokenTtlMinutes: getEnvInt('PHI_REVEAL_TOKEN_TTL_MINUTES', 15),

  // Logging
  logLevel: getEnvEnum('LOG_LEVEL', LOG_LEVELS, 'info'),
  logFormat: getEnvString('LOG_FORMAT', 'json'),

  // Metrics (Phase 08)
  metricsEnabled: getEnvBool('METRICS_ENABLED', true),

  // Feature Flags
  featureBatchProcessing: getEnvBool('FEATURE_BATCH_PROCESSING', true),
  featureEvidenceRetrieval: getEnvBool('FEATURE_EVIDENCE_RETRIEVAL', true),
  featureAutoEscalation: getEnvBool('FEATURE_AUTO_ESCALATION', true),
} as const;

/**
 * Validate critical configuration on startup
 */
export function validateConfig(): void {
  const errors: string[] = [];

  // Check for dev secrets in production
  if (config.nodeEnv === 'production') {
    if (config.jwtSecret.includes('dev-secret') || config.jwtSecret.length < 32) {
      errors.push('JWT_SECRET must be set to a secure value in production');
    }
    if (config.sessionSecret.includes('dev-session') || config.sessionSecret.length < 32) {
      errors.push('SESSION_SECRET must be set to a secure value in production');
    }
  }

  // Validate governance mode
  if (config.governanceMode === 'LIVE' && config.nodeEnv === 'development') {
    console.warn('WARNING: GOVERNANCE_MODE=LIVE in development environment');
  }

  if (errors.length > 0) {
    throw new Error(`Configuration validation failed:\n${errors.join('\n')}`);
  }
}

export default config;
