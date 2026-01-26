-- Migration: 002_lit_watchers
-- Phase 2.2: Literature watcher tables for automated search monitoring

-- Literature watchers table
CREATE TABLE IF NOT EXISTS lit_watchers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  manuscript_id UUID NOT NULL,
  query TEXT NOT NULL,
  frequency VARCHAR(20) DEFAULT 'weekly' CHECK (frequency IN ('daily', 'weekly', 'monthly')),
  sources TEXT[] DEFAULT ARRAY['pubmed', 'semantic_scholar'],
  last_run TIMESTAMPTZ,
  next_run TIMESTAMPTZ,
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'paused', 'completed')),
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for efficient queries
CREATE INDEX IF NOT EXISTS idx_lit_watchers_manuscript ON lit_watchers(manuscript_id);
CREATE INDEX IF NOT EXISTS idx_lit_watchers_next_run ON lit_watchers(next_run) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_lit_watchers_status ON lit_watchers(status);

-- Literature alerts table
CREATE TABLE IF NOT EXISTS lit_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  watcher_id UUID NOT NULL REFERENCES lit_watchers(id) ON DELETE CASCADE,
  paper_title TEXT NOT NULL,
  paper_authors TEXT[],
  paper_year INT,
  paper_doi VARCHAR(255),
  paper_pmid VARCHAR(20),
  paper_url TEXT,
  relevance_score FLOAT DEFAULT 0.0,
  source VARCHAR(50) NOT NULL,
  alert_status VARCHAR(20) DEFAULT 'new' CHECK (alert_status IN ('new', 'viewed', 'dismissed', 'added')),
  notified_at TIMESTAMPTZ DEFAULT NOW(),
  acknowledged_at TIMESTAMPTZ,
  added_to_manuscript_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_lit_alerts_watcher ON lit_alerts(watcher_id);
CREATE INDEX IF NOT EXISTS idx_lit_alerts_status ON lit_alerts(alert_status);
CREATE INDEX IF NOT EXISTS idx_lit_alerts_doi ON lit_alerts(paper_doi) WHERE paper_doi IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_lit_alerts_pmid ON lit_alerts(paper_pmid) WHERE paper_pmid IS NOT NULL;

-- Update trigger for lit_watchers
CREATE OR REPLACE FUNCTION update_lit_watchers_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER lit_watchers_updated_at
  BEFORE UPDATE ON lit_watchers
  FOR EACH ROW
  EXECUTE FUNCTION update_lit_watchers_updated_at();

-- Function to calculate next run time
CREATE OR REPLACE FUNCTION calculate_next_run(
  p_frequency VARCHAR(20),
  p_last_run TIMESTAMPTZ DEFAULT NOW()
) RETURNS TIMESTAMPTZ AS $$
BEGIN
  RETURN CASE p_frequency
    WHEN 'daily' THEN p_last_run + INTERVAL '1 day'
    WHEN 'weekly' THEN p_last_run + INTERVAL '1 week'
    WHEN 'monthly' THEN p_last_run + INTERVAL '1 month'
    ELSE p_last_run + INTERVAL '1 week'
  END;
END;
$$ LANGUAGE plpgsql;

-- Comments for documentation
COMMENT ON TABLE lit_watchers IS 'Stores literature monitoring configurations for manuscripts';
COMMENT ON TABLE lit_alerts IS 'Stores alerts from literature watcher searches';
COMMENT ON COLUMN lit_watchers.frequency IS 'How often to run the search: daily, weekly, or monthly';
COMMENT ON COLUMN lit_watchers.sources IS 'Array of literature sources to search (pubmed, semantic_scholar, arxiv)';
COMMENT ON COLUMN lit_alerts.relevance_score IS 'Calculated relevance score 0.0-1.0 based on query match';
COMMENT ON COLUMN lit_alerts.alert_status IS 'new=unseen, viewed=seen, dismissed=ignored, added=added to manuscript';
