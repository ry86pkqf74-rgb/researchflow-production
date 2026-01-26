# Manuscript Engine - Gap Analysis

**Generated**: 2026-01-18
**Existing Services**: 22 files
**Total PRD Tasks**: 100 + 6 setup + 3 verification = 109 tasks

## Executive Summary

**Overall Status**: ~22% Complete (22 existing services, many more needed)

- ✅ **Phase 4 (Writing Assistance)**: ~60% complete (14/20 tasks have services)
- ⚠️ **Phase 0 (Setup)**: Partially complete (directory structure exists, some types)
- ❌ **Phase 1 (Data Integration)**: ~20% complete (4/20 tasks)
- ❌ **Phase 2 (Literature)**: 5% complete (1/20 tasks)
- ❌ **Phase 3 (Structure)**: 10% complete (prompts exist, services missing)
- ❌ **Phase 5 (Review/Export)**: 5% complete (1/20 tasks)

---

## Existing Services (22 files)

### Phase 1: Data Integration (4 services exist)
- ✅ `data-mapper.service.ts` (T1)
- ✅ `data-tagger.service.ts` (T2)
- ✅ `phi-guard.service.ts` (T6) - CRITICAL
- ✅ `version-control.service.ts` (T9)

### Phase 2: Literature (1 service exists)
- ✅ `citation-manager.service.ts` (T24)

### Phase 4: Writing Assistance (14 services exist)
- ✅ `abbreviation.service.ts` (T74)
- ✅ `citation-suggester.service.ts` (T77)
- ✅ `claim-highlighter.service.ts` (T78)
- ✅ `claim-verifier.service.ts` (T64)
- ✅ `clarity-analyzer.service.ts` (T70)
- ✅ `claude-writer.service.ts` (T62)
- ✅ `grammar-checker.service.ts` (T63)
- ✅ `medical-nlp.service.ts` (T68)
- ✅ `openai-drafter.service.ts` (T61)
- ✅ `paraphrase.service.ts` (T73 - lit-paraphrase)
- ✅ `readability.service.ts` (T75)
- ✅ `sentence-builder.service.ts` (T72)
- ✅ `synonym-finder.service.ts` (T67)
- ✅ `tone-adjuster.service.ts` (T66)
- ✅ `transition-suggester.service.ts` (T65)

### Phase 5: Export (1 service exists)
- ✅ `export.service.ts` (possibly T85/T86)
- ✅ `compliance-checker.service.ts` (possibly T82-T84)

### Supporting Files (6 files exist)
- ✅ `src/prompts/abstract-generator.prompt.ts` (T8)
- ✅ `src/prompts/section-prompts/` (5 files - T71)
  - abstract.prompt.ts
  - discussion.prompt.ts
  - introduction.prompt.ts
  - methods.prompt.ts
  - results.prompt.ts
- ✅ `src/templates/phrase-library.ts` (T79)
- ✅ `src/templates/table-templates.ts` (T7)
- ✅ `src/types/manuscript.types.ts` (P0-4)
- ✅ `src/types/imrad.types.ts` (P0-4)

---

## Missing Services by Phase

### Phase 0: Package Setup (Missing 3 tasks)

- ❌ P0-5: Create database migration for manuscript tables
- ❌ P0-6: Update root workspace to include manuscript-engine
- ⚠️ P0-3: Verify tsconfig.json is properly configured
- ⚠️ P0-4: Missing citation.types.ts

### Phase 1: Data Integration (Missing 16 services)

- ❌ T3: `visualization.service.ts` - Chart generation
- ❌ T4: `data-citation.service.ts` - Data citations with audit hash
- ❌ T5: `data-filter.types.ts` - Filter criteria types
- ❌ T10: `data-validator.ts` (utils) - Validate section data
- ❌ T11: `manuscript-data.routes.ts` (orchestrator) - API routes
- ❌ T12: `data-lineage.service.ts` - Trace data to source
- ❌ T13: `chart-embed.service.ts` - Figure numbering/captions
- ❌ T14: `pre-draft-validator.service.ts` - Validate before draft
- ❌ T15: `comparison-importer.service.ts` - Import comparisons
- ❌ T16: `data-sync.service.ts` - Real-time updates (EventEmitter)
- ❌ T17: `metadata-extractor.ts` (utils) - Extract metadata
- ❌ T18: `quarantine.service.ts` - AES-256 encryption
- ❌ T19: `data-search.service.ts` - Cmd+K search
- ❌ T20: `data-integration.test.ts` (integration test)

### Phase 2: Literature Integration (Missing 19 services)

- ❌ T21: `pubmed.service.ts` - PubMed API integration
- ❌ T22: `semantic-scholar.service.ts` - Semantic Scholar API
- ❌ T23: `lit-review.service.ts` - Literature review generation
- ❌ T25: `gap-analysis.prompt.ts` - Gap analysis prompts
- ❌ T26: `citation-inserter.types.ts` - Citation UI types
- ❌ T27: `arxiv.service.ts` - arXiv integration
- ❌ T28: `lit-matrix.service.ts` - Systematic review matrix
- ❌ T29: `plagiarism-check.service.ts` - N-gram similarity
- ❌ T30: `citation-export.ts` (utils) - BibTeX/RIS/EndNote export
- ❌ T31: `lit-watcher.service.ts` - Monitor new publications
- ❌ T32: `keyword-extractor.ts` (utils) - Extract keywords
- ❌ T33: `lit-summary-embed.service.ts` - Embed summaries
- ❌ T34: `conflict-detector.service.ts` - Detect conflicting findings
- ❌ T35: `zotero.service.ts` - Zotero integration
- ❌ T36: Already exists as `paraphrase.service.ts`
- ❌ T37: `search-history.types.ts` - Search history types
- ❌ T38: `citation-formatter.service.ts` - AMA/APA/Vancouver
- ❌ T39: `relevance-scorer.service.ts` - Score citation relevance
- ❌ T40: `literature.test.ts` (integration test)

### Phase 3: Structure Building (Missing 18 services)

- ❌ T41: `imrad-templates.ts` (templates) - IMRaD/case/PRISMA templates
- ❌ T42: `abstract-generator.service.ts` - Generate abstracts
- ❌ T43: `introduction-builder.service.ts` - Build introduction
- ❌ T44: `methods-populator.service.ts` - Auto-fill methods
- ❌ T45: `results-scaffold.service.ts` - Build results structure
- ❌ T46: `discussion-builder.service.ts` - Discussion sections
- ❌ T47: `references-builder.service.ts` - Reference list
- ❌ T48: `acknowledgments.service.ts` - Acknowledgments generator
- ❌ T49: `figure-table-inserter.types.ts` - Figure/table placement types
- ❌ T50: `word-count-tracker.service.ts` - Track word counts
- ❌ T51: `outline-expander.service.ts` - Expand outlines to prose
- ❌ T52: `section-reorder.types.ts` - Section reordering types
- ❌ T53: `journal-templates/nejm.ts` - NEJM template
- ❌ T54: `journal-templates/lancet.ts` - Lancet template
- ❌ T55: `journal-templates/jama.ts` - JAMA template
- ❌ T56: `journal-templates/nature-medicine.ts` - Nature Medicine template
- ❌ T57: `title-generator.service.ts` - Generate titles
- ❌ T58: `author-manager.service.ts` - ORCID, affiliations
- ❌ T59: `branch-manager.service.ts` - Versioned branching
- ❌ T60: `structure.test.ts` (integration test)

### Phase 4: Writing Assistance (Missing 6 tasks)

- ❌ T69: `collaborative-editor.types.ts` - Editor types
- ❌ T76: `co-writer-mode.types.ts` - Live AI suggestions types
- ❌ T80: `writing-tools.test.ts` (integration test)
- ⚠️ Need to verify existing services match specifications

### Phase 5: Review, Export & Compliance (Missing 19 services)

- ❌ T81: `peer-review.service.ts` - Simulate peer review
- ❌ T82: `consort-checker.service.ts` - CONSORT 2010 checklist
- ❌ T83: `strobe-checker.service.ts` - STROBE checklist
- ❌ T84: `prisma-checker.service.ts` - PRISMA 2020 checklist
- ❌ T85: `docx-export.service.ts` - Word export
- ❌ T86: `pdf-export.service.ts` - PDF export
- ❌ T87: `latex-export.service.ts` - LaTeX export
- ❌ T88: `submission-packager.service.ts` - Package for submission
- ❌ T89: `cover-letter.service.ts` - Generate cover letter
- ❌ T90: `revision-tracker.service.ts` - Track revisions
- ❌ T91: `response-letter.service.ts` - Response to reviewers
- ❌ T92: `icmje-form.service.ts` - ICMJE COI form
- ❌ T93: `author-agreement.service.ts` - Author contributions
- ❌ T94: `data-availability.service.ts` - Data statement
- ❌ T95: `preprint-submitter.service.ts` - bioRxiv/medRxiv
- ❌ T96: `journal-finder.service.ts` - Suggest journals
- ❌ T97: `final-phi-scan.service.ts` - CRITICAL final PHI scan
- ❌ T98: `audit-report.service.ts` - Generate audit report
- ❌ T99: `archive.service.ts` - ZIP archive creation
- ❌ T100: `full-workflow.test.ts` (e2e test)

### Verification Tasks (Missing 3)

- ❌ V1: Build and test entire package
- ❌ V2: Verify exports and integration
- ❌ V3: Security verification (PHI scanning)

---

## Export Issues

**CRITICAL**: Only 7 services exported from `src/services/index.ts`

Currently exported:
```typescript
export * from './phi-guard.service';
export * from './data-mapper.service';
export * from './data-tagger.service';
export * from './version-control.service';
export * from './citation-manager.service';
export * from './export.service';
export * from './compliance-checker.service';
```

Missing exports (15 services):
- abbreviation.service
- citation-suggester.service
- claim-highlighter.service
- claim-verifier.service
- clarity-analyzer.service
- claude-writer.service
- grammar-checker.service
- medical-nlp.service
- openai-drafter.service
- paraphrase.service
- readability.service
- sentence-builder.service
- synonym-finder.service
- tone-adjuster.service
- transition-suggester.service

---

## Implementation Priority

### 🔴 **HIGH PRIORITY (Phase 0 & Critical Services)**

1. **P0-4**: Add missing `citation.types.ts`
2. **P0-5**: Create database migration
3. **P0-6**: Verify workspace configuration
4. **Fix exports**: Add all 15 missing service exports to index.ts
5. **T97**: `final-phi-scan.service.ts` (CRITICAL for Phase 5)

### 🟠 **MEDIUM PRIORITY (Complete Phase 1)**

Complete Phase 1 Data Integration (16 missing services):
- T3, T4, T5, T10-T20

### 🟡 **MEDIUM-LOW PRIORITY (Literature & Structure)**

- Phase 2: Literature services (19 tasks)
- Phase 3: Structure services (18 tasks)

### 🟢 **LOW PRIORITY (Verification & Polish)**

- Phase 4: Verify existing services
- Phase 5: Export and compliance services
- Final verification tasks

---

## Next Steps

1. **Update activity log** in MANUSCRIPT_ENGINE_PRD.md
2. **Fix export issues** (add 15 missing exports)
3. **Complete Phase 0** setup tasks
4. **Implement Phase 1** missing services
5. **Write tests** for each new service
6. **Mark tasks as `passes: true`** in PRD as completed

---

## Test Coverage Status

**Existing Tests**: 1 integration test file
**Required Tests**:
- T20: data-integration.test.ts
- T40: literature.test.ts
- T60: structure.test.ts
- T80: writing-tools.test.ts
- T100: full-workflow.test.ts

**Current Coverage**: Unknown (need to run `npm test` in packages/manuscript-engine)
**Target Coverage**: >80%
