# Prompt for Claude — Implement Test Documentation & Maintenance

You are Claude Code working in the repo: `researchflow-production`.

## GOAL
Create clear, contributor-friendly test documentation (quality > quantity) and ensure complex test scenarios are documented. Add a repo-wide `TESTING.md` and a workflow-testing guide under `docs/testing/`. Update minimal references so new contributors can run the suite correctly (including when Postgres/Redis are required and when `NO_NETWORK` / `MOCK_ONLY` should be enabled). **Do NOT change application behavior** — docs and documentation-only link fixes are the priority.

## SCOPE (what to change)
1) **ADD**: `TESTING.md` (repo root) — the canonical “how to run tests locally” guide.
2) **ADD**: `docs/testing/README.md` — index of testing docs.
3) **ADD**: `docs/testing/WORKFLOW_INTEGRATION_TESTING.md` — guide for workflow/orchestration-related tests (pytest + offline determinism).
4) **UPDATE**: `AGENT.md` — add a short pointer to `TESTING.md` in the “Running Tests” / “Test Documentation” area.
5) **UPDATE**: `README.md` (repo root) — in the Testing section, add a single line linking to `TESTING.md`.
6) **UPDATE (doc-only)**: `services/worker/workflows/README.md` — fix the link to the workflow testing guide to use a repo-root absolute path (`/docs/testing/...`) so it works everywhere.
7) **OPTIONAL (tiny, doc-only)**: `Makefile` help output — add a single help line under “Testing” pointing to `TESTING.md`. Do not change any Make targets behavior.

## CONSTRAINTS / STYLE
- Do not introduce secrets. Use placeholders and explicitly say “use sandbox keys” when applicable.
- Preserve governance language: default fail-closed, offline-by-default.
- Call out when local infra is required: Postgres/Redis, and how to start/stop them.
- Prefer repo-root absolute links in Markdown where it prevents broken relative paths.
- Keep docs concise but complete: new contributors should be able to run the suite without guessing.
- After changes, run lightweight validation:
  - `npm -s run test:unit` (or `make test-unit` if preferred)
  - Ensure Markdown links are not obviously broken (spot-check).
  - Do not spend time fixing unrelated doc links unless touched by this change.

---

## 1) CREATE `TESTING.md` (root)

Create `TESTING.md` with **EXACT** content below:

```markdown
# Testing Guide (Local + CI)

This repo contains multiple test suites (Node/Vitest, Python/pytest, Playwright E2E, containerized manuscript-engine tests). The default posture is **fail-closed** and **offline-by-default**.

If you are new: start with **Quick Start**.

---

## Quick Start (most contributors)

### 0) One-time setup
```bash
make setup
```

### 1) Run the default suite (fastest “is my branch green?”)
```bash
make test
```

### 2) Run E2E (browser) when UI/workflow changes
```bash
make test-e2e
```

### 3) Manuscript-engine tests (containerized, auto-approve friendly)
```bash
./test-manuscript-engine.sh test
./test-manuscript-engine.sh smoke
./test-manuscript-engine.sh e2e
```

---

## What tests exist in this repo?

### A) Node.js (Vitest)
- **Unit tests**: `npm run test:unit`
- **Integration tests**: `npm run test:integration`
- **Coverage**: `npm run test:coverage`
- **Governance-critical** suites:
  - `npm run test:rbac`
  - `npm run test:phi`
  - `npm run test:fail-closed`
  - `npm run test:mode-enforcement`
  - `npm run test:invariants`

### B) Python Worker (pytest)
There are Python tests under `services/worker/src/**/tests/` and any worker-level test folders configured for pytest.

Recommended options:
- **Docker-based (consistent)** via Makefile:
  ```bash
  make test-unit
  make test-integration
  ```
  (These run pytest inside the `worker` container.)

- **Run locally (faster iteration if you prefer local Python)**:
  ```bash
  cd services/worker
  pip install -r requirements.txt
  pytest
  ```

### C) Playwright E2E (UI)
- Run:
  ```bash
  npm run test:e2e
  ```

**Important note about base URL / ports**
- Docker Compose serves the web UI on `http://localhost:5173` by default.
- Playwright uses `BASE_URL` if provided.
If you already have services running and want Playwright to target the Docker UI:
```bash
docker-compose up -d
BASE_URL=http://localhost:5173 CI=true npm run test:e2e
```

### D) Manuscript Engine (containerized)
Use the repo root runner:
```bash
./test-manuscript-engine.sh test
./test-manuscript-engine.sh watch
./test-manuscript-engine.sh coverage
./test-manuscript-engine.sh smoke
./test-manuscript-engine.sh e2e
```

See also:
- `CONTAINER_TESTING.md`
- `packages/manuscript-engine/DOCKER_TESTING.md`
- `docs/PHASE_B_CLOSEOUT.md`

---

## When do I need Postgres/Redis running?

Some integration and smoke tests require live infrastructure.

### Start infra only (Postgres + Redis)
```bash
docker-compose up -d postgres redis
```

### Start all services (API + worker + web + collab)
```bash
docker-compose up -d
```

### Apply DB init/migrations (Compose must be running)
```bash
make db-migrate
```

### Stop everything
```bash
docker-compose down
```

### Nuke volumes (destructive)
```bash
docker-compose down -v
```

---

## Offline vs Networked tests (governance-first)

### Default: offline-by-default
Most tests should run with:
- `ROS_MODE=STANDBY`
- `NO_NETWORK=1` (or `true`)
- `MOCK_ONLY=1` (or `true`)

### External integrations (PubMed, ORCID, plagiarism providers, LLMs)
- Tests must **stub** external APIs by default.
- If you must run a “real integration” locally:
  - Use **sandbox keys** and **synthetic data only**
  - Keep these tests opt-in (document how to run them, do not make them default)
  - Never commit secrets or real PHI

Examples of sandbox toggles you may encounter:
- ORCID: `ORCID_SANDBOX=true`
- Copyleaks: `COPYLEAKS_SANDBOX=true`

---

## Writing high-quality tests (minimum standard)

- Prefer behavior-driven assertions (not “coverage-only” tests).
- For complex scenarios (network stubs, mode gates, approval flows), include:
  - A short comment describing the strategy
  - What is mocked vs real
  - Any required env vars
  - Any fixtures and why they are safe (no PHI)

---

## Troubleshooting

### Node out-of-memory
If you see memory issues running TypeScript builds/tests:
```bash
export NODE_OPTIONS="--max-old-space-size=4096"
```

### Playwright failing to reach the app
- Ensure something is serving the UI
- Or run with:
```bash
docker-compose up -d
BASE_URL=http://localhost:5173 CI=true npm run test:e2e
```

### “Database connection refused”
- Start infra:
```bash
docker-compose up -d postgres redis
```
```

---

## 2) CREATE `docs/testing/README.md`

Create `docs/testing/README.md` with **EXACT** content:

```markdown
# Testing Docs

- **Repo-wide local testing guide**: [`/TESTING.md`](/TESTING.md)
- **Workflow integration testing**: [`/docs/testing/WORKFLOW_INTEGRATION_TESTING.md`](/docs/testing/WORKFLOW_INTEGRATION_TESTING.md)

Additional references:
- Manuscript engine container testing: [`/CONTAINER_TESTING.md`](/CONTAINER_TESTING.md)
- Manuscript engine package guide: [`/packages/manuscript-engine/DOCKER_TESTING.md`](/packages/manuscript-engine/DOCKER_TESTING.md)
- Phase B smoke/E2E details: [`/docs/PHASE_B_CLOSEOUT.md`](/docs/PHASE_B_CLOSEOUT.md)
```

---

## 3) CREATE `docs/testing/WORKFLOW_INTEGRATION_TESTING.md`

Create `docs/testing/WORKFLOW_INTEGRATION_TESTING.md` with **EXACT** content:

```markdown
# Workflow Integration Testing (Worker Orchestration)

This guide covers testing for workflow orchestration scaffolding (Snakemake/Nextflow wrappers) and the governance-first runtime guarantees:
- **Offline-by-default** (`NO_NETWORK=1`)
- **Mock-only AI** (`MOCK_ONLY=1`)
- **Fail-closed** gating and deterministic outputs
- **Quarantined outputs** under `.tmp/`

> This is intentionally **metadata-only** and must never emit PHI.

---

## What these tests should validate

1) **Determinism**
- Same inputs/config → same ordering, same manifest hashes, stable outputs (or stable placeholders in stub phase)

2) **STANDBY enforcement**
- When running in STANDBY, network calls are blocked and AI providers remain mocked

3) **No forbidden patterns**
- Workflow files must not include disallowed network patterns or unsafe paths

4) **Quarantine discipline**
- Outputs must stay under `.tmp/` and not leak outside

---

## How to run

### Option A: run via the worker container (recommended)
```bash
# From repo root
docker-compose run --rm worker pytest -k "workflow" -v
```

### Option B: run locally in the worker directory
```bash
cd services/worker
pip install -r requirements.txt
pytest -k "workflow" -v
```

### Ensure offline flags
For workflow integration runs, set:
```bash
export ROS_MODE=STANDBY
export NO_NETWORK=1
export MOCK_ONLY=1
```

---

## When Snakemake/Nextflow are installed

These tools are optional. Tests should not require them unless explicitly marked “opt-in”.
If installed, you can additionally validate orchestration commands:

```bash
# From repo root
make workflow-dryrun
make workflow-snakemake
make workflow-nextflow
```

---

## Adding new workflow-related tests (standard)

- Prefer `-k`-selectable naming: include “workflow” in test names or markers
- Document the scenario:
  - Inputs used (synthetic only)
  - Expected invariants
  - Any environment requirements
  - What is stubbed/mocked
```

---

## 4) UPDATE `AGENT.md` to point to TESTING.md

In `AGENT.md`, under “Running Tests” (or near “Test Documentation”), add a short note:

- Add a bullet line: `- Repo-specific test instructions: see TESTING.md (Docker-first, offline defaults, Postgres/Redis notes).`

Keep it short; do not rewrite AGENT.md.

---

## 5) UPDATE root `README.md` to link to TESTING.md

In the existing “## Testing” section (after the command examples), add one line:

`See [TESTING.md](/TESTING.md) for full local setup, offline flags, infra requirements, and E2E/container notes.`

---

## 6) UPDATE `services/worker/workflows/README.md` link to the new workflow testing doc

Find the line that references `docs/testing/WORKFLOW_INTEGRATION_TESTING.md` and change it to use an absolute repo-root link:

- Replace: `(../docs/testing/WORKFLOW_INTEGRATION_TESTING.md)`
- With: `(/docs/testing/WORKFLOW_INTEGRATION_TESTING.md)`

Do not change other content.

---

## 7) OPTIONAL: Add a help hint in `Makefile`

In the `help:` target under the “Testing” block, add:

`@echo "  Docs: see TESTING.md - local test setup, infra notes, offline flags"`

Do not change targets/behavior.

---

## VALIDATION (after edits)

Run:

```bash
npm -s run test:unit
```

Optionally spot-check:
- `make help` prints the new docs hint (if you did step 7)
- `README.md` links render
- `services/worker/workflows/README.md` link works on GitHub

---

## COMMIT

Create a single commit with a conventional message, e.g.:

`docs(testing): add TESTING.md and workflow testing docs`

Include:
- TESTING.md
- docs/testing/README.md
- docs/testing/WORKFLOW_INTEGRATION_TESTING.md
- AGENT.md update
- README.md update
- (optional) Makefile help hint
- workflows README link fix

Then push.
