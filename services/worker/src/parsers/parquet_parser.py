"""
Parquet File Parser

Parses Apache Parquet files using pyarrow.
"""

from __future__ import annotations

import logging
from pathlib import Path
from typing import Any, Dict, List, Optional

from .registry import BaseParser, ParseResult

logger = logging.getLogger(__name__)


class ParquetParser(BaseParser):
    """Parser for Apache Parquet files."""

    @property
    def name(self) -> str:
        return "parquet"

    @property
    def supported_extensions(self) -> List[str]:
        return ["parquet", "pq", "parq"]

    @property
    def supported_mimetypes(self) -> List[str]:
        return ["application/vnd.apache.parquet", "application/x-parquet"]

    def parse(
        self,
        file_path: Path,
        max_rows: Optional[int] = None,
        columns: Optional[List[str]] = None,
        include_data: bool = True,
        **options
    ) -> ParseResult:
        """
        Parse a Parquet file.

        Args:
            file_path: Path to the Parquet file
            max_rows: Maximum number of rows to read (None for all)
            columns: List of columns to read (None for all)
            include_data: Whether to include data in result
            **options: Additional options

        Returns:
            ParseResult with parsed data
        """
        try:
            import pyarrow.parquet as pq
        except ImportError:
            return ParseResult(
                success=False,
                format=self.name,
                errors=["pyarrow not installed. Install with: pip install pyarrow"],
            )

        try:
            # Read Parquet file
            parquet_file = pq.ParquetFile(file_path)

            # Get metadata
            metadata = parquet_file.metadata
            schema = parquet_file.schema_arrow

            # Extract schema information
            schema_info = self._extract_schema(schema)

            # Read data
            if include_data:
                if max_rows:
                    table = parquet_file.read_row_groups(
                        range(min(parquet_file.metadata.num_row_groups,
                              (max_rows // 1000) + 1)),
                        columns=columns
                    )
                    if len(table) > max_rows:
                        table = table.slice(0, max_rows)
                else:
                    table = parquet_file.read(columns=columns)

                df = table.to_pandas()
                data = df.to_dict(orient="records") if len(df) <= 1000 else None
                record_count = len(df)
                column_names = list(df.columns)
            else:
                data = None
                record_count = metadata.num_rows
                column_names = [field.name for field in schema]

            return ParseResult(
                success=True,
                format=self.name,
                record_count=record_count,
                columns=column_names,
                schema=schema_info,
                data=data,
                metadata={
                    "num_row_groups": metadata.num_row_groups,
                    "num_columns": metadata.num_columns,
                    "created_by": metadata.created_by,
                    "format_version": str(metadata.format_version),
                    "serialized_size": metadata.serialized_size,
                    "compression": self._get_compression_info(parquet_file),
                },
            )

        except Exception as e:
            logger.exception(f"Error parsing Parquet file: {e}")
            return ParseResult(
                success=False,
                format=self.name,
                errors=[str(e)],
            )

    def _extract_schema(self, schema) -> Dict[str, Any]:
        """Extract schema information from PyArrow schema."""
        fields = {}
        for field in schema:
            fields[field.name] = {
                "type": str(field.type),
                "nullable": field.nullable,
            }
            if field.metadata:
                fields[field.name]["metadata"] = {
                    k.decode(): v.decode()
                    for k, v in field.metadata.items()
                }
        return {
            "fields": fields,
            "pandas_metadata": self._extract_pandas_metadata(schema),
        }

    def _extract_pandas_metadata(self, schema) -> Optional[Dict[str, Any]]:
        """Extract pandas metadata if present."""
        if schema.pandas_metadata:
            return {
                "columns": [c["name"] for c in schema.pandas_metadata.get("columns", [])],
                "index_columns": schema.pandas_metadata.get("index_columns", []),
                "pandas_version": schema.pandas_metadata.get("pandas_version"),
            }
        return None

    def _get_compression_info(self, parquet_file) -> Optional[str]:
        """Get compression information from first row group."""
        try:
            if parquet_file.metadata.num_row_groups > 0:
                row_group = parquet_file.metadata.row_group(0)
                if row_group.num_columns > 0:
                    return str(row_group.column(0).compression)
        except Exception:
            pass
        return None


def read_parquet_schema(file_path: Path) -> Dict[str, Any]:
    """
    Read only the schema from a Parquet file (no data).

    Args:
        file_path: Path to the Parquet file

    Returns:
        Schema dictionary
    """
    parser = ParquetParser()
    result = parser.parse(file_path, include_data=False)
    return result.schema if result.success else {}


def read_parquet_sample(
    file_path: Path,
    n_rows: int = 100,
    columns: Optional[List[str]] = None,
) -> List[Dict[str, Any]]:
    """
    Read a sample of rows from a Parquet file.

    Args:
        file_path: Path to the Parquet file
        n_rows: Number of rows to read
        columns: Columns to include

    Returns:
        List of row dictionaries
    """
    parser = ParquetParser()
    result = parser.parse(file_path, max_rows=n_rows, columns=columns)
    return result.data if result.success and result.data else []
