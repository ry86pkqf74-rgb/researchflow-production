-- ============================================================
-- Migration 010: Docs-First Phase 1 Tables
-- Purpose: Ideas backlog, Topic Briefs, Venues, Doc Kits
-- Author: ResearchFlow Team
-- Date: 2026-01-20
-- ============================================================

BEGIN;

-- ============================================================
-- 1. IDEAS TABLE
-- Research idea backlog with status tracking
-- ============================================================

CREATE TABLE IF NOT EXISTS ideas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  research_id VARCHAR(255) NOT NULL,
  title VARCHAR(500) NOT NULL,
  description TEXT,
  status VARCHAR(20) DEFAULT 'BACKLOG' NOT NULL
    CHECK (status IN ('BACKLOG', 'EVALUATING', 'APPROVED', 'REJECTED', 'CONVERTED')),
  created_by VARCHAR(255) NOT NULL,
  org_id VARCHAR(255),
  metadata JSONB DEFAULT '{}'::jsonb NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  deleted_at TIMESTAMP
);

CREATE INDEX idx_ideas_research_id ON ideas(research_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_ideas_status ON ideas(status) WHERE deleted_at IS NULL;
CREATE INDEX idx_ideas_created_at ON ideas(created_at DESC) WHERE deleted_at IS NULL;

-- ============================================================
-- 2. IDEA_SCORECARDS TABLE
-- Scoring criteria for evaluating ideas
-- ============================================================

CREATE TABLE IF NOT EXISTS idea_scorecards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  idea_id UUID NOT NULL REFERENCES ideas(id) ON DELETE CASCADE,
  novelty_score INT CHECK (novelty_score BETWEEN 1 AND 5),
  feasibility_score INT CHECK (feasibility_score BETWEEN 1 AND 5),
  impact_score INT CHECK (impact_score BETWEEN 1 AND 5),
  alignment_score INT CHECK (alignment_score BETWEEN 1 AND 5),
  total_score INT GENERATED ALWAYS AS (
    COALESCE(novelty_score, 0) +
    COALESCE(feasibility_score, 0) +
    COALESCE(impact_score, 0) +
    COALESCE(alignment_score, 0)
  ) STORED,
  notes TEXT,
  created_by VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  UNIQUE(idea_id)
);

CREATE INDEX idx_scorecards_idea_id ON idea_scorecards(idea_id);
CREATE INDEX idx_scorecards_total_score ON idea_scorecards(total_score DESC);

-- ============================================================
-- 3. TOPIC_BRIEFS TABLE
-- Structured research planning documents with PICO framework
-- ============================================================

CREATE TABLE IF NOT EXISTS topic_briefs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  research_id VARCHAR(255) NOT NULL,
  idea_id UUID REFERENCES ideas(id) ON DELETE SET NULL,
  title VARCHAR(500) NOT NULL,
  version_number INT NOT NULL DEFAULT 1,

  -- PICO Framework
  population TEXT,
  intervention TEXT,
  comparison TEXT,
  outcomes TEXT[],

  -- Research Structure
  research_question TEXT NOT NULL,
  hypothesis TEXT,
  background TEXT,
  methods_overview TEXT,
  expected_findings TEXT,

  -- Metadata
  status VARCHAR(20) DEFAULT 'DRAFT' NOT NULL
    CHECK (status IN ('DRAFT', 'ACTIVE', 'FROZEN', 'ARCHIVED')),
  frozen_at TIMESTAMP,
  frozen_by VARCHAR(255),

  created_by VARCHAR(255) NOT NULL,
  org_id VARCHAR(255),
  metadata JSONB DEFAULT '{}'::jsonb NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  deleted_at TIMESTAMP
);

CREATE INDEX idx_topic_briefs_research_id ON topic_briefs(research_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_topic_briefs_status ON topic_briefs(status) WHERE deleted_at IS NULL;
CREATE INDEX idx_topic_briefs_updated_at ON topic_briefs(updated_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX idx_topic_briefs_idea_id ON topic_briefs(idea_id) WHERE deleted_at IS NULL;

-- ============================================================
-- 4. VENUES TABLE
-- Target publication/presentation venues
-- ============================================================

CREATE TABLE IF NOT EXISTS venues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(500) NOT NULL,
  type VARCHAR(50) NOT NULL
    CHECK (type IN ('JOURNAL', 'CONFERENCE', 'WORKSHOP', 'PREPRINT')),
  impact_factor DECIMAL(5,3),
  acceptance_rate DECIMAL(5,2),

  -- Requirements
  word_limit INT,
  abstract_limit INT,
  guidelines_url TEXT,
  submission_deadline DATE,

  metadata JSONB DEFAULT '{}'::jsonb NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  deleted_at TIMESTAMP
);

CREATE INDEX idx_venues_type ON venues(type) WHERE deleted_at IS NULL;
CREATE INDEX idx_venues_name ON venues(name) WHERE deleted_at IS NULL;
CREATE INDEX idx_venues_deadline ON venues(submission_deadline) WHERE deleted_at IS NULL;

-- ============================================================
-- 5. DOC_KITS TABLE
-- Document preparation kits per venue
-- ============================================================

CREATE TABLE IF NOT EXISTS doc_kits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  topic_brief_id UUID NOT NULL REFERENCES topic_briefs(id) ON DELETE CASCADE,
  venue_id UUID NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
  status VARCHAR(20) DEFAULT 'IN_PROGRESS' NOT NULL
    CHECK (status IN ('NOT_STARTED', 'IN_PROGRESS', 'COMPLETE', 'SUBMITTED')),

  created_by VARCHAR(255) NOT NULL,
  org_id VARCHAR(255),
  metadata JSONB DEFAULT '{}'::jsonb NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  deleted_at TIMESTAMP
);

CREATE INDEX idx_doc_kits_brief_id ON doc_kits(topic_brief_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_doc_kits_venue_id ON doc_kits(venue_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_doc_kits_status ON doc_kits(status) WHERE deleted_at IS NULL;

-- ============================================================
-- 6. DOC_KIT_ITEMS TABLE
-- Individual documents in a kit
-- ============================================================

CREATE TABLE IF NOT EXISTS doc_kit_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  doc_kit_id UUID NOT NULL REFERENCES doc_kits(id) ON DELETE CASCADE,
  item_type VARCHAR(100) NOT NULL,
  title VARCHAR(500) NOT NULL,
  description TEXT,

  -- Content
  content TEXT,
  artifact_id UUID REFERENCES artifacts(id) ON DELETE SET NULL,

  -- Status
  status VARCHAR(20) DEFAULT 'NOT_STARTED' NOT NULL
    CHECK (status IN ('NOT_STARTED', 'IN_PROGRESS', 'COMPLETE')),
  required BOOLEAN DEFAULT true NOT NULL,
  display_order INT NOT NULL,

  metadata JSONB DEFAULT '{}'::jsonb NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  deleted_at TIMESTAMP
);

CREATE INDEX idx_doc_kit_items_kit_id ON doc_kit_items(doc_kit_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_doc_kit_items_order ON doc_kit_items(doc_kit_id, display_order) WHERE deleted_at IS NULL;
CREATE INDEX idx_doc_kit_items_artifact_id ON doc_kit_items(artifact_id) WHERE deleted_at IS NULL;

-- ============================================================
-- 7. DOC_ANCHORS TABLE
-- Hash chain for immutable scope freeze snapshots
-- ============================================================

CREATE TABLE IF NOT EXISTS doc_anchors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  topic_brief_id UUID NOT NULL REFERENCES topic_briefs(id) ON DELETE CASCADE,
  version_number INT NOT NULL,

  -- Snapshot data
  snapshot_data JSONB NOT NULL,

  -- Hash chain
  previous_hash VARCHAR(64),
  current_hash VARCHAR(64) NOT NULL,

  created_by VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,

  UNIQUE(topic_brief_id, version_number)
);

CREATE INDEX idx_doc_anchors_brief_id ON doc_anchors(topic_brief_id);
CREATE INDEX idx_doc_anchors_version ON doc_anchors(topic_brief_id, version_number DESC);
CREATE INDEX idx_doc_anchors_hash ON doc_anchors(current_hash);

-- ============================================================
-- TRIGGERS & FUNCTIONS
-- ============================================================

-- Auto-increment version number on significant changes
CREATE OR REPLACE FUNCTION increment_topic_brief_version()
RETURNS TRIGGER AS $$
BEGIN
  -- Only increment if not frozen and key fields changed
  IF OLD.status != 'FROZEN' AND (
    OLD.research_question IS DISTINCT FROM NEW.research_question OR
    OLD.hypothesis IS DISTINCT FROM NEW.hypothesis OR
    OLD.population IS DISTINCT FROM NEW.population OR
    OLD.intervention IS DISTINCT FROM NEW.intervention OR
    OLD.comparison IS DISTINCT FROM NEW.comparison
  ) THEN
    NEW.version_number := OLD.version_number + 1;
  END IF;

  NEW.updated_at := CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER topic_brief_version_increment
  BEFORE UPDATE ON topic_briefs
  FOR EACH ROW
  EXECUTE FUNCTION increment_topic_brief_version();

-- Auto-update timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_ideas_updated_at
  BEFORE UPDATE ON ideas
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_idea_scorecards_updated_at
  BEFORE UPDATE ON idea_scorecards
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

COMMIT;

-- ============================================================
-- VERIFICATION
-- ============================================================

DO $$
BEGIN
  ASSERT (SELECT COUNT(*) FROM information_schema.tables
    WHERE table_name = 'ideas') = 1,
    'ideas table not created';

  ASSERT (SELECT COUNT(*) FROM information_schema.tables
    WHERE table_name = 'idea_scorecards') = 1,
    'idea_scorecards table not created';

  ASSERT (SELECT COUNT(*) FROM information_schema.tables
    WHERE table_name = 'topic_briefs') = 1,
    'topic_briefs table not created';

  ASSERT (SELECT COUNT(*) FROM information_schema.tables
    WHERE table_name = 'venues') = 1,
    'venues table not created';

  ASSERT (SELECT COUNT(*) FROM information_schema.tables
    WHERE table_name = 'doc_kits') = 1,
    'doc_kits table not created';

  ASSERT (SELECT COUNT(*) FROM information_schema.tables
    WHERE table_name = 'doc_kit_items') = 1,
    'doc_kit_items table not created';

  ASSERT (SELECT COUNT(*) FROM information_schema.tables
    WHERE table_name = 'doc_anchors') = 1,
    'doc_anchors table not created';

  RAISE NOTICE 'Migration 010: All 7 tables created successfully!';
END $$;
