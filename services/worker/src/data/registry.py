"""Dataset Registry - Metadata-only tracking for dataset lifecycle.

Stores dataset metadata (NO PHI, NO row-level data) including:
- Content hashes
- Schema fingerprints
- Aggregate statistics (row/column counts)
- Admissibility categories
- Governance decision references

Storage: .tmp/registry/datasets.jsonl (JSONL append-only log)
"""

import hashlib
import json
from dataclasses import dataclass, asdict
from datetime import datetime, timezone
from enum import Enum
from pathlib import Path
from typing import Dict, List, Optional


class DatasetStatus(Enum):
    """Dataset lifecycle status."""

    QUARANTINED = "QUARANTINED"  # In quarantine, not promoted
    PROMOTED = "PROMOTED"  # Promoted to persistent store
    ARCHIVED = "ARCHIVED"  # Moved to archive


@dataclass
class DatasetRecord:
    """Metadata-only dataset record (NO PHI).

    Attributes:
        dataset_id: Unique identifier (UUID format)
        content_hash: SHA256 of file content
        schema_fingerprint: Hash of column names + dtypes
        row_count: Number of rows
        column_count: Number of columns
        column_names: List of column names (metadata only)
        admissibility: Data admissibility category
        status: Current lifecycle status
        governance_decision_ref: Reference to governance decision log
        originating_run_ids: Run IDs that created/referenced this dataset
        created_at: ISO 8601 timestamp (UTC)
        updated_at: ISO 8601 timestamp (UTC)
        promoted_at: ISO 8601 timestamp when promoted (if applicable)
        notes: Optional operator notes (NO PHI)
    """

    dataset_id: str
    content_hash: str
    schema_fingerprint: str
    row_count: int
    column_count: int
    column_names: List[str]
    admissibility: str
    status: str
    governance_decision_ref: Optional[str]
    originating_run_ids: List[str]
    created_at: str
    updated_at: str
    promoted_at: Optional[str] = None
    notes: Optional[str] = None

    # Added in Phase 3: record the Pandera schema version used when
    # registering the dataset.  This aids in tracking compatibility
    # between datasets and schema definitions over time.  If None,
    # the global schema registry version will be used at registration time.
    schema_version: Optional[str] = None

    # Human-friendly metadata fields (optional, for display/organization)
    display_name: Optional[str] = None
    description: Optional[str] = None
    tags: Optional[List[str]] = None

    def to_dict(self) -> Dict:
        """Convert to dictionary for JSON serialization."""
        return asdict(self)

    @classmethod
    def from_dict(cls, data: Dict) -> "DatasetRecord":
        """Create from dictionary with backward compatibility."""
        # Ensure new optional fields have defaults for old records
        data.setdefault("display_name", None)
        data.setdefault("description", None)
        data.setdefault("tags", None)
        return cls(**data)


class DatasetRegistry:
    """Dataset registry with JSONL persistence.

    Metadata-only tracking (NO PHI, NO row-level data).
    Storage location: .tmp/registry/datasets.jsonl
    """

    def __init__(self, registry_path: Optional[Path] = None):
        """Initialize registry.

        Args:
            registry_path: Path to registry file (default: .tmp/registry/datasets.jsonl)
        """
        if registry_path is None:
            # Default to .tmp/registry/datasets.jsonl
            registry_path = Path(".tmp/registry/datasets.jsonl")

        self.registry_path = Path(registry_path)
        self._ensure_registry_dir()

    def _ensure_registry_dir(self) -> None:
        """Ensure registry directory exists."""
        self.registry_path.parent.mkdir(parents=True, exist_ok=True)

    def register_dataset(
        self,
        dataset_id: str,
        content_hash: str,
        schema_fingerprint: str,
        row_count: int,
        column_count: int,
        column_names: List[str],
        admissibility: str,
        status: str = "QUARANTINED",
        governance_decision_ref: Optional[str] = None,
        originating_run_id: Optional[str] = None,
        notes: Optional[str] = None,
        schema_version: Optional[str] = None,
    ) -> DatasetRecord:
        """Register new dataset in registry.

        Args:
            dataset_id: Unique identifier
            content_hash: SHA256 of content
            schema_fingerprint: Schema hash
            row_count: Number of rows
            column_count: Number of columns
            column_names: Column names (metadata only)
            admissibility: Data category
            status: Lifecycle status
            governance_decision_ref: Governance decision reference
            originating_run_id: Run ID
            notes: Optional notes

        Returns:
            DatasetRecord
        """
        now = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")

        # Determine schema version if not provided; fallback to schema registry version
        if schema_version is None:
            try:
                from schemas.pandera import schema_registry

                schema_version = schema_registry.__version__  # type: ignore[attr-defined]
            except Exception:
                # Default if schema registry missing or has no __version__
                schema_version = "unknown"

        record = DatasetRecord(
            dataset_id=dataset_id,
            content_hash=content_hash,
            schema_fingerprint=schema_fingerprint,
            row_count=row_count,
            column_count=column_count,
            column_names=column_names,
            admissibility=admissibility,
            status=status,
            governance_decision_ref=governance_decision_ref,
            originating_run_ids=[originating_run_id] if originating_run_id else [],
            created_at=now,
            updated_at=now,
            notes=notes,
            schema_version=schema_version,
        )

        self._append_record(record)
        return record

    def update_status(
        self,
        dataset_id: str,
        new_status: str,
        notes: Optional[str] = None,
    ) -> Optional[DatasetRecord]:
        """Update dataset status.

        Args:
            dataset_id: Dataset identifier
            new_status: New status value
            notes: Optional notes

        Returns:
            Updated DatasetRecord or None if not found
        """
        record = self.get_dataset(dataset_id)
        if record is None:
            return None

        now = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
        record.status = new_status
        record.updated_at = now

        if new_status == "PROMOTED":
            record.promoted_at = now

        if notes:
            record.notes = notes

        self._append_record(record)
        return record

    def update_metadata(
        self,
        dataset_id: str,
        display_name: Optional[str] = None,
        description: Optional[str] = None,
        tags: Optional[List[str]] = None,
    ) -> Optional[DatasetRecord]:
        """Update dataset metadata (display_name, description, tags).

        Only specified fields are updated; omitted fields remain unchanged.
        Empty strings are converted to None for consistency.

        Args:
            dataset_id: Dataset identifier
            display_name: Human-friendly display name (optional)
            description: Dataset description (optional)
            tags: List of tags for organization (optional)

        Returns:
            Updated DatasetRecord or None if not found
        """
        record = self.get_dataset(dataset_id)
        if record is None:
            return None

        now = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
        record.updated_at = now

        # Update fields if provided (None means "don't change")
        if display_name is not None:
            record.display_name = display_name.strip() if display_name.strip() else None

        if description is not None:
            record.description = description.strip() if description.strip() else None

        if tags is not None:
            # Clean and deduplicate tags
            cleaned_tags = [t.strip() for t in tags if t.strip()]
            record.tags = cleaned_tags if cleaned_tags else None

        self._append_record(record)
        return record

    def update_validation_results(
        self,
        dataset_id: str,
        validation_type: str,
        validation_passed: bool,
        validation_results: dict,
    ) -> Optional[DatasetRecord]:
        """Update dataset with validation results.

        Args:
            dataset_id: Dataset identifier
            validation_type: Type of validation (e.g., "schema_validation")
            validation_passed: Whether validation passed
            validation_results: Validation results dictionary

        Returns:
            Updated DatasetRecord or None if not found
        """
        record = self.get_dataset(dataset_id)
        if record is None:
            return None

        now = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
        record.updated_at = now

        # Store validation results in notes field (JSON-encoded)
        validation_summary = {
            "type": validation_type,
            "passed": validation_passed,
            "timestamp": now,
            "results": validation_results,
        }

        # Append to existing notes or create new
        if record.notes:
            notes = f"{record.notes}\n[VALIDATION] {json.dumps(validation_summary)}"
        else:
            notes = f"[VALIDATION] {json.dumps(validation_summary)}"

        record.notes = notes

        self._append_record(record)
        return record

    def get_dataset(self, dataset_id: str) -> Optional[DatasetRecord]:
        """Get dataset by ID (latest version).

        Args:
            dataset_id: Dataset identifier

        Returns:
            DatasetRecord or None if not found
        """
        records = self._load_all_records()

        # Get latest version of dataset (JSONL append-only, last wins)
        for record in reversed(records):
            if record.dataset_id == dataset_id:
                return record

        return None

    def list_datasets(
        self,
        status: Optional[str] = None,
        admissibility: Optional[str] = None,
    ) -> List[DatasetRecord]:
        """List datasets with optional filters.

        Args:
            status: Filter by status
            admissibility: Filter by admissibility

        Returns:
            List of DatasetRecords
        """
        records = self._load_all_records()

        # Get latest version of each dataset
        latest_records = {}
        for record in records:
            latest_records[record.dataset_id] = record

        results = list(latest_records.values())

        # Apply filters
        if status:
            results = [r for r in results if r.status == status]

        if admissibility:
            results = [r for r in results if r.admissibility == admissibility]

        return results

    def _append_record(self, record: DatasetRecord) -> None:
        """Append record to JSONL file."""
        self._ensure_registry_dir()

        with open(self.registry_path, "a") as f:
            json_line = json.dumps(record.to_dict(), sort_keys=True)
            f.write(json_line + "\n")

    def _load_all_records(self) -> List[DatasetRecord]:
        """Load all records from JSONL file."""
        if not self.registry_path.exists():
            return []

        records = []
        with open(self.registry_path, "r") as f:
            for line in f:
                line = line.strip()
                if line:
                    data = json.loads(line)
                    records.append(DatasetRecord.from_dict(data))

        return records


def compute_schema_fingerprint(column_names: List[str], dtypes: Dict[str, str]) -> str:
    """Compute deterministic schema fingerprint.

    Args:
        column_names: List of column names
        dtypes: Dict mapping column names to dtype strings

    Returns:
        SHA256 hex hash of schema
    """
    # Create stable representation
    schema_repr = json.dumps(
        {
            "columns": sorted(column_names),
            "dtypes": {k: dtypes.get(k, "unknown") for k in sorted(column_names)},
        },
        sort_keys=True,
    )

    return hashlib.sha256(schema_repr.encode("utf-8")).hexdigest()


def compute_content_hash(file_path: Path) -> str:
    """Compute SHA256 hash of file content.

    Args:
        file_path: Path to file

    Returns:
        SHA256 hex hash
    """
    hasher = hashlib.sha256()

    with open(file_path, "rb") as f:
        while chunk := f.read(8192):
            hasher.update(chunk)

    return hasher.hexdigest()
