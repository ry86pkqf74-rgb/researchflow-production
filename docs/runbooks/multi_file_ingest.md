# Multi-File Ingestion Runbook

## Overview

This runbook covers operational procedures for the multi-file data ingestion feature.

## Quick Start

### 1. Start Services

```bash
docker-compose up -d
```

### 2. Verify Health

```bash
# Check worker ingest endpoint
curl http://localhost:8000/api/ingest/health

# Check orchestrator ingest endpoint
curl http://localhost:3001/api/ingest/health
```

### 3. Run Detection

```bash
curl -X POST http://localhost:3001/api/ingest/detect \
  -H "Content-Type: application/json" \
  -d '{"source_path": "/data/uploads/my_study"}'
```

### 4. Execute Merge

```bash
curl -X POST http://localhost:3001/api/ingest/merge \
  -H "Content-Type: application/json" \
  -d '{
    "run_id": "YOUR_RUN_ID",
    "linking_column": "patient_id",
    "merge_type": "left"
  }'
```

## Common Operations

### List Active Jobs

```bash
curl http://localhost:3001/api/ingest/jobs
```

### Check Job Status

```bash
curl http://localhost:3001/api/ingest/status/YOUR_RUN_ID
```

### Cancel Job

```bash
curl -X DELETE http://localhost:3001/api/ingest/jobs/YOUR_RUN_ID
```

## File Preparation

### Supported Formats

- CSV (`.csv`) - Comma-separated
- TSV (`.tsv`) - Tab-separated
- Excel (`.xlsx`, `.xls`) - Single or multi-sheet
- Parquet (`.parquet`) - Columnar

### Best Practices

1. **Consistent ID columns**: Use same column name across files
2. **Clean headers**: No spaces, special characters
3. **Unique IDs**: Ensure linking column has high uniqueness
4. **UTF-8 encoding**: Save CSV/TSV as UTF-8

### File Organization

```
study_data/
├── demographics.csv    # patient_id, age, sex, race
├── labs.csv           # patient_id, glucose, hba1c, date
├── medications.xlsx   # patient_id, drug_name, dosage
└── outcomes.csv       # patient_id, outcome, follow_up_date
```

## Troubleshooting

### No ID Candidates Found

**Symptom**: Detection returns empty candidates array

**Causes**:
1. No common columns across files
2. Column values have no overlap
3. Low uniqueness (many duplicates)

**Solutions**:
1. Check column names match (case-sensitive by default)
2. Verify ID values exist in multiple files
3. Lower `min_uniqueness` threshold:
   ```json
   {"options": {"min_uniqueness": 0.5}}
   ```

### Merge Fails with Column Not Found

**Symptom**: Error "Column X not found in all files"

**Causes**:
1. Column name differs between files
2. Typo in linking_column parameter

**Solutions**:
1. Use fuzzy matching (enabled by default)
2. Check exact column names in each file
3. Rename columns before upload

### Out of Memory on Large Files

**Symptom**: Worker crashes or times out

**Causes**:
1. Files exceed available memory
2. Dask chunking not enabled

**Solutions**:
1. Enable Dask processing:
   ```bash
   DASK_ENABLED=true docker-compose up -d worker
   ```
2. Reduce chunk size:
   ```bash
   CHUNK_SIZE=5000 docker-compose up -d worker
   ```
3. Use Polars backend:
   ```bash
   USE_POLARS=true docker-compose up -d worker
   ```

### Excel Multi-Sheet Issues

**Symptom**: Only first sheet processed

**Causes**:
1. Default behavior is all sheets
2. Sheet names may conflict

**Solutions**:
1. Verify Excel file structure
2. Each sheet becomes separate "file" in detection
3. Check for consistent column names across sheets

## Performance Tuning

### For Large Files (>100MB)

```bash
# Enable parallel processing
DASK_ENABLED=true
CHUNK_SIZE=50000

# Or use Polars (faster for single large files)
USE_POLARS=true
```

### For Many Small Files (>50 files)

```bash
# Increase worker resources
docker-compose up -d --scale worker=3
```

### Memory Optimization

```bash
# Limit concurrent jobs
MAX_CONCURRENT_INGEST_JOBS=2

# Enable streaming output
STREAMING_OUTPUT=true
```

## Monitoring

### Logs

```bash
# Worker logs
docker-compose logs -f worker | grep ingest

# Orchestrator logs
docker-compose logs -f orchestrator | grep ingest
```

### Metrics

Key metrics to monitor:
- `ingest_detection_duration_seconds`
- `ingest_merge_duration_seconds`
- `ingest_files_processed_total`
- `ingest_rows_merged_total`
- `ingest_errors_total`

### Health Checks

```bash
# Worker health
curl http://localhost:8000/api/ingest/health

# Expected response
{
  "status": "healthy",
  "service": "multi-file-ingest",
  "active_jobs": 0
}
```

## Disaster Recovery

### Job Stuck in Processing

```bash
# 1. Check job status
curl http://localhost:3001/api/ingest/status/RUN_ID

# 2. If stuck, force delete
curl -X DELETE http://localhost:3001/api/ingest/jobs/RUN_ID

# 3. Restart worker if needed
docker-compose restart worker
```

### Manifest Recovery

Manifests are stored in `/data/manifests/`. To recover:

```bash
# List manifests
ls /data/manifests/*.json

# View specific manifest
cat /data/manifests/ingest-RUN_ID.json
```

### Data Recovery

Output files are stored in `/data/artifacts/`. Check for:
- `merged-RUN_ID.parquet` - Merged output
- `merged-RUN_ID.csv` - CSV output (if requested)

## Security Considerations

### PHI Handling

1. **DEMO mode**: Automatically strips/flags PHI-like columns
2. **LIVE mode**: Preserves all data (requires proper authorization)

```bash
# Check current mode
echo $GOVERNANCE_MODE

# Set mode
GOVERNANCE_MODE=LIVE docker-compose up -d
```

### Access Control

- Ingest endpoints require authentication in LIVE mode
- Check `requireAuth` middleware configuration
- Audit manifests include user_id for traceability

## Maintenance

### Cleanup Old Jobs

```bash
# Jobs older than 7 days
find /data/manifests -name "*.json" -mtime +7 -delete

# Temporary files
find /data/artifacts -name "temp-*" -mtime +1 -delete
```

### Database Maintenance

If using DuckDB persistence:

```bash
# Vacuum database
duckdb /data/ingest.duckdb "VACUUM;"

# Check size
du -h /data/ingest.duckdb
```

## Support

### Escalation Path

1. Check logs for error details
2. Verify file format compatibility
3. Test with smaller sample data
4. Check worker memory/CPU usage
5. Contact data engineering team

### Common Error Codes

| Code | Meaning | Action |
|------|---------|--------|
| 400 | Bad request | Check request body |
| 404 | Job not found | Run detection first |
| 409 | Conflict | Job already processed |
| 500 | Server error | Check worker logs |
| 503 | Service unavailable | Restart worker |
