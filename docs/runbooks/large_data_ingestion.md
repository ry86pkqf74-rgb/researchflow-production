# Large-Data Ingestion & Dask Integration

## Overview

ResearchFlow's large-data ingestion system enables processing of datasets from 1 to 100+ million rows without exhausting RAM. The system automatically detects file sizes and selects the optimal processing strategy.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     File Input                                   │
│                   (CSV/TSV/Parquet)                              │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                   Size Detection                                 │
│              os.path.getsize(file_path)                         │
└─────────────────────────────────────────────────────────────────┘
                              │
              ┌───────────────┼───────────────┐
              ▼               ▼               ▼
       < threshold     >= threshold     >= threshold
                       DASK_ENABLED      DASK_DISABLED
              │               │               │
              ▼               ▼               ▼
┌───────────────┐ ┌───────────────┐ ┌───────────────┐
│    pandas     │ │     Dask      │ │   Chunked     │
│  DataFrame    │ │  DataFrame    │ │  TextFileReader│
│   (in-memory) │ │ (partitioned) │ │  (iterator)   │
└───────────────┘ └───────────────┘ └───────────────┘
              │               │               │
              └───────────────┼───────────────┘
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Validation                                  │
│          validate_data() - handles all data types               │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                   PHI Detection                                  │
│    scan_dataframe_for_phi() / scan_dask_dataframe_for_phi()    │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                 Partitioned Output                               │
│          write_cleaned() → Parquet partitions                   │
└─────────────────────────────────────────────────────────────────┘
```

## Configuration

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `LARGE_FILE_BYTES` | `52428800` (50MB) | File size threshold for large-file handling |
| `CHUNK_SIZE_ROWS` | `500000` | Rows per chunk for pandas fallback |
| `DASK_ENABLED` | `false` | Enable Dask distributed processing |
| `DASK_BLOCKSIZE_BYTES` | `67108864` (64MB) | Block size for Dask read_csv |
| `DASK_WORKERS` | `4` | Number of Dask workers |
| `DASK_THREADS_PER_WORKER` | `2` | Threads per Dask worker |
| `DASK_MEMORY_LIMIT` | `4GB` | Memory limit per worker |
| `DASK_SCHEDULER_ADDR` | (none) | External Dask scheduler address |
| `MAX_PARQUET_FILE_SIZE` | `104857600` (100MB) | Max partition file size |

### docker-compose.yml Configuration

```yaml
services:
  worker:
    environment:
      # Large-data ingestion
      - LARGE_FILE_BYTES=52428800
      - CHUNK_SIZE_ROWS=500000
      - DASK_ENABLED=false
      - DASK_BLOCKSIZE_BYTES=67108864
      - DASK_WORKERS=4
      - DASK_THREADS_PER_WORKER=2
      - DASK_MEMORY_LIMIT=4GB
      - MAX_PARQUET_FILE_SIZE=104857600
```

## Usage

### Basic Ingestion

```python
from src.ingestion import ingest_file_large, IngestionConfig

# Use default configuration
data, metadata = ingest_file_large("data.csv", "csv")

# Check what mode was used
if metadata.is_dask:
    print(f"Using Dask with {metadata.partition_count} partitions")
elif metadata.is_chunked:
    print(f"Using chunked mode with ~{metadata.partition_count} chunks")
else:
    print(f"Using standard pandas ({len(data)} rows)")
```

### Custom Configuration

```python
from src.ingestion import ingest_file_large, IngestionConfig

config = IngestionConfig(
    large_file_bytes=100 * 1024 * 1024,  # 100MB threshold
    chunk_size_rows=100000,
    dask_enabled=True,
)

data, metadata = ingest_file_large("large_data.csv", "csv", config=config)
```

### Validation

```python
from src.ingestion import validate_data
from src.ingestion.schema_loader import SchemaDefinition, ColumnDefinition

schema = SchemaDefinition(
    name="my_schema",
    version="1.0.0",
    file_format="csv",
    columns=[
        ColumnDefinition(name="id", type="integer", required=True, nullable=False),
        ColumnDefinition(name="name", type="string", required=True, nullable=True),
    ],
    required_columns=["id", "name"],
)

# Works with pandas DataFrame, Dask DataFrame, or TextFileReader
result = validate_data(data, schema)

if result.valid:
    print(f"Valid: {result.total_rows_validated} rows")
else:
    print(f"Invalid: {result.errors}")
    for chunk_err in result.chunk_errors:
        print(f"  Chunk {chunk_err.chunk_index}: {chunk_err.errors}")
```

### Writing Partitioned Output

```python
from src.ingestion import write_cleaned, write_manifest

# Write to partitioned Parquet
result = write_cleaned(data, "/output/cleaned", filename="dataset")

print(f"Wrote {result.row_count} rows")
print(f"Partitioned: {result.partitioned}")
print(f"Total size: {result.total_bytes} bytes")

# Generate manifest
write_manifest(result, "/output/manifest.json", job_id="job_abc123")
```

## Processing Modes

### Standard Pandas Mode

Used for files under `LARGE_FILE_BYTES` threshold.

**Pros:**
- Simple, fast for small files
- Full DataFrame API available
- In-memory operations

**Cons:**
- Memory-bound
- Not suitable for large files

### Dask Mode

Used for large files when `DASK_ENABLED=true`.

**Pros:**
- Handles datasets larger than RAM
- Parallel processing
- Lazy evaluation (memory efficient)
- Familiar DataFrame API

**Cons:**
- Requires Dask installation
- Some operations trigger computation
- Overhead for small files

### Chunked Mode

Used for large files when Dask is disabled.

**Pros:**
- No additional dependencies
- Memory efficient
- Works everywhere pandas works

**Cons:**
- Sequential processing
- Must handle chunk boundaries
- Some operations need aggregation

## Workflow Integration

### Stage 04: Schema Validation

Stage 04 automatically detects large files and uses appropriate validation:

```python
# In stage_04_validate.py
if INGESTION_AVAILABLE:
    is_valid, error_msg, metadata = validate_csv_large(file_path, config)
```

The stage passes `large_file_info` to subsequent stages:

```python
output["large_file_info"] = {
    "processing_mode": metadata.get("processing_mode"),
    "partition_count": metadata.get("partition_count"),
    "file_size_bytes": metadata.get("file_size_bytes"),
}
```

### Stage 05: PHI Detection

Stage 05 uses mode-aware PHI scanning:

```python
# For Dask DataFrames
if ingestion_meta.is_dask:
    findings, scan_meta = scan_dask_dataframe_for_phi(data, tier=tier)

# For chunked data
elif ingestion_meta.is_chunked:
    findings, scan_meta = scan_chunked_iterator_for_phi(data, tier=tier)

# For standard DataFrames
else:
    findings = scan_dataframe_for_phi(data, tier=tier)
```

## Output Schema

### WriteResult

```python
@dataclass
class WriteResult:
    output_path: str          # Path to output file/directory
    format: str               # "parquet", "csv", etc.
    partitioned: bool         # True if multiple partition files
    partition_paths: List[str] # List of partition file paths
    row_count: int            # Total rows written
    column_count: int         # Number of columns
    total_bytes: int          # Total size in bytes
    checksum: str             # SHA-256 checksum
    compression: str          # Compression codec used
    created_at: str           # ISO timestamp
```

### Manifest JSON

```json
{
  "version": "1.0.0",
  "job_id": "job_abc123xyz456",
  "created_at": "2026-01-23T12:00:00Z",
  "output": {
    "output_path": "/data/output/dataset",
    "format": "parquet",
    "partitioned": true,
    "partition_paths": [
      "/data/output/dataset/part-00000.parquet",
      "/data/output/dataset/part-00001.parquet"
    ],
    "row_count": 1000000,
    "column_count": 15,
    "total_bytes": 52428800,
    "checksum": "abc123...",
    "compression": "snappy"
  },
  "metadata": {
    "source": "workflow_stage_04",
    "pipeline_version": "1.4.0"
  }
}
```

## Job Result Schema

The `datasetOutput` field in job results follows this schema:

```json
{
  "datasetOutput": {
    "outputPath": "/data/output/cleaned",
    "format": "parquet",
    "partitioned": true,
    "partitionPaths": ["..."],
    "rowCount": 1000000,
    "columnCount": 15,
    "totalBytes": 52428800,
    "checksum": "abc123...",
    "compression": "snappy",
    "createdAt": "2026-01-23T12:00:00Z"
  }
}
```

## Performance Tuning

### Memory Optimization

For memory-constrained environments:

```bash
# Reduce chunk size
CHUNK_SIZE_ROWS=100000

# Disable Dask (uses less memory per operation)
DASK_ENABLED=false

# Lower Dask memory limit
DASK_MEMORY_LIMIT=2GB
```

### Throughput Optimization

For maximum throughput:

```bash
# Enable Dask for parallel processing
DASK_ENABLED=true

# Increase workers
DASK_WORKERS=8

# Larger block size (better I/O)
DASK_BLOCKSIZE_BYTES=134217728  # 128MB
```

### Large Dataset Recommendations

| Dataset Size | Recommended Mode | Configuration |
|--------------|------------------|---------------|
| < 50MB | Standard pandas | Default |
| 50MB - 1GB | Chunked or Dask | `CHUNK_SIZE_ROWS=500000` |
| 1GB - 10GB | Dask | `DASK_ENABLED=true`, `DASK_WORKERS=4` |
| > 10GB | Dask cluster | External `DASK_SCHEDULER_ADDR` |

## Troubleshooting

### Out of Memory

**Symptoms:** Worker crashes, OOM errors

**Solutions:**
1. Enable Dask: `DASK_ENABLED=true`
2. Reduce chunk size: `CHUNK_SIZE_ROWS=100000`
3. Increase Dask memory limit: `DASK_MEMORY_LIMIT=8GB`

### Slow Processing

**Symptoms:** Long processing times

**Solutions:**
1. Enable Dask for parallel processing
2. Increase workers: `DASK_WORKERS=8`
3. Use SSD storage for temp files

### Validation Errors

**Symptoms:** Validation fails on specific chunks

**Solutions:**
1. Check `chunk_errors` in ValidationResult
2. Use `max_chunk_errors` parameter to limit validation
3. Review data quality at reported row offsets

## API Reference

### ingest_file_large()

```python
def ingest_file_large(
    data_path: Union[str, Path],
    file_format: str,
    config: Optional[IngestionConfig] = None,
) -> tuple[DataType, IngestionMetadata]:
    """Ingest a file with automatic large-file handling."""
```

### validate_data()

```python
def validate_data(
    data: DataType,
    schema: SchemaDefinition,
    *,
    coerce_types: bool = True,
    max_chunk_errors: int = 10,
) -> ValidationResult:
    """Validate data against schema with automatic type detection."""
```

### write_cleaned()

```python
def write_cleaned(
    data: DataType,
    output_dir: Union[str, Path],
    *,
    filename: str = "data",
    config: Optional[IngestionConfig] = None,
    compression: str = "snappy",
) -> WriteResult:
    """Write cleaned data to Parquet format."""
```

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.4.0 | 2026-01-23 | Phase 4: Partitioned output writer |
| 1.3.0 | 2026-01-23 | Phase 3: Dask/chunked validation |
| 1.2.0 | 2026-01-23 | Phase 2: Ingestion module enhancement |
| 1.1.0 | 2026-01-23 | Phase 1: Configuration infrastructure |
