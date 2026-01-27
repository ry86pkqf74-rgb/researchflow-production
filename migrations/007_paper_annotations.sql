-- ============================================
-- Migration: Paper Annotations (Track B Phase 11)
-- ResearchFlow Production
-- ============================================

BEGIN;

-- =============================================================================
-- Paper Annotations - Highlights, notes, underlines on PDFs
-- =============================================================================

CREATE TABLE IF NOT EXISTS paper_annotations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    paper_id UUID NOT NULL REFERENCES papers(id) ON DELETE CASCADE,
    user_id VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    -- Position information
    page_number INTEGER NOT NULL,
    rect JSONB NOT NULL,  -- {x1, y1, x2, y2, width, height} - normalized coordinates (0-1)

    -- Annotation type and style
    type VARCHAR(20) NOT NULL,  -- highlight, underline, strikethrough, note
    color VARCHAR(20) DEFAULT 'yellow',  -- yellow, green, blue, pink, orange

    -- Content
    selected_text TEXT,  -- The text that was selected (for highlights)
    note_content TEXT,   -- User's note/comment

    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT chk_annotation_type CHECK (type IN ('highlight', 'underline', 'strikethrough', 'note')),
    CONSTRAINT chk_annotation_color CHECK (color IN ('yellow', 'green', 'blue', 'pink', 'orange', 'red', 'purple'))
);

-- =============================================================================
-- Annotation Threads - Comments/replies on annotations
-- =============================================================================

CREATE TABLE IF NOT EXISTS annotation_threads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    annotation_id UUID NOT NULL REFERENCES paper_annotations(id) ON DELETE CASCADE,
    user_id VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    parent_id UUID REFERENCES annotation_threads(id) ON DELETE CASCADE,  -- For replies

    content TEXT NOT NULL,
    is_resolved BOOLEAN DEFAULT FALSE,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================================
-- Indexes
-- =============================================================================

CREATE INDEX idx_annotations_paper_id ON paper_annotations(paper_id);
CREATE INDEX idx_annotations_user_id ON paper_annotations(user_id);
CREATE INDEX idx_annotations_page ON paper_annotations(paper_id, page_number);
CREATE INDEX idx_annotations_type ON paper_annotations(type);
CREATE INDEX idx_annotations_created ON paper_annotations(created_at DESC);

CREATE INDEX idx_annotation_threads_annotation ON annotation_threads(annotation_id);
CREATE INDEX idx_annotation_threads_parent ON annotation_threads(parent_id) WHERE parent_id IS NOT NULL;

-- =============================================================================
-- Update Timestamp Trigger
-- =============================================================================

CREATE TRIGGER trg_annotations_updated
    BEFORE UPDATE ON paper_annotations
    FOR EACH ROW EXECUTE FUNCTION update_paper_timestamp();

CREATE TRIGGER trg_annotation_threads_updated
    BEFORE UPDATE ON annotation_threads
    FOR EACH ROW EXECUTE FUNCTION update_paper_timestamp();

COMMIT;
