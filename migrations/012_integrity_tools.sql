-- Migration: 012_integrity_tools.sql
-- Track B Phase 16: Integrity Tools
--
-- Tables for research integrity verification

-- =============================================================================
-- Integrity Checks
-- =============================================================================
-- Track integrity verification runs on manuscripts

CREATE TABLE IF NOT EXISTS integrity_checks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    manuscript_id UUID NOT NULL REFERENCES manuscripts(id) ON DELETE CASCADE,

    -- Check type and status
    check_type VARCHAR(50) NOT NULL, -- plagiarism, statistics, citations, figures, data
    status VARCHAR(20) DEFAULT 'pending', -- pending, running, completed, failed

    -- Overall results
    overall_score DECIMAL(5,2), -- 0-100 integrity score
    risk_level VARCHAR(20), -- low, medium, high, critical
    issues_found INTEGER DEFAULT 0,
    warnings_found INTEGER DEFAULT 0,

    -- Detailed results (JSON)
    results JSONB DEFAULT '{}',
    recommendations JSONB DEFAULT '[]',

    -- Processing info
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    processing_time_ms INTEGER,

    -- Error handling
    error_code VARCHAR(50),
    error_message TEXT,

    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_integrity_checks_user ON integrity_checks(user_id);
CREATE INDEX IF NOT EXISTS idx_integrity_checks_manuscript ON integrity_checks(manuscript_id);
CREATE INDEX IF NOT EXISTS idx_integrity_checks_type ON integrity_checks(check_type);
CREATE INDEX IF NOT EXISTS idx_integrity_checks_status ON integrity_checks(status);

-- =============================================================================
-- Similarity Matches (Plagiarism Detection)
-- =============================================================================

CREATE TABLE IF NOT EXISTS similarity_matches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    check_id UUID NOT NULL REFERENCES integrity_checks(id) ON DELETE CASCADE,

    -- Source info
    source_type VARCHAR(50), -- paper, web, database, self
    source_title TEXT,
    source_authors TEXT,
    source_url TEXT,
    source_doi VARCHAR(255),

    -- Match details
    similarity_percent DECIMAL(5,2) NOT NULL,
    matched_text TEXT NOT NULL,
    original_text TEXT,

    -- Position in manuscript
    section VARCHAR(100),
    page_number INTEGER,
    paragraph_index INTEGER,
    char_start INTEGER,
    char_end INTEGER,

    -- Classification
    match_type VARCHAR(50), -- exact, paraphrase, self_citation, common_knowledge
    is_cited BOOLEAN DEFAULT FALSE,
    is_excluded BOOLEAN DEFAULT FALSE,
    exclusion_reason VARCHAR(100),

    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_similarity_matches_check ON similarity_matches(check_id);
CREATE INDEX IF NOT EXISTS idx_similarity_matches_percent ON similarity_matches(similarity_percent DESC);

-- =============================================================================
-- Statistical Verification
-- =============================================================================

CREATE TABLE IF NOT EXISTS statistical_verifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    check_id UUID NOT NULL REFERENCES integrity_checks(id) ON DELETE CASCADE,

    -- Statistic info
    statistic_type VARCHAR(50) NOT NULL, -- p_value, ci, effect_size, sample_size, test_statistic
    reported_value TEXT NOT NULL,
    computed_value TEXT,

    -- Position
    section VARCHAR(100),
    page_number INTEGER,
    context_text TEXT,

    -- Verification result
    is_consistent BOOLEAN,
    is_reportable BOOLEAN DEFAULT TRUE,
    discrepancy_type VARCHAR(50), -- rounding, calculation, impossible, suspicious
    discrepancy_details TEXT,

    -- GRIM/SPRITE tests
    grim_result BOOLEAN, -- Granularity-Related Inconsistency of Means
    sprite_result BOOLEAN, -- Sample Parameter Reconstruction via Iterative Techniques

    -- Confidence
    confidence_score DECIMAL(5,2),

    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_stat_verify_check ON statistical_verifications(check_id);
CREATE INDEX IF NOT EXISTS idx_stat_verify_type ON statistical_verifications(statistic_type);
CREATE INDEX IF NOT EXISTS idx_stat_verify_consistent ON statistical_verifications(is_consistent);

-- =============================================================================
-- Citation Verification
-- =============================================================================

CREATE TABLE IF NOT EXISTS citation_verifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    check_id UUID NOT NULL REFERENCES integrity_checks(id) ON DELETE CASCADE,

    -- Citation info
    citation_text TEXT NOT NULL,
    cited_authors TEXT,
    cited_year VARCHAR(10),
    cited_doi VARCHAR(255),

    -- Verification status
    is_found BOOLEAN,
    is_accessible BOOLEAN,
    is_retracted BOOLEAN DEFAULT FALSE,
    retraction_date DATE,
    retraction_reason TEXT,

    -- Content verification
    claim_text TEXT,
    supports_claim BOOLEAN,
    claim_verification_notes TEXT,

    -- Source details
    actual_title TEXT,
    actual_doi VARCHAR(255),
    actual_url TEXT,

    -- Issues
    issue_type VARCHAR(50), -- not_found, retracted, misquoted, wrong_citation, broken_link
    issue_details TEXT,

    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_citation_verify_check ON citation_verifications(check_id);
CREATE INDEX IF NOT EXISTS idx_citation_verify_retracted ON citation_verifications(is_retracted);

-- =============================================================================
-- Figure/Image Analysis
-- =============================================================================

CREATE TABLE IF NOT EXISTS image_verifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    check_id UUID NOT NULL REFERENCES integrity_checks(id) ON DELETE CASCADE,

    -- Image info
    image_label VARCHAR(100),
    image_path TEXT,
    image_type VARCHAR(50), -- figure, chart, gel, blot, microscopy, other

    -- Verification results
    manipulation_score DECIMAL(5,2), -- 0-100, likelihood of manipulation
    duplication_found BOOLEAN DEFAULT FALSE,
    duplication_details JSONB,

    -- Specific checks
    splicing_detected BOOLEAN,
    cloning_detected BOOLEAN,
    contrast_manipulation BOOLEAN,
    background_artifacts BOOLEAN,

    -- Metadata analysis
    metadata_issues JSONB DEFAULT '[]',
    exif_anomalies JSONB DEFAULT '[]',

    -- Comparison with other images
    similar_images JSONB DEFAULT '[]', -- Within same manuscript or database

    notes TEXT,

    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_image_verify_check ON image_verifications(check_id);
CREATE INDEX IF NOT EXISTS idx_image_verify_type ON image_verifications(image_type);

-- =============================================================================
-- Data Integrity Checks
-- =============================================================================

CREATE TABLE IF NOT EXISTS data_verifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    check_id UUID NOT NULL REFERENCES integrity_checks(id) ON DELETE CASCADE,

    -- Data source
    data_type VARCHAR(50), -- table, supplementary, raw, processed
    data_location TEXT,

    -- Checks performed
    benford_law_pass BOOLEAN, -- First digit distribution
    duplicates_found INTEGER DEFAULT 0,
    outliers_found INTEGER DEFAULT 0,
    impossible_values INTEGER DEFAULT 0,

    -- Detailed findings
    findings JSONB DEFAULT '[]',
    suspicious_patterns JSONB DEFAULT '[]',

    -- Summary
    risk_score DECIMAL(5,2),
    recommendation TEXT,

    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_data_verify_check ON data_verifications(check_id);

-- =============================================================================
-- Integrity Reports
-- =============================================================================
-- Generated reports summarizing integrity findings

CREATE TABLE IF NOT EXISTS integrity_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    manuscript_id UUID NOT NULL REFERENCES manuscripts(id) ON DELETE CASCADE,

    -- Report content
    report_type VARCHAR(50) DEFAULT 'full', -- full, summary, specific
    title VARCHAR(300),

    -- Checks included
    check_ids JSONB DEFAULT '[]', -- Array of integrity_check IDs

    -- Summary metrics
    overall_integrity_score DECIMAL(5,2),
    similarity_score DECIMAL(5,2),
    statistics_score DECIMAL(5,2),
    citations_score DECIMAL(5,2),
    figures_score DECIMAL(5,2),

    -- Content
    executive_summary TEXT,
    detailed_findings JSONB DEFAULT '{}',
    recommendations JSONB DEFAULT '[]',

    -- Export info
    pdf_path TEXT,
    generated_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_integrity_reports_user ON integrity_reports(user_id);
CREATE INDEX IF NOT EXISTS idx_integrity_reports_manuscript ON integrity_reports(manuscript_id);

-- =============================================================================
-- Retraction Watch Integration
-- =============================================================================
-- Cache of retracted papers for quick lookup

CREATE TABLE IF NOT EXISTS retracted_papers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Paper identifiers
    doi VARCHAR(255),
    pmid VARCHAR(50),
    title TEXT,
    authors TEXT,

    -- Retraction info
    retraction_date DATE,
    retraction_reason TEXT,
    retraction_notice_doi VARCHAR(255),
    retraction_notice_url TEXT,

    -- Original publication
    journal VARCHAR(300),
    publication_date DATE,

    -- Source
    data_source VARCHAR(50) DEFAULT 'retraction_watch',
    last_updated TIMESTAMPTZ DEFAULT NOW(),

    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_retracted_doi ON retracted_papers(doi) WHERE doi IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_retracted_pmid ON retracted_papers(pmid) WHERE pmid IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_retracted_date ON retracted_papers(retraction_date);

-- Full-text search
CREATE INDEX IF NOT EXISTS idx_retracted_fts ON retracted_papers
USING gin(to_tsvector('english', COALESCE(title, '') || ' ' || COALESCE(authors, '')));
