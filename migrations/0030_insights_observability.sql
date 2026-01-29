-- Migration: 0030_insights_observability.sql
-- Phase 6: Insights & Observability Tables
-- Generated: 2026-01-29

-- =====================
-- INSIGHT EVENTS TABLE
-- Store events for replay, audit, and analytics
-- =====================

CREATE TABLE IF NOT EXISTS insight_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    timestamp TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    category VARCHAR(20) NOT NULL,
    source VARCHAR(50) NOT NULL,
    event_type VARCHAR(100) NOT NULL,
    severity VARCHAR(20) NOT NULL DEFAULT 'info',
    
    -- Context identifiers
    run_id VARCHAR(255),
    research_id VARCHAR(255),
    user_id VARCHAR(255) REFERENCES users(id) ON DELETE SET NULL,
    session_id VARCHAR(255),
    
    -- Event payload (PHI-safe: no raw data content)
    payload JSONB NOT NULL DEFAULT '{}',
    
    -- Tracing support
    trace_id VARCHAR(64),
    span_id VARCHAR(32),
    parent_span_id VARCHAR(32),
    
    -- Metadata
    duration_ms INTEGER,
    metadata JSONB NOT NULL DEFAULT '{}',
    
    -- Retention
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for insight_events
CREATE INDEX IF NOT EXISTS idx_insight_events_timestamp ON insight_events(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_insight_events_category ON insight_events(category);
CREATE INDEX IF NOT EXISTS idx_insight_events_source ON insight_events(source);
CREATE INDEX IF NOT EXISTS idx_insight_events_event_type ON insight_events(event_type);
CREATE INDEX IF NOT EXISTS idx_insight_events_severity ON insight_events(severity);
CREATE INDEX IF NOT EXISTS idx_insight_events_run_id ON insight_events(run_id) WHERE run_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_insight_events_research_id ON insight_events(research_id) WHERE research_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_insight_events_user_id ON insight_events(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_insight_events_trace_id ON insight_events(trace_id) WHERE trace_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_insight_events_expires_at ON insight_events(expires_at) WHERE expires_at IS NOT NULL;

-- Composite index for common queries
CREATE INDEX IF NOT EXISTS idx_insight_events_category_timestamp ON insight_events(category, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_insight_events_source_timestamp ON insight_events(source, timestamp DESC);

-- =====================
-- INSIGHT SUBSCRIPTIONS TABLE
-- Track who subscribes to what events (WebSocket channels)
-- =====================

CREATE TABLE IF NOT EXISTS insight_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Subscription filters
    categories JSONB NOT NULL DEFAULT '[]',
    sources JSONB NOT NULL DEFAULT '[]',
    event_types JSONB NOT NULL DEFAULT '[]',
    severities JSONB NOT NULL DEFAULT '[]',
    
    -- Scope filters
    research_ids JSONB NOT NULL DEFAULT '[]',
    
    -- Delivery settings
    delivery_channel VARCHAR(50) NOT NULL DEFAULT 'websocket',
    webhook_url TEXT,
    
    -- Status
    is_active BOOLEAN NOT NULL DEFAULT true,
    last_delivered_at TIMESTAMPTZ,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for insight_subscriptions
CREATE INDEX IF NOT EXISTS idx_insight_subscriptions_user_id ON insight_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_insight_subscriptions_active ON insight_subscriptions(is_active) WHERE is_active = true;

-- =====================
-- INSIGHT ALERTS TABLE
-- Alert configurations with thresholds and actions
-- =====================

CREATE TABLE IF NOT EXISTS insight_alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    
    -- Alert condition
    category VARCHAR(20) NOT NULL,
    event_type VARCHAR(100),
    condition_field VARCHAR(100) NOT NULL,
    condition_operator VARCHAR(20) NOT NULL,
    condition_value TEXT NOT NULL,
    
    -- Threshold settings (for rate-based alerts)
    threshold_count INTEGER,
    threshold_window_seconds INTEGER,
    
    -- Actions
    actions JSONB NOT NULL DEFAULT '[]',
    
    -- Scope
    org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    research_ids JSONB NOT NULL DEFAULT '[]',
    
    -- Status
    enabled BOOLEAN NOT NULL DEFAULT true,
    last_triggered_at TIMESTAMPTZ,
    trigger_count INTEGER NOT NULL DEFAULT 0,
    
    -- Cooldown (prevent alert storms)
    cooldown_seconds INTEGER NOT NULL DEFAULT 300,
    
    created_by VARCHAR(255) REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for insight_alerts
CREATE INDEX IF NOT EXISTS idx_insight_alerts_org_id ON insight_alerts(org_id) WHERE org_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_insight_alerts_enabled ON insight_alerts(enabled) WHERE enabled = true;
CREATE INDEX IF NOT EXISTS idx_insight_alerts_category ON insight_alerts(category);

-- =====================
-- INSIGHT ALERT HISTORY TABLE
-- Track when alerts were triggered
-- =====================

CREATE TABLE IF NOT EXISTS insight_alert_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    alert_id UUID NOT NULL REFERENCES insight_alerts(id) ON DELETE CASCADE,
    event_id UUID REFERENCES insight_events(id) ON DELETE SET NULL,
    
    -- Trigger context
    trigger_value TEXT,
    matched_condition JSONB NOT NULL,
    
    -- Actions taken
    actions_taken JSONB NOT NULL DEFAULT '[]',
    action_results JSONB NOT NULL DEFAULT '{}',
    
    -- Resolution
    acknowledged BOOLEAN NOT NULL DEFAULT false,
    acknowledged_by VARCHAR(255) REFERENCES users(id),
    acknowledged_at TIMESTAMPTZ,
    resolution TEXT,
    
    triggered_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for insight_alert_history
CREATE INDEX IF NOT EXISTS idx_insight_alert_history_alert_id ON insight_alert_history(alert_id);
CREATE INDEX IF NOT EXISTS idx_insight_alert_history_triggered_at ON insight_alert_history(triggered_at DESC);
CREATE INDEX IF NOT EXISTS idx_insight_alert_history_acknowledged ON insight_alert_history(acknowledged) WHERE acknowledged = false;

-- =====================
-- AI TRACE EVENTS TABLE
-- Detailed AI invocation tracing for explainability
-- =====================

CREATE TABLE IF NOT EXISTS ai_trace_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Link to parent invocation
    invocation_id UUID REFERENCES ai_invocations(id) ON DELETE CASCADE,
    insight_event_id UUID REFERENCES insight_events(id) ON DELETE SET NULL,
    
    -- Tracing identifiers
    trace_id VARCHAR(64) NOT NULL,
    span_id VARCHAR(32) NOT NULL,
    parent_span_id VARCHAR(32),
    
    -- Event details
    span_name VARCHAR(100) NOT NULL,
    span_kind VARCHAR(20) NOT NULL DEFAULT 'internal',
    
    -- Timing
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ,
    duration_ms INTEGER,
    
    -- Attributes (PHI-safe metadata only)
    attributes JSONB NOT NULL DEFAULT '{}',
    
    -- Status
    status_code VARCHAR(20) NOT NULL DEFAULT 'OK',
    status_message TEXT,
    
    -- Context
    research_id VARCHAR(255),
    user_id VARCHAR(255) REFERENCES users(id) ON DELETE SET NULL,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for ai_trace_events
CREATE INDEX IF NOT EXISTS idx_ai_trace_events_trace_id ON ai_trace_events(trace_id);
CREATE INDEX IF NOT EXISTS idx_ai_trace_events_invocation_id ON ai_trace_events(invocation_id) WHERE invocation_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ai_trace_events_span_id ON ai_trace_events(span_id);
CREATE INDEX IF NOT EXISTS idx_ai_trace_events_start_time ON ai_trace_events(start_time DESC);

-- Composite index for trace queries
CREATE INDEX IF NOT EXISTS idx_ai_trace_events_trace_span ON ai_trace_events(trace_id, span_id);

-- =====================
-- RETENTION POLICY FUNCTION
-- Auto-delete expired insight events
-- =====================

CREATE OR REPLACE FUNCTION cleanup_expired_insight_events()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM insight_events
    WHERE expires_at IS NOT NULL AND expires_at < CURRENT_TIMESTAMP;
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- =====================
-- UPDATED_AT TRIGGERS
-- =====================

CREATE OR REPLACE FUNCTION update_insight_subscriptions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_insight_subscriptions_updated_at
    BEFORE UPDATE ON insight_subscriptions
    FOR EACH ROW
    EXECUTE FUNCTION update_insight_subscriptions_updated_at();

CREATE OR REPLACE FUNCTION update_insight_alerts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_insight_alerts_updated_at
    BEFORE UPDATE ON insight_alerts
    FOR EACH ROW
    EXECUTE FUNCTION update_insight_alerts_updated_at();

-- =====================
-- COMMENTS FOR DOCUMENTATION
-- =====================

COMMENT ON TABLE insight_events IS 'PHI-safe event storage for observability and audit trail';
COMMENT ON TABLE insight_subscriptions IS 'User subscriptions to real-time insight events';
COMMENT ON TABLE insight_alerts IS 'Configurable alert rules for insight events';
COMMENT ON TABLE insight_alert_history IS 'History of triggered alerts and resolutions';
COMMENT ON TABLE ai_trace_events IS 'Distributed tracing spans for AI invocations';

COMMENT ON COLUMN insight_events.payload IS 'Event-specific data, must be PHI-safe';
COMMENT ON COLUMN insight_events.trace_id IS 'W3C Trace Context trace-id for distributed tracing';
COMMENT ON COLUMN insight_events.span_id IS 'W3C Trace Context span-id';
COMMENT ON COLUMN insight_alerts.cooldown_seconds IS 'Minimum seconds between repeated alerts';
