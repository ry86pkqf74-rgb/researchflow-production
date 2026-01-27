-- ResearchFlow Production Database Initialization
-- ================================================
-- Updated to match Drizzle ORM schema (VARCHAR types for IDs)

-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "vector";  -- pgvector for AI embeddings

-- ====================
-- Core Tables (matching Drizzle schema with VARCHAR IDs)
-- ====================

-- Users Table (from auth.ts)
CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(255) PRIMARY KEY DEFAULT gen_random_uuid()::text,
    email VARCHAR(255) UNIQUE,
    first_name VARCHAR(255),
    last_name VARCHAR(255),
    profile_image_url VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Sessions Table (from auth.ts)
CREATE TABLE IF NOT EXISTS sessions (
    id VARCHAR(255) PRIMARY KEY DEFAULT gen_random_uuid()::text,
    user_id VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);

-- Organizations Table
CREATE TABLE IF NOT EXISTS organizations (
    id VARCHAR(255) PRIMARY KEY DEFAULT gen_random_uuid()::text,
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    logo_url TEXT,
    settings JSONB DEFAULT '{}',
    billing_email VARCHAR(255),
    subscription_tier VARCHAR(50) NOT NULL DEFAULT 'FREE',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- Conversations Table
CREATE TABLE IF NOT EXISTS conversations (
    id SERIAL PRIMARY KEY,
    title TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- Messages Table
CREATE TABLE IF NOT EXISTS messages (
    id SERIAL PRIMARY KEY,
    conversation_id INTEGER NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    role TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- Artifacts Table
CREATE TABLE IF NOT EXISTS artifacts (
    id VARCHAR(255) PRIMARY KEY DEFAULT gen_random_uuid()::text,
    research_id VARCHAR(255) NOT NULL,
    stage_id VARCHAR(255) NOT NULL,
    artifact_type TEXT NOT NULL,
    filename TEXT NOT NULL,
    mime_type TEXT NOT NULL,
    content TEXT NOT NULL,
    size_bytes INTEGER NOT NULL,
    sha256_hash VARCHAR(255) NOT NULL,
    created_by VARCHAR(255) NOT NULL,
    current_version_id VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- Artifact Versions Table
CREATE TABLE IF NOT EXISTS artifact_versions (
    id VARCHAR(255) PRIMARY KEY DEFAULT gen_random_uuid()::text,
    artifact_id VARCHAR(255) NOT NULL REFERENCES artifacts(id) ON DELETE CASCADE,
    version_number INTEGER NOT NULL,
    content TEXT NOT NULL,
    size_bytes INTEGER NOT NULL,
    sha256_hash VARCHAR(255) NOT NULL,
    created_by VARCHAR(255) NOT NULL,
    change_description TEXT NOT NULL,
    branch VARCHAR(100) NOT NULL DEFAULT 'main',
    parent_version_id VARCHAR(255),
    metadata JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- File Uploads Table
CREATE TABLE IF NOT EXISTS file_uploads (
    id VARCHAR(255) PRIMARY KEY DEFAULT gen_random_uuid()::text,
    research_id VARCHAR(255),
    original_filename TEXT NOT NULL,
    stored_filename TEXT NOT NULL,
    mime_type TEXT NOT NULL,
    size_bytes INTEGER NOT NULL,
    sha256_hash VARCHAR(255) NOT NULL,
    uploaded_by VARCHAR(255) NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    phi_scan_status TEXT DEFAULT 'pending',
    phi_scan_result JSONB,
    metadata JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- Research Sessions Table
CREATE TABLE IF NOT EXISTS research_sessions (
    id VARCHAR(255) PRIMARY KEY DEFAULT gen_random_uuid()::text,
    research_id VARCHAR(255) NOT NULL,
    user_id VARCHAR(255) NOT NULL,
    current_stage INTEGER NOT NULL DEFAULT 1,
    status TEXT NOT NULL DEFAULT 'active',
    variables JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- Research Projects Table
CREATE TABLE IF NOT EXISTS research_projects (
    id VARCHAR(255) PRIMARY KEY DEFAULT gen_random_uuid()::text,
    research_id VARCHAR(255) UNIQUE NOT NULL,
    title VARCHAR(500) NOT NULL,
    description TEXT,
    owner_id VARCHAR(255),
    org_id VARCHAR(255),
    status VARCHAR(50) DEFAULT 'draft',
    governance_mode VARCHAR(20) DEFAULT 'DEMO',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- User Roles Table
CREATE TABLE IF NOT EXISTS user_roles (
    id VARCHAR(255) PRIMARY KEY DEFAULT gen_random_uuid()::text,
    user_id VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(50) NOT NULL,
    assigned_by VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- Approval Gates Table
CREATE TABLE IF NOT EXISTS approval_gates (
    id VARCHAR(255) PRIMARY KEY DEFAULT gen_random_uuid()::text,
    research_id VARCHAR(255) NOT NULL,
    stage_id VARCHAR(255) NOT NULL,
    operation_type VARCHAR(100) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'PENDING',
    requested_by VARCHAR(255) NOT NULL,
    assigned_to VARCHAR(255),
    approved_by VARCHAR(255),
    rejection_reason TEXT,
    escalation_level INTEGER NOT NULL DEFAULT 0,
    auto_expire_at TIMESTAMP,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- Audit Logs Table
CREATE TABLE IF NOT EXISTS audit_logs (
    id SERIAL PRIMARY KEY,
    event_type TEXT NOT NULL,
    user_id VARCHAR(255) REFERENCES users(id),
    resource_type TEXT,
    resource_id VARCHAR(255),
    action TEXT NOT NULL,
    details JSONB,
    ip_address VARCHAR(45),
    user_agent TEXT,
    session_id VARCHAR(255),
    research_id VARCHAR(255),
    previous_hash VARCHAR(64),
    entry_hash VARCHAR(64),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_event_type ON audit_logs(event_type);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at);

-- PHI Incidents Table
CREATE TABLE IF NOT EXISTS phi_incidents (
    id VARCHAR(255) PRIMARY KEY DEFAULT gen_random_uuid()::text,
    research_id VARCHAR(255) NOT NULL,
    stage_id VARCHAR(255) NOT NULL,
    incident_type TEXT NOT NULL,
    description TEXT NOT NULL,
    severity VARCHAR(20) NOT NULL,
    source TEXT NOT NULL,
    phi_types JSONB NOT NULL DEFAULT '[]',
    resolution_status VARCHAR(50) NOT NULL DEFAULT 'open',
    resolution_notes TEXT,
    resolved_by VARCHAR(255),
    resolved_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- ====================
-- AI Integration Tables
-- ====================

-- AI Invocations Table
CREATE TABLE IF NOT EXISTS ai_invocations (
    id VARCHAR(255) PRIMARY KEY DEFAULT gen_random_uuid()::text,
    research_id VARCHAR(255),
    stage_id VARCHAR(255),
    operation VARCHAR(100) NOT NULL,
    model_tier VARCHAR(20) NOT NULL,
    model_id VARCHAR(100) NOT NULL,
    input_tokens INTEGER,
    output_tokens INTEGER,
    latency_ms INTEGER,
    cost_usd DECIMAL(10, 6),
    cache_hit BOOLEAN DEFAULT FALSE,
    escalated_from VARCHAR(20),
    invoked_by VARCHAR(255),
    input_snapshot JSONB,
    output_snapshot JSONB,
    success BOOLEAN NOT NULL DEFAULT TRUE,
    error_message TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_ai_invocations_research ON ai_invocations(research_id);
CREATE INDEX IF NOT EXISTS idx_ai_invocations_created_at ON ai_invocations(created_at);

-- ====================
-- Feature Flags & Experiments
-- ====================

-- Feature Flags Table
CREATE TABLE IF NOT EXISTS feature_flags (
    key VARCHAR(100) PRIMARY KEY,
    flag_key VARCHAR(100) UNIQUE,
    enabled BOOLEAN NOT NULL DEFAULT FALSE,
    description TEXT,
    scope VARCHAR(50) NOT NULL DEFAULT 'product',
    required_modes JSONB DEFAULT '[]',
    rollout_percent INTEGER NOT NULL DEFAULT 100 CHECK (rollout_percent >= 0 AND rollout_percent <= 100),
    updated_by VARCHAR(255) REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_feature_flags_scope ON feature_flags(scope);
CREATE INDEX IF NOT EXISTS idx_feature_flags_enabled ON feature_flags(enabled) WHERE enabled = TRUE;

-- Experiments Table
CREATE TABLE IF NOT EXISTS experiments (
    key VARCHAR(100) PRIMARY KEY,
    enabled BOOLEAN NOT NULL DEFAULT FALSE,
    description TEXT,
    variants JSONB NOT NULL DEFAULT '{}',
    allocation JSONB NOT NULL DEFAULT '{}',
    required_modes JSONB DEFAULT '[]',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- Experiment Assignments Table
CREATE TABLE IF NOT EXISTS experiment_assignments (
    id VARCHAR(255) PRIMARY KEY DEFAULT gen_random_uuid()::text,
    experiment_key VARCHAR(100) NOT NULL REFERENCES experiments(key) ON DELETE CASCADE,
    user_id VARCHAR(255) REFERENCES users(id) ON DELETE SET NULL,
    session_id VARCHAR(255),
    variant VARCHAR(50) NOT NULL,
    assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (experiment_key, user_id, session_id)
);

-- Analytics Events Table
CREATE TABLE IF NOT EXISTS analytics_events (
    id VARCHAR(255) PRIMARY KEY DEFAULT gen_random_uuid()::text,
    event_name VARCHAR(120) NOT NULL,
    user_id VARCHAR(255) REFERENCES users(id) ON DELETE SET NULL,
    session_id VARCHAR(255),
    research_id VARCHAR(255),
    mode VARCHAR(20) NOT NULL,
    properties JSONB DEFAULT '{}',
    ip_hash VARCHAR(64),
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_analytics_events_name ON analytics_events(event_name, created_at);
CREATE INDEX IF NOT EXISTS idx_analytics_events_user ON analytics_events(user_id, created_at);

-- Governance Config Table
CREATE TABLE IF NOT EXISTS governance_config (
    key VARCHAR(100) PRIMARY KEY,
    value JSONB NOT NULL DEFAULT '{}',
    updated_by VARCHAR(255) REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- ====================
-- Phase G: Workflow Builder Tables (matching Drizzle schema)
-- ====================

-- Workflows Table (metadata)
CREATE TABLE IF NOT EXISTS workflows (
    id VARCHAR(255) PRIMARY KEY DEFAULT gen_random_uuid()::text,
    org_id VARCHAR(255) REFERENCES organizations(id) ON DELETE SET NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    status VARCHAR(50) NOT NULL DEFAULT 'draft',
    created_by VARCHAR(255) REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_workflows_org ON workflows(org_id);
CREATE INDEX IF NOT EXISTS idx_workflows_status ON workflows(status);
CREATE INDEX IF NOT EXISTS idx_workflows_created_by ON workflows(created_by);

-- Workflow Versions Table (immutable versions)
CREATE TABLE IF NOT EXISTS workflow_versions (
    id VARCHAR(255) PRIMARY KEY DEFAULT gen_random_uuid()::text,
    workflow_id VARCHAR(255) NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
    version INTEGER NOT NULL,
    definition JSONB NOT NULL,
    changelog TEXT,
    created_by VARCHAR(255) REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    UNIQUE(workflow_id, version)
);

CREATE INDEX IF NOT EXISTS idx_workflow_versions_workflow ON workflow_versions(workflow_id);
CREATE INDEX IF NOT EXISTS idx_workflow_versions_version ON workflow_versions(workflow_id, version);

-- Workflow Templates Table (seeded templates)
CREATE TABLE IF NOT EXISTS workflow_templates (
    key VARCHAR(100) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    definition JSONB NOT NULL,
    category VARCHAR(100) DEFAULT 'general',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_workflow_templates_category ON workflow_templates(category);
CREATE INDEX IF NOT EXISTS idx_workflow_templates_active ON workflow_templates(is_active) WHERE is_active = TRUE;

-- Workflow Policies Table (RBAC per workflow)
CREATE TABLE IF NOT EXISTS workflow_policies (
    workflow_id VARCHAR(255) PRIMARY KEY REFERENCES workflows(id) ON DELETE CASCADE,
    policy JSONB NOT NULL DEFAULT '{}',
    updated_by VARCHAR(255) REFERENCES users(id),
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- Workflow Run Checkpoints Table (resume capability)
CREATE TABLE IF NOT EXISTS workflow_run_checkpoints (
    id VARCHAR(255) PRIMARY KEY DEFAULT gen_random_uuid()::text,
    run_id VARCHAR(255) NOT NULL,
    workflow_id VARCHAR(255) NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
    workflow_version INTEGER NOT NULL,
    current_node_id VARCHAR(255) NOT NULL,
    completed_nodes JSONB NOT NULL DEFAULT '[]',
    node_outputs JSONB NOT NULL DEFAULT '{}',
    status VARCHAR(50) NOT NULL DEFAULT 'running',
    error_message TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_workflow_checkpoints_run ON workflow_run_checkpoints(run_id);
CREATE INDEX IF NOT EXISTS idx_workflow_checkpoints_workflow ON workflow_run_checkpoints(workflow_id);
CREATE INDEX IF NOT EXISTS idx_workflow_checkpoints_status ON workflow_run_checkpoints(status);

-- ====================
-- Functions and Triggers
-- ====================

-- Updated at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply updated_at triggers
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_users_updated_at') THEN
        CREATE TRIGGER update_users_updated_at
            BEFORE UPDATE ON users
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_workflows_updated_at') THEN
        CREATE TRIGGER update_workflows_updated_at
            BEFORE UPDATE ON workflows
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_organizations_updated_at') THEN
        CREATE TRIGGER update_organizations_updated_at
            BEFORE UPDATE ON organizations
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
END $$;

-- ====================
-- Initial Seed Data
-- ====================

-- Insert test users for development
INSERT INTO users (id, email, first_name, last_name, created_at, updated_at) VALUES
(gen_random_uuid()::text, 'testros@researchflow.dev', 'Test', 'Admin', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(gen_random_uuid()::text, 'researcher@researchflow.dev', 'Sarah', 'Chen', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(gen_random_uuid()::text, 'steward@researchflow.dev', 'Emily', 'Wang', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(gen_random_uuid()::text, 'viewer@researchflow.dev', 'Alex', 'Kim', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT (email) DO NOTHING;

-- Insert initial governance mode configuration
INSERT INTO governance_config (key, value, created_at, updated_at) VALUES
('mode', '{"mode": "DEMO"}', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT (key) DO UPDATE SET
    value = EXCLUDED.value,
    updated_at = CURRENT_TIMESTAMP;

-- Insert default feature flags
INSERT INTO feature_flags (key, flag_key, enabled, description, scope) VALUES
('workflow_builder', 'workflow_builder', true, 'Enable custom workflow builder', 'product'),
('ai_tier_escalation', 'ai_tier_escalation', true, 'Enable AI model tier escalation', 'product'),
('phi_scanning', 'phi_scanning', true, 'Enable PHI scanning for uploads', 'compliance')
ON CONFLICT (key) DO UPDATE SET
    enabled = EXCLUDED.enabled,
    updated_at = CURRENT_TIMESTAMP;

-- Seed default workflow templates
INSERT INTO workflow_templates (key, name, description, definition, category) VALUES
(
    'standard-research',
    'Standard Research Pipeline',
    'Complete 20-stage research workflow from topic declaration to archive',
    '{
        "schemaVersion": "1.0",
        "nodes": [
            {"id": "stage-1", "type": "stage", "label": "Topic Declaration", "stageId": 1, "position": {"x": 250, "y": 0}},
            {"id": "stage-2", "type": "stage", "label": "Literature Search", "stageId": 2, "position": {"x": 250, "y": 100}},
            {"id": "stage-3", "type": "stage", "label": "IRB Proposal", "stageId": 3, "position": {"x": 250, "y": 200}},
            {"id": "stage-4", "type": "stage", "label": "Planned Extraction", "stageId": 4, "position": {"x": 250, "y": 300}},
            {"id": "gate-phi", "type": "gate", "label": "PHI Check Gate", "gateType": "phi_check", "position": {"x": 250, "y": 400}},
            {"id": "stage-5", "type": "stage", "label": "PHI Scanning", "stageId": 5, "position": {"x": 250, "y": 500}},
            {"id": "stage-6", "type": "stage", "label": "Schema Extraction", "stageId": 6, "position": {"x": 250, "y": 600}},
            {"id": "stage-7", "type": "stage", "label": "Final Scrubbing", "stageId": 7, "position": {"x": 250, "y": 700}},
            {"id": "stage-11", "type": "stage", "label": "Statistical Analysis", "stageId": 11, "position": {"x": 250, "y": 800}},
            {"id": "gate-ai", "type": "gate", "label": "AI Approval Gate", "gateType": "ai_approval", "position": {"x": 250, "y": 900}},
            {"id": "stage-14", "type": "stage", "label": "Manuscript Draft", "stageId": 14, "position": {"x": 250, "y": 1000}},
            {"id": "stage-19", "type": "stage", "label": "Archive", "stageId": 19, "position": {"x": 250, "y": 1100}}
        ],
        "edges": [
            {"id": "e1-2", "from": "stage-1", "to": "stage-2"},
            {"id": "e2-3", "from": "stage-2", "to": "stage-3"},
            {"id": "e3-4", "from": "stage-3", "to": "stage-4"},
            {"id": "e4-gate", "from": "stage-4", "to": "gate-phi"},
            {"id": "egate-5", "from": "gate-phi", "to": "stage-5"},
            {"id": "e5-6", "from": "stage-5", "to": "stage-6"},
            {"id": "e6-7", "from": "stage-6", "to": "stage-7"},
            {"id": "e7-11", "from": "stage-7", "to": "stage-11"},
            {"id": "e11-gate", "from": "stage-11", "to": "gate-ai"},
            {"id": "egate-14", "from": "gate-ai", "to": "stage-14"},
            {"id": "e14-19", "from": "stage-14", "to": "stage-19"}
        ],
        "entryNodeId": "stage-1"
    }',
    'research'
),
(
    'quick-analysis',
    'Quick Analysis Pipeline',
    'Abbreviated pipeline for rapid data analysis without full manuscript generation',
    '{
        "schemaVersion": "1.0",
        "nodes": [
            {"id": "stage-1", "type": "stage", "label": "Topic Declaration", "stageId": 1, "position": {"x": 250, "y": 0}},
            {"id": "stage-5", "type": "stage", "label": "PHI Scanning", "stageId": 5, "position": {"x": 250, "y": 100}},
            {"id": "stage-6", "type": "stage", "label": "Schema Extraction", "stageId": 6, "position": {"x": 250, "y": 200}},
            {"id": "stage-11", "type": "stage", "label": "Statistical Analysis", "stageId": 11, "position": {"x": 250, "y": 300}},
            {"id": "stage-12", "type": "stage", "label": "Results Summary", "stageId": 12, "position": {"x": 250, "y": 400}}
        ],
        "edges": [
            {"id": "e1-5", "from": "stage-1", "to": "stage-5"},
            {"id": "e5-6", "from": "stage-5", "to": "stage-6"},
            {"id": "e6-11", "from": "stage-6", "to": "stage-11"},
            {"id": "e11-12", "from": "stage-11", "to": "stage-12"}
        ],
        "entryNodeId": "stage-1"
    }',
    'research'
),
(
    'conference-prep',
    'Conference Preparation',
    'Focused workflow for Stage 20 conference materials generation',
    '{
        "schemaVersion": "1.0",
        "nodes": [
            {"id": "stage-1", "type": "stage", "label": "Topic Declaration", "stageId": 1, "position": {"x": 250, "y": 0}},
            {"id": "stage-2", "type": "stage", "label": "Literature Search", "stageId": 2, "position": {"x": 250, "y": 100}},
            {"id": "stage-14", "type": "stage", "label": "Manuscript Draft", "stageId": 14, "position": {"x": 250, "y": 200}},
            {"id": "stage-20", "type": "stage", "label": "Conference Prep", "stageId": 20, "position": {"x": 250, "y": 300}}
        ],
        "edges": [
            {"id": "e1-2", "from": "stage-1", "to": "stage-2"},
            {"id": "e2-14", "from": "stage-2", "to": "stage-14"},
            {"id": "e14-20", "from": "stage-14", "to": "stage-20"}
        ],
        "entryNodeId": "stage-1"
    }',
    'conference'
),
(
    'literature-review',
    'Literature Review Only',
    'Focused workflow for comprehensive literature review and evidence synthesis',
    '{
        "schemaVersion": "1.0",
        "nodes": [
            {"id": "stage-1", "type": "stage", "label": "Topic Declaration", "stageId": 1, "position": {"x": 250, "y": 0}},
            {"id": "stage-2", "type": "stage", "label": "Literature Search", "stageId": 2, "position": {"x": 250, "y": 100}},
            {"id": "stage-12", "type": "stage", "label": "Results Summary", "stageId": 12, "position": {"x": 250, "y": 200}}
        ],
        "edges": [
            {"id": "e1-2", "from": "stage-1", "to": "stage-2"},
            {"id": "e2-12", "from": "stage-2", "to": "stage-12"}
        ],
        "entryNodeId": "stage-1"
    }',
    'research'
)
ON CONFLICT (key) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    definition = EXCLUDED.definition,
    category = EXCLUDED.category;

-- Grant permissions
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO ros;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO ros;
