# Environment Variables Registry

> **Single source of truth** for all ResearchFlow environment configuration.
> Updated: 2026-01-20 | Version: 1.0

## Quick Reference

| Category | Service | Prefix |
|----------|---------|--------|
| Core | All | `DATABASE_*`, `REDIS_*` |
| AI Router | orchestrator/worker | `AI_*`, `ANTHROPIC_*`, `OPENAI_*` |
| PHI Safety | All | `PHI_*`, `GOVERNANCE_*` |
| Caching | ai-router/worker | `*_CACHE_*`, `LIT_CACHE_*` |
| Streaming | orchestrator/web | `AI_STREAMING_*`, `VITE_AI_STREAMING_*` |
| K8s/Scaling | infrastructure | `UVICORN_*`, HPA manifests |
| Observability | All | `LOG_*`, `SENTRY_*`, `DD_*` |

---

## Core Infrastructure

### Database
| Variable | Default | Service | Description | Security |
|----------|---------|---------|-------------|----------|
| `DATABASE_URL` | `postgresql://ros:ros@postgres:5432/ros` | orchestrator, worker | PostgreSQL connection string | **SECRET** - Never log |
| `POSTGRES_USER` | `ros` | postgres | Database user | SECRET |
| `POSTGRES_PASSWORD` | `ros` | postgres | Database password | **SECRET** |
| `POSTGRES_DB` | `ros` | postgres | Database name | - |

### Redis
| Variable | Default | Service | Description | Security |
|----------|---------|---------|-------------|----------|
| `REDIS_URL` | `redis://redis:6379` | orchestrator, ai-router | Redis connection URL | SECRET if auth |

---

## Service Configuration

### Orchestrator (Node.js)
| Variable | Default | Service | Description | Security |
|----------|---------|---------|-------------|----------|
| `NODE_ENV` | `development` | orchestrator | Environment mode | - |
| `PORT` | `3001` | orchestrator | HTTP listen port | - |
| `WORKER_URL` | `http://worker:8000` | orchestrator | Worker service URL for ROS proxy | - |
| `WORKER_CALLBACK_URL` | `http://worker:8000` | orchestrator | Worker callback URL | - |
| `ROS_PROXY_ENABLED` | `true` | orchestrator | Enable /api/ros/* proxy to worker | - |
| `ROS_PROXY_TIMEOUT_MS` | `120000` | orchestrator | Proxy request timeout | - |
| `JWT_SECRET` | - | orchestrator | JWT signing secret | **SECRET** |
| `SESSION_SECRET` | - | orchestrator | Session encryption key | **SECRET** |
| `JWT_EXPIRATION` | `24h` | orchestrator | JWT token expiry | - |

### Worker (Python/FastAPI)
| Variable | Default | Service | Description | Security |
|----------|---------|---------|-------------|----------|
| `PYTHONPATH` | `/app/src:/app` | worker | Python module path | - |
| `PYTHONUNBUFFERED` | `1` | worker | Disable output buffering | - |
| `UVICORN_WORKERS` | `1` | worker | Number of uvicorn worker processes | - |
| `UVICORN_HOST` | `0.0.0.0` | worker | Bind address | - |
| `UVICORN_PORT` | `8000` | worker | Bind port | - |
| `ARTIFACT_PATH` | `/data/artifacts` | worker | Artifact storage path | - |
| `LOG_PATH` | `/data/logs` | worker | Log file directory | - |
| `MANIFEST_PATH` | `/data/manifests` | worker | Manifest storage path | - |

---

## AI Integration

### AI Router
| Variable | Default | Service | Description | Security |
|----------|---------|---------|-------------|----------|
| `ANTHROPIC_API_KEY` | - | ai-router | Anthropic API key | **SECRET** |
| `OPENAI_API_KEY` | - | ai-router | OpenAI API key (embeddings) | **SECRET** |
| `AI_DEFAULT_TIER` | `MINI` | ai-router | Default model tier (MINI/STANDARD/ADVANCED) | - |
| `AI_ENABLE_PROMPT_CACHE` | `true` | ai-router | Enable prompt caching | - |
| `AI_CACHE_TTL_SECONDS` | `3600` | ai-router | Prompt cache TTL | - |
| `AI_DAILY_COST_LIMIT` | `100.00` | ai-router | Daily cost limit (USD) | - |
| `AI_PER_REQUEST_LIMIT` | `5.00` | ai-router | Per-request cost limit (USD) | - |

### AI Response Cache (Phase 04)
| Variable | Default | Service | Description | Security |
|----------|---------|---------|-------------|----------|
| `AI_RESPONSE_CACHE_ENABLED` | `true` | ai-router | Enable response caching | - |
| `AI_RESPONSE_CACHE_TTL_SECONDS` | `21600` | ai-router | Response cache TTL (6h) | - |
| `AI_RESPONSE_CACHE_BACKEND` | `memory` | ai-router | Cache backend (memory\|redis) | - |

### AI Streaming (Phase 07)
| Variable | Default | Service | Description | Security |
|----------|---------|---------|-------------|----------|
| `AI_STREAMING_ENABLED` | `false` | orchestrator | Enable SSE streaming endpoint | - |
| `AI_STREAMING_IDLE_TIMEOUT_MS` | `30000` | orchestrator | Streaming idle timeout | - |
| `VITE_AI_STREAMING_ENABLED` | `false` | web | Enable streaming UI | - |

---

## Caching (Phase 04)

### Literature Search Cache
| Variable | Default | Service | Description | Security |
|----------|---------|---------|-------------|----------|
| `LIT_CACHE_ENABLED` | `true` | worker | Enable literature search caching | - |
| `LIT_CACHE_TTL_SECONDS` | `86400` | worker | Literature cache TTL (24h) | - |
| `LIT_CACHE_MAXSIZE` | `1000` | worker | Max cache entries | - |
| `LITERATURE_CACHE_TTL_SECONDS` | `86400` | worker | (Legacy) Literature cache TTL | - |

### IRB Draft Cache
| Variable | Default | Service | Description | Security |
|----------|---------|---------|-------------|----------|
| `IRB_DRAFT_CACHE_ENABLED` | `false` | worker | Enable IRB draft caching | PHI-gated |

---

## PHI Safety & Governance

| Variable | Default | Service | Description | Security |
|----------|---------|---------|-------------|----------|
| `GOVERNANCE_MODE` | `DEMO` | all | DEMO=synthetic only, LIVE=PHI access | **CRITICAL** |
| `PHI_SCAN_ENABLED` | `true` | all | Enable PHI detection | - |
| `PHI_REVEAL_TOKEN_TTL_MINUTES` | `15` | orchestrator | PHI reveal token expiry | - |
| `PHI_AUDIT_RETENTION_DAYS` | `365` | orchestrator | Audit log retention | Compliance |

---

## Observability (Phase 08)

### Logging
| Variable | Default | Service | Description | Security |
|----------|---------|---------|-------------|----------|
| `LOG_LEVEL` | `info` | all | Log verbosity (debug\|info\|warn\|error) | - |
| `LOG_FORMAT` | `json` | all | Log format (json\|text) | - |
| `SQL_LOGGING` | `false` | orchestrator | Enable SQL query logging | Dev only |

### Metrics
| Variable | Default | Service | Description | Security |
|----------|---------|---------|-------------|----------|
| `METRICS_ENABLED` | `true` | worker, orchestrator | Enable /metrics endpoint | - |
| `METRICS_PORT` | `9090` | worker | Metrics server port | - |

### External Services
| Variable | Default | Service | Description | Security |
|----------|---------|---------|-------------|----------|
| `SENTRY_DSN` | - | all | Sentry error tracking DSN | SECRET |
| `DD_API_KEY` | - | all | DataDog API key | **SECRET** |
| `DD_SERVICE` | `researchflow` | all | DataDog service name | - |

---

## External Integrations

### Literature APIs (Phase C)
| Variable | Default | Service | Description | Security |
|----------|---------|---------|-------------|----------|
| `NCBI_API_KEY` | - | worker | PubMed E-utilities API key | SECRET |
| `NCBI_TOOL` | `researchflow` | worker | NCBI tool identifier | - |
| `NCBI_EMAIL` | - | worker | NCBI contact email | - |
| `SEMANTIC_SCHOLAR_API_KEY` | - | worker | Semantic Scholar API key | SECRET |

### Vector Database
| Variable | Default | Service | Description | Security |
|----------|---------|---------|-------------|----------|
| `CHROMA_PERSIST_DIR` | `/data/chroma` | worker | ChromaDB persistence directory | - |
| `EMBEDDINGS_PROVIDER` | `openai` | worker | Embeddings provider (openai\|local\|mock) | - |
| `EMBEDDINGS_MODEL` | `text-embedding-3-small` | worker | Embeddings model name | - |

### Cloud Storage
| Variable | Default | Service | Description | Security |
|----------|---------|---------|-------------|----------|
| `AWS_ACCESS_KEY_ID` | - | worker | AWS access key | **SECRET** |
| `AWS_SECRET_ACCESS_KEY` | - | worker | AWS secret key | **SECRET** |
| `AWS_S3_BUCKET` | `researchflow-artifacts` | worker | S3 bucket name | - |
| `AWS_REGION` | `us-east-1` | worker | AWS region | - |

---

## Feature Flags

### Core Features
| Variable | Default | Service | Description |
|----------|---------|---------|-------------|
| `FEATURE_BATCH_PROCESSING` | `true` | worker | Enable batch processing |
| `FEATURE_EVIDENCE_RETRIEVAL` | `true` | worker | Enable evidence retrieval |
| `FEATURE_AUTO_ESCALATION` | `true` | orchestrator | Enable auto-escalation |

### Heavy Components
| Variable | Default | Service | Description |
|----------|---------|---------|-------------|
| `OCR_ENABLED` | `false` | worker | Enable Tesseract OCR |
| `SCISPACY_ENABLED` | `false` | worker | Enable scispaCy NLP |
| `PROFILING_ENABLED` | `false` | worker | Enable ydata-profiling |
| `TRANSCRIPTION_ENABLED` | `false` | worker | Enable Whisper transcription |
| `DASK_ENABLED` | `false` | worker | Enable Dask parallelization |

### UI/UX Features (Phase F)
| Variable | Default | Service | Description |
|----------|---------|---------|-------------|
| `FEATURE_CUSTOM_FIELDS` | `false` | orchestrator | Custom form fields |
| `FEATURE_VOICE_COMMANDS` | `false` | orchestrator | Voice command UI |
| `FEATURE_XR_PREVIEW` | `false` | orchestrator | XR preview mode |
| `FEATURE_SEMANTIC_SEARCH` | `false` | orchestrator | Semantic search |
| `VITE_FEATURE_*` | `false` | web | Frontend feature flags |

---

## Development

| Variable | Default | Service | Description |
|----------|---------|---------|-------------|
| `HOT_RELOAD` | `true` | all | Enable hot reload |
| `MOCK_AI_RESPONSES` | `false` | ai-router | Mock AI responses |
| `MOCK_FHIR_CONNECTOR` | `true` | worker | Mock FHIR connector |

---

## Security Guidelines

### Secrets Management
1. **Never commit secrets** to git - use `.env` (gitignored)
2. **Use secret managers** in production (AWS Secrets Manager, Vault)
3. **Rotate secrets** regularly, especially API keys
4. **Audit secret access** via cloud provider logs

### PHI Safety Rules
1. **Never log** request/response bodies containing PHI
2. **Cache keys must be hashed** - never store prompts directly
3. **PHI-gated caching** - only cache when PHI scan passes
4. **Metrics labels must be PHI-free** - no patient identifiers

### Environment Isolation
```bash
# Production
GOVERNANCE_MODE=LIVE
NODE_ENV=production
LOG_LEVEL=warn

# Staging
GOVERNANCE_MODE=DEMO
NODE_ENV=staging
LOG_LEVEL=info

# Development
GOVERNANCE_MODE=DEMO
NODE_ENV=development
LOG_LEVEL=debug
```

---

## Adding New Variables

When adding new environment variables:

1. **Add to this registry** with default, service, description, and security level
2. **Add to `.env.example`** with documented default
3. **Add to relevant Dockerfile** if build-time
4. **Add to K8s ConfigMap/Secret** if k8s-deployed
5. **Update service code** to read with safe defaults
6. **Test with missing value** to ensure graceful fallback
