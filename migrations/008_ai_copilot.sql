-- ============================================
-- Migration: AI Copilot for PDFs (Track B Phase 12)
-- ResearchFlow Production
-- ============================================
--
-- This migration adds support for RAG-based AI chat:
-- - Paper chunks with vector embeddings for semantic search
-- - Chat message history per paper
-- - Paper summaries and extracted claims
--
-- Requires pgvector extension (CREATE EXTENSION vector)

BEGIN;

-- Ensure pgvector is available
CREATE EXTENSION IF NOT EXISTS vector;

-- =============================================================================
-- Paper Chunks - Text segments with embeddings for RAG
-- =============================================================================

CREATE TABLE IF NOT EXISTS paper_chunks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    paper_id UUID NOT NULL REFERENCES papers(id) ON DELETE CASCADE,

    -- Position information
    chunk_index INTEGER NOT NULL,
    page_number INTEGER,  -- Which page this chunk is from

    -- Content
    text_content TEXT NOT NULL,
    char_start INTEGER,  -- Start position in full text
    char_end INTEGER,    -- End position in full text

    -- Embedding (OpenAI ada-002 uses 1536 dimensions, ada-003 uses 3072)
    embedding vector(1536),

    -- Metadata
    token_count INTEGER,
    metadata JSONB DEFAULT '{}',

    created_at TIMESTAMPTZ DEFAULT NOW(),

    -- Ensure unique chunk ordering per paper
    UNIQUE(paper_id, chunk_index)
);

-- =============================================================================
-- Paper Chat Messages - Conversation history for AI copilot
-- =============================================================================

CREATE TABLE IF NOT EXISTS paper_chat_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    paper_id UUID NOT NULL REFERENCES papers(id) ON DELETE CASCADE,
    user_id VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    -- Message content
    role VARCHAR(20) NOT NULL,  -- 'user', 'assistant', 'system'
    content TEXT NOT NULL,

    -- Context tracking (which chunks were used for RAG)
    context_chunk_ids UUID[] DEFAULT '{}',

    -- Response metadata
    model_used VARCHAR(100),
    tokens_input INTEGER,
    tokens_output INTEGER,
    latency_ms INTEGER,

    -- For streaming responses
    is_complete BOOLEAN DEFAULT TRUE,

    created_at TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT chk_chat_role CHECK (role IN ('user', 'assistant', 'system'))
);

-- =============================================================================
-- Paper AI Summaries - Cached AI-generated summaries
-- =============================================================================

CREATE TABLE IF NOT EXISTS paper_summaries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    paper_id UUID NOT NULL REFERENCES papers(id) ON DELETE CASCADE,
    user_id VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    -- Summary types: 'abstract', 'full', 'methods', 'results', 'key_findings'
    summary_type VARCHAR(30) NOT NULL,

    -- Content
    content TEXT NOT NULL,

    -- Generation metadata
    model_used VARCHAR(100),
    prompt_version VARCHAR(20),

    -- Validity
    is_stale BOOLEAN DEFAULT FALSE,  -- Set to true when paper content changes

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    -- One summary per type per user per paper
    UNIQUE(paper_id, user_id, summary_type)
);

-- =============================================================================
-- Paper Claims - Extracted key claims/findings
-- =============================================================================

CREATE TABLE IF NOT EXISTS paper_claims (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    paper_id UUID NOT NULL REFERENCES papers(id) ON DELETE CASCADE,
    user_id VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    -- Claim content
    claim_text TEXT NOT NULL,
    claim_type VARCHAR(30),  -- 'finding', 'method', 'limitation', 'conclusion'

    -- Source location
    source_chunk_id UUID REFERENCES paper_chunks(id) ON DELETE SET NULL,
    page_number INTEGER,

    -- Evidence/confidence
    evidence_text TEXT,
    confidence_score DECIMAL(3, 2),  -- 0.00 to 1.00

    -- User verification
    is_verified BOOLEAN DEFAULT FALSE,
    verified_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================================
-- Indexes for Performance
-- =============================================================================

-- Paper chunks indexes
CREATE INDEX idx_paper_chunks_paper_id ON paper_chunks(paper_id);
CREATE INDEX idx_paper_chunks_page ON paper_chunks(paper_id, page_number);

-- Vector similarity search index (using ivfflat for fast approximate search)
-- Note: This index should be created AFTER data is loaded for better quality
-- For small datasets, exact search without index works fine
CREATE INDEX idx_paper_chunks_embedding ON paper_chunks
    USING ivfflat (embedding vector_cosine_ops)
    WITH (lists = 100);

-- Chat messages indexes
CREATE INDEX idx_chat_messages_paper_id ON paper_chat_messages(paper_id);
CREATE INDEX idx_chat_messages_user_id ON paper_chat_messages(user_id);
CREATE INDEX idx_chat_messages_paper_user ON paper_chat_messages(paper_id, user_id, created_at DESC);

-- Summaries indexes
CREATE INDEX idx_paper_summaries_paper ON paper_summaries(paper_id);
CREATE INDEX idx_paper_summaries_user ON paper_summaries(user_id);

-- Claims indexes
CREATE INDEX idx_paper_claims_paper ON paper_claims(paper_id);
CREATE INDEX idx_paper_claims_type ON paper_claims(claim_type);

-- =============================================================================
-- Helper Function: Find similar chunks using vector similarity
-- =============================================================================

CREATE OR REPLACE FUNCTION find_similar_chunks(
    p_paper_id UUID,
    p_query_embedding vector(1536),
    p_limit INTEGER DEFAULT 5,
    p_min_similarity DECIMAL DEFAULT 0.7
)
RETURNS TABLE (
    chunk_id UUID,
    chunk_index INTEGER,
    page_number INTEGER,
    text_content TEXT,
    similarity DECIMAL
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        pc.id as chunk_id,
        pc.chunk_index,
        pc.page_number,
        pc.text_content,
        (1 - (pc.embedding <=> p_query_embedding))::DECIMAL as similarity
    FROM paper_chunks pc
    WHERE pc.paper_id = p_paper_id
      AND pc.embedding IS NOT NULL
      AND (1 - (pc.embedding <=> p_query_embedding)) >= p_min_similarity
    ORDER BY pc.embedding <=> p_query_embedding
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- Update Timestamp Triggers
-- =============================================================================

CREATE TRIGGER trg_paper_summaries_updated
    BEFORE UPDATE ON paper_summaries
    FOR EACH ROW EXECUTE FUNCTION update_paper_timestamp();

-- =============================================================================
-- Add chunking status to papers table
-- =============================================================================

ALTER TABLE papers ADD COLUMN IF NOT EXISTS chunking_status VARCHAR(20) DEFAULT 'pending';
ALTER TABLE papers ADD COLUMN IF NOT EXISTS chunks_count INTEGER DEFAULT 0;
ALTER TABLE papers ADD COLUMN IF NOT EXISTS last_chunked_at TIMESTAMPTZ;

-- Add constraint for chunking status
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'chk_paper_chunking_status'
    ) THEN
        ALTER TABLE papers ADD CONSTRAINT chk_paper_chunking_status
            CHECK (chunking_status IN ('pending', 'processing', 'ready', 'error'));
    END IF;
END $$;

COMMIT;
