-- Migration: 0008_phase_h_document_lifecycle.sql
-- Document & Artifact Lifecycle: Graph, Comments, Claims, Shares, Submissions
-- Part of ResearchFlow Document Lifecycle Completion

BEGIN;

-- =========================================================
-- 1) Artifact provenance graph
-- =========================================================
CREATE TABLE IF NOT EXISTS artifact_edges (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
  research_id VARCHAR NOT NULL,
  source_artifact_id VARCHAR NOT NULL REFERENCES artifacts(id) ON DELETE CASCADE,
  target_artifact_id VARCHAR NOT NULL REFERENCES artifacts(id) ON DELETE CASCADE,
  relation_type VARCHAR(50) NOT NULL CHECK (relation_type IN (
    'derived_from','references','supersedes','uses','generated_from','exported_to','annotates'
  )),
  transformation_type VARCHAR(100),
  transformation_config JSONB DEFAULT '{}'::jsonb NOT NULL,
  source_version_id VARCHAR REFERENCES artifact_versions(id) ON DELETE SET NULL,
  target_version_id VARCHAR REFERENCES artifact_versions(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  deleted_at TIMESTAMP,
  metadata JSONB DEFAULT '{}'::jsonb NOT NULL,
  CONSTRAINT artifact_edges_no_self_loop CHECK (source_artifact_id <> target_artifact_id)
);

CREATE INDEX IF NOT EXISTS idx_artifact_edges_research ON artifact_edges(research_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_artifact_edges_source ON artifact_edges(source_artifact_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_artifact_edges_target ON artifact_edges(target_artifact_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_artifact_edges_relation ON artifact_edges(relation_type) WHERE deleted_at IS NULL;

-- Avoid exact duplicate edges (soft-delete aware)
CREATE UNIQUE INDEX IF NOT EXISTS idx_artifact_edges_unique
ON artifact_edges(source_artifact_id, target_artifact_id, relation_type)
WHERE deleted_at IS NULL;

-- =========================================================
-- 2) Extend artifact_versions for branching + merge provenance
-- =========================================================
ALTER TABLE artifact_versions
  ADD COLUMN IF NOT EXISTS branch VARCHAR(100) NOT NULL DEFAULT 'main',
  ADD COLUMN IF NOT EXISTS parent_version_id VARCHAR REFERENCES artifact_versions(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb NOT NULL;

CREATE INDEX IF NOT EXISTS idx_artifact_versions_branch ON artifact_versions(artifact_id, branch, version_number DESC);

-- =========================================================
-- 3) Inline comments (threaded) with polymorphic anchors
-- =========================================================
CREATE TABLE IF NOT EXISTS comments (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
  research_id VARCHAR NOT NULL,
  artifact_id VARCHAR NOT NULL REFERENCES artifacts(id) ON DELETE CASCADE,
  version_id VARCHAR REFERENCES artifact_versions(id) ON DELETE SET NULL,

  parent_comment_id VARCHAR REFERENCES comments(id) ON DELETE CASCADE,
  thread_id VARCHAR NOT NULL,

  anchor_type VARCHAR(50) NOT NULL CHECK (anchor_type IN (
    'text_selection','entire_section','table_cell','figure_region','slide_region'
  )),
  anchor_data JSONB NOT NULL,

  body TEXT NOT NULL,
  resolved BOOLEAN NOT NULL DEFAULT FALSE,
  resolved_by VARCHAR REFERENCES users(id),
  resolved_at TIMESTAMP,

  assigned_to VARCHAR REFERENCES users(id),

  created_by VARCHAR NOT NULL REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  deleted_at TIMESTAMP,

  phi_scan_status VARCHAR(20) DEFAULT 'PENDING' CHECK (phi_scan_status IN ('PASS','FAIL','PENDING','OVERRIDE')),
  phi_findings JSONB DEFAULT '[]'::jsonb NOT NULL,
  metadata JSONB DEFAULT '{}'::jsonb NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_comments_artifact ON comments(artifact_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_comments_thread ON comments(thread_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_comments_open ON comments(resolved) WHERE deleted_at IS NULL AND resolved = FALSE;

-- =========================================================
-- 4) Claims + Evidence links
-- =========================================================
CREATE TABLE IF NOT EXISTS claims (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
  research_id VARCHAR NOT NULL,
  manuscript_artifact_id VARCHAR NOT NULL REFERENCES artifacts(id) ON DELETE CASCADE,
  manuscript_version_id VARCHAR REFERENCES artifact_versions(id) ON DELETE SET NULL,

  section VARCHAR(50),
  claim_text TEXT NOT NULL,
  anchor_type VARCHAR(50) DEFAULT 'text_selection',
  anchor_data JSONB DEFAULT '{}'::jsonb NOT NULL,

  created_by VARCHAR NOT NULL REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,

  phi_scan_status VARCHAR(20) DEFAULT 'PENDING' CHECK (phi_scan_status IN ('PASS','FAIL','PENDING','OVERRIDE')),
  phi_findings JSONB DEFAULT '[]'::jsonb NOT NULL,

  metadata JSONB DEFAULT '{}'::jsonb NOT NULL
);

CREATE TABLE IF NOT EXISTS claim_evidence_links (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
  claim_id VARCHAR NOT NULL REFERENCES claims(id) ON DELETE CASCADE,
  evidence_type VARCHAR(30) NOT NULL CHECK (evidence_type IN ('citation','artifact','pdf_highlight','url')),
  evidence_ref VARCHAR NOT NULL,
  evidence_locator JSONB DEFAULT '{}'::jsonb NOT NULL,
  created_by VARCHAR NOT NULL REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  metadata JSONB DEFAULT '{}'::jsonb NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_claims_manuscript ON claims(manuscript_artifact_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_claim_evidence_claim ON claim_evidence_links(claim_id);

-- =========================================================
-- 5) External review share links (token-based, expiring)
-- =========================================================
CREATE TABLE IF NOT EXISTS artifact_shares (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
  artifact_id VARCHAR NOT NULL REFERENCES artifacts(id) ON DELETE CASCADE,
  permission VARCHAR(20) NOT NULL CHECK (permission IN ('read','comment')),
  token_hash VARCHAR(64) NOT NULL,
  expires_at TIMESTAMP,
  created_by VARCHAR NOT NULL REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  revoked_at TIMESTAMP,
  metadata JSONB DEFAULT '{}'::jsonb NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_artifact_shares_token_hash ON artifact_shares(token_hash);
CREATE INDEX IF NOT EXISTS idx_artifact_shares_artifact ON artifact_shares(artifact_id) WHERE revoked_at IS NULL;

-- =========================================================
-- 6) Submission + rebuttal tracking (journal or conference)
-- =========================================================
CREATE TABLE IF NOT EXISTS submission_targets (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
  org_id VARCHAR,
  name TEXT NOT NULL,
  kind VARCHAR(20) NOT NULL CHECK (kind IN ('journal','conference')),
  website_url TEXT,
  requirements_artifact_id VARCHAR REFERENCES artifacts(id) ON DELETE SET NULL,
  metadata JSONB DEFAULT '{}'::jsonb NOT NULL,
  created_by VARCHAR REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE IF NOT EXISTS submissions (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
  research_id VARCHAR NOT NULL,
  target_id VARCHAR NOT NULL REFERENCES submission_targets(id) ON DELETE RESTRICT,
  status VARCHAR(30) NOT NULL DEFAULT 'draft' CHECK (status IN (
    'draft','submitted','revise','accepted','rejected','withdrawn','camera_ready'
  )),
  current_manuscript_artifact_id VARCHAR REFERENCES artifacts(id) ON DELETE SET NULL,
  current_manuscript_version_id VARCHAR REFERENCES artifact_versions(id) ON DELETE SET NULL,
  submitted_at TIMESTAMP,
  decision_at TIMESTAMP,
  external_tracking_id VARCHAR,
  metadata JSONB DEFAULT '{}'::jsonb NOT NULL,
  created_by VARCHAR REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_submissions_research ON submissions(research_id, created_at DESC);

CREATE TABLE IF NOT EXISTS reviewer_points (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
  submission_id VARCHAR NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,
  reviewer_label VARCHAR(50) DEFAULT 'reviewer_1',
  body TEXT NOT NULL,
  anchor_data JSONB DEFAULT '{}'::jsonb NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'open' CHECK (status IN ('open','resolved')),
  created_by VARCHAR REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  resolved_at TIMESTAMP,
  resolved_by VARCHAR REFERENCES users(id),
  phi_scan_status VARCHAR(20) DEFAULT 'PENDING' CHECK (phi_scan_status IN ('PASS','FAIL','PENDING','OVERRIDE')),
  phi_findings JSONB DEFAULT '[]'::jsonb NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_reviewer_points_submission ON reviewer_points(submission_id, status);

CREATE TABLE IF NOT EXISTS rebuttal_responses (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
  reviewer_point_id VARCHAR NOT NULL REFERENCES reviewer_points(id) ON DELETE CASCADE,
  response_body TEXT NOT NULL,
  linked_version_id VARCHAR REFERENCES artifact_versions(id) ON DELETE SET NULL,
  created_by VARCHAR REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  phi_scan_status VARCHAR(20) DEFAULT 'PENDING' CHECK (phi_scan_status IN ('PASS','FAIL','PENDING','OVERRIDE')),
  phi_findings JSONB DEFAULT '[]'::jsonb NOT NULL
);

CREATE TABLE IF NOT EXISTS submission_packages (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
  submission_id VARCHAR NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,
  package_type VARCHAR(30) NOT NULL CHECK (package_type IN ('initial','rebuttal','camera_ready','conference_bundle')),
  artifact_ids JSONB NOT NULL,
  manifest JSONB NOT NULL,
  created_by VARCHAR REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_submission_packages_submission ON submission_packages(submission_id, created_at DESC);

-- =========================================================
-- 7) Collaboration persistence (Yjs CRDT)
-- =========================================================
CREATE TABLE IF NOT EXISTS manuscript_yjs_snapshots (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
  manuscript_artifact_id VARCHAR NOT NULL REFERENCES artifacts(id) ON DELETE CASCADE,
  snapshot_clock BIGINT NOT NULL,
  snapshot BYTEA NOT NULL,
  created_by VARCHAR REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_yjs_snapshots_manuscript ON manuscript_yjs_snapshots(manuscript_artifact_id, snapshot_clock DESC);

CREATE TABLE IF NOT EXISTS manuscript_yjs_updates (
  id BIGSERIAL PRIMARY KEY,
  manuscript_artifact_id VARCHAR NOT NULL REFERENCES artifacts(id) ON DELETE CASCADE,
  clock BIGINT NOT NULL,
  update_data BYTEA NOT NULL,
  user_id VARCHAR REFERENCES users(id),
  applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_yjs_updates_manuscript ON manuscript_yjs_updates(manuscript_artifact_id, clock);

COMMIT;
