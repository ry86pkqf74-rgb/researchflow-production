-- Migration: Cumulative Workflow Data Tables
-- Purpose: Enable data flow between stages in the 20-stage research workflow
-- Fixes: Information not transferring between workflow stages in LIVE mode
-- Date: 2026-01-27

-- ============================================================================
-- PROJECT MANIFESTS: Stores cumulative state for each project/research session
-- ============================================================================
CREATE TABLE IF NOT EXISTS project_manifests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID,
    research_id VARCHAR(255),
    user_id VARCHAR(255),
    current_stage INTEGER NOT NULL DEFAULT 1,
    governance_mode VARCHAR(10) NOT NULL DEFAULT 'DEMO',
    cumulative_data JSONB NOT NULL DEFAULT '{}',
    phi_schemas JSONB DEFAULT '{}',
    workflow_config JSONB DEFAULT '{}',
    status VARCHAR(20) NOT NULL DEFAULT 'active',
    started_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    -- Allow either project_id or research_id as identifier
    CONSTRAINT manifest_identifier CHECK (project_id IS NOT NULL OR research_id IS NOT NULL)
);

-- Create unique index for project-based manifests
CREATE UNIQUE INDEX IF NOT EXISTS idx_manifest_project_unique
    ON project_manifests(project_id) WHERE project_id IS NOT NULL;

-- Create unique index for research-based manifests
CREATE UNIQUE INDEX IF NOT EXISTS idx_manifest_research_unique
    ON project_manifests(research_id) WHERE research_id IS NOT NULL;

-- ============================================================================
-- STAGE OUTPUTS: Individual stage results with inputs and outputs
-- ============================================================================
CREATE TABLE IF NOT EXISTS stage_outputs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    manifest_id UUID NOT NULL REFERENCES project_manifests(id) ON DELETE CASCADE,
    project_id UUID,
    research_id VARCHAR(255),
    stage_number INTEGER NOT NULL,
    stage_name VARCHAR(100) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    input_data JSONB DEFAULT '{}',
    output_data JSONB DEFAULT '{}',
    artifacts JSONB DEFAULT '[]',
    ai_calls JSONB DEFAULT '[]',
    error_message TEXT,
    execution_time_ms INTEGER,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),

    -- Prevent duplicate stages per manifest
    UNIQUE(manifest_id, stage_number)
);

-- ============================================================================
-- STAGE ARTIFACTS: Track generated files and outputs per stage
-- ============================================================================
CREATE TABLE IF NOT EXISTS stage_artifacts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    stage_output_id UUID NOT NULL REFERENCES stage_outputs(id) ON DELETE CASCADE,
    manifest_id UUID NOT NULL REFERENCES project_manifests(id) ON DELETE CASCADE,
    artifact_type VARCHAR(50) NOT NULL, -- 'document', 'table', 'figure', 'data', 'schema'
    artifact_name VARCHAR(255) NOT NULL,
    file_path TEXT,
    content_hash VARCHAR(64),
    size_bytes BIGINT,
    mime_type VARCHAR(100),
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- WORKFLOW STATE TRANSITIONS: Audit trail for state changes
-- ============================================================================
CREATE TABLE IF NOT EXISTS workflow_state_transitions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    manifest_id UUID NOT NULL REFERENCES project_manifests(id) ON DELETE CASCADE,
    from_stage INTEGER,
    to_stage INTEGER NOT NULL,
    from_status VARCHAR(20),
    to_status VARCHAR(20) NOT NULL,
    triggered_by VARCHAR(255), -- user_id or 'system'
    governance_mode VARCHAR(10),
    transition_data JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- INDEXES FOR PERFORMANCE
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_manifest_project ON project_manifests(project_id);
CREATE INDEX IF NOT EXISTS idx_manifest_research ON project_manifests(research_id);
CREATE INDEX IF NOT EXISTS idx_manifest_user ON project_manifests(user_id);
CREATE INDEX IF NOT EXISTS idx_manifest_status ON project_manifests(status);
CREATE INDEX IF NOT EXISTS idx_manifest_governance ON project_manifests(governance_mode);

CREATE INDEX IF NOT EXISTS idx_stage_outputs_manifest ON stage_outputs(manifest_id);
CREATE INDEX IF NOT EXISTS idx_stage_outputs_stage ON stage_outputs(stage_number);
CREATE INDEX IF NOT EXISTS idx_stage_outputs_status ON stage_outputs(status);
CREATE INDEX IF NOT EXISTS idx_stage_outputs_project ON stage_outputs(project_id);
CREATE INDEX IF NOT EXISTS idx_stage_outputs_research ON stage_outputs(research_id);

CREATE INDEX IF NOT EXISTS idx_stage_artifacts_output ON stage_artifacts(stage_output_id);
CREATE INDEX IF NOT EXISTS idx_stage_artifacts_manifest ON stage_artifacts(manifest_id);
CREATE INDEX IF NOT EXISTS idx_stage_artifacts_type ON stage_artifacts(artifact_type);

CREATE INDEX IF NOT EXISTS idx_transitions_manifest ON workflow_state_transitions(manifest_id);
CREATE INDEX IF NOT EXISTS idx_transitions_created ON workflow_state_transitions(created_at);

-- ============================================================================
-- FUNCTION: Get cumulative data from all prior stages
-- ============================================================================
CREATE OR REPLACE FUNCTION get_cumulative_stage_data(p_manifest_id UUID, p_up_to_stage INTEGER)
RETURNS JSONB AS $$
DECLARE
    result JSONB := '{}';
    stage_record RECORD;
BEGIN
    FOR stage_record IN
        SELECT stage_number, stage_name, output_data, artifacts
        FROM stage_outputs
        WHERE manifest_id = p_manifest_id
          AND stage_number < p_up_to_stage
          AND status = 'completed'
        ORDER BY stage_number
    LOOP
        result := result || jsonb_build_object(
            'stage_' || stage_record.stage_number,
            jsonb_build_object(
                'name', stage_record.stage_name,
                'data', stage_record.output_data,
                'artifacts', stage_record.artifacts
            )
        );
    END LOOP;
    RETURN result;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- FUNCTION: Get specific stage output by name or number
-- ============================================================================
CREATE OR REPLACE FUNCTION get_stage_output(
    p_manifest_id UUID,
    p_stage_identifier TEXT
)
RETURNS JSONB AS $$
DECLARE
    stage_record RECORD;
    stage_num INTEGER;
BEGIN
    -- Try to parse as number first
    BEGIN
        stage_num := p_stage_identifier::INTEGER;
        SELECT output_data, artifacts INTO stage_record
        FROM stage_outputs
        WHERE manifest_id = p_manifest_id
          AND stage_number = stage_num
          AND status = 'completed'
        LIMIT 1;
    EXCEPTION WHEN OTHERS THEN
        -- If not a number, search by name
        SELECT output_data, artifacts INTO stage_record
        FROM stage_outputs
        WHERE manifest_id = p_manifest_id
          AND stage_name = p_stage_identifier
          AND status = 'completed'
        LIMIT 1;
    END;

    IF stage_record IS NULL THEN
        RETURN NULL;
    END IF;

    RETURN jsonb_build_object(
        'data', stage_record.output_data,
        'artifacts', stage_record.artifacts
    );
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- TRIGGER: Auto-update manifest when stage completes
-- ============================================================================
CREATE OR REPLACE FUNCTION update_manifest_on_stage_complete()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status = 'completed' AND (OLD IS NULL OR OLD.status != 'completed') THEN
        UPDATE project_manifests
        SET
            cumulative_data = cumulative_data || jsonb_build_object(
                'stage_' || NEW.stage_number,
                jsonb_build_object(
                    'name', NEW.stage_name,
                    'data', NEW.output_data,
                    'artifacts', NEW.artifacts,
                    'completed_at', NEW.completed_at
                )
            ),
            current_stage = GREATEST(current_stage, NEW.stage_number + 1),
            updated_at = NOW()
        WHERE id = NEW.manifest_id;

        -- Record state transition
        INSERT INTO workflow_state_transitions (
            manifest_id, from_stage, to_stage, from_status, to_status, triggered_by
        ) VALUES (
            NEW.manifest_id,
            NEW.stage_number,
            NEW.stage_number + 1,
            OLD.status,
            NEW.status,
            'system'
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_manifest_on_complete ON stage_outputs;
CREATE TRIGGER trigger_update_manifest_on_complete
    AFTER INSERT OR UPDATE ON stage_outputs
    FOR EACH ROW
    EXECUTE FUNCTION update_manifest_on_stage_complete();

-- ============================================================================
-- TRIGGER: Auto-update manifest timestamp on any change
-- ============================================================================
CREATE OR REPLACE FUNCTION update_manifest_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_manifest_timestamp ON project_manifests;
CREATE TRIGGER trigger_manifest_timestamp
    BEFORE UPDATE ON project_manifests
    FOR EACH ROW
    EXECUTE FUNCTION update_manifest_timestamp();

-- ============================================================================
-- COMMENTS FOR DOCUMENTATION
-- ============================================================================
COMMENT ON TABLE project_manifests IS 'Cumulative state tracking for research workflows. Stores all data that flows between stages.';
COMMENT ON TABLE stage_outputs IS 'Individual stage execution results with inputs, outputs, and artifacts.';
COMMENT ON TABLE stage_artifacts IS 'Generated files and outputs from each stage execution.';
COMMENT ON TABLE workflow_state_transitions IS 'Audit trail of all workflow state changes.';
COMMENT ON FUNCTION get_cumulative_stage_data IS 'Returns accumulated output data from all stages prior to specified stage number.';
COMMENT ON FUNCTION get_stage_output IS 'Returns output data from a specific stage by number or name.';
