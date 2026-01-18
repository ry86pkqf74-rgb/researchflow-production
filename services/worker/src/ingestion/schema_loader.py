"""
Schema Loader for Ingestion Layer (PR9A-1)

Loads and validates schema definitions from YAML or Python.

Schema Format (YAML):
  name: "my_dataset"
  version: "1.0.0"
  file_format: csv  # csv, tsv, parquet
  columns:
    - name: column1
      type: string
      required: true
      nullable: false
    - name: column2
      type: integer
      required: false
      nullable: true

Supported types: string, integer, float, boolean, datetime

Last Updated: 2026-01-09
"""

import hashlib
import importlib.util
import sys
import yaml
from dataclasses import dataclass, field
from pathlib import Path
from typing import List, Dict, Any, Optional, Literal


# =============================================================================
# SCHEMA DEFINITION CLASSES
# =============================================================================


@dataclass
class ColumnDefinition:
    """Single column definition in schema."""

    name: str
    type: Literal["string", "integer", "float", "boolean", "datetime"]
    required: bool = True
    nullable: bool = False
    description: Optional[str] = None

    def __post_init__(self):
        """Validate column definition."""
        if not self.name:
            raise ValueError("Column name cannot be empty")

        valid_types = {"string", "integer", "float", "boolean", "datetime"}
        if self.type not in valid_types:
            raise ValueError(
                f"Invalid column type '{self.type}'. Must be one of: {valid_types}"
            )


@dataclass
class SchemaDefinition:
    """Complete schema definition for ingestion."""

    name: str
    version: str
    file_format: Literal["csv", "tsv", "parquet"]
    columns: List[ColumnDefinition] = field(default_factory=list)
    description: Optional[str] = None
    metadata: Dict[str, Any] = field(default_factory=dict)

    def __post_init__(self):
        """Validate schema definition."""
        if not self.name:
            raise ValueError("Schema name cannot be empty")

        if not self.version:
            raise ValueError("Schema version cannot be empty")

        valid_formats = {"csv", "tsv", "parquet"}
        if self.file_format not in valid_formats:
            raise ValueError(
                f"Invalid file_format '{self.file_format}'. Must be one of: {valid_formats}"
            )

        if not self.columns:
            raise ValueError("Schema must define at least one column")

        # Check for duplicate column names
        col_names = [col.name for col in self.columns]
        duplicates = [name for name in col_names if col_names.count(name) > 1]
        if duplicates:
            raise ValueError(f"Duplicate column names detected: {set(duplicates)}")

    @property
    def required_columns(self) -> List[str]:
        """Get list of required column names."""
        return [col.name for col in self.columns if col.required]

    @property
    def column_names(self) -> List[str]:
        """Get list of all column names."""
        return [col.name for col in self.columns]

    def get_column(self, name: str) -> Optional[ColumnDefinition]:
        """Get column definition by name."""
        for col in self.columns:
            if col.name == name:
                return col
        return None


# =============================================================================
# SCHEMA LOADING
# =============================================================================


def load_schema(path: Path) -> SchemaDefinition:
    """
    Load schema definition from YAML file.

    Args:
        path: Path to schema YAML file

    Returns:
        SchemaDefinition object

    Raises:
        FileNotFoundError: If schema file not found
        ValueError: If schema is invalid
        yaml.YAMLError: If YAML is malformed
    """
    path = Path(path)

    if not path.exists():
        raise FileNotFoundError(f"Schema file not found: {path}")

    if path.suffix in {".yaml", ".yml"}:
        with open(path, "r", encoding="utf-8") as f:
            raw_schema = yaml.safe_load(f)

        if not isinstance(raw_schema, dict):
            raise ValueError("Schema YAML must be a dictionary")

        try:
            return _parse_schema_dict(raw_schema)
        except (KeyError, TypeError, ValueError) as e:
            raise ValueError(f"Invalid schema format: {e}") from e

    if path.suffix == ".py":
        return _load_python_schema(path)

    raise ValueError(f"Schema file must be YAML (.yaml/.yml) or Python (.py): {path}")


def _load_python_schema(path: Path) -> SchemaDefinition:
    """Load a schema defined in a Python file.

    Contract:
    - File must define a global `SCHEMA` of type SchemaDefinition.

    SECURITY NOTE (SANDBOX-only):
    Loading a Python schema executes arbitrary code from the schema file. Only
    use this in trusted, local SANDBOX workflows.
    """

    module_name = _python_schema_module_name(path)
    spec = importlib.util.spec_from_file_location(module_name, str(path))
    if spec is None or spec.loader is None:
        raise ValueError(f"Unable to load schema module: {path}")

    module = importlib.util.module_from_spec(spec)
    sys.modules[module_name] = module
    try:
        spec.loader.exec_module(module)  # type: ignore[union-attr]
    except Exception as e:
        raise ValueError(f"Error executing schema module: {e}") from e

    schema_obj = getattr(module, "SCHEMA", None)
    if not isinstance(schema_obj, SchemaDefinition):
        raise ValueError("Python schema must define `SCHEMA: SchemaDefinition`")

    return schema_obj


def _python_schema_module_name(path: Path) -> str:
    """Return a deterministic module name for a schema file path."""
    try:
        stable_input = str(path.resolve()).encode("utf-8")
        digest = hashlib.sha256(stable_input).hexdigest()[:16]
    except Exception:
        digest = f"{hash(str(path)) & 0xFFFFFFFF:x}"

    return f"_ros_ingestion_schema_{digest}"


def _parse_schema_dict(data: Dict[str, Any]) -> SchemaDefinition:
    """
    Parse schema dictionary into SchemaDefinition.

    Args:
        data: Raw schema dictionary from YAML

    Returns:
        SchemaDefinition object

    Raises:
        ValueError: If schema format is invalid
    """
    # Required fields
    name = data.get("name")
    version = data.get("version")
    file_format = data.get("file_format")

    if not name:
        raise ValueError("Schema must have 'name' field")
    if not version:
        raise ValueError("Schema must have 'version' field")
    if not file_format:
        raise ValueError("Schema must have 'file_format' field")

    # Optional fields
    description = data.get("description")
    metadata = data.get("metadata", {})

    # Parse columns
    columns_data = data.get("columns", [])
    if not columns_data:
        raise ValueError("Schema must define 'columns' list")

    columns = []
    for i, col_data in enumerate(columns_data):
        if not isinstance(col_data, dict):
            raise ValueError(f"Column {i} must be a dictionary")

        col = ColumnDefinition(
            name=col_data.get("name"),
            type=col_data.get("type"),
            required=col_data.get("required", True),
            nullable=col_data.get("nullable", False),
            description=col_data.get("description"),
        )
        columns.append(col)

    return SchemaDefinition(
        name=name,
        version=version,
        file_format=file_format,
        columns=columns,
        description=description,
        metadata=metadata,
    )


# =============================================================================
# PYTHON SCHEMA BUILDER (Alternative to YAML)
# =============================================================================


class SchemaBuilder:
    """
    Builder pattern for creating schema definitions in Python.

    Example:
        >>> schema = (SchemaBuilder("my_dataset", "1.0.0", "csv")
        ...           .add_column("id", "integer", required=True)
        ...           .add_column("name", "string", nullable=False)
        ...           .build())
    """

    def __init__(self, name: str, version: str, file_format: str):
        """Initialize schema builder."""
        self.name = name
        self.version = version
        self.file_format = file_format
        self.columns: List[ColumnDefinition] = []
        self.description: Optional[str] = None
        self.metadata: Dict[str, Any] = {}

    def add_column(
        self,
        name: str,
        type: str,
        required: bool = True,
        nullable: bool = False,
        description: Optional[str] = None,
    ) -> "SchemaBuilder":
        """Add column to schema (chainable)."""
        col = ColumnDefinition(
            name=name,
            type=type,
            required=required,
            nullable=nullable,
            description=description,
        )
        self.columns.append(col)
        return self

    def set_description(self, description: str) -> "SchemaBuilder":
        """Set schema description (chainable)."""
        self.description = description
        return self

    def add_metadata(self, key: str, value: Any) -> "SchemaBuilder":
        """Add metadata entry (chainable)."""
        self.metadata[key] = value
        return self

    def build(self) -> SchemaDefinition:
        """Build and validate schema definition."""
        return SchemaDefinition(
            name=self.name,
            version=self.version,
            file_format=self.file_format,
            columns=self.columns,
            description=self.description,
            metadata=self.metadata,
        )
