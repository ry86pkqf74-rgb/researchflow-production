-- ============================================
-- Migration: Create Manuscript Tables
-- ResearchFlow Production
-- ============================================

BEGIN;

-- Manuscripts table
CREATE TABLE IF NOT EXISTS manuscripts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    project_id UUID,  -- Projects table may not exist yet
    title VARCHAR(500) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'draft',
    template_type VARCHAR(50) NOT NULL DEFAULT 'imrad',
    citation_style VARCHAR(20) NOT NULL DEFAULT 'AMA',
    target_journal VARCHAR(200),
    current_version_id UUID,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT chk_manuscript_status CHECK (status IN (
        'draft', 'in_review', 'revision_requested',
        'approved', 'submitted', 'published', 'archived'
    )),
    CONSTRAINT chk_template_type CHECK (template_type IN (
        'imrad', 'case_report', 'systematic_review',
        'meta_analysis', 'letter', 'editorial', 'review_article'
    ))
);

-- Manuscript versions (hash-chained)
CREATE TABLE IF NOT EXISTS manuscript_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    manuscript_id UUID NOT NULL REFERENCES manuscripts(id) ON DELETE CASCADE,
    version_number INTEGER NOT NULL,
    content JSONB NOT NULL DEFAULT '{}',
    data_snapshot_hash VARCHAR(64) NOT NULL,
    word_count INTEGER NOT NULL DEFAULT 0,
    change_description TEXT,
    previous_hash VARCHAR(64),
    current_hash VARCHAR(64) NOT NULL,
    created_by VARCHAR(255) NOT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(manuscript_id, version_number)
);

-- Add FK after versions table created
ALTER TABLE manuscripts
    ADD CONSTRAINT fk_current_version
    FOREIGN KEY (current_version_id)
    REFERENCES manuscript_versions(id)
    ON DELETE SET NULL;

-- Authors
CREATE TABLE IF NOT EXISTS manuscript_authors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    manuscript_id UUID NOT NULL REFERENCES manuscripts(id) ON DELETE CASCADE,
    user_id VARCHAR(255) REFERENCES users(id) ON DELETE SET NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    email VARCHAR(255) NOT NULL,
    orcid VARCHAR(19),
    affiliations TEXT[] DEFAULT '{}',
    is_corresponding BOOLEAN DEFAULT FALSE,
    order_index INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT chk_orcid_format CHECK (
        orcid IS NULL OR orcid ~ '^\d{4}-\d{4}-\d{4}-\d{3}[\dX]$'
    )
);

-- Citations
CREATE TABLE IF NOT EXISTS manuscript_citations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    manuscript_id UUID NOT NULL REFERENCES manuscripts(id) ON DELETE CASCADE,
    source_type VARCHAR(20) NOT NULL,
    external_id VARCHAR(100) NOT NULL,
    title TEXT NOT NULL,
    authors JSONB NOT NULL DEFAULT '[]',
    journal VARCHAR(500),
    year INTEGER NOT NULL,
    volume VARCHAR(50),
    issue VARCHAR(50),
    pages VARCHAR(50),
    doi VARCHAR(100),
    pmid VARCHAR(20),
    pmcid VARCHAR(20),
    url TEXT,
    abstract TEXT,
    keywords TEXT[] DEFAULT '{}',
    mesh_terms TEXT[] DEFAULT '{}',
    sections TEXT[] DEFAULT '{}',
    order_in_document INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(manuscript_id, source_type, external_id)
);

-- Audit log (hash-chained for immutability)
CREATE TABLE IF NOT EXISTS manuscript_audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    manuscript_id UUID NOT NULL REFERENCES manuscripts(id) ON DELETE CASCADE,
    action VARCHAR(100) NOT NULL,
    details JSONB NOT NULL DEFAULT '{}',
    user_id VARCHAR(255) NOT NULL REFERENCES users(id),
    timestamp TIMESTAMPTZ DEFAULT NOW(),
    previous_hash VARCHAR(64),
    current_hash VARCHAR(64) NOT NULL
);

-- Performance indexes
CREATE INDEX idx_manuscripts_user_id ON manuscripts(user_id);
CREATE INDEX idx_manuscripts_status ON manuscripts(status);
CREATE INDEX idx_manuscripts_project_id ON manuscripts(project_id) WHERE project_id IS NOT NULL;
CREATE INDEX idx_manuscript_versions_manuscript ON manuscript_versions(manuscript_id);
CREATE INDEX idx_manuscript_citations_manuscript ON manuscript_citations(manuscript_id);
CREATE INDEX idx_manuscript_citations_pmid ON manuscript_citations(pmid) WHERE pmid IS NOT NULL;
CREATE INDEX idx_manuscript_citations_doi ON manuscript_citations(doi) WHERE doi IS NOT NULL;
CREATE INDEX idx_manuscript_audit_manuscript ON manuscript_audit_log(manuscript_id);
CREATE INDEX idx_manuscript_audit_timestamp ON manuscript_audit_log(timestamp);

-- Auto-update timestamp trigger
CREATE OR REPLACE FUNCTION update_manuscript_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_manuscripts_updated
    BEFORE UPDATE ON manuscripts
    FOR EACH ROW EXECUTE FUNCTION update_manuscript_timestamp();

CREATE TRIGGER trg_manuscript_citations_updated
    BEFORE UPDATE ON manuscript_citations
    FOR EACH ROW EXECUTE FUNCTION update_manuscript_timestamp();

COMMIT;
