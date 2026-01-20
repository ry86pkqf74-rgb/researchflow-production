# Load & Performance Testing Integration Prompt (Claude Execution)

## Context
Repository: `ry86pkqf74-rgb/researchflow-production`

This document is a **single, authoritative execution prompt** for Claude.  
Claude should treat this file as an **instructional specification** and implement all tasks end‑to‑end without asking follow‑up questions.

---

## GOAL

Introduce **first‑class load and performance testing** to ResearchFlow Production in a way that is:

- Governance‑safe (DEMO mode only, no real AI calls)
- PHI‑safe (strictly synthetic payloads)
- CI‑enforced (performance budgets fail PRs)
- Scalable (guides worker replica tuning, Redis/DB throughput)

Deliverables include:
1. Locust-based load tests (orchestrator + worker)
2. Performance budgets with automated enforcement
3. CI workflow (PR smoke + nightly load)
4. Developer tooling (Makefile + docs)
5. Two prerequisite fixes required for safe load testing

---

## HARD CONSTRAINTS (MANDATORY)

- **No PHI** in payloads, fixtures, logs, or docs.
- **No external AI API calls** in CI or load tests.
- DEMO mode must remain **fail‑closed by default**.
- Any latency simulation must be explicitly opt‑in via env flags.
- All new functionality must pass existing CI/tests.

---

## REPO CONTEXT YOU MUST USE

### Services
- Orchestrator (Node/Express, DEMO/LIVE modes)
- Worker (FastAPI)

### Key Endpoints
**Worker**
- `POST /api/ros/irb/generate`
- `POST /api/ros/irb/export/docx`

**Orchestrator / UI**
- `POST /api/ai/research-brief`
- `POST /api/ai/evidence-gap-map`
- `POST /api/ai/study-cards`
- `POST /api/ai/decision-matrix`
- `POST /api/ai/manuscript-draft`
- `POST /api/ros/phi/scan` or `/api/phi/scan`

### Known Issue
`services/orchestrator/middleware/mode-guard.ts` currently uses `req.path`, which **breaks router-mounted paths**. This must be fixed as part of this work.

---

## PART A — DEMO MODE AI MOCKING (REQUIRED FOR LOAD TESTING)

### 1. Fix path handling

**File:** `services/orchestrator/middleware/mode-guard.ts`

- Replace usage of `req.path` with:
```ts
const fullPath =
  (req.originalUrl || `${req.baseUrl}${req.path}`).split('?')[0];
```

- Use `fullPath` for:
  - Logging
  - Mock lookup
  - Blocking logic

### 2. Add latency simulation (DEMO ONLY)

Add optional latency simulation guarded by env flags:

```env
DEMO_SIMULATE_LATENCY=false   # default OFF
DEMO_LATENCY_MIN_MS=800
DEMO_LATENCY_MAX_MS=2000
```

Behavior:
- If `DEMO_SIMULATE_LATENCY=true`, add a random delay
- Delay occurs **before** returning mock response
- No effect in LIVE mode

### 3. Expand mock coverage

Ensure mock map supports:
- `/api/ai/research-brief`
- `/api/ai/evidence-gap-map`
- `/api/ai/study-cards`
- `/api/ai/decision-matrix`
- `/api/ai/manuscript-draft`
- `/api/phi/scan` and `/api/ros/phi/scan`

Unknown endpoints should fall back to default mock response.

---

## PART B — WORKER TEMP FILE CLEANUP (CRITICAL)

### Problem
DOCX export endpoints leak temp files under load.

### Fix

**File:** `services/worker/api_server.py`

For all endpoints returning `FileResponse`:

- Use `BackgroundTasks` to delete temp files after response is sent.
- Example pattern:

```python
from fastapi import BackgroundTasks

@app.post("/api/ros/irb/export/docx")
async def export_docx(req: ExportRequest, background_tasks: BackgroundTasks):
    path = generate_docx(...)
    background_tasks.add_task(os.remove, path)
    return FileResponse(path, filename="irb.docx")
```

### Test
- Add a pytest validating cleanup behavior
- If filesystem verification is hard, refactor cleanup into helper and unit test that helper

---

## PART C — LOAD TESTING (LOCUST)

### Directory Structure
```
loadtest/
  requirements.txt
  locustfile_orchestrator.py
  locustfile_worker.py
  budgets.yaml
  README.md
  results/   # gitignored
```

### 1. Dependencies
`loadtest/requirements.txt`
- `locust`
- `pyyaml`
- `requests` (if needed)

### 2. Orchestrator Load Test
`locustfile_orchestrator.py`

Target:
- `ORCHESTRATOR_URL` (default `http://localhost:3001`)

Tasks:
- PHI scan
- Research brief
- Evidence gap map
- Study cards
- Decision matrix
- Manuscript draft

Rules:
- Synthetic payloads only
- `catch_response=True`
- Explicit request naming

### 3. Worker Load Test
`locustfile_worker.py`

Target:
- `WORKER_URL` (default `http://localhost:8000`)

Tasks:
- IRB generate (high weight)
- DOCX export (medium weight)
- Read-only status/baseline endpoint

Ensure:
- Responses are streamed/closed
- No file contents held in memory

---

## PART D — PERFORMANCE BUDGETS

### File
`loadtest/budgets.yaml`

Profiles:
- `smoke` (PR)
- `nightly` (scheduled)

Metrics:
- p95 latency
- failure rate

Example targets:
- PHI scan: p95 ≤ 500 ms
- IRB generate: p95 ≤ 5 s
- DOCX export: p95 ≤ 10 s
- AI endpoints: p95 ≤ 30 s

---

## PART E — BUDGET ENFORCEMENT SCRIPT

**File:** `scripts/perf/check_locust_budgets.py`

Responsibilities:
- Parse Locust CSV output
- Compare against `budgets.yaml`
- Fail with clear error if exceeded
- Emit JSON summary for CI artifacts

---

## PART F — CI INTEGRATION

### Workflow
`.github/workflows/performance.yml`

Triggers:
- `pull_request` → smoke profile
- `schedule` → nightly profile
- `workflow_dispatch`

Steps:
1. Start stack via docker-compose
2. Enable DEMO latency simulation
3. Run Locust (orchestrator + worker)
4. Enforce budgets
5. Upload CSV + JSON artifacts
6. Tear down stack

**No external AI calls allowed.**

---

## PART G — DEVELOPER UX

### Makefile Targets
- `make loadtest-smoke`
- `make loadtest-nightly`
- `make loadtest-orchestrator`
- `make loadtest-worker`

### Docs
- `loadtest/README.md`
- Optional: `docs/performance/LOAD_TESTING.md`

---

## ACCEPTANCE CRITERIA

- Temp files no longer leak under load
- Smoke test runs < 3 minutes
- CI fails if budgets exceeded
- DEMO mode remains safe-by-default
- Zero PHI exposure
- Zero external AI calls in CI

---

## SUGGESTED COMMITS

1. `fix(worker): cleanup temp export files`
2. `fix(orchestrator): correct DEMO path handling + latency simulation`
3. `feat(perf): add locust load tests + budgets`
4. `ci(perf): enforce performance budgets`
5. `docs(perf): load testing documentation`

---

**EXECUTE ALL TASKS ABOVE WITHOUT ASKING QUESTIONS.**
