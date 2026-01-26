# Docker Launch Plan - ResearchFlow Production

**Date:** January 26, 2026  
**Purpose:** Ensure Docker launches correctly with all services

---

## Pre-Launch Checklist

### 1. Verify Environment Configuration
```bash
cd /Users/ros/Documents/GitHub/researchflow-production

# Check .env exists and has API keys
cat .env | grep -E "OPENAI|ANTHROPIC|GOVERNANCE"

# Expected output should show API keys configured
```

### 2. Verify Docker Desktop is Running
- Open **Docker Desktop** application on Mac
- Wait for the whale icon to stop animating (indicates ready)
- Verify in menu bar: Docker Desktop is running

### 3. Check Docker from Terminal
```bash
# Verify Docker is accessible
docker --version
docker compose version

# Check no conflicting containers
docker ps -a
```

---

## Launch Sequence

### Step 1: Clean Start (Recommended)
```bash
cd /Users/ros/Documents/GitHub/researchflow-production

# Remove any old containers/volumes (optional, for clean start)
docker compose down -v

# Build and start all services
docker compose up --build
```

### Step 2: Alternative - Background Start
```bash
# Start in detached mode
docker compose up -d --build

# View logs
docker compose logs -f
```

### Step 3: Using npm scripts
```bash
# Development mode
npm run dev

# Or with rebuild
npm run dev:build
```

---

## Services Expected to Start

| Service | Port | Health Check |
|---------|------|--------------|
| **web** (Frontend) | 3000 | http://localhost:3000 |
| **orchestrator** (API) | 3001 | http://localhost:3001/health |
| **worker** (Python) | 8000 | http://localhost:8000/health |
| **postgres** (Database) | 5432 | Internal |
| **redis** (Cache) | 6379 | Internal |

---

## Health Verification Commands

```bash
# Check all containers running
docker compose ps

# Test frontend
curl -s http://localhost:3000 | head -20

# Test orchestrator health
curl http://localhost:3001/health

# Test worker health
curl http://localhost:8000/health

# Check orchestrator logs for API key
docker compose logs orchestrator | grep -i "openai\|api key"
```

---

## Troubleshooting

### Issue: "Cannot connect to Docker daemon"
**Fix:** Start Docker Desktop application

### Issue: Port already in use
```bash
# Find what's using the port
lsof -i :3000
lsof -i :3001

# Kill the process or change port in docker-compose.yml
```

### Issue: Build fails
```bash
# Clean rebuild
docker compose down
docker system prune -f
docker compose up --build
```

### Issue: Database connection fails
```bash
# Check postgres is running
docker compose logs postgres

# Restart just postgres
docker compose restart postgres
```

### Issue: API key not loaded
```bash
# Verify .env is in project root
ls -la .env

# Check env vars in container
docker compose exec orchestrator printenv | grep OPENAI
```

---

## Post-Launch Verification

1. **Frontend loads:** http://localhost:3000
2. **Can log in:** Use admin credentials
3. **API responds:** http://localhost:3001/health returns OK
4. **Worker responds:** http://localhost:8000/health returns OK
5. **AI works:** Test an AI endpoint (see Webpage Evaluation Plan)

---

## Quick Start Command

```bash
# One-liner to start everything
cd /Users/ros/Documents/GitHub/researchflow-production && docker compose up --build
```

---

*Plan Created: January 26, 2026*
