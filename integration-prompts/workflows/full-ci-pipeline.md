# Workflow: Full CI Pipeline

## Context
Complete CI pipeline execution for ResearchFlow production deployment readiness.

## Goal
Execute the full continuous integration pipeline to validate the codebase.

## Pipeline Stages

### Stage 1: Environment Setup
1. Verify Node.js version >= 20
2. Verify npm version >= 10
3. Run `npm ci` to install dependencies
4. Verify PostgreSQL connection
5. Verify Redis connection

### Stage 2: Code Quality
1. Run ESLint: `npm run lint`
2. Run TypeScript check: `npm run typecheck`
3. Run Prettier check: `npm run format:check`

### Stage 3: Build
1. Build packages: `npm run build:packages`
2. Build services: `npm run build:services`
3. Verify build artifacts exist

### Stage 4: Unit Tests
1. Run unit tests: `npm run test:unit`
2. Generate coverage report: `npm run test:coverage`
3. Verify coverage thresholds

### Stage 5: Integration Tests
1. Ensure database is migrated
2. Run integration tests: `npm run test:integration`

### Stage 6: E2E Tests
1. Start services: `npm run dev` (background)
2. Wait for services to be healthy
3. Run E2E tests: `npm run test:e2e`
4. Stop services

### Stage 7: Security Checks
1. Run `npm audit`
2. Check for outdated dependencies
3. Verify no secrets in codebase

## Constraints
- Pipeline must complete within 30 minutes
- Any stage failure should stop the pipeline
- All results must be logged

## Success Criteria
- [ ] All stages complete successfully
- [ ] No critical security vulnerabilities
- [ ] Test coverage meets thresholds
- [ ] Build artifacts are valid

## Output Format
```
## CI Pipeline Report
Generated: [timestamp]
Duration: [total time]

### Stage Results
| Stage | Status | Duration | Notes |
|-------|--------|----------|-------|
| Setup | ✅/❌ | Xs | |
| Quality | ✅/❌ | Xs | |
| Build | ✅/❌ | Xs | |
| Unit Tests | ✅/❌ | Xs | |
| Integration | ✅/❌ | Xs | |
| E2E | ✅/❌ | Xs | |
| Security | ✅/❌ | Xs | |

### Overall Status: PASS/FAIL

### Issues Found
[List any issues with recommendations]
```
