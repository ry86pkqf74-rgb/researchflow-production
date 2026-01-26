# ResearchFlow Production Documentation Uplift — Claude Implementation Prompt

You are Claude (coding agent) operating **inside** the repo:
`ry86pkqf74-rgb/researchflow-production` (default branches: `main`, `develop`).

## TASK
Implement a documentation uplift focused on onboarding, user enablement, integration, architecture clarity, and production operations.

## GOALS (deliverables)
1) Add a **human-friendly contributor guide**: `CONTRIBUTING.md`
2) Add a **researcher user manual** for the web UI: `docs/USER_GUIDE.md`
3) Add **API usage examples** (curl + Postman collection) for integrators:
   - `docs/API_USAGE.md`
   - `docs/postman/ResearchFlow.postman_collection.json`
4) Add a **system architecture deep dive** with request-flow + failure modes + sequence diagrams: `docs/ARCHITECTURE_DEEP_DIVE.md`
5) Add a **deployment/operations runbook** for DevOps: `docs/OPS_RUNBOOK.md`
6) Add a **docs landing page** that links everything: `docs/README.md`
7) Update existing top-level docs to point to the new ones:
   - `README.md` (add “Documentation” section + link to CONTRIBUTING + link to user guide/runbook)
   - `AGENT.md` (keep AI-agent guidance, but add a prominent “Human Contributors” pointer to CONTRIBUTING)
8) Security scan note: repo currently has CI “Security Audit” (e.g., npm audit). There is **no** `.trivyignore` in this repo.
   - Add `.trivyignore` as a **stub** (empty but with header comment) and document its intended use + how to justify ignores in `docs/OPS_RUNBOOK.md` (Security section).
   - Do **not** add new CI scanners unless it’s trivial and clearly aligned; primary requirement is documentation.

## CONSTRAINTS
- Do NOT introduce any PHI/PII in docs. Use placeholders only.
- Keep docs accurate to the repo’s current behavior:
  - Dev commands are primarily via `make` (see `Makefile`, `scripts/setup.sh`, `scripts/dev.sh`).
  - Key env vars are in `.env.example` (root) and `services/worker/.env.example`.
  - Staging deploy runs from `develop`; production deploy runs from `v*` tags with manual approval (see `.github/workflows/deploy-staging.yml`, `.github/workflows/deploy-production.yml`).
  - API examples should reflect routes actually used by the web UI and tests (e.g., `/api/workflow/stages`, `/api/workflow/execute/:stageId`, `/api/ros/artifacts`, `/api/ros/export/reproducibility-bundle/:researchId`, governance endpoints, etc.).
- Prefer Mermaid diagrams for architecture docs (GitHub renders them).
- Keep tone “professional, concise, healthcare-governance aware”.

## WORK PLAN (do these in order)

### A) Repo scan (read-only)
1. Open and skim:
   - `README.md`
   - `AGENT.md`
   - `.env.example`
   - `Makefile`
   - `scripts/setup.sh`, `scripts/dev.sh`, `scripts/deploy.sh`
   - OpenAPI specs: `shared/contracts/api.yaml`, `shared/contracts/manuscript-api.yaml` (if present)
   - Web UI callsites to confirm endpoints (e.g., `services/web/src/components/sections/workflow-pipeline.tsx`, `services/web/src/components/sections/artifact-vault.tsx`)
   - Export-bundle routes: `services/orchestrator/src/routes/export-bundle.ts`
2. Confirm any existing docs that overlap with the new ones; do not duplicate—link instead.

### B) Create `CONTRIBUTING.md` (human contributor guide)
Create `CONTRIBUTING.md` in repo root with these sections:

1. **Overview**
   - What repo is (ResearchFlow Production: orchestrator + worker + web + shared packages)
   - Branch model: `develop` for active work, `main` stable/release; tags `v*` for prod deploy.

2. **Quick Start (local dev)**
   - Prereqs: Docker/Docker Compose, Node 20+, Python 3.11+, Make
   - Setup:
     - `make setup`
     - copy env: `.env.example → .env` (already in setup)
   - Run:
     - `make dev`
   - Key URLs:
     - Web UI (5173), API (3001), Worker (8000)

3. **Coding Standards**
   - TypeScript: strict, lint, format; how to run `npm run lint`, `npm run format`, `npm run type-check`
   - Python: ruff + mypy + pytest (note: worker tests run in docker-compose in Makefile)
   - No secrets in code; use env vars only (point to `.env.example` + `services/worker/.env.example`)

4. **Tests**
   - `make test`, `make test-unit`, `make test-integration`, `make test-e2e`, `make test-coverage`
   - Mention CI memory settings and that typecheck may currently be non-blocking in CI (but contributors should still fix type issues where possible).

5. **PR workflow**
   - Branch naming: `feature/*`, `fix/*`, `docs/*`
   - PRs target `develop` unless it’s an urgent hotfix (document the exception)
   - Required checks (CI, governance tests, E2E)

6. **Release workflow**
   - How staging deploy happens (push to `develop`)
   - How production deploy happens (tag `vX.Y.Z`, manual approval)
   - Link to workflows in `.github/workflows/`

7. **Governance / PHI Safety (short but explicit)**
   - DEMO vs LIVE governance concepts at a high level
   - Never include PHI in issues/PRs/logs; rely on scrubbers and location-only reporting

### C) Create `docs/README.md` (documentation hub)
Add a docs landing page that links:
- USER_GUIDE
- API_USAGE
- ARCHITECTURE_DEEP_DIVE
- OPS_RUNBOOK
- Reference: OpenAPI contracts under `shared/contracts/`
- Manuscript-engine PRDs under `docs/` (already present)

### D) Create `docs/USER_GUIDE.md` (researcher-facing manual)
Write for researchers using the Web UI.

Required sections:
1. **What ResearchFlow is** (1 paragraph) + key concepts:
   - Projects / research IDs
   - Artifacts
   - Stages (19-stage workflow) with a short explanation
   - Roles (VIEWER/RESEARCHER/STEWARD/ADMIN) and what they mean to users

2. **Modes and safety**
   - DEMO vs LIVE (what is blocked, what is allowed)
   - PHI rules: system reports **locations/metadata** and blocks unsafe actions; never reveals PHI in DEMO.

3. **End-to-end walkthrough (the “happy path”)**
   - Create/define topic (Stage 1)
   - Literature search / IRB proposal / planned extraction (Stages 2–4)
   - Upload data + PHI scan (Stages 5–8): explain the PHI gate and what “location-only” reporting means
   - Summary + analysis + drafting (Stages 9–16): explain AI approval gate, attestation gates, and how the UI prompts users
   - Export + reproducibility bundle: what gets exported, what is scanned, how approvals work

4. **Resolving PHI alerts**
   - What triggers a PHI block
   - What to do: de-identify, re-upload, request steward review, etc.
   - Where to see audit trail and approvals in UI

5. **Artifacts and downloads**
   - How to find artifacts (Artifact Vault)
   - Version history behavior (if visible)
   - Reproducibility bundle export: what’s inside, integrity hashes

6. **Troubleshooting (practical)**
   - “Stage blocked by gate” (AI approval / attestation / PHI gate)
   - “DEMO mode limitations”
   - “Export blocked”
   - “System not ready” (health endpoints)

### E) Create `docs/API_USAGE.md` + Postman collection

1. `docs/API_USAGE.md` should include:
   - Base URL patterns: behind nginx `/api/*` proxies to orchestrator
   - Authentication notes:
     - In dev/testing there are mock/test utilities and/or session-based auth.
     - For production, JWT-based auth is configured via env vars (`JWT_SECRET`, `JWT_EXPIRATION`) and referenced in OpenAPI contracts.
     - Provide examples for:
       a) Session cookie flow (browser-like, “credentials: include”)
       b) Bearer token flow (JWT) as the canonical API-integrator pattern
     - Be explicit about what is “current” vs “planned/contracted” if behavior differs.

   - Example calls (curl):
     - Health: `GET /health`, `GET /health/ready`
     - Workflow stages: `GET /api/workflow/stages`
     - Execute stage: `POST /api/workflow/execute/{stageId}`
     - Artifacts: `GET /api/ros/artifacts/{researchId}`, `POST /api/ros/artifacts`
     - Export reproducibility bundle: `GET /api/ros/export/reproducibility-bundle/{researchId}?format=zip`
     - Bundle request workflow (if exposed via router mount): show `POST /api/export/bundle/request` (adjust path to match actual mounted base), and `POST /api/export/bundle/phi-override/{requestId}` for STEWARD

   - Link to OpenAPI files: `shared/contracts/api.yaml` and `shared/contracts/manuscript-api.yaml`

2. Create `docs/postman/ResearchFlow.postman_collection.json`
   - Use Postman v2.1 format
   - Include environment variables placeholders:
     - `baseUrl` (default `http://localhost:3001`)
     - `jwt` (empty)
     - `researchId` (default `DEMO-001`)
   - Requests mirroring the curl examples above
   - Use Authorization “Bearer Token” with `{{jwt}}` for protected endpoints
   - Include a note request explaining how to obtain tokens in LIVE (or placeholder if not fully implemented)

### F) Create `docs/ARCHITECTURE_DEEP_DIVE.md`
Must include:
1. **Component inventory**
   - Nginx, Web, Orchestrator, Worker, Postgres, Redis, shared /data volume, Collab service
2. **Request flows** (with Mermaid sequence diagrams)
   - “Run a workflow stage” (Web → Orchestrator → Worker or internal executor → Artifacts)
   - “Export reproducibility bundle” (Web → Orchestrator → PHI scan → approval gate → zip archive → download)
   - “PHI scan and gating” (where checks occur, fail-closed behavior)
3. **Data and storage model** (high-level)
   - DB tables exist (jobs, artifacts, audit logs, etc.)—do not over-specify; keep accurate.
4. **Failure modes + recovery**
   - Worker crash during processing
   - Redis outage
   - DB outage / migration issues
   - External API downtime (AI providers, literature)
   - STANDBY / NO_NETWORK behavior (fail-closed, degraded modes)
   - What the system does and what operators should do (link to OPS_RUNBOOK)

### G) Create `docs/OPS_RUNBOOK.md` (deployment & operations)
Include:
1. **Environments**
   - Local dev (docker-compose)
   - Production-like compose (`docker-compose.prod.yml` with nginx)
   - Kubernetes overlays (dev/staging/production)
2. **Health checks and readiness**
   - `/health`, `/health/ready` and nginx `/health`
   - How to verify via curl
3. **Database operations**
   - Migrations: `make db-migrate` (runs init.sql)
   - Seed: `make db-seed`
   - Backup: `make db-backup`
   - Restore procedure (document exact commands using `docker-compose exec postgres ...` and gzip)
   - Backups directory expectations (created by setup.sh)
4. **Secrets management & rotation**
   - `.env` for local (never commit)
   - GitHub Secrets for CI/CD (OPENAI/ANTHROPIC keys, kubeconfigs)
   - K8s secrets strategy (high-level)
   - Rotation checklist (JWT_SECRET, SESSION_SECRET, DB creds, AI keys)
5. **Scaling guidance**
   - Orchestrator horizontal scaling considerations
   - Worker scaling and queue/backpressure considerations
   - Redis sizing and eviction policy (noting prod compose uses maxmemory policy)
6. **Incident response (PHI-focused)**
   - What constitutes an incident
   - Immediate containment steps
   - Audit log review
   - Export blocking behavior
7. **Security scanning and auditor notes**
   - Current: CI includes `npm audit --audit-level=high`
   - Add: `.trivyignore` stub + instructions for how to document each ignore (CVE, component, risk acceptance)
   - Add section “If we add Trivy later, where it plugs in and how to maintain ignore rationale”
   - Do NOT claim Trivy is already running unless you confirm via workflows.

### H) Add `.trivyignore` (stub)
Create `.trivyignore` at repo root with:
- Header comment explaining it is used only if/when Trivy scanning is enabled
- No ignore entries by default
- A template section showing how to add entries with justification pointer to OPS_RUNBOOK (or a future `docs/security/VULNERABILITY_ACCEPTANCE.md`—only create this if needed)

### I) Update `README.md` and `AGENT.md`

1. `README.md`
   - Add a “Documentation” section near the top that links to:
     - `docs/README.md`
     - `docs/USER_GUIDE.md`
     - `docs/API_USAGE.md`
     - `docs/ARCHITECTURE_DEEP_DIVE.md`
     - `docs/OPS_RUNBOOK.md`
   - Update “Contributing” section to point to `CONTRIBUTING.md` and keep the quick bullets.

2. `AGENT.md`
   - Keep existing agent standards.
   - Add at the very top:
     - “Human contributors: see CONTRIBUTING.md”
     - “Docs hub: docs/README.md”
   - Do not remove Ralph/agent references.

## QUALITY CHECKS (acceptance criteria)
- New files exist with clean Markdown formatting:
  - `CONTRIBUTING.md`
  - `docs/README.md`
  - `docs/USER_GUIDE.md`
  - `docs/API_USAGE.md`
  - `docs/postman/ResearchFlow.postman_collection.json`
  - `docs/ARCHITECTURE_DEEP_DIVE.md`
  - `docs/OPS_RUNBOOK.md`
  - `.trivyignore`
- All links in README/docs resolve to real paths.
- No secrets or PHI in docs.
- Mermaid diagrams render (syntax valid).
- Minimal repo disturbance: documentation-only changes (except `.trivyignore` stub and README/AGENT edits).

## DELIVERY
- Create a branch: `docs/onboarding-guides`
- Commit in 1–2 commits total:
  - `docs: add contributor, user, api, architecture, ops guides`
  - (optional) `docs: link docs hub from README and agent guide`
- Open a PR to `develop` with a clear summary and checklist.

Proceed to implement now.
