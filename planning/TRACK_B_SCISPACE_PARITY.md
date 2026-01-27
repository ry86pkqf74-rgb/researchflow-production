# Track B: SciSpace Parity Implementation Plan

**Created**: January 27, 2026
**Status**: Phases 10-12 Complete, Phase 13 In Progress
**Predecessor**: Track A (Production) + Track M (Manuscript Studio)

---

## Overview

Track B brings ResearchFlow to feature parity with SciSpace-type research tools, adding:
- PDF management and reading
- AI-powered document analysis
- Literature organization
- Citation management
- Export capabilities
- Research integrity tools

---

## Phase Summary

| Phase | Feature | Priority | Est. Effort | Status |
|-------|---------|----------|-------------|--------|
| 10 | Paper Library & PDF Ingestion | P0 | 2 days | ✅ Complete |
| 11 | PDF Viewer with Annotations | P0 | 2 days | ✅ Complete |
| 12 | AI Copilot for PDFs | P1 | 3 days | ✅ Complete |
| 13 | Literature Review Workspace | P1 | 2 days | 🔄 Pending |
| 14 | Citation Manager (CSL) | P1 | 2 days | 🔄 Pending |
| 15 | Manuscript Export (Pandoc) | P2 | 1 day | 🔄 Pending |
| 16 | Integrity Tools | P2 | 2 days | 🔄 Pending |
| 17 | Ecosystem Integrations | P2 | 2 days | 🔄 Pending |

**Total Estimated**: 16 days

---

## Phase 10: Paper Library & PDF Ingestion

### Objective
Create a centralized library for uploaded/imported PDFs with metadata extraction.

### Backend Tasks
1. Create `papers` table migration
2. Create `/api/papers` CRUD routes
3. Implement PDF upload handling (multer)
4. Integrate pdf-parse for text extraction
5. Extract metadata (title, authors, abstract, DOI)
6. Store PDF in file system or S3-compatible storage

### Database Schema
```sql
CREATE TABLE papers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id VARCHAR(255) NOT NULL REFERENCES users(id),
    title VARCHAR(500) NOT NULL,
    authors JSONB DEFAULT '[]',
    abstract TEXT,
    doi VARCHAR(100),
    pmid VARCHAR(20),
    year INTEGER,
    journal VARCHAR(300),
    pdf_path VARCHAR(500),
    thumbnail_path VARCHAR(500),
    page_count INTEGER,
    word_count INTEGER,
    status VARCHAR(20) DEFAULT 'processing',
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE paper_tags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    paper_id UUID NOT NULL REFERENCES papers(id) ON DELETE CASCADE,
    tag VARCHAR(100) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### API Endpoints
- `POST /api/papers/upload` - Upload PDF
- `GET /api/papers` - List papers
- `GET /api/papers/:id` - Get paper details
- `DELETE /api/papers/:id` - Remove paper
- `POST /api/papers/:id/tags` - Add tags
- `GET /api/papers/search` - Full-text search

### Frontend Tasks
1. Create Paper Library page (`/papers`)
2. Upload dropzone component
3. Paper grid/list view
4. Search and filter UI
5. Tag management UI

---

## Phase 11: PDF Viewer with Annotations

### Objective
In-browser PDF viewing with highlighting and annotation capabilities.

### Backend Tasks
1. Create `paper_annotations` table
2. Create `/api/papers/:id/annotations` routes
3. Implement annotation CRUD
4. Store annotation positions (page, rect coordinates)

### Database Schema
```sql
CREATE TABLE paper_annotations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    paper_id UUID NOT NULL REFERENCES papers(id) ON DELETE CASCADE,
    user_id VARCHAR(255) NOT NULL REFERENCES users(id),
    page_number INTEGER NOT NULL,
    type VARCHAR(20) NOT NULL, -- highlight, note, underline
    color VARCHAR(20) DEFAULT 'yellow',
    rect JSONB NOT NULL, -- {x1, y1, x2, y2}
    text_content TEXT, -- Selected text
    note TEXT, -- User's note
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Frontend Tasks
1. Integrate react-pdf or pdf.js
2. Build annotation overlay layer
3. Highlight/underline tools
4. Note attachment UI
5. Annotation sidebar panel
6. Export annotations

---

## Phase 12: AI Copilot for PDFs

### Objective
Chat interface for asking questions about PDF content.

### Backend Tasks
1. Create `/api/papers/:id/chat` endpoint
2. Implement RAG pipeline:
   - Chunk PDF text
   - Generate embeddings (OpenAI or local)
   - Store in vector DB (pgvector)
   - Retrieve relevant chunks for context
3. Create `/api/papers/:id/summarize` endpoint
4. Create `/api/papers/:id/extract-claims` endpoint

### Database Schema
```sql
CREATE TABLE paper_chunks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    paper_id UUID NOT NULL REFERENCES papers(id) ON DELETE CASCADE,
    chunk_index INTEGER NOT NULL,
    page_number INTEGER,
    text_content TEXT NOT NULL,
    embedding vector(1536), -- OpenAI ada-002 dimension
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE paper_chat_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    paper_id UUID NOT NULL REFERENCES papers(id) ON DELETE CASCADE,
    user_id VARCHAR(255) NOT NULL REFERENCES users(id),
    role VARCHAR(20) NOT NULL, -- user, assistant
    content TEXT NOT NULL,
    context_chunks UUID[] DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### API Endpoints
- `POST /api/papers/:id/chat` - Send message, get AI response
- `GET /api/papers/:id/chat` - Get chat history
- `POST /api/papers/:id/summarize` - Generate summary
- `POST /api/papers/:id/extract-claims` - Extract key claims

### Frontend Tasks
1. Chat panel component
2. Message history display
3. Streaming response UI
4. Quick actions (summarize, extract claims)
5. Source citation display

---

## Phase 13: Literature Review Workspace

### Objective
Organized workspace for managing literature reviews with collections and notes.

### Backend Tasks
1. Create `collections` table
2. Create `collection_papers` junction table
3. Create `literature_notes` table
4. CRUD routes for collections

### Database Schema
```sql
CREATE TABLE collections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id VARCHAR(255) NOT NULL REFERENCES users(id),
    name VARCHAR(200) NOT NULL,
    description TEXT,
    color VARCHAR(20),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE collection_papers (
    collection_id UUID NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
    paper_id UUID NOT NULL REFERENCES papers(id) ON DELETE CASCADE,
    added_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (collection_id, paper_id)
);

CREATE TABLE literature_notes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id VARCHAR(255) NOT NULL REFERENCES users(id),
    collection_id UUID REFERENCES collections(id) ON DELETE SET NULL,
    paper_id UUID REFERENCES papers(id) ON DELETE SET NULL,
    title VARCHAR(300),
    content TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Frontend Tasks
1. Collections sidebar
2. Drag-and-drop paper organization
3. Literature notes editor
4. Collection sharing (future)
5. Export collection as bibliography

---

## Phase 14: Citation Manager (CSL)

### Objective
Import, organize, and format citations using Citation Style Language.

### Backend Tasks
1. Integrate citeproc-js or citation-js
2. Support CSL style selection (APA, AMA, Vancouver, etc.)
3. Create `/api/citations/format` endpoint
4. Import from BibTeX, RIS, PubMed

### API Endpoints
- `POST /api/citations/import` - Import from file
- `POST /api/citations/format` - Format citation(s)
- `GET /api/citations/styles` - List available CSL styles
- `POST /api/papers/:id/cite` - Get formatted citation

### Frontend Tasks
1. Citation format selector
2. Copy formatted citation button
3. Bibliography generator
4. Import modal (BibTeX, RIS, DOI lookup)

---

## Phase 15: Manuscript Export (Pandoc)

### Objective
Export manuscripts to various formats (DOCX, LaTeX, PDF).

### Backend Tasks
1. Install Pandoc in worker container
2. Create `/api/manuscripts/:id/export` endpoint
3. Support formats: DOCX, LaTeX, PDF, Markdown
4. Apply journal templates
5. Include formatted citations

### API Endpoints
- `POST /api/manuscripts/:id/export` - Generate export
  - Body: `{ format: "docx" | "latex" | "pdf", style: "ama" | "apa", template?: "nature" }`
- `GET /api/manuscripts/:id/export/:jobId` - Get export status/download

### Frontend Tasks
1. Export modal with format selection
2. Template selector
3. Download progress indicator
4. Preview before export

---

## Phase 16: Integrity Tools

### Objective
Tools for checking plagiarism, statistics, and reproducibility.

### Backend Tasks
1. Implement similarity checker (against uploaded papers)
2. Statistical result extractor
3. GRIM/SPRITE test integration
4. Create `/api/integrity` routes

### API Endpoints
- `POST /api/integrity/similarity` - Check text similarity
- `POST /api/integrity/statistics` - Validate statistical results
- `POST /api/integrity/reproduce` - Check reproducibility markers

### Frontend Tasks
1. Integrity dashboard
2. Similarity report display
3. Statistical validation UI
4. Reproducibility checklist

---

## Phase 17: Ecosystem Integrations

### Objective
Connect with external services (Zotero, Mendeley, CrossRef, ORCID).

### Backend Tasks
1. Zotero API integration (sync library)
2. Mendeley OAuth flow
3. CrossRef DOI lookup
4. ORCID profile import
5. Semantic Scholar API

### API Endpoints
- `POST /api/integrations/zotero/connect`
- `POST /api/integrations/zotero/sync`
- `POST /api/integrations/mendeley/connect`
- `GET /api/integrations/crossref/lookup/:doi`
- `GET /api/integrations/orcid/:orcid/works`

### Frontend Tasks
1. Integrations settings page
2. OAuth flow handling
3. Sync status display
4. Import from connected services

---

## Implementation Order

### Week 1: Foundation (Phases 10-11)
- Day 1-2: Paper Library backend + frontend
- Day 3-4: PDF Viewer + basic annotations

### Week 2: AI Features (Phases 12-13)
- Day 5-7: AI Copilot (RAG pipeline, chat UI)
- Day 8-9: Literature Review workspace

### Week 3: Citations & Export (Phases 14-15)
- Day 10-11: Citation Manager
- Day 12: Manuscript Export

### Week 4: Polish (Phases 16-17)
- Day 13-14: Integrity Tools
- Day 15-16: Ecosystem Integrations

---

## Dependencies

### NPM Packages to Add
- `pdf-parse` - PDF text extraction
- `react-pdf` or `pdfjs-dist` - PDF rendering
- `citation-js` - Citation formatting
- `pgvector` - Vector similarity search

### Python Packages (Worker)
- `PyMuPDF` (fitz) - PDF manipulation
- `sentence-transformers` - Local embeddings (optional)

### System Dependencies
- Pandoc - Document conversion

---

## Success Criteria

| Phase | Verification |
|-------|--------------|
| 10 | Upload PDF → appears in library with extracted metadata |
| 11 | Open PDF → view pages, create highlight, see annotation saved |
| 12 | Ask question about PDF → get relevant AI response with citations |
| 13 | Create collection → add papers → view organized workspace |
| 14 | Select citation style → get properly formatted citation |
| 15 | Export manuscript → download valid DOCX/PDF with citations |
| 16 | Run integrity check → see similarity report |
| 17 | Connect Zotero → see imported papers |

---

**Ready to begin Phase 10: Paper Library & PDF Ingestion**
