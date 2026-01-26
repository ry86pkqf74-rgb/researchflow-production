-- Manual fixes applied on 2026-01-21
-- These tables were created manually to fix missing dependencies from partial migration runs

-- Create org_memberships table (from 0005_phase_e_multitenancy.sql)
CREATE TABLE IF NOT EXISTS org_memberships (
  id VARCHAR(255) PRIMARY KEY DEFAULT gen_random_uuid()::text,
  org_id VARCHAR(255) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id VARCHAR(255) NOT NULL,
  role VARCHAR(50) NOT NULL DEFAULT 'MEMBER',
  permissions JSONB DEFAULT '[]'::jsonb,
  joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(org_id, user_id)
);

-- Create indexes for org_memberships
CREATE INDEX IF NOT EXISTS idx_org_memberships_org_id ON org_memberships(org_id);
CREATE INDEX IF NOT EXISTS idx_org_memberships_user_id ON org_memberships(user_id);

-- Note: The following tables were created by running migrations:
-- - organizations (0005_phase_e_multitenancy.sql)
-- - workflow_templates (0007_phase_g_workflow_builder.sql)
-- - workflow_runs (0007_phase_g_workflow_builder.sql)
-- - workflow_run_checkpoints (0007_phase_g_workflow_builder.sql)
