-- Migration: Phase D - AI Ethics & Security Tables
-- Version: 0004
-- Date: 2026-01-20
-- Description: Adds tables for ethics approvals, AI feedback, user consents, quotas, MFA, and security anomalies

-- =============================================
-- ETHICS APPROVALS TABLE (Task 62)
-- Tracks ethics approval requirements for AI operations
-- =============================================
CREATE TABLE IF NOT EXISTS ethics_approvals (
    id VARCHAR(255) PRIMARY KEY DEFAULT gen_random_uuid()::text,
    task_type VARCHAR(100) NOT NULL,
    ethics_category VARCHAR(50) NOT NULL CHECK (ethics_category IN ('bias_review', 'data_usage', 'patient_impact', 'model_safety', 'consent_verification')),
    risk_level VARCHAR(20) NOT NULL DEFAULT 'LOW' CHECK (risk_level IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
    requested_by_id VARCHAR(255) NOT NULL REFERENCES users(id),
    requested_by_role VARCHAR(50) NOT NULL,
    approved_by_id VARCHAR(255) REFERENCES users(id),
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED', 'EXPIRED')),
    risk_assessment JSONB,
    conditions JSONB,
    justification TEXT,
    governance_mode VARCHAR(20) NOT NULL,
    phi_risk_level VARCHAR(20),
    valid_until TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    reviewed_at TIMESTAMP
);

CREATE INDEX idx_ethics_approvals_status ON ethics_approvals(status);
CREATE INDEX idx_ethics_approvals_user ON ethics_approvals(requested_by_id);
CREATE INDEX idx_ethics_approvals_task ON ethics_approvals(task_type);
CREATE INDEX idx_ethics_approvals_risk ON ethics_approvals(risk_level);

-- =============================================
-- AI OUTPUT FEEDBACK TABLE (Task 65)
-- Collects user feedback on AI outputs
-- =============================================
CREATE TABLE IF NOT EXISTS ai_output_feedback (
    id VARCHAR(255) PRIMARY KEY DEFAULT gen_random_uuid()::text,
    invocation_id VARCHAR(255) NOT NULL,
    user_id VARCHAR(255) NOT NULL REFERENCES users(id),
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    feedback_type VARCHAR(50) NOT NULL CHECK (feedback_type IN ('accuracy', 'relevance', 'safety', 'quality', 'bias', 'completeness')),
    tags JSONB,
    comment TEXT,
    is_useful_for_training BOOLEAN DEFAULT FALSE,
    reviewed_by_admin BOOLEAN DEFAULT FALSE,
    reviewed_at TIMESTAMP,
    review_notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX idx_ai_feedback_invocation ON ai_output_feedback(invocation_id);
CREATE INDEX idx_ai_feedback_user ON ai_output_feedback(user_id);
CREATE INDEX idx_ai_feedback_type ON ai_output_feedback(feedback_type);
CREATE INDEX idx_ai_feedback_rating ON ai_output_feedback(rating);
CREATE INDEX idx_ai_feedback_reviewed ON ai_output_feedback(reviewed_by_admin);

-- =============================================
-- USER CONSENTS TABLE (Task 73 - GDPR)
-- Tracks GDPR-compliant consent records
-- =============================================
CREATE TABLE IF NOT EXISTS user_consents (
    id VARCHAR(255) PRIMARY KEY DEFAULT gen_random_uuid()::text,
    user_id VARCHAR(255) NOT NULL REFERENCES users(id),
    consent_type VARCHAR(50) NOT NULL CHECK (consent_type IN ('data_processing', 'ai_usage', 'phi_access', 'marketing', 'research_participation', 'data_sharing')),
    consent_version VARCHAR(20) NOT NULL,
    granted BOOLEAN NOT NULL,
    granted_at TIMESTAMP,
    revoked_at TIMESTAMP,
    ip_address VARCHAR(45),
    user_agent TEXT,
    legal_basis VARCHAR(50) CHECK (legal_basis IN ('consent', 'legitimate_interest', 'contract', 'legal_obligation', 'vital_interest', 'public_task')),
    purpose TEXT,
    data_categories JSONB,
    retention_period_days INTEGER,
    expires_at TIMESTAMP,
    metadata JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX idx_user_consents_user ON user_consents(user_id);
CREATE INDEX idx_user_consents_type ON user_consents(consent_type);
CREATE INDEX idx_user_consents_granted ON user_consents(granted);
CREATE INDEX idx_user_consents_revoked ON user_consents(revoked_at);

-- =============================================
-- USER QUOTAS TABLE (Task 75)
-- Tracks resource quotas per user
-- =============================================
CREATE TABLE IF NOT EXISTS user_quotas (
    id VARCHAR(255) PRIMARY KEY DEFAULT gen_random_uuid()::text,
    user_id VARCHAR(255) NOT NULL REFERENCES users(id),
    quota_type VARCHAR(50) NOT NULL CHECK (quota_type IN ('ai_calls_per_minute', 'ai_calls_per_day', 'tokens_per_day', 'storage_mb', 'exports_per_day', 'concurrent_jobs')),
    max_value INTEGER NOT NULL,
    current_value INTEGER NOT NULL DEFAULT 0,
    reset_period VARCHAR(20) NOT NULL CHECK (reset_period IN ('minute', 'hour', 'day', 'week', 'month')),
    last_reset_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    custom_limit INTEGER,
    custom_limit_set_by VARCHAR(255) REFERENCES users(id),
    custom_limit_reason TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX idx_user_quotas_user ON user_quotas(user_id);
CREATE INDEX idx_user_quotas_type ON user_quotas(quota_type);
CREATE INDEX idx_user_quotas_active ON user_quotas(is_active);
CREATE UNIQUE INDEX idx_user_quotas_unique ON user_quotas(user_id, quota_type);

-- =============================================
-- MFA ENROLLMENTS TABLE (Task 79)
-- Tracks multi-factor authentication enrollments
-- =============================================
CREATE TABLE IF NOT EXISTS mfa_enrollments (
    id VARCHAR(255) PRIMARY KEY DEFAULT gen_random_uuid()::text,
    user_id VARCHAR(255) NOT NULL REFERENCES users(id),
    mfa_type VARCHAR(20) NOT NULL DEFAULT 'totp' CHECK (mfa_type IN ('totp', 'webauthn', 'sms', 'email')),
    secret_encrypted VARCHAR(500) NOT NULL,
    backup_codes_encrypted TEXT,
    backup_codes_used JSONB,
    is_active BOOLEAN NOT NULL DEFAULT FALSE,
    is_verified BOOLEAN NOT NULL DEFAULT FALSE,
    last_used_at TIMESTAMP,
    failed_attempts INTEGER DEFAULT 0,
    locked_until TIMESTAMP,
    enrolled_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    verified_at TIMESTAMP
);

CREATE INDEX idx_mfa_enrollments_user ON mfa_enrollments(user_id);
CREATE INDEX idx_mfa_enrollments_active ON mfa_enrollments(is_active);
CREATE UNIQUE INDEX idx_mfa_enrollments_unique ON mfa_enrollments(user_id, mfa_type);

-- =============================================
-- SECURITY ANOMALIES TABLE (Task 67)
-- Tracks detected security anomalies
-- =============================================
CREATE TABLE IF NOT EXISTS security_anomalies (
    id VARCHAR(255) PRIMARY KEY DEFAULT gen_random_uuid()::text,
    anomaly_type VARCHAR(50) NOT NULL CHECK (anomaly_type IN ('brute_force', 'unusual_access', 'phi_spike', 'privilege_escalation', 'geographic_anomaly', 'rate_limit_abuse')),
    severity VARCHAR(20) NOT NULL DEFAULT 'WARNING' CHECK (severity IN ('INFO', 'WARNING', 'ALERT', 'CRITICAL')),
    user_id VARCHAR(255) REFERENCES users(id),
    ip_address VARCHAR(45),
    description TEXT NOT NULL,
    detection_score VARCHAR(20),
    evidence JSONB,
    acknowledged BOOLEAN DEFAULT FALSE,
    acknowledged_by VARCHAR(255) REFERENCES users(id),
    acknowledged_at TIMESTAMP,
    resolved_at TIMESTAMP,
    resolution_notes TEXT,
    false_positive BOOLEAN DEFAULT FALSE,
    detected_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX idx_security_anomalies_type ON security_anomalies(anomaly_type);
CREATE INDEX idx_security_anomalies_severity ON security_anomalies(severity);
CREATE INDEX idx_security_anomalies_user ON security_anomalies(user_id);
CREATE INDEX idx_security_anomalies_acknowledged ON security_anomalies(acknowledged);
CREATE INDEX idx_security_anomalies_detected ON security_anomalies(detected_at);

-- =============================================
-- EXTEND AI INVOCATIONS TABLE (Task 64 - Explainability)
-- Add columns for extended explainability tracking
-- =============================================
DO $$
BEGIN
    -- Add prompt_template_id column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'ai_invocations' AND column_name = 'prompt_template_id') THEN
        ALTER TABLE ai_invocations ADD COLUMN prompt_template_id VARCHAR(255);
    END IF;

    -- Add prompt_template_version column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'ai_invocations' AND column_name = 'prompt_template_version') THEN
        ALTER TABLE ai_invocations ADD COLUMN prompt_template_version INTEGER;
    END IF;

    -- Add prompt_hash column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'ai_invocations' AND column_name = 'prompt_hash') THEN
        ALTER TABLE ai_invocations ADD COLUMN prompt_hash VARCHAR(64);
    END IF;

    -- Add response_hash column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'ai_invocations' AND column_name = 'response_hash') THEN
        ALTER TABLE ai_invocations ADD COLUMN response_hash VARCHAR(64);
    END IF;

    -- Add phi_risk_level column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'ai_invocations' AND column_name = 'phi_risk_level') THEN
        ALTER TABLE ai_invocations ADD COLUMN phi_risk_level VARCHAR(20);
    END IF;

    -- Add reasoning_trace column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'ai_invocations' AND column_name = 'reasoning_trace') THEN
        ALTER TABLE ai_invocations ADD COLUMN reasoning_trace JSONB;
    END IF;

    -- Add ethics_approval_id column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'ai_invocations' AND column_name = 'ethics_approval_id') THEN
        ALTER TABLE ai_invocations ADD COLUMN ethics_approval_id VARCHAR(255) REFERENCES ethics_approvals(id);
    END IF;

    -- Add session_id column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'ai_invocations' AND column_name = 'session_id') THEN
        ALTER TABLE ai_invocations ADD COLUMN session_id VARCHAR(255);
    END IF;
END $$;

-- =============================================
-- VIEWS FOR REPORTING
-- =============================================

-- Ethics approval summary view
CREATE OR REPLACE VIEW v_ethics_approval_summary AS
SELECT
    DATE(created_at) as approval_date,
    risk_level,
    status,
    COUNT(*) as count,
    COUNT(*) FILTER (WHERE status = 'APPROVED') as approved_count,
    COUNT(*) FILTER (WHERE status = 'REJECTED') as rejected_count,
    AVG(EXTRACT(EPOCH FROM (reviewed_at - created_at))/3600) as avg_review_hours
FROM ethics_approvals
GROUP BY DATE(created_at), risk_level, status;

-- AI feedback summary view
CREATE OR REPLACE VIEW v_ai_feedback_summary AS
SELECT
    DATE(created_at) as feedback_date,
    feedback_type,
    COUNT(*) as count,
    ROUND(AVG(rating)::numeric, 2) as avg_rating,
    COUNT(*) FILTER (WHERE rating >= 4) as positive_count,
    COUNT(*) FILTER (WHERE rating <= 2) as negative_count
FROM ai_output_feedback
GROUP BY DATE(created_at), feedback_type;

-- Security anomaly summary view
CREATE OR REPLACE VIEW v_security_anomaly_summary AS
SELECT
    DATE(detected_at) as detection_date,
    anomaly_type,
    severity,
    COUNT(*) as count,
    COUNT(*) FILTER (WHERE acknowledged = true) as acknowledged_count,
    COUNT(*) FILTER (WHERE false_positive = true) as false_positive_count
FROM security_anomalies
GROUP BY DATE(detected_at), anomaly_type, severity;

-- =============================================
-- COMMENTS
-- =============================================
COMMENT ON TABLE ethics_approvals IS 'Phase D Task 62: Ethics gate approvals for AI operations';
COMMENT ON TABLE ai_output_feedback IS 'Phase D Task 65: User feedback on AI outputs';
COMMENT ON TABLE user_consents IS 'Phase D Task 73: GDPR-compliant consent tracking';
COMMENT ON TABLE user_quotas IS 'Phase D Task 75: Resource quotas per user';
COMMENT ON TABLE mfa_enrollments IS 'Phase D Task 79: Multi-factor authentication enrollments';
COMMENT ON TABLE security_anomalies IS 'Phase D Task 67: Security anomaly detection';
