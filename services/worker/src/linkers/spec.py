"""
Cross-Modal Linker Specification Types

This module defines the declarative specification types for cross-modal linking.
These are SPECIFICATION-ONLY constructs that define linking rules without
executing any data processing.

Governance: SSAP v1.0 Compliant
Status: Pre-Analysis Only
"""

from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum
from pathlib import Path
from typing import Dict, List, Optional, Any

import yaml


class LinkableEntity(Enum):
    """Linkable clinical event types."""

    MOLECULAR = "MOLECULAR"
    IMAGING = "IMAGING"
    SURGICAL = "SURGICAL"
    PATHOLOGY = "PATHOLOGY"
    CYTOLOGY = "CYTOLOGY"

    @classmethod
    def from_string(cls, value: str) -> "LinkableEntity":
        """Parse entity from string, case-insensitive."""
        return cls[value.upper()]


class Laterality(Enum):
    """Anatomical laterality values."""

    LEFT = "LEFT"
    RIGHT = "RIGHT"
    BILATERAL = "BILATERAL"
    MIDLINE = "MIDLINE"
    NA = "NA"

    @classmethod
    def from_string(cls, value: str) -> "Laterality":
        """Parse laterality from string, case-insensitive."""
        return cls[value.upper()]


class Directionality(Enum):
    """Link directionality options."""

    FORWARD = "forward"  # Source precedes target
    BACKWARD = "backward"  # Source follows target
    BIDIRECTIONAL = "bidirectional"  # Either direction allowed

    @classmethod
    def from_string(cls, value: str) -> "Directionality":
        """Parse directionality from string."""
        value_lower = value.lower()
        for member in cls:
            if member.value == value_lower:
                return member
        raise ValueError(f"Unknown directionality: {value}")


class Cardinality(Enum):
    """Link cardinality constraints."""

    ONE_TO_ONE = "one_to_one"
    ONE_TO_MANY = "one_to_many"
    MANY_TO_ONE = "many_to_one"
    MANY_TO_MANY = "many_to_many"

    @classmethod
    def from_string(cls, value: str) -> "Cardinality":
        """Parse cardinality from string."""
        value_lower = value.lower()
        for member in cls:
            if member.value == value_lower:
                return member
        raise ValueError(f"Unknown cardinality: {value}")


class ConfidenceCategory(Enum):
    """Link confidence categories with codes."""

    HIGH = ("H", 0.8)
    MEDIUM = ("M", 0.5)
    LOW = ("L", 0.2)
    REJECTED = ("X", 0.0)

    def __init__(self, code: str, min_score: float):
        self.code = code
        self.min_score = min_score

    @classmethod
    def from_code(cls, code: str) -> "ConfidenceCategory":
        """Get category from single-character code."""
        for cat in cls:
            if cat.code == code:
                return cat
        raise ValueError(f"Unknown confidence code: {code}")

    @classmethod
    def from_score(cls, score: float) -> "ConfidenceCategory":
        """Determine category from numeric score."""
        if score >= cls.HIGH.min_score:
            return cls.HIGH
        elif score >= cls.MEDIUM.min_score:
            return cls.MEDIUM
        elif score >= cls.LOW.min_score:
            return cls.LOW
        else:
            return cls.REJECTED


@dataclass(frozen=True)
class TimeWindow:
    """
    Time window specification for linking.

    All values are in days. Negative values indicate before the reference point.
    """

    min_days: int
    max_days: int
    reference: str  # source_to_target, relative_to_target, symmetric

    def __post_init__(self):
        """Validate window sanity."""
        if self.min_days > self.max_days:
            raise ValueError(
                f"Invalid time window: min_days ({self.min_days}) > max_days ({self.max_days})"
            )

    @property
    def span_days(self) -> int:
        """Total span of the window in days."""
        return self.max_days - self.min_days

    @property
    def is_symmetric(self) -> bool:
        """Check if window is symmetric around zero."""
        return self.min_days == -self.max_days

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "TimeWindow":
        """Create from dictionary representation."""
        return cls(
            min_days=data["min_days"],
            max_days=data["max_days"],
            reference=data["reference"],
        )


@dataclass(frozen=True)
class LateralityRule:
    """Laterality matching rule specification."""

    name: str
    description: str
    accepts_na: bool = True

    @classmethod
    def from_dict(cls, name: str, data: Dict[str, Any]) -> "LateralityRule":
        """Create from dictionary representation."""
        return cls(
            name=name,
            description=data["description"],
            accepts_na=data.get("accepts_na", True),
        )


@dataclass
class LinkTypeSpec:
    """
    Specification for a single link type.

    This is a DECLARATIVE specification—it does NOT execute any linking.
    """

    link_id: str
    source_entity: LinkableEntity
    target_entity: LinkableEntity
    directionality: Directionality
    time_window: TimeWindow
    laterality_rule: str
    cardinality: Cardinality
    description: str = ""
    window_position_weight: float = 0.5
    laterality_match_weight: float = 0.5

    def __post_init__(self):
        """Validate weights sum to 1."""
        total = self.window_position_weight + self.laterality_match_weight
        if abs(total - 1.0) > 0.01:
            raise ValueError(f"Confidence weights must sum to 1.0, got {total}")

    @classmethod
    def from_dict(cls, link_id: str, data: Dict[str, Any]) -> "LinkTypeSpec":
        """Create from dictionary representation."""
        adjustments = data.get("confidence_adjustments", {})
        return cls(
            link_id=link_id,
            source_entity=LinkableEntity.from_string(data["source_entity"]),
            target_entity=LinkableEntity.from_string(data["target_entity"]),
            directionality=Directionality.from_string(data["directionality"]),
            time_window=TimeWindow.from_dict(data["time_window"]),
            laterality_rule=data["laterality_rule"],
            cardinality=Cardinality.from_string(data["cardinality"]),
            description=data.get("description", ""),
            window_position_weight=adjustments.get("window_position_weight", 0.5),
            laterality_match_weight=adjustments.get("laterality_match_weight", 0.5),
        )


@dataclass
class EntitySpec:
    """Specification for a linkable entity type."""

    entity_type: LinkableEntity
    description: str
    source_patterns: List[str]
    required_fields: List[str]

    @classmethod
    def from_dict(cls, entity_name: str, data: Dict[str, Any]) -> "EntitySpec":
        """Create from dictionary representation."""
        return cls(
            entity_type=LinkableEntity.from_string(entity_name),
            description=data["description"],
            source_patterns=data["source_patterns"],
            required_fields=data["required_fields"],
        )


@dataclass
class LinkerConfig:
    """
    Complete linker configuration loaded from YAML.

    This is a READ-ONLY specification container. It does NOT execute linking.
    """

    entities: Dict[str, EntitySpec] = field(default_factory=dict)
    link_types: Dict[str, LinkTypeSpec] = field(default_factory=dict)
    laterality_valid_values: List[Laterality] = field(default_factory=list)
    laterality_compatibility: Dict[str, Dict[str, str]] = field(default_factory=dict)
    laterality_rules: Dict[str, LateralityRule] = field(default_factory=dict)
    confidence_categories: Dict[str, Dict[str, Any]] = field(default_factory=dict)
    validation_rules: Dict[str, List[str]] = field(default_factory=dict)
    version: str = "1.0.0"
    status: str = "specification_only"
    execution_permitted: bool = False

    def get_link_type(self, link_id: str) -> Optional[LinkTypeSpec]:
        """Get a link type specification by ID."""
        return self.link_types.get(link_id)

    def get_entity(self, entity_type: LinkableEntity) -> Optional[EntitySpec]:
        """Get an entity specification by type."""
        return self.entities.get(entity_type.value)

    def list_link_types(self) -> List[str]:
        """List all defined link type IDs."""
        return list(self.link_types.keys())

    def is_laterality_compatible(
        self, source: Laterality, target: Laterality
    ) -> tuple[bool, str]:
        """
        Check laterality compatibility between source and target.

        Returns (is_compatible, confidence_level).
        """
        source_matrix = self.laterality_compatibility.get(source.value, {})
        confidence = source_matrix.get(target.value, "REJECTED")
        is_compatible = confidence != "REJECTED"
        return is_compatible, confidence


def load_linker_config(config_path: Optional[Path] = None) -> LinkerConfig:
    """
    Load linker configuration from YAML file.

    Args:
        config_path: Path to linker_rules.yaml. If None, uses default location.

    Returns:
        LinkerConfig instance with parsed specifications.

    Note:
        This function is READ-ONLY. It loads specifications but does NOT
        execute any linking logic.
    """
    if config_path is None:
        # Default path relative to repository root
        config_path = (
            Path(__file__).parent.parent.parent
            / "config"
            / "linkers"
            / "linker_rules.yaml"
        )

    if not config_path.exists():
        raise FileNotFoundError(f"Linker config not found: {config_path}")

    with open(config_path) as f:
        raw_config = yaml.safe_load(f)

    # Parse entities
    entities = {}
    for entity_name, entity_data in raw_config.get("entities", {}).items():
        entities[entity_name] = EntitySpec.from_dict(entity_name, entity_data)

    # Parse link types
    link_types = {}
    for link_id, link_data in raw_config.get("link_types", {}).items():
        link_types[link_id] = LinkTypeSpec.from_dict(link_id, link_data)

    # Parse laterality rules
    lat_rules_raw = raw_config.get("laterality_rules", {})
    laterality_valid_values = [
        Laterality.from_string(v) for v in lat_rules_raw.get("valid_values", [])
    ]
    laterality_compatibility = lat_rules_raw.get("compatibility_matrix", {})
    laterality_rules = {
        name: LateralityRule.from_dict(name, data)
        for name, data in lat_rules_raw.get("matching_rules", {}).items()
    }

    # Parse confidence categories
    confidence_categories = raw_config.get("confidence_categories", {})

    # Parse validation rules
    validation_rules = raw_config.get("validation_rules", {})

    # Parse metadata
    metadata = raw_config.get("metadata", {})

    return LinkerConfig(
        entities=entities,
        link_types=link_types,
        laterality_valid_values=laterality_valid_values,
        laterality_compatibility=laterality_compatibility,
        laterality_rules=laterality_rules,
        confidence_categories=confidence_categories,
        validation_rules=validation_rules,
        version=metadata.get("version", "1.0.0"),
        status=metadata.get("status", "specification_only"),
        execution_permitted=metadata.get("execution_permitted", False),
    )
