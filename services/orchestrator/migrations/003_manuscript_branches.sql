-- Migration: 003_manuscript_branches
-- Phase 3.3: Branch persistence for manuscript versioning

-- Manuscript branches table
CREATE TABLE IF NOT EXISTS manuscript_branches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  manuscript_id UUID NOT NULL,
  branch_name VARCHAR(100) NOT NULL,
  parent_branch VARCHAR(100) DEFAULT 'main',
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'merged', 'archived', 'deleted')),
  description TEXT,
  version_hash VARCHAR(64),
  word_counts JSONB DEFAULT '{}',
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  merged_at TIMESTAMPTZ,
  merged_by UUID,
  UNIQUE(manuscript_id, branch_name)
);

-- Create indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_branches_manuscript ON manuscript_branches(manuscript_id);
CREATE INDEX IF NOT EXISTS idx_branches_status ON manuscript_branches(status) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_branches_parent ON manuscript_branches(parent_branch);

-- Manuscript revisions table
CREATE TABLE IF NOT EXISTS manuscript_revisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id UUID NOT NULL REFERENCES manuscript_branches(id) ON DELETE CASCADE,
  revision_number INT NOT NULL,
  content JSONB NOT NULL,
  sections_changed TEXT[] DEFAULT ARRAY[]::TEXT[],
  diff_from_parent JSONB,
  word_count INT,
  commit_message TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(branch_id, revision_number)
);

-- Create indexes for revisions
CREATE INDEX IF NOT EXISTS idx_revisions_branch ON manuscript_revisions(branch_id);
CREATE INDEX IF NOT EXISTS idx_revisions_created ON manuscript_revisions(created_at DESC);

-- Branch merge history
CREATE TABLE IF NOT EXISTS branch_merges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_branch_id UUID NOT NULL REFERENCES manuscript_branches(id),
  target_branch_id UUID NOT NULL REFERENCES manuscript_branches(id),
  merge_type VARCHAR(20) DEFAULT 'fast_forward' CHECK (merge_type IN ('fast_forward', 'squash', 'rebase')),
  conflicts JSONB,
  resolution JSONB,
  merged_by UUID,
  merged_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for merge history
CREATE INDEX IF NOT EXISTS idx_merges_target ON branch_merges(target_branch_id);

-- Update trigger for branches
CREATE OR REPLACE FUNCTION update_branch_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS branch_updated_at ON manuscript_branches;
CREATE TRIGGER branch_updated_at
  BEFORE UPDATE ON manuscript_branches
  FOR EACH ROW
  EXECUTE FUNCTION update_branch_updated_at();

-- Function to get next revision number
CREATE OR REPLACE FUNCTION get_next_revision_number(p_branch_id UUID)
RETURNS INT AS $$
DECLARE
  next_num INT;
BEGIN
  SELECT COALESCE(MAX(revision_number), 0) + 1 INTO next_num
  FROM manuscript_revisions
  WHERE branch_id = p_branch_id;
  RETURN next_num;
END;
$$ LANGUAGE plpgsql;

-- Function to compute diff between revisions
CREATE OR REPLACE FUNCTION compute_revision_diff(
  p_old_content JSONB,
  p_new_content JSONB
) RETURNS JSONB AS $$
DECLARE
  diff JSONB := '{}';
  old_keys TEXT[];
  new_keys TEXT[];
  key TEXT;
BEGIN
  -- Get all keys
  SELECT array_agg(k) INTO old_keys FROM jsonb_object_keys(p_old_content) k;
  SELECT array_agg(k) INTO new_keys FROM jsonb_object_keys(p_new_content) k;
  
  -- Find changes
  FOREACH key IN ARRAY COALESCE(new_keys, ARRAY[]::TEXT[])
  LOOP
    IF NOT (p_old_content ? key) THEN
      diff := diff || jsonb_build_object(key, jsonb_build_object('action', 'added'));
    ELSIF p_old_content->key != p_new_content->key THEN
      diff := diff || jsonb_build_object(key, jsonb_build_object('action', 'modified'));
    END IF;
  END LOOP;
  
  -- Find deletions
  FOREACH key IN ARRAY COALESCE(old_keys, ARRAY[]::TEXT[])
  LOOP
    IF NOT (p_new_content ? key) THEN
      diff := diff || jsonb_build_object(key, jsonb_build_object('action', 'deleted'));
    END IF;
  END LOOP;
  
  RETURN diff;
END;
$$ LANGUAGE plpgsql;

-- View for active branches with latest revision
CREATE OR REPLACE VIEW active_branches_view AS
SELECT 
  b.*,
  r.revision_number as latest_revision,
  r.created_at as last_modified,
  r.commit_message as last_commit_message
FROM manuscript_branches b
LEFT JOIN LATERAL (
  SELECT revision_number, created_at, commit_message
  FROM manuscript_revisions
  WHERE branch_id = b.id
  ORDER BY revision_number DESC
  LIMIT 1
) r ON true
WHERE b.status = 'active';

-- Comments for documentation
COMMENT ON TABLE manuscript_branches IS 'Stores branch metadata for manuscript version control';
COMMENT ON TABLE manuscript_revisions IS 'Stores revision history for each branch';
COMMENT ON TABLE branch_merges IS 'Tracks branch merge history';
COMMENT ON COLUMN manuscript_branches.version_hash IS 'SHA-256 hash of content for quick comparison';
COMMENT ON COLUMN manuscript_revisions.diff_from_parent IS 'JSON diff showing changes from previous revision';
