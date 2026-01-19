# Phase C: Literature & Data Heterogeneity Deepening

## Overview

Phase C implements comprehensive literature retrieval, multi-format parsing, and data processing capabilities for the ResearchFlow platform.

## Completed Tasks (81-120)

### Literature API Clients (Tasks 81-84)

**Orchestrator Services:**
- `services/orchestrator/src/services/literature/pubmed.client.ts` - PubMed E-utilities API integration
- `services/orchestrator/src/services/literature/semantic_scholar.client.ts` - Semantic Scholar Graph API
- `services/orchestrator/src/services/literature/arxiv.client.ts` - arXiv Atom feed parsing
- `services/orchestrator/src/services/literature/clinicaltrials.client.ts` - ClinicalTrials.gov v2 API
- `services/orchestrator/src/services/literature/index.ts` - Client exports
- `services/orchestrator/src/routes/literature.ts` - Unified literature search routes

**Worker Modules:**
- `services/worker/src/literature/summarize_chain.py` - AI-powered paper summarization
- `services/worker/src/literature/matrix_builder.py` - Literature review matrix generation
- `services/worker/src/literature/relevance_ranker.py` - TF-IDF + embedding ranking
- `services/worker/src/literature/ris_import.py` - RIS/EndNote bibliography parsing
- `services/worker/src/literature/conflict_detector.py` - Conflict detection across sources

### Vector Indexing (Task 84)

- `services/worker/src/vector/literature_index.py` - Weaviate integration for semantic search
  - Paper ingestion with PHI guard
  - Hybrid search (BM25 + vector)
  - Similarity search

### Multi-Format Parsers (Tasks 85-91)

- `services/worker/src/parsers/registry.py` - Central parser registry
- `services/worker/src/parsers/parquet_parser.py` - Apache Parquet support
- `services/worker/src/parsers/hdf5_parser.py` - HDF5/NetCDF support
- `services/worker/src/parsers/pdf_parser.py` - PDF extraction via PyMuPDF
- `services/worker/src/parsers/jsonl_parser.py` - JSONL/NDJSON streaming
- `services/worker/src/parsers/zip_recursive.py` - Recursive ZIP extraction
- `services/worker/src/parsers/grobid_parser.py` - GROBID ML-based PDF parsing

### OCR Pipeline (Task 89)

- `services/worker/src/ocr/ocr_pipeline.py` - Tesseract OCR integration
  - Image text extraction
  - PDF page scanning
  - PHI guard on output

### NLP Entity Extraction (Task 90)

- `services/worker/src/nlp/entity_extractor.py` - spaCy entity extraction
  - Confidence scoring
  - PHI entity type filtering

### Keyword Extraction (Task 88)

- `services/worker/src/extraction/keyword_extractor.py` - RAKE/TF-IDF keyword extraction

### Data Profiling (Task 92)

- `services/worker/src/profiling/profile_report.py` - ydata-profiling integration
  - HTML/JSON report generation
  - Quality metrics

### Data Fusion (Task 94)

- `services/worker/src/fusion/fusion_engine.py` - Multi-source data fusion
  - Fuzzy key matching
  - Conflict resolution strategies
  - Audit trail

### Deduplication (Task 95)

- `services/worker/src/cleaning/dedup.py` - Deduplication with fuzzy matching
  - Exact matching
  - rapidfuzz similarity
  - Cluster reporting

### Data Lineage (Task 97)

- `services/worker/src/lineage/dependency_graph.py` - Dependency tracking
  - Mermaid diagram generation
  - JSON export
  - Graph validation

### Advanced Features (Tasks 101-115)

- `services/worker/src/transcription/whisper_stub.py` - Audio transcription (Whisper stub)
- `services/worker/src/versioning/data_versioner.py` - Dataset versioning
- `services/worker/src/image/detector.py` - OpenCV feature detection
- `services/worker/src/math/mathpix_stub.py` - Equation extraction (MathPix stub)
- `services/worker/src/i18n/language_detector.py` - Language detection
- `services/worker/src/i18n/translator.py` - Translation service stub
- `services/worker/src/queue/retry_queue.py` - Retry queue with exponential backoff
- `services/worker/src/geospatial/geo_utils.py` - Geographic utilities

## Dependencies Added

**Orchestrator (package.json):**
- `fast-xml-parser` - XML parsing for arXiv feeds

**Worker (requirements.txt should include):**
- `weaviate-client` - Vector database
- `rapidfuzz` - Fuzzy string matching
- `ydata-profiling` - Data profiling (optional)
- `pytesseract` - OCR (optional)
- `spacy` - NLP (optional)
- `langdetect` - Language detection

## Feature Flags

All new features respect governance modes and feature flags:

| Flag | Default | Description |
|------|---------|-------------|
| `ENABLE_OCR` | 0 | Enable Tesseract OCR |
| `ENABLE_PROFILING` | 0 | Enable data profiling |
| `ENABLE_GROBID` | 0 | Enable GROBID PDF parsing |
| `ENABLE_WHISPER` | 0 | Enable audio transcription |
| `ENABLE_OPENCV` | 0 | Enable image feature detection |
| `ENABLE_MATHPIX` | 0 | Enable equation extraction |
| `ENABLE_TRANSLATION` | 0 | Enable translation services |
| `ENABLE_GEOCODING` | 0 | Enable location geocoding |

## PHI Guard Integration

All new modules integrate with the PHI guard:
- Literature imports scan titles and abstracts
- OCR output is scanned before return
- NLP excludes PHI entity types by default
- Translations are scanned post-processing
- All operations respect `fail_closed` parameter

## API Routes Added

### Literature Routes (`/api/literature`)

- `POST /search` - Unified multi-source search
- `GET /pubmed/search` - PubMed search
- `GET /semantic-scholar/search` - Semantic Scholar search
- `GET /arxiv/search` - arXiv search
- `GET /clinicaltrials/search` - ClinicalTrials.gov search
- `GET /article/:source/:id` - Fetch specific article

## File Count

- **New TypeScript files:** 6
- **New Python files:** 24
- **Total new files:** 30

## Next Steps

1. Configure environment variables for enabled features
2. Install optional dependencies as needed
3. Set up Weaviate instance for vector search
4. Configure GROBID service for ML PDF parsing
5. Test literature search endpoints
