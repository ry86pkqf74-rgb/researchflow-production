"""
Schema Alignment

Aligns schemas from different data sources for fusion operations.
"""

from __future__ import annotations

import logging
import re
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional, Set, Tuple

logger = logging.getLogger(__name__)


@dataclass
class ColumnMapping:
    """Mapping between columns from different sources."""
    source_column: str
    target_column: str
    source_type: str
    target_type: str
    confidence: float  # 0-1 confidence in the mapping
    transform: Optional[str] = None  # Transformation to apply


@dataclass
class SchemaAlignment:
    """Result of schema alignment."""
    mappings: List[ColumnMapping]
    unmapped_source: List[str]
    unmapped_target: List[str]
    aligned_columns: List[str]
    confidence: float


class SchemaAligner:
    """
    Aligns schemas from different data sources.

    Uses multiple strategies:
    1. Exact name matching
    2. Normalized name matching (case-insensitive, underscore/space)
    3. Semantic similarity (if available)
    4. Type compatibility
    """

    # Common name variations
    NAME_VARIATIONS = {
        "id": ["identifier", "key", "pk"],
        "name": ["title", "label"],
        "date": ["datetime", "timestamp", "time"],
        "email": ["mail", "e-mail", "email_address"],
        "phone": ["telephone", "mobile", "phone_number"],
        "address": ["addr", "location"],
        "city": ["town", "municipality"],
        "state": ["province", "region"],
        "country": ["nation"],
        "zip": ["postal_code", "zipcode", "postcode"],
        "first_name": ["firstname", "given_name", "fname"],
        "last_name": ["lastname", "surname", "family_name", "lname"],
        "description": ["desc", "summary", "details"],
        "price": ["cost", "amount", "value"],
        "quantity": ["qty", "count", "num"],
        "created_at": ["created", "creation_date", "created_date"],
        "updated_at": ["updated", "modified", "modification_date"],
    }

    # Type compatibility matrix
    TYPE_COMPATIBILITY = {
        ("integer", "float"): 0.9,
        ("float", "integer"): 0.8,
        ("string", "integer"): 0.3,
        ("string", "float"): 0.3,
        ("integer", "string"): 0.7,
        ("float", "string"): 0.7,
        ("datetime", "string"): 0.6,
        ("string", "datetime"): 0.5,
        ("boolean", "integer"): 0.5,
        ("integer", "boolean"): 0.5,
    }

    def __init__(self, min_confidence: float = 0.5):
        self.min_confidence = min_confidence
        self._build_variation_index()

    def _build_variation_index(self):
        """Build reverse index of name variations."""
        self._variation_to_canonical = {}
        for canonical, variations in self.NAME_VARIATIONS.items():
            self._variation_to_canonical[canonical] = canonical
            for var in variations:
                self._variation_to_canonical[var] = canonical

    def normalize_name(self, name: str) -> str:
        """Normalize a column name for comparison."""
        # Lowercase
        normalized = name.lower()
        # Replace common separators with underscore
        normalized = re.sub(r"[-\s.]+", "_", normalized)
        # Remove non-alphanumeric except underscore
        normalized = re.sub(r"[^a-z0-9_]", "", normalized)
        # Remove trailing numbers (e.g., col1, col2)
        normalized = re.sub(r"_?\d+$", "", normalized)
        return normalized

    def get_canonical_name(self, name: str) -> str:
        """Get canonical form of a column name."""
        normalized = self.normalize_name(name)
        return self._variation_to_canonical.get(normalized, normalized)

    def align(
        self,
        source_schema: Dict[str, str],
        target_schema: Dict[str, str],
    ) -> SchemaAlignment:
        """
        Align source schema to target schema.

        Args:
            source_schema: {column_name: data_type} for source
            target_schema: {column_name: data_type} for target

        Returns:
            SchemaAlignment with column mappings
        """
        mappings = []
        mapped_source: Set[str] = set()
        mapped_target: Set[str] = set()

        # Strategy 1: Exact match
        for source_col, source_type in source_schema.items():
            if source_col in target_schema:
                target_type = target_schema[source_col]
                confidence = self._calculate_confidence(
                    source_col, source_col, source_type, target_type, "exact"
                )
                mappings.append(ColumnMapping(
                    source_column=source_col,
                    target_column=source_col,
                    source_type=source_type,
                    target_type=target_type,
                    confidence=confidence,
                ))
                mapped_source.add(source_col)
                mapped_target.add(source_col)

        # Strategy 2: Normalized name match
        source_normalized = {
            self.normalize_name(col): (col, dtype)
            for col, dtype in source_schema.items()
            if col not in mapped_source
        }
        target_normalized = {
            self.normalize_name(col): (col, dtype)
            for col, dtype in target_schema.items()
            if col not in mapped_target
        }

        for norm_name, (source_col, source_type) in source_normalized.items():
            if norm_name in target_normalized:
                target_col, target_type = target_normalized[norm_name]
                confidence = self._calculate_confidence(
                    source_col, target_col, source_type, target_type, "normalized"
                )
                if confidence >= self.min_confidence:
                    mappings.append(ColumnMapping(
                        source_column=source_col,
                        target_column=target_col,
                        source_type=source_type,
                        target_type=target_type,
                        confidence=confidence,
                    ))
                    mapped_source.add(source_col)
                    mapped_target.add(target_col)

        # Strategy 3: Canonical name match
        source_canonical = {
            self.get_canonical_name(col): (col, dtype)
            for col, dtype in source_schema.items()
            if col not in mapped_source
        }
        target_canonical = {
            self.get_canonical_name(col): (col, dtype)
            for col, dtype in target_schema.items()
            if col not in mapped_target
        }

        for canon_name, (source_col, source_type) in source_canonical.items():
            if canon_name in target_canonical:
                target_col, target_type = target_canonical[canon_name]
                confidence = self._calculate_confidence(
                    source_col, target_col, source_type, target_type, "canonical"
                )
                if confidence >= self.min_confidence:
                    mappings.append(ColumnMapping(
                        source_column=source_col,
                        target_column=target_col,
                        source_type=source_type,
                        target_type=target_type,
                        confidence=confidence,
                    ))
                    mapped_source.add(source_col)
                    mapped_target.add(target_col)

        # Calculate unmapped columns
        unmapped_source = [col for col in source_schema if col not in mapped_source]
        unmapped_target = [col for col in target_schema if col not in mapped_target]

        # Calculate overall confidence
        if mappings:
            overall_confidence = sum(m.confidence for m in mappings) / len(mappings)
        else:
            overall_confidence = 0.0

        return SchemaAlignment(
            mappings=mappings,
            unmapped_source=unmapped_source,
            unmapped_target=unmapped_target,
            aligned_columns=[m.target_column for m in mappings],
            confidence=overall_confidence,
        )

    def _calculate_confidence(
        self,
        source_col: str,
        target_col: str,
        source_type: str,
        target_type: str,
        match_type: str,
    ) -> float:
        """Calculate confidence score for a column mapping."""
        # Base confidence from match type
        base_confidence = {
            "exact": 1.0,
            "normalized": 0.9,
            "canonical": 0.8,
            "semantic": 0.7,
        }.get(match_type, 0.5)

        # Adjust for type compatibility
        if source_type == target_type:
            type_factor = 1.0
        else:
            type_key = (source_type.lower(), target_type.lower())
            type_factor = self.TYPE_COMPATIBILITY.get(type_key, 0.5)

        return base_confidence * type_factor


def align_schemas(
    source_schema: Dict[str, str],
    target_schema: Dict[str, str],
    min_confidence: float = 0.5,
) -> SchemaAlignment:
    """
    Align source schema to target schema.

    Args:
        source_schema: Source column types {name: type}
        target_schema: Target column types {name: type}
        min_confidence: Minimum confidence for mappings

    Returns:
        SchemaAlignment with mappings and unmapped columns
    """
    aligner = SchemaAligner(min_confidence=min_confidence)
    return aligner.align(source_schema, target_schema)
