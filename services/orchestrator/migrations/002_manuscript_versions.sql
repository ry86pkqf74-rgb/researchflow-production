-- Migration: Enhanced version control with Yjs support
-- Created: 2026-01-20
-- Description: Persistent storage for manuscript versions with real-time collaboration support

BEGIN;

-- ============================================================
-- Manuscript versions table (enhanced from in-memory version)
-- ============================================================
CREATE TABLE IF NOT EXISTS manuscript_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  manuscript_id UUID NOT NULL REFERENCES artifacts(id) ON DELETE CASCADE,
  version_number INT NOT NULL,

  -- Content storage (dual model: structured + CRDT)
  content_json JSONB NOT NULL,              -- IMRaD structured content
  yjs_snapshot BYTEA,                        -- Yjs binary state snapshot for CRDT

  -- Provenance
  created_by VARCHAR(255) NOT NULL,
  change_description TEXT,
  data_snapshot_hash VARCHAR(64),            -- SHA-256 of source data for reproducibility

  -- Metrics
  word_count INT,
  section_counts JSONB,                      -- {"introduction": 450, "methods": 890, ...}

  -- Temporal
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,

  -- Flexible metadata
  metadata JSONB DEFAULT '{}'::jsonb NOT NULL,

  -- Constraints
  CONSTRAINT manuscript_versions_unique_number UNIQUE (manuscript_id, version_number)
);

-- Indexes for version queries
CREATE INDEX idx_manuscript_versions_manuscript ON manuscript_versions(manuscript_id, version_number DESC);
CREATE INDEX idx_manuscript_versions_created_at ON manuscript_versions(created_at DESC);
CREATE INDEX idx_manuscript_versions_created_by ON manuscript_versions(created_by);

COMMENT ON TABLE manuscript_versions IS 'Immutable snapshots of manuscript state with version history';
COMMENT ON COLUMN manuscript_versions.yjs_snapshot IS 'Binary Yjs state for real-time collaboration restoration';
COMMENT ON COLUMN manuscript_versions.content_json IS 'Structured IMRaD content for queries and export';

-- ============================================================
-- Yjs incremental updates (for real-time collaboration)
-- ============================================================
CREATE TABLE IF NOT EXISTS manuscript_yjs_updates (
  id BIGSERIAL PRIMARY KEY,
  manuscript_id UUID NOT NULL REFERENCES artifacts(id) ON DELETE CASCADE,

  -- Yjs update data
  clock BIGINT NOT NULL,                     -- Yjs logical clock (timestamp-based)
  update_data BYTEA NOT NULL,                -- Yjs binary update (immutable)

  -- Metadata
  user_id VARCHAR(255),                      -- Who made this update
  applied_at TIMESTAMP DEFAULT NOW() NOT NULL,

  -- Session tracking
  session_id VARCHAR(255)
);

-- Indexes for Yjs update retrieval
CREATE INDEX idx_yjs_updates_manuscript ON manuscript_yjs_updates(manuscript_id, clock);
CREATE INDEX idx_yjs_updates_applied_at ON manuscript_yjs_updates(applied_at);
CREATE INDEX idx_yjs_updates_user ON manuscript_yjs_updates(user_id) WHERE user_id IS NOT NULL;

COMMENT ON TABLE manuscript_yjs_updates IS 'Incremental Yjs updates for real-time collaboration sync';
COMMENT ON COLUMN manuscript_yjs_updates.clock IS 'Logical clock for update ordering (millisecond timestamp)';
COMMENT ON COLUMN manuscript_yjs_updates.update_data IS 'Binary Yjs update (cannot be interpreted as text)';

-- ============================================================
-- Partitioning strategy for scalability
-- ============================================================

-- Note: For production, partition manuscript_yjs_updates by manuscript_id or time
-- Example (commented out - enable when needed):
--
-- CREATE TABLE manuscript_yjs_updates (
--   id BIGSERIAL NOT NULL,
--   manuscript_id UUID NOT NULL,
--   clock BIGINT NOT NULL,
--   update_data BYTEA NOT NULL,
--   user_id VARCHAR(255),
--   applied_at TIMESTAMP DEFAULT NOW() NOT NULL,
--   PRIMARY KEY (manuscript_id, id)
-- ) PARTITION BY HASH (manuscript_id);
--
-- CREATE TABLE manuscript_yjs_updates_p0 PARTITION OF manuscript_yjs_updates
--   FOR VALUES WITH (MODULUS 4, REMAINDER 0);
-- CREATE TABLE manuscript_yjs_updates_p1 PARTITION OF manuscript_yjs_updates
--   FOR VALUES WITH (MODULUS 4, REMAINDER 1);
-- CREATE TABLE manuscript_yjs_updates_p2 PARTITION OF manuscript_yjs_updates
--   FOR VALUES WITH (MODULUS 4, REMAINDER 2);
-- CREATE TABLE manuscript_yjs_updates_p3 PARTITION OF manuscript_yjs_updates
--   FOR VALUES WITH (MODULUS 4, REMAINDER 3);

-- ============================================================
-- Functions for version management
-- ============================================================

-- Get next version number for a manuscript
CREATE OR REPLACE FUNCTION get_next_version_number(p_manuscript_id UUID)
RETURNS INT AS $$
DECLARE
    next_num INT;
BEGIN
    SELECT COALESCE(MAX(version_number), 0) + 1
    INTO next_num
    FROM manuscript_versions
    WHERE manuscript_id = p_manuscript_id;

    RETURN next_num;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_next_version_number IS 'Auto-increment version number per manuscript';

-- Compact old Yjs updates (archival strategy)
CREATE OR REPLACE FUNCTION compact_yjs_updates(
    p_manuscript_id UUID,
    p_older_than_days INT DEFAULT 30
) RETURNS INT AS $$
DECLARE
    deleted_count INT;
    latest_snapshot_clock BIGINT;
BEGIN
    -- Get the clock of the latest version snapshot
    SELECT
        EXTRACT(EPOCH FROM created_at) * 1000
    INTO latest_snapshot_clock
    FROM manuscript_versions
    WHERE manuscript_id = p_manuscript_id
      AND yjs_snapshot IS NOT NULL
    ORDER BY version_number DESC
    LIMIT 1;

    -- Delete updates older than snapshot and older than retention period
    DELETE FROM manuscript_yjs_updates
    WHERE manuscript_id = p_manuscript_id
      AND clock < latest_snapshot_clock
      AND applied_at < NOW() - (p_older_than_days || ' days')::INTERVAL;

    GET DIAGNOSTICS deleted_count = ROW_COUNT;

    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION compact_yjs_updates IS 'Archive old Yjs updates to reduce storage (keeps updates newer than latest snapshot)';

-- ============================================================
-- Triggers
-- ============================================================

-- Trigger to validate version number on insert
CREATE OR REPLACE FUNCTION validate_version_number()
RETURNS TRIGGER AS $$
DECLARE
    expected_version INT;
BEGIN
    expected_version := get_next_version_number(NEW.manuscript_id) - 1;

    IF NEW.version_number != expected_version THEN
        RAISE EXCEPTION 'Invalid version number: expected %, got %',
            expected_version, NEW.version_number;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER check_version_number
    BEFORE INSERT ON manuscript_versions
    FOR EACH ROW
    EXECUTE FUNCTION validate_version_number();

COMMIT;

-- ============================================================
-- Verification queries
-- ============================================================

DO $$
BEGIN
    ASSERT (SELECT COUNT(*) FROM information_schema.tables WHERE table_name = 'manuscript_versions') = 1,
           'manuscript_versions table not created';
    ASSERT (SELECT COUNT(*) FROM information_schema.tables WHERE table_name = 'manuscript_yjs_updates') = 1,
           'manuscript_yjs_updates table not created';
    RAISE NOTICE 'Migration 002 completed successfully';
END $$;
