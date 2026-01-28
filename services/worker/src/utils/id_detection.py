"""
ID Column Detection Utility

Detects candidate linking columns across multiple DataFrames using:
- Fuzzy matching on column names (fuzzywuzzy)
- Uniqueness ratio calculation
- Overlap analysis across DataFrames
- Pattern matching for common ID column names

Part of the multi-file ingestion feature.
"""
import re
from typing import List, Dict, Tuple, Optional, Any
from dataclasses import dataclass
import pandas as pd
import logging

logger = logging.getLogger(__name__)

try:
    from fuzzywuzzy import fuzz, process
    FUZZY_AVAILABLE = True
except ImportError:
    FUZZY_AVAILABLE = False
    logger.warning("fuzzywuzzy not available - fuzzy matching disabled")


# Common ID column name patterns (case-insensitive regex)
ID_PATTERNS = [
    r'.*_id$', r'^id_.*', r'.*id$', r'^id$',
    r'.*_key$', r'^key_.*', r'.*key$',
    r'research.*id', r'study.*id', r'patient.*id', r'subject.*id',
    r'record.*id', r'case.*id', r'participant.*id', r'sample.*id',
    r'mrn', r'medical.*record', r'chart.*number',
    r'enrollment.*id', r'screening.*id', r'visit.*id',
]

# Columns to exclude from ID detection (timestamp, description fields)
EXCLUDE_PATTERNS = [
    r'created_at', r'updated_at', r'modified_at', r'timestamp',
    r'description', r'notes', r'comment', r'remarks',
    r'.*_date$', r'.*_time$',
]


@dataclass
class IDCandidate:
    """Represents a candidate ID column with scoring metrics."""
    column_name: str
    uniqueness_ratio: float      # 0-1, higher = more unique values
    overlap_ratio: float         # 0-1, higher = more overlap across DataFrames
    pattern_score: float         # 0-1, higher = matches ID patterns better
    combined_score: float        # Weighted combination of all scores
    source_files: List[str]      # Files/sheets containing this column
    sample_values: List[str]     # Sample values for user review

    def to_dict(self) -> Dict[str, Any]:
        return {
            'column_name': self.column_name,
            'uniqueness_ratio': round(self.uniqueness_ratio, 3),
            'overlap_ratio': round(self.overlap_ratio, 3),
            'pattern_score': round(self.pattern_score, 3),
            'combined_score': round(self.combined_score, 3),
            'source_files': self.source_files,
            'sample_values': self.sample_values[:5],  # Limit to 5 samples
        }


def calculate_uniqueness_ratio(series: pd.Series) -> float:
    """
    Calculate the ratio of unique values to total values.
    Higher ratio indicates better ID candidate.

    Args:
        series: Pandas Series to analyze

    Returns:
        Float between 0 and 1
    """
    if len(series) == 0:
        return 0.0

    # Drop NA values for uniqueness calculation
    non_null = series.dropna()
    if len(non_null) == 0:
        return 0.0

    return len(non_null.unique()) / len(non_null)


def calculate_overlap_ratio(
    dfs: List[pd.DataFrame],
    column_name: str,
    fuzzy_threshold: int = 85
) -> float:
    """
    Calculate overlap ratio of values across DataFrames.
    Uses fuzzy matching on column names to find equivalent columns.

    Args:
        dfs: List of DataFrames to analyze
        column_name: Target column name
        fuzzy_threshold: Threshold for fuzzy column name matching

    Returns:
        Float between 0 and 1 (intersection over union)
    """
    all_values = []

    for df in dfs:
        # Find matching column (exact or fuzzy)
        matching_col = find_matching_column(df.columns.tolist(), column_name, fuzzy_threshold)
        if matching_col:
            values = set(df[matching_col].dropna().astype(str).unique())
            all_values.append(values)

    if len(all_values) < 2:
        return 0.0

    # Calculate intersection over union (Jaccard similarity)
    intersection = all_values[0]
    union = all_values[0]

    for values in all_values[1:]:
        intersection = intersection.intersection(values)
        union = union.union(values)

    if len(union) == 0:
        return 0.0

    return len(intersection) / len(union)


def find_matching_column(
    columns: List[str],
    target: str,
    threshold: int = 85
) -> Optional[str]:
    """
    Find a column matching the target name using fuzzy matching.

    Args:
        columns: List of column names to search
        target: Target column name to match
        threshold: Minimum fuzzy match score (0-100)

    Returns:
        Matching column name or None
    """
    # Try exact match first (case-insensitive)
    for col in columns:
        if col.lower() == target.lower():
            return col

    # Try fuzzy match if available
    if FUZZY_AVAILABLE:
        matches = process.extractBests(target, columns, score_cutoff=threshold)
        if matches:
            return matches[0][0]

    return None


def calculate_pattern_score(column_name: str) -> float:
    """
    Score how well a column name matches common ID patterns.

    Args:
        column_name: Column name to score

    Returns:
        Float between 0 and 1
    """
    col_lower = column_name.lower()

    # Check exclusions first - return 0 if matches exclude pattern
    for pattern in EXCLUDE_PATTERNS:
        if re.match(pattern, col_lower):
            return 0.0

    # Check ID patterns
    max_score = 0.0
    for pattern in ID_PATTERNS:
        if re.match(pattern, col_lower):
            max_score = max(max_score, 1.0)  # Full match at start
        elif re.search(pattern, col_lower):
            max_score = max(max_score, 0.7)  # Partial match

    # Bonus for short names (IDs tend to be concise)
    if len(column_name) <= 20:
        max_score = min(1.0, max_score + 0.1)

    # Bonus for containing 'id' anywhere
    if 'id' in col_lower:
        max_score = min(1.0, max_score + 0.15)

    return max_score


def get_sample_values(
    dataframes: Dict[str, pd.DataFrame],
    column_name: str,
    max_samples: int = 5,
    fuzzy_threshold: int = 85
) -> List[str]:
    """
    Get sample values from a column across DataFrames.

    Args:
        dataframes: Dict mapping filename to DataFrame
        column_name: Column to sample from
        max_samples: Maximum number of samples to return
        fuzzy_threshold: Threshold for fuzzy column matching

    Returns:
        List of sample value strings
    """
    samples = set()

    for df in dataframes.values():
        matching_col = find_matching_column(df.columns.tolist(), column_name, fuzzy_threshold)
        if matching_col:
            col_samples = df[matching_col].dropna().astype(str).unique()[:max_samples]
            samples.update(col_samples)
            if len(samples) >= max_samples:
                break

    return list(samples)[:max_samples]


def detect_id_candidates(
    dataframes: Dict[str, pd.DataFrame],
    min_uniqueness: float = 0.5,
    min_overlap: float = 0.1,
    fuzzy_threshold: int = 85,
    max_candidates: int = 5
) -> List[IDCandidate]:
    """
    Detect candidate ID columns across multiple DataFrames.

    This is the main entry point for ID detection. It analyzes all columns
    across all DataFrames and returns ranked candidates based on:
    - Uniqueness ratio (how many unique values)
    - Overlap ratio (how much value overlap across DataFrames)
    - Pattern score (how well name matches common ID patterns)

    Args:
        dataframes: Dict mapping filename/sheet name to DataFrame
        min_uniqueness: Minimum uniqueness ratio to consider (0-1)
        min_overlap: Minimum overlap ratio across DataFrames (0-1)
        fuzzy_threshold: Threshold for fuzzy column name matching (0-100)
        max_candidates: Maximum number of candidates to return

    Returns:
        List of IDCandidate objects, sorted by combined score (descending)
    """
    if not dataframes:
        return []

    df_list = list(dataframes.values())
    filenames = list(dataframes.keys())

    # Collect all unique column names across DataFrames
    all_columns = set()
    column_sources: Dict[str, List[str]] = {}

    for filename, df in dataframes.items():
        for col in df.columns:
            all_columns.add(col)
            col_key = col.lower()
            if col_key not in column_sources:
                column_sources[col_key] = []
            column_sources[col_key].append(filename)

    # Analyze each column
    candidates = []

    for col in all_columns:
        col_lower = col.lower()

        # Get source files for this column
        sources = column_sources.get(col_lower, [])

        # For multi-file scenarios, check for fuzzy matches in other files
        if len(sources) < len(dataframes) and len(dataframes) > 1:
            for filename, df in dataframes.items():
                if filename not in sources:
                    match = find_matching_column(df.columns.tolist(), col, fuzzy_threshold)
                    if match:
                        sources.append(filename)

        # Calculate uniqueness (use max across DataFrames)
        uniqueness = 0.0
        for df in df_list:
            match = find_matching_column(df.columns.tolist(), col, fuzzy_threshold)
            if match:
                uniqueness = max(uniqueness, calculate_uniqueness_ratio(df[match]))

        # Skip columns with low uniqueness
        if uniqueness < min_uniqueness:
            continue

        # Calculate overlap if multiple DataFrames
        overlap = 0.0
        if len(df_list) > 1:
            overlap = calculate_overlap_ratio(df_list, col, fuzzy_threshold)
            # Skip columns with low overlap (unless single file)
            if overlap < min_overlap:
                continue
        else:
            overlap = 1.0  # Single DataFrame, max overlap by default

        # Calculate pattern score
        pattern_score = calculate_pattern_score(col)

        # Calculate combined score (weighted)
        combined = (
            0.35 * uniqueness +
            0.35 * overlap +
            0.30 * pattern_score
        )

        # Get sample values
        samples = get_sample_values(dataframes, col, fuzzy_threshold=fuzzy_threshold)

        candidates.append(IDCandidate(
            column_name=col,
            uniqueness_ratio=uniqueness,
            overlap_ratio=overlap,
            pattern_score=pattern_score,
            combined_score=combined,
            source_files=sources,
            sample_values=samples,
        ))

    # Sort by combined score (descending) and return top candidates
    candidates.sort(key=lambda c: c.combined_score, reverse=True)
    return candidates[:max_candidates]


def validate_id_column(
    dataframes: Dict[str, pd.DataFrame],
    id_column: str,
    fuzzy_threshold: int = 85
) -> Tuple[bool, Optional[str]]:
    """
    Validate that an ID column exists in all DataFrames.

    Args:
        dataframes: Dict mapping filename to DataFrame
        id_column: ID column name to validate
        fuzzy_threshold: Threshold for fuzzy matching

    Returns:
        Tuple of (is_valid, error_message)
    """
    missing_files = []

    for filename, df in dataframes.items():
        match = find_matching_column(df.columns.tolist(), id_column, fuzzy_threshold)
        if not match:
            missing_files.append(filename)

    if missing_files:
        return False, f"ID column '{id_column}' not found in: {', '.join(missing_files)}"

    return True, None


def format_confirmation_prompt(candidates: List[IDCandidate]) -> str:
    """
    Format a user-friendly confirmation prompt for ID column selection.

    Args:
        candidates: List of ID candidates to display

    Returns:
        Formatted string for user confirmation
    """
    if not candidates:
        return "No candidate ID columns detected. Please specify the linking column manually."

    lines = [
        "Detected potential ID columns for linking:",
        "",
    ]

    for i, c in enumerate(candidates, 1):
        lines.append(f"{i}. **{c.column_name}** (Score: {c.combined_score:.2f})")
        lines.append(f"   - Uniqueness: {c.uniqueness_ratio:.1%}")
        lines.append(f"   - Overlap: {c.overlap_ratio:.1%}")
        lines.append(f"   - Sources: {', '.join(c.source_files[:3])}")
        if c.sample_values:
            lines.append(f"   - Samples: {', '.join(c.sample_values[:3])}")
        lines.append("")

    lines.append("Please confirm the ID column to use for merging.")
    lines.append("Type 'yes' to use the top candidate, or specify a column name.")

    return "\n".join(lines)
