# Integration Roadmap: Phases 2, 3, and 5

## Current Status (2026-01-18)

### ✅ DEPLOYED TO MAIN BRANCH (7 Commits)

**Commit History:**
1. **0149e95** - PRD v1.0
2. **2c022f7** - Package structure and core types
3. **6c20b22** - PHI Guard, Data Mapper, Data Tagger
4. **11df920** - Version Control, templates, tests
5. **9b95f62** - Services index and test config
6. **df0bf6f** - Literature and export services
7. **457b71f** - PRD v2.0
8. **79a8975** - Phase 4 AI Writing Tools (JUST DEPLOYED)

**Total Services Live:** 22 services
**Test Coverage:** 90%+
**Package Version:** 2.0.0

---

## Phase Integration Priority

### Priority 1: IMMEDIATE VALUE (Week 1-2)

**Goal**: Add features users will use immediately

**Services to Integrate:**
1. **AbstractGeneratorService** (Phase 3)
   - 250-word structured abstracts
   - Highest user demand
   - Builds on existing AI router
   - **Effort**: 2 days
   - **Files**: `src/services/abstract-generator.service.ts`

2. **MethodsPopulatorService** (Phase 3)
   - Auto-populate from data metadata
   - Biggest time saver for researchers
   - **Effort**: 2 days
   - **Files**: `src/services/methods-populator.service.ts`

3. **ResultsScaffoldService** (Phase 3)
   - Data-driven results generation
   - Integrates with existing DataMapperService
   - **Effort**: 2 days
   - **Files**: `src/services/results-scaffold.service.ts`

**Deliverable**: Draft generation for 3 key sections (Abstract, Methods, Results)

---

### Priority 2: LITERATURE POWER (Week 3-4)

**Goal**: Enable comprehensive literature integration

**Services to Integrate:**
1. **PubMedService** (Phase 2)
   - Search and citation integration
   - Core functionality for medical research
   - **Effort**: 3 days
   - **Dependencies**: None
   - **Files**: `src/services/pubmed.service.ts`

2. **CitationFormatterService** (Phase 2)
   - 5 citation styles (AMA, APA, Vancouver, NLM, Chicago)
   - Required for export
   - **Effort**: 2 days
   - **Files**: `src/services/citation-formatter.service.ts`

3. **SemanticScholarService** (Phase 2)
   - Paper summaries and abstracts
   - Enhances literature review
   - **Effort**: 2 days
   - **Files**: `src/services/semantic-scholar.service.ts`

4. **LitReviewService** (Phase 2)
   - Generate literature review sections
   - AI-powered synthesis
   - **Effort**: 3 days
   - **Files**: `src/services/lit-review.service.ts`

**Deliverable**: Complete literature search and citation pipeline

---

### Priority 3: STRUCTURE COMPLETION (Week 5-6)

**Goal**: Complete IMRaD manuscript generation

**Services to Integrate:**
1. **IntroductionBuilderService** (Phase 3)
   - Background + gap + objectives
   - Integrates with LitReviewService
   - **Effort**: 3 days
   - **Files**: `src/services/introduction-builder.service.ts`

2. **DiscussionBuilderService** (Phase 3)
   - Findings + literature comparison
   - Complex AI prompts
   - **Effort**: 3 days
   - **Files**: `src/services/discussion-builder.service.ts`

3. **ReferencesBuilderService** (Phase 3)
   - Auto-build reference lists
   - Integrates with CitationManagerService
   - **Effort**: 2 days
   - **Files**: `src/services/references-builder.service.ts`

4. **TitleGeneratorService** (Phase 3)
   - AI-powered title generation
   - High user value
   - **Effort**: 1 day
   - **Files**: `src/services/title-generator.service.ts`

5. **KeywordGeneratorService** (Phase 3)
   - MeSH term generation
   - Journal submission requirement
   - **Effort**: 2 days
   - **Files**: `src/services/keyword-generator.service.ts`

**Deliverable**: Complete IMRaD manuscript generation pipeline

---

### Priority 4: CRITICAL COMPLIANCE (Week 7-8)

**Goal**: Production-ready with full compliance

**Services to Integrate:**
1. **PhiAuditService** (Phase 5) 🔴 CRITICAL
   - Final PHI scan before export
   - Fail-closed design
   - **Effort**: 2 days
   - **Priority**: HIGHEST
   - **Files**: `src/services/phi-audit.service.ts`

2. **ApprovalGateService** (Phase 5) 🔴 GOVERNANCE
   - Human attestation workflow
   - Multi-approver support
   - **Effort**: 3 days
   - **Priority**: HIGH
   - **Files**: `src/services/approval-gate.service.ts`

3. **ManuscriptAuditService** (Phase 5)
   - Hash-chained audit logs
   - Immutable trail
   - **Effort**: 2 days
   - **Files**: `src/services/manuscript-audit.service.ts`

4. **PeerReviewSimService** (Phase 5)
   - AI-simulated peer review
   - High user value
   - **Effort**: 3 days
   - **Files**: `src/services/peer-review-sim.service.ts`

**Deliverable**: Production-grade security and compliance

---

### Priority 5: COLLABORATION & POLISH (Week 9-10)

**Goal**: Multi-user workflows and UX refinement

**Services to Integrate:**
1. **CollaborationService** (Phase 5)
   - Co-author management
   - RBAC integration
   - **Effort**: 4 days
   - **Files**: `src/services/collaboration.service.ts`

2. **RevisionTrackerService** (Phase 5)
   - Track changes with diffs
   - Version comparison
   - **Effort**: 2 days
   - **Files**: `src/services/revision-tracker.service.ts`

3. **ProgressTrackerService** (Phase 5)
   - Progress metrics and analytics
   - User dashboard
   - **Effort**: 2 days
   - **Files**: `src/services/progress-tracker.service.ts`

4. **SummaryReportService** (Phase 5)
   - Post-draft analytics
   - Compliance summary
   - **Effort**: 2 days
   - **Files**: `src/services/summary-report.service.ts`

**Deliverable**: Collaborative editing and user analytics

---

### Priority 6: ADVANCED FEATURES (Week 11-12)

**Goal**: Complete feature set for GA launch

**Remaining Services:**
- BlindingService (Phase 5)
- PlagiarismScannerService (Phase 5)
- SubmissionService (Phase 5)
- OrcidService (Phase 5)
- AccessibilityService (Phase 5)
- BackupService (Phase 5)
- TranslationService (Phase 5)
- RejectionAnalyzerService (Phase 5)
- GapAnalysisService (Phase 2)
- ArXivService (Phase 2)
- ZoteroService (Phase 2)
- AuthorManagerService (Phase 3)
- BranchManagerService (Phase 3)
- AcknowledgmentsService (Phase 3)
- COIDisclosureService (Phase 3)
- AppendicesBuilderService (Phase 3)

**Effort**: 3-4 weeks for complete integration
**Priority**: MEDIUM-LOW (polish features)

---

## Integration Workflow

### Step-by-Step Process

**For Each Service:**

1. **Locate Source Code**
   ```bash
   # Phase 1 Enhanced
   cat /private/tmp/claude/-Users-lhglosser/tasks/ae72e11.output
   
   # Phase 2
   cat /private/tmp/claude/-Users-lhglosser/tasks/a53635d.output
   
   # Phase 3
   cat /private/tmp/claude/-Users-lhglosser/tasks/a7ed248.output
   
   # Phase 5
   cat /private/tmp/claude/-Users-lhglosser/tasks/a2ee1fa.output
   ```

2. **Extract Service Code**
   - Copy service file from agent output
   - Review for completeness
   - Check dependencies

3. **Integrate into Package**
   ```bash
   # Create service file
   vi /tmp/researchflow-work/packages/manuscript-engine/src/services/SERVICE_NAME.service.ts
   
   # Add to index.ts exports
   # Add tests
   # Update package.json if new dependencies
   ```

4. **Test Integration**
   ```bash
   cd /tmp/researchflow-work/packages/manuscript-engine
   npm test
   npm run test:coverage
   ```

5. **Commit and Push**
   ```bash
   git add src/services/SERVICE_NAME.service.ts
   git add src/__tests__/services/SERVICE_NAME.test.ts
   git add index.ts
   git commit -m "feat(manuscript-engine): add SERVICE_NAME

   - Integrates from Phase X agent output
   - [Brief description of functionality]
   - Tests included with 90%+ coverage
   
   Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
   git push origin main
   ```

---

## Quick Reference: Agent Output Files

| Phase | Agent ID | Output File | Services Count |
|-------|----------|-------------|----------------|
| Phase 1 Enhanced | ae72e11 | `/private/tmp/claude/-Users-lhglosser/tasks/ae72e11.output` | 8 |
| Phase 2 | a53635d | `/private/tmp/claude/-Users-lhglosser/tasks/a53635d.output` | 15+ |
| Phase 3 | a7ed248 | `/private/tmp/claude/-Users-lhglosser/tasks/a7ed248.output` | 14 |
| Phase 4 | a74c992 | `/Users/lhglosser/Desktop/manuscript-engine-phase4/` | 15 ✅ |
| Phase 5 | a2ee1fa | `/private/tmp/claude/-Users-lhglosser/tasks/a2ee1fa.output` | 18 |

---

## Dependency Graph

```
Priority 1 (Week 1-2)
├── AbstractGeneratorService
├── MethodsPopulatorService
└── ResultsScaffoldService

Priority 2 (Week 3-4)
├── PubMedService
├── CitationFormatterService
├── SemanticScholarService
└── LitReviewService
    └── Depends on: PubMedService

Priority 3 (Week 5-6)
├── IntroductionBuilderService
│   └── Depends on: LitReviewService
├── DiscussionBuilderService
│   └── Depends on: LitReviewService, CitationFormatterService
├── ReferencesBuilderService
│   └── Depends on: CitationFormatterService
├── TitleGeneratorService
└── KeywordGeneratorService

Priority 4 (Week 7-8)
├── PhiAuditService (CRITICAL)
├── ApprovalGateService (GOVERNANCE)
├── ManuscriptAuditService
└── PeerReviewSimService

Priority 5 (Week 9-10)
├── CollaborationService
├── RevisionTrackerService
├── ProgressTrackerService
└── SummaryReportService
```

---

## Testing Strategy

### Unit Tests
- Each service must have corresponding `.test.ts` file
- Target: 90%+ coverage per service
- Mock all external dependencies
- Test all public methods

### Integration Tests
- Test service interactions
- Validate data flow between services
- PHI protection verification
- Performance benchmarks

### E2E Tests
- Full manuscript generation workflow
- Multi-user collaboration scenarios
- Export with compliance checking
- Approval gate workflows

---

## Success Metrics

### Week-by-Week Targets

**Week 2:**
- 3 new services integrated (Priority 1)
- 25 total services
- Test coverage maintained at 90%+

**Week 4:**
- 7 new services integrated (Priority 1-2)
- 29 total services
- Literature search functional

**Week 6:**
- 12 new services integrated (Priority 1-3)
- 34 total services
- Complete IMRaD generation

**Week 8:**
- 16 new services integrated (Priority 1-4)
- 38 total services
- Production-ready with compliance

**Week 10:**
- 20 new services integrated (Priority 1-5)
- 42 total services
- Collaboration features live

**Week 12:**
- All 100 tasks completed
- 60+ total services
- Beta testing complete

---

## Rollback Plan

**If Integration Causes Issues:**

1. **Immediate Rollback:**
   ```bash
   git revert HEAD
   git push origin main
   ```

2. **Isolate Service:**
   - Comment out in index.ts
   - Deploy hotfix
   - Debug offline

3. **Recovery Steps:**
   - Restore previous working state
   - Review service dependencies
   - Fix issues in development branch
   - Re-deploy with additional tests

---

## Risk Mitigation

### High-Risk Integrations

1. **PhiAuditService**: Test exhaustively before deployment
2. **ApprovalGateService**: Validate RBAC integration
3. **PubMedService**: Handle API rate limits and downtime
4. **LitReviewService**: Prevent AI hallucinations

### Mitigation Strategies

- Feature flags for new services
- Gradual rollout (10% → 50% → 100% users)
- Monitoring and alerting
- Immediate rollback capability

---

## Next Steps

### IMMEDIATE (This Week)
1. Read Phase 3 agent output (`a7ed248.output`)
2. Extract AbstractGeneratorService code
3. Integrate and test
4. Push to main branch
5. Repeat for MethodsPopulatorService and ResultsScaffoldService

### SHORT-TERM (Next 2 Weeks)
1. Integrate Priority 2 services (PubMed, citations)
2. Build literature search UI components
3. Integration testing with real PubMed API

### MEDIUM-TERM (Weeks 5-8)
1. Complete IMRaD generation pipeline
2. Integrate critical compliance services
3. Security audit and penetration testing

### LONG-TERM (Weeks 9-12)
1. Collaboration features
2. Advanced features (translation, rejection analysis)
3. Beta testing with 50 researchers
4. General availability launch

---

## Appendix: Command Cheat Sheet

**View Agent Output:**
```bash
less /private/tmp/claude/-Users-lhglosser/tasks/a7ed248.output
```

**Extract Service Code:**
```bash
# Scroll to service definition, copy to clipboard
```

**Create New Service:**
```bash
cd /tmp/researchflow-work/packages/manuscript-engine
vi src/services/NEW_SERVICE.service.ts
```

**Run Tests:**
```bash
npm test
npm run test:coverage
```

**Commit Pattern:**
```bash
git add src/services/SERVICE.service.ts
git add src/__tests__/services/SERVICE.test.ts  
git add index.ts
git commit -m "feat(manuscript-engine): add SERVICE

- Description
- Tests included

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
git push origin main
```

---

**Document Version**: 1.0  
**Created**: 2026-01-18  
**Last Updated**: 2026-01-18  
**Next Review**: Weekly during active development

---

*This roadmap provides a clear path to complete the RALPH Manuscript Writing Module by integrating all services from background agent outputs. Follow the priority order for maximum value delivery.*
