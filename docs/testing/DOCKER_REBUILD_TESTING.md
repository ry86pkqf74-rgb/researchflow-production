# Docker Clean Build & Integration Testing Guide

## Overview

This document provides step-by-step instructions for performing a clean Docker build and running comprehensive integration tests for the ResearchFlow platform, including the Guideline Engine and Planning Hub features.

## Prerequisites

- Docker Desktop installed and running
- Docker Compose v2.0+
- Node.js 18+ (for Playwright tests)
- Git access to the repository

## Quick Start

```bash
# 1. Clean environment
docker-compose down -v
docker system prune -f

# 2. Fresh build
docker-compose build --no-cache
docker-compose up -d

# 3. Verify services
docker-compose ps
curl http://localhost:3001/health
curl http://localhost:8000/health

# 4. Run tests
npx playwright test

# 5. View report
npx playwright show-report
```

## Detailed Phases

### Phase 1: Clean Docker Environment

```bash
# Stop all project containers
docker-compose down

# Remove project containers
docker-compose rm -f

# Remove project volumes (⚠️ DATA LOSS)
docker volume rm researchflow-production_postgres_data 2>/dev/null
docker volume rm researchflow-production_redis_data 2>/dev/null

# Remove project images (force rebuild)
docker rmi $(docker images -q --filter "reference=*researchflow*") 2>/dev/null

# Clear build cache
docker builder prune -f

# Verify clean state
docker ps -a | grep -E "researchflow|worker|orchestrator|web|redis|postgres"
```

### Phase 2: Update Dependencies

Check that these files have the required dependencies:

**services/worker/requirements.txt** should include:
- `redis>=5.0.0`
- `beautifulsoup4>=4.12.0`
- `lxml>=5.0.0`
- `PyMuPDF>=1.23.0`
- `aiohttp>=3.9.0`

**docker-compose.yml** should have:
- `redis` service with health check
- `guideline-engine` service on port 8001
- `REDIS_URL` environment variables

### Phase 3: Fresh Build

```bash
# Build all services with no cache
docker-compose build --no-cache

# Start infrastructure first
docker-compose up -d postgres redis

# Wait for healthy status
docker-compose exec -T postgres pg_isready -U ros -d ros
docker-compose exec -T redis redis-cli ping

# Start application services
docker-compose up -d worker orchestrator guideline-engine
sleep 10
docker-compose up -d web

# Verify all services running
docker-compose ps
```

### Phase 4: API Testing

```bash
# Health checks
curl -s http://localhost:3001/health | jq .
curl -s http://localhost:8000/health | jq .
curl -s http://localhost:8001/health | jq .

# Guideline Engine endpoints
curl -s "http://localhost:3001/api/guidelines/fields" | jq .
curl -s "http://localhost:3001/api/guidelines/sources" | jq .
curl -s "http://localhost:3001/api/guidelines/categories" | jq .
curl -s "http://localhost:3001/api/guidelines/process?query=tnm%20colorectal" | jq .
curl -s "http://localhost:3001/api/guidelines/process?query=clavien-dindo" | jq .

# Test caching
echo "First request (uncached):"
time curl -s "http://localhost:3001/api/guidelines/process?query=asa%20physical%20status" | jq '.from_cache'

echo "Second request (cached):"
time curl -s "http://localhost:3001/api/guidelines/process?query=asa%20physical%20status" | jq '.from_cache'

# Check Redis keys
docker-compose exec -T redis redis-cli keys "guideline:*"
```

### Phase 5: Playwright Tests

```bash
# Install Playwright browsers (if needed)
npx playwright install chromium

# Run all E2E tests
npx playwright test

# Run with UI mode
npx playwright test --ui

# Run specific test file
npx playwright test tests/e2e/guideline-engine.spec.ts

# Run with visible browser
npx playwright test --headed

# View HTML report
npx playwright show-report
```

### Phase 6: Browser Manual Testing

1. Open http://localhost:5173 in Chrome
2. Open DevTools (Cmd+Option+I / Ctrl+Shift+I)
3. Check Console for errors
4. Test in Console:

```javascript
// Test fields endpoint
fetch('http://localhost:3001/api/guidelines/fields')
  .then(r => r.json())
  .then(console.log);

// Test process endpoint
fetch('http://localhost:3001/api/guidelines/process?query=clavien-dindo')
  .then(r => r.json())
  .then(console.log);
```

## Verification Checklist

### Docker Status
- [ ] All containers running: `docker-compose ps`
- [ ] No restart loops
- [ ] No error logs: `docker-compose logs | grep -i error`

### Database
- [ ] Postgres accessible: `docker-compose exec postgres pg_isready`
- [ ] Tables created

### Redis
- [ ] Redis accessible: `docker-compose exec redis redis-cli ping`
- [ ] Cache keys created after queries

### API Endpoints
- [ ] `GET /health` → 200
- [ ] `GET /api/guidelines/fields` → 200 with data
- [ ] `GET /api/guidelines/sources` → 200 with 20+ sources
- [ ] `GET /api/guidelines/process?query=tnm` → 200 with parsed data
- [ ] Second query shows `from_cache: true`

### Frontend
- [ ] Page loads at http://localhost:5173
- [ ] No console errors
- [ ] No CORS errors

### Tests
- [ ] Playwright tests pass

## Troubleshooting

| Issue | Diagnose | Solution |
|-------|----------|----------|
| Container won't start | `docker-compose logs <service>` | Fix config/dependencies |
| Port in use | `lsof -i :3001` | Kill process or change port |
| Database connection | `docker-compose exec postgres pg_isready` | Wait for healthy |
| Redis connection | `docker-compose exec redis redis-cli ping` | Check REDIS_HOST |
| Build fails | `docker-compose build --no-cache <service>` | Check Dockerfile |
| Tests fail | `npx playwright test --debug` | Debug mode |
| CORS errors | Check orchestrator CORS config | Add frontend origin |
| 404 on API | Check route registration | Verify routes |
| Module not found | `docker-compose exec worker pip list` | Install package |

## Services Reference

| Service | Port | Health Check |
|---------|------|--------------|
| web | 5173 | http://localhost:5173 |
| orchestrator | 3001 | http://localhost:3001/health |
| worker | 8000 | http://localhost:8000/health |
| guideline-engine | 8001 | http://localhost:8001/health |
| postgres | 5432 | pg_isready |
| redis | 6379 | redis-cli ping |

## Environment Variables

Required in `.env`:
```bash
GOVERNANCE_MODE=DEMO  # or LIVE
DATABASE_URL=postgresql://ros:ros@postgres:5432/ros
REDIS_URL=redis://redis:6379
ANTHROPIC_API_KEY=sk-ant-...
JWT_SECRET=your-secret-here
```
