# Gap Matrix (Docs ↔ Code ↔ Runtime)

Generated: 2026-01-26 (Updated)

## Summary

The repository is **well-implemented** with most documented features having working code. Key gaps are primarily in:
1. Additional test coverage
2. Documentation updates
3. Minor wiring completions

## Feature Gap Analysis

| Feature / Doc Claim | Doc Location | Code Exists? | Runtime Wired? | Tests Exist? | Missing Pieces |
|---------------------|--------------|--------------|----------------|--------------|----------------|
| **Phase 2: Literature Integration** | `01_phase2_literature_integration.md` | ✅ | ✅ | ✅ | Minor: ReferenceLibrary persistence |
| PubMed Search | - | ✅ `packages/manuscript-engine/src/services/pubmed.service.ts` | ✅ | ✅ | None |
| Semantic Scholar | - | ✅ `packages/manuscript-engine/src/services/semantic-scholar.service.ts` | ✅ | ⚠️ | More test coverage |
| arXiv Search | - | ✅ `packages/manuscript-engine/src/services/arxiv.service.ts` | ✅ | ⚠️ | More test coverage |
| Citation Formatter | - | ✅ `packages/manuscript-engine/src/services/citation-formatter.service.ts` | ✅ | ✅ | None |
| Literature Types (Zod) | - | ✅ `packages/core/types/literature.ts` | ✅ | ✅ | None |
| Literature Routes | - | ✅ `services/orchestrator/src/routes/literature.ts` | ✅ | ✅ | None |
| Redis Caching | - | ✅ `services/orchestrator/src/services/redis-cache.ts` | ✅ | ✅ | None |
| **Phase 3: IMRaD Structure** | `02_phase3_imrad_structure.md` | ✅ | ✅ | ⚠️ | AI router integration tests |
| Introduction Builder | - | ✅ `packages/manuscript-engine/src/services/introduction-builder.service.ts` | ✅ | ⚠️ | AI router wire tests |
| Methods Populator | - | ✅ `packages/manuscript-engine/src/services/methods-populator.service.ts` | ✅ | ⚠️ | AI router wire tests |
| Results Scaffold | - | ✅ `packages/manuscript-engine/src/services/results-scaffold.service.ts` | ✅ | ⚠️ | AI router wire tests |
| Discussion Builder | - | ✅ `packages/manuscript-engine/src/services/discussion-builder.service.ts` | ✅ | ⚠️ | AI router wire tests |
| Abstract Generator | - | ✅ `packages/manuscript-engine/src/services/abstract-generator.service.ts` | ✅ | ✅ | None |
| **Stage 20: Conference Prep** | `04_stage20_conference_prep.md` | ✅ | ✅ | ✅ | None |
| Conference Discovery | - | ✅ `services/worker/src/conference_prep/discovery.py` | ✅ | ✅ | None |
| Guideline Extraction | - | ✅ `services/worker/src/conference_prep/guidelines.py` | ✅ | ✅ | None |
| Material Generation | - | ✅ `services/worker/src/conference_prep/generate_materials.py` | ✅ | ✅ | None |
| Export Bundle | - | ✅ `services/worker/src/conference_prep/export_bundle.py` | ✅ | ✅ | None |
| Stage 20 Registry | - | ✅ `services/worker/src/workflow_engine/stages/stage_20_conference.py` | ✅ | ✅ | None |
| Conference Routes | - | ✅ `services/orchestrator/src/routes/conference.ts` | ✅ | ✅ | None |
| **Collaboration (CRDT)** | `05_collaboration_and_provenance.md` | ✅ | ✅ | ⚠️ | More test coverage |
| Collab Server | - | ✅ `services/collab/src/server.ts` | ✅ | ⚠️ | Integration tests |
| Yjs Persistence | - | ✅ `services/collab/src/persistence/` | ✅ | ⚠️ | More coverage |
| DB Tables (Yjs) | - | ✅ `migrations/0008_phase_h_document_lifecycle.sql` | ✅ | ✅ | None |
| Auth Integration | - | ✅ `services/collab/src/auth.ts` | ✅ | ⚠️ | JWT tests |
| **Artifact Provenance** | `05_collaboration_and_provenance.md` | ✅ | ✅ | ⚠️ | UI visualization tests |
| artifact_edges table | - | ✅ `migrations/0008_phase_h_document_lifecycle.sql` | ✅ | ✅ | None |
| Graph API Routes | - | ✅ `services/orchestrator/src/routes/artifact-graph.ts` | ✅ | ⚠️ | More coverage |
| Worker Provenance | - | ✅ `services/worker/src/conference_prep/provenance.py` | ✅ | ⚠️ | More coverage |
| **Comments/Threads** | `05_collaboration_and_provenance.md` | ✅ | ✅ | ⚠️ | More test coverage |
| Comments Table | - | ✅ `migrations/0008_phase_h_document_lifecycle.sql` | ✅ | ✅ | None |
| Comments Routes | - | ✅ `services/orchestrator/src/routes/comments.ts` | ✅ | ⚠️ | More coverage |
| **CI/CD + Webhooks** | `06_ci_cd_actions_webhooks.md` | ✅ | ✅ | ✅ | None |
| CI Workflow | - | ✅ `.github/workflows/ci.yml` | ✅ | ✅ | None |
| Security Scan | - | ✅ `.github/workflows/security-scan.yaml` | ✅ | ✅ | None |
| Docker Build | - | ✅ `.github/workflows/build-images.yml` | ✅ | ✅ | None |
| Webhook Routes | - | ✅ `services/orchestrator/src/routes/webhooks.ts` | ✅ | ⚠️ | Integration tests |
| Stripe Handler | - | ✅ `services/orchestrator/src/routes/webhooks/stripe.ts` | ✅ | ⚠️ | Integration tests |
| Zoom Handler | - | ✅ `services/orchestrator/src/routes/webhooks/zoom.ts` | ✅ | ⚠️ | Integration tests |
| **PHI Governance** | Various | ✅ | ✅ | ✅ | None |
| PHI Engine | - | ✅ `packages/phi-engine/` | ✅ | ✅ | None |
| PHI Middleware | - | ✅ `services/orchestrator/src/middleware/phiScan.ts` | ✅ | ✅ | None |
| PHI Collab | - | ✅ `services/collab/src/phi-scanner.ts` | ✅ | ⚠️ | More tests |
| **Feature Flags** | Phase F docs | ✅ | ✅ | ✅ | None |
| Flags Service | - | ✅ `services/orchestrator/src/services/feature-flags.service.ts` | ✅ | ✅ | None |
| Experiments | - | ✅ `services/orchestrator/src/services/experiments.service.ts` | ✅ | ✅ | None |
| **Analytics** | Phase F docs | ✅ | ✅ | ✅ | None |
| Analytics Service | - | ✅ `services/orchestrator/src/services/analytics.service.ts` | ✅ | ✅ | None |
| Consent Management | - | ✅ `services/orchestrator/src/routes/consent.ts` | ✅ | ✅ | None |

## Action Items

### High Priority (Required)
1. ✅ ~~Create webhook handlers for external integrations (Stripe/Zoom)~~ - **COMPLETED** (see `services/orchestrator/src/routes/webhooks/`)

### Medium Priority (Recommended)
2. Add integration tests for collaboration server
3. Add more unit tests for artifact graph operations
4. Add tests for IMRaD AI router integration
5. Add integration tests for webhook handlers (Stripe/Zoom)

### Low Priority (Nice to Have)
6. Add UI tests for graph visualization
7. Add performance benchmarks for literature search
8. Add chaos tests for collab server failover

## Implementation Status Legend

| Symbol | Meaning |
|--------|---------|
| ✅ | Fully implemented and working |
| ⚠️ | Partially implemented or needs more coverage |
| ❌ | Not implemented |
