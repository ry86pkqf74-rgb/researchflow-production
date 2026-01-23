# Clinical Data Extraction Module

## Overview

The Clinical Data Extraction module provides HIPAA-compliant extraction of structured medical data from unstructured clinical text. It uses tiered LLM models with integrated PHI scanning, MeSH term enrichment, and comprehensive monitoring.

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                        Frontend (React)                              │
│  ┌─────────────┐  ┌──────────────┐  ┌─────────────┐  ┌───────────┐ │
│  │ ConfigPanel │  │ ProgressPanel│  │ ResultsView │  │ MetricsCard│ │
│  └─────────────┘  └──────────────┘  └─────────────┘  └───────────┘ │
└─────────────────────────────────────────────────────────────────────┘
                              │ API
┌─────────────────────────────────────────────────────────────────────┐
│                        API Layer (FastAPI)                           │
│  ┌─────────────┐  ┌──────────────┐  ┌─────────────────────────────┐ │
│  │ /extract/df │  │ /detect-cols │  │ /api/datasets/:id/phi-scan  │ │
│  └─────────────┘  └──────────────┘  └─────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────────────────┐
│                     Processing Layer                                 │
│  ┌─────────────┐  ┌──────────────┐  ┌─────────────┐  ┌───────────┐ │
│  │ cell_parser │  │ nlm_client   │  │ PHIScanner  │  │PromptMgr  │ │
│  └─────────────┘  └──────────────┘  └─────────────┘  └───────────┘ │
└─────────────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────────────────┐
│                     LLM Router / AI Orchestrator                     │
│  ┌─────────────┐  ┌──────────────┐  ┌─────────────────────────────┐ │
│  │    NANO     │  │     MINI     │  │         FRONTIER            │ │
│  │ (GPT-3.5)   │  │ (GPT-4o-mini)│  │ (Claude/GPT-4)              │ │
│  └─────────────┘  └──────────────┘  └─────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────┘
```

## Quick Start

### Installation

```bash
cd services/worker
pip install -r requirements.txt
```

### Basic Usage

```python
from data_extraction import (
    parse_block_text,
    detect_narrative_columns,
    PHIScanner,
)
import pandas as pd

# Load your data
df = pd.read_csv("clinical_notes.csv")

# Detect narrative columns
narrative_cols = detect_narrative_columns(df)
print(f"Detected columns: {narrative_cols}")

# Extract with PHI scanning
results = await parse_block_text(
    df=df,
    columns=narrative_cols,
    tier="MINI",
    enable_phi_scan=True,
    block_on_phi=True,
)

# Access results
print(f"Processed: {results.successful}/{results.total_cells}")
print(f"PHI blocked: {results.phi_blocked}")
print(f"Cost: ${results.total_cost_usd:.4f}")
```

## Components

### 1. Cell Parser (`cell_parser.py`)

DataFrame-level extraction with batch processing.

```python
from data_extraction import parse_block_text, CellTarget

# Auto-detect and extract
results = await parse_block_text(
    df=df,
    columns=["operative_note", "discharge_summary"],
    tier="MINI",
    enable_phi_scan=True,
    block_on_phi=True,
    enable_nlm_enrichment=True,
    max_concurrent=10,
)

# Access manifest
print(results.to_dict())
```

**Parameters:**
- `df`: Input DataFrame
- `columns`: List of columns to extract (None = auto-detect)
- `tier`: "NANO", "MINI", or "FRONTIER"
- `enable_phi_scan`: Run PHI detection before extraction
- `block_on_phi`: Stop if PHI detected
- `enable_nlm_enrichment`: Add MeSH IDs to extracted terms
- `max_concurrent`: Parallel extraction limit

### 2. PHI Scanner (`cell_parser.py`)

HIPAA-compliant PHI detection.

```python
from data_extraction import PHIScanner

scanner = PHIScanner()

# Scan single cell
result = scanner.scan(text)
print(f"PHI detected: {result.has_phi}")
print(f"Types found: {result.phi_types}")  # ['ssn', 'phone', etc.]

# Returns locations only, never values!
for loc in result.locations:
    print(f"  {loc['type']}: chars {loc['start']}-{loc['end']}")
```

**Detected PHI Types:**
- SSN (xxx-xx-xxxx format)
- Phone numbers
- Email addresses
- Medical Record Numbers (MRN)
- Dates of birth
- Credit card numbers
- Names (pattern-based)

### 3. NLM Client (`nlm_client.py`)

Direct NCBI E-utilities API for MeSH enrichment.

```python
from data_extraction import NLMClient, lookup_mesh_term

# Single term lookup
result = await lookup_mesh_term("appendicitis")
print(f"MeSH ID: {result.mesh_id}")  # D001064
print(f"Preferred term: {result.preferred_term}")

# Batch lookup with caching
client = NLMClient()
terms = ["appendicitis", "cholecystectomy", "laparoscopic"]
results = await client.batch_lookup(terms)

# View cache stats
stats = client.get_stats()
print(f"Cache hits: {stats.cache_hits}/{stats.total_requests}")
```

### 4. Prompt Manager (`prompt_manager.py`)

Tier-specific prompt loading with token estimation.

```python
from data_extraction import PromptManager, get_optimal_tier

pm = PromptManager()

# Get prompt for tier
prompt = pm.get_extraction_prompt(clinical_text, tier="FRONTIER")

# Estimate tokens before API call
estimate = pm.estimate_request_tokens("extraction", clinical_text, tier="MINI")
print(f"Estimated tokens: {estimate['total_request_tokens']}")

# Auto-select tier based on text length
tier = get_optimal_tier(clinical_text, prefer_quality=True)
```

**Prompt Tiers:**

| Tier | Tokens | Use Case | Features |
|------|--------|----------|----------|
| NANO | ~250 | Short notes, high volume | Basic extraction |
| MINI | ~1,300 | Most use cases | Evidence, confidence scores |
| FRONTIER | ~2,700 | Complex operative notes | Clavien-Dindo, detailed fields |

### 5. Testing Framework (`testing/`)

Synthetic data generation and benchmarking.

```python
from data_extraction.testing import (
    SyntheticNoteGenerator,
    BenchmarkRunner,
    get_gold_standard_cases,
)

# Generate synthetic data
generator = SyntheticNoteGenerator(seed=42)
notes = generator.generate_batch(count=100)

# Run benchmark
runner = BenchmarkRunner()
result = await runner.run_benchmark(notes, tier="MINI")

# View results
print(result.summary())
# ═══════════════════════════════════════════════════════
#   ACCURACY (Macro-Averaged)
#     Precision:          0.850
#     Recall:             0.780
#     F1 Score:           0.814
# ...

# Compare tiers
comparison = await runner.compare_tiers(notes)
print(runner.print_tier_comparison(comparison))
```

### 6. Monitoring (`monitoring.py`)

Production observability with alerts.

```python
from data_extraction.monitoring import get_monitor, configure_monitor

# Configure with custom thresholds
monitor = configure_monitor(
    enable_alerts=True,
    thresholds={
        "error_rate": 0.05,  # 5% error threshold
        "daily_cost_usd": 50.0,  # $50 daily budget
    }
)

# Record extractions
monitor.record_extraction(
    tier="MINI",
    latency_ms=150,
    success=True,
    tokens_used=500,
    cost_usd=0.001,
)

# Context manager for automatic tracking
with monitor.track_extraction(tier="MINI") as tracker:
    result = await extract(text)
    tracker.set_tokens(result.tokens)
    tracker.set_cost(result.cost)

# Health check
health = monitor.health_check()
print(health.to_dict())

# Prometheus metrics
print(monitor.get_prometheus_metrics())
```

### 7. Logging (`logging_config.py`)

PHI-safe structured logging.

```python
from data_extraction.logging_config import configure_logging, get_logger

# Configure JSON logging with PHI scrubbing
configure_logging(
    level="INFO",
    json_format=True,
    scrub_phi=True,
    log_file="/var/log/extraction.log",
)

logger = get_logger(__name__)

# Structured logging
logger.extraction_start(
    tier="MINI",
    cell_count=100,
    columns=["note"],
)

# PHI is automatically scrubbed
logger.info(f"Processing patient SSN: 123-45-6789")
# Output: {"message": "Processing patient SSN: [PHI_REDACTED]", ...}
```

## API Endpoints

### POST /extraction/extract/dataframe

Upload and extract from a file.

```bash
curl -X POST http://localhost:8000/extraction/extract/dataframe \
  -F "file=@notes.csv" \
  -F "enable_phi_scanning=true" \
  -F "enable_nlm_enrichment=true" \
  -F "force_tier=MINI"
```

**Response:**
```json
{
  "status": "completed",
  "row_count": 100,
  "columns_processed": ["operative_note"],
  "total_cells": 100,
  "successful": 95,
  "failed": 2,
  "phi_blocked": 3,
  "total_cost_usd": 0.15,
  "total_tokens": 45000
}
```

### POST /extraction/detect-columns

Detect narrative columns in a file.

```bash
curl -X POST http://localhost:8000/extraction/detect-columns \
  -F "file=@notes.csv"
```

**Response:**
```json
{
  "columns": [
    {"name": "operative_note", "is_narrative": true, "avg_length": 2500},
    {"name": "patient_id", "is_narrative": false, "avg_length": 10}
  ],
  "extraction_target_count": 1
}
```

## Workflow Integration

The extraction module integrates with the ResearchFlow 19-stage workflow at **Stage 06: Analysis**.

```python
# In workflow configuration
config = {
    "analysis_type": "dataframe_extraction",
    "parameters": {
        "columns": None,  # Auto-detect
        "enable_phi_scanning": True,
        "block_on_phi": True,
        "enable_nlm_enrichment": True,
        "force_tier": None,  # Auto-select
        "max_concurrent": 10,
    }
}
```

## Security Considerations

### PHI Protection

1. **Pre-extraction scanning**: All cells are scanned for PHI before LLM processing
2. **Locations only**: PHI scanner returns character positions, never actual values
3. **Block on detect**: Configurable to halt extraction if PHI found
4. **Log scrubbing**: All logs are automatically scrubbed of PHI patterns

### Governance Modes

- **DEMO**: Simulated extraction, no real API calls
- **LIVE**: Full extraction with governance checks
- **OFFLINE**: Local processing only

## Cost Optimization

### Token Estimation

```python
estimate = pm.estimate_request_tokens("extraction", text, tier="MINI")

if estimate["total_request_tokens"] > 4000:
    tier = "NANO"  # Use smaller prompt
```

### Tier Auto-Selection

```python
# Automatically select cheapest tier that fits
tier = get_optimal_tier(text, max_tokens=4000, prefer_quality=False)
```

### Budget Alerts

```python
monitor = configure_monitor(
    thresholds={
        "daily_cost_usd": 100.0,
        "hourly_cost_usd": 10.0,
    },
    alert_callback=lambda alert: send_slack_notification(alert),
)
```

## Testing

### Run All Tests

```bash
cd services/worker
PYTHONPATH=src python -m pytest tests/ -v
```

### Run Specific Test Modules

```bash
# Cell parser tests
pytest tests/test_cell_parser.py -v

# NLM client tests
pytest tests/test_nlm_client.py -v

# Prompt manager tests
pytest tests/test_prompt_manager.py -v

# Testing framework tests
pytest tests/test_testing_framework.py -v
```

### Generate Benchmark Report

```python
from data_extraction.testing import run_gold_standard_benchmark

result = await run_gold_standard_benchmark(tier="MINI")
print(result.summary())
```

## Troubleshooting

### Common Issues

**1. PHI blocking all extractions**
- Check if your data contains formatted identifiers
- Use `PHIScanner.scan()` to inspect what's being detected
- Consider pre-sanitizing your data

**2. High error rates**
- Check model availability in AI Router
- Review error types in monitoring
- Consider using a higher tier for complex notes

**3. Slow extraction**
- Increase `max_concurrent` for parallel processing
- Use NANO tier for simple notes
- Check network latency to AI Router

**4. Missing MeSH enrichment**
- Verify NLM API connectivity
- Check rate limits (3 req/sec)
- Review cache hit rate in stats

## File Structure

```
services/worker/src/data_extraction/
├── __init__.py           # Module exports
├── cell_parser.py        # DataFrame extraction
├── nlm_client.py         # Direct NCBI API
├── nlm_enrichment.py     # MeSH enrichment orchestration
├── extract_from_cells.py # Single-cell extraction
├── schemas.py            # Pydantic models
├── prompt_manager.py     # Prompt loading/versioning
├── monitoring.py         # Metrics and alerts
├── logging_config.py     # Structured logging
├── api_routes.py         # FastAPI endpoints
├── prompts/
│   ├── clinical_note_extract_nano.txt
│   ├── clinical_note_extract_v2.txt
│   ├── clinical_note_extract_frontier.txt
│   ├── clinical_note_repair_json_v2.txt
│   └── note_type_classify_v1.txt
└── testing/
    ├── __init__.py
    ├── synthetic_data.py  # Note generator
    └── benchmark.py       # Metrics runner
```

## Version History

- **1.0.0** - Initial release with cell parser, NLM client, prompt tiers
- **1.1.0** - Added workflow integration, API endpoints
- **1.2.0** - Added testing framework, monitoring, logging

## Support

For issues or questions, contact the ResearchFlow team or file an issue in the repository.
