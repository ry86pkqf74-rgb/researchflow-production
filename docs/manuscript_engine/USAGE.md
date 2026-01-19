# Manuscript Engine Usage Guide

## Overview

The Manuscript Engine provides AI-powered manuscript generation, real-time collaboration, and export capabilities with built-in PHI protection and governance controls.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                       Web UI (React)                         │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │ IMRaD Editor│  │ ArtifactPicker│  │ AI Co-drafter     │  │
│  │ (TipTap)    │  │              │  │                    │  │
│  └─────────────┘  └─────────────┘  └─────────────────────┘  │
└───────────────────────────┬─────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                  Orchestrator (Node.js)                      │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐   │
│  │ PHI Guard    │  │ Governance   │  │ Job Management   │   │
│  │              │  │ Gates        │  │                  │   │
│  └──────────────┘  └──────────────┘  └──────────────────┘   │
└───────────────────────────┬─────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                    Worker (Python)                           │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐   │
│  │ Section Gen  │  │ Claim Verify │  │ Export Pipeline  │   │
│  │              │  │              │  │ (Pandoc)         │   │
│  └──────────────┘  └──────────────┘  └──────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

## Services

### Starting Services

```bash
# Start all services
docker-compose up

# Or start individually
cd services/orchestrator && npm run dev
cd services/worker && python api_server.py
cd services/collab && npm run dev
cd services/web && npm run dev
```

## API Endpoints

### Manuscript Management

#### Create Manuscript
```bash
POST /api/manuscripts
Content-Type: application/json

{
  "title": "My Research Study",
  "mode": "DEMO"  # STANDBY | DEMO | LIVE
}
```

#### Generate Section
```bash
POST /api/manuscripts/{id}/sections/{sectionKey}/generate
Content-Type: application/json

{
  "inputs": {
    "litSummaryRefs": ["ref-123"],
    "dataMetadataRefs": ["dataset-456"]
  },
  "constraints": {
    "wordTarget": 500,
    "tone": "medical_surgical",
    "citationStyle": "vancouver"
  }
}
```

Supported sections: `TITLE`, `ABSTRACT`, `INTRODUCTION`, `METHODS`, `RESULTS`, `DISCUSSION`, `REFERENCES`

#### Commit Revision
```bash
POST /api/manuscripts/{id}/sections/{sectionKey}/commit
Content-Type: application/json

{
  "contentMd": "# Introduction\n\nYour content here...",
  "commitMessage": "Updated introduction with new findings"
}
```

#### Rollback to Revision
```bash
POST /api/manuscripts/{id}/sections/{sectionKey}/rollback
Content-Type: application/json

{
  "targetRevisionId": "revision-uuid"
}
```

### Export

#### Export Manuscript
```bash
POST /api/manuscripts/{id}/export
Content-Type: application/json

{
  "format": "docx",  # md | docx | pdf | latex_zip
  "journalStyleId": "nejm",
  "doubleBlind": true
}
```

#### Create Reproducibility Bundle
```bash
POST /api/manuscripts/{id}/repro-bundle
```

### Verification & Review

#### Verify Claims
```bash
POST /api/manuscripts/{id}/claims/verify
```

#### Simulate Peer Review
```bash
POST /api/manuscripts/{id}/peer-review
Content-Type: application/json

{
  "journalStyleId": "nejm"
}
```

### AI Co-drafting

```bash
POST /api/manuscripts/{id}/codraft
Content-Type: application/json

{
  "sectionKey": "DISCUSSION",
  "instruction": "expand",  # expand | clarify | simplify | cite | custom
  "selectedText": "The results suggest..."
}
```

### Translation

```bash
POST /api/manuscripts/{id}/translate
Content-Type: application/json

{
  "sectionKey": "ABSTRACT",
  "targetLanguage": "es"  # es, fr, de, pt, it, etc.
}
```

## Governance Modes

### STANDBY
- No external API calls allowed
- No exports permitted
- Internal editing only

### DEMO
- All features available
- Uses synthetic/demo data
- Auto-approved for exports

### LIVE
- Requires explicit approval for exports
- Requires approval for external API calls
- Full audit trail
- PHI scanning enforced

### Changing Governance Mode

```bash
PUT /api/manuscripts/{id}/governance/mode
Content-Type: application/json

{
  "mode": "LIVE"
}
```

### Requesting Approval (LIVE mode)

```bash
POST /api/manuscripts/{id}/approvals
Content-Type: application/json

{
  "action": "EXPORT",
  "reason": "Final submission to journal"
}
```

## PHI Protection

All content is scanned for PHI before:
- AI generation
- External API calls
- Exports
- Translation

If PHI is detected, the request is blocked and returns location-only information:

```json
{
  "error": "PHI_BLOCKED",
  "locations": [
    {
      "startOffset": 150,
      "endOffset": 165,
      "phiType": "SSN"
    }
  ]
}
```

## Real-time Collaboration

Connect to the collaboration server via WebSocket:

```javascript
import { HocuspocusProvider } from '@hocuspocus/provider';
import * as Y from 'yjs';

const ydoc = new Y.Doc();
const provider = new HocuspocusProvider({
  url: 'ws://localhost:1234',
  name: `${manuscriptId}:${sectionKey}`,
  document: ydoc,
});
```

## Journal Templates

Available templates:
- `nejm` - New England Journal of Medicine
- `jama` - JAMA
- `lancet` - The Lancet
- `bmj` - BMJ

Templates define:
- Required sections
- Word limits per section
- Citation style
- Double-blind support

## Audit Trail

View manuscript history:

```bash
GET /api/manuscripts/{id}/audit?limit=50&offset=0
```

Returns hash-chained events for tamper detection.

## Error Codes

| Code | Description |
|------|-------------|
| `PHI_BLOCKED` | PHI detected in content |
| `EXPORT_BLOCKED` | Export not allowed (governance) |
| `INVALID_SECTION` | Unknown section key |
| `REVISION_NOT_FOUND` | Target revision doesn't exist |
| `APPROVAL_REQUIRED` | LIVE mode requires approval |

## Environment Variables

```bash
# Orchestrator
GOVERNANCE_MODE=DEMO
WORKER_URL=http://worker:8000
DATABASE_URL=postgres://...

# Worker
ANTHROPIC_API_KEY=sk-...
OPENAI_API_KEY=sk-...
DEEPL_API_KEY=...
ARTIFACTS_PATH=/data/artifacts

# Collaboration
COLLAB_PORT=1234
```

## Testing

```bash
# Run unit tests
npm run test:unit

# Run E2E tests
npm run test:e2e

# Run governance tests
npm run test:governance
```

## Example: Full Manuscript Flow

```bash
# 1. Create manuscript
curl -X POST /api/manuscripts \
  -d '{"title": "My Study", "mode": "DEMO"}'

# 2. Generate introduction
curl -X POST /api/manuscripts/{id}/sections/INTRODUCTION/generate \
  -d '{"inputs": {"litSummaryRefs": ["ref-1"]}}'

# 3. Wait for job completion
curl /api/jobs/{jobId}

# 4. Commit the generated content
curl -X POST /api/manuscripts/{id}/sections/INTRODUCTION/commit \
  -d '{"contentMd": "...", "commitMessage": "AI-generated draft"}'

# 5. Run claim verification
curl -X POST /api/manuscripts/{id}/claims/verify

# 6. Export to DOCX
curl -X POST /api/manuscripts/{id}/export \
  -d '{"format": "docx", "journalStyleId": "nejm"}'
```
