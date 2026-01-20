# Claude Execution Prompt — Broaden Playwright E2E Critical Journeys (ResearchFlow Production)

**Repo:** `researchflow-production`

## Objective
Expand Playwright E2E coverage to reliably test the **most critical user journeys** end-to-end:

1. **Create a new project** (via a bundle import UI flow).
2. **Upload data** (bundle upload UI).
3. **Run / view pipeline** status and results.
4. **View artifacts** produced by a run.
5. Validate **multiple user roles** (e.g., ADMIN vs RESEARCHER vs VIEWER).
6. Simulate **failure scenarios**:
   - AI provider failure (backend returns 500)
   - Offline / no-network mode

The tests must be deterministic, stable, and not depend on unpredictable external services.

---

## Key Constraints
- **Do not rely on external AI providers** in E2E tests.
- Prefer **`data-testid` selectors** over text selectors.
- Avoid brittle timing (no arbitrary sleeps unless absolutely necessary). Use Playwright’s `expect(...).toBeVisible()` / `waitFor*` patterns.
- Keep all fixture data **non-PHI**.

---

## Deliverables

### D1 — New Route + Page for Bundle Import

#### Task D1.1: Add a dedicated `/import` route
1. Update: `services/web/src/App.tsx`
2. Add a route:
   - `path="/import"` → renders a new page component `ImportBundlePage`

> Notes:
> - Keep routing consistent with your existing patterns.
> - Ensure the route is reachable in dev and test.

#### Task D1.2: Create the Import Bundle page
Create: `services/web/src/pages/import-bundle.tsx`

Requirements:
- Render the existing component: `BundleImport`
- Provide a simple heading (e.g., “Import Project Bundle”)
- Provide a clear navigation element back to Home (button/link)
- Ensure the page is minimal and testable

---

### D2 — Add a Minimal Fixture Bundle File

Create: `tests/e2e/fixtures/sample-bundle.json`

Requirements:
- Tiny JSON payload (keep it small)
- Contains no PHI
- Must be valid JSON

Example:
```json
{
  "bundleVersion": "1.0",
  "project": { "name": "E2E Sample Project" },
  "datasets": [],
  "metadata": { "createdBy": "e2e" }
}
```

---

### D3 — New Critical Journeys E2E Spec

Create: `tests/e2e/critical-journeys.spec.ts`

This file must cover all scenarios below.

---

## Scenario A — Project Creation + Upload Data (Bundle Import)

### Why
Your UI has a bundle import flow component, but the backend endpoints may not exist or may not be stable for E2E. We will implement this E2E flow **by mocking network responses**.

### Required Playwright behavior
- Visit `/import`
- Upload `tests/e2e/fixtures/sample-bundle.json` using `data-testid="input-file"`
- Mock the network calls that `BundleImport` makes (or should make):

#### Mock 1: `POST /api/bundles/verify`
Return a “valid bundle” response:
```json
{
  "isValid": true,
  "schemaValid": true,
  "provenanceVerified": true,
  "hashIntegrity": true,
  "errors": [],
  "warnings": [],
  "bundleInfo": {
    "projectName": "E2E Sample Project",
    "bundleVersion": "1.0"
  }
}
```

#### Mock 2: `POST /api/projects/import-handoff`
Return an import success:
```json
{ "success": true, "projectId": "proj-e2e-001" }
```

### Assertions
- The UI progresses through the verify/import steps
- The UI shows a clear “success” signal (text, status chip, or other element)
- If a toast is used, assert it appears
- If the flow navigates elsewhere after success, assert destination loads

### Selector rules
Prefer existing selectors from `BundleImport`:
- `data-testid="dropzone"`
- `data-testid="input-file"`
- `data-testid="button-import"`
- `data-testid="button-cancel"`

If any missing, add them in the component (minimal, non-invasive).

---

## Scenario B — Pipeline Dashboard: View Runs + View Artifacts

### Why
A core user journey is to view pipeline runs and inspect artifacts.

### Required Playwright behavior
- Log in as **RESEARCHER** or **ADMIN** using existing auth fixtures
- Navigate to `/pipeline`
- Wait for stable “loaded” indicator
- Interact with runs and artifacts UI

### Assertions
The test must be resilient to an empty environment:

**If runs exist:**
1. Click a run `button-view-run-*`
2. Ensure the details panel shows
3. Toggle artifacts with `button-toggle-artifacts`
4. Assert at least one `artifact-item-*` is present OR an empty artifacts state is rendered

**If no runs exist:**
- Assert the empty state: “No Pipeline Runs” (or the equivalent UI)

### Selector rules
Use existing `data-testid`s wherever possible, e.g.:
- `card-status-summary`
- `tab-runs`
- `button-refresh-runs`
- `button-view-run-<id>`
- `button-toggle-artifacts`
- `artifact-item-<id>`

If any needed IDs are missing, add them **only where necessary**.

---

## Scenario C — Role Coverage: ADMIN vs RESEARCHER vs VIEWER

### Why
Critical journeys must be validated across user roles.

### Required Playwright behavior
Create a small helper inside the spec (or in a shared helper file) that:
- logs in as a given role (using existing fixtures)
- loads `/pipeline`
- asserts the page loads

Then run the pipeline assertions under:
- **ADMIN**
- **RESEARCHER**
- **VIEWER**

### Assertions by role
- ADMIN / RESEARCHER:
  - should see the pipeline dashboard
  - should see run cards/controls if any exist

- VIEWER:
  - should load the pipeline dashboard
  - may have restricted actions
  - assert restricted state is handled gracefully (e.g., disabled buttons or missing actions)

If the UI does not yet enforce RBAC in the front-end, the test should at minimum confirm the dashboard loads and does not error.

---

## Scenario D — Failure Simulation: AI Provider Failure

### Why
UI should fail gracefully when an AI endpoint fails.

### Required Playwright behavior
- Intercept a relevant endpoint call used by the UI (choose the most direct/representative):
  - Example: an `/api/ai/*` endpoint if present
  - Or a pipeline endpoint that triggers AI work
- Force response status `500`

### Assertions
- UI shows a clear error state
- UI does not crash or hang

### Implementation requirement
If there is no stable error selector today, add a minimal UI element:
- `data-testid="error-banner"` on the error alert component

Then assert `error-banner` becomes visible in the test.

---

## Scenario E — Failure Simulation: Offline / No-Network

### Why
The app advertises governance/no-network modes. E2E should validate that the UI handles offline conditions.

### Required Playwright behavior
- Load `/pipeline`
- After load completes, set offline:
  - `await context.setOffline(true)`
- Click refresh (`button-refresh-runs`)

### Assertions
- UI shows a clear offline/network error state
- UI remains usable (no blank screen)

### Implementation requirement
If you do not have a stable banner for offline mode today, add one:
- `data-testid="offline-banner"` when fetch requests fail with network error

---

## Determinism & Reliability Improvements

### Task R1 — Stable Environment Setup in Tests
In `critical-journeys.spec.ts`, ensure each test:
- clears storage / cookies if needed
- uses deterministic waits
- avoids relying on pre-existing runs unless the test explicitly supports empty-state

### Task R2 — Prefer `data-testid`
If any element needed for the critical path has no `data-testid`, add it.

Minimal allowed additions:
- `data-testid="error-banner"`
- `data-testid="offline-banner"`
- Any missing IDs in the import page shell

---

## Optional (Nice-to-have)
If it’s low effort and aligns with your app behavior, add:
- A smoke test that confirms Home (`/`) loads and navigation to `/pipeline` works.

---

## How to Run
Ensure these commands pass locally:

- `npm run test:e2e`

If the repo requires Docker services for E2E, ensure the existing Playwright `webServer` command still works.

---

## Acceptance Criteria
All of the following must be true:

1. `npm run test:e2e` passes locally.
2. A new spec `tests/e2e/critical-journeys.spec.ts` exists and includes:
   - Bundle import flow (with mocked `/api/bundles/verify` and `/api/projects/import-handoff`)
   - Pipeline dashboard run selection + artifact viewing
   - Role coverage (ADMIN + RESEARCHER + VIEWER)
   - AI failure simulation test
   - Offline/no-network simulation test
3. Tests are stable:
   - no flaky sleeps
   - resilient to empty-state conditions
   - uses `data-testid` selectors

---

## Implementation Checklist (Quick)
- [ ] Add `/import` route in `services/web/src/App.tsx`
- [ ] Add `services/web/src/pages/import-bundle.tsx`
- [ ] Add `tests/e2e/fixtures/sample-bundle.json`
- [ ] Add `tests/e2e/critical-journeys.spec.ts`
- [ ] Add `data-testid` selectors only where needed
- [ ] Ensure error/offline states have stable selectors (`error-banner`, `offline-banner`)
- [ ] Run `npm run test:e2e` and confirm green
