"""
Pandera schema shim for the Heart Disease sample dataset.

This module re-exports the single source of truth from src/ to preserve backward compatibility.
"""

from src.schemas.pandera.heart_disease_schema import (
    HeartDiseaseSchema,
    validate,
    __version__,
)

__all__ = ["HeartDiseaseSchema", "validate", "__version__"]
