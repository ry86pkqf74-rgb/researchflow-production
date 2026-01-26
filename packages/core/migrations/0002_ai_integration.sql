-- Migration: AI Integration Tables
-- Version: 0002
-- Date: 2026-01-18
-- Description: Adds tables for AI model routing, cost tracking, batch processing, and evidence retrieval

-- =============================================
-- AI INVOCATIONS TABLE
-- Tracks all AI API calls with full audit trail
-- =============================================
CREATE TABLE IF NOT EXISTS ai_invocations (
    id SERIAL PRIMARY KEY,
    audit_event_id INTEGER REFERENCES audit_logs(id),
    provider VARCHAR(50) NOT NULL CHECK (provider IN ('anthropic', 'openai', 'together')),
    model VARCHAR(100) NOT NULL,
    task_type VARCHAR(50) NOT NULL,
    workflow_stage INTEGER,
    input_token_count INTEGER NOT NULL DEFAULT 0,
    output_token_count INTEGER NOT NULL DEFAULT 0,
    latency_ms INTEGER NOT NULL DEFAULT 0,
    phi_scan_passed BOOLEAN NOT NULL DEFAULT TRUE,
    mode_check_passed BOOLEAN NOT NULL DEFAULT TRUE,
    status VARCHAR(20) NOT NULL DEFAULT 'SUCCESS' CHECK (status IN ('SUCCESS', 'FAILED', 'BLOCKED', 'TIMEOUT')),
    error_message TEXT,
    request_id VARCHAR(100),
    research_id VARCHAR(255),
    user_id VARCHAR(255) REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX idx_ai_invocations_provider ON ai_invocations(provider);
CREATE INDEX idx_ai_invocations_status ON ai_invocations(status);
CREATE INDEX idx_ai_invocations_research ON ai_invocations(research_id);
CREATE INDEX idx_ai_invocations_created ON ai_invocations(created_at);

-- =============================================
-- AI MODEL USAGE TABLE
-- Tracks model tier routing and escalation
-- =============================================
CREATE TABLE IF NOT EXISTS ai_model_usage (
    id SERIAL PRIMARY KEY,
    invocation_id INTEGER NOT NULL REFERENCES ai_invocations(id) ON DELETE CASCADE,
    initial_tier VARCHAR(20) NOT NULL CHECK (initial_tier IN ('NANO', 'MINI', 'FRONTIER')),
    final_tier VARCHAR(20) NOT NULL CHECK (final_tier IN ('NANO', 'MINI', 'FRONTIER')),
    escalated BOOLEAN DEFAULT FALSE,
    escalation_reason TEXT,
    escalation_count INTEGER DEFAULT 0,
    quality_gate_passed BOOLEAN DEFAULT TRUE,
    quality_checks JSONB,
    estimated_cost_usd DECIMAL(10, 6) DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX idx_ai_model_usage_tier ON ai_model_usage(final_tier);
CREATE INDEX idx_ai_model_usage_escalated ON ai_model_usage(escalated);

-- =============================================
-- PROMPT CACHE STATS TABLE
-- Monitors prompt caching effectiveness
-- =============================================
CREATE TABLE IF NOT EXISTS prompt_cache_stats (
    id SERIAL PRIMARY KEY,
    cache_key VARCHAR(500) NOT NULL UNIQUE,
    stage_id INTEGER,
    tenant_id VARCHAR(255),
    prompt_name VARCHAR(100) NOT NULL,
    policy_version VARCHAR(50),
    hit_count INTEGER DEFAULT 0,
    miss_count INTEGER DEFAULT 0,
    cached_tokens INTEGER DEFAULT 0,
    estimated_savings_usd DECIMAL(10, 6) DEFAULT 0,
    last_hit_at TIMESTAMP,
    last_miss_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX idx_prompt_cache_stats_stage ON prompt_cache_stats(stage_id);
CREATE INDEX idx_prompt_cache_stats_tenant ON prompt_cache_stats(tenant_id);

-- =============================================
-- BATCH JOBS TABLE
-- Tracks batch processing jobs for non-interactive work
-- =============================================
CREATE TABLE IF NOT EXISTS batch_jobs (
    id SERIAL PRIMARY KEY,
    job_id VARCHAR(100) NOT NULL UNIQUE,
    provider VARCHAR(50) NOT NULL CHECK (provider IN ('openai', 'anthropic')),
    provider_job_id VARCHAR(255),
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'SUBMITTED', 'PROCESSING', 'COMPLETED', 'FAILED', 'CANCELLED')),
    request_count INTEGER NOT NULL DEFAULT 0,
    completed_count INTEGER DEFAULT 0,
    failed_count INTEGER DEFAULT 0,
    governance_mode VARCHAR(20) NOT NULL,
    research_id VARCHAR(255),
    created_by VARCHAR(255) REFERENCES users(id),
    submitted_at TIMESTAMP,
    completed_at TIMESTAMP,
    error_message TEXT,
    results JSONB,
    metadata JSONB,
    webhook_url TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX idx_batch_jobs_status ON batch_jobs(status);
CREATE INDEX idx_batch_jobs_provider ON batch_jobs(provider);
CREATE INDEX idx_batch_jobs_research ON batch_jobs(research_id);

-- =============================================
-- BATCH JOB REQUESTS TABLE
-- Individual requests within a batch job
-- =============================================
CREATE TABLE IF NOT EXISTS batch_job_requests (
    id SERIAL PRIMARY KEY,
    batch_job_id INTEGER NOT NULL REFERENCES batch_jobs(id) ON DELETE CASCADE,
    request_index INTEGER NOT NULL,
    task_type VARCHAR(50) NOT NULL,
    prompt_hash VARCHAR(64) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED')),
    input_tokens INTEGER,
    output_tokens INTEGER,
    response_content TEXT,
    error_message TEXT,
    processed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX idx_batch_job_requests_job ON batch_job_requests(batch_job_id);
CREATE INDEX idx_batch_job_requests_status ON batch_job_requests(status);

-- =============================================
-- EVIDENCE CARDS TABLE
-- Pre-processed evidence for RAG
-- =============================================
CREATE TABLE IF NOT EXISTS evidence_cards (
    id SERIAL PRIMARY KEY,
    card_id VARCHAR(100) NOT NULL UNIQUE,
    project_id VARCHAR(255),
    research_id VARCHAR(255),
    paper_id VARCHAR(255) NOT NULL,
    paper_title TEXT,
    paper_authors TEXT,
    paper_year INTEGER,
    paper_doi VARCHAR(255),
    claim TEXT NOT NULL,
    quote TEXT NOT NULL,
    location VARCHAR(255) NOT NULL,
    page_number INTEGER,
    section VARCHAR(100),
    confidence DECIMAL(3, 2) CHECK (confidence >= 0 AND confidence <= 1),
    relevance_score DECIMAL(3, 2),
    extraction_method VARCHAR(50),
    embedding_vector JSONB,
    tags JSONB,
    created_by VARCHAR(255) REFERENCES users(id),
    verified_by VARCHAR(255) REFERENCES users(id),
    verified_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX idx_evidence_cards_project ON evidence_cards(project_id);
CREATE INDEX idx_evidence_cards_research ON evidence_cards(research_id);
CREATE INDEX idx_evidence_cards_paper ON evidence_cards(paper_id);
CREATE INDEX idx_evidence_cards_confidence ON evidence_cards(confidence);

-- =============================================
-- EVIDENCE CARD USAGE TABLE
-- Tracks which evidence cards were used in AI prompts
-- =============================================
CREATE TABLE IF NOT EXISTS evidence_card_usage (
    id SERIAL PRIMARY KEY,
    evidence_card_id INTEGER NOT NULL REFERENCES evidence_cards(id) ON DELETE CASCADE,
    invocation_id INTEGER NOT NULL REFERENCES ai_invocations(id) ON DELETE CASCADE,
    usage_type VARCHAR(50) NOT NULL CHECK (usage_type IN ('context', 'citation', 'verification')),
    relevance_rank INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX idx_evidence_card_usage_card ON evidence_card_usage(evidence_card_id);
CREATE INDEX idx_evidence_card_usage_invocation ON evidence_card_usage(invocation_id);

-- =============================================
-- AI PROMPTS TABLE
-- Versioned prompt library
-- =============================================
CREATE TABLE IF NOT EXISTS ai_prompts (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    version INTEGER NOT NULL DEFAULT 1,
    workflow_stage INTEGER,
    provider VARCHAR(50) CHECK (provider IN ('openai', 'anthropic', 'together')),
    model VARCHAR(100),
    system_prompt TEXT NOT NULL,
    user_template TEXT NOT NULL,
    dynamic_markers JSONB,
    is_active BOOLEAN DEFAULT TRUE,
    is_default BOOLEAN DEFAULT FALSE,
    description TEXT,
    tags JSONB,
    created_by VARCHAR(255) REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    UNIQUE(name, version)
);

CREATE INDEX idx_ai_prompts_name ON ai_prompts(name);
CREATE INDEX idx_ai_prompts_stage ON ai_prompts(workflow_stage);
CREATE INDEX idx_ai_prompts_active ON ai_prompts(is_active);

-- =============================================
-- AI COST SUMMARY TABLE
-- Aggregated cost tracking by period
-- =============================================
CREATE TABLE IF NOT EXISTS ai_cost_summary (
    id SERIAL PRIMARY KEY,
    period_type VARCHAR(20) NOT NULL CHECK (period_type IN ('hourly', 'daily', 'weekly', 'monthly')),
    period_start TIMESTAMP NOT NULL,
    period_end TIMESTAMP NOT NULL,
    tenant_id VARCHAR(255),
    research_id VARCHAR(255),
    provider VARCHAR(50),
    tier VARCHAR(20),
    invocation_count INTEGER DEFAULT 0,
    total_input_tokens BIGINT DEFAULT 0,
    total_output_tokens BIGINT DEFAULT 0,
    total_cost_usd DECIMAL(12, 6) DEFAULT 0,
    cache_hit_count INTEGER DEFAULT 0,
    cache_savings_usd DECIMAL(12, 6) DEFAULT 0,
    escalation_count INTEGER DEFAULT 0,
    error_count INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    UNIQUE(period_type, period_start, tenant_id, research_id, provider, tier)
);

CREATE INDEX idx_ai_cost_summary_period ON ai_cost_summary(period_type, period_start);
CREATE INDEX idx_ai_cost_summary_tenant ON ai_cost_summary(tenant_id);
CREATE INDEX idx_ai_cost_summary_research ON ai_cost_summary(research_id);

-- =============================================
-- Add AI-related columns to existing tables
-- =============================================

-- Add tier tracking to handoff_packs if not exists
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'handoff_packs' AND column_name = 'model_tier') THEN
        ALTER TABLE handoff_packs ADD COLUMN model_tier VARCHAR(20);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'handoff_packs' AND column_name = 'escalated') THEN
        ALTER TABLE handoff_packs ADD COLUMN escalated BOOLEAN DEFAULT FALSE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'handoff_packs' AND column_name = 'phi_scan_passed') THEN
        ALTER TABLE handoff_packs ADD COLUMN phi_scan_passed BOOLEAN DEFAULT TRUE;
    END IF;
END $$;

-- =============================================
-- Insert default AI prompts
-- =============================================
INSERT INTO ai_prompts (name, version, workflow_stage, system_prompt, user_template, dynamic_markers, is_active, is_default, description)
VALUES
(
    'research_brief_generator',
    1,
    2,
    'You are a clinical research methodology expert. Your task is to generate comprehensive research briefs from topic declarations.

IMPORTANT GUIDELINES:
- Focus on HIPAA compliance and data protection
- Ensure methodological rigor
- Consider statistical validity
- Identify potential confounders and biases

OUTPUT FORMAT:
Return valid JSON with the specified structure.',
    'Generate a research brief from this topic declaration:

TOPIC: {{title}}
DESCRIPTION: {{description}}

PICO ELEMENTS:
- Population: {{population}}
- Intervention/Exposure: {{intervention}}
- Comparator: {{comparator}}
- Outcomes: {{outcomes}}
- Timeframe: {{timeframe}}

Return valid JSON only.',
    '["title", "description", "population", "intervention", "comparator", "outcomes", "timeframe"]',
    true,
    true,
    'Generates enhanced research briefs from topic declarations'
),
(
    'phi_scanner',
    1,
    0,
    'You are a PHI (Protected Health Information) detection specialist. Scan the provided text for any potential PHI according to HIPAA Safe Harbor guidelines.

IMPORTANT: Never include the actual PHI values in your response. Only report locations and types.',
    'Scan this text for PHI:

{{content}}

Return JSON with: hasPhi (boolean), riskLevel (none/low/medium/high), findingsCount (number), categories (array).',
    '["content"]',
    true,
    true,
    'AI-assisted PHI scanning for complex text'
),
(
    'abstract_generator',
    1,
    18,
    'You are a scientific writing expert specializing in research abstracts. Generate a structured abstract following IMRAD format (Introduction, Methods, Results, And Discussion).

REQUIREMENTS:
- Word limit: 250-300 words
- Use active voice where appropriate
- Include key statistical findings
- State clinical significance',
    'Generate an abstract for this research:

TITLE: {{title}}
STUDY DESIGN: {{studyDesign}}
POPULATION: {{population}}
INTERVENTION: {{intervention}}
OUTCOMES: {{outcomes}}
KEY FINDINGS: {{keyFindings}}',
    '["title", "studyDesign", "population", "intervention", "outcomes", "keyFindings"]',
    true,
    true,
    'Generates conference-ready abstracts from research data'
)
ON CONFLICT (name, version) DO NOTHING;

-- =============================================
-- Create views for reporting
-- =============================================

-- View for AI usage by tier
CREATE OR REPLACE VIEW v_ai_usage_by_tier AS
SELECT
    mu.final_tier as tier,
    COUNT(*) as invocation_count,
    SUM(i.input_token_count) as total_input_tokens,
    SUM(i.output_token_count) as total_output_tokens,
    SUM(mu.estimated_cost_usd) as total_cost_usd,
    AVG(i.latency_ms) as avg_latency_ms,
    SUM(CASE WHEN mu.escalated THEN 1 ELSE 0 END) as escalation_count,
    COUNT(*) FILTER (WHERE i.status = 'SUCCESS') as success_count,
    COUNT(*) FILTER (WHERE i.status = 'FAILED') as failed_count,
    DATE_TRUNC('day', i.created_at) as date
FROM ai_invocations i
JOIN ai_model_usage mu ON mu.invocation_id = i.id
GROUP BY mu.final_tier, DATE_TRUNC('day', i.created_at);

-- View for prompt cache effectiveness
CREATE OR REPLACE VIEW v_prompt_cache_effectiveness AS
SELECT
    prompt_name,
    stage_id,
    SUM(hit_count) as total_hits,
    SUM(miss_count) as total_misses,
    CASE WHEN SUM(hit_count) + SUM(miss_count) > 0
         THEN ROUND(SUM(hit_count)::numeric / (SUM(hit_count) + SUM(miss_count)) * 100, 2)
         ELSE 0
    END as hit_rate_pct,
    SUM(estimated_savings_usd) as total_savings_usd
FROM prompt_cache_stats
GROUP BY prompt_name, stage_id;

COMMENT ON TABLE ai_invocations IS 'Tracks all AI API invocations with full audit trail';
COMMENT ON TABLE ai_model_usage IS 'Tracks model tier routing decisions and escalations';
COMMENT ON TABLE prompt_cache_stats IS 'Monitors prompt caching effectiveness and cost savings';
COMMENT ON TABLE batch_jobs IS 'Manages batch processing jobs for non-interactive AI work';
COMMENT ON TABLE evidence_cards IS 'Pre-processed evidence cards for RAG (Retrieval Augmented Generation)';
COMMENT ON TABLE ai_prompts IS 'Versioned library of AI prompts for each workflow stage';
COMMENT ON TABLE ai_cost_summary IS 'Aggregated AI cost tracking by time period';
