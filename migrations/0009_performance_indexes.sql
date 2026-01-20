-- Migration: 0009_performance_indexes.sql
-- Phase 05: Database Performance Indexes
--
-- Purpose: Add indexes for high-cardinality/frequently-filtered columns
-- to reduce DB load from:
--   - Job/status polling
--   - Per-research lookups
--   - Audit log queries
--   - PHI scan lookups
--
-- See docs/architecture/perf-optimization-roadmap.md
--
-- NOTE: Using IF NOT EXISTS for idempotency
-- Consider running CONCURRENTLY in production for large tables

-- =============================================================================
-- approval_gates: frequently queried by resource_id + status
-- =============================================================================
CREATE INDEX IF NOT EXISTS idx_approval_gates_resource_status
    ON approval_gates(resource_id, status);

CREATE INDEX IF NOT EXISTS idx_approval_gates_research_id
    ON approval_gates(research_id);

CREATE INDEX IF NOT EXISTS idx_approval_gates_status
    ON approval_gates(status)
    WHERE status IN ('pending', 'in_review');

-- =============================================================================
-- topics: per-research status filtering
-- =============================================================================
CREATE INDEX IF NOT EXISTS idx_topics_research_status
    ON topics(research_id, status);

CREATE INDEX IF NOT EXISTS idx_topics_status
    ON topics(status);

-- =============================================================================
-- statistical_plans: per-research status filtering
-- =============================================================================
CREATE INDEX IF NOT EXISTS idx_statistical_plans_research_status
    ON statistical_plans(research_id, status);

-- =============================================================================
-- file_uploads: per-research status filtering, upload tracking
-- =============================================================================
CREATE INDEX IF NOT EXISTS idx_file_uploads_research_status
    ON file_uploads(research_id, status);

CREATE INDEX IF NOT EXISTS idx_file_uploads_created_at
    ON file_uploads(created_at DESC);

-- =============================================================================
-- handoff_packs: stage transitions and research lookups
-- =============================================================================
CREATE INDEX IF NOT EXISTS idx_handoff_packs_research_stage
    ON handoff_packs(research_id, stage_id);

CREATE INDEX IF NOT EXISTS idx_handoff_packs_created_at
    ON handoff_packs(created_at DESC);

-- =============================================================================
-- audit_logs: time-series queries and research filtering
-- =============================================================================
CREATE INDEX IF NOT EXISTS idx_audit_logs_research_created
    ON audit_logs(research_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at
    ON audit_logs(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_logs_user_created
    ON audit_logs(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_logs_action_type
    ON audit_logs(action_type);

-- =============================================================================
-- phi_scan_results: resource lookups for PHI status
-- =============================================================================
CREATE INDEX IF NOT EXISTS idx_phi_scan_results_resource
    ON phi_scan_results(resource_type, resource_id);

CREATE INDEX IF NOT EXISTS idx_phi_scan_results_scan_date
    ON phi_scan_results(scan_date DESC);

CREATE INDEX IF NOT EXISTS idx_phi_scan_results_has_phi
    ON phi_scan_results(has_phi)
    WHERE has_phi = true;

-- =============================================================================
-- ai_invocations: tracking AI usage patterns
-- =============================================================================
CREATE INDEX IF NOT EXISTS idx_ai_invocations_research_created
    ON ai_invocations(research_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ai_invocations_status_created
    ON ai_invocations(status, created_at DESC);

-- =============================================================================
-- documents: document lifecycle tracking (Phase H)
-- =============================================================================
CREATE INDEX IF NOT EXISTS idx_documents_research_status
    ON documents(research_id, status);

CREATE INDEX IF NOT EXISTS idx_documents_type_status
    ON documents(document_type, status);

CREATE INDEX IF NOT EXISTS idx_documents_updated_at
    ON documents(updated_at DESC);

-- =============================================================================
-- workflow_executions: workflow monitoring
-- =============================================================================
CREATE INDEX IF NOT EXISTS idx_workflow_executions_research_status
    ON workflow_executions(research_id, status);

CREATE INDEX IF NOT EXISTS idx_workflow_executions_started_at
    ON workflow_executions(started_at DESC);

-- =============================================================================
-- jobs: job queue management
-- =============================================================================
CREATE INDEX IF NOT EXISTS idx_jobs_status_created
    ON jobs(status, created_at);

CREATE INDEX IF NOT EXISTS idx_jobs_type_status
    ON jobs(job_type, status);

CREATE INDEX IF NOT EXISTS idx_jobs_research_id
    ON jobs(research_id);

-- =============================================================================
-- ANALYZE: Update statistics for query planner
-- =============================================================================
ANALYZE approval_gates;
ANALYZE topics;
ANALYZE statistical_plans;
ANALYZE file_uploads;
ANALYZE handoff_packs;
ANALYZE audit_logs;
ANALYZE phi_scan_results;
ANALYZE ai_invocations;
ANALYZE documents;
ANALYZE workflow_executions;
ANALYZE jobs;

-- =============================================================================
-- COMMENT: Document this migration
-- =============================================================================
COMMENT ON INDEX idx_approval_gates_resource_status IS 'Phase 05: Optimize approval gate lookups';
COMMENT ON INDEX idx_audit_logs_research_created IS 'Phase 05: Optimize audit log queries by research';
COMMENT ON INDEX idx_phi_scan_results_resource IS 'Phase 05: Optimize PHI scan lookups';
