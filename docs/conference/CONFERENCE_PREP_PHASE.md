# Stage 20: Conference Preparation Phase

## Overview

The Conference Preparation Phase (Stage 20) enables researchers to discover relevant conferences, extract submission guidelines, and generate compliant materials for abstract/poster/oral submissions.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     Frontend (React)                            │
│  conference-readiness.tsx → API Client → React Query Mutations  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                   Orchestrator (Express)                        │
│  routes/conference.ts → PHI Validation → Worker Proxy           │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                     Worker (FastAPI)                            │
│  api_server.py → Conference Prep Modules → File Generation      │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                   Conference Prep Modules                       │
│  discovery.py │ guidelines.py │ generate_materials.py │ etc.   │
└─────────────────────────────────────────────────────────────────┘
```

## API Endpoints

### Discovery

**POST** `/api/ros/conference/discover`

Discover conferences matching search criteria.

```json
{
  "keywords": ["robotic", "surgery", "outcomes"],
  "yearRange": [2024, 2025],
  "formats": ["poster", "oral"],
  "locationPref": "US",
  "maxResults": 10,
  "mode": "DEMO"
}
```

Response:
```json
{
  "success": true,
  "data": {
    "conferences": [
      {
        "id": "sages-2025",
        "name": "Society of American Gastrointestinal and Endoscopic Surgeons",
        "abbreviation": "SAGES",
        "url": "https://www.sages.org",
        "typicalMonth": "March",
        "abstractDeadline": "2024-11-15",
        "formats": ["poster", "oral", "video", "quickshot"],
        "tags": ["surgery", "endoscopy", "minimally-invasive"],
        "score": 0.92,
        "scoreBreakdown": {
          "keyword": 0.35,
          "format": 0.25,
          "timing": 0.20,
          "location": 0.12
        },
        "matchExplanation": "Strong match for robotic surgery research"
      }
    ],
    "totalFound": 15,
    "queryMetadata": {
      "keywords": ["robotic", "surgery"],
      "mode": "DEMO",
      "timestamp": "2024-01-15T10:30:00Z"
    }
  }
}
```

### Guidelines Extraction

**POST** `/api/ros/conference/guidelines/extract`

Extract and sanitize conference submission guidelines.

```json
{
  "conferenceName": "SAGES",
  "conferenceUrl": "https://www.sages.org/abstract-guidelines",
  "formats": ["poster", "oral"],
  "mode": "DEMO"
}
```

Response:
```json
{
  "success": true,
  "data": {
    "conferenceName": "SAGES",
    "rawTextHash": "a1b2c3d4e5f6...",
    "extractedFields": {
      "abstractWordLimit": 300,
      "posterSize": "48x36 inches",
      "slideLimits": {
        "maxSlides": 10,
        "speakingTimeMinutes": 8
      },
      "acceptedFileTypes": ["pdf", "pptx"],
      "blindingRequired": true,
      "requiredSections": ["Background", "Methods", "Results", "Conclusions"]
    },
    "sanitizationApplied": true
  }
}
```

### Material Export

**POST** `/api/ros/conference/materials/export`

Generate conference submission materials and create downloadable bundle.

```json
{
  "researchId": "uuid-here",
  "conferenceName": "SAGES",
  "formats": ["poster", "oral"],
  "title": "Robotic Surgery Outcomes Study",
  "authors": ["Smith J", "Jones M"],
  "abstract": "Background: This study...",
  "sections": {
    "background": "...",
    "methods": "...",
    "results": "...",
    "conclusions": "..."
  },
  "blindingMode": false,
  "mode": "DEMO"
}
```

### Bundle Download

**GET** `/api/ros/conference/bundle/{run_id}/download`

Download the generated materials bundle as a ZIP file.

## Core Modules

### discovery.py

Ranks conferences based on keyword matching, format availability, timing, and location preferences.

```python
from src.conference_prep.discovery import discover_conferences, ConferenceDiscoveryInput

input_data = ConferenceDiscoveryInput(
    keywords=["surgery", "robotic"],
    max_results=5
)
result = discover_conferences(input_data)
```

### guidelines.py

Extracts submission guidelines with PHI/PII sanitization.

```python
from src.conference_prep.guidelines import extract_guidelines, GuidelineExtractionInput

input_data = GuidelineExtractionInput(
    conference_name="SAGES",
    formats=["poster"],
    mode="DEMO"
)
result = extract_guidelines(input_data)
```

### generate_materials.py

Generates PDF posters and PPTX presentations using reportlab and python-pptx.

### export_bundle.py

Creates ZIP bundles with manifest and provenance tracking.

### registry.py

Curated database of surgical/medical conferences with metadata.

### provenance.py

Hash chain integrity tracking for generated materials.

## PHI Safety

All text content is scanned and sanitized before processing:

- Email addresses → `[REDACTED_EMAIL]`
- Phone numbers → `[REDACTED_PHONE]`
- SSN patterns → `[REDACTED_SSN]`
- MRN patterns → `[REDACTED_MRN]`
- Date of birth patterns → `[REDACTED_DOB]`

The `sanitize_pii()` function applies all configured patterns from the canonical PHI registry.

## DEMO Mode

All endpoints support a `mode` parameter:

- `DEMO`: Returns fixture data without network calls (for testing/development)
- `LIVE`: Makes actual API calls and web scraping (production)

## Testing

Run Stage 20 unit tests:

```bash
cd services/worker
python -m pytest tests/unit/conference_prep/test_stage_20.py -v
```

Run with Docker:

```bash
docker-compose -f docker-compose.conference-test.yml up --build
```

## File Locations

| Component | Path |
|-----------|------|
| Python modules | `services/worker/src/conference_prep/` |
| FastAPI endpoints | `services/worker/api_server.py` |
| Orchestrator routes | `services/orchestrator/src/routes/conference.ts` |
| Frontend component | `services/web/src/components/ui/conference-readiness.tsx` |
| API client | `services/web/src/lib/api/conference.ts` |
| Unit tests | `tests/unit/conference_prep/test_stage_20.py` |

## Configuration

Environment variables:

```env
# Worker service
CONFERENCE_ARTIFACTS_PATH=/data/artifacts/conference
CONFERENCE_MODE=DEMO

# Orchestrator
WORKER_SERVICE_URL=http://localhost:8001
ARTIFACTS_PATH=/data/artifacts/conference
CONFERENCE_API_TIMEOUT=120000
```

## Workflow

1. **Discovery**: User enters keywords → system ranks matching conferences
2. **Selection**: User selects a conference from ranked results
3. **Guidelines**: System extracts and displays submission requirements
4. **Validation**: System validates research content against requirements
5. **Generation**: System generates PDF/PPTX materials
6. **Download**: User downloads materials bundle with provenance manifest
