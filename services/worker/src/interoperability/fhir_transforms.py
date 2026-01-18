"""
FHIR Transformation Library (INF-15)

**Governance:**
- Pure functions only (no network, no I/O, no side effects)
- Offline-safe in all ROS modes (STANDBY, SANDBOX, ACTIVE)
- Synthetic test data only (no PHI processing)
- FHIR R4 Observation resource output

**Safety guarantees:**
- No network calls
- No file system access
- No external dependencies beyond stdlib + typing
- Input validation with clear error messages
- Output conforms to FHIR R4 Observation schema

**Usage:**
    from src.interoperability.fhir_transforms import signal_to_fhir_observation

    signal = {
        "research_id": "R001",
        "signal_time": "2024-01-15T14:30:00Z",
        "signal_type": "PROM",
        "signal_name": "pain_score",
        "signal_value_num": 7.0,
        "unit": "/10",
        ...
    }

    observation = signal_to_fhir_observation(signal)
    # Returns: FHIR R4 Observation as dict

**STANDBY Mode:**
- Transformation is allowed (pure function)
- Input data MUST be synthetic (enforced by caller)
- No real patient data processing permitted
"""

from typing import Optional, Dict, List, Any, Tuple
from datetime import datetime, timezone
import hashlib
import json


DEFAULT_CONFIG = {
    "include_notes": True,
    "use_encounter_for_episode": True,
    "default_status": "final",
}


def signal_to_fhir_observation(
    signal_dict: Dict[str, Any], config: Optional[Dict[str, Any]] = None
) -> Tuple[Dict[str, Any], Dict[str, str]]:
    """
    Transform a canonical signal dictionary to a FHIR R4 Observation resource.

    Args:
        signal_dict: Dictionary containing signal fields:
            - research_id (str, required): Patient identifier
            - signal_time (str, required): ISO 8601 timestamp
            - signal_type (str, required): PROM, symptom, wearable, adherence, other
            - signal_name (str, required): Internal signal name
            - signal_value_num (float, optional): Numeric value
            - signal_value_text (str, optional): Text value
            - unit (str, optional): Unit of measurement
            - source_system (str, optional): Source system identifier
            - collection_mode (str, optional): self_report, passive_sensing, clinician_entered
            - quality_flag (str, optional): Quality flag (invalid, rejected, etc.)
            - notes (str, optional): Free-text notes
            - episode_id (str, optional): Episode identifier
        config: Optional configuration overrides

    Returns:
        Tuple of (fhir_observation_dict, provenance_metadata)
        - fhir_observation_dict: FHIR R4 Observation resource
        - provenance_metadata: {"signal_hash": "sha256:...", "fhir_hash": "sha256:...", "transform_timestamp": "...", "transform_version": "v1.0.0"}

    Raises:
        ValueError: If required fields are missing or invalid

    Example:
        >>> signal = {"research_id": "R001", ...}
        >>> fhir_obs, prov = signal_to_fhir_observation(signal)
        >>> prov["signal_hash"]
        'sha256:abc123...'
    """
    # Merge config with defaults
    cfg = {**DEFAULT_CONFIG, **(config or {})}

    # Validate required fields
    required_fields = ["research_id", "signal_time", "signal_type", "signal_name"]
    for field in required_fields:
        if not signal_dict.get(field):
            raise ValueError(f"Required field '{field}' is missing or empty")

    # Validate at least one value is provided
    if not signal_dict.get("signal_value_num") and not signal_dict.get("signal_value_text"):
        raise ValueError("At least one of 'signal_value_num' or 'signal_value_text' must be provided")

    # Build observation
    observation = {
        "resourceType": "Observation",
        "status": _map_status(signal_dict.get("quality_flag"), cfg["default_status"]),
        "category": _map_category(signal_dict["signal_type"]),
        "code": _map_code(signal_dict["signal_name"], signal_dict["signal_type"]),
        "subject": _map_subject(signal_dict["research_id"]),
        "effectiveDateTime": signal_dict["signal_time"],
    }

    # Add value
    value_field = _map_value(
        signal_dict.get("signal_value_num"),
        signal_dict.get("signal_value_text"),
        signal_dict.get("unit")
    )
    observation.update(value_field)

    # Add optional fields
    method = _map_method(signal_dict.get("collection_mode"))
    if method:
        observation["method"] = method

    device = _map_device(signal_dict.get("source_system"), signal_dict["signal_type"])
    if device:
        observation["device"] = device

    encounter = _map_episode_context(
        signal_dict.get("episode_id"),
        cfg["use_encounter_for_episode"]
    )
    if encounter:
        observation["encounter"] = encounter

    if cfg["include_notes"]:
        note = _map_note(signal_dict.get("notes"), signal_dict["signal_time"])
        if note:
            observation["note"] = note

    # Compute provenance hashes
    provenance = _compute_transform_provenance(signal_dict, observation)

    return observation, provenance


def _map_status(quality_flag: Optional[str], default_status: str) -> str:
    """
    Map quality flag to FHIR Observation status.

    Args:
        quality_flag: Quality flag from signal
        default_status: Default status if no flag

    Returns:
        FHIR status code
    """
    if quality_flag in ["invalid", "rejected"]:
        return "entered-in-error"
    return default_status


def _map_category(signal_type: str) -> List[Dict[str, Any]]:
    """
    Map signal type to FHIR category.

    Args:
        signal_type: PROM, symptom, wearable, adherence, other

    Returns:
        FHIR category array
    """
    category_mapping = {
        "PROM": {
            "coding": [{
                "system": "http://terminology.hl7.org/CodeSystem/observation-category",
                "code": "survey",
                "display": "Survey"
            }]
        },
        "symptom": {
            "coding": [{
                "system": "http://terminology.hl7.org/CodeSystem/observation-category",
                "code": "vital-signs",
                "display": "Vital Signs"
            }]
        },
        "wearable": {
            "coding": [{
                "system": "http://terminology.hl7.org/CodeSystem/observation-category",
                "code": "vital-signs",
                "display": "Vital Signs"
            }]
        },
        "adherence": {
            "coding": [{
                "system": "http://terminology.hl7.org/CodeSystem/observation-category",
                "code": "therapy",
                "display": "Therapy"
            }]
        },
        "other": {
            "coding": [{
                "system": "http://terminology.hl7.org/CodeSystem/observation-category",
                "code": "exam",
                "display": "Exam"
            }]
        },
    }
    return [category_mapping.get(signal_type, category_mapping["other"])]


def _map_code(signal_name: str, signal_type: str) -> Dict[str, Any]:
    """
    Map signal name to FHIR code.

    Args:
        signal_name: Internal signal name
        signal_type: Signal type for context

    Returns:
        FHIR CodeableConcept
    """
    # Humanize display name
    display = signal_name.replace("_", " ").title()

    return {
        "coding": [{
            "system": "https://research-os.example.org/signals",
            "code": signal_name,
            "display": display
        }],
        "text": f"{signal_name} ({signal_type})"
    }


def _map_subject(research_id: str) -> Dict[str, Any]:
    """
    Map research ID to FHIR subject reference.

    Args:
        research_id: Research subject identifier

    Returns:
        FHIR Reference
    """
    return {
        "identifier": {
            "system": "https://research-os.example.org/patients",
            "value": research_id
        },
        "display": f"Research Subject {research_id}"
    }


def _map_value(
    signal_value_num: Optional[float],
    signal_value_text: Optional[str],
    unit: Optional[str]
) -> Dict[str, Any]:
    """
    Map signal values to FHIR value field.

    Args:
        signal_value_num: Numeric value
        signal_value_text: Text value
        unit: Unit of measurement

    Returns:
        Dictionary with valueQuantity or valueString
    """
    if signal_value_num is not None:
        value_field = {
            "valueQuantity": {
                "value": signal_value_num,
            }
        }
        if unit:
            value_field["valueQuantity"]["unit"] = unit
            value_field["valueQuantity"]["code"] = unit
            value_field["valueQuantity"]["system"] = "http://unitsofmeasure.org"
        return value_field
    elif signal_value_text:
        return {"valueString": signal_value_text}
    return {}


def _map_method(collection_mode: Optional[str]) -> Optional[Dict[str, Any]]:
    """
    Map collection mode to FHIR method.

    Args:
        collection_mode: self_report, passive_sensing, clinician_entered

    Returns:
        FHIR CodeableConcept or None
    """
    if not collection_mode:
        return None

    method_mapping = {
        "self_report": {
            "coding": [{
                "system": "https://research-os.example.org/collection-methods",
                "code": "self-reported",
                "display": "Self-Reported"
            }]
        },
        "passive_sensing": {
            "coding": [{
                "system": "https://research-os.example.org/collection-methods",
                "code": "device-automated",
                "display": "Device Automated"
            }]
        },
        "clinician_entered": {
            "coding": [{
                "system": "https://research-os.example.org/collection-methods",
                "code": "clinician-entered",
                "display": "Clinician Entered"
            }]
        },
    }
    return method_mapping.get(collection_mode)


def _map_device(source_system: Optional[str], signal_type: str) -> Optional[Dict[str, Any]]:
    """
    Map source system to FHIR device reference (wearables only).

    Args:
        source_system: Source system identifier
        signal_type: Signal type

    Returns:
        FHIR Reference or None
    """
    if signal_type != "wearable" or not source_system:
        return None

    return {
        "identifier": {
            "system": "https://research-os.example.org/devices",
            "value": source_system
        },
        "display": f"Device: {source_system}"
    }


def _map_episode_context(
    episode_id: Optional[str],
    use_encounter: bool
) -> Optional[Dict[str, Any]]:
    """
    Map episode ID to FHIR encounter reference.

    Args:
        episode_id: Episode identifier
        use_encounter: Whether to use encounter field

    Returns:
        FHIR Reference or None
    """
    if not episode_id or not use_encounter:
        return None

    return {
        "identifier": {
            "system": "https://research-os.example.org/episodes",
            "value": episode_id
        },
        "display": f"Episode {episode_id}"
    }


def _map_note(notes: Optional[str], timestamp: Optional[str] = None) -> Optional[List[Dict[str, Any]]]:
    """
    Map notes to FHIR annotation.

    Args:
        notes: Free-text notes
        timestamp: Optional timestamp (defaults to current time)

    Returns:
        FHIR Annotation array or None
    """
    if not notes:
        return None

    time = timestamp or datetime.utcnow().isoformat() + "Z"
    return [{
        "text": notes,
        "time": time
    }]


def _compute_transform_provenance(
    signal_dict: Dict[str, Any], observation: Dict[str, Any]
) -> Dict[str, str]:
    """
    Compute provenance metadata for canonical → FHIR transform.

    Computes SHA-256 hashes of both input (canonical signal) and output (FHIR observation)
    for lineage tracking at transform boundaries.

    Args:
        signal_dict: Input canonical signal dictionary
        observation: Output FHIR observation dictionary

    Returns:
        Dictionary with signal_hash, fhir_hash, transform_timestamp, transform_version
    """
    signal_hash = _compute_signal_hash(signal_dict)
    fhir_hash = _compute_fhir_hash(observation)
    timestamp = datetime.now(timezone.utc).isoformat()

    return {
        "signal_hash": f"sha256:{signal_hash}",
        "fhir_hash": f"sha256:{fhir_hash}",
        "transform_timestamp": timestamp,
        "transform_version": "v1.0.0",
    }


def _compute_signal_hash(signal_dict: Dict[str, Any]) -> str:
    """
    Compute SHA-256 hash of canonical signal dictionary.

    Uses canonical JSON representation (sorted keys) for deterministic hashing.
    """
    canonical_json = json.dumps(signal_dict, sort_keys=True)
    return hashlib.sha256(canonical_json.encode("utf-8")).hexdigest()


def _compute_fhir_hash(observation: Dict[str, Any]) -> str:
    """
    Compute SHA-256 hash of FHIR Observation resource.

    Uses canonical JSON representation (sorted keys) for deterministic hashing.
    """
    canonical_json = json.dumps(observation, sort_keys=True)
    return hashlib.sha256(canonical_json.encode("utf-8")).hexdigest()
