# ResearchFlow Manuscript Engine - Ralph Loop PRD

## Overview

Build the `manuscript-engine` package for ResearchFlow Canvas - a comprehensive manuscript authoring system with PHI protection, literature integration, and regulatory compliance checking for healthcare research.

**Repository**: `https://github.com/ry86pkqf74rgb/researchflow-production`
**Target Package**: `packages/manuscript-engine/`
**Total Tasks**: 100 (across 6 phases)

## Completion Criteria

Output `<promise>MANUSCRIPT_ENGINE_COMPLETE</promise>` when ALL of the following are true:
- All 100 tasks have `passes: true`
- `npm run build` succeeds in `packages/manuscript-engine`
- `npm test` passes with >80% coverage
- No TypeScript compilation errors
- PHI scanning integrated at all data insertion points

## Phase Reference Files

The detailed implementation specifications are in these files:
- `PHASE_0_PACKAGE_SETUP.md` - Package scaffolding and types
- `PHASE_1_DATA_INTEGRATION.md` - Tasks 1-20: Data mapping, PHI guard, versioning
- `PHASE_2_LITERATURE_INTEGRATION.md` - Tasks 21-40: PubMed, citations, plagiarism
- `PHASE_3_STRUCTURE_BUILDING.md` - Tasks 41-60: IMRaD templates, generators
- `PHASE_4_WRITING_ASSISTANCE.md` - Tasks 61-80: AI drafting, grammar, claims
- `PHASE_5_REVIEW_EXPORT.md` - Tasks 81-100: Peer review, CONSORT, export

**IMPORTANT**: Read each phase file BEFORE implementing its tasks.

---

## Activity Log

<!-- Ralph updates this section after each iteration -->

### Latest Activity
- [ ] No activity yet - awaiting first iteration

---

## Project Plan

### Phase 0: Package Setup

```json
{
  "category": "setup",
  "task_id": "P0-1",
  "description": "Create packages/manuscript-engine directory structure",
  "steps": [
    "mkdir -p packages/manuscript-engine/src/{services,types,utils,templates,prompts,__tests__/{unit,integration,e2e}}",
    "Verify directory structure exists"
  ],
  "passes": false
}
```

```json
{
  "category": "setup",
  "task_id": "P0-2",
  "description": "Create package.json with workspace references",
  "steps": [
    "Create packages/manuscript-engine/package.json per PHASE_0_PACKAGE_SETUP.md",
    "Include dependencies: zod, uuid, date-fns",
    "Include workspace refs: @researchflow/core, @researchflow/phi-engine, @researchflow/ai-router",
    "Run npm install in monorepo root"
  ],
  "passes": false
}
```

```json
{
  "category": "setup",
  "task_id": "P0-3",
  "description": "Create tsconfig.json with path mappings",
  "steps": [
    "Create packages/manuscript-engine/tsconfig.json",
    "Extend from root tsconfig",
    "Add references to dependent packages",
    "Verify tsc --noEmit passes"
  ],
  "passes": false
}
```

```json
{
  "category": "setup",
  "task_id": "P0-4",
  "description": "Create core type definitions",
  "steps": [
    "Create src/types/manuscript.types.ts per PHASE_0",
    "Create src/types/imrad.types.ts per PHASE_0",
    "Create src/types/citation.types.ts per PHASE_0",
    "Export all types from src/types/index.ts"
  ],
  "passes": false
}
```

```json
{
  "category": "setup",
  "task_id": "P0-5",
  "description": "Create database migration for manuscript tables",
  "steps": [
    "Create migrations/20240118_001_create_manuscript_tables.sql",
    "Include: manuscripts, manuscript_versions, manuscript_authors, manuscript_citations, manuscript_audit_log",
    "Add hash-chain audit columns",
    "Verify SQL syntax is valid"
  ],
  "passes": false
}
```

```json
{
  "category": "setup",
  "task_id": "P0-6",
  "description": "Update root workspace to include manuscript-engine",
  "steps": [
    "Add 'packages/manuscript-engine' to root package.json workspaces",
    "Run npm install to link workspace",
    "Verify package is recognized with npm ls @researchflow/manuscript-engine"
  ],
  "passes": false
}
```

### Phase 1: Data Integration (Tasks 1-20)

```json
{
  "category": "data-integration",
  "task_id": "T1",
  "description": "Create data-mapper.service.ts",
  "steps": [
    "Read PHASE_1_DATA_INTEGRATION.md Task 1 specification",
    "Create packages/manuscript-engine/src/services/data-mapper.service.ts",
    "Implement ClinicalDataset to IMRaD section mapping",
    "Export service from src/services/index.ts"
  ],
  "passes": false
}
```

```json
{
  "category": "data-integration",
  "task_id": "T2",
  "description": "Create data-tagger.service.ts",
  "steps": [
    "Read PHASE_1_DATA_INTEGRATION.md Task 2 specification",
    "Create packages/manuscript-engine/src/services/data-tagger.service.ts",
    "Implement column auto-tagging for section relevance",
    "Include statistical summary extraction"
  ],
  "passes": false
}
```

```json
{
  "category": "data-integration",
  "task_id": "T3",
  "description": "Create visualization.service.ts",
  "steps": [
    "Read PHASE_1_DATA_INTEGRATION.md Task 3 specification",
    "Create packages/manuscript-engine/src/services/visualization.service.ts",
    "Support chart types: bar, line, scatter, box, histogram, Kaplan-Meier, forest",
    "Generate chart configuration objects"
  ],
  "passes": false
}
```

```json
{
  "category": "data-integration",
  "task_id": "T4",
  "description": "Create data-citation.service.ts",
  "steps": [
    "Create packages/manuscript-engine/src/services/data-citation.service.ts",
    "Implement data citations with audit hash linking",
    "Link citations to source datasets"
  ],
  "passes": false
}
```

```json
{
  "category": "data-integration",
  "task_id": "T5",
  "description": "Create data-filter.types.ts",
  "steps": [
    "Create packages/manuscript-engine/src/types/data-filter.types.ts",
    "Define FilterCriteria, FilterState, FilterPreview types",
    "Support inclusion/exclusion flow tracking"
  ],
  "passes": false
}
```

```json
{
  "category": "data-integration",
  "task_id": "T6",
  "description": "Create phi-guard.service.ts - CRITICAL",
  "steps": [
    "Read PHASE_1_DATA_INTEGRATION.md Task 6 specification",
    "Create packages/manuscript-engine/src/services/phi-guard.service.ts",
    "Implement 18 HIPAA identifier patterns",
    "FAIL-CLOSED: Block on ANY detection",
    "Log all scans to audit trail",
    "Write unit tests for all patterns"
  ],
  "passes": false
}
```

```json
{
  "category": "data-integration",
  "task_id": "T7",
  "description": "Create table-templates.ts",
  "steps": [
    "Create packages/manuscript-engine/src/templates/table-templates.ts",
    "Include: demographics, outcomes, regression, comparison templates",
    "Generate APA-compliant table structures"
  ],
  "passes": false
}
```

```json
{
  "category": "data-integration",
  "task_id": "T8",
  "description": "Create abstract-generator.prompt.ts",
  "steps": [
    "Create packages/manuscript-engine/src/prompts/abstract-generator.prompt.ts",
    "Define structured and unstructured abstract prompts",
    "Include IMRAD section extraction"
  ],
  "passes": false
}
```

```json
{
  "category": "data-integration",
  "task_id": "T9",
  "description": "Create version-control.service.ts",
  "steps": [
    "Create packages/manuscript-engine/src/services/version-control.service.ts",
    "Implement hash-chained manuscript versioning",
    "Support diff comparison between versions",
    "Store previous_hash for audit chain"
  ],
  "passes": false
}
```

```json
{
  "category": "data-integration",
  "task_id": "T10",
  "description": "Create data-validator.ts",
  "steps": [
    "Create packages/manuscript-engine/src/utils/data-validator.ts",
    "Validate section-specific data formats",
    "Handle numeric precision (p-values, CIs)",
    "Return validation errors array"
  ],
  "passes": false
}
```

```json
{
  "category": "data-integration",
  "task_id": "T11",
  "description": "Create manuscript-data.routes.ts",
  "steps": [
    "Create services/orchestrator/src/routes/manuscript-data.routes.ts",
    "Implement: GET/POST data selection, preview with PHI masking",
    "Add RBAC middleware to all routes",
    "Integrate with existing Express app"
  ],
  "passes": false
}
```

```json
{
  "category": "data-integration",
  "task_id": "T12",
  "description": "Create data-lineage.service.ts",
  "steps": [
    "Create packages/manuscript-engine/src/services/data-lineage.service.ts",
    "Track: upload→processing→extraction→section_insert→export",
    "Implement trace to source functionality",
    "Link to audit hashes"
  ],
  "passes": false
}
```

```json
{
  "category": "data-integration",
  "task_id": "T13",
  "description": "Create chart-embed.service.ts",
  "steps": [
    "Create packages/manuscript-engine/src/services/chart-embed.service.ts",
    "Handle figure numbering",
    "Generate captions",
    "Create embed code placeholders"
  ],
  "passes": false
}
```

```json
{
  "category": "data-integration",
  "task_id": "T14",
  "description": "Create pre-draft-validator.service.ts",
  "steps": [
    "Create packages/manuscript-engine/src/services/pre-draft-validator.service.ts",
    "Validate: data completeness, statistical accuracy, citation integrity",
    "Require human attestation for sensitive sections",
    "Block draft generation on validation failure"
  ],
  "passes": false
}
```

```json
{
  "category": "data-integration",
  "task_id": "T15",
  "description": "Create comparison-importer.service.ts",
  "steps": [
    "Create packages/manuscript-engine/src/services/comparison-importer.service.ts",
    "Support bulk import for Discussion comparisons",
    "Build comparison matrix",
    "Generate discussion text suggestions"
  ],
  "passes": false
}
```

```json
{
  "category": "data-integration",
  "task_id": "T16",
  "description": "Create data-sync.service.ts",
  "steps": [
    "Create packages/manuscript-engine/src/services/data-sync.service.ts",
    "Implement EventEmitter for real-time updates",
    "Track affected sections",
    "Support severity levels: critical, warning, info"
  ],
  "passes": false
}
```

```json
{
  "category": "data-integration",
  "task_id": "T17",
  "description": "Create metadata-extractor.ts",
  "steps": [
    "Create packages/manuscript-engine/src/utils/metadata-extractor.ts",
    "Extract author/institution/study metadata",
    "Validate ORCID format",
    "Parse affiliation strings"
  ],
  "passes": false
}
```

```json
{
  "category": "data-integration",
  "task_id": "T18",
  "description": "Create quarantine.service.ts",
  "steps": [
    "Create packages/manuscript-engine/src/services/quarantine.service.ts",
    "Implement AES-256 encryption for sensitive data",
    "Require human attestation for release",
    "Support token expiration and access limits"
  ],
  "passes": false
}
```

```json
{
  "category": "data-integration",
  "task_id": "T19",
  "description": "Create data-search.service.ts",
  "steps": [
    "Create packages/manuscript-engine/src/services/data-search.service.ts",
    "Implement Cmd+K search across columns, values, statistics, citations",
    "Include relevance scoring",
    "Return search results with context"
  ],
  "passes": false
}
```

```json
{
  "category": "data-integration",
  "task_id": "T20",
  "description": "Create data-integration.test.ts",
  "steps": [
    "Create packages/manuscript-engine/src/__tests__/integration/data-integration.test.ts",
    "Test E2E flow: tag→map→cite→version→validate",
    "Use synthetic medical datasets",
    "Verify PHI guard blocks contaminated data",
    "All tests must pass"
  ],
  "passes": false
}
```

### Phase 2: Literature Integration (Tasks 21-40)

```json
{
  "category": "literature",
  "task_id": "T21",
  "description": "Create pubmed.service.ts",
  "steps": [
    "Read PHASE_2_LITERATURE_INTEGRATION.md Task 21 specification",
    "Create packages/manuscript-engine/src/services/pubmed.service.ts",
    "Implement: search, fetchByPmid, fetchByDoi, toCitation, getRelatedArticles",
    "Parse PubMed XML responses"
  ],
  "passes": false
}
```

```json
{
  "category": "literature",
  "task_id": "T22",
  "description": "Create semantic-scholar.service.ts",
  "steps": [
    "Read PHASE_2_LITERATURE_INTEGRATION.md Task 22 specification",
    "Create packages/manuscript-engine/src/services/semantic-scholar.service.ts",
    "Implement: search, getPaper, getCitations, getReferences, getTldr"
  ],
  "passes": false
}
```

```json
{
  "category": "literature",
  "task_id": "T23",
  "description": "Create lit-review.service.ts",
  "steps": [
    "Create packages/manuscript-engine/src/services/lit-review.service.ts",
    "Support styles: thematic, chronological, methodological, narrative",
    "Implement theme clustering and gap analysis",
    "Generate structured review sections"
  ],
  "passes": false
}
```

```json
{
  "category": "literature",
  "task_id": "T24",
  "description": "Create citation-manager.service.ts",
  "steps": [
    "Create packages/manuscript-engine/src/services/citation-manager.service.ts",
    "Implement: DOI/PMID resolution via CrossRef",
    "Duplicate detection",
    "Reordering by appearance",
    "Validation"
  ],
  "passes": false
}
```

```json
{
  "category": "literature",
  "task_id": "T25",
  "description": "Create gap-analysis.prompt.ts",
  "steps": [
    "Create packages/manuscript-engine/src/prompts/gap-analysis.prompt.ts",
    "Define prompts for: population, methodological, outcome, contextual gaps",
    "Include research opportunity generation"
  ],
  "passes": false
}
```

```json
{
  "category": "literature",
  "task_id": "T26",
  "description": "Create citation-inserter.types.ts",
  "steps": [
    "Create packages/manuscript-engine/src/types/citation-inserter.types.ts",
    "Define: position tracking, preview state, search state types"
  ],
  "passes": false
}
```

```json
{
  "category": "literature",
  "task_id": "T27",
  "description": "Create arxiv.service.ts",
  "steps": [
    "Create packages/manuscript-engine/src/services/arxiv.service.ts",
    "Implement arXiv API integration",
    "Parse Atom feeds",
    "Support category filtering and PDF links"
  ],
  "passes": false
}
```

```json
{
  "category": "literature",
  "task_id": "T28",
  "description": "Create lit-matrix.service.ts",
  "steps": [
    "Create packages/manuscript-engine/src/services/lit-matrix.service.ts",
    "Build systematic review PICO columns",
    "Include quality assessment",
    "Calculate effect sizes",
    "Export to table format"
  ],
  "passes": false
}
```

```json
{
  "category": "literature",
  "task_id": "T29",
  "description": "Create plagiarism-check.service.ts",
  "steps": [
    "Create packages/manuscript-engine/src/services/plagiarism-check.service.ts",
    "Implement N-gram similarity (5-word phrases)",
    "70% threshold for flagging",
    "Generate match reports"
  ],
  "passes": false
}
```

```json
{
  "category": "literature",
  "task_id": "T30",
  "description": "Create citation-export.ts",
  "steps": [
    "Create packages/manuscript-engine/src/utils/citation-export.ts",
    "Support formats: BibTeX, RIS, EndNote XML, CSV"
  ],
  "passes": false
}
```

```json
{
  "category": "literature",
  "task_id": "T31-40",
  "description": "Complete remaining literature services",
  "steps": [
    "T31: lit-watcher.service.ts - Background monitoring for new publications",
    "T32: keyword-extractor.ts - Extract keywords from text",
    "T33: lit-summary-embed.service.ts - Embed literature summaries",
    "T34: conflict-detector.service.ts - Detect conflicting findings",
    "T35: zotero.service.ts - Zotero integration",
    "T36: paraphrase.service.ts - Ethical paraphrasing",
    "T37: search-history.types.ts - Search history tracking",
    "T38: citation-formatter.service.ts - AMA/APA/Vancouver formatting",
    "T39: relevance-scorer.service.ts - Score citation relevance",
    "T40: literature.test.ts - Integration tests for literature services"
  ],
  "passes": false
}
```

### Phase 3: Structure Building (Tasks 41-60)

```json
{
  "category": "structure",
  "task_id": "T41",
  "description": "Create imrad-templates.ts",
  "steps": [
    "Read PHASE_3_STRUCTURE_BUILDING.md Task 41 specification",
    "Create packages/manuscript-engine/src/templates/imrad-templates.ts",
    "Include: IMRaD, case report, systematic review (PRISMA) templates",
    "Define word count limits and placeholders"
  ],
  "passes": false
}
```

```json
{
  "category": "structure",
  "task_id": "T42",
  "description": "Create abstract-generator.service.ts",
  "steps": [
    "Create packages/manuscript-engine/src/services/abstract-generator.service.ts",
    "Generate structured/unstructured abstracts",
    "Extract objectives/methods/results/conclusions",
    "Validate word limits"
  ],
  "passes": false
}
```

```json
{
  "category": "structure",
  "task_id": "T43",
  "description": "Create introduction-builder.service.ts",
  "steps": [
    "Create packages/manuscript-engine/src/services/introduction-builder.service.ts",
    "Build funnel structure: general→specific background, rationale/gap, objectives",
    "Suggest citations by relevance"
  ],
  "passes": false
}
```

```json
{
  "category": "structure",
  "task_id": "T44-52",
  "description": "Create structure services",
  "steps": [
    "T44: methods-populator.service.ts - Auto-fill from metadata",
    "T45: results-scaffold.service.ts - Build results structure",
    "T46: discussion-builder.service.ts - Discussion sections",
    "T47: references-builder.service.ts - Reference list",
    "T48: acknowledgments.service.ts - Acknowledgments generator",
    "T49: figure-table-inserter.types.ts - Figure/table placement",
    "T50: word-count-tracker.service.ts - Track word counts",
    "T51: outline-expander.service.ts - Expand outlines to prose",
    "T52: section-reorder.types.ts - Section reordering"
  ],
  "passes": false
}
```

```json
{
  "category": "structure",
  "task_id": "T53",
  "description": "Create journal-templates/nejm.ts",
  "steps": [
    "Create packages/manuscript-engine/src/templates/journal-templates/nejm.ts",
    "250-word abstract, 3000-word limit",
    "Vancouver citation style",
    "40 refs max, 6 figures/tables total",
    "Create index.ts with getJournalTemplate()"
  ],
  "passes": false
}
```

```json
{
  "category": "structure",
  "task_id": "T54-56",
  "description": "Additional journal templates",
  "steps": [
    "T54: journal-templates/lancet.ts",
    "T55: journal-templates/jama.ts",
    "T56: journal-templates/nature-medicine.ts",
    "Update index.ts to include all templates"
  ],
  "passes": false
}
```

```json
{
  "category": "structure",
  "task_id": "T57",
  "description": "Create title-generator.service.ts",
  "steps": [
    "Create packages/manuscript-engine/src/services/title-generator.service.ts",
    "Generate: descriptive, declarative, compound titles",
    "Validate length (8-15 words)",
    "Check for abbreviations"
  ],
  "passes": false
}
```

```json
{
  "category": "structure",
  "task_id": "T58-60",
  "description": "Complete structure phase",
  "steps": [
    "T58: author-manager.service.ts - ORCID, affiliations",
    "T59: branch-manager.service.ts - Versioned branching",
    "T60: structure.test.ts - Integration tests"
  ],
  "passes": false
}
```

### Phase 4: Writing Assistance (Tasks 61-80)

```json
{
  "category": "writing",
  "task_id": "T61",
  "description": "Create openai-drafter.service.ts",
  "steps": [
    "Read PHASE_4_WRITING_ASSISTANCE.md Task 61 specification",
    "Create packages/manuscript-engine/src/services/openai-drafter.service.ts",
    "Integrate with ai-router package",
    "Implement: draftSection, expandOutline, continueWriting",
    "Add PHI scan before returning content"
  ],
  "passes": false
}
```

```json
{
  "category": "writing",
  "task_id": "T62",
  "description": "Create claude-writer.service.ts",
  "steps": [
    "Create packages/manuscript-engine/src/services/claude-writer.service.ts",
    "Use extended thinking mode",
    "Implement: reasonedWrite, improveWithExplanation, generateOptions, critiqueDraft"
  ],
  "passes": false
}
```

```json
{
  "category": "writing",
  "task_id": "T63",
  "description": "Create grammar-checker.service.ts",
  "steps": [
    "Create packages/manuscript-engine/src/services/grammar-checker.service.ts",
    "Check: grammar, spelling, punctuation, style",
    "Medical term exceptions: etiology/hemoglobin/tumor variants",
    "Abbreviation validation"
  ],
  "passes": false
}
```

```json
{
  "category": "writing",
  "task_id": "T64",
  "description": "Create claim-verifier.service.ts",
  "steps": [
    "Create packages/manuscript-engine/src/services/claim-verifier.service.ts",
    "Extract claims: statistical, comparative, causal, descriptive",
    "Verify against data citations and literature",
    "Calculate confidence scores",
    "Log to audit trail"
  ],
  "passes": false
}
```

```json
{
  "category": "writing",
  "task_id": "T65-70",
  "description": "Create writing assistance services",
  "steps": [
    "T65: transition-suggester.service.ts - Suggest transitions",
    "T66: tone-adjuster.service.ts - Adjust tone",
    "T67: synonym-finder.service.ts - Medical synonyms",
    "T68: medical-nlp.service.ts - BioBERT integration",
    "T69: collaborative-editor.types.ts - Editor types",
    "T70: clarity-analyzer.service.ts - Clarity scoring"
  ],
  "passes": false
}
```

```json
{
  "category": "writing",
  "task_id": "T71",
  "description": "Create section-prompts/",
  "steps": [
    "Create packages/manuscript-engine/src/prompts/section-prompts/",
    "introduction.prompt.ts",
    "methods.prompt.ts",
    "results.prompt.ts",
    "discussion.prompt.ts",
    "Export all from index.ts"
  ],
  "passes": false
}
```

```json
{
  "category": "writing",
  "task_id": "T72-74",
  "description": "Additional writing services",
  "steps": [
    "T72: sentence-builder.service.ts - Build sentences from data",
    "T73: lit-paraphrase.service.ts - Ethical paraphrasing",
    "T74: abbreviation.service.ts - Abbreviation management"
  ],
  "passes": false
}
```

```json
{
  "category": "writing",
  "task_id": "T75",
  "description": "Create readability.service.ts",
  "steps": [
    "Create packages/manuscript-engine/src/services/readability.service.ts",
    "Calculate: Flesch Reading Ease, Flesch-Kincaid, Gunning Fog, SMOG, ARI",
    "Per-section analysis",
    "Target: grade 12, sentences <25 words, FRE 30-50"
  ],
  "passes": false
}
```

```json
{
  "category": "writing",
  "task_id": "T76-78",
  "description": "AI writing support",
  "steps": [
    "T76: co-writer-mode.types.ts - Live AI suggestions",
    "T77: citation-suggester.service.ts - Context-based suggestions",
    "T78: claim-highlighter.service.ts - Highlight unsubstantiated claims"
  ],
  "passes": false
}
```

```json
{
  "category": "writing",
  "task_id": "T79",
  "description": "Create phrase-library.ts",
  "steps": [
    "Create packages/manuscript-engine/src/templates/phrase-library.ts",
    "Include phrases for: methods, results, discussion",
    "Implement fillTemplate() function",
    "Statistical phrase templates with placeholders"
  ],
  "passes": false
}
```

```json
{
  "category": "writing",
  "task_id": "T80",
  "description": "Create writing-tools.test.ts",
  "steps": [
    "Create packages/manuscript-engine/src/__tests__/integration/writing-tools.test.ts",
    "Test all writing services",
    "Verify PHI scan on all AI-generated content",
    "All tests must pass"
  ],
  "passes": false
}
```

### Phase 5: Review, Export & Compliance (Tasks 81-100)

```json
{
  "category": "compliance",
  "task_id": "T81",
  "description": "Create peer-review.service.ts",
  "steps": [
    "Read PHASE_5_REVIEW_EXPORT.md Task 81 specification",
    "Create packages/manuscript-engine/src/services/peer-review.service.ts",
    "Implement simulateReview with criteria scoring",
    "Generate reviewer-style feedback letter"
  ],
  "passes": false
}
```

```json
{
  "category": "compliance",
  "task_id": "T82",
  "description": "Create consort-checker.service.ts",
  "steps": [
    "Create packages/manuscript-engine/src/services/consort-checker.service.ts",
    "Implement full CONSORT 2010 checklist (25 items)",
    "Pattern matching for each item",
    "Generate compliance report"
  ],
  "passes": false
}
```

```json
{
  "category": "compliance",
  "task_id": "T83",
  "description": "Create strobe-checker.service.ts",
  "steps": [
    "Create packages/manuscript-engine/src/services/strobe-checker.service.ts",
    "Support: cohort, case-control, cross-sectional",
    "Full STROBE checklist"
  ],
  "passes": false
}
```

```json
{
  "category": "compliance",
  "task_id": "T84",
  "description": "Create prisma-checker.service.ts",
  "steps": [
    "Create packages/manuscript-engine/src/services/prisma-checker.service.ts",
    "PRISMA 2020 checklist",
    "Check for flow diagram reference"
  ],
  "passes": false
}
```

```json
{
  "category": "compliance",
  "task_id": "T85",
  "description": "Create docx-export.service.ts",
  "steps": [
    "Create packages/manuscript-engine/src/services/docx-export.service.ts",
    "Generate Word documents",
    "Support: tracked changes, line numbers, double spacing",
    "Include title page, sections, references"
  ],
  "passes": false
}
```

```json
{
  "category": "compliance",
  "task_id": "T86",
  "description": "Create pdf-export.service.ts",
  "steps": [
    "Create packages/manuscript-engine/src/services/pdf-export.service.ts",
    "Generate HTML then convert to PDF",
    "Support templates: manuscript, preprint, journal"
  ],
  "passes": false
}
```

```json
{
  "category": "compliance",
  "task_id": "T87-96",
  "description": "Additional export and compliance services",
  "steps": [
    "T87: latex-export.service.ts - LaTeX export",
    "T88: submission-packager.service.ts - Package for submission",
    "T89: cover-letter.service.ts - Generate cover letter",
    "T90: revision-tracker.service.ts - Track revisions",
    "T91: response-letter.service.ts - Response to reviewers",
    "T92: icmje-form.service.ts - ICMJE COI form",
    "T93: author-agreement.service.ts - Author contributions",
    "T94: data-availability.service.ts - Data statement",
    "T95: preprint-submitter.service.ts - bioRxiv/medRxiv",
    "T96: journal-finder.service.ts - Suggest journals"
  ],
  "passes": false
}
```

```json
{
  "category": "compliance",
  "task_id": "T97",
  "description": "Create final-phi-scan.service.ts - CRITICAL",
  "steps": [
    "Read PHASE_5_REVIEW_EXPORT.md Task 97 specification",
    "Create packages/manuscript-engine/src/services/final-phi-scan.service.ts",
    "Scan ALL 18 HIPAA identifiers",
    "BLOCK export on ANY detection",
    "Generate audit hash",
    "Write comprehensive unit tests"
  ],
  "passes": false
}
```

```json
{
  "category": "compliance",
  "task_id": "T98",
  "description": "Create audit-report.service.ts",
  "steps": [
    "Create packages/manuscript-engine/src/services/audit-report.service.ts",
    "Generate PDF of complete audit trail",
    "Include all hash chains",
    "Show data lineage"
  ],
  "passes": false
}
```

```json
{
  "category": "compliance",
  "task_id": "T99",
  "description": "Create archive.service.ts",
  "steps": [
    "Create packages/manuscript-engine/src/services/archive.service.ts",
    "Package: manuscript, audit trail, data citations",
    "Generate ZIP archive",
    "Include manifest.json"
  ],
  "passes": false
}
```

```json
{
  "category": "compliance",
  "task_id": "T100",
  "description": "Create full-workflow.test.ts",
  "steps": [
    "Create packages/manuscript-engine/src/__tests__/e2e/full-workflow.test.ts",
    "Test complete workflow: draft → compliance → PHI scan → export",
    "Verify audit trail completeness",
    "Verify PHI blocking works",
    "ALL tests must pass"
  ],
  "passes": false
}
```

### Final Verification

```json
{
  "category": "verification",
  "task_id": "V1",
  "description": "Build and test entire package",
  "steps": [
    "cd packages/manuscript-engine",
    "npm run build - must succeed with no errors",
    "npm test - must pass with >80% coverage",
    "npm run lint - no errors"
  ],
  "passes": false
}
```

```json
{
  "category": "verification",
  "task_id": "V2",
  "description": "Verify exports and integration",
  "steps": [
    "All services exported from src/services/index.ts",
    "All types exported from src/types/index.ts",
    "Package can be imported from other workspaces",
    "API routes registered in orchestrator"
  ],
  "passes": false
}
```

```json
{
  "category": "verification",
  "task_id": "V3",
  "description": "Security verification",
  "steps": [
    "PHI guard blocks all 18 HIPAA identifiers",
    "Final PHI scan prevents contaminated exports",
    "Audit trail is complete and hash-chained",
    "All routes have RBAC middleware"
  ],
  "passes": false
}
```

---

## If Stuck After 15 Iterations

If progress stalls:
1. Document what's blocking progress in this file
2. List what was attempted
3. Identify the specific error messages
4. Check if dependencies are missing
5. Verify the phase file specifications match current codebase
6. Suggest alternative approaches
7. Output `<promise>BLOCKED_NEEDS_REVIEW</promise>`

---

## Ralph Loop Execution

Execute this PRD with:

```bash
/ralph-loop "Read MANUSCRIPT_ENGINE_PRD.md and the phase files (PHASE_0 through PHASE_5). 
Work through each task in order, marking passes: true when complete.
Update the Activity Log section after each task.
Run tests after completing each phase.
Output <promise>MANUSCRIPT_ENGINE_COMPLETE</promise> when ALL tasks pass." \
--max-iterations 100 \
--completion-promise "MANUSCRIPT_ENGINE_COMPLETE"
```

---

## Notes

- **GOVERNANCE FIRST**: PHI scanning is non-negotiable at all data insertion points
- **FAIL-CLOSED**: Any PHI detection blocks the operation
- **AUDIT EVERYTHING**: Hash-chain all operations for compliance
- **TEST CONTINUOUSLY**: Run tests after each phase
- **READ PHASE FILES**: Each phase file has exact code specifications - use them
