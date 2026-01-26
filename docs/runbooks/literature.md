# Literature Integration Runbook

## Overview

ResearchFlow's literature integration provides search across PubMed, Semantic Scholar, and arXiv with Redis caching, citation formatting, and reference library management.

## Prerequisites

- Node.js 20+
- Redis instance (for caching)
- Optional: NCBI API key (increases PubMed rate limits)
- Optional: Semantic Scholar API key

## Environment Variables

```bash
# Required
REDIS_URL=redis://localhost:6379

# Optional (recommended for production)
NCBI_API_KEY=your_ncbi_api_key
SEMANTIC_SCHOLAR_API_KEY=your_s2_api_key

# Cache TTL (seconds)
LITERATURE_CACHE_TTL=3600
```

## How to Run Locally

### 1. Start Redis

```bash
# Docker
docker run -d -p 6379:6379 redis:7-alpine

# Or native
redis-server
```

### 2. Start the Orchestrator

```bash
cd services/orchestrator
npm run dev
```

### 3. Test the Literature API

```bash
# Search PubMed
curl -X POST http://localhost:3001/api/literature/search \
  -H "Content-Type: application/json" \
  -d '{"query": "diabetes mellitus treatment", "providers": ["pubmed"], "limit": 10}'

# Search multiple providers
curl -X POST http://localhost:3001/api/literature/search \
  -H "Content-Type: application/json" \
  -d '{"query": "machine learning healthcare", "providers": ["pubmed", "semantic_scholar", "arxiv"], "limit": 5}'
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/literature/search` | Search literature sources |
| GET | `/api/literature/item/:id` | Get single item by ID |
| POST | `/api/literature/library` | Add to reference library |
| GET | `/api/literature/library` | List library items |
| DELETE | `/api/literature/library/:id` | Remove from library |
| POST | `/api/literature/format` | Format citation |

## Citation Formatting

Supported styles:
- APA (7th edition)
- Vancouver
- MLA
- Chicago
- IEEE
- Harvard
- Nature
- Science

```bash
curl -X POST http://localhost:3001/api/literature/format \
  -H "Content-Type: application/json" \
  -d '{
    "citation": {"id": "pubmed:12345", "title": "...", "authors": [...]},
    "style": "apa"
  }'
```

## Troubleshooting

### "Rate limited by PubMed"

1. Add `NCBI_API_KEY` to environment
2. Check Redis is running (caching reduces API calls)
3. Increase `LITERATURE_CACHE_TTL`

### "Semantic Scholar returns empty results"

1. Check API key is valid
2. Try different query terms
3. Check S2 API status: https://api.semanticscholar.org/api-docs/

### "Redis connection failed"

1. Verify `REDIS_URL` is correct
2. Check Redis is running: `redis-cli ping`
3. Check firewall rules

## Testing

```bash
# Unit tests
npm test -- --grep literature

# Integration tests
npm run test:integration -- --grep literature
```

## Related Documentation

- [packages/core/types/literature.ts](../../packages/core/types/literature.ts) - Type definitions
- [packages/manuscript-engine/src/services/pubmed.service.ts](../../packages/manuscript-engine/src/services/pubmed.service.ts) - PubMed implementation
- [services/orchestrator/src/routes/literature.ts](../../services/orchestrator/src/routes/literature.ts) - API routes
