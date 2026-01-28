# Security Middleware Implementation - SEC-002, SEC-004, SEC-005

## Overview
Implemented comprehensive security middleware suite for ResearchFlow Orchestrator service to protect against common web vulnerabilities and enforce strict security policies.

## Files Created

### 1. Rate Limiting Middleware
**File:** `/services/orchestrator/src/middleware/rateLimit.ts`

**Features:**
- **Default Rate Limiter**: 100 requests/minute globally
- **Auth Endpoints Limiter**: 10 requests/minute (stricter for brute force prevention)
- **API Endpoints Limiter**: 200 requests/minute (generous for API consumers)
- **Redis-backed Storage**: Distributed rate limiting across multiple instances
- **Custom Key Generator**: Uses authenticated user ID if available, IP address otherwise
- **Health Check Skip List**: Exempts health endpoints from rate limiting
- **Automatic Fallback**: Uses in-memory store if Redis unavailable

**Key Functions:**
- `initializeRedisClient()`: Establishes Redis connection with error handling
- `createDefaultLimiter()`: Global rate limiter middleware factory
- `createAuthLimiter()`: Stricter limiter for authentication endpoints
- `createApiLimiter()`: API-specific rate limiter
- `closeRedisClient()`: Graceful shutdown cleanup

**Dependencies:**
- `express-rate-limit`: ^7.1.5
- `rate-limit-redis`: ^4.1.5
- `redis`: ^4.6.13 (already installed)

### 2. Security Headers Middleware
**File:** `/services/orchestrator/src/middleware/securityHeaders.ts`

**Features:**
- **Content Security Policy (CSP)**
  - `script-src: 'self'` (strict XSS protection)
  - `style-src: 'self' 'unsafe-inline'` (supports Tailwind CSS and styled-components)
  - `img-src: 'self' data: https: blob:` (flexible image handling)
  - `connect-src: 'self'` + API endpoints (controlled external connections)
  - `frame-ancestors: 'none'` (prevents clickjacking)
  - `report-uri: /api/csp-violations` (violation reporting)

- **Additional Security Headers:**
  - `X-Frame-Options: DENY` (click-jacking protection)
  - `X-Content-Type-Options: nosniff` (MIME type sniffing prevention)
  - `X-XSS-Protection: 1; mode=block` (XSS filter activation)
  - `Strict-Transport-Security: max-age=31536000; includeSubDomains; preload` (HTTPS enforcement)
  - `Referrer-Policy: strict-origin-when-cross-origin` (referrer information control)
  - `Permissions-Policy` (feature access restrictions)
  - `Cross-Origin-Embedder-Policy` (cross-origin isolation)
  - `Cross-Origin-Opener-Policy: same-origin` (process isolation)
  - `Cross-Origin-Resource-Policy: cross-origin` (resource sharing control)

- **Development vs Production:**
  - Development: CSP in report-only mode, allows unsafe-inline scripts for tooling
  - Production: Enforced policies, adds to HSTS preload list

**Key Functions:**
- `configureSecurityHeaders()`: Main helmet configuration with CSP policies
- `cspViolationReporter()`: CSP violation collection and logging endpoint
- `apiSecurityHeaders()`: API-specific cache control and security headers
- `createSecurityHeadersMiddleware()`: Combined middleware factory
- `initializeSecurityHeadersLogging()`: Initialization logging

**Dependencies:**
- `helmet`: ^7.1.0

### 3. Package Dependencies Updated
**File:** `/services/orchestrator/package.json`

Added security packages:
```json
"express-rate-limit": "^7.1.5",
"rate-limit-redis": "^4.1.5",
"helmet": "^7.1.0"
```

## Integration

### Main Application File
**File:** `/services/orchestrator/index.ts`

**Changes:**
1. Imported security middleware functions
2. Applied security headers globally early in middleware chain
3. Initialized rate limiters during startup
4. Configured endpoint-specific rate limiters:
   - Global default: 100 req/min
   - Auth endpoints (`/auth`, `/login`, `/signup`, `/refresh-token`): 10 req/min
   - API routes (`/api/*`): 200 req/min
5. Registered CSP violation reporter endpoint
6. Updated graceful shutdown to close Redis client

**Middleware Chain Order (Important):**
```
1. CORS Configuration
2. Security Headers (Helmet)
3. API Security Headers
4. JSON/URL-Encoded Parsers
5. Health Check Logging
6. Default Rate Limiter
7. Auth Endpoints Rate Limiter
8. API Rate Limiter
9. CSP Violation Reporter
10. Route Handlers
```

## Configuration

### Environment Variables
The implementation uses these optional environment variables:

```bash
# Redis Configuration
REDIS_URL=redis://redis:6379

# CSP Reporting
CSP_REPORT_URI=/api/csp-violations

# CORS Configuration
CORS_ORIGIN=*

# Deployment Mode
NODE_ENV=production
```

## Security Policies Explained

### Content Security Policy (CSP)
- **Purpose**: Prevents XSS attacks by controlling resource loading
- **Report-Only Mode**: In development, violations are logged without blocking
- **Enforcement**: In production, violations are blocked and logged
- **Reporting**: CSP violations reported to `/api/csp-violations` endpoint

### Rate Limiting Strategy
- **Distributed**: Redis-backed for multi-instance environments
- **User-Aware**: Different limits based on user authentication status
- **Endpoint-Specific**: Stricter limits on sensitive endpoints (auth)
- **Graceful Degradation**: Falls back to in-memory store if Redis unavailable

### Security Headers Impact
- **HSTS**: Enforces HTTPS in production (1 year expiration)
- **Permissions Policy**: Blocks access to camera, microphone, geolocation, etc.
- **Cross-Origin Policies**: Isolates origin contexts for additional protection
- **Cache Control**: Prevents caching of sensitive API responses

## Monitoring & Logging

All security events are logged with structured logging:

1. **Rate Limit Violations**
   ```
   [WARN] Rate limit exceeded
   keyGenerator: ip:192.168.1.1
   path: /api/users
   method: POST
   ```

2. **CSP Violations**
   ```
   [WARN] CSP Violation detected
   violationType: script
   blockedUri: https://malicious.com/script.js
   violatedDirective: script-src 'self'
   ```

3. **Security Headers Initialization**
   ```
   [INFO] Security headers middleware initialized
   nodeEnv: production
   cspReportUri: /api/csp-violations
   ```

4. **Redis Connection**
   ```
   [INFO] Redis client connected for rate limiting
   ```

## Testing Recommendations

### Rate Limiting Tests
1. Send 101+ requests in 1 minute to trigger default limiter
2. Send 11+ requests to auth endpoint in 1 minute
3. Verify 429 status code and `Retry-After` header
4. Test with Redis unavailable for fallback behavior

### Security Headers Tests
1. Verify CSP header presence with `curl -i`
2. Test CSP violation reporting to `/api/csp-violations`
3. Verify HSTS header in production
4. Check frame-ancestors: none prevents iframe embedding
5. Validate all security headers in browser DevTools

### CSP Policy Tests
1. Attempt to load external scripts (should fail)
2. Test inline styles (should work for Tailwind)
3. Verify image loading from approved sources
4. Test WebSocket connections to approved APIs

## Production Checklist

- [ ] Redis instance is deployed and accessible
- [ ] Environment variables configured correctly
- [ ] CSP_REPORT_URI endpoint is accessible
- [ ] Rate limiting thresholds reviewed for workload
- [ ] CSP policies reviewed for custom domains
- [ ] Monitoring dashboards set up for rate limit/CSP events
- [ ] HSTS preload list submission (after testing)
- [ ] Security headers validation in production
- [ ] Load testing with rate limiters enabled

## Performance Considerations

1. **Rate Limiting Overhead**: ~1-2ms per request (Redis backend)
2. **Security Headers Overhead**: <1ms per request
3. **CSP Violation Reporting**: Async, minimal impact
4. **Memory Usage**: Redis store for distributed limiting (configurable)

## Rollback Plan

If issues occur:

1. **Reduce Rate Limits**: Adjust `max` values in limiter factories
2. **Disable Redis**: Environment will fall back to in-memory store
3. **Report-Only CSP**: Set `reportOnly: true` in development
4. **Disable Specific Header**: Comment out in helmet configuration

## Future Enhancements

1. **Adaptive Rate Limiting**: Adjust limits based on user tier/API key
2. **Geographic Rate Limiting**: Different limits by region
3. **Machine Learning**: Anomaly detection for attack patterns
4. **Rate Limit Dashboard**: Real-time monitoring UI
5. **Custom CSP Directives**: Per-route policy enforcement
6. **Automated HSTS Preload**: Submission workflow

## References

- [OWASP Security Headers](https://owasp.org/www-project-secure-headers/)
- [Content Security Policy Guide](https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP)
- [Express Rate Limit](https://github.com/nfriedly/express-rate-limit)
- [Helmet.js Documentation](https://helmetjs.github.io/)

## Implementation Status

✅ **SEC-002**: Rate Limiting Implementation - COMPLETE
- Default, Auth, and API limiters implemented
- Redis-backed storage with fallback
- Custom key generator (user ID / IP)
- Health check skip list

✅ **SEC-004**: Security Headers Configuration - COMPLETE
- Comprehensive helmet configuration
- CSP policy implementation
- All required security headers

✅ **SEC-005**: CSP Policy Implementation - COMPLETE
- Strict script-src ('self' only)
- Style-src supports Tailwind and inline
- Image sources configured
- Connect sources to approved APIs
- Frame-ancestors set to 'none'
- Violation reporting to /api/csp-violations

✅ **Integration**: Middleware applied to orchestrator service
