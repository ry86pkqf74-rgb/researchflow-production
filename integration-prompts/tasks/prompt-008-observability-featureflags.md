# ResearchFlow Production - Observability + Analytics + Realtime + Feature Flags (Single Claude Prompt)

Target repo: `ry86pkqf74-rgb/researchflow-production`

## How to use
Copy the entire prompt below into Claude Code (or Claude chat) and execute it inside the repo.

## Prompt (copy/paste)

```text
You are Claude Code operating inside the repo: ry86pkqf74-rgb/researchflow-production.

MISSION
Implement an "Observability + Feature Control Upgrade" across the stack, aligned to governance-first and PHI-safe principles.

This upgrade includes:
1) Analytics: privacy-conscious internal analytics with explicit user consent and PHI-safe payloads.
2) Realtime updates: server-push updates for governance and long-running job status (SSE + Redis pub/sub; polling fallback).
3) Error alerting and on-call: integrate Sentry (server + web; worker optional) with PHI scrubbing and documented alert routing.
4) CI security integrations: Dependabot + scheduled security audit (npm audit + pip-audit + Trivy).
5) Feature flags and A/B testing: DB-backed flags + experiments (deterministic assignment) with governance-mode constraints.

NON-NEGOTIABLE CONSTRAINTS
- NEVER send PHI/PII to third-party services (Sentry included) without aggressive scrubbing. Default behavior must be PHI-safe.
- Analytics must be OPT-IN by explicit user consent. If no consent, do not emit analytics events.
- All new endpoints must enforce RBAC where appropriate and respect DEMO/STANDBY/LIVE rules.
- Fail-closed mindset: if the PHI scrubber/validator errors, drop the event/error payload (do not forward).
- Analytics payloads must be PHI-safe by design: IDs, counts, booleans, timings, feature identifiers. No raw dataset values, no manuscript content, no user-entered free text.

DELIVERABLES (DONE MEANS ALL OF THESE ARE TRUE)
A) Database
- New tables exist and are wired into drizzle schema:
  - governance_config
  - feature_flags
  - experiments
  - experiment_assignments
  - analytics_events

B) Orchestrator (services/orchestrator)
- /api/analytics/events (POST): accepts PHI-safe events (batched) when consent header is present.
- /api/analytics/summary (GET): returns admin-only aggregates.
- /api/governance/state (GET): returns authoritative DB-backed mode + flags (no longer hard-coded mock flags).
- /api/governance/mode (POST): persists mode (governance_config), updates in-process mode, writes audit log, emits realtime event.
- /api/governance/flags/:flagKey (POST): persists flag change, writes audit log, emits realtime event.
- /api/stream (GET): SSE stream for realtime events (governance + jobs). Fallback to polling in UI on error.
- Shared EventBus publishes events locally and via Redis pub/sub when REDIS_URL is set.

C) Web (services/web)
- Analytics consent UI + persisted setting.
- trackEvent() utility posts internal analytics events only when consented.
- Governance Console stops polling every 30s; instead subscribes to SSE stream (with polling fallback).
- Feature flags in Zustand are hydrated from server state; server becomes source of truth.

D) Error alerting and on-call readiness
- Sentry integrated in orchestrator + web with PHI scrubbing.
- docs/ops/observability.md added explaining Sentry setup + recommended alert routing (email/PagerDuty) and PHI policy.

E) CI security integrations
- .github/dependabot.yml added.
- CI runs pip-audit for worker deps.
- CI runs Trivy scan (filesystem scan is sufficient).
- A scheduled weekly security workflow exists.

F) Tests
- Unit/integration tests cover feature flags evaluation and analytics ingestion (including PHI redaction behavior).
- E2E mocks updated to include new/updated endpoints so E2E remains green.

IMPLEMENTATION PLAN (DO IN ORDER)

STEP 0 - QUICK ORIENTATION (READ THESE FIRST)
- services/orchestrator/index.ts (primary entrypoint)
- services/orchestrator/routes.ts (router mounting)
- services/orchestrator/src/routes/governance.ts (governance API, currently mocky)
- services/orchestrator/middleware/mode-guard.ts (governance mode enforcement)
- services/orchestrator/src/routes/consent.ts (existing consent APIs)
- services/orchestrator/src/services/audit-service.ts and services/orchestrator/src/services/auditService.ts (audit logging)
- packages/core/types/schema.ts (drizzle schema)
- infrastructure/docker/postgres/init.sql (dev DB bootstrap)
- services/web/src/pages/governance-console.tsx (currently polls)
- services/web/src/stores/governance-store.ts
- .github/workflows/ci.yml and .github/workflows/security-scan.yaml
- tests/e2e/mocks/handlers.ts (MSW mocks)

STEP 1 - DATABASE + CORE SCHEMA
1.1 Create a new SQL migration in /migrations with the next sequence number.
- Name: migrations/0006_phase_f_observability_featureflags.sql
- Follow the style of migrations/0005_phase_e_multitenancy.sql (VARCHAR ids default gen_random_uuid()::text; timestamps; indexes).

1.2 In that migration, add tables:
A) governance_config
- key VARCHAR(100) PRIMARY KEY
- value JSONB NOT NULL DEFAULT '{}'
- updated_by VARCHAR(255) REFERENCES users(id)
- created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
- updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL

B) feature_flags
- key VARCHAR(100) PRIMARY KEY
- enabled BOOLEAN NOT NULL DEFAULT FALSE
- description TEXT
- scope VARCHAR(50) NOT NULL DEFAULT 'product'  -- 'product'|'governance'
- required_modes JSONB DEFAULT '[]'             -- e.g. ['DEMO','LIVE']
- rollout_percent INTEGER NOT NULL DEFAULT 100  -- 0..100
- updated_by VARCHAR(255) REFERENCES users(id)
- created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
- updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL

C) experiments
- key VARCHAR(100) PRIMARY KEY
- enabled BOOLEAN NOT NULL DEFAULT FALSE
- description TEXT
- variants JSONB NOT NULL DEFAULT '{}'          -- e.g. {"A": {...}, "B": {...}}
- allocation JSONB NOT NULL DEFAULT '{}'        -- e.g. {"A": 50, "B": 50}
- required_modes JSONB DEFAULT '[]'
- created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
- updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL

D) experiment_assignments
- id VARCHAR(255) PRIMARY KEY DEFAULT gen_random_uuid()::text
- experiment_key VARCHAR(100) NOT NULL REFERENCES experiments(key) ON DELETE CASCADE
- user_id VARCHAR(255) REFERENCES users(id)
- session_id VARCHAR(255)
- variant VARCHAR(50) NOT NULL
- assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
- UNIQUE (experiment_key, user_id, session_id)

E) analytics_events
- id VARCHAR(255) PRIMARY KEY DEFAULT gen_random_uuid()::text
- event_name VARCHAR(120) NOT NULL
- user_id VARCHAR(255) REFERENCES users(id)
- session_id VARCHAR(255)
- research_id VARCHAR(255)
- mode VARCHAR(20) NOT NULL
- properties JSONB DEFAULT '{}'
- ip_hash VARCHAR(64)
- user_agent TEXT
- created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
- Indexes: (event_name, created_at), (user_id, created_at), (research_id, created_at)

1.3 Consent: extend existing consent types to support analytics.
- Update migrations/0004_phase_d_ethics_security.sql CHECK constraint on user_consents.consent_type to include 'analytics'.
- Update services/orchestrator/src/routes/consent.ts validConsentTypes array to include 'analytics'.
- Update packages/core/types/schema.ts userConsents schema (if it encodes allowed types) accordingly.

1.4 Update infrastructure/docker/postgres/init.sql
- Add CREATE TABLE IF NOT EXISTS definitions for the same new tables (governance_config, feature_flags, experiments, experiment_assignments, analytics_events).
- Do NOT remove existing extensions; init.sql already enables uuid-ossp and pgcrypto.

1.5 Update packages/core/types/schema.ts (Drizzle)
- Add drizzle definitions for all new tables.
- Export insert schemas/types consistent with existing patterns (createInsertSchema and zod).
- Keep IDs consistent with existing varchar-based IDs (default(sql`gen_random_uuid()`)).

STEP 2 - ORCHESTRATOR: SERVICES (EventBus, ModeConfig, FeatureFlags, Experiments, Analytics)
2.1 Create: services/orchestrator/src/services/event-bus.ts
- Provide an in-process pub/sub + optional Redis pub/sub bridge.
- If REDIS_URL is set, publish JSON to channel 'researchflow:events'.
- Subscriber (if enabled) should re-emit received events locally.
- Event shape (PHI-safe only):
  type AppEvent = { type: string; ts: string; topic: 'governance'|'jobs'|'all'; payload: Record<string, unknown> }
- Never include raw dataset values, manuscript text, or request bodies.

2.2 Create: services/orchestrator/src/services/governance-config.service.ts
- Responsibilities:
  - Read current mode from governance_config['mode'] (JSON value: {mode: 'STANDBY'|'DEMO'|'LIVE'}).
  - If missing, fall back to process.env.GOVERNANCE_MODE or 'DEMO'.
  - On startup, load from DB and set process.env.GOVERNANCE_MODE for consistency with mode-guard.
  - Provide setMode(mode, actorUserId) that:
    - persists to governance_config
    - sets process.env.GOVERNANCE_MODE in-process
    - writes an audit log entry via logAction(...)
    - publishes event-bus event governance.mode_changed

2.3 Create: services/orchestrator/src/services/feature-flags.service.ts
- Store flags in DB table feature_flags.
- Evaluation rules:
  - required_modes: if current mode not in list, treat flag as false.
  - rollout_percent < 100: deterministic gate by hash(userId or sessionId + flagKey) % 100.
  - Add optional env override: FEATURE_<KEY>=true/false forces final value.
- API:
  - getFlags({ userId, sessionId, mode }): returns { [flagKey]: boolean }
  - listFlags(): returns metadata for UI (key, enabled, description, scope, rollout_percent, required_modes)
  - setFlag(key, enabled, actorUserId): upserts flag, audits, publishes governance.flag_changed

2.4 Create: services/orchestrator/src/services/experiments.service.ts
- Deterministic assignment:
  - use userId if present else sessionId
  - hash(id + experimentKey) % 100 -> pick variant by allocation
- Persist assignment best-effort to experiment_assignments.
- API:
  - getVariant(experimentKey, { userId, sessionId, mode }) -> { variant: string, config: object }
  - listExperiments() -> admin/steward use
- Publish analytics event 'experiment_assigned' (no PHI) and event-bus 'experiment.assigned' topic 'all'.

2.5 Create: services/orchestrator/src/services/analytics.service.ts
- Implement internal analytics ingestion with strict PHI safety.
- Use @researchflow/phi-engine scan to detect PHI in JSON.stringify(properties).
- Define an allowlist of event names, for example:
  - ui.page_view
  - ui.button_click
  - governance.console_view
  - governance.mode_changed
  - governance.flag_changed
  - job.started
  - job.progress
  - job.completed
  - job.failed
  - experiment.assigned
- Reject unknown event names.
- Enforce max properties size (e.g., 8KB JSON).
- If PHI detected in properties, store properties = { phi_redacted: true } and set a governance_log entry (no PHI values).
- Hash IP: ip_hash = sha256(ip + ANALYTICS_IP_SALT). Never store raw IP.
- Require consent: only store if the request indicates analytics consent (see STEP 4).

STEP 3 - ORCHESTRATOR: ROUTES (Analytics, Stream/SSE, Governance)
3.1 Create: services/orchestrator/src/routes/analytics.ts
- POST /api/analytics/events
  - Auth: requireRole('RESEARCHER') or higher.
  - Consent enforcement:
    - Require user has granted consentType='analytics' via user_consents (not revoked).
    - Also require request header X-Analytics-Consent: true (defense-in-depth).
    - If missing consent, return 403 CONSENT_REQUIRED (client should no-op).
  - Validate body shape: { events: Array<{ eventName: string; ts?: string; properties?: object; researchId?: string }> }
  - Call AnalyticsService.ingestBatch(...)
  - Return { accepted: number, rejected: number }
- GET /api/analytics/summary
  - Auth: requireRole('ADMIN') (or STEWARD+)
  - Return aggregates (counts by event_name, day, mode)

3.2 Create: services/orchestrator/src/routes/stream.ts
- GET /api/stream?topic=governance|jobs|all
- Implement SSE:
  - Set headers: Content-Type: text/event-stream, Cache-Control: no-cache, Connection: keep-alive
  - On connect:
    - Send initial event: type='hello' with { mode, flags, flagsMeta }
  - Subscribe to EventBus and forward matching topic events.
  - Send keepalive ping every 25s.
  - Cleanup subscription on close.

3.3 Upgrade: services/orchestrator/src/routes/governance.ts
- Replace any in-memory/mock flag state with DB-backed state from FeatureFlagService + GovernanceConfigService.
- GET /api/governance/state
  - Return:
    {
      mode: string,
      flags: Record<string, boolean>,
      flagsMeta: Array<{ key: string; enabled: boolean; description?: string; scope: string; rolloutPercent: number; requiredModes: string[] }>,
      timestamp: string
    }
- POST /api/governance/mode
  - Auth: requireRole('ADMIN')
  - Body: { mode: 'STANDBY'|'DEMO'|'LIVE' }
  - Call GovernanceConfigService.setMode
  - Publish EventBus event governance.mode_changed
  - Return updated mode + flags snapshot
- POST /api/governance/flags/:flagKey
  - Auth: requireRole('ADMIN')
  - Body: { enabled: boolean, description?: string, scope?: string, rolloutPercent?: number, requiredModes?: string[] }
  - Call FeatureFlagService.setFlag (upsert)
  - Publish EventBus event governance.flag_changed
  - Return updated flags snapshot

3.4 Mount new routers in services/orchestrator/routes.ts (primary)
- Import analyticsRouter from ./src/routes/analytics
- Import streamRouter from ./src/routes/stream
- Add:
  - app.use('/api/analytics', analyticsRouter)
  - app.use('/api/stream', streamRouter)
- Ensure these are mounted after auth setup so req.user is present.

3.5 Jobs realtime (minimal viable)
- Identify where job status/progress is updated (jobs table updates, queue handling, worker callbacks).
- When job status changes, publish EventBus event topic='jobs':
  - job.started { jobId, researchId }
  - job.progress { jobId, progress }
  - job.completed { jobId }
  - job.failed { jobId }
- Ensure payload contains only IDs/status/progress numbers.

STEP 4 - WEB: CONSENTED ANALYTICS + SSE REALTIME
4.1 Add analytics consent support using existing consent API
- Implement a small consent client:
  - GET /api/consent/status
  - POST /api/consent/grant { consentType: 'analytics', legalBasis: 'consent', purpose: 'product_analytics' }
  - POST /api/consent/revoke { consentType: 'analytics', reason: 'user_opt_out' }
- Update server-side consent validation (STEP 1.3) so 'analytics' is a valid consent type.

4.2 Create: services/web/src/stores/consent-store.ts (Zustand, persisted)
- Store:
  - analyticsGranted: boolean
  - loaded: boolean
  - loadFromServer(): fetch /api/consent/status and set analyticsGranted
  - grantAnalytics(): call /api/consent/grant then refresh
  - revokeAnalytics(): call /api/consent/revoke then refresh

4.3 Create: services/web/src/lib/analytics.ts
- export function trackEvent(eventName: string, properties?: object, researchId?: string)
- Behavior:
  - If consent-store.analyticsGranted is false -> return (no-op)
  - POST /api/analytics/events with header X-Analytics-Consent: true
  - Batch small bursts (optional): keep an in-memory queue and flush every N seconds or N events.
  - Never accept free-text fields; only pass whitelisted property keys (ids, booleans, numbers, enums).

4.4 Create: services/web/src/components/AnalyticsConsentBanner.tsx
- Render only when:
  - consent-store.loaded is true
  - analyticsGranted is false
- Copy:
  - Explain: "We collect usage events (no PHI) to improve ResearchFlow. Optional."
  - Buttons: Allow analytics / No thanks
- Allow -> grantAnalytics()
- No thanks -> keep false (do not call server unless you want to explicitly store opt-out as revoked)

4.5 Governance Console: replace polling with SSE (keep fallback)
- File: services/web/src/pages/governance-console.tsx
- Replace 30s setInterval polling with EventSource:
  - const es = new EventSource('/api/stream?topic=governance')
  - On 'hello' and governance.* events, update governance store (mode + flags)
  - If SSE errors or closes, fall back to existing polling every 30s.
- Emit analytics:
  - trackEvent('governance.console_view', { page: 'governance' })

4.6 Ensure governance-store becomes server-authoritative
- File: services/web/src/stores/governance-store.ts
- Add hydrateFromServer({ mode, flags, flagsMeta })
- Ensure persisted state does not override the server (treat server snapshot as source of truth).

4.7 Optional (nice): job status UI realtime
- Wherever the UI shows job progress, subscribe to EventSource('/api/stream?topic=jobs') and update job progress.

STEP 5 - ERROR ALERTING (SENTRY) WITH PHI SCRUBBING
5.1 Orchestrator (Node)
- Add dependency: @sentry/node
- In services/orchestrator/index.ts (primary entrypoint):
  - If process.env.SENTRY_DSN is set, initialize Sentry.
  - Implement beforeSend(event):
    - Remove request bodies, headers, cookies, breadcrumbs.
    - Remove/blank event.extra and any custom context fields that might include user input.
    - Run @researchflow/phi-engine scan on JSON.stringify(sanitizedEvent). If detected -> drop event (return null).
  - Ensure uncaught exceptions and Express errors are captured.

5.2 Web (React)
- Add dependencies: @sentry/react (and required browser package)
- Initialize in app entry (e.g., services/web/src/main.tsx):
  - Use import.meta.env.VITE_SENTRY_DSN
  - beforeSend scrubs breadcrumbs and strips any user-entered content.
  - If phi-engine is available in web bundle, run a lightweight scan; otherwise default to aggressive field stripping.

5.3 Docs
- Add docs/ops/observability.md:
  - Env vars: SENTRY_DSN, VITE_SENTRY_DSN
  - Alerting: how to route critical issues to email/PagerDuty
  - PHI policy: "No PHI in Sentry; events are scrubbed and dropped if PHI is detected."

STEP 6 - CI SECURITY INTEGRATIONS
6.1 Dependabot
- Add .github/dependabot.yml
  - ecosystems: github-actions, npm (root + services/* + packages/*), pip (services/worker)
  - schedule weekly
  - label PRs "dependencies"

6.2 pip-audit + Trivy
- Update existing .github/workflows/security-scan.yaml (preferred) to include:
  - pip-audit -r services/worker/requirements.txt
  - Trivy fs scan of repo
- Ensure workflow runs on:
  - pull_request
  - push to main
  - schedule (weekly)
- Store results as artifacts (or SARIF if enabled).

STEP 7 - TESTS + E2E MOCKS
7.1 Unit/integration tests (vitest)
- Add tests for:
  - FeatureFlagService evaluation (required_modes, rollout_percent, env override)
  - Analytics ingestion (consent required, allowlist enforced, PHI redaction behavior)
  - GovernanceConfigService mode persistence (db + env updated)

7.2 E2E mocks
- Update tests/e2e/mocks/handlers.ts:
  - /api/governance/state now returns flags + flagsMeta + mode
  - /api/analytics/events accepts and returns accepted/rejected
  - /api/consent/status/grant/revoke for analytics consent
- If E2E does not support SSE, keep UI fallback polling path so tests remain stable.

STEP 8 - DOCS + FINAL VERIFICATION
8.1 Add docs/OBSERVABILITY_FEATURE_FLAGS_UPGRADE.md
- Endpoints added
- SSE event types
- Analytics event allowlist
- Consent flow (analytics)

8.2 Update .env.example
- Add (if missing):
  - ANALYTICS_IP_SALT=change-me
  - SENTRY_DSN=
  - VITE_SENTRY_DSN=
  - REDIS_URL=

8.3 Verify
- Run:
  - npm run typecheck
  - npm test
  - npm run test:e2e (if available)
- Confirm governance console works with SSE (and fallback).
- Confirm analytics drops events without consent.
- Confirm Sentry drops events when PHI detected.

COMMIT PLAN (SEPARATE, REVIEWABLE COMMITS)
1) feat(core): add governance_config + feature flags + experiments + analytics tables (sql + drizzle)
2) feat(orchestrator): event-bus + analytics route + stream route + db-backed governance
3) feat(web): consent-based analytics + SSE governance updates + fallback polling
4) chore(observability): Sentry integration + docs
5) chore(ci): dependabot + enhance security-scan workflow (pip-audit + trivy + schedule)
6) test: add/adjust unit/integration tests + update E2E mocks

FINAL OUTPUT REQUIREMENTS
When finished, print:
- Summary of changes
- List of new endpoints
- List of new tables
- SSE event types
- Any follow-up TODOs (for example: enabling PagerDuty in Sentry UI)
```
