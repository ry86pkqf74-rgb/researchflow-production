# Docker Deployment Guide

This guide covers deploying ResearchFlow using Docker for both development and production environments.

## Prerequisites

- Docker Engine 24.0+
- Docker Compose 2.20+
- 8GB RAM minimum (16GB recommended for production)
- 20GB disk space

## Quick Start (Development)

1. **Clone the repository:**
   ```bash
   git clone https://github.com/ry86pkqf74-rgb/researchflow-production.git
   cd researchflow-production
   ```

2. **Configure environment:**
   ```bash
   cp .env.example .env
   # Edit .env with your API keys (ANTHROPIC_API_KEY, OPENAI_API_KEY)
   ```

3. **Start the stack:**
   ```bash
   docker-compose up -d
   ```

4. **Access the application:**
   - Web UI: http://localhost:5173
   - API: http://localhost:3001/api/health
   - Collab: http://localhost:1234/health

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    Docker Network (researchflow)            │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────┐     ┌──────────────┐     ┌─────────┐          │
│  │   Web   │────▶│ Orchestrator │────▶│ Worker  │          │
│  │ (Nginx) │     │   (Node.js)  │     │(Python) │          │
│  └────┬────┘     └──────┬───────┘     └────┬────┘          │
│       │                 │                   │               │
│       │          ┌──────┴───────┐          │               │
│       │          │    Collab    │          │               │
│       │          │  (Yjs/WS)    │          │               │
│       │          └──────────────┘          │               │
│       │                 │                   │               │
│       ▼                 ▼                   ▼               │
│  ┌─────────┐     ┌──────────────┐     ┌─────────┐          │
│  │  Redis  │     │  PostgreSQL  │     │ Shared  │          │
│  │ (Cache) │     │     (DB)     │     │  Data   │          │
│  └─────────┘     └──────────────┘     └─────────┘          │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## Services

| Service | Port | Description |
|---------|------|-------------|
| web | 5173 (dev), 80 (prod) | React frontend served by Nginx |
| orchestrator | 3001 | Node.js API orchestrator |
| worker | 8000 (internal) | Python FastAPI compute service |
| collab | 1234 | Yjs real-time collaboration server |
| postgres | 5432 | PostgreSQL database |
| redis | 6379 | Redis cache |

## Development Mode

Development mode includes:
- Hot-reload via volume mounts
- Source code mounted into containers
- Debug logging enabled
- All ports exposed to host

```bash
# Start all services
docker-compose up -d

# View logs
docker-compose logs -f

# View specific service logs
docker-compose logs -f orchestrator

# Rebuild after code changes
docker-compose build orchestrator
docker-compose up -d orchestrator

# Stop all services
docker-compose down

# Stop and remove volumes (clean slate)
docker-compose down -v
```

## Production Mode

Production mode includes:
- Nginx reverse proxy with SSL support
- Production build targets
- Resource limits
- No source code mounts
- Health-based dependency ordering

### Setup

1. **Configure environment:**
   ```bash
   cp .env.example .env
   # Edit .env with production values:
   # - Strong database credentials
   # - Secure JWT_SECRET (use: openssl rand -base64 32)
   # - API keys
   # - GOVERNANCE_MODE=LIVE (if needed)
   ```

2. **Configure SSL (optional):**
   ```bash
   # Place certificates in:
   # infrastructure/docker/nginx/ssl/cert.pem
   # infrastructure/docker/nginx/ssl/key.pem
   ```

3. **Build and start:**
   ```bash
   docker-compose -f docker-compose.prod.yml build
   docker-compose -f docker-compose.prod.yml up -d
   ```

4. **Verify:**
   ```bash
   # Check all services are healthy
   docker-compose -f docker-compose.prod.yml ps

   # Test health endpoints
   curl http://localhost/api/health
   ```

## Environment Variables

### Required for Production

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string |
| `REDIS_URL` | Redis connection string |
| `JWT_SECRET` | Secret for JWT tokens (use strong random value) |
| `ANTHROPIC_API_KEY` | Anthropic API key for AI features |

### Optional

| Variable | Default | Description |
|----------|---------|-------------|
| `GOVERNANCE_MODE` | `DEMO` | `DEMO` or `LIVE` mode |
| `OPENAI_API_KEY` | - | For embeddings |
| `UVICORN_WORKERS` | `1` | Worker processes for Python service |

See `.env.example` for complete list.

## Building Images

### Development Build

```bash
# Build all services
docker-compose build

# Build specific service
docker-compose build orchestrator
```

### Production Build

```bash
# Build with production target
docker-compose -f docker-compose.prod.yml build

# Build specific service
docker-compose -f docker-compose.prod.yml build orchestrator
```

### Multi-Architecture Build

For building images that work on both AMD64 and ARM64:

```bash
docker buildx build --platform linux/amd64,linux/arm64 \
  -f services/orchestrator/Dockerfile \
  --target production \
  -t ghcr.io/your-org/orchestrator:latest \
  --push .
```

## Resource Requirements

### Development

| Service | CPU | Memory |
|---------|-----|--------|
| orchestrator | 0.5 | 512MB |
| worker | 1.0 | 2GB |
| web | 0.25 | 128MB |
| collab | 0.25 | 256MB |
| postgres | 0.5 | 512MB |
| redis | 0.25 | 256MB |
| **Total** | **2.75** | **3.5GB** |

### Production

| Service | CPU Limit | Memory Limit |
|---------|-----------|--------------|
| orchestrator | 2 | 2GB |
| worker | 4 | 8GB |
| web | 0.5 | 256MB |
| collab | 1 | 512MB |
| postgres | 2 | 4GB |
| redis | 1 | 1GB |
| **Total** | **10.5** | **15.75GB** |

## Troubleshooting

### Container Exits Immediately

```bash
# Check logs
docker-compose logs orchestrator

# Common causes:
# - Missing environment variables
# - Database not ready
# - Invalid configuration
```

### Database Connection Errors

Services wait for database health before starting. If issues persist:

```bash
# Check PostgreSQL is healthy
docker-compose exec postgres pg_isready -U ros

# Restart orchestrator after DB is ready
docker-compose restart orchestrator
```

### Permission Issues

All production containers run as non-root users. If you see permission errors:

```bash
# Check container user
docker-compose exec orchestrator whoami  # Should be: nodejs

# Fix volume permissions
sudo chown -R 1001:1001 ./data
```

### Health Check Failures

```bash
# Check health status
docker inspect --format='{{.State.Health.Status}}' researchflow-orchestrator-1

# View health check logs
docker inspect --format='{{json .State.Health}}' researchflow-orchestrator-1 | jq
```

## Security Considerations

1. **Non-root containers**: All production images run as non-root users
2. **No secrets in images**: All secrets via environment variables
3. **Health checks**: All services have health endpoints
4. **Network isolation**: Services communicate via internal Docker network
5. **Resource limits**: Production compose includes CPU/memory limits

## Backup and Recovery

### Database Backup

```bash
# Backup
docker-compose exec postgres pg_dump -U ros ros > backup.sql

# Restore
cat backup.sql | docker-compose exec -T postgres psql -U ros ros
```

### Volume Backup

```bash
# Stop services
docker-compose down

# Backup volumes
docker run --rm -v researchflow_postgres-data:/data -v $(pwd):/backup \
  alpine tar czf /backup/postgres-backup.tar.gz /data

# Restore
docker run --rm -v researchflow_postgres-data:/data -v $(pwd):/backup \
  alpine tar xzf /backup/postgres-backup.tar.gz -C /
```

## Upgrading

```bash
# Pull latest code
git pull

# Rebuild images
docker-compose -f docker-compose.prod.yml build

# Restart with new images
docker-compose -f docker-compose.prod.yml up -d

# Verify health
docker-compose -f docker-compose.prod.yml ps
```

## Related Documentation

- [Environment Variables](../configuration/env-vars.md)
- [Kubernetes Deployment](./kubernetes-guide.md)
- [CI/CD Pipeline](.github/workflows/build-images.yml)
