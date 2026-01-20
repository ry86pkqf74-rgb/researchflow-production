# ResearchFlow Deployment Robustness & Performance Optimization Prompt

## Role
You are **Claude**, acting as an autonomous senior platform engineer on the repository:

**ry86pkqf74-rgb/researchflow-production**

Your task is to implement the changes below exactly, producing production‑ready code, configuration, tests, and documentation.

---

## Global Constraints (Non‑Negotiable)

- **Fail‑closed always**: When `ROS_MODE=STANDBY` or `NO_NETWORK=true` or `MOCK_ONLY=true`, *no outbound network calls* may be attempted.
- **No PHI leakage**: Never log, emit, or export PHI.
- **No secrets in code**: Use env vars / secrets only.
- **Backward compatible**: Prefer aliasing endpoints and env vars over breaking changes.
- **Production realism**: No placeholders, mocks, or TODO stubs where correctness matters.

---

## A) Health & Readiness Endpoint Consistency

### Problems Identified
- Orchestrator Docker healthcheck uses `/api/health`, but server exposes `/health`.
- Worker Docker healthcheck expects `/health`, but FastAPI worker lacks it.
- Readiness checks do not validate real dependencies.

### Tasks

#### A1. Orchestrator health aliases
**File:** `services/orchestrator/index.ts`

Add:
- `GET /api/health` → alias of `/health`
- `GET /api/health/ready` → alias of `/health/ready`

Do **not** remove existing endpoints.

#### A2. Orchestrator real readiness checks
Upgrade `/health/ready` to validate:
- **Postgres**: `SELECT 1` using existing pg Pool
- **Redis**: TCP RESP `PING` (no new deps)
- **Worker**: HTTP GET `${WORKER_CALLBACK_URL}/health` (2s timeout)

Return:
```json
{
  "status": "ready",
  "checks": { "db": "ok", "redis": "ok", "worker": "ok" },
  "mode": { "ros_mode": "...", "no_network": "...", "mock_only": "..." }
}
```

Fail with HTTP 503 and explicit failed checks.

#### A3. Worker health endpoints
**File:** `services/worker/api_server.py`

Add:
- `GET /health`
- `GET /health/ready`

Include runtime mode flags and validate internal invariants.

---

## B) Mode Toggling & Fail‑Closed Governance

### Goals
- Single operator toggle via `ROS_MODE`
- Preserve `GOVERNANCE_MODE` compatibility
- Document emergency fallback behavior

### Tasks

#### B1. Mode precedence
**File:** `services/orchestrator/middleware/mode-guard.ts`

- Prefer `ROS_MODE` if set
- Fallback to `GOVERNANCE_MODE`

#### B2. Deployment env propagation
**Files:**  
- `docker-compose.prod.yml`  
- `infrastructure/kubernetes/**/configmap.yaml`

Ensure all services receive:
```
ROS_MODE
NO_NETWORK
MOCK_ONLY
ALLOW_UPLOADS
STRICT_PHI_ON_UPLOAD
```

Defaults:
- CI / STANDBY: network blocked
- Production: LIVE, network enabled

#### B3. Documentation
Create:
- `docs/operations/MODE_TOGGLE.md`

Include:
- Mode definitions
- Emergency STANDBY procedure (Docker + K8s)
- Return‑to‑LIVE checklist

---

## C) Backups & Recovery

### Tasks

#### C1. Makefile hardening
**File:** `Makefile`
- Ensure `backups/` exists
- Non‑interactive `docker-compose exec -T`
- Add retention target
- Optional restore helper

#### C2. Kubernetes CronJob backups
**Files:**
- `infrastructure/kubernetes/overlays/production/db-backup-cronjob.yaml`
- `kustomization.yaml`

Features:
- Daily backups
- Retention pruning
- SHA256 checksums

#### C3. Runbooks
Create:
- `docs/operations/BACKUPS_AND_RESTORE.md`

Cover:
- Local backups
- K8s CronJobs
- PITR guidance (managed DBs)

---

## D) Monitoring & Telemetry

### Goals
- Visibility into blocked vs failed external calls
- No heavy observability stack required

### Tasks

#### D1. Telemetry collector
**File:** `services/orchestrator/src/utils/telemetry.ts`

Track:
- `external_calls_total{provider,status}`
- `external_calls_blocked_total`
- `external_calls_failed_total`

#### D2. Metrics endpoint
Expose:
- `GET /api/metrics`

Return counters + runtime mode (no secrets).

#### D3. Enforce gating in all AI paths
**Files:**
- `services/orchestrator/llm-router.ts`
- `packages/ai-router/src/model-router.service.ts`

Before any SDK call:
- Check mode flags
- Block if disallowed
- Record telemetry

---

## E) Logging Volume Management

### Tasks

#### E1. Structured logger
**File:** `services/orchestrator/src/utils/logger.ts`
- Levels: debug/info/warn/error
- Respect `LOG_LEVEL`
- JSON optional

#### E2. Replace noisy logs
- Remove `console.log` in hot paths
- Ensure PHI‑safe logging only

#### E3. Logging docs
Create:
- `docs/operations/LOGGING.md`

---

## F) Future Performance (Docs + Hooks Only)

Create:
- `docs/architecture/SCALE_PLAN.md`
- `docs/operations/PROFILING.md`

Include:
- DB scaling strategy
- Distributed processing roadmap
- Profiling playbook
- Validation fast‑path guidance (documented, not enabled)

---

## Testing Requirements

- Vitest: verify external calls are blocked in STANDBY
- Pytest: verify `/health` and `/health/ready`
- No broad test rewrites

---

## Final Output

At completion:
- Summarize changes
- List all modified and created files
- Confirm fail‑closed behavior is preserved

**End of Prompt**
