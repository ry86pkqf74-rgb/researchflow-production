# Orchestration Landscape (INF-1 / Task A)

**Status:** Scaffolding phase - INF-1 complete
**Last Updated:** 2026-01-14

---

## What This Workflow Orchestrates

The Snakemake/Nextflow scaffolding orchestrates the following **existing validated entry points**:

1. **Literature Ingestion**: [src/literature/runtime.py](../src/literature/runtime.py) - `ingest_literature_runtime()`
2. **Document Normalization**: [src/literature/normalize.py](../src/literature/normalize.py) - `normalize_document()`
3. **Schema Validation**: [src/validation/schema_validator.py](../src/validation/schema_validator.py)
4. **Layered Verification**: [src/verification/layered_verifier.py](../src/verification/layered_verifier.py) - `run_verification_pipeline()`
5. **Export Bundle Creation**: [src/export_runtime_active/runtime.py](../src/export_runtime_active/runtime.py) - `build_export_bundle()`

---

## What This Does NOT Replace

This workflow orchestration **explicitly does NOT replace or modify**:

### 1. Sourcelit Synthesis Orchestrator
- **Location**: [src/ros_sourcelit_active/orchestrator.py](../src/ros_sourcelit_active/orchestrator.py)
- **Status**: **Remains authoritative** for literature synthesis workflows
- **Governance**: Enforces SANDBOX mode + NO_NETWORK=1
- **Entry Point**: `orchestrate_sourcelit_synthesis()`

### 2. Investor Demo Day Orchestrator
- **Location**: [scripts/run_investor_demo_day.sh](../scripts/run_investor_demo_day.sh)
- **Status**: **Remains authoritative** for demo execution
- **Pattern**: Shell-based orchestrator with strict mode (`set -euo pipefail`)
- **Workflow**: Pre-demo preflight → Docker investor demo → Refresh handoff pack

### 3. Runtime Implementations
- **All runtime modules** under `src/*_runtime*/runtime.py` remain unchanged
- **No changes** to runtime semantics or governance gates
- **All governance controls** (RuntimeConfig, Preflight, capabilities) preserved

### 4. Web Frontend Workflow Launcher
- **Location**: [web_frontend/components/workflow_launcher.py](../web_frontend/components/workflow_launcher.py)
- **Status**: UI workflows continue to work as designed
- **No changes** to UI-driven workflow state management

---

## STANDBY/NO_NETWORK Enforcement

### Fail-Closed by Default

All workflow configurations enforce **STANDBY mode** by default:

- ✅ `NO_NETWORK=1` environment variable enforced (no external network calls)
- ✅ `MOCK_ONLY=1` ensures AI providers are mocked (no LLM API calls)
- ✅ `ROS_MODE=STANDBY` enforces offline-only operation
- ✅ All artifacts written to `.tmp/` quarantine directories
- ✅ No external network calls permitted in CI/tests

### Runtime Validation

Governance gates are **preserved at all entry points**:

- **Preflight checks** run before workflow execution ([src/preflight.py](../src/preflight.py))
- **RuntimeConfig** enforces mode restrictions ([src/runtime_config.py](../src/runtime_config.py))
- **Governance capabilities** validate operations ([src/governance/capabilities.py](../src/governance/capabilities.py))

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                    Optional Workflow Orchestration                   │
│                         (INF-1 Scaffolding)                          │
│                                                                       │
│  ┌──────────────────────┐        ┌──────────────────────┐          │
│  │   Snakemake (Stub)   │        │   Nextflow (Stub)    │          │
│  │  workflows/snakemake │        │  workflows/nextflow  │          │
│  └──────────┬───────────┘        └──────────┬───────────┘          │
│             │                               │                        │
└─────────────┼───────────────────────────────┼────────────────────────┘
              │                               │
              └───────────┬───────────────────┘
                          │
                          ▼
         ┌────────────────────────────────────────────┐
         │      Existing Validated Entry Points       │
         │       (No Changes - Preserve Gates)        │
         │                                            │
         │  ├─ src/literature/runtime.py             │
         │  ├─ src/literature/normalize.py           │
         │  ├─ src/validation/schema_validator.py    │
         │  ├─ src/verification/layered_verifier.py  │
         │  └─ src/export_runtime_active/runtime.py  │
         └────────────────────────────────────────────┘

         ┌────────────────────────────────────────────┐
         │   Existing Orchestrators (Unchanged)       │
         │                                            │
         │  ├─ src/ros_sourcelit_active/orchestrator.py  │
         │  └─ scripts/run_investor_demo_day.sh          │
         └────────────────────────────────────────────┘
```

---

## Current Status (INF-1 Complete)

### ✅ Implemented
- [x] Workflow directory structure (`workflows/`)
- [x] Snakemake Snakefile with stub rules
- [x] Snakemake config (STANDBY defaults)
- [x] Nextflow main.nf with stub processes
- [x] Nextflow config (STANDBY defaults)
- [x] Documentation (READMEs)
- [x] Makefile targets (workflow-help, workflow-dryrun, etc.)
- [x] Policy tests (27 tests, all passing)
- [x] pytest -q passes (2696 passed, 12 skipped)
- [x] make validate-file-placement passes (0 violations)

### 🚧 Future Work (Post-INF-1)
- [ ] Replace stub rules with actual runtime invocations (production-ready workflows)
- [ ] Add parameter passing to Python modules
- [ ] Implement error handling and retries
- [ ] Add logging and provenance tracking
- [ ] Enable ACTIVE mode support (with governance approval)
- [ ] Container integration (INF-2 / Task B)
- [ ] Cloud executor profiles (INF-J / Task J - optional)

---

## Verification Checklist

### Pre-Implementation ✅
- [x] Read Integration Supplement Execution Guide
- [x] Explore existing orchestrators (src/ros_sourcelit_active/orchestrator.py, scripts/run_investor_demo_day.sh)
- [x] Identify validated entry points (literature/runtime.py, validation/*, verification/*, export_runtime_active/*)
- [x] Understand governance controls (RuntimeConfig, Preflight, capabilities.py)

### Post-Implementation ✅
- [x] **pytest -q passes**: Full test suite green (2696 passed, 12 skipped)
- [x] **make validate-file-placement passes**: 0 violations detected
- [x] **make workflow-dryrun**: Gracefully skips if Snakemake not installed
- [x] **Manual inspection**: No forbidden network patterns in workflow files
- [x] **Documentation review**: README documents STANDBY enforcement

---

## References

- **Integration Guide**: [docs/plans/INTEGRATION_SUPPLEMENT_EXECUTION_GUIDE_2026.md](../docs/plans/INTEGRATION_SUPPLEMENT_EXECUTION_GUIDE_2026.md)
- **RuntimeConfig**: [src/runtime_config.py](../src/runtime_config.py)
- **Governance Capabilities**: [src/governance/capabilities.py](../src/governance/capabilities.py)
- **Existing Orchestrators**:
  - Sourcelit: [src/ros_sourcelit_active/orchestrator.py](../src/ros_sourcelit_active/orchestrator.py)
  - Investor Demo: [scripts/run_investor_demo_day.sh](../scripts/run_investor_demo_day.sh)
- **Workflow Documentation**: [workflows/README.md](README.md)
- **Tests**: [tests/test_workflow_scaffolding.py](../tests/test_workflow_scaffolding.py)
