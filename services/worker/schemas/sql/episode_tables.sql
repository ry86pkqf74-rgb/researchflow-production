-- ============================================================================
-- TEMPORAL DIAGNOSTIC EPISODE FUSION - SQL SCHEMA
-- ============================================================================
--
-- This schema defines the tables for storing diagnostic episodes and their
-- relationships to multi-modal events, surgeries, and aggregated features.
--
-- Tables:
-- 1. DiagnosticEpisode: Primary episode metadata
-- 2. EpisodeEvent: Links events to episodes with temporal tracking
-- 3. EpisodeSurgeryLink: Links episodes to surgical outcomes
-- 4. EpisodeFeatures: Materialized aggregated features per episode
--
-- Author: Research Operating System
-- Date: 2025-12-22
-- ============================================================================

-- ============================================================================
-- 1. DIAGNOSTIC_EPISODE
-- ============================================================================
-- Primary episode metadata table tracking the anchor event for each episode
-- Each episode represents a clinically coherent diagnostic workup period

CREATE TABLE IF NOT EXISTS diagnostic_episode (
    -- Primary key
    episode_id VARCHAR(50) PRIMARY KEY,

    -- Patient identifier
    research_id VARCHAR(50) NOT NULL,

    -- Index event (anchor) for this episode
    index_event_type VARCHAR(50) NOT NULL,  -- 'surgery', 'fna_biopsy', 'molecular_test', 'major_imaging'
    index_event_date DATE NOT NULL,         -- Date of index event
    index_event_id VARCHAR(100) NOT NULL,   -- Reference to original event record

    -- Episode priority (lower = higher priority, based on event type)
    priority_rank INTEGER NOT NULL,

    -- Time window configuration (days before/after index event)
    time_window_days INTEGER DEFAULT 30,

    -- Provenance tracking
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by VARCHAR(100) DEFAULT 'episode_fusion_v1',

    -- Indexes for efficient querying
    CONSTRAINT fk_research_id FOREIGN KEY (research_id)
        REFERENCES patients(research_id) ON DELETE CASCADE,
    INDEX idx_research_id (research_id),
    INDEX idx_index_event_date (index_event_date),
    INDEX idx_index_event_type (index_event_type)
);

COMMENT ON TABLE diagnostic_episode IS
'Primary episode metadata. Each episode anchors on an index event (surgery, FNA, etc.)
and defines a time window for associated diagnostic events.';

COMMENT ON COLUMN diagnostic_episode.episode_id IS
'Unique episode identifier (format: {research_id}_EP{episode_num})';

COMMENT ON COLUMN diagnostic_episode.priority_rank IS
'Event priority: 0=surgery (highest), 1=FNA, 2=molecular, 3=imaging (lowest)';

COMMENT ON COLUMN diagnostic_episode.time_window_days IS
'Time window in days (±) around index event for event assignment.
Standard windows: 14 (narrow), 30 (standard), 45 (wide)';


-- ============================================================================
-- 2. EPISODE_EVENT
-- ============================================================================
-- Links individual events (imaging, cytology, molecular, labs) to episodes
-- Tracks temporal relationship (delta days) between event and episode anchor

CREATE TABLE IF NOT EXISTS episode_event (
    -- Composite primary key
    episode_id VARCHAR(50) NOT NULL,
    event_id VARCHAR(100) NOT NULL,

    -- Event metadata
    event_type VARCHAR(50) NOT NULL,        -- 'ultrasound', 'ct_scan', 'fna_biopsy', etc.
    event_date DATE NOT NULL,               -- Date of event

    -- Temporal relationship to episode
    delta_days INTEGER NOT NULL,            -- event_date - index_event_date (negative = before)
    within_window BOOLEAN NOT NULL,         -- TRUE if within time window

    -- Provenance tracking
    assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (episode_id, event_id),

    -- Foreign keys
    CONSTRAINT fk_episode_id FOREIGN KEY (episode_id)
        REFERENCES diagnostic_episode(episode_id) ON DELETE CASCADE,

    -- Indexes for efficient querying
    INDEX idx_episode_id (episode_id),
    INDEX idx_event_type (event_type),
    INDEX idx_event_date (event_date),
    INDEX idx_delta_days (delta_days)
);

COMMENT ON TABLE episode_event IS
'Links individual events to diagnostic episodes. Each event is assigned to the
nearest episode within the time window. Tracks temporal delta for analysis.';

COMMENT ON COLUMN episode_event.delta_days IS
'Days from event to index event (negative = before index, positive = after index).
Example: delta_days = -7 means event occurred 7 days BEFORE index event.';

COMMENT ON COLUMN episode_event.within_window IS
'Flag indicating event falls within episode time window (|delta_days| <= time_window_days)';


-- ============================================================================
-- 3. EPISODE_SURGERY_LINK
-- ============================================================================
-- Links episodes to surgical outcomes and classifies temporal relationship
-- Enables pre-operative vs. post-operative analysis

CREATE TABLE IF NOT EXISTS episode_surgery_link (
    -- Composite primary key
    episode_id VARCHAR(50) NOT NULL,
    surgery_id VARCHAR(100),

    -- Surgery metadata
    surgery_date DATE,
    surgery_type VARCHAR(100),              -- 'Total Thyroidectomy', 'Lobectomy', etc.

    -- Temporal relationship classification
    relationship_type VARCHAR(20) NOT NULL, -- 'preop', 'postop', 'unrelated', 'no_surgery'
    days_to_surgery INTEGER,                -- episode_index_date → surgery_date (negative = before)

    -- Provenance tracking
    linked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (episode_id, COALESCE(surgery_id, 'no_surgery')),

    -- Foreign keys
    CONSTRAINT fk_episode_id_surgery FOREIGN KEY (episode_id)
        REFERENCES diagnostic_episode(episode_id) ON DELETE CASCADE,

    -- Indexes
    INDEX idx_relationship_type (relationship_type),
    INDEX idx_surgery_date (surgery_date)
);

COMMENT ON TABLE episode_surgery_link IS
'Links episodes to surgeries and classifies temporal relationship.
Pre-op: Episode within 90 days BEFORE surgery
Post-op: Episode within 365 days AFTER surgery
Unrelated: Episode outside both windows
No_surgery: Patient has no surgery record';

COMMENT ON COLUMN episode_surgery_link.relationship_type IS
'Classification: preop (episode before surgery), postop (episode after surgery),
unrelated (episode far from surgery), no_surgery (patient has no surgery)';

COMMENT ON COLUMN episode_surgery_link.days_to_surgery IS
'Days from episode index event to surgery (negative = episode before surgery).
Example: days_to_surgery = -30 means episode was 30 days BEFORE surgery.';


-- ============================================================================
-- 4. EPISODE_FEATURES (Materialized View / Table)
-- ============================================================================
-- Aggregated features for each episode across all modalities
-- This is the primary table for machine learning feature engineering

CREATE TABLE IF NOT EXISTS episode_features (
    -- Primary key
    episode_id VARCHAR(50) PRIMARY KEY,

    -- Patient and episode metadata
    research_id VARCHAR(50) NOT NULL,
    index_event_type VARCHAR(50) NOT NULL,
    index_event_date DATE NOT NULL,

    -- === IMAGING FEATURES ===
    -- Ultrasound (TI-RADS)
    tirads_max INTEGER,                     -- Maximum TI-RADS score (worst finding)
    nodule_count_total INTEGER,             -- Total nodules across all imaging
    nodule_size_max_cm DECIMAL(5,2),        -- Largest nodule size (cm)
    thyroid_volume_last_cc DECIMAL(6,2),    -- Most recent thyroid volume (cc)
    suspicious_features_total INTEGER,      -- Count of suspicious US features

    -- === CYTOLOGY FEATURES ===
    -- FNA Bethesda classification
    bethesda_max INTEGER,                   -- Maximum Bethesda score (worst cytology)
    bethesda_latest INTEGER,                -- Most recent Bethesda score
    fna_count INTEGER,                      -- Number of FNA procedures in episode
    adequacy_latest VARCHAR(50),            -- Most recent adequacy assessment

    -- === MOLECULAR FEATURES ===
    -- Mutations and molecular classifiers
    braf_positive BOOLEAN,                  -- Any BRAF mutation detected
    ras_positive BOOLEAN,                   -- Any RAS mutation detected
    ret_ptc_positive BOOLEAN,               -- Any RET/PTC fusion detected
    molecular_classifier_latest DECIMAL(5,3), -- Most recent molecular classifier score

    -- === LAB FEATURES ===
    -- Thyroglobulin and antibodies
    thyroglobulin_mean DECIMAL(8,2),        -- Mean thyroglobulin (ng/mL)
    thyroglobulin_max DECIMAL(8,2),         -- Max thyroglobulin (ng/mL)
    tsh_latest DECIMAL(6,3),                -- Most recent TSH (mIU/L)
    t3_latest DECIMAL(6,2),                 -- Most recent T3 (ng/dL)
    t4_latest DECIMAL(6,2),                 -- Most recent T4 (μg/dL)
    anti_tg_max DECIMAL(7,2),               -- Max anti-thyroglobulin antibody (IU/mL)
    anti_tg_positive BOOLEAN,               -- Anti-Tg > 0.9 IU/mL (positive)

    -- === PATHOLOGY FEATURES (from surgery outcome) ===
    -- Linked from episode_surgery_link
    malignancy_label INTEGER,               -- 0=benign, 1=malignant (ground truth)
    histology_type VARCHAR(100),            -- Papillary, follicular, medullary, etc.
    tumor_size_cm DECIMAL(5,2),             -- Tumor size (cm)
    ajcc8_t_stage VARCHAR(10),              -- AJCC 8th edition T stage
    ajcc8_n_stage VARCHAR(10),              -- AJCC 8th edition N stage
    ajcc8_m_stage VARCHAR(10),              -- AJCC 8th edition M stage

    -- === METADATA ===
    feature_count INTEGER NOT NULL,         -- Number of non-null features
    completeness_pct DECIMAL(5,2),          -- % of features with data

    -- Provenance tracking
    computed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    computation_version VARCHAR(20) DEFAULT 'v1.0',

    -- Foreign key
    CONSTRAINT fk_episode_id_features FOREIGN KEY (episode_id)
        REFERENCES diagnostic_episode(episode_id) ON DELETE CASCADE,

    -- Indexes
    INDEX idx_research_id_features (research_id),
    INDEX idx_index_event_date_features (index_event_date),
    INDEX idx_malignancy_label (malignancy_label)
);

COMMENT ON TABLE episode_features IS
'Materialized aggregated features for each episode. This table is the primary
source for machine learning feature engineering. Features are aggregated from
all events within the episode time window using clinically appropriate rules
(e.g., max TI-RADS = worst finding, max Bethesda = worst cytology).';

COMMENT ON COLUMN episode_features.tirads_max IS
'Maximum TI-RADS score across all ultrasounds in episode (range: 1-5, higher = more suspicious)';

COMMENT ON COLUMN episode_features.bethesda_max IS
'Maximum Bethesda classification across all FNA in episode (range: I-VI, higher = more suspicious)';

COMMENT ON COLUMN episode_features.molecular_classifier_latest IS
'Most recent molecular classifier score (e.g., Afirma GEC, ThyroSeq).
Higher scores indicate higher malignancy risk.';


-- ============================================================================
-- VIEWS FOR ANALYSIS
-- ============================================================================

-- View: Pre-operative episodes with complete feature data
CREATE OR REPLACE VIEW preop_episodes_complete AS
SELECT
    ef.*,
    esl.surgery_date,
    esl.surgery_type,
    esl.days_to_surgery
FROM episode_features ef
INNER JOIN episode_surgery_link esl
    ON ef.episode_id = esl.episode_id
WHERE esl.relationship_type = 'preop'
  AND ef.completeness_pct >= 50.0  -- At least 50% of features populated
;

COMMENT ON VIEW preop_episodes_complete IS
'Pre-operative episodes with at least 50% feature completeness.
This is the primary dataset for malignancy prediction models.';


-- View: Episode coverage summary (for quality monitoring)
CREATE OR REPLACE VIEW episode_coverage_summary AS
SELECT
    de.research_id,
    COUNT(DISTINCT de.episode_id) AS episode_count,
    COUNT(DISTINCT CASE WHEN esl.relationship_type = 'preop' THEN de.episode_id END) AS preop_episodes,
    COUNT(DISTINCT ee.event_id) AS total_events,
    COUNT(DISTINCT CASE WHEN ee.event_type = 'ultrasound' THEN ee.event_id END) AS ultrasound_events,
    COUNT(DISTINCT CASE WHEN ee.event_type = 'fna_biopsy' THEN ee.event_id END) AS fna_events,
    COUNT(DISTINCT CASE WHEN ee.event_type = 'molecular_test' THEN ee.event_id END) AS molecular_events,
    AVG(ef.completeness_pct) AS avg_completeness_pct
FROM diagnostic_episode de
LEFT JOIN episode_event ee ON de.episode_id = ee.episode_id
LEFT JOIN episode_surgery_link esl ON de.episode_id = esl.episode_id
LEFT JOIN episode_features ef ON de.episode_id = ef.episode_id
GROUP BY de.research_id
;

COMMENT ON VIEW episode_coverage_summary IS
'Patient-level summary of episode coverage, event counts, and feature completeness.
Use for quality monitoring and identifying patients with incomplete data.';


-- ============================================================================
-- INDEXES FOR PERFORMANCE
-- ============================================================================

-- Additional indexes for common query patterns
CREATE INDEX idx_episode_features_completeness ON episode_features(completeness_pct DESC);
CREATE INDEX idx_episode_features_bethesda ON episode_features(bethesda_max);
CREATE INDEX idx_episode_features_tirads ON episode_features(tirads_max);
CREATE INDEX idx_preop_episodes ON episode_surgery_link(relationship_type, days_to_surgery);


-- ============================================================================
-- GRANTS (Adjust based on your security model)
-- ============================================================================

-- Grant read access to analysts
-- GRANT SELECT ON diagnostic_episode TO analyst_role;
-- GRANT SELECT ON episode_event TO analyst_role;
-- GRANT SELECT ON episode_surgery_link TO analyst_role;
-- GRANT SELECT ON episode_features TO analyst_role;
-- GRANT SELECT ON preop_episodes_complete TO analyst_role;
-- GRANT SELECT ON episode_coverage_summary TO analyst_role;


-- ============================================================================
-- END OF SCHEMA
-- ============================================================================
