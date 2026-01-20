-- Migration: Create artifacts and graph tables
-- Created: 2026-01-20
-- Description: Establishes foundation for artifact provenance tracking

BEGIN;

-- ============================================================
-- Core artifacts table
-- ============================================================
CREATE TABLE IF NOT EXISTS artifacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Type classification
  type VARCHAR(50) NOT NULL CHECK (type IN (
    'topic', 'literature', 'dataset', 'analysis',
    'manuscript', 'conference_poster', 'conference_slides',
    'conference_abstract', 'figure', 'table'
  )),

  -- Basic metadata
  name VARCHAR(255) NOT NULL,
  description TEXT,
  status VARCHAR(50) DEFAULT 'draft' CHECK (status IN (
    'draft', 'active', 'review', 'approved', 'archived'
  )),

  -- PHI compliance tracking
  phi_scanned BOOLEAN DEFAULT FALSE,
  phi_status VARCHAR(20) CHECK (phi_status IN (
    'PASS', 'FAIL', 'PENDING', 'OVERRIDE'
  )),
  phi_scan_date TIMESTAMP,
  phi_findings_count INT DEFAULT 0,

  -- Ownership and RBAC
  owner_user_id VARCHAR(255) NOT NULL,
  organization_id VARCHAR(255),

  -- Temporal tracking
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL,
  deleted_at TIMESTAMP,  -- Soft delete

  -- Flexible metadata for type-specific data
  metadata JSONB DEFAULT '{}'::jsonb NOT NULL
);

-- Indexes for artifact queries
CREATE INDEX idx_artifacts_type ON artifacts(type) WHERE deleted_at IS NULL;
CREATE INDEX idx_artifacts_status ON artifacts(status) WHERE deleted_at IS NULL;
CREATE INDEX idx_artifacts_owner ON artifacts(owner_user_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_artifacts_org ON artifacts(organization_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_artifacts_phi_status ON artifacts(phi_status) WHERE phi_scanned = TRUE;
CREATE INDEX idx_artifacts_updated_at ON artifacts(updated_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX idx_artifacts_metadata_gin ON artifacts USING gin(metadata) WHERE deleted_at IS NULL;

-- ============================================================
-- Artifact relationships (edges in the provenance graph)
-- ============================================================
CREATE TABLE IF NOT EXISTS artifact_edges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Edge endpoints
  source_artifact_id UUID NOT NULL REFERENCES artifacts(id) ON DELETE CASCADE,
  target_artifact_id UUID NOT NULL REFERENCES artifacts(id) ON DELETE CASCADE,

  -- Relationship semantics
  relation_type VARCHAR(50) NOT NULL CHECK (relation_type IN (
    'derived_from',      -- Target derived from source (e.g., Analysis from Dataset)
    'references',        -- Target references source (e.g., Manuscript references Literature)
    'supersedes',        -- Target supersedes source (versioning)
    'uses',             -- Target uses source (e.g., Poster uses Figure)
    'generated_from',   -- Target generated from source (e.g., Conference material from Manuscript)
    'exported_to',      -- Source exported to target (e.g., PPTX to PDF)
    'annotates'         -- Target annotates source (e.g., Comment annotates Section)
  )),

  -- Transformation metadata
  transformation_type VARCHAR(100),        -- 'literature_search', 'statistical_analysis', 'export', etc.
  transformation_config JSONB,              -- Parameters used in transformation

  -- Version tracking (which versions were involved)
  source_version_id UUID,                   -- Which version of source was used
  target_version_id UUID,                   -- Which version of target was created

  -- Temporal
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  deleted_at TIMESTAMP,  -- Soft delete

  -- Flexible metadata
  metadata JSONB DEFAULT '{}'::jsonb NOT NULL,

  -- Constraints
  CONSTRAINT no_self_loops CHECK (source_artifact_id != target_artifact_id)
);

-- Indexes for graph traversal
CREATE INDEX idx_artifact_edges_source ON artifact_edges(source_artifact_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_artifact_edges_target ON artifact_edges(target_artifact_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_artifact_edges_relation_type ON artifact_edges(relation_type) WHERE deleted_at IS NULL;
CREATE INDEX idx_artifact_edges_both ON artifact_edges(source_artifact_id, target_artifact_id) WHERE deleted_at IS NULL;

-- Unique constraint: one edge per source/target/relation combination
CREATE UNIQUE INDEX idx_artifact_edges_unique ON artifact_edges(
  source_artifact_id, target_artifact_id, relation_type
) WHERE deleted_at IS NULL;

-- ============================================================
-- Audit log for compliance
-- ============================================================
CREATE TABLE IF NOT EXISTS artifact_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  artifact_id UUID REFERENCES artifacts(id) ON DELETE SET NULL,

  -- Action classification
  action VARCHAR(100) NOT NULL,             -- 'CREATE', 'UPDATE', 'DELETE', 'EXPORT', 'COMMENT', 'RESOLVE_COMMENT', etc.
  action_category VARCHAR(50),              -- 'CONTENT', 'METADATA', 'PHI', 'VERSION', 'COLLABORATION'

  -- Actor information
  user_id VARCHAR(255) NOT NULL,
  user_role VARCHAR(50),

  -- Change details
  details JSONB NOT NULL,
  before_state JSONB,                       -- State before change
  after_state JSONB,                        -- State after change

  -- Hash chain for tamper detection
  previous_hash VARCHAR(64),                -- SHA-256 of previous audit entry
  current_hash VARCHAR(64) NOT NULL,        -- SHA-256 of this entry (action + details + timestamp)

  -- PHI compliance tracking
  phi_scanned BOOLEAN DEFAULT FALSE,
  phi_findings INT DEFAULT 0,

  -- Temporal
  timestamp TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Indexes for audit queries
CREATE INDEX idx_audit_log_artifact ON artifact_audit_log(artifact_id, timestamp DESC);
CREATE INDEX idx_audit_log_user ON artifact_audit_log(user_id, timestamp DESC);
CREATE INDEX idx_audit_log_action ON artifact_audit_log(action);
CREATE INDEX idx_audit_log_action_category ON artifact_audit_log(action_category);
CREATE INDEX idx_audit_log_timestamp ON artifact_audit_log(timestamp DESC);

-- Index for hash chain verification
CREATE INDEX idx_audit_log_hash ON artifact_audit_log(previous_hash) WHERE previous_hash IS NOT NULL;

-- ============================================================
-- Functions and triggers
-- ============================================================

-- Trigger to auto-update updated_at on artifacts
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_artifacts_updated_at
    BEFORE UPDATE ON artifacts
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Function to check for cycles in artifact graph
CREATE OR REPLACE FUNCTION check_artifact_cycle(
    p_source_id UUID,
    p_target_id UUID
) RETURNS BOOLEAN AS $$
DECLARE
    cycle_exists BOOLEAN;
BEGIN
    -- Check if adding edge source -> target would create a cycle
    -- by checking if there's already a path from target to source
    WITH RECURSIVE paths AS (
        SELECT source_artifact_id, target_artifact_id, 1 as depth
        FROM artifact_edges
        WHERE source_artifact_id = p_target_id
          AND deleted_at IS NULL

        UNION ALL

        SELECT e.source_artifact_id, e.target_artifact_id, p.depth + 1
        FROM artifact_edges e
        INNER JOIN paths p ON e.source_artifact_id = p.target_artifact_id
        WHERE p.depth < 20  -- Max depth limit to prevent infinite recursion
          AND e.deleted_at IS NULL
    )
    SELECT EXISTS(
        SELECT 1 FROM paths WHERE target_artifact_id = p_source_id
    ) INTO cycle_exists;

    RETURN cycle_exists;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION check_artifact_cycle IS 'Returns TRUE if adding edge would create a cycle';

COMMIT;

-- ============================================================
-- Verification queries
-- ============================================================

-- Verify tables created
DO $$
BEGIN
    ASSERT (SELECT COUNT(*) FROM information_schema.tables WHERE table_name = 'artifacts') = 1,
           'artifacts table not created';
    ASSERT (SELECT COUNT(*) FROM information_schema.tables WHERE table_name = 'artifact_edges') = 1,
           'artifact_edges table not created';
    ASSERT (SELECT COUNT(*) FROM information_schema.tables WHERE table_name = 'artifact_audit_log') = 1,
           'artifact_audit_log table not created';
    RAISE NOTICE 'Migration 001 completed successfully';
END $$;
