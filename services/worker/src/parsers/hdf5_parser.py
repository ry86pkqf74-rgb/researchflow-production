"""
HDF5 File Parser

Parses HDF5 files using h5py.
"""

from __future__ import annotations

import logging
from pathlib import Path
from typing import Any, Dict, List, Optional

from .registry import BaseParser, ParseResult

logger = logging.getLogger(__name__)


class HDF5Parser(BaseParser):
    """Parser for HDF5 files."""

    @property
    def name(self) -> str:
        return "hdf5"

    @property
    def supported_extensions(self) -> List[str]:
        return ["h5", "hdf5", "hdf", "he5"]

    @property
    def supported_mimetypes(self) -> List[str]:
        return ["application/x-hdf5", "application/x-hdf"]

    def parse(
        self,
        file_path: Path,
        max_rows: Optional[int] = None,
        datasets: Optional[List[str]] = None,
        include_data: bool = True,
        **options
    ) -> ParseResult:
        """
        Parse an HDF5 file.

        Args:
            file_path: Path to the HDF5 file
            max_rows: Maximum rows per dataset (None for all)
            datasets: List of dataset paths to read (None for all)
            include_data: Whether to include data in result
            **options: Additional options

        Returns:
            ParseResult with parsed data
        """
        try:
            import h5py
            import numpy as np
        except ImportError:
            return ParseResult(
                success=False,
                format=self.name,
                errors=["h5py not installed. Install with: pip install h5py"],
            )

        try:
            with h5py.File(file_path, 'r') as f:
                # Discover structure
                structure = self._explore_group(f, max_depth=10)

                # Extract schema
                schema_info = self._extract_schema(f, structure)

                # Read data if requested
                data = None
                total_records = 0

                if include_data:
                    data = {}
                    for ds_path in structure.get("datasets", []):
                        if datasets and ds_path not in datasets:
                            continue

                        try:
                            ds = f[ds_path]
                            if isinstance(ds, h5py.Dataset):
                                if max_rows and ds.shape and ds.shape[0] > max_rows:
                                    arr = ds[:max_rows]
                                else:
                                    arr = ds[:]

                                # Convert numpy arrays to Python types
                                if isinstance(arr, np.ndarray):
                                    if arr.dtype.kind == 'S' or arr.dtype.kind == 'U':
                                        arr = arr.astype(str).tolist()
                                    elif arr.ndim <= 2 and arr.size <= 10000:
                                        arr = arr.tolist()
                                    else:
                                        # For large arrays, just store shape and dtype
                                        arr = {
                                            "shape": list(ds.shape),
                                            "dtype": str(ds.dtype),
                                            "size": ds.size,
                                            "_truncated": True,
                                        }

                                data[ds_path] = arr
                                total_records += ds.shape[0] if ds.shape else 1
                        except Exception as e:
                            logger.warning(f"Could not read dataset {ds_path}: {e}")

                # Get file attributes
                file_attrs = dict(f.attrs) if f.attrs else {}
                # Convert numpy types to Python types
                file_attrs = self._convert_attrs(file_attrs)

                return ParseResult(
                    success=True,
                    format=self.name,
                    record_count=total_records if include_data else None,
                    columns=structure.get("datasets", []),
                    schema=schema_info,
                    data=data,
                    metadata={
                        "groups": structure.get("groups", []),
                        "num_datasets": len(structure.get("datasets", [])),
                        "num_groups": len(structure.get("groups", [])),
                        "file_attrs": file_attrs,
                        "driver": f.driver,
                        "libver": f.libver,
                    },
                )

        except Exception as e:
            logger.exception(f"Error parsing HDF5 file: {e}")
            return ParseResult(
                success=False,
                format=self.name,
                errors=[str(e)],
            )

    def _explore_group(
        self,
        group,
        prefix: str = "",
        max_depth: int = 10,
        current_depth: int = 0
    ) -> Dict[str, List[str]]:
        """Recursively explore HDF5 group structure."""
        import h5py

        result = {"groups": [], "datasets": []}

        if current_depth >= max_depth:
            return result

        for key in group.keys():
            path = f"{prefix}/{key}" if prefix else key
            item = group[key]

            if isinstance(item, h5py.Group):
                result["groups"].append(path)
                # Recurse into subgroups
                sub_result = self._explore_group(
                    item, path, max_depth, current_depth + 1
                )
                result["groups"].extend(sub_result["groups"])
                result["datasets"].extend(sub_result["datasets"])
            elif isinstance(item, h5py.Dataset):
                result["datasets"].append(path)

        return result

    def _extract_schema(self, f, structure: Dict) -> Dict[str, Any]:
        """Extract schema information from HDF5 file."""
        import h5py

        datasets_schema = {}
        for ds_path in structure.get("datasets", []):
            try:
                ds = f[ds_path]
                if isinstance(ds, h5py.Dataset):
                    datasets_schema[ds_path] = {
                        "shape": list(ds.shape),
                        "dtype": str(ds.dtype),
                        "chunks": list(ds.chunks) if ds.chunks else None,
                        "compression": ds.compression,
                        "compression_opts": ds.compression_opts,
                        "maxshape": list(ds.maxshape) if ds.maxshape else None,
                        "attrs": self._convert_attrs(dict(ds.attrs)),
                    }
            except Exception as e:
                logger.warning(f"Could not extract schema for {ds_path}: {e}")

        return {
            "datasets": datasets_schema,
            "groups": structure.get("groups", []),
        }

    def _convert_attrs(self, attrs: Dict) -> Dict:
        """Convert numpy types in attributes to Python types."""
        import numpy as np

        result = {}
        for k, v in attrs.items():
            if isinstance(v, np.ndarray):
                if v.size <= 100:
                    result[k] = v.tolist()
                else:
                    result[k] = f"<array shape={v.shape}>"
            elif isinstance(v, (np.integer, np.floating)):
                result[k] = v.item()
            elif isinstance(v, bytes):
                result[k] = v.decode('utf-8', errors='replace')
            else:
                result[k] = v
        return result


def list_hdf5_datasets(file_path: Path) -> List[str]:
    """
    List all datasets in an HDF5 file.

    Args:
        file_path: Path to the HDF5 file

    Returns:
        List of dataset paths
    """
    parser = HDF5Parser()
    result = parser.parse(file_path, include_data=False)
    return result.columns if result.success else []


def read_hdf5_dataset(
    file_path: Path,
    dataset_path: str,
    max_rows: Optional[int] = None,
) -> Optional[Any]:
    """
    Read a specific dataset from an HDF5 file.

    Args:
        file_path: Path to the HDF5 file
        dataset_path: Path to the dataset within the file
        max_rows: Maximum rows to read

    Returns:
        Dataset data or None if not found
    """
    parser = HDF5Parser()
    result = parser.parse(
        file_path,
        datasets=[dataset_path],
        max_rows=max_rows,
    )
    if result.success and result.data:
        return result.data.get(dataset_path)
    return None
