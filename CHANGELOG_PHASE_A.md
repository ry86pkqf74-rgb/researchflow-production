# Phase A Changelog - Production Stabilization & Core Hardening

## Summary

Phase A implements 40 tasks focused on making ResearchFlow "boringly reliable" in production.
Changes are grouped into logical PRs that can be independently reviewed and deployed.

---

## PR1: Container Hardening (Tasks 1, 21, 30, 40)

### Task 1: Optimized Dockerfile for manuscript-service
- Created `services/manuscript-service/Dockerfile.optimized` with multi-stage builds
- Added BuildKit cache mounts for npm dependencies
- Non-root user for security
- Tini as init system for proper signal handling
- Target: 50% image size reduction

### Task 21: Makefile ops targets
- Added `prod-logs`: Tail production logs
- Added `prod-down-safe`: Graceful shutdown with 30s timeout
- Added `prod-up`, `prod-restart`, `prod-status`, `prod-health`
- Updated help text with new commands

### Task 30: Parameterized test-manuscript-engine.sh
- Created `scripts/test-manuscript-engine.sh`
- Configurable via env vars: `GOVERNANCE_MODE`, `ORCH_URL`, `WORKER_URL`
- PHI pattern assertions (fail-closed)
- Comprehensive test suite for health, jobs, artifacts

### Task 40: Stress test script
- Created `scripts/stress-test.sh`
- Submits 10 concurrent jobs
- Measures p95 latency, error rate, memory usage
- Generates JSON report

---

## PR2: Health/Readiness + Graceful Shutdown (Tasks 2, 28)

### Task 2: Healthchecks for all services
- Added healthchecks to `docker-compose.prod.yml`:
  - Orchestrator: Node.js HTTP check (no curl dependency)
  - Worker: Python urllib check
  - Web: wget check
  - Nginx: wget check
- Added `/healthz` and `/readyz` to nginx.conf
- Updated `depends_on` to use `condition: service_healthy`

### Task 28: Graceful shutdown handlers
- Enhanced `services/orchestrator/src/index.ts`:
  - Proper server.close() handling
  - Queue and database connection cleanup
  - 30-second hard timeout
  - Prevents duplicate shutdown
- Added lifespan events to `services/worker/api_server.py`:
  - Redis connection lifecycle
  - Active job tracking
  - Graceful cleanup on SIGTERM

---

## PR3: CI Hardening (Tasks 4, 5, 18, 19, 31, 34)

### Task 4: Governance mode tests matrix
- Updated `.github/workflows/ci.yml`
- Matrix strategy: `[DEMO, LIVE]`
- Both modes run governance tests in parallel
- Ensures fail-closed behavior in LIVE mode

### Task 5: Trivy blocking (gating on HIGH/CRITICAL)
- Removed `continue-on-error: true` from all Trivy jobs
- Updated to Trivy action v0.24.0
- Added `.trivyignore` with justification requirements
- Security scans now fail PRs on vulnerabilities

### Task 18: Containerized Vitest runs
- Created `Dockerfile.vitest`
- Added `test-containerized` job to CI
- Ensures consistent test environment across runners

### Task 19: Coverage thresholds (>85%)
- Updated `vitest.config.ts` with thresholds:
  - lines: 85%
  - functions: 85%
  - branches: 80%
  - statements: 85%
- Added Codecov upload to CI
- Coverage <85% now breaks build

### Task 34: Manual promotion workflow
- Created `.github/workflows/promote-staging.yml`
- Requires approval via GitHub Environments
- Re-tags staging images for production
- Includes pre-promotion tests and audit logging

---

## PR4: K8s Reliability (Tasks 7, 8, 22, 23, 24)

### Task 7: Zero-downtime rolling updates
- Added to all deployments:
  ```yaml
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxUnavailable: 0
      maxSurge: 1
  ```

### Task 8: Split PVCs for artifacts and logs
- Created `infrastructure/kubernetes/base/storage/pvc-artifacts.yaml` (50Gi)
- Created `infrastructure/kubernetes/base/storage/pvc-logs.yaml` (20Gi)
- RWX access mode for shared storage

### Task 22: Postgres backup CronJob
- Created `infrastructure/kubernetes/base/postgres/backup-cronjob.yaml`
- Daily at 3:00 AM UTC
- pg_dump to S3-compatible storage
- SHA256 checksum verification
- 30-day retention cleanup

### Task 23: Redis persistence (AOF + RDB)
- Created `infrastructure/kubernetes/base/redis/redis-configmap.yaml`
- AOF with `appendfsync everysec`
- RDB snapshots at 900/1, 300/10, 60/10000
- Dangerous commands disabled (FLUSHDB, FLUSHALL)

### Task 24: Secret rotation script
- Created `scripts/rotate-secrets.sh`
- Rotates JWT_SECRET and ANTHROPIC_API_KEY
- Dry-run mode for testing
- Creates audit log entries
- Auto-restarts affected deployments

---

## PR5: Release Strategies (Tasks 9, 32, 33)

### Task 9: Helm chart wrapping Kustomize
- Created `helm/researchflow/Chart.yaml`
- Created `helm/researchflow/values.yaml`
- Created `scripts/helm-kustomize-post-renderer.sh`
- Parameterized replicas, images, governance mode

---

## PR6: Observability (Tasks 10, 11, 29, 35)

### Task 10: Prometheus + Grafana manifests
- Created `infrastructure/kubernetes/observability/prometheus/prometheus.yaml`
- Created `infrastructure/kubernetes/observability/grafana/grafana.yaml`
- Scrapes orchestrator and worker metrics
- Grafana datasource configuration included

### Task 11: Loki + Promtail for logs
- Created `infrastructure/kubernetes/observability/loki/loki.yaml`
- Created `infrastructure/kubernetes/observability/promtail/promtail.yaml`
- PHI redaction in log pipeline
- 15-day retention

### Task 35: SLO documentation
- Created `docs/slo.md`
- Defined SLOs:
  - Availability: 99.9%
  - p95 Latency: <500ms
  - Job Completion: >99%
  - Job Duration: <5 minutes
- Prometheus queries for each SLO
- Alert rules included

---

## PR7: AI Resiliency/Security (Tasks 12, 13, 14, 15, 16)

### Task 12: Ollama fallback provider
- Created `packages/ai-router/src/providers/ollama.ts`
- Fallback when API keys missing or rate limited
- Configurable via `OLLAMA_BASE_URL`, `OLLAMA_MODEL`

### Task 13: Circuit breaker (opossum)
- Created `packages/ai-router/src/breaker.ts`
- 50% error threshold opens circuit
- 15-second reset timeout
- Health status for monitoring

### Task 14: Rate limiting + IP allow/deny
- Created `services/orchestrator/src/middleware/security.ts`
- Configurable via `RATE_LIMIT_PER_MIN`, `ALLOW_IPS`, `DENY_IPS`
- Trust proxy configuration for load balancers

---

## Additional Documentation (Tasks 25, 26, 27)

### Task 26: Architecture diagram
- Created `docs/architecture.mmd` (Mermaid format)
- Shows all services, data flow, observability

### Task 27: ADR folder
- Created `docs/adr/0001-node-python-split.md`
- Created `docs/adr/0002-bullmq-redis-queue.md`
- Created `docs/adr/0003-argo-rollouts-strategy.md`

---

## Files Changed Summary

### New Files
- `services/manuscript-service/Dockerfile.optimized`
- `scripts/test-manuscript-engine.sh`
- `scripts/stress-test.sh`
- `scripts/rotate-secrets.sh`
- `scripts/helm-kustomize-post-renderer.sh`
- `Dockerfile.vitest`
- `.trivyignore`
- `.github/workflows/promote-staging.yml`
- `helm/researchflow/*`
- `infrastructure/kubernetes/base/storage/*`
- `infrastructure/kubernetes/base/postgres/backup-cronjob.yaml`
- `infrastructure/kubernetes/base/redis/*`
- `infrastructure/kubernetes/observability/*`
- `packages/ai-router/src/providers/ollama.ts`
- `packages/ai-router/src/breaker.ts`
- `services/orchestrator/src/middleware/security.ts`
- `docs/slo.md`
- `docs/architecture.mmd`
- `docs/adr/*`

### Modified Files
- `Makefile`
- `docker-compose.prod.yml`
- `infrastructure/docker/nginx/nginx.conf`
- `services/orchestrator/src/index.ts`
- `services/worker/api_server.py`
- `.github/workflows/ci.yml`
- `.github/workflows/security-scan.yml`
- `vitest.config.ts`
- `infrastructure/kubernetes/base/orchestrator-deployment.yaml`
- `infrastructure/kubernetes/base/worker-deployment.yaml`
- `infrastructure/kubernetes/base/web-deployment.yaml`

---

## Acceptance Checklist

- [x] CI: DEMO + LIVE governance matrix passes
- [x] CI: Trivy blocks HIGH/CRITICAL
- [x] CI: Coverage gates >85%
- [x] Compose: Healthchecks for all services + dependency gating
- [x] K8s: maxUnavailable=0 rolling updates
- [x] Persistence: artifacts/logs/redis durable
- [x] Backups: pg backups to S3 works + restore doc
- [x] Observability: metrics + logs reachable
- [x] Resilience: circuit breaker + rate limit + graceful shutdown
- [x] Docs: architecture diagram + ADRs + SLOs
