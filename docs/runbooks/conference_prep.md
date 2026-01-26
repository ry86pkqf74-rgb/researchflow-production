# Conference Preparation Runbook (Stage 20)

## Overview

Stage 20 automates conference submission preparation: discovery, guideline extraction, material generation (abstracts, posters, slides), and export bundling.

## Prerequisites

- Python 3.11+
- Redis (for caching)
- Access to worker service
- Manuscript artifacts from earlier stages

## Environment Variables

```bash
# Required
GOVERNANCE_MODE=DEMO|LIVE
ARTIFACTS_PATH=/data/artifacts    # Note: Both ARTIFACTS_PATH and ARTIFACT_PATH are supported

# Optional
CONFERENCE_CACHE_TTL=86400        # Cache duration for conference discovery (seconds)
ENABLE_WEB_SEARCH=false           # Enable online conference discovery

# AI Keys (for material generation)
OPENAI_API_KEY=your_key
ANTHROPIC_API_KEY=your_key
```

## How to Run Locally

### 1. Start the Worker

```bash
cd services/worker
pip install -r requirements.txt
python api_server.py
```

### 2. Run Stage 20 Directly

```python
from src.workflow_engine.stages.stage_20_conference import Stage20ConferencePreparation
from src.workflow_engine.types import StageContext

context = StageContext(
    job_id="test_job_123",
    artifact_path="/data/artifacts",
    governance_mode="DEMO",
    config={
        "enable_conference_prep": True,
        "conference_prep": {
            "keywords": ["diabetes", "machine learning"],
            "target_regions": ["US", "Europe"],
            "prefer_upcoming_months": 6,
        }
    }
)

stage = Stage20ConferencePreparation()
result = await stage.execute(context)
print(result.artifacts)
```

### 3. Via API

```bash
# Start conference prep job
curl -X POST http://localhost:8001/api/conference/start \
  -H "Content-Type: application/json" \
  -d '{
    "manuscript_text": "Our study examined...",
    "keywords": ["diabetes", "CGM"],
    "enable_discovery": true
  }'

# Check job status
curl http://localhost:8001/api/conference/status/{job_id}

# Get generated materials
curl http://localhost:8001/api/conference/materials/{job_id}
```

## Workflow Stages

### 20.1 Conference Discovery

Finds relevant conferences based on:
- Research keywords
- Target regions/locations
- Upcoming submission deadlines

Output: `conference_candidates.json`

### 20.2 Guideline Extraction

Parses submission requirements:
- Abstract word limits
- Format requirements (structured/narrative)
- Required sections

Output: `conference_guidelines.json`

### 20.3 Material Generation

Creates submission materials:
- **Abstract**: Formatted per guidelines
- **Poster outline**: Key sections + figure placeholders
- **Slide outline**: Presentation structure

Output: `conference_materials.json`

### 20.4 Validation & Export

- PHI scan all outputs
- Validate word counts
- Generate submission bundle

Output: `conference_bundle.zip`

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/ros/conference/discover` | Find conferences |
| POST | `/api/ros/conference/guidelines` | Extract requirements |
| POST | `/api/ros/conference/generate` | Generate materials |
| POST | `/api/ros/conference/export` | Create bundle |
| GET | `/api/ros/conference/bundle/:id` | Download bundle |

## Demo Mode

In DEMO mode, uses pre-configured conference data:

```python
# Available demo conferences
- American Diabetes Association (ADA)
- EASD Annual Meeting
- Thyroid Association Conference
```

## PHI Governance

All generated materials are PHI-scanned before export:

- **DEMO**: Warnings logged
- **LIVE**: PHI = export blocked

## Troubleshooting

### "No conferences found"

1. Check keywords are relevant
2. Try broader search terms
3. In DEMO mode, use demo conferences

### "Guideline extraction failed"

1. Check conference URL is accessible
2. Try manual guideline entry
3. Check for rate limiting

### "Bundle validation failed"

1. Review PHI scan results
2. Check word counts
3. Verify all required sections present

## Testing

```bash
cd services/worker
pytest tests/unit/conference_prep/ -v

# Integration tests
pytest tests/integration/test_stage_20.py -v
```

## Output Structure

```
conference_prep/{run_id}/
├── conference_candidates.json
├── conference_guidelines.json
├── conference_materials.json
├── validation_report.json
├── provenance.json
└── conference_bundle.zip
```

## Related Documentation

- [services/worker/src/conference_prep/](../../services/worker/src/conference_prep/) - Implementation
- [STAGE_20_IMPLEMENTATION_PLAN.md](../../STAGE_20_IMPLEMENTATION_PLAN.md) - Design doc
- [packages/core/types/conference.ts](../../packages/core/types/conference.ts) - Type definitions
