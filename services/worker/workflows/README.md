# Workflow Orchestration (INF-1 / Task A)

**Status:** Scaffolding phase - optional wrapper for existing validated entry points
**Last Updated:** 2026-01-14

## Overview

This directory contains **optional workflow orchestration scaffolding** (Snakemake and Nextflow) that wraps existing validated runtime entry points in the Research Operating System.

### What This Orchestrates

The workflow scaffolding orchestrates the following **existing validated entry points**:

1. **Literature Ingestion**: [src/literature/runtime.py](../src/literature/runtime.py) - `ingest_literature_runtime()`
2. **Document Normalization**: [src/literature/normalize.py](../src/literature/normalize.py) - `normalize_document()`
3. **Schema Validation**: [src/validation/schema_validator.py](../src/validation/schema_validator.py)
4. **Layered Verification**: [src/verification/layered_verifier.py](../src/verification/layered_verifier.py) - `run_verification_pipeline()`
5. **Export Bundle Creation**: [src/export_runtime_active/runtime.py](../src/export_runtime_active/runtime.py) - `build_export_bundle()`

### What This Does NOT Replace

This workflow orchestration **explicitly does NOT replace or modify**:

1. **Sourcelit Synthesis Orchestrator** ([src/ros_sourcelit_active/orchestrator.py](../src/ros_sourcelit_active/orchestrator.py))
   - Remains authoritative for literature synthesis workflows
2. **Investor Demo Day Orchestrator** ([scripts/run_investor_demo_day.sh](../scripts/run_investor_demo_day.sh))
   - Remains authoritative for demo execution
3. **Runtime implementations** (src/*_runtime*/runtime.py)
   - No changes to runtime semantics or governance gates
4. **Web frontend workflow launcher** ([web_frontend/components/workflow_launcher.py](../web_frontend/components/workflow_launcher.py))
   - UI workflows continue to work as designed

---

## STANDBY/NO_NETWORK Enforcement

### Fail-Closed by Default

All workflow configurations enforce **STANDBY mode** by default:

- `NO_NETWORK=1` environment variable enforced (no external network calls)
- `MOCK_ONLY=1` ensures AI providers are mocked (no LLM API calls)
- `ROS_MODE=STANDBY` enforces offline-only operation
- All artifacts written to `.tmp/` quarantine directories
- No external network calls permitted in CI/tests

### Runtime Validation

Governance gates are **preserved at all entry points**:

- **Preflight checks** run before workflow execution
- **RuntimeConfig** enforces mode restrictions (see [src/runtime_config.py](../src/runtime_config.py))
- **Governance capabilities** validate operations (see [src/governance/capabilities.py](../src/governance/capabilities.py))

---

## Directory Structure

```
workflows/
├── README.md                          # This file
├── snakemake/
│   ├── Snakefile                      # Snakemake workflow definition
│   ├── config/
│   │   ├── config.yaml                # Default config (STANDBY defaults)
│   │   └── example.yaml               # Example with detailed comments
│   └── README.md                      # Snakemake-specific documentation
└── nextflow/
    ├── main.nf                        # Nextflow workflow definition
    ├── nextflow.config                # Nextflow configuration (STANDBY defaults)
    └── README.md                      # Nextflow-specific documentation
```

---

## Installation

### Option 1: Direct Installation (Optional)

Snakemake and Nextflow are **optional dependencies**. Install if you want to use workflow orchestration:

```bash
# Snakemake
pip install snakemake

# Nextflow (requires Java 11+)
curl -s https://get.nextflow.io | bash
```

### Option 2: Containerized Execution (Recommended)

Use the containerized environment (Task B / INF-2 - future work):

```bash
# Future: docker-compose up workflow-orchestrator
```

### Option 3: Skip Workflow Orchestration

You can continue using existing entry points directly without workflow orchestration:

```bash
# Direct Python invocation (no workflow orchestrator needed)
python -m src.pipeline.runner --dataset sample --out .tmp/pipeline_sample
```

---

## Quick Start

### Snakemake Dry-Run

```bash
# Simulate workflow (no execution)
make workflow-dryrun

# Or manually:
cd workflows/snakemake
snakemake -n --configfile config/config.yaml
```

### Snakemake Execution

```bash
# Execute workflow (STANDBY mode, offline)
make workflow-snakemake

# Or manually:
cd workflows/snakemake
snakemake --cores 1 --configfile config/config.yaml
```

### Nextflow Execution

```bash
# Execute workflow (STANDBY mode, offline)
make workflow-nextflow

# Or manually:
cd workflows/nextflow
nextflow run main.nf -c nextflow.config
```

---

## Configuration

### Snakemake Configuration

Edit [snakemake/config/config.yaml](snakemake/config/config.yaml):

```yaml
# Runtime control
ros_mode: STANDBY      # STANDBY | SANDBOX | ACTIVE
no_network: true       # Enforce offline mode
mock_only: true        # Mock LLM providers

# Input/output paths (all under .tmp/)
literature_input: ".tmp/literature_runtime/inputs/"
literature_artifacts: ".tmp/literature_runtime/artifacts/"
```

See [snakemake/config/example.yaml](snakemake/config/example.yaml) for detailed configuration options.

### Nextflow Configuration

Edit [nextflow/nextflow.config](nextflow/nextflow.config):

```groovy
params {
    ros_mode = 'STANDBY'
    no_network = true
    mock_only = true
    input_dir = '.tmp/literature_runtime/inputs'
    output_dir = '.tmp/workflow_output'
}
```

---

## Makefile Targets

```bash
make workflow-help        # Show workflow orchestration help
make workflow-dryrun      # Simulate Snakemake workflow (no execution)
make workflow-snakemake   # Run Snakemake workflow (STANDBY mode)
make workflow-nextflow    # Run Nextflow workflow (STANDBY mode)
```

---

## ACTIVE Mode Execution (Future)

**IMPORTANT:** ACTIVE mode is NOT enabled in this scaffolding phase.

For ACTIVE mode execution (future work):

1. Review [docs/plans/INTEGRATION_SUPPLEMENT_EXECUTION_GUIDE_2026.md](../docs/plans/INTEGRATION_SUPPLEMENT_EXECUTION_GUIDE_2026.md)
2. Run preflight checks: `python scripts/preflight_online.py`
3. Update workflow config:
   - `ros_mode: ACTIVE`
   - `no_network: false`
   - `mock_only: false`
4. Ensure LLM provider credentials are configured
5. Verify IRB approval for any real data processing

---

## Testing

### Integration Tests

Workflow integration tests verify offline execution, determinism, and STANDBY enforcement (INF-12):

```bash
# Run all workflow integration tests
pytest tests/test_workflow_integration.py -v

# Run specific test class
pytest tests/test_workflow_integration.py::TestWorkflowDeterminism -v

# Quick mode
pytest tests/test_workflow_integration.py -q
```

**Test Coverage**: 40+ tests covering:
- Fixture validation (5 tests)
- Determinism harness (6 tests)
- STANDBY enforcement at 4 layers (7 tests)
- Offline mode safety (6 tests)
- Snakemake integration (8 tests)
- Nextflow integration (8 tests)

See [docs/testing/WORKFLOW_INTEGRATION_TESTING.md](../docs/testing/WORKFLOW_INTEGRATION_TESTING.md) for detailed testing guide.

### Policy Tests

Policy tests verify workflow structure and governance compliance:

```bash
# Run scaffolding policy tests
pytest tests/test_workflow_scaffolding.py -v
```

**Test Coverage**: 27 tests covering:
- Directory structure validation
- Config schema validation
- STANDBY default enforcement
- Output path quarantine (.tmp/)
- Network call pattern scanning
- Governance compliance

---

## Troubleshooting

### "Snakemake not installed"

Snakemake is an **optional dependency**. Either:
- Install: `pip install snakemake`
- Use containerized execution (future)
- Continue using direct Python invocation

### "Nextflow not installed"

Nextflow is an **optional dependency**. Either:
- Install: `curl -s https://get.nextflow.io | bash`
- Use containerized execution (future)
- Continue using direct Python invocation

### "Workflow fails in CI"

This is expected. Workflow orchestration is **optional** and not required in CI. Tests only validate:
- Workflow files exist and are parseable
- No forbidden network patterns
- Config enforces STANDBY defaults

---

## Design Principles

1. **Additive Only**: No modifications to existing orchestrators or runtimes
2. **Optional Wrapper**: Not a mandatory dependency - direct Python invocation still works
3. **Fail-Closed**: STANDBY mode by default, all governance gates preserved
4. **Deterministic**: Sequential execution, stable artifact ordering
5. **Quarantined**: All artifacts under `.tmp/` (never committed)
6. **Metadata-Only**: No PHI, no secrets, no content emission in CI/tests

---

## References

- **Integration Roadmap**: [docs/plans/INTEGRATION_SUPPLEMENT_EXECUTION_GUIDE_2026.md](../docs/plans/INTEGRATION_SUPPLEMENT_EXECUTION_GUIDE_2026.md)
- **RuntimeConfig**: [src/runtime_config.py](../src/runtime_config.py)
- **Governance Capabilities**: [src/governance/capabilities.py](../src/governance/capabilities.py)
- **Existing Orchestrators**:
  - Sourcelit: [src/ros_sourcelit_active/orchestrator.py](../src/ros_sourcelit_active/orchestrator.py)
  - Investor Demo: [scripts/run_investor_demo_day.sh](../scripts/run_investor_demo_day.sh)

---

## Future Work

- **INF-2 (Task B)**: Containerized single-command execution
- **INF-3 (Task C)**: Test expansion and quality gates
- **Production workflows**: Replace stub rules with actual runtime invocations
- **DAG visualization**: Generate workflow diagrams
- **ACTIVE mode support**: Enable online workflows with governance approval
