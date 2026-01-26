# Phase F: Observability, Analytics, Realtime Updates & Feature Flags

## Overview

Phase F introduces privacy-conscious internal analytics, realtime updates via SSE, and database-backed feature flags with governance mode constraints. All components follow ResearchFlow's PHI-safe, fail-closed design principles.

## Components

### 1. Database Schema Changes

**Migration:** `migrations/0010_phase_f_observability_featureflags.sql`

New tables:
- `governance_config` - DB-backed governance mode configuration
- `feature_flags` - Feature flags with rollout percentages and mode constraints
- `experiments` - A/B testing experiments
- `experiment_assignments` - Deterministic variant assignments
- `analytics_events` - PHI-safe event storage

### 2. Backend Services

#### EventBus (`services/orchestrator/src/services/event-bus.ts`)
In-process pub/sub with optional Redis bridge for multi-instance deployments.

```typescript
// Subscribe to governance events
eventBus.subscribe('governance', (event) => {
  console.log('Mode changed:', event);
});

// Publish events
eventBus.publishGovernanceEvent('governance.mode_changed', {
  previousMode: 'DEMO',
  newMode: 'LIVE',
  changedBy: userId,
});
```

Topics: `governance`, `jobs`, `all`

#### GovernanceConfigService (`services/orchestrator/src/services/governance-config.service.ts`)
DB-backed mode configuration with caching and event publishing.

```typescript
// Get current mode (cached)
const mode = await governanceConfigService.getMode();

// Set mode (with audit logging)
await governanceConfigService.setMode('LIVE', userId);
```

#### FeatureFlagsService (`services/orchestrator/src/services/feature-flags.service.ts`)
Feature flags with:
- Governance mode constraints (`requiredModes`)
- Rollout percentages (deterministic hash)
- Environment variable overrides (`FEATURE_<KEY>`)

```typescript
// Check flag
const allowed = await isFlagEnabled('ALLOW_EXPORTS', false, userId);

// List all flags with metadata
const flags = await listFlags();
```

#### ExperimentsService (`services/orchestrator/src/services/experiments.service.ts`)
A/B testing with deterministic variant assignment.

```typescript
const variant = await experimentsService.getVariant('new-ui-experiment', userId);
// Returns: 'control' | 'variant_a' | 'variant_b'
```

#### AnalyticsService (`services/orchestrator/src/services/analytics.service.ts`)
PHI-safe analytics ingestion with:
- Allowlisted event names
- PHI pattern detection and auto-redaction
- IP hashing
- Size limits (8KB)

```typescript
await analyticsService.trackEvent({
  eventName: 'page_view',
  userId,
  properties: { page: '/dashboard' }
});
```

### 3. API Routes

#### Analytics (`/api/analytics`)
- `POST /api/analytics/events` - Batch event ingestion (requires consent header)
- `GET /api/analytics/summary` - Admin analytics dashboard

#### Stream/SSE (`/api/stream`)
- `GET /api/stream?topic=governance` - SSE stream for realtime updates

#### Governance (`/api/governance`)
- `GET /api/governance/state` - Current mode, flags, and metadata
- `POST /api/governance/mode` - Change governance mode
- `POST /api/governance/flags/:flagKey` - Update feature flag

### 4. Frontend Components

#### Consent Store (`services/web/src/stores/consent-store.ts`)
Zustand store for analytics consent management.

```typescript
const { analyticsGranted, grantAnalytics, revokeAnalytics } = useConsentStore();
```

#### Analytics Utility (`services/web/src/lib/analytics.ts`)
Client-side event tracking with consent checking and batching.

```typescript
import { trackEvent } from '@/lib/analytics';

trackEvent('button_clicked', { buttonId: 'submit' });
```

#### AnalyticsConsentBanner (`services/web/src/components/AnalyticsConsentBanner.tsx`)
Opt-in consent banner shown to users who haven't granted analytics consent.

#### Governance Store (`services/web/src/stores/governance-store.ts`)
Updated with SSE support for realtime governance updates.

```typescript
const { mode, flagsMeta, sseConnected } = useGovernanceStore();
```

### 5. SSE in Governance Console

The Governance Console (`services/web/src/pages/governance-console.tsx`) now uses:
- SSE for realtime updates (primary)
- Polling fallback (30s interval)
- Connection status indicator

## Security Considerations

### PHI Safety

1. **Analytics Events**
   - Allowlisted event names only
   - PHI pattern detection (SSN, email, phone, MRN)
   - Auto-redaction of detected PHI
   - Size limits prevent large text blobs
   - IP addresses hashed, never stored raw

2. **Error Tracking (Sentry)**
   - PHI scrubbing in beforeSend hook
   - User data anonymization
   - Request body stripping
   - DOM tracking disabled

### Feature Flags

1. **Mode Constraints**
   - Flags can require specific governance modes
   - Automatically disabled when mode doesn't match
   - Fail-closed: unknown flags default to disabled

2. **Rollout Safety**
   - Deterministic hash ensures consistent user experience
   - Gradual rollout percentages

## Configuration

### Environment Variables

```bash
# Analytics
ANALYTICS_IP_SALT=your-secret-salt

# Sentry (optional)
SENTRY_DSN=https://key@sentry.io/project
VITE_SENTRY_DSN=https://key@sentry.io/project

# Feature flag overrides
FEATURE_ALLOW_UPLOADS=true
FEATURE_ALLOW_EXPORTS=false
```

### Default Feature Flags

| Flag | Default | Required Modes | Description |
|------|---------|----------------|-------------|
| ALLOW_UPLOADS | true | DEMO, LIVE | Allow dataset uploads |
| ALLOW_EXPORTS | false | LIVE | Allow result exports |
| ALLOW_LLM_CALLS | true | DEMO, LIVE | Allow LLM API calls |
| REQUIRE_PHI_SCAN | true | DEMO, LIVE | Require PHI scanning |
| PHI_SCAN_ON_UPLOAD | true | DEMO, LIVE | Scan on upload |
| ENABLE_EXPERIMENTS | false | LIVE | Enable A/B testing |

## Testing

Unit tests:
- `services/orchestrator/src/services/__tests__/feature-flags.service.test.ts`
- `services/orchestrator/src/services/__tests__/analytics.service.test.ts`
- `services/orchestrator/src/services/__tests__/event-bus.test.ts`
- `services/web/src/stores/__tests__/consent-store.test.ts`

Run tests:
```bash
cd services/orchestrator && npm test
cd services/web && npm test
```

## CI/CD Security

Security scanning via `.github/workflows/security-scan.yaml`:
- **Trivy**: Container vulnerability scanning
- **CodeQL**: Static analysis
- **Gitleaks**: Secret detection
- **pip-audit**: Python dependency vulnerabilities
- **Checkov**: Infrastructure as Code scanning

Dependabot configuration in `.github/dependabot.yml` for automated updates.

## Rollback

To rollback Phase F:
1. Set `GOVERNANCE_MODE=DEMO` in environment
2. Run migration rollback (if supported)
3. Feature flags will fail-closed automatically
