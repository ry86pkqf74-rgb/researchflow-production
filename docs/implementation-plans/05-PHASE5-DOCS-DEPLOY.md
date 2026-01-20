# Phase 5: Documentation & Deployment

**Targets:**
- `docs/conference/`
- `docker-compose.conference-test.yml`
- `README.md`
- `INTEGRATION-ROADMAP.md`

**Estimated LOC:** ~400 lines

---

## Overview

Final phase covering documentation, deployment configuration, and CI/CD integration.

---

## File 1: Conference Prep Phase Documentation

Create `docs/conference/CONFERENCE_PREP_PHASE.md`:

```markdown
# Stage 20: Conference Preparation

## Overview

Stage 20 provides an end-to-end conference submission workflow within ResearchFlow, enabling researchers to:

1. **Discover** relevant conferences based on research keywords and preferences
2. **Extract** submission guidelines with automatic sanitization
3. **Generate** submission materials (PDF posters, PPTX slides)
4. **Export** a complete submission bundle with compliance verification

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Web Frontend                              │
│                  (React: conference-readiness.tsx)               │
└────────────────────────────┬────────────────────────────────────┘
                             │ HTTP
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                       Orchestrator (Node)                        │
│                    (routes/conference.ts)                        │
│  • Authentication & RBAC                                         │
│  • PHI gating before worker calls                               │
│  • Audit logging                                                 │
│  • File streaming for downloads                                  │
└────────────────────────────┬────────────────────────────────────┘
                             │ HTTP (internal)
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Worker (Python/FastAPI)                     │
│                   (conference_prep/ modules)                     │
│  • discovery.py - Conference ranking                            │
│  • guidelines.py - Extraction + sanitization                    │
│  • generate_materials.py - PDF/PPTX generation                  │
│  • export_bundle.py - ZIP bundling + manifest                   │
│  • provenance.py - Hash chain audit trail                       │
└─────────────────────────────────────────────────────────────────┘
                             │
                             ▼
                   /data/artifacts/conference/
```

## Operating Modes

### DEMO Mode (Default)
- Uses curated conference registry (13+ conferences)
- Returns fixture guidelines for known conferences
- No external network calls
- Safe for development and testing

### LIVE Mode
- Augments registry with external sources (future)
- Fetches actual guideline pages
- PHI-scans all outbound requests
- Requires network connectivity

## API Endpoints

### Discovery
```
POST /api/ros/conference/discover
```

**Request:**
```json
{
  "keywords": ["robotic", "surgery", "outcomes"],
  "yearRange": [2026, 2026],
  "formats": ["poster", "oral"],
  "locationPref": "US",
  "maxResults": 10,
  "mode": "DEMO"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "conferences": [
      {
        "id": "sages-2026",
        "name": "SAGES Annual Meeting",
        "abbreviation": "SAGES",
        "score": 0.92,
        "scoreBreakdown": {
          "keyword": 0.95,
          "format": 1.0,
          "timing": 0.85,
          "location": 0.90
        },
        "matchExplanation": "Excellent keyword match (robotic, surgery)..."
      }
    ],
    "totalFound": 8
  }
}
```

### Guideline Extraction
```
POST /api/ros/conference/guidelines/extract
```

**Request:**
```json
{
  "conferenceName": "SAGES",
  "conferenceUrl": "https://www.sages.org/meetings/",
  "formats": ["poster", "oral"],
  "mode": "DEMO"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "conferenceName": "SAGES",
    "rawTextHash": "a1b2c3d4e5f6...",
    "extractedFields": {
      "abstractWordLimit": 350,
      "posterSize": "48x36 inches",
      "acceptedFileTypes": ["pdf"],
      "blindingRequired": true,
      "requiredSections": ["Background", "Methods", "Results", "Conclusions"]
    },
    "sanitizationApplied": true
  }
}
```

### Full Export
```
POST /api/ros/conference/export
```

**Request:**
```json
{
  "researchId": "uuid-here",
  "conferenceName": "SAGES",
  "formats": ["poster"],
  "title": "Robotic Surgery Outcomes Study",
  "authors": ["John Doe", "Jane Smith"],
  "abstract": "Background: ...",
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

**Response:**
```json
{
  "success": true,
  "data": {
    "runId": "run-abc123",
    "materials": [
      {
        "filename": "poster.pdf",
        "format": "pdf",
        "size": 245678,
        "hash": "sha256:abc123..."
      }
    ],
    "bundleHash": "sha256:def456...",
    "downloadUrl": "/api/ros/conference/download/run-abc123/conference_bundle_run-abc123.zip",
    "checklist": [
      {"id": "1", "category": "content", "label": "Abstract word count", "status": "pass"}
    ]
  }
}
```

### File Download
```
GET /api/ros/conference/download/:runId/:filename
```

Returns the file with appropriate `Content-Type` header.

## PHI Safety Rules

1. **No PHI in keywords**: Discovery keywords are PHI-scanned before processing
2. **No PHI in content**: Abstract and sections are PHI-scanned before export
3. **Sanitized guidelines**: All extracted text is sanitized (emails, phones redacted)
4. **Hash-only findings**: PHI scan results contain only hashes and locations, never raw values
5. **Blinding mode**: Optional author/institution redaction for anonymous submissions

## Artifact Storage

All generated files are stored at:
```
/data/artifacts/conference/{run_id}/
├── abstract.md
├── poster.pdf (if poster format)
├── slides.pptx (if oral format)
├── symposium_deck.pptx (if symposium)
├── handout.pdf (if symposium)
├── checklist.json
├── guideline_summary.json
├── manifest.json
└── conference_bundle_{run_id}.zip
```

### Manifest Structure
```json
{
  "runId": "run-abc123",
  "createdAt": "2026-01-20T12:00:00Z",
  "files": [
    {
      "filename": "poster.pdf",
      "size": 245678,
      "hash": "sha256:abc123...",
      "mimeType": "application/pdf"
    }
  ],
  "toolVersions": {
    "reportlab": "4.2.0",
    "python-pptx": "1.0.2"
  }
}
```

## Curated Conference Registry

The following conferences are included in the built-in registry:

| Conference | Abbreviation | Typical Month | Formats |
|------------|--------------|---------------|---------|
| SAGES Annual Meeting | SAGES | Mar-Apr | poster, oral, video |
| ACS Clinical Congress | ACS | Oct | poster, oral, symposium |
| ASCRS Annual Meeting | ASCRS | May-Jun | poster, oral |
| ASMBS Annual Meeting | ASMBS | Oct-Nov | poster, oral |
| Society of American Gastrointestinal and Endoscopic Surgeons | SAGES | Mar | poster, oral |
| ... | ... | ... | ... |

## Running in DEMO Mode

```bash
# Start services
docker-compose -f docker-compose.conference-test.yml up

# Test discovery
curl -X POST http://localhost:3001/api/ros/conference/discover \
  -H "Content-Type: application/json" \
  -d '{"keywords": ["robotic"], "mode": "DEMO"}'
```

## Troubleshooting

### Common Issues

1. **"Worker service unavailable"**
   - Ensure worker is running on port 8001
   - Check `WORKER_SERVICE_URL` environment variable

2. **"PHI detected in content"**
   - Review content for patterns like SSN, email, phone
   - Use blinding mode if author names trigger false positives

3. **"File not found" on download**
   - Verify run_id is correct
   - Check artifacts directory permissions

4. **"Generation timeout"**
   - Increase `CONFERENCE_API_TIMEOUT` (default 2 minutes)
   - Check worker service logs for errors
```

---

## File 2: API Reference

Create `docs/conference/API_REFERENCE.md`:

```markdown
# Conference API Reference

## Base URL
```
/api/ros/conference
```

## Authentication
All endpoints require authentication via session cookie or Bearer token.

## Endpoints

### POST /discover
Discover conferences matching search criteria.

**Request Body:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| keywords | string[] | Yes | Search keywords |
| yearRange | [number, number] | No | Year range filter |
| formats | string[] | No | Desired formats |
| locationPref | string | No | Geographic preference |
| maxResults | number | No | Max results (1-50, default 10) |
| mode | "DEMO" \| "LIVE" | No | Operating mode (default DEMO) |

### POST /guidelines/extract
Extract submission guidelines from a conference.

**Request Body:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| conferenceName | string | Yes | Conference name |
| conferenceUrl | string | No | URL for live extraction |
| formats | string[] | No | Formats to extract |
| mode | "DEMO" \| "LIVE" | No | Operating mode |

### POST /export
Generate materials and create submission bundle.

**Request Body:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| researchId | string (uuid) | Yes | Research identifier |
| conferenceName | string | Yes | Target conference |
| formats | ("poster"\|"oral"\|"symposium")[] | Yes | Formats to generate |
| title | string | Yes | Submission title |
| authors | string[] | No | Author names |
| abstract | string | Yes | Abstract text |
| sections | object | Yes | Content sections |
| blindingMode | boolean | No | Redact author info |
| mode | "DEMO" \| "LIVE" | No | Operating mode |

### GET /download/:runId/:filename
Download a generated file.

**Path Parameters:**
| Parameter | Description |
|-----------|-------------|
| runId | Export run identifier |
| filename | File to download |

**Response Headers:**
- `Content-Type`: File MIME type
- `Content-Disposition`: `attachment; filename="..."`

### GET /export/:runId
Get status of a previous export.

**Response:**
```json
{
  "success": true,
  "data": {
    "runId": "...",
    "manifest": { ... },
    "downloadUrl": "..."
  }
}
```

## Error Responses

All error responses follow this format:
```json
{
  "success": false,
  "error": "Error message"
}
```

**Common Error Codes:**
- 400: Invalid request (validation error, path traversal)
- 401: Not authenticated
- 403: Insufficient permissions
- 404: Resource not found
- 500: Server error
```

---

## File 3: Docker Compose for Testing

Create `docker-compose.conference-test.yml`:

```yaml
version: '3.8'

services:
  worker:
    build:
      context: ./services/worker
      dockerfile: Dockerfile
      target: development
    ports:
      - "8001:8001"
    volumes:
      - ./services/worker:/app
      - conference-artifacts:/data/artifacts/conference
    environment:
      - PYTHONUNBUFFERED=1
      - ARTIFACTS_PATH=/data/artifacts/conference
      - LOG_LEVEL=DEBUG
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8001/health"]
      interval: 10s
      timeout: 5s
      retries: 3
    command: uvicorn api_server:app --host 0.0.0.0 --port 8001 --reload

  orchestrator:
    build:
      context: ./services/orchestrator
      dockerfile: Dockerfile
      target: development
    ports:
      - "3001:3001"
    volumes:
      - ./services/orchestrator:/app
      - conference-artifacts:/data/artifacts/conference
    environment:
      - NODE_ENV=development
      - WORKER_SERVICE_URL=http://worker:8001
      - ARTIFACTS_PATH=/data/artifacts/conference
      - CONFERENCE_API_TIMEOUT=120000
    depends_on:
      worker:
        condition: service_healthy
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3001/health"]
      interval: 10s
      timeout: 5s
      retries: 3

  web:
    build:
      context: ./services/web
      dockerfile: Dockerfile
      target: development
    ports:
      - "3000:3000"
    volumes:
      - ./services/web:/app
      - /app/node_modules
    environment:
      - NEXT_PUBLIC_API_URL=http://localhost:3001
    depends_on:
      - orchestrator

volumes:
  conference-artifacts:

networks:
  default:
    name: researchflow-conference-test
```

---

## File 4: README Update

Add to `README.md`:

```markdown
## Conference Preparation (Stage 20)

Stage 20 provides conference submission workflow capabilities:

### Quick Start

```bash
# Start conference test environment
docker-compose -f docker-compose.conference-test.yml up

# Access web UI
open http://localhost:3000

# Navigate to Stage 20: Conference Preparation
```

### DEMO Mode

Run without network calls using curated conference data:

```bash
curl -X POST http://localhost:3001/api/ros/conference/discover \
  -H "Content-Type: application/json" \
  -d '{
    "keywords": ["robotic", "surgery"],
    "maxResults": 5,
    "mode": "DEMO"
  }'
```

### Generate Materials

```bash
curl -X POST http://localhost:3001/api/ros/conference/export \
  -H "Content-Type: application/json" \
  -d '{
    "researchId": "test-123",
    "conferenceName": "SAGES",
    "formats": ["poster"],
    "title": "My Research",
    "abstract": "Background: ...",
    "sections": {
      "background": "...",
      "methods": "...",
      "results": "...",
      "conclusions": "..."
    },
    "mode": "DEMO"
  }'
```

### Documentation

- [Conference Prep Phase Guide](docs/conference/CONFERENCE_PREP_PHASE.md)
- [API Reference](docs/conference/API_REFERENCE.md)
```

---

## File 5: Roadmap Update

Add to `INTEGRATION-ROADMAP.md`:

```markdown
## Conference Module

### Milestone: Conference Module Beta (Q2 2026)

#### Completed ✅
- [x] Conference discovery with curated registry (13 conferences)
- [x] Guideline extraction with PII/PHI sanitization
- [x] PDF poster generation (reportlab)
- [x] PPTX slide generation (python-pptx)
- [x] ZIP bundle creation with manifest
- [x] Provenance tracking with hash chain
- [x] Stage 20 workflow configuration
- [x] TypeScript schemas and types
- [x] React UI component

#### In Progress 🔧
- [ ] Worker FastAPI endpoints
- [ ] Orchestrator proxy routes
- [ ] Frontend API integration
- [ ] Integration tests
- [ ] E2E Playwright tests

#### Planned 📋
- [ ] Live guideline web scraping
- [ ] AI-powered guideline summarization
- [ ] Conference recommendation ML model
- [ ] Multi-language support
- [ ] Direct submission platform integration
```

---

## File 6: GitHub Actions Workflow

Create `.github/workflows/conference-tests.yml`:

```yaml
name: Conference Module Tests

on:
  push:
    paths:
      - 'services/worker/src/conference_prep/**'
      - 'services/orchestrator/src/routes/conference.ts'
      - 'services/web/src/components/ui/conference-readiness.tsx'
      - 'packages/core/types/conference.ts'
  pull_request:
    paths:
      - 'services/worker/src/conference_prep/**'
      - 'services/orchestrator/src/routes/conference.ts'

jobs:
  worker-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Set up Python
        uses: actions/setup-python@v5
        with:
          python-version: '3.11'

      - name: Install dependencies
        run: |
          cd services/worker
          pip install -r requirements.txt
          pip install pytest pytest-asyncio

      - name: Run conference tests
        run: |
          cd services/worker
          pytest tests/test_conference_api.py -v

  orchestrator-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Set up Node
        uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Install dependencies
        run: npm ci

      - name: Run conference route tests
        run: npx vitest run tests/unit/orchestrator/conference-routes.test.ts

  e2e-tests:
    runs-on: ubuntu-latest
    needs: [worker-tests, orchestrator-tests]
    steps:
      - uses: actions/checkout@v4

      - name: Set up services
        run: docker-compose -f docker-compose.conference-test.yml up -d

      - name: Wait for services
        run: sleep 30

      - name: Install Playwright
        run: npx playwright install --with-deps

      - name: Run E2E tests
        run: npx playwright test tests/e2e/conference-workflow.spec.ts

      - name: Stop services
        run: docker-compose -f docker-compose.conference-test.yml down
```

---

## Verification Checklist

- [ ] All documentation files created
- [ ] Docker compose file works (`docker-compose -f docker-compose.conference-test.yml up`)
- [ ] README updated with conference section
- [ ] Roadmap updated with milestone
- [ ] GitHub Actions workflow triggers on relevant file changes

---

## Deployment Readiness

With all phases complete, the conference preparation module is ready for:

1. **Development testing** - Use docker-compose.conference-test.yml
2. **Staging deployment** - Standard Kubernetes deployment
3. **Production rollout** - Feature flag controlled

The DEMO mode ensures safe testing without external dependencies.
