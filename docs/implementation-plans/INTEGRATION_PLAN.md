# ResearchFlow Production - Comprehensive Integration Plan

## Executive Summary

This document outlines a phased approach to integrating improvements from the execution plans into the ResearchFlow production codebase. The analysis compares the 150 tasks across 13 execution plan files against the current implementation state.

## Current State Analysis

### Implemented Features (Complete/Partial)
- **App Shell & Navigation**: Adaptive navigation, sidebar with org selector, theme provider
- **Authentication**: Passport.js integration, session management, RBAC basics
- **Governance**: Mode switching (DEMO/LIVE), PHI engine, approval workflows
- **Workflow System**: 20-stage research workflow, stage definitions, workflow builder
- **Collaboration**: Real-time editing (Yjs), comments, artifact versioning
- **AI Integration**: AI router, LLM orchestration, cost optimization
- **Data Management**: Artifact versioning, graph relationships, claims/evidence linking
- **Conference Prep**: Stage 20 conference discovery, abstract generation

### Gaps Identified for Enhancement
1. **i18n/Multi-language**: No current implementation
2. **Keyboard Shortcuts**: Global shortcut manager missing
3. **Breadcrumbs**: Not implemented for deep navigation
4. **Stage Help Docs**: Inline documentation system
5. **Undo/Redo**: Stage edit history
6. **E2E Testing**: Comprehensive Playwright coverage
7. **Performance Metrics**: Web vitals tracking
8. **Service Worker**: Offline artifact viewing
9. **Admin Dashboards**: K8s monitoring, CI/CD status, queue status

---

## Phase 1: Web Shell Enhancements
**Priority: HIGH | Estimated Tasks: 10**

### 1.1 Breadcrumb Navigation (Task 11)
- Create `Breadcrumbs.tsx` component
- Integrate with wouter router
- Show path: Projects / {Name} / Workflow / Stage {N}

### 1.2 Keyboard Shortcuts (Task 17)
- Create global shortcuts manager
- `Ctrl+S`: Save current editor
- `g d`: Go to dashboard
- `g w`: Go to workflow
- Ignore when in input/textarea

### 1.3 Multi-language Support (Task 22)
- Add i18next configuration (already in deps)
- Create translation files (en.json, es.json)
- Add language selector to settings

### 1.4 Accessibility Improvements (Task 12)
- Add ARIA labels to all interactive elements
- Ensure focus rings visible
- Add ESLint jsx-a11y rules

### 1.5 Confirmation Dialogs (Task 14)
- Create `useConfirm` hook
- Danger variant with type-to-confirm
- Used for PHI access, deletes, exports

---

## Phase 2: Dashboard & UX Enhancements
**Priority: HIGH | Estimated Tasks: 15**

### 2.1 Dashboard Improvements (Task 3)
- Enhance PipelineDashboard with project progress bars
- Show workflow completion status
- Quick action buttons

### 2.2 Stage Tooltips (Task 5)
- Central STAGES definition with descriptions
- Tooltip on each stage in workflow view
- Keyboard accessible

### 2.3 Error Handling (Task 6)
- Enhance ErrorBoundary components
- User-friendly error messages
- Include traceId for support

### 2.4 Real-time Progress (Task 8)
- SSE endpoint for run events
- Progress bar updates
- Per-stage status indicators

### 2.5 Drag-and-Drop PHI Upload (Task 10)
- Enhance PhiDropzone component
- Show scan progress and results
- Redaction preview

### 2.6 Stage Transition Animations (Task 20)
- Framer Motion animations
- Respect prefers-reduced-motion

### 2.7 Dashboard Widgets (Task 21)
- Draggable widget grid
- Job queue, costs, K8s status
- Persist layout to preferences

### 2.8 AI Routing Indicators (Task 23)
- Model tier badges (NANO/MINI/FRONTIER)
- Show in stage header and job list

### 2.9 Run Recovery Panel (Task 24)
- Recovery wizard for interrupted runs
- Resume/retry options
- Log download

### 2.10 Onboarding Tour (Task 25)
- Tour component for first-time users
- Highlight key features
- Persist completion to preferences

---

## Phase 3: Workflow Stage UI Completion
**Priority: HIGH | Estimated Tasks: 20**

### 3.1 Stage Framework (Tasks 26-45)
- Verify StageLayout component
- Ensure all 20 stages have proper UI
- Schema-driven input forms
- Artifact output panels

### 3.2 Stage 20 Exports (Tasks 46-50)
- PDF poster generation
- PPTX slide exporter
- Compliance checklist viewer
- ZIP bundle downloader
- Conference keyword search

### 3.3 Validation & Undo (Tasks 51, 53)
- JSON schema validation for all stages
- Undo/redo hook for stage edits

### 3.4 Branching Logic (Task 54)
- Workflow graph with conditions
- Skip optional stages (e.g., PHI scan in DEMO)

### 3.5 Manifest Editor (Task 56)
- Artifact manifest inline editor
- Schema validation
- Audit trail

### 3.6 Stage Help Docs (Task 52)
- Help drawer component
- Stage-specific documentation
- Link from stage header

---

## Phase 4: Backend API & AI Router
**Priority: MEDIUM | Estimated Tasks: 12**

### 4.1 API Contracts (Task 85)
- OpenAPI spec maintenance
- Generate TypeScript client types
- CI validation

### 4.2 Multi-tenancy (Task 81)
- Tenant selector enhancement
- Tenant-scoped queries
- Header/JWT claims

### 4.3 AI Router (Task 79)
- Cost estimation display
- Model tier selection UI
- Routing rules engine

### 4.4 Manuscript Engine (Task 94)
- Manuscript section assembly
- Template selection
- Multi-format export

### 4.5 User Preferences API (Task 2 enhancement)
- Persist theme, locale, dashboard layout
- Sync across sessions

---

## Phase 5: Security & Compliance
**Priority: HIGH | Estimated Tasks: 20**

### 5.1 DEMO Mode Guards (Task 96)
- Restrict upload/PHI in DEMO
- Synthetic data enforcement
- Clear mode indicators

### 5.2 Session Management (Task 111)
- Timeout warning modals
- Session extension
- Auto-logout

### 5.3 CSRF Protection (Task 113)
- Token cookie + header
- Auto-retry on 403
- Verify on mutations

### 5.4 Two-Factor Auth (Task 112)
- TOTP setup wizard
- Recovery codes
- MFA enforcement

### 5.5 PHI Approval Workflow (Task 97)
- Request/approve/deny flow
- Admin inbox
- Audit trail

### 5.6 Redaction Previews (Task 98)
- Findings visualization
- Side-by-side redaction
- Confidence scores

### 5.7 Encryption Toggles (Task 106)
- Per-project encryption
- KMS integration
- Audit logging

### 5.8 Breach Notifications (Task 108)
- Banner system
- Acknowledgement tracking
- Admin controls

### 5.9 Data Retention (Task 115)
- TTL enforcement
- Legal hold flags
- Scheduled purge jobs

### 5.10 Cost Display (Task 110)
- AI cost per stage
- Monthly cost dashboard
- Budget alerts

---

## Phase 6: Infrastructure & Admin
**Priority: MEDIUM | Estimated Tasks: 10**

### 6.1 Migration Status (Task 82)
- View applied/pending migrations
- Admin-only access

### 6.2 K8s Monitoring (Task 89)
- Pod status dashboard
- Restart counts, age
- Node utilization

### 6.3 CI/CD Status (Task 90)
- GitHub Actions integration
- Recent runs display
- Failure alerts

### 6.4 Queue Status (Task 55)
- BullMQ queue viewer
- Waiting/active/failed counts
- Dashboard widget

### 6.5 HPA Controls (Task 92)
- Replica scaling UI
- Admin-only with confirm
- Audit logging

---

## Phase 7: Testing & Performance
**Priority: HIGH | Estimated Tasks: 12**

### 7.1 Unit Tests (Task 116)
- Vitest configuration
- Component test coverage
- Testing Library integration

### 7.2 E2E Tests (Task 117)
- Playwright setup
- Auth stubs for DEMO
- Stage navigation coverage

### 7.3 A11y Testing (Task 127)
- axe-core integration
- CI enforcement
- Violation reports

### 7.4 Stage E2E Coverage (Task 75)
- Data-driven tests for stages 1-20
- PHI gating verification
- Export blocking tests

### 7.5 Lazy Loading (Task 119)
- Route-level code splitting
- Defer heavy dependencies
- Reduce initial bundle

### 7.6 Caching (Task 121)
- TanStack Query caching
- Stale-while-revalidate
- Cache invalidation

### 7.7 Web Vitals (Task 120)
- LCP, CLS, TTFB tracking
- Backend metrics endpoint
- Performance dashboard

### 7.8 Service Worker (Task 134)
- Offline artifact viewing
- Cache metadata
- Offline mode banner

---

## Phase 8: Documentation & Deployment
**Priority: LOW | Estimated Tasks: 15**

### 8.1 Help Section (Task 136)
- README rendering
- Stage documentation
- Search functionality

### 8.2 Inline Docs (Task 137)
- Component help keys
- Tooltip/drawer system
- Context-sensitive help

### 8.3 Onboarding Wizard (Task 138)
- Step-by-step setup
- Sample workflow execution
- Feature discovery

### 8.4 WCAG Compliance (Task 139)
- Contrast audit
- Keyboard navigation
- Screen reader testing

### 8.5 Changelog Viewer (Task 148)
- Git log formatting
- Release notes
- Version comparison

### 8.6 Update Notifier (Task 150)
- Version comparison
- Update banner
- Migration notes

---

## Implementation Order

### Week 1: Foundation
1. Breadcrumbs navigation
2. Keyboard shortcuts
3. i18n scaffolding
4. Confirmation dialogs
5. ARIA improvements

### Week 2: UX Polish
1. Stage tooltips with STAGES constant
2. Dashboard widgets framework
3. Stage transition animations
4. Error handling improvements
5. AI routing indicators

### Week 3: Stage Completion
1. Stage help drawer
2. Undo/redo for stages
3. Stage 20 export pipeline
4. PHI gating enforcement
5. Branching logic

### Week 4: Security
1. Session timeout
2. CSRF protection
3. PHI approval workflow
4. Redaction previews
5. DEMO guards

### Week 5: Testing & Performance
1. Vitest setup
2. Playwright E2E
3. A11y automation
4. Lazy loading
5. Service worker

### Week 6: Admin & Docs
1. Admin dashboards
2. Help section
3. Onboarding wizard
4. Changelog viewer
5. Final polish

---

## Success Criteria

1. All 20 workflow stages have complete UI
2. i18n supports English and Spanish
3. E2E test coverage for critical paths
4. WCAG 2.1 compliance
5. PHI gating enforced in LIVE mode
6. Session security with 2FA option
7. Admin dashboards for ops visibility
8. Performance metrics tracking
9. Offline artifact viewing capability
10. Comprehensive documentation

---

## Risk Mitigation

- **Breaking Changes**: Small commits with tests
- **Performance Regression**: Benchmark before/after
- **Security Gaps**: Security review checklist
- **Accessibility**: Automated a11y testing in CI
- **Data Loss**: Backup procedures documented

---

## Next Steps

1. Review and approve this plan
2. Begin Phase 1 implementation
3. Regular progress updates
4. Iterative testing and deployment
