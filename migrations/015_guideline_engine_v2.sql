-- Guideline Engine Tables (v2 - Python FastAPI microservice)
-- This migration supports the standalone guideline-engine package

-- Source Registry: License and access policy compliance
CREATE TABLE IF NOT EXISTS source_registry (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    publisher_name VARCHAR(255) NOT NULL,
    url_pattern TEXT,
    access_method VARCHAR(50) DEFAULT 'public_web',
    license_type VARCHAR(50) DEFAULT 'unknown',
    allow_store_full_text BOOLEAN DEFAULT FALSE,
    allow_store_tables BOOLEAN DEFAULT FALSE,
    allow_show_excerpts BOOLEAN DEFAULT TRUE,
    excerpt_max_length INTEGER DEFAULT 500,
    require_deep_link BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- System Cards: Canonical abstraction for scoring systems, staging, grading
-- Drop and recreate if exists to ensure schema matches
DROP TABLE IF EXISTS calculator_results CASCADE;
DROP TABLE IF EXISTS version_graph CASCADE;
DROP TABLE IF EXISTS evidence_statements CASCADE;
DROP TABLE IF EXISTS rule_specs CASCADE;
DROP TABLE IF EXISTS validation_blueprints CASCADE;
DROP TABLE IF EXISTS guideline_documents CASCADE;
DROP TABLE IF EXISTS system_cards CASCADE;

CREATE TABLE system_cards (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    type VARCHAR(50) NOT NULL,  -- score, staging, grading, guideline, classification, reporting_standard
    specialty VARCHAR(100),
    condition_concepts JSONB DEFAULT '[]',
    intended_use VARCHAR(100),  -- diagnosis, prognosis, treatment_selection, severity, complications
    population VARCHAR(100),
    inputs JSONB NOT NULL DEFAULT '[]',
    outputs JSONB NOT NULL DEFAULT '[]',
    interpretation JSONB DEFAULT '[]',
    limitations TEXT[],
    source_anchors JSONB DEFAULT '[]',  -- [{url, page, section}]
    version VARCHAR(50),
    effective_date DATE,
    superseded_by UUID REFERENCES system_cards(id),
    status VARCHAR(20) DEFAULT 'active',
    extraction_confidence DECIMAL(3,2),
    verified BOOLEAN DEFAULT FALSE,
    verified_by UUID,
    verified_at TIMESTAMPTZ,
    non_computable_reason TEXT,  -- NULL if computable
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Rule Specs: Deterministic computation definitions
CREATE TABLE rule_specs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    system_card_id UUID NOT NULL REFERENCES system_cards(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    rule_type VARCHAR(50) NOT NULL,  -- threshold, lookup_table, formula
    rule_definition JSONB NOT NULL,
    test_cases JSONB DEFAULT '[]',
    validated BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Evidence Statements: Anchored citations with provenance
CREATE TABLE evidence_statements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    system_card_id UUID NOT NULL REFERENCES system_cards(id) ON DELETE CASCADE,
    statement_text TEXT NOT NULL,
    strength VARCHAR(50),  -- strong, moderate, weak, expert_consensus
    quality VARCHAR(50),   -- high, moderate, low, very_low
    evidence_type VARCHAR(50),  -- rct, cohort, case_control, case_series, expert_opinion
    citation_ref TEXT,
    anchor JSONB,  -- {url, page, section, excerpt}
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Validation Blueprints: AI-generated study plans
CREATE TABLE validation_blueprints (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    system_card_id UUID NOT NULL REFERENCES system_cards(id),
    user_id UUID NOT NULL,
    study_intent VARCHAR(100) NOT NULL,  -- external_validation, temporal_validation, subgroup_validation, head_to_head, recalibration
    research_aims JSONB DEFAULT '[]',
    hypotheses JSONB DEFAULT '[]',
    data_dictionary JSONB DEFAULT '[]',
    outcomes JSONB DEFAULT '[]',
    inclusion_criteria JSONB DEFAULT '[]',
    exclusion_criteria JSONB DEFAULT '[]',
    analysis_plan JSONB DEFAULT '[]',
    validation_metrics JSONB DEFAULT '[]',
    sensitivity_analyses JSONB DEFAULT '[]',
    limitations TEXT[],
    reporting_checklist VARCHAR(50)[],  -- TRIPOD, STROBE, etc.
    status VARCHAR(20) DEFAULT 'draft',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Calculator Results: Audit log of calculations
CREATE TABLE calculator_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    system_card_id UUID NOT NULL REFERENCES system_cards(id),
    rule_spec_id UUID REFERENCES rule_specs(id),
    user_id UUID,
    inputs JSONB NOT NULL,
    outputs JSONB NOT NULL,
    interpretation TEXT,
    context VARCHAR(50) DEFAULT 'research',  -- research, education, demo
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_system_cards_type ON system_cards(type);
CREATE INDEX IF NOT EXISTS idx_system_cards_specialty ON system_cards(specialty);
CREATE INDEX IF NOT EXISTS idx_system_cards_status ON system_cards(status);
CREATE INDEX IF NOT EXISTS idx_system_cards_name_search ON system_cards USING gin(to_tsvector('english', name));
CREATE INDEX IF NOT EXISTS idx_rule_specs_system ON rule_specs(system_card_id);
CREATE INDEX IF NOT EXISTS idx_rule_specs_type ON rule_specs(rule_type);
CREATE INDEX IF NOT EXISTS idx_evidence_system ON evidence_statements(system_card_id);
CREATE INDEX IF NOT EXISTS idx_blueprints_user ON validation_blueprints(user_id);
CREATE INDEX IF NOT EXISTS idx_blueprints_system ON validation_blueprints(system_card_id);
CREATE INDEX IF NOT EXISTS idx_calc_results_system ON calculator_results(system_card_id);
CREATE INDEX IF NOT EXISTS idx_calc_results_user ON calculator_results(user_id);

-- Comments for documentation
COMMENT ON TABLE system_cards IS 'Canonical abstraction for clinical scoring systems, staging criteria, grading scales';
COMMENT ON TABLE rule_specs IS 'Deterministic computation rules - NO LLM involvement in execution';
COMMENT ON TABLE evidence_statements IS 'Anchored citations with source provenance';
COMMENT ON TABLE validation_blueprints IS 'AI-generated study plans grounded on SystemCard inputs/outputs';
COMMENT ON TABLE calculator_results IS 'Audit log of all score calculations';
COMMENT ON COLUMN system_cards.non_computable_reason IS 'If non-NULL, system cannot be computed (e.g., STROBE checklist)';
COMMENT ON COLUMN system_cards.source_anchors IS 'Array of {url, page, section} for citation compliance';
