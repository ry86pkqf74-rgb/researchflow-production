/**
 * Environment Validation Examples
 *
 * This file demonstrates various ways to use the environment validation
 * in your application. These are not part of the exported API but serve
 * as documentation and testing examples.
 *
 * DO NOT import this file in your application - it's for reference only.
 */

/* ===== Example 1: Basic Server Initialization ===== */

// This is how you would initialize your server with environment validation
// Place this in your server's main initialization file (e.g., apps/api-node/src/index.ts)

/*
import { validateEnv } from '@researchflow/core/config';
import express from 'express';

async function startServer() {
  // Validate ALL environment variables at startup
  // This will throw if any validation fails
  const env = validateEnv();

  console.log(`Starting server in ${env.NODE_ENV} mode`);

  // Now use env variables with full type safety
  const app = express();
  const port = 3000;

  // Database connection with validated URL
  const db = connectDatabase(env.DATABASE_URL);

  // JWT middleware with validated secret
  app.use(authMiddleware(env.JWT_SECRET, env.JWT_EXPIRES_IN));

  // CORS configuration with validated whitelist
  if (env.CORS_WHITELIST) {
    app.use(cors({
      origin: env.CORS_WHITELIST,
      credentials: true,
    }));
  }

  // Listen and start
  app.listen(port, () => {
    console.log(`Server running on port ${port}`);
  });
}

startServer().catch(error => {
  console.error('Server startup failed:', error.message);
  process.exit(1);
});
*/

/* ===== Example 2: Safe Validation with Error Handling ===== */

// Use this when you want to handle validation errors gracefully without throwing

/*
import { validateEnvSafe } from '@researchflow/core/config';

function setupApplication() {
  const result = validateEnvSafe();

  if (!result.success) {
    console.error('Environment validation failed!');
    console.error('Errors:', result.errors);

    // Handle specific errors
    const dbUrlErrors = result.errors?.DATABASE_URL;
    if (dbUrlErrors) {
      console.error('Database URL issues:', dbUrlErrors);
      // Provide setup instructions
      console.error('Expected format: postgresql://user:password@host:port/database');
    }

    process.exit(1);
  }

  const env = result.data;
  // env is now fully typed and validated
  setupDatabase(env.DATABASE_URL);
}
*/

/* ===== Example 3: Validation Report for Debugging ===== */

// Use this during development to see which variables are configured

/*
import { getEnvValidationReport } from '@researchflow/core/config';

function printSetupStatus() {
  const report = getEnvValidationReport();

  console.log(`
Environment Validation Report
==============================
Timestamp: ${report.timestamp}
Node Environment: ${report.nodeEnv}
Status: ${report.validationStatus}

Required Variables:
${Object.entries(report.requiredVariables)
  .map(([key, present]) => `  ${key}: ${present ? '✓' : '✗'}`)
  .join('\n')}

Optional Variables (if needed):
${Object.entries(report.optionalVariables)
  .map(([key, present]) => `  ${key}: ${present ? '✓ configured' : '○ not configured'}`)
  .join('\n')}
${report.issues.length > 0 ? `
Issues Found:
${report.issues.map(issue => `  • ${issue}`).join('\n')}
` : ''}
  `);
}
*/

/* ===== Example 4: Feature Flag Usage ===== */

// Access boolean feature flags with type safety

/*
import { validateEnv } from '@researchflow/core/config';

const env = validateEnv();

// These are properly typed as boolean, with defaults
if (env.PHI_SCAN_ENABLED) {
  enablePHIScanning();
}

if (env.CHAT_AGENT_ENABLED) {
  initializeChatAgents(env.CHAT_AGENT_PROVIDER);
}

if (env.QUALITY_GATE_ENABLED) {
  enableQualityGates(env.MIN_QUALITY_SCORE_THRESHOLD);
}

if (env.AUTO_REFINE_ENABLED) {
  enableAutoRefinement(env.MAX_REFINE_ATTEMPTS);
}
*/

/* ===== Example 5: API Key Usage with Fallback ===== */

// Safely use optional API keys with proper error handling

/*
import { validateEnv } from '@researchflow/core/config';

const env = validateEnv();

class AIService {
  async generateWithOpenAI(prompt: string) {
    if (!env.OPENAI_API_KEY) {
      throw new Error(
        'OpenAI API key not configured. ' +
        'Set OPENAI_API_KEY in your .env file.'
      );
    }

    const response = await openai.createCompletion({
      model: 'gpt-4',
      prompt,
      apiKey: env.OPENAI_API_KEY,
    });

    return response;
  }

  async generateWithAnthropic(prompt: string) {
    if (!env.ANTHROPIC_API_KEY) {
      throw new Error(
        'Anthropic API key not configured. ' +
        'Set ANTHROPIC_API_KEY in your .env file.'
      );
    }

    const response = await anthropic.messages.create({
      model: 'claude-3-sonnet-20240229',
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }],
    });

    return response;
  }

  // Intelligently choose provider based on configuration
  async generate(prompt: string) {
    if (env.OPENAI_API_KEY) {
      return this.generateWithOpenAI(prompt);
    } else if (env.ANTHROPIC_API_KEY) {
      return this.generateWithAnthropic(prompt);
    } else {
      throw new Error(
        'No AI API keys configured. ' +
        'Set OPENAI_API_KEY or ANTHROPIC_API_KEY in your .env file.'
      );
    }
  }
}
*/

/* ===== Example 6: Configuration Classes ===== */

// Use environment in class initialization

/*
import { validateEnv, Env } from '@researchflow/core/config';

class DatabaseConfig {
  url: string;
  user: string;
  database: string;
  poolSize: number = 10;

  constructor(env: Env) {
    this.url = env.DATABASE_URL;
    this.user = env.POSTGRES_USER;
    this.database = env.POSTGRES_DB;
  }
}

class SecurityConfig {
  jwtSecret: string;
  jwtExpiresIn: string;
  refreshExpiresIn: string;
  allowStatelessJWT: boolean;
  adminEmails: string[];

  constructor(env: Env) {
    this.jwtSecret = env.JWT_SECRET;
    this.jwtExpiresIn = env.JWT_EXPIRES_IN;
    this.refreshExpiresIn = env.JWT_REFRESH_EXPIRES_IN;
    this.allowStatelessJWT = env.AUTH_ALLOW_STATELESS_JWT;
    this.adminEmails = env.ADMIN_EMAILS || [];
  }
}

class AppConfig {
  db: DatabaseConfig;
  security: SecurityConfig;
  governance: {
    mode: 'LIVE' | 'STANDBY';
    phiScanEnabled: boolean;
    phiFailClosed: boolean;
  };

  constructor(env: Env) {
    this.db = new DatabaseConfig(env);
    this.security = new SecurityConfig(env);
    this.governance = {
      mode: env.GOVERNANCE_MODE,
      phiScanEnabled: env.PHI_SCAN_ENABLED,
      phiFailClosed: env.PHI_FAIL_CLOSED,
    };
  }
}

// Usage
const env = validateEnv();
const config = new AppConfig(env);
*/

/* ===== Example 7: Testing with Environment Overrides ===== */

// Override environment variables in tests

/*
import { describe, it, beforeEach, afterEach, expect } from 'vitest';
import { validateEnv } from '@researchflow/core/config';

describe('My Service', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    // Save original environment
    process.env = { ...originalEnv };
    // Set test-specific values
    process.env.NODE_ENV = 'test';
    process.env.DATABASE_URL = 'postgresql://test:test@localhost/test_db';
    process.env.POSTGRES_USER = 'test';
    process.env.POSTGRES_DB = 'test_db';
    process.env.JWT_SECRET = 'test-secret-' + 'x'.repeat(20);
  });

  afterEach(() => {
    // Restore original environment
    process.env = originalEnv;
  });

  it('should work with test configuration', () => {
    const env = validateEnv();
    expect(env.NODE_ENV).toBe('test');
  });
});
*/

/* ===== Example 8: Docker Entrypoint Script ===== */

// Validate environment before starting container

/*
#!/bin/bash
# entrypoint.sh

# Validate environment on container startup
node -e "
const { validateEnv } = require('@researchflow/core/config');
try {
  validateEnv();
  console.log('✓ Environment validation passed');
} catch (error) {
  console.error('✗ Environment validation failed:');
  console.error(error.message);
  process.exit(1);
}
"

# If validation passed, start the application
exec node ./dist/index.js
*/

/* ===== Example 9: CLI Configuration ===== */

// Use in CLI tools with proper error messages

/*
import { validateEnv, validateEnvSafe } from '@researchflow/core/config';
import chalk from 'chalk';

function setupCLI() {
  console.log(chalk.blue('ResearchFlow CLI'));
  console.log(chalk.blue('================\n'));

  const result = validateEnvSafe();

  if (!result.success) {
    console.error(chalk.red('Configuration Error\n'));

    // Print each validation error with context
    Object.entries(result.errors || {}).forEach(([key, messages]) => {
      console.error(chalk.yellow(`${key}:`));
      messages.forEach(msg => {
        console.error(`  ${msg}`);
      });
    });

    console.error(chalk.gray('\nSee .env.example for configuration template\n'));
    process.exit(1);
  }

  console.log(chalk.green('✓ Configuration valid\n'));
  return result.data;
}

const env = setupCLI();
*/

/* ===== Example 10: Type-Safe Configuration Singleton ===== */

// Create a configuration singleton with lazy validation

/*
import { validateEnv, Env } from '@researchflow/core/config';

class ConfigManager {
  private static instance: ConfigManager;
  private env: Env | null = null;

  private constructor() {}

  static getInstance(): ConfigManager {
    if (!ConfigManager.instance) {
      ConfigManager.instance = new ConfigManager();
    }
    return ConfigManager.instance;
  }

  getEnv(): Env {
    if (!this.env) {
      this.env = validateEnv();
    }
    return this.env;
  }

  get nodeEnv() {
    return this.getEnv().NODE_ENV;
  }

  get databaseUrl() {
    return this.getEnv().DATABASE_URL;
  }

  get jwtSecret() {
    return this.getEnv().JWT_SECRET;
  }

  get isProduction() {
    return this.nodeEnv === 'production';
  }

  get isDevelopment() {
    return this.nodeEnv === 'development';
  }

  get isTest() {
    return this.nodeEnv === 'test';
  }
}

// Usage throughout application
const config = ConfigManager.getInstance();
console.log(config.jwtSecret);
console.log(config.isProduction);
*/

// Export nothing - this file is documentation only
export {};
