# Service Inventory

Generated: 2026-01-20

## Manuscript Engine (`packages/manuscript-engine/`)

| Service | Path | Exported? | Wired? | Tests? | Notes |
|---------|------|-----------|--------|--------|-------|
| PubMedService | `src/services/pubmed.service.ts` | ✅ | ✅ | ✅ | E-utilities integration |
| SemanticScholarService | `src/services/semantic-scholar.service.ts` | ✅ | ✅ | ⚠️ | Needs more tests |
| ArxivService | `src/services/arxiv.service.ts` | ✅ | ✅ | ⚠️ | Basic implementation |
| CitationFormatterService | `src/services/citation-formatter.service.ts` | ✅ | ✅ | ✅ | APA, Vancouver, MLA |
| CitationManagerService | `src/services/citation-manager.service.ts` | ✅ | ✅ | ✅ | Library management |
| AbstractGeneratorService | `src/services/abstract-generator.service.ts` | ✅ | ✅ | ✅ | Structured/narrative |
| IntroductionBuilderService | `src/services/introduction-builder.service.ts` | ✅ | ✅ | ⚠️ | Needs AI router wire |
| MethodsPopulatorService | `src/services/methods-populator.service.ts` | ✅ | ✅ | ⚠️ | Template-based |
| DiscussionBuilderService | `src/services/discussion-builder.service.ts` | ✅ | ✅ | ⚠️ | Needs AI router wire |
| ResultsScaffoldService | `src/services/results-scaffold.service.ts` | ✅ | ✅ | ⚠️ | Basic scaffolding |
| PhiGuardService | `src/services/phi-guard.service.ts` | ✅ | ✅ | ✅ | Fail-closed PHI scan |
| PeerReviewService | `src/services/peer-review.service.ts` | ✅ | ✅ | ⚠️ | Simulated review |
| PlagiarismCheckService | `src/services/plagiarism-check.service.ts` | ✅ | ⚠️ | ⚠️ | Stubbed - no ext API |
| FinalPhiScanService | `src/services/final-phi-scan.service.ts` | ✅ | ✅ | ✅ | Export gate |

## Orchestrator (`services/orchestrator/`)

| Route/Module | Path | Wired? | Tests? | Notes |
|--------------|------|--------|--------|-------|
| Literature Routes | `src/routes/literature.ts` | ✅ | ✅ | Search + cache |
| Conference Routes | `src/routes/conference.ts` | ✅ | ✅ | Stage 20 API |
| Governance Routes | `src/routes/governance.ts` | ✅ | ✅ | Mode + flags |
| Analytics Routes | `src/routes/analytics.ts` | ✅ | ✅ | Consent-based |
| Artifact Graph Routes | `src/routes/artifact-graph.ts` | ✅ | ⚠️ | Provenance API |
| Comments Routes | `src/routes/comments.ts` | ✅ | ⚠️ | Threaded comments |
| Claims Routes | `src/routes/claims.ts` | ✅ | ⚠️ | Evidence linking |
| Stream Routes | `src/routes/stream.ts` | ✅ | ⚠️ | SSE governance |
| Consent Routes | `src/routes/consent.ts` | ✅ | ✅ | GDPR compliance |
| RBAC Middleware | `src/middleware/rbac.ts` | ✅ | ✅ | Role-based access |
| PHI Middleware | `src/middleware/phiScan.ts` | ✅ | ✅ | Fail-closed gate |

## Worker - Python (`services/worker/`)

| Stage | Path | Registered? | Tests? | Notes |
|-------|------|-------------|--------|-------|
| Stage 20 Conference | `src/workflow_engine/stages/stage_20_conference.py` | ✅ | ✅ | Full implementation |
| Conference Discovery | `src/conference_prep/discovery.py` | ✅ | ✅ | Demo + search |
| Conference Guidelines | `src/conference_prep/guidelines.py` | ✅ | ✅ | Extraction |
| Material Generation | `src/conference_prep/generate_materials.py` | ✅ | ✅ | Abstract/poster/slides |
| Export Bundle | `src/conference_prep/export_bundle.py` | ✅ | ✅ | ZIP packaging |
| Provenance Tracker | `src/conference_prep/provenance.py` | ✅ | ⚠️ | Graph integration |
| PHI Scanning | `src/governance/phi_scanner.py` | ✅ | ✅ | Worker-side PHI |

## Collaboration (`services/collab/`)

| Component | Path | Wired? | Tests? | Notes |
|-----------|------|--------|--------|-------|
| Server | `src/server.ts` | ✅ | ⚠️ | Yjs CRDT |
| Auth | `src/auth.ts` | ✅ | ⚠️ | JWT verification |
| PHI Scanner | `src/phi-scanner.ts` | ✅ | ⚠️ | Real-time PHI |
| Persistence | `src/persistence/` | ✅ | ⚠️ | Postgres snapshots |

## Shared Contracts (`shared/`)

| Contract | Path | Used by TS | Used by Py | Notes |
|----------|------|------------|------------|-------|
| API OpenAPI | `contracts/api.yaml` | ✅ | ✅ | Spec file |
| PHI Patterns | `phi/` | ✅ | ✅ | Shared patterns |
| JSON Schemas | `schemas/` | ✅ | ✅ | Validation |

## Core Types (`packages/core/`)

| Type Module | Path | Exported? | Notes |
|-------------|------|-----------|-------|
| Literature Types | `types/literature.ts` | ✅ | Full Zod schemas |
| Conference Types | `types/conference.ts` | ✅ | Stage 20 support |
| Governance Types | `types/governance.ts` | ✅ | Mode + flags |
| Workflow Types | `types/workflow.ts` | ✅ | Stage definitions |
| Auth Types | `types/auth.ts` | ✅ | RBAC roles |

## CI/CD Workflows (`.github/workflows/`)

| Workflow | File | Status | Notes |
|----------|------|--------|-------|
| CI | `ci.yml` | ✅ | Lint + typecheck + tests |
| Security Scan | `security-scan.yaml` | ✅ | Trivy, CodeQL, Gitleaks |
| Build Images | `build-images.yml` | ✅ | Docker builds |
| Deploy Staging | `deploy-staging.yml` | ✅ | K8s staging |
| Deploy Production | `deploy-production.yml` | ✅ | K8s prod |
| PHI Codegen Check | `phi-codegen-check.yml` | ✅ | PHI pattern validation |
| PR Size Guard | `pr-size-guard.yml` | ✅ | PR governance |
| Publish Docs | `publish-docs.yml` | ✅ | MkDocs deployment |
| Slack Notify | `slack-notify.yml` | ✅ | CI notifications |
