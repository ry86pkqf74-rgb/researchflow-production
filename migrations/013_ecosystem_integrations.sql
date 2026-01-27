-- Migration: 013_ecosystem_integrations.sql
-- Track B Phase 17: Ecosystem Integrations
--
-- Tables for external service integrations

-- =============================================================================
-- User Integrations
-- =============================================================================
-- Store OAuth tokens and settings for external services

CREATE TABLE IF NOT EXISTS user_integrations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    -- Service info
    service_name VARCHAR(50) NOT NULL, -- orcid, zotero, mendeley, crossref, pubmed, google_scholar
    service_user_id VARCHAR(255), -- User ID on external service

    -- OAuth tokens
    access_token TEXT,
    refresh_token TEXT,
    token_expires_at TIMESTAMPTZ,
    token_scope TEXT,

    -- API keys (for services that use API keys instead of OAuth)
    api_key TEXT,

    -- Service-specific settings
    settings JSONB DEFAULT '{}',

    -- Status
    is_active BOOLEAN DEFAULT TRUE,
    last_sync_at TIMESTAMPTZ,
    sync_status VARCHAR(20), -- pending, syncing, completed, failed
    sync_error TEXT,

    -- Stats
    items_synced INTEGER DEFAULT 0,
    last_item_synced_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(user_id, service_name)
);

CREATE INDEX IF NOT EXISTS idx_user_integrations_user ON user_integrations(user_id);
CREATE INDEX IF NOT EXISTS idx_user_integrations_service ON user_integrations(service_name);

-- =============================================================================
-- ORCID Profile Data
-- =============================================================================
-- Cache ORCID profile information

CREATE TABLE IF NOT EXISTS orcid_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    -- ORCID identifiers
    orcid_id VARCHAR(20) NOT NULL, -- 0000-0000-0000-0000 format
    orcid_uri TEXT,

    -- Profile data
    given_names VARCHAR(200),
    family_name VARCHAR(200),
    credit_name VARCHAR(300),
    biography TEXT,

    -- Affiliations (cached from ORCID)
    affiliations JSONB DEFAULT '[]',

    -- Works (cached from ORCID)
    works_count INTEGER DEFAULT 0,
    works_last_synced TIMESTAMPTZ,

    -- Settings
    auto_sync BOOLEAN DEFAULT TRUE,
    sync_publications BOOLEAN DEFAULT TRUE,
    sync_affiliations BOOLEAN DEFAULT TRUE,

    last_synced_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(user_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_orcid_profiles_orcid ON orcid_profiles(orcid_id);

-- =============================================================================
-- Reference Manager Sync
-- =============================================================================
-- Track synced items from Zotero/Mendeley

CREATE TABLE IF NOT EXISTS reference_manager_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    integration_id UUID NOT NULL REFERENCES user_integrations(id) ON DELETE CASCADE,

    -- External IDs
    external_id VARCHAR(255) NOT NULL, -- Item ID in Zotero/Mendeley
    external_version VARCHAR(50), -- Version for sync tracking
    external_collection_id VARCHAR(255),

    -- Linked local item
    citation_id UUID REFERENCES citations(id) ON DELETE SET NULL,
    paper_id UUID REFERENCES papers(id) ON DELETE SET NULL,

    -- Item data (cached)
    item_type VARCHAR(50),
    title TEXT,
    creators JSONB DEFAULT '[]',
    date_added TIMESTAMPTZ,
    date_modified TIMESTAMPTZ,

    -- Sync status
    sync_direction VARCHAR(20) DEFAULT 'pull', -- pull, push, bidirectional
    last_synced_at TIMESTAMPTZ,
    is_dirty BOOLEAN DEFAULT FALSE, -- Local changes not yet pushed

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(integration_id, external_id)
);

CREATE INDEX IF NOT EXISTS idx_ref_manager_items_user ON reference_manager_items(user_id);
CREATE INDEX IF NOT EXISTS idx_ref_manager_items_integration ON reference_manager_items(integration_id);
CREATE INDEX IF NOT EXISTS idx_ref_manager_items_citation ON reference_manager_items(citation_id);

-- =============================================================================
-- Webhook Configurations
-- =============================================================================
-- Configure incoming/outgoing webhooks

CREATE TABLE IF NOT EXISTS webhook_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id VARCHAR(255) REFERENCES users(id) ON DELETE CASCADE, -- NULL for system webhooks

    -- Webhook info
    name VARCHAR(200) NOT NULL,
    description TEXT,
    direction VARCHAR(20) NOT NULL, -- incoming, outgoing

    -- For incoming webhooks
    webhook_url TEXT, -- URL to send to this service
    webhook_secret VARCHAR(255), -- For verifying incoming requests

    -- For outgoing webhooks
    target_url TEXT, -- URL to call
    http_method VARCHAR(10) DEFAULT 'POST',
    headers JSONB DEFAULT '{}',
    auth_type VARCHAR(20), -- none, basic, bearer, custom
    auth_credentials TEXT, -- Encrypted

    -- Triggers (for outgoing)
    trigger_events JSONB DEFAULT '[]', -- Events that trigger this webhook

    -- Settings
    is_active BOOLEAN DEFAULT TRUE,
    retry_count INTEGER DEFAULT 3,
    retry_delay_seconds INTEGER DEFAULT 60,

    -- Stats
    total_calls INTEGER DEFAULT 0,
    successful_calls INTEGER DEFAULT 0,
    failed_calls INTEGER DEFAULT 0,
    last_called_at TIMESTAMPTZ,
    last_error TEXT,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_webhook_configs_user ON webhook_configs(user_id);
CREATE INDEX IF NOT EXISTS idx_webhook_configs_active ON webhook_configs(is_active);

-- =============================================================================
-- Webhook Logs
-- =============================================================================

CREATE TABLE IF NOT EXISTS webhook_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    webhook_id UUID NOT NULL REFERENCES webhook_configs(id) ON DELETE CASCADE,

    -- Request info
    direction VARCHAR(20) NOT NULL, -- incoming, outgoing
    event_type VARCHAR(100),
    request_url TEXT,
    request_method VARCHAR(10),
    request_headers JSONB,
    request_body TEXT,

    -- Response info
    response_status INTEGER,
    response_headers JSONB,
    response_body TEXT,
    response_time_ms INTEGER,

    -- Status
    status VARCHAR(20) DEFAULT 'pending', -- pending, success, failed, retrying
    error_message TEXT,
    retry_count INTEGER DEFAULT 0,

    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_webhook_logs_webhook ON webhook_logs(webhook_id);
CREATE INDEX IF NOT EXISTS idx_webhook_logs_created ON webhook_logs(created_at DESC);

-- =============================================================================
-- Import/Export Jobs
-- =============================================================================
-- Track bulk import/export operations

CREATE TABLE IF NOT EXISTS import_export_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    -- Job type
    job_type VARCHAR(50) NOT NULL, -- import, export
    source_type VARCHAR(50), -- zotero, mendeley, bibtex, ris, endnote, csv
    target_type VARCHAR(50),

    -- File info
    input_filename VARCHAR(500),
    input_path TEXT,
    output_filename VARCHAR(500),
    output_path TEXT,

    -- Progress
    status VARCHAR(20) DEFAULT 'pending', -- pending, processing, completed, failed
    progress INTEGER DEFAULT 0,
    total_items INTEGER,
    processed_items INTEGER DEFAULT 0,
    successful_items INTEGER DEFAULT 0,
    failed_items INTEGER DEFAULT 0,

    -- Results
    results JSONB DEFAULT '{}',
    errors JSONB DEFAULT '[]',

    -- Timing
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_import_export_user ON import_export_jobs(user_id);
CREATE INDEX IF NOT EXISTS idx_import_export_status ON import_export_jobs(status);

-- =============================================================================
-- External Service Status Cache
-- =============================================================================
-- Cache service availability and rate limits

CREATE TABLE IF NOT EXISTS service_status_cache (
    service_name VARCHAR(50) PRIMARY KEY,

    -- Status
    is_available BOOLEAN DEFAULT TRUE,
    status_message TEXT,
    last_checked_at TIMESTAMPTZ DEFAULT NOW(),

    -- Rate limits
    rate_limit_remaining INTEGER,
    rate_limit_total INTEGER,
    rate_limit_resets_at TIMESTAMPTZ,

    -- Response times (rolling average)
    avg_response_time_ms INTEGER,
    p95_response_time_ms INTEGER,

    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert known services
INSERT INTO service_status_cache (service_name, is_available) VALUES
('crossref', TRUE),
('pubmed', TRUE),
('orcid', TRUE),
('zotero', TRUE),
('mendeley', TRUE),
('unpaywall', TRUE),
('semantic_scholar', TRUE),
('openalex', TRUE)
ON CONFLICT DO NOTHING;

-- =============================================================================
-- Triggers
-- =============================================================================

CREATE OR REPLACE FUNCTION update_integration_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_user_integrations_updated ON user_integrations;
CREATE TRIGGER trigger_user_integrations_updated
    BEFORE UPDATE ON user_integrations
    FOR EACH ROW
    EXECUTE FUNCTION update_integration_timestamp();

DROP TRIGGER IF EXISTS trigger_orcid_profiles_updated ON orcid_profiles;
CREATE TRIGGER trigger_orcid_profiles_updated
    BEFORE UPDATE ON orcid_profiles
    FOR EACH ROW
    EXECUTE FUNCTION update_integration_timestamp();

DROP TRIGGER IF EXISTS trigger_webhook_configs_updated ON webhook_configs;
CREATE TRIGGER trigger_webhook_configs_updated
    BEFORE UPDATE ON webhook_configs
    FOR EACH ROW
    EXECUTE FUNCTION update_integration_timestamp();
