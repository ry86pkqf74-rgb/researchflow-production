"""
Schema Inference

Automatically infers data schemas from various data sources.
"""

from __future__ import annotations

import json
import logging
import re
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional, Union

from src.provenance.artifact_store import store_text, new_run_id

logger = logging.getLogger(__name__)


@dataclass
class ColumnSchema:
    """Schema information for a single column."""
    name: str
    inferred_type: str  # string, integer, float, boolean, datetime, array, object
    nullable: bool
    unique_values: Optional[int] = None
    null_count: int = 0
    sample_values: List[Any] = field(default_factory=list)
    min_value: Optional[Any] = None
    max_value: Optional[Any] = None
    mean_value: Optional[float] = None
    pattern: Optional[str] = None  # Detected pattern (e.g., email, phone)
    description: Optional[str] = None


@dataclass
class InferredSchema:
    """Complete inferred schema for a dataset."""
    columns: List[ColumnSchema]
    record_count: int
    column_count: int
    inferred_at: str
    source: Optional[str] = None
    format: Optional[str] = None
    primary_key_candidates: List[str] = field(default_factory=list)
    foreign_key_candidates: List[Dict[str, str]] = field(default_factory=list)
    metadata: Dict[str, Any] = field(default_factory=dict)


class SchemaInference:
    """
    Automatic schema inference for tabular data.

    Supports:
    - Pandas DataFrames
    - CSV/Excel files
    - Parquet files
    - JSON/JSONL files
    - Lists of dictionaries
    """

    # Common patterns for type detection
    PATTERNS = {
        "email": re.compile(r"^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$"),
        "phone": re.compile(r"^[\+]?[(]?[0-9]{3}[)]?[-\s\.]?[0-9]{3}[-\s\.]?[0-9]{4,6}$"),
        "url": re.compile(r"^https?://[^\s]+$"),
        "uuid": re.compile(r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$", re.I),
        "ipv4": re.compile(r"^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$"),
        "date": re.compile(r"^\d{4}-\d{2}-\d{2}$"),
        "datetime": re.compile(r"^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}"),
        "ssn": re.compile(r"^\d{3}-\d{2}-\d{4}$"),
        "zip_code": re.compile(r"^\d{5}(-\d{4})?$"),
    }

    def __init__(self, sample_size: int = 1000):
        """
        Initialize schema inference.

        Args:
            sample_size: Number of rows to sample for inference
        """
        self.sample_size = sample_size

    def infer_from_dataframe(
        self,
        df,
        source: Optional[str] = None,
    ) -> InferredSchema:
        """
        Infer schema from a pandas DataFrame.

        Args:
            df: pandas DataFrame
            source: Optional source identifier

        Returns:
            InferredSchema object
        """
        import pandas as pd
        import numpy as np

        columns = []
        pk_candidates = []

        for col in df.columns:
            col_data = df[col]

            # Determine type
            inferred_type = self._infer_column_type(col_data)

            # Calculate statistics
            null_count = int(col_data.isna().sum())
            non_null_count = len(col_data) - null_count

            unique_count = None
            if non_null_count > 0:
                try:
                    unique_count = col_data.nunique()
                except Exception:
                    pass

            # Get sample values
            sample_values = []
            try:
                non_null = col_data.dropna()
                if len(non_null) > 0:
                    sample = non_null.head(5).tolist()
                    sample_values = [
                        self._convert_to_json_safe(v) for v in sample
                    ]
            except Exception:
                pass

            # Calculate min/max/mean for numeric types
            min_val = max_val = mean_val = None
            if inferred_type in ("integer", "float"):
                try:
                    numeric_data = pd.to_numeric(col_data, errors="coerce")
                    min_val = self._convert_to_json_safe(numeric_data.min())
                    max_val = self._convert_to_json_safe(numeric_data.max())
                    mean_val = float(numeric_data.mean()) if not pd.isna(numeric_data.mean()) else None
                except Exception:
                    pass

            # Detect patterns
            pattern = self._detect_pattern(col_data)

            col_schema = ColumnSchema(
                name=str(col),
                inferred_type=inferred_type,
                nullable=null_count > 0,
                unique_values=unique_count,
                null_count=null_count,
                sample_values=sample_values,
                min_value=min_val,
                max_value=max_val,
                mean_value=mean_val,
                pattern=pattern,
            )
            columns.append(col_schema)

            # Check for primary key candidate
            if unique_count == len(df) and null_count == 0:
                pk_candidates.append(str(col))

        return InferredSchema(
            columns=columns,
            record_count=len(df),
            column_count=len(df.columns),
            inferred_at=datetime.utcnow().isoformat() + "Z",
            source=source,
            format="dataframe",
            primary_key_candidates=pk_candidates,
            metadata={
                "dtypes": {str(k): str(v) for k, v in df.dtypes.items()},
                "memory_usage_mb": df.memory_usage(deep=True).sum() / 1024 / 1024,
            },
        )

    def infer_from_records(
        self,
        records: List[Dict[str, Any]],
        source: Optional[str] = None,
    ) -> InferredSchema:
        """
        Infer schema from a list of dictionaries.

        Args:
            records: List of record dictionaries
            source: Optional source identifier

        Returns:
            InferredSchema object
        """
        if not records:
            return InferredSchema(
                columns=[],
                record_count=0,
                column_count=0,
                inferred_at=datetime.utcnow().isoformat() + "Z",
                source=source,
                format="records",
            )

        try:
            import pandas as pd
            df = pd.DataFrame(records[:self.sample_size])
            return self.infer_from_dataframe(df, source)
        except ImportError:
            # Fallback without pandas
            return self._infer_without_pandas(records, source)

    def _infer_without_pandas(
        self,
        records: List[Dict[str, Any]],
        source: Optional[str],
    ) -> InferredSchema:
        """Infer schema without pandas (basic implementation)."""
        if not records:
            return InferredSchema(
                columns=[],
                record_count=0,
                column_count=0,
                inferred_at=datetime.utcnow().isoformat() + "Z",
                source=source,
            )

        # Collect all column names
        all_columns = set()
        for record in records[:self.sample_size]:
            all_columns.update(record.keys())

        columns = []
        for col in sorted(all_columns):
            values = [r.get(col) for r in records[:self.sample_size]]
            non_null = [v for v in values if v is not None]

            # Infer type from values
            inferred_type = "string"
            if non_null:
                sample = non_null[0]
                if isinstance(sample, bool):
                    inferred_type = "boolean"
                elif isinstance(sample, int):
                    inferred_type = "integer"
                elif isinstance(sample, float):
                    inferred_type = "float"
                elif isinstance(sample, list):
                    inferred_type = "array"
                elif isinstance(sample, dict):
                    inferred_type = "object"

            columns.append(ColumnSchema(
                name=col,
                inferred_type=inferred_type,
                nullable=len(non_null) < len(values),
                unique_values=len(set(str(v) for v in non_null)) if non_null else 0,
                null_count=len(values) - len(non_null),
                sample_values=non_null[:5],
            ))

        return InferredSchema(
            columns=columns,
            record_count=len(records),
            column_count=len(all_columns),
            inferred_at=datetime.utcnow().isoformat() + "Z",
            source=source,
            format="records",
        )

    def _infer_column_type(self, col_data) -> str:
        """Infer the type of a pandas column."""
        import pandas as pd
        import numpy as np

        dtype = col_data.dtype

        # Check pandas dtype
        if pd.api.types.is_bool_dtype(dtype):
            return "boolean"
        elif pd.api.types.is_integer_dtype(dtype):
            return "integer"
        elif pd.api.types.is_float_dtype(dtype):
            return "float"
        elif pd.api.types.is_datetime64_any_dtype(dtype):
            return "datetime"

        # For object dtype, check actual values
        if dtype == object:
            non_null = col_data.dropna()
            if len(non_null) == 0:
                return "string"

            sample = non_null.iloc[0]

            if isinstance(sample, bool):
                return "boolean"
            elif isinstance(sample, (list, np.ndarray)):
                return "array"
            elif isinstance(sample, dict):
                return "object"

            # Try to parse as numeric
            try:
                numeric = pd.to_numeric(non_null.head(100), errors="raise")
                if numeric.dtype.kind in "iu":
                    return "integer"
                return "float"
            except Exception:
                pass

            # Try to parse as datetime
            try:
                pd.to_datetime(non_null.head(100), errors="raise")
                return "datetime"
            except Exception:
                pass

        return "string"

    def _detect_pattern(self, col_data) -> Optional[str]:
        """Detect common patterns in string columns."""
        try:
            non_null = col_data.dropna().astype(str).head(100)
            if len(non_null) == 0:
                return None

            for pattern_name, regex in self.PATTERNS.items():
                matches = non_null.str.match(regex, na=False)
                if matches.sum() / len(matches) > 0.8:
                    return pattern_name

        except Exception:
            pass

        return None

    def _convert_to_json_safe(self, value) -> Any:
        """Convert value to JSON-safe type."""
        import numpy as np

        if value is None or (isinstance(value, float) and np.isnan(value)):
            return None
        elif isinstance(value, (np.integer, np.int64, np.int32)):
            return int(value)
        elif isinstance(value, (np.floating, np.float64, np.float32)):
            return float(value)
        elif isinstance(value, np.ndarray):
            return value.tolist()
        elif hasattr(value, "isoformat"):
            return value.isoformat()
        return value


def infer_schema(
    data: Union[Any, List[Dict]],
    source: Optional[str] = None,
    save_artifact: bool = False,
) -> InferredSchema:
    """
    Infer schema from data.

    Args:
        data: DataFrame or list of dictionaries
        source: Source identifier
        save_artifact: Whether to save as artifact

    Returns:
        InferredSchema object
    """
    inference = SchemaInference()

    # Check if it's a DataFrame
    try:
        import pandas as pd
        if isinstance(data, pd.DataFrame):
            result = inference.infer_from_dataframe(data, source)
        else:
            result = inference.infer_from_records(data, source)
    except ImportError:
        result = inference.infer_from_records(data, source)

    # Save artifact if requested
    if save_artifact:
        try:
            run_id = new_run_id("schema_inference")

            # Convert to dict for JSON
            schema_dict = {
                "columns": [
                    {
                        "name": c.name,
                        "type": c.inferred_type,
                        "nullable": c.nullable,
                        "unique_values": c.unique_values,
                        "null_count": c.null_count,
                        "sample_values": c.sample_values,
                        "min_value": c.min_value,
                        "max_value": c.max_value,
                        "mean_value": c.mean_value,
                        "pattern": c.pattern,
                    }
                    for c in result.columns
                ],
                "record_count": result.record_count,
                "column_count": result.column_count,
                "inferred_at": result.inferred_at,
                "source": result.source,
                "format": result.format,
                "primary_key_candidates": result.primary_key_candidates,
                "metadata": result.metadata,
            }

            store_text(
                run_id=run_id,
                category="schema_inference",
                filename="schema.json",
                text=json.dumps(schema_dict, indent=2, default=str),
            )

            result.metadata["artifact_run_id"] = run_id
            logger.info(f"Saved schema artifact: {run_id}")

        except Exception as e:
            logger.warning(f"Failed to save artifact: {e}")

    return result


def infer_schema_from_file(
    file_path: Union[str, Path],
    save_artifact: bool = False,
) -> InferredSchema:
    """
    Infer schema from a file.

    Args:
        file_path: Path to the data file
        save_artifact: Whether to save as artifact

    Returns:
        InferredSchema object
    """
    path = Path(file_path)
    ext = path.suffix.lower()

    try:
        import pandas as pd

        if ext == ".csv":
            df = pd.read_csv(path, nrows=10000)
        elif ext in (".xlsx", ".xls"):
            df = pd.read_excel(path, nrows=10000)
        elif ext == ".parquet":
            df = pd.read_parquet(path)
        elif ext in (".json", ".jsonl"):
            df = pd.read_json(path, lines=(ext == ".jsonl"), nrows=10000)
        else:
            raise ValueError(f"Unsupported file format: {ext}")

        result = infer_schema(df, source=str(path), save_artifact=save_artifact)
        result.format = ext.lstrip(".")
        return result

    except ImportError:
        raise RuntimeError("pandas is required for file-based schema inference")
