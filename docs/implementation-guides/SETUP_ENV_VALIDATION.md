# Quick Setup: Environment Validation

## Getting Started

The environment validation schema is now integrated into the core package. Here's how to use it:

### Step 1: Import at Application Startup

Add this to your server initialization (e.g., `apps/api-node/src/index.ts` or `services/orchestrator/src/index.ts`):

```typescript
import { validateEnv } from '@researchflow/core/config';

// At the very top of your main function:
const env = validateEnv();

console.log(`✓ Environment validated successfully`);
console.log(`  Mode: ${env.NODE_ENV}`);
console.log(`  Database: ${env.DATABASE_URL.split('@')[1]}`);
```

This will:
- Validate ALL environment variables immediately
- Throw a clear error if anything is misconfigured
- Provide the fully-typed `env` object for use throughout your app

### Step 2: Use Validated Environment

Once validated, use `env` to access configuration:

```typescript
// Import once per file (or use dependency injection)
import { validateEnv } from '@researchflow/core/config';
const env = validateEnv();

// Database setup
const db = createConnection(env.DATABASE_URL);

// JWT middleware
setupAuth(app, {
  secret: env.JWT_SECRET,
  expiresIn: env.JWT_EXPIRES_IN,
});

// CORS configuration
if (env.CORS_WHITELIST) {
  app.use(cors({ origin: env.CORS_WHITELIST }));
}

// Feature flags
if (env.PHI_SCAN_ENABLED) {
  enablePHIScan();
}
```

### Step 3: Ensure .env is Configured

Copy `.env.example` to `.env` and fill in required values:

```bash
cp .env.example .env
```

Minimum required variables:
- `NODE_ENV`: development, production, or test
- `DATABASE_URL`: postgresql://user:password@host/db
- `POSTGRES_USER`: database user
- `POSTGRES_DB`: database name
- `JWT_SECRET`: 32+ random characters (generate with `openssl rand -hex 16`)

### Step 4: Test Validation

Run this to see validation report:

```typescript
import { getEnvValidationReport } from '@researchflow/core/config';

const report = getEnvValidationReport();
console.log(JSON.stringify(report, null, 2));
```

## Common Integration Patterns

### Express Server

```typescript
import express from 'express';
import { validateEnv } from '@researchflow/core/config';

const app = express();
const env = validateEnv();

// Now env is fully typed and validated
app.use(authMiddleware(env.JWT_SECRET));
app.listen(3000);
```

### Feature Flags

```typescript
const env = validateEnv();

if (env.CHAT_AGENT_ENABLED) {
  initializeChatAgents(env.CHAT_AGENT_PROVIDER);
}

if (env.QUALITY_GATE_ENABLED) {
  enableQualityGates(env.MIN_QUALITY_SCORE_THRESHOLD);
}
```

### API Key Handling

```typescript
const env = validateEnv();

// Check if optional API key is configured
if (env.OPENAI_API_KEY) {
  useOpenAI(env.OPENAI_API_KEY);
} else if (env.ANTHROPIC_API_KEY) {
  useAnthropic(env.ANTHROPIC_API_KEY);
} else {
  console.warn('No AI API key configured, using mock');
}
```

## Documentation

Full documentation available in:
- **`packages/core/src/config/README.md`**: Comprehensive guide with all variables
- **`packages/core/src/config/examples.ts`**: 10 usage pattern examples
- **`ENV_VALIDATION_IMPLEMENTATION.md`**: Implementation details and design decisions

## Validation Functions

### `validateEnv()` - Throws on Error
Use in server initialization for fail-fast behavior:
```typescript
const env = validateEnv(); // Throws if invalid
```

### `validateEnvSafe()` - Returns Result
Use when graceful error handling is needed:
```typescript
const result = validateEnvSafe();
if (!result.success) {
  console.error('Validation failed:', result.errors);
  process.exit(1);
}
const env = result.data;
```

### `getEnvValidationReport()` - Diagnostic Report
Use for debugging during development:
```typescript
const report = getEnvValidationReport();
console.log(report); // { validationStatus, requiredVariables, optionalVariables, issues }
```

## What Gets Validated

The schema validates 100+ environment variables:

| Category | Examples |
|----------|----------|
| **Core** | NODE_ENV, ENVIRONMENT, DEBUG |
| **Database** | DATABASE_URL, POSTGRES_USER, POSTGRES_PASSWORD |
| **Security** | JWT_SECRET, JWT_EXPIRES_IN, ADMIN_EMAILS |
| **AI APIs** | OPENAI_API_KEY, ANTHROPIC_API_KEY, TOGETHER_API_KEY |
| **Governance** | GOVERNANCE_MODE, PHI_SCAN_ENABLED, PHI_FAIL_CLOSED |
| **Features** | CHAT_AGENT_ENABLED, DASHBOARD_ENABLED, AUTO_REFINE_ENABLED |
| **Quality** | QUALITY_GATE_ENABLED, MIN_QUALITY_SCORE_THRESHOLD |
| **Performance** | AI_REQUEST_TIMEOUT_MS, AI_MAX_RETRIES, LARGE_FILE_BYTES |

See `packages/core/src/config/README.md` for complete list.

## Type Safety

Once validated, TypeScript IntelliSense works perfectly:

```typescript
const env = validateEnv();

// IntelliSense shows all available properties
// Types are correctly inferred:
env.JWT_SECRET        // string (required)
env.OPENAI_API_KEY    // string | undefined (optional)
env.DEBUG             // boolean (converted from string)
env.CORS_WHITELIST    // string[] | undefined (parsed from comma-separated)
env.NODE_ENV          // 'development' | 'production' | 'test' (enum)
```

## Production Checklist

Before deploying to production:

- [ ] Set `NODE_ENV=production`
- [ ] JWT_SECRET: 32+ random characters (use `openssl rand -hex 16`)
- [ ] DATABASE_URL: Production PostgreSQL connection string
- [ ] POSTGRES_USER and POSTGRES_DB: Production values
- [ ] Configure required AI API keys
- [ ] Set CORS_WHITELIST to production domain only
- [ ] Set AUTH_ALLOW_STATELESS_JWT=false
- [ ] Set PHI_FAIL_CLOSED=true (default)
- [ ] Set GOVERNANCE_MODE appropriately (LIVE or STANDBY)
- [ ] Run validation: `validateEnv()` succeeds at startup
- [ ] Check generated report: `getEnvValidationReport()`

## Testing

In your tests, override environment variables:

```typescript
import { beforeEach, afterEach, expect } from 'vitest';
import { validateEnv } from '@researchflow/core/config';

describe('My Tests', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    // Set test values
    process.env.NODE_ENV = 'test';
    process.env.DATABASE_URL = 'postgresql://test:test@localhost/test_db';
    process.env.POSTGRES_USER = 'test';
    process.env.POSTGRES_DB = 'test_db';
    process.env.JWT_SECRET = 'test'.repeat(8);
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('works', () => {
    const env = validateEnv();
    expect(env.NODE_ENV).toBe('test');
  });
});
```

## Troubleshooting

### "DATABASE_URL: Invalid url"
Ensure your DATABASE_URL is a valid PostgreSQL connection string:
```
postgresql://user:password@localhost:5432/dbname
```

### "JWT_SECRET: Must be at least 32 characters"
Generate a secure secret:
```bash
openssl rand -hex 16
```

### "ADMIN_EMAILS: All items must be valid email addresses"
Ensure comma-separated list with valid emails:
```
admin1@example.com,admin2@example.com
```

### "Module not found: @researchflow/core/config"
Make sure you're importing from the correct path:
```typescript
// Correct
import { validateEnv } from '@researchflow/core/config';

// Also correct
import { validateEnv } from '@researchflow/core';
```

## Questions?

See the full documentation:
- **Comprehensive Guide**: `packages/core/src/config/README.md`
- **Implementation Details**: `ENV_VALIDATION_IMPLEMENTATION.md`
- **Code Examples**: `packages/core/src/config/examples.ts`
- **Test Examples**: `packages/core/src/config/__tests__/env-schema.test.ts`
