-- Migration 011: Phase F - UI/UX Enhancements Tables
-- Tasks 101-110: Feature Flags, Experiments, Custom Fields, Semantic Search, Tutorials

-- ============================================================================
-- FEATURE FLAGS & EXPERIMENTS (Task 110)
-- ============================================================================

-- Feature flags table (backend control)
CREATE TABLE IF NOT EXISTS feature_flags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  flag_key VARCHAR(100) UNIQUE NOT NULL,
  enabled BOOLEAN DEFAULT false NOT NULL,
  description TEXT,
  tier_required VARCHAR(20), -- 'FREE', 'TEAM', 'ENTERPRISE'
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Experiments table (A/B testing)
CREATE TABLE IF NOT EXISTS experiments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  experiment_key VARCHAR(100) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  variants JSONB NOT NULL, -- [{"key": "control", "weight": 50}, {"key": "variant_a", "weight": 50}]
  status VARCHAR(20) DEFAULT 'DRAFT' NOT NULL,
  start_date TIMESTAMP,
  end_date TIMESTAMP,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT experiments_status_check CHECK (status IN ('DRAFT', 'RUNNING', 'PAUSED', 'COMPLETE'))
);

-- Experiment assignments table (deterministic user assignments)
CREATE TABLE IF NOT EXISTS experiment_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  experiment_id UUID NOT NULL REFERENCES experiments(id) ON DELETE CASCADE,
  user_id VARCHAR(255) NOT NULL,
  variant_key VARCHAR(100) NOT NULL,
  assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(experiment_id, user_id)
);

-- ============================================================================
-- CUSTOM FIELDS (Task 101)
-- ============================================================================

-- Org-level custom field schemas
CREATE TABLE IF NOT EXISTS org_custom_fields (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id VARCHAR(255) NOT NULL,
  entity_type VARCHAR(50) NOT NULL, -- 'project', 'dataset', 'artifact'
  schema_json JSONB NOT NULL, -- Array of field definitions
  version INT DEFAULT 1 NOT NULL,
  updated_by VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(org_id, entity_type)
);

-- Entity-level custom field values
CREATE TABLE IF NOT EXISTS entity_custom_field_values (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type VARCHAR(50) NOT NULL,
  entity_id VARCHAR(255) NOT NULL,
  org_id VARCHAR(255) NOT NULL,
  values_json JSONB NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(entity_type, entity_id, org_id)
);

-- ============================================================================
-- SEMANTIC SEARCH (Task 107)
-- ============================================================================

-- Artifact embeddings for PHI-safe semantic search
CREATE TABLE IF NOT EXISTS artifact_embeddings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  artifact_id UUID NOT NULL REFERENCES artifacts(id) ON DELETE CASCADE,
  org_id VARCHAR(255) NOT NULL,
  embedding_vector JSONB NOT NULL, -- Store as JSON array (or use pgvector if available)
  model_name VARCHAR(100) DEFAULT 'text-embedding-3-small' NOT NULL,
  metadata_hash VARCHAR(64) NOT NULL, -- SHA-256 of metadata used to generate embedding
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(artifact_id)
);

-- ============================================================================
-- TUTORIALS (Task 108)
-- ============================================================================

-- Tutorial assets and content
CREATE TABLE IF NOT EXISTS tutorial_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tutorial_key VARCHAR(100) UNIQUE NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  video_url TEXT, -- YouTube/Vimeo/self-hosted
  steps JSONB NOT NULL, -- [{"title": "Step 1", "content": "...", "targetSelector": ".upload-button"}]
  enabled BOOLEAN DEFAULT true,
  org_id VARCHAR(255), -- Null = global; set = org-specific override
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- INDEXES
-- ============================================================================

-- Feature flags indexes
CREATE INDEX IF NOT EXISTS idx_feature_flags_enabled ON feature_flags(enabled) WHERE enabled = true;

-- Experiments indexes
CREATE INDEX IF NOT EXISTS idx_experiments_status ON experiments(status);
CREATE INDEX IF NOT EXISTS idx_experiment_assignments_user ON experiment_assignments(user_id);

-- Custom fields indexes
CREATE INDEX IF NOT EXISTS idx_custom_fields_org ON org_custom_fields(org_id);
CREATE INDEX IF NOT EXISTS idx_custom_values_entity ON entity_custom_field_values(entity_type, entity_id);

-- Semantic search indexes
CREATE INDEX IF NOT EXISTS idx_artifact_embeddings_artifact ON artifact_embeddings(artifact_id);
CREATE INDEX IF NOT EXISTS idx_artifact_embeddings_org ON artifact_embeddings(org_id);

-- Tutorial indexes
CREATE INDEX IF NOT EXISTS idx_tutorial_assets_key ON tutorial_assets(tutorial_key);
CREATE INDEX IF NOT EXISTS idx_tutorial_assets_enabled ON tutorial_assets(enabled) WHERE enabled = true;

-- ============================================================================
-- INITIAL FEATURE FLAGS
-- ============================================================================

-- Insert default feature flags (all disabled by default)
INSERT INTO feature_flags (flag_key, description, tier_required, enabled)
VALUES
  ('custom_fields', 'Enable custom fields form builder for organizations', 'TEAM', false),
  ('role_adaptive_nav', 'Enable role-based adaptive navigation', 'FREE', false),
  ('voice_commands', 'Enable voice command navigation (experimental)', 'ENTERPRISE', false),
  ('xr_preview', 'Enable XR/3D workflow visualization (experimental)', 'ENTERPRISE', false),
  ('semantic_search', 'Enable semantic search on artifact metadata', 'TEAM', false),
  ('inline_tutorials', 'Enable context-sensitive inline tutorials', 'FREE', false),
  ('accessibility_mode', 'Enable enhanced accessibility features', 'FREE', false),
  ('domain_themes', 'Enable domain-specific theme packs', 'FREE', false),
  ('gamification_badges', 'Enable compliance gamification badges (experimental)', 'TEAM', false)
ON CONFLICT (flag_key) DO NOTHING;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE feature_flags IS 'Feature flag configuration for gradual rollout';
COMMENT ON TABLE experiments IS 'A/B testing experiment definitions';
COMMENT ON TABLE experiment_assignments IS 'Deterministic user-to-variant assignments';
COMMENT ON TABLE org_custom_fields IS 'Organization-level custom field schemas';
COMMENT ON TABLE entity_custom_field_values IS 'Custom field values for entities';
COMMENT ON TABLE artifact_embeddings IS 'PHI-safe metadata embeddings for semantic search';
COMMENT ON TABLE tutorial_assets IS 'Tutorial content and video resources';
