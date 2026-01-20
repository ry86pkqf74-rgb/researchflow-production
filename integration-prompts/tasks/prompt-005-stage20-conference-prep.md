# Claude Implementation Prompt — Stage 20: Conference Preparation (ResearchFlow Production)

**Repo:** `ry86pkqf74-rgb/researchflow-production`  
**Goal:** Add a dedicated, governance-first **Stage 20: Conference Preparation** that upgrades and extends existing **Conference Readiness (Stages 17–19)** into a complete, end-to-end conference submission workflow.

---

## 0) Operating Mode and Ground Rules

You are Claude acting as an autonomous engineering agent with full write access to this repository.

### Non‑negotiable governance rules (fail‑closed)
1. **No PHI leaves the system.** Any outbound network calls (AI or web) must be blocked if PHI is detected in the payload.
2. **No PHI values in responses.** Return only *locations* (row/column, field paths) and *categories* when something is flagged.
3. **DEMO / STANDBY / NO_NETWORK** must run without external calls. Use fixtures + local corpora.
4. **LIVE** may use network + AI Router, but must PHI-scan before any outbound request.
5. **Reproducibility & auditability**: every generated artifact must have:
   - deterministic inputs recorded (or referenced),
   - a manifest with **sha256**, size, timestamps,
   - tool/version metadata when applicable.

### Design constraints
- Extend existing architecture; do **not** duplicate “conference readiness” logic already present.
- Keep responsibilities clean:
  - **Web**: user workflow + previews, downloads.
  - **Orchestrator (Node)**: auth, orchestration, governance checks, calling Worker, AI Router integration.
  - **Worker (Python/FastAPI)**: deterministic processing, generation (PDF/PPTX/ZIP), guideline parsing, storage to `/data/artifacts`.

---

## 1) Current System Context (What already exists — extend it)

### Existing Conference Readiness stages (17–19)
The workflow configuration already contains **Conference Readiness** with stages:
- 17 — Poster
- 18 — Symposium
- 19 — Presentation

Stage 20 must be inserted **before** these in the same group so users discover conferences and extract guidelines *first*, then generate materials.

### Existing conference types/schemas
`packages/core/types/conference.ts` already defines:
- requirements schema, checklist schema, material schema, export request schema
…but it currently **hard-limits stageId to 17–19**, which must be extended to include stage 20.

### Existing UI panel
There is already a `ConferenceReadinessPanel` in the web UI which calls:
- `POST /api/ros/conference/export`
…but the payload is incomplete (it lacks `researchId` / `conferenceId`) and the backend route may be missing.

---

## 2) Desired Outcome (Stage 20 = Conference Preparation)

Stage 20 performs a governed, sequential sub-pipeline:

1. **Conference Discovery**  
2. **Guideline Extraction + Normalization**  
3. **Material Generation** (Poster PDF, Oral PPTX, Symposium slide deck + handout)  
4. **Validation & Export** (QC checks + ZIP bundle + checklist)

Stage 20 must be **optional**, enabled via job spec flag:
```json
{
  "enable_conference_prep": true,
  "conference_prep": {
    "keywords": ["robotic", "colorectal", "outcomes"],
    "year_range": [2026, 2026],
    "formats": ["poster", "oral"],
    "location_pref": "US",
    "max_results": 10
  }
}
```

---

## 3) Implementation Tasks (Single Plan)

> Execute tasks in order. Each task must include code changes, tests, and documentation updates where relevant.

---

# A) Stage 20: Wire Into Workflow, Governance, and Shared Types

## A1) Add Stage 20 to Orchestrator workflow stage groups
**Edit:** `services/orchestrator/routes.ts`

- Locate the stage group config where stages 17–19 are defined (conference-readiness).
- Insert **Stage 20** at the top of that group:
  - `id: 20`
  - `name: "Conference Preparation"`
  - `shortName: "Prep"`
  - `description: "Discover conferences, extract guidelines, generate submission-ready materials"`
  - `outputs: ["Shortlisted conferences", "Guideline templates", "Submission bundle ZIP"]`
  - `duration: "10–30 min"`
- Ensure stage 20 is **optional** along with the conference-readiness group.

## A2) Governance lifecycle mapping must include stage 20 (backend)
**Edit:** `services/orchestrator/routes.ts` (or wherever stage→state is mapped)

- Update mapping so stages `15–20` are `FROZEN`.
  - Example change:
    - from `if (stageId >= 15 && stageId <= 19) return "FROZEN";`
    - to   `if (stageId >= 15 && stageId <= 20) return "FROZEN";`

## A3) Governance mapping must include stage 20 (web)
**Edit:** `services/web/src/lib/governance.ts`

- Mirror the backend mapping change for stage 20.
- Add stage 20 into the AI-enabled stage config **only** if guideline summarization uses AI Router.
- Ensure stage 20 is PHI-gated if it produces exportable artifacts.

## A4) Shared type/schema updates for stageId limits
**Edit:** `packages/core/types/conference.ts`

Update stageId bounds:
- `ComplianceChecklistSchema.stageId`: `max(19)` → `max(20)`
- `ConferenceMaterialSchema.stageId`: `max(19)` → `max(20)`
- `ConferenceExportRequest.stageId`: union `17|18|19` → `17|18|19|20`

Add new types/schemas (Zod):
- `ConferenceDiscoveryRequestSchema`
- `ConferenceDiscoveryResultSchema`
- `ConferenceGuidelineExtractionRequestSchema`
- `ConferenceGuidelineExtractionResultSchema`
- `ConferencePrepRunRequestSchema` / `ConferencePrepRunResultSchema` (optional convenience wrapper)

---

# B) Conference Discovery (Deterministic + DEMO Fixtures)

## B1) Add curated conference registry (worker)
**Create:** `services/worker/src/conference_prep/registry.py`

Include an initial curated list of major surgical conferences:
- SAGES Annual Meeting
- ACS Clinical Congress
- CNS (as relevant)
- ASE
- ACMS
- SUS (if relevant)
- Add tags by domain (hernia, robotics, colorectal, endocrine, outcomes, etc.)
- Include:
  - name, url, typical month, typical abstract window,
  - supported formats (poster/oral/symposium),
  - tags/keywords

## B2) Implement discovery ranking logic (worker)
**Create:** `services/worker/src/conference_prep/discovery.py`

Inputs:
- keywords, year_range, location_pref, formats, max_results

Output:
- ranked list with a `score` (0–1), `why` explanation (no hallucinations), and metadata.

Ranking criteria (deterministic):
- keyword overlap (token/term match),
- format match,
- time-window relevance (if current date is past typical deadline, penalize),
- location preference match.

**DEMO/NO_NETWORK rule:** discovery must work offline purely from registry.

## B3) Add worker endpoint for discovery
**Edit:** `services/worker/api_server.py`

Add:
- `POST /api/ros/conference/discover` → calls discovery, returns top N.

Add request/response validation using the shared schema pattern used elsewhere.

---

# C) Guideline Extraction + Sanitization + Summarization

## C1) Implement guideline extraction (worker)
**Create:** `services/worker/src/conference_prep/guidelines.py`

Features:
- Given conference `url` + formats, fetch guideline pages
- Parse HTML with BeautifulSoup
- Parse PDFs (public PDFs only) using `pypdf` (or `PyPDF2`)
- Produce:
  - `raw_text` (stored only after sanitization)
  - `rawTextSha256`
  - extracted fields (best-effort):
    - abstract word limit
    - poster size/dimensions
    - slide limits & time
    - file types
    - blinding rules
    - HIPAA/video requirements if stated

### Sanitization requirements (critical)
Before saving or returning any extracted text:
- Remove emails, phone numbers, addresses, names when possible.
- Replace with placeholders like `[REDACTED_EMAIL]`, `[REDACTED_PHONE]`.
- Never include scraped PII/PHI in logs.

## C2) Add guideline extraction endpoint (worker)
**Edit:** `services/worker/api_server.py`

Add:
- `POST /api/ros/conference/guidelines/extract` → returns sanitized raw text + extracted structured hints + hashes.

**DEMO mode:** return fixture guideline JSONs for 2–3 sample conferences.

## C3) Optional: AI Router guideline summarization (orchestrator)
**Create:** `services/orchestrator/src/services/conference-guideline-summarizer.ts`

- Input: sanitized raw text
- Output: strict JSON matching `ConferenceRequirementsSchema`
- Must:
  - PHI-scan prompt before outbound request
  - use AI Router configuration patterns from repo
  - DEMO mode: return fixture structured summary, no AI call
- The prompt must include:
  - “Do not invent missing details”
  - “Return unknown/null when not found”
  - “Cite snippet evidence in fields where possible” (store citations as offsets, not raw text if possible)

---

# D) Material Generation (Real files: PDF/PPTX/ZIP) + Manifest

## D1) Add dependencies for generation
**Edit:** `services/worker/requirements.txt` (or worker dependency file)

Add:
- `reportlab`
- `python-pptx`
- `beautifulsoup4`
- `pypdf` (or `PyPDF2`)

Update Dockerfile/worker build if needed to ensure deps install.

## D2) Implement generation module
**Create:** `services/worker/src/conference_prep/generate_materials.py`

Inputs:
- manuscript abstract text / IMRaD markdown draft (from pipeline artifacts if available),
- key results and figure references,
- conference requirements template,
- selected format(s): poster/oral/symposium

Outputs to `/data/artifacts/conference/<run_id>/`:
- `abstract.md`
- `poster.pdf` (if poster)
- `slides.pptx` (if oral)
- `symposium_deck.pptx` + `handout.pdf` (if symposium)
- `checklist.json`
- `guideline_summary.json`
- `manifest.json`

Poster generation:
- Use reportlab to generate a single-page PDF poster with sections:
  - Title, Authors (optional; support blinding), Background, Methods, Results, Conclusion
- Ensure **blinding mode**: strip institution/author when required.

Slides generation:
- Use python-pptx to generate a minimal but real PPTX:
  - title slide
  - methods slide
  - results slide with embedded figure placeholders
  - conclusion slide
- Keep within slide/time constraints if supplied.

## D3) Implement export bundler
**Create:** `services/worker/src/conference_prep/export_bundle.py`

- Zips the run folder into:
  - `conference_submission_bundle_<run_id>.zip`
- Include a top-level `manifest.json` with:
  - file list
  - sha256 hashes
  - byte sizes
  - createdAt timestamps
  - versions (python, reportlab, pptx, etc.)
- Return zip path + manifest.

## D4) Add worker export endpoint (orchestrates all steps)
**Edit:** `services/worker/api_server.py`

Add:
- `POST /api/ros/conference/export`

Behavior:
1. optionally call discovery (if no conference selected)
2. extract guidelines (or accept cached guideline artifacts)
3. summarize/normalize requirements (deterministic parse; optional orchestrator AI step)
4. generate materials
5. validate (QC)
6. create ZIP bundle
7. return response:
   - run_id
   - files + hashes + sizes
   - download paths
   - checklist results

**DEMO mode:** use fixtures for everything, but still generate real files (from fixture content) to test the pipeline.

---

# E) Orchestrator: API Wiring, Download Endpoints, Permissions

## E1) Ensure conference router is mounted
**Verify/Edit:** `services/orchestrator/routes.ts`

Mount:
- `app.use("/api/ros/conference", conferenceRouter);`

## E2) Add missing endpoints in orchestrator conference routes
**Edit:** `services/orchestrator/src/routes/conference.ts`

Add:
- `POST /discover` → proxies to worker `/api/ros/conference/discover`
- `POST /guidelines/extract` → proxies to worker endpoint
- `POST /export` → proxies to worker export endpoint
  - must validate role: RESEARCHER (or existing RBAC)
  - must log an audit event

## E3) Add download streaming endpoint in orchestrator
**Edit:** `services/orchestrator/src/routes/conference.ts`

Add:
- `GET /download/:runId/:filename`

Rules:
- Prevent path traversal: only allow basename filenames, reject `..` or `/`
- Stream file from `/data/artifacts/conference/<runId>/<filename>`
- Set `Content-Type` based on extension:
  - `.pdf` → `application/pdf`
  - `.pptx` → `application/vnd.openxmlformats-officedocument.presentationml.presentation`
  - `.zip` → `application/zip`
- Ensure authorization (same as export)

---

# F) Web UI: Add Stage 20 “Conference Prep” Panel + Fix Payloads

## F1) Add Stage 20 UI tab and workflow
**Edit:** `services/web/src/components/ui/conference-readiness.tsx`

Changes:
- Expand accepted stage IDs: 17|18|19 → 17|18|19|20
- When stageId === 20, render a “Conference Prep” flow:
  - inputs: keywords, year range, location preference, format selection
  - button 1: “Discover Conferences” → `POST /api/ros/conference/discover`
  - user selects conference → button 2: “Fetch Guidelines” → `/guidelines/extract`
  - button 3: “Generate Materials” → `POST /api/ros/conference/export`

## F2) Fix export payload: include reproducibility identifiers
Current payload is incomplete. Update export request to include:
- `researchId`
- `conferenceId` (or conference name + url)
- `formats`
- `requirementsOverrides` (optional)
- `blindingMode` (optional)
- `runMetadata` (optional)

## F3) Add persistent `researchId` in session/workflow state
**Edit:** `services/web/src/hooks/use-workflow-persistence.ts`

- Store `researchId` (uuid)
- Ensure it persists across refresh and is passed to conference panel.

## F4) Ensure stage 20 is PHI-gated and visible
**Edit:** `services/web/src/components/sections/workflow-pipeline.tsx`

- If there is a `PHI_GATED_STAGES` list for exportable stages, add stage 20.

---

# G) Reproducibility Bundle Integration

## G1) Extend reproducibility bundle to include conference artifacts
**Edit:** `services/orchestrator/src/services/reproducibility-bundle.ts` (or equivalent)

Add:
- conference artifacts to the archive:
  - `conference/requirements/*.json`
  - `conference/materials/<run_id>/*`
  - `conference/bundles/*.zip`
- Include manifest hashes.
- Ensure guideline text is sanitized in stored artifacts.

---

# H) CI / Testing (Must be real and passing)

## H1) Worker tests (pytest)
**Create:** `services/worker/tests/test_conference_discovery.py`
- discovery returns stable ranking for known keywords
- DEMO mode returns fixtures

**Create:** `services/worker/tests/test_guideline_extraction.py`
- parses a fixture HTML into correct structured hints
- sanitizes emails/phones (assert redacted)

**Create:** `services/worker/tests/test_material_generation.py`
- generates PDF and PPTX
- verifies files exist, non-zero bytes, sha256 in manifest

## H2) Orchestrator tests (vitest)
Add tests verifying:
- `/api/ros/conference/export` returns `run_id` and `downloadUrl` fields
- DEMO mode does not call worker (uses fixtures)
- download endpoint prevents path traversal

## H3) E2E (Playwright) — extend critical path
Add a simple E2E flow:
- go to Stage 20
- discover conferences (fixture)
- extract guidelines (fixture)
- generate materials
- download ZIP
- assert file downloaded

---

# I) Deployment and Local Dev Support

## I1) Docker updates
- Update worker Dockerfile if needed to ensure new deps install.
- Add a compose file for isolated testing:
  - **Create:** `docker-compose.conference-test.yml`
  - Bring up orchestrator + worker + shared `/data` volume

## I2) Kubernetes manifests (if applicable)
- Add readiness/liveness probe compatibility for new endpoints (worker/orchestrator)
- Ensure Stage 20 does not require new services unless you intentionally split guideline parsing into a separate microservice.

---

# J) Documentation

## J1) Add dedicated docs
**Create:** `docs/conference/CONFERENCE_PREP_PHASE.md`
Include:
- architecture overview (text diagram)
- DEMO vs LIVE behavior
- endpoint examples (curl)
- how artifacts are stored and hashed
- PHI safety rules

## J2) README update
Update README.md with:
- “Conference Preparation (Stage 20)” usage
- sample workflow
- how to run in DEMO mode

## J3) Roadmap update
Update `INTEGRATION-ROADMAP.md`:
- milestone: “Conference Module Beta by Q2 2026”
- tasks checklist

---

## 4) Acceptance Criteria (Definition of Done)

✅ Stage 20 appears in workflow UI under Conference Readiness and is optional  
✅ `POST /api/ros/conference/discover` returns ranked conferences (DEMO fixtures + LIVE registry)  
✅ `POST /api/ros/conference/guidelines/extract` returns sanitized text + hashes  
✅ `POST /api/ros/conference/export` generates real files: **PDF + PPTX + ZIP** and returns manifest  
✅ `GET /api/ros/conference/download/:runId/:filename` streams generated files securely  
✅ DEMO mode never calls external network or AI  
✅ LIVE mode PHI-scans before any outbound call  
✅ Tests pass (pytest + vitest + Playwright minimal)  
✅ Docs updated (README + docs/conference + roadmap)

---

## 5) Progress Reporting Format (after each commit/major change)

After each major chunk of work, output:

```text
STATUS
- completed: [..]
- in_progress: [..]
- blocked: [..]

CHANGES
- files_modified: [..]
- files_added: [..]

TESTS
- unit: pass/fail
- integration: pass/fail
- e2e: pass/fail
```

---

## 6) Implementation Order Recommendation (3 PR-sized commits)

1) **Stage 20 wiring + discovery + guideline extraction** (types, routes, worker endpoints, fixtures)  
2) **Material generation + export + downloads** (PDF/PPTX/ZIP, manifests, streaming endpoint)  
3) **Bundle integration + tests + docs** (repro bundle, E2E, documentation)

Proceed now.
