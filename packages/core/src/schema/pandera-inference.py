"""
Pandera Schema Inference Module

Automatically infers Pandera schemas from DataFrame samples with intelligent
type detection, constraint inference, and validation rule generation.

Features:
- Automatic type detection with coercion rules
- Nullable column detection
- Unique constraint inference
- Range/pattern detection for validation
- Export to JSON for versioning
"""

import pandera as pa
import pandas as pd
import numpy as np
from typing import Dict, Any, List, Optional
import json
from datetime import datetime


class SchemaInferenceConfig:
    """Configuration for schema inference behavior"""

    def __init__(
        self,
        strict: bool = True,
        infer_constraints: bool = True,
        sample_threshold: float = 0.95,
        null_threshold: float = 0.01,
        unique_threshold: float = 0.95
    ):
        """
        Args:
            strict: If True, enforce strict type validation
            infer_constraints: If True, infer min/max constraints
            sample_threshold: Fraction of samples that must pass for constraint
            null_threshold: Max fraction of nulls to consider non-nullable
            unique_threshold: Min fraction of unique values to consider unique
        """
        self.strict = strict
        self.infer_constraints = infer_constraints
        self.sample_threshold = sample_threshold
        self.null_threshold = null_threshold
        self.unique_threshold = unique_threshold


def infer_schema_from_dataframe(
    df: pd.DataFrame,
    schema_name: str,
    config: Optional[SchemaInferenceConfig] = None,
    column_descriptions: Optional[Dict[str, str]] = None
) -> pa.DataFrameSchema:
    """
    Infer Pandera schema from DataFrame with intelligent type detection.

    Args:
        df: DataFrame to infer schema from
        schema_name: Name for the schema
        config: Configuration for inference behavior
        column_descriptions: Optional descriptions for columns

    Returns:
        Inferred Pandera DataFrameSchema

    Example:
        >>> df = pd.DataFrame({
        ...     'patient_id': ['P001', 'P002', 'P003'],
        ...     'age': [45, 67, None],
        ...     'diagnosis': ['cancer', 'benign', 'cancer']
        ... })
        >>> schema = infer_schema_from_dataframe(df, 'patient_data')
        >>> validated_df = schema.validate(df)
    """
    if config is None:
        config = SchemaInferenceConfig()

    if column_descriptions is None:
        column_descriptions = {}

    column_schemas = {}

    for col in df.columns:
        column_schemas[col] = _infer_column_schema(
            df[col],
            col,
            config,
            column_descriptions.get(col)
        )

    return pa.DataFrameSchema(
        columns=column_schemas,
        name=schema_name,
        strict=config.strict,
        coerce=not config.strict,
        description=f"Auto-inferred schema for {schema_name}"
    )


def _infer_column_schema(
    series: pd.Series,
    col_name: str,
    config: SchemaInferenceConfig,
    description: Optional[str] = None
) -> pa.Column:
    """Infer schema for a single column"""

    # Detect dtype
    dtype = _infer_dtype(series)

    # Check nullability
    null_fraction = series.isnull().sum() / len(series)
    nullable = null_fraction > config.null_threshold

    # Check uniqueness
    non_null_series = series.dropna()
    if len(non_null_series) > 0:
        unique_fraction = non_null_series.nunique() / len(non_null_series)
        unique = unique_fraction >= config.unique_threshold
    else:
        unique = False

    # Infer checks/constraints
    checks = []
    if config.infer_constraints and len(non_null_series) > 0:
        checks = _infer_checks(non_null_series, dtype, config)

    return pa.Column(
        dtype=dtype,
        nullable=nullable,
        unique=unique,
        checks=checks if checks else None,
        coerce=not config.strict,
        description=description,
        title=col_name.replace('_', ' ').title()
    )


def _infer_dtype(series: pd.Series) -> Any:
    """Infer appropriate Pandera dtype from series"""

    # Remove nulls for type inference
    non_null = series.dropna()

    if len(non_null) == 0:
        return pa.Object  # Default for empty series

    # Check current pandas dtype
    if pd.api.types.is_integer_dtype(series):
        return pa.Int64
    elif pd.api.types.is_float_dtype(series):
        return pa.Float64
    elif pd.api.types.is_bool_dtype(series):
        return pa.Bool
    elif pd.api.types.is_datetime64_any_dtype(series):
        return pa.DateTime
    elif pd.api.types.is_string_dtype(series):
        return pa.String

    # Try to infer from string content
    if pd.api.types.is_object_dtype(series):
        # Try date parsing
        try:
            pd.to_datetime(non_null.head(100), errors='raise')
            return pa.DateTime
        except (ValueError, TypeError):
            pass

        # Try numeric parsing
        try:
            numeric_vals = pd.to_numeric(non_null.head(100), errors='raise')
            if (numeric_vals % 1 == 0).all():
                return pa.Int64
            else:
                return pa.Float64
        except (ValueError, TypeError):
            pass

        # Default to string
        return pa.String

    return pa.Object


def _infer_checks(
    series: pd.Series,
    dtype: Any,
    config: SchemaInferenceConfig
) -> List[pa.Check]:
    """Infer validation checks from data"""

    checks = []

    # Numeric constraints
    if dtype in [pa.Int64, pa.Float64]:
        min_val = series.min()
        max_val = series.max()

        # Add range check with some tolerance
        if pd.notna(min_val) and pd.notna(max_val):
            # Allow 10% tolerance for future values
            tolerance = (max_val - min_val) * 0.1
            checks.append(pa.Check.greater_than_or_equal_to(min_val - tolerance))
            checks.append(pa.Check.less_than_or_equal_to(max_val + tolerance))

    # String constraints
    elif dtype == pa.String:
        # Check for common patterns
        str_series = series.astype(str)

        # Email pattern
        if str_series.str.contains(r'^[\w\.-]+@[\w\.-]+\.\w+$', regex=True).mean() > 0.9:
            checks.append(
                pa.Check.str_matches(r'^[\w\.-]+@[\w\.-]+\.\w+$')
            )

        # Phone pattern (US format)
        elif str_series.str.contains(r'^\d{3}-\d{3}-\d{4}$', regex=True).mean() > 0.9:
            checks.append(
                pa.Check.str_matches(r'^\d{3}-\d{3}-\d{4}$')
            )

        # ID pattern (alphanumeric)
        elif str_series.str.contains(r'^[A-Z]\d{3,}$', regex=True).mean() > 0.9:
            checks.append(
                pa.Check.str_matches(r'^[A-Z]\d{3,}$')
            )

        # Min/max length
        min_len = str_series.str.len().min()
        max_len = str_series.str.len().max()
        if pd.notna(min_len) and min_len > 0:
            checks.append(pa.Check.str_length(min_value=max(1, min_len - 2)))
        if pd.notna(max_len):
            checks.append(pa.Check.str_length(max_value=max_len + 10))

    return checks


def schema_to_json(schema: pa.DataFrameSchema) -> Dict[str, Any]:
    """
    Export Pandera schema as JSON for versioning and storage.

    Args:
        schema: Pandera DataFrameSchema to export

    Returns:
        JSON-serializable dictionary
    """
    schema_dict = {
        "name": schema.name,
        "version": "1.0.0",  # Will be managed by versioning system
        "description": schema.description,
        "strict": schema.strict,
        "coerce": schema.coerce,
        "created_at": datetime.utcnow().isoformat(),
        "columns": {}
    }

    for col_name, col_schema in schema.columns.items():
        schema_dict["columns"][col_name] = {
            "dtype": str(col_schema.dtype),
            "nullable": col_schema.nullable,
            "unique": col_schema.unique,
            "coerce": col_schema.coerce,
            "description": col_schema.description,
            "title": col_schema.title,
            "checks": [_check_to_dict(check) for check in (col_schema.checks or [])]
        }

    return schema_dict


def _check_to_dict(check: pa.Check) -> Dict[str, Any]:
    """Convert Pandera Check to dictionary"""
    return {
        "name": check.name or check.__class__.__name__,
        "description": check.description,
        "error": check.error
    }


def schema_from_json(json_data: Dict[str, Any]) -> pa.DataFrameSchema:
    """
    Load Pandera schema from JSON.

    Args:
        json_data: Schema dictionary from schema_to_json

    Returns:
        Reconstructed Pandera DataFrameSchema
    """
    columns = {}

    for col_name, col_data in json_data.get("columns", {}).items():
        # Parse dtype (simplified - production would need full dtype mapping)
        dtype_str = col_data["dtype"]
        dtype = _parse_dtype_string(dtype_str)

        columns[col_name] = pa.Column(
            dtype=dtype,
            nullable=col_data.get("nullable", True),
            unique=col_data.get("unique", False),
            coerce=col_data.get("coerce", True),
            description=col_data.get("description"),
            title=col_data.get("title")
            # Note: Checks require more complex deserialization
        )

    return pa.DataFrameSchema(
        columns=columns,
        name=json_data.get("name"),
        strict=json_data.get("strict", False),
        coerce=json_data.get("coerce", True),
        description=json_data.get("description")
    )


def _parse_dtype_string(dtype_str: str) -> Any:
    """Parse dtype string back to Pandera dtype"""
    dtype_map = {
        "int64": pa.Int64,
        "float64": pa.Float64,
        "string": pa.String,
        "bool": pa.Bool,
        "datetime64[ns]": pa.DateTime,
        "object": pa.Object
    }

    # Simple string matching (production would be more robust)
    for key, dtype in dtype_map.items():
        if key in dtype_str.lower():
            return dtype

    return pa.Object


def compare_schemas(
    schema1: pa.DataFrameSchema,
    schema2: pa.DataFrameSchema
) -> Dict[str, Any]:
    """
    Compare two schemas and return differences.

    Args:
        schema1: First schema
        schema2: Second schema

    Returns:
        Dictionary describing differences
    """
    differences = {
        "columns_added": [],
        "columns_removed": [],
        "columns_modified": {},
        "compatible": True
    }

    cols1 = set(schema1.columns.keys())
    cols2 = set(schema2.columns.keys())

    differences["columns_added"] = list(cols2 - cols1)
    differences["columns_removed"] = list(cols1 - cols2)

    # Check modified columns
    for col in cols1 & cols2:
        col1 = schema1.columns[col]
        col2 = schema2.columns[col]

        changes = {}

        if str(col1.dtype) != str(col2.dtype):
            changes["dtype"] = {
                "old": str(col1.dtype),
                "new": str(col2.dtype)
            }
            differences["compatible"] = False

        if col1.nullable != col2.nullable:
            changes["nullable"] = {
                "old": col1.nullable,
                "new": col2.nullable
            }
            # Making non-nullable is breaking change
            if not col2.nullable:
                differences["compatible"] = False

        if changes:
            differences["columns_modified"][col] = changes

    # Removed columns or type changes = breaking
    if differences["columns_removed"]:
        differences["compatible"] = False

    return differences


# Example usage
if __name__ == "__main__":
    # Create sample DataFrame
    df = pd.DataFrame({
        'patient_id': ['P001', 'P002', 'P003', 'P004'],
        'age': [45, 67, 23, 89],
        'diagnosis': ['cancer', 'benign', 'cancer', None],
        'visit_date': pd.to_datetime(['2024-01-01', '2024-01-02', '2024-01-03', '2024-01-04']),
        'test_result': [12.5, 15.3, 10.1, 18.7]
    })

    # Infer schema
    schema = infer_schema_from_dataframe(
        df,
        'patient_data',
        column_descriptions={
            'patient_id': 'Unique patient identifier',
            'age': 'Patient age in years',
            'diagnosis': 'Diagnosis result'
        }
    )

    # Export to JSON
    schema_json = schema_to_json(schema)
    print(json.dumps(schema_json, indent=2))

    # Validate data
    try:
        validated_df = schema.validate(df)
        print("\n✓ Schema validation passed")
    except pa.errors.SchemaError as e:
        print(f"\n✗ Schema validation failed: {e}")
