# ResearchFlow Production - Comprehensive Gap Analysis & Integration Plan

**Generated:** January 23, 2026
**Repository:** https://github.com/ry86pkqf74-rgb/researchflow-production
**Analysis Scope:** Full codebase review comparing documented features against implementation

---

## Executive Summary

This document provides a comprehensive analysis of the ResearchFlow production repository, identifying gaps between documented features and actual implementations. The analysis covers all three major services (Orchestrator, Worker, Web), Docker configurations, and E2E testing coverage.

### Key Findings

| Category | Documented | Implemented | Gap |
|----------|-----------|-------------|-----|
| Workflow Stages (UI) | 20 | 3 dedicated components | **17 missing** |
| Workflow Stages (Worker) | 20 | 6 | **14 missing** |
| API Routes | 60 files | 42 mounted | **18 not registered** |
| E2E Test Coverage | Full journey | Partial | **Critical paths missing** |

---

## 1. Web UI Implementation Gaps

### 1.1 Stage Components (CRITICAL)

**Documented:** 20-stage research workflow
**Implemented:** Only 3 dedicated stage components

| Stage | Name | UI Component | Status |
|-------|------|--------------|--------|
| 1 | Hypothesis Formation | `Stage01Hypothesis.tsx` | ✅ Implemented |
| 2 | Literature Review | - | ❌ **MISSING** |
| 3 | Literature Search | `Stage03LiteratureSearch.tsx` | ✅ Implemented |
| 4 | Data Collection | - | ❌ **MISSING** |
| 5 | Data Cleaning | - | ❌ **MISSING** |
| 6 | Exploratory Analysis | - | ❌ **MISSING** |
| 7 | Statistical Analysis | - | ❌ **MISSING** |
| 8 | Visualization | - | ❌ **MISSING** |
| 9 | Results Review | - | ❌ **MISSING** |
| 10 | Validation | - | ❌ **MISSING** |
| 11 | Introduction Writing | - | ❌ **MISSING** |
| 12 | Methods Writing | - | ❌ **MISSING** |
| 13 | Results Writing | - | ❌ **MISSING** |
| 14 | Discussion Writing | - | ❌ **MISSING** |
| 15 | Manuscript Compilation | - | ❌ **MISSING** |
| 16 | Peer Review | - | ❌ **MISSING** |
| 17 | Revision | - | ❌ **MISSING** |
| 18 | Final Review | - | ❌ **MISSING** |
| 19 | Submission | - | ❌ **MISSING** |
| 20 | Conference Preparation | `Stage20FinalExport.tsx` | ✅ Implemented |

### 1.2 Missing Feature Components

The following documented features lack dedicated UI components:

1. **Literature Review Dashboard** - No dedicated page for Stage 2
2. **Data Profiling UI** - Quality dashboard exists but lacks deep data profiling
3. **Statistical Analysis Wizard** - No guided statistical analysis interface
4. **Visualization Builder** - No drag-drop chart builder
5. **Peer Review Interface** - Basic review-sessions page exists but lacks full peer review workflow
6. **Submission Tracker** - No journal submission tracking dashboard

### 1.3 Implemented But Not Integrated

These components exist but aren't connected to the main workflow:

- `ai-insights-panel.tsx` (28.5 KB) - AI insights not wired to stages
- `ROSMetrics.tsx` (9.9 KB) - Metrics panel not visible in main workflow

---

## 2. Python Worker Implementation Gaps

### 2.1 Stage Implementations

**Documented:** 20-stage pipeline execution
**Implemented:** 6 stages

| Stage | File | Status | Notes |
|-------|------|--------|-------|
| 1 | `stage_01_upload.py` | ✅ | File intake, validation |
| 3 | `stage_03_irb.py` | ✅ | IRB compliance checks |
| 4 | `stage_04_validate.py` | ✅ | Schema validation |
| 5 | `stage_05_phi.py` | ✅ | PHI detection |
| 8 | `stage_08_validation.py` | ✅ | Data validation |
| 20 | `stage_20_conference.py` | ✅ | Conference prep orchestration |

**Missing Worker Stages:**
- Stage 2: Literature Review automation
- Stage 6: Exploratory Analysis
- Stage 7: Statistical Analysis
- Stages 9-19: All manuscript and review stages

### 2.2 Manuscript Module (PARTIAL)

**Documented in PRD-RALPH-MANUSCRIPT-MODULE.md:**
- 5 phases with 60+ services
- AI-powered section generation
- ICMJE/CONSORT/STROBE compliance

**Implemented:**
- `export_bundle.py` - Bundle export only
- `question_framer.py` - Research question framing
- `manuscript_runtime_active/runtime.py` - Basic draft building

**Missing:**
- Abstract generator
- Methods section generator
- Results section generator
- Discussion generator
- Compliance checkers (ICMJE, CONSORT, STROBE, PRISMA)
- Peer review simulation

### 2.3 Conference Prep Module (COMPLETE ✅)

All documented features implemented:
- `discovery.py` - Conference discovery
- `guidelines.py` - Guideline extraction
- `generate_materials.py` - Poster/slides generation
- `export_bundle.py` - Bundle packaging
- `provenance.py` - Audit trail
- `registry.py` - Conference format registry

---

## 3. Orchestrator API Gaps

### 3.1 Unregistered Routes (18 files)

These routes exist but are **NOT mounted** in `index.ts`:

| Route File | Purpose | Priority |
|------------|---------|----------|
| `ai-feedback.ts` | AI output feedback collection | HIGH |
| `ai-router.ts` | Intelligent model routing | HIGH |
| `ai-streaming.ts` | SSE for AI responses | HIGH |
| `artifact-graph.ts` | Provenance graph API | HIGH |
| `artifact-versions.ts` | Version management | MEDIUM |
| `claims.ts` | Claim extraction | MEDIUM |
| `collaborationExport.ts` | Yjs document export | MEDIUM |
| `export-bundle.ts` | Reproducibility bundles | HIGH |
| `mfa.ts` | Multi-factor auth | HIGH |
| `phi-scanner.ts` | PHI scanning API | HIGH |
| `ros-worker-proxy.ts` | Worker job proxy | HIGH |
| `topics.ts` | Topic management | LOW |
| `quality.ts` | Quality dashboard data | MEDIUM |
| `metrics.ts` | Prometheus metrics | MEDIUM |
| `stream.ts` | SSE event stream | HIGH |
| `analytics.ts` | Analytics events | LOW |
| `billing.ts` | Stripe integration | MEDIUM |
| `notifications.ts` | Notification center | MEDIUM |

### 3.2 Stub Implementations (Mock Data)

These routes return mock/placeholder data:

1. **`quality.ts`** - Returns empty structures, TODO comments
2. **`governance-simulate.ts`** - Mock simulation responses
3. **`sustainability.ts`** - Mock CO2 data
4. **`datasets.ts`** - Development mock datasets

### 3.3 TODO Items in Code

Found across route files:
- "TODO: Implement data source listing"
- "TODO: Add RBAC middleware" (multiple)
- "TODO: Implement account deletion workflow"
- "TODO: Send to worker service for actual execution"
- "TODO: Fetch executions from database"

---

## 4. Docker Configuration Analysis

### 4.1 Services Configured

| Service | Dev Compose | Prod Compose | Status |
|---------|-------------|--------------|--------|
| orchestrator | ✅ | ✅ | Working |
| worker | ✅ | ✅ | Working |
| web | ✅ | ✅ | Working |
| collab | ✅ | ✅ | Working |
| postgres | ✅ | ✅ | Working |
| redis | ✅ | ✅ | Working |
| nginx | ❌ | ✅ | Prod only |

### 4.2 Docker Issues Identified

1. **Worker port not exposed** in dev compose (only healthcheck)
2. **No Playwright service** in docker-compose for E2E testing
3. **Volume mount inconsistency** between dev and prod configs

### 4.3 Missing Docker Configurations

- `docker-compose.test.yml` for E2E testing with Playwright
- Playwright container service definition
- Test database seeding automation

---

## 5. E2E Testing Gaps

### 5.1 Current Coverage

| Test File | Coverage | Status |
|-----------|----------|--------|
| `auth.spec.ts` | Login/logout flows | ✅ |
| `critical-journeys.spec.ts` | Import, dashboard, roles | ✅ |
| `governance-modes.spec.ts` | DEMO/LIVE switching | ✅ |
| `manuscripts.spec.ts` | Manuscript CRUD | ✅ |
| `phi-redaction.spec.ts` | PHI detection UI | ✅ |
| `policy-enforcement.spec.ts` | Policy checks | ✅ |
| `system-smoke.spec.ts` | Basic health | ✅ |
| `workflow-navigation.spec.ts` | Stage navigation | ⚠️ Partial |

### 5.2 Missing Test Coverage

1. **Full 20-stage workflow completion** - Only navigation tested
2. **AI streaming interactions** - No tests for AI features
3. **Real-time collaboration** - Collab server not tested
4. **Export flows** - Bundle export not E2E tested
5. **Conference prep workflow** - Stage 20 specific tests missing

---

## 6. Integration Plan

### Phase 1: Critical API Integration (Week 1-2)

**Priority: Register unregistered routes**

```typescript
// Add to services/orchestrator/src/index.ts

// AI Features
import aiFeedbackRoutes from './routes/ai-feedback';
import aiRouterRoutes from './routes/ai-router';
import aiStreamingRoutes from './routes/ai-streaming';

// Core Features
import artifactGraphRoutes from './routes/artifact-graph';
import exportBundleRoutes from './routes/export-bundle';
import phiScannerRoutes from './routes/phi-scanner';
import streamRoutes from './routes/stream';

// Mount routes
app.use('/api/ai/feedback', aiFeedbackRoutes);
app.use('/api/ai/router', aiRouterRoutes);
app.use('/api/ai/stream', aiStreamingRoutes);
app.use('/api/ros/artifacts', artifactGraphRoutes);
app.use('/api/export', exportBundleRoutes);
app.use('/api/ros/phi', phiScannerRoutes);
app.use('/api/stream', streamRoutes);
```

### Phase 2: Stage UI Components (Week 3-6)

**Create dedicated components for high-priority stages:**

```
services/web/src/components/stages/
├── Stage01Hypothesis.tsx     ✅ EXISTS
├── Stage02LiteratureReview.tsx   🔨 CREATE
├── Stage03LiteratureSearch.tsx   ✅ EXISTS
├── Stage04DataCollection.tsx     🔨 CREATE
├── Stage05DataCleaning.tsx       🔨 CREATE
├── Stage06ExploratoryAnalysis.tsx 🔨 CREATE
├── Stage07StatisticalAnalysis.tsx 🔨 CREATE
├── Stage08Visualization.tsx      🔨 CREATE
├── Stage09ResultsReview.tsx      🔨 CREATE
├── Stage10Validation.tsx         🔨 CREATE
├── Stage11IntroductionWriting.tsx 🔨 CREATE
├── Stage12MethodsWriting.tsx     🔨 CREATE
├── Stage13ResultsWriting.tsx     🔨 CREATE
├── Stage14DiscussionWriting.tsx  🔨 CREATE
├── Stage15ManuscriptCompilation.tsx 🔨 CREATE
├── Stage16PeerReview.tsx         🔨 CREATE
├── Stage17Revision.tsx           🔨 CREATE
├── Stage18FinalReview.tsx        🔨 CREATE
├── Stage19Submission.tsx         🔨 CREATE
├── Stage20FinalExport.tsx        ✅ EXISTS
└── StageLayout.tsx               ✅ EXISTS
```

### Phase 3: Worker Stage Implementations (Week 7-10)

**Implement missing Python worker stages:**

```python
# services/worker/src/pipeline/stages/
stage_02_literature.py    # Literature search automation
stage_06_exploratory.py   # EDA with pandas profiling
stage_07_statistical.py   # Statistical analysis engine
stage_09_review.py        # Results review workflow
stage_10_validation.py    # Reproducibility validation
stage_11_intro.py         # AI introduction drafting
stage_12_methods.py       # Methods section generator
stage_13_results.py       # Results section generator
stage_14_discussion.py    # Discussion generator
stage_15_compile.py       # Manuscript compilation
stage_16_peer_review.py   # Peer review simulation
stage_17_revision.py      # Revision tracking
stage_18_final.py         # Final QC checks
stage_19_submission.py    # Journal submission prep
```

### Phase 4: Docker & E2E Testing (Week 11-12)

**Create Playwright Docker testing setup:**

```yaml
# docker-compose.test.yml
services:
  playwright:
    image: mcr.microsoft.com/playwright:v1.40.0-jammy
    depends_on:
      - web
      - orchestrator
      - worker
    environment:
      - BASE_URL=http://web:80
    volumes:
      - ./tests:/tests
      - ./playwright-report:/playwright-report
    command: npx playwright test --reporter=html

  test-db:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: test
      POSTGRES_PASSWORD: test
      POSTGRES_DB: ros_test
```

**Add missing E2E tests:**

```typescript
// tests/e2e/full-workflow.spec.ts
test('complete 20-stage research workflow', async ({ page }) => {
  // Test full workflow completion
});

// tests/e2e/ai-features.spec.ts
test('AI streaming responses', async ({ page }) => {
  // Test AI interactions
});

// tests/e2e/collaboration.spec.ts
test('real-time collaboration', async ({ page }) => {
  // Test Yjs collaboration
});
```

---

## 7. Recommended Immediate Actions

### High Priority (This Week)

1. **Register 18 unregistered API routes** in orchestrator index.ts
2. **Add worker port exposure** (8000) to docker-compose.yml
3. **Create docker-compose.test.yml** for Playwright testing
4. **Fix WorkflowStages.tsx** to show all 20 stages (currently shows 19)

### Medium Priority (Next 2 Weeks)

1. Create Stage 2 (Literature Review) UI component
2. Create Stage 6-8 (Analysis) UI components
3. Implement `stage_06_exploratory.py` worker
4. Implement `stage_07_statistical.py` worker
5. Add E2E tests for AI streaming

### Lower Priority (Month 2)

1. Complete all 17 missing stage UI components
2. Complete all 14 missing worker stages
3. Implement full manuscript generation pipeline
4. Add comprehensive E2E test coverage

---

## 8. Verification Checklist

Use this checklist after implementing changes:

### API Routes
- [ ] All 60 route files are registered
- [ ] No 404 errors on documented endpoints
- [ ] Swagger/OpenAPI docs reflect all routes
- [ ] Health endpoints return 200

### UI Components
- [ ] All 20 stages have dedicated components
- [ ] Stage navigation works for all stages
- [ ] Stage completion updates workflow status
- [ ] PHI gates show on stages 9, 13, 14, 17, 18, 19

### Worker Stages
- [ ] All 20 stages have Python implementations
- [ ] Stage registry validates all stages (1-20)
- [ ] Job queue processes all stage types
- [ ] Stage outputs persist correctly

### Docker & Testing
- [ ] `docker-compose up` starts all services
- [ ] `docker-compose -f docker-compose.test.yml up` runs E2E tests
- [ ] Playwright tests pass in CI
- [ ] No container restart loops

---

## Appendix: File Locations

### Stage Definitions
- **UI Stages:** `services/web/src/workflow/stages.ts`
- **Worker Stages:** `services/worker/src/pipeline/stages/`
- **Stage Registry:** `services/worker/src/workflow_engine/registry.py`

### Route Registrations
- **Main Router:** `services/orchestrator/src/index.ts`
- **Route Files:** `services/orchestrator/src/routes/`

### Docker Configs
- **Dev:** `docker-compose.yml`
- **Prod:** `docker-compose.prod.yml`
- **Test:** `docker-compose.test.yml` (TO BE CREATED)

---

*This document should be updated as gaps are addressed.*
