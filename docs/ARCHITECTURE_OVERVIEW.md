# ResearchFlow Architecture Overview

> Single-source-of-truth architecture documentation for ResearchFlow Production

## System Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                              CLIENTS                                     │
│                    Browser (React SPA) / API Consumers                   │
└─────────────────────────────────────────────────────────────────────────┘
                                   │
                                   ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         INGRESS / LOAD BALANCER                          │
│                    (Nginx / K8s Ingress Controller)                      │
│                   TLS termination, rate limiting                         │
└─────────────────────────────────────────────────────────────────────────┘
                    │                               │
                    ▼                               ▼
┌───────────────────────────────┐   ┌───────────────────────────────────┐
│     NODE.JS ORCHESTRATOR      │   │      REACT WEB (services/web)     │
│     (services/orchestrator)   │   │                                   │
│ ┌───────────────────────────┐ │   │  ┌─────────────────────────────┐  │
│ │  Auth (JWT + RBAC)        │ │   │  │  Zustand Stores             │  │
│ │  PHI Scanning Middleware  │ │   │  │  - auth, consent, mode      │  │
│ │  Governance Mode Guards   │ │   │  │  - dataset, org, governance │  │
│ │  Feature Flag Service     │ │   │  └─────────────────────────────┘  │
│ │  Audit Logging            │ │   │  ┌─────────────────────────────┐  │
│ └───────────────────────────┘ │   │  │  74 UI Components           │  │
│ ┌───────────────────────────┐ │   │  │  Voice/Audio Integration    │  │
│ │  AI Router (no PHI)       │ │   │  │  CRDT Collaborative Editor  │  │
│ │  Job Queue (BullMQ)       │ │   │  └─────────────────────────────┘  │
│ │  WebSocket (Collaboration)│ │   └───────────────────────────────────┘
│ │  48+ API Routes           │ │
│ │  48+ Service Classes      │ │
│ └───────────────────────────┘ │
└───────────────────────────────┘
        │           │
        │           ▼
        │   ┌───────────────────────────────┐
        │   │   COLLABORATION SERVICE       │
        │   │   (services/collab)           │
        │   │                               │
        │   │  Hocuspocus + Y.js CRDT       │
        │   │  Redis > Postgres > Memory    │
        │   │  PHI Scanning (debounced)     │
        │   │  JWT Auth, Presence Tracking  │
        │   └───────────────────────────────┘
        │
        ▼
┌───────────────────────────────┐
│     PYTHON COMPUTE WORKER     │
│     (services/worker)         │
│ ┌───────────────────────────┐ │
│ │  Pandera Validation       │ │
│ │  20-Stage Workflow Engine │ │
│ │  Stage 20 Conference Prep │ │
│ │  Statistical Analysis     │ │
│ │  Figure/Table Generation  │ │
│ │  Artifact Manifest Writer │ │
│ │  PHI Output Guard         │ │
│ └───────────────────────────┘ │
└───────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                          DATA & STORAGE LAYER                            │
│ ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────────────┐   │
│ │   PostgreSQL    │  │      Redis      │  │    Filesystem/S3        │   │
│ │   - Users       │  │   - Job Queue   │  │   /data/artifacts/      │   │
│ │   - Projects    │  │   - Cache       │  │   /data/manifests/      │   │
│ │   - Artifacts   │  │   - Sessions    │  │   /data/logs/           │   │
│ │   - Audit Logs  │  │   - Collab YDoc │  │   /data/uploads/        │   │
│ │   - Feature Flags│ │   - Pub/Sub     │  │                         │   │
│ └─────────────────┘  └─────────────────┘  └─────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────┘
```

## Trust Boundaries

### Boundary 1: Browser to Backend
- All API requests authenticated via JWT
- RBAC enforced on every route
- Input validation + sanitization
- Rate limiting at ingress

### Boundary 2: Orchestrator to Worker
- Job specs as JSON (no raw PHI in specs)
- Worker operates in isolated container
- Results written to shared storage
- PHI output guard validates before write

### Boundary 3: PHI Boundary (Critical)
- **PHI never leaves the secure perimeter in DEMO mode**
- PHI scanning at: upload, AI routing, export, collaboration
- Audit log captures all PHI access attempts
- Fail-closed: if scan fails, operation blocked

```
                    ┌──────────────────────────────────────┐
                    │        PHI SECURE BOUNDARY            │
                    │                                      │
   User Input ──────┼──▶ PHI Scan ──▶ [BLOCK if PHI]       │
                    │                                      │
   AI Request ──────┼──▶ PHI Scan ──▶ [Strip PHI] ──▶ AI   │
                    │                                      │
   Export Request ──┼──▶ PHI Scan ──▶ [Audit] ──▶ Export   │
                    │                                      │
   Collab Edit ─────┼──▶ PHI Scan (debounced) ──▶ [Warn]   │
                    │                                      │
                    └──────────────────────────────────────┘
```

## Service Communication

### HTTP APIs
| Source | Target | Protocol | Auth | Notes |
|--------|--------|----------|------|-------|
| Browser | Orchestrator | HTTPS | JWT | REST API |
| Orchestrator | Worker | HTTP | Internal | Docker network |
| Browser | Collab | WSS | JWT | WebSocket for CRDT |

### Event Bus (Redis Pub/Sub)
- Governance mode changes broadcast to all services
- Feature flag updates trigger cache invalidation
- Job status updates pushed to clients via SSE

### Message Queue (BullMQ/Redis)
- Job specs queued by orchestrator
- Worker processes jobs asynchronously
- Status updates via callback URL

## Packages (Shared Libraries)

| Package | Purpose | Key Exports |
|---------|---------|-------------|
| `packages/core` | Shared TypeScript types | Zod schemas, role types, artifact types |
| `packages/ai-router` | AI model routing | Tier selection, cost calculation, watermarking |
| `packages/phi-engine` | PHI detection | Scanning, scrubbing, log redaction |
| `packages/manuscript-engine` | Document building | IMRaD sections, citations, formatting |

## Governance Modes

| Mode | PHI Access | External AI | Feature Flags | Use Case |
|------|------------|-------------|---------------|----------|
| DEMO | Blocked | Mocked | Playful enabled | Sales demos, training |
| LIVE | Audited | Real | Strict defaults | Production |
| STANDBY | Read-only | Disabled | Minimal | Maintenance |

## Security Controls

### Authentication
- JWT tokens with configurable expiration
- Session management via Redis
- MFA support (TOTP)

### Authorization
- Role-based: VIEWER, RESEARCHER, STEWARD, ADMIN
- Resource-level permissions
- Organization multi-tenancy

### Audit Trail
- All actions logged with:
  - Timestamp, user, action, resource
  - IP address, user agent, session ID
  - Previous/entry hash (chain integrity)
- Retention: configurable (default 365 days)

### PHI Protection
- Input scanning (regex + ML patterns)
- Output guard (worker results)
- Collaboration scanning (debounced)
- Never logged or echoed to user

## Scalability

### Horizontal Scaling
- Orchestrator: stateless, scale via replicas
- Worker: scale based on job queue depth
- Collab: scale via Hocuspocus clustering

### Vertical Scaling
- Worker: memory-intensive analysis
- Redis: in-memory caching

### Data Partitioning
- Organization-based multi-tenancy
- Project-level isolation
- Artifact sharding by project ID

## Disaster Recovery

### Backups
- PostgreSQL: daily full + hourly incremental
- Redis: RDB snapshots + AOF
- Artifacts: S3 versioning (production)

### Failover
- Database: read replicas with automatic promotion
- Redis: Sentinel or Cluster mode
- Services: K8s self-healing

## Ports and Protocols

| Service | Port | Protocol | Internal | External |
|---------|------|----------|----------|----------|
| Web | 5173 | HTTP | ✓ | Via ingress |
| Orchestrator | 3001 | HTTP | ✓ | Via ingress |
| Collab | 3002 | WS | ✓ | Via ingress |
| Worker | 8000 | HTTP | ✓ | No |
| PostgreSQL | 5432 | TCP | ✓ | No |
| Redis | 6379 | TCP | ✓ | No |

## Related Documentation

- [Stages Map](./STAGES_MAP.md) - 20-stage workflow mapping
- [Local Development](./LOCAL_DEV.md) - Development setup
- [Deployment](./DEPLOYMENT.md) - Production deployment
- [Security & Governance](./SECURITY_GOVERNANCE.md) - Security details
