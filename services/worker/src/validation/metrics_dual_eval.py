"""Dual strict/tolerant validation metrics.

This module provides evaluation functions that produce both:
1. Strict pass/fail (exact match, go/no-go gates)
2. Tolerant pass/fail (within tolerance, monitoring/drift visibility)

All functions return a dict with standardized fields for consistent reporting.
"""

from typing import Any, Dict, Optional, Union
from datetime import datetime, timedelta


def evaluate_numeric(
    observed: Optional[Union[int, float]],
    expected: Optional[Union[int, float]],
    tolerance_pct: float = 1.0,
) -> Dict[str, Any]:
    """Evaluate numeric value with strict and tolerant criteria.

    Args:
        observed: Observed numeric value
        expected: Expected numeric value
        tolerance_pct: Tolerance as percentage (default 1% = ±1%)

    Returns:
        Dict with keys:
            - strict_pass: bool (exact match)
            - tolerant_pass: bool or None
            - deviation: numeric or None
            - deviation_unit: str or None
            - tolerance: float or None
            - notes: str or None
    """
    # Handle null cases
    if observed is None and expected is None:
        return {
            "strict_pass": True,
            "tolerant_pass": True,
            "deviation": None,
            "deviation_unit": None,
            "tolerance": tolerance_pct,
            "notes": "Both values are None",
        }

    if observed is None or expected is None:
        return {
            "strict_pass": False,
            "tolerant_pass": False,
            "deviation": None,
            "deviation_unit": None,
            "tolerance": tolerance_pct,
            "notes": f"Null mismatch: observed={observed}, expected={expected}",
        }

    # Calculate deviation
    if expected == 0:
        # Special case: expected is zero - use absolute deviation
        deviation_abs = abs(observed - expected)
        deviation_pct = None
        # For zero expected, tolerant pass only if observed is also zero
        tolerant_pass = observed == 0
    else:
        deviation_abs = observed - expected
        deviation_pct = abs((deviation_abs / expected) * 100)
        # Tolerant evaluation: within tolerance percentage
        tolerant_pass = deviation_pct <= tolerance_pct

    # Strict evaluation: exact match
    strict_pass = observed == expected

    return {
        "strict_pass": strict_pass,
        "tolerant_pass": tolerant_pass,
        "deviation": deviation_pct if deviation_pct is not None else deviation_abs,
        "deviation_unit": "pct" if deviation_pct is not None else "abs",
        "tolerance": tolerance_pct,
        "notes": None,
    }


def evaluate_date(
    observed: Optional[str], expected: Optional[str], tolerance_days: int = 1
) -> Dict[str, Any]:
    """Evaluate date value with strict and tolerant criteria.

    Args:
        observed: Observed date string (ISO 8601 format)
        expected: Expected date string (ISO 8601 format)
        tolerance_days: Tolerance in days (default ±1 day)

    Returns:
        Dict with keys:
            - strict_pass: bool (exact match)
            - tolerant_pass: bool or None
            - deviation: int (days) or None
            - deviation_unit: str or None
            - tolerance: int or None
            - notes: str or None
    """
    # Handle null cases
    if observed is None and expected is None:
        return {
            "strict_pass": True,
            "tolerant_pass": True,
            "deviation": None,
            "deviation_unit": None,
            "tolerance": tolerance_days,
            "notes": "Both values are None",
        }

    if observed is None or expected is None:
        return {
            "strict_pass": False,
            "tolerant_pass": False,
            "deviation": None,
            "deviation_unit": None,
            "tolerance": tolerance_days,
            "notes": f"Null mismatch: observed={observed}, expected={expected}",
        }

    # Parse dates
    try:
        # Support both date and datetime formats
        obs_dt = datetime.fromisoformat(observed.replace("Z", "+00:00"))
        exp_dt = datetime.fromisoformat(expected.replace("Z", "+00:00"))
    except (ValueError, AttributeError) as e:
        return {
            "strict_pass": False,
            "tolerant_pass": False,
            "deviation": None,
            "deviation_unit": None,
            "tolerance": tolerance_days,
            "notes": f"Date parse error: {e}",
        }

    # Calculate deviation in days
    delta = obs_dt - exp_dt
    # Use total_seconds to get precise difference, then convert to days
    total_seconds = delta.total_seconds()
    deviation_days = int(total_seconds / 86400)  # 86400 seconds per day

    # Strict evaluation: exact match (same day)
    strict_pass = deviation_days == 0

    # Tolerant evaluation: within tolerance days
    tolerant_pass = abs(deviation_days) <= tolerance_days

    return {
        "strict_pass": strict_pass,
        "tolerant_pass": tolerant_pass,
        "deviation": deviation_days,
        "deviation_unit": "days",
        "tolerance": tolerance_days,
        "notes": None,
    }


def evaluate_string(observed: Optional[str], expected: Optional[str]) -> Dict[str, Any]:
    """Evaluate string value with strict criteria only.

    Args:
        observed: Observed string value
        expected: Expected string value

    Returns:
        Dict with keys:
            - strict_pass: bool (exact match)
            - tolerant_pass: None (no tolerance for strings)
            - deviation: None
            - deviation_unit: None
            - tolerance: None
            - notes: str or None
    """
    # Handle null cases
    if observed is None and expected is None:
        return {
            "strict_pass": True,
            "tolerant_pass": None,
            "deviation": None,
            "deviation_unit": None,
            "tolerance": None,
            "notes": "Both values are None",
        }

    if observed is None or expected is None:
        return {
            "strict_pass": False,
            "tolerant_pass": None,
            "deviation": None,
            "deviation_unit": None,
            "tolerance": None,
            "notes": f"Null mismatch: observed={observed}, expected={expected}",
        }

    # Strict evaluation: exact match
    strict_pass = observed == expected

    return {
        "strict_pass": strict_pass,
        "tolerant_pass": None,
        "deviation": None,
        "deviation_unit": None,
        "tolerance": None,
        "notes": f"Mismatch: '{observed}' != '{expected}'" if not strict_pass else None,
    }


def evaluate_bool(observed: Optional[bool], expected: Optional[bool]) -> Dict[str, Any]:
    """Evaluate boolean value with strict criteria only.

    Args:
        observed: Observed boolean value
        expected: Expected boolean value

    Returns:
        Dict with keys:
            - strict_pass: bool (exact match)
            - tolerant_pass: None (no tolerance for booleans)
            - deviation: None
            - deviation_unit: None
            - tolerance: None
            - notes: str or None
    """
    # Handle null cases
    if observed is None and expected is None:
        return {
            "strict_pass": True,
            "tolerant_pass": None,
            "deviation": None,
            "deviation_unit": None,
            "tolerance": None,
            "notes": "Both values are None",
        }

    if observed is None or expected is None:
        return {
            "strict_pass": False,
            "tolerant_pass": None,
            "deviation": None,
            "deviation_unit": None,
            "tolerance": None,
            "notes": f"Null mismatch: observed={observed}, expected={expected}",
        }

    # Strict evaluation: exact match
    strict_pass = observed == expected

    return {
        "strict_pass": strict_pass,
        "tolerant_pass": None,
        "deviation": None,
        "deviation_unit": None,
        "tolerance": None,
        "notes": f"Mismatch: {observed} != {expected}" if not strict_pass else None,
    }
