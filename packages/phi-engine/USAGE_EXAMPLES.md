# Log Scrubber Usage Examples

## Overview
The PHI Engine log scrubber automatically sanitizes Protected Health Information (PHI) from application logs, ensuring HIPAA compliance.

## Installation

The log scrubber is included in `@researchflow/phi-engine`. For Pino integration, install Pino as well:

```bash
npm install pino  # Optional, only needed for Pino adapter
```

## Basic Usage

### Scrubbing String Messages

```typescript
import { scrubLog } from '@researchflow/phi-engine';

const message = 'Patient SSN: 123-45-6789, Email: john@example.com';
const scrubbed = scrubLog(message);
// Result: 'Patient SSN: [REDACTED:SSN], Email: [REDACTED:EMAIL]'
```

### Scrubbing Objects

```typescript
import { scrubObject } from '@researchflow/phi-engine';

const data = {
  patient: {
    name: 'John Doe',
    ssn: '123-45-6789',
    email: 'patient@example.com',
    phone: '(555) 123-4567'
  }
};

const scrubbed = scrubObject(data);
// Result: {
//   patient: {
//     name: 'John Doe',
//     ssn: '[REDACTED:SSN]',
//     email: '[REDACTED:EMAIL]',
//     phone: '([REDACTED:PHONE]'
//   }
// }
```

## Pino Logger Integration

### Creating a Scrubbed Logger

```typescript
import { createScrubbedLogger } from '@researchflow/phi-engine';

// Create a PHI-safe Pino logger
const logger = createScrubbedLogger({
  level: process.env.LOG_LEVEL || 'info',
  name: 'my-app'
});

// All logs are automatically scrubbed
logger.info({ patientSSN: '123-45-6789' }, 'Processing patient');
// Output: { patientSSN: '[REDACTED:SSN]', scrubbed: true } Processing patient

logger.warn('Patient email: test@example.com needs update');
// Output: Patient email: [REDACTED:EMAIL] needs update
```

### Child Loggers

```typescript
// Child loggers inherit scrubbing behavior
const childLogger = logger.child({ 
  module: 'patient-service',
  environment: 'production' 
});

childLogger.info({ ssn: '987-65-4321' }, 'Patient record updated');
// PHI automatically scrubbed
```

## Console Override (Development Only)

For development environments, you can override console methods:

```typescript
import { 
  installConsoleScrubber, 
  removeConsoleScrubber 
} from '@researchflow/phi-engine';

// Install (throws error in production)
installConsoleScrubber();

// Now all console output is scrubbed
console.log('Patient SSN: 123-45-6789');
// Output: Patient SSN: [REDACTED:SSN]

console.error('Error processing email: test@example.com');
// Output: Error processing email: [REDACTED:EMAIL]

// Remove when done
removeConsoleScrubber();
```

## Utility Functions

### Check for PHI

```typescript
import { containsPhi } from '@researchflow/phi-engine';

if (containsPhi('SSN: 123-45-6789')) {
  console.log('PHI detected! Handle with care.');
}
```

### Get PHI Statistics

```typescript
import { getPhiStats } from '@researchflow/phi-engine';

const message = 'SSN: 123-45-6789, Email: a@b.com, Email2: c@d.com';
const stats = getPhiStats(message);
// Result: { SSN: 1, EMAIL: 2 }

console.log(`Found ${stats.SSN} SSNs and ${stats.EMAIL} emails`);
```

## Application Entry Point Example

```typescript
// app.ts
import { createScrubbedLogger } from '@researchflow/phi-engine';

// Create scrubbed logger for the entire application
export const logger = createScrubbedLogger({
  level: process.env.LOG_LEVEL || 'info',
  name: 'researchflow-canvas',
  transport: process.env.NODE_ENV === 'development' 
    ? { target: 'pino-pretty' }
    : undefined
});

// Use throughout the application
logger.info('Application started');
```

```typescript
// patient-service.ts
import { logger } from './app';

const serviceLogger = logger.child({ service: 'patient' });

export function processPatient(data: PatientData) {
  // This will be automatically scrubbed
  serviceLogger.info({ patientData: data }, 'Processing patient');
}
```

## Performance

The log scrubber is highly optimized:
- **10,000+ messages per second** processing speed
- Cached regex patterns for maximum performance
- Minimal overhead on logging operations

Performance test results:
```
✓ Scrubbed 10,000 messages in 61.41ms
  Average: 0.0061ms per message

✓ Scrubbed 10,000 objects in 323.63ms
  Average: 0.0324ms per object
```

## PHI Types Detected

The scrubber detects and redacts all HIPAA-defined identifiers:
- SSN (Social Security Numbers)
- MRN (Medical Record Numbers)
- Email addresses
- Phone numbers
- Names with titles (Dr., Mr., Mrs., Ms.)
- Street addresses
- ZIP codes
- Dates of birth
- IP addresses
- URLs
- Account numbers
- License numbers
- Device IDs
- Ages over 89

## Best Practices

1. **Use Pino Adapter in Production**: The Pino adapter provides the best performance and integration.

2. **Console Override for Development Only**: Never use `installConsoleScrubber()` in production.

3. **Child Loggers for Context**: Create child loggers for different modules/services.

4. **Monitor PHI Stats**: Use `getPhiStats()` to monitor and audit PHI detection.

5. **Test Your Logs**: Always test that PHI is properly scrubbed before deploying.

## Error Handling

```typescript
try {
  logger.error({ 
    error: err,
    patientSSN: '123-45-6789' 
  }, 'Failed to process patient');
  // Both error message and SSN are scrubbed
} catch (e) {
  // Logging errors are handled internally
}
```

## Integration with Express

```typescript
import express from 'express';
import { createScrubbedLogger } from '@researchflow/phi-engine';

const app = express();
const logger = createScrubbedLogger({ name: 'api' });

// Request logging middleware
app.use((req, res, next) => {
  logger.info({
    method: req.method,
    url: req.url,
    body: req.body  // PHI in request body will be scrubbed
  }, 'Request received');
  next();
});

// Error handling
app.use((err, req, res, next) => {
  logger.error({ 
    err, 
    url: req.url,
    body: req.body  // PHI scrubbed
  }, 'Request failed');
  res.status(500).json({ error: 'Internal server error' });
});
```
