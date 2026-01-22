# ResearchFlow Canvas - Claude Context

## Project Status
- Phase: Deployment & Integration Review - IN PROGRESS
- Completion: ~90%
- Last session: 2026-01-22

## Architecture
- Monorepo: packages/core, packages/phi-engine, packages/workflow-engine, packages/ai-router, packages/artifact-vault
- Frontend: React/TypeScript
- Backend: Express/FastAPI
- Governance: RBAC, PHI gating, audit logging

## Active Tasks
1. [x] Route registration (34 routes now active)
2. [x] Docker health checks (6/6 services)
3. [x] Security hardening (credentials, logging, ports)
4. [ ] HTTPS configuration (production)
5. [ ] End-to-end testing
6. [ ] API documentation

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

## Recent Improvements (2026-01-22)

### Route Registration ✓
- Added consent routes (`/api/consent`) - GDPR compliance
- Added comments routes (`/api/ros/comments`) - Inline commenting with PHI scanning
- Added submissions routes (`/api/ros/submissions`) - Journal/conference submissions
- Added manuscript branches (`/api/ros/manuscripts`) - Branching & merging
- Total: 34 route groups registered (up from 30)

### Docker Health Checks ✓
- Added worker health check in development (startup race condition fixed)
- Added web health check in production
- All 6 services now have proper health checks

### Security Hardening ✓
- Database credentials use environment variables (no hardcoded passwords)
- PostgreSQL port 5432 no longer exposed externally
- All services have log rotation (10MB max, 3 files)
- Redis persistence aligned across dev/prod (AOF enabled)

### Status
- **Staging Ready**: All Priority 1-2 items complete
- **Production Blockers**: HTTPS configuration, load testing
- **Deployment**: Ready for staging environment testing

## Session Notes
- 2026-01-22: Comprehensive deployment review and wiring verification complete
