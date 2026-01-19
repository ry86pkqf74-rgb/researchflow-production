-- Phase D Integrations Migration
-- Tasks: 151, 156, 159, 168, 174, 177, 179, 185, 186

-- =============================================================================
-- OAuth Connections (Task 151, 159, 168, 177)
-- =============================================================================
CREATE TABLE IF NOT EXISTS oauth_connections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    provider TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'connected' CHECK (status IN ('connected', 'disconnected', 'expired', 'error')),
    external_account_id TEXT,
    external_account_label TEXT,
    token_encrypted TEXT NOT NULL,
    meta JSONB NOT NULL DEFAULT '{}'::jsonb,
    last_sync_at TIMESTAMPTZ,
    last_sync_cursor TEXT,
    last_error TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS oauth_connections_user_provider_idx
    ON oauth_connections(user_id, provider);
CREATE INDEX IF NOT EXISTS oauth_connections_provider_status_idx
    ON oauth_connections(provider, status);
CREATE UNIQUE INDEX IF NOT EXISTS oauth_connections_user_provider_account_idx
    ON oauth_connections(user_id, provider, external_account_id)
    WHERE external_account_id IS NOT NULL;

-- =============================================================================
-- Integration Sync Runs (Task 151, 159, 168, 177)
-- =============================================================================
CREATE TABLE IF NOT EXISTS integration_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    connection_id UUID NOT NULL REFERENCES oauth_connections(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed')),
    sync_type TEXT NOT NULL DEFAULT 'incremental' CHECK (sync_type IN ('full', 'incremental')),
    items_synced INTEGER NOT NULL DEFAULT 0,
    items_created INTEGER NOT NULL DEFAULT 0,
    items_updated INTEGER NOT NULL DEFAULT 0,
    items_deleted INTEGER NOT NULL DEFAULT 0,
    next_cursor TEXT,
    has_more BOOLEAN NOT NULL DEFAULT FALSE,
    error_message TEXT,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    duration_ms INTEGER,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS integration_runs_connection_idx
    ON integration_runs(connection_id);
CREATE INDEX IF NOT EXISTS integration_runs_status_idx
    ON integration_runs(status, created_at DESC);

-- =============================================================================
-- Workflow Events (Task 156)
-- =============================================================================
CREATE TABLE IF NOT EXISTS workflow_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type TEXT NOT NULL,
    workflow_id UUID,
    job_id TEXT,
    user_id UUID,
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Partition by month for efficient querying and cleanup
CREATE INDEX IF NOT EXISTS workflow_events_type_timestamp_idx
    ON workflow_events(type, timestamp DESC);
CREATE INDEX IF NOT EXISTS workflow_events_workflow_idx
    ON workflow_events(workflow_id, timestamp DESC)
    WHERE workflow_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS workflow_events_job_idx
    ON workflow_events(job_id, timestamp DESC)
    WHERE job_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS workflow_events_user_idx
    ON workflow_events(user_id, timestamp DESC)
    WHERE user_id IS NOT NULL;

-- =============================================================================
-- Artifact Variants / Thumbnails (Task 185)
-- =============================================================================
CREATE TABLE IF NOT EXISTS artifact_variants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    artifact_id UUID NOT NULL,
    variant_type TEXT NOT NULL CHECK (variant_type IN ('thumbnail', 'preview', 'optimized', 'compressed')),
    width INTEGER,
    height INTEGER,
    size_bytes INTEGER NOT NULL,
    mime_type TEXT NOT NULL,
    storage_path TEXT NOT NULL,
    storage_backend TEXT NOT NULL DEFAULT 'local' CHECK (storage_backend IN ('local', 's3')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS artifact_variants_artifact_idx
    ON artifact_variants(artifact_id);
CREATE UNIQUE INDEX IF NOT EXISTS artifact_variants_artifact_type_idx
    ON artifact_variants(artifact_id, variant_type, width, height);

-- =============================================================================
-- Manifest Provenance Chain (Task 186)
-- =============================================================================
ALTER TABLE manifests
    ADD COLUMN IF NOT EXISTS provenance_hash TEXT,
    ADD COLUMN IF NOT EXISTS prev_provenance_hash TEXT,
    ADD COLUMN IF NOT EXISTS provenance_chain_index INTEGER,
    ADD COLUMN IF NOT EXISTS provenance_signature TEXT,
    ADD COLUMN IF NOT EXISTS provenance_hashed_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS manifests_provenance_hash_idx
    ON manifests(provenance_hash)
    WHERE provenance_hash IS NOT NULL;
CREATE INDEX IF NOT EXISTS manifests_provenance_chain_idx
    ON manifests(prev_provenance_hash)
    WHERE prev_provenance_hash IS NOT NULL;

-- =============================================================================
-- Manifest Quarantine (Task 179)
-- =============================================================================
ALTER TABLE manifests
    ADD COLUMN IF NOT EXISTS quarantine_status TEXT DEFAULT 'none' CHECK (quarantine_status IN ('none', 'quarantined', 'released')),
    ADD COLUMN IF NOT EXISTS quarantine_reason_codes TEXT[],
    ADD COLUMN IF NOT EXISTS quarantine_created_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS quarantine_review_state TEXT CHECK (quarantine_review_state IN ('pending', 'approved', 'rejected')),
    ADD COLUMN IF NOT EXISTS quarantine_reviewed_by UUID,
    ADD COLUMN IF NOT EXISTS quarantine_reviewed_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS quarantine_review_notes TEXT,
    ADD COLUMN IF NOT EXISTS quarantine_triggered_rule TEXT;

CREATE INDEX IF NOT EXISTS manifests_quarantine_status_idx
    ON manifests(quarantine_status)
    WHERE quarantine_status != 'none';
CREATE INDEX IF NOT EXISTS manifests_quarantine_review_idx
    ON manifests(quarantine_review_state, quarantine_created_at DESC)
    WHERE quarantine_status = 'quarantined';

-- =============================================================================
-- Manifest Uncertainty (Task 191)
-- =============================================================================
ALTER TABLE manifests
    ADD COLUMN IF NOT EXISTS uncertainty JSONB DEFAULT '{}'::jsonb;

-- =============================================================================
-- Manifest Carbon Metrics (Task 189)
-- =============================================================================
ALTER TABLE manifests
    ADD COLUMN IF NOT EXISTS carbon_runtime_seconds NUMERIC,
    ADD COLUMN IF NOT EXISTS carbon_co2e_grams NUMERIC,
    ADD COLUMN IF NOT EXISTS carbon_method TEXT CHECK (carbon_method IN ('measured', 'estimated', 'unknown')),
    ADD COLUMN IF NOT EXISTS carbon_energy_wh NUMERIC,
    ADD COLUMN IF NOT EXISTS carbon_region TEXT;

-- =============================================================================
-- Extension Hooks Registry (Task 174)
-- =============================================================================
CREATE TABLE IF NOT EXISTS extension_hooks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    type TEXT NOT NULL CHECK (type IN (
        'beforeJobDispatch',
        'afterWorkerResult',
        'onManifestFinalized',
        'onIntegrationSync',
        'onQuarantineApplied',
        'onUserAction'
    )),
    priority INTEGER NOT NULL DEFAULT 100,
    enabled BOOLEAN NOT NULL DEFAULT FALSE,
    handler_code TEXT,
    handler_url TEXT,
    timeout_ms INTEGER NOT NULL DEFAULT 5000,
    fail_on_error BOOLEAN NOT NULL DEFAULT FALSE,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS extension_hooks_type_enabled_idx
    ON extension_hooks(type, enabled, priority);

-- =============================================================================
-- User Badges / Gamification (Task 171)
-- =============================================================================
CREATE TABLE IF NOT EXISTS user_badges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    badge_type TEXT NOT NULL,
    badge_level INTEGER NOT NULL DEFAULT 1,
    earned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS user_badges_user_idx
    ON user_badges(user_id);
CREATE UNIQUE INDEX IF NOT EXISTS user_badges_user_type_idx
    ON user_badges(user_id, badge_type);

-- =============================================================================
-- Queue Metrics (Task 158, 175)
-- =============================================================================
CREATE TABLE IF NOT EXISTS queue_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    queue_name TEXT NOT NULL,
    backend TEXT NOT NULL DEFAULT 'bullmq' CHECK (backend IN ('bullmq', 'rabbitmq', 'dual')),
    depth INTEGER NOT NULL,
    processing INTEGER NOT NULL DEFAULT 0,
    completed_total BIGINT NOT NULL DEFAULT 0,
    failed_total BIGINT NOT NULL DEFAULT 0,
    avg_wait_time_ms INTEGER,
    avg_process_time_ms INTEGER,
    recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS queue_metrics_queue_time_idx
    ON queue_metrics(queue_name, recorded_at DESC);

-- =============================================================================
-- Triggers for updated_at
-- =============================================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS oauth_connections_updated_at ON oauth_connections;
CREATE TRIGGER oauth_connections_updated_at
    BEFORE UPDATE ON oauth_connections
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS extension_hooks_updated_at ON extension_hooks;
CREATE TRIGGER extension_hooks_updated_at
    BEFORE UPDATE ON extension_hooks
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
