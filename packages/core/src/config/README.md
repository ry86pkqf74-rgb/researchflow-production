# Environment Configuration Module

Centralized, type-safe environment variable validation for ResearchFlow with fail-fast behavior.

## Overview

This module provides:
- **Centralized validation**: All environment variables defined in one place
- **Type safety**: Zod schema automatically generates TypeScript types
- **Fail-fast**: Validation errors thrown at startup, not runtime
- **Comprehensive coverage**: All critical variables validated with sensible defaults
- **Security checks**: Entropy validation for secrets, format validation for API keys
- **Detailed errors**: Clear error messages on validation failure

## Quick Start

### 1. Validate Environment at Startup

```typescript
import { validateEnv } from '@researchflow/core/config';

// In your main server initialization file
const env = validateEnv(); // Throws if validation fails

// Now env is fully typed with IntelliSense support
console.log(env.DATABASE_URL); // string (required)
console.log(env.JWT_SECRET); // string (min 32 chars)
console.log(env.OPENAI_API_KEY); // string | undefined (optional)
```

### 2. Safe Validation with Error Handling

```typescript
import { validateEnvSafe } from '@researchflow/core/config';

const result = validateEnvSafe();

if (result.success) {
  const env = result.data;
  // Use env
} else {
  console.error('Validation errors:', result.errors);
  // Handle errors without throwing
}
```

### 3. Get Validation Report (Development)

```typescript
import { getEnvValidationReport } from '@researchflow/core/config';

const report = getEnvValidationReport();
console.log(report);
// {
//   timestamp: "2024-01-28T10:30:00Z",
//   nodeEnv: "production",
//   validationStatus: "PASS",
//   requiredVariables: { NODE_ENV: true, DATABASE_URL: true, ... },
//   optionalVariables: { OPENAI_API_KEY: false, ... },
//   issues: []
// }
```

## Variable Categories

### Core Environment
- `NODE_ENV`: development | production | test
- `ENVIRONMENT`: dev | test | prod
- `DEBUG`: boolean

### Database
- `DATABASE_URL`: Required PostgreSQL connection string
- `POSTGRES_USER`: Required username
- `POSTGRES_PASSWORD`: Optional, 32+ chars if provided
- `POSTGRES_DB`: Required database name
- `DB_PASSWORD`: Optional, 32+ chars if provided (HIPAA)
- `REDIS_PASSWORD`: Optional, 32+ chars if provided (HIPAA)

### Authentication & Security
- `JWT_SECRET`: Required, minimum 32 characters (cryptographic)
- `JWT_EXPIRES_IN`: Token expiration time (default: 24h)
- `JWT_REFRESH_EXPIRES_IN`: Refresh token expiration (default: 7d)
- `AUTH_ALLOW_STATELESS_JWT`: Boolean (default: false)
- `ADMIN_EMAILS`: Comma-separated email list (optional)

### AI Provider API Keys
All optional, but validated if provided:
- `OPENAI_API_KEY`
- `ANTHROPIC_API_KEY`
- `CLAUDE_API_KEY`
- `TOGETHER_API_KEY`
- `XAI_API_KEY`
- `MERCURY_API_KEY`
- `SOURCEGRAPH_API_KEY`
- `FIGMA_API_KEY`
- `REPLIT_API_TOKEN`

### Research & Literature APIs
- `NCBI_API_KEY`: Optional
- `SEMANTIC_SCHOLAR_API_KEY`: Optional
- `LITERATURE_CACHE_TTL`: Seconds (default: 3600)

### Integration APIs
- `NOTION_API_KEY`: Optional
- `NOTION_API_USAGE_TRACKER_DB`: UUID format (optional)
- `NOTION_TOOL_USAGE_PLANS_DB`: UUID format (optional)

### Governance & Compliance
- `GOVERNANCE_MODE`: LIVE | STANDBY (default: LIVE)
- `PHI_SCAN_ENABLED`: Boolean (default: true)
- `PHI_FAIL_CLOSED`: Boolean (default: true)

### Feature Flags & Configuration
- `CHAT_AGENT_ENABLED`: Boolean (default: true)
- `DASHBOARD_ENABLED`: Boolean (default: true)
- `ENABLE_WEB_SEARCH`: Boolean (default: false)
- `AUTO_REFINE_ENABLED`: Boolean (default: false)
- `QUALITY_GATE_ENABLED`: Boolean (default: true)

### Quality & Performance
- `AI_REQUEST_TIMEOUT_MS`: Milliseconds (default: 120000)
- `AI_MAX_RETRIES`: Number (default: 3)
- `MAX_REFINE_ATTEMPTS`: Number (default: 3)
- `MIN_QUALITY_SCORE_THRESHOLD`: 0-1 (default: 0.7)
- `AI_DEFAULT_TIER`: NANO | MINI | FRONTIER (default: MINI)

### Large File Processing
- `LARGE_FILE_BYTES`: Bytes threshold (default: 52428800)
- `CHUNK_SIZE_ROWS`: Rows per chunk (default: 500000)
- `DASK_ENABLED`: Boolean (default: false)
- `DASK_WORKERS`: Number (default: 4)
- `DASK_MEMORY_LIMIT`: Memory string (default: 4GB)

## Integration Examples

### Server Initialization

```typescript
// apps/api-node/src/server.ts
import { validateEnv } from '@researchflow/core/config';

async function startServer() {
  // Validate ALL environment variables immediately
  const env = validateEnv();

  // Now safe to use env throughout the app
  const db = createConnection(env.DATABASE_URL);
  const jwtConfig = {
    secret: env.JWT_SECRET,
    expiresIn: env.JWT_EXPIRES_IN,
  };

  // ... start server
}
```

### Middleware Integration

```typescript
// apps/api-node/src/middleware/auth.ts
import { validateEnv } from '@researchflow/core/config';

const env = validateEnv();

export function authMiddleware(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  const decoded = jwt.verify(token, env.JWT_SECRET);
  // ...
}
```

### Service Configuration

```typescript
// services/orchestrator/src/ai-service.ts
import { validateEnv } from '@researchflow/core/config';

class AIService {
  private env = validateEnv();

  async generateContent() {
    const apiKey = this.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY not configured');
    }
    // Use api key for OpenAI calls
  }
}
```

### Testing

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    setupFiles: ['./test-setup.ts'],
  },
});

// test-setup.ts
import { validateEnv } from '@researchflow/core/config';

// Validate test environment
validateEnv();
```

## Validation Rules

### String Validation
- Non-empty strings required for API keys
- URL strings validated with `new URL()`
- Email validation using RFC 5322 pattern

### Entropy Checks
- Secrets and passwords: minimum 32 characters
- Applied to: `JWT_SECRET`, `DB_PASSWORD`, `REDIS_PASSWORD`, `POSTGRES_PASSWORD`

### Numeric Validation
- Positive integers for counts (retries, workers, etc.)
- Non-negative for optional numeric values
- Range validation for scores (0-1)

### Boolean Conversion
- String values "true"/"false" converted to boolean
- Case-sensitive (use lowercase in .env files)

### Format Validation
- UUIDs: strict UUID format for database IDs
- URLs: must be valid HTTP/HTTPS URLs
- Email lists: comma-separated, all validated

### Range Validation
- Port numbers: 1-65535
- Quality scores: 0.0-1.0
- Retry counts: must be >= 0

## Error Handling

### Validation Failures

When `validateEnv()` throws, you see:

```
Error: Environment validation failed:
  DATABASE_URL: Invalid url
  JWT_SECRET: Must be at least 32 characters for cryptographic security
  POSTGRES_USER: String must contain at least 1 character(s)
```

### Safe Validation

For non-throwing validation:

```typescript
const result = validateEnvSafe();

if (!result.success) {
  const errors = result.errors;
  // {
  //   DATABASE_URL: ["Invalid url"],
  //   JWT_SECRET: ["Must be at least 32 characters..."],
  //   POSTGRES_USER: ["String must contain at least 1 character(s)"]
  // }
}
```

## Security Best Practices

1. **Never commit .env files**: Use `.gitignore` (already configured)
2. **Rotate secrets regularly**: Update JWT_SECRET and API keys
3. **Use environment-specific values**: Different secrets for dev/test/prod
4. **Validate at startup**: Catch configuration errors immediately
5. **Fail secure**: PHI_FAIL_CLOSED defaults to true
6. **Use strong secrets**: All secrets enforce 32+ character minimum

## Production Checklist

- [ ] Set `NODE_ENV=production`
- [ ] JWT_SECRET: 32+ random characters (use `openssl rand -hex 16`)
- [ ] DATABASE_URL: Production PostgreSQL connection string
- [ ] API keys: All required API keys configured
- [ ] CORS_WHITELIST: Set to production domain only
- [ ] AUTH_ALLOW_STATELESS_JWT: Set to false
- [ ] PHI_FAIL_CLOSED: Set to true
- [ ] GOVERNANCE_MODE: Set to appropriate mode (LIVE or STANDBY)
- [ ] Run `npm run type-check` to verify types

## Adding New Variables

To add a new environment variable:

1. Add schema definition in `env-schema.ts` object
2. Include appropriate validation (optional, required, format, range)
3. Set default value if applicable
4. Add TypeScript type inference (automatic via `z.infer`)
5. Export in `config/index.ts`
6. Update this README with documentation

Example:

```typescript
export const envSchema = z.object({
  // ... existing fields ...
  MY_NEW_VAR: z.string().min(1).optional(), // Optional string, min 1 char
  MY_PORT: portNumber.default('3000'),       // Uses port validator
  MY_API_KEY: apiKey.optional(),              // Uses API key validator
});
```

## Performance Considerations

- Validation runs once at startup: negligible performance impact
- Type inference is compile-time only: no runtime cost
- Zod parsing is optimized for environment variables
- Caching validated env: Use `const env = validateEnv()` once, reuse throughout app

## Troubleshooting

### "DATABASE_URL: Invalid url"
Ensure DATABASE_URL is a valid connection string:
```
postgresql://user:password@localhost:5432/dbname
```

### "JWT_SECRET: Must be at least 32 characters"
Generate with: `openssl rand -hex 16` (produces 32 hex characters)

### "ADMIN_EMAILS: All items must be valid email addresses"
Ensure email list is comma-separated with valid email format:
```
admin1@example.com,admin2@example.com
```

### Type errors when using env
Ensure `validateEnv()` is called and its result is used:
```typescript
const env = validateEnv(); // Must call function
console.log(env.JWT_SECRET); // Now has IntelliSense
```

## Related Files

- `.env.example`: Template with all variables
- `.env`: Actual configuration (gitignored)
- `packages/core/src/config/env-schema.ts`: Schema definitions
- `packages/core/src/config/index.ts`: Public exports
