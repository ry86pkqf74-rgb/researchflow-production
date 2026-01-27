-- ============================================
-- Migration 004: Demo Fixtures Tables
-- ============================================
-- These tables support the transition from demo fixtures to DB-backed data.
-- See docs/DEMO_FIXTURES_INVENTORY.md for full context.
--
-- Priority: HIGH items should be uncommented and run first.
-- Generated: 2026-01-27
-- ============================================

-- ============================================
-- HIGH PRIORITY: PHI Scans Table
-- ============================================
-- Currently using in-memory Map in phi-scanner.ts
-- This table persists PHI scan results for audit and review.

CREATE TABLE IF NOT EXISTS phi_scans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  file_id UUID, -- REFERENCES files(id) when files table exists
  research_id UUID, -- REFERENCES research_projects(id) when table exists
  user_id UUID, -- REFERENCES users(id) when table exists
  governance_mode VARCHAR(20) NOT NULL DEFAULT 'DEMO',

  -- Scan results
  findings JSONB NOT NULL DEFAULT '[]',
  findings_count INTEGER DEFAULT 0,
  risk_level VARCHAR(20) CHECK (risk_level IN ('none', 'low', 'medium', 'high')),

  -- Location data (coordinates only, no PHI values)
  locations JSONB DEFAULT '[]',

  -- Metadata
  scanned_at TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_phi_scans_file ON phi_scans(file_id);
CREATE INDEX IF NOT EXISTS idx_phi_scans_research ON phi_scans(research_id);
CREATE INDEX IF NOT EXISTS idx_phi_scans_user ON phi_scans(user_id);
CREATE INDEX IF NOT EXISTS idx_phi_scans_risk ON phi_scans(risk_level);

-- ============================================
-- MEDIUM PRIORITY: Sustainability Metrics
-- ============================================
-- Currently returning mock data in sustainability.ts
-- These tables track carbon footprint and resource usage.

-- Uncomment when ready to implement sustainability tracking:

/*
CREATE TABLE IF NOT EXISTS sustainability_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID, -- REFERENCES organizations(id)
  period VARCHAR(20) NOT NULL, -- 'hourly', 'daily', 'weekly', 'monthly'
  period_start TIMESTAMP NOT NULL,
  period_end TIMESTAMP NOT NULL,

  -- Resource usage
  carbon_kg DECIMAL(10,4) DEFAULT 0,
  energy_kwh DECIMAL(10,4) DEFAULT 0,
  water_liters DECIMAL(10,4) DEFAULT 0,
  compute_hours DECIMAL(10,2) DEFAULT 0,

  -- AI usage breakdown
  api_calls_count INTEGER DEFAULT 0,
  tokens_input BIGINT DEFAULT 0,
  tokens_output BIGINT DEFAULT 0,
  model_tier VARCHAR(20), -- 'nano', 'micro', 'standard', 'premium', 'frontier'

  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sustainability_org ON sustainability_metrics(org_id);
CREATE INDEX IF NOT EXISTS idx_sustainability_period ON sustainability_metrics(period_start, period_end);

CREATE TABLE IF NOT EXISTS sustainability_goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID, -- REFERENCES organizations(id)
  metric_type VARCHAR(50) NOT NULL, -- 'carbon', 'energy', 'water', 'compute'
  target_value DECIMAL(10,4) NOT NULL,
  current_value DECIMAL(10,4) DEFAULT 0,
  deadline DATE,
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'achieved', 'missed', 'cancelled')),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
*/

-- ============================================
-- Notes for implementation
-- ============================================
--
-- 1. After running this migration, update the routes:
--    - phi-scanner.ts: Replace Map with DB queries
--    - sustainability.ts: Replace mock functions with real queries
--
-- 2. The datasets table should already exist from earlier migrations.
--    Check that datasets.ts uses DB queries, not mockDatasets array.
--
-- 3. For custom-fields.ts, verify custom_field_values table exists
--    and implement the actual value retrieval.
