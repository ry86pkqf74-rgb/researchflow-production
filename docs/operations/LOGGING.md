# Logging Operations Guide

This document describes the structured logging system used in ResearchFlow, including configuration, best practices, and PHI-safe logging guidelines.

## Overview

ResearchFlow uses a structured logging system that provides:

- **Log levels**: debug, info, warn, error
- **Environment-based configuration** via `LOG_LEVEL` and `LOG_FORMAT`
- **JSON output format** for production log aggregation
- **PHI-safe logging** with automatic redaction of sensitive data
- **Contextual information**: timestamp, level, module, requestId

## Configuration

### Environment Variables

| Variable | Values | Default | Description |
|----------|--------|---------|-------------|
| `LOG_LEVEL` | `debug`, `info`, `warn`, `error` | `info` | Minimum log level to output |
| `LOG_FORMAT` | `json`, `text` | `text` | Output format for logs |

### Log Level Hierarchy

Log levels follow a severity hierarchy (from most to least verbose):

1. **debug** - Detailed debugging information (disabled in production)
2. **info** - General operational information
3. **warn** - Warning conditions that should be reviewed
4. **error** - Error conditions requiring attention

When `LOG_LEVEL` is set, only messages at that level or higher severity are output.

### Recommended Settings by Environment

#### Development

```bash
LOG_LEVEL=debug
LOG_FORMAT=text
```

Human-readable output with full debugging details.

#### Staging

```bash
LOG_LEVEL=info
LOG_FORMAT=json
```

JSON output for log aggregation, info level for operational visibility.

#### Production

```bash
LOG_LEVEL=info
LOG_FORMAT=json
```

JSON output for log aggregation. Use `warn` if log volume is too high.

## JSON Output Format

When `LOG_FORMAT=json`, logs are output as single-line JSON objects:

```json
{"timestamp":"2024-01-20T12:00:00.000Z","level":"info","message":"Request completed","module":"orchestrator","requestId":"abc123","context":{"method":"GET","path":"/api/health","statusCode":200,"duration":15}}
```

### Fields

| Field | Type | Description |
|-------|------|-------------|
| `timestamp` | ISO 8601 | When the log entry was created |
| `level` | string | Log level (debug/info/warn/error) |
| `message` | string | Human-readable log message |
| `module` | string | Source module/component name |
| `requestId` | string | Request correlation ID (if available) |
| `context` | object | Additional structured data |

## Usage

### Basic Usage

```typescript
import { createLogger } from './src/utils/logger';

const logger = createLogger('my-module');

logger.debug('Detailed debugging info');
logger.info('General information');
logger.warn('Warning condition');
logger.error('Error occurred');
```

### With Context

```typescript
logger.info('User action completed', {
  userId: user.id,
  action: 'update',
  duration: 150,
});
```

### Error Logging

```typescript
try {
  await riskyOperation();
} catch (error) {
  logger.logError('Operation failed', error as Error, {
    operationId: opId,
  });
}
```

### Request-Scoped Logging

```typescript
import { createRequestLogger } from './src/utils/logger';

// In middleware
const requestLogger = createRequestLogger(req.id);
requestLogger.info('Processing request', { path: req.path });
```

## PHI-Safe Logging Guidelines

### Automatic Redaction

The logger automatically redacts common PHI patterns:

- Social Security Numbers (XXX-XX-XXXX)
- Phone numbers
- Email addresses
- Date of birth patterns
- MRN (Medical Record Numbers)
- Patient ID references

### Sensitive Field Detection

Object keys containing these terms are automatically redacted:

- `ssn`, `socialSecurity`
- `dob`, `dateOfBirth`, `birthdate`
- `mrn`, `medicalRecord`
- `patientId`, `patientName`
- `address`, `street`, `zip`
- `phone`, `mobile`, `telephone`
- `email`
- `firstName`, `lastName`, `name`
- `diagnosis`, `treatment`, `medication`
- `insurance`, `policyNumber`

### Best Practices

1. **Never log raw PHI**
   ```typescript
   // BAD - logs actual patient name
   logger.info(`Processing patient ${patient.name}`);

   // GOOD - logs only ID
   logger.info('Processing patient', { patientId: patient.id });
   ```

2. **Use IDs instead of names**
   ```typescript
   // BAD
   logger.info(`User ${user.email} logged in`);

   // GOOD
   logger.info('User logged in', { userId: user.id });
   ```

3. **Redact before logging**
   ```typescript
   // If you must log something potentially sensitive
   logger.info('Data processed', {
     recordCount: records.length,
     // Don't include the actual records
   });
   ```

4. **Audit logs are separate**
   - Use the audit logging system for compliance-required events
   - Operational logs should not contain PHI

## Log Retention and Rotation

### Recommendations

| Environment | Retention | Rotation |
|-------------|-----------|----------|
| Development | 7 days | Daily |
| Staging | 30 days | Daily |
| Production | 90 days | Daily, compressed |

### Docker/Kubernetes

Configure log drivers in your container orchestration:

```yaml
# docker-compose.yml
services:
  orchestrator:
    logging:
      driver: "json-file"
      options:
        max-size: "100m"
        max-file: "5"
```

### Log Aggregation

For production environments, forward logs to a centralized system:

- **Splunk** - Via HEC (HTTP Event Collector)
- **Elasticsearch** - Via Filebeat or Fluentd
- **CloudWatch** - Via AWS log driver
- **Datadog** - Via dd-agent

## Monitoring and Alerting

### Recommended Alerts

| Condition | Severity | Action |
|-----------|----------|--------|
| Error rate > 1% | Warning | Investigate |
| Error rate > 5% | Critical | Immediate response |
| Specific error codes | Varies | Based on code |

### Key Metrics to Track

- Error count by module
- Error rate over time
- Response time percentiles
- Log volume by level

## Troubleshooting

### High Log Volume

If logs are too verbose:

1. Set `LOG_LEVEL=warn` temporarily
2. Review debug statements in hot paths
3. Consider sampling for high-frequency events

### Missing Logs

1. Verify `LOG_LEVEL` is set correctly
2. Check container log configuration
3. Verify log aggregation pipeline

### Performance Impact

- JSON serialization has minimal overhead
- PHI redaction adds ~1-2ms per log entry
- Consider `LOG_LEVEL=warn` if performance-critical

## Security Considerations

1. **Log files should be protected** - Restrict access to log storage
2. **Don't log credentials** - API keys, tokens, passwords
3. **Audit log access** - Track who views logs
4. **Encrypt at rest** - For compliance requirements
5. **Secure transmission** - Use TLS for log forwarding
