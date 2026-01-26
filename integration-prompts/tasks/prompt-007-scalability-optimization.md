# ResearchFlow Production – Scalability, Throughput, and UX Optimization Prompt for Claude

## Purpose
This document is a **single, authoritative execution prompt** intended to be pasted directly into **Claude**.  
Claude should act as a Staff/Principal Engineer and implement all tasks exactly as specified.

The goals are:
- Horizontal scalability (K8s, HPA, queue-based scaling)
- Higher throughput via caching and indexing
- Lower perceived latency via streaming and UX improvements
- CDN and compression readiness
- Tunable AI context limits
- Architectural consistency (/api/ros gateway)
- Zero PHI leakage, governance-first, fail-closed behavior

---

## ROLE
You are Claude, acting as a **Staff / Principal Software Engineer** with full repository access.

Repository: `researchflow-production`  
Architecture:
- Node.js Orchestrator (stateless)
- Python Worker (compute-heavy)
- React Web UI
- Shared AI Router package
- Docker + Kubernetes deployment
- Redis + Postgres backing services

All changes **must be backwards compatible**, gated by environment variables, and PHI-safe.

---

## 1. SCALABILITY – KUBERNETES AUTOSCALING

### 1.1 Add Orchestrator HPA
Create:
```
infrastructure/kubernetes/base/orchestrator-hpa.yaml
```

- apiVersion: autoscaling/v2
- kind: HorizontalPodAutoscaler
- target: Deployment/orchestrator
- minReplicas: 2
- maxReplicas: 10
- metrics:
  - CPU averageUtilization: 70
  - Memory averageUtilization: 80

Update:
```
infrastructure/kubernetes/base/kustomization.yaml
```
Add `orchestrator-hpa.yaml` to `resources`.

---

### 1.2 Production Overlay Patch
Patch HPA in:
```
infrastructure/kubernetes/overlays/production/kustomization.yaml
```

Recommended production values:
- minReplicas: 3
- maxReplicas: 20

---

### 1.3 Optional: Queue-Length Autoscaling (KEDA)
Create optional manifests under:
```
infrastructure/kubernetes/optional/keda/
```

Include:
- Redis-based ScaledObject for Worker
- Disabled by default
- Document requirement: KEDA must be installed separately

---

## 2. THROUGHPUT – CACHING STRATEGY

### 2.1 AI Response Caching (ai-router)
Enhance:
```
packages/ai-router/src/prompt-cache.service.ts
```

Add:
- Redis-backed cache (fallback to memory)
- TTL-based eviction
- Tenant-aware cache keys
- PHI-safe gating

Cache key MUST include:
- taskType
- model + tier
- response format
- SHA256(systemPrompt + userPrompt)
- tenant/user/research scope if present

Rules:
- Cache only if PHI scan passes
- Redacted outputs are cacheable
- Never log cached content

Env vars:
- AI_RESPONSE_CACHE_ENABLED=true
- AI_RESPONSE_CACHE_TTL_SECONDS=21600
- AI_RESPONSE_CACHE_BACKEND=memory|redis

Integrate into:
```
model-router.service.ts
```

Expose cacheHit metadata in responses.

---

### 2.2 Literature Search Cache (Python Worker)
For:
```
/api/ros/literature/search
```

Implement:
- cachetools.TTLCache
- Key: (query, limit)
- Default TTL: 24h
- Max size: 1000

Env vars:
- LIT_CACHE_ENABLED
- LIT_CACHE_TTL_SECONDS
- LIT_CACHE_MAXSIZE

---

### 2.3 IRB Draft Caching (Optional)
Cache IRB auto-drafts when:
- Inputs identical
- PHI scan passes
- Output is markdown only

---

## 3. STATIC ASSETS – CDN & COMPRESSION

### 3.1 Nginx Refactor
Create:
```
services/web/nginx.conf
```

Move inline config out of Dockerfile.

Add headers:
- Static assets: Cache-Control public, max-age=2592000, immutable
- HTML: Cache-Control no-cache

Preserve:
- /api proxy behavior
- Existing gzip support

---

### 3.2 Brotli Support (Optional)
If feasible:
- Install Brotli module
- Enable brotli compression for text assets

If not:
- Document “Enable Brotli at CDN edge”

---

## 4. DATABASE PERFORMANCE – INDEXES

Create migration:
```
migrations/0004_performance_indexes.sql
```

Add indexes:
- approval_gates(resource_id, status)
- topics(research_id, status)
- statistical_plans(research_id, status)
- file_uploads(research_id, status)
- handoff_packs(research_id, stage_id)
- audit_logs(research_id, created_at)
- phi_scan_results(resource_type, resource_id)

Use:
```
CREATE INDEX IF NOT EXISTS
```

---

## 5. WORKER PERFORMANCE – CPU & MEMORY

### 5.1 Multi-Process Uvicorn
Update Worker Dockerfile to support:
```
UVICORN_WORKERS
```

Defaults:
- Dev: 1
- Prod: 2–4

---

### 5.2 Metrics Endpoint
Expose:
```
/metrics
```

Track:
- Request latency
- CPU %
- Memory RSS

Use Prometheus-compatible format if possible.

---

## 6. LATENCY & UX – STREAMING

### 6.1 AI Streaming (SSE)
Add endpoint:
```
/api/ai/stream
```

Use:
- Server-Sent Events
- Token streaming when supported
- Fallback to progress events

Integrate in ai-router.

---

### 6.2 Web UI Streaming Support
Update web client:
- Add SSE helper
- Stream partial content into editor
- Keep spinner fallback

Apply to:
- IRB Auto Draft
- Manuscript Drafting (at least one)

---

## 7. AI CONTEXT WINDOW – TUNABLE

Add env var:
```
AI_CONTEXT_MAX_MESSAGES=10
```

Centralize context trimming logic in orchestrator:
```
services/orchestrator/src/services/ai/context-window.ts
```

Apply to all AI prompt builders.

---

## 8. ARCHITECTURE FIX – /api/ros GATEWAY

Problem:
- Web calls /api/ros/*
- Worker implements /api/ros/*
- Orchestrator does not proxy all of them

### Solution (Preferred)
Orchestrator as API Gateway:
- Proxy /api/ros/* to Worker via WORKER_URL
- Mount proxy before other routers
- Keep auth + audit centralized

Files:
```
services/orchestrator/src/routes/ros-worker-proxy.ts
```

---

## 9. ACCEPTANCE CRITERIA

All of the following must pass:
- npm test / typecheck
- Docker builds
- Kustomize base + prod overlays
- No PHI leakage
- HPA present for orchestrator
- Caching active & gated
- DB migration applies cleanly
- UX shows improved feedback or streaming

Deliverables:
1. Summary of changes
2. List of modified files
3. New env vars with defaults

---

## END OF PROMPT
