# ResearchFlow Production

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
│  │  Data    │ │ 19-Stage │ │  Figure  │ │ Artifact │           │
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

- Docker & Docker Compose
- Node.js 20+
- Python 3.11+
- Make

### Development Setup

```bash
# Clone the repository
git clone https://github.com/your-org/researchflow-production.git
cd researchflow-production

# Initial setup
make setup

# Start development environment
make dev
```

Access the application:
- **Web UI**: http://localhost:5173
- **API**: http://localhost:3001
- **Worker API**: http://localhost:8000

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
│   ├── worker/           # Python compute (validation, analysis, 19-stage workflow)
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
- 19-stage research workflow execution
- Statistical analysis and QC
- Figure and table generation
- Artifact creation with manifest tracking

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

## Governance

ResearchFlow implements strict PHI governance:

- **DEMO Mode**: PHI reveal blocked, synthetic data only
- **LIVE Mode**: PHI access requires approval, full audit trail

All AI interactions are routed through the AI Router which:
- Scans inputs/outputs for PHI
- Routes to appropriate model tier based on task complexity
- Maintains full audit trail of AI invocations
- Implements cost optimization with automatic escalation

## Contributing

1. Create a feature branch from `develop`
2. Make changes and add tests
3. Run `make lint` and `make test`
4. Submit a PR

## License

MIT License - See [LICENSE](LICENSE) for details.
