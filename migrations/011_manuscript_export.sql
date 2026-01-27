-- Migration: 011_manuscript_export.sql
-- Track B Phase 15: Manuscript Export (Pandoc)
--
-- Tables for manuscript export with multiple format support

-- =============================================================================
-- Export Templates
-- =============================================================================
-- Define export templates for different journals/formats

CREATE TABLE IF NOT EXISTS export_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id VARCHAR(255) REFERENCES users(id) ON DELETE CASCADE, -- NULL for system templates

    name VARCHAR(200) NOT NULL,
    description TEXT,

    -- Output format
    output_format VARCHAR(50) NOT NULL, -- docx, pdf, latex, html, md, odt

    -- Template files (stored or referenced)
    template_type VARCHAR(50) DEFAULT 'builtin', -- builtin, custom, journal
    template_content TEXT, -- For custom Pandoc/LaTeX templates
    template_path VARCHAR(500), -- Path to template file

    -- Pandoc options
    pandoc_args JSONB DEFAULT '[]', -- Additional pandoc arguments

    -- Citation style
    citation_style_id UUID REFERENCES citation_styles(id),
    csl_name VARCHAR(100), -- Or CSL name if not in DB

    -- Journal-specific settings
    journal_name VARCHAR(200),
    journal_issn VARCHAR(50),
    journal_guidelines_url TEXT,

    -- Formatting options
    page_size VARCHAR(20) DEFAULT 'letter', -- letter, a4, custom
    margins JSONB DEFAULT '{"top": 1, "bottom": 1, "left": 1, "right": 1}',
    font_family VARCHAR(100) DEFAULT 'Times New Roman',
    font_size INTEGER DEFAULT 12,
    line_spacing DECIMAL(3,2) DEFAULT 2.0,

    -- Sections to include
    include_abstract BOOLEAN DEFAULT TRUE,
    include_keywords BOOLEAN DEFAULT TRUE,
    include_author_info BOOLEAN DEFAULT TRUE,
    include_acknowledgments BOOLEAN DEFAULT TRUE,
    include_references BOOLEAN DEFAULT TRUE,
    include_figures_tables BOOLEAN DEFAULT TRUE,
    include_supplementary BOOLEAN DEFAULT FALSE,

    -- Numbering options
    number_sections BOOLEAN DEFAULT TRUE,
    number_figures BOOLEAN DEFAULT TRUE,
    number_tables BOOLEAN DEFAULT TRUE,
    number_equations BOOLEAN DEFAULT FALSE,

    -- Metadata
    is_system BOOLEAN DEFAULT FALSE,
    is_default BOOLEAN DEFAULT FALSE,
    category VARCHAR(50), -- general, medical, engineering, humanities

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_export_templates_user ON export_templates(user_id);
CREATE INDEX IF NOT EXISTS idx_export_templates_format ON export_templates(output_format);

-- =============================================================================
-- Export Jobs
-- =============================================================================
-- Track export job history and status

CREATE TABLE IF NOT EXISTS export_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    manuscript_id UUID NOT NULL REFERENCES manuscripts(id) ON DELETE CASCADE,

    -- Template used
    template_id UUID REFERENCES export_templates(id) ON DELETE SET NULL,
    output_format VARCHAR(50) NOT NULL,

    -- Job status
    status VARCHAR(20) DEFAULT 'pending', -- pending, processing, completed, failed
    progress INTEGER DEFAULT 0, -- 0-100 percent

    -- Output files
    output_filename VARCHAR(500),
    output_path VARCHAR(1000),
    output_size_bytes BIGINT,
    output_url TEXT, -- Temporary download URL
    output_expires_at TIMESTAMPTZ,

    -- Export options used
    export_options JSONB DEFAULT '{}',

    -- Citation info
    citations_included INTEGER DEFAULT 0,
    citation_style VARCHAR(100),

    -- Processing info
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    processing_time_ms INTEGER,

    -- Error handling
    error_code VARCHAR(50),
    error_message TEXT,
    error_details JSONB,

    -- Pandoc version used
    pandoc_version VARCHAR(20),

    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_export_jobs_user ON export_jobs(user_id);
CREATE INDEX IF NOT EXISTS idx_export_jobs_manuscript ON export_jobs(manuscript_id);
CREATE INDEX IF NOT EXISTS idx_export_jobs_status ON export_jobs(status);
CREATE INDEX IF NOT EXISTS idx_export_jobs_created ON export_jobs(user_id, created_at DESC);

-- =============================================================================
-- Export Presets (User Saved Configurations)
-- =============================================================================

CREATE TABLE IF NOT EXISTS export_presets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    name VARCHAR(200) NOT NULL,
    description TEXT,

    -- Template to use
    template_id UUID REFERENCES export_templates(id) ON DELETE SET NULL,
    output_format VARCHAR(50) NOT NULL,

    -- Override options
    options_override JSONB DEFAULT '{}',

    -- Usage tracking
    use_count INTEGER DEFAULT 0,
    last_used_at TIMESTAMPTZ,

    is_default BOOLEAN DEFAULT FALSE,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_export_presets_user ON export_presets(user_id);

-- =============================================================================
-- Journal Submission Requirements
-- =============================================================================
-- Store submission guidelines for common journals

CREATE TABLE IF NOT EXISTS journal_requirements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Journal info
    journal_name VARCHAR(300) NOT NULL,
    journal_abbrev VARCHAR(100),
    issn VARCHAR(50),
    eissn VARCHAR(50),
    publisher VARCHAR(200),

    -- URLs
    homepage_url TEXT,
    submission_url TEXT,
    guidelines_url TEXT,

    -- Manuscript requirements
    max_word_count INTEGER,
    max_abstract_words INTEGER,
    max_figures INTEGER,
    max_tables INTEGER,
    max_references INTEGER,

    -- Format requirements
    accepted_formats JSONB DEFAULT '["docx"]', -- docx, pdf, latex, etc.
    required_sections JSONB DEFAULT '[]',

    -- Citation style
    citation_style VARCHAR(100),
    citation_style_id UUID REFERENCES citation_styles(id),

    -- Document formatting
    formatting_requirements JSONB DEFAULT '{}',

    -- Figure/table requirements
    figure_requirements JSONB DEFAULT '{}',
    table_requirements JSONB DEFAULT '{}',

    -- Open access info
    open_access_options JSONB DEFAULT '{}',
    apc_usd DECIMAL(10,2), -- Article Processing Charge

    -- Impact metrics
    impact_factor DECIMAL(6,3),
    cite_score DECIMAL(6,3),
    h_index INTEGER,

    -- Categories
    categories JSONB DEFAULT '[]',
    subject_areas JSONB DEFAULT '[]',

    -- Metadata
    data_source VARCHAR(50) DEFAULT 'manual', -- manual, crossref, scopus, doaj
    last_verified_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_journal_requirements_name ON journal_requirements(journal_name);
CREATE INDEX IF NOT EXISTS idx_journal_requirements_issn ON journal_requirements(issn);
CREATE UNIQUE INDEX IF NOT EXISTS idx_journal_requirements_issn_unique ON journal_requirements(issn) WHERE issn IS NOT NULL;

-- Full-text search on journals
CREATE INDEX IF NOT EXISTS idx_journal_fts ON journal_requirements
USING gin(to_tsvector('english', journal_name || ' ' || COALESCE(publisher, '')));

-- =============================================================================
-- Insert Default Export Templates
-- =============================================================================

INSERT INTO export_templates (
    id, name, description, output_format, template_type,
    page_size, font_family, font_size, line_spacing,
    is_system, is_default, category
) VALUES
(
    gen_random_uuid(),
    'Standard Manuscript (DOCX)',
    'Double-spaced manuscript with standard formatting for most journals',
    'docx',
    'builtin',
    'letter', 'Times New Roman', 12, 2.0,
    TRUE, TRUE, 'general'
),
(
    gen_random_uuid(),
    'Standard Manuscript (PDF)',
    'PDF export with professional typography',
    'pdf',
    'builtin',
    'letter', 'Times New Roman', 12, 2.0,
    TRUE, FALSE, 'general'
),
(
    gen_random_uuid(),
    'LaTeX Article',
    'LaTeX source for further customization',
    'latex',
    'builtin',
    'a4', 'Computer Modern', 11, 1.5,
    TRUE, FALSE, 'general'
),
(
    gen_random_uuid(),
    'HTML Preview',
    'Web-friendly HTML for online viewing',
    'html',
    'builtin',
    'responsive', 'Arial', 16, 1.6,
    TRUE, FALSE, 'general'
),
(
    gen_random_uuid(),
    'Markdown Export',
    'Plain Markdown with YAML frontmatter',
    'md',
    'builtin',
    'none', 'monospace', 14, 1.5,
    TRUE, FALSE, 'general'
),
(
    gen_random_uuid(),
    'JAMA Style',
    'Formatted for JAMA and AMA journals',
    'docx',
    'journal',
    'letter', 'Times New Roman', 12, 2.0,
    TRUE, FALSE, 'medical'
),
(
    gen_random_uuid(),
    'NEJM Style',
    'Formatted for New England Journal of Medicine',
    'docx',
    'journal',
    'letter', 'Times New Roman', 12, 2.0,
    TRUE, FALSE, 'medical'
),
(
    gen_random_uuid(),
    'IEEE Style',
    'Two-column IEEE conference/journal format',
    'pdf',
    'journal',
    'letter', 'Times New Roman', 10, 1.0,
    TRUE, FALSE, 'engineering'
),
(
    gen_random_uuid(),
    'APA 7th Edition',
    'Standard APA format for psychology and social sciences',
    'docx',
    'builtin',
    'letter', 'Times New Roman', 12, 2.0,
    TRUE, FALSE, 'humanities'
)
ON CONFLICT DO NOTHING;

-- =============================================================================
-- Triggers
-- =============================================================================

CREATE OR REPLACE FUNCTION update_export_template_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_export_templates_updated ON export_templates;
CREATE TRIGGER trigger_export_templates_updated
    BEFORE UPDATE ON export_templates
    FOR EACH ROW
    EXECUTE FUNCTION update_export_template_timestamp();

DROP TRIGGER IF EXISTS trigger_export_presets_updated ON export_presets;
CREATE TRIGGER trigger_export_presets_updated
    BEFORE UPDATE ON export_presets
    FOR EACH ROW
    EXECUTE FUNCTION update_export_template_timestamp();
