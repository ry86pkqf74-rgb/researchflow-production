"""
Parquet File Parser
"""

from __future__ import annotations

import logging
from pathlib import Path

from .registry import ParseResult, register_parser

logger = logging.getLogger(__name__)


@register_parser('parquet')
def parse_parquet(file_path: str) -> ParseResult:
    """
    Parse a Parquet file into a DataFrame.

    Args:
        file_path: Path to Parquet file

    Returns:
        ParseResult with DataFrame
    """
    try:
        import pandas as pd

        df = pd.read_parquet(file_path)

        metadata = {
            'file_path': file_path,
            'file_size': Path(file_path).stat().st_size,
            'columns': list(df.columns),
            'dtypes': {col: str(dtype) for col, dtype in df.dtypes.items()},
        }

        return ParseResult(
            success=True,
            data=df,
            metadata=metadata,
            format='parquet',
            row_count=len(df),
            column_count=len(df.columns)
        )

    except ImportError:
        return ParseResult(
            success=False,
            data=None,
            metadata={'file_path': file_path},
            format='parquet',
            error="pyarrow or fastparquet not installed"
        )
    except Exception as e:
        logger.exception(f"Error parsing parquet: {e}")
        return ParseResult(
            success=False,
            data=None,
            metadata={'file_path': file_path},
            format='parquet',
            error=str(e)
        )
