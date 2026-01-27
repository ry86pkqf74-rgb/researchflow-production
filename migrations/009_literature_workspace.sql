-- ============================================
-- Migration: Literature Review Workspace (Track B Phase 13)
-- ResearchFlow Production
-- ============================================
--
-- Adds support for organizing papers into collections
-- and creating literature review notes.

BEGIN;

-- =============================================================================
-- Collections - Folders/groups for organizing papers
-- =============================================================================

CREATE TABLE IF NOT EXISTS collections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    -- Collection metadata
    name VARCHAR(200) NOT NULL,
    description TEXT,
    color VARCHAR(20) DEFAULT 'blue',  -- For UI display
    icon VARCHAR(50),  -- Optional icon name

    -- Hierarchy support (for nested collections)
    parent_id UUID REFERENCES collections(id) ON DELETE SET NULL,

    -- Ordering
    sort_order INTEGER DEFAULT 0,

    -- Settings
    is_archived BOOLEAN DEFAULT FALSE,
    is_pinned BOOLEAN DEFAULT FALSE,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT chk_collection_color CHECK (color IN (
        'blue', 'green', 'red', 'yellow', 'purple', 'pink', 'orange', 'gray'
    ))
);

-- =============================================================================
-- Collection Papers - Junction table for papers in collections
-- =============================================================================

CREATE TABLE IF NOT EXISTS collection_papers (
    collection_id UUID NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
    paper_id UUID NOT NULL REFERENCES papers(id) ON DELETE CASCADE,

    -- Position within collection
    sort_order INTEGER DEFAULT 0,

    -- Notes specific to this paper in this collection
    collection_notes TEXT,

    added_at TIMESTAMPTZ DEFAULT NOW(),
    added_by VARCHAR(255) REFERENCES users(id),

    PRIMARY KEY (collection_id, paper_id)
);

-- =============================================================================
-- Literature Notes - Standalone or linked notes
-- =============================================================================

CREATE TABLE IF NOT EXISTS literature_notes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    -- Links (optional - notes can be standalone, collection-level, or paper-level)
    collection_id UUID REFERENCES collections(id) ON DELETE SET NULL,
    paper_id UUID REFERENCES papers(id) ON DELETE SET NULL,

    -- Content
    title VARCHAR(300),
    content TEXT NOT NULL,

    -- Rich content support
    content_format VARCHAR(20) DEFAULT 'markdown',  -- markdown, html, plaintext

    -- Tags for organization
    tags JSONB DEFAULT '[]',

    -- Status
    is_archived BOOLEAN DEFAULT FALSE,
    is_pinned BOOLEAN DEFAULT FALSE,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT chk_note_format CHECK (content_format IN ('markdown', 'html', 'plaintext'))
);

-- =============================================================================
-- Smart Collections - Auto-populated based on filters
-- =============================================================================

CREATE TABLE IF NOT EXISTS smart_collections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    name VARCHAR(200) NOT NULL,
    description TEXT,
    color VARCHAR(20) DEFAULT 'purple',
    icon VARCHAR(50) DEFAULT 'sparkles',

    -- Filter criteria (JSONB for flexibility)
    -- Example: {"read_status": "unread", "year_from": 2023, "tags": ["important"]}
    filter_criteria JSONB NOT NULL DEFAULT '{}',

    -- Cache
    cached_paper_count INTEGER DEFAULT 0,
    last_computed_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================================
-- Indexes
-- =============================================================================

-- Collections
CREATE INDEX idx_collections_user ON collections(user_id);
CREATE INDEX idx_collections_parent ON collections(parent_id) WHERE parent_id IS NOT NULL;
CREATE INDEX idx_collections_archived ON collections(user_id, is_archived);
CREATE INDEX idx_collections_pinned ON collections(user_id, is_pinned) WHERE is_pinned = TRUE;

-- Collection Papers
CREATE INDEX idx_collection_papers_paper ON collection_papers(paper_id);
CREATE INDEX idx_collection_papers_added ON collection_papers(collection_id, added_at DESC);

-- Literature Notes
CREATE INDEX idx_literature_notes_user ON literature_notes(user_id);
CREATE INDEX idx_literature_notes_collection ON literature_notes(collection_id) WHERE collection_id IS NOT NULL;
CREATE INDEX idx_literature_notes_paper ON literature_notes(paper_id) WHERE paper_id IS NOT NULL;
CREATE INDEX idx_literature_notes_pinned ON literature_notes(user_id, is_pinned) WHERE is_pinned = TRUE;
CREATE INDEX idx_literature_notes_tags ON literature_notes USING GIN (tags);

-- Smart Collections
CREATE INDEX idx_smart_collections_user ON smart_collections(user_id);

-- =============================================================================
-- Triggers
-- =============================================================================

-- Update timestamp on collections
CREATE TRIGGER trg_collections_updated
    BEFORE UPDATE ON collections
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Update timestamp on notes
CREATE TRIGGER trg_literature_notes_updated
    BEFORE UPDATE ON literature_notes
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Update timestamp on smart collections
CREATE TRIGGER trg_smart_collections_updated
    BEFORE UPDATE ON smart_collections
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================================================
-- Helper Functions
-- =============================================================================

-- Get paper count for a collection
CREATE OR REPLACE FUNCTION get_collection_paper_count(p_collection_id UUID)
RETURNS INTEGER AS $$
BEGIN
    RETURN (SELECT COUNT(*) FROM collection_papers WHERE collection_id = p_collection_id);
END;
$$ LANGUAGE plpgsql;

-- Get all papers in a collection (including nested collections)
CREATE OR REPLACE FUNCTION get_collection_papers_recursive(p_collection_id UUID)
RETURNS TABLE (paper_id UUID) AS $$
WITH RECURSIVE collection_tree AS (
    -- Base case: the collection itself
    SELECT id FROM collections WHERE id = p_collection_id
    UNION ALL
    -- Recursive case: child collections
    SELECT c.id FROM collections c
    INNER JOIN collection_tree ct ON c.parent_id = ct.id
)
SELECT DISTINCT cp.paper_id
FROM collection_papers cp
WHERE cp.collection_id IN (SELECT id FROM collection_tree);
$$ LANGUAGE sql;

COMMIT;
