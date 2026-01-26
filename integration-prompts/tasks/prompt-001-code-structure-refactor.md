# Claude Code Prompt — Code Structure Optimization (ResearchFlow Production)

Repo: `ry86pkqf74-rgb/researchflow-production` (default branch: `main`)

> Paste everything below into Claude Code. This is written to drive **small, reviewable commits** and deliver a **modular stage/plugin workflow** plus **single-source PHI patterns** across services.

---

## ROLE

You are **Claude Code** working directly in the repository `ry86pkqf74-rgb/researchflow-production`.

---

## GOAL

Refactor to reduce future complexity growth by implementing three concrete improvements:

1) **Guardrails** to prevent "giant PRs/commits" (encourage small iterative changes).
2) Refactor the Python "19-stage workflow" execution path into a **modular plugin/stage architecture** (stage registry + runner), replacing the current stub loop in `services/worker/src/main.py`.
3) Reduce PHI pattern drift/redundancy by consolidating:
   - **Node-side scanners** to use `@researchflow/phi-engine` as the **single TS pattern source**, and
   - **Python IRB PHI guard** to use the **central Python PHI patterns/output guard**.

---

## NON-NEGOTIABLES

- **No PHI leakage**: no raw PHI values should be returned in scan outputs or logged.
  - Location-only (offsets / row / col) and/or hashes are allowed.
- Preserve existing public APIs where possible; if a breaking change is required, do a backward-compatible transition (deprecate fields; don't remove abruptly).
- Keep changes split into **SMALL commits** (≤ ~500–800 LOC net per commit) and ideally a feature branch + PR.

---

## REPO CONTEXT (what you should find)

- `services/worker/src/main.py`: `run_stages()` is currently a stub that just loops `range(1, 20)` with no registry/runner.
- `services/orchestrator/services/phi-scanner.ts`: contains duplicated PHI patterns and returns `matchedText` (which can leak PHI).
- `packages/phi-engine/src/patterns.ts`: canonical TS PHI patterns.
- `services/collab/src/phi-scanner.ts`: includes fallback PHI patterns that can drift.
- Python patterns already exist in `services/worker/src/validation/phi_patterns.py`, but `services/worker/src/ros_irb/phi_guard.py` is separate/minimal.

---

## PRE-FLIGHT (READ-ONLY)

1) Read and briefly summarize current behavior in these files:
   - `services/worker/src/main.py` (note `run_stages` stub)
   - `services/orchestrator/services/phi-scanner.ts` (note local PHI duplication and matchedText behavior)
   - `packages/phi-engine/src/patterns.ts` and `packages/phi-engine/src/regex-scanner.ts`
   - `services/worker/src/validation/phi_patterns.py`
   - `services/worker/src/ros_irb/phi_guard.py`
2) Identify call sites of `services/orchestrator/services/phi-scanner.ts` and confirm which tests cover it.

---

## IMPLEMENTATION PLAN (execute in order, commit each step separately)

### COMMIT 1 — `chore(governance): add PR size & change-scope guardrails`

**A) Add PR size guard workflow**
- Create: `.github/workflows/pr-size-guard.yml`
- Trigger: `pull_request` (opened, synchronize, reopened)
- Steps:
  - checkout with `fetch-depth: 0`
  - compute diff size between base and head
  - fail if total changed lines (`additions+deletions`) exceeds a threshold (start at **1500** lines; configurable via env)
  - print a helpful message: "PR too large; split into smaller PRs/feature flags"
- Implementation detail (suggested):
  - `git diff --numstat origin/${{ github.base_ref }}...${{ github.sha }}` to sum additions/deletions
  - ensure it works for fork PRs (use `github.event.pull_request.base.sha` and `.head.sha` if needed)

**B) Add PR template emphasizing small PRs**
- Create: `.github/pull_request_template.md`
- Include checkboxes:
  - [ ] Focused on one feature/fix
  - [ ] Tests added/updated
  - [ ] No PHI in logs/outputs
  - [ ] Docs updated (if needed)

**C) Add policy doc**
- Create: `docs/dev/SMALL_PR_POLICY.md`

---

### COMMIT 2 — `refactor(phi): make orchestrator PHI scanner use @researchflow/phi-engine`

**Problem**
`services/orchestrator/services/phi-scanner.ts` duplicates patterns and can include raw `matchedText`.

**Target outcome**
- Orchestrator `scanForPHI()` delegates detection to **`@researchflow/phi-engine`**:
  - `RegexPhiScanner` + `PHI_PATTERNS`
- Scan results **do NOT include raw matched PHI text**.
  - Keep positions (start/end offsets)
  - Use either `matchedText = "[REDACTED]"` or store `exampleHash` (sha256 prefix)
- Preserve `riskLevel` / `requiresOverride` semantics and keep API compatible.

**Steps**
1) Edit `services/orchestrator/services/phi-scanner.ts`:
   - Remove local `PHI_PATTERNS` regex definitions.
   - Import:
     - `import crypto from "crypto";`
     - `import { RegexPhiScanner, PHI_PATTERNS as CANONICAL_PATTERNS } from "@researchflow/phi-engine";`
   - Instantiate a module-level scanner singleton.
   - Build lookup metadata from `CANONICAL_PATTERNS` (hipaaCategory/description).
   - `const findings = scanner.scan(content)`
   - Map each finding to orchestrator's PHI match shape:
     - `category`: map phi-engine type -> existing orchestrator PHICategory union.
     - `matchedText`: **never** raw. Use `"[REDACTED]"` or `exampleHash`.
     - `position`: `start/end` from finding indices.
     - `confidence`: from finding.
     - `hipaaIdentifier`, `pattern`, `description`: from canonical metadata.
2) Ensure override storage contains only safe metadata.
3) Update unit tests (likely `services/orchestrator/tests/...`):
   - Add assertion that `matchedText` is not the literal input SSN/email/etc.
4) Ensure logs don't print raw findings.

Run relevant test target(s): `npm test` / `pnpm test` / repo Makefile targets as applicable.

---

### COMMIT 3 — `refactor(phi): reduce collab scanner drift by consuming phi-engine patterns`

**Problem**
`services/collab/src/phi-scanner.ts` has fallback patterns that drift.

**Target outcome**
- Keep dynamic import behavior (phi-engine preferred).
- If import fails, fallback patterns must be a **minimal high-confidence** subset:
  - SSN, MRN, PHONE, EMAIL, DOB
- Ensure collab outputs remain **location-only metadata** (no raw PHI).

**Steps**
1) If phi-engine import succeeds, always use it (already attempts this).
2) If import fails:
   - reduce fallback patterns to high-confidence-only
   - comment: fallback must remain consistent with phi-engine high-confidence subset
3) Add a small TS unit test verifying:
   - collab scanner output contains offsets/types only, not raw matched text.

---

### COMMIT 4 — `refactor(worker): introduce stage registry + workflow runner (plugin architecture)`

**Problem**
`services/worker/src/main.py` stage runner is a stub.

**Target outcome**
Add a new Python workflow engine with:
- `Stage` interface
- stage registry (id -> stage)
- runner that executes stages sequentially and emits:
  - completed stage IDs
  - artifact list (paths only)
  - manifest dict with run metadata and sanitized errors (no PHI)

**Design constraints**
- Offline-safe by default; no network calls.
- Fail-closed on stage failures.
- Stage outputs must be PHI-safe (no raw PHI in logs or returned results).

**Implementation steps**

**A) Create new package:** `services/worker/src/workflow_engine/`
- `__init__.py`
- `types.py`:
  - `StageResult` (status, artifacts, summary, warnings, errors_sanitized)
  - `StageContext` (job_id, config, dataset_pointer, artifact_root, mode, tmp_root)
  - `Stage` (Protocol/ABC): `id:int`, `name:str`, `run(ctx)->StageResult`
- `registry.py`:
  - global registry dict
  - decorator `register_stage(stage_id:int)` for stage classes
  - `get_stage(id)`, `list_stages()`
- `runner.py`:
  - `run_stages(stage_ids: list[int], ctx: StageContext)`
  - deterministic ordering
  - sanitize errors (truncate; hash suspicious substrings)
  - write manifest JSON to: `artifact_root/manifests/<job_id>_<run_id>.json`

**B) Implement 3 REAL stages (proof of architecture)**

1) **Stage 3 (IRB Proposal)**
   - Wrap existing IRB generation logic used by worker API (e.g., assemble/render IRB markdown).
   - After generating markdown, run a **PHI output guard** and fail-closed if PHI detected.
   - Save artifact: `artifact_root/irb/<job_id>/irb_draft_<run_id>.md`
   - Summary metadata only (word count, section count).

2) **Stage 5 (PHI Scanning)**
   - Use the existing Python governance scanner to scan `dataset_pointer`.
   - Save PHI report JSON: `artifact_root/phi_scan/<job_id>/phi_scan_<run_id>.json`
   - Summary = counts only.

3) **Stage 8 (Data Validation)**
   - Validate dataset using existing validator and schema_name from config.
   - Sanitize/harden any schema errors (hash column names if needed).
   - Save validation summary JSON: `artifact_root/validation/<job_id>/validation_<run_id>.json`

**C) Update `services/worker/src/main.py`**
- Replace placeholder loop with:
  - create `StageContext`
  - call `workflow_engine.runner.run_stages(...)`
  - populate `JobResult.manifest` and `JobResult.artifacts`

**D) Add Python tests**
- Create: `services/worker/src/workflow_engine/tests/test_workflow_engine_runner.py`
  - registry has stage IDs
  - running `[5]` on a synthetic CSV yields artifact + manifest
  - manifest contains no raw PHI strings (assert against known patterns)
- Add tests for stage 3 & stage 8 with synthetic inputs.

Run: `cd services/worker && pytest --maxfail=1 -q`

---

### COMMIT 5 — `refactor(phi): consolidate Python IRB PHI guard onto central patterns`

**Problem**
`services/worker/src/ros_irb/phi_guard.py` is separate and minimal.

**Target outcome**
IRB PHI guard uses central governance output guard (single-source) instead of its own regex list.

**Steps**
1) In `services/worker/src/ros_irb/phi_guard.py`:
   - replace internal regex patterns with adapter to central `output_phi_guard`:
     - `contains_phi(text)` -> uses high-confidence scan
     - `redact_phi(text)` -> uses canonical redact
   - Keep existing function signatures stable.
2) Add tests `services/worker/src/ros_irb/tests/test_phi_guard.py`:
   - detects SSN/email/phone
   - redacts consistently with `[REDACTED:<kind>]` style markers (or whatever canonical does)

Run: `cd services/worker && pytest -q`

---

## FINAL QA + DOCS

1) Add/update doc indicating PHI pattern sources:
- Add `docs/governance/PHI_PATTERN_SOURCES.md` (or update existing PHI boundary docs) to state:
  - TS canonical source: `packages/phi-engine/src/patterns.ts`
  - Orchestrator uses phi-engine (no local drift)
  - Python IRB uses central output guard / tiered patterns
2) Run:
- `make test`
- `make lint`

---

## DELIVERABLES CHECKLIST

- [ ] PR size guard workflow added and working.
- [ ] Orchestrator PHI scanner no longer duplicates patterns; no raw matched PHI returned/stored.
- [ ] Python worker stage runner uses registry/runner; at least stages 3/5/8 implemented.
- [ ] Python IRB PHI guard delegates to central output guard patterns.
- [ ] Tests added for each new behavior.
- [ ] Docs updated.

---

## FINAL REPORT (when done)

Summarize:
- files changed
- tests run + status
- any follow-ups (e.g., full cross-language "single-source PHI registry" later, config-driven stage ordering, stage dependency graph, etc.)
