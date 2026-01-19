# Phase B Changelog - Manuscript Engine Expansion

## Summary

Phase B implements 40 tasks (Tasks 41-80) focused on expanding the manuscript engine with AI-powered generation, real-time collaboration, and comprehensive export capabilities.

---

## PR-B0: Foundation Layer

### Shared Contracts
- `shared/contracts/manuscripts.ts` - Manuscript types, section keys, job interfaces
- `shared/contracts/audit.ts` - Audit event types and governance interfaces
- `shared/contracts/artifacts.ts` - Artifact types, manifests, reproducibility bundle

### Database Migration
- `migrations/005_phase_b_manuscript_engine.sql`
  - `manuscript_section_revisions` - Section versioning with append-only history
  - `manuscript_jobs` - Job tracking for async operations
  - `manuscript_audit_events` - Hash-chained audit trail
  - `manuscript_artifacts` - Figures, tables, exports
  - `manuscript_approvals` - LIVE mode approval workflow
  - `manuscript_feedback` - AI draft ratings
  - `manuscript_ai_costs` - Token usage tracking
  - `journal_templates` - NEJM, JAMA, Lancet, BMJ presets

### Worker Client
- `services/orchestrator/src/clients/workerClient.ts`
  - HTTP client with timeout handling
  - Error wrapping for worker communication

### PHI Guard
- `services/orchestrator/src/security/phiGuard.ts` - Node.js PHI assertions
- `services/worker/src/security/phi_guard.py` - Python PHI assertions
  - Location-only reporting (never logs PHI text)
  - Object recursive scanning

---

## PR-B1: Core Manuscript Model (Tasks 41, 42, 44, 50, 66, 70)

### Task 41: Generate INTRODUCTION Endpoint
- `services/orchestrator/src/routes/manuscripts.generate.ts`
  - POST `/api/manuscripts/:id/sections/:sectionKey/generate`
  - PHI scan before job creation
  - Async job enqueue to worker

### Task 42: Worker Section Generation
- `services/worker/src/tasks/generate_section.py`
  - Section-specific prompts with medical/surgical tone
  - Context building from refs (lit summaries, data metadata)
  - PHI scan on inputs and outputs

### Task 44: Revision Versioning with Rollback
- `services/orchestrator/src/services/revisionsService.ts`
  - Append-only revision history
  - Word count tracking
  - Rollback creates new revision (preserves history)
- `services/orchestrator/src/routes/manuscripts.revisions.ts`
  - GET/POST revision history
  - Rollback endpoint

### Task 50: Medical/Surgical Tone Prompts
- System prompts tuned for academic medical writing
- Cautious language, citation placeholders
- Section-specific guidelines (IMRaD)

### Task 66: Governance Gates
- `services/orchestrator/src/routes/approvals.ts`
  - STANDBY: blocks all external actions
  - DEMO: auto-approve
  - LIVE: requires explicit approval
  - Audit trail for all gate checks

### Task 70: Manifest Validation
- `services/worker/src/artifacts/manifest_validate.py`
  - Schema validation
  - File existence check
  - Hash verification

---

## PR-B2: IMRaD Editor + Collaboration (Tasks 45-47, 60-63, 78-79)

### Task 45: Real-time Collaboration
- `services/collab/` - New Hocuspocus server
  - Yjs document sync
  - WebSocket collaboration
  - Document persistence hooks

### Task 46: Rich Text IMRaD Editor
- `services/web/src/components/manuscripts/ImradEditor.tsx`
  - TipTap editor with StarterKit
  - Collaboration extension
  - Cursor presence
  - Word count display

### Task 47: Artifact Embeds
- `services/web/src/components/manuscripts/extensions/ArtifactEmbedNode.ts`
  - Custom TipTap node for figures/tables
  - Draggable, atom-style rendering
- `services/web/src/components/manuscripts/ArtifactPicker.tsx`
  - Modal for selecting artifacts

### Task 60: Manuscript Dashboard
- `services/web/src/pages/ManuscriptsDashboard.tsx`
  - Progress bars per section
  - Word count tracking
  - Validation status

### Task 61: AI Co-drafter Sidebar
- `services/web/src/components/manuscripts/AICodrawer.tsx`
  - Expand/clarify/simplify actions
  - Custom instruction support
  - Job polling for results

### Task 62: Claim Lint Panel
- `services/web/src/components/manuscripts/ClaimLintPanel.tsx`
  - Severity-based filtering
  - Click to highlight in editor
  - Evidence suggestions

### Task 63: Voice Dictation
- `services/web/src/components/manuscripts/DictationButton.tsx`
  - Web Speech API integration
  - Interim transcript display

### Task 78-79: Mobile + Offline
- Responsive editor design
- `services/web/src/offline/indexedDbDraftCache.ts`
  - IndexedDB draft storage
  - Online/offline sync

---

## PR-B3: Verification + Review Simulation (Tasks 48-49, 67)

### Task 48: Claim Verifier
- `services/worker/src/tasks/claim_verifier.py`
  - Sentence extraction
  - Evidence retrieval (embeddings-ready)
  - Severity classification

### Task 49: Peer Review Simulation
- `services/worker/src/tasks/peer_review.py`
  - Reviewer 1: Methodological focus
  - Reviewer 2: Clinical focus
  - Editor synthesis
  - Action item extraction

### Task 67: Audit Trail Viewer
- `services/web/src/components/manuscripts/AuditTrail.tsx`
  - Timeline view grouped by date
  - Event type icons
  - Hash display for integrity

---

## PR-B4: Exports + Validators (Tasks 43, 51-52, 56-57, 65)

### Task 43: Export Pipeline
- `services/worker/src/tasks/export_pipeline.py`
  - Markdown → DOCX (Pandoc)
  - Markdown → PDF (Pandoc + LaTeX)
  - Markdown → LaTeX bundle (zip)

### Task 51: Export Endpoints
- `services/orchestrator/src/routes/exports.ts`
  - Governance-gated exports
  - Multiple format support

### Task 52: Journal Templates
- Database-seeded templates (NEJM, JAMA, Lancet, BMJ)
- Word limits, citation styles, section requirements

### Task 56: Double-Blind Redaction
- `export_pipeline.py:redact_double_blind()`
  - Removes author/affiliation sections
  - Redacts IRB IDs, grant numbers

### Task 57: Submission Validator
- `services/worker/src/tasks/submission_validator.py`
  - Section presence check
  - Word count limits
  - Citation placeholder detection

### Task 65: Accessibility Check
- axe-core integration placeholder
- Export preview accessibility warnings

---

## PR-B5: External Integrations (Tasks 54-55, 59, 64, 72, 77)

### Task 54: Style Check (LanguageTool)
- Self-hosted LanguageTool proxy
- PHI scan before external call

### Task 55: Plagiarism Check (Copyleaks stub)
- Configurable API key
- Blocks export if score exceeds threshold

### Task 59: ORCID Integration
- Stub for author metadata fetch
- LIVE mode audit logging

### Task 64: Translation
- `services/worker/src/tasks/translate_abstract.py`
  - DeepL primary, Google fallback
  - 12 supported languages
  - PHI scan on input/output

### Task 72: DOI Minting
- DataCite stub
  - DEMO: simulated DOI
  - LIVE: real API call (gated)

### Task 77: Overleaf Export
- LaTeX bundle compatible
- Feature-flagged sync

---

## PR-B6: Stats + Figures + Reproducibility (Tasks 68-71)

### Task 68: Statistical Reporting
- Table 1 generation
- CI formatting
- Results tables

### Task 69: Interactive Figures
- Matplotlib → Plotly conversion
- plotly_json artifact format

### Task 70: Manifest Validation
- (See PR-B1)

### Task 71: Reproducibility Bundle
- `services/worker/src/tasks/repro_bundle.py`
  - Manuscript + manifests
  - pip freeze
  - Docker compose template
  - README with usage

---

## PR-B7: Docs + E2E + Feedback (Tasks 73-76, 80)

### Task 73: Documentation
- `docs/manuscript_engine/USAGE.md`
  - API reference
  - Governance modes
  - Example flows

### Task 74: E2E Tests
- Playwright test scaffolding
- Full manuscript flow validation

### Task 75: Cost Estimator
- AI token tracking table
- Per-manuscript cost display

### Task 76: Feedback Loop
- POST `/api/manuscripts/:id/feedback`
- Rating + comment storage

### Task 80: Simulation Test
- Full manuscript generation from synthetic data

---

## Files Changed Summary

### New Files (60+)
```
shared/contracts/manuscripts.ts
shared/contracts/audit.ts
shared/contracts/artifacts.ts
migrations/005_phase_b_manuscript_engine.sql
services/orchestrator/src/clients/workerClient.ts
services/orchestrator/src/security/phiGuard.ts
services/orchestrator/src/services/manuscriptJobs.ts
services/orchestrator/src/services/revisionsService.ts
services/orchestrator/src/routes/manuscripts.generate.ts
services/orchestrator/src/routes/manuscripts.revisions.ts
services/orchestrator/src/routes/approvals.ts
services/orchestrator/src/routes/exports.ts
services/orchestrator/src/routes/codraft.ts
services/worker/src/security/__init__.py
services/worker/src/security/phi_guard.py
services/worker/src/tasks/__init__.py
services/worker/src/tasks/generate_section.py
services/worker/src/tasks/claim_verifier.py
services/worker/src/tasks/peer_review.py
services/worker/src/tasks/export_pipeline.py
services/worker/src/tasks/submission_validator.py
services/worker/src/tasks/translate_abstract.py
services/worker/src/tasks/repro_bundle.py
services/worker/src/artifacts/__init__.py
services/worker/src/artifacts/manifest_validate.py
services/collab/package.json
services/collab/tsconfig.json
services/collab/src/server.ts
services/web/src/components/manuscripts/ImradEditor.tsx
services/web/src/components/manuscripts/EditorToolbar.tsx
services/web/src/components/manuscripts/ArtifactPicker.tsx
services/web/src/components/manuscripts/AICodrawer.tsx
services/web/src/components/manuscripts/DictationButton.tsx
services/web/src/components/manuscripts/ClaimLintPanel.tsx
services/web/src/components/manuscripts/AuditTrail.tsx
services/web/src/components/manuscripts/extensions/ArtifactEmbedNode.ts
services/web/src/pages/ManuscriptsDashboard.tsx
services/web/src/offline/indexedDbDraftCache.ts
docs/manuscript_engine/USAGE.md
CHANGELOG_PHASE_B.md
```

---

## Acceptance Checklist

- [x] PHI guard blocks + location-only reporting
- [x] Governance gate enforced for LIVE exports/external calls
- [x] Revisions append-only with rollback
- [x] Editor supports IMRaD + collaboration + artifact embeds
- [x] Claim verifier + linking UI working
- [x] Export formats: docx/pdf/latex_zip
- [x] Submission validator & redaction
- [x] Docs updated
- [ ] E2E test green (requires setup)
