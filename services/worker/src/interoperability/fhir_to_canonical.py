"""
FHIR to Canonical Transform Library (C3 Inbound Bridge)

**Governance:**
- Pure functions only (no network, no I/O, no side effects)
- Offline-safe in all ROS modes (STANDBY, SANDBOX, ACTIVE)
- Synthetic test data only (no PHI processing)
- FHIR R4 Observation resource input

**Safety guarantees:**
- No network calls
- No file system access
- No external dependencies beyond stdlib + typing
- Input validation with clear error messages
- Output conforms to canonical signal schema v1.0.0

**Usage:**
    from src.interoperability.fhir_to_canonical import fhir_observation_to_signal

    fhir_obs = {
        "resourceType": "Observation",
        "status": "final",
        "subject": {"identifier": {"value": "R001"}},
        "effectiveDateTime": "2024-01-15T14:30:00Z",
        "category": [...],
        "code": {...},
        "valueQuantity": {"value": 7.0, "unit": "/10"}
    }

    signal, provenance = fhir_observation_to_signal(fhir_obs)
    # Returns: (canonical_signal_dict, provenance_metadata)

**STANDBY Mode:**
- Transformation is allowed (pure function)
- Input data MUST be synthetic (enforced by caller)
- No real patient data processing permitted

**Provenance Tracking:**
- Computes SHA-256 hash of input FHIR resource
- Returns provenance metadata for lineage tracking
- Hash computed on canonical JSON representation (sorted keys)
"""

from typing import Optional, Dict, Any, Tuple
from datetime import datetime, timezone
import hashlib
import json

__version__ = "v1.0.0"

DEFAULT_CONFIG = {
    "strict_validation": True,
    "require_research_id_format": False,  # Set True to enforce R### pattern
    "default_signal_type": "other",
}


def fhir_observation_to_signal(
    observation: Dict[str, Any], config: Optional[Dict[str, Any]] = None
) -> Tuple[Dict[str, Any], Dict[str, Any]]:
    """
    Transform a FHIR R4 Observation resource to canonical signal format.

    Args:
        observation: FHIR R4 Observation resource as dictionary
        config: Optional configuration overrides

    Returns:
        Tuple of (canonical_signal_dict, provenance_metadata)
        - canonical_signal_dict: 13-field canonical signal
        - provenance_metadata: {"fhir_hash": "sha256:...", "transform_timestamp": "...", "transform_version": "v1.0.0"}

    Raises:
        ValueError: If required FHIR fields are missing or invalid

    Example:
        >>> fhir_obs = {...}  # FHIR R4 Observation
        >>> signal, prov = fhir_observation_to_signal(fhir_obs)
        >>> signal["research_id"]
        'R001'
        >>> prov["fhir_hash"]
        'sha256:abc123...'
    """
    # Merge config with defaults
    cfg = {**DEFAULT_CONFIG, **(config or {})}

    # Validate FHIR structure
    if observation.get("resourceType") != "Observation":
        raise ValueError("Input must be a FHIR Observation resource")

    # Extract canonical fields
    signal = {
        "research_id": _extract_research_id(observation, cfg),
        "signal_time": _extract_effective_datetime(observation),
        "signal_type": _extract_signal_type(observation, cfg),
        "signal_name": _extract_signal_name(observation),
        "signal_value_num": None,
        "signal_value_text": None,
        "unit": None,
        "source_system": _extract_source_system(observation),
        "collection_mode": _extract_collection_mode(observation),
        "quality_flag": _extract_quality_flag(observation),
        "notes": _extract_notes(observation),
        "episode_id": _extract_episode_context(observation),
        "encounter_id_deid": None,  # FHIR encounter → episode_id (canonical has no separate encounter field)
    }

    # Extract value (populates signal_value_num OR signal_value_text + unit)
    value_fields = _extract_value(observation)
    signal.update(value_fields)

    # Compute provenance
    provenance = _compute_provenance(observation)

    return signal, provenance


def _extract_research_id(observation: Dict[str, Any], cfg: Dict[str, Any]) -> str:
    """Extract research_id from FHIR subject reference."""
    subject = observation.get("subject")
    if not subject:
        raise ValueError("FHIR Observation missing required 'subject' field")

    # Try identifier.value first (preferred for research IDs)
    identifier = subject.get("identifier")
    if identifier and identifier.get("value"):
        research_id = identifier["value"]
    # Fallback to reference string parsing (e.g., "Patient/R001")
    elif subject.get("reference"):
        reference = subject["reference"]
        research_id = reference.split("/")[-1]  # Extract ID from "Patient/R001"
    else:
        raise ValueError("FHIR subject must have identifier.value or reference")

    # Optional: Validate research ID format (R### pattern for synthetic data)
    if cfg["require_research_id_format"]:
        if not research_id.startswith("R") or not research_id[1:].isdigit():
            raise ValueError(f"Research ID must match pattern R### (got: {research_id})")

    return research_id


def _extract_effective_datetime(observation: Dict[str, Any]) -> str:
    """Extract signal_time from FHIR effectiveDateTime or effectivePeriod."""
    # Try effectiveDateTime first
    effective_dt = observation.get("effectiveDateTime")
    if effective_dt:
        return effective_dt

    # Fallback to effectivePeriod.start
    effective_period = observation.get("effectivePeriod")
    if effective_period and effective_period.get("start"):
        return effective_period["start"]

    raise ValueError("FHIR Observation missing required 'effectiveDateTime' or 'effectivePeriod.start'")


def _extract_signal_type(observation: Dict[str, Any], cfg: Dict[str, Any]) -> str:
    """
    Extract signal_type from FHIR category.

    Reverse mapping:
    - survey → PROM
    - vital-signs → symptom (default) or wearable (if device present)
    - therapy → adherence
    - exam → other
    """
    categories = observation.get("category", [])
    if not categories:
        return cfg["default_signal_type"]

    # Extract first category code
    coding = categories[0].get("coding", [])
    if not coding:
        return cfg["default_signal_type"]

    category_code = coding[0].get("code", "")

    # Reverse mapping from FHIR category to signal_type
    category_map = {
        "survey": "PROM",
        "vital-signs": "symptom",  # Default; will check for device to distinguish wearable
        "therapy": "adherence",
        "exam": "other",
    }

    signal_type = category_map.get(category_code, cfg["default_signal_type"])

    # If vital-signs and device present, reclassify as wearable
    if signal_type == "symptom" and observation.get("device"):
        signal_type = "wearable"

    return signal_type


def _extract_signal_name(observation: Dict[str, Any]) -> str:
    """Extract signal_name from FHIR code.coding[0].code."""
    code = observation.get("code")
    if not code:
        raise ValueError("FHIR Observation missing required 'code' field")

    coding = code.get("coding", [])
    if not coding or not coding[0].get("code"):
        raise ValueError("FHIR code must have at least one coding with 'code' field")

    return coding[0]["code"]


def _extract_value(observation: Dict[str, Any]) -> Dict[str, Optional[Any]]:
    """
    Extract value fields from FHIR valueQuantity, valueString, or valueCodeableConcept.

    Returns:
        Dictionary with signal_value_num, signal_value_text, unit
    """
    # Try valueQuantity (numeric)
    value_quantity = observation.get("valueQuantity")
    if value_quantity:
        return {
            "signal_value_num": value_quantity.get("value"),
            "signal_value_text": None,
            "unit": value_quantity.get("unit") or value_quantity.get("code"),
        }

    # Try valueString (text)
    value_string = observation.get("valueString")
    if value_string:
        return {
            "signal_value_num": None,
            "signal_value_text": value_string,
            "unit": None,
        }

    # Try valueCodeableConcept (treat as text)
    value_concept = observation.get("valueCodeableConcept")
    if value_concept:
        text = value_concept.get("text") or (
            value_concept.get("coding", [{}])[0].get("display") if value_concept.get("coding") else None
        )
        return {
            "signal_value_num": None,
            "signal_value_text": text,
            "unit": None,
        }

    # No value found - not necessarily an error (some observations have interpretation but no value)
    return {
        "signal_value_num": None,
        "signal_value_text": None,
        "unit": None,
    }


def _extract_source_system(observation: Dict[str, Any]) -> Optional[str]:
    """Extract source_system from FHIR device reference (if present)."""
    device = observation.get("device")
    if not device:
        return None

    # Try identifier.value first
    identifier = device.get("identifier")
    if identifier and identifier.get("value"):
        return identifier["value"]

    # Fallback to reference parsing
    reference = device.get("reference")
    if reference:
        return reference.split("/")[-1]

    return None


def _extract_collection_mode(observation: Dict[str, Any]) -> Optional[str]:
    """
    Extract collection_mode from FHIR method.

    Reverse mapping:
    - self-reported → self_report
    - device-automated → passive_sensing
    - clinician-entered → clinician_entered
    """
    method = observation.get("method")
    if not method:
        return None

    coding = method.get("coding", [])
    if not coding:
        return None

    method_code = coding[0].get("code", "")

    # Reverse mapping
    method_map = {
        "self-reported": "self_report",
        "device-automated": "passive_sensing",
        "clinician-entered": "clinician_entered",
    }

    return method_map.get(method_code)


def _extract_quality_flag(observation: Dict[str, Any]) -> Optional[str]:
    """
    Extract quality_flag from FHIR status.

    Reverse mapping:
    - entered-in-error → invalid
    - final, amended, corrected → None (valid)
    """
    status = observation.get("status")
    if status == "entered-in-error":
        return "invalid"
    return None  # All other statuses treated as valid


def _extract_notes(observation: Dict[str, Any]) -> Optional[str]:
    """Extract notes from FHIR note array (concatenate if multiple)."""
    notes = observation.get("note", [])
    if not notes:
        return None

    # Concatenate all note texts with newline separator
    note_texts = [note.get("text", "") for note in notes if note.get("text")]
    return "\n".join(note_texts) if note_texts else None


def _extract_episode_context(observation: Dict[str, Any]) -> Optional[str]:
    """Extract episode_id from FHIR encounter reference."""
    encounter = observation.get("encounter")
    if not encounter:
        return None

    # Try identifier.value first
    identifier = encounter.get("identifier")
    if identifier and identifier.get("value"):
        return identifier["value"]

    # Fallback to reference parsing
    reference = encounter.get("reference")
    if reference:
        return reference.split("/")[-1]

    return None


def _compute_provenance(observation: Dict[str, Any]) -> Dict[str, str]:
    """
    Compute provenance metadata for the transformation.

    Returns:
        Dictionary with fhir_hash, transform_timestamp, transform_version
    """
    fhir_hash = _compute_fhir_hash(observation)
    timestamp = datetime.now(timezone.utc).isoformat()

    return {
        "fhir_hash": f"sha256:{fhir_hash}",
        "transform_timestamp": timestamp,
        "transform_version": __version__,
    }


def _compute_fhir_hash(observation: Dict[str, Any]) -> str:
    """
    Compute SHA-256 hash of FHIR Observation resource.

    Uses canonical JSON representation (sorted keys) for deterministic hashing.
    """
    canonical_json = json.dumps(observation, sort_keys=True)
    return hashlib.sha256(canonical_json.encode("utf-8")).hexdigest()
