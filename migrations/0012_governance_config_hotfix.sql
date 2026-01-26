-- Governance Config Hotfix
-- Ensures governance_config exists and has default mode.

CREATE TABLE IF NOT EXISTS governance_config (
  key VARCHAR(100) PRIMARY KEY,
  value JSONB NOT NULL DEFAULT '{}',
  updated_by UUID REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

INSERT INTO governance_config (key, value, updated_at)
VALUES ('mode', '{"mode": "DEMO"}', NOW())
ON CONFLICT (key) DO NOTHING;
