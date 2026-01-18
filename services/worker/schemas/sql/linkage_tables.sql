-- ============================================================================
-- CI-GUARDED LINKAGE TABLES AND MATERIALIZED VIEWS
-- ============================================================================
--
-- This schema defines tables and views for production-grade linkage between
-- multi-modal diagnostic data (imaging, cytology, molecular) and outcomes
-- (pathology, surgery) with CI guardrails.
--
-- Tables:
-- 1. diagnostic_linkage: Master linkage table with date tolerances
-- 2. linkage_audit_log: Immutable audit trail for all link decisions
-- 3. linkage_validation_log: CI validation check results
--
-- Materialized Views:
-- 4. ct_ete_vs_path_ete: CT-reported ETE vs pathology-confirmed ETE
-- 5. tirads_vs_rom: TI-RADS score vs risk of malignancy
-- 6. bethesda_vs_malignancy: Bethesda category vs final malignancy
-- 7. linkage_coverage_summary: Coverage statistics by modality
--
-- Author: Research Operating System
-- Date: 2025-12-22
-- ============================================================================

-- ============================================================================
-- 1. DIAGNOSTIC_LINKAGE
-- ============================================================================
-- Master linkage table for multi-modal diagnostic data to outcomes

CREATE TABLE IF NOT EXISTS diagnostic_linkage (
    -- Primary key
    linkage_id VARCHAR(50) PRIMARY KEY,

    -- Source record (imaging, cytology, molecular)
    source_id VARCHAR(100) NOT NULL,
    source_type VARCHAR(50) NOT NULL,  -- 'ct_scan', 'fna_biopsy', 'molecular_test', etc.
    source_date DATE NOT NULL,

    -- Target record (pathology, surgery)
    target_id VARCHAR(100) NOT NULL,
    target_type VARCHAR(50) NOT NULL,  -- 'pathology', 'surgery'
    target_date DATE NOT NULL,

    -- Patient identifier
    research_id VARCHAR(50) NOT NULL,

    -- Temporal relationship
    days_gap INTEGER NOT NULL,              -- Signed: negative = source before target
    abs_days_gap INTEGER NOT NULL,          -- Absolute value for filtering
    tolerance_days INTEGER NOT NULL,        -- Date tolerance window used
    within_tolerance BOOLEAN NOT NULL,      -- Always TRUE for created links

    -- Link quality metrics
    link_confidence DECIMAL(5,3) NOT NULL,  -- 0.0-1.0 (1.0 = same day, decreases with gap)
    validation_status VARCHAR(20) NOT NULL, -- 'PASSED', 'FAILED', 'WARNING'

    -- Provenance tracking
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by VARCHAR(100) DEFAULT 'linkage_engine_v1',

    -- Indexes for efficient querying
    INDEX idx_source_id (source_id),
    INDEX idx_target_id (target_id),
    INDEX idx_research_id (research_id),
    INDEX idx_source_type (source_type),
    INDEX idx_validation_status (validation_status),
    INDEX idx_abs_days_gap (abs_days_gap)
);

COMMENT ON TABLE diagnostic_linkage IS
'Master linkage table connecting multi-modal diagnostic events to clinical outcomes.
Uses deterministic date tolerance rules: CT ±90d, FNA ±14d, Molecular ±30d.';

COMMENT ON COLUMN diagnostic_linkage.days_gap IS
'Signed temporal gap (source_date - target_date).
Negative = source before target (typical pre-operative scenario).';

COMMENT ON COLUMN diagnostic_linkage.link_confidence IS
'Confidence score: 1.0 (same day) to 0.0 (tolerance boundary).
Calculated as: 1.0 - (abs_days_gap / tolerance_days)';


-- ============================================================================
-- 2. LINKAGE_AUDIT_LOG
-- ============================================================================
-- Immutable audit trail for all linkage decisions (append-only)

CREATE TABLE IF NOT EXISTS linkage_audit_log (
    -- Primary key
    audit_id VARCHAR(50) PRIMARY KEY,

    -- Audit metadata
    timestamp TIMESTAMP NOT NULL,

    -- Linkage reference
    linkage_id VARCHAR(50) NOT NULL,
    source_id VARCHAR(100) NOT NULL,
    target_id VARCHAR(100) NOT NULL,
    source_type VARCHAR(50) NOT NULL,
    target_type VARCHAR(50) NOT NULL,

    -- Temporal metrics
    days_gap INTEGER NOT NULL,
    abs_days_gap INTEGER NOT NULL,
    tolerance_days INTEGER NOT NULL,

    -- Quality metrics
    link_confidence DECIMAL(5,3) NOT NULL,
    validation_status VARCHAR(20) NOT NULL,
    validation_checks TEXT,              -- JSON: validation check results

    -- Provenance
    created_by VARCHAR(100) NOT NULL,

    -- Hash chain for tamper detection
    log_hash VARCHAR(16) NOT NULL,       -- SHA-256 hash of entry (truncated)
    prev_log_hash VARCHAR(16) NOT NULL,  -- Hash of previous entry (creates chain)

    -- Indexes
    INDEX idx_timestamp (timestamp),
    INDEX idx_linkage_id (linkage_id),
    INDEX idx_source_type_audit (source_type)
);

COMMENT ON TABLE linkage_audit_log IS
'Immutable audit trail for linkage decisions. Append-only (no updates/deletes).
Hash chain enables tamper detection and ensures log integrity.';

COMMENT ON COLUMN linkage_audit_log.log_hash IS
'SHA-256 hash of entry + prev_log_hash. Creates tamper-evident chain.';


-- ============================================================================
-- 3. LINKAGE_VALIDATION_LOG
-- ============================================================================
-- CI validation check results for quality monitoring

CREATE TABLE IF NOT EXISTS linkage_validation_log (
    -- Primary key
    validation_id VARCHAR(50) PRIMARY KEY,

    -- Validation run metadata
    run_timestamp TIMESTAMP NOT NULL,
    linkage_batch_id VARCHAR(50),        -- Links validation to linkage creation run

    -- Validation checks
    check_name VARCHAR(50) NOT NULL,     -- 'time_gap_bounds', 'cardinality', etc.
    check_passed BOOLEAN NOT NULL,
    violations INTEGER DEFAULT 0,
    error_details TEXT,                  -- JSON: detailed error information

    -- Provenance
    validated_by VARCHAR(100) DEFAULT 'linkage_validator_v1',

    -- Indexes
    INDEX idx_run_timestamp (run_timestamp),
    INDEX idx_check_name (check_name),
    INDEX idx_check_passed (check_passed)
);

COMMENT ON TABLE linkage_validation_log IS
'CI validation check results. Tracks time-gap bounds, cardinality,
prohibited combinations, and coverage metrics for quality gates.';


-- ============================================================================
-- MATERIALIZED VIEW 4: CT-ETE vs PATH-ETE
-- ============================================================================
-- Compare CT-reported extrathyroidal extension (ETE) to pathology-confirmed ETE

CREATE OR REPLACE VIEW ct_ete_vs_path_ete AS
SELECT
    dl.linkage_id,
    dl.research_id,
    dl.source_id AS ct_id,
    dl.target_id AS pathology_id,
    ct.ete_present AS ct_ete_reported,
    path.ete_confirmed AS path_ete_confirmed,
    CASE
        WHEN ct.ete_present = path.ete_confirmed THEN 'CONCORDANT'
        ELSE 'DISCORDANT'
    END AS concordance_status,
    dl.days_gap,
    dl.link_confidence,
    dl.created_at
FROM diagnostic_linkage dl
INNER JOIN ct_imaging ct ON dl.source_id = ct.ct_id
INNER JOIN pathology_reports path ON dl.target_id = path.pathology_id
WHERE dl.source_type = 'ct_scan'
  AND dl.validation_status = 'PASSED'
  AND ct.ete_present IS NOT NULL
  AND path.ete_confirmed IS NOT NULL
;

COMMENT ON VIEW ct_ete_vs_path_ete IS
'Linkage concordance view: CT-reported ETE vs pathology-confirmed ETE.
Used for validating imaging diagnostic accuracy.';


-- ============================================================================
-- MATERIALIZED VIEW 5: TI-RADS vs ROM
-- ============================================================================
-- Compare TI-RADS risk stratification to actual risk of malignancy

CREATE OR REPLACE VIEW tirads_vs_rom AS
SELECT
    dl.linkage_id,
    dl.research_id,
    us.tirads_score,
    CASE
        WHEN path.malignancy_status = 1 THEN 'MALIGNANT'
        ELSE 'BENIGN'
    END AS pathology_outcome,
    COUNT(*) OVER (PARTITION BY us.tirads_score, path.malignancy_status) AS count,
    dl.days_gap,
    dl.link_confidence
FROM diagnostic_linkage dl
INNER JOIN ultrasound_imaging us ON dl.source_id = us.ultrasound_id
INNER JOIN pathology_reports path ON dl.target_id = path.pathology_id
WHERE dl.source_type = 'ultrasound'
  AND dl.validation_status = 'PASSED'
  AND us.tirads_score IS NOT NULL
  AND path.malignancy_status IS NOT NULL
;

COMMENT ON VIEW tirads_vs_rom IS
'Risk of malignancy (ROM) by TI-RADS score. Compares ultrasound risk stratification
to final pathology outcomes. Used for validating TI-RADS performance.';


-- ============================================================================
-- MATERIALIZED VIEW 6: BETHESDA vs MALIGNANCY
-- ============================================================================
-- Compare Bethesda cytology classification to final malignancy outcome

CREATE OR REPLACE VIEW bethesda_vs_malignancy AS
SELECT
    dl.linkage_id,
    dl.research_id,
    fna.bethesda_category,
    CASE
        WHEN path.malignancy_status = 1 THEN 'MALIGNANT'
        ELSE 'BENIGN'
    END AS pathology_outcome,
    COUNT(*) OVER (PARTITION BY fna.bethesda_category, path.malignancy_status) AS count,
    dl.days_gap,
    dl.link_confidence
FROM diagnostic_linkage dl
INNER JOIN fna_cytology fna ON dl.source_id = fna.fna_id
INNER JOIN pathology_reports path ON dl.target_id = path.pathology_id
WHERE dl.source_type = 'fna_biopsy'
  AND dl.validation_status = 'PASSED'
  AND fna.bethesda_category IS NOT NULL
  AND path.malignancy_status IS NOT NULL
;

COMMENT ON VIEW bethesda_vs_malignancy IS
'Risk of malignancy (ROM) by Bethesda category. Compares FNA cytology
classification to final pathology. Used for validating Bethesda performance.';


-- ============================================================================
-- MATERIALIZED VIEW 7: LINKAGE_COVERAGE_SUMMARY
-- ============================================================================
-- Summary statistics for linkage coverage by modality

CREATE OR REPLACE VIEW linkage_coverage_summary AS
SELECT
    source_type,
    COUNT(DISTINCT linkage_id) AS total_linkages,
    COUNT(DISTINCT source_id) AS unique_sources_linked,
    COUNT(DISTINCT target_id) AS unique_targets_linked,
    COUNT(DISTINCT research_id) AS unique_patients,
    AVG(abs_days_gap) AS mean_abs_days_gap,
    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY abs_days_gap) AS median_abs_days_gap,
    MAX(abs_days_gap) AS max_abs_days_gap,
    AVG(link_confidence) AS mean_link_confidence,
    SUM(CASE WHEN validation_status = 'PASSED' THEN 1 ELSE 0 END) AS passed_validation,
    SUM(CASE WHEN validation_status = 'FAILED' THEN 1 ELSE 0 END) AS failed_validation,
    SUM(CASE WHEN validation_status = 'WARNING' THEN 1 ELSE 0 END) AS warning_validation
FROM diagnostic_linkage
GROUP BY source_type
ORDER BY total_linkages DESC
;

COMMENT ON VIEW linkage_coverage_summary IS
'Linkage coverage and quality summary by modality. Used for quality monitoring
and identifying data gaps. Tracks linkage counts, temporal metrics, and validation status.';


-- ============================================================================
-- INDEXES FOR PERFORMANCE
-- ============================================================================

-- Additional composite indexes for common query patterns
CREATE INDEX idx_linkage_source_target ON diagnostic_linkage(source_type, target_type);
CREATE INDEX idx_linkage_patient_source ON diagnostic_linkage(research_id, source_type);
CREATE INDEX idx_linkage_confidence_status ON diagnostic_linkage(link_confidence DESC, validation_status);

-- Audit log indexes for temporal queries
CREATE INDEX idx_audit_timestamp_source ON linkage_audit_log(timestamp, source_type);

-- Validation log indexes for CI monitoring
CREATE INDEX idx_validation_timestamp_check ON linkage_validation_log(run_timestamp, check_name);


-- ============================================================================
-- GRANTS (Adjust based on your security model)
-- ============================================================================

-- Grant read access to analysts
-- GRANT SELECT ON diagnostic_linkage TO analyst_role;
-- GRANT SELECT ON linkage_audit_log TO analyst_role;
-- GRANT SELECT ON linkage_validation_log TO analyst_role;
-- GRANT SELECT ON ct_ete_vs_path_ete TO analyst_role;
-- GRANT SELECT ON tirads_vs_rom TO analyst_role;
-- GRANT SELECT ON bethesda_vs_malignancy TO analyst_role;
-- GRANT SELECT ON linkage_coverage_summary TO analyst_role;


-- ============================================================================
-- CI GUARDRAIL CHECKS (Execute in CI/CD pipeline)
-- ============================================================================

-- Check 1: Time-gap bounds (all links within tolerance)
-- Expected: 0 violations
SELECT COUNT(*) AS time_gap_violations
FROM diagnostic_linkage
WHERE abs_days_gap > tolerance_days;

-- Check 2: Cardinality (each source links to ≤1 target)
-- Expected: 0 violations
SELECT source_id, COUNT(*) AS link_count
FROM diagnostic_linkage
GROUP BY source_id
HAVING COUNT(*) > 1;

-- Check 3: Linkage coverage (≥80% of sources linked)
-- Expected: coverage_pct ≥ 80
SELECT
    source_type,
    (COUNT(DISTINCT source_id) * 100.0 /
     (SELECT COUNT(*) FROM source_table)) AS coverage_pct
FROM diagnostic_linkage
GROUP BY source_type;

-- Check 4: Concordance (CT-ETE vs Path-ETE ≥85% agreement)
-- Expected: agreement_pct ≥ 85
SELECT
    SUM(CASE WHEN concordance_status = 'CONCORDANT' THEN 1 ELSE 0 END) * 100.0 /
    COUNT(*) AS agreement_pct
FROM ct_ete_vs_path_ete;

-- Check 5: Audit log integrity (hash chain valid)
-- Expected: No hash mismatches or chain breaks
-- (Implemented in Python AuditLogger.verify_hash_chain())


-- ============================================================================
-- END OF SCHEMA
-- ============================================================================
