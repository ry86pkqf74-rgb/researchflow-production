# Phase 4A: API Integration Layer - Quick Reference

## Files Created/Updated

| File | Status | Purpose |
|------|--------|---------|
| `/services/orchestrator/openapi.json` | ✅ NEW | OpenAPI 3.0 specification |
| `/services/web/src/lib/api/retry.ts` | ✅ NEW | Retry logic with exponential backoff |
| `/services/web/src/lib/api/client.ts` | ✅ UPDATED | Enhanced with retry + timeout |
| `/services/web/src/lib/api/auth.ts` | ✅ UPDATED | Auth header injection + utilities |
| `/services/web/src/lib/queryClient.ts` | ✅ UPDATED | TanStack Query configuration |
| `/services/web/src/lib/api/index.ts` | ✅ UPDATED | Export retry logic & auth utils |
| `/services/web/src/components/errors/ErrorBoundary.tsx` | ✅ EXISTING | Error boundaries (pre-implemented) |

## Key Imports

```typescript
// API Client
import { apiClient } from '@/lib/api';

// Auth & Headers
import {
  authApi,
  getAuthToken,
  isAuthenticated,
  getCurrentUser,
  hasRole,
  hasPermission
} from '@/lib/api/auth';

// Retry Logic
import {
  retryWithBackoff,
  retryableFetch,
  isRetryable,
  RetryManager
} from '@/lib/api/retry';

// Query Client
import { queryClient, apiRequest } from '@/lib/queryClient';

// Error Boundaries
import {
  ErrorBoundary,
  ErrorFallback,
  useErrorHandler
} from '@/components/errors/ErrorBoundary';
```

## Common Patterns

### Authenticated Request
```typescript
const { data, error } = await apiClient.get('/api/workflows');
// Auth header automatically injected
// Retries on transient errors
```

### Login Flow
```typescript
const { data: login } = await authApi.login({
  email: 'user@example.com',
  password: 'secret'
});
if (login) {
  setAuthTokens(login.token, login.refresh_token, login.expires_at);
}
```

### Check Permission
```typescript
if (authApi.hasRole('admin')) {
  // Show admin panel
}

if (authApi.hasPermission(['approve', 'export'])) {
  // Show governance options
}
```

### Wrap Component with Error Boundary
```typescript
<ErrorBoundary>
  <MyComponent />
</ErrorBoundary>
```

### Custom Retry Logic
```typescript
const data = await retryWithBackoff(
  () => apiClient.get('/data'),
  { maxRetries: 5 },
  (attempt) => console.log(`Retry ${attempt}`)
);
```

## Configuration

### Default Retry Config
- Max retries: 3
- Initial delay: 100ms
- Max delay: 5000ms
- Backoff multiplier: 2x
- Jitter: 10%

### Retryable Status Codes
- 408 (Timeout)
- 429 (Rate limit)
- 500-504 (Server errors)

### Query Client Cache
- Stale time: 5 minutes
- GC time: 10 minutes
- Refetch on reconnect

## API Endpoint Examples

```
GET    /api/health                    - Health check
POST   /api/auth/login                - Login
POST   /api/auth/logout               - Logout
GET    /api/auth/me                   - Current user
POST   /api/auth/refresh              - Refresh token

GET    /api/workflows                 - List workflows
POST   /api/workflows                 - Create workflow
GET    /api/workflows/{id}            - Get workflow
PUT    /api/workflows/{id}            - Update workflow
DELETE /api/workflows/{id}            - Delete workflow

GET    /api/governance/pending        - Pending approvals
POST   /api/governance/approve/{id}   - Approve request

POST   /api/export/manifest           - Create export
POST   /api/export/bundle             - Export bundle
```

## Error Handling

### Handle Query Errors
```typescript
const { data, error, isLoading } = useQuery({
  queryKey: ['/api/workflows'],
  queryFn: getQueryFn({ on401: 'throw' })
});

if (error) {
  return <ErrorFallback error={error} />;
}
```

### Handle Fetch Errors
```typescript
try {
  const response = await retryableFetch('/api/data');
  const data = await response.json();
} catch (error) {
  if (isRetryable(error)) {
    console.log('Transient error, would have retried');
  }
}
```

## Testing

### Test Retry Logic
```typescript
// Retry happens automatically for:
// - fetch() failures
// - Status 408, 429, 500-504
// - Custom retryable errors

const mock = jest.spyOn(global, 'fetch')
  .mockResolvedValueOnce({ ok: false, status: 503 })
  .mockResolvedValueOnce({ ok: true, json: () => ({}) });

await retryableFetch('/api/test');
expect(mock).toHaveBeenCalledTimes(2);
```

### Test Auth
```typescript
setAuthTokens('token123');
expect(isAuthenticated()).toBe(true);
expect(getCurrentUser()).toBeDefined();

clearAuthTokens();
expect(isAuthenticated()).toBe(false);
```

## Environment Setup

```bash
# Install dependencies (TanStack Query already included)
npm install

# Build
npm run build

# Dev server
npm run dev
```

## Verification Checklist

- [x] OpenAPI spec created at `/services/orchestrator/openapi.json`
- [x] TanStack Query properly configured with retry
- [x] API client supports GET, POST, PUT, PATCH, DELETE
- [x] Auth headers automatically injected
- [x] Token management functions implemented
- [x] Error boundary components ready
- [x] Retry logic with exponential backoff
- [x] TypeScript compilation successful
- [x] Build passes without errors
- [x] Documentation complete

## Next Steps

1. **Use in Components:**
   ```typescript
   import { apiClient } from '@/lib/api';

   const { data } = await apiClient.get('/api/endpoint');
   ```

2. **Implement in Pages:**
   ```typescript
   import { useQuery } from '@tanstack/react-query';
   import { queryClient } from '@/lib/queryClient';
   ```

3. **Add Error Boundaries:**
   ```typescript
   import { ErrorBoundary } from '@/components/errors/ErrorBoundary';
   ```

4. **Generate TypeScript Client (Future):**
   - Use OpenAPI spec with openapi-generator
   - Generate fully typed client from spec

## Support Resources

- **OpenAPI Spec:** `/services/orchestrator/openapi.json`
- **Full Documentation:** `/PHASE4A_API_INTEGRATION_COMPLETION.md`
- **API Client Source:** `/services/web/src/lib/api/client.ts`
- **Auth Module Source:** `/services/web/src/lib/api/auth.ts`
- **Retry Logic Source:** `/services/web/src/lib/api/retry.ts`
