"""
Stage 5: PHI Detection and Handling

This stage scans data for Protected Health Information (PHI) and
ensures proper handling according to HIPAA requirements.

Phase 5 Enhancement:
- Supports Dask DataFrame using map_partitions
- Supports chunked iteration for large files
- Integrates with ingestion module configuration

Uses canonical PHI patterns from the generated module for consistency
with Node services.
"""

import hashlib
import logging
import os
from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple, Union

from ..types import StageContext, StageResult
from ..registry import register_stage

# Import generated PHI patterns - single source of truth
from src.validation.phi_patterns_generated import (
    PHI_PATTERNS_HIGH_CONFIDENCE,
    PHI_PATTERNS_OUTPUT_GUARD,
)

# Import ingestion module for large-data support (Phase 5)
try:
    from src.ingestion import (
        IngestionConfig,
        get_ingestion_config,
        ingest_file_large,
        IngestionMetadata,
        DASK_AVAILABLE,
    )
    INGESTION_AVAILABLE = True
except ImportError:
    INGESTION_AVAILABLE = False
    DASK_AVAILABLE = False

# Import pandas for DataFrame handling
try:
    import pandas as pd
    PANDAS_AVAILABLE = True
except ImportError:
    PANDAS_AVAILABLE = False

logger = logging.getLogger("workflow_engine.stages.stage_05_phi")


def hash_match(text: str) -> str:
    """Compute SHA256 hash of matched text (first 12 chars).

    CRITICAL: Never store raw PHI. Only hashes for deduplication.

    Args:
        text: Matched PHI text

    Returns:
        First 12 characters of SHA256 hash
    """
    return hashlib.sha256(text.encode()).hexdigest()[:12]


def scan_text_for_phi(
    content: str,
    tier: str = "HIGH_CONFIDENCE"
) -> List[Dict[str, Any]]:
    """Scan text content for PHI patterns.

    Args:
        content: Text content to scan
        tier: Pattern tier to use ("HIGH_CONFIDENCE" or "OUTPUT_GUARD")

    Returns:
        List of PHI findings (hash-only, no raw values)
    """
    patterns = (
        PHI_PATTERNS_HIGH_CONFIDENCE
        if tier == "HIGH_CONFIDENCE"
        else PHI_PATTERNS_OUTPUT_GUARD
    )

    findings: List[Dict[str, Any]] = []

    for category, pattern in patterns:
        for match in pattern.finditer(content):
            # CRITICAL: Hash immediately, never store raw match
            match_text = match.group()
            findings.append({
                "category": category,
                "matchHash": hash_match(match_text),
                "matchLength": len(match_text),
                "position": {
                    "start": match.start(),
                    "end": match.end(),
                },
            })

    return findings


def scan_dataframe_for_phi(
    df: "pd.DataFrame",
    tier: str = "HIGH_CONFIDENCE",
    chunk_index: Optional[int] = None,
) -> List[Dict[str, Any]]:
    """Scan a pandas DataFrame for PHI patterns.
    
    Scans all string columns for PHI.
    
    Args:
        df: DataFrame to scan
        tier: Pattern tier to use
        chunk_index: Optional chunk/partition index for tracking
        
    Returns:
        List of PHI findings with column info
    """
    findings: List[Dict[str, Any]] = []
    
    # Identify string columns
    string_cols = df.select_dtypes(include=['object', 'string']).columns
    
    for col in string_cols:
        for row_idx, value in enumerate(df[col]):
            if pd.isna(value):
                continue
            
            content = str(value)
            col_findings = scan_text_for_phi(content, tier=tier)
            
            for finding in col_findings:
                finding["column"] = col
                finding["row"] = row_idx
                if chunk_index is not None:
                    finding["chunk_index"] = chunk_index
                findings.append(finding)
    
    return findings


def scan_dask_dataframe_for_phi(
    ddf: Any,  # dask.dataframe.DataFrame
    tier: str = "HIGH_CONFIDENCE",
    max_partitions: int = 100,
) -> Tuple[List[Dict[str, Any]], Dict[str, Any]]:
    """Scan a Dask DataFrame for PHI using map_partitions.
    
    Args:
        ddf: Dask DataFrame to scan
        tier: Pattern tier to use
        max_partitions: Maximum partitions to scan (for safety)
        
    Returns:
        Tuple of (findings, scan_metadata)
    """
    if not DASK_AVAILABLE:
        return [], {"error": "Dask not available"}
    
    all_findings: List[Dict[str, Any]] = []
    partitions_scanned = 0
    total_rows = 0
    
    num_partitions = min(ddf.npartitions, max_partitions)
    
    for i in range(num_partitions):
        try:
            partition_df = ddf.get_partition(i).compute()
            partition_findings = scan_dataframe_for_phi(
                partition_df, 
                tier=tier, 
                chunk_index=i
            )
            all_findings.extend(partition_findings)
            total_rows += len(partition_df)
            partitions_scanned += 1
        except Exception as e:
            logger.warning(f"Error scanning partition {i}: {e}")
    
    metadata = {
        "partitions_scanned": partitions_scanned,
        "total_partitions": ddf.npartitions,
        "rows_scanned": total_rows,
        "scan_mode": "dask_partitioned",
    }
    
    return all_findings, metadata


def scan_chunked_iterator_for_phi(
    reader: Any,  # TextFileReader
    tier: str = "HIGH_CONFIDENCE",
    max_chunks: int = 100,
) -> Tuple[List[Dict[str, Any]], Dict[str, Any]]:
    """Scan a chunked iterator (TextFileReader) for PHI.
    
    Note: This consumes the iterator.
    
    Args:
        reader: Chunked file reader
        tier: Pattern tier to use
        max_chunks: Maximum chunks to scan (for safety)
        
    Returns:
        Tuple of (findings, scan_metadata)
    """
    all_findings: List[Dict[str, Any]] = []
    chunks_scanned = 0
    total_rows = 0
    
    for i, chunk_df in enumerate(reader):
        if i >= max_chunks:
            logger.warning(f"Reached max_chunks limit ({max_chunks})")
            break
        
        chunk_findings = scan_dataframe_for_phi(
            chunk_df,
            tier=tier,
            chunk_index=i
        )
        all_findings.extend(chunk_findings)
        total_rows += len(chunk_df)
        chunks_scanned += 1
    
    metadata = {
        "chunks_scanned": chunks_scanned,
        "rows_scanned": total_rows,
        "scan_mode": "chunked",
    }
    
    return all_findings, metadata


@register_stage
class Stage05PHIDetection:
    """PHI Detection and Handling Stage.

    This stage performs the following:
    - Scans dataset columns for potential PHI
    - Identifies direct identifiers (names, SSN, MRN)
    - Identifies quasi-identifiers (DOB, ZIP, gender combinations)
    - Validates de-identification requirements
    - Generates PHI inventory report
    
    Phase 5 Enhancement:
    - Supports Dask DataFrame scanning via map_partitions
    - Supports chunked scanning for large files
    - Integrates with ingestion module configuration
    """

    stage_id = 5
    stage_name = "PHI Detection"

    # Categories of PHI to detect
    PHI_CATEGORIES = [
        "names",
        "geographic_data",
        "dates",
        "phone_numbers",
        "fax_numbers",
        "email_addresses",
        "social_security_numbers",
        "medical_record_numbers",
        "health_plan_numbers",
        "account_numbers",
        "certificate_numbers",
        "vehicle_identifiers",
        "device_identifiers",
        "web_urls",
        "ip_addresses",
        "biometric_identifiers",
        "photographs",
        "unique_identifiers",
    ]

    async def execute(self, context: StageContext) -> StageResult:
        """Execute PHI detection scan.

        Args:
            context: StageContext with job configuration

        Returns:
            StageResult with PHI detection results (hash-only, no raw PHI)
        """
        started_at = datetime.utcnow().isoformat() + "Z"
        warnings: List[str] = []
        errors: List[str] = []
        artifacts: List[str] = []

        logger.info(f"Running PHI detection for job {context.job_id}")

        # Get PHI configuration
        phi_config = context.config.get("phi", {})
        scan_mode = phi_config.get("scan_mode", "standard")
        tier = (
            "OUTPUT_GUARD"
            if scan_mode == "strict"
            else "HIGH_CONFIDENCE"
        )

        all_findings: List[Dict[str, Any]] = []
        content_length = 0
        scan_metadata: Dict[str, Any] = {}

        # Get large-file info from stage 04 output if available
        large_file_info = context.config.get("stage_04_output", {}).get("large_file_info", {})
        processing_mode = large_file_info.get("processing_mode", "standard")
        
        # Scan file content if provided
        file_path = context.dataset_pointer
        if file_path and os.path.exists(file_path):
            try:
                file_size = os.path.getsize(file_path)
                content_length = file_size
                
                # Check if we should use large-file handling
                use_large_file = False
                if INGESTION_AVAILABLE:
                    config = get_ingestion_config()
                    use_large_file = file_size >= config.large_file_bytes
                
                if use_large_file and file_path.endswith(('.csv', '.tsv')):
                    # Use large-file PHI scanning
                    logger.info(f"Using large-file PHI scanning for {file_path}")
                    
                    file_format = "tsv" if file_path.endswith('.tsv') else "csv"
                    data, ingestion_meta = ingest_file_large(
                        file_path,
                        file_format=file_format,
                        config=config,
                    )
                    
                    if ingestion_meta.is_dask:
                        all_findings, scan_metadata = scan_dask_dataframe_for_phi(
                            data, tier=tier
                        )
                    elif ingestion_meta.is_chunked:
                        all_findings, scan_metadata = scan_chunked_iterator_for_phi(
                            data, tier=tier
                        )
                    else:
                        # Standard pandas DataFrame
                        all_findings = scan_dataframe_for_phi(data, tier=tier)
                        scan_metadata = {"scan_mode": "pandas", "rows_scanned": len(data)}
                    
                elif PANDAS_AVAILABLE and file_path.endswith(('.csv', '.tsv', '.parquet')):
                    # Use pandas for structured data
                    if file_path.endswith('.parquet'):
                        df = pd.read_parquet(file_path)
                    elif file_path.endswith('.tsv'):
                        df = pd.read_csv(file_path, sep='\t')
                    else:
                        df = pd.read_csv(file_path)
                    
                    all_findings = scan_dataframe_for_phi(df, tier=tier)
                    scan_metadata = {"scan_mode": "pandas", "rows_scanned": len(df)}
                    
                else:
                    # Fall back to text scanning
                    with open(file_path, "r", encoding="utf-8", errors="replace") as f:
                        content = f.read()
                    content_length = len(content)
                    all_findings = scan_text_for_phi(content, tier=tier)
                    scan_metadata = {"scan_mode": "text", "content_length": content_length}
                
                logger.info(
                    f"Scanned {scan_metadata.get('rows_scanned', content_length)} "
                    f"units, found {len(all_findings)} potential PHI matches"
                )

            except Exception as e:
                errors.append(f"Failed to read file for PHI scan: {str(e)}")
                logger.error(f"PHI scan error: {e}")

        # Aggregate findings by category (no raw PHI in output)
        categories_found: Dict[str, int] = {}
        for finding in all_findings:
            cat = finding["category"]
            categories_found[cat] = categories_found.get(cat, 0) + 1

        # Determine risk level
        phi_count = len(all_findings)
        if phi_count == 0:
            risk_level = "none"
        elif phi_count <= 5:
            risk_level = "low"
        elif phi_count <= 20:
            risk_level = "medium"
        else:
            risk_level = "high"

        # CRITICAL: Detection results contain NO raw PHI
        # Only hashes, counts, and positions
        detection_results = {
            "scan_mode": scan_mode,
            "tier": tier,
            "content_length": content_length,
            "total_findings": phi_count,
            "categories_found": categories_found,
            "risk_level": risk_level,
            "phi_detected": phi_count > 0,
            "requires_deidentification": risk_level in ("medium", "high"),
            # Store individual findings (hash-only)
            "findings": all_findings,
            # Include scan metadata for diagnostics
            "scan_metadata": scan_metadata,
        }

        # Build PHI schema for downstream stages (cumulative data)
        # This schema tells downstream stages which columns/fields contain PHI
        phi_schema = {
            "version": "1.0",
            "generated_at": datetime.utcnow().isoformat() + "Z",
            "source_file": file_path,
            "governance_mode": context.governance_mode,
            "risk_level": risk_level,
            "phi_detected": phi_count > 0,
            # Map of column -> list of PHI categories found
            "column_phi_map": {},
            # List of columns requiring de-identification
            "columns_requiring_deidentification": [],
            # De-identification recommendations
            "deidentification_recommendations": {},
        }

        # Build column-level PHI map from findings
        for finding in all_findings:
            col = finding.get("column", "_text_content")
            cat = finding["category"]

            if col not in phi_schema["column_phi_map"]:
                phi_schema["column_phi_map"][col] = []

            if cat not in phi_schema["column_phi_map"][col]:
                phi_schema["column_phi_map"][col].append(cat)

        # Identify columns requiring de-identification
        for col, categories in phi_schema["column_phi_map"].items():
            if categories:  # Any PHI found in column
                phi_schema["columns_requiring_deidentification"].append(col)

                # Add de-identification recommendations per category
                recommendations = []
                for cat in categories:
                    if cat in ("names", "social_security_numbers", "medical_record_numbers"):
                        recommendations.append("redact_or_pseudonymize")
                    elif cat in ("dates",):
                        recommendations.append("date_shift")
                    elif cat in ("geographic_data",):
                        recommendations.append("generalize_to_region")
                    elif cat in ("phone_numbers", "email_addresses"):
                        recommendations.append("redact")
                    else:
                        recommendations.append("redact")

                phi_schema["deidentification_recommendations"][col] = list(set(recommendations))

        # Store PHI schema in detection results for cumulative access
        detection_results["phi_schema"] = phi_schema

        # Mode-specific handling
        if context.governance_mode == "DEMO":
            detection_results["demo_mode"] = True
            if phi_count > 0:
                warnings.append("DEMO mode: PHI detected but processing continues")

        if context.governance_mode == "PRODUCTION" and risk_level == "high":
            errors.append("Production mode: High PHI risk requires manual review")

        completed_at = datetime.utcnow().isoformat() + "Z"
        started_dt = datetime.fromisoformat(started_at.replace("Z", "+00:00"))
        completed_dt = datetime.fromisoformat(completed_at.replace("Z", "+00:00"))
        duration_ms = int((completed_dt - started_dt).total_seconds() * 1000)

        # Fail if critical PHI detected in production
        status = "failed" if errors else "completed"

        return StageResult(
            stage_id=self.stage_id,
            stage_name=self.stage_name,
            status=status,
            started_at=started_at,
            completed_at=completed_at,
            duration_ms=duration_ms,
            output=detection_results,
            artifacts=artifacts,
            warnings=warnings,
            errors=errors,
            metadata={
                "governance_mode": context.governance_mode,
                "phi_categories_checked": self.PHI_CATEGORIES,
                "pattern_count": len(PHI_PATTERNS_OUTPUT_GUARD),
                "ingestion_module_available": INGESTION_AVAILABLE,
                "dask_available": DASK_AVAILABLE,
                "processing_mode": scan_metadata.get("scan_mode", "unknown"),
            },
        )
