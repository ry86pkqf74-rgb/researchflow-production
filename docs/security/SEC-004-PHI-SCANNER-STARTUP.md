# SEC-004: PHI Scanner Startup Validation

## Overview

When `PHI_SCAN_ENABLED=true`, the ResearchFlow system must verify that the PHI scanner is operational before accepting requests. This security measure ensures protected health information handling compliance and prevents degraded functionality from being silently ignored.

## Requirements

1. **Verify Dependencies**: Confirm PHI scanner dependencies are loaded
2. **Test Scan**: Run a test scan on dummy data containing PHI patterns
3. **Test Redaction**: Verify redaction functionality works correctly
4. **Block on Failure**: Startup must fail in production if scanner fails with `PHI_SCAN_ENABLED=true`
5. **Clear Logging**: Log exactly what failed and why

## Architecture

### Health Check Service

Location: `services/orchestrator/src/services/phi-scanner-healthcheck.ts`

Provides comprehensive health check functionality:

```typescript
// Main function - runs all checks
export async function performPhiScannerHealthCheck(): Promise<HealthCheckResult>

// Log results with appropriate formatting
export function logHealthCheckResults(result: HealthCheckResult): void

// Validate and potentially block startup
export function validateHealthCheckForStartup(result: HealthCheckResult, isProduction: boolean): void
```

### Result Types

```typescript
interface HealthCheckResult {
  status: 'healthy' | 'degraded' | 'failed';
  timestamp: string;
  checks: {
    configEnabled: boolean;      // PHI_SCAN_ENABLED setting
    scannerLoaded: boolean;       // Dependencies loaded
    testScanPassed: boolean;      // Test scans successful
    testRedactionPassed: boolean; // Redaction works
  };
  errors: string[];              // Critical failures
  warnings: string[];            // Non-critical issues
}
```

## Startup Integration

The health check is integrated into the server initialization sequence in `services/orchestrator/src/index.ts`:

```typescript
async function initializeServer() {
  try {
    // 1. Initialize Planning Queues
    await initPlanningQueues();

    // 2. Validate PHI Scanner (before accepting requests)
    const phiHealthCheck = await performPhiScannerHealthCheck();
    logHealthCheckResults(phiHealthCheck);
    validateHealthCheckForStartup(phiHealthCheck, NODE_ENV === 'production');

    // 3. Start server
    startServer();
  } catch (error) {
    console.error('[Server Init] Fatal error during initialization:', error);
    process.exit(1);
  }
}
```

## Behavior

### Configuration Disabled (`PHI_SCAN_ENABLED=false`)

- Health check completes immediately
- Returns `status: 'healthy'` without running tests
- Server starts normally

### Configuration Enabled (`PHI_SCAN_ENABLED=true`)

#### All Checks Pass → `status: 'healthy'`
- Dependencies loaded successfully
- Test scans detect PHI patterns correctly
- Redaction functionality works
- Server starts normally

#### Some Warnings → `status: 'degraded'`
- Scanner is operational but with limitations
- Example: Some PHI patterns may be disabled
- Server starts with warnings logged
- Production deployments should investigate before release

#### Critical Failure → `status: 'failed'`

**Development/Non-Production**:
- Error logged but server starts anyway
- Allows troubleshooting in dev environment

**Production** (`NODE_ENV=production`):
- Server startup **BLOCKED**
- Process exits with code 1
- Clear error message explains what failed
- Examples of critical failures:
  - Scanner module not loadable
  - PHI pattern engine not initialized
  - Test scan cannot complete
  - Redaction functionality broken

## Test Patterns

The health check tests the scanner with the following data:

| Pattern | Test Data | Expected |
|---------|-----------|----------|
| SSN | "My SSN is 123-45-6789" | Detected |
| MRN | "Patient MRN: 987654321" | Detected |
| Phone | "Call me at (555) 123-4567" | Detected |
| Email | "Contact: john.doe@example.com" | Detected |
| Clean | "This is completely clean text..." | Not detected |

## Error Messages

### Example: Scanner Not Loadable

```
========================================================================
PHI SCANNER HEALTH CHECK RESULTS
========================================================================
Status:        FAILED
Timestamp:     2026-01-28T12:34:56.789Z
Config:        PHI_SCAN_ENABLED=true

Checks:
  - Dependencies Loaded: ✗
  - Test Scan Passed:    ✗
  - Redaction Passed:    ✗

ERRORS:
  ✗ scanForPhi function not available from phi-protection
  ✗ redactPhiInData function not available from phi-protection

========================================================================
[PHI Health Check] CRITICAL: PHI Scanner failed to initialize
Node Environment: production
Configuration: PHI_SCAN_ENABLED=true
Errors:
  - scanForPhi function not available from phi-protection
  - redactPhiInData function not available from phi-protection

ACTION REQUIRED:
The PHI scanner must be operational when PHI_SCAN_ENABLED=true in production.
Please check the errors above and fix before starting the server.
```

### Example: Test Scan Failed

```
========================================================================
PHI SCANNER HEALTH CHECK RESULTS
========================================================================
Status:        FAILED
Timestamp:     2026-01-28T12:34:56.789Z
Config:        PHI_SCAN_ENABLED=true

Checks:
  - Dependencies Loaded: ✓
  - Test Scan Passed:    ✗
  - Redaction Passed:    ✓

ERRORS:
  ✗ Failed to detect SSN pattern in test data

========================================================================
```

## Logging

Health check results are logged with clear markers:

- `[PHI Health Check] ✓` - Success
- `[PHI Health Check] ⚠` - Warning/degraded
- `[PHI Health Check] ✗` - Error/failure

## Testing

Unit tests located at: `tests/unit/services/phi-scanner-healthcheck.test.ts`

Test coverage includes:
- Health check execution
- Result logging
- Startup validation logic
- Production vs. development behavior
- Error and warning handling
- Timestamp validation

Run tests:
```bash
npm test -- phi-scanner-healthcheck.test.ts
```

## Monitoring

After startup, monitor:

1. **Logs** - Look for `[PHI Health Check]` markers in startup logs
2. **Status** - Check health endpoint: `GET /health`
3. **Governance** - Verify `GOVERNANCE_MODE` is appropriate for environment

## Configuration

### Environment Variables

```bash
# Enable PHI scanning (default: true)
PHI_SCAN_ENABLED=true

# Fail-closed behavior (when PHI detected, deny operation)
PHI_FAIL_CLOSED=true

# Governance mode (DEMO or LIVE)
GOVERNANCE_MODE=LIVE

# Production flag
NODE_ENV=production
```

## Troubleshooting

### "PHI Scanner initialization failed - startup blocked"

**In Production**:
1. Check `PHI_SCAN_ENABLED` in `.env` - is it intentionally true?
2. Verify phi-engine package is installed and loadable
3. Check for build errors in phi-protection service
4. Confirm all dependencies in package.json are installed

**Temporary Workaround** (non-ideal):
- Set `PHI_SCAN_ENABLED=false` temporarily
- Only for debugging - must be re-enabled before production

### "Test scan failed" or "Redaction may not be working"

1. Check if PHI patterns are being loaded from `@researchflow/phi-engine`
2. Verify regex patterns are compiled correctly
3. Check for runtime errors in pattern matching
4. Look at detailed error messages in logs

### Server starts without health check

1. Confirm imports are correct in index.ts
2. Check for syntax errors in phi-scanner-healthcheck.ts
3. Verify async/await chain is correct
4. Look for exception swallowing in error handler

## Related Files

- **Health Check Service**: `services/orchestrator/src/services/phi-scanner-healthcheck.ts`
- **PHI Protection Service**: `services/orchestrator/src/services/phi-protection.ts`
- **PHI Scanner Utility**: `services/orchestrator/src/utils/phi-scanner.ts`
- **PHI Engine Package**: `packages/phi-engine/src/`
- **Server Entry**: `services/orchestrator/src/index.ts`
- **Tests**: `tests/unit/services/phi-scanner-healthcheck.test.ts`

## Compliance

This implementation supports:

- **HIPAA** - Ensures PHI handling mechanisms are operational
- **GDPR** - Validates privacy controls before processing
- **HITRUST** - Demonstrates control validation at startup
- **SOC 2** - Validates critical security function availability

## Security Considerations

1. **No PHI in Logs** - Health check reports hashes/locations, never raw PHI
2. **Fail-Closed** - Startup fails rather than degrading silently
3. **Production-First** - Stricter validation in production
4. **Clear Errors** - Specific messages aid troubleshooting without exposing details

## Version History

- **2026-01-28** - Initial implementation of SEC-004
