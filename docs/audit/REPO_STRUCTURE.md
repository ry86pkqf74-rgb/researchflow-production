# Repository Structure Audit

Generated: 2026-01-20

## Canonical Roots

| Placeholder | Actual Path |
|-------------|-------------|
| `<MANUSCRIPT_ENGINE_ROOT>` | `packages/manuscript-engine/` |
| `<ORCHESTRATOR_ROOT>` | `services/orchestrator/` |
| `<WORKER_ROOT>` | `services/worker/` |
| `<WEB_ROOT>` | `services/web/` |
| `<COLLAB_ROOT>` | `services/collab/` |
| `<SHARED_ROOT>` | `shared/` |
| `<PACKAGES_ROOT>` | `packages/` |

## Top-Level Structure

```
researchflow-production/
├── .github/workflows/       # CI/CD pipelines
├── binder/                  # Jupyter/Binder config
├── data/                    # Runtime data (artifacts, logs, uploads)
├── docs/                    # Documentation
├── infrastructure/          # Docker, K8s, Terraform
├── integration-prompts/     # Claude integration prompts
├── k8s/                     # Kubernetes manifests
├── migrations/              # Database migrations (Drizzle)
├── notebooks/               # Jupyter notebooks
├── packages/                # Shared TS packages
│   ├── ai-router/           # AI model routing
│   ├── cli/                 # CLI tooling
│   ├── core/                # Core types, schemas, constants
│   ├── manuscript-engine/   # Literature, IMRaD, citation services
│   └── phi-engine/          # PHI scanning engine
├── planning/                # Planning docs
├── scripts/                 # Build/run scripts
├── services/                # Main services
│   ├── collab/              # CRDT collaboration server (Yjs)
│   ├── manuscript-service/  # Manuscript service
│   ├── orchestrator/        # Main API server (Express)
│   ├── web/                 # React frontend (Vite)
│   └── worker/              # Python worker (FastAPI)
├── shared/                  # Shared contracts and schemas
│   ├── contracts/           # API contracts
│   ├── phi/                 # PHI patterns
│   └── schemas/             # JSON schemas
├── tests/                   # Test suites
│   ├── chaos/               # Chaos testing
│   ├── e2e/                 # Playwright E2E
│   ├── integration/         # Integration tests
│   ├── perf/                # Performance tests
│   ├── security/            # Security tests
│   └── unit/                # Unit tests (vitest)
└── types/                   # Global TS type definitions
```

## Service Entrypoints

| Service | Entrypoint | Framework | Port |
|---------|------------|-----------|------|
| Orchestrator | `services/orchestrator/src/index.ts` | Express | 3001 |
| Web | `services/web/src/main.tsx` | React + Vite | 5173 |
| Worker | `services/worker/api_server.py` | FastAPI | 8001 |
| Collab | `services/collab/src/server.ts` | HTTP + Yjs | 4002 |

## Languages & Stats

- **TypeScript**: Primary (packages, services/orchestrator, services/web)
- **Python**: Worker service (FastAPI, pandas, scikit-learn)
- **SQL**: Migrations (PostgreSQL)

## Key Dependencies

### TypeScript
- Express.js (orchestrator)
- React + Zustand (web)
- Drizzle ORM
- Zod (validation)
- Vitest (testing)
- Playwright (E2E)

### Python
- FastAPI
- Pydantic
- Redis
- Pandas
- pytest
