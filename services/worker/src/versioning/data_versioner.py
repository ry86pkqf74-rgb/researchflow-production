"""
Data Versioning

Tracks versions of datasets and transformations for reproducibility.
"""

from __future__ import annotations

import hashlib
import json
import logging
import os
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)


@dataclass
class DataVersion:
    """A single data version"""
    version_id: str
    dataset_id: str
    version_number: int
    created_at: str
    content_hash: str
    row_count: Optional[int] = None
    column_count: Optional[int] = None
    schema_hash: Optional[str] = None
    metadata: Dict[str, Any] = field(default_factory=dict)
    parent_version: Optional[str] = None
    transformation: Optional[str] = None


@dataclass
class VersionHistory:
    """History of all versions for a dataset"""
    dataset_id: str
    versions: List[DataVersion]
    current_version: int
    total_versions: int


class DataVersioner:
    """
    Tracks data versions for reproducibility.

    Features:
    - Content-based hashing
    - Schema change detection
    - Parent-child relationships
    - Transformation tracking
    """

    def __init__(self, storage_path: str = ".tmp/versions"):
        """
        Initialize versioner.

        Args:
            storage_path: Path to store version metadata
        """
        self.storage_path = Path(storage_path)
        self.storage_path.mkdir(parents=True, exist_ok=True)
        self._cache: Dict[str, VersionHistory] = {}

    def _compute_content_hash(self, data: Any) -> str:
        """Compute hash of data content"""
        try:
            import pandas as pd

            if isinstance(data, pd.DataFrame):
                # Hash DataFrame content
                content = data.to_csv(index=False).encode('utf-8')
            elif isinstance(data, (dict, list)):
                content = json.dumps(data, sort_keys=True, default=str).encode('utf-8')
            elif isinstance(data, bytes):
                content = data
            elif isinstance(data, str):
                content = data.encode('utf-8')
            else:
                content = str(data).encode('utf-8')

            return hashlib.sha256(content).hexdigest()[:16]

        except Exception as e:
            logger.warning(f"Failed to compute content hash: {e}")
            return hashlib.sha256(str(datetime.utcnow()).encode()).hexdigest()[:16]

    def _compute_schema_hash(self, data: Any) -> Optional[str]:
        """Compute hash of data schema"""
        try:
            import pandas as pd

            if isinstance(data, pd.DataFrame):
                schema = {
                    'columns': list(data.columns),
                    'dtypes': {str(k): str(v) for k, v in data.dtypes.items()}
                }
                return hashlib.sha256(
                    json.dumps(schema, sort_keys=True).encode()
                ).hexdigest()[:12]
            return None
        except Exception:
            return None

    def _load_history(self, dataset_id: str) -> VersionHistory:
        """Load version history from storage"""
        if dataset_id in self._cache:
            return self._cache[dataset_id]

        history_file = self.storage_path / f"{dataset_id}_history.json"

        if history_file.exists():
            with open(history_file, 'r') as f:
                data = json.load(f)

            versions = [
                DataVersion(
                    version_id=v['version_id'],
                    dataset_id=v['dataset_id'],
                    version_number=v['version_number'],
                    created_at=v['created_at'],
                    content_hash=v['content_hash'],
                    row_count=v.get('row_count'),
                    column_count=v.get('column_count'),
                    schema_hash=v.get('schema_hash'),
                    metadata=v.get('metadata', {}),
                    parent_version=v.get('parent_version'),
                    transformation=v.get('transformation')
                )
                for v in data.get('versions', [])
            ]

            history = VersionHistory(
                dataset_id=dataset_id,
                versions=versions,
                current_version=data.get('current_version', len(versions)),
                total_versions=len(versions)
            )
        else:
            history = VersionHistory(
                dataset_id=dataset_id,
                versions=[],
                current_version=0,
                total_versions=0
            )

        self._cache[dataset_id] = history
        return history

    def _save_history(self, history: VersionHistory) -> None:
        """Save version history to storage"""
        history_file = self.storage_path / f"{history.dataset_id}_history.json"

        data = {
            'dataset_id': history.dataset_id,
            'current_version': history.current_version,
            'versions': [
                {
                    'version_id': v.version_id,
                    'dataset_id': v.dataset_id,
                    'version_number': v.version_number,
                    'created_at': v.created_at,
                    'content_hash': v.content_hash,
                    'row_count': v.row_count,
                    'column_count': v.column_count,
                    'schema_hash': v.schema_hash,
                    'metadata': v.metadata,
                    'parent_version': v.parent_version,
                    'transformation': v.transformation
                }
                for v in history.versions
            ]
        }

        with open(history_file, 'w') as f:
            json.dump(data, f, indent=2)

        self._cache[history.dataset_id] = history

    def create_version(
        self,
        dataset_id: str,
        data: Any,
        transformation: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None
    ) -> DataVersion:
        """
        Create a new version of a dataset.

        Args:
            dataset_id: Unique dataset identifier
            data: The data to version
            transformation: Description of transformation applied
            metadata: Optional metadata

        Returns:
            DataVersion object
        """
        history = self._load_history(dataset_id)

        # Compute hashes
        content_hash = self._compute_content_hash(data)
        schema_hash = self._compute_schema_hash(data)

        # Check if content already exists
        for existing in history.versions:
            if existing.content_hash == content_hash:
                logger.info(f"Content unchanged, returning existing version {existing.version_number}")
                return existing

        # Get data dimensions
        row_count = None
        column_count = None
        try:
            import pandas as pd
            if isinstance(data, pd.DataFrame):
                row_count, column_count = data.shape
            elif isinstance(data, list):
                row_count = len(data)
        except Exception:
            pass

        # Determine parent version
        parent_version = None
        if history.versions:
            parent_version = history.versions[-1].version_id

        # Create new version
        version_number = history.current_version + 1
        version_id = f"{dataset_id}_v{version_number}_{content_hash[:8]}"

        version = DataVersion(
            version_id=version_id,
            dataset_id=dataset_id,
            version_number=version_number,
            created_at=datetime.utcnow().isoformat(),
            content_hash=content_hash,
            row_count=row_count,
            column_count=column_count,
            schema_hash=schema_hash,
            metadata=metadata or {},
            parent_version=parent_version,
            transformation=transformation
        )

        # Update history
        history.versions.append(version)
        history.current_version = version_number
        history.total_versions = len(history.versions)

        self._save_history(history)

        logger.info(f"Created version {version_number} for dataset {dataset_id}")
        return version

    def get_version(
        self,
        dataset_id: str,
        version_number: Optional[int] = None
    ) -> Optional[DataVersion]:
        """
        Get a specific version.

        Args:
            dataset_id: Dataset identifier
            version_number: Version number (latest if not specified)

        Returns:
            DataVersion or None
        """
        history = self._load_history(dataset_id)

        if not history.versions:
            return None

        if version_number is None:
            return history.versions[-1]

        for v in history.versions:
            if v.version_number == version_number:
                return v

        return None

    def get_history(self, dataset_id: str) -> VersionHistory:
        """
        Get full version history.

        Args:
            dataset_id: Dataset identifier

        Returns:
            VersionHistory object
        """
        return self._load_history(dataset_id)

    def compare_versions(
        self,
        dataset_id: str,
        version_a: int,
        version_b: int
    ) -> Dict[str, Any]:
        """
        Compare two versions.

        Args:
            dataset_id: Dataset identifier
            version_a: First version number
            version_b: Second version number

        Returns:
            Dictionary with comparison details
        """
        va = self.get_version(dataset_id, version_a)
        vb = self.get_version(dataset_id, version_b)

        if not va or not vb:
            return {'error': 'Version not found'}

        comparison = {
            'dataset_id': dataset_id,
            'version_a': version_a,
            'version_b': version_b,
            'content_changed': va.content_hash != vb.content_hash,
            'schema_changed': va.schema_hash != vb.schema_hash,
            'row_count_delta': None,
            'column_count_delta': None,
            'time_delta': None
        }

        if va.row_count is not None and vb.row_count is not None:
            comparison['row_count_delta'] = vb.row_count - va.row_count

        if va.column_count is not None and vb.column_count is not None:
            comparison['column_count_delta'] = vb.column_count - va.column_count

        # Calculate time between versions
        try:
            from datetime import datetime
            ta = datetime.fromisoformat(va.created_at)
            tb = datetime.fromisoformat(vb.created_at)
            comparison['time_delta'] = str(tb - ta)
        except Exception:
            pass

        return comparison

    def get_lineage(self, dataset_id: str, version_number: int) -> List[DataVersion]:
        """
        Get lineage (ancestry) of a version.

        Args:
            dataset_id: Dataset identifier
            version_number: Version to trace

        Returns:
            List of versions from oldest to current
        """
        history = self._load_history(dataset_id)
        lineage = []

        current = self.get_version(dataset_id, version_number)

        while current:
            lineage.insert(0, current)
            if current.parent_version:
                # Find parent
                parent = None
                for v in history.versions:
                    if v.version_id == current.parent_version:
                        parent = v
                        break
                current = parent
            else:
                break

        return lineage
