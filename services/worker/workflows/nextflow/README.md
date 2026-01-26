# Nextflow Workflow Orchestration

**Status:** Scaffolding phase - stub processes for demonstration
**Last Updated:** 2026-01-14

## Overview

This Nextflow workflow provides **optional orchestration scaffolding** for existing validated entry points in the Research Operating System. It is designed as an **additive wrapper** that does not replace or modify existing orchestrators.

---

## Quick Start

### Execute Workflow

```bash
# From repo root
make workflow-nextflow

# Or from workflows/nextflow directory
nextflow run main.nf -c nextflow.config
```

---

## Workflow Processes

### Current Processes (Stub Phase)

1. **INGEST_LITERATURE**
   - **Purpose**: Ingest literature documents
   - **Entry Point**: `src/literature/runtime.py::ingest_literature_runtime()`
   - **Input**: Sample document path
   - **Output**: `literature_manifest.json`
   - **Status**: STUB (creates placeholder output)

2. **NORMALIZE**
   - **Purpose**: Normalize documents
   - **Entry Point**: `src/literature/normalize.py::normalize_document()`
   - **Input**: Literature manifest
   - **Output**: `normalized_manifest.json`
   - **Status**: STUB (creates placeholder output)

3. **VALIDATE**
   - **Purpose**: Schema validation
   - **Entry Point**: `src/validation/schema_validator.py`
   - **Input**: Normalized manifest
   - **Output**: `validation_report.json`
   - **Status**: STUB (creates placeholder output)

4. **VERIFY**
   - **Purpose**: Layered verification
   - **Entry Point**: `src/verification/layered_verifier.py::run_verification_pipeline()`
   - **Input**: Validation report
   - **Output**: `verification_report.json`
   - **Status**: STUB (creates placeholder output)

### Pipeline Flow

```
sample.txt → INGEST_LITERATURE → manifest
                ↓
            NORMALIZE → normalized
                ↓
            VALIDATE → validated
                ↓
            VERIFY → verified
```

---

## Configuration

### Parameters ([nextflow.config](nextflow.config))

```groovy
params {
    ros_mode = 'STANDBY'
    no_network = true
    mock_only = true
    input_dir = '.tmp/literature_runtime/inputs'
    output_dir = '.tmp/workflow_output'
}
```

### Environment Variables

```groovy
env {
    ROS_MODE = params.ros_mode
    NO_NETWORK = '1'
    MOCK_ONLY = '1'
}
```

---

## Nextflow Features

### Execution Reports

Nextflow automatically generates execution reports:

- **HTML Report**: `.tmp/workflow_output/nextflow_report.html`
- **Timeline**: `.tmp/workflow_output/nextflow_timeline.html`
- **Trace**: `.tmp/workflow_output/nextflow_trace.txt`

### Profiles

```bash
# STANDBY profile (default)
nextflow run main.nf -profile standby

# SANDBOX profile (offline, synthetic data)
nextflow run main.nf -profile sandbox
```

Note: ACTIVE profile is intentionally omitted (requires governance approval).

### Resume Execution

```bash
# Resume from last checkpoint
nextflow run main.nf -resume
```

---

## Governance Enforcement

### STANDBY Mode

The workflow enforces STANDBY mode via:

1. **Environment variables** in `nextflow.config`:
   ```groovy
   env {
       ROS_MODE = 'STANDBY'
       NO_NETWORK = '1'
       MOCK_ONLY = '1'
   }
   ```

2. **Error strategy**: Fail-closed (terminate on first error)
   ```groovy
   process {
       errorStrategy = 'terminate'
   }
   ```

3. **Working directory**: Quarantined under `.tmp/`
   ```groovy
   process {
       workDir = '.tmp/nextflow_work'
   }
   ```

### Artifact Quarantine

All inputs/outputs are under `.tmp/` quarantine:

```groovy
params {
    input_dir = '.tmp/literature_runtime/inputs'
    output_dir = '.tmp/workflow_output'
    literature_artifacts = '.tmp/literature_runtime/artifacts'
}
```

---

## Troubleshooting

### Error: "Nextflow not installed"

Nextflow is an **optional dependency**. Install with:

```bash
# Download and install
curl -s https://get.nextflow.io | bash

# Move to PATH
sudo mv nextflow /usr/local/bin/

# Or use directly
./nextflow run main.nf
```

### Error: "Java not found"

Nextflow requires Java 11+:

```bash
# Check Java version
java -version

# Install Java (macOS)
brew install openjdk@11

# Install Java (Ubuntu)
sudo apt-get install openjdk-11-jdk
```

### Error: "Input file not found"

The workflow expects input files under `.tmp/literature_runtime/inputs/`. Create sample input:

```bash
mkdir -p .tmp/literature_runtime/inputs
echo "Sample literature content" > .tmp/literature_runtime/inputs/sample.txt
```

### Error: "Permission denied"

Ensure `.tmp/` directory is writable:

```bash
mkdir -p .tmp/nextflow_work
chmod 755 .tmp
```

---

## Design Principles

1. **Stub Processes**: Current processes are stubs for demonstration
2. **No Network**: Workflow runs offline (NO_NETWORK=1)
3. **Mock LLM**: All AI providers mocked (MOCK_ONLY=1)
4. **Deterministic**: Sequential execution (queueSize=1)
5. **Fail-Closed**: Terminate on first error
6. **Additive**: No changes to existing runtimes

---

## Future Work

- Replace stub processes with actual runtime invocations
- Add parameter passing to Python modules
- Implement error handling and retries
- Add container support (INF-2 / Task B)
- Enable ACTIVE mode support (with governance approval)
- Add cloud executor profiles (INF-J / Task J - optional)

---

## References

- **Nextflow Documentation**: https://www.nextflow.io/docs/latest/
- **ROS Orchestration Overview**: [../README.md](../README.md)
- **Integration Guide**: [../../docs/plans/INTEGRATION_SUPPLEMENT_EXECUTION_GUIDE_2026.md](../../docs/plans/INTEGRATION_SUPPLEMENT_EXECUTION_GUIDE_2026.md)
