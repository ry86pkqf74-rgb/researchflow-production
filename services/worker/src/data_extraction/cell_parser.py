"""
Cell Parser Module - DataFrame-level text detection and batch extraction.

This module provides tools for identifying narrative text columns in DataFrames
and orchestrating batch LLM extraction with PHI pre/post scanning.

Key Features:
- Automatic detection of narrative text columns
- PHI scanning before sending to external AI
- PHI scanning of extraction outputs
- Batch processing with controlled concurrency
- Integration with governance/phi_scanner
"""

import asyncio
import json
import logging
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import pandas as pd

from .extract_from_cells import extract_clinical_from_cell, ExtractionError
from .nlm_enrichment import enrich_extraction
from .schemas import ClinicalExtraction, ExtractionResponse

logger = logging.getLogger(__name__)

# Columns that commonly contain narrative text
NARRATIVE_COLUMN_PATTERNS = [
    "note", "notes", "comment", "comments", "description",
    "history", "narrative", "text", "finding", "findings",
    "impression", "assessment", "plan", "summary", "details",
    "report", "reason", "indication", "chief_complaint",
    "hpi", "ros", "physical_exam", "discharge", "operative",
]

# Default thresholds
DEFAULT_MIN_TEXT_LENGTH = 100
DEFAULT_MIN_NARRATIVE_RATIO = 0.3
DEFAULT_MAX_CONCURRENT = 5


@dataclass
class CellTarget:
    """Identifies a cell targeted for extraction."""
    row_idx: int
    col_name: str
    text: str
    text_length: int
    sentence_count: int


@dataclass
class PHIScanResult:
    """Result of PHI scan on text."""
    has_phi: bool
    phi_types: List[str] = field(default_factory=list)
    redacted_text: Optional[str] = None
    scan_notes: List[str] = field(default_factory=list)


@dataclass
class CellExtractionResult:
    """Result of extracting a single cell."""
    row_idx: int
    col_name: str
    success: bool
    extraction: Optional[ClinicalExtraction] = None
    response: Optional[ExtractionResponse] = None
    pre_phi_scan: Optional[PHIScanResult] = None
    post_phi_scan: Optional[PHIScanResult] = None
    error: Optional[str] = None
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "row_idx": self.row_idx,
            "col_name": self.col_name,
            "success": self.success,
            "extraction": self.extraction.model_dump() if self.extraction else None,
            "tier_used": self.response.tier_used if self.response else None,
            "cost_usd": self.response.cost_usd if self.response else None,
            "processing_time_ms": self.response.processing_time_ms if self.response else None,
            "pre_phi_detected": self.pre_phi_scan.has_phi if self.pre_phi_scan else False,
            "post_phi_detected": self.post_phi_scan.has_phi if self.post_phi_scan else False,
            "error": self.error,
        }


@dataclass
class BatchExtractionManifest:
    """Manifest of batch extraction results."""
    timestamp: str
    total_cells: int
    successful: int
    failed: int
    phi_blocked: int
    total_cost_usd: float
    total_tokens: Dict[str, int]
    results: List[Dict[str, Any]]
    columns_processed: List[str]
    config: Dict[str, Any]
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "timestamp": self.timestamp,
            "total_cells": self.total_cells,
            "successful": self.successful,
            "failed": self.failed,
            "phi_blocked": self.phi_blocked,
            "total_cost_usd": self.total_cost_usd,
            "total_tokens": self.total_tokens,
            "results": self.results,
            "columns_processed": self.columns_processed,
            "config": self.config,
        }


class PHIScanner:
    """
    PHI scanner wrapper for extraction flow.
    
    Provides pre/post scanning of text for PHI before/after AI extraction.
    Returns locations/hashes only, never raw PHI values.
    """
    
    def __init__(self, include_medium: bool = False, include_low: bool = False):
        """
        Initialize PHI scanner.
        
        Args:
            include_medium: Include medium-severity patterns (dates, ZIP+4)
            include_low: Include low-severity patterns (URLs)
        """
        self.include_medium = include_medium
        self.include_low = include_low
        self._detector = None
    
    def _get_detector(self):
        """Lazy load PHI detector."""
        if self._detector is None:
            try:
                from src.validation.phi_detector import PHIDetector
                self._detector = PHIDetector()
            except ImportError:
                logger.warning("PHIDetector not available, PHI scanning disabled")
                self._detector = False
        return self._detector
    
    def scan_text(self, text: str) -> PHIScanResult:
        """
        Scan text for PHI indicators.
        
        Args:
            text: Text to scan
            
        Returns:
            PHIScanResult with detection info (no raw PHI values)
        """
        detector = self._get_detector()
        if not detector:
            return PHIScanResult(has_phi=False, scan_notes=["PHI scanning unavailable"])
        
        try:
            detections = detector.scan_value(text)
            
            # Filter by severity
            high_severity_types = {"ssn", "mrn", "phone", "email", "license"}
            phi_types = []
            
            for phi_type, _ in detections:
                type_str = phi_type.value if hasattr(phi_type, 'value') else str(phi_type)
                # Check severity (high always included)
                if type_str.lower() in high_severity_types:
                    phi_types.append(type_str)
                elif self.include_medium and type_str.lower() in {"date", "zip", "account"}:
                    phi_types.append(type_str)
                elif self.include_low and type_str.lower() in {"url"}:
                    phi_types.append(type_str)
            
            phi_types = list(set(phi_types))
            has_phi = len(phi_types) > 0
            
            return PHIScanResult(
                has_phi=has_phi,
                phi_types=phi_types,
                scan_notes=[f"detections_count={len(detections)}", f"filtered_types={len(phi_types)}"],
            )
            
        except Exception as e:
            logger.error(f"PHI scan failed: {e}")
            return PHIScanResult(
                has_phi=False,
                scan_notes=[f"scan_error={str(e)[:100]}"],
            )
    
    def scan_dict(self, data: Dict[str, Any]) -> PHIScanResult:
        """
        Scan a dictionary (extraction output) for PHI.
        
        Args:
            data: Dictionary to scan
            
        Returns:
            PHIScanResult
        """
        # Convert to JSON string for scanning
        try:
            text = json.dumps(data, default=str)
            return self.scan_text(text)
        except Exception as e:
            return PHIScanResult(has_phi=False, scan_notes=[f"dict_scan_error={str(e)[:100]}"])


def detect_narrative_columns(
    df: pd.DataFrame,
    min_text_length: int = DEFAULT_MIN_TEXT_LENGTH,
    min_narrative_ratio: float = DEFAULT_MIN_NARRATIVE_RATIO,
) -> List[str]:
    """
    Detect columns likely containing unstructured narrative text.
    
    Args:
        df: Input DataFrame
        min_text_length: Minimum average text length to consider
        min_narrative_ratio: Minimum ratio of cells with long text
    
    Returns:
        List of column names identified as narrative columns
    """
    narrative_cols = []
    
    for col in df.columns:
        if df[col].dtype != object:
            continue
        
        # Check column name patterns
        col_lower = str(col).lower()
        matches_pattern = any(p in col_lower for p in NARRATIVE_COLUMN_PATTERNS)
        
        # Analyze cell content
        text_series = df[col].dropna().astype(str)
        if len(text_series) == 0:
            continue
        
        text_lengths = text_series.str.len()
        avg_length = text_lengths.mean()
        long_text_ratio = (text_lengths > min_text_length).mean()
        
        # Decision logic
        if matches_pattern and avg_length > 50:
            narrative_cols.append(col)
        elif avg_length > min_text_length and long_text_ratio > min_narrative_ratio:
            narrative_cols.append(col)
    
    logger.info(f"Detected {len(narrative_cols)} narrative columns: {narrative_cols}")
    return narrative_cols


def identify_extraction_targets(
    df: pd.DataFrame,
    columns: Optional[List[str]] = None,
    min_text_length: int = DEFAULT_MIN_TEXT_LENGTH,
) -> List[CellTarget]:
    """
    Identify specific cells that should undergo LLM extraction.
    
    Args:
        df: Input DataFrame
        columns: Specific columns to check (None = auto-detect)
        min_text_length: Minimum text length to trigger extraction
    
    Returns:
        List of CellTarget objects identifying cells for extraction
    """
    if columns is None:
        columns = detect_narrative_columns(df)
    
    targets = []
    
    for col in columns:
        if col not in df.columns:
            continue
        
        for idx, value in df[col].items():
            if not isinstance(value, str):
                continue
            
            text_len = len(value)
            if text_len < min_text_length:
                continue
            
            # Count sentences (rough heuristic)
            sentence_count = value.count('.') + value.count('!') + value.count('?')
            
            targets.append(CellTarget(
                row_idx=idx,
                col_name=col,
                text=value,
                text_length=text_len,
                sentence_count=sentence_count,
            ))
    
    logger.info(f"Identified {len(targets)} extraction targets across {len(columns)} columns")
    return targets


async def extract_cell_with_phi_guard(
    target: CellTarget,
    phi_scanner: Optional[PHIScanner] = None,
    metadata: Optional[Dict[str, Any]] = None,
    force_tier: Optional[str] = None,
    enable_nlm_enrichment: bool = False,
    block_on_phi: bool = True,
) -> CellExtractionResult:
    """
    Extract clinical data from a cell with PHI pre/post scanning.
    
    Args:
        target: Cell to extract from
        phi_scanner: Optional PHI scanner instance
        metadata: Additional metadata for extraction
        force_tier: Force specific model tier
        enable_nlm_enrichment: Run MeSH enrichment on results
        block_on_phi: If True, skip extraction when PHI detected in input
    
    Returns:
        CellExtractionResult
    """
    metadata = metadata or {}
    metadata.update({
        "row_idx": target.row_idx,
        "col_name": target.col_name,
        "text_length": target.text_length,
    })
    
    # Pre-scan for PHI
    pre_scan = None
    if phi_scanner:
        pre_scan = phi_scanner.scan_text(target.text)
        if pre_scan.has_phi and block_on_phi:
            logger.warning(f"PHI detected in cell [{target.row_idx}][{target.col_name}], skipping extraction")
            return CellExtractionResult(
                row_idx=target.row_idx,
                col_name=target.col_name,
                success=False,
                pre_phi_scan=pre_scan,
                error="PHI detected in input, extraction blocked",
            )
    
    # Perform extraction
    try:
        response = await extract_clinical_from_cell(
            cell_text=target.text,
            metadata=metadata,
            force_tier=force_tier,
        )
        extraction = response.extraction
        
        # Post-scan extraction output for PHI leakage
        post_scan = None
        if phi_scanner and extraction:
            post_scan = phi_scanner.scan_dict(extraction.model_dump())
            if post_scan.has_phi:
                logger.warning(f"PHI detected in extraction output for [{target.row_idx}][{target.col_name}]")
                extraction.warnings.append("PHI detected in output - review required")
        
        # Optional NLM enrichment
        if enable_nlm_enrichment and extraction:
            try:
                enriched = await enrich_extraction(
                    extraction.model_dump(),
                    request_id=response.request_id,
                )
                extraction = ClinicalExtraction.model_validate(enriched)
            except Exception as e:
                logger.warning(f"NLM enrichment failed: {e}")
                extraction.warnings.append(f"NLM enrichment failed: {str(e)[:50]}")
        
        return CellExtractionResult(
            row_idx=target.row_idx,
            col_name=target.col_name,
            success=True,
            extraction=extraction,
            response=response,
            pre_phi_scan=pre_scan,
            post_phi_scan=post_scan,
        )
        
    except ExtractionError as e:
        logger.error(f"Extraction failed for [{target.row_idx}][{target.col_name}]: {e}")
        return CellExtractionResult(
            row_idx=target.row_idx,
            col_name=target.col_name,
            success=False,
            pre_phi_scan=pre_scan,
            error=str(e),
        )
    except Exception as e:
        logger.error(f"Unexpected error extracting [{target.row_idx}][{target.col_name}]: {e}")
        return CellExtractionResult(
            row_idx=target.row_idx,
            col_name=target.col_name,
            success=False,
            pre_phi_scan=pre_scan,
            error=f"Unexpected: {str(e)[:100]}",
        )


async def parse_block_text(
    df: pd.DataFrame,
    columns: Optional[List[str]] = None,
    min_text_length: int = DEFAULT_MIN_TEXT_LENGTH,
    max_concurrent: int = DEFAULT_MAX_CONCURRENT,
    enable_phi_scanning: bool = True,
    block_on_phi: bool = True,
    enable_nlm_enrichment: bool = False,
    force_tier: Optional[str] = None,
    metadata: Optional[Dict[str, Any]] = None,
) -> Tuple[pd.DataFrame, BatchExtractionManifest]:
    """
    Parse all narrative text cells in a DataFrame using LLM extraction.
    
    This is the main entry point for batch extraction from DataFrames.
    
    Args:
        df: Input DataFrame
        columns: Specific columns (None = auto-detect)
        min_text_length: Minimum text length for extraction
        max_concurrent: Maximum concurrent API calls
        enable_phi_scanning: Enable PHI pre/post scanning
        block_on_phi: Block extraction when PHI detected
        enable_nlm_enrichment: Enable MeSH term enrichment
        force_tier: Force specific model tier
        metadata: Additional metadata for all extractions
    
    Returns:
        Tuple of (modified DataFrame, extraction manifest)
    """
    metadata = metadata or {}
    timestamp = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
    
    # Identify targets
    targets = identify_extraction_targets(df, columns, min_text_length)
    
    if not targets:
        logger.info("No extraction targets found")
        return df, BatchExtractionManifest(
            timestamp=timestamp,
            total_cells=0,
            successful=0,
            failed=0,
            phi_blocked=0,
            total_cost_usd=0.0,
            total_tokens={"input": 0, "output": 0},
            results=[],
            columns_processed=columns or [],
            config={
                "min_text_length": min_text_length,
                "enable_phi_scanning": enable_phi_scanning,
                "enable_nlm_enrichment": enable_nlm_enrichment,
            },
        )
    
    # Initialize PHI scanner
    phi_scanner = PHIScanner() if enable_phi_scanning else None
    
    # Create semaphore for rate limiting
    semaphore = asyncio.Semaphore(max_concurrent)
    
    async def process_cell(target: CellTarget) -> CellExtractionResult:
        async with semaphore:
            return await extract_cell_with_phi_guard(
                target=target,
                phi_scanner=phi_scanner,
                metadata=metadata,
                force_tier=force_tier,
                enable_nlm_enrichment=enable_nlm_enrichment,
                block_on_phi=block_on_phi,
            )
    
    # Process all targets concurrently
    logger.info(f"Starting batch extraction of {len(targets)} cells with concurrency={max_concurrent}")
    tasks = [process_cell(t) for t in targets]
    results = await asyncio.gather(*tasks, return_exceptions=True)
    
    # Build manifest and update DataFrame
    df_result = df.copy()
    extraction_results = []
    successful = 0
    failed = 0
    phi_blocked = 0
    total_cost = 0.0
    total_tokens = {"input": 0, "output": 0}
    columns_with_extractions = set()
    
    for result in results:
        if isinstance(result, Exception):
            failed += 1
            extraction_results.append({
                "success": False,
                "error": str(result)[:200],
            })
            continue
        
        extraction_results.append(result.to_dict())
        
        if result.success:
            successful += 1
            columns_with_extractions.add(result.col_name)
            
            # Add extraction to DataFrame
            extracted_col = f"{result.col_name}_extracted"
            if extracted_col not in df_result.columns:
                df_result[extracted_col] = None
            
            df_result.at[result.row_idx, extracted_col] = result.extraction.model_dump() if result.extraction else None
            
            # Accumulate costs
            if result.response:
                total_cost += result.response.cost_usd
                total_tokens["input"] += result.response.tokens.get("input", 0)
                total_tokens["output"] += result.response.tokens.get("output", 0)
        else:
            if result.error and "PHI detected" in result.error:
                phi_blocked += 1
            else:
                failed += 1
    
    manifest = BatchExtractionManifest(
        timestamp=timestamp,
        total_cells=len(targets),
        successful=successful,
        failed=failed,
        phi_blocked=phi_blocked,
        total_cost_usd=total_cost,
        total_tokens=total_tokens,
        results=extraction_results,
        columns_processed=list(columns_with_extractions),
        config={
            "min_text_length": min_text_length,
            "max_concurrent": max_concurrent,
            "enable_phi_scanning": enable_phi_scanning,
            "block_on_phi": block_on_phi,
            "enable_nlm_enrichment": enable_nlm_enrichment,
            "force_tier": force_tier,
        },
    )
    
    logger.info(
        f"Batch extraction complete: {successful} successful, {failed} failed, "
        f"{phi_blocked} PHI-blocked, cost=${total_cost:.4f}"
    )
    
    return df_result, manifest


def parse_block_text_sync(
    df: pd.DataFrame,
    **kwargs,
) -> Tuple[pd.DataFrame, BatchExtractionManifest]:
    """
    Synchronous wrapper for parse_block_text.
    
    Args:
        df: Input DataFrame
        **kwargs: Arguments passed to parse_block_text
    
    Returns:
        Tuple of (modified DataFrame, extraction manifest)
    """
    return asyncio.run(parse_block_text(df, **kwargs))


# Convenience exports
__all__ = [
    "detect_narrative_columns",
    "identify_extraction_targets",
    "parse_block_text",
    "parse_block_text_sync",
    "extract_cell_with_phi_guard",
    "CellTarget",
    "CellExtractionResult",
    "BatchExtractionManifest",
    "PHIScanner",
    "PHIScanResult",
]
