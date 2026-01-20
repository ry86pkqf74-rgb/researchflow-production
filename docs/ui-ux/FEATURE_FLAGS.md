# Feature Flags System

> Complete reference for ResearchFlow's feature flag system

## Overview

ResearchFlow uses a two-tier feature flag system:

1. **Database-backed flags** - Governance-aware, rollout percentages, audit logged
2. **Environment variable flags** - Quick toggles for development and ops

## Flag Evaluation Priority

```
1. Environment Variable (highest priority)
   ↓
2. User-specific override (if exists)
   ↓
3. Database flag with rollout evaluation
   ↓
4. Default value (lowest priority)
```

## Core Flags

### Governance Flags

| Flag Key | Default | Modes | Description |
|----------|---------|-------|-------------|
| `ALLOW_UPLOADS` | `true` | ALL | Enable file uploads |
| `ALLOW_EXPORTS` | `true` | LIVE only | Enable data exports |
| `ALLOW_LLM_CALLS` | `true` | ALL | Enable AI features |
| `REQUIRE_PHI_SCAN` | `true` | ALL | Mandatory PHI scanning |
| `ANALYTICS_ENABLED` | `false` | ALL | User analytics (requires consent) |
| `SSE_ENABLED` | `true` | ALL | Real-time server-sent events |

### UI/UX Enhancement Flags

| Flag Key | Default | Category | Description |
|----------|---------|----------|-------------|
| `FEATURE_VOICE_COMMANDS` | `false` | Navigation | Voice command support |
| `FEATURE_SEMANTIC_SEARCH` | `false` | Search | NLP-based artifact search |
| `FEATURE_XR_PREVIEW` | `false` | Experimental | AR/VR previews |
| `FEATURE_INLINE_TUTORIALS` | `false` | Onboarding | Context-sensitive help |
| `FEATURE_ACCESSIBILITY_MODE` | `false` | Accessibility | Enhanced a11y features |
| `FEATURE_DOMAIN_THEMES` | `false` | Personalization | Domain-specific themes |
| `FEATURE_GAMIFICATION_BADGES` | `false` | Engagement | Achievement badges (DEMO) |
| `FEATURE_CUSTOM_FIELDS` | `false` | Advanced | Custom field definitions |
| `FEATURE_ROLE_ADAPTIVE_NAV` | `false` | Navigation | Role-based UI layouts |

### Processing Flags

| Flag Key | Default | Description |
|----------|---------|-------------|
| `FEATURE_BATCH_PROCESSING` | `true` | Enable batch job processing |
| `FEATURE_EVIDENCE_RETRIEVAL` | `true` | AI evidence retrieval |
| `FEATURE_AUTO_ESCALATION` | `true` | AI tier auto-escalation |
| `OCR_ENABLED` | `false` | Tesseract OCR processing |
| `SCISPACY_ENABLED` | `false` | scispaCy NLP |
| `PROFILING_ENABLED` | `false` | Data profiling |
| `TRANSCRIPTION_ENABLED` | `false` | Audio transcription |
| `DASK_ENABLED` | `false` | Parallel processing |

## Using Feature Flags

### Server-Side (Orchestrator)

```typescript
import { isFlagEnabled, getFlags } from './services/feature-flags.service';

// Check single flag
const voiceEnabled = await isFlagEnabled('FEATURE_VOICE_COMMANDS', {
  userId: req.user?.id,
  mode: req.governanceMode,
});

// Get all flags for user
const flags = await getFlags({
  userId: req.user?.id,
  mode: req.governanceMode,
});
```

### Client-Side (Web)

```typescript
import { useFeatureFlag, useEnabledFeatureFlags } from '@/hooks/useFeatureFlag';

function MyComponent() {
  // Single flag
  const voiceEnabled = useFeatureFlag('FEATURE_VOICE_COMMANDS');

  // All enabled flags
  const { flags, isLoading } = useEnabledFeatureFlags();

  if (!voiceEnabled) return null;

  return <VoiceNavigation />;
}
```

### Environment Variables

```bash
# Server-side (Node.js)
FEATURE_VOICE_COMMANDS=true
FEATURE_SEMANTIC_SEARCH=true

# Client-side (Vite)
VITE_FEATURE_VOICE_COMMANDS=true
VITE_FEATURE_SEMANTIC_SEARCH=true
```

## Governance Mode Gating

Flags can be restricted to specific governance modes:

```typescript
// Flag definition in database
{
  key: 'ALLOW_EXPORTS',
  defaultValue: true,
  requiredModes: ['LIVE'],  // Only enabled in LIVE mode
  rolloutPercentage: 100
}

// Flag evaluation respects mode
const canExport = await isFlagEnabled('ALLOW_EXPORTS', {
  mode: 'DEMO'  // Returns false because DEMO not in requiredModes
});
```

## Rollout Percentages

Gradual rollouts based on user ID hashing:

```typescript
// Database flag with 50% rollout
{
  key: 'NEW_FEATURE',
  defaultValue: false,
  rolloutPercentage: 50
}

// User assignment is deterministic
// Same user always gets same result
const enabled = await isFlagEnabled('NEW_FEATURE', {
  userId: 'user-123'  // Hashed to determine inclusion
});
```

## Feature Flag Lifecycle

### 1. Introduce New Flag

```bash
# Add to .env.example
FEATURE_NEW_THING=false
VITE_FEATURE_NEW_THING=false

# Add migration for database flag
INSERT INTO feature_flags (key, default_value, description, category)
VALUES ('FEATURE_NEW_THING', false, 'Description', 'category');
```

### 2. Develop Behind Flag

```typescript
// Wrap new code in flag check
if (await isFlagEnabled('FEATURE_NEW_THING')) {
  // New feature code
}
```

### 3. Gradual Rollout

```sql
-- Start at 10%
UPDATE feature_flags SET rollout_percentage = 10
WHERE key = 'FEATURE_NEW_THING';

-- Increase to 50%
UPDATE feature_flags SET rollout_percentage = 50
WHERE key = 'FEATURE_NEW_THING';

-- Full rollout
UPDATE feature_flags SET rollout_percentage = 100
WHERE key = 'FEATURE_NEW_THING';
```

### 4. Remove Flag (Feature Stable)

```bash
# Make feature permanent
# Remove flag checks from code
# Remove from database and .env files
```

## Flag Categories

### By Risk Level

| Category | Examples | Default Behavior |
|----------|----------|------------------|
| **Safe** | Voice nav, themes | Can enable in DEMO |
| **Moderate** | Custom fields, analytics | Requires consent |
| **Sensitive** | Exports, PHI access | LIVE mode only, audit |

### By Implementation Phase

| Phase | Flags | Status |
|-------|-------|--------|
| Phase 0 | Feature flag system | ✅ Implemented |
| Phase 1 | Voice nav, gesture nav | 🟡 Infrastructure ready |
| Phase 2 | Themes, accessibility | 🟡 Partial |
| Phase 3 | Analytics, heatmaps | 🟡 Consent-gated |
| Phase 4 | Offline sync | ❌ Planned |
| Phase 5 | AR/VR | ❌ Experimental |

## API Endpoints

### Get All Flags

```http
GET /api/governance/state
Authorization: Bearer <token>

Response:
{
  "mode": "DEMO",
  "flags": {
    "ALLOW_UPLOADS": true,
    "ALLOW_EXPORTS": false,
    "FEATURE_VOICE_COMMANDS": true
  },
  "flagMetadata": {
    "ALLOW_EXPORTS": {
      "requiredModes": ["LIVE"],
      "description": "Enable data exports"
    }
  }
}
```

### Check Single Flag

```http
GET /api/experiments/flags/FEATURE_VOICE_COMMANDS
Authorization: Bearer <token>

Response:
{
  "key": "FEATURE_VOICE_COMMANDS",
  "enabled": true,
  "source": "database"
}
```

### Update Flag (STEWARD+)

```http
POST /api/governance/flags/FEATURE_VOICE_COMMANDS
Authorization: Bearer <token>
Content-Type: application/json

{
  "enabled": true,
  "rolloutPercentage": 100
}
```

## Best Practices

### Naming Conventions

- Prefix with `FEATURE_` for product features
- Prefix with `ALLOW_` for permission toggles
- Use SCREAMING_SNAKE_CASE
- Be descriptive: `FEATURE_VOICE_COMMANDS` not `VOICE`

### Flag Hygiene

1. **Document every flag** - Add description in migration
2. **Set expiration** - Plan to remove temporary flags
3. **Audit usage** - Track which flags are checked
4. **Test both states** - Ensure code works with flag on AND off

### Performance

- **Cache flag evaluations** - TTL-based caching (60s default)
- **Batch flag checks** - Use `getFlags()` for multiple flags
- **Env vars for hot paths** - Skip DB for high-frequency checks

## Monitoring

### Flag Usage Metrics

```sql
-- Count flag evaluations by key
SELECT flag_key, COUNT(*)
FROM flag_evaluations
WHERE created_at > NOW() - INTERVAL '1 day'
GROUP BY flag_key;
```

### Audit Trail

All flag changes are audit logged:
```json
{
  "action": "FLAG_UPDATE",
  "flagKey": "FEATURE_VOICE_COMMANDS",
  "previousValue": false,
  "newValue": true,
  "userId": "admin-123",
  "timestamp": "2026-01-20T12:00:00Z"
}
```

## Related Documentation

- [Governance & Security](../SECURITY_GOVERNANCE.md)
- [Architecture Overview](../ARCHITECTURE_OVERVIEW.md)
- [UI/UX README](./README.md)
