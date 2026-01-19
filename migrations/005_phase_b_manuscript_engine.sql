-- ============================================
-- Migration: Phase B - Manuscript Engine Expansion
-- ResearchFlow Production
-- ============================================

BEGIN;

-- Section revisions (append-only with parent tracking)
CREATE TABLE IF NOT EXISTS manuscript_section_revisions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    manuscript_id UUID NOT NULL REFERENCES manuscripts(id) ON DELETE CASCADE,
    section_key TEXT NOT NULL,
    version INT NOT NULL,
    content_md TEXT NOT NULL,
    content_json JSONB NULL,
    word_count INT NOT NULL DEFAULT 0,
    created_by TEXT NOT NULL,
    commit_message TEXT NULL,
    parent_revision_id UUID NULL REFERENCES manuscript_section_revisions(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT chk_section_key CHECK (section_key IN (
        'TITLE', 'ABSTRACT', 'INTRODUCTION', 'METHODS', 'RESULTS', 'DISCUSSION',
        'REFERENCES', 'FIGURES', 'TABLES', 'SUPPLEMENT', 'ACKNOWLEDGEMENTS', 'CONFLICTS'
    )),
    UNIQUE(manuscript_id, section_key, version)
);

-- Manuscript jobs (generation, export, verification, etc.)
CREATE TABLE IF NOT EXISTS manuscript_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    manuscript_id UUID NOT NULL REFERENCES manuscripts(id) ON DELETE CASCADE,
    job_type TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'QUEUED',
    request_json JSONB NOT NULL,
    result_json JSONB NULL,
    error_text TEXT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT chk_job_status CHECK (status IN ('QUEUED', 'RUNNING', 'SUCCEEDED', 'FAILED', 'BLOCKED'))
);

-- Manuscript audit events (hash-chained for immutability)
CREATE TABLE IF NOT EXISTS manuscript_audit_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    manuscript_id UUID NOT NULL REFERENCES manuscripts(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL,
    actor TEXT NOT NULL,
    details_json JSONB NOT NULL DEFAULT '{}',
    previous_hash VARCHAR(64) NULL,
    current_hash VARCHAR(64) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT chk_event_type CHECK (event_type IN (
        'MANUSCRIPT_CREATED', 'SECTION_GENERATED', 'SECTION_EDITED', 'SECTION_ROLLBACK',
        'EXPORT_REQUESTED', 'EXPORT_COMPLETED', 'PHI_BLOCKED', 'PHI_SCAN_PASSED',
        'CLAIM_VERIFICATION', 'PEER_REVIEW_SIMULATED', 'APPROVAL_REQUESTED',
        'APPROVAL_GRANTED', 'APPROVAL_DENIED', 'EXTERNAL_API_CALL', 'STYLE_CHECK',
        'PLAGIARISM_CHECK', 'DOI_MINTED', 'ORCID_FETCHED', 'TRANSLATION_REQUESTED',
        'FEEDBACK_SUBMITTED'
    ))
);

-- Manuscript artifacts (figures, tables, exports)
CREATE TABLE IF NOT EXISTS manuscript_artifacts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    manuscript_id UUID NOT NULL REFERENCES manuscripts(id) ON DELETE CASCADE,
    kind TEXT NOT NULL,
    format TEXT NOT NULL,
    name TEXT NOT NULL,
    caption TEXT NULL,
    path TEXT NOT NULL,
    content_hash VARCHAR(64) NOT NULL,
    size_bytes BIGINT NOT NULL,
    mime_type TEXT NOT NULL,
    metadata JSONB NULL,
    created_by TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT chk_artifact_kind CHECK (kind IN ('figure', 'table', 'export', 'supplement', 'data', 'code', 'bundle')),
    CONSTRAINT chk_artifact_format CHECK (format IN ('png', 'svg', 'pdf', 'csv', 'json', 'docx', 'latex', 'html', 'zip', 'plotly_json'))
);

-- Manuscript approvals (for LIVE mode governance)
CREATE TABLE IF NOT EXISTS manuscript_approvals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    manuscript_id UUID NOT NULL REFERENCES manuscripts(id) ON DELETE CASCADE,
    action TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'PENDING',
    requested_by TEXT NOT NULL,
    reason TEXT NOT NULL,
    metadata JSONB NULL,
    approved_by TEXT NULL,
    approved_at TIMESTAMPTZ NULL,
    denial_reason TEXT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT chk_approval_action CHECK (action IN ('EXPORT', 'EXTERNAL_API', 'PUBLISH')),
    CONSTRAINT chk_approval_status CHECK (status IN ('PENDING', 'APPROVED', 'DENIED'))
);

-- Manuscript feedback (for AI prompt tuning)
CREATE TABLE IF NOT EXISTS manuscript_feedback (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    manuscript_id UUID NOT NULL REFERENCES manuscripts(id) ON DELETE CASCADE,
    job_id UUID NULL REFERENCES manuscript_jobs(id) ON DELETE SET NULL,
    section_key TEXT NULL,
    rating INT NOT NULL CHECK (rating >= 1 AND rating <= 5),
    feedback_text TEXT NULL,
    submitted_by TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- AI cost tracking
CREATE TABLE IF NOT EXISTS manuscript_ai_costs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    manuscript_id UUID NOT NULL REFERENCES manuscripts(id) ON DELETE CASCADE,
    job_id UUID NULL REFERENCES manuscript_jobs(id) ON DELETE SET NULL,
    model TEXT NOT NULL,
    prompt_tokens INT NOT NULL,
    completion_tokens INT NOT NULL,
    cost_usd DECIMAL(10, 6) NOT NULL,
    step TEXT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Journal templates
CREATE TABLE IF NOT EXISTS journal_templates (
    id TEXT PRIMARY KEY,
    display_name TEXT NOT NULL,
    sections TEXT[] NOT NULL,
    word_limits JSONB NOT NULL DEFAULT '{}',
    citation_style TEXT NOT NULL DEFAULT 'vancouver',
    double_blind_supported BOOLEAN NOT NULL DEFAULT false,
    metadata JSONB NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Insert default journal templates
INSERT INTO journal_templates (id, display_name, sections, word_limits, citation_style, double_blind_supported) VALUES
    ('nejm', 'New England Journal of Medicine',
     ARRAY['TITLE', 'ABSTRACT', 'INTRODUCTION', 'METHODS', 'RESULTS', 'DISCUSSION', 'REFERENCES'],
     '{"ABSTRACT": 250, "INTRODUCTION": 500}', 'vancouver', true),
    ('jama', 'JAMA',
     ARRAY['TITLE', 'ABSTRACT', 'INTRODUCTION', 'METHODS', 'RESULTS', 'DISCUSSION', 'REFERENCES'],
     '{"ABSTRACT": 350, "INTRODUCTION": 600}', 'ama', true),
    ('lancet', 'The Lancet',
     ARRAY['TITLE', 'ABSTRACT', 'INTRODUCTION', 'METHODS', 'RESULTS', 'DISCUSSION', 'REFERENCES'],
     '{"ABSTRACT": 300, "INTRODUCTION": 500}', 'vancouver', true),
    ('bmj', 'BMJ',
     ARRAY['TITLE', 'ABSTRACT', 'INTRODUCTION', 'METHODS', 'RESULTS', 'DISCUSSION', 'REFERENCES'],
     '{"ABSTRACT": 250, "INTRODUCTION": 400}', 'vancouver', true)
ON CONFLICT (id) DO NOTHING;

-- Update manuscripts table to add mode column if not exists
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'manuscripts' AND column_name = 'mode') THEN
        ALTER TABLE manuscripts ADD COLUMN mode TEXT NOT NULL DEFAULT 'DEMO'
            CHECK (mode IN ('STANDBY', 'DEMO', 'LIVE'));
    END IF;
END $$;

-- Performance indexes
CREATE INDEX IF NOT EXISTS idx_section_revisions_manuscript ON manuscript_section_revisions(manuscript_id);
CREATE INDEX IF NOT EXISTS idx_section_revisions_section ON manuscript_section_revisions(manuscript_id, section_key);
CREATE INDEX IF NOT EXISTS idx_manuscript_jobs_manuscript ON manuscript_jobs(manuscript_id);
CREATE INDEX IF NOT EXISTS idx_manuscript_jobs_status ON manuscript_jobs(status);
CREATE INDEX IF NOT EXISTS idx_audit_events_manuscript ON manuscript_audit_events(manuscript_id);
CREATE INDEX IF NOT EXISTS idx_audit_events_type ON manuscript_audit_events(event_type);
CREATE INDEX IF NOT EXISTS idx_audit_events_created ON manuscript_audit_events(created_at);
CREATE INDEX IF NOT EXISTS idx_artifacts_manuscript ON manuscript_artifacts(manuscript_id);
CREATE INDEX IF NOT EXISTS idx_artifacts_kind ON manuscript_artifacts(kind);
CREATE INDEX IF NOT EXISTS idx_approvals_manuscript ON manuscript_approvals(manuscript_id);
CREATE INDEX IF NOT EXISTS idx_approvals_status ON manuscript_approvals(status);
CREATE INDEX IF NOT EXISTS idx_feedback_manuscript ON manuscript_feedback(manuscript_id);
CREATE INDEX IF NOT EXISTS idx_ai_costs_manuscript ON manuscript_ai_costs(manuscript_id);

-- Auto-update timestamp trigger for jobs
CREATE OR REPLACE FUNCTION update_manuscript_job_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_manuscript_jobs_updated ON manuscript_jobs;
CREATE TRIGGER trg_manuscript_jobs_updated
    BEFORE UPDATE ON manuscript_jobs
    FOR EACH ROW EXECUTE FUNCTION update_manuscript_job_timestamp();

COMMIT;
