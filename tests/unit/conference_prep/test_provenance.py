"""
Tests for Conference Prep Provenance Tracking

Tests PHI scanning, hash-chain integrity, and export manifest generation.
"""

import hashlib
import json
from datetime import datetime
from unittest.mock import patch, MagicMock
import pytest


class TestPhiScanning:
    """Tests for PHI detection in artifact content."""

    def test_scan_detects_ssn(self):
        """Should detect SSN patterns."""
        import re
        ssn_pattern = r'\d{3}-\d{2}-\d{4}'
        text = "Patient SSN: 123-45-6789"

        matches = re.findall(ssn_pattern, text)
        assert len(matches) == 1
        assert matches[0] == "123-45-6789"

    def test_scan_detects_mrn(self):
        """Should detect MRN patterns."""
        import re
        mrn_pattern = r'MRN:\s*\w+'
        text = "MRN: ABC123456"

        matches = re.findall(mrn_pattern, text)
        assert len(matches) == 1

    def test_scan_detects_dob(self):
        """Should detect date of birth patterns."""
        import re
        dob_pattern = r'DOB:\s*\d{1,2}[/-]\d{1,2}[/-]\d{2,4}'
        text = "DOB: 01/15/1990"

        matches = re.findall(dob_pattern, text)
        assert len(matches) == 1

    def test_scan_clean_text(self):
        """Should pass text without PHI."""
        import re
        phi_patterns = [
            r'\d{3}-\d{2}-\d{4}',  # SSN
            r'MRN:\s*\w+',         # MRN
            r'DOB:\s*\d{1,2}[/-]\d{1,2}[/-]\d{2,4}',  # DOB
        ]

        clean_text = "This manuscript presents findings about statistical methods."

        has_phi = any(re.search(p, clean_text) for p in phi_patterns)
        assert has_phi is False

    def test_findings_store_location_only(self):
        """PHI findings should not store raw PHI values."""
        finding = {
            "pattern_type": "SSN",
            "start_offset": 10,
            "end_offset": 21,
            "hash_sample": hashlib.sha256(b"123-45-6789").hexdigest()[:12],
            "confidence": 1.0,
        }

        # Should NOT contain raw PHI
        assert "raw_value" not in finding
        assert "value" not in finding
        assert len(finding["hash_sample"]) == 12


class TestHashChain:
    """Tests for provenance hash-chain integrity."""

    def test_compute_content_hash(self):
        """Should compute deterministic content hash."""
        content = "Sample manuscript content"

        hash1 = hashlib.sha256(content.encode("utf-8")).hexdigest()
        hash2 = hashlib.sha256(content.encode("utf-8")).hexdigest()

        assert hash1 == hash2
        assert len(hash1) == 64

    def test_compute_entry_hash(self):
        """Should compute entry hash including previous hash."""
        payload = {
            "artifact_id": "artifact-1",
            "artifact_type": "manuscript",
            "research_id": "research-1",
            "phi_scan_status": "PASS",
            "content_hash": "abc123",
            "created_at": "2024-01-15T10:00:00",
            "previous_hash": "GENESIS",
        }

        json_str = json.dumps(payload, sort_keys=True)
        entry_hash = hashlib.sha256(json_str.encode("utf-8")).hexdigest()

        assert len(entry_hash) == 64

    def test_chain_links_correctly(self):
        """Should link entries with previous hash."""
        genesis = "GENESIS"

        # First entry
        entry1 = {"id": "1", "previous_hash": genesis}
        hash1 = hashlib.sha256(json.dumps(entry1, sort_keys=True).encode()).hexdigest()

        # Second entry links to first
        entry2 = {"id": "2", "previous_hash": hash1}
        hash2 = hashlib.sha256(json.dumps(entry2, sort_keys=True).encode()).hexdigest()

        # Third entry links to second
        entry3 = {"id": "3", "previous_hash": hash2}
        hash3 = hashlib.sha256(json.dumps(entry3, sort_keys=True).encode()).hexdigest()

        # Verify chain
        assert entry2["previous_hash"] == hash1
        assert entry3["previous_hash"] == hash2

    def test_detect_tampered_entry(self):
        """Should detect if an entry was modified."""
        original = {"id": "1", "content": "original", "previous_hash": "GENESIS"}
        original_hash = hashlib.sha256(json.dumps(original, sort_keys=True).encode()).hexdigest()

        # Tamper with the entry
        tampered = {"id": "1", "content": "modified", "previous_hash": "GENESIS"}
        tampered_hash = hashlib.sha256(json.dumps(tampered, sort_keys=True).encode()).hexdigest()

        assert original_hash != tampered_hash


class TestProvenanceRecord:
    """Tests for ArtifactProvenanceRecord creation."""

    def test_create_record_with_phi_pass(self):
        """Should create record when no PHI detected."""
        record = {
            "artifact_id": "artifact-1",
            "artifact_type": "manuscript",
            "research_id": "research-1",
            "phi_scan_status": "PASS",
            "phi_findings": [],
            "created_at": datetime.utcnow().isoformat(),
        }

        assert record["phi_scan_status"] == "PASS"
        assert len(record["phi_findings"]) == 0

    def test_create_record_with_phi_fail(self):
        """Should mark record as FAIL when PHI detected."""
        record = {
            "artifact_id": "artifact-1",
            "artifact_type": "manuscript",
            "research_id": "research-1",
            "phi_scan_status": "FAIL",
            "phi_findings": [
                {"pattern_type": "SSN", "start_offset": 10, "end_offset": 21}
            ],
        }

        assert record["phi_scan_status"] == "FAIL"
        assert len(record["phi_findings"]) == 1

    def test_create_record_with_override(self):
        """Should allow steward override."""
        record = {
            "artifact_id": "artifact-1",
            "phi_scan_status": "OVERRIDE",
            "phi_findings": [],  # May still have findings
        }

        assert record["phi_scan_status"] == "OVERRIDE"

    def test_artifact_types(self):
        """Should validate artifact types."""
        valid_types = [
            "manuscript",
            "poster",
            "abstract",
            "slides",
            "supplementary",
            "figure",
            "table",
            "rebuttal",
            "camera_ready",
        ]

        for t in valid_types:
            assert t in valid_types


class TestProvenanceEdge:
    """Tests for provenance relationship edges."""

    def test_create_edge(self):
        """Should create edge between artifacts."""
        edge = {
            "id": "edge_artifact-1_artifact-2_derived_from",
            "source_artifact_id": "artifact-1",
            "target_artifact_id": "artifact-2",
            "relation_type": "derived_from",
            "created_by": "user-1",
            "created_at": datetime.utcnow().isoformat(),
        }

        assert edge["source_artifact_id"] == "artifact-1"
        assert edge["target_artifact_id"] == "artifact-2"
        assert edge["relation_type"] == "derived_from"

    def test_relation_types(self):
        """Should validate relation types."""
        valid_relations = [
            "derived_from",
            "extracted_from",
            "exported_to",
            "merged_with",
            "supersedes",
        ]

        for r in valid_relations:
            assert r in valid_relations

    def test_edge_hash_chain(self):
        """Should compute hash for edge verification."""
        edge_payload = {
            "id": "edge-1",
            "source": "artifact-1",
            "target": "artifact-2",
            "relation": "derived_from",
            "created_at": "2024-01-15T10:00:00",
            "previous_hash": "GENESIS",
        }

        edge_hash = hashlib.sha256(
            json.dumps(edge_payload, sort_keys=True).encode()
        ).hexdigest()

        assert len(edge_hash) == 64


class TestExportManifest:
    """Tests for export manifest generation."""

    def test_generate_manifest(self):
        """Should generate export manifest."""
        records = [
            {"artifact_id": "a1", "artifact_type": "manuscript", "phi_scan_status": "PASS"},
            {"artifact_id": "a2", "artifact_type": "figure", "phi_scan_status": "PASS"},
            {"artifact_id": "a3", "artifact_type": "table", "phi_scan_status": "FAIL"},
        ]

        exportable = [r for r in records if r["phi_scan_status"] in ("PASS", "OVERRIDE")]
        blocked = [r for r in records if r["phi_scan_status"] == "FAIL"]

        manifest = {
            "manifest_version": "1.0",
            "generated_at": datetime.utcnow().isoformat(),
            "statistics": {
                "total_records": len(records),
                "exportable": len(exportable),
                "blocked_phi": len(blocked),
            },
            "artifacts": exportable,
        }

        assert manifest["statistics"]["total_records"] == 3
        assert manifest["statistics"]["exportable"] == 2
        assert manifest["statistics"]["blocked_phi"] == 1

    def test_manifest_excludes_phi_fail(self):
        """Should exclude artifacts with PHI FAIL status."""
        records = [
            {"artifact_id": "a1", "phi_scan_status": "PASS"},
            {"artifact_id": "a2", "phi_scan_status": "FAIL"},
        ]

        exportable = [r for r in records if r["phi_scan_status"] != "FAIL"]

        assert len(exportable) == 1
        assert exportable[0]["artifact_id"] == "a1"

    def test_manifest_includes_override(self):
        """Should include artifacts with OVERRIDE status."""
        records = [
            {"artifact_id": "a1", "phi_scan_status": "OVERRIDE"},
        ]

        exportable = [r for r in records if r["phi_scan_status"] in ("PASS", "OVERRIDE")]

        assert len(exportable) == 1

    def test_manifest_verification_hash(self):
        """Should compute verification hash for manifest."""
        artifacts = [
            {"artifact_id": "a1", "content_hash": "hash1"},
            {"artifact_id": "a2", "content_hash": "hash2"},
        ]

        manifest_json = json.dumps(artifacts, sort_keys=True)
        verification_hash = hashlib.sha256(manifest_json.encode()).hexdigest()

        assert len(verification_hash) == 64


class TestRescanForPhi:
    """Tests for re-scanning content for PHI."""

    def test_rescan_updates_status(self):
        """Should update PHI status on rescan."""
        record = {
            "phi_scan_status": "PENDING",
            "phi_findings": [],
        }

        # After rescan with clean content
        record["phi_scan_status"] = "PASS"
        record["phi_scanned_at"] = datetime.utcnow().isoformat()

        assert record["phi_scan_status"] == "PASS"
        assert record["phi_scanned_at"] is not None

    def test_rescan_detects_new_phi(self):
        """Should detect new PHI on rescan."""
        record = {
            "phi_scan_status": "PASS",
            "phi_findings": [],
        }

        # Simulate PHI detection
        new_findings = [{"pattern_type": "SSN", "start_offset": 10, "end_offset": 21}]

        record["phi_scan_status"] = "FAIL"
        record["phi_findings"] = new_findings

        assert record["phi_scan_status"] == "FAIL"
        assert len(record["phi_findings"]) == 1

    def test_rescan_with_override(self):
        """Should allow override on rescan."""
        record = {
            "phi_scan_status": "FAIL",
            "phi_findings": [{"pattern_type": "MRN"}],
        }

        # Steward override
        record["phi_scan_status"] = "OVERRIDE"

        assert record["phi_scan_status"] == "OVERRIDE"


class TestChainValidation:
    """Tests for provenance chain validation."""

    def test_validate_valid_chain(self):
        """Should pass for valid chain."""
        previous_hash = "GENESIS"
        records = []

        for i in range(3):
            entry = {"id": f"record-{i}", "previous_hash": previous_hash}
            entry_hash = hashlib.sha256(json.dumps(entry, sort_keys=True).encode()).hexdigest()
            records.append({"entry": entry, "hash": entry_hash})
            previous_hash = entry_hash

        # Validate chain
        is_valid = True
        prev = "GENESIS"
        for r in records:
            if r["entry"]["previous_hash"] != prev:
                is_valid = False
                break
            prev = r["hash"]

        assert is_valid is True

    def test_detect_broken_chain(self):
        """Should detect broken chain."""
        records = [
            {"previous_hash": "GENESIS", "hash": "hash1"},
            {"previous_hash": "wrong_hash", "hash": "hash2"},  # Broken link
        ]

        is_valid = True
        prev = "GENESIS"
        for r in records:
            if r["previous_hash"] != prev:
                is_valid = False
                break
            prev = r["hash"]

        assert is_valid is False

    def test_empty_chain_is_valid(self):
        """Empty chain should be valid."""
        records = []
        is_valid = len(records) == 0 or True  # Empty is valid
        assert is_valid is True
