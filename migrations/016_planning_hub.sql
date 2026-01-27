-- =============================================================================
-- Planning Hub Tables for ResearchFlow
-- Migration: 016_planning_hub
-- Description: Notion-like pages, databases, tasks, goals, and timeline projections
-- =============================================================================

-- =============================================================================
-- Hub Pages (Notion-like pages)
-- =============================================================================
CREATE TABLE IF NOT EXISTS hub_pages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    parent_id UUID REFERENCES hub_pages(id) ON DELETE SET NULL,
    title VARCHAR(500) NOT NULL,
    icon VARCHAR(10),
    cover_url VARCHAR(2000),
    blocks JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID NOT NULL,
    is_archived BOOLEAN DEFAULT FALSE,
    phi_detected BOOLEAN DEFAULT FALSE,
    phi_categories TEXT[] DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_hub_pages_project ON hub_pages(project_id);
CREATE INDEX IF NOT EXISTS idx_hub_pages_parent ON hub_pages(parent_id);
CREATE INDEX IF NOT EXISTS idx_hub_pages_created_by ON hub_pages(created_by);
CREATE INDEX IF NOT EXISTS idx_hub_pages_archived ON hub_pages(is_archived) WHERE is_archived = FALSE;

-- =============================================================================
-- Hub Databases (Notion-like databases)
-- =============================================================================
CREATE TABLE IF NOT EXISTS hub_databases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    title VARCHAR(500) NOT NULL,
    description VARCHAR(2000),
    properties JSONB DEFAULT '[]'::jsonb,
    default_view VARCHAR(20) DEFAULT 'table',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID NOT NULL,
    is_archived BOOLEAN DEFAULT FALSE
);

CREATE INDEX IF NOT EXISTS idx_hub_databases_project ON hub_databases(project_id);
CREATE INDEX IF NOT EXISTS idx_hub_databases_archived ON hub_databases(is_archived) WHERE is_archived = FALSE;

-- =============================================================================
-- Hub Records (rows in hub databases)
-- =============================================================================
CREATE TABLE IF NOT EXISTS hub_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    database_id UUID NOT NULL REFERENCES hub_databases(id) ON DELETE CASCADE,
    properties JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID NOT NULL,
    is_archived BOOLEAN DEFAULT FALSE,
    phi_detected BOOLEAN DEFAULT FALSE
);

CREATE INDEX IF NOT EXISTS idx_hub_records_database ON hub_records(database_id);
CREATE INDEX IF NOT EXISTS idx_hub_records_properties ON hub_records USING GIN (properties);
CREATE INDEX IF NOT EXISTS idx_hub_records_archived ON hub_records(is_archived) WHERE is_archived = FALSE;

-- =============================================================================
-- Hub Tasks (structured tasks with workflow integration)
-- =============================================================================
CREATE TABLE IF NOT EXISTS hub_tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    database_id UUID REFERENCES hub_databases(id) ON DELETE SET NULL,
    title VARCHAR(500) NOT NULL,
    description TEXT,
    status VARCHAR(20) DEFAULT 'todo',
    priority INTEGER DEFAULT 0 CHECK (priority >= 0 AND priority <= 5),
    assignee_id UUID,
    due_date TIMESTAMPTZ,
    start_date TIMESTAMPTZ,
    estimated_hours DECIMAL(10,2),
    actual_hours DECIMAL(10,2),
    -- Workflow integration
    workflow_stage_id UUID,
    workflow_job_id UUID,
    artifact_id UUID,
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    created_by UUID NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_hub_tasks_project ON hub_tasks(project_id);
CREATE INDEX IF NOT EXISTS idx_hub_tasks_database ON hub_tasks(database_id);
CREATE INDEX IF NOT EXISTS idx_hub_tasks_status ON hub_tasks(status);
CREATE INDEX IF NOT EXISTS idx_hub_tasks_assignee ON hub_tasks(assignee_id);
CREATE INDEX IF NOT EXISTS idx_hub_tasks_due_date ON hub_tasks(due_date);
CREATE INDEX IF NOT EXISTS idx_hub_tasks_workflow_stage ON hub_tasks(workflow_stage_id);

-- =============================================================================
-- Hub Goals
-- =============================================================================
CREATE TABLE IF NOT EXISTS hub_goals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    title VARCHAR(500) NOT NULL,
    description TEXT,
    target_date TIMESTAMPTZ NOT NULL,
    status VARCHAR(20) DEFAULT 'on_track',
    progress INTEGER DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
    milestones JSONB DEFAULT '[]'::jsonb,
    linked_task_ids UUID[] DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_hub_goals_project ON hub_goals(project_id);
CREATE INDEX IF NOT EXISTS idx_hub_goals_target_date ON hub_goals(target_date);
CREATE INDEX IF NOT EXISTS idx_hub_goals_status ON hub_goals(status);

-- =============================================================================
-- Hub Links (graph edges between entities)
-- =============================================================================
CREATE TABLE IF NOT EXISTS hub_links (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    source_type VARCHAR(20) NOT NULL,
    source_id UUID NOT NULL,
    target_type VARCHAR(20) NOT NULL,
    target_id UUID NOT NULL,
    link_type VARCHAR(20) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID NOT NULL,
    UNIQUE(source_type, source_id, target_type, target_id, link_type)
);

CREATE INDEX IF NOT EXISTS idx_hub_links_project ON hub_links(project_id);
CREATE INDEX IF NOT EXISTS idx_hub_links_source ON hub_links(source_type, source_id);
CREATE INDEX IF NOT EXISTS idx_hub_links_target ON hub_links(target_type, target_id);

-- =============================================================================
-- Hub Workflow Links (ties hub objects to ROS workflow)
-- =============================================================================
CREATE TABLE IF NOT EXISTS hub_workflow_links (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    hub_entity_type VARCHAR(20) NOT NULL,
    hub_entity_id UUID NOT NULL,
    workflow_entity_type VARCHAR(20) NOT NULL,
    workflow_entity_id UUID NOT NULL,
    link_behavior VARCHAR(30) DEFAULT 'sync_status',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID NOT NULL,
    UNIQUE(hub_entity_id, workflow_entity_id)
);

CREATE INDEX IF NOT EXISTS idx_hub_workflow_links_project ON hub_workflow_links(project_id);
CREATE INDEX IF NOT EXISTS idx_hub_workflow_links_hub ON hub_workflow_links(hub_entity_type, hub_entity_id);
CREATE INDEX IF NOT EXISTS idx_hub_workflow_links_workflow ON hub_workflow_links(workflow_entity_type, workflow_entity_id);

-- =============================================================================
-- Hub Projection Runs (async timeline projection jobs)
-- =============================================================================
CREATE TABLE IF NOT EXISTS hub_projection_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    status VARCHAR(20) DEFAULT 'pending',
    input_params JSONB NOT NULL,
    started_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    created_by UUID NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_hub_projection_runs_project ON hub_projection_runs(project_id);
CREATE INDEX IF NOT EXISTS idx_hub_projection_runs_status ON hub_projection_runs(status);

-- =============================================================================
-- Hub Projection Outputs (projection results)
-- =============================================================================
CREATE TABLE IF NOT EXISTS hub_projection_outputs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    run_id UUID NOT NULL REFERENCES hub_projection_runs(id) ON DELETE CASCADE,
    results JSONB,
    error TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_hub_projection_outputs_run ON hub_projection_outputs(run_id);

-- =============================================================================
-- Triggers for updated_at
-- =============================================================================
CREATE OR REPLACE FUNCTION update_hub_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_hub_pages_updated_at ON hub_pages;
CREATE TRIGGER update_hub_pages_updated_at BEFORE UPDATE ON hub_pages
    FOR EACH ROW EXECUTE FUNCTION update_hub_updated_at_column();

DROP TRIGGER IF EXISTS update_hub_databases_updated_at ON hub_databases;
CREATE TRIGGER update_hub_databases_updated_at BEFORE UPDATE ON hub_databases
    FOR EACH ROW EXECUTE FUNCTION update_hub_updated_at_column();

DROP TRIGGER IF EXISTS update_hub_records_updated_at ON hub_records;
CREATE TRIGGER update_hub_records_updated_at BEFORE UPDATE ON hub_records
    FOR EACH ROW EXECUTE FUNCTION update_hub_updated_at_column();

DROP TRIGGER IF EXISTS update_hub_tasks_updated_at ON hub_tasks;
CREATE TRIGGER update_hub_tasks_updated_at BEFORE UPDATE ON hub_tasks
    FOR EACH ROW EXECUTE FUNCTION update_hub_updated_at_column();

DROP TRIGGER IF EXISTS update_hub_goals_updated_at ON hub_goals;
CREATE TRIGGER update_hub_goals_updated_at BEFORE UPDATE ON hub_goals
    FOR EACH ROW EXECUTE FUNCTION update_hub_updated_at_column();

-- =============================================================================
-- Comments
-- =============================================================================
COMMENT ON TABLE hub_pages IS 'Notion-like pages with hierarchical structure and rich content blocks';
COMMENT ON TABLE hub_databases IS 'Flexible databases with customizable properties (like Notion databases)';
COMMENT ON TABLE hub_records IS 'Records/rows within hub databases';
COMMENT ON TABLE hub_tasks IS 'Structured tasks with workflow integration and time tracking';
COMMENT ON TABLE hub_goals IS 'High-level goals with milestones and task linking';
COMMENT ON TABLE hub_links IS 'Graph edges connecting hub entities';
COMMENT ON TABLE hub_workflow_links IS 'Links between hub entities and ROS workflow stages/jobs/artifacts';
COMMENT ON TABLE hub_projection_runs IS 'Async timeline projection job runs';
COMMENT ON TABLE hub_projection_outputs IS 'Results from timeline projection runs';
