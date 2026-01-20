-- Phase E: Multi-tenancy Foundation (Task 81-83)
-- Migration: 0005_phase_e_multitenancy.sql
-- Created: 2026-01-20

-- =====================
-- ORGANIZATIONS TABLE
-- =====================
CREATE TABLE IF NOT EXISTS organizations (
  id VARCHAR(255) PRIMARY KEY DEFAULT gen_random_uuid()::text,
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(100) UNIQUE NOT NULL,
  description TEXT,
  logo_url TEXT,
  settings JSONB DEFAULT '{}',
  billing_email VARCHAR(255),
  subscription_tier VARCHAR(50) NOT NULL DEFAULT 'FREE',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_organizations_slug ON organizations(slug);
CREATE INDEX IF NOT EXISTS idx_organizations_active ON organizations(is_active) WHERE is_active = TRUE;

-- =====================
-- ORG MEMBERSHIPS TABLE
-- =====================
CREATE TABLE IF NOT EXISTS org_memberships (
  id VARCHAR(255) PRIMARY KEY DEFAULT gen_random_uuid()::text,
  org_id VARCHAR(255) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  org_role VARCHAR(50) NOT NULL DEFAULT 'MEMBER',
  joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  invited_by VARCHAR(255) REFERENCES users(id),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  UNIQUE(org_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_org_memberships_org ON org_memberships(org_id);
CREATE INDEX IF NOT EXISTS idx_org_memberships_user ON org_memberships(user_id);
CREATE INDEX IF NOT EXISTS idx_org_memberships_active ON org_memberships(is_active) WHERE is_active = TRUE;

-- =====================
-- ORG INVITES TABLE
-- =====================
CREATE TABLE IF NOT EXISTS org_invites (
  id VARCHAR(255) PRIMARY KEY DEFAULT gen_random_uuid()::text,
  org_id VARCHAR(255) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  email VARCHAR(255) NOT NULL,
  org_role VARCHAR(50) NOT NULL DEFAULT 'MEMBER',
  token_hash VARCHAR(64) NOT NULL UNIQUE,
  invited_by VARCHAR(255) NOT NULL REFERENCES users(id),
  expires_at TIMESTAMP NOT NULL,
  accepted_at TIMESTAMP,
  status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_org_invites_org ON org_invites(org_id);
CREATE INDEX IF NOT EXISTS idx_org_invites_email ON org_invites(email);
CREATE INDEX IF NOT EXISTS idx_org_invites_token ON org_invites(token_hash);
CREATE INDEX IF NOT EXISTS idx_org_invites_status ON org_invites(status) WHERE status = 'PENDING';

-- =====================
-- ORG SUBSCRIPTIONS TABLE (Task 84 - Billing stub)
-- =====================
CREATE TABLE IF NOT EXISTS org_subscriptions (
  id VARCHAR(255) PRIMARY KEY DEFAULT gen_random_uuid()::text,
  org_id VARCHAR(255) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  stripe_customer_id VARCHAR(100),
  stripe_subscription_id VARCHAR(100),
  tier VARCHAR(50) NOT NULL DEFAULT 'FREE',
  status VARCHAR(50) NOT NULL DEFAULT 'active',
  current_period_start TIMESTAMP,
  current_period_end TIMESTAMP,
  cancel_at_period_end BOOLEAN DEFAULT FALSE,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_org_subscriptions_org ON org_subscriptions(org_id);
CREATE INDEX IF NOT EXISTS idx_org_subscriptions_stripe ON org_subscriptions(stripe_customer_id);

-- =====================
-- ORG INTEGRATIONS TABLE (Task 85-86, 99 - Slack, Notion, Salesforce)
-- =====================
CREATE TABLE IF NOT EXISTS org_integrations (
  id VARCHAR(255) PRIMARY KEY DEFAULT gen_random_uuid()::text,
  org_id VARCHAR(255) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  integration_type VARCHAR(50) NOT NULL,
  config JSONB NOT NULL DEFAULT '{}',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  last_synced_at TIMESTAMP,
  sync_status VARCHAR(50),
  error_message TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  UNIQUE(org_id, integration_type)
);

CREATE INDEX IF NOT EXISTS idx_org_integrations_org ON org_integrations(org_id);
CREATE INDEX IF NOT EXISTS idx_org_integrations_type ON org_integrations(integration_type);

-- =====================
-- REVIEW SESSIONS TABLE (Task 87 - Zoom)
-- =====================
CREATE TABLE IF NOT EXISTS review_sessions (
  id VARCHAR(255) PRIMARY KEY DEFAULT gen_random_uuid()::text,
  org_id VARCHAR(255) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  research_id VARCHAR(255),
  zoom_meeting_id VARCHAR(100),
  topic VARCHAR(500),
  start_time TIMESTAMP,
  end_time TIMESTAMP,
  duration_minutes INTEGER,
  participants JSONB,
  recording_url TEXT,
  transcript_url TEXT,
  status VARCHAR(50) NOT NULL DEFAULT 'scheduled',
  metadata JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_review_sessions_org ON review_sessions(org_id);
CREATE INDEX IF NOT EXISTS idx_review_sessions_zoom ON review_sessions(zoom_meeting_id);
CREATE INDEX IF NOT EXISTS idx_review_sessions_research ON review_sessions(research_id);

-- =====================
-- BADGES TABLE (Task 92 - Gamification)
-- =====================
CREATE TABLE IF NOT EXISTS badges (
  id VARCHAR(255) PRIMARY KEY DEFAULT gen_random_uuid()::text,
  code VARCHAR(100) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  icon_url TEXT,
  category VARCHAR(50),
  criteria JSONB,
  points INTEGER DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_badges_code ON badges(code);
CREATE INDEX IF NOT EXISTS idx_badges_category ON badges(category);

-- =====================
-- USER BADGES TABLE (Task 92 - Gamification)
-- =====================
CREATE TABLE IF NOT EXISTS user_badges (
  id VARCHAR(255) PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  badge_id VARCHAR(255) NOT NULL REFERENCES badges(id) ON DELETE CASCADE,
  org_id VARCHAR(255) REFERENCES organizations(id) ON DELETE SET NULL,
  awarded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  awarded_by VARCHAR(255) REFERENCES users(id),
  metadata JSONB,
  UNIQUE(user_id, badge_id)
);

CREATE INDEX IF NOT EXISTS idx_user_badges_user ON user_badges(user_id);
CREATE INDEX IF NOT EXISTS idx_user_badges_badge ON user_badges(badge_id);

-- =====================
-- USER ONBOARDING TABLE (Task 97)
-- =====================
CREATE TABLE IF NOT EXISTS user_onboarding (
  id VARCHAR(255) PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  org_id VARCHAR(255) REFERENCES organizations(id) ON DELETE SET NULL,
  steps_completed JSONB DEFAULT '[]',
  current_step INTEGER DEFAULT 0,
  completed_at TIMESTAMP,
  skipped BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  UNIQUE(user_id, org_id)
);

CREATE INDEX IF NOT EXISTS idx_user_onboarding_user ON user_onboarding(user_id);

-- =====================
-- NOTION MAPPINGS TABLE (Task 86)
-- =====================
CREATE TABLE IF NOT EXISTS notion_mappings (
  id VARCHAR(255) PRIMARY KEY DEFAULT gen_random_uuid()::text,
  org_id VARCHAR(255) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  artifact_id VARCHAR(255) REFERENCES artifacts(id) ON DELETE SET NULL,
  notion_page_id VARCHAR(100),
  notion_database_id VARCHAR(100),
  sync_direction VARCHAR(20) DEFAULT 'push',
  last_synced_at TIMESTAMP,
  sync_status VARCHAR(50),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_notion_mappings_org ON notion_mappings(org_id);
CREATE INDEX IF NOT EXISTS idx_notion_mappings_artifact ON notion_mappings(artifact_id);

-- =====================
-- ADD org_id TO research_projects
-- =====================
ALTER TABLE research_projects
  ADD COLUMN IF NOT EXISTS org_id VARCHAR(255) REFERENCES organizations(id);

CREATE INDEX IF NOT EXISTS idx_research_projects_org ON research_projects(org_id);

-- =====================
-- SEARCH VECTOR FOR ARTIFACTS (Task 98)
-- =====================
ALTER TABLE artifacts
  ADD COLUMN IF NOT EXISTS search_vector tsvector;

CREATE INDEX IF NOT EXISTS idx_artifacts_search ON artifacts USING GIN(search_vector);

-- Create function to update search vector
CREATE OR REPLACE FUNCTION update_artifact_search_vector()
RETURNS TRIGGER AS $$
BEGIN
  NEW.search_vector := to_tsvector('english',
    COALESCE(NEW.filename, '') || ' ' ||
    COALESCE(NEW.content, '')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for search vector updates
DROP TRIGGER IF EXISTS trg_artifacts_search ON artifacts;
CREATE TRIGGER trg_artifacts_search
  BEFORE INSERT OR UPDATE ON artifacts
  FOR EACH ROW EXECUTE FUNCTION update_artifact_search_vector();

-- Update existing artifacts
UPDATE artifacts SET search_vector = to_tsvector('english',
  COALESCE(filename, '') || ' ' ||
  COALESCE(content, '')
) WHERE search_vector IS NULL;

-- =====================
-- SEED DEFAULT BADGES
-- =====================
INSERT INTO badges (code, name, description, category, points) VALUES
  ('first_research', 'First Research', 'Created your first research project', 'milestone', 10),
  ('first_artifact', 'First Artifact', 'Created your first artifact', 'milestone', 10),
  ('collaborator', 'Team Player', 'Joined your first organization', 'social', 5),
  ('reviewer', 'Reviewer', 'Completed your first review', 'contribution', 15),
  ('early_adopter', 'Early Adopter', 'One of the first 100 users', 'special', 50)
ON CONFLICT (code) DO NOTHING;
