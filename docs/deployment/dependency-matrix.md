# ResearchFlow Dependency Matrix

This document maps features to their required dependencies, system packages, and configuration.

## Feature → Dependency Matrix

| Feature | Python Packages | System Packages | Environment Variables | Service Dependencies |
|---------|-----------------|-----------------|----------------------|---------------------|
| **PDF Export** | reportlab, PyMuPDF | pandoc, texlive-*, wkhtmltopdf | ARTIFACT_PATH | - |
| **DOCX Export** | python-pptx, python-docx | pandoc | ARTIFACT_PATH | - |
| **PHI Detection** | presidio-analyzer, presidio-anonymizer, spacy | - | PHI_SCAN_ENABLED, PHI_FAIL_CLOSED | en_core_web_sm model |
| **Statistical Analysis** | scipy, statsmodels, lifelines, scikit-learn | - | - | - |
| **Data Ingestion** | pandas, pandera, openpyxl, xlrd | - | DATA_PARSE_STRICT | - |
| **Multi-File Merge** | fuzzywuzzy, python-Levenshtein, polars, duckdb | - | - | - |
| **Large Data Processing** | dask, pyarrow | - | DASK_ENABLED | - |
| **Version Control** | pygit2 | git, libgit2 | PROJECTS_PATH | - |
| **Literature Search** | aiohttp, beautifulsoup4 | - | NCBI_API_KEY, SEMANTIC_SCHOLAR_API_KEY | orchestrator |
| **AI/LLM Integration** | httpx, openai, anthropic | - | OPENAI_API_KEY, ANTHROPIC_API_KEY, AI_ROUTER_URL | orchestrator |
| **Chat Agents** | - | - | CHAT_AGENT_ENABLED, CHAT_AGENT_MODEL | orchestrator |
| **Real-time Collaboration** | - | - | REDIS_URL | redis, collab |
| **Guideline Engine** | - | - | GUIDELINE_ENGINE_URL | guideline-engine |

## Service → Port Matrix

| Service | Internal Port | Dev Exposed | Prod Exposed | Health Endpoint |
|---------|---------------|-------------|--------------|-----------------|
| orchestrator | 3001 | 3001 | - (nginx) | GET /health |
| worker | 8000 | 8000 | - | GET /health |
| web | 80 | 5173 | 80/443 (nginx) | GET /health |
| collab | 1234/1235 | 1234/1235 | - (nginx) | GET :1235/health |
| guideline-engine | 8001 | 8001 | - | GET /health |
| postgres | 5432 | - | - | pg_isready |
| redis | 6379 | 6379 | - | redis-cli ping |
| nginx | 80/443 | - | 80/443 | GET /health |

## Docker Stage → Target Matrix

| Service | Development Target | Production Target | Base Image |
|---------|-------------------|-------------------|------------|
| orchestrator | development | production | node:20-alpine |
| worker | development | production | python:3.11-slim |
| web | development | production | node:20-alpine → nginx:alpine |
| collab | development | production | node:20-alpine |
| guideline-engine | - | - | python:3.11-slim |

## System Package Purpose

| Package | Purpose | Required For |
|---------|---------|--------------|
| pandoc | Document conversion | PDF/DOCX export |
| texlive-latex-base | LaTeX rendering | PDF generation |
| texlive-fonts-recommended | Standard fonts | PDF quality |
| texlive-latex-extra | Extended LaTeX | Complex documents |
| wkhtmltopdf | HTML to PDF | Report generation |
| fonts-liberation | Microsoft-compatible fonts | Document compatibility |
| fonts-dejavu-core | Unicode fonts | International text |
| libgit2 | Git library | Version control |
| libpq | PostgreSQL client | Database connection |

## Python Model Downloads

| Model | Package | Download Command | Purpose |
|-------|---------|-----------------|---------|
| en_core_web_sm | spacy | `python -m spacy download en_core_web_sm` | PHI detection NER |

## Volume Mounts

| Volume | Container Path | Purpose |
|--------|---------------|---------|
| shared-data | /data | Artifacts, logs, manifests |
| projects-data | /data/projects | Git repositories |
| postgres-data | /var/lib/postgresql/data | Database storage |
| redis-data | /data | Redis persistence |

## Network Configuration

| Network | Driver | Services |
|---------|--------|----------|
| researchflow | bridge | All services |

## Health Check Configuration

| Service | Interval | Timeout | Retries | Start Period |
|---------|----------|---------|---------|--------------|
| orchestrator | 30s | 10s | 3 | 40s |
| worker | 30s | 10s | 3 | 40s |
| web | 30s | 10s | 3 | 10s |
| collab | 30s | 10s | 3 | 10s |
| guideline-engine | 30s | 10s | 3 | 10s |
| postgres | 10s | 5s | 5 | 15s |
| redis | 10s | 5s | 5 | 5s |

## Troubleshooting Quick Reference

| Symptom | Likely Cause | Solution |
|---------|--------------|----------|
| PDF export fails | Missing texlive/pandoc | Rebuild worker with export packages |
| PHI scan errors | Missing spacy model | Ensure `spacy download en_core_web_sm` in Dockerfile |
| Literature search fails | Missing API keys | Set NCBI_API_KEY, SEMANTIC_SCHOLAR_API_KEY |
| Feature works in dev, fails in prod | Missing env vars | Compare docker-compose.yml with docker-compose.prod.yml |
| Version control fails | Missing libgit2 | Ensure libgit2-dev (build) and libgit2-1.1 (runtime) installed |
| Guideline engine unavailable | Service not in prod compose | Add guideline-engine service to docker-compose.prod.yml |
