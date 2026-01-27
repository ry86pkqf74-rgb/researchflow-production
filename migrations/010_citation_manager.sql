-- Migration: 010_citation_manager.sql
-- Track B Phase 14: Citation Manager (CSL)
--
-- Tables for citation management with CSL support

-- =============================================================================
-- Citations Table
-- =============================================================================
-- Stores citation metadata in CSL-JSON format for interoperability

CREATE TABLE IF NOT EXISTS citations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    -- Core CSL-JSON fields (mapped to CSL spec)
    csl_type VARCHAR(50) NOT NULL DEFAULT 'article-journal', -- CSL item type
    title TEXT NOT NULL,
    authors JSONB DEFAULT '[]', -- Array of {family, given, literal, suffix, etc.}
    issued JSONB, -- {date-parts: [[year, month, day]], literal: "string"}

    -- Publication info
    container_title TEXT, -- Journal/book title
    volume VARCHAR(50),
    issue VARCHAR(50),
    page VARCHAR(100), -- Page range
    publisher TEXT,
    publisher_place TEXT,

    -- Identifiers
    doi VARCHAR(255),
    pmid VARCHAR(50),
    pmcid VARCHAR(50),
    isbn VARCHAR(50),
    issn VARCHAR(50),
    arxiv_id VARCHAR(100),
    url TEXT,

    -- Abstract and notes
    abstract TEXT,
    note TEXT,

    -- Link to paper in library (optional)
    paper_id UUID REFERENCES papers(id) ON DELETE SET NULL,

    -- Full CSL-JSON blob for any additional fields
    csl_json JSONB NOT NULL DEFAULT '{}',

    -- Source of citation data
    source VARCHAR(50) DEFAULT 'manual', -- manual, crossref, pubmed, doi, bibtex
    source_id VARCHAR(255), -- ID from source system

    -- Organization
    is_favorite BOOLEAN DEFAULT FALSE,
    is_archived BOOLEAN DEFAULT FALSE,

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for citations
CREATE INDEX IF NOT EXISTS idx_citations_user ON citations(user_id);
CREATE INDEX IF NOT EXISTS idx_citations_doi ON citations(doi);
CREATE INDEX IF NOT EXISTS idx_citations_pmid ON citations(pmid);
CREATE INDEX IF NOT EXISTS idx_citations_paper ON citations(paper_id);
CREATE INDEX IF NOT EXISTS idx_citations_type ON citations(csl_type);
CREATE INDEX IF NOT EXISTS idx_citations_created ON citations(user_id, created_at DESC);

-- Full-text search on citations
CREATE INDEX IF NOT EXISTS idx_citations_fts ON citations
USING gin(to_tsvector('english', COALESCE(title, '') || ' ' || COALESCE(abstract, '')));

-- =============================================================================
-- Citation Groups/Projects
-- =============================================================================
-- Group citations by project, paper, or manuscript

CREATE TABLE IF NOT EXISTS citation_groups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(200) NOT NULL,
    description TEXT,
    color VARCHAR(20) DEFAULT 'blue',

    -- Link to manuscript (optional)
    manuscript_id UUID REFERENCES manuscripts(id) ON DELETE SET NULL,

    -- Link to collection (optional)
    collection_id UUID REFERENCES collections(id) ON DELETE SET NULL,

    sort_order INTEGER DEFAULT 0,
    is_default BOOLEAN DEFAULT FALSE,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_citation_groups_user ON citation_groups(user_id);
CREATE INDEX IF NOT EXISTS idx_citation_groups_manuscript ON citation_groups(manuscript_id);

-- =============================================================================
-- Citation Group Members
-- =============================================================================

CREATE TABLE IF NOT EXISTS citation_group_members (
    group_id UUID NOT NULL REFERENCES citation_groups(id) ON DELETE CASCADE,
    citation_id UUID NOT NULL REFERENCES citations(id) ON DELETE CASCADE,
    sort_order INTEGER DEFAULT 0,
    citation_key VARCHAR(100), -- e.g., "Smith2024" for in-text citations
    added_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (group_id, citation_id)
);

CREATE INDEX IF NOT EXISTS idx_cgm_citation ON citation_group_members(citation_id);

-- =============================================================================
-- Citation Styles (CSL)
-- =============================================================================
-- Store custom and commonly-used citation styles

CREATE TABLE IF NOT EXISTS citation_styles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id VARCHAR(255) REFERENCES users(id) ON DELETE CASCADE, -- NULL for system styles

    name VARCHAR(200) NOT NULL,
    short_name VARCHAR(100), -- e.g., "APA", "MLA", "Chicago"
    description TEXT,

    -- The actual CSL XML content
    csl_xml TEXT NOT NULL,

    -- Source info
    csl_id VARCHAR(255), -- ID from CSL style repository
    csl_version VARCHAR(20) DEFAULT '1.0.2',
    source_url TEXT,

    -- Metadata
    category VARCHAR(50), -- author-date, numeric, note, label
    fields JSONB DEFAULT '[]', -- Fields this style supports

    is_system BOOLEAN DEFAULT FALSE, -- Built-in style
    is_default BOOLEAN DEFAULT FALSE, -- User's default style

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_citation_styles_user ON citation_styles(user_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_citation_styles_csl_id ON citation_styles(csl_id) WHERE csl_id IS NOT NULL;

-- =============================================================================
-- Citation Formatted Cache
-- =============================================================================
-- Cache formatted citations to avoid re-processing

CREATE TABLE IF NOT EXISTS citation_formatted (
    citation_id UUID NOT NULL REFERENCES citations(id) ON DELETE CASCADE,
    style_id UUID NOT NULL REFERENCES citation_styles(id) ON DELETE CASCADE,

    -- Formatted outputs
    bibliography TEXT, -- Full bibliography entry
    in_text TEXT, -- In-text citation (e.g., "(Smith, 2024)")
    in_text_short TEXT, -- Short form (e.g., "(Smith)")
    note TEXT, -- Footnote/endnote format

    -- Metadata
    csl_json_hash VARCHAR(64), -- Hash of source CSL-JSON to detect changes

    created_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (citation_id, style_id)
);

-- =============================================================================
-- Insert default citation styles
-- =============================================================================

INSERT INTO citation_styles (id, name, short_name, description, csl_xml, csl_id, category, is_system, is_default)
VALUES
(
    gen_random_uuid(),
    'American Psychological Association 7th edition',
    'APA',
    'APA 7th edition style for psychology, education, and social sciences',
    '<!-- APA 7th CSL will be loaded from official repository -->',
    'apa',
    'author-date',
    TRUE,
    TRUE
),
(
    gen_random_uuid(),
    'Modern Language Association 9th edition',
    'MLA',
    'MLA 9th edition style for humanities',
    '<!-- MLA 9th CSL will be loaded from official repository -->',
    'modern-language-association',
    'author-date',
    TRUE,
    FALSE
),
(
    gen_random_uuid(),
    'Chicago Manual of Style 17th edition (author-date)',
    'Chicago',
    'Chicago author-date style for sciences',
    '<!-- Chicago CSL will be loaded from official repository -->',
    'chicago-author-date',
    'author-date',
    TRUE,
    FALSE
),
(
    gen_random_uuid(),
    'IEEE',
    'IEEE',
    'IEEE style for engineering and computer science',
    '<!-- IEEE CSL will be loaded from official repository -->',
    'ieee',
    'numeric',
    TRUE,
    FALSE
),
(
    gen_random_uuid(),
    'Vancouver',
    'Vancouver',
    'Vancouver style for biomedical journals',
    '<!-- Vancouver CSL will be loaded from official repository -->',
    'vancouver',
    'numeric',
    TRUE,
    FALSE
),
(
    gen_random_uuid(),
    'Nature',
    'Nature',
    'Nature journal citation style',
    '<!-- Nature CSL will be loaded from official repository -->',
    'nature',
    'numeric',
    TRUE,
    FALSE
),
(
    gen_random_uuid(),
    'Harvard Reference format 1',
    'Harvard',
    'Harvard referencing style',
    '<!-- Harvard CSL will be loaded from official repository -->',
    'harvard-cite-them-right',
    'author-date',
    TRUE,
    FALSE
)
ON CONFLICT DO NOTHING;

-- =============================================================================
-- BibTeX Import History
-- =============================================================================
-- Track imported BibTeX files

CREATE TABLE IF NOT EXISTS bibtex_imports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    filename VARCHAR(500),
    file_content TEXT, -- Original BibTeX content
    file_hash VARCHAR(64), -- For deduplication

    entries_count INTEGER DEFAULT 0,
    imported_count INTEGER DEFAULT 0,
    skipped_count INTEGER DEFAULT 0,
    error_count INTEGER DEFAULT 0,

    status VARCHAR(20) DEFAULT 'pending', -- pending, processing, completed, error
    error_message TEXT,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_bibtex_imports_user ON bibtex_imports(user_id);

-- =============================================================================
-- Triggers
-- =============================================================================

-- Update timestamp trigger for citations
CREATE OR REPLACE FUNCTION update_citation_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_citations_updated ON citations;
CREATE TRIGGER trigger_citations_updated
    BEFORE UPDATE ON citations
    FOR EACH ROW
    EXECUTE FUNCTION update_citation_timestamp();

DROP TRIGGER IF EXISTS trigger_citation_groups_updated ON citation_groups;
CREATE TRIGGER trigger_citation_groups_updated
    BEFORE UPDATE ON citation_groups
    FOR EACH ROW
    EXECUTE FUNCTION update_citation_timestamp();

DROP TRIGGER IF EXISTS trigger_citation_styles_updated ON citation_styles;
CREATE TRIGGER trigger_citation_styles_updated
    BEFORE UPDATE ON citation_styles
    FOR EACH ROW
    EXECUTE FUNCTION update_citation_timestamp();
