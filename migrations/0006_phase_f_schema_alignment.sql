-- Phase F: Schema Alignment Migration
-- Migration: 0006_phase_f_schema_alignment.sql
-- Purpose: Add missing tables from schema.ts to align Drizzle schema with database
-- Created: 2026-01-20

-- =====================
-- RESEARCH BRIEFS TABLE (Stage 3 - Brief Generation)
-- =====================
CREATE TABLE IF NOT EXISTS research_briefs (
  id VARCHAR(255) PRIMARY KEY DEFAULT gen_random_uuid()::text,
  topic_id VARCHAR(255) NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
  topic_version INTEGER NOT NULL,
  research_id VARCHAR(255) NOT NULL,
  entry_mode TEXT,
  converted_pico JSONB,
  summary TEXT,
  study_objectives JSONB NOT NULL,
  population TEXT NOT NULL,
  exposure TEXT NOT NULL,
  comparator TEXT,
  outcomes JSONB NOT NULL,
  timeframe TEXT,
  candidate_endpoints JSONB NOT NULL,
  key_confounders JSONB NOT NULL,
  minimum_dataset_fields JSONB NOT NULL,
  clarifying_prompts JSONB NOT NULL,
  refinement_suggestions JSONB,
  model_used VARCHAR(255) NOT NULL,
  prompt_version VARCHAR(255) NOT NULL,
  artifact_hash VARCHAR(255) NOT NULL,
  token_usage_input INTEGER,
  token_usage_output INTEGER,
  generation_latency_ms INTEGER,
  status TEXT NOT NULL DEFAULT 'draft',
  created_by VARCHAR(255) NOT NULL,
  approved_by VARCHAR(255) REFERENCES users(id),
  approved_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_research_briefs_topic ON research_briefs(topic_id);
CREATE INDEX IF NOT EXISTS idx_research_briefs_research ON research_briefs(research_id);

-- =====================
-- IDEAS TABLE (Topic Ideation)
-- =====================
CREATE TABLE IF NOT EXISTS ideas (
  id VARCHAR(255) PRIMARY KEY DEFAULT gen_random_uuid()::text,
  org_id VARCHAR(255),
  title VARCHAR(500) NOT NULL,
  description TEXT,
  category VARCHAR(100),
  status VARCHAR(50) DEFAULT 'draft' NOT NULL,
  created_by VARCHAR(255) NOT NULL,
  metadata JSONB DEFAULT '{}' NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  deleted_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_ideas_org ON ideas(org_id);
CREATE INDEX IF NOT EXISTS idx_ideas_status ON ideas(status);

-- =====================
-- IDEA SCORECARDS TABLE
-- =====================
CREATE TABLE IF NOT EXISTS idea_scorecards (
  id VARCHAR(255) PRIMARY KEY DEFAULT gen_random_uuid()::text,
  idea_id VARCHAR(255) NOT NULL REFERENCES ideas(id) ON DELETE CASCADE,
  dimension VARCHAR(100) NOT NULL,
  score INTEGER NOT NULL,
  rationale TEXT,
  scored_by VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_idea_scorecards_idea ON idea_scorecards(idea_id);

-- =====================
-- TOPIC BRIEFS TABLE (Docs-First Architecture)
-- =====================
CREATE TABLE IF NOT EXISTS topic_briefs (
  id VARCHAR(255) PRIMARY KEY DEFAULT gen_random_uuid()::text,
  version_number INTEGER DEFAULT 1 NOT NULL,
  title VARCHAR(500) NOT NULL,
  research_question TEXT,
  hypothesis TEXT,
  background TEXT,
  methods_overview TEXT,
  expected_findings TEXT,
  status VARCHAR(20) DEFAULT 'DRAFT' NOT NULL,
  frozen_at TIMESTAMP,
  frozen_by VARCHAR(255),
  created_by VARCHAR(255) NOT NULL,
  org_id VARCHAR(255),
  metadata JSONB DEFAULT '{}' NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  deleted_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_topic_briefs_org ON topic_briefs(org_id);
CREATE INDEX IF NOT EXISTS idx_topic_briefs_status ON topic_briefs(status);

-- =====================
-- VENUES TABLE (Publication/Conference targets)
-- =====================
CREATE TABLE IF NOT EXISTS venues (
  id VARCHAR(255) PRIMARY KEY DEFAULT gen_random_uuid()::text,
  name VARCHAR(500) NOT NULL,
  type VARCHAR(50) NOT NULL,
  impact_factor TEXT,
  acceptance_rate TEXT,
  word_limit INTEGER,
  abstract_limit INTEGER,
  guidelines_url TEXT,
  submission_deadline TIMESTAMP,
  metadata JSONB DEFAULT '{}' NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  deleted_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_venues_type ON venues(type);

-- =====================
-- DOC KITS TABLE (Document preparation kits)
-- =====================
CREATE TABLE IF NOT EXISTS doc_kits (
  id VARCHAR(255) PRIMARY KEY DEFAULT gen_random_uuid()::text,
  topic_brief_id VARCHAR(255) NOT NULL REFERENCES topic_briefs(id) ON DELETE CASCADE,
  venue_id VARCHAR(255) NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
  status VARCHAR(20) DEFAULT 'IN_PROGRESS' NOT NULL,
  created_by VARCHAR(255) NOT NULL,
  org_id VARCHAR(255),
  metadata JSONB DEFAULT '{}' NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  deleted_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_doc_kits_topic_brief ON doc_kits(topic_brief_id);
CREATE INDEX IF NOT EXISTS idx_doc_kits_venue ON doc_kits(venue_id);

-- =====================
-- DOC KIT ITEMS TABLE (Individual documents in kit)
-- =====================
CREATE TABLE IF NOT EXISTS doc_kit_items (
  id VARCHAR(255) PRIMARY KEY DEFAULT gen_random_uuid()::text,
  doc_kit_id VARCHAR(255) NOT NULL REFERENCES doc_kits(id) ON DELETE CASCADE,
  item_type VARCHAR(100) NOT NULL,
  title VARCHAR(500) NOT NULL,
  description TEXT,
  content TEXT,
  artifact_id VARCHAR(255) REFERENCES artifacts(id) ON DELETE SET NULL,
  status VARCHAR(20) DEFAULT 'NOT_STARTED' NOT NULL,
  required BOOLEAN DEFAULT TRUE NOT NULL,
  display_order INTEGER NOT NULL,
  metadata JSONB DEFAULT '{}' NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  deleted_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_doc_kit_items_kit ON doc_kit_items(doc_kit_id);

-- =====================
-- DOC ANCHORS TABLE (Hash chain for scope freeze)
-- =====================
CREATE TABLE IF NOT EXISTS doc_anchors (
  id VARCHAR(255) PRIMARY KEY DEFAULT gen_random_uuid()::text,
  topic_brief_id VARCHAR(255) NOT NULL REFERENCES topic_briefs(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL,
  snapshot_data JSONB NOT NULL,
  previous_hash VARCHAR(64),
  current_hash VARCHAR(64) NOT NULL,
  created_by VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_doc_anchors_topic_brief ON doc_anchors(topic_brief_id);

-- =====================
-- FEATURE FLAGS TABLE (Task 110)
-- =====================
CREATE TABLE IF NOT EXISTS feature_flags (
  id VARCHAR(255) PRIMARY KEY DEFAULT gen_random_uuid()::text,
  flag_key VARCHAR(100) UNIQUE NOT NULL,
  enabled BOOLEAN DEFAULT FALSE NOT NULL,
  description TEXT,
  tier_required VARCHAR(20),
  metadata JSONB DEFAULT '{}' NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_feature_flags_key ON feature_flags(flag_key);

-- =====================
-- EXPERIMENTS TABLE (A/B Testing)
-- =====================
CREATE TABLE IF NOT EXISTS experiments (
  id VARCHAR(255) PRIMARY KEY DEFAULT gen_random_uuid()::text,
  experiment_key VARCHAR(100) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  variants JSONB NOT NULL,
  status VARCHAR(20) DEFAULT 'DRAFT' NOT NULL,
  start_date TIMESTAMP,
  end_date TIMESTAMP,
  metadata JSONB DEFAULT '{}' NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_experiments_key ON experiments(experiment_key);
CREATE INDEX IF NOT EXISTS idx_experiments_status ON experiments(status);

-- =====================
-- EXPERIMENT ASSIGNMENTS TABLE
-- =====================
CREATE TABLE IF NOT EXISTS experiment_assignments (
  id VARCHAR(255) PRIMARY KEY DEFAULT gen_random_uuid()::text,
  experiment_id VARCHAR(255) NOT NULL REFERENCES experiments(id) ON DELETE CASCADE,
  user_id VARCHAR(255) NOT NULL,
  variant_key VARCHAR(100) NOT NULL,
  assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_experiment_assignments_experiment ON experiment_assignments(experiment_id);
CREATE INDEX IF NOT EXISTS idx_experiment_assignments_user ON experiment_assignments(user_id);

-- =====================
-- ORG CUSTOM FIELDS TABLE (Task 101)
-- =====================
CREATE TABLE IF NOT EXISTS org_custom_fields (
  id VARCHAR(255) PRIMARY KEY DEFAULT gen_random_uuid()::text,
  org_id VARCHAR(255) NOT NULL,
  entity_type VARCHAR(50) NOT NULL,
  schema_json JSONB NOT NULL,
  version INTEGER DEFAULT 1 NOT NULL,
  updated_by VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_org_custom_fields_org ON org_custom_fields(org_id);
CREATE INDEX IF NOT EXISTS idx_org_custom_fields_entity ON org_custom_fields(entity_type);

-- =====================
-- ENTITY CUSTOM FIELD VALUES TABLE
-- =====================
CREATE TABLE IF NOT EXISTS entity_custom_field_values (
  id VARCHAR(255) PRIMARY KEY DEFAULT gen_random_uuid()::text,
  entity_type VARCHAR(50) NOT NULL,
  entity_id VARCHAR(255) NOT NULL,
  org_id VARCHAR(255) NOT NULL,
  values_json JSONB NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_entity_custom_field_values_entity ON entity_custom_field_values(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_entity_custom_field_values_org ON entity_custom_field_values(org_id);

-- =====================
-- ARTIFACT EMBEDDINGS TABLE (Task 107 - Semantic Search)
-- =====================
CREATE TABLE IF NOT EXISTS artifact_embeddings (
  id VARCHAR(255) PRIMARY KEY DEFAULT gen_random_uuid()::text,
  artifact_id VARCHAR(255) NOT NULL REFERENCES artifacts(id) ON DELETE CASCADE,
  org_id VARCHAR(255) NOT NULL,
  embedding_vector JSONB NOT NULL,
  model_name VARCHAR(100) DEFAULT 'text-embedding-3-small' NOT NULL,
  metadata_hash VARCHAR(64) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_artifact_embeddings_artifact ON artifact_embeddings(artifact_id);
CREATE INDEX IF NOT EXISTS idx_artifact_embeddings_org ON artifact_embeddings(org_id);

-- =====================
-- TUTORIAL ASSETS TABLE (Task 108)
-- =====================
CREATE TABLE IF NOT EXISTS tutorial_assets (
  id VARCHAR(255) PRIMARY KEY DEFAULT gen_random_uuid()::text,
  tutorial_key VARCHAR(100) UNIQUE NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  video_url TEXT,
  steps JSONB NOT NULL,
  enabled BOOLEAN DEFAULT TRUE,
  org_id VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_tutorial_assets_key ON tutorial_assets(tutorial_key);
CREATE INDEX IF NOT EXISTS idx_tutorial_assets_org ON tutorial_assets(org_id);

-- =====================
-- Seed default feature flags
-- =====================
INSERT INTO feature_flags (flag_key, enabled, description, tier_required) VALUES
('workflow_builder', false, 'Enable custom workflow builder', 'TEAM'),
('parallel_stages', false, 'Enable parallel stage execution', 'ENTERPRISE'),
('semantic_search', false, 'Enable semantic search for artifacts', 'TEAM'),
('experiments', false, 'Enable A/B experiments', 'ENTERPRISE')
ON CONFLICT (flag_key) DO NOTHING;
