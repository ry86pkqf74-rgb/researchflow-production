"""
HDF5 File Parser
"""

from __future__ import annotations

import logging
from pathlib import Path
from typing import Dict, Any

from .registry import ParseResult, register_parser

logger = logging.getLogger(__name__)


@register_parser('h5')
@register_parser('hdf5')
@register_parser('hdf')
def parse_hdf5(file_path: str) -> ParseResult:
    """
    Parse an HDF5 file.

    Args:
        file_path: Path to HDF5 file

    Returns:
        ParseResult with data
    """
    try:
        import h5py
        import pandas as pd

        with h5py.File(file_path, 'r') as f:
            # Get structure info
            datasets = []
            groups = []

            def visit_item(name, obj):
                if isinstance(obj, h5py.Dataset):
                    datasets.append({
                        'name': name,
                        'shape': obj.shape,
                        'dtype': str(obj.dtype)
                    })
                elif isinstance(obj, h5py.Group):
                    groups.append(name)

            f.visititems(visit_item)

            # Try to read as DataFrame if single dataset or common patterns
            df = None

            # Check for pandas-style HDF5
            try:
                df = pd.read_hdf(file_path)
            except (KeyError, ValueError):
                # Not a pandas HDF5, try first dataset
                if datasets:
                    first_ds = datasets[0]['name']
                    data = f[first_ds][:]

                    # Convert to DataFrame if 2D
                    if len(data.shape) == 2:
                        df = pd.DataFrame(data)
                    elif len(data.shape) == 1:
                        df = pd.DataFrame({'data': data})

            metadata = {
                'file_path': file_path,
                'file_size': Path(file_path).stat().st_size,
                'datasets': datasets,
                'groups': groups,
            }

            if df is not None:
                metadata['columns'] = list(df.columns)
                return ParseResult(
                    success=True,
                    data=df,
                    metadata=metadata,
                    format='hdf5',
                    row_count=len(df),
                    column_count=len(df.columns)
                )
            else:
                return ParseResult(
                    success=True,
                    data={'datasets': datasets, 'groups': groups},
                    metadata=metadata,
                    format='hdf5'
                )

    except ImportError as e:
        return ParseResult(
            success=False,
            data=None,
            metadata={'file_path': file_path},
            format='hdf5',
            error=f"Required package not installed: {e}"
        )
    except Exception as e:
        logger.exception(f"Error parsing HDF5: {e}")
        return ParseResult(
            success=False,
            data=None,
            metadata={'file_path': file_path},
            format='hdf5',
            error=str(e)
        )
