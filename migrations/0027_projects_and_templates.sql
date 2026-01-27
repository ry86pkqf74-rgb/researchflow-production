-- =============================================================================
-- Projects and Templates Migration
-- Migration: 0027_projects_and_templates
-- Description: Creates projects table for multi-project organization
-- =============================================================================

-- =============================================================================
-- Projects Table (distinct from research_projects for flexibility)
-- =============================================================================
CREATE TABLE IF NOT EXISTS projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    org_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'active'
        CHECK (status IN ('active', 'completed', 'archived')),
    settings JSONB DEFAULT '{}'::jsonb,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_projects_owner ON projects(owner_id);
CREATE INDEX IF NOT EXISTS idx_projects_org ON projects(org_id);
CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status);

-- =============================================================================
-- Project Workflows Junction Table
-- =============================================================================
CREATE TABLE IF NOT EXISTS project_workflows (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    workflow_id UUID NOT NULL,
    added_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    added_by UUID REFERENCES users(id),
    UNIQUE(project_id, workflow_id)
);

CREATE INDEX IF NOT EXISTS idx_project_workflows_project ON project_workflows(project_id);
CREATE INDEX IF NOT EXISTS idx_project_workflows_workflow ON project_workflows(workflow_id);

-- =============================================================================
-- Project Members Table for Team Collaboration
-- =============================================================================
CREATE TABLE IF NOT EXISTS project_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(20) NOT NULL DEFAULT 'member'
        CHECK (role IN ('owner', 'admin', 'member', 'viewer')),
    joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(project_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_project_members_project ON project_members(project_id);
CREATE INDEX IF NOT EXISTS idx_project_members_user ON project_members(user_id);

-- =============================================================================
-- Triggers for updated_at
-- =============================================================================
CREATE OR REPLACE FUNCTION update_project_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_projects_updated_at ON projects;
CREATE TRIGGER update_projects_updated_at
    BEFORE UPDATE ON projects
    FOR EACH ROW EXECUTE FUNCTION update_project_updated_at_column();

-- =============================================================================
-- Seed Default Workflow Templates (if not already present)
-- =============================================================================
INSERT INTO workflow_templates (key, name, description, category, definition, is_active)
SELECT 'clinical_research', 'Clinical Research', 'Full 20-stage clinical research workflow', 'Research',
       '{"stages": 20, "phiEnabled": true}'::jsonb, TRUE
WHERE NOT EXISTS (SELECT 1 FROM workflow_templates WHERE key = 'clinical_research');

INSERT INTO workflow_templates (key, name, description, category, definition, is_active)
SELECT 'quick_analysis', 'Quick Analysis', 'Streamlined analysis workflow (stages 6-12)', 'Analysis',
       '{"stages": 7, "phiEnabled": true}'::jsonb, TRUE
WHERE NOT EXISTS (SELECT 1 FROM workflow_templates WHERE key = 'quick_analysis');

INSERT INTO workflow_templates (key, name, description, category, definition, is_active)
SELECT 'literature_review', 'Literature Review', 'Literature-focused workflow', 'Literature',
       '{"stages": 5, "phiEnabled": false}'::jsonb, TRUE
WHERE NOT EXISTS (SELECT 1 FROM workflow_templates WHERE key = 'literature_review');

-- =============================================================================
-- Comments
-- =============================================================================
COMMENT ON TABLE projects IS 'Multi-project organization for research workflows';
COMMENT ON TABLE project_workflows IS 'Links projects to their constituent workflows';
COMMENT ON TABLE project_members IS 'Team members and their roles within projects';
