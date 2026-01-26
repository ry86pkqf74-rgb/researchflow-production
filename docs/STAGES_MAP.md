# ResearchFlow 20-Stage Workflow Map

> Mapping each stage to UI routes, backend endpoints, worker modules, and artifact types

## Stage Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    RESEARCHFLOW 20-STAGE WORKFLOW                        │
├─────────────────────────────────────────────────────────────────────────┤
│  PHASE 1: SETUP & PLANNING (Stages 1-5)                                 │
│  ┌───────┐ ┌───────┐ ┌───────┐ ┌───────┐ ┌───────┐                     │
│  │ S1    │→│ S2    │→│ S3    │→│ S4    │→│ S5    │                     │
│  │Hypoth │ │Lit Rev│ │Design │ │Data   │ │Clean  │                     │
│  └───────┘ └───────┘ └───────┘ └───────┘ └───────┘                     │
├─────────────────────────────────────────────────────────────────────────┤
│  PHASE 2: ANALYSIS (Stages 6-10)                                        │
│  ┌───────┐ ┌───────┐ ┌───────┐ ┌───────┐ ┌───────┐                     │
│  │ S6    │→│ S7    │→│ S8    │→│ S9    │→│ S10   │                     │
│  │Explore│ │Stats  │ │Visual │ │Review │ │Valid  │                     │
│  └───────┘ └───────┘ └───────┘ └───────┘ └───────┘                     │
├─────────────────────────────────────────────────────────────────────────┤
│  PHASE 3: WRITING (Stages 11-15)                                        │
│  ┌───────┐ ┌───────┐ ┌───────┐ ┌───────┐ ┌───────┐                     │
│  │ S11   │→│ S12   │→│ S13   │→│ S14   │→│ S15   │                     │
│  │Intro  │ │Methods│ │Results│ │Discuss│ │Compile│                     │
│  └───────┘ └───────┘ └───────┘ └───────┘ └───────┘                     │
├─────────────────────────────────────────────────────────────────────────┤
│  PHASE 4: REVIEW & PUBLISH (Stages 16-20)                               │
│  ┌───────┐ ┌───────┐ ┌───────┐ ┌───────┐ ┌───────┐                     │
│  │ S16   │→│ S17   │→│ S18   │→│ S19   │→│ S20   │                     │
│  │PeerRev│ │Revise │ │Final  │ │Submit │ │Confer │                     │
│  └───────┘ └───────┘ └───────┘ └───────┘ └───────┘                     │
└─────────────────────────────────────────────────────────────────────────┘
```

## Detailed Stage Mapping

### Stage 1: Hypothesis Formation

| Aspect | Details |
|--------|---------|
| **Purpose** | Define research questions and hypotheses |
| **UI Route** | `/projects/:id/stages/1` |
| **UI Component** | `services/web/src/components/stages/stage-01/` |
| **API Endpoints** | `POST /api/projects/:id/hypothesis` |
| **Worker Module** | N/A (primarily UI-driven) |
| **Artifacts Created** | `hypothesis.json`, `research_questions.md` |
| **Collaboration** | Real-time CRDT editing (Y.js) |
| **PHI Policy** | Scan hypothesis text for incidental PHI |

### Stage 2: Literature Review

| Aspect | Details |
|--------|---------|
| **Purpose** | Search and organize relevant literature |
| **UI Route** | `/projects/:id/stages/2` |
| **UI Component** | `services/web/src/components/stages/stage-02/` |
| **API Endpoints** | `GET /api/literature/search`, `POST /api/literature/references` |
| **Worker Module** | Literature search caching |
| **Artifacts Created** | `references.json`, `citations.bib`, `literature_matrix.xlsx` |
| **Integrations** | PubMed, Semantic Scholar, arXiv |
| **PHI Policy** | Query terms scanned before external search |

### Stage 3: Study Design

| Aspect | Details |
|--------|---------|
| **Purpose** | Define methodology and analysis plan |
| **UI Route** | `/projects/:id/stages/3` |
| **UI Component** | `services/web/src/components/stages/stage-03/` |
| **API Endpoints** | `POST /api/projects/:id/sap` |
| **Worker Module** | SAP generator |
| **Artifacts Created** | `study_design.json`, `sap.md`, `power_analysis.json` |
| **AI Features** | Statistical analysis plan generation |
| **PHI Policy** | Design docs may reference variables (no actual data) |

### Stage 4: Data Collection

| Aspect | Details |
|--------|---------|
| **Purpose** | Upload and register datasets |
| **UI Route** | `/projects/:id/stages/4` |
| **UI Component** | `services/web/src/components/stages/stage-04/` |
| **API Endpoints** | `POST /api/upload`, `GET /api/datasets/:id` |
| **Worker Module** | Pandera validation |
| **Artifacts Created** | Raw data files, `validation_report.json` |
| **PHI Policy** | **Full PHI scan on upload**, block if detected in DEMO |

### Stage 5: Data Cleaning

| Aspect | Details |
|--------|---------|
| **Purpose** | Clean, transform, and prepare data |
| **UI Route** | `/projects/:id/stages/5` |
| **UI Component** | `services/web/src/components/stages/stage-05/` |
| **API Endpoints** | `POST /api/datasets/:id/transform` |
| **Worker Module** | `stage_05_cleaning.py` |
| **Artifacts Created** | `cleaned_data.parquet`, `transform_log.json`, `missing_report.json` |
| **PHI Policy** | PHI redaction options: mask, drop, tokenize |

### Stage 6: Exploratory Analysis

| Aspect | Details |
|--------|---------|
| **Purpose** | Initial data exploration and visualization |
| **UI Route** | `/projects/:id/stages/6` |
| **UI Component** | `services/web/src/components/stages/stage-06/` |
| **API Endpoints** | `POST /api/analysis/explore` |
| **Worker Module** | `stage_06_exploration.py` |
| **Artifacts Created** | `eda_report.html`, `distributions.json`, exploration plots |
| **PHI Policy** | Summaries only (no individual records in output) |

### Stage 7: Statistical Analysis

| Aspect | Details |
|--------|---------|
| **Purpose** | Run primary statistical analyses |
| **UI Route** | `/projects/:id/stages/7` |
| **UI Component** | `services/web/src/components/stages/stage-07/` |
| **API Endpoints** | `POST /api/analysis/stats` |
| **Worker Module** | `stage_07_statistics.py` |
| **Artifacts Created** | `stats_results.json`, `tables/*.csv`, model outputs |
| **PHI Policy** | Aggregate results only |

### Stage 8: Visualization

| Aspect | Details |
|--------|---------|
| **Purpose** | Generate publication-quality figures |
| **UI Route** | `/projects/:id/stages/8` |
| **UI Component** | `services/web/src/components/stages/stage-08/` |
| **API Endpoints** | `POST /api/figures/generate` |
| **Worker Module** | `stage_08_visualization.py` |
| **Artifacts Created** | `figures/*.png`, `figures/*.svg`, `figure_metadata.json` |
| **PHI Policy** | No individual identifiers in figures |

### Stage 9: Results Review

| Aspect | Details |
|--------|---------|
| **Purpose** | Collaborative review of results |
| **UI Route** | `/projects/:id/stages/9` |
| **UI Component** | `services/web/src/components/stages/stage-09/` |
| **API Endpoints** | `GET/POST /api/v2/artifacts/:id/comments` |
| **Worker Module** | N/A |
| **Artifacts Created** | Comments, review notes |
| **Collaboration** | Threaded comments with anchoring |
| **PHI Policy** | Comment text scanned for PHI |

### Stage 10: Validation

| Aspect | Details |
|--------|---------|
| **Purpose** | Validate analysis reproducibility |
| **UI Route** | `/projects/:id/stages/10` |
| **UI Component** | `services/web/src/components/stages/stage-10/` |
| **API Endpoints** | `POST /api/validation/run` |
| **Worker Module** | `stage_10_validation.py` |
| **Artifacts Created** | `validation_report.json`, checksums, reproducibility log |
| **PHI Policy** | Validation runs on cleaned data |

### Stage 11: Introduction Writing

| Aspect | Details |
|--------|---------|
| **Purpose** | Draft manuscript introduction |
| **UI Route** | `/projects/:id/stages/11` |
| **UI Component** | `services/web/src/components/stages/stage-11/` |
| **API Endpoints** | `POST /api/manuscript/sections/introduction` |
| **Worker Module** | `packages/manuscript-engine/src/services/introduction-builder.service.ts` |
| **Artifacts Created** | `sections/introduction.md`, `introduction_draft.docx` |
| **AI Features** | AI-assisted drafting with literature integration |
| **PHI Policy** | No data values in introduction |

### Stage 12: Methods Writing

| Aspect | Details |
|--------|---------|
| **Purpose** | Document methodology |
| **UI Route** | `/projects/:id/stages/12` |
| **UI Component** | `services/web/src/components/stages/stage-12/` |
| **API Endpoints** | `POST /api/manuscript/sections/methods` |
| **Worker Module** | `packages/manuscript-engine/src/services/methods-builder.service.ts` |
| **Artifacts Created** | `sections/methods.md`, method diagrams |
| **PHI Policy** | Method descriptions only (no actual data) |

### Stage 13: Results Writing

| Aspect | Details |
|--------|---------|
| **Purpose** | Write results section with tables/figures |
| **UI Route** | `/projects/:id/stages/13` |
| **UI Component** | `services/web/src/components/stages/stage-13/` |
| **API Endpoints** | `POST /api/manuscript/sections/results` |
| **Worker Module** | `packages/manuscript-engine/src/services/results-builder.service.ts` |
| **Artifacts Created** | `sections/results.md`, integrated tables |
| **PHI Policy** | Aggregate statistics only |

### Stage 14: Discussion Writing

| Aspect | Details |
|--------|---------|
| **Purpose** | Write discussion and conclusions |
| **UI Route** | `/projects/:id/stages/14` |
| **UI Component** | `services/web/src/components/stages/stage-14/` |
| **API Endpoints** | `POST /api/manuscript/sections/discussion` |
| **Worker Module** | `packages/manuscript-engine/src/services/discussion-builder.service.ts` |
| **Artifacts Created** | `sections/discussion.md` |
| **AI Features** | Limitation and future work suggestions |
| **PHI Policy** | No identifiable information |

### Stage 15: Manuscript Compilation

| Aspect | Details |
|--------|---------|
| **Purpose** | Compile complete manuscript |
| **UI Route** | `/projects/:id/stages/15` |
| **UI Component** | `services/web/src/components/stages/stage-15/` |
| **API Endpoints** | `POST /api/manuscript/compile` |
| **Worker Module** | Pandoc-based compilation |
| **Artifacts Created** | `manuscript.docx`, `manuscript.pdf`, `manuscript.tex` |
| **PHI Policy** | Final PHI scan before compilation |

### Stage 16: Peer Review

| Aspect | Details |
|--------|---------|
| **Purpose** | Internal peer review process |
| **UI Route** | `/projects/:id/stages/16` |
| **UI Component** | `services/web/src/components/stages/stage-16/` |
| **API Endpoints** | `POST /api/reviews` |
| **Worker Module** | N/A |
| **Artifacts Created** | Review comments, scoring rubrics |
| **Collaboration** | Reviewer assignment, threaded feedback |
| **PHI Policy** | Reviews visible only to authorized roles |

### Stage 17: Revision

| Aspect | Details |
|--------|---------|
| **Purpose** | Address reviewer comments |
| **UI Route** | `/projects/:id/stages/17` |
| **UI Component** | `services/web/src/components/stages/stage-17/` |
| **API Endpoints** | `POST /api/manuscript/revise` |
| **Worker Module** | Diff generation |
| **Artifacts Created** | `revision_response.md`, tracked changes document |
| **PHI Policy** | Standard document handling |

### Stage 18: Final Review

| Aspect | Details |
|--------|---------|
| **Purpose** | Final quality check before submission |
| **UI Route** | `/projects/:id/stages/18` |
| **UI Component** | `services/web/src/components/stages/stage-18/` |
| **API Endpoints** | `POST /api/qc/final` |
| **Worker Module** | QC checklist validation |
| **Artifacts Created** | `qc_report.json`, compliance checklist |
| **PHI Policy** | PHI attestation required |

### Stage 19: Submission

| Aspect | Details |
|--------|---------|
| **Purpose** | Prepare and track journal submission |
| **UI Route** | `/projects/:id/stages/19` |
| **UI Component** | `services/web/src/components/stages/stage-19/` |
| **API Endpoints** | `POST /api/submissions` |
| **Worker Module** | N/A |
| **Artifacts Created** | Submission package, cover letter |
| **PHI Policy** | Final export validation |

### Stage 20: Conference Preparation (Optional)

| Aspect | Details |
|--------|---------|
| **Purpose** | Generate conference materials |
| **UI Route** | `/projects/:id/stages/20` |
| **UI Component** | `services/web/src/components/stages/stage-20/` |
| **API Endpoints** | `POST /api/conference/prepare` |
| **Worker Module** | `services/worker/src/conference_prep/`, `stage_20_conference.py` |
| **Artifacts Created** | Poster PDF, slides PPTX, abstract variants, export bundles |
| **Integrations** | Conference discovery, guideline extraction |
| **PHI Policy** | Materials scanned before export |

## Adding a New Stage

To add a new stage:

1. **Worker Module** (if compute needed):
   ```
   services/worker/src/workflow_engine/stages/stage_XX_name.py
   ```

2. **UI Component**:
   ```
   services/web/src/components/stages/stage-XX/
   ├── index.tsx
   ├── StageXXPanel.tsx
   └── hooks/useStageXX.ts
   ```

3. **API Route** (if new endpoint needed):
   ```
   services/orchestrator/src/routes/stage-xx.ts
   ```

4. **Types**:
   ```
   packages/core/types/stages/stage-xx.ts
   ```

5. **Migration** (if new tables needed):
   ```
   services/orchestrator/migrations/XXXX_stage_xx_tables.sql
   ```

## Adding a New UI Panel

To add a new panel within an existing stage:

1. **Component**:
   ```tsx
   // services/web/src/components/stages/stage-XX/NewPanel.tsx
   export function NewPanel({ projectId }: { projectId: string }) {
     // Implementation
   }
   ```

2. **Register in stage index**:
   ```tsx
   // services/web/src/components/stages/stage-XX/index.tsx
   export { NewPanel } from './NewPanel';
   ```

3. **Add to stage layout** (if using tabs):
   ```tsx
   <Tabs>
     <TabsTrigger value="main">Main</TabsTrigger>
     <TabsTrigger value="new">New Panel</TabsTrigger>
     <TabsContent value="new">
       <NewPanel projectId={projectId} />
     </TabsContent>
   </Tabs>
   ```

## Artifact Types by Stage

| Stage | Primary Artifacts | Format | Storage |
|-------|-------------------|--------|---------|
| 1-3 | Plans, designs | JSON, MD | `/data/artifacts/{project}/planning/` |
| 4-5 | Data files | Parquet, CSV | `/data/artifacts/{project}/data/` |
| 6-8 | Analysis outputs | JSON, PNG, SVG | `/data/artifacts/{project}/analysis/` |
| 9-10 | Reviews, validation | JSON, MD | `/data/artifacts/{project}/review/` |
| 11-15 | Manuscript sections | MD, DOCX | `/data/artifacts/{project}/manuscript/` |
| 16-18 | Review artifacts | JSON, MD | `/data/artifacts/{project}/review/` |
| 19-20 | Submission materials | PDF, PPTX, ZIP | `/data/artifacts/{project}/output/` |

## Stage Transition Rules

- Stages can be skipped if not applicable
- Stage 20 (Conference) is entirely optional
- Stages 16-18 may loop during revision
- PHI attestation required before Stage 15 compilation
- STEWARD approval required for LIVE mode exports
