"""
Unified provenance event schema for ROS platform.

Provides a single, standardized event model for all provenance logging across
the platform, replacing bespoke logging implementations.

Governance:
- NO PHI content (metadata only)
- Audit chain preserved via append-only JSONL
- User-scoped logs: .tmp/workspaces/<user_id>/provenance.jsonl
- CI-safe: graceful degradation on failures

Related:
- src/provenance/logger.py (legacy operation logger)
- web_frontend/utils/provenance.py (legacy PHI event logger)
"""

from datetime import datetime, timezone
from enum import Enum
from typing import Any, Optional

from pydantic import BaseModel, Field, field_validator, ConfigDict


class EventType(str, Enum):
    """
    Standardized event types for provenance tracking.

    Categorizes events by domain for filtering and analysis.
    """

    # Pipeline operations
    PIPELINE_START = "pipeline_start"
    PIPELINE_COMPLETE = "pipeline_complete"
    PIPELINE_ERROR = "pipeline_error"

    # Data operations
    DATA_INGEST = "data_ingest"
    DATA_EXPORT = "data_export"
    DATA_TRANSFORM = "data_transform"

    # PHI/Security events
    PHI_SCAN = "phi_scan"
    PHI_SCRUB = "phi_scrub"
    PHI_DETECTED = "phi_detected"

    # LLM/AI operations
    LLM_REQUEST = "llm_request"
    LLM_CALL = "llm_call"
    LLM_RESPONSE = "llm_response"
    AI_GENERATION = "ai_generation"

    # Manuscript/Export
    MANUSCRIPT_GENERATE = "manuscript_generate"
    EXPORT_BUNDLE = "export_bundle"
    FIGURE_GENERATE = "figure_generate"

    # Quality/Validation
    QA_CHECK = "qa_check"
    VALIDATION_RUN = "validation_run"

    # User actions
    USER_UPLOAD = "user_upload"
    USER_DOWNLOAD = "user_download"
    USER_VIEW = "user_view"

    # System events
    SYSTEM_ERROR = "system_error"
    SYSTEM_WARNING = "system_warning"


class RuntimeMode(str, Enum):
    """Runtime mode classification."""

    ONLINE = "online"
    OFFLINE = "offline"
    TEST = "test"
    UNKNOWN = "unknown"


class Classification(str, Enum):
    """Data classification for security/compliance."""

    PUBLIC = "public"
    INTERNAL = "internal"
    CONFIDENTIAL = "confidential"
    PHI = "phi"
    PHI_STAGING = "phi_staging"
    UNKNOWN = "unknown"


class ProvenanceEvent(BaseModel):
    """
    Unified provenance event schema.

    Captures all metadata necessary for audit trails without including PHI content.
    All events are logged to user-scoped JSONL files for traceability.

    Attributes:
        event_type: Type of event from standardized enum
        timestamp: UTC timestamp in ISO 8601 format
        user_id: User identifier (anonymized/hashed for privacy)
        mode: Runtime mode (online/offline/test)
        classification: Data classification level
        success: Whether the operation succeeded
        details: Event-specific metadata (NO PHI CONTENT)
        hashes: Optional content hashes for integrity verification
        session_id: Optional session identifier for grouping events
        request_id: Optional request identifier for tracing
        git_commit_sha: Optional git commit for reproducibility
        schema_version: Schema version for future compatibility tracking

    Example:
        >>> event = ProvenanceEvent(
        ...     event_type=EventType.LLM_REQUEST,
        ...     user_id="alice",
        ...     mode=RuntimeMode.ONLINE,
        ...     classification=Classification.INTERNAL,
        ...     success=True,
        ...     details={
        ...         "provider": "claude",
        ...         "model": "claude-3-5-sonnet",
        ...         "prompt_hash": "abc123..."
        ...     },
        ...     hashes={"prompt": "sha256:abc123..."}
        ... )
    """

    event_type: EventType = Field(..., description="Event type from standardized enum")

    timestamp: str = Field(
        default_factory=lambda: datetime.now(timezone.utc)
        .isoformat()
        .replace("+00:00", "Z"),
        description="UTC timestamp in ISO 8601 format",
    )

    user_id: str = Field(..., description="User identifier (may be anonymized/hashed)")

    mode: RuntimeMode = Field(
        default=RuntimeMode.UNKNOWN, description="Runtime mode (online/offline/test)"
    )

    classification: Classification = Field(
        default=Classification.UNKNOWN,
        description="Data classification level for security",
    )

    success: bool = Field(..., description="Whether the operation succeeded")

    details: dict[str, Any] = Field(
        default_factory=dict, description="Event-specific metadata (NO PHI CONTENT)"
    )

    hashes: Optional[dict[str, str]] = Field(
        default=None, description="Optional content hashes for integrity verification"
    )

    session_id: Optional[str] = Field(
        default=None, description="Session identifier for grouping related events"
    )

    request_id: Optional[str] = Field(
        default=None, description="Request identifier for tracing"
    )

    git_commit_sha: Optional[str] = Field(
        default=None, description="Git commit SHA for reproducibility"
    )

    schema_version: str = Field(
        default="1.0.0",
        description="Schema version for future compatibility tracking"
    )

    @field_validator("details")
    @classmethod
    def validate_no_phi_content(cls, v: dict[str, Any]) -> dict[str, Any]:
        """
        Validate that details dict doesn't contain obvious PHI content.

        This is a basic safeguard - not comprehensive PHI detection.
        Real PHI protection happens at ingestion boundaries.
        """
        # Curated denylist of PHI-bearing field names (normalized: lowercase, no underscores/dashes)
        phi_denylist = {
            "ssn",
            "socialsecurity",
            "patientname",
            "patientid",
            "mrn",
            "medicalrecord",
            "medicalrecordnumber",
            "dob",
            "dateofbirth",
            "email",
            "phonenumber",
            "phone",
            "address",
            "rawdata",
            "content",
        }

        for key in v.keys():
            # Normalize key: lowercase + remove underscores and dashes
            key_norm = key.lower().replace("_", "").replace("-", "")
            # Exact match only - no substring matching
            if key_norm in phi_denylist:
                raise ValueError(
                    f"Potential PHI field in details: '{key}'. "
                    f"Provenance events must NOT contain PHI content. "
                    f"Use hashes or counts instead."
                )

        return v

    model_config = ConfigDict(
        use_enum_values=True,
        json_encoders={datetime: lambda v: v.isoformat().replace("+00:00", "Z")},
    )
