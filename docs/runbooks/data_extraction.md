# Data Extraction Runbook

**Version**: 1.0.0  
**Last Updated**: January 23, 2026  
**Owner**: ResearchFlow Canvas Team

---

## Overview

The Data Extraction system converts unstructured clinical text into structured, queryable data using LLM-powered extraction. All AI calls are routed through the governance-compliant AI Router, ensuring PHI protection and audit trails.

### Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Web Client    │────▶│   ros-backend   │────▶│   api-node      │
│   (React)       │     │   (FastAPI)     │     │   (AI Router)   │
└─────────────────┘     └─────────────────┘     └─────────────────┘
                               │                        │
                               │                        ▼
                               │                ┌─────────────────┐
                               │                │   LLM Providers │
                               │                │ (Anthropic, etc)│
                               │                └─────────────────┘
                               │
                               ▼
                        ┌─────────────────┐
                        │   Orchestrator  │────▶ NLM E-utilities
                        │   (MeSH lookup) │      (MeSH enrichment)
                        └─────────────────┘
```

### Key Principles

1. **Worker never calls LLM providers directly** - All calls go through AI Router
2. **PHI scanning before every AI call** - Blocked if PHI detected
3. **Audit trail on every request** - Request IDs for tracing
4. **Fail closed** - Errors result in extraction failure, not partial/unsafe results

---

## Components

### 1. Extraction Module (`ros-backend/src/data_extraction/`)

| File | Purpose |
|------|---------|
| `schemas.py` | Pydantic models for extraction output |
| `extract_from_cells.py` | Main extraction logic with tier escalation |
| `nlm_enrichment.py` | MeSH term enrichment client |
| `prompts/` | Versioned prompt templates |

### 2. AI Router (`api-node/services/ai-router.service.ts`)

Routes LLM requests to appropriate providers based on tier:

| Tier | Model | Use Cases | Cost/MTok |
|------|-------|-----------|-----------|
| NANO | Claude Haiku | Classification, simple extraction | $0.25 in / $1.25 out |
| MINI | Claude Sonnet | Standard extraction | $3.00 in / $15.00 out |
| FRONTIER | Claude Opus | Complex reasoning, repairs | $15.00 in / $75.00 out |

### 3. MeSH Client (`api-node/services/mesh-client.service.ts`)

Handles NLM E-utilities integration for term enrichment.

---

## API Endpoints

### Extract Single Cell

```http
POST /api/extraction/extract
Content-Type: application/json

{
  "text": "Patient underwent laparoscopic cholecystectomy...",
  "metadata": {
    "file_id": "abc123",
    "column": "operative_note"
  },
  "force_tier": "MINI"  // Optional
}
```

**Response:**
```json
{
  "extraction": {
    "note_type": "operative_note",
    "diagnoses": [{"text": "acute cholecystitis", "mesh_id": "D041881"}],
    "procedures": [{"text": "laparoscopic cholecystectomy"}],
    "confidence": 0.85
  },
  "tier_used": "MINI",
  "cost_usd": 0.0045,
  "request_id": "ext_a1b2c3d4"
}
```

### Batch Extract

```http
POST /api/extraction/extract/batch
Content-Type: application/json

{
  "requests": [
    {"text": "...", "metadata": {}},
    {"text": "...", "metadata": {}}
  ],
  "concurrency": 5
}
```

### MeSH Enrichment

```http
POST /api/extraction/enrich
Content-Type: application/json

{
  "terms": ["cholecystitis", "laparoscopic cholecystectomy"],
  "include_synonyms": true,
  "max_results_per_term": 3
}
```

---

## Prompt Versions

Prompts are stored in `prompts/` for version control:

| Prompt | Version | Purpose |
|--------|---------|---------|
| `note_type_classify_v1.txt` | v1 | Note type classification (Pass A) |
| `clinical_note_extract_v1.txt` | v1 | Main extraction (Pass B) |
| `clinical_note_repair_json_v1.txt` | v1 | JSON repair for malformed output |

### Updating Prompts

1. Create new version file (e.g., `clinical_note_extract_v2.txt`)
2. Update reference in `extract_from_cells.py`
3. Test with representative samples
4. Deploy with A/B testing if possible
5. Archive old version (don't delete)

---

## Tier Escalation Policy

Extraction uses automatic tier escalation on failure:

```
NANO (classification)
    │
    ▼ failure
MINI (standard extraction)
    │
    ▼ failure
FRONTIER (complex/repair)
    │
    ▼ failure
Return partial result with warnings
```

**Escalation Triggers:**
- JSON validation failure
- Schema mismatch
- Timeout (>60s)
- Provider error (500, rate limit)

---

## Error Taxonomy

| Error Type | Code | Recovery |
|------------|------|----------|
| `PHI_BLOCKED` | 403 | Data must be sanitized first |
| `TIMEOUT` | 504 | Retry with FRONTIER tier |
| `INVALID_JSON` | 422 | Attempt JSON repair |
| `VALIDATION_ERROR` | 400 | Check input format |
| `RATE_LIMITED` | 429 | Exponential backoff |
| `PROVIDER_ERROR` | 502 | Try alternate provider |

---

## NLM/NCBI Setup

### Getting an API Key

1. Create NCBI account: https://www.ncbi.nlm.nih.gov/account/
2. Go to Settings → API Key Management
3. Click "Create an API Key"
4. Copy key to `.env` as `NCBI_API_KEY`

### Rate Limits

| Condition | Limit |
|-----------|-------|
| Without API key | 3 requests/second |
| With API key | 10 requests/second |
| Registered tool | Higher (by request) |

### E-utilities Used

- **ESearch**: Search MeSH database for UIDs
- **EFetch**: Retrieve descriptor details by UID

---

## Monitoring

### Key Metrics

- `extraction_requests_total` - Total extraction requests
- `extraction_tier_usage` - Requests by tier (NANO/MINI/FRONTIER)
- `extraction_cost_usd` - Cumulative cost in USD
- `extraction_latency_ms` - Request latency histogram
- `extraction_errors_total` - Errors by type

### Health Check

```http
GET /api/extraction/health

{
  "status": "healthy",
  "service": "extraction",
  "version": "1.0.0"
}
```

### Alerts

| Condition | Threshold | Action |
|-----------|-----------|--------|
| Error rate | >5% over 5min | Page on-call |
| Latency P99 | >30s | Investigate provider |
| Cost spike | >2x daily avg | Review usage patterns |
| MeSH cache miss | >80% | Check NLM connectivity |

---

## Troubleshooting

### Extraction returns low confidence

1. Check input text length (too short may lack context)
2. Review classified note type (misclassification affects extraction)
3. Try forcing higher tier with `force_tier: "FRONTIER"`
4. Check for unusual formatting in source text

### JSON validation failures

1. Check AI Router logs for raw LLM output
2. Look for markdown fences in response
3. Verify schema version matches expected
4. Try JSON repair endpoint directly

### MeSH enrichment failing

1. Verify `NCBI_API_KEY` is set
2. Check NLM service status: https://www.ncbi.nlm.nih.gov/Status/
3. Review rate limit headers in responses
4. Clear and rebuild MeSH cache

### PHI blocked errors

1. Verify dataset has passed PHI scan (Stage 3)
2. Check sanitization status (Stage 4 complete)
3. Review PHI findings in `/api/datasets/:id/phi-findings`

---

## Configuration

### Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `AI_ROUTER_URL` | Yes | - | URL to AI Router service |
| `ORCHESTRATOR_URL` | Yes | - | URL to Orchestrator service |
| `ANTHROPIC_API_KEY` | Yes | - | Anthropic API key |
| `OPENAI_API_KEY` | No | - | OpenAI API key (fallback) |
| `TOGETHER_API_KEY` | No | - | TogetherAI API key (batch) |
| `XAI_API_KEY` | No | - | xAI/Grok API key (fallback) |
| `NCBI_API_KEY` | Recommended | - | NCBI E-utilities API key |
| `EXTRACTION_TIMEOUT_SECONDS` | No | 60 | Request timeout |
| `ENRICHMENT_TIMEOUT_SECONDS` | No | 30 | MeSH lookup timeout |

### Feature Flags

- `ENABLE_TIER_ESCALATION` - Enable automatic tier escalation (default: true)
- `ENABLE_JSON_REPAIR` - Enable JSON repair attempts (default: true)
- `ENABLE_MESH_ENRICHMENT` - Enable MeSH term enrichment (default: true)
- `ENABLE_CLASSIFICATION_PASS` - Enable Pass A classification (default: true)

---

## Appendix: Output Schema

See `schemas.py` for full Pydantic definitions. Key fields:

```python
class ClinicalExtraction(BaseModel):
    note_type: Optional[NoteType]
    diagnoses: List[CodedTerm]
    procedures: List[CodedTerm]
    medications: List[MedicationEntry]
    outcomes: List[CodedTerm]
    complications: List[CodedTerm]
    ros_symptoms: List[CodedTerm]
    vital_signs: List[VitalSign]
    lab_results: List[LabResult]
    study_fields: Dict[str, Any]
    confidence: float  # 0.0 - 1.0
    warnings: List[str]
```
