-- =============================================================================
-- Multi-Project Dashboard Enhancement Migration
-- Migration: 0028_multiproject_dashboard
-- Description: Adds milestones table, workflow_runs table, and missing columns
--              for comprehensive multi-project dashboard functionality.
-- =============================================================================

-- =============================================================================
-- Add slug column to projects table (for URL-friendly identifiers)
-- =============================================================================
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'projects' AND column_name = 'slug'
    ) THEN
        ALTER TABLE projects ADD COLUMN slug VARCHAR(100);
        CREATE UNIQUE INDEX idx_projects_slug ON projects(org_id, slug) WHERE slug IS NOT NULL;
    END IF;
END $$;

-- =============================================================================
-- Milestones Table (extracted from hub_goals.milestones JSONB)
-- =============================================================================
CREATE TABLE IF NOT EXISTS milestones (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    goal_id UUID REFERENCES hub_goals(id) ON DELETE SET NULL,
    title VARCHAR(500) NOT NULL,
    description TEXT,
    target_date TIMESTAMPTZ NOT NULL,
    completed_date TIMESTAMPTZ,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'missed')),
    sort_order INTEGER DEFAULT 0,
    linked_task_ids UUID[] DEFAULT '{}',
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_milestones_project ON milestones(project_id);
CREATE INDEX IF NOT EXISTS idx_milestones_goal ON milestones(goal_id);
CREATE INDEX IF NOT EXISTS idx_milestones_target_date ON milestones(target_date);
CREATE INDEX IF NOT EXISTS idx_milestones_status ON milestones(status);

-- =============================================================================
-- Workflow Runs Table (execution history tracking)
-- =============================================================================
CREATE TABLE IF NOT EXISTS workflow_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workflow_id UUID NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
    version_id UUID REFERENCES workflow_versions(id) ON DELETE SET NULL,
    project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed', 'cancelled')),
    trigger_type VARCHAR(20) DEFAULT 'manual' CHECK (trigger_type IN ('manual', 'schedule', 'event', 'api')),
    inputs JSONB DEFAULT '{}'::jsonb,
    outputs JSONB DEFAULT '{}'::jsonb,
    error_message TEXT,
    step_statuses JSONB DEFAULT '[]'::jsonb,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    duration_ms INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_workflow_runs_workflow ON workflow_runs(workflow_id);
CREATE INDEX IF NOT EXISTS idx_workflow_runs_project ON workflow_runs(project_id);
CREATE INDEX IF NOT EXISTS idx_workflow_runs_status ON workflow_runs(status);
CREATE INDEX IF NOT EXISTS idx_workflow_runs_created_at ON workflow_runs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_workflow_runs_started_at ON workflow_runs(started_at DESC);

-- =============================================================================
-- Workflow Run Steps (detailed step-level tracking)
-- =============================================================================
CREATE TABLE IF NOT EXISTS workflow_run_steps (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    run_id UUID NOT NULL REFERENCES workflow_runs(id) ON DELETE CASCADE,
    step_id VARCHAR(100) NOT NULL,
    step_name VARCHAR(255),
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed', 'skipped')),
    inputs JSONB DEFAULT '{}'::jsonb,
    outputs JSONB DEFAULT '{}'::jsonb,
    error_message TEXT,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    duration_ms INTEGER,
    retry_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_workflow_run_steps_run ON workflow_run_steps(run_id);
CREATE INDEX IF NOT EXISTS idx_workflow_run_steps_status ON workflow_run_steps(status);

-- =============================================================================
-- Calendar Events Table (unified calendar view)
-- =============================================================================
CREATE TABLE IF NOT EXISTS calendar_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    title VARCHAR(500) NOT NULL,
    description TEXT,
    event_type VARCHAR(30) NOT NULL CHECK (event_type IN ('task_due', 'milestone', 'goal', 'meeting', 'deadline', 'custom')),
    source_type VARCHAR(30),
    source_id UUID,
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ,
    all_day BOOLEAN DEFAULT FALSE,
    color VARCHAR(20),
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_calendar_events_project ON calendar_events(project_id);
CREATE INDEX IF NOT EXISTS idx_calendar_events_start_time ON calendar_events(start_time);
CREATE INDEX IF NOT EXISTS idx_calendar_events_source ON calendar_events(source_type, source_id);
CREATE INDEX IF NOT EXISTS idx_calendar_events_type ON calendar_events(event_type);

-- =============================================================================
-- Project Activity Log (for dashboard activity feed)
-- =============================================================================
CREATE TABLE IF NOT EXISTS project_activity (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    action VARCHAR(50) NOT NULL,
    entity_type VARCHAR(30) NOT NULL,
    entity_id UUID,
    entity_name VARCHAR(500),
    details JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_project_activity_project ON project_activity(project_id);
CREATE INDEX IF NOT EXISTS idx_project_activity_created_at ON project_activity(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_project_activity_user ON project_activity(user_id);
CREATE INDEX IF NOT EXISTS idx_project_activity_entity ON project_activity(entity_type, entity_id);

-- =============================================================================
-- Triggers for updated_at
-- =============================================================================
DROP TRIGGER IF EXISTS update_milestones_updated_at ON milestones;
CREATE TRIGGER update_milestones_updated_at BEFORE UPDATE ON milestones
    FOR EACH ROW EXECUTE FUNCTION update_hub_updated_at_column();

DROP TRIGGER IF EXISTS update_calendar_events_updated_at ON calendar_events;
CREATE TRIGGER update_calendar_events_updated_at BEFORE UPDATE ON calendar_events
    FOR EACH ROW EXECUTE FUNCTION update_hub_updated_at_column();

-- =============================================================================
-- Comments
-- =============================================================================
COMMENT ON TABLE milestones IS 'Project milestones with task linking and goal association';
COMMENT ON TABLE workflow_runs IS 'Execution history for workflow runs';
COMMENT ON TABLE workflow_run_steps IS 'Step-level details for workflow runs';
COMMENT ON TABLE calendar_events IS 'Unified calendar events from tasks, milestones, goals';
COMMENT ON TABLE project_activity IS 'Activity log for project dashboard feed';

-- =============================================================================
-- Helper function to sync calendar events from tasks/milestones/goals
-- =============================================================================
CREATE OR REPLACE FUNCTION sync_task_to_calendar()
RETURNS TRIGGER AS $$
BEGIN
    -- Delete existing calendar event for this task
    DELETE FROM calendar_events
    WHERE source_type = 'task' AND source_id = NEW.id;

    -- Create new calendar event if task has a due date
    IF NEW.due_date IS NOT NULL AND NEW.status NOT IN ('done', 'cancelled') THEN
        INSERT INTO calendar_events (
            project_id, title, event_type, source_type, source_id,
            start_time, all_day, created_by
        ) VALUES (
            NEW.project_id, NEW.title, 'task_due', 'task', NEW.id,
            NEW.due_date, TRUE, NEW.created_by
        );
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS sync_task_calendar ON hub_tasks;
CREATE TRIGGER sync_task_calendar AFTER INSERT OR UPDATE ON hub_tasks
    FOR EACH ROW EXECUTE FUNCTION sync_task_to_calendar();

CREATE OR REPLACE FUNCTION sync_milestone_to_calendar()
RETURNS TRIGGER AS $$
BEGIN
    -- Delete existing calendar event for this milestone
    DELETE FROM calendar_events
    WHERE source_type = 'milestone' AND source_id = NEW.id;

    -- Create new calendar event if milestone not completed
    IF NEW.status NOT IN ('completed', 'missed') THEN
        INSERT INTO calendar_events (
            project_id, title, event_type, source_type, source_id,
            start_time, all_day, created_by
        ) VALUES (
            NEW.project_id, NEW.title, 'milestone', 'milestone', NEW.id,
            NEW.target_date, TRUE, NEW.created_by
        );
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS sync_milestone_calendar ON milestones;
CREATE TRIGGER sync_milestone_calendar AFTER INSERT OR UPDATE ON milestones
    FOR EACH ROW EXECUTE FUNCTION sync_milestone_to_calendar();

CREATE OR REPLACE FUNCTION sync_goal_to_calendar()
RETURNS TRIGGER AS $$
BEGIN
    -- Delete existing calendar event for this goal
    DELETE FROM calendar_events
    WHERE source_type = 'goal' AND source_id = NEW.id;

    -- Create new calendar event if goal not achieved
    IF NEW.status NOT IN ('achieved', 'abandoned') THEN
        INSERT INTO calendar_events (
            project_id, title, event_type, source_type, source_id,
            start_time, all_day, created_by
        ) VALUES (
            NEW.project_id, NEW.title, 'goal', 'goal', NEW.id,
            NEW.target_date, TRUE, NEW.created_by
        );
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS sync_goal_calendar ON hub_goals;
CREATE TRIGGER sync_goal_calendar AFTER INSERT OR UPDATE ON hub_goals
    FOR EACH ROW EXECUTE FUNCTION sync_goal_to_calendar();
