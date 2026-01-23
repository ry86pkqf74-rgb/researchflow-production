-- Migration: 005_review_compliance
-- Phase 5: Review and Compliance tables

-- ============================================
-- APPROVAL GATES
-- ============================================

CREATE TABLE IF NOT EXISTS approval_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  manuscript_id UUID NOT NULL,
  gate_type VARCHAR(50) NOT NULL CHECK (gate_type IN ('AI_USAGE', 'PHI_OVERRIDE', 'EXPORT', 'SUBMISSION')),
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'expired')),
  requested_by UUID NOT NULL,
  justification TEXT,
  context JSONB DEFAULT '{}',
  decided_by UUID,
  decided_at TIMESTAMPTZ,
  comments TEXT,
  conditions TEXT[] DEFAULT ARRAY[]::TEXT[],
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_approval_manuscript ON approval_requests(manuscript_id);
CREATE INDEX IF NOT EXISTS idx_approval_gate_type ON approval_requests(gate_type);
CREATE INDEX IF NOT EXISTS idx_approval_status ON approval_requests(status);
CREATE INDEX IF NOT EXISTS idx_approval_pending ON approval_requests(status, expires_at) WHERE status = 'pending';

-- Gate configurations (optional, for dynamic config)
CREATE TABLE IF NOT EXISTS gate_configurations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gate_type VARCHAR(50) UNIQUE NOT NULL,
  required_roles TEXT[] NOT NULL,
  auto_approve_roles TEXT[] DEFAULT ARRAY[]::TEXT[],
  expiration_hours INT DEFAULT 168,
  require_justification BOOLEAN DEFAULT true,
  notify_on_request TEXT[] DEFAULT ARRAY[]::TEXT[],
  notify_on_decision TEXT[] DEFAULT ARRAY[]::TEXT[],
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default configurations
INSERT INTO gate_configurations (gate_type, required_roles, auto_approve_roles, expiration_hours, require_justification)
VALUES 
  ('AI_USAGE', ARRAY['researcher', 'pi', 'admin'], ARRAY['pi', 'admin'], 168, true),
  ('PHI_OVERRIDE', ARRAY['pi', 'compliance_officer', 'admin'], ARRAY[]::TEXT[], 24, true),
  ('EXPORT', ARRAY['researcher', 'pi', 'admin'], ARRAY['pi', 'admin'], 72, false),
  ('SUBMISSION', ARRAY['pi', 'admin'], ARRAY[]::TEXT[], 168, true)
ON CONFLICT (gate_type) DO NOTHING;

-- ============================================
-- BLINDING SERVICE
-- ============================================

CREATE TABLE IF NOT EXISTS blinding_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  manuscript_id UUID NOT NULL,
  blinding_level VARCHAR(20) NOT NULL CHECK (blinding_level IN ('single', 'double')),
  original_hash VARCHAR(64) NOT NULL,
  blinded_hash VARCHAR(64) NOT NULL,
  redaction_map JSONB DEFAULT '{}',
  redaction_count INT DEFAULT 0,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  unblinded_at TIMESTAMPTZ,
  unblinded_by UUID
);

CREATE INDEX IF NOT EXISTS idx_blinding_manuscript ON blinding_records(manuscript_id);
CREATE INDEX IF NOT EXISTS idx_blinding_active ON blinding_records(manuscript_id) WHERE unblinded_at IS NULL;

-- ============================================
-- COMPLIANCE REPORTS
-- ============================================

CREATE TABLE IF NOT EXISTS compliance_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  manuscript_id UUID NOT NULL,
  checklist_type VARCHAR(20) NOT NULL CHECK (checklist_type IN ('STROBE', 'PRISMA')),
  study_type VARCHAR(50),
  overall_score NUMERIC(5,2),
  grade VARCHAR(2),
  items JSONB NOT NULL,
  summary JSONB,
  recommendations TEXT[],
  generated_by UUID,
  generated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_compliance_manuscript ON compliance_reports(manuscript_id);
CREATE INDEX IF NOT EXISTS idx_compliance_type ON compliance_reports(checklist_type);
CREATE INDEX IF NOT EXISTS idx_compliance_score ON compliance_reports(overall_score);

-- Compliance history for tracking improvements
CREATE TABLE IF NOT EXISTS compliance_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  manuscript_id UUID NOT NULL,
  checklist_type VARCHAR(20) NOT NULL,
  version INT NOT NULL,
  score NUMERIC(5,2),
  grade VARCHAR(2),
  items_passed INT,
  items_failed INT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_compliance_history_manuscript ON compliance_history(manuscript_id, checklist_type);

-- ============================================
-- HELPER FUNCTIONS
-- ============================================

-- Auto-expire pending approval requests
CREATE OR REPLACE FUNCTION expire_approval_requests()
RETURNS INTEGER AS $$
DECLARE
  expired_count INTEGER;
BEGIN
  UPDATE approval_requests
  SET status = 'expired', updated_at = NOW()
  WHERE status = 'pending' AND expires_at < NOW();
  
  GET DIAGNOSTICS expired_count = ROW_COUNT;
  RETURN expired_count;
END;
$$ LANGUAGE plpgsql;

-- Get current approval status for manuscript
CREATE OR REPLACE FUNCTION get_approval_status(
  p_manuscript_id UUID,
  p_gate_type VARCHAR
)
RETURNS TABLE(
  has_approval BOOLEAN,
  status VARCHAR,
  decided_at TIMESTAMPTZ,
  conditions TEXT[]
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    CASE WHEN ar.status = 'approved' THEN true ELSE false END,
    ar.status,
    ar.decided_at,
    ar.conditions
  FROM approval_requests ar
  WHERE ar.manuscript_id = p_manuscript_id
    AND ar.gate_type = p_gate_type
    AND (ar.expires_at IS NULL OR ar.expires_at > NOW())
  ORDER BY ar.created_at DESC
  LIMIT 1;
END;
$$ LANGUAGE plpgsql;

-- Update timestamps trigger
CREATE OR REPLACE FUNCTION update_review_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS approval_updated_at ON approval_requests;
CREATE TRIGGER approval_updated_at
  BEFORE UPDATE ON approval_requests
  FOR EACH ROW
  EXECUTE FUNCTION update_review_updated_at();

DROP TRIGGER IF EXISTS gate_config_updated_at ON gate_configurations;
CREATE TRIGGER gate_config_updated_at
  BEFORE UPDATE ON gate_configurations
  FOR EACH ROW
  EXECUTE FUNCTION update_review_updated_at();

-- ============================================
-- VIEWS
-- ============================================

-- Pending approvals view
CREATE OR REPLACE VIEW pending_approvals AS
SELECT 
  ar.*,
  gc.required_roles,
  gc.expiration_hours,
  EXTRACT(EPOCH FROM (ar.expires_at - NOW()))/3600 as hours_remaining
FROM approval_requests ar
LEFT JOIN gate_configurations gc ON ar.gate_type = gc.gate_type
WHERE ar.status = 'pending'
  AND (ar.expires_at IS NULL OR ar.expires_at > NOW())
ORDER BY ar.created_at ASC;

-- Compliance summary view
CREATE OR REPLACE VIEW manuscript_compliance_summary AS
SELECT 
  manuscript_id,
  MAX(CASE WHEN checklist_type = 'STROBE' THEN overall_score END) as strobe_score,
  MAX(CASE WHEN checklist_type = 'STROBE' THEN grade END) as strobe_grade,
  MAX(CASE WHEN checklist_type = 'PRISMA' THEN overall_score END) as prisma_score,
  MAX(CASE WHEN checklist_type = 'PRISMA' THEN grade END) as prisma_grade,
  MAX(generated_at) as last_checked
FROM compliance_reports
GROUP BY manuscript_id;

-- ============================================
-- COMMENTS
-- ============================================

COMMENT ON TABLE approval_requests IS 'Governance gate approval requests';
COMMENT ON TABLE gate_configurations IS 'Configuration for each gate type';
COMMENT ON TABLE blinding_records IS 'Manuscript blinding records for peer review';
COMMENT ON TABLE compliance_reports IS 'STROBE/PRISMA compliance check results';
COMMENT ON TABLE compliance_history IS 'Track compliance score changes over time';
