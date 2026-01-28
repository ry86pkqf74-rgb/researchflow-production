# Audit Logging for Authentication Events - Implementation Guide

## Overview

This document describes the audit logging implementation for all authentication events in the ResearchFlow production system. The audit system uses SHA-256 hash chaining to ensure tamper detection and integrity verification.

## Architecture

### Hash Chain Mechanism

Each audit log entry includes:
- **entryHash**: SHA-256 hash of the current entry plus the previous hash
- **previousHash**: Reference to the hash of the previous entry (or "GENESIS" for first entry)

This creates an immutable chain where tampering with any entry would break all subsequent hashes, making it possible to detect unauthorized modifications.

## Audit Events

### Supported Event Types

The following authentication events are logged:

1. **LOGIN_SUCCESS** - User successfully authenticates
2. **LOGIN_FAILURE** - Failed login attempt (with reason)
3. **LOGOUT** - User logs out
4. **REGISTRATION** - New user registration (success/failure)
5. **PASSWORD_RESET_REQUEST** - User requests password reset
6. **PASSWORD_RESET_SUCCESS** - Password successfully reset
7. **SESSION_EXPIRATION** - User session expires
8. **TOKEN_REFRESH_SUCCESS** - Access token successfully refreshed
9. **TOKEN_REFRESH_FAILURE** - Failed token refresh (with reason)

## Entry Structure

Each audit log entry contains:

```typescript
{
  eventType: string;           // Type of auth event
  userId?: string;             // User ID (if known)
  ipAddress?: string;          // Client IP address
  userAgent?: string;          // Browser/client user agent
  success: boolean;            // Whether the event succeeded
  failureReason?: string;      // Reason for failure (if applicable)
  details?: Record<string, any>; // Additional event details
  previousHash: string;        // Hash chain linkage
  entryHash: string;          // Current entry hash
  timestamp: Date;            // When the event occurred (auto-set)
}
```

## Files Modified

### 1. `/services/orchestrator/src/services/audit-service.ts`

Added the `logAuthEvent()` function to log authentication events with full hash chain integrity:

```typescript
export async function logAuthEvent(entry: {
  eventType: 'LOGIN_SUCCESS' | 'LOGIN_FAILURE' | 'LOGOUT' | 'REGISTRATION' |
    'PASSWORD_RESET_REQUEST' | 'PASSWORD_RESET_SUCCESS' | 'SESSION_EXPIRATION' |
    'TOKEN_REFRESH_SUCCESS' | 'TOKEN_REFRESH_FAILURE';
  userId?: string;
  ipAddress?: string;
  userAgent?: string;
  success: boolean;
  failureReason?: string;
  details?: Record<string, any>;
}): Promise<void>
```

### 2. `/services/orchestrator/src/utils/request-metadata.ts` (NEW)

Created utility functions to extract request metadata:

- `getClientIpAddress(req)` - Extracts client IP, checking multiple headers for proxy support
  - Checks: X-Forwarded-For, X-Real-IP, CF-Connecting-IP, socket.remoteAddress
  - Returns first IP from list to get original client

- `getUserAgent(req)` - Extracts user agent string

- `getRequestMetadata(req)` - Returns both IP and user agent in one call

### 3. `/services/orchestrator/src/routes/auth.ts`

Added audit logging to all authentication endpoints:

#### POST /api/auth/register
- Logs registration success/failure
- Captures user role and email on success
- Logs validation errors with details

#### POST /api/auth/login
- Logs login success with user role
- Logs login failures with specific failure reason
- Captures email for failed attempts

#### POST /api/auth/logout
- Logs logout events for authenticated users
- Captures user email and logout action

#### POST /api/auth/logout-all
- Logs logout from all devices
- Marks action as "logout_all_devices"

#### POST /api/auth/refresh
- Logs token refresh success
- Logs token refresh failures with reason

#### POST /api/auth/forgot-password
- Logs password reset requests
- Records whether user exists (for security)
- Handles validation errors

#### POST /api/auth/reset-password
- Logs successful password resets
- Logs failed reset attempts with reasons
- Tracks invalid/expired token attempts

## Usage Examples

### Logging a Successful Login

```typescript
await logAuthEvent({
  eventType: 'LOGIN_SUCCESS',
  userId: user.id,
  ipAddress: '192.168.1.100',
  userAgent: 'Mozilla/5.0...',
  success: true,
  details: {
    email: user.email,
    role: user.role
  }
});
```

### Logging a Failed Login

```typescript
await logAuthEvent({
  eventType: 'LOGIN_FAILURE',
  ipAddress: req.ip,
  userAgent: req.headers['user-agent'],
  success: false,
  failureReason: 'Invalid email or password',
  details: {
    email: loginAttempt.email,
    attemptCount: failedAttempts
  }
});
```

### Logging a Registration

```typescript
await logAuthEvent({
  eventType: 'REGISTRATION',
  userId: newUser.id,
  ipAddress: clientIp,
  userAgent: clientUserAgent,
  success: true,
  details: {
    email: newUser.email,
    role: 'RESEARCHER'
  }
});
```

### Logging a Password Reset Request

```typescript
await logAuthEvent({
  eventType: 'PASSWORD_RESET_REQUEST',
  userId: user.id,
  ipAddress: clientIp,
  userAgent: clientUserAgent,
  success: true,
  details: {
    email: user.email
  }
});
```

## Integration with Request Metadata

Extract client information from Express requests:

```typescript
import { getRequestMetadata } from '../utils/request-metadata';

// In your route handler
const metadata = getRequestMetadata(req);

await logAuthEvent({
  eventType: 'LOGIN_SUCCESS',
  userId: user.id,
  ipAddress: metadata.ipAddress,
  userAgent: metadata.userAgent,
  success: true,
  details: { email: user.email }
});
```

## Database Schema

The `audit_logs` table stores all events with the following columns:

- `id` (serial) - Primary key
- `eventType` (text) - Type of event
- `userId` (varchar) - User ID (nullable)
- `ipAddress` (varchar) - Client IP (nullable)
- `userAgent` (text) - Browser user agent (nullable)
- `action` (text) - Action result ('SUCCESS' or 'FAILURE')
- `details` (jsonb) - Additional event details
- `previousHash` (varchar) - Hash chain linkage
- `entryHash` (varchar) - Current entry hash
- `createdAt` (timestamp) - Event timestamp

## Verification

### Verifying Audit Chain Integrity

```typescript
import { verifyAuditChain } from '../services/audit-service';

const result = await verifyAuditChain();

if (result.valid) {
  console.log(`Audit chain valid with ${result.totalEntries} entries`);
} else {
  console.error(`Chain broken at entry ${result.brokenAt}`);
}
```

### Retrieving Audit Logs

```typescript
import { getAuditLogsForResource } from '../services/audit-service';

// Get all audit logs for a specific resource
const logs = await getAuditLogsForResource('USER', userId);
```

## Security Considerations

1. **Error Handling**: All audit logging is wrapped in `.catch()` to prevent audit failures from breaking authentication
2. **IP Address Extraction**: Handles proxy scenarios by checking multiple headers
3. **Failure Reasons**: Generic messages in API responses while detailed reasons are logged
4. **Email Enumeration Prevention**: Password reset endpoints return success even if user doesn't exist
5. **Hash Chain Integrity**: Tampered entries break the chain, enabling detection
6. **Immutability**: Once logged, entries cannot be modified without breaking the hash chain

## Testing

Run the test suite:

```bash
npm test -- tests/audit-auth-events.test.ts
```

Tests verify:
- All event types are logged correctly
- Hash chain integrity is maintained
- IP address extraction works across proxy scenarios
- Metadata is captured accurately
- Failures are logged with reasons

## Monitoring and Alerts

Monitor the audit logs for:

1. **Multiple Failed Login Attempts** - Possible brute force attack
2. **Password Resets for Multiple Users** - Possible compromised reset mechanism
3. **Unusual IP Addresses** - Possible unauthorized access
4. **Broken Hash Chains** - Possible tampering attempts
5. **Session Expirations** - Normal activity metrics

## Future Enhancements

1. **Session Expiration Tracking**: Add automatic logging when tokens expire
2. **Rate Limiting Integration**: Log rate limit violations
3. **Geographic Analysis**: Include GeoIP data with IP addresses
4. **Real-time Alerts**: Alert on suspicious patterns
5. **Audit Log Export**: Bulk export functionality for compliance
6. **Encryption at Rest**: Encrypt sensitive audit data in database

## Compliance

This audit logging system supports:
- **SOC 2 Type II** - Detailed authentication audit trail
- **HIPAA** - PHI access tracking with IP and user agent
- **GDPR** - User activity logs with timestamp and details
- **HITRUST** - Comprehensive authentication event logging
- **Regulatory Requirements** - Non-repudiation through hash chains
