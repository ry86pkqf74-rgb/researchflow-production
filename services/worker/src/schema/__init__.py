"""
Schema Module

Provides automatic schema inference and data dictionary generation.
"""

from .infer_schema import (
    SchemaInference,
    InferredSchema,
    ColumnSchema,
    infer_schema,
    infer_schema_from_file,
)

__all__ = [
    "SchemaInference",
    "InferredSchema",
    "ColumnSchema",
    "infer_schema",
    "infer_schema_from_file",
]
