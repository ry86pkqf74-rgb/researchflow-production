-- Guidelines Engine Schema
-- Migration: 014_guidelines_engine.sql
-- Purpose: Create tables for clinical guidelines, scoring systems, and validation blueprints

-- Source Registry: tracks where guidelines come from and licensing
CREATE TABLE IF NOT EXISTS source_registry (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    publisher_name VARCHAR(255) NOT NULL,
    url_pattern TEXT,
    access_method VARCHAR(50) NOT NULL DEFAULT 'public_web', -- public_web, pdf, api, subscription, manual_upload
    license_type VARCHAR(50) NOT NULL DEFAULT 'unknown', -- public_domain, permissive, copyrighted_linkable, subscription, internal_only
    update_cadence VARCHAR(50), -- rolling, annual, major_editions
    -- Allowed actions (compliance enforcement)
    allow_store_full_text BOOLEAN DEFAULT FALSE,
    allow_store_tables BOOLEAN DEFAULT FALSE,
    allow_store_embeddings BOOLEAN DEFAULT FALSE,
    allow_show_excerpts BOOLEAN DEFAULT TRUE,
    excerpt_max_length INTEGER DEFAULT 500,
    require_deep_link BOOLEAN DEFAULT TRUE,
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Guideline Documents: the source artifacts
CREATE TABLE IF NOT EXISTS guideline_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(500) NOT NULL,
    publisher VARCHAR(255),
    publication_date DATE,
    version_label VARCHAR(100),
    url TEXT,
    jurisdiction VARCHAR(100),
    source_registry_id UUID REFERENCES source_registry(id),
    raw_artifact_path TEXT, -- only populated if license allows storage
    change_summary TEXT,
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- System Cards: the canonical abstraction for any guideline/score/staging
CREATE TABLE IF NOT EXISTS system_cards (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    type VARCHAR(50) NOT NULL, -- score, staging, grading, guideline, classification, criteria, reporting_standard
    -- Taxonomy
    specialty VARCHAR(100), -- surgery, oncology, cardiology, neurology, etc.
    condition_concepts JSONB DEFAULT '[]', -- [{system: "MeSH", code: "...", term: "..."}]
    intended_use VARCHAR(100), -- diagnosis, prognosis, treatment_selection, severity, complications, quality
    population VARCHAR(100), -- adult, pediatric, inpatient, outpatient, specific subgroups
    care_setting VARCHAR(100),
    -- Structure
    inputs JSONB NOT NULL DEFAULT '[]', -- [{name: "...", type: "numeric|categorical|boolean", unit: "...", required: true}]
    outputs JSONB NOT NULL DEFAULT '[]', -- [{name: "...", type: "score|stage|grade|class", range: "...", labels: [...]}]
    interpretation JSONB DEFAULT '[]', -- [{range: "...", meaning: "..."}]
    limitations TEXT[],
    evidence_summary JSONB,
    -- Linking
    guideline_document_id UUID REFERENCES guideline_documents(id),
    -- Version tracking
    version VARCHAR(50),
    effective_date DATE,
    superseded_by UUID REFERENCES system_cards(id),
    status VARCHAR(20) DEFAULT 'active', -- active, superseded, retired, draft
    -- Curation
    extraction_confidence DECIMAL(3,2), -- 0.00-1.00
    verified BOOLEAN DEFAULT FALSE,
    verified_by UUID,
    verified_at TIMESTAMPTZ,
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Rule Specs: computable definitions (JSON Logic or DSL)
CREATE TABLE IF NOT EXISTS rule_specs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    system_card_id UUID NOT NULL REFERENCES system_cards(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    -- The computable rule
    rule_type VARCHAR(50) NOT NULL, -- threshold, lookup_table, formula, decision_tree
    rule_definition JSONB NOT NULL, -- The actual logic
    -- Validation
    test_cases JSONB DEFAULT '[]', -- [{inputs: {...}, expected_output: {...}}]
    validated BOOLEAN DEFAULT FALSE,
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Evidence Statements: anchored citations for each claim
CREATE TABLE IF NOT EXISTS evidence_statements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    system_card_id UUID NOT NULL REFERENCES system_cards(id) ON DELETE CASCADE,
    statement_text TEXT NOT NULL,
    -- Evidence grading
    strength VARCHAR(50), -- strong, moderate, weak, expert_consensus
    quality VARCHAR(50), -- high, moderate, low, very_low
    evidence_type VARCHAR(50), -- rct, cohort, case_control, case_series, expert_opinion
    -- Source anchoring
    citation_ref TEXT, -- e.g., "Smith et al., 2023"
    source_url TEXT,
    source_page VARCHAR(50),
    source_section VARCHAR(255),
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Version Graph: tracks relationships between versions
CREATE TABLE IF NOT EXISTS version_graph (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    system_card_id UUID NOT NULL REFERENCES system_cards(id) ON DELETE CASCADE,
    previous_version_id UUID REFERENCES system_cards(id),
    change_type VARCHAR(50), -- new_edition, correction, update, major_revision
    change_summary TEXT,
    diff_data JSONB, -- structured diff of what changed
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Validation Blueprints: generated study plans
CREATE TABLE IF NOT EXISTS validation_blueprints (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    system_card_id UUID NOT NULL REFERENCES system_cards(id),
    user_id UUID NOT NULL,
    -- Study design
    study_intent VARCHAR(100) NOT NULL, -- external_validation, temporal_validation, subgroup_validation, head_to_head, recalibration, simplification, fairness
    research_aims JSONB DEFAULT '[]',
    hypotheses JSONB DEFAULT '[]',
    -- Data requirements
    data_dictionary JSONB DEFAULT '[]', -- [{variable: "...", type: "...", source: "...", required: true}]
    outcomes JSONB DEFAULT '[]', -- [{name: "...", type: "...", time_horizon: "..."}]
    inclusion_criteria JSONB DEFAULT '[]',
    exclusion_criteria JSONB DEFAULT '[]',
    -- Analysis plan
    analysis_plan JSONB DEFAULT '[]', -- [{method: "...", rationale: "...", assumptions: [...]}]
    validation_metrics JSONB DEFAULT '[]', -- [{metric: "...", interpretation: "..."}]
    sensitivity_analyses JSONB DEFAULT '[]',
    -- Outputs
    limitations TEXT[],
    reporting_checklist VARCHAR(50)[], -- TRIPOD, STROBE, CONSORT, etc.
    -- Status
    status VARCHAR(20) DEFAULT 'draft', -- draft, finalized, exported
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Calculator Results: audit trail for score calculations
CREATE TABLE IF NOT EXISTS calculator_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    system_card_id UUID NOT NULL REFERENCES system_cards(id),
    rule_spec_id UUID REFERENCES rule_specs(id),
    user_id UUID,
    -- Calculation
    inputs JSONB NOT NULL,
    outputs JSONB NOT NULL,
    interpretation TEXT,
    -- Context
    context VARCHAR(50) DEFAULT 'research', -- research, education, demo
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_system_cards_type ON system_cards(type);
CREATE INDEX IF NOT EXISTS idx_system_cards_specialty ON system_cards(specialty);
CREATE INDEX IF NOT EXISTS idx_system_cards_status ON system_cards(status);
CREATE INDEX IF NOT EXISTS idx_system_cards_name ON system_cards(name);
CREATE INDEX IF NOT EXISTS idx_system_cards_name_trgm ON system_cards USING gin (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_rule_specs_system_card ON rule_specs(system_card_id);
CREATE INDEX IF NOT EXISTS idx_evidence_system_card ON evidence_statements(system_card_id);
CREATE INDEX IF NOT EXISTS idx_blueprints_user ON validation_blueprints(user_id);
CREATE INDEX IF NOT EXISTS idx_blueprints_system ON validation_blueprints(system_card_id);
CREATE INDEX IF NOT EXISTS idx_calculator_results_system ON calculator_results(system_card_id);
CREATE INDEX IF NOT EXISTS idx_calculator_results_user ON calculator_results(user_id);

-- Comments for documentation
COMMENT ON TABLE source_registry IS 'Tracks sources of clinical guidelines with licensing/compliance rules';
COMMENT ON TABLE guideline_documents IS 'Source documents for clinical guidelines';
COMMENT ON TABLE system_cards IS 'Canonical abstraction for scoring systems, staging, grading, and guidelines';
COMMENT ON TABLE rule_specs IS 'Computable rule definitions (JSON Logic) for deterministic calculations';
COMMENT ON TABLE evidence_statements IS 'Evidence citations anchored to system cards';
COMMENT ON TABLE validation_blueprints IS 'AI-generated study plans for validating scoring systems';
COMMENT ON TABLE calculator_results IS 'Audit trail of all score/staging calculations';
