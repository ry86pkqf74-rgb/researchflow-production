# Implementation Plan: Document & Artifact Lifecycle Completion

## Overview
This plan covers the full integration of document lifecycle features including versioning, provenance, comments, branching, submissions, and conference prep.

## Phase 1: DB + Core Schema Alignment

### Migration: 0008_phase_h_document_lifecycle.sql
New tables to create:
- `artifact_edges` - Provenance graph edges
- `comments` - Inline/threaded comments with anchors
- `claims` - Claims from manuscripts
- `claim_evidence_links` - Evidence links for claims
- `artifact_shares` - External reviewer share links
- `submission_targets` - Journal/conference targets
- `submissions` - Submission tracking
- `reviewer_points` - Reviewer feedback
- `rebuttal_responses` - Rebuttal responses
- `submission_packages` - Submission bundles
- `manuscript_yjs_snapshots` - CRDT snapshots
- `manuscript_yjs_updates` - CRDT updates

Alter existing:
- `artifact_versions` - Add branch, parent_version_id, metadata columns

### Drizzle Schema Updates
- Add all new table definitions to packages/core/types/schema.ts
- Create insert schemas with Zod validation
- Export types

---

## Phase 2: Artifact Graph Service + Auto-Linking

### Files to create:
- `services/orchestrator/src/services/artifactGraphService.ts`
  - createEdge() with cycle prevention
  - getGraph() with depth/direction params
  - computeOutdated() for stale detection
  - wouldCreateCycle() using recursive CTE

- `services/orchestrator/src/routes/artifact-graph.ts`
  - GET /api/ros/artifacts/:artifactId/graph
  - POST /api/ros/artifact-edges
  - DELETE /api/ros/artifact-edges/:edgeId

### Auto-linking in workflow:
- Modify routes.ts stage executor to auto-create edges
- Stage dependency mapping for derived_from edges

---

## Phase 3: Comments Service (PHI-safe)

### Files to create:
- `services/orchestrator/src/services/commentService.ts`
  - createComment() with PHI scanning
  - listComments() with filters
  - resolveComment()
  - deleteComment() (soft delete)

- `services/orchestrator/src/routes/comments.ts`
  - POST /api/ros/comments
  - GET /api/ros/comments
  - PATCH /api/ros/comments/:id
  - DELETE /api/ros/comments/:id

### PHI Safety:
- Scan body with phi-engine before insert
- Return 409 with location-only findings if PHI detected
- Never store raw PHI unless steward override

---

## Phase 4: Versioning + Diff + Branching

### Files to create:
- `services/orchestrator/src/services/diffService.ts`
  - computeTextDiff() using diff-match-patch
  - generateDiffSummary()

- `services/orchestrator/src/routes/artifact-versions.ts`
  - GET /api/ros/artifact/:artifactId/versions
  - POST /api/ros/artifact/:artifactId/versions
  - POST /api/ros/artifact/:artifactId/compare
  - POST /api/ros/artifact/:artifactId/restore/:versionId

- `services/orchestrator/src/routes/manuscript-branches.ts`
  - POST /api/ros/manuscripts/:artifactId/branch
  - GET /api/ros/manuscripts/:artifactId/branches
  - POST /api/ros/manuscripts/:artifactId/merge

### Merge Strategy:
- Find LCA (lowest common ancestor) via parent chain walk
- Compute patches: base→source, base→target
- Detect conflicts via overlapping diff hunks
- Return conflict report or create merged version

---

## Phase 5: Claims + Evidence Linking

### Files to create:
- `services/orchestrator/src/services/claimService.ts`
  - createClaim() with PHI scanning
  - linkEvidence()
  - getCoverage() statistics

- `services/orchestrator/src/routes/claims.ts`
  - POST /api/ros/claims
  - GET /api/ros/claims
  - POST /api/ros/claims/:claimId/evidence
  - GET /api/ros/claims/:claimId/evidence
  - GET /api/ros/claims/coverage

---

## Phase 6: External Reviewer Share Links

### Files to create:
- `services/orchestrator/src/services/shareService.ts`
  - createShareLink() - generate token, store hash
  - validateShareToken()
  - revokeShare()

- `services/orchestrator/src/routes/shares.ts`
  - POST /api/ros/shares
  - GET /api/ros/shares
  - POST /api/ros/shares/:id/revoke

### RBAC Middleware Update:
- Check X-Share-Token header
- Allow read/comment based on permission
- Block version edits, exports, admin actions

---

## Phase 7: Submission + Rebuttal Tracking

### Files to create:
- `services/orchestrator/src/services/submissionService.ts`
  - createTarget()
  - createSubmission()
  - updateStatus()
  - addReviewerPoint()
  - addRebuttalResponse()
  - createPackage()

- `services/orchestrator/src/routes/submissions.ts`
  - POST /api/ros/submission-targets
  - GET /api/ros/submission-targets
  - POST /api/ros/submissions
  - GET /api/ros/submissions
  - PATCH /api/ros/submissions/:id
  - POST /api/ros/submissions/:id/reviewer-points
  - POST /api/ros/reviewer-points/:id/resolve
  - POST /api/ros/reviewer-points/:id/rebuttal-response
  - POST /api/ros/submissions/:id/package

---

## Phase 8: Conference Prep Provenance + PHI Scan

### Files to create:
- `services/worker/src/conference_prep/pptx_phi_scan.py`
  - scan_pptx_for_phi_locations()
  - Returns location-only findings (slide/shape/kind/hash)

### Updates:
- Map conference outputs to artifacts table
- Create artifact_edges for provenance
- Extend reproducibility bundle with conference manifests

---

## Phase 9: Web UI Components

### Files to create:
- `services/web/src/pages/artifact-graph.tsx`
- `services/web/src/components/graph/ArtifactGraphView.tsx`
- `services/web/src/components/comments/CommentPanel.tsx`
- `services/web/src/components/comments/InlineCommentMark.tsx`
- `services/web/src/components/versions/VersionHistoryPanel.tsx`
- `services/web/src/components/versions/DiffViewer.tsx`

### Updates:
- Update manuscript-branching.tsx with real APIs
- Add routes for graph page
- Update E2E mocks

---

## Phase 10: Tests + Documentation

### Test files:
- `services/worker/tests/test_pptx_phi_scan.py`
- Add integration tests for new endpoints

### Documentation:
- `docs/features/DOCUMENT_LIFECYCLE.md`
- `docs/features/REVIEWER_WORKFLOW.md`
- `docs/features/SUBMISSION_TRACKING.md`

---

## Commit Plan

1. feat(db): add artifact graph, comments, claims, shares, submissions schema
2. feat(core): extend drizzle schema for doc lifecycle tables
3. feat(orchestrator): artifact graph service + routes + auto-linking
4. feat(orchestrator): comments service + routes (PHI safe)
5. feat(orchestrator): branching + diff + restore APIs
6. feat(orchestrator): external share links for reviewers
7. feat(orchestrator): submission + rebuttal tracker
8. feat(worker): pptx PHI scan + conference provenance linking
9. feat(web): artifact graph UI + real version/diff/comment panels
10. test: add unit/integration coverage + update E2E mocks
11. docs: document document lifecycle + reviewer workflow + submission tracker
