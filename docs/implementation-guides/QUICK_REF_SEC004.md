# SEC-004 Quick Reference

## What is SEC-004?

PHI Scanner Startup Validation - ensures the PHI scanner is operational before the server accepts requests when `PHI_SCAN_ENABLED=true`.

## Files at a Glance

| File | Role |
|------|------|
| `services/orchestrator/src/services/phi-scanner-healthcheck.ts` | Health check service |
| `services/orchestrator/src/index.ts` | Startup integration (lines 422-452, 582-585) |
| `tests/unit/services/phi-scanner-healthcheck.test.ts` | Unit tests |
| `docs/security/SEC-004-PHI-SCANNER-STARTUP.md` | Full documentation |

## Key Functions

### `performPhiScannerHealthCheck(): Promise<HealthCheckResult>`
Runs all validation checks:
- ✓ Dependencies loaded
- ✓ Test scans work
- ✓ Redaction works

### `logHealthCheckResults(result: HealthCheckResult): void`
Pretty-prints results with status, checks, errors, warnings

### `validateHealthCheckForStartup(result: HealthCheckResult, isProduction: boolean): void`
Validates result and potentially blocks startup (production only)

## Quick Test

```bash
# Run health check tests
npm test -- phi-scanner-healthcheck.test.ts

# Start server with PHI scanning enabled (dev)
PHI_SCAN_ENABLED=true npm start

# Start server with PHI scanning enabled (prod - will block if scanner fails)
NODE_ENV=production PHI_SCAN_ENABLED=true npm start
```

## Behavior Matrix

| Config | Environment | Status | Action |
|--------|-------------|--------|--------|
| `PHI_SCAN_ENABLED=false` | Any | - | Skip validation, start server |
| `PHI_SCAN_ENABLED=true` | Development | ✓ Healthy | Start server |
| `PHI_SCAN_ENABLED=true` | Development | ⚠ Degraded | Start server, log warnings |
| `PHI_SCAN_ENABLED=true` | Development | ✗ Failed | Start server, log errors |
| `PHI_SCAN_ENABLED=true` | Production | ✓ Healthy | Start server |
| `PHI_SCAN_ENABLED=true` | Production | ⚠ Degraded | Start server, log warnings |
| `PHI_SCAN_ENABLED=true` | Production | ✗ Failed | **BLOCK STARTUP** |

## Error Messages

### Startup Blocked (Production)
```
[PHI Health Check] CRITICAL: PHI Scanner failed to initialize
Node Environment: production
Configuration: PHI_SCAN_ENABLED=true
Errors:
  - [specific error details]

ACTION REQUIRED:
The PHI scanner must be operational when PHI_SCAN_ENABLED=true in production.
```

### Degraded (Warnings)
```
[PHI Health Check] ⚠ Scanner is operational but with warnings
[PHI Health Check] Warnings:
  - [specific warning]
```

### Healthy
```
[PHI Health Check] ✓ All checks passed - PHI scanner is operational
```

## Configuration

```bash
# Enable PHI scanning (default: true)
PHI_SCAN_ENABLED=true

# Fail-closed behavior
PHI_FAIL_CLOSED=true

# Governance mode
GOVERNANCE_MODE=LIVE

# Production
NODE_ENV=production
```

## What Gets Tested

| Pattern | Test Data | Expected |
|---------|-----------|----------|
| SSN | "My SSN is 123-45-6789" | Detected |
| MRN | "Patient MRN: 987654321" | Detected |
| Phone | "Call me at (555) 123-4567" | Detected |
| Email | "Contact: john.doe@example.com" | Detected |
| Clean | Normal text | NOT detected |

## Health Check Result Type

```typescript
interface HealthCheckResult {
  status: 'healthy' | 'degraded' | 'failed';
  timestamp: string;                    // ISO 8601
  checks: {
    configEnabled: boolean;             // PHI_SCAN_ENABLED setting
    scannerLoaded: boolean;             // Dependencies available
    testScanPassed: boolean;            // Tests successful
    testRedactionPassed: boolean;       // Redaction works
  };
  errors: string[];                     // Critical issues
  warnings: string[];                   // Non-critical issues
}
```

## Startup Flow

```
1. Server starts (index.ts)
   ↓
2. initializeServer() called
   ├─ Initialize Planning Queues
   ├─ Validate PHI Scanner ← SEC-004
   │  ├─ Check config (PHI_SCAN_ENABLED)
   │  ├─ Verify dependencies
   │  ├─ Run test scans
   │  ├─ Run redaction tests
   │  └─ Log results
   ├─ validateHealthCheckForStartup()
   │  └─ Block startup in production if failed
   └─ startServer()
   ↓
3. HTTP server listening
```

## Troubleshooting

### "PHI Scanner failed to initialize"
1. Check `PHI_SCAN_ENABLED` in `.env`
2. Verify phi-engine package is installed
3. Check for build errors in phi-protection
4. Install dependencies: `npm install`

### "Test scan failed"
1. Check if patterns are loaded from `@researchflow/phi-engine`
2. Verify regex patterns compile correctly
3. Check for runtime errors in logs

### "Redaction may not be working"
1. Verify `redactPhiInData()` function exists
2. Check if redaction markers `[REDACTED-*]` appear in output
3. Confirm original PHI is removed

### "Server starts without health check"
1. Verify imports in `index.ts` are correct (line 424)
2. Check for syntax errors in `phi-scanner-healthcheck.ts`
3. Confirm `initializeServer()` is called (line 582)
4. Look for exceptions in error handler

## Security Note

- ✅ No raw PHI in logs
- ✅ Only hashes/locations reported
- ✅ Startup fails rather than degrading silently
- ✅ Production-first validation
- ✅ Clear error messages without exposing details

## Performance

- Health check runs in < 100ms (typical)
- Non-blocking relative to server startup
- Minimal overhead (regex pattern matching only)
- No external API calls

## Logging Markers

```
[PHI Health Check] ✓    → Success
[PHI Health Check] ⚠    → Warning/degraded
[PHI Health Check] ✗    → Error/failure
[Server Init]           → Server initialization
```

## Related Documentation

- Full Details: `docs/security/SEC-004-PHI-SCANNER-STARTUP.md`
- Implementation: `docs/IMPLEMENTATION_SEC004.md`
- Source: `services/orchestrator/src/services/phi-scanner-healthcheck.ts`

## Compliance

- HIPAA: Validates PHI controls
- GDPR: Validates privacy controls
- HITRUST: Demonstrates control validation
- SOC 2: Validates critical function availability
