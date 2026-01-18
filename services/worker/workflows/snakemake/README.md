# Snakemake Workflow Orchestration

**Status:** Scaffolding phase - stub rules for demonstration
**Last Updated:** 2026-01-14

## Overview

This Snakemake workflow provides **optional orchestration scaffolding** for existing validated entry points in the Research Operating System. It is designed as an **additive wrapper** that does not replace or modify existing orchestrators.

---

## Quick Start

### Dry-Run (Recommended First)

```bash
# From repo root
make workflow-dryrun

# Or from workflows/snakemake directory
snakemake -n --configfile config/config.yaml
```

### Execute Workflow

```bash
# From repo root
make workflow-snakemake

# Or from workflows/snakemake directory
snakemake --cores 1 --configfile config/config.yaml
```

---

## Workflow Rules

### Current Rules (Stub Phase)

1. **ingest_literature**
   - **Purpose**: Ingest literature documents
   - **Entry Point**: `src/literature/runtime.py::ingest_literature_runtime()`
   - **Input**: `.tmp/literature_runtime/inputs/sample.txt`
   - **Output**: `.tmp/literature_runtime/artifacts/literature_manifest.json`
   - **Status**: STUB (creates placeholder output)

### Future Rules (To Be Implemented)

2. **normalize**
   - **Purpose**: Normalize documents
   - **Entry Point**: `src/literature/normalize.py::normalize_document()`
   - **Input**: Literature manifest
   - **Output**: Normalized manifest

3. **validate**
   - **Purpose**: Schema validation
   - **Entry Point**: `src/validation/schema_validator.py`
   - **Input**: Normalized manifest
   - **Output**: Validation report

4. **verify**
   - **Purpose**: Layered verification
   - **Entry Point**: `src/verification/layered_verifier.py::run_verification_pipeline()`
   - **Input**: Validation report
   - **Output**: Verification report

5. **export**
   - **Purpose**: Create export bundle
   - **Entry Point**: `src/export_runtime_active/runtime.py::build_export_bundle()`
   - **Input**: Verification report
   - **Output**: Export bundle ZIP

---

## Configuration

### Default Config ([config/config.yaml](config/config.yaml))

```yaml
# Runtime control
ros_mode: STANDBY
no_network: true
mock_only: true

# Paths (all under .tmp/)
literature_input: ".tmp/literature_runtime/inputs/"
literature_artifacts: ".tmp/literature_runtime/artifacts/"
```

### Example Config ([config/example.yaml](config/example.yaml))

See [config/example.yaml](config/example.yaml) for detailed configuration options with comments.

---

## Snakemake Features

### Dry-Run Mode

```bash
snakemake -n --configfile config/config.yaml
```

Simulates workflow execution without running commands. Useful for:
- Verifying DAG structure
- Checking rule dependencies
- Debugging workflow logic

### DAG Visualization (Requires Graphviz)

```bash
snakemake --dag --configfile config/config.yaml | dot -Tpng > workflow_dag.png
```

### Rule Graph

```bash
snakemake --rulegraph --configfile config/config.yaml | dot -Tpng > rule_graph.png
```

---

## Governance Enforcement

### STANDBY Mode

The Snakefile enforces STANDBY mode via environment variables:

```python
os.environ["ROS_MODE"] = config.get("ros_mode", "STANDBY")
os.environ["NO_NETWORK"] = "1" if config.get("no_network", True) else "0"
os.environ["MOCK_ONLY"] = "1" if config.get("mock_only", True) else "0"
```

### Artifact Quarantine

All inputs/outputs are under `.tmp/` quarantine:

```yaml
literature_input: ".tmp/literature_runtime/inputs/"
literature_artifacts: ".tmp/literature_runtime/artifacts/"
sourcelit_manifests: ".tmp/sourcelit_runtime/manifests/"
export_output: ".tmp/export_runs/"
```

---

## Troubleshooting

### Error: "Snakemake not installed"

Snakemake is an **optional dependency**. Install with:

```bash
pip install snakemake
```

Or use containerized execution (future work).

### Error: "No rule to make target"

The workflow expects input files under `.tmp/literature_runtime/inputs/`. Create sample input:

```bash
mkdir -p .tmp/literature_runtime/inputs
echo "Sample literature content" > .tmp/literature_runtime/inputs/sample.txt
```

### Error: "Directory not writable"

Ensure `.tmp/` directory is writable:

```bash
mkdir -p .tmp/literature_runtime/artifacts
chmod 755 .tmp
```

---

## Design Principles

1. **Stub Rules**: Current rules are stubs for demonstration
2. **No Network**: Workflow runs offline (NO_NETWORK=1)
3. **Mock LLM**: All AI providers mocked (MOCK_ONLY=1)
4. **Deterministic**: Sequential execution, stable ordering
5. **Additive**: No changes to existing runtimes

---

## Future Work

- Replace stub rules with actual runtime invocations
- Add parameter passing to Python modules
- Implement error handling and retries
- Add logging and provenance tracking
- Enable ACTIVE mode support (with governance approval)

---

## References

- **Snakemake Documentation**: https://snakemake.readthedocs.io/
- **ROS Orchestration Overview**: [../README.md](../README.md)
- **Integration Guide**: [../../docs/plans/INTEGRATION_SUPPLEMENT_EXECUTION_GUIDE_2026.md](../../docs/plans/INTEGRATION_SUPPLEMENT_EXECUTION_GUIDE_2026.md)
