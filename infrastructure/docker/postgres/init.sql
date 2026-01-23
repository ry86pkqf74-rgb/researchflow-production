-- ResearchFlow Production Database Initialization
-- ================================================

-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ====================
-- Core Tables
-- ====================

-- Users and Authentication
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255),
    name VARCHAR(255),
    role VARCHAR(50) DEFAULT 'researcher',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Refresh Tokens for JWT authentication
CREATE TABLE IF NOT EXISTS refresh_tokens (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    token VARCHAR(500) UNIQUE NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_refresh_tokens_user_id ON refresh_tokens(user_id);
CREATE INDEX idx_refresh_tokens_token ON refresh_tokens(token);
CREATE INDEX idx_refresh_tokens_expires_at ON refresh_tokens(expires_at);

-- Research Projects
CREATE TABLE IF NOT EXISTS research_projects (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    research_id VARCHAR(100) UNIQUE NOT NULL,
    title VARCHAR(500) NOT NULL,
    description TEXT,
    owner_id UUID REFERENCES users(id),
    status VARCHAR(50) DEFAULT 'draft',
    governance_mode VARCHAR(20) DEFAULT 'DEMO',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ====================
-- Job Queue Tables
-- ====================

CREATE TABLE IF NOT EXISTS jobs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    job_id VARCHAR(100) UNIQUE NOT NULL,
    type VARCHAR(50) NOT NULL,
    status VARCHAR(50) DEFAULT 'pending',
    config JSONB NOT NULL DEFAULT '{}',
    result JSONB,
    error TEXT,
    research_id UUID REFERENCES research_projects(id),
    user_id UUID REFERENCES users(id),
    stages INTEGER[] DEFAULT ARRAY[]::INTEGER[],
    progress INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_jobs_status ON jobs(status);
CREATE INDEX idx_jobs_type ON jobs(type);
CREATE INDEX idx_jobs_research_id ON jobs(research_id);

-- ====================
-- AI Integration Tables
-- ====================

-- AI Invocations Audit Trail
CREATE TABLE IF NOT EXISTS ai_invocations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    model_tier VARCHAR(20) NOT NULL,
    model_id VARCHAR(100) NOT NULL,
    operation VARCHAR(100) NOT NULL,
    input_tokens INTEGER,
    output_tokens INTEGER,
    latency_ms INTEGER,
    cost_usd DECIMAL(10, 6),
    cache_hit BOOLEAN DEFAULT FALSE,
    escalated_from VARCHAR(20),
    research_id UUID REFERENCES research_projects(id),
    user_id UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_ai_invocations_created_at ON ai_invocations(created_at);
CREATE INDEX idx_ai_invocations_model_tier ON ai_invocations(model_tier);

-- AI Model Usage Tracking
CREATE TABLE IF NOT EXISTS ai_model_usage (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    model_tier VARCHAR(20) NOT NULL,
    model_id VARCHAR(100) NOT NULL,
    total_invocations INTEGER DEFAULT 0,
    total_tokens INTEGER DEFAULT 0,
    total_cost_usd DECIMAL(12, 6) DEFAULT 0,
    date DATE NOT NULL,
    UNIQUE(model_id, date)
);

-- Prompt Cache Stats
CREATE TABLE IF NOT EXISTS prompt_cache_stats (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    cache_key VARCHAR(255) NOT NULL,
    hits INTEGER DEFAULT 0,
    misses INTEGER DEFAULT 0,
    last_hit_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Batch Jobs
CREATE TABLE IF NOT EXISTS batch_jobs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    batch_id VARCHAR(100) UNIQUE NOT NULL,
    status VARCHAR(50) DEFAULT 'pending',
    total_requests INTEGER DEFAULT 0,
    completed_requests INTEGER DEFAULT 0,
    failed_requests INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE
);

CREATE TABLE IF NOT EXISTS batch_job_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    batch_id UUID REFERENCES batch_jobs(id),
    request_id VARCHAR(100) NOT NULL,
    status VARCHAR(50) DEFAULT 'pending',
    input JSONB NOT NULL,
    output JSONB,
    error TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE
);

-- Evidence Cards for RAG
CREATE TABLE IF NOT EXISTS evidence_cards (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    card_id VARCHAR(100) UNIQUE NOT NULL,
    title VARCHAR(500) NOT NULL,
    content TEXT NOT NULL,
    source VARCHAR(255),
    source_type VARCHAR(50),
    embedding BYTEA,
    metadata JSONB DEFAULT '{}',
    research_id UUID REFERENCES research_projects(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS evidence_card_usage (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    card_id UUID REFERENCES evidence_cards(id),
    ai_invocation_id UUID REFERENCES ai_invocations(id),
    relevance_score DECIMAL(5, 4),
    used_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- AI Prompts (Versioned Library)
CREATE TABLE IF NOT EXISTS ai_prompts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    version INTEGER NOT NULL,
    system_prompt TEXT,
    user_prompt_template TEXT,
    model_tier VARCHAR(20) DEFAULT 'MINI',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(name, version)
);

-- AI Cost Summary (Aggregated)
CREATE TABLE IF NOT EXISTS ai_cost_summary (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    date DATE NOT NULL,
    model_tier VARCHAR(20) NOT NULL,
    total_invocations INTEGER DEFAULT 0,
    total_input_tokens INTEGER DEFAULT 0,
    total_output_tokens INTEGER DEFAULT 0,
    total_cost_usd DECIMAL(12, 6) DEFAULT 0,
    cache_hit_rate DECIMAL(5, 4) DEFAULT 0,
    UNIQUE(date, model_tier)
);

-- ====================
-- PHI Governance Tables
-- ====================

CREATE TABLE IF NOT EXISTS phi_access_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    action VARCHAR(50) NOT NULL,
    resource_type VARCHAR(100),
    resource_id VARCHAR(255),
    user_id UUID REFERENCES users(id),
    reason TEXT,
    approved_by UUID REFERENCES users(id),
    reveal_token VARCHAR(255),
    token_expires_at TIMESTAMP WITH TIME ZONE,
    accessed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    ip_address INET,
    user_agent TEXT
);

CREATE INDEX idx_phi_access_log_user_id ON phi_access_log(user_id);
CREATE INDEX idx_phi_access_log_accessed_at ON phi_access_log(accessed_at);

-- ====================
-- Artifact Storage
-- ====================

CREATE TABLE IF NOT EXISTS artifacts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    artifact_id VARCHAR(100) UNIQUE NOT NULL,
    type VARCHAR(50) NOT NULL,
    name VARCHAR(255) NOT NULL,
    path VARCHAR(500) NOT NULL,
    size_bytes BIGINT,
    mime_type VARCHAR(100),
    checksum VARCHAR(64),
    job_id UUID REFERENCES jobs(id),
    research_id UUID REFERENCES research_projects(id),
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_artifacts_job_id ON artifacts(job_id);
CREATE INDEX idx_artifacts_research_id ON artifacts(research_id);

CREATE TABLE IF NOT EXISTS run_manifests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    manifest_id VARCHAR(100) UNIQUE NOT NULL,
    job_id UUID REFERENCES jobs(id),
    stages_completed INTEGER[] DEFAULT ARRAY[]::INTEGER[],
    artifacts UUID[] DEFAULT ARRAY[]::UUID[],
    status VARCHAR(50) DEFAULT 'pending',
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ====================
-- Governance Log
-- ====================

CREATE TABLE IF NOT EXISTS governance_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_type VARCHAR(100) NOT NULL,
    severity VARCHAR(20) DEFAULT 'INFO',
    message TEXT,
    context JSONB DEFAULT '{}',
    user_id UUID REFERENCES users(id),
    research_id UUID REFERENCES research_projects(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_governance_log_event_type ON governance_log(event_type);
CREATE INDEX idx_governance_log_created_at ON governance_log(created_at);

CREATE TABLE IF NOT EXISTS audit_logs (
    id SERIAL PRIMARY KEY,
    event_type TEXT NOT NULL,
    user_id UUID REFERENCES users(id),
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
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_event_type ON audit_logs(event_type);
CREATE INDEX idx_audit_logs_action ON audit_logs(action);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at);

-- ====================
-- Phase F: Observability + Feature Flags
-- ====================

CREATE TABLE IF NOT EXISTS governance_config (
    key VARCHAR(100) PRIMARY KEY,
    value JSONB NOT NULL DEFAULT '{}',
    updated_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS feature_flags (
    key VARCHAR(100) PRIMARY KEY,
    enabled BOOLEAN NOT NULL DEFAULT FALSE,
    description TEXT,
    scope VARCHAR(50) NOT NULL DEFAULT 'product',
    required_modes JSONB DEFAULT '[]',
    rollout_percent INTEGER NOT NULL DEFAULT 100 CHECK (rollout_percent >= 0 AND rollout_percent <= 100),
    updated_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_feature_flags_scope ON feature_flags(scope);
CREATE INDEX idx_feature_flags_enabled ON feature_flags(enabled) WHERE enabled = TRUE;

CREATE TABLE IF NOT EXISTS experiments (
    key VARCHAR(100) PRIMARY KEY,
    enabled BOOLEAN NOT NULL DEFAULT FALSE,
    description TEXT,
    variants JSONB NOT NULL DEFAULT '{}',
    allocation JSONB NOT NULL DEFAULT '{}',
    required_modes JSONB DEFAULT '[]',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_experiments_enabled ON experiments(enabled) WHERE enabled = TRUE;

CREATE TABLE IF NOT EXISTS experiment_assignments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    experiment_key VARCHAR(100) NOT NULL REFERENCES experiments(key) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    session_id VARCHAR(255),
    variant VARCHAR(50) NOT NULL,
    assigned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE (experiment_key, user_id, session_id)
);

CREATE INDEX idx_experiment_assignments_experiment ON experiment_assignments(experiment_key);
CREATE INDEX idx_experiment_assignments_user ON experiment_assignments(user_id);

CREATE TABLE IF NOT EXISTS analytics_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_name VARCHAR(120) NOT NULL,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    session_id VARCHAR(255),
    research_id VARCHAR(255),
    mode VARCHAR(20) NOT NULL,
    properties JSONB DEFAULT '{}',
    ip_hash VARCHAR(64),
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_analytics_events_name_created ON analytics_events(event_name, created_at);
CREATE INDEX idx_analytics_events_user_created ON analytics_events(user_id, created_at);
CREATE INDEX idx_analytics_events_research_created ON analytics_events(research_id, created_at);

-- ====================
-- Functions and Triggers
-- ====================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_research_projects_updated_at
    BEFORE UPDATE ON research_projects
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ====================
-- Initial Data
-- ====================

INSERT INTO ai_prompts (name, version, system_prompt, model_tier, is_active) VALUES
('research_brief', 1, 'You are a clinical research assistant helping to generate research briefs. Focus on accuracy, clarity, and adherence to research methodology.', 'MINI', true),
('data_validation', 1, 'You are a data quality specialist. Analyze datasets for completeness, consistency, and potential issues.', 'NANO', true),
('evidence_synthesis', 1, 'You are a systematic review specialist. Synthesize evidence from multiple sources while maintaining scientific rigor.', 'FRONTIER', true)
ON CONFLICT (name, version) DO NOTHING;

-- ====================
-- Test Users for Development
-- ====================

INSERT INTO users (id, email, name, role, created_at, updated_at) VALUES
(uuid_generate_v5(uuid_ns_dns(), 'testros@researchflow.dev'), 'testros@researchflow.dev', 'Test ROS Admin', 'ADMIN', NOW(), NOW()),
(uuid_generate_v5(uuid_ns_dns(), 'researcher@researchflow.dev'), 'researcher@researchflow.dev', 'Dr. Sarah Chen', 'RESEARCHER', NOW(), NOW()),
(uuid_generate_v5(uuid_ns_dns(), 'steward@researchflow.dev'), 'steward@researchflow.dev', 'Dr. Emily Wang', 'STEWARD', NOW(), NOW()),
(uuid_generate_v5(uuid_ns_dns(), 'viewer@researchflow.dev'), 'viewer@researchflow.dev', 'Alex Kim', 'VIEWER', NOW(), NOW())
ON CONFLICT (email) DO NOTHING;

INSERT INTO governance_config (key, value, updated_by, created_at, updated_at) VALUES
('mode', '{"mode": "DEMO"}', uuid_generate_v5(uuid_ns_dns(), 'testros@researchflow.dev'), NOW(), NOW())
ON CONFLICT (key) DO UPDATE SET
  value = EXCLUDED.value,
  updated_at = NOW();

-- ====================
-- Phase G: Workflow Builder Tables
-- ====================

CREATE TABLE IF NOT EXISTS workflows (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id VARCHAR(255),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    status VARCHAR(50) NOT NULL DEFAULT 'draft',
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_workflows_org ON workflows(org_id);
CREATE INDEX IF NOT EXISTS idx_workflows_status ON workflows(status);
CREATE INDEX IF NOT EXISTS idx_workflows_created_by ON workflows(created_by);

CREATE TABLE IF NOT EXISTS workflow_versions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workflow_id UUID NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
    version INTEGER NOT NULL,
    definition JSONB NOT NULL,
    changelog TEXT,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(workflow_id, version)
);

CREATE INDEX IF NOT EXISTS idx_workflow_versions_workflow ON workflow_versions(workflow_id);
CREATE INDEX IF NOT EXISTS idx_workflow_versions_version ON workflow_versions(workflow_id, version);

CREATE TABLE IF NOT EXISTS workflow_templates (
    key VARCHAR(100) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    definition JSONB NOT NULL,
    category VARCHAR(100) DEFAULT 'general',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_workflow_templates_category ON workflow_templates(category);
CREATE INDEX IF NOT EXISTS idx_workflow_templates_active ON workflow_templates(is_active) WHERE is_active = TRUE;

CREATE TABLE IF NOT EXISTS workflow_policies (
    workflow_id UUID PRIMARY KEY REFERENCES workflows(id) ON DELETE CASCADE,
    policy JSONB NOT NULL DEFAULT '{}',
    updated_by UUID REFERENCES users(id),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS workflow_run_checkpoints (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    run_id VARCHAR(255) NOT NULL,
    workflow_id UUID NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
    workflow_version INTEGER NOT NULL,
    current_node_id VARCHAR(255) NOT NULL,
    completed_nodes JSONB NOT NULL DEFAULT '[]',
    node_outputs JSONB NOT NULL DEFAULT '{}',
    status VARCHAR(50) NOT NULL DEFAULT 'running',
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_workflow_checkpoints_run ON workflow_run_checkpoints(run_id);
CREATE INDEX IF NOT EXISTS idx_workflow_checkpoints_workflow ON workflow_run_checkpoints(workflow_id);
CREATE INDEX IF NOT EXISTS idx_workflow_checkpoints_status ON workflow_run_checkpoints(status);

-- Seed default workflow templates
INSERT INTO workflow_templates (key, name, description, definition, category) VALUES
('standard-research', 'Standard Research Pipeline', 'Complete 20-stage research workflow from topic declaration to archive',
'{"schemaVersion":"1.0","nodes":[{"id":"stage-1","type":"stage","label":"Topic Declaration","stageId":1,"position":{"x":250,"y":0}},{"id":"stage-2","type":"stage","label":"Literature Search","stageId":2,"position":{"x":250,"y":100}},{"id":"stage-3","type":"stage","label":"IRB Proposal","stageId":3,"position":{"x":250,"y":200}},{"id":"stage-4","type":"stage","label":"Planned Extraction","stageId":4,"position":{"x":250,"y":300}},{"id":"gate-phi","type":"gate","label":"PHI Check Gate","gateType":"phi_check","position":{"x":250,"y":400}},{"id":"stage-5","type":"stage","label":"PHI Scanning","stageId":5,"position":{"x":250,"y":500}},{"id":"stage-6","type":"stage","label":"Schema Extraction","stageId":6,"position":{"x":250,"y":600}},{"id":"stage-7","type":"stage","label":"Final Scrubbing","stageId":7,"position":{"x":250,"y":700}},{"id":"stage-11","type":"stage","label":"Statistical Analysis","stageId":11,"position":{"x":250,"y":800}},{"id":"gate-ai","type":"gate","label":"AI Approval Gate","gateType":"ai_approval","position":{"x":250,"y":900}},{"id":"stage-14","type":"stage","label":"Manuscript Draft","stageId":14,"position":{"x":250,"y":1000}},{"id":"stage-19","type":"stage","label":"Archive","stageId":19,"position":{"x":250,"y":1100}}],"edges":[{"id":"e1-2","from":"stage-1","to":"stage-2"},{"id":"e2-3","from":"stage-2","to":"stage-3"},{"id":"e3-4","from":"stage-3","to":"stage-4"},{"id":"e4-gate","from":"stage-4","to":"gate-phi"},{"id":"egate-5","from":"gate-phi","to":"stage-5"},{"id":"e5-6","from":"stage-5","to":"stage-6"},{"id":"e6-7","from":"stage-6","to":"stage-7"},{"id":"e7-11","from":"stage-7","to":"stage-11"},{"id":"e11-gate","from":"stage-11","to":"gate-ai"},{"id":"egate-14","from":"gate-ai","to":"stage-14"},{"id":"e14-19","from":"stage-14","to":"stage-19"}],"entryNodeId":"stage-1"}',
'research'),
('quick-analysis', 'Quick Analysis Pipeline', 'Abbreviated pipeline for rapid data analysis without full manuscript generation',
'{"schemaVersion":"1.0","nodes":[{"id":"stage-1","type":"stage","label":"Topic Declaration","stageId":1,"position":{"x":250,"y":0}},{"id":"stage-5","type":"stage","label":"PHI Scanning","stageId":5,"position":{"x":250,"y":100}},{"id":"stage-6","type":"stage","label":"Schema Extraction","stageId":6,"position":{"x":250,"y":200}},{"id":"stage-11","type":"stage","label":"Statistical Analysis","stageId":11,"position":{"x":250,"y":300}},{"id":"stage-12","type":"stage","label":"Results Summary","stageId":12,"position":{"x":250,"y":400}}],"edges":[{"id":"e1-5","from":"stage-1","to":"stage-5"},{"id":"e5-6","from":"stage-5","to":"stage-6"},{"id":"e6-11","from":"stage-6","to":"stage-11"},{"id":"e11-12","from":"stage-11","to":"stage-12"}],"entryNodeId":"stage-1"}',
'research'),
('conference-prep', 'Conference Preparation', 'Focused workflow for Stage 20 conference materials generation',
'{"schemaVersion":"1.0","nodes":[{"id":"stage-1","type":"stage","label":"Topic Declaration","stageId":1,"position":{"x":250,"y":0}},{"id":"stage-2","type":"stage","label":"Literature Search","stageId":2,"position":{"x":250,"y":100}},{"id":"stage-14","type":"stage","label":"Manuscript Draft","stageId":14,"position":{"x":250,"y":200}},{"id":"stage-20","type":"stage","label":"Conference Prep","stageId":20,"position":{"x":250,"y":300}}],"edges":[{"id":"e1-2","from":"stage-1","to":"stage-2"},{"id":"e2-14","from":"stage-2","to":"stage-14"},{"id":"e14-20","from":"stage-14","to":"stage-20"}],"entryNodeId":"stage-1"}',
'conference'),
('literature-review', 'Literature Review Only', 'Focused workflow for comprehensive literature review and evidence synthesis',
'{"schemaVersion":"1.0","nodes":[{"id":"stage-1","type":"stage","label":"Topic Declaration","stageId":1,"position":{"x":250,"y":0}},{"id":"stage-2","type":"stage","label":"Literature Search","stageId":2,"position":{"x":250,"y":100}},{"id":"stage-12","type":"stage","label":"Results Summary","stageId":12,"position":{"x":250,"y":200}}],"edges":[{"id":"e1-2","from":"stage-1","to":"stage-2"},{"id":"e2-12","from":"stage-2","to":"stage-12"}],"entryNodeId":"stage-1"}',
'research')
ON CONFLICT (key) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  definition = EXCLUDED.definition,
  category = EXCLUDED.category;

CREATE TRIGGER update_workflows_updated_at
    BEFORE UPDATE ON workflows
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Grant permissions
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO ros;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO ros;
