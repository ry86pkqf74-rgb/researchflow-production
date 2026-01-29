-- Migration: Transparency Foundation
-- Version: 0029
-- Date: 2026-01-28
-- Description: Extends schema for LIT integration, transparency reporting, and large data handling
-- Task: ROS-TRACE-03

-- =============================================
-- EXTEND AI_INVOCATIONS TABLE
-- Add columns for transparency and governance tracking
-- =============================================

-- Add governance_mode column (DEMO vs LIVE)
ALTER TABLE ai_invocations 
ADD COLUMN IF NOT EXISTS governance_mode VARCHAR(20) DEFAULT 'DEMO' 
    CHECK (governance_mode IN ('DEMO', 'LIVE', 'OFFLINE'));

-- Add unique invocation UUID for cross-system correlation
ALTER TABLE ai_invocations 
ADD COLUMN IF NOT EXISTS invocation_id UUID DEFAULT gen_random_uuid();

-- Add PHI scan summary JSONB for detailed scan results
ALTER TABLE ai_invocations 
ADD COLUMN IF NOT EXISTS phi_scan_summary JSONB;

-- Add prompt/output references (S3 URIs or storage paths)
ALTER TABLE ai_invocations 
ADD COLUMN IF NOT EXISTS prompt_ref VARCHAR(500);

ALTER TABLE ai_invocations 
ADD COLUMN IF NOT EXISTS output_ref VARCHAR(500);

-- Add model tier for routing analysis
ALTER TABLE ai_invocations 
ADD COLUMN IF NOT EXISTS tier VARCHAR(20) 
    CHECK (tier IN ('NANO', 'MINI', 'FRONTIER'));

-- Add caller service for attribution
ALTER TABLE ai_invocations 
ADD COLUMN IF NOT EXISTS caller_service VARCHAR(50);

-- Add purpose classification
ALTER TABLE ai_invocations 
ADD COLUMN IF NOT EXISTS purpose VARCHAR(50);

-- Add cost tracking
ALTER TABLE ai_invocations 
ADD COLUMN IF NOT EXISTS cost_usd DECIMAL(10, 6) DEFAULT 0;

-- Add escalation tracking
ALTER TABLE ai_invocations 
ADD COLUMN IF NOT EXISTS escalated BOOLEAN DEFAULT FALSE;

ALTER TABLE ai_invocations 
ADD COLUMN IF NOT EXISTS escalation_tier VARCHAR(20);

-- Add routing metadata JSONB
ALTER TABLE ai_invocations 
ADD COLUMN IF NOT EXISTS routing_metadata JSONB;

-- Add run_id for workflow correlation
ALTER TABLE ai_invocations 
ADD COLUMN IF NOT EXISTS run_id UUID;

-- Add stage number
ALTER TABLE ai_invocations 
ADD COLUMN IF NOT EXISTS stage INTEGER;

-- Add agent_id for multi-agent tracking
ALTER TABLE ai_invocations 
ADD COLUMN IF NOT EXISTS agent_id VARCHAR(100);

-- Add tenant_id for multi-tenancy
ALTER TABLE ai_invocations 
ADD COLUMN IF NOT EXISTS tenant_id VARCHAR(255);

-- Add project_id for project scoping
ALTER TABLE ai_invocations 
ADD COLUMN IF NOT EXISTS project_id VARCHAR(255);

-- Create index for invocation_id lookups
CREATE INDEX IF NOT EXISTS idx_ai_invocations_invocation_id ON ai_invocations(invocation_id);

-- Create index for governance mode filtering
CREATE INDEX IF NOT EXISTS idx_ai_invocations_governance ON ai_invocations(governance_mode);

-- Create index for run correlation
CREATE INDEX IF NOT EXISTS idx_ai_invocations_run_id ON ai_invocations(run_id);

-- Create index for project scoping
CREATE INDEX IF NOT EXISTS idx_ai_invocations_project_id ON ai_invocations(project_id);

-- Create composite index for transparency queries
CREATE INDEX IF NOT EXISTS idx_ai_invocations_transparency 
ON ai_invocations(project_id, run_id, governance_mode, created_at DESC);

-- =============================================
-- DATASETS TABLE
-- Tracks large data files with governance metadata
-- =============================================
CREATE TABLE IF NOT EXISTS datasets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Location and format
    uri VARCHAR(1000) NOT NULL,
    format VARCHAR(20) NOT NULL CHECK (format IN ('csv', 'parquet', 'ndjson', 'dicom', 'xlsx', 'json', 'hl7', 'fhir')),
    
    -- Size and integrity
    size_bytes BIGINT NOT NULL DEFAULT 0,
    sha256 VARCHAR(64),
    row_count BIGINT,
    
    -- Governance
    governance_mode VARCHAR(20) NOT NULL DEFAULT 'DEMO' CHECK (governance_mode IN ('DEMO', 'LIVE')),
    phi_scan_status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (phi_scan_status IN ('pending', 'clean', 'flagged', 'redacted', 'failed')),
    phi_scan_result JSONB,
    
    -- Partitioning for large files
    partition_count INTEGER DEFAULT 1,
    partition_schema JSONB,
    
    -- Schema discovery
    detected_schema JSONB,
    column_count INTEGER,
    
    -- Ownership and access
    owner_id VARCHAR(255) REFERENCES users(id),
    project_id VARCHAR(255),
    tenant_id VARCHAR(255),
    
    -- Lifecycle
    is_archived BOOLEAN DEFAULT FALSE,
    archived_at TIMESTAMP,
    expires_at TIMESTAMP,
    
    -- Audit
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    created_by VARCHAR(255) REFERENCES users(id),
    
    -- Metadata
    name VARCHAR(255),
    description TEXT,
    tags JSONB,
    metadata JSONB
);

-- Indexes for datasets
CREATE INDEX IF NOT EXISTS idx_datasets_project ON datasets(project_id);
CREATE INDEX IF NOT EXISTS idx_datasets_owner ON datasets(owner_id);
CREATE INDEX IF NOT EXISTS idx_datasets_governance ON datasets(governance_mode);
CREATE INDEX IF NOT EXISTS idx_datasets_phi_status ON datasets(phi_scan_status);
CREATE INDEX IF NOT EXISTS idx_datasets_created ON datasets(created_at DESC);

-- =============================================
-- DATASET ACCESS LOG TABLE
-- Audit trail for dataset access (HIPAA compliance)
-- =============================================
CREATE TABLE IF NOT EXISTS dataset_access_log (
    id BIGSERIAL PRIMARY KEY,
    
    -- What was accessed
    dataset_id UUID NOT NULL REFERENCES datasets(id) ON DELETE CASCADE,
    
    -- Who accessed
    user_id VARCHAR(255) REFERENCES users(id),
    service_name VARCHAR(100),
    ip_address INET,
    
    -- Access details
    access_type VARCHAR(50) NOT NULL CHECK (access_type IN ('read', 'download', 'export', 'transform', 'delete', 'share')),
    rows_accessed BIGINT,
    columns_accessed JSONB,
    
    -- Context
    purpose VARCHAR(255),
    run_id UUID,
    stage INTEGER,
    
    -- Governance
    governance_mode VARCHAR(20) NOT NULL,
    phi_exposure_risk VARCHAR(20) CHECK (phi_exposure_risk IN ('none', 'low', 'medium', 'high')),
    
    -- Result
    success BOOLEAN NOT NULL DEFAULT TRUE,
    error_message TEXT,
    
    -- Timing
    duration_ms INTEGER,
    accessed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    
    -- Session context
    session_id VARCHAR(255),
    request_id VARCHAR(255)
);

-- Indexes for audit queries
CREATE INDEX IF NOT EXISTS idx_dataset_access_dataset ON dataset_access_log(dataset_id);
CREATE INDEX IF NOT EXISTS idx_dataset_access_user ON dataset_access_log(user_id);
CREATE INDEX IF NOT EXISTS idx_dataset_access_time ON dataset_access_log(accessed_at DESC);
CREATE INDEX IF NOT EXISTS idx_dataset_access_type ON dataset_access_log(access_type);
CREATE INDEX IF NOT EXISTS idx_dataset_access_governance ON dataset_access_log(governance_mode);

-- Composite index for HIPAA audit queries
CREATE INDEX IF NOT EXISTS idx_dataset_access_audit 
ON dataset_access_log(governance_mode, accessed_at DESC, user_id);

-- =============================================
-- WORKFLOW STAGE RUNS TABLE
-- Checkpointing for long-running workflows
-- =============================================
CREATE TABLE IF NOT EXISTS workflow_stage_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Workflow context
    run_id UUID NOT NULL,
    stage_number INTEGER NOT NULL,
    stage_name VARCHAR(100),
    
    -- Status tracking
    status VARCHAR(20) NOT NULL DEFAULT 'pending' 
        CHECK (status IN ('pending', 'running', 'completed', 'failed', 'skipped', 'paused', 'cancelled')),
    
    -- Progress
    progress_percent DECIMAL(5, 2) DEFAULT 0 CHECK (progress_percent >= 0 AND progress_percent <= 100),
    items_total INTEGER,
    items_processed INTEGER DEFAULT 0,
    items_failed INTEGER DEFAULT 0,
    
    -- Checkpointing
    checkpoint_data JSONB,
    checkpoint_version INTEGER DEFAULT 1,
    last_checkpoint_at TIMESTAMP,
    
    -- Timing
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    duration_ms INTEGER,
    
    -- Retry handling
    attempt_number INTEGER DEFAULT 1,
    max_attempts INTEGER DEFAULT 3,
    last_error TEXT,
    
    -- AI usage summary for this stage
    ai_call_count INTEGER DEFAULT 0,
    ai_cost_usd DECIMAL(10, 6) DEFAULT 0,
    ai_latency_total_ms INTEGER DEFAULT 0,
    
    -- Input/Output references
    input_ref VARCHAR(500),
    output_ref VARCHAR(500),
    
    -- Governance
    governance_mode VARCHAR(20) NOT NULL DEFAULT 'DEMO' 
        CHECK (governance_mode IN ('DEMO', 'LIVE', 'OFFLINE')),
    
    -- Project context
    project_id VARCHAR(255),
    user_id VARCHAR(255) REFERENCES users(id),
    tenant_id VARCHAR(255),
    
    -- Audit
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    
    -- Metadata
    metadata JSONB,
    
    -- Ensure unique stage per run
    CONSTRAINT unique_run_stage UNIQUE (run_id, stage_number)
);

-- Indexes for workflow queries
CREATE INDEX IF NOT EXISTS idx_workflow_stage_runs_run ON workflow_stage_runs(run_id);
CREATE INDEX IF NOT EXISTS idx_workflow_stage_runs_status ON workflow_stage_runs(status);
CREATE INDEX IF NOT EXISTS idx_workflow_stage_runs_project ON workflow_stage_runs(project_id);
CREATE INDEX IF NOT EXISTS idx_workflow_stage_runs_created ON workflow_stage_runs(created_at DESC);

-- Composite index for run monitoring
CREATE INDEX IF NOT EXISTS idx_workflow_stage_runs_monitor 
ON workflow_stage_runs(run_id, stage_number, status);

-- =============================================
-- TRANSPARENCY REPORTS TABLE
-- Stores generated transparency reports
-- =============================================
CREATE TABLE IF NOT EXISTS transparency_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Context
    run_id UUID NOT NULL,
    project_id VARCHAR(255),
    project_name VARCHAR(255),
    
    -- Governance
    governance_mode VARCHAR(20) NOT NULL CHECK (governance_mode IN ('DEMO', 'LIVE')),
    
    -- Summary metrics
    total_ai_calls INTEGER NOT NULL DEFAULT 0,
    total_cost_usd DECIMAL(10, 6) NOT NULL DEFAULT 0,
    total_latency_ms INTEGER NOT NULL DEFAULT 0,
    avg_latency_ms INTEGER,
    
    -- Tier breakdown
    calls_by_tier JSONB,
    calls_by_provider JSONB,
    
    -- Performance
    latency_percentiles JSONB,
    
    -- PHI summary
    phi_scans_total INTEGER DEFAULT 0,
    phi_flags_total INTEGER DEFAULT 0,
    phi_redactions_total INTEGER DEFAULT 0,
    phi_types_detected JSONB,
    
    -- Stage breakdown
    stage_breakdown JSONB,
    
    -- Top expensive calls
    top_expensive_calls JSONB,
    
    -- Recommendations
    recommendations JSONB,
    
    -- Full report content (Markdown)
    report_markdown TEXT,
    report_html TEXT,
    
    -- Audit
    generated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    generated_by VARCHAR(255),
    
    -- Version tracking
    report_version INTEGER DEFAULT 1
);

-- Indexes for report queries
CREATE INDEX IF NOT EXISTS idx_transparency_reports_run ON transparency_reports(run_id);
CREATE INDEX IF NOT EXISTS idx_transparency_reports_project ON transparency_reports(project_id);
CREATE INDEX IF NOT EXISTS idx_transparency_reports_generated ON transparency_reports(generated_at DESC);

-- =============================================
-- LIT BUNDLES TABLE
-- Stores LIT (Language Interpretability Tool) export bundles
-- =============================================
CREATE TABLE IF NOT EXISTS lit_bundles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Context
    run_id UUID NOT NULL,
    project_id VARCHAR(255),
    
    -- Bundle content
    example_count INTEGER NOT NULL DEFAULT 0,
    stages_covered JSONB,
    
    -- Model configuration
    models_included JSONB,
    default_model VARCHAR(100),
    
    -- Storage
    bundle_uri VARCHAR(500),
    bundle_size_bytes BIGINT,
    
    -- Governance (all examples are redacted for LIVE mode)
    governance_mode VARCHAR(20) NOT NULL CHECK (governance_mode IN ('DEMO', 'LIVE')),
    redaction_applied BOOLEAN DEFAULT FALSE,
    
    -- Audit
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    created_by VARCHAR(255),
    
    -- Metadata
    metadata JSONB
);

-- Indexes for LIT bundle queries
CREATE INDEX IF NOT EXISTS idx_lit_bundles_run ON lit_bundles(run_id);
CREATE INDEX IF NOT EXISTS idx_lit_bundles_project ON lit_bundles(project_id);
CREATE INDEX IF NOT EXISTS idx_lit_bundles_created ON lit_bundles(created_at DESC);

-- =============================================
-- UPDATE TRIGGER FOR TIMESTAMP MAINTENANCE
-- =============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply trigger to tables with updated_at
DROP TRIGGER IF EXISTS update_datasets_updated_at ON datasets;
CREATE TRIGGER update_datasets_updated_at
    BEFORE UPDATE ON datasets
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_workflow_stage_runs_updated_at ON workflow_stage_runs;
CREATE TRIGGER update_workflow_stage_runs_updated_at
    BEFORE UPDATE ON workflow_stage_runs
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- =============================================
-- COMMENTS FOR DOCUMENTATION
-- =============================================
COMMENT ON TABLE datasets IS 'Tracks large data files with governance metadata for HIPAA compliance';
COMMENT ON TABLE dataset_access_log IS 'Audit trail for all dataset access operations';
COMMENT ON TABLE workflow_stage_runs IS 'Checkpointing and progress tracking for 20-stage workflows';
COMMENT ON TABLE transparency_reports IS 'Generated transparency reports for AI usage in research runs';
COMMENT ON TABLE lit_bundles IS 'LIT export bundles for model interpretability analysis';

COMMENT ON COLUMN ai_invocations.governance_mode IS 'DEMO uses synthetic data, LIVE uses real PHI';
COMMENT ON COLUMN ai_invocations.invocation_id IS 'Unique UUID for cross-system correlation with Redis streams';
COMMENT ON COLUMN ai_invocations.phi_scan_summary IS 'JSON with scan status, flagged types, confidence, redaction count';
COMMENT ON COLUMN datasets.phi_scan_status IS 'pending=not scanned, clean=no PHI, flagged=PHI detected, redacted=PHI removed';
COMMENT ON COLUMN workflow_stage_runs.checkpoint_data IS 'JSON state for resuming failed/paused stages';
