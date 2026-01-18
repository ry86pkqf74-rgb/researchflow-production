"""Canonical data schemas and contracts.

This package contains versioned canonical schemas that serve as neutral
interchange formats between external systems (e.g., FHIR) and internal
research datasets.

Submodules:
    signals: Canonical signal schema for patient-generated observations
"""

from src.canonical.signals import SignalSchemaV1, validate_signals

__all__ = ["SignalSchemaV1", "validate_signals"]
