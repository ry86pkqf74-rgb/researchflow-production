# LIVE Mode Authentication & Function Verification

## Overview
This document provides a comprehensive verification checklist for ensuring all functions work correctly in LIVE mode after user login.

---

## Authentication Flow ✅

### 1. Login Process
**Location:** [services/web/src/pages/login.tsx](services/web/src/pages/login.tsx)

**Flow:**
1. User enters email and password
2. Frontend calls `POST /api/auth/login` with credentials
3. Backend validates credentials and returns:
   - Access token (JWT)
   - User object
   - Refresh token (HTTP-only cookie)
4. Frontend stores access token in Zustand store and localStorage
5. User redirected to `/onboarding`

**Authentication Service:**
- [services/orchestrator/src/routes/auth.ts](services/orchestrator/src/routes/auth.ts) - Auth endpoints
- [services/orchestrator/src/services/authService.ts](services/orchestrator/src/services/authService.ts) - Auth logic
- [services/web/src/hooks/use-auth.ts](services/web/src/hooks/use-auth.ts) - Frontend auth hook

### 2. Token Storage
**Zustand Store:** `useTokenStore`
- Stores access token with persistence
- Syncs with localStorage for API client compatibility
- Provides `setAccessToken()` and `clearToken()` methods

**Storage Keys:**
- `auth-storage` (Zustand persist)
- `auth_token` (localStorage for API compatibility)

### 3. Token Validation
**Middleware:** `optionalAuth` (applied globally)
- Location: [services/orchestrator/src/services/authService.ts](services/orchestrator/src/services/authService.ts)
- Extracts Bearer token from Authorization header
- Verifies JWT signature and expiration
- Attaches decoded user to `req.user`
- **Does NOT block requests** - allows anonymous access

**Protected Routes:** `requireAuth` middleware
- Explicitly blocks unauthenticated requests
- Returns 401 if no valid token

### 4. Mode-Based Authentication
**AuthGate Component:** [services/web/src/components/mode/AuthGate.tsx](services/web/src/components/mode/AuthGate.tsx)

**Behavior:**
- **DEMO mode**: No authentication required, all pages accessible
- **LIVE mode + requireAuth**: Redirects to `/login` if not authenticated
- **LIVE mode + !requireAuth**: Allows access but user info available if logged in

---

## AI Operations with Authorization ✅

### 1. useAI Hook Integration
**Location:** [services/web/src/hooks/useAI.ts](services/web/src/hooks/useAI.ts)

**Features:**
- ✅ Imports `useTokenStore` to access current token
- ✅ Adds `Authorization: Bearer ${token}` header to all API requests
- ✅ Integrates with `useAIApprovalGate` for 100% strict approval in LIVE mode
- ✅ Validates responses using Zod schemas
- ✅ Returns detailed error messages

**Authentication Flow:**
```typescript
// 1. Get access token from store
const accessToken = useTokenStore((state) => state.accessToken);

// 2. Add to request headers
const headers: HeadersInit = {
  'Content-Type': 'application/json',
};
if (accessToken) {
  headers['Authorization'] = `Bearer ${accessToken}`;
}

// 3. Make authenticated request
fetch(apiPath, { headers, credentials: 'include', ... });
```

### 2. AI Approval Gate
**Location:** [services/web/src/components/ui/ai-approval-gate.tsx](services/web/src/components/ui/ai-approval-gate.tsx)

**Authorization Store:** [services/web/src/stores/ai-authorization-store.ts](services/web/src/stores/ai-authorization-store.ts)

**Approval Modes:**
1. `REQUIRE_EACH`: Approval required for every AI call (most restrictive)
2. `APPROVE_PHASE`: Phase-level batch approval
3. `APPROVE_SESSION`: Session-wide upfront approval

**Workflow:**
1. Component calls `requestApproval(stageId, stageName)`
2. Modal displays:
   - AI tools being used
   - Model and cost estimate
   - PHI risk level
   - Governance acknowledgment
3. User enters name and clicks "Approve"
4. Approval stored in authorization store
5. Promise resolves with approval result
6. AI operation proceeds or errors

### 3. Retry Mechanism
**Location:** [services/web/src/hooks/useAIWithRetry.ts](services/web/src/hooks/useAIWithRetry.ts)

**Features:**
- Wraps `useAI` with automatic retry logic
- Retries network errors (fetch failures, timeouts, 5xx)
- Does NOT retry application errors (4xx, validation, user denial)
- Exponential backoff: 1s, 2s, 4s
- Toast notifications for retries
- Configurable max retries (default: 2)

### 4. Streaming Infrastructure
**Hooks:**
- [services/web/src/hooks/useAIStreaming.ts](services/web/src/hooks/useAIStreaming.ts) - Main streaming hook
- [services/web/src/lib/streaming.ts](services/web/src/lib/streaming.ts) - SSE infrastructure

**Components:**
- [services/web/src/components/ai/ManuscriptDraftStreaming.tsx](services/web/src/components/ai/ManuscriptDraftStreaming.tsx)
- [services/web/src/components/ai/StatisticalAnalysisStreaming.tsx](services/web/src/components/ai/StatisticalAnalysisStreaming.tsx)
- [services/web/src/components/ai/LiteratureSearchStreaming.tsx](services/web/src/components/ai/LiteratureSearchStreaming.tsx)
- [services/web/src/components/ai/ResearchBriefStreaming.tsx](services/web/src/components/ai/ResearchBriefStreaming.tsx)

**Features:**
- Real-time progress updates
- Token-by-token streaming for text generation
- Cancellation support
- DEMO mode simulation
- **Integrates with approval gate** - requests approval before starting stream

---

## Verification Checklist

### Phase 1: Authentication ✅

- [ ] **Login**
  - [ ] User can access `/login` page
  - [ ] Form validation works (empty fields, invalid email)
  - [ ] Valid credentials → successful login
  - [ ] Invalid credentials → error message
  - [ ] Access token stored in Zustand + localStorage
  - [ ] User redirected to `/onboarding`

- [ ] **Token Persistence**
  - [ ] Refresh page → user still logged in
  - [ ] Access token present in localStorage
  - [ ] Zustand store hydrated from localStorage

- [ ] **Logout**
  - [ ] Logout clears access token
  - [ ] Logout clears localStorage
  - [ ] Logout redirects to login page

### Phase 2: Mode Switching ✅

- [ ] **DEMO Mode**
  - [ ] All pages accessible without login
  - [ ] AI operations return mock data
  - [ ] No approval modal shown
  - [ ] DemoWatermark visible

- [ ] **LIVE Mode**
  - [ ] Protected pages redirect to login if not authenticated
  - [ ] Authenticated users can access all features
  - [ ] AI operations require approval
  - [ ] Real API calls made (not mock data)

### Phase 3: AI Operations in LIVE Mode ✅

- [ ] **Authorization Headers**
  - [ ] All AI API calls include `Authorization: Bearer ${token}`
  - [ ] Backend receives and validates token
  - [ ] 401 returned if token invalid/expired

- [ ] **Approval Gate**
  - [ ] Approval modal appears before AI operations
  - [ ] Modal shows correct tool information
  - [ ] User can approve or deny
  - [ ] Approval stores approver name
  - [ ] Denial prevents API call
  - [ ] Approval allows API call to proceed

- [ ] **Specific Operations**
  - [ ] Topic Recommendations (Stage 1)
    - [ ] Click "Get Recommendations" button
    - [ ] Approval modal appears
    - [ ] After approval, API call fires
    - [ ] Results display correctly

  - [ ] Literature Search (Stage 2)
    - [ ] Execute stage 2
    - [ ] Approval modal appears
    - [ ] Search completes
    - [ ] Results populated

  - [ ] Research Brief (Stage 3)
    - [ ] Generate research brief
    - [ ] Approval required
    - [ ] Brief generated successfully

  - [ ] Statistical Analysis (Stage 13)
    - [ ] Execute analysis
    - [ ] Approval modal
    - [ ] Analysis completes

  - [ ] Manuscript Drafting (Stage 14)
    - [ ] Generate manuscript
    - [ ] Approval modal
    - [ ] Manuscript drafted

### Phase 4: Error Handling ✅

- [ ] **Authentication Errors**
  - [ ] Expired token → 401 error
  - [ ] Invalid token → 401 error
  - [ ] Missing token in LIVE mode → redirects to login
  - [ ] Token refresh works (if implemented)

- [ ] **Network Errors**
  - [ ] Transient failure → automatic retry
  - [ ] Retry toast appears
  - [ ] Success after retry → success toast
  - [ ] All retries exhausted → error toast

- [ ] **Validation Errors**
  - [ ] Invalid AI response → caught by Zod validation
  - [ ] Error toast shows specific validation error
  - [ ] Component doesn't crash

### Phase 5: Streaming Operations ✅

- [ ] **Manuscript Drafting**
  - [ ] Click "Start Manuscript Drafting"
  - [ ] Approval modal appears
  - [ ] After approval, streaming begins
  - [ ] Progress bar updates
  - [ ] Status text changes
  - [ ] Tokens appear incrementally
  - [ ] Cancel button works
  - [ ] Completion state shows result

- [ ] **Statistical Analysis**
  - [ ] Start analysis
  - [ ] Approval required
  - [ ] Progress updates show steps
  - [ ] Checklist items complete sequentially
  - [ ] Final results displayed

- [ ] **Literature Search**
  - [ ] Start search
  - [ ] Approval modal
  - [ ] Database progress indicators
  - [ ] Each database completes
  - [ ] Total results shown

- [ ] **Research Brief**
  - [ ] Generate brief
  - [ ] Approval required
  - [ ] Section-by-section progress
  - [ ] Live text preview
  - [ ] Complete brief displayed

### Phase 6: Integration Testing ✅

- [ ] **End-to-End Workflow**
  1. Login with valid credentials
  2. Switch to LIVE mode
  3. Navigate to Pipeline Dashboard
  4. Execute Stage 1 (Topic Declaration)
  5. Verify approval modal appears
  6. Approve operation
  7. Verify API call succeeds
  8. Verify results display
  9. Execute subsequent stages
  10. Verify entire workflow completes

- [ ] **Multi-User Scenarios**
  - [ ] User A logs in → sees their data
  - [ ] User B logs in → sees different data
  - [ ] User A cannot access User B's data

- [ ] **Session Management**
  - [ ] Long session → token refresh works
  - [ ] Idle timeout → re-authentication required
  - [ ] Multiple tabs → tokens synced

---

## Known Limitations

1. **Token Refresh**: Currently implemented but may need testing for long sessions
2. **Concurrent Requests**: Multiple AI operations in parallel may need approval for each
3. **Offline Mode**: No offline support - requires network connectivity
4. **Token Expiry**: User must re-login after token expires (typically 24 hours)

---

## Troubleshooting

### Issue: "Authentication required for LIVE mode"
**Cause:** User not logged in or token expired
**Solution:** Redirect to `/login` and authenticate

### Issue: Approval modal doesn't appear
**Cause:** Already approved for phase/session, or in DEMO mode
**Solution:** Check approval mode setting, or switch to REQUIRE_EACH mode

### Issue: API call returns 401
**Cause:** Token invalid, expired, or missing
**Solution:** Check token in localStorage, verify format, re-authenticate

### Issue: Retry loop
**Cause:** Server consistently returns 5xx error
**Solution:** Check backend logs, verify AI service availability

### Issue: Streaming doesn't start
**Cause:** Approval denied or network error
**Solution:** Check console logs, verify approval flow, check network tab

---

## Testing Commands

### Frontend Build
```bash
cd services/web
npm run build
```

### Backend Tests
```bash
cd services/orchestrator
npm test
```

### Integration Tests
```bash
cd services/web
npm run test
```

### Manual Testing
1. Start orchestrator: `cd services/orchestrator && npm run dev`
2. Start web: `cd services/web && npm run dev`
3. Open browser: `http://localhost:5173`
4. Test login flow
5. Test AI operations

---

## Summary

### ✅ Completed
- Authentication flow (login, token storage, validation)
- Authorization headers added to all AI requests
- 100% strict approval requirement in LIVE mode
- Response validation with Zod schemas
- Retry mechanism for transient failures
- Streaming infrastructure with approval integration
- Example streaming components for all major operations
- Build verification (no regressions)

### ✅ Verified
- useAI hook includes Authorization header
- AuthGate redirects unauthenticated users in LIVE mode
- Mode store correctly tracks DEMO vs LIVE
- Workflow endpoints use optionalAuth middleware
- All builds pass successfully

### 📋 Manual Verification Required
- Login with actual credentials (backend running)
- Execute AI operations in LIVE mode
- Verify approval modal behavior
- Test streaming components in running app
- Verify retry logic with simulated failures
- Test token expiry and refresh

---

## Contact & Support
For issues or questions:
- Check console logs (browser DevTools)
- Check backend logs (orchestrator console)
- Review audit trail (`/api/workflow/audit-log`)
- Check this documentation for troubleshooting steps
