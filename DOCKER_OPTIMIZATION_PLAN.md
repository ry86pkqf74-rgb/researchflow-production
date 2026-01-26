# Docker Deployment Optimization Plan

**Date:** January 20, 2026
**Status:** ✅ Implementation Complete
**Scope:** Finalize Docker deployment for local development and production readiness

---

## Executive Summary

This plan addresses the Docker optimization requirements for ResearchFlow across 5 main phases, subdivided into 15 subphases for methodical, error-free execution. Each subphase is designed to be atomic and independently verifiable.

---

## Current State Assessment

| Service | Multi-Stage | Non-Root | Healthcheck | Status |
|---------|-------------|----------|-------------|--------|
| Orchestrator | ✅ Yes | ✅ Yes | ✅ Yes | Good - Minor tweaks |
| Worker | ✅ Yes | ✅ Yes | ✅ Yes | Good - Minor tweaks |
| Web | ✅ Yes | ⚠️ Implicit | ✅ Yes | Good - Extract nginx config |
| Collab | ❌ No | ❌ No | ✅ Yes | **Needs refactor** |

---

## Phase 1: Optimize Service Dockerfiles

### Phase 1.1: Orchestrator Dockerfile Verification
**Priority:** Low (already well-structured)
**Estimated Changes:** Minimal

**Tasks:**
1. Verify multi-stage build structure (base → deps → development/production)
2. Confirm non-root user (nodejs:1001) is active in production
3. Validate healthcheck endpoint configuration
4. Add OCI/Docker labels for metadata
5. Document any monorepo symlink concerns

**Acceptance Criteria:**
- Dockerfile passes `docker build --target production` without errors
- Container runs as non-root (verify with `docker exec <id> whoami`)
- Health endpoint responds at `/api/health`

---

### Phase 1.2: Worker Dockerfile Optimization
**Priority:** Low (already well-structured)
**Estimated Changes:** Minor

**Tasks:**
1. Add `PYTHONDONTWRITEBYTECODE=1` environment variable
2. Verify UVICORN_WORKERS support in CMD or entrypoint
3. Confirm non-root user (worker) is active
4. Add OCI/Docker labels for metadata
5. Verify health endpoint at `/health`

**Acceptance Criteria:**
- Dockerfile builds successfully for both stages
- Python optimizations applied
- Worker count configurable via environment

---

### Phase 1.3: Web Dockerfile Enhancement
**Priority:** Medium (extract nginx config)
**Estimated Changes:** Moderate

**Tasks:**
1. Extract inline nginx config to `infrastructure/docker/nginx/default.conf`
2. Update Dockerfile to COPY external config file
3. Add security headers to nginx config (X-Frame-Options, X-Content-Type-Options)
4. Add OCI/Docker labels for metadata
5. Verify SPA routing and API proxy functionality

**Acceptance Criteria:**
- Nginx config is external file (maintainable)
- Security headers present in responses
- SPA routing works correctly
- API proxy to orchestrator functional

---

### Phase 1.4: Collab Dockerfile Refactor (CRITICAL)
**Priority:** High (needs complete refactor)
**Estimated Changes:** Major

**Tasks:**
1. Convert to multi-stage build (base → deps → build → production)
2. Move build dependencies (python3, make, g++) to builder stage only
3. Add non-root user (appuser:appgroup) in production stage
4. Add embedded healthcheck matching compose configuration
5. Change CMD from `npm run dev` to `npm run start` for production
6. Copy only compiled output to production stage
7. Add OCI/Docker labels for metadata

**Acceptance Criteria:**
- Multi-stage build reduces final image size significantly
- Production container runs as non-root
- No build tools in production image
- Health endpoint responds at `/health`

---

## Phase 2: Refine Docker Compose Configuration

### Phase 2.1: Development Compose (docker-compose.yml) Updates
**Priority:** Medium
**Estimated Changes:** Moderate

**Tasks:**
1. Standardize build contexts across all services
2. Add `depends_on` with `condition: service_healthy` for orchestrator and worker
3. Verify all environment variable defaults are sensible
4. Ensure volume mounts don't override critical container files
5. Add restart policies for infrastructure services (postgres, redis)
6. Verify network configuration (researchflow bridge)

**Acceptance Criteria:**
- Services start in correct order based on health
- All services reach healthy state
- Hot-reload works for development

---

### Phase 2.2: Production Compose (docker-compose.prod.yml) Updates
**Priority:** High
**Estimated Changes:** Moderate

**Tasks:**
1. Add collab service block (if needed for production)
2. Verify all services use `target: production`
3. Confirm resource limits are appropriate
4. Add logging driver configuration
5. Verify restart policies (unless-stopped)
6. Ensure secrets are externalized (not hardcoded)

**Acceptance Criteria:**
- All services build with production target
- Resource limits enforced
- Services restart on failure
- Logging configured appropriately

---

### Phase 2.3: Environment and Secrets Management
**Priority:** Medium
**Estimated Changes:** Minor

**Tasks:**
1. Verify `.dockerignore` excludes `.env` files
2. Update `.env.example` with any new variables
3. Add clear "CHANGE IN PRODUCTION" warnings for secrets
4. Document environment variable requirements in compose files
5. Verify no secrets baked into images

**Acceptance Criteria:**
- `.env` never included in Docker context
- All required variables documented
- Example file comprehensive

---

## Phase 3: Nginx Configuration Enhancement

### Phase 3.1: Extract and Organize Nginx Config
**Priority:** Medium
**Estimated Changes:** Moderate

**Tasks:**
1. Create `infrastructure/docker/nginx/default.conf` (SPA + API proxy)
2. Update web Dockerfile to use external config
3. Ensure config matches inline version functionality
4. Add appropriate comments for maintainability

**Acceptance Criteria:**
- Config file is standalone and readable
- Functionality identical to inline version
- Easy to modify for different environments

---

### Phase 3.2: Security Headers and Optimizations
**Priority:** Medium
**Estimated Changes:** Minor

**Tasks:**
1. Add security headers:
   - X-Frame-Options: DENY
   - X-Content-Type-Options: nosniff
   - X-XSS-Protection: 1; mode=block
   - Referrer-Policy: strict-origin-when-cross-origin
2. Verify gzip compression settings
3. Confirm cache control headers for assets
4. Add client_max_body_size for uploads

**Acceptance Criteria:**
- Security headers present in all responses
- Assets properly cached
- Large uploads supported

---

## Phase 4: Build, Test, and Validate

### Phase 4.1: Build All Docker Images
**Priority:** High
**Estimated Changes:** None (validation only)

**Tasks:**
1. Run `docker-compose build` for development images
2. Run `docker-compose -f docker-compose.prod.yml build` for production images
3. Verify image sizes are reasonable
4. Check for any build warnings or errors
5. Tag images appropriately

**Acceptance Criteria:**
- All images build successfully
- No critical warnings
- Image sizes optimized (multi-stage benefit visible)

---

### Phase 4.2: Launch and Verify Stack
**Priority:** High
**Estimated Changes:** None (validation only)

**Tasks:**
1. Run `docker-compose up -d` for full stack
2. Verify each service health:
   - Web UI at http://localhost:5173
   - Orchestrator API at http://localhost:3001/api/health
   - Collab at http://localhost:1234/health
3. Check logs for any errors
4. Verify database initialization
5. Test basic application functionality

**Acceptance Criteria:**
- All services healthy
- Web UI accessible and functional
- API endpoints responding
- No error logs

---

### Phase 4.3: Production Mode Testing
**Priority:** High
**Estimated Changes:** None (validation only)

**Tasks:**
1. Run `docker-compose -f docker-compose.prod.yml up -d`
2. Verify production configurations applied
3. Test nginx reverse proxy functionality
4. Verify resource limits are respected
5. Confirm graceful shutdown works

**Acceptance Criteria:**
- Production stack runs successfully
- Nginx serves frontend and proxies API
- Resource limits enforced
- Clean shutdown without data loss

---

## Phase 5: Documentation and Final Checks

### Phase 5.1: Update Documentation
**Priority:** Medium
**Estimated Changes:** Documentation only

**Tasks:**
1. Update README.md with Docker deployment section
2. Add `docs/deployment/docker-guide.md` with detailed instructions
3. Document environment variable requirements
4. Add troubleshooting section for common issues
5. Include commands for both dev and prod modes

**Acceptance Criteria:**
- Developer can follow docs to deploy
- All configuration options documented
- Troubleshooting covers common issues

---

### Phase 5.2: Final Verification and Commit
**Priority:** High
**Estimated Changes:** None (commit only)

**Tasks:**
1. Run full test suite if available
2. Verify all changes are consistent
3. Create comprehensive commit message
4. Push changes to repository
5. Verify CI/CD pipeline passes (if applicable)

**Acceptance Criteria:**
- All tests pass
- Changes committed with clear message
- Pipeline builds successfully

---

## Implementation Order

Execute phases in this order to minimize risk:

```
Phase 1.1 (Orchestrator) → Phase 1.2 (Worker) → Phase 1.3 (Web) → Phase 1.4 (Collab)
    ↓
Phase 2.1 (Dev Compose) → Phase 2.2 (Prod Compose) → Phase 2.3 (Secrets)
    ↓
Phase 3.1 (Nginx Extract) → Phase 3.2 (Security Headers)
    ↓
Phase 4.1 (Build) → Phase 4.2 (Test Dev) → Phase 4.3 (Test Prod)
    ↓
Phase 5.1 (Docs) → Phase 5.2 (Commit)
```

---

## Risk Mitigation

1. **Before each phase:** Read current file state completely
2. **After each change:** Verify syntax with `docker-compose config`
3. **Incremental testing:** Build and test after each subphase
4. **Rollback ready:** Git commit after each successful phase
5. **No assumptions:** Verify file paths and content before editing

---

## Success Metrics

- [x] All 4 service Dockerfiles use multi-stage builds
- [x] All production containers run as non-root
- [x] All services have embedded healthchecks
- [x] Docker Compose brings up full stack with single command
- [x] Development hot-reload functional
- [x] Production mode uses nginx reverse proxy
- [x] Documentation complete for new developers
- [ ] CI/CD pipeline passes (to be verified)

---

## Notes

- Collab service refactor is the highest priority change
- Orchestrator and Worker are already well-structured
- Web service mainly needs nginx config extraction
- Production compose may need collab service added
- HTTPS configuration deferred (requires certificates)
