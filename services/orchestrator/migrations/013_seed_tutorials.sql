-- Migration 013: Seed Default Tutorials
-- Task 108: Inline Tutorials
--
-- Seeds 4 default tutorials for common ResearchFlow workflows:
-- 1. Dataset Upload
-- 2. Create Research Project
-- 3. Approval Gate Workflow
-- 4. Semantic Search Basics

-- Ensure feature flag exists
INSERT INTO feature_flags (flag_key, enabled, description, tier_required, created_at, updated_at)
VALUES ('inline_tutorials', true, 'Interactive inline tutorials for feature onboarding', 'FREE', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT (flag_key) DO UPDATE
SET description = EXCLUDED.description, updated_at = CURRENT_TIMESTAMP;

-- Seed Tutorial 1: Dataset Upload
INSERT INTO tutorial_assets (tutorial_key, title, description, video_url, steps, enabled, org_id, created_at, updated_at)
VALUES (
  'dataset_upload',
  'Upload Your First Dataset',
  'Learn how to securely upload and scan datasets for PHI',
  NULL, -- Video URL placeholder
  '[
    {
      "title": "Navigate to Datasets",
      "content": "Click the Datasets link in the sidebar to view all datasets in your organization.",
      "targetSelector": "a[href=''/datasets'']"
    },
    {
      "title": "Click Upload Button",
      "content": "Click the ''Upload Dataset'' button to start the upload process.",
      "targetSelector": "[data-testid=''upload-dataset-btn'']"
    },
    {
      "title": "Select File",
      "content": "Choose a CSV, Excel, or JSON file from your computer. Max size: 100MB.",
      "targetSelector": "input[type=''file'']"
    },
    {
      "title": "Configure PHI Scan",
      "content": "Enable PHI scanning to automatically detect and flag sensitive health information.",
      "targetSelector": "[data-testid=''phi-scan-toggle'']"
    },
    {
      "title": "Submit",
      "content": "Click ''Upload'' to process your dataset. You''ll receive a notification when it''s ready.",
      "targetSelector": "button[type=''submit'']"
    }
  ]'::jsonb,
  true,
  NULL, -- Global tutorial
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
);

-- Seed Tutorial 2: Create Research Project
INSERT INTO tutorial_assets (tutorial_key, title, description, video_url, steps, enabled, org_id, created_at, updated_at)
VALUES (
  'create_project',
  'Start a Research Project',
  'Set up a new research project with IRB configuration',
  NULL,
  '[
    {
      "title": "Open Pipeline",
      "content": "Navigate to the Research Pipeline to manage your projects.",
      "targetSelector": "a[href=''/pipeline'']"
    },
    {
      "title": "New Project",
      "content": "Click ''New Project'' to start creating your research project.",
      "targetSelector": "[data-testid=''new-project-btn'']"
    },
    {
      "title": "Set Title & Description",
      "content": "Give your project a descriptive title and summary.",
      "targetSelector": "input[name=''title'']"
    },
    {
      "title": "Choose Template",
      "content": "Select a project template that matches your research type.",
      "targetSelector": "[data-testid=''template-selector'']"
    },
    {
      "title": "Configure IRB",
      "content": "Enter your IRB approval number and upload required documents.",
      "targetSelector": "[data-testid=''irb-config'']"
    }
  ]'::jsonb,
  true,
  NULL,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
);

-- Seed Tutorial 3: Approval Gate Workflow
INSERT INTO tutorial_assets (tutorial_key, title, description, video_url, steps, enabled, org_id, created_at, updated_at)
VALUES (
  'approval_gates',
  'Understanding Approval Gates',
  'Learn how governance approval gates protect research integrity',
  NULL,
  '[
    {
      "title": "What Are Approval Gates?",
      "content": "Approval gates ensure that critical research steps are reviewed by authorized personnel before proceeding."
    },
    {
      "title": "Request Approval",
      "content": "When you reach a gate, you''ll see a ''Request Approval'' button. Click it to notify reviewers.",
      "targetSelector": "[data-testid=''request-approval-btn'']"
    },
    {
      "title": "Review Dashboard",
      "content": "Admins can view all pending approvals in the Governance Dashboard.",
      "targetSelector": "a[href=''/governance'']"
    },
    {
      "title": "Approve or Reject",
      "content": "Reviewers can approve or reject requests with comments. All actions are logged.",
      "targetSelector": "[data-testid=''approval-actions'']"
    }
  ]'::jsonb,
  true,
  NULL,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
);

-- Seed Tutorial 4: Semantic Search Basics
INSERT INTO tutorial_assets (tutorial_key, title, description, video_url, steps, enabled, org_id, created_at, updated_at)
VALUES (
  'semantic_search',
  'Discover with Semantic Search',
  'Find artifacts by meaning, not just keywords (PRO tier)',
  NULL,
  '[
    {
      "title": "Navigate to Search",
      "content": "Open the Search page to find artifacts across your organization.",
      "targetSelector": "a[href=''/search'']"
    },
    {
      "title": "Choose Search Mode",
      "content": "Select ''Semantic'' mode to search by conceptual similarity instead of exact keywords.",
      "targetSelector": "[data-testid=''search-mode-selector'']"
    },
    {
      "title": "Enter Query",
      "content": "Type a concept like ''thyroid analysis'' - semantic search finds related artifacts even if they don''t contain those exact words.",
      "targetSelector": "input[placeholder*=''Search'']"
    },
    {
      "title": "Review Results",
      "content": "Results show similarity scores (%) indicating how closely they match your query.",
      "targetSelector": "[data-testid=''search-results'']"
    }
  ]'::jsonb,
  true,
  NULL,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
);

-- Verification: Count seeded tutorials
DO $$
DECLARE
  tutorial_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO tutorial_count
  FROM tutorial_assets
  WHERE tutorial_key IN ('dataset_upload', 'create_project', 'approval_gates', 'semantic_search');

  IF tutorial_count != 4 THEN
    RAISE WARNING 'Expected 4 tutorials but found %', tutorial_count;
  ELSE
    RAISE NOTICE 'Successfully seeded 4 default tutorials';
  END IF;
END $$;
