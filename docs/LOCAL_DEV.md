# Local Development Guide

> Complete guide to setting up and running ResearchFlow locally

## Prerequisites

- **Docker** & Docker Compose (v2+)
- **Node.js** 20+ (for local development without Docker)
- **Python** 3.11+ (for worker development)
- **Make** (optional but recommended)
- **pnpm** (package manager)

## Quick Start (Docker)

```bash
# Clone repository
git clone https://github.com/ry86pkqf74-rgb/researchflow-production.git
cd researchflow-production

# Copy environment file
cp .env.example .env

# Start all services
docker-compose up

# Or with rebuild
docker-compose up --build
```

**Access Points:**
| Service | URL | Purpose |
|---------|-----|---------|
| Web UI | http://localhost:5173 | React frontend |
| Orchestrator API | http://localhost:3001 | Node.js API |
| Worker API | http://localhost:8000 | Python compute |
| PostgreSQL | localhost:5432 | Database |
| Redis | localhost:6379 | Cache/Queue |

## Development Without Docker

### 1. Database Setup

```bash
# Start only infrastructure
docker-compose up postgres redis -d

# Or use local PostgreSQL/Redis
createdb ros
```

### 2. Install Dependencies

```bash
# Install all packages (monorepo)
pnpm install

# Or per service
cd services/orchestrator && pnpm install
cd services/web && pnpm install
cd services/worker && pip install -r requirements.txt
```

### 3. Run Migrations

```bash
# Using orchestrator's migration tool
cd services/orchestrator
pnpm run migrate

# Or manually with psql
psql $DATABASE_URL -f migrations/0000_omniscient_emma_frost.sql
# ... repeat for each migration file in order
```

### 4. Start Services

**Terminal 1 - Orchestrator:**
```bash
cd services/orchestrator
pnpm run dev
# Runs on http://localhost:3001
```

**Terminal 2 - Web:**
```bash
cd services/web
pnpm run dev
# Runs on http://localhost:5173
```

**Terminal 3 - Worker:**
```bash
cd services/worker
python -m uvicorn src.main:app --reload --port 8000
# Runs on http://localhost:8000
```

**Terminal 4 - Collaboration (optional):**
```bash
cd services/collab
pnpm run dev
# Runs on http://localhost:3002
```

## Docker Compose Variants

| File | Purpose | Command |
|------|---------|---------|
| `docker-compose.yml` | Development (default) | `docker-compose up` |
| `docker-compose.prod.yml` | Production-like | `docker-compose -f docker-compose.prod.yml up` |
| `docker-compose.manuscript-test.yml` | Manuscript engine testing | `docker-compose -f docker-compose.manuscript-test.yml up` |
| `docker-compose.claude-integration.yml` | Claude AI integration | `docker-compose -f docker-compose.claude-integration.yml up` |

## Running Tests

### All Tests
```bash
make test
# Or
pnpm run test
```

### Unit Tests
```bash
# Orchestrator
cd services/orchestrator && pnpm run test

# Web
cd services/web && pnpm run test

# Worker
cd services/worker && pytest
```

### Integration Tests
```bash
# Requires running services
pnpm run test:integration
```

### End-to-End Tests (Playwright)
```bash
# Start services first
docker-compose up -d

# Run E2E tests
pnpm run test:e2e

# Or with UI
pnpm run test:e2e:ui
```

### Test Coverage
```bash
pnpm run test:coverage
```

## Common Development Tasks

### Reset Database

```bash
# Drop and recreate
docker-compose down -v
docker-compose up postgres -d
cd services/orchestrator && pnpm run migrate

# Or just seed fresh data
pnpm run db:seed
```

### Clear Redis Cache

```bash
docker-compose exec redis redis-cli FLUSHALL
```

### View Logs

```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f orchestrator
docker-compose logs -f worker
docker-compose logs -f web
```

### Rebuild Single Service

```bash
docker-compose up --build orchestrator
docker-compose up --build worker
```

### Run Linting

```bash
# All
pnpm run lint

# Fix issues
pnpm run lint:fix

# TypeScript check
pnpm run typecheck
```

## Environment Configuration

### Key Variables for Development

```bash
# Governance (use DEMO for safe development)
GOVERNANCE_MODE=DEMO

# Database
DATABASE_URL=postgresql://ros:ros@localhost:5432/ros

# Redis
REDIS_URL=redis://localhost:6379

# JWT (change in production!)
JWT_SECRET=dev-secret-change-me

# Feature flags for development
FEATURE_VOICE_COMMANDS=true
FEATURE_SEMANTIC_SEARCH=true

# Mock external services
MOCK_AI_RESPONSES=true
MOCK_FHIR_CONNECTOR=true
```

### Hot Reload

Hot reload is enabled by default in development:
- **Orchestrator**: Uses `ts-node-dev`
- **Web**: Uses Vite HMR
- **Worker**: Uses `uvicorn --reload`

## Troubleshooting

### Port Already in Use

```bash
# Find process
lsof -i :3001  # or 5173, 8000, etc.

# Kill process
kill -9 <PID>
```

### Database Connection Failed

```bash
# Check if PostgreSQL is running
docker-compose ps postgres

# Check connection
psql $DATABASE_URL -c "SELECT 1"

# Reset PostgreSQL volume
docker-compose down -v
docker-compose up postgres -d
```

### Node Memory Issues

```bash
# Increase Node.js memory
export NODE_OPTIONS="--max-old-space-size=4096"
pnpm run dev
```

### Python Import Errors

```bash
# Ensure PYTHONPATH is set
export PYTHONPATH=/path/to/services/worker/src

# Or use module syntax
cd services/worker
python -m src.main
```

### Migration Failures

```bash
# Check migration status
psql $DATABASE_URL -c "SELECT * FROM schema_migrations"

# Run specific migration
psql $DATABASE_URL -f migrations/XXXX_migration.sql

# Reset migrations (WARNING: deletes data)
psql $DATABASE_URL -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"
pnpm run migrate
```

### Redis Connection Issues

```bash
# Test Redis connection
redis-cli -h localhost -p 6379 PING

# Check if password required
redis-cli -h localhost -p 6379 -a yourpassword PING
```

### WebSocket Connection Failed

```bash
# Check if collab service is running
curl http://localhost:3002/health

# Check WebSocket URL in .env
NEXT_PUBLIC_WS_URL=ws://localhost:3002
```

## IDE Setup

### VS Code

Recommended extensions:
- ESLint
- Prettier
- TypeScript Vue Plugin (Volar)
- Python
- Docker

Settings (`.vscode/settings.json`):
```json
{
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "typescript.tsdk": "node_modules/typescript/lib",
  "python.defaultInterpreterPath": "./services/worker/.venv/bin/python"
}
```

### JetBrains (WebStorm/PyCharm)

- Enable ESLint integration
- Set Node.js interpreter
- Configure Python interpreter for worker
- Enable Docker integration

## Debugging

### Node.js (Orchestrator)

```bash
# Debug mode
NODE_OPTIONS='--inspect' pnpm run dev

# Then attach debugger to localhost:9229
```

### Python (Worker)

```bash
# Using debugpy
pip install debugpy
python -m debugpy --listen 5678 --wait-for-client -m uvicorn src.main:app
```

### Browser (Web)

- Use React Developer Tools
- Use Redux DevTools (for Zustand)
- Network tab for API debugging

## Performance Profiling

### Node.js

```bash
# Generate profile
NODE_OPTIONS='--prof' pnpm run dev
# Process profile
node --prof-process isolate-*.log > profile.txt
```

### Python

```bash
# Using cProfile
python -m cProfile -o profile.prof src/main.py
# Visualize
pip install snakeviz
snakeviz profile.prof
```

## Related Documentation

- [Architecture Overview](./ARCHITECTURE_OVERVIEW.md)
- [Stages Map](./STAGES_MAP.md)
- [Testing Guide](./TESTING.md)
- [Deployment Guide](./DEPLOYMENT.md)
