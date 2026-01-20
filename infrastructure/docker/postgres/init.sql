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
    name VARCHAR(255),
    role VARCHAR(50) DEFAULT 'researcher',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

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
    embedding VECTOR(1536),
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

-- PHI Access Audit Log
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

-- Run Manifests
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

-- ====================
-- Phase F: Observability + Feature Flags
-- ====================

-- Governance Config (DB-backed mode configuration)
CREATE TABLE IF NOT EXISTS governance_config (
    key VARCHAR(100) PRIMARY KEY,
    value JSONB NOT NULL DEFAULT '{}',
    updated_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Feature Flags
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

-- Experiments (A/B Testing)
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

-- Experiment Assignments
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

-- Analytics Events (PHI-safe, opt-in only)
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

-- Updated at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply updated_at triggers
CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_research_projects_updated_at
    BEFORE UPDATE ON research_projects
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ====================
-- Initial Data
-- ====================

-- Insert default prompts
INSERT INTO ai_prompts (name, version, system_prompt, model_tier, is_active) VALUES
('research_brief', 1, 'You are a clinical research assistant helping to generate research briefs. Focus on accuracy, clarity, and adherence to research methodology.', 'MINI', true),
('data_validation', 1, 'You are a data quality specialist. Analyze datasets for completeness, consistency, and potential issues.', 'NANO', true),
('evidence_synthesis', 1, 'You are a systematic review specialist. Synthesize evidence from multiple sources while maintaining scientific rigor.', 'FRONTIER', true)
ON CONFLICT (name, version) DO NOTHING;

-- Grant permissions
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO ros;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO ros;
