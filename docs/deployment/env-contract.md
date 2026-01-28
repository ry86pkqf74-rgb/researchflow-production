# ResearchFlow Environment Variable Contract

This document defines all environment variables, their purposes, defaults, and which services require them.

## Quick Reference

| Priority | Category | Count |
|----------|----------|-------|
| Required | Core Infrastructure | 8 |
| Required | Security | 3 |
| Recommended | AI/LLM | 4 |
| Optional | Features | 15+ |

---

## Core Infrastructure (Required)

### Database

| Variable | Default | Services | Description |
|----------|---------|----------|-------------|
| `DATABASE_URL` | - | orchestrator, worker, collab, guideline-engine | PostgreSQL connection string |
| `POSTGRES_USER` | ros | postgres, migrate | Database username |
| `POSTGRES_PASSWORD` | ros | postgres, migrate | Database password |
| `POSTGRES_DB` | ros | postgres, migrate | Database name |

**Format**: `postgresql://USER:PASSWORD@HOST:PORT/DATABASE`

### Cache

| Variable | Default | Services | Description |
|----------|---------|----------|-------------|
| `REDIS_URL` | - | orchestrator, worker, collab | Redis connection string |

**Format**: `redis://HOST:PORT`

### Service URLs

| Variable | Default | Services | Description |
|----------|---------|----------|-------------|
| `WORKER_URL` | http://worker:8000 | orchestrator | Worker service URL |
| `WORKER_CALLBACK_URL` | http://worker:8000 | orchestrator | Worker callback URL |
| `ORCHESTRATOR_URL` | http://orchestrator:3001 | worker | Orchestrator URL for worker |
| `GUIDELINE_ENGINE_URL` | http://guideline-engine:8001 | orchestrator | Guideline engine URL |
| `AI_ROUTER_URL` | http://orchestrator:3001/api/ai/extraction/generate | worker | AI router endpoint |

---

## Security (Required for Production)

### Authentication

| Variable | Default | Services | Description |
|----------|---------|----------|-------------|
| `JWT_SECRET` | development-secret | orchestrator, collab | JWT signing secret (CHANGE IN PROD) |
| `JWT_EXPIRES_IN` | 24h | orchestrator | Access token expiry |
| `JWT_REFRESH_EXPIRES_IN` | 7d | orchestrator | Refresh token expiry |
| `AUTH_ALLOW_STATELESS_JWT` | false (prod) / true (dev) | orchestrator | Allow stateless JWT |
| `ADMIN_EMAILS` | - | orchestrator | Comma-separated admin email list |

### PHI Protection

| Variable | Default | Services | Description |
|----------|---------|----------|-------------|
| `PHI_SCAN_ENABLED` | true | orchestrator, worker | Enable PHI scanning |
| `PHI_FAIL_CLOSED` | true | orchestrator, worker | Fail if PHI detected |
| `STRICT_PHI_ON_UPLOAD` | true | orchestrator, worker | Strict PHI checks on upload |

---

## AI/LLM Integration (Recommended)

### API Keys

| Variable | Default | Services | Description |
|----------|---------|----------|-------------|
| `OPENAI_API_KEY` | - | orchestrator, worker | OpenAI API key |
| `ANTHROPIC_API_KEY` | - | orchestrator, worker | Anthropic API key |
| `CLAUDE_API_KEY` | - | orchestrator, worker | Claude API key (alias) |

### Chat Agents

| Variable | Default | Services | Description |
|----------|---------|----------|-------------|
| `CHAT_AGENT_ENABLED` | true | orchestrator, worker | Enable chat agents |
| `CHAT_AGENT_MODEL` | gpt-4 | orchestrator, worker | Default chat model |
| `CHAT_AGENT_PROVIDER` | openai | orchestrator | Chat provider |

### LLM Processing

| Variable | Default | Services | Description |
|----------|---------|----------|-------------|
| `EXTRACTION_TIMEOUT_SECONDS` | 60 | worker | LLM extraction timeout |
| `ENRICHMENT_TIMEOUT_SECONDS` | 30 | worker | Data enrichment timeout |

---

## Literature Integration (Optional)

| Variable | Default | Services | Description |
|----------|---------|----------|-------------|
| `NCBI_API_KEY` | - | orchestrator | NCBI/PubMed API key |
| `SEMANTIC_SCHOLAR_API_KEY` | - | orchestrator | Semantic Scholar API key |
| `LITERATURE_CACHE_TTL` | 3600 | orchestrator | Literature cache TTL (seconds) |

---

## Governance & Mode

| Variable | Default | Services | Description |
|----------|---------|----------|-------------|
| `GOVERNANCE_MODE` | LIVE | orchestrator, worker, web | LIVE, DEMO, or STANDBY |
| `ROS_MODE` | - | orchestrator, worker, web | Overrides GOVERNANCE_MODE |
| `APP_MODE` | LIVE | collab | Collaboration mode |
| `NODE_ENV` | development | orchestrator, collab | Node environment |

### Safety Flags

| Variable | Default | Services | Description |
|----------|---------|----------|-------------|
| `NO_NETWORK` | false | orchestrator, worker | Disable network calls |
| `MOCK_ONLY` | false | orchestrator, worker | Use mock data only |
| `ALLOW_UPLOADS` | true | orchestrator, worker | Allow file uploads |

---

## Dashboard & UI

| Variable | Default | Services | Description |
|----------|---------|----------|-------------|
| `DASHBOARD_ENABLED` | true | orchestrator | Enable dashboard |
| `DASHBOARD_CALENDAR_INTEGRATION` | true | orchestrator | Enable calendar |
| `DASHBOARD_REFRESH_INTERVAL` | 5000 | orchestrator | Refresh interval (ms) |
| `NEXT_PUBLIC_ENABLE_CHAT_AGENTS` | true | web | Enable chat agents in UI |

---

## Data Processing

| Variable | Default | Services | Description |
|----------|---------|----------|-------------|
| `DATA_PARSE_STRICT` | true | worker | Strict data parsing |
| `DASK_ENABLED` | false | worker | Enable Dask for large data |

---

## Storage Paths

| Variable | Default | Services | Description |
|----------|---------|----------|-------------|
| `ARTIFACT_PATH` | /data/artifacts | worker | Artifact storage path |
| `ARTIFACTS_PATH` | /data/artifacts | worker | Alias for ARTIFACT_PATH |
| `LOG_PATH` | /data/logs | worker | Log storage path |
| `PROJECTS_PATH` | /data/projects | worker | Git projects path |

---

## Conference/Research Features

| Variable | Default | Services | Description |
|----------|---------|----------|-------------|
| `CONFERENCE_CACHE_TTL` | 86400 | worker | Conference data cache (seconds) |
| `ENABLE_WEB_SEARCH` | false | worker | Enable web search features |

---

## Production Scaling

| Variable | Default | Services | Description |
|----------|---------|----------|-------------|
| `UVICORN_WORKERS` | 1 (dev) / 2 (prod) | worker | Number of Uvicorn workers |

---

## Frontend Build Args

These are set at build time, not runtime:

| Variable | Default | Description |
|----------|---------|-------------|
| `VITE_API_BASE_URL` | - | API base URL |
| `VITE_WS_URL` | - | WebSocket URL |
| `VITE_COLLAB_URL` | - | Collaboration WebSocket URL |
| `VITE_SENTRY_DSN` | - | Sentry error tracking |
| `VITE_ENABLE_ANALYTICS` | false | Enable analytics |

---

## Service-Specific Requirements

### Orchestrator

**Required**:
- DATABASE_URL
- REDIS_URL
- JWT_SECRET (production)

**Recommended**:
- OPENAI_API_KEY or ANTHROPIC_API_KEY
- NCBI_API_KEY (for literature features)

### Worker

**Required**:
- DATABASE_URL
- REDIS_URL
- ORCHESTRATOR_URL

**Recommended**:
- OPENAI_API_KEY or ANTHROPIC_API_KEY
- AI_ROUTER_URL

### Web

**Required** (build-time):
- VITE_API_BASE_URL
- VITE_WS_URL

### Collab

**Required**:
- DATABASE_URL
- REDIS_URL
- JWT_SECRET

### Guideline Engine

**Required**:
- DATABASE_URL

**Recommended**:
- AI_ROUTER_URL

---

## Example .env for Production

```bash
# Core Infrastructure
DATABASE_URL=postgresql://ros:SECURE_PASSWORD@postgres:5432/ros
REDIS_URL=redis://redis:6379
POSTGRES_USER=ros
POSTGRES_PASSWORD=SECURE_PASSWORD
POSTGRES_DB=ros

# Security (CHANGE THESE!)
JWT_SECRET=your-secure-256-bit-secret-here
JWT_EXPIRES_IN=24h
JWT_REFRESH_EXPIRES_IN=7d
AUTH_ALLOW_STATELESS_JWT=false
ADMIN_EMAILS=admin@yourdomain.com

# AI/LLM
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...

# Literature
NCBI_API_KEY=your-ncbi-key
SEMANTIC_SCHOLAR_API_KEY=your-s2-key

# Mode
GOVERNANCE_MODE=LIVE
NODE_ENV=production

# PHI Protection
PHI_SCAN_ENABLED=true
PHI_FAIL_CLOSED=true

# Domain (for frontend build)
DOMAIN=app.yourdomain.com
```

---

## Validation Checklist

Before deploying to production:

- [ ] DATABASE_URL is set and accessible
- [ ] REDIS_URL is set and accessible
- [ ] JWT_SECRET is changed from default
- [ ] At least one AI API key is set (OPENAI or ANTHROPIC)
- [ ] PHI_SCAN_ENABLED=true for healthcare data
- [ ] GOVERNANCE_MODE=LIVE for production
- [ ] NODE_ENV=production for orchestrator/collab
- [ ] All service URLs use internal Docker network names
