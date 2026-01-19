"""PHI Guard - Python shim for PHI protection.

Provides assertion functions that block operations containing PHI.
Returns location-only reports (never the actual PHI text).
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Dict, List, Optional

from src.validation.phi_detector import PHIDetector


@dataclass
class PhiLocation:
    """Location of detected PHI (no actual PHI text included)."""
    start_offset: int
    end_offset: int
    phi_type: str
    section: Optional[str] = None


class PhiBlocked(Exception):
    """Exception raised when PHI is detected and operation is blocked."""

    def __init__(self, label: str, locations: List[PhiLocation]):
        super().__init__(f"PHI blocked in {label}")
        self.code = "PHI_BLOCKED"
        self.label = label
        self.locations = locations

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dict for JSON serialization."""
        return {
            "code": self.code,
            "label": self.label,
            "locations": [
                {
                    "start_offset": loc.start_offset,
                    "end_offset": loc.end_offset,
                    "phi_type": loc.phi_type,
                    "section": loc.section,
                }
                for loc in self.locations
            ],
        }


# Singleton detector instance
_detector: Optional[PHIDetector] = None


def _get_detector() -> PHIDetector:
    """Get or create the singleton PHI detector."""
    global _detector
    if _detector is None:
        _detector = PHIDetector()
    return _detector


def scan_text_for_phi(text: str) -> Dict[str, Any]:
    """Scan text for PHI and return location-only results.

    Args:
        text: Text to scan

    Returns:
        Dict with 'has_phi' boolean and 'locations' list
    """
    if not text or not isinstance(text, str):
        return {"has_phi": False, "locations": []}

    detector = _get_detector()
    detections = detector.scan_value(text)

    if not detections:
        return {"has_phi": False, "locations": []}

    # Convert detections to location-only format
    # detections is list of (PHIType, matched_text) tuples
    # We need to find positions - scan_value doesn't give positions directly
    # So we do a position-aware scan
    locations: List[Dict[str, Any]] = []

    for phi_type, match_text in detections:
        # Find position of match in text (first occurrence)
        start = text.find(match_text)
        if start >= 0:
            locations.append({
                "start_offset": start,
                "end_offset": start + len(match_text),
                "phi_type": phi_type.value if hasattr(phi_type, "value") else str(phi_type),
            })

    return {"has_phi": len(locations) > 0, "locations": locations}


def assert_no_phi(label: str, text: str) -> None:
    """Assert that text contains no PHI, raise PhiBlocked if it does.

    Args:
        label: Label for error reporting (e.g., "context:INTRODUCTION")
        text: Text to scan

    Raises:
        PhiBlocked: If PHI is detected
    """
    result = scan_text_for_phi(text)

    if result["has_phi"]:
        locations = [
            PhiLocation(
                start_offset=loc["start_offset"],
                end_offset=loc["end_offset"],
                phi_type=loc["phi_type"],
            )
            for loc in result["locations"]
        ]
        raise PhiBlocked(label, locations)


def contains_phi(text: str) -> bool:
    """Check if text contains PHI (non-raising version).

    Args:
        text: Text to check

    Returns:
        True if PHI detected
    """
    result = scan_text_for_phi(text)
    return result["has_phi"]


def scan_object_for_phi(
    obj: Any,
    label: str,
    max_depth: int = 10
) -> Dict[str, Any]:
    """Scan object recursively for PHI in string values.

    Args:
        obj: Object to scan
        label: Base label for error reporting
        max_depth: Maximum recursion depth

    Returns:
        Dict with 'has_phi' boolean and 'locations' list (with path info)
    """
    locations: List[Dict[str, Any]] = []

    def walk(value: Any, path: str, depth: int) -> None:
        if depth > max_depth:
            return

        if isinstance(value, str):
            result = scan_text_for_phi(value)
            if result["has_phi"]:
                for loc in result["locations"]:
                    locations.append({**loc, "path": path})
        elif isinstance(value, dict):
            for key, val in value.items():
                new_path = f"{path}.{key}" if path else key
                walk(val, new_path, depth + 1)
        elif isinstance(value, (list, tuple)):
            for i, item in enumerate(value):
                walk(item, f"{path}[{i}]", depth + 1)

    walk(obj, label, 0)

    return {"has_phi": len(locations) > 0, "locations": locations}


def assert_no_phi_in_object(label: str, obj: Any) -> None:
    """Assert object contains no PHI in any string values.

    Args:
        label: Label for error reporting
        obj: Object to scan

    Raises:
        PhiBlocked: If PHI is detected
    """
    result = scan_object_for_phi(obj, label)

    if result["has_phi"]:
        locations = [
            PhiLocation(
                start_offset=loc["start_offset"],
                end_offset=loc["end_offset"],
                phi_type=loc["phi_type"],
                section=loc.get("path"),
            )
            for loc in result["locations"]
        ]
        raise PhiBlocked(label, locations)
