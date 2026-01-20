# ResearchFlow Production – Governance & Maintainability Refactor Prompt

## Audience
Claude (Senior Refactor & Governance Engineer)

## Repository
`ry86pkqf74-rgb/researchflow-production`

---

## Mission

Refactor and optimize the repository to improve **maintainability, modularity, and governance safety** while preserving existing functionality and passing all tests.

This prompt operationalizes the following goals:

1. Reduce review and rollback risk by enforcing **smaller, auditable changes**.
2. Refactor the Python **19-stage workflow engine** into a modular, plugin-based pipeline.
3. Eliminate **redundant PHI implementations** across Node and Python.
4. Establish a **single source of truth for PHI patterns** to prevent drift.
5. Guarantee **zero raw PHI leakage** across APIs, logs, artifacts, and UI.

---

## Non‑Negotiable Constraints

- ❌ **No raw PHI** may be returned, logged, persisted, or displayed.
- ❌ No network calls in CI or governance scripts.
- ✅ Tests must pass (Node + Python).
- ✅ Changes must be split into **small, reviewable commits** (< ~800 LOC per commit unless explicitly justified).
- ✅ Governance failures must fail closed.

---

## Deliverables Overview

| Priority | Area | Outcome |
|--------|------|---------|
| P0 | PHI Safety | Hash‑only, location‑only PHI reporting |
| P0 | PHI Deduplication | Single PHI engine across Node + Python |
| P1 | Canonical PHI Registry | JSON‑driven, code‑generated patterns |
| P1 | Workflow Modularity | Plugin‑based Python stage runner |
| P1 | PR Hygiene | PR size guard + governance checklist |

---

## A) P0 — PHI SAFETY FIX (CRITICAL)

### Objective
Ensure **no PHI scanner output contains raw matched text**. Only hashes + locations are allowed.

### Required Changes

#### 1. Node Orchestrator PHI Output
**File**
```
services/orchestrator/services/phi-scanner.ts
```

**Change Interface**
- REMOVE: `matchedText: string`
- ADD:
  - `matchHash: string` (SHA256(match).slice(0,12))
  - `matchLength: number`

**Rules**
- Never log `matchText`
- Hash immediately, then discard

#### 2. Web UI PHI Display
**File**
```
services/web/src/components/ui/phi-gate.tsx
```

**Behavior**
- Display findings as:
  ```
  [HASH:abcd1234] (pos 120–131)
  ```
- Never render raw content

#### 3. Tests
- Add unit test asserting:
  - No response JSON includes `matchedText`
  - No raw detected value appears anywhere

**Commit**
```
fix(phi): make PHI scan outputs hash-only and PHI-safe
```

---

## B) P0 — PHI DEDUPLICATION

### Objective
Remove duplicated regex logic. Use `@researchflow/phi-engine` everywhere.

### Required Changes

#### Replace Local Regex Libraries
Refactor the following to call `@researchflow/phi-engine`:

- `services/orchestrator/services/phi-scanner.ts`
- `services/orchestrator/src/services/phi-protection.ts`
- `services/orchestrator/utils/run-manifest.ts`

**Rules**
- Convert findings → hash + location + category
- Discard `.value` immediately
- Use conservative HIGH_CONFIDENCE patterns for gates

**Commit**
```
refactor(phi): deduplicate orchestrator PHI scanners to phi-engine
```

---

## C) P1 — CANONICAL PHI REGISTRY + CODEGEN

### Objective
Prevent PHI drift by defining patterns **once** and generating TS + Python code.

### Canonical Spec
Create:
```
shared/phi/phi_patterns.v1.json
```

**Schema**
```json
{
  "version": "1.0.0",
  "patterns": [
    {
      "id": "SSN_STRICT",
      "category": "SSN",
      "tier": ["HIGH_CONFIDENCE","OUTPUT_GUARD"],
      "regex": { "source": "\\b\\d{3}-\\d{2}-\\d{4}\\b", "flags": "g" },
      "hipaaCategory": "164.514(b)(2)(i)(A)",
      "baseConfidence": 0.8
    }
  ]
}
```

### Generator Script
Create:
```
scripts/governance/generate_phi_patterns.py
```

**Outputs**
- TS: `packages/phi-engine/src/patterns.generated.ts`
- Python: `services/worker/src/validation/phi_patterns_generated.py`

### CI Guard
- Fail CI if generated output differs from committed files.

**Commit**
```
chore(phi): add canonical PHI registry + code generation
```

---

## D) P1 — PYTHON WORKFLOW MODULARITY

### Objective
Replace monolithic stage loop with a **plugin‑based workflow engine**.

### New Structure
```
services/worker/src/workflow/
  base.py
  context.py
  registry.py
  runner.py
  stages/
    stage_01_upload.py
    stage_04_phi_scan.py
    stage_05_validate.py
```

### Requirements
- Each stage implements a `Stage` interface
- Stages registered via decorator
- Runner executes ordered subset
- Metadata‑only results (no raw data)

### Integration
Refactor:
```
services/worker/src/main.py
```

Replace numeric loop with:
```python
runner = WorkflowRunner(StageRegistry.default())
runner.run(stages=configured_ids, ctx=context)
```

**Commit**
```
refactor(worker): introduce modular workflow stage runner
```

---

## E) P1 — PR HYGIENE & GOVERNANCE

### PR Size Guard
Add:
```
.github/workflows/pr-size-guard.yml
```

**Rules**
- Fail PRs > 2500 LOC unless labeled `large-pr-approved`
- Post instructional comment automatically

### PR Template
Add:
```
.github/pull_request_template.md
```

Include:
- Summary
- Tests run
- PHI safety checklist
- PR size acknowledgment

**Commit**
```
chore(governance): enforce PR size guardrails
```

---

## Acceptance Criteria

- ✅ No raw PHI anywhere (API, UI, logs, artifacts)
- ✅ Single PHI scanner across Node + Python
- ✅ Canonical PHI registry with codegen + CI guard
- ✅ Modular Python workflow engine scaffold
- ✅ PRs blocked if excessively large

---

## Test Commands

```bash
npm test
pytest
```

---

## Final Output Required from Claude

1. List of files added/modified
2. Explanation of PHI safety guarantees
3. Test results summary
4. Suggested follow‑up PRs (if any stubs remain)

