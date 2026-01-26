-- Phase G: Custom Workflow Builder
-- Migration: 0007_phase_g_workflow_builder.sql
-- Purpose: Add tables for custom workflow definitions, versioning, and policies
-- Created: 2026-01-20
-- Implements: Items 1-10 from 100 Improvements Playbook
-- Note: This migration uses VARCHAR types matching Drizzle ORM schema (packages/core/types/schema.ts)

-- =====================
-- WORKFLOWS TABLE (Metadata)
-- =====================
CREATE TABLE IF NOT EXISTS workflows (
  id VARCHAR(255) PRIMARY KEY DEFAULT gen_random_uuid()::text,
  org_id VARCHAR(255) REFERENCES organizations(id) ON DELETE SET NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  status VARCHAR(50) NOT NULL DEFAULT 'draft',
  created_by VARCHAR(255) REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_workflows_org ON workflows(org_id);
CREATE INDEX IF NOT EXISTS idx_workflows_status ON workflows(status);
CREATE INDEX IF NOT EXISTS idx_workflows_created_by ON workflows(created_by);

-- =====================
-- WORKFLOW VERSIONS TABLE (Immutable versions)
-- =====================
CREATE TABLE IF NOT EXISTS workflow_versions (
  id VARCHAR(255) PRIMARY KEY DEFAULT gen_random_uuid()::text,
  workflow_id VARCHAR(255) NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
  version INTEGER NOT NULL,
  definition JSONB NOT NULL,
  changelog TEXT,
  created_by VARCHAR(255) REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  UNIQUE(workflow_id, version)
);

CREATE INDEX IF NOT EXISTS idx_workflow_versions_workflow ON workflow_versions(workflow_id);
CREATE INDEX IF NOT EXISTS idx_workflow_versions_version ON workflow_versions(workflow_id, version);

-- =====================
-- WORKFLOW TEMPLATES TABLE (Seeded templates)
-- =====================
CREATE TABLE IF NOT EXISTS workflow_templates (
  key VARCHAR(100) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  definition JSONB NOT NULL,
  category VARCHAR(100) DEFAULT 'general',
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_workflow_templates_category ON workflow_templates(category);
CREATE INDEX IF NOT EXISTS idx_workflow_templates_active ON workflow_templates(is_active) WHERE is_active = TRUE;

-- =====================
-- WORKFLOW POLICIES TABLE (RBAC per workflow)
-- =====================
CREATE TABLE IF NOT EXISTS workflow_policies (
  workflow_id VARCHAR(255) PRIMARY KEY REFERENCES workflows(id) ON DELETE CASCADE,
  policy JSONB NOT NULL DEFAULT '{}',
  updated_by VARCHAR(255) REFERENCES users(id),
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- =====================
-- WORKFLOW RUN CHECKPOINTS TABLE (Resume capability)
-- =====================
CREATE TABLE IF NOT EXISTS workflow_run_checkpoints (
  id VARCHAR(255) PRIMARY KEY DEFAULT gen_random_uuid()::text,
  run_id VARCHAR(255) NOT NULL,
  workflow_id VARCHAR(255) NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
  workflow_version INTEGER NOT NULL,
  current_node_id VARCHAR(255) NOT NULL,
  completed_nodes JSONB NOT NULL DEFAULT '[]',
  node_outputs JSONB NOT NULL DEFAULT '{}',
  status VARCHAR(50) NOT NULL DEFAULT 'running',
  error_message TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_workflow_checkpoints_run ON workflow_run_checkpoints(run_id);
CREATE INDEX IF NOT EXISTS idx_workflow_checkpoints_workflow ON workflow_run_checkpoints(workflow_id);
CREATE INDEX IF NOT EXISTS idx_workflow_checkpoints_status ON workflow_run_checkpoints(status);

-- =====================
-- Seed default workflow templates
-- =====================
INSERT INTO workflow_templates (key, name, description, definition, category) VALUES
(
  'standard-research',
  'Standard Research Pipeline',
  'Complete 20-stage research workflow from topic declaration to archive',
  '{
    "schemaVersion": "1.0",
    "nodes": [
      {"id": "stage-1", "type": "stage", "label": "Topic Declaration", "stageId": 1, "position": {"x": 250, "y": 0}},
      {"id": "stage-2", "type": "stage", "label": "Literature Search", "stageId": 2, "position": {"x": 250, "y": 100}},
      {"id": "stage-3", "type": "stage", "label": "IRB Proposal", "stageId": 3, "position": {"x": 250, "y": 200}},
      {"id": "stage-4", "type": "stage", "label": "Planned Extraction", "stageId": 4, "position": {"x": 250, "y": 300}},
      {"id": "gate-phi", "type": "gate", "label": "PHI Check Gate", "gateType": "phi_check", "position": {"x": 250, "y": 400}},
      {"id": "stage-5", "type": "stage", "label": "PHI Scanning", "stageId": 5, "position": {"x": 250, "y": 500}},
      {"id": "stage-6", "type": "stage", "label": "Schema Extraction", "stageId": 6, "position": {"x": 250, "y": 600}},
      {"id": "stage-7", "type": "stage", "label": "Final Scrubbing", "stageId": 7, "position": {"x": 250, "y": 700}},
      {"id": "stage-11", "type": "stage", "label": "Statistical Analysis", "stageId": 11, "position": {"x": 250, "y": 800}},
      {"id": "gate-ai", "type": "gate", "label": "AI Approval Gate", "gateType": "ai_approval", "position": {"x": 250, "y": 900}},
      {"id": "stage-14", "type": "stage", "label": "Manuscript Draft", "stageId": 14, "position": {"x": 250, "y": 1000}},
      {"id": "stage-19", "type": "stage", "label": "Archive", "stageId": 19, "position": {"x": 250, "y": 1100}}
    ],
    "edges": [
      {"id": "e1-2", "from": "stage-1", "to": "stage-2"},
      {"id": "e2-3", "from": "stage-2", "to": "stage-3"},
      {"id": "e3-4", "from": "stage-3", "to": "stage-4"},
      {"id": "e4-gate", "from": "stage-4", "to": "gate-phi"},
      {"id": "egate-5", "from": "gate-phi", "to": "stage-5"},
      {"id": "e5-6", "from": "stage-5", "to": "stage-6"},
      {"id": "e6-7", "from": "stage-6", "to": "stage-7"},
      {"id": "e7-11", "from": "stage-7", "to": "stage-11"},
      {"id": "e11-gate", "from": "stage-11", "to": "gate-ai"},
      {"id": "egate-14", "from": "gate-ai", "to": "stage-14"},
      {"id": "e14-19", "from": "stage-14", "to": "stage-19"}
    ],
    "entryNodeId": "stage-1"
  }',
  'research'
),
(
  'quick-analysis',
  'Quick Analysis Pipeline',
  'Abbreviated pipeline for rapid data analysis without full manuscript generation',
  '{
    "schemaVersion": "1.0",
    "nodes": [
      {"id": "stage-1", "type": "stage", "label": "Topic Declaration", "stageId": 1, "position": {"x": 250, "y": 0}},
      {"id": "stage-5", "type": "stage", "label": "PHI Scanning", "stageId": 5, "position": {"x": 250, "y": 100}},
      {"id": "stage-6", "type": "stage", "label": "Schema Extraction", "stageId": 6, "position": {"x": 250, "y": 200}},
      {"id": "stage-11", "type": "stage", "label": "Statistical Analysis", "stageId": 11, "position": {"x": 250, "y": 300}},
      {"id": "stage-12", "type": "stage", "label": "Results Summary", "stageId": 12, "position": {"x": 250, "y": 400}}
    ],
    "edges": [
      {"id": "e1-5", "from": "stage-1", "to": "stage-5"},
      {"id": "e5-6", "from": "stage-5", "to": "stage-6"},
      {"id": "e6-11", "from": "stage-6", "to": "stage-11"},
      {"id": "e11-12", "from": "stage-11", "to": "stage-12"}
    ],
    "entryNodeId": "stage-1"
  }',
  'research'
),
(
  'conference-prep',
  'Conference Preparation',
  'Focused workflow for Stage 20 conference materials generation',
  '{
    "schemaVersion": "1.0",
    "nodes": [
      {"id": "stage-1", "type": "stage", "label": "Topic Declaration", "stageId": 1, "position": {"x": 250, "y": 0}},
      {"id": "stage-2", "type": "stage", "label": "Literature Search", "stageId": 2, "position": {"x": 250, "y": 100}},
      {"id": "stage-14", "type": "stage", "label": "Manuscript Draft", "stageId": 14, "position": {"x": 250, "y": 200}},
      {"id": "stage-20", "type": "stage", "label": "Conference Prep", "stageId": 20, "position": {"x": 250, "y": 300}}
    ],
    "edges": [
      {"id": "e1-2", "from": "stage-1", "to": "stage-2"},
      {"id": "e2-14", "from": "stage-2", "to": "stage-14"},
      {"id": "e14-20", "from": "stage-14", "to": "stage-20"}
    ],
    "entryNodeId": "stage-1"
  }',
  'conference'
),
(
  'literature-review',
  'Literature Review Only',
  'Focused workflow for comprehensive literature review and evidence synthesis',
  '{
    "schemaVersion": "1.0",
    "nodes": [
      {"id": "stage-1", "type": "stage", "label": "Topic Declaration", "stageId": 1, "position": {"x": 250, "y": 0}},
      {"id": "stage-2", "type": "stage", "label": "Literature Search", "stageId": 2, "position": {"x": 250, "y": 100}},
      {"id": "stage-12", "type": "stage", "label": "Results Summary", "stageId": 12, "position": {"x": 250, "y": 200}}
    ],
    "edges": [
      {"id": "e1-2", "from": "stage-1", "to": "stage-2"},
      {"id": "e2-12", "from": "stage-2", "to": "stage-12"}
    ],
    "entryNodeId": "stage-1"
  }',
  'research'
)
ON CONFLICT (key) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  definition = EXCLUDED.definition,
  category = EXCLUDED.category;

-- =====================
-- Enable workflow_builder feature flag
-- =====================
UPDATE feature_flags SET enabled = true WHERE flag_key = 'workflow_builder';
