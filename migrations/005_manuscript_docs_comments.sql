-- ============================================
-- Migration: Manuscript Docs and Comments
-- Track M Phases M2-M3
-- ResearchFlow Production
-- ============================================

BEGIN;

-- =============================================================================
-- Phase M2: Manuscript Document Persistence (Yjs state)
-- =============================================================================

-- Manuscript docs table for Yjs state and text content
CREATE TABLE IF NOT EXISTS manuscript_docs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    manuscript_id UUID NOT NULL REFERENCES manuscripts(id) ON DELETE CASCADE,
    section_id UUID,  -- Optional: for section-specific saves
    yjs_doc_state BYTEA,  -- Binary Yjs state for CRDT sync
    content_text TEXT,    -- Plain text for search/PHI scanning
    version INTEGER NOT NULL DEFAULT 1,
    created_by VARCHAR(255) REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for efficient queries
CREATE INDEX idx_manuscript_docs_manuscript ON manuscript_docs(manuscript_id);
CREATE INDEX idx_manuscript_docs_section ON manuscript_docs(section_id) WHERE section_id IS NOT NULL;
CREATE INDEX idx_manuscript_docs_created ON manuscript_docs(created_at DESC);

-- =============================================================================
-- Phase M3: Manuscript Comments System
-- =============================================================================

-- Manuscript comments with inline anchoring
CREATE TABLE IF NOT EXISTS manuscript_comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    manuscript_id UUID NOT NULL REFERENCES manuscripts(id) ON DELETE CASCADE,
    section_id UUID,  -- Optional: section reference

    -- Text anchor coordinates
    anchor_start INTEGER,  -- Character offset start
    anchor_end INTEGER,    -- Character offset end
    anchor_text TEXT,      -- Quoted text for reference (helps with position drift)

    -- Comment content
    body TEXT NOT NULL,
    status VARCHAR(20) DEFAULT 'open',  -- open, resolved
    tag VARCHAR(50),  -- stats, methods, citations, grammar, etc.

    -- Threading support
    parent_id UUID REFERENCES manuscript_comments(id),  -- For thread replies

    -- User tracking
    created_by VARCHAR(255) NOT NULL REFERENCES users(id),
    resolved_by VARCHAR(255) REFERENCES users(id),
    resolved_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT chk_comment_status CHECK (status IN ('open', 'resolved', 'archived'))
);

-- Indexes for comment queries
CREATE INDEX idx_comments_manuscript ON manuscript_comments(manuscript_id);
CREATE INDEX idx_comments_section ON manuscript_comments(section_id) WHERE section_id IS NOT NULL;
CREATE INDEX idx_comments_status ON manuscript_comments(status);
CREATE INDEX idx_comments_parent ON manuscript_comments(parent_id) WHERE parent_id IS NOT NULL;
CREATE INDEX idx_comments_created ON manuscript_comments(created_at DESC);

-- Update trigger for comments
CREATE TRIGGER trg_manuscript_comments_updated
    BEFORE UPDATE ON manuscript_comments
    FOR EACH ROW EXECUTE FUNCTION update_manuscript_timestamp();

-- =============================================================================
-- Phase M4: AI Provenance Logging (for refine operations)
-- =============================================================================

-- AI operation provenance log
CREATE TABLE IF NOT EXISTS manuscript_ai_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    manuscript_id UUID NOT NULL REFERENCES manuscripts(id) ON DELETE CASCADE,
    section_id UUID,

    -- Operation details
    action_type VARCHAR(50) NOT NULL,  -- generate, refine, validate
    instruction TEXT,

    -- Input/Output hashes (no actual content for PHI safety)
    input_hash VARCHAR(64) NOT NULL,
    output_hash VARCHAR(64) NOT NULL,

    -- AI model info
    model VARCHAR(100),
    provider VARCHAR(50),
    tokens_used INTEGER,
    latency_ms INTEGER,

    -- User and timestamp
    user_id VARCHAR(255) NOT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT chk_ai_action_type CHECK (action_type IN (
        'generate', 'refine', 'validate', 'summarize', 'translate', 'expand', 'simplify'
    ))
);

CREATE INDEX idx_ai_events_manuscript ON manuscript_ai_events(manuscript_id);
CREATE INDEX idx_ai_events_action ON manuscript_ai_events(action_type);
CREATE INDEX idx_ai_events_created ON manuscript_ai_events(created_at DESC);

COMMIT;
