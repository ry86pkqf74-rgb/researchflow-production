"""
Data Ingestion Models

Normalized surgical-case payload used across REDCap/Epic/spreadsheet sources.

Based on document_pdf.pdf specification (page 2-3).

IMPORTANT PHI CONSIDERATIONS:
- patient_id should be de-identified or a stable pseudonym
- operative_note may contain PHI; consider de-id before caching/persisting
- mrn_last4 is optional; avoid if not needed for linkage
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Optional


@dataclass(frozen=True)
class SurgicalCase:
    """
    Normalized surgical-case payload used across REDCap/Epic/spreadsheets.

    This immutable dataclass serves as the common interchange format for
    clinical data from multiple ingestion sources.

    Attributes:
        case_id: Unique identifier for this surgical case
        source: Origin system ("redcap" | "epic" | "spreadsheet" | etc.)
        patient_id: De-identified patient ID or stable pseudonym
        mrn_last4: Last 4 digits of MRN (optional, avoid if not needed)
        procedure: Procedure name or CPT description
        procedure_date: Date/time of the procedure
        surgeon: Operating surgeon name
        service_line: Clinical service line (e.g., "General Surgery")
        operative_note_text: Full operative note text (may contain PHI)
        outcomes: Dictionary of outcome measures (SSI, LOS, readmission, etc.)
        metadata: Additional source-specific metadata
    """
    case_id: str
    source: str  # "redcap" | "epic" | "spreadsheet" | etc.
    patient_id: Optional[str] = None  # de-id or pseudonym
    mrn_last4: Optional[str] = None  # optional, avoid if not needed
    procedure: Optional[str] = None
    procedure_date: Optional[datetime] = None
    surgeon: Optional[str] = None
    service_line: Optional[str] = None
    operative_note_text: Optional[str] = None
    outcomes: dict[str, Any] = field(default_factory=dict)
    metadata: dict[str, Any] = field(default_factory=dict)

    def has_operative_note(self) -> bool:
        """Check if this case has an operative note."""
        return bool(self.operative_note_text and self.operative_note_text.strip())

    def get_outcome(self, key: str, default: Any = None) -> Any:
        """Safely get an outcome value."""
        return self.outcomes.get(key, default)

    def to_dict(self) -> dict[str, Any]:
        """Convert to dictionary for serialization."""
        return {
            "case_id": self.case_id,
            "source": self.source,
            "patient_id": self.patient_id,
            "mrn_last4": self.mrn_last4,
            "procedure": self.procedure,
            "procedure_date": self.procedure_date.isoformat() if self.procedure_date else None,
            "surgeon": self.surgeon,
            "service_line": self.service_line,
            "operative_note_text": self.operative_note_text,
            "outcomes": dict(self.outcomes),
            "metadata": dict(self.metadata),
        }

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> "SurgicalCase":
        """Create from dictionary."""
        procedure_date = None
        if data.get("procedure_date"):
            if isinstance(data["procedure_date"], datetime):
                procedure_date = data["procedure_date"]
            elif isinstance(data["procedure_date"], str):
                procedure_date = datetime.fromisoformat(data["procedure_date"])

        return cls(
            case_id=data["case_id"],
            source=data["source"],
            patient_id=data.get("patient_id"),
            mrn_last4=data.get("mrn_last4"),
            procedure=data.get("procedure"),
            procedure_date=procedure_date,
            surgeon=data.get("surgeon"),
            service_line=data.get("service_line"),
            operative_note_text=data.get("operative_note_text"),
            outcomes=data.get("outcomes", {}),
            metadata=data.get("metadata", {}),
        )


@dataclass(frozen=True)
class IngestionResult:
    """
    Result of a batch ingestion operation.

    Attributes:
        cases: List of successfully ingested SurgicalCase objects
        errors: List of (record_id, error_message) tuples for failed records
        source: The source system
        timestamp: When the ingestion was performed
    """
    cases: list[SurgicalCase]
    errors: list[tuple[str, str]]
    source: str
    timestamp: datetime = field(default_factory=lambda: datetime.now())

    @property
    def success_count(self) -> int:
        """Number of successfully ingested cases."""
        return len(self.cases)

    @property
    def error_count(self) -> int:
        """Number of failed records."""
        return len(self.errors)

    @property
    def total_count(self) -> int:
        """Total records attempted."""
        return self.success_count + self.error_count
