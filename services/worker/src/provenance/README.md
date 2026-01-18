# Provenance Logger

Minimal metadata-only provenance logging for ROS core pipeline operations.

## Purpose

Records **what happened** during pipeline runs without touching data or analysis logic.
- NO PHI
- NO row-level data  
- NO external provider calls
- Offline-first design

## Location

Logs written to: `.tmp/provenance/run_provenance.jsonl`

## Log Format

JSONL (one JSON entry per line) with these fields:

```json
{
  "entry_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "timestamp": "2026-01-07T02:55:00Z",
  "git_commit_sha": "cdd04a4314fbda6f5ce2b0ab1933a1028af7478c",
  "operation": "export",
  "inputs": ["data/processed/cohort.parquet", "config/phase1.yaml"],
  "outputs": ["results/export_bundle_20260107.json"],
  "notes": "Phase 1 cohort export"
}
```

## Usage

### Option 1: Convenience Function

```python
from src.provenance import log_operation

# Log a pipeline operation
log_operation(
    operation="export",
    inputs=["data/processed/cohort.parquet", "config/phase1.yaml"],
    outputs=["results/export_bundle.json"],
    notes="Phase 1 cohort export"
)
```

### Option 2: Logger Instance

```python
from src.provenance import ProvenanceLogger

# Create logger (uses default path: .tmp/provenance/run_provenance.jsonl)
logger = ProvenanceLogger()

# Log operations
logger.log_operation(
    operation="qa",
    inputs=["results/export_bundle.json"],
    outputs=["reports/qa_metrics.json"],
    notes="Quality assurance checks"
)

# Read log
entries = logger.read_log()
print(f"Total entries: {len(entries)}")

# Get summary
summary = logger.get_summary()
print(f"Operations: {summary['operations']}")
```

### Custom Log Path

```python
from pathlib import Path
from src.provenance import ProvenanceLogger

# Use custom log path
logger = ProvenanceLogger(log_path=Path("reports/my_run.jsonl"))
logger.log_operation(
    operation="manuscript",
    inputs=["results/bundle.json"],
    outputs=["manuscripts/draft_v1.md"]
)
```

## Operation Types

Common operation strings (not enforced, use as needed):

Operation names are intentionally freeform and not validated to allow
experiment- or project-specific labels; keep them consistent within a workflow.

## Integration Examples

- **Timestamps**: UTC ISO 8601 with `Z` suffix for consistency
def export_cohort(config_path: str, output_path: str):
See: `docs/governance/PHI_BOUNDARIES.md`
    
    # Log the operation
    log_operation(
        operation="export",
        inputs=[config_path],
        outputs=[output_path],
        notes=f"Cohort export using {config_path}"
    )
```

### In QA Pipeline

```python
from src.provenance import ProvenanceLogger

def run_qa_checks(bundle_path: str):
    logger = ProvenanceLogger()
    
    # ... run QA checks ...
    
    logger.log_operation(
        operation="qa",
        inputs=[bundle_path],
        outputs=["reports/qa/metrics.json", "reports/qa/summary.txt"],
        notes="Automated QA validation suite"
    )
```

## Pipeline Run Provenance Manifests

Pipeline runs (e.g., `src/pipeline/runner.py`) also write metadata-only provenance manifests to their output directories:

**File format**: `.tmp/<output_dir>/provenance_<run_id>.json`

**Structure**:
```json
{
  "run_id": "20260107_154200",
  "dataset": "sample",
  "overall_status": "PASSED",
  "total_duration_ms": 1234.5,
  "row_count": 303,
  "column_count": 14,
  "schema_name": "HeartDiseaseSchema",
  "git_commit_sha": "abc123...",
  "input_artifact_hashes": [
    {
      "path": ".tmp/sample_data/heart_disease_sample.csv",
      "sha256": "a1b2c3d4e5f6...",
      "bytes": 12345
    }
  ],
  "artifact_hashes": {
    "parquet_sha256": "def456...",
    "summary_sha256": "789ghi..."
  },
  "created_at": "2026-01-07T20:42:00Z"
}
```

**Key differences from operation logs**:
- Single JSON file per run (not JSONL)
- Contains row/column counts (but NO column names or data)
- Includes artifact hashes (SHA256) for verification
- Written to pipeline output directory (not centralized log)

**PHI Safety**:
- NO column names in JSON
- NO row-level data
- NO identifiers
- Only aggregate counts and checksums

### Input Artifact Fingerprinting

Pipeline manifests include `input_artifact_hashes` to track the fingerprint of input datasets used during a run. This enables:

**Drift Detection**: Compare input hashes across runs to detect when source data has changed, which may indicate:
- Data refreshes or updates
- Schema migrations
- Unexpected data modifications
- Pipeline reproducibility issues

**Reproducibility**: By capturing the exact input artifact state (SHA256 + file size), you can verify that a pipeline run used the expected input data. This is critical for:
- Validating research results
- Debugging pipeline failures
- Auditing data lineage
- Ensuring consistent reprocessing

**Example usage**:
```python
# Load two provenance manifests from different runs
with open('.tmp/run1/provenance_20260107_154200.json') as f:
    run1 = json.load(f)

with open('.tmp/run2/provenance_20260107_160000.json') as f:
    run2 = json.load(f)

# Compare input artifacts
run1_hash = run1['input_artifact_hashes'][0]['sha256']
run2_hash = run2['input_artifact_hashes'][0]['sha256']

if run1_hash != run2_hash:
    print("WARNING: Input data changed between runs!")
    print(f"  Run 1: {run1_hash}")
    print(f"  Run 2: {run2_hash}")
else:
    print(" Input data consistent across runs")
```

**PHI Safety**: Input artifact fingerprints contain ONLY:
- File path (relative)
- SHA256 hash of file contents
- File size in bytes

NO column names, row data, or identifiers are included.

## Governance

- **Artifacts location**: `.tmp/provenance/` (temporary run artifacts) for operation logs; `.tmp/<output_dir>/` for pipeline manifests
- **No PHI**: Only file paths and metadata logged
- **Offline-first**: No external API calls
- **Append-only**: JSONL format for safe concurrent writes (operation logs)
- **Git tracking**: Automatically captures commit SHA when available

See: `docs/governance/PLATFORM_COMPLIANCE.md`

## Testing

Run tests:

```bash
cd Research-Operating-System-Template
pytest tests/test_provenance_logger.py -v
```

## Difference from `web_frontend/utils/provenance.py`

This module is for **core pipeline operations** (src/), while `web_frontend/utils/provenance.py` is for **UI session tracking**.

| Feature | src/provenance | web_frontend/utils/provenance |
|---------|---------------|-------------------------------|
| Purpose | Pipeline operations | UI session tracking |
| Log location | `.tmp/provenance/` | `reports/platform_logs/` |
| Structure | Simple operation logs | Session-based entries |
| Use case | Batch pipelines, CI | Interactive UI actions |

## Artifact Storage

Structured storage for run outputs with deterministic hashing and metadata tracking.

### Purpose

Store intermediate artifacts from pipeline runs with:
- **Unique run IDs**: Timestamp + random hex for collision-free identification
- **SHA256 hashing**: Deterministic content verification
- **Immutable metadata**: Frozen dataclass prevents tampering
- **Organized structure**: `reports/{category}/{run_id}/{filename}`

### Location

Artifacts stored in: `reports/` (configurable via `ROS_REPORTS_DIR` env var)

**PHI Safety**: `reports/` directory is gitignored (not committed to repository)

### Usage

```python
from src.provenance.artifact_store import new_run_id, store_text, store_bytes

# Generate unique run ID
run_id = new_run_id("analysis")  # e.g., "analysis_20260113T180000Z_a1b2c3d4"

# Store text artifact
artifact = store_text(
    run_id=run_id,
    category="literature_search",
    filename="overview.md",
    text="# Literature Review\n\nFindings..."
)

print(f"Stored: {artifact.path}")
print(f"SHA256: {artifact.sha256}")
print(f"Size: {artifact.size_bytes} bytes")

# Store binary artifact
data = b"binary content"
artifact = store_bytes(
    run_id=run_id,
    category="figures",
    filename="plot.png",
    content=data,
    mode="wb"  # or "xb" for exclusive (fail if exists)
)
```

### Directory Structure

```
reports/
├── literature_search/
│   └── analysis_20260113T180000Z_a1b2c3d4/
│       └── overview.md
└── figures/
    └── analysis_20260113T180000Z_a1b2c3d4/
        └── plot.png
```

### StoredArtifact Metadata

```python
@dataclass(frozen=True)
class StoredArtifact:
    run_id: str        # Unique run identifier
    category: str      # Artifact category (e.g., "figures", "literature_search")
    path: str          # Absolute path to stored file
    sha256: str        # SHA256 hex digest (64 chars)
    size_bytes: int    # File size in bytes
```

**Immutability**: The dataclass is frozen, preventing field modifications after creation.

### Environment Configuration

```bash
# Default: stores in ./reports/
export ROS_REPORTS_DIR="reports"

# Custom location (e.g., shared network drive)
export ROS_REPORTS_DIR="/mnt/shared/artifacts"
```

### Governance

- **No PHI**: Only file paths and metadata stored (hashes, sizes, run IDs)
- **Offline-first**: No external API calls, all operations local
- **Deterministic**: SHA256 ensures reproducibility (same content → same hash)
- **Immutable**: Frozen dataclass prevents metadata tampering
- **Boundary enforcement**: Artifacts in `reports/` (gitignored, not committed)

See: `docs/governance/PHI_BOUNDARIES.md`

### Testing

```bash
pytest tests/test_artifact_store.py -v
```

**Last Updated**: 2026-01-13
