# Docker Launch Plan - ResearchFlow Production

**Date:** January 26, 2026  
**Purpose:** Ensure Docker launches correctly with all services from a fresh build

---

## Prerequisites

### 1. Docker Desktop
- Install Docker Desktop from https://www.docker.com/products/docker-desktop
- Start Docker Desktop and wait for it to be ready (whale icon stops animating)

### 2. Environment Configuration
Create `.env` file in project root with required variables:

```env
# Required: AI API Keys (at least OpenAI)
OPENAI_API_KEY=sk-your-key-here
AI_INTEGRATIONS_OPENAI_API_KEY=sk-your-key-here

# Optional: Additional AI providers
ANTHROPIC_API_KEY=sk-ant-your-key-here
XAI_API_KEY=xai-your-key-here

# Required: Authentication
JWT_SECRET=your-secret-key-here
AUTH_ALLOW_STATELESS_JWT=true

# Required: Mode
GOVERNANCE_MODE=LIVE

# Required: Database
POSTGRES_USER=ros
POSTGRES_PASSWORD=ros
POSTGRES_DB=ros
DATABASE_URL=postgresql://ros:ros@localhost:5432/ros

# Required: Services
WORKER_URL=http://worker:8000
REDIS_URL=redis://redis:6379

# Environment
NODE_ENV=development
```

---

## Fresh Build Instructions

### Option 1: Quick Start (Recommended)
```bash
cd /Users/ros/Documents/GitHub/researchflow-production

# Clean start - removes old containers and volumes
docker compose down -v

# Build and start all services
docker compose up --build
```

### Option 2: Background Mode
```bash
# Start in detached mode
docker compose up -d --build

# View logs
docker compose logs -f
```

### Option 3: Using npm scripts
```bash
npm run dev        # Same as docker compose up
npm run dev:build  # Same as docker compose up --build
```

---

## Services & Ports

| Service | Port | Health Check | Description |
|---------|------|--------------|-------------|
| **web** | 5173 | http://localhost:5173 | Frontend (Vite) |
| **orchestrator** | 3001 | http://localhost:3001/health | API Server |
| **worker** | 8000 | http://localhost:8000/health | Python Worker |
| **collab** | 1234-1235 | Internal | Collaboration Service |
| **postgres** | 5432 | Internal | Database |
| **redis** | 6379 | Internal | Cache |

---

## Verify Services Are Running

```bash
# Check all containers
docker compose ps

# Expected output: All services should show "Up" and "healthy"
```

### Health Check Commands
```bash
# Frontend
curl -s http://localhost:5173 | head -5

# API Server
curl http://localhost:3001/health

# Worker (if exposed)
curl http://localhost:8000/health

# Mode check
curl http://localhost:3001/api/mode
```

---

## Test AI Functionality

```bash
# Test AI endpoint (should return real AI response)
curl -X POST http://localhost:3001/api/ai/research-brief \
  -H "Content-Type: application/json" \
  -d '{"topic":"impact of telemedicine on diabetes management"}'
```

Expected: JSON response with AI-generated research brief (not mock data).

---

## Troubleshooting

### Issue: "Cannot connect to Docker daemon"
```bash
# Start Docker Desktop application
open -a Docker
# Wait for it to fully start, then retry
```

### Issue: "Port already in use"
```bash
# Find what's using the port
lsof -i :3001
lsof -i :5173

# Kill the process or stop conflicting services
kill -9 <PID>
```

### Issue: "ERR_MODULE_NOT_FOUND: @researchflow/manuscript-engine"
```bash
# Rebuild without cache
docker compose down
docker compose build --no-cache orchestrator
docker compose up -d
```

### Issue: Orchestrator keeps restarting
```bash
# Check logs for errors
docker compose logs orchestrator --tail 50

# Common causes:
# 1. Missing package in Dockerfile - rebuild with --no-cache
# 2. Missing .env file - create from template above
# 3. Syntax error in code - check logs for specific error
```

### Issue: "OpenAI API key" error
```bash
# Verify .env has the key
cat .env | grep OPENAI

# Restart orchestrator to pick up new env vars
docker compose restart orchestrator
```

### Issue: Build fails completely
```bash
# Nuclear option - clean everything
docker compose down -v
docker system prune -f
docker compose up --build
```

---

## Dependencies & Package Structure

The orchestrator requires these workspace packages:

```
packages/
├── core/                 # Shared types and utilities
├── phi-engine/          # PHI detection
├── ai-router/           # AI provider routing
└── manuscript-engine/   # Manuscript generation (REQUIRED)
```

These are copied into the Docker container at build time. If you add new packages:

1. Add to `services/orchestrator/package.json`:
   ```json
   "@researchflow/new-package": "file:./packages/new-package"
   ```

2. Add COPY commands to `services/orchestrator/Dockerfile` (deps stage):
   ```dockerfile
   COPY packages/new-package/package.json ./packages/new-package/
   COPY packages/new-package/index.ts ./packages/new-package/
   COPY packages/new-package/src ./packages/new-package/src
   ```

3. Add to the symlink creation (development and production stages):
   ```dockerfile
   cp -r ./packages/new-package ./node_modules/@researchflow/new-package
   ```

---

## Quick Reference

```bash
# Start
docker compose up --build

# Stop
docker compose down

# Rebuild single service
docker compose up -d --build orchestrator

# View logs
docker compose logs -f orchestrator

# Shell into container
docker compose exec orchestrator sh

# Check env vars in container
docker compose exec orchestrator printenv | grep OPENAI
```

---

*Updated: January 26, 2026*
