-- ============================================
-- Migration: Paper Library (Track B Phase 10)
-- ResearchFlow Production
-- ============================================

BEGIN;

-- =============================================================================
-- Papers Table - Core paper/PDF records
-- =============================================================================

CREATE TABLE IF NOT EXISTS papers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    -- Metadata
    title VARCHAR(500) NOT NULL,
    authors JSONB DEFAULT '[]',  -- [{name, affiliation, orcid}]
    abstract TEXT,
    doi VARCHAR(100),
    pmid VARCHAR(20),
    pmcid VARCHAR(20),
    arxiv_id VARCHAR(50),
    year INTEGER,
    journal VARCHAR(300),
    volume VARCHAR(50),
    issue VARCHAR(50),
    pages VARCHAR(50),
    publisher VARCHAR(200),
    keywords TEXT[] DEFAULT '{}',
    mesh_terms TEXT[] DEFAULT '{}',

    -- File storage
    pdf_path VARCHAR(500),           -- Path to uploaded PDF
    thumbnail_path VARCHAR(500),      -- Preview thumbnail
    file_size_bytes BIGINT,
    file_hash VARCHAR(64),           -- SHA256 for deduplication

    -- Content analysis
    page_count INTEGER,
    word_count INTEGER,
    language VARCHAR(10) DEFAULT 'en',

    -- Processing status
    status VARCHAR(20) DEFAULT 'pending',  -- pending, processing, ready, error
    processing_error TEXT,

    -- User metadata
    read_status VARCHAR(20) DEFAULT 'unread',  -- unread, reading, read
    rating INTEGER,  -- 1-5 stars
    notes TEXT,

    -- Additional metadata
    metadata JSONB DEFAULT '{}',

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    -- Constraints
    CONSTRAINT chk_paper_status CHECK (status IN ('pending', 'processing', 'ready', 'error')),
    CONSTRAINT chk_paper_read_status CHECK (read_status IN ('unread', 'reading', 'read')),
    CONSTRAINT chk_paper_rating CHECK (rating IS NULL OR (rating >= 1 AND rating <= 5))
);

-- =============================================================================
-- Paper Tags - User-defined tags for organization
-- =============================================================================

CREATE TABLE IF NOT EXISTS paper_tags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    paper_id UUID NOT NULL REFERENCES papers(id) ON DELETE CASCADE,
    tag VARCHAR(100) NOT NULL,
    color VARCHAR(20) DEFAULT 'gray',
    created_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(paper_id, tag)
);

-- =============================================================================
-- Paper Full-Text Search - Extracted text for search
-- =============================================================================

CREATE TABLE IF NOT EXISTS paper_text_content (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    paper_id UUID NOT NULL REFERENCES papers(id) ON DELETE CASCADE,
    page_number INTEGER NOT NULL,
    text_content TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(paper_id, page_number)
);

-- =============================================================================
-- Indexes for Performance
-- =============================================================================

-- Papers indexes
CREATE INDEX idx_papers_user_id ON papers(user_id);
CREATE INDEX idx_papers_status ON papers(status);
CREATE INDEX idx_papers_doi ON papers(doi) WHERE doi IS NOT NULL;
CREATE INDEX idx_papers_pmid ON papers(pmid) WHERE pmid IS NOT NULL;
CREATE INDEX idx_papers_year ON papers(year) WHERE year IS NOT NULL;
CREATE INDEX idx_papers_file_hash ON papers(file_hash) WHERE file_hash IS NOT NULL;
CREATE INDEX idx_papers_created_at ON papers(created_at DESC);
CREATE INDEX idx_papers_read_status ON papers(read_status);

-- Full-text search on title and abstract
CREATE INDEX idx_papers_title_search ON papers USING gin(to_tsvector('english', title));
CREATE INDEX idx_papers_abstract_search ON papers USING gin(to_tsvector('english', abstract)) WHERE abstract IS NOT NULL;

-- Tags indexes
CREATE INDEX idx_paper_tags_paper_id ON paper_tags(paper_id);
CREATE INDEX idx_paper_tags_tag ON paper_tags(tag);

-- Text content indexes
CREATE INDEX idx_paper_text_paper_id ON paper_text_content(paper_id);
CREATE INDEX idx_paper_text_search ON paper_text_content USING gin(to_tsvector('english', text_content));

-- =============================================================================
-- Update Timestamp Trigger
-- =============================================================================

CREATE OR REPLACE FUNCTION update_paper_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_papers_updated
    BEFORE UPDATE ON papers
    FOR EACH ROW EXECUTE FUNCTION update_paper_timestamp();

COMMIT;
