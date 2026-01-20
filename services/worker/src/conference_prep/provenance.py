"""Conference Prep Provenance Tracking

Tracks the provenance chain for conference preparation artifacts:
- Source artifact relationships (manuscript -> poster, etc.)
- PHI scan status for each generated artifact
- Version lineage for modifications
- Export audit trail

All operations are logged with hash-chain integrity for compliance.
"""

import hashlib
import json
import logging
from datetime import datetime
from enum import Enum
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field
from dataclasses import dataclass, field
import re

# Import PHI patterns for scanning
from validation.phi_patterns import PHI_PATTERNS_OUTPUT_GUARD

logger = logging.getLogger(__name__)


class ArtifactType(str, Enum):
    """Types of conference prep artifacts."""
    MANUSCRIPT = "manuscript"
    POSTER = "poster"
    ABSTRACT = "abstract"
    SLIDES = "slides"
    SUPPLEMENTARY = "supplementary"
    FIGURE = "figure"
    TABLE = "table"
    REBUTTAL = "rebuttal"
    CAMERA_READY = "camera_ready"


class PhiScanStatus(str, Enum):
    """PHI scan status values."""
    PENDING = "PENDING"
    PASS = "PASS"
    FAIL = "FAIL"
    OVERRIDE = "OVERRIDE"


class ProvenanceRelationType(str, Enum):
    """Types of provenance relationships."""
    DERIVED_FROM = "derived_from"
    EXTRACTED_FROM = "extracted_from"
    EXPORTED_TO = "exported_to"
    MERGED_WITH = "merged_with"
    SUPERSEDES = "supersedes"


class PhiFinding(BaseModel):
    """A PHI detection finding (location-only, no raw data)."""
    pattern_type: str
    start_offset: int
    end_offset: int
    hash_sample: str  # SHA256 of matched text (first 12 chars)
    confidence: float = Field(default=1.0, ge=0.0, le=1.0)


class ProvenanceEdge(BaseModel):
    """A provenance relationship between artifacts."""
    id: str
    source_artifact_id: str
    target_artifact_id: str
    relation_type: ProvenanceRelationType
    created_at: datetime = Field(default_factory=datetime.utcnow)
    created_by: str
    metadata: Dict[str, Any] = Field(default_factory=dict)
    hash_chain: Optional[str] = None


class ArtifactProvenanceRecord(BaseModel):
    """Provenance record for a conference prep artifact."""
    artifact_id: str
    artifact_type: ArtifactType
    research_id: str
    submission_id: Optional[str] = None
    version_id: Optional[str] = None

    # PHI tracking
    phi_scan_status: PhiScanStatus = PhiScanStatus.PENDING
    phi_findings: List[PhiFinding] = Field(default_factory=list)
    phi_scanned_at: Optional[datetime] = None
    phi_scanned_by: Optional[str] = None

    # Provenance chain
    source_artifact_ids: List[str] = Field(default_factory=list)
    edges: List[ProvenanceEdge] = Field(default_factory=list)

    # Timestamps
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    # Hash chain for integrity
    content_hash: Optional[str] = None
    entry_hash: Optional[str] = None
    previous_hash: Optional[str] = None

    metadata: Dict[str, Any] = Field(default_factory=dict)


def compute_content_hash(content: str) -> str:
    """Compute SHA256 hash of content."""
    return hashlib.sha256(content.encode("utf-8")).hexdigest()


def compute_entry_hash(record: ArtifactProvenanceRecord, previous_hash: str = "GENESIS") -> str:
    """Compute hash-chain entry hash for audit integrity."""
    payload = {
        "artifact_id": record.artifact_id,
        "artifact_type": record.artifact_type.value,
        "research_id": record.research_id,
        "phi_scan_status": record.phi_scan_status.value,
        "content_hash": record.content_hash,
        "created_at": record.created_at.isoformat(),
        "previous_hash": previous_hash,
    }
    json_str = json.dumps(payload, sort_keys=True)
    return hashlib.sha256(json_str.encode("utf-8")).hexdigest()


def _hash_sample(text: str) -> str:
    """Create a hash sample for PHI findings (never store raw PHI)."""
    return hashlib.sha256(text.encode("utf-8")).hexdigest()[:12]


def scan_text_for_phi(text: str) -> tuple[bool, List[PhiFinding]]:
    """
    Scan text for PHI using output-guard patterns.

    Returns:
        Tuple of (has_phi: bool, findings: List[PhiFinding])

    Note: Findings contain location-only data (no raw PHI).
    """
    findings: List[PhiFinding] = []

    for pattern_name, pattern_regex in PHI_PATTERNS_OUTPUT_GUARD:
        for match in pattern_regex.finditer(text):
            finding = PhiFinding(
                pattern_type=pattern_name,
                start_offset=match.start(),
                end_offset=match.end(),
                hash_sample=_hash_sample(match.group()),
                confidence=1.0,
            )
            findings.append(finding)

    return len(findings) > 0, findings


def create_provenance_record(
    artifact_id: str,
    artifact_type: ArtifactType,
    research_id: str,
    content: Optional[str] = None,
    source_artifact_ids: Optional[List[str]] = None,
    submission_id: Optional[str] = None,
    version_id: Optional[str] = None,
    created_by: str = "system",
    skip_phi_scan: bool = False,
    previous_hash: str = "GENESIS",
    metadata: Optional[Dict[str, Any]] = None,
) -> tuple[ArtifactProvenanceRecord, Optional[str]]:
    """
    Create a provenance record for a conference prep artifact.

    Args:
        artifact_id: Unique artifact identifier
        artifact_type: Type of artifact
        research_id: Parent research project ID
        content: Artifact content to scan for PHI
        source_artifact_ids: IDs of source artifacts (for lineage)
        submission_id: Optional submission this belongs to
        version_id: Optional version identifier
        created_by: User/system creating the record
        skip_phi_scan: If True, skip PHI scanning (requires steward override)
        previous_hash: Previous entry hash for chain integrity
        metadata: Additional metadata

    Returns:
        Tuple of (record, error_message)
        If PHI is detected and not overridden, error_message contains details.
    """
    now = datetime.utcnow()

    # Compute content hash if content provided
    content_hash = compute_content_hash(content) if content else None

    # PHI scanning
    phi_scan_status = PhiScanStatus.PENDING
    phi_findings: List[PhiFinding] = []

    if content and not skip_phi_scan:
        has_phi, findings = scan_text_for_phi(content)
        phi_findings = findings
        phi_scan_status = PhiScanStatus.FAIL if has_phi else PhiScanStatus.PASS

        if has_phi:
            error_msg = (
                f"PHI detected in artifact {artifact_id}. "
                f"Found {len(findings)} potential PHI instances. "
                "Review and request steward override if necessary."
            )
            logger.warning(f"PHI detected: {len(findings)} findings in {artifact_id}")

            # Still create the record but mark as FAIL
            record = ArtifactProvenanceRecord(
                artifact_id=artifact_id,
                artifact_type=artifact_type,
                research_id=research_id,
                submission_id=submission_id,
                version_id=version_id,
                phi_scan_status=PhiScanStatus.FAIL,
                phi_findings=phi_findings,
                phi_scanned_at=now,
                phi_scanned_by=created_by,
                source_artifact_ids=source_artifact_ids or [],
                content_hash=content_hash,
                previous_hash=previous_hash,
                metadata=metadata or {},
                created_at=now,
                updated_at=now,
            )
            record.entry_hash = compute_entry_hash(record, previous_hash)
            return record, error_msg
    elif skip_phi_scan:
        phi_scan_status = PhiScanStatus.OVERRIDE
        logger.info(f"PHI scan skipped for {artifact_id} (steward override)")

    record = ArtifactProvenanceRecord(
        artifact_id=artifact_id,
        artifact_type=artifact_type,
        research_id=research_id,
        submission_id=submission_id,
        version_id=version_id,
        phi_scan_status=phi_scan_status,
        phi_findings=phi_findings,
        phi_scanned_at=now if content else None,
        phi_scanned_by=created_by if content else None,
        source_artifact_ids=source_artifact_ids or [],
        content_hash=content_hash,
        previous_hash=previous_hash,
        metadata=metadata or {},
        created_at=now,
        updated_at=now,
    )
    record.entry_hash = compute_entry_hash(record, previous_hash)

    logger.info(f"Created provenance record for {artifact_id} (type={artifact_type.value})")
    return record, None


def add_provenance_edge(
    record: ArtifactProvenanceRecord,
    source_artifact_id: str,
    relation_type: ProvenanceRelationType,
    created_by: str = "system",
    metadata: Optional[Dict[str, Any]] = None,
) -> ProvenanceEdge:
    """
    Add a provenance edge linking this artifact to a source.

    Args:
        record: The provenance record to update
        source_artifact_id: ID of the source artifact
        relation_type: Type of relationship
        created_by: User/system creating the edge
        metadata: Additional edge metadata

    Returns:
        The created ProvenanceEdge
    """
    edge_id = f"edge_{record.artifact_id}_{source_artifact_id}_{relation_type.value}"

    edge = ProvenanceEdge(
        id=edge_id,
        source_artifact_id=source_artifact_id,
        target_artifact_id=record.artifact_id,
        relation_type=relation_type,
        created_by=created_by,
        metadata=metadata or {},
    )

    # Compute edge hash chain
    edge_payload = {
        "id": edge.id,
        "source": edge.source_artifact_id,
        "target": edge.target_artifact_id,
        "relation": edge.relation_type.value,
        "created_at": edge.created_at.isoformat(),
        "previous_hash": record.entry_hash or "GENESIS",
    }
    edge.hash_chain = hashlib.sha256(
        json.dumps(edge_payload, sort_keys=True).encode("utf-8")
    ).hexdigest()

    record.edges.append(edge)
    if source_artifact_id not in record.source_artifact_ids:
        record.source_artifact_ids.append(source_artifact_id)

    record.updated_at = datetime.utcnow()

    logger.info(
        f"Added provenance edge: {source_artifact_id} --{relation_type.value}--> "
        f"{record.artifact_id}"
    )
    return edge


def rescan_for_phi(
    record: ArtifactProvenanceRecord,
    content: str,
    scanned_by: str = "system",
    override: bool = False,
) -> tuple[ArtifactProvenanceRecord, Optional[str]]:
    """
    Re-scan an artifact's content for PHI.

    Used after content modification or for periodic compliance checks.

    Args:
        record: The provenance record to update
        content: Current content to scan
        scanned_by: User/system performing the scan
        override: If True, mark as OVERRIDE instead of FAIL

    Returns:
        Tuple of (updated_record, error_message)
    """
    now = datetime.utcnow()

    has_phi, findings = scan_text_for_phi(content)
    record.phi_findings = findings
    record.phi_scanned_at = now
    record.phi_scanned_by = scanned_by
    record.content_hash = compute_content_hash(content)
    record.updated_at = now

    if has_phi:
        if override:
            record.phi_scan_status = PhiScanStatus.OVERRIDE
            logger.info(f"PHI override applied for {record.artifact_id}")
            return record, None
        else:
            record.phi_scan_status = PhiScanStatus.FAIL
            error_msg = (
                f"PHI re-scan detected {len(findings)} issues in {record.artifact_id}. "
                "Content cannot be exported without steward override."
            )
            logger.warning(error_msg)
            return record, error_msg
    else:
        record.phi_scan_status = PhiScanStatus.PASS
        logger.info(f"PHI re-scan passed for {record.artifact_id}")
        return record, None


def validate_provenance_chain(records: List[ArtifactProvenanceRecord]) -> tuple[bool, Optional[str]]:
    """
    Validate the integrity of a provenance chain.

    Args:
        records: List of provenance records in chronological order

    Returns:
        Tuple of (is_valid, error_message)
    """
    if not records:
        return True, None

    previous_hash = "GENESIS"

    for i, record in enumerate(records):
        # Check previous hash linkage
        if record.previous_hash != previous_hash:
            return False, f"Hash chain broken at record {record.artifact_id} (index {i})"

        # Recompute and verify entry hash
        expected_hash = compute_entry_hash(record, previous_hash)
        if record.entry_hash != expected_hash:
            return False, f"Entry hash mismatch at record {record.artifact_id} (index {i})"

        previous_hash = record.entry_hash or "GENESIS"

    logger.info(f"Provenance chain validated: {len(records)} records")
    return True, None


def generate_export_manifest(
    records: List[ArtifactProvenanceRecord],
    submission_id: Optional[str] = None,
    export_format: str = "json",
) -> Dict[str, Any]:
    """
    Generate an export manifest for provenance records.

    Used for conference submission packages.

    Args:
        records: Provenance records to include
        submission_id: Optional submission ID
        export_format: Export format (json, yaml)

    Returns:
        Export manifest dictionary
    """
    # Filter to only PASS or OVERRIDE status
    exportable = [
        r for r in records
        if r.phi_scan_status in (PhiScanStatus.PASS, PhiScanStatus.OVERRIDE)
    ]

    blocked = [
        r for r in records
        if r.phi_scan_status == PhiScanStatus.FAIL
    ]

    manifest = {
        "manifest_version": "1.0",
        "generated_at": datetime.utcnow().isoformat(),
        "submission_id": submission_id,
        "export_format": export_format,
        "statistics": {
            "total_records": len(records),
            "exportable": len(exportable),
            "blocked_phi": len(blocked),
            "by_type": {},
            "by_status": {},
        },
        "artifacts": [],
        "provenance_edges": [],
        "integrity": {
            "chain_valid": False,
            "verification_hash": None,
        },
    }

    # Count by type and status
    for record in records:
        t = record.artifact_type.value
        s = record.phi_scan_status.value
        manifest["statistics"]["by_type"][t] = manifest["statistics"]["by_type"].get(t, 0) + 1
        manifest["statistics"]["by_status"][s] = manifest["statistics"]["by_status"].get(s, 0) + 1

    # Add exportable artifacts
    for record in exportable:
        manifest["artifacts"].append({
            "artifact_id": record.artifact_id,
            "type": record.artifact_type.value,
            "research_id": record.research_id,
            "version_id": record.version_id,
            "phi_scan_status": record.phi_scan_status.value,
            "content_hash": record.content_hash,
            "entry_hash": record.entry_hash,
            "created_at": record.created_at.isoformat(),
        })

        for edge in record.edges:
            manifest["provenance_edges"].append({
                "id": edge.id,
                "source": edge.source_artifact_id,
                "target": edge.target_artifact_id,
                "relation": edge.relation_type.value,
                "created_at": edge.created_at.isoformat(),
                "hash_chain": edge.hash_chain,
            })

    # Validate chain integrity
    is_valid, _ = validate_provenance_chain(records)
    manifest["integrity"]["chain_valid"] = is_valid

    # Compute manifest verification hash
    manifest_json = json.dumps(manifest["artifacts"], sort_keys=True)
    manifest["integrity"]["verification_hash"] = hashlib.sha256(
        manifest_json.encode("utf-8")
    ).hexdigest()

    logger.info(
        f"Generated export manifest: {len(exportable)} artifacts, "
        f"{len(blocked)} blocked"
    )
    return manifest
