# Manuscript Studio Wiring Audit

**Audit Date**: January 27, 2026
**Repository**: ResearchFlow Production
**Auditor**: Claude Coworker

---

## Executive Summary

| Component | Described | Implemented | Wired | Status |
|-----------|-----------|-------------|-------|--------|
| Database Schema | ✅ | ✅ | ✅ | COMPLETE |
| Backend Routes (Branching) | ✅ | ✅ | ✅ | COMPLETE |
| Backend Routes (Generation) | ✅ | ✅ | ✅ | COMPLETE |
| Backend Routes (CRUD) | ✅ | ❌ | ❌ | **MISSING** |
| Backend Routes (Comments) | ✅ | ❌ | ❌ | **MISSING** |
| Backend Routes (Doc Persistence) | ✅ | ❌ | ❌ | **MISSING** |
| Service Library (64 svc) | ✅ | ✅ | ⚠️ | PARTIAL |
| Frontend Pages | ✅ | ⚠️ | ⚠️ | PARTIAL |
| PHI Integration | ✅ | ✅ | ⚠️ | PARTIAL |

**Overall Readiness**: ~50% - Strong foundation, critical CRUD/persistence gaps

---

## 1. Described (in docs/README)

### From Execution Plan
- [x] Generate manuscript sections (IMRaD)
- [x] Collaborative editing (Yjs)
- [x] Review/comments
- [x] PHI gating
- [x] Version control/branching
- [x] Provenance logging

### From PRD-RALPH-MANUSCRIPT-MODULE-V2.md
- [x] Section generation with AI
- [x] Word budget validation
- [x] Journal style templates
- [x] Abstract generator (structured/unstructured)
- [x] Citation management

---

## 2. Implemented (code exists)

### Database Tables (migrations/003_create_manuscript_tables.sql)

| Table | Columns | Status |
|-------|---------|--------|
| `manuscripts` | id, title, status, template_type, citation_style, research_id | ✅ EXISTS |
| `manuscript_versions` | id, manuscript_id, content, content_hash, change_description | ✅ EXISTS |
| `manuscript_authors` | id, manuscript_id, orcid, name, affiliation, is_corresponding | ✅ EXISTS |
| `manuscript_citations` | id, manuscript_id, pubmed_id, doi, mesh_terms | ✅ EXISTS |
| `manuscript_audit_log` | id, manuscript_id, event_type, user_id, prev_hash, new_hash | ✅ EXISTS |

### Backend Routes

| File | Endpoints | Import Line |
|------|-----------|-------------|
| `manuscript-branches.ts` | POST/GET branch, POST merge, DELETE branch | Line 52 |
| `manuscript-generation.ts` | generate/results, generate/discussion, generate/title-keywords, generate/full, validate/section, budgets | Line 91 |
| `manuscript/data.routes.ts` | data, data/select, data/preview | **NOT IMPORTED** |

### Service Library (packages/manuscript-engine/src/services/)

```
✅ abstract-generator.service.ts
✅ appendices-builder.service.ts
✅ author-manager.service.ts
✅ branch-manager.service.ts
✅ citation-manager.service.ts
✅ claim-verifier.service.ts
✅ compliance-checker.service.ts
✅ discussion-builder.service.ts
✅ introduction-builder.service.ts
✅ methods-populator.service.ts
✅ results-scaffold.service.ts
✅ title-generator.service.ts
✅ keyword-generator.service.ts
✅ word-budget-validator.service.ts
... (64 total services)
```

### Frontend Components

| File | Purpose | Status |
|------|---------|--------|
| `pages/manuscript-editor.tsx` | Main editor | ⚠️ Calls non-existent endpoints |
| `components/ui/manuscript-workspace.tsx` | Branch workspace | ⚠️ Demo data fallback |
| `components/sections/manuscript-branching.tsx` | Branch list | ⚠️ Demo data fallback |

---

## 3. Wired (actually works in docker)

### Currently Mounted Routes (index.ts)

| Line | Mount Path | Route File | Status |
|------|------------|------------|--------|
| 144 | `/api/ros/manuscripts` | manuscript-branches.ts | ✅ WIRED |
| 238 | `/api/manuscript` | manuscript-generation.ts | ✅ WIRED |
| 142 | `/api/ros/comments` | comments.ts | ✅ WIRED (general) |

### Endpoint Status

| Endpoint | Backend | Frontend Calls | Works? |
|----------|---------|----------------|--------|
| `POST /api/ros/manuscripts/:id/branch` | ✅ | ❌ | ⚠️ Not used |
| `GET /api/ros/manuscripts/:id/branches` | ✅ | ❌ | ⚠️ Not used |
| `POST /api/ros/manuscripts/:id/merge` | ✅ | ❌ | ⚠️ Not used |
| `DELETE /api/ros/manuscripts/:id/branches/:name` | ✅ | ❌ | ⚠️ Not used |
| `POST /api/manuscript/generate/results` | ✅ | ✅ | ✅ WORKS |
| `POST /api/manuscript/generate/discussion` | ✅ | ✅ | ✅ WORKS |
| `POST /api/manuscript/generate/title-keywords` | ✅ | ⚠️ | ⚠️ Partial |
| `POST /api/manuscript/generate/full` | ✅ | ❌ | ⚠️ Not used |
| `POST /api/manuscript/validate/section` | ✅ | ❌ | ⚠️ Not used |
| `GET /api/manuscript/budgets` | ✅ | ❌ | ⚠️ Not used |
| `PUT /api/manuscript/budgets/:id` | ✅ | ❌ | ⚠️ Not used |

---

## 4. Issues Found

### Critical Gap #1: Missing Canonical CRUD Endpoint

**Required by Execution Plan Phase M1:**
```
POST   /api/manuscripts                     # Create manuscript
GET    /api/manuscripts                     # List manuscripts
GET    /api/manuscripts/:id                 # Get manuscript
GET    /api/manuscripts/:id/sections        # Get sections
GET    /api/manuscripts/:id/doc             # Get latest doc state
POST   /api/manuscripts/:id/doc/save        # Save snapshot
```

**Current Status**: NONE of these exist

**Frontend Impact**: `manuscript-editor.tsx` calls `POST /api/ros/manuscripts` which doesn't create a manuscript

### Critical Gap #2: Missing Comments System for Manuscripts

**Required by Execution Plan Phase M3:**
```
GET    /api/manuscripts/:id/comments        # Get comments
POST   /api/manuscripts/:id/comments        # Add comment
POST   /api/manuscripts/:id/comments/:cid/resolve  # Resolve
```

**Current Status**: General comments route exists at `/api/ros/comments` but not manuscript-specific

**Tables Needed**: `manuscript_comments` with anchor positions

### Critical Gap #3: Missing AI Refine Endpoint

**Required by Execution Plan Phase M4:**
```
POST   /api/manuscripts/:id/sections/:sid/refine   # Refine with AI
```

**Current Status**: NOT IMPLEMENTED

**Key Feature**: Must return diff structure, not overwrite content

### Critical Gap #4: Document Persistence Not Wired

**Required by Execution Plan Phase M2:**
- Yjs state persistence (`yjs_doc_state BYTEA`)
- Content text for search/PHI scan
- Version tracking per section

**Current Status**: Schema designed but no API endpoints

---

## 5. Alignment with Execution Plan Track M

| Phase | Requirement | Status | Action Needed |
|-------|-------------|--------|---------------|
| M0 | Wiring Audit | ✅ | This document |
| M1 | Canonical `/api/manuscripts` | ❌ | Create routes file |
| M2 | Doc Persistence | ❌ | Add save/load endpoints |
| M3 | Comments System | ❌ | Add manuscript-specific comments |
| M4 | AI Refine (Diff) | ❌ | Add refine endpoint |
| M5 | PHI Gating | ⚠️ | Wire to manuscript routes |
| M6 | Generation UX | ⚠️ | Frontend work |
| M7 | E2E Tests | ❌ | Create test suite |
| M8 | Final Compose Check | ❌ | Docker verification |

---

## 6. Recommended Fix Order

### Phase M1: Canonical Endpoint Alignment
1. Create `services/orchestrator/src/routes/manuscripts.ts`
2. Implement CRUD endpoints
3. Mount at `/api/manuscripts` in index.ts
4. Add `/api/manuscripts/ping` health check

### Phase M2: Collaborative Document Persistence
1. Add `manuscript_docs` table migration
2. Implement `GET /:id/doc` endpoint
3. Implement `POST /:id/doc/save` endpoint with PHI scan

### Phase M3: Comments System
1. Add `manuscript_comments` table migration
2. Implement comments CRUD endpoints
3. Add thread and resolve functionality

### Phase M4: AI Refine
1. Create `POST /:id/sections/:sid/refine` endpoint
2. Return diff structure (original, proposed, diff)
3. Log provenance for AI calls

### Phase M5-M8: Polish
1. Wire PHI middleware to all manuscript AI routes
2. Polish generation UI
3. Create E2E tests
4. Docker compose verification

---

## 7. Files to Create/Modify

### New Files
- `services/orchestrator/src/routes/manuscripts.ts` (canonical CRUD)
- `migrations/005_manuscript_docs_comments.sql` (persistence + comments)
- `tests/e2e/manuscript-journey.spec.ts` (E2E tests)
- `scripts/verify-manuscript-studio.sh` (verification script)
- `docs/runbooks/manuscript-studio.md` (runbook)

### Modify Files
- `services/orchestrator/src/index.ts` (add route mount)
- `services/web/src/pages/manuscript-editor.tsx` (fix API calls)
- `services/web/src/components/ui/manuscript-workspace.tsx` (remove demo fallback)

---

## Conclusion

The Manuscript Studio has **solid foundational infrastructure** (database, services, branching) but **critical wiring gaps** for core CRUD operations, document persistence, and the comments system. Following the Track M phases in order will systematically address these gaps.

**Estimated Work**: 3-4 phases to reach functional MVP
