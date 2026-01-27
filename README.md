# ResearchFlow Production

[![CI](https://github.com/ry86pkqf74-rgb/researchflow-production/actions/workflows/ci.yml/badge.svg)](https://github.com/ry86pkqf74-rgb/researchflow-production/actions/workflows/ci.yml)
[![Security Scan](https://github.com/ry86pkqf74-rgb/researchflow-production/actions/workflows/security-scan.yaml/badge.svg)](https://github.com/ry86pkqf74-rgb/researchflow-production/actions/workflows/security-scan.yaml)
[![Documentation](https://img.shields.io/badge/docs-GitHub%20Pages-blue)](https://ry86pkqf74-rgb.github.io/researchflow-production/)
[![Binder](https://mybinder.org/badge_logo.svg)](https://mybinder.org/v2/gh/ry86pkqf74-rgb/researchflow-production/HEAD?labpath=notebooks%2Fdemo.ipynb)
[![Open In Colab](https://colab.research.google.com/assets/colab-badge.svg)](https://colab.research.google.com/github/ry86pkqf74-rgb/researchflow-production/blob/main/notebooks/demo.ipynb)

Docker-first deployment architecture for ResearchFlow with clean Node.js/Python separation.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         CLIENTS                                  │
│                    (Web UI / API Consumers)                      │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                    NODE.JS ORCHESTRATOR                          │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐           │
│  │   Auth   │ │   RBAC   │ │  Upload  │ │ Job Queue│           │
│  │  Service │ │  Service │ │  + PHI   │ │  + Status│           │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘           │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐                        │
│  │ AI Router│ │  Artifact│ │  Audit   │                        │
│  │ (no PHI) │ │  Browser │ │  Logger  │                        │
│  └──────────┘ └──────────┘ └──────────┘                        │
└─────────────────────────────────────────────────────────────────┘
                                │
                    Job Specs (JSON) │ Status Polling
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                    PYTHON COMPUTE WORKER                         │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐           │
│  │  Data    │ │ 20-Stage │ │  Figure  │ │ Artifact │           │
│  │Validation│ │ Workflow │ │  + Table │ │ + Manifest│          │
│  │ (Pandera)│ │  Engine  │ │   Gen    │ │   Writer │           │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘           │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                    SHARED STORAGE                                │
│     /data/artifacts/    /data/manifests/    /data/logs/         │
└─────────────────────────────────────────────────────────────────┘
```

## Quick Start

### Prerequisites

- Docker & Docker Compose v2.20+
- Node.js 20+ (for local development)
- Python 3.11+ (for local development)
- Make (optional, for convenience commands)

### Development Setup

```bash
# 1. Clone the repository
git clone https://github.com/ry86pkqf74-rgb/researchflow-production.git
cd researchflow-production

# 2. Copy environment file and configure
cp .env.example .env
# Edit .env with your API keys (see Configuration section)

# 3. Start all services with Docker Compose
docker compose up -d

# 4. Wait for migrations to complete (check logs)
docker compose logs migrate -f

# 5. Verify services are running
docker compose ps
```

Access the application:
- **Web UI**: http://localhost:5173
- **API**: http://localhost:3001
- **Worker API**: http://localhost:8000
- **API Docs**: http://localhost:3001/api-docs

### Run Migrations (if needed)

```bash
# All migrations run automatically via docker compose
# To manually run specific migrations:
docker compose exec postgres psql -U ros -d ros -f /migrations/006_paper_library.sql
```

### Verify Installation

```bash
# Check all services
curl http://localhost:3001/health
curl http://localhost:8000/health

# Test authentication
curl -X POST http://localhost:3001/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"testpass123"}'
```

### Available Commands

```bash
make help            # Show all available commands
make dev             # Start development environment
make dev-build       # Rebuild and start
make test            # Run all tests
make lint            # Run linters
make build           # Build production images
```

## Project Structure

```
researchflow-production/
├── services/
│   ├── orchestrator/     # Node.js API (auth, RBAC, job queue, AI routing)
│   ├── worker/           # Python compute (validation, analysis, 20-stage workflow)
│   └── web/              # React frontend
├── packages/
│   ├── core/             # Shared TypeScript types and schemas
│   ├── ai-router/        # AI model routing with cost optimization
│   └── phi-engine/       # PHI detection and scrubbing
├── shared/
│   ├── schemas/          # JSON schemas for job specs
│   └── contracts/        # OpenAPI contracts
├── infrastructure/
│   ├── docker/           # Docker configurations
│   └── kubernetes/       # K8s manifests with Kustomize overlays
├── tests/                # Test suites
└── scripts/              # Deployment and utility scripts
```

## Services

### Orchestrator (Node.js)

The orchestrator handles:
- Authentication and authorization (JWT, RBAC)
- File uploads with PHI scanning
- Job queue management (Redis/BullMQ)
- AI model routing (NANO/MINI/FRONTIER tiers)
- Artifact browsing and delivery
- Audit logging

### Worker (Python)

The worker handles:
- Data validation (Pandera schemas)
- 20-stage research workflow execution (with optional conference prep)
- Statistical analysis and QC
- Figure and table generation
- Artifact creation with manifest tracking
- Conference material generation (posters, slides, export bundles)

### Web (React)

React-based frontend with:
- Research project management
- Workflow visualization
- Artifact browser
- Real-time job status updates

## Configuration

### Environment Variables

Copy `.env.example` to `.env` and configure:

```bash
# Governance
GOVERNANCE_MODE=DEMO        # DEMO or LIVE

# Database
DATABASE_URL=postgresql://ros:ros@postgres:5432/ros

# Redis
REDIS_URL=redis://redis:6379

# AI Integration
ANTHROPIC_API_KEY=sk-ant-...

# Security
JWT_SECRET=your-secret-key
```

## Deployment

### Docker Compose (Development/Staging)

```bash
# Development
docker-compose up

# Production-like
docker-compose -f docker-compose.prod.yml up
```

### Kubernetes

```bash
# Development overlay
kubectl apply -k infrastructure/kubernetes/overlays/dev

# Staging
kubectl apply -k infrastructure/kubernetes/overlays/staging

# Production
kubectl apply -k infrastructure/kubernetes/overlays/production
```

### CI/CD

GitHub Actions workflows handle:
- **CI**: Linting, testing, security scanning
- **Build**: Multi-arch Docker image builds
- **Deploy Staging**: Automatic on `develop` branch
- **Deploy Production**: Manual approval required, automatic rollback on failure

## Testing

```bash
# All tests
make test

# Unit tests only
make test-unit

# Integration tests
make test-integration

# E2E tests
make test-e2e

# With coverage
make test-coverage
```

## Stage 20: Conference Preparation

Stage 20 is an optional workflow stage that automates conference submission material generation:

### Features

- **Conference Discovery**: Automatically find relevant conferences based on research keywords and preferences
- **Guideline Extraction**: Parse submission requirements (word limits, poster dimensions, slide counts)
- **Material Generation**: Create conference-ready materials:
  - Abstracts (formatted to word limits)
  - Poster PDFs (compliant with dimension requirements)
  - Presentation slides (PPTX format)
  - Compliance checklists
- **Validation & Export**: QC checks and bundled ZIP exports ready for submission

### Usage

Enable conference prep in your job spec:

```json
{
  "enable_conference_prep": true,
  "conference_prep": {
    "keywords": ["surgery", "endocrinology", "thyroid"],
    "field": "endocrinology",
    "year_range": [2026, 2027],
    "location_preferences": ["North America", "Europe"],
    "formats": ["poster", "oral"],
    "max_candidates": 10,
    "selected_conferences": ["SAGES Annual Meeting", "ACS"]
  }
}
```

### PHI Protection

Stage 20 enforces strict PHI protection:
- All query keywords are scanned for PHI before external searches
- Generated materials pass PHI redaction checks before export
- Conference discovery uses only public, non-sensitive metadata
- Offline/DEMO mode uses curated fixture data (no external calls)

### Output Structure

```
.tmp/conference_prep/{run_id}/
├── discovery/conference_candidates.json
├── guidelines/guidelines_{conference}.json
├── materials/{conference}/{format}/
│   ├── abstract.txt
│   ├── poster.pdf
│   └── slides.pptx
├── validation/validation_report_{conference}_{format}.json
└── bundles/export_bundle_{conference}_{format}.zip
```

## Authentication & Authorization

ResearchFlow uses JWT-based authentication with role-based access control (RBAC).

### Modes

| Mode | Authentication | Features | Data |
|------|---------------|----------|------|
| **Demo Mode** | Optional | Limited features | Mock data |
| **Live Mode** | Required | Full features | Real data |

### User Roles

| Role | Level | Permissions |
|------|-------|-------------|
| VIEWER | 1 | Read-only access |
| RESEARCHER | 2 | Create, analyze, export |
| STEWARD | 3 | Approve workflows, data export |
| ADMIN | 4 | Full system access |

### Authentication Flow

```bash
# 1. Register
curl -X POST http://localhost:3001/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"securepass123"}'

# 2. Login (returns JWT)
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"securepass123"}'

# 3. Use token for API calls
curl -H "Authorization: Bearer <token>" \
  http://localhost:3001/api/papers
```

### Protected Endpoints

| Endpoint | Required Permission |
|----------|-------------------|
| `/api/analysis/*` | ANALYZE |
| `/api/governance/approve` | STEWARD role |
| `/api/ros/export/data` | STEWARD role |
| `/api/admin/*` | ADMIN role |

### Environment Variables

```bash
JWT_SECRET=<secure-random-key>      # Required in production
JWT_EXPIRES_IN=24h                   # Token expiry
AUTH_ALLOW_STATELESS_JWT=false      # Set false in production
ADMIN_EMAILS=admin@example.com      # Comma-separated admin emails
```

## Governance

ResearchFlow implements strict PHI governance:

- **DEMO Mode**: PHI reveal blocked, synthetic data only
- **LIVE Mode**: PHI access requires approval, full audit trail

All AI interactions are routed through the AI Router which:
- Scans inputs/outputs for PHI
- Routes to appropriate model tier based on task complexity
- Maintains full audit trail of AI invocations
- Implements cost optimization with automatic escalation

## Implementation Status (Evidence-Based)

Full audit available in:
- [docs/audit/GAP_MATRIX.md](docs/audit/GAP_MATRIX.md)
- [docs/audit/SERVICE_INVENTORY.md](docs/audit/SERVICE_INVENTORY.md)
- [docs/audit/REPO_STRUCTURE.md](docs/audit/REPO_STRUCTURE.md)
- [CHECKPOINT_SUMMARY.md](CHECKPOINT_SUMMARY.md)

### Track A: Production Activation ✅

| Phase | Description | Status |
|-------|-------------|--------|
| 1-9 | Migration runner, healthchecks, WebSocket, Redis persistence | ✅ Complete |

### Track M: Manuscript Studio ✅

| Phase | Description | Status |
|-------|-------------|--------|
| M0-M8 | Canonical API, Yjs persistence, Comments, AI Refine, PHI gating | ✅ Complete |

### Track B: SciSpace Parity ✅

| Phase | Feature | API Endpoint | Status |
|-------|---------|--------------|--------|
| 10 | Paper Library & PDF Ingestion | `/api/papers` | ✅ |
| 11 | PDF Viewer with Annotations | `/api/papers/:id/annotations` | ✅ |
| 12 | AI Copilot for PDFs (RAG) | `/api/papers/:id/copilot` | ✅ |
| 13 | Literature Review Workspace | `/api/collections`, `/api/notes` | ✅ |
| 14 | Citation Manager (CSL) | `/api/citations` | ✅ |
| 15 | Manuscript Export (Pandoc) | `/api/export` | ✅ |
| 16 | Integrity Tools | `/api/integrity` | ✅ |
| 17 | Ecosystem Integrations | `/api/ecosystem` | ✅ |

### Core Features

| Feature | Status | Evidence |
|---------|--------|----------|
| Phase 2: Literature Integration | ✅ Done | `packages/manuscript-engine/src/services/pubmed.service.ts`, `services/orchestrator/src/routes/literature.ts` |
| Phase 3: IMRaD Structure | ✅ Done | `packages/manuscript-engine/src/services/*-builder.service.ts` |
| Stage 20: Conference Prep | ✅ Done | `services/worker/src/conference_prep/`, `services/worker/src/workflow_engine/stages/stage_20_conference.py` |
| Collaboration (CRDT) | ✅ Done | `services/collab/src/server.ts`, `migrations/0008_phase_h_document_lifecycle.sql` |
| Artifact Provenance | ✅ Done | `services/orchestrator/src/routes/artifact-graph.ts`, `artifact_edges` table |
| Feature Flags | ✅ Done | `services/orchestrator/src/services/feature-flags.service.ts` |
| Analytics (Consent-based) | ✅ Done | `services/orchestrator/src/services/analytics.service.ts`, `services/orchestrator/src/routes/consent.ts` |
| CI/CD Workflows | ✅ Done | `.github/workflows/ci.yml`, `.github/workflows/security-scan.yaml` |
| Webhooks (Stripe/Zoom) | ✅ Done | `services/orchestrator/src/webhooks/` |
| PHI Governance | ✅ Done | `packages/phi-engine/`, `services/orchestrator/src/middleware/phiScan.ts` |

## Runbooks

Operational guides available in `docs/runbooks/`:

- [Literature Integration](docs/runbooks/literature.md)
- [Manuscript Engine](docs/runbooks/manuscript_engine.md)
- [Conference Preparation](docs/runbooks/conference_prep.md)
- [Collaboration & Provenance](docs/runbooks/collaboration.md)
- [CI/CD](docs/runbooks/ci_cd.md)
- [Webhooks](docs/runbooks/webhooks.md)

## Environment Variables

See [.env.example](.env.example) for full list. Key variables:

```bash
# Governance
GOVERNANCE_MODE=DEMO|LIVE

# Database
DATABASE_URL=postgres://...

# Redis
REDIS_URL=redis://localhost:6379

# AI (optional)
ANTHROPIC_API_KEY=...
OPENAI_API_KEY=...

# Literature (optional, increases rate limits)
NCBI_API_KEY=...
SEMANTIC_SCHOLAR_API_KEY=...

# Webhooks (optional)
STRIPE_WEBHOOK_SECRET=whsec_...
ZOOM_WEBHOOK_SECRET_TOKEN=...
```

## Contributing

1. Create a feature branch from `develop`
2. Make changes and add tests
3. Run `make lint` and `make test`
4. Submit a PR

See [CONTRIBUTING.md](CONTRIBUTING.md) for detailed guidelines.

## License

MIT License - See [LICENSE](LICENSE) for details.
