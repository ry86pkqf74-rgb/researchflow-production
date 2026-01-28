# ResearchFlow Backend Deployment Guide

This guide covers backend service optimization, performance tuning, and deployment best practices.

## Architecture Overview

ResearchFlow uses a microservices architecture with the following backend services:

| Service | Language | Port | Purpose |
|---------|----------|------|---------|
| Orchestrator | Node.js (Express) | 3001 | API Gateway, Authentication, AI Router |
| Worker | Python (FastAPI) | 8000 | Data Processing, ML/AI Tasks, PHI Scanning |
| Guideline Engine | Python (FastAPI) | 8001 | Clinical Scoring, Staging Calculations |
| Collab | Node.js (WebSocket) | 1234 | Real-time Collaboration |
| PostgreSQL | - | 5432 | Primary Database (pgvector enabled) |
| Redis | - | 6379 | Caching, Sessions, Pub/Sub |

---

## Performance Optimizations

### 1. Node.js (Orchestrator) Tuning

**Memory Settings**
```yaml
# docker-compose.yml
orchestrator:
  environment:
    - NODE_OPTIONS=--max-old-space-size=4096
```

**Connection Pooling**
The orchestrator uses connection pooling for PostgreSQL. Tune in `.env`:
```env
# PostgreSQL connection pool
DATABASE_POOL_MIN=5
DATABASE_POOL_MAX=20
```

**API Response Caching**
Redis is used for caching. Configure TTLs:
```env
LITERATURE_CACHE_TTL=3600  # 1 hour for literature search
CONFERENCE_CACHE_TTL=86400 # 24 hours for conference data
```

### 2. Python (Worker) Tuning

**Uvicorn Workers**
Scale workers based on CPU cores:
```yaml
# docker-compose.yml
worker:
  environment:
    - UVICORN_WORKERS=4  # Recommended: 2 * CPU cores + 1
```

**Memory for ML Models**
PHI detection uses spaCy models. Ensure adequate memory:
```yaml
worker:
  deploy:
    resources:
      limits:
        memory: 4G
      reservations:
        memory: 2G
```

**Dask Configuration (for large files)**
```env
LARGE_FILE_BYTES=52428800   # 50 MB threshold
DASK_ENABLED=true
DASK_WORKERS=4
DASK_MEMORY_LIMIT=4GB
```

### 3. PostgreSQL Optimization

**Connection Settings**
```sql
-- Increase max connections for production
ALTER SYSTEM SET max_connections = 200;

-- Work memory for complex queries
ALTER SYSTEM SET work_mem = '256MB';

-- Shared buffers (25% of RAM recommended)
ALTER SYSTEM SET shared_buffers = '4GB';
```

**pgvector Index Optimization**
```sql
-- Create HNSW index for faster vector search
CREATE INDEX ON document_embeddings
USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);
```

### 4. Redis Configuration

**Persistence Settings**
```conf
# redis.conf
appendonly yes
appendfsync everysec
maxmemory 2gb
maxmemory-policy allkeys-lru
```

---

## Security Hardening

### 1. Container Security

All containers use:
- ✅ Non-root users
- ✅ Read-only file systems (where possible)
- ✅ Minimal base images (Alpine, slim)
- ✅ Health checks

**Enable Read-Only**
```yaml
# docker-compose.yml
orchestrator:
  read_only: true
  tmpfs:
    - /tmp
```

### 2. Network Security

**Internal Network Isolation**
```yaml
networks:
  researchflow:
    internal: true  # No external access
  frontend:
    # External access for web/API
```

**Database Not Exposed**
PostgreSQL should only use `expose` (internal) not `ports`:
```yaml
postgres:
  expose:
    - "5432"  # Internal only
  # ports:   # Don't expose externally
  #   - "5432:5432"
```

### 3. Secrets Management

**Never in Environment Variables**
Use Docker secrets or external vault:
```yaml
services:
  orchestrator:
    secrets:
      - anthropic_api_key
      - openai_api_key

secrets:
  anthropic_api_key:
    external: true
  openai_api_key:
    external: true
```

### 4. PHI Protection

PHI scanning is enabled by default:
```env
PHI_SCAN_ENABLED=true
PHI_FAIL_CLOSED=true  # Block operations with PHI
```

---

## Scaling Strategies

### Horizontal Scaling

**Orchestrator (Stateless)**
```yaml
orchestrator:
  deploy:
    replicas: 3
    update_config:
      parallelism: 1
      delay: 10s
```

**Worker (CPU-bound)**
```yaml
worker:
  deploy:
    replicas: 4
    resources:
      limits:
        cpus: '2'
```

### Vertical Scaling

**Memory-Intensive Services**
```yaml
# Guideline Engine (clinical calculations)
guideline-engine:
  deploy:
    resources:
      limits:
        memory: 2G
```

---

## Health Checks

All services implement health endpoints:

| Service | Endpoint | Expected Response |
|---------|----------|-------------------|
| Orchestrator | GET /health | `{"status": "healthy"}` |
| Orchestrator | GET /api/health | Full health with DB/Redis |
| Worker | GET /health | `{"status": "ok"}` |
| Guideline Engine | GET /health | `{"status": "healthy"}` |
| Collab | GET :1235/health | `{"status": "ok"}` |

**Testing Health**
```bash
# All services
curl http://localhost:3001/api/health  # Orchestrator
curl http://localhost:8000/health      # Worker
curl http://localhost:8001/health      # Guideline Engine
curl http://localhost:1235/health      # Collab
```

---

## Monitoring & Logging

### Structured Logging

All services use JSON logging:
```env
LOG_FORMAT=json
LOG_LEVEL=info  # debug, info, warn, error
```

### Metrics

Enable Prometheus metrics:
```yaml
orchestrator:
  environment:
    - METRICS_ENABLED=true
    - METRICS_PORT=9090
```

### Error Tracking (Sentry)

```env
SENTRY_DSN=https://xxx@sentry.io/xxx
VITE_SENTRY_DSN=https://xxx@sentry.io/xxx
```

---

## Deployment Checklist

### Pre-Deployment

- [ ] All secrets configured in GitHub/K8s
- [ ] Database migrations tested
- [ ] Health checks passing locally
- [ ] Security scan completed (no critical/high vulns)
- [ ] API keys validated (all providers)

### During Deployment

- [ ] Database backup created
- [ ] Blue-green or rolling update strategy
- [ ] Health checks monitored during rollout
- [ ] No error spike in logs

### Post-Deployment

- [ ] All health endpoints returning 200
- [ ] Smoke tests passing
- [ ] No performance degradation
- [ ] Alerting configured

---

## Troubleshooting

### Common Issues

**1. Worker OOM (Out of Memory)**
```bash
# Check memory usage
docker stats worker

# Increase memory limit
UVICORN_WORKERS=2  # Reduce workers
```

**2. Database Connection Pool Exhaustion**
```bash
# Check active connections
SELECT count(*) FROM pg_stat_activity;

# Increase pool
DATABASE_POOL_MAX=30
```

**3. Redis Memory Full**
```bash
# Check memory
redis-cli INFO memory

# Configure eviction
maxmemory-policy allkeys-lru
```

**4. Slow AI Responses**
```bash
# Check timeout settings
AI_REQUEST_TIMEOUT_MS=120000  # 2 minutes
AI_MAX_RETRIES=3

# Enable tier escalation
ESCALATION_ENABLED=true
```

---

## Quick Commands

```bash
# View all service logs
docker-compose logs -f

# Restart specific service
docker-compose restart orchestrator

# Scale workers
docker-compose up -d --scale worker=4

# Database backup
docker-compose exec postgres pg_dump -U ros ros > backup.sql

# Redis flush (development only!)
docker-compose exec redis redis-cli FLUSHALL

# Full health check
./scripts/health-check.sh
```

---

*Last updated: January 2026*
