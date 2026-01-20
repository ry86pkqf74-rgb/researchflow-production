-- Migration 012: Semantic Search Infrastructure
-- Task 107: Add cosine similarity function, indexes, and feature flag

-- Cosine similarity function for JSONB vectors
-- This enables semantic search without requiring pgvector extension
CREATE OR REPLACE FUNCTION cosine_similarity(vec1 JSONB, vec2 JSONB)
RETURNS FLOAT AS $$
DECLARE
  dot_product FLOAT := 0;
  magnitude1 FLOAT := 0;
  magnitude2 FLOAT := 0;
  arr1 FLOAT[];
  arr2 FLOAT[];
  i INT;
BEGIN
  -- Convert JSONB arrays to PostgreSQL arrays
  SELECT ARRAY(SELECT jsonb_array_elements_text(vec1)::FLOAT) INTO arr1;
  SELECT ARRAY(SELECT jsonb_array_elements_text(vec2)::FLOAT) INTO arr2;

  -- Validate arrays have same length
  IF array_length(arr1, 1) != array_length(arr2, 1) THEN
    RAISE EXCEPTION 'Vector dimensions must match';
  END IF;

  -- Calculate dot product and magnitudes
  FOR i IN 1..array_length(arr1, 1) LOOP
    dot_product := dot_product + (arr1[i] * arr2[i]);
    magnitude1 := magnitude1 + (arr1[i] * arr1[i]);
    magnitude2 := magnitude2 + (arr2[i] * arr2[i]);
  END LOOP;

  -- Return cosine similarity (1 = identical, 0 = orthogonal, -1 = opposite)
  RETURN CASE
    WHEN magnitude1 = 0 OR magnitude2 = 0 THEN 0
    ELSE dot_product / (sqrt(magnitude1) * sqrt(magnitude2))
  END;
END;
$$ LANGUAGE plpgsql IMMUTABLE PARALLEL SAFE;

-- Performance indexes for artifact embeddings
CREATE INDEX IF NOT EXISTS idx_artifact_embeddings_org_id
  ON artifact_embeddings(org_id);

CREATE INDEX IF NOT EXISTS idx_artifact_embeddings_artifact_id
  ON artifact_embeddings(artifact_id);

CREATE INDEX IF NOT EXISTS idx_artifact_embeddings_metadata_hash
  ON artifact_embeddings(metadata_hash);

-- Feature flag for semantic search (PRO tier required)
INSERT INTO feature_flags (flag_key, enabled, description, tier_required, created_at, updated_at)
VALUES (
  'semantic_search',
  true,
  'Semantic vector search for artifacts using OpenAI embeddings',
  'PRO',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
)
ON CONFLICT (flag_key) DO UPDATE
SET
  enabled = EXCLUDED.enabled,
  description = EXCLUDED.description,
  tier_required = EXCLUDED.tier_required,
  updated_at = CURRENT_TIMESTAMP;

-- Add helpful comment
COMMENT ON FUNCTION cosine_similarity IS 'Calculate cosine similarity between two JSONB vector arrays for semantic search. Returns value between -1 and 1, where 1 indicates identical vectors.';
