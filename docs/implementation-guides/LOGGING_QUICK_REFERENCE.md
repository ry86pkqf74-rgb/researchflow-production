# Structured Logging Quick Reference

## How to Use the Logger

### Basic Setup
```typescript
import { createLogger } from '../utils/logger';

// Create a logger for your module
const logger = createLogger('module-name');
```

### Log Levels

```typescript
// Debug - detailed information for debugging
logger.debug('Variable value', { userId: 123, action: 'init' });

// Info - general operational information
logger.info('User logged in', { userId: 123, email: 'user@example.com' });

// Warn - potentially problematic situations
logger.warn('High memory usage detected', { memoryUsageMB: 512 });

// Error - errors that need attention
logger.error('Failed to process request', { error: 'Timeout' });

// Log with error object (includes stack trace)
try {
  doSomething();
} catch (error) {
  logger.logError('Operation failed', error as Error, { context: 'operation-name' });
}
```

### Context Objects

Always pass context as an object (second parameter):
```typescript
// GOOD
logger.info('User action', { userId: 123, action: 'download', filename: 'report.pdf' });

// BAD - avoid string concatenation
logger.info(`User ${userId} performed ${action}`);
```

### PHI Safety (Automatic)

The logger automatically redacts:
- SSN patterns (XXX-XX-XXXX)
- Phone numbers
- Email addresses
- Patient IDs
- Medical record numbers
- Dates of birth
- First/last names
- Any field named: email, phone, ssn, mrn, patient_id, etc.

You can log data safely without worrying about PII exposure:
```typescript
// PHI is automatically redacted
logger.info('User data', {
  email: 'john.doe@example.com',        // → [REDACTED]
  phone: '555-123-4567',                // → [REDACTED]
  ssn: '123-45-6789',                   // → [REDACTED]
  address: '123 Main St',               // → [REDACTED]
  diagnosis: 'Type 2 Diabetes'          // → [PHI_REDACTED]
});
```

## Environment Variables

### Control Log Level
```bash
# Show everything
LOG_LEVEL=debug

# Show info and above (default)
LOG_LEVEL=info

# Show only warnings and errors
LOG_LEVEL=warn

# Show only errors
LOG_LEVEL=error
```

### Control Output Format
```bash
# Pretty format (development - default)
LOG_FORMAT=pretty

# JSON format (production)
LOG_FORMAT=json
```

## Examples

### Authentication Flow
```typescript
import { createLogger } from '../utils/logger';
const logger = createLogger('auth-routes');

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Log validation
    logger.debug('Login attempt', { email });

    const result = await authService.login(email, password);

    if (!result.success) {
      logger.warn('Login failed', { email, reason: result.error });
      return res.status(401).json({ error: result.error });
    }

    logger.info('User logged in successfully', {
      userId: result.user.id,
      email: result.user.email
    });

    res.json({ token: result.token });
  } catch (error) {
    logger.logError('Login error', error as Error, { email: req.body.email });
    res.status(500).json({ error: 'Login failed' });
  }
});
```

### Service Operations
```typescript
import { createLogger } from '../utils/logger';
const logger = createLogger('user-service');

export async function updateUserProfile(userId: string, data: UserProfile) {
  try {
    logger.debug('Updating user profile', { userId });

    const result = await database.updateUser(userId, data);

    logger.info('User profile updated', {
      userId,
      fieldsUpdated: Object.keys(data)
    });

    return result;
  } catch (error) {
    logger.error('Failed to update user profile', {
      userId,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    throw error;
  }
}
```

### Server Initialization
```typescript
import { createLogger } from './utils/logger';
const logger = createLogger('server');

async function start() {
  try {
    logger.debug('Starting server initialization', { env: process.env.NODE_ENV });

    // Initialize services
    await initializeDatabase();
    logger.info('Database connected', { host: process.env.DB_HOST });

    await initializeCache();
    logger.info('Cache initialized', { provider: 'redis' });

    // Start server
    app.listen(PORT, () => {
      logger.info('Server started', {
        port: PORT,
        environment: process.env.NODE_ENV,
        timestamp: new Date().toISOString()
      });
    });
  } catch (error) {
    logger.logError('Server initialization failed', error as Error);
    process.exit(1);
  }
}
```

## Request-Scoped Logging

For request handlers, create a request-scoped logger:
```typescript
import { createRequestLogger } from '../utils/logger';

export function requestHandler(req: Request, res: Response) {
  const requestId = req.id || generateRequestId();
  const logger = createRequestLogger(requestId, 'handler-module');

  logger.info('Request started', { method: req.method, path: req.path });
  // ... handle request
  logger.info('Request completed', { statusCode: res.statusCode });
}
```

## Common Patterns

### Database Operations
```typescript
logger.debug('Database query', { table: 'users', query: 'SELECT ...' });
logger.info('Records inserted', { table: 'users', count: 5 });
logger.error('Database error', { table: 'users', code: 'CONSTRAINT_FAILED' });
```

### API Calls
```typescript
logger.debug('API request', { method: 'POST', url: '/api/v1/data' });
logger.info('API response received', { statusCode: 200, duration: '245ms' });
logger.warn('API rate limit approaching', { remaining: 5, limit: 100 });
```

### File Operations
```typescript
logger.debug('Reading file', { path: '/data/report.csv' });
logger.info('File processed', { path: '/data/report.csv', size: '2.5MB' });
logger.error('File read error', { path: '/data/report.csv', errno: 'ENOENT' });
```

## DO's and DON'Ts

### DO
- Use structured context objects
- Include relevant IDs (userId, requestId, etc.)
- Log at appropriate levels
- Use meaningful messages
- Include counts, sizes, durations for performance tracking

### DON'T
- Concatenate strings into the message
- Log raw PII (it's auto-redacted but best practice)
- Use console.log/console.error
- Log in loops (use count summary instead)
- Include credentials or tokens in context

## Troubleshooting

### Logs not showing?
Check the `LOG_LEVEL` environment variable:
```bash
# Show what you're logging
LOG_LEVEL=debug npm run dev
```

### Want JSON logs?
```bash
# Set in production
LOG_FORMAT=json npm start
```

### Need to find logs by request?
Use the requestId in context:
```typescript
const logger = createRequestLogger(requestId);
logger.info('User action', { action: 'download' });
// Easy to trace all logs from one request
```

## Migration from console.log

Quick patterns to update existing code:

```typescript
// Replace console.log
console.log('message') → logger.info('message')
console.log('message', data) → logger.info('message', data)

// Replace console.error
console.error('message') → logger.error('message')
console.error('message', error) → logger.logError('message', error as Error)

// Replace console.warn
console.warn('message') → logger.warn('message')

// Replace console.debug
console.debug('message') → logger.debug('message')
```
