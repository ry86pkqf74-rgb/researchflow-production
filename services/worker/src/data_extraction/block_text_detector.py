"""
Block Text Detector Module - Heuristic detection of clinical narrative cells.

This module provides efficient detection of cells containing unstructured
clinical narrative text that should be processed by LLM extraction.

Key Features:
- Configurable heuristics (min_chars, min_newlines, clinical markers)
- Column allow/deny lists for fast filtering
- Pre-segmentation by clinical headings
- Content hashing for deduplication

Design Principles:
- Fast heuristics before expensive operations
- No PHI in logs or cache keys
- Deterministic results for same input
"""

import re
import hashlib
import logging
from dataclasses import dataclass, field
from typing import Optional, List, Dict, Any, Set, Tuple
from enum import Enum
import pandas as pd

from .config import BlockTextConfig, get_config

logger = logging.getLogger(__name__)


class CellClassification(str, Enum):
    """Classification of cell content type."""
    BLOCK_TEXT = "block_text"  # Narrative clinical text
    SHORT_TEXT = "short_text"  # Too short for extraction
    NUMERIC = "numeric"  # Mostly numbers
    CODE_LIST = "code_list"  # Looks like coded values
    IDENTIFIER = "identifier"  # PHI-risk identifier column
    EXCLUDED = "excluded"  # Explicitly excluded
    EMPTY = "empty"  # No content


@dataclass
class CellDetection:
    """Result of detecting block text in a cell."""
    row_idx: int
    col_name: str
    classification: CellClassification
    text: str
    text_length: int
    newline_count: int
    alpha_ratio: float
    clinical_markers_found: List[str]
    heading_sections: Dict[str, str]  # Pre-segmented sections
    content_hash: str  # For deduplication
    should_extract: bool
    skip_reason: Optional[str] = None
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "row_idx": self.row_idx,
            "col_name": self.col_name,
            "classification": self.classification.value,
            "text_length": self.text_length,
            "newline_count": self.newline_count,
            "alpha_ratio": self.alpha_ratio,
            "clinical_markers_found": self.clinical_markers_found,
            "heading_sections": list(self.heading_sections.keys()),
            "content_hash": self.content_hash,
            "should_extract": self.should_extract,
            "skip_reason": self.skip_reason,
        }


@dataclass
class ColumnProfile:
    """Profile of a column for block text detection."""
    name: str
    is_allowed: bool
    is_denied: bool
    total_cells: int
    non_empty_cells: int
    block_text_cells: int
    avg_length: float
    max_length: int
    block_text_ratio: float
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "name": self.name,
            "is_allowed": self.is_allowed,
            "is_denied": self.is_denied,
            "total_cells": self.total_cells,
            "non_empty_cells": self.non_empty_cells,
            "block_text_cells": self.block_text_cells,
            "avg_length": self.avg_length,
            "max_length": self.max_length,
            "block_text_ratio": self.block_text_ratio,
        }


def compute_content_hash(text: str) -> str:
    """
    Compute a hash of text content for deduplication.
    
    Uses first 12 chars of SHA256 - sufficient for dedup without
    storing full content hashes.
    """
    normalized = text.strip().lower()
    return hashlib.sha256(normalized.encode()).hexdigest()[:12]


def compute_alpha_ratio(text: str) -> float:
    """Compute ratio of alphabetic characters to total characters."""
    if not text:
        return 0.0
    alpha_count = sum(1 for c in text if c.isalpha())
    return alpha_count / len(text)


def find_clinical_markers(
    text: str,
    marker_tokens: List[str],
) -> List[str]:
    """
    Find clinical marker tokens in text.
    
    Args:
        text: Text to search
        marker_tokens: List of tokens to look for
        
    Returns:
        List of markers found (case-preserved from config)
    """
    text_lower = text.lower()
    found = []
    
    for token in marker_tokens:
        # Use word boundaries for accurate matching
        pattern = rf"\b{re.escape(token.lower())}\b"
        if re.search(pattern, text_lower):
            found.append(token)
    
    return found


def segment_by_headings(
    text: str,
    heading_regex: str,
) -> Dict[str, str]:
    """
    Pre-segment text by clinical section headings.
    
    Args:
        text: Text to segment
        heading_regex: Regex pattern for headings
        
    Returns:
        Dict mapping heading name to section content
    """
    sections = {}
    
    # Find all heading matches with positions
    pattern = re.compile(heading_regex)
    matches = list(pattern.finditer(text))
    
    if not matches:
        return {"_full": text}
    
    for i, match in enumerate(matches):
        heading = match.group().upper()
        start = match.end()
        
        # Find end of section (next heading or end of text)
        if i + 1 < len(matches):
            end = matches[i + 1].start()
        else:
            end = len(text)
        
        # Extract and clean section content
        content = text[start:end].strip()
        
        # Remove common delimiters after heading
        content = re.sub(r"^[:;\-]\s*", "", content)
        
        if content:
            sections[heading] = content
    
    return sections


class BlockTextDetector:
    """
    Detector for identifying clinical narrative text cells.
    
    Example:
        detector = BlockTextDetector()
        
        # Check single cell
        detection = detector.detect_cell(text, row_idx=0, col_name="notes")
        if detection.should_extract:
            process(detection)
        
        # Profile entire column
        profile = detector.profile_column(df["notes"])
    """
    
    def __init__(self, config: Optional[BlockTextConfig] = None):
        """
        Initialize detector with configuration.
        
        Args:
            config: BlockTextConfig instance. Uses global config if None.
        """
        self.config = config or get_config().block_text
        
        # Pre-compile regex
        self._heading_pattern = re.compile(self.config.clinical_heading_regex)
        
        # Normalize column lists for fast lookup
        self._allow_columns = {c.lower() for c in self.config.allow_columns}
        self._deny_columns = {c.lower() for c in self.config.deny_columns}
        
        # Cache for content hashes (deduplication)
        self._seen_hashes: Set[str] = set()
    
    def is_column_allowed(self, col_name: str) -> bool:
        """Check if column is in allow list."""
        return col_name.lower() in self._allow_columns
    
    def is_column_denied(self, col_name: str) -> bool:
        """Check if column is in deny list."""
        return col_name.lower() in self._deny_columns
    
    def clear_dedup_cache(self):
        """Clear the deduplication cache."""
        self._seen_hashes.clear()
    
    def detect_cell(
        self,
        text: Any,
        row_idx: int,
        col_name: str,
        check_dedup: bool = True,
    ) -> CellDetection:
        """
        Detect if a cell contains block text suitable for extraction.
        
        Args:
            text: Cell content
            row_idx: Row index
            col_name: Column name
            check_dedup: Check for duplicate content
            
        Returns:
            CellDetection result
        """
        # Handle non-string or empty
        if text is None or (isinstance(text, float) and pd.isna(text)):
            return CellDetection(
                row_idx=row_idx,
                col_name=col_name,
                classification=CellClassification.EMPTY,
                text="",
                text_length=0,
                newline_count=0,
                alpha_ratio=0.0,
                clinical_markers_found=[],
                heading_sections={},
                content_hash="",
                should_extract=False,
                skip_reason="empty_cell",
            )
        
        # Convert to string
        text_str = str(text).strip()
        
        if not text_str:
            return CellDetection(
                row_idx=row_idx,
                col_name=col_name,
                classification=CellClassification.EMPTY,
                text="",
                text_length=0,
                newline_count=0,
                alpha_ratio=0.0,
                clinical_markers_found=[],
                heading_sections={},
                content_hash="",
                should_extract=False,
                skip_reason="empty_after_strip",
            )
        
        # Quick column-level checks
        if self.is_column_denied(col_name):
            return CellDetection(
                row_idx=row_idx,
                col_name=col_name,
                classification=CellClassification.EXCLUDED,
                text=text_str,
                text_length=len(text_str),
                newline_count=0,
                alpha_ratio=0.0,
                clinical_markers_found=[],
                heading_sections={},
                content_hash="",
                should_extract=False,
                skip_reason="column_denied",
            )
        
        # Compute metrics
        text_length = len(text_str)
        newline_count = text_str.count("\n")
        alpha_ratio = compute_alpha_ratio(text_str)
        content_hash = compute_content_hash(text_str)
        
        # Check for duplicate
        if check_dedup and content_hash in self._seen_hashes:
            return CellDetection(
                row_idx=row_idx,
                col_name=col_name,
                classification=CellClassification.BLOCK_TEXT,
                text=text_str,
                text_length=text_length,
                newline_count=newline_count,
                alpha_ratio=alpha_ratio,
                clinical_markers_found=[],
                heading_sections={},
                content_hash=content_hash,
                should_extract=False,
                skip_reason="duplicate_content",
            )
        
        # Check alpha ratio (exclude mostly numeric)
        if alpha_ratio < self.config.min_alpha_ratio:
            return CellDetection(
                row_idx=row_idx,
                col_name=col_name,
                classification=CellClassification.NUMERIC,
                text=text_str,
                text_length=text_length,
                newline_count=newline_count,
                alpha_ratio=alpha_ratio,
                clinical_markers_found=[],
                heading_sections={},
                content_hash=content_hash,
                should_extract=False,
                skip_reason=f"low_alpha_ratio_{alpha_ratio:.2f}",
            )
        
        # Find clinical markers
        clinical_markers = find_clinical_markers(
            text_str,
            self.config.clinical_marker_tokens,
        )
        
        # Pre-segment by headings
        heading_sections = segment_by_headings(
            text_str,
            self.config.clinical_heading_regex,
        )
        
        # Decision logic
        should_extract = False
        classification = CellClassification.SHORT_TEXT
        skip_reason = None
        
        # Allowed columns always extract if not empty
        if self.is_column_allowed(col_name):
            should_extract = True
            classification = CellClassification.BLOCK_TEXT
            
        # Length threshold
        elif text_length >= self.config.min_chars:
            should_extract = True
            classification = CellClassification.BLOCK_TEXT
            
        # Newline threshold
        elif newline_count >= self.config.min_newlines:
            should_extract = True
            classification = CellClassification.BLOCK_TEXT
            
        # Clinical marker threshold
        elif len(clinical_markers) >= self.config.min_clinical_markers:
            should_extract = True
            classification = CellClassification.BLOCK_TEXT
            
        else:
            skip_reason = f"below_thresholds_len={text_length}_nl={newline_count}_markers={len(clinical_markers)}"
        
        # Update dedup cache
        if should_extract and check_dedup:
            self._seen_hashes.add(content_hash)
        
        return CellDetection(
            row_idx=row_idx,
            col_name=col_name,
            classification=classification,
            text=text_str,
            text_length=text_length,
            newline_count=newline_count,
            alpha_ratio=alpha_ratio,
            clinical_markers_found=clinical_markers,
            heading_sections=heading_sections,
            content_hash=content_hash,
            should_extract=should_extract,
            skip_reason=skip_reason,
        )
    
    def detect_dataframe(
        self,
        df: pd.DataFrame,
        columns: Optional[List[str]] = None,
        check_dedup: bool = True,
    ) -> List[CellDetection]:
        """
        Detect block text cells in a DataFrame.
        
        Args:
            df: Input DataFrame
            columns: Columns to check (None = auto-detect)
            check_dedup: Enable deduplication
            
        Returns:
            List of CellDetection for cells that should be extracted
        """
        detections = []
        
        # Determine columns to process
        if columns is None:
            # Auto-detect: allowed columns + string columns
            cols_to_check = []
            for col in df.columns:
                if self.is_column_denied(col):
                    continue
                if self.is_column_allowed(col):
                    cols_to_check.append(col)
                elif df[col].dtype == object:
                    cols_to_check.append(col)
        else:
            cols_to_check = [c for c in columns if c in df.columns]
        
        # Process each cell
        for col in cols_to_check:
            for idx, value in df[col].items():
                detection = self.detect_cell(
                    text=value,
                    row_idx=idx,
                    col_name=col,
                    check_dedup=check_dedup,
                )
                if detection.should_extract:
                    detections.append(detection)
        
        logger.info(
            f"Detected {len(detections)} block text cells from "
            f"{len(cols_to_check)} columns in {len(df)} rows"
        )
        
        return detections
    
    def profile_column(
        self,
        series: pd.Series,
        col_name: Optional[str] = None,
    ) -> ColumnProfile:
        """
        Profile a column for block text detection statistics.
        
        Args:
            series: Column data
            col_name: Column name
            
        Returns:
            ColumnProfile with statistics
        """
        name = col_name or series.name or "unknown"
        
        # Count non-empty
        non_empty = series.dropna().astype(str).str.strip()
        non_empty = non_empty[non_empty != ""]
        
        if len(non_empty) == 0:
            return ColumnProfile(
                name=name,
                is_allowed=self.is_column_allowed(name),
                is_denied=self.is_column_denied(name),
                total_cells=len(series),
                non_empty_cells=0,
                block_text_cells=0,
                avg_length=0.0,
                max_length=0,
                block_text_ratio=0.0,
            )
        
        # Count block text cells
        lengths = non_empty.str.len()
        block_text_count = sum(
            1 for val in non_empty
            if len(val) >= self.config.min_chars
            or val.count("\n") >= self.config.min_newlines
        )
        
        return ColumnProfile(
            name=name,
            is_allowed=self.is_column_allowed(name),
            is_denied=self.is_column_denied(name),
            total_cells=len(series),
            non_empty_cells=len(non_empty),
            block_text_cells=block_text_count,
            avg_length=lengths.mean(),
            max_length=lengths.max(),
            block_text_ratio=block_text_count / len(non_empty) if len(non_empty) > 0 else 0.0,
        )


__all__ = [
    "CellClassification",
    "CellDetection",
    "ColumnProfile",
    "BlockTextDetector",
    "compute_content_hash",
    "compute_alpha_ratio",
    "find_clinical_markers",
    "segment_by_headings",
]
