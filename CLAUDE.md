# ResearchFlow Canvas - Claude Context

## Project Status
- Phase: B (Manuscript & Collaboration) - COMPLETE
- Completion: ~80%
- Last session: 2026-01-19

## Architecture
- Monorepo: packages/core, packages/phi-engine, packages/workflow-engine, packages/ai-router, packages/artifact-vault
- Frontend: React/TypeScript
- Backend: Express/FastAPI
- Governance: RBAC, PHI gating, audit logging

## Active Tasks
1. [ ] Manuscript authoring engine (autonomous loop)
2. [ ] File upload systems
3. [ ] PHI gating UI components
4. [ ] Testing infrastructure

## Key Decisions
- Governance-first: No autonomous AI execution from CI
- IMRaD structure for manuscripts
- Synthetic data until PHI approval
- HIPAA compliance required

## Directory Structure
- /services - Backend services
- /packages - Shared packages
- /infrastructure - Docker, K8s configs
- /scripts - Build and deploy scripts
- /docs - Documentation

## Session Notes
[Add notes each session]
