# Structured Logging Migration: Before & After Examples

## Example 1: Authentication Validation Error

### Before: auth.ts (Line 46)
```typescript
await logAuthEvent({
  eventType: 'REGISTRATION',
  ipAddress: metadata.ipAddress,
  userAgent: metadata.userAgent,
  success: false,
  failureReason: 'Validation failed',
  details: {
    email: req.body.email,
    errors: parseResult.error.errors
  }
}).catch(err => console.error('Failed to log registration validation error:', err));
```

**Issues:**
- Raw console.error output
- No structured context
- Error handling doesn't propagate context
- Not searchable in log aggregation systems

### After: auth.ts (Line 45)
```typescript
await logAuthEvent({
  eventType: 'REGISTRATION',
  ipAddress: metadata.ipAddress,
  userAgent: metadata.userAgent,
  success: false,
  failureReason: 'Validation failed',
  details: {
    email: req.body.email,
    errors: parseResult.error.errors
  }
}).catch(err => logger.error('Failed to log registration validation error', { error: err }));
```

**Improvements:**
- Structured logging with context object
- Email automatically redacted if PII
- Searchable error field
- Module context included (auth-routes)
- Timestamp automatically added

---

## Example 2: Server Exception Handling

### Before: auth.ts (Line 104)
```typescript
} catch (error) {
  console.error('Registration error:', error);
  const metadata = getRequestMetadata(req);
  await logAuthEvent({
    eventType: 'REGISTRATION',
    // ... event details
  });
  res.status(500).json({ error: 'Registration failed' });
}
```

**Issues:**
- Error object dumped to console
- Stack trace not captured
- No context about request
- Inconsistent with application state

### After: auth.ts (Line 106)
```typescript
} catch (error) {
  logger.logError('Registration error', error as Error);
  const metadata = getRequestMetadata(req);
  await logAuthEvent({
    eventType: 'REGISTRATION',
    // ... event details
  });
  res.status(500).json({ error: 'Registration failed' });
}
```

**Improvements:**
- Stack trace automatically captured (up to 5 lines)
- Error name and message structured
- Environment-aware (stack only in dev)
- Proper error propagation
- Consistent error handling pattern

---

## Example 3: CORS Security Logging

### Before: index.ts (Line 160)
```typescript
if (!isDevelopment && url.protocol !== 'https:') {
  console.warn(`[CORS] Rejected non-HTTPS origin in production: ${origin}`);
  return false;
}
```

**Issues:**
- Manual formatting with [CORS] prefix
- Mixed concerns in string
- Hard to parse for monitoring
- Security event not queryable

### After: index.ts (Line 163)
```typescript
if (!isDevelopment && url.protocol !== 'https:') {
  logger.warn('Rejected non-HTTPS origin in production', { origin });
  return false;
}
```

**Improvements:**
- Origin automatically redacted if it contains email
- Structured event for security monitoring
- Easily queryable: `module: "orchestrator-server" AND message: "Rejected non-HTTPS"`
- Timestamp and environment context included
- Can trigger alerts based on structured fields

---

## Example 4: Startup Banner Refactoring

### Before: index.ts (Lines 465-587)
```typescript
function startServer() {
  httpServer.listen(PORT, () => {
  console.log('='.repeat(60));
  console.log('ResearchFlow Canvas Server');
  console.log('='.repeat(60));
  console.log(`Environment:      ${NODE_ENV}`);
  console.log(`Port:             ${PORT}`);
  console.log(`Governance Mode:  ${process.env.GOVERNANCE_MODE || 'DEMO'}`);
  console.log(`Health Check:     http://localhost:${PORT}/health`);
  console.log(`API Base:         http://localhost:${PORT}/api`);
  console.log(`WebSocket:        ws://localhost:${PORT}/collaboration`);
  console.log('='.repeat(60));
  console.log('Phase 1-2 Features: ACTIVE');
  console.log('  ✓ RBAC Middleware');
  console.log('  ✓ Data Classification');
  // ... 70+ more console.log statements
  console.log('='.repeat(60));
  });
}
```

**Issues:**
- 80+ lines of console.log statements
- Decorative borders and separators
- Feature lists not queryable
- Human-readable but not machine-readable
- Hard to maintain feature state

### After: index.ts (Lines 465-476)
```typescript
function startServer() {
  httpServer.listen(PORT, () => {
  logger.info('ResearchFlow Canvas Server Started', {
    environment: NODE_ENV,
    port: PORT,
    governanceMode: process.env.GOVERNANCE_MODE || 'DEMO',
    health_check: `http://localhost:${PORT}/health`,
    api_base: `http://localhost:${PORT}/api`,
    websocket: `ws://localhost:${PORT}/collaboration`
  });

  logger.info('Features Configuration', {
    phase_1_2: ['RBAC Middleware', 'Data Classification', 'Approval Gates', 'Claim Linter', 'PHI Scanning', 'ORCID Integration'],
    phase_3: ['Artifact Provenance Graph', 'Real-time Collaboration', 'Version Control', 'Comment System'],
    phase_f: ['Feature Flags', 'A/B Experiments', 'Custom Fields', 'Frontend Hooks'],
    phase_g: ['Cluster Monitoring', 'Predictive Scaling', 'Data Sharding', 'Edge Computing', 'Cost Monitoring'],
    phase_h: ['API Documentation', 'Plugin Marketplace', 'AI Model Hooks', 'Overleaf Integration', 'GDPR Consent'],
    agentic: ['AI-Assisted Planning', 'PHI Governance', 'BullMQ Queue', 'Job Status Streaming']
  });
  });
}
```

**Improvements:**
- 75 fewer lines of code (from 80+ to 2 structured logs)
- Machine-readable feature configuration
- Queryable: `context.phase_1_2: "RBAC Middleware"`
- Easy to add/remove features
- JSON output shows structured hierarchy
- Can programmatically check features from logs

---

## Example 5: Error Handling with Context

### Before: auth.ts (Line 495)
```typescript
if (process.env.NODE_ENV === 'development') {
  console.log('[Password Reset] Token for', email, ':', resetToken);
  console.log('[Password Reset] Link: http://localhost:5173/reset-password?token=' + resetToken);
}
```

**Issues:**
- Manual string concatenation
- Inconsistent formatting
- Password reset token logged to stdout
- Manual prefix handling [Password Reset]
- Hard to suppress in production

### After: auth.ts (Line 496)
```typescript
if (process.env.NODE_ENV === 'development') {
  logger.info('Password reset token generated', {
    email,
    token: resetToken,
    link: `http://localhost:5173/reset-password?token=${resetToken}`
  });
}
```

**Improvements:**
- Email automatically redacted
- Token in structured field
- Automatically skipped in production (if LOG_LEVEL doesn't show info)
- Can set LOG_FORMAT=json for testing
- Easy to grep/search for password reset events
- Link is queryable

---

## Example 6: WebSocket Initialization Error

### Before: index.ts (Lines 424-425)
```typescript
try {
  wsServer = new CollaborationWebSocketServer(httpServer);
} catch (error) {
  console.error('Failed to initialize WebSocket server:', error);
  console.log('Continuing without collaboration features...');
}
```

**Issues:**
- Two separate console calls
- No structured error context
- Inconsistent severity levels (error then log)
- Hard to determine if system is degraded

### After: index.ts (Lines 424-426)
```typescript
try {
  wsServer = new CollaborationWebSocketServer(httpServer);
} catch (error) {
  logger.logError('Failed to initialize WebSocket server', error as Error);
  logger.info('Continuing without collaboration features...');
}
```

**Improvements:**
- Error details (name, message, stack) automatically captured
- Proper severity levels maintained
- Can set alerts on ERROR level
- Stack trace helps debugging
- INFO level confirms graceful degradation
- Related events easy to trace together

---

## Output Format Comparison

### Development Mode (Pretty Format)
```
14:23:45 INFO [auth-routes] User logged in successfully { userId: 'user123', email: '[REDACTED]' }
14:23:46 DEBUG [orchestrator-server] Incoming request { method: 'POST', path: '/api/auth/login' }
14:23:47 ERROR [orchestrator-server] Failed to initialize WebSocket server { errorName: 'EADDRINUSE', errorMessage: 'Port 8080 already in use' }
```

**Human-readable:**
- Clear timestamps
- Module names in brackets
- Pretty formatting
- Easy to scan visually

### Production Mode (JSON Format)
```json
{"timestamp":"2026-01-28T14:23:45.123Z","level":"info","message":"User logged in successfully","module":"auth-routes","context":{"userId":"user123","email":"[REDACTED]"}}
{"timestamp":"2026-01-28T14:23:46.456Z","level":"debug","message":"Incoming request","module":"orchestrator-server","context":{"method":"POST","path":"/api/auth/login"}}
{"timestamp":"2026-01-28T14:23:47.789Z","level":"error","message":"Failed to initialize WebSocket server","module":"orchestrator-server","context":{"errorName":"EADDRINUSE","errorMessage":"Port 8080 already in use"}}
```

**Machine-readable:**
- Queryable JSON structure
- Indexable by log systems
- Parseable for metrics
- Easy to filter by level, module, or context fields

---

## Migration Patterns

### Pattern 1: Simple Log Statement
```typescript
// Before
console.log('User action', { userId, action });

// After
logger.info('User action', { userId, action });
```

### Pattern 2: Console Error with Error Object
```typescript
// Before
console.error('Operation failed:', error);

// After
logger.logError('Operation failed', error as Error);
```

### Pattern 3: Warning with Context
```typescript
// Before
console.warn(`[MODULE] Warning: ${msg}`, { context });

// After
logger.warn(msg, { context });
```

### Pattern 4: Formatted String
```typescript
// Before
console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);

// After
logger.debug('Incoming request', { method: req.method, path: req.path });
// Timestamp added automatically
```

### Pattern 5: Conditional Logging
```typescript
// Before
if (NODE_ENV === 'development') {
  console.log('Debug info:', data);
}

// After
logger.debug('Debug info', data);
// LOG_LEVEL controls visibility automatically
```

---

## Key Takeaways

1. **Structured = Searchable**: Every field becomes a queryable dimension
2. **Automatic = Secure**: PHI/PII redaction happens by default
3. **Consistent = Reliable**: Same format everywhere = easier monitoring
4. **Context = Better Debugging**: Include relevant IDs and state
5. **Production Ready = Peace of Mind**: JSON output works with any log system

All examples use the logger with zero changes to application logic!
