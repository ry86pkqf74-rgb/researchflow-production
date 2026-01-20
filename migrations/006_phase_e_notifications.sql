-- ============================================
-- Migration: Phase E - Notifications & Preferences
-- ResearchFlow Production
-- Task 182: Notification system tables
-- ============================================

BEGIN;

-- User notification preferences
CREATE TABLE IF NOT EXISTS notification_preferences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL,
    channel TEXT NOT NULL,
    event_type TEXT NOT NULL,
    enabled BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT chk_channel CHECK (channel IN ('email', 'in_app', 'slack', 'webhook')),
    CONSTRAINT chk_event_type CHECK (event_type IN (
        'job_completed', 'job_failed', 'manuscript_ready',
        'approval_required', 'approval_granted', 'approval_denied',
        'phi_alert', 'system_alert', 'weekly_digest',
        'achievement_unlocked', 'streak_milestone'
    )),
    UNIQUE(user_id, channel, event_type)
);

-- In-app notifications
CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL,
    event_type TEXT NOT NULL,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    metadata JSONB DEFAULT '{}',
    read_at TIMESTAMPTZ NULL,
    dismissed_at TIMESTAMPTZ NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT chk_notification_event CHECK (event_type IN (
        'job_completed', 'job_failed', 'manuscript_ready',
        'approval_required', 'approval_granted', 'approval_denied',
        'phi_alert', 'system_alert', 'achievement_unlocked',
        'streak_milestone', 'welcome', 'feature_announcement'
    ))
);

-- Notification delivery log (for tracking email/webhook deliveries)
CREATE TABLE IF NOT EXISTS notification_deliveries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    notification_id UUID REFERENCES notifications(id) ON DELETE CASCADE,
    channel TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    attempts INT NOT NULL DEFAULT 0,
    last_attempt_at TIMESTAMPTZ NULL,
    delivered_at TIMESTAMPTZ NULL,
    error_message TEXT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT chk_delivery_channel CHECK (channel IN ('email', 'slack', 'webhook')),
    CONSTRAINT chk_delivery_status CHECK (status IN ('pending', 'sent', 'delivered', 'failed', 'bounced'))
);

-- Webhook subscriptions
CREATE TABLE IF NOT EXISTS webhook_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL,
    name TEXT NOT NULL,
    url TEXT NOT NULL,
    secret TEXT NOT NULL,
    event_types TEXT[] NOT NULL,
    enabled BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Webhook delivery attempts
CREATE TABLE IF NOT EXISTS webhook_deliveries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    subscription_id UUID NOT NULL REFERENCES webhook_subscriptions(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL,
    payload JSONB NOT NULL,
    status_code INT NULL,
    response_body TEXT NULL,
    attempt INT NOT NULL DEFAULT 1,
    next_retry_at TIMESTAMPTZ NULL,
    delivered_at TIMESTAMPTZ NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Gamification: User achievements
CREATE TABLE IF NOT EXISTS user_achievements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL,
    achievement_id TEXT NOT NULL,
    unlocked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    metadata JSONB DEFAULT '{}',

    CONSTRAINT chk_achievement CHECK (achievement_id IN (
        'first_project', 'first_manuscript', 'workflow_master',
        'speed_runner', 'quality_champion', 'collaboration_star',
        'data_guardian', 'ai_whisperer', 'publication_ready',
        'streak_7', 'streak_30', 'streak_100'
    )),
    UNIQUE(user_id, achievement_id)
);

-- Gamification: Research streaks
CREATE TABLE IF NOT EXISTS research_streaks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL UNIQUE,
    current_streak INT NOT NULL DEFAULT 0,
    longest_streak INT NOT NULL DEFAULT 0,
    last_activity_date DATE NOT NULL DEFAULT CURRENT_DATE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Feature flags
CREATE TABLE IF NOT EXISTS feature_flags (
    id TEXT PRIMARY KEY,
    description TEXT,
    enabled BOOLEAN NOT NULL DEFAULT false,
    rollout_percentage INT NOT NULL DEFAULT 0 CHECK (rollout_percentage >= 0 AND rollout_percentage <= 100),
    user_whitelist TEXT[] DEFAULT '{}',
    user_blacklist TEXT[] DEFAULT '{}',
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Insert default feature flags
INSERT INTO feature_flags (id, description, enabled, rollout_percentage) VALUES
    ('dark_mode', 'Enable dark mode theme', true, 100),
    ('ai_suggestions', 'AI-powered writing suggestions', true, 50),
    ('collaborative_editing', 'Real-time collaborative editing', false, 0),
    ('advanced_analytics', 'Advanced usage analytics dashboard', true, 100),
    ('xr_viewer', 'XR/VR data visualization', false, 0),
    ('quantum_compute', 'Quantum computing integration', false, 0),
    ('green_mode', 'Sustainability-optimized AI routing', true, 25)
ON CONFLICT (id) DO NOTHING;

-- Performance indexes
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_unread ON notifications(user_id) WHERE read_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_notifications_created ON notifications(created_at);
CREATE INDEX IF NOT EXISTS idx_notification_prefs_user ON notification_preferences(user_id);
CREATE INDEX IF NOT EXISTS idx_webhook_subs_user ON webhook_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_pending ON webhook_deliveries(next_retry_at) WHERE delivered_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_achievements_user ON user_achievements(user_id);
CREATE INDEX IF NOT EXISTS idx_streaks_user ON research_streaks(user_id);

-- Auto-update timestamp triggers
CREATE OR REPLACE FUNCTION update_notification_prefs_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_notification_prefs_updated ON notification_preferences;
CREATE TRIGGER trg_notification_prefs_updated
    BEFORE UPDATE ON notification_preferences
    FOR EACH ROW EXECUTE FUNCTION update_notification_prefs_timestamp();

DROP TRIGGER IF EXISTS trg_webhook_subs_updated ON webhook_subscriptions;
CREATE TRIGGER trg_webhook_subs_updated
    BEFORE UPDATE ON webhook_subscriptions
    FOR EACH ROW EXECUTE FUNCTION update_notification_prefs_timestamp();

DROP TRIGGER IF EXISTS trg_feature_flags_updated ON feature_flags;
CREATE TRIGGER trg_feature_flags_updated
    BEFORE UPDATE ON feature_flags
    FOR EACH ROW EXECUTE FUNCTION update_notification_prefs_timestamp();

COMMIT;
