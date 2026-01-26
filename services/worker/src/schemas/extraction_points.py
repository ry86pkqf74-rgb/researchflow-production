"""
Extraction Points Schema

Pydantic models for defining data extraction points in research workflow.
Extraction points guide what data to extract from datasets for analysis.

Governance:
- NO PHI content in descriptions or hints
- Immutable once generated (frozen=True for ExtractionPoint)
- Versioned schema for evolution tracking

Related:
- web_frontend/workflow/state.py (state key: workflow_extraction_points)
- web_frontend/pages/workflow/1_📋_Topic.py (definition UI - future)
- src/analysis/gap_analysis.py (gap analysis integration - future)
"""

from datetime import datetime, timezone
from enum import Enum
from typing import Any, List, Optional
import re

from pydantic import BaseModel, Field, field_validator, ConfigDict


class DataType(str, Enum):
    """
    Data type classification for extraction points.

    Categorizes the expected type of data to be extracted from datasets.
    """

    CATEGORICAL = "categorical"  # Discrete categories (e.g., TIRADS TR1-TR5)
    NUMERIC_CONTINUOUS = "numeric_continuous"  # Continuous numbers (age, size)
    NUMERIC_DISCRETE = "numeric_discrete"  # Discrete counts (nodule count)
    TEMPORAL = "temporal"  # Dates/timestamps
    TEXT = "text"  # Free text descriptions
    BINARY = "binary"  # Boolean yes/no
    IDENTIFIER = "identifier"  # IDs/keys (e.g., study_id, sample_id)
    MIXED = "mixed"  # Multiple types or complex structure
    UNKNOWN = "unknown"  # Type not yet determined


class ExtractionPoint(BaseModel):
    """
    Individual data extraction point definition.

    Represents a specific piece of data that should be extracted from a dataset
    for research analysis. Extraction points guide data validation, gap analysis,
    and manuscript generation.

    Attributes:
        id: Unique identifier for this extraction point (e.g., "ep_001")
        name: Short, human-readable name/title
        description: Detailed description of what data to extract
        data_type: Type of data expected (categorical, numeric, etc.)
        required: Whether this extraction point is mandatory for the analysis
        source_hint: Optional hint about where to find this in the dataset
                    (e.g., "column: tirads_score", "table: imaging_data")
        tags: Categorization tags for filtering and grouping
        related_literature_ids: IDs of literature references that motivate
                               this extraction point
        validation_notes: Optional notes about expected format, range, or
                         validation rules
        created_at: UTC timestamp when this point was defined (ISO 8601)

    Example:
        >>> point = ExtractionPoint(
        ...     id="ep_001",
        ...     name="TIRADS Classification",
        ...     description="ACR TI-RADS category (TR1-TR5) for thyroid nodules",
        ...     data_type=DataType.CATEGORICAL,
        ...     required=True,
        ...     tags=["imaging", "classification"],
        ...     related_literature_ids=["synth_001"]
        ... )
    """

    id: str = Field(..., description="Unique identifier (e.g., 'ep_001')")
    name: str = Field(..., description="Short name/title")
    description: str = Field(..., description="Detailed description of what to extract")
    data_type: DataType = Field(
        default=DataType.UNKNOWN,
        description="Expected data type"
    )
    required: bool = Field(
        default=True,
        description="Whether this extraction point is mandatory"
    )
    source_hint: Optional[str] = Field(
        default=None,
        description="Optional hint about location in dataset"
    )
    tags: List[str] = Field(
        default_factory=list,
        description="Categorization tags"
    )
    related_literature_ids: List[str] = Field(
        default_factory=list,
        description="Literature references motivating this point"
    )
    validation_notes: Optional[str] = Field(
        default=None,
        description="Expected format/range notes"
    )
    created_at: str = Field(
        default_factory=lambda: datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        description="UTC timestamp of creation (ISO 8601)"
    )

    @field_validator("id", "name", "description")
    @classmethod
    def validate_non_empty_string(cls, v: str) -> str:
        """Ensure critical string fields are non-empty after stripping whitespace."""
        if not v or not v.strip():
            raise ValueError("Field must be non-empty")
        return v.strip()

    @field_validator("tags")
    @classmethod
    def validate_tags(cls, v: List[str]) -> List[str]:
        """
        Normalize and validate tags.

        Tags are converted to lowercase and filtered to only allow alphanumeric
        characters and hyphens. Empty tags are removed.
        """
        normalized = []
        for tag in v:
            tag_clean = tag.strip().lower()
            # Only allow alphanumeric + hyphens
            if tag_clean and re.match(r'^[a-z0-9-]+$', tag_clean):
                normalized.append(tag_clean)
        return normalized

    @field_validator("related_literature_ids")
    @classmethod
    def deduplicate_literature_ids(cls, v: List[str]) -> List[str]:
        """Deduplicate and validate literature IDs, preserving order."""
        seen = set()
        unique = []
        for lit_id in v:
            lit_id_clean = lit_id.strip()
            if lit_id_clean and lit_id_clean not in seen:
                unique.append(lit_id_clean)
                seen.add(lit_id_clean)
        return unique

    @field_validator("source_hint", "validation_notes", "description")
    @classmethod
    def check_no_phi_patterns(cls, v: Optional[str]) -> Optional[str]:
        """
        Basic check for potential PHI content in text fields.

        This is a defensive safeguard, not comprehensive PHI detection.
        Real PHI protection happens at data ingestion boundaries.
        """
        if v is None:
            return v

        # Warning patterns for obvious PHI references
        phi_patterns = {
            r'\bssn\b': 'SSN',
            r'\bpatient[_\s-]?id\b': 'patient_id',
            r'\bdate[_\s-]?of[_\s-]?birth\b': 'date_of_birth',
            r'\bdob\b': 'DOB',
            r'\bmedical[_\s-]?record[_\s-]?number\b': 'MRN',
            r'\bmrn\b': 'MRN',
        }

        v_lower = v.lower()
        for pattern, name in phi_patterns.items():
            if re.search(pattern, v_lower):
                raise ValueError(
                    f"Potential PHI reference detected: '{name}'. "
                    f"Extraction point definitions must NOT contain PHI content. "
                    f"Use generic descriptions instead."
                )

        return v

    model_config = ConfigDict(
        use_enum_values=True,
        frozen=True,  # Immutable once created
    )


class ExtractionPointsOutput(BaseModel):
    """
    Container for extraction points with versioning.

    Wraps a list of extraction points with schema versioning and metadata
    for reproducibility and evolution tracking.

    Attributes:
        schema_version: Schema version in semver format (e.g., "1.0.0")
        generated_at: UTC timestamp of generation (ISO 8601)
        research_topic_id: Optional link back to research topic
        points: List of extraction point definitions
        metadata: Optional metadata dictionary for additional context

    Example:
        >>> output = ExtractionPointsOutput(
        ...     schema_version="1.0.0",
        ...     points=[
        ...         ExtractionPoint(id="ep_001", name="TIRADS", description="..."),
        ...         ExtractionPoint(id="ep_002", name="Nodule Size", description="...")
        ...     ],
        ...     research_topic_id="topic_thyroid_2024"
        ... )
        >>> json_str = output.model_dump_json(indent=2)
    """

    schema_version: str = Field(
        default="1.0.0",
        description="Schema version in semver format"
    )
    generated_at: str = Field(
        default_factory=lambda: datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        description="UTC timestamp of generation (ISO 8601)"
    )
    research_topic_id: Optional[str] = Field(
        default=None,
        description="Optional link to research topic"
    )
    points: List[ExtractionPoint] = Field(
        default_factory=list,
        description="List of extraction point definitions"
    )
    metadata: dict[str, Any] = Field(
        default_factory=dict,
        description="Optional metadata for additional context"
    )

    @field_validator("schema_version")
    @classmethod
    def validate_semver(cls, v: str) -> str:
        """Ensure schema_version follows semver format (e.g., '1.0.0')."""
        if not re.match(r'^\d+\.\d+\.\d+$', v):
            raise ValueError(
                f"schema_version must follow semver format (e.g., '1.0.0'), got: {v}"
            )
        return v

    @field_validator("points")
    @classmethod
    def validate_unique_ids(cls, v: List[ExtractionPoint]) -> List[ExtractionPoint]:
        """Ensure all extraction point IDs are unique within the container."""
        ids = [point.id for point in v]
        if len(ids) != len(set(ids)):
            duplicates = [id_ for id_ in ids if ids.count(id_) > 1]
            raise ValueError(
                f"Duplicate extraction point IDs found: {list(set(duplicates))}"
            )
        return v

    model_config = ConfigDict(
        use_enum_values=True,
        frozen=True,  # Immutable once created (consistent with ExtractionPoint)
    )
