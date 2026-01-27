# ResearchFlow Production Deployment Checklist

This checklist covers pre-deployment verification for production environments.

**Last Updated:** 2026-01-27
**Version:** v1.1.0-production-fixes

---

## Pre-Deployment Checks

### 1. Environment Variables

Verify all required environment variables are configured in `.env`:

#### Required - Core Services
- [ ] `DATABASE_URL` - PostgreSQL connection string
- [ ] `REDIS_URL` - Redis connection string
- [ ] `JWT_SECRET` - JWT signing secret (min 32 chars)
- [ ] `POSTGRES_USER` - PostgreSQL username
- [ ] `POSTGRES_PASSWORD` - PostgreSQL password
- [ ] `POSTGRES_DB` - PostgreSQL database name

#### Required - AI Services
- [ ] `ANTHROPIC_API_KEY` - Anthropic Claude API key
- [ ] `OPENAI_API_KEY` - OpenAI API key (optional if only using Claude)

#### Required - Frontend Build
- [ ] `DOMAIN` - Production domain (e.g., researchflow.example.com)
- [ ] `VITE_SENTRY_DSN` - Sentry DSN for error tracking (optional)
- [ ] `VITE_ENABLE_ANALYTICS` - Analytics toggle (true/false)

#### Mode Configuration
- [ ] `GOVERNANCE_MODE` - Set to `LIVE` for production
- [ ] `ROS_MODE` - Optional override for governance mode
- [ ] `APP_MODE` - Collab service mode (`LIVE` for production)

### 2. Database Preparation

- [ ] PostgreSQL 16+ is running and accessible
- [ ] Database user has required permissions
- [ ] Run `docker-compose -f docker-compose.prod.yml config` to validate
- [ ] Verify migrations will run before services start

### 3. Infrastructure Verification

#### Nginx Configuration
- [ ] SSL certificates are valid and in `infrastructure/docker/nginx/ssl/`
- [ ] `nginx.conf` has `/collab` WebSocket proxy location
- [ ] `/api` proxy location points to orchestrator:3001
- [ ] Health endpoint `/health` is configured

#### Network
- [ ] Ports 80 and 443 are accessible
- [ ] Internal Docker network `researchflow` is configured
- [ ] DNS points to production server

### 4. Service Health Checks

After deployment, verify each service:

#### Orchestrator
- [ ] `curl http://localhost:3001/health` returns 200
- [ ] `/api/health` endpoint accessible via nginx

#### Worker
- [ ] `curl http://localhost:8000/health` returns 200
- [ ] Worker can reach orchestrator

#### Collab
- [ ] `curl http://localhost:1235/health` returns 200 (health port)
- [ ] WebSocket connection works at `/collab`
- [ ] Persistence adapter shows healthy

#### Web
- [ ] `curl http://localhost:80/health` returns 200
- [ ] Frontend loads correctly via nginx
- [ ] VITE_* environment variables are baked in

#### Redis
- [ ] `redis-cli ping` returns PONG
- [ ] Workflow state service can connect

#### PostgreSQL
- [ ] All migrations have run (check migrate service logs)
- [ ] Required tables exist

---

## Deployment Steps

### 1. Pull Latest Code
```bash
git pull origin main
```

### 2. Build and Start Services
```bash
# Build fresh images
docker-compose -f docker-compose.prod.yml build --no-cache

# Start with proper order
docker-compose -f docker-compose.prod.yml up -d
```

### 3. Verify Migrations
```bash
# Check migrate service completed
docker-compose -f docker-compose.prod.yml logs migrate
# Should show "Migrations complete"
```

### 4. Verify All Services Healthy
```bash
# Check service status
docker-compose -f docker-compose.prod.yml ps

# Check health endpoints
curl http://localhost:3001/health  # orchestrator
curl http://localhost:8000/health  # worker
curl http://localhost:1235/health  # collab (health port)
curl http://localhost/health       # nginx/web
```

### 5. Smoke Test
- [ ] Login to application
- [ ] Create new project
- [ ] Upload test file (verify PHI scan)
- [ ] Open collaborative editor (verify WebSocket)
- [ ] Check workflow stage navigation

---

## Rollback Procedure

If issues are detected:

### Quick Rollback
```bash
# Stop services
docker-compose -f docker-compose.prod.yml down

# Revert to previous image tag
docker-compose -f docker-compose.prod.yml pull [previous-tag]
docker-compose -f docker-compose.prod.yml up -d
```

### Database Rollback
```bash
# If migrations need to be reverted
# Check migrations/README.md for rollback scripts
```

---

## Post-Deployment Monitoring

### Key Metrics to Watch
- [ ] Response times on `/api/*` endpoints
- [ ] WebSocket connection count
- [ ] Memory usage on orchestrator and worker
- [ ] Redis connection pool usage
- [ ] PostgreSQL connection count

### Log Locations
- Orchestrator: `docker-compose logs orchestrator`
- Worker: `docker-compose logs worker`
- Collab: `docker-compose logs collab`
- Nginx: `docker-compose logs nginx`

---

## Known Issues

### Workflow State Redis
- First request after restart may have brief delay while Redis state loads
- Memory fallback ensures service continues if Redis is temporarily unavailable

### PHI Scanner
- Location-only reporting means clients don't receive actual PHI values
- Use row/column coordinates to locate PHI in source documents

---

## Support

For deployment issues:
1. Check service logs: `docker-compose -f docker-compose.prod.yml logs [service]`
2. Verify environment variables: `docker-compose -f docker-compose.prod.yml config`
3. Check GitHub issues for known problems
