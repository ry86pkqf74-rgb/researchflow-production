# Medical Integrations

This document describes the medical data integration modules for ResearchFlow,
enabling ingestion from clinical data sources and evidence-based validation.

## Overview

The medical integrations module provides:

1. **Clinical Data Ingestion** - REDCap and Epic FHIR connectors
2. **Evidence Validation** - PubMed-based claim validation
3. **Caching** - Redis caching with optional encryption
4. **Parallel Processing** - Ray-based distributed execution
5. **Imaging** - Optional DICOM/NIfTI support

---

## REDCap Integration

REDCap is commonly used in research settings for surgical case data collection.

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `REDCAP_API_URL` | Yes | REDCap API endpoint (e.g., `https://<redcap>/api/`) |
| `REDCAP_API_TOKEN` | Yes | Project-scoped API token |
| `REDCAP_TIMEOUT_S` | No | Request timeout (default: 60) |

### Permissions & Security

- API tokens are user+project scoped; **never log tokens**
- Prefer exporting de-identified datasets when feasible
- Token should have minimal required permissions

### Usage

```python
from data_ingestion.redcap.client import RedcapClient
from data_ingestion.redcap.mapper import redcap_record_to_case

# Initialize client
client = RedcapClient.from_env()

# Export records with filter
records = client.export_records(
    filter_logic='[service_line]="General Surgery"'
)

# Convert to normalized SurgicalCase objects
cases = [redcap_record_to_case(r) for r in records]
```

---

## Epic (SMART on FHIR Backend Services)

Epic integration uses the SMART Backend Services OAuth flow with JWT client assertion.

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `EPIC_FHIR_BASE_URL` | Yes | FHIR R4 base URL |
| `EPIC_TOKEN_URL` | Yes | OAuth token endpoint |
| `EPIC_CLIENT_ID` | Yes | Registered client ID |
| `EPIC_PRIVATE_KEY_PEM` | Yes | RSA private key (PEM format) |
| `EPIC_JWT_KID` | No | Key ID for key rotation |
| `EPIC_SCOPE` | No | OAuth scopes |
| `EPIC_TIMEOUT_S` | No | Request timeout (default: 60) |

### Registration Notes

- Backend OAuth apps require uploading a JWT public key
- Scopes and resource availability vary by Epic organization
- Contact your Epic administrator for configuration details

### Usage

```python
from data_ingestion.epic.fhir_client import EpicFHIRClient
from data_ingestion.epic.mapper import procedure_to_case

# Initialize client (handles token refresh automatically)
client = EpicFHIRClient.from_env()

# Search for procedures
bundle = client.search_procedures("patient-123", date="ge2024-01-01")

# Get operative notes
doc_refs = client.search_document_references("patient-123")
```

---

## Evidence Validation (PubMed / NCBI E-utilities)

Extracted assertions can be validated against PubMed evidence.

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `NCBI_API_KEY` | No | API key (increases rate limit to 10 req/sec) |
| `PUBMED_TIMEOUT_S` | No | Request timeout (default: 30) |
| `PUBMED_CACHE_TTL_S` | No | Cache TTL (default: 86400 = 24h) |

### Usage

```python
from medical_validation.pubmed_client import PubMedClient
from medical_validation.evidence_linker import EvidenceLinker

# Initialize
client = PubMedClient.from_env()
linker = EvidenceLinker(client)

# Find evidence for a surgical claim
result = linker.find_for_surgical_claim(
    procedure="laparoscopic cholecystectomy",
    topic="antibiotic prophylaxis",
    optional_keywords=["cefazolin", "single dose"]
)

print(f"Found {result.count} supporting articles")
for article in result.articles:
    print(f"  - {article['title']} ({article['year']})")
```

### Predefined Topics

The evidence linker supports these built-in topic templates:

- `antibiotics` - Antibiotic prophylaxis
- `eras` - Enhanced recovery protocols
- `vte` - VTE prophylaxis
- `drains` - Drain management
- `hemostasis` - Bleeding control
- `outcomes` - Surgical outcomes/complications

---

## Caching Policy

### Default Behavior

- **Do NOT cache PHI-bearing raw text** by default
- Cache PubMed queries and results (public data)
- Cache LLM extraction results only for de-identified inputs

### Enabling PHI-Safe Caching

If you must cache PHI-bearing content:

1. Set `CACHE_FERNET_KEY` with a valid Fernet key
2. Use short TTLs (e.g., 3600 seconds)
3. Ensure Redis is properly secured

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `REDIS_URL` | No | Redis URL (default: `redis://localhost:6379/0`) |
| `CACHE_TTL_S` | No | Default TTL (default: 86400) |
| `CACHE_PREFIX` | No | Key prefix (default: "worker") |
| `CACHE_FERNET_KEY` | No | Encryption key (enables PHI-safe caching) |

### Usage

```python
from cache.redis_cache import RedisCache, cached_extraction

cache = RedisCache.from_env()

# Manual caching
cache.set_json("my:key", {"data": "value"}, ttl_s=3600)
data = cache.get_json("my:key")

# Cached LLM extraction wrapper
result = cached_extraction(
    cache,
    llm.extract,
    operative_note_text,
    "gpt-4",
    ttl_s=604800  # 1 week
)
```

---

## Ray Execution Backend

For high-throughput chunk processing, enable Ray-based parallel execution.

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `EXECUTION_BACKEND` | No | `ray` or `local` (default: local) |
| `RAY_ADDRESS` | No | Ray cluster address |
| `RAY_NUM_ACTORS` | No | Number of actors (default: 8) |
| `RAY_MAX_IN_FLIGHT` | No | Max concurrent tasks (default: 64) |

### Usage

```python
from execution.ray_llm_executor import map_chunks

results = map_chunks(
    chunks,
    extract_fn=my_extract_function,
    context_builder=lambda i, c: {"chunk_index": i},
)
```

---

## Simulation Module (Optional)

Imaging I/O and volume rendering for surgical planning research.

### Requirements

```bash
pip install SimpleITK vtk numpy
```

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `ENABLE_SIMULATION` | No | Set to `1` to enable |

### Usage

```python
from simulation.imaging_io import load_volume, ImagingInput
from simulation.vtk_render import render_volume_to_png

# Load DICOM series
volume = load_volume(ImagingInput(dicom_dir="/path/to/dicom"))

# Render to PNG
render_volume_to_png(volume, "output.png")
```

---

## Docker Configuration

Add these environment variables to your `docker-compose.yml`:

```yaml
services:
  worker:
    environment:
      # REDCap
      - REDCAP_API_URL=${REDCAP_API_URL}
      - REDCAP_API_TOKEN=${REDCAP_API_TOKEN}
      
      # Epic FHIR
      - EPIC_FHIR_BASE_URL=${EPIC_FHIR_BASE_URL}
      - EPIC_TOKEN_URL=${EPIC_TOKEN_URL}
      - EPIC_CLIENT_ID=${EPIC_CLIENT_ID}
      - EPIC_PRIVATE_KEY_PEM=${EPIC_PRIVATE_KEY_PEM}
      
      # PubMed
      - NCBI_API_KEY=${NCBI_API_KEY}
      
      # Caching
      - REDIS_URL=redis://redis:6379/0
      - CACHE_FERNET_KEY=${CACHE_FERNET_KEY}
      
      # Execution
      - EXECUTION_BACKEND=local
```

---

## PHI Compliance Summary

| Component | PHI Risk | Mitigation |
|-----------|----------|------------|
| REDCap | High | Export de-identified data; secure token storage |
| Epic FHIR | High | Minimal scopes; audit logging; encryption |
| PubMed | None | Only search queries transmitted |
| Redis Cache | Medium | Use FERNET encryption; short TTLs |
| Ray | Low | Keep data in-memory; no persistence |
