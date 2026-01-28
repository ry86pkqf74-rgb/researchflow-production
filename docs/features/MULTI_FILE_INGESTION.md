# Multi-File Data Ingestion

## Overview

The Multi-File Ingestion feature enables automatic detection and merging of multiple data files (CSV, Excel, Parquet) into a unified dataset. It uses intelligent ID column detection to identify linking columns across files and supports various merge strategies.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     Frontend (React)                            │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐      │
│  │ File Upload  │ -> │ ID Selector  │ -> │ Merge Config │      │
│  └──────────────┘    └──────────────┘    └──────────────┘      │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                  Orchestrator (Node.js)                         │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐      │
│  │ POST /detect │ -> │ Job Manager  │ -> │ POST /merge  │      │
│  └──────────────┘    └──────────────┘    └──────────────┘      │
│         routes/ingest.ts          jobs/multiFileIngest.ts       │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Worker (Python)                              │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐      │
│  │ ID Detection │ -> │ Merge Engine │ -> │ Output Writer│      │
│  └──────────────┘    └──────────────┘    └──────────────┘      │
│   utils/id_detection.py    ingest/merge_ingest.py              │
└─────────────────────────────────────────────────────────────────┘
```

## Two-Phase Workflow

### Phase 1: Detection

1. User uploads/selects files or directory
2. System reads all supported file formats
3. ID candidates are detected based on:
   - **Uniqueness ratio**: How unique are values in the column?
   - **Overlap ratio**: How much do values overlap across files?
   - **Pattern score**: Does the column name match common ID patterns?
   - **Fuzzy matching**: Do column names match across files (even with different naming)?
4. Candidates are ranked and returned for user confirmation

### Phase 2: Merge

1. User selects/confirms the linking column
2. User chooses merge type (inner, left, outer)
3. System performs the merge
4. Output is written to Parquet (default) or CSV
5. Audit manifest is generated

## API Endpoints

### Orchestrator Routes (`/api/ingest/*`)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/ingest/detect` | POST | Start detection phase |
| `/api/ingest/confirm` | POST | Confirm and execute merge |
| `/api/ingest/status/:runId` | GET | Get job status |
| `/api/ingest/jobs` | GET | List all jobs |
| `/api/ingest/jobs/:runId` | DELETE | Cancel/delete job |
| `/api/ingest/health` | GET | Health check |

### Worker Endpoints (`/api/ingest/*`)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/ingest/detect` | POST | Execute detection |
| `/api/ingest/merge` | POST | Execute merge |
| `/api/ingest/status/:runId` | GET | Get job status |
| `/api/ingest/jobs` | GET | List active jobs |
| `/api/ingest/jobs/:runId` | DELETE | Remove job |
| `/api/ingest/health` | GET | Service health |

## Request/Response Examples

### Detection Request

```json
POST /api/ingest/detect
{
  "source_path": "/data/uploads/study_123",
  "run_id": "optional-custom-id",
  "options": {
    "min_uniqueness": 0.8,
    "min_overlap": 0.3,
    "top_n": 5
  }
}
```

### Detection Response

```json
{
  "run_id": "ingest-abc123-456",
  "status": "detected",
  "files_found": 3,
  "candidates": [
    {
      "column_name": "patient_id",
      "uniqueness_ratio": 0.98,
      "overlap_ratio": 0.85,
      "pattern_score": 1.0,
      "matched_in_files": ["demographics.csv", "labs.csv", "outcomes.csv"]
    },
    {
      "column_name": "mrn",
      "uniqueness_ratio": 0.95,
      "overlap_ratio": 0.80,
      "pattern_score": 0.9,
      "matched_in_files": ["demographics.csv", "labs.csv"]
    }
  ]
}
```

### Merge Request

```json
POST /api/ingest/merge
{
  "run_id": "ingest-abc123-456",
  "linking_column": "patient_id",
  "merge_type": "left",
  "output_format": "parquet"
}
```

### Merge Response

```json
{
  "success": true,
  "run_id": "ingest-abc123-456",
  "output_path": "/data/artifacts/merged-abc123.parquet",
  "row_count": 1250,
  "column_count": 45,
  "manifest": {
    "run_id": "ingest-abc123-456",
    "input_files": ["demographics.csv", "labs.csv", "outcomes.csv"],
    "linking_column": "patient_id",
    "merge_type": "left",
    "timestamp": "2026-01-27T12:34:56Z"
  }
}
```

## Supported File Formats

| Format | Extension | Notes |
|--------|-----------|-------|
| CSV | `.csv` | Auto-detects delimiter |
| TSV | `.tsv` | Tab-separated |
| Excel | `.xlsx`, `.xls` | Multi-sheet support |
| Parquet | `.parquet` | Columnar format |

## ID Detection Algorithm

The ID column detection uses a weighted scoring system:

```python
score = (
    uniqueness_weight * uniqueness_ratio +
    overlap_weight * overlap_ratio +
    pattern_weight * pattern_score
)
```

Default weights:
- `uniqueness_weight`: 0.4
- `overlap_weight`: 0.4
- `pattern_weight`: 0.2

### Common ID Patterns Recognized

- `id`, `_id`, `Id`, `ID`
- `patient_id`, `subject_id`, `participant_id`
- `mrn`, `medical_record_number`
- `record_id` (REDCap)
- `case_id`, `study_id`
- `*_num`, `*_number`

### Fuzzy Matching

Column names are matched using fuzzy string matching (fuzzywuzzy library) to handle:
- Case differences (`PatientID` ↔ `patient_id`)
- Naming conventions (`subjectNum` ↔ `subject_number`)
- Abbreviations (`pt_id` ↔ `patient_id`)

Default similarity threshold: 80%

## Merge Types

| Type | SQL Equivalent | Description |
|------|---------------|-------------|
| `inner` | INNER JOIN | Only rows with matching IDs in all files |
| `left` | LEFT JOIN | All rows from first file, matched from others |
| `outer` | FULL OUTER JOIN | All rows from all files |

## PHI Governance

The ingestion respects the system-wide governance mode:

- **DEMO mode**: PHI-like columns may be flagged or stripped
- **LIVE mode**: All data preserved as-is

PHI detection looks for patterns like:
- Names (first_name, last_name, patient_name)
- SSN patterns
- Date of birth
- Address fields
- Phone numbers
- Email addresses

## Large File Handling

For files larger than the configured threshold (default: 100MB), the system uses:

1. **Dask chunking**: Process files in parallel chunks
2. **Polars backend**: Optional high-performance dataframe library
3. **Streaming writes**: Write output in chunks to avoid memory issues

Configure via environment variables:
```bash
DASK_ENABLED=true
CHUNK_SIZE=10000
USE_POLARS=true
```

## Audit Trail

Every merge operation generates a manifest stored in `/data/manifests/`:

```json
{
  "run_id": "ingest-abc123-456",
  "input_files": ["file1.csv", "file2.xlsx"],
  "linking_column": "patient_id",
  "merge_type": "left",
  "timestamp": "2026-01-27T12:34:56Z",
  "row_count_input": {"file1.csv": 500, "file2.xlsx": 450},
  "row_count_output": 520,
  "user_id": "user-123",
  "governance_mode": "LIVE"
}
```

## Error Handling

| Error | HTTP Code | Resolution |
|-------|-----------|------------|
| Invalid path | 400 | Check file/directory exists |
| No supported files | 400 | Ensure CSV/Excel/Parquet files present |
| Column not found | 400 | Verify linking column exists in all files |
| Job not found | 404 | Run detection phase first |
| Merge conflict | 409 | Job may already be merged |
| Processing error | 500 | Check worker logs |

## Testing

Run tests with:

```bash
# Unit tests
cd services/worker
pytest tests/test_id_detection.py -v
pytest tests/test_merge_ingest.py -v

# API integration tests
pytest tests/test_ingest_api.py -v
```

## Configuration

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `ARTIFACT_PATH` | `/data/artifacts` | Output directory |
| `GOVERNANCE_MODE` | `DEMO` | PHI handling mode |
| `DASK_ENABLED` | `false` | Use Dask for large files |
| `CHUNK_SIZE` | `10000` | Rows per chunk |
| `USE_POLARS` | `false` | Use Polars backend |
| `FUZZY_THRESHOLD` | `80` | Column name match threshold |

## Dependencies

Python packages:
- `pandas` - Core dataframe operations
- `fuzzywuzzy` - Fuzzy string matching
- `python-Levenshtein` - Fast string matching
- `openpyxl` - Excel reading/writing
- `xlrd` - Legacy Excel support
- `pyarrow` - Parquet support
- `polars` (optional) - High-performance dataframes
- `dask` (optional) - Parallel processing
- `duckdb` (optional) - SQL-based operations

## Future Enhancements

1. **Web UI**: Drag-and-drop file upload with visual ID selection
2. **Schema validation**: Pandera integration for data quality checks
3. **Incremental updates**: Append new data to existing merged datasets
4. **Data profiling**: Automatic statistics on merged data
5. **Export formats**: Support for SPSS, Stata, SAS formats
