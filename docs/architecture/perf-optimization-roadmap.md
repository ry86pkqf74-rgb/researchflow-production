# Performance Optimization Roadmap

> ResearchFlow Production Performance & Scaling Strategy
> Updated: 2026-01-20

## Overview

This document outlines the phased approach to optimizing ResearchFlow for production scale. Each phase is designed to be independently deployable with minimal risk.

## Success Metrics

| Metric | Current | Target | Phase |
|--------|---------|--------|-------|
| p95 latency (AI drafts) | ~30s | <10s (perceived) | 07 |
| DB CPU utilization | Variable | <60% avg | 05 |
| Cache hit rate | 0% | >40% | 04 |
| Worker throughput | 1 req/worker | 4+ req/worker | 08 |
| Auto-scale response | Manual | <60s | 02 |

---

## Phase Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                    OPTIMIZATION PHASES                          │
├─────────────────────────────────────────────────────────────────┤
│  Phase 01: Baseline & Guardrails     [Foundation]               │
│  Phase 02: K8s Autoscaling           [Elasticity]               │
│  Phase 03: ROS Gateway               [Architecture]             │
│  Phase 04: Caching                   [Throughput]               │
│  Phase 05: DB Indexes                [Database]                 │
│  Phase 06: Nginx/CDN                 [Delivery]                 │
│  Phase 07: Streaming UX              [Latency]                  │
│  Phase 08: Observability             [Visibility]               │
└─────────────────────────────────────────────────────────────────┘
```

---

## Phase 01: Baseline & Guardrails

**Goal:** Establish safe foundation for subsequent changes.

**Deliverables:**
- [x] PR template with rollout/backout checklists
- [x] Environment variable registry (`docs/configuration/env-vars.md`)
- [x] TypeScript env config helper
- [x] Performance optimization roadmap (this doc)

**Risk:** None - documentation only.

---

## Phase 02: K8s Autoscaling Wiring

**Goal:** Enable automatic scaling under load.

**Components:**
- HPA for orchestrator (2-10 replicas, CPU 70%)
- HPA for worker (1-20 replicas, CPU 60%, queue-length metric)
- HPA for web (2-8 replicas, CPU 75%)
- PodDisruptionBudgets for availability

**Configuration:** `infrastructure/kubernetes/base/hpa-config.yaml`

**Env Vars:** None (K8s manifests only)

**Risk:** Low - HPAs scale pods, not behavior.

---

## Phase 03: ROS Gateway Consistency

**Goal:** Centralize API routing through orchestrator.

**Architecture:**
```
┌─────────┐      ┌──────────────┐      ┌────────┐
│   Web   │─────▶│ Orchestrator │─────▶│ Worker │
│         │      │  /api/ros/*  │      │        │
└─────────┘      │   (proxy)    │      └────────┘
                 └──────────────┘
```

**Benefits:**
- Single security boundary
- Centralized auth/audit
- Consistent logging
- Streaming support

**Env Vars:**
- `ROS_PROXY_ENABLED` (default: true)
- `WORKER_URL` (default: http://worker:8000)
- `ROS_PROXY_TIMEOUT_MS` (default: 120000)

**Risk:** Medium - new proxy layer; feature-flagged.

---

## Phase 04: Throughput via Caching

**Goal:** Reduce redundant expensive operations.

**Cache Layers:**
1. **AI Response Cache** (ai-router)
   - Tenant-aware, hash-based keys
   - PHI-gated (only cache clean I/O)
   - Redis or memory backend

2. **Literature Search Cache** (worker)
   - Query+limit keyed
   - 24h TTL, 1000 max entries

3. **IRB Draft Cache** (optional)
   - Only if PHI-safe
   - Disabled by default

**Env Vars:**
- `AI_RESPONSE_CACHE_ENABLED` / `_TTL_SECONDS` / `_BACKEND`
- `LIT_CACHE_ENABLED` / `_TTL_SECONDS` / `_MAXSIZE`
- `IRB_DRAFT_CACHE_ENABLED`

**Risk:** Low - caches are additive, feature-flagged.

---

## Phase 05: Database Indexes

**Goal:** Optimize frequent query patterns.

**Target Tables:**
- `approval_gates` (resource_id, status)
- `topics` (research_id, status)
- `statistical_plans` (research_id, status)
- `file_uploads` (research_id, status)
- `handoff_packs` (research_id, stage_id)
- `audit_logs` (research_id, created_at)
- `phi_scan_results` (resource_type, resource_id)

**Migration:** `migrations/0009_performance_indexes.sql`

**Risk:** Low - `CREATE INDEX IF NOT EXISTS` is idempotent.

---

## Phase 06: Web/Nginx CDN Readiness

**Goal:** Optimize static asset delivery.

**Changes:**
- Extract nginx.conf to versioned file
- Static assets: `Cache-Control: public, max-age=2592000, immutable`
- HTML: `Cache-Control: no-cache` (fast rollouts)
- Enable gzip (already present)
- Document Brotli strategy (edge vs origin)

**Risk:** Low - caching rules only.

---

## Phase 07: Streaming & Perceived Latency

**Goal:** Show progress during long AI operations.

**Architecture:**
```
┌─────────┐      ┌──────────────┐      ┌───────────┐
│   Web   │◀─SSE─│ Orchestrator │◀─────│ ai-router │
│ (React) │      │ /api/ai/stream│      │(streaming)│
└─────────┘      └──────────────┘      └───────────┘
```

**SSE Events:**
- `status` - phase updates (Drafting, Validating, etc.)
- `token` - partial text chunks
- `done` - final payload
- `error` - error details

**Env Vars:**
- `AI_STREAMING_ENABLED` (default: false)
- `AI_STREAMING_IDLE_TIMEOUT_MS` (default: 30000)
- `VITE_AI_STREAMING_ENABLED` (default: false)

**Risk:** Medium - new endpoint; feature-flagged.

---

## Phase 08: Observability & Worker Parallelism

**Goal:** Make performance measurable and improvable.

**Metrics Endpoints:**
- Worker: `GET /metrics` (Prometheus format)
- Orchestrator: `GET /metrics` (prom-client)

**Tracked Metrics:**
- Request count/latency by route
- Cache hit rates
- CPU/memory usage
- Proxy latency (orchestrator→worker)

**Worker Parallelism:**
- `UVICORN_WORKERS` env var (default: 1)
- Dockerfile/entrypoint integration

**Risk:** Low - additive observability.

---

## Rollout Strategy

### Staging First
All phases deploy to staging before production:
1. Apply changes
2. Run integration tests
3. Load test (if applicable)
4. Monitor for 24h
5. Promote to production

### Feature Flags
Behavior-changing features are always flagged:
- Default: OFF in production
- Enable incrementally
- Instant rollback via env var

### Backout Plans
Every phase has documented backout:
- Revert PR (safest)
- Disable feature flag (fastest)
- K8s rollback (for manifest changes)

---

## Dependencies

```
Phase 01 ──┬──▶ Phase 02 ──▶ Phase 08 (HPA tuning)
           │
           ├──▶ Phase 03 ──▶ Phase 07 (streaming needs proxy)
           │
           ├──▶ Phase 04 (caching)
           │
           ├──▶ Phase 05 (DB indexes)
           │
           └──▶ Phase 06 (nginx)
```

Phase 01 is the foundation; other phases can proceed in parallel after it.

---

## Monitoring & Alerts

### Key Dashboards
1. **Request Latency** - p50/p95/p99 by endpoint
2. **Cache Performance** - hit rate, size, evictions
3. **Database** - query latency, connection pool, CPU
4. **Worker Pool** - queue depth, processing time
5. **Autoscaling** - replica counts, HPA events

### Critical Alerts
| Alert | Threshold | Action |
|-------|-----------|--------|
| p95 > 10s | 5 min | Investigate slow queries |
| Error rate > 1% | 5 min | Check logs, rollback if needed |
| Cache hit < 20% | 1 hour | Review cache keys |
| Worker queue > 100 | 5 min | Scale workers |
| DB CPU > 80% | 10 min | Review queries, add indexes |

---

## References

- [Environment Variables Registry](../configuration/env-vars.md)
- [K8s HPA Configuration](../../infrastructure/kubernetes/base/hpa-config.yaml)
- [Database Scaling Plan](SCALE_PLAN.md)
