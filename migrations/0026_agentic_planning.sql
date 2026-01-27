-- ============================================
-- Agentic Planning Tables
-- ============================================
-- Stores analysis plans, execution jobs, and artifacts
-- for the AI-assisted statistical analysis pipeline

-- Analysis Plans
CREATE TABLE IF NOT EXISTS analysis_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NULL,
  dataset_id TEXT NOT NULL,

  -- Plan content
  name TEXT NOT NULL,
  description TEXT,
  research_question TEXT NOT NULL,
  plan_type TEXT NOT NULL DEFAULT 'statistical'
    CHECK (plan_type IN ('statistical', 'exploratory', 'comparative', 'predictive')),

  -- Constraints
  constraints JSONB NOT NULL DEFAULT '{}'::jsonb,

  -- Generated plan specification
  plan_spec JSONB NOT NULL DEFAULT '{}'::jsonb,

  -- Status
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'pending_approval', 'approved', 'rejected', 'running', 'completed', 'failed')),

  -- Governance
  requires_approval BOOLEAN NOT NULL DEFAULT FALSE,
  approved_by UUID NULL,
  approved_at TIMESTAMPTZ NULL,
  rejection_reason TEXT NULL,

  -- Audit
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_analysis_plans_status ON analysis_plans (status);
CREATE INDEX IF NOT EXISTS idx_analysis_plans_dataset ON analysis_plans (dataset_id);
CREATE INDEX IF NOT EXISTS idx_analysis_plans_creator ON analysis_plans (created_by);
CREATE INDEX IF NOT EXISTS idx_analysis_plans_project ON analysis_plans (project_id);

-- Analysis Jobs (execution tracking)
CREATE TABLE IF NOT EXISTS analysis_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID NOT NULL REFERENCES analysis_plans(id) ON DELETE CASCADE,

  -- Job info
  job_type TEXT NOT NULL CHECK (job_type IN ('plan_build', 'plan_run')),
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'queued', 'running', 'completed', 'failed', 'cancelled')),

  -- Progress tracking
  progress INTEGER NOT NULL DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
  current_stage TEXT NULL,
  stages_completed JSONB NOT NULL DEFAULT '[]'::jsonb,

  -- Results
  result JSONB NULL,
  error_message TEXT NULL,
  error_details JSONB NULL,

  -- Timing
  started_at TIMESTAMPTZ NULL,
  completed_at TIMESTAMPTZ NULL,

  -- Audit
  started_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_analysis_jobs_plan ON analysis_jobs (plan_id);
CREATE INDEX IF NOT EXISTS idx_analysis_jobs_status ON analysis_jobs (status);
CREATE INDEX IF NOT EXISTS idx_analysis_jobs_type ON analysis_jobs (job_type);

-- Analysis Artifacts
CREATE TABLE IF NOT EXISTS analysis_artifacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES analysis_jobs(id) ON DELETE CASCADE,
  plan_id UUID NOT NULL REFERENCES analysis_plans(id) ON DELETE CASCADE,

  -- Artifact info
  artifact_type TEXT NOT NULL CHECK (artifact_type IN (
    'table', 'figure', 'report', 'manifest', 'log', 'data', 'other'
  )),
  name TEXT NOT NULL,
  description TEXT NULL,

  -- Storage
  file_path TEXT NULL,
  file_size INTEGER NULL,
  mime_type TEXT NULL,

  -- Inline data (for small artifacts)
  inline_data JSONB NULL,

  -- Metadata
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_analysis_artifacts_job ON analysis_artifacts (job_id);
CREATE INDEX IF NOT EXISTS idx_analysis_artifacts_plan ON analysis_artifacts (plan_id);
CREATE INDEX IF NOT EXISTS idx_analysis_artifacts_type ON analysis_artifacts (artifact_type);

-- Job Events (for SSE streaming)
CREATE TABLE IF NOT EXISTS analysis_job_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES analysis_jobs(id) ON DELETE CASCADE,

  event_type TEXT NOT NULL,
  event_data JSONB NOT NULL DEFAULT '{}'::jsonb,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_job_events_job ON analysis_job_events (job_id, created_at);

-- Trigger for updated_at on analysis_plans
CREATE OR REPLACE FUNCTION update_analysis_plan_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_analysis_plan_updated ON analysis_plans;
CREATE TRIGGER trg_analysis_plan_updated
  BEFORE UPDATE ON analysis_plans
  FOR EACH ROW
  EXECUTE FUNCTION update_analysis_plan_timestamp();

-- Comments for documentation
COMMENT ON TABLE analysis_plans IS 'Stores AI-generated statistical analysis plans';
COMMENT ON TABLE analysis_jobs IS 'Tracks execution of plan building and running jobs';
COMMENT ON TABLE analysis_artifacts IS 'Generated outputs from analysis execution';
COMMENT ON TABLE analysis_job_events IS 'Real-time events for SSE streaming of job progress';
