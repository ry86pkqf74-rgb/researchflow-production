-- Phase F: Observability + Feature Flags Upgrade
-- Migration: 0010_phase_f_observability_featureflags.sql
-- Created: 2026-01-20
--
-- This migration adds tables for:
-- - governance_config: DB-backed governance mode configuration
-- - feature_flags: Feature toggle system with rollout controls
-- - experiments: A/B testing experiment definitions
-- - experiment_assignments: Deterministic user/session to variant assignments
-- - analytics_events: PHI-safe internal analytics (opt-in only)

-- =====================
-- GOVERNANCE CONFIG TABLE
-- =====================
CREATE TABLE IF NOT EXISTS governance_config (
  key VARCHAR(100) PRIMARY KEY,
  value JSONB NOT NULL DEFAULT '{}',
  updated_by VARCHAR(255) REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- Seed default mode if not exists
INSERT INTO governance_config (key, value, updated_at)
VALUES ('mode', '{"mode": "DEMO"}', CURRENT_TIMESTAMP)
ON CONFLICT (key) DO NOTHING;

-- =====================
-- FEATURE FLAGS TABLE
-- =====================
CREATE TABLE IF NOT EXISTS feature_flags (
  key VARCHAR(100) PRIMARY KEY,
  enabled BOOLEAN NOT NULL DEFAULT FALSE,
  description TEXT,
  scope VARCHAR(50) NOT NULL DEFAULT 'product', -- 'product' | 'governance'
  required_modes JSONB DEFAULT '[]', -- e.g. ['DEMO', 'LIVE']
  rollout_percent INTEGER NOT NULL DEFAULT 100 CHECK (rollout_percent >= 0 AND rollout_percent <= 100),
  updated_by VARCHAR(255) REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_feature_flags_scope ON feature_flags(scope);
CREATE INDEX IF NOT EXISTS idx_feature_flags_enabled ON feature_flags(enabled) WHERE enabled = TRUE;

-- Seed default feature flags
INSERT INTO feature_flags (key, enabled, description, scope, required_modes, rollout_percent)
VALUES
  ('ALLOW_UPLOADS', true, 'Allow dataset uploads to the system', 'governance', '["DEMO", "LIVE"]', 100),
  ('ALLOW_EXPORTS', false, 'Allow result exports (requires steward approval)', 'governance', '["LIVE"]', 100),
  ('ALLOW_LLM_CALLS', true, 'Allow LLM API calls for draft generation', 'product', '["DEMO", "LIVE"]', 100),
  ('REQUIRE_PHI_SCAN', true, 'Require PHI scanning for all uploaded data', 'governance', '["DEMO", "STANDBY", "LIVE"]', 100),
  ('ANALYTICS_ENABLED', true, 'Enable internal analytics collection (requires user consent)', 'product', '["DEMO", "LIVE"]', 100),
  ('SSE_ENABLED', true, 'Enable Server-Sent Events for realtime updates', 'product', '["DEMO", "STANDBY", "LIVE"]', 100)
ON CONFLICT (key) DO NOTHING;

-- =====================
-- EXPERIMENTS TABLE
-- =====================
CREATE TABLE IF NOT EXISTS experiments (
  key VARCHAR(100) PRIMARY KEY,
  enabled BOOLEAN NOT NULL DEFAULT FALSE,
  description TEXT,
  variants JSONB NOT NULL DEFAULT '{}', -- e.g. {"A": {"color": "blue"}, "B": {"color": "green"}}
  allocation JSONB NOT NULL DEFAULT '{}', -- e.g. {"A": 50, "B": 50}
  required_modes JSONB DEFAULT '[]',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_experiments_enabled ON experiments(enabled) WHERE enabled = TRUE;

-- =====================
-- EXPERIMENT ASSIGNMENTS TABLE
-- =====================
CREATE TABLE IF NOT EXISTS experiment_assignments (
  id VARCHAR(255) PRIMARY KEY DEFAULT gen_random_uuid()::text,
  experiment_key VARCHAR(100) NOT NULL REFERENCES experiments(key) ON DELETE CASCADE,
  user_id VARCHAR(255) REFERENCES users(id) ON DELETE SET NULL,
  session_id VARCHAR(255),
  variant VARCHAR(50) NOT NULL,
  assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  CONSTRAINT unique_experiment_user_session UNIQUE (experiment_key, user_id, session_id)
);

CREATE INDEX IF NOT EXISTS idx_experiment_assignments_experiment ON experiment_assignments(experiment_key);
CREATE INDEX IF NOT EXISTS idx_experiment_assignments_user ON experiment_assignments(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_experiment_assignments_session ON experiment_assignments(session_id) WHERE session_id IS NOT NULL;

-- =====================
-- ANALYTICS EVENTS TABLE
-- =====================
-- PHI-safe by design: only stores IDs, counts, booleans, timings, feature identifiers
-- No raw dataset values, no manuscript content, no user-entered free text
CREATE TABLE IF NOT EXISTS analytics_events (
  id VARCHAR(255) PRIMARY KEY DEFAULT gen_random_uuid()::text,
  event_name VARCHAR(120) NOT NULL,
  user_id VARCHAR(255) REFERENCES users(id) ON DELETE SET NULL,
  session_id VARCHAR(255),
  research_id VARCHAR(255),
  mode VARCHAR(20) NOT NULL,
  properties JSONB DEFAULT '{}',
  ip_hash VARCHAR(64), -- SHA256 hashed IP, never raw IP
  user_agent TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_analytics_events_name_created ON analytics_events(event_name, created_at);
CREATE INDEX IF NOT EXISTS idx_analytics_events_user_created ON analytics_events(user_id, created_at) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_analytics_events_research_created ON analytics_events(research_id, created_at) WHERE research_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_analytics_events_mode ON analytics_events(mode);

-- Add comment explaining PHI safety
COMMENT ON TABLE analytics_events IS 'PHI-safe internal analytics. Stores only IDs, counts, booleans, timings. No PII/PHI stored. Requires explicit user consent.';
COMMENT ON COLUMN analytics_events.ip_hash IS 'SHA256(ip + salt) - never store raw IP addresses';
COMMENT ON COLUMN analytics_events.properties IS 'PHI-safe properties only: IDs, counts, booleans, enums. Properties are validated and PHI is auto-redacted.';

-- =====================
-- UPDATE USER_CONSENTS CHECK CONSTRAINT
-- =====================
-- Add 'analytics' as a valid consent type
-- Note: This alters the existing CHECK constraint from Phase D migration

-- First drop the old constraint if it exists (safe idempotent approach)
DO $$
BEGIN
  -- Check if the constraint exists before trying to drop
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'user_consents'
    AND constraint_name = 'user_consents_consent_type_check'
  ) THEN
    ALTER TABLE user_consents DROP CONSTRAINT user_consents_consent_type_check;
  END IF;
END $$;

-- Add new constraint with 'analytics' included
ALTER TABLE user_consents
ADD CONSTRAINT user_consents_consent_type_check
CHECK (consent_type IN ('data_processing', 'ai_usage', 'phi_access', 'marketing', 'research_participation', 'data_sharing', 'analytics'));
