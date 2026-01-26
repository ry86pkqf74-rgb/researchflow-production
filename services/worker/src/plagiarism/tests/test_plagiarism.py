"""Tests for plagiarism check provider system.

Tests cover:
- Mock provider behavior
- Gate enforcement logic
- Fail-closed behavior
- Audit logging
- Provider selection
"""

from __future__ import annotations

import os
import tempfile
from datetime import datetime, timezone
from pathlib import Path
from unittest import mock
import pytest

from ..provider import (
    PlagiarismCheckError,
    PlagiarismMatch,
    PlagiarismResult,
    ProviderStatus,
    hash_matched_text,
)
from ..mock_provider import MockPlagiarismProvider
from ..copyleaks_provider import CopyleaksProvider, is_copyleaks_configured
from ..gate import (
    PlagiarismGate,
    PlagiarismAuditAction,
    PlagiarismAuditLogger,
    check_plagiarism_with_gate,
    is_plagiarism_check_required,
)


# =============================================================================
# PROVIDER DATACLASS TESTS
# =============================================================================


class TestPlagiarismMatch:
    """Tests for PlagiarismMatch dataclass."""

    def test_create_match(self):
        """Test creating a plagiarism match."""
        match = PlagiarismMatch(
            source_url="https://example.com/paper",
            source_title="Test Paper",
            matched_text_hash="abc123",
            similarity=0.75,
            start_position=100,
            end_position=200,
        )

        assert match.source_url == "https://example.com/paper"
        assert match.source_title == "Test Paper"
        assert match.matched_text_hash == "abc123"
        assert match.similarity == 0.75
        assert match.start_position == 100
        assert match.end_position == 200

    def test_match_to_dict(self):
        """Test serialization to dictionary."""
        match = PlagiarismMatch(
            source_url="https://example.com",
            source_title="Title",
            matched_text_hash="hash123",
            similarity=0.5,
            start_position=0,
            end_position=50,
        )

        d = match.to_dict()
        assert d["sourceUrl"] == "https://example.com"
        assert d["sourceTitle"] == "Title"
        assert d["matchedTextHash"] == "hash123"
        assert d["similarity"] == 0.5

    def test_match_from_dict(self):
        """Test deserialization from dictionary."""
        data = {
            "sourceUrl": "https://test.com",
            "sourceTitle": "Test",
            "matchedTextHash": "xyz789",
            "similarity": 0.3,
            "startPosition": 10,
            "endPosition": 20,
        }

        match = PlagiarismMatch.from_dict(data)
        assert match.source_url == "https://test.com"
        assert match.similarity == 0.3


class TestPlagiarismResult:
    """Tests for PlagiarismResult dataclass."""

    def test_create_result(self):
        """Test creating a plagiarism result."""
        result = PlagiarismResult(
            similarity_score=0.05,
            matches=[],
            provider="mock",
            checked_at=datetime.now(timezone.utc),
            document_id="doc123",
            scan_id="scan456",
            is_mock=True,
        )

        assert result.similarity_score == 0.05
        assert result.provider == "mock"
        assert result.is_mock is True

    def test_result_passed_low_similarity(self):
        """Test that low similarity passes."""
        result = PlagiarismResult(
            similarity_score=0.05,
            matches=[],
            provider="mock",
            checked_at=datetime.now(timezone.utc),
        )

        assert result.passed is True

    def test_result_failed_high_similarity(self):
        """Test that high similarity fails."""
        result = PlagiarismResult(
            similarity_score=0.15,
            matches=[],
            provider="mock",
            checked_at=datetime.now(timezone.utc),
        )

        assert result.passed is False

    def test_result_boundary_similarity(self):
        """Test boundary condition at 10% threshold."""
        # Exactly 10% should fail
        result = PlagiarismResult(
            similarity_score=0.10,
            matches=[],
            provider="mock",
            checked_at=datetime.now(timezone.utc),
        )
        assert result.passed is False

        # Just under 10% should pass
        result2 = PlagiarismResult(
            similarity_score=0.099,
            matches=[],
            provider="mock",
            checked_at=datetime.now(timezone.utc),
        )
        assert result2.passed is True

    def test_invalid_similarity_score(self):
        """Test that invalid similarity scores raise error."""
        with pytest.raises(ValueError):
            PlagiarismResult(
                similarity_score=1.5,  # > 1.0
                matches=[],
                provider="mock",
                checked_at=datetime.now(timezone.utc),
            )

        with pytest.raises(ValueError):
            PlagiarismResult(
                similarity_score=-0.1,  # < 0
                matches=[],
                provider="mock",
                checked_at=datetime.now(timezone.utc),
            )

    def test_match_count(self):
        """Test match count property."""
        matches = [
            PlagiarismMatch(
                source_url="url1",
                source_title="title1",
                matched_text_hash="hash1",
                similarity=0.5,
                start_position=0,
                end_position=10,
            ),
            PlagiarismMatch(
                source_url="url2",
                source_title="title2",
                matched_text_hash="hash2",
                similarity=0.3,
                start_position=20,
                end_position=30,
            ),
        ]

        result = PlagiarismResult(
            similarity_score=0.4,
            matches=matches,
            provider="mock",
            checked_at=datetime.now(timezone.utc),
        )

        assert result.match_count == 2


class TestHashMatchedText:
    """Tests for the hash_matched_text function."""

    def test_hash_deterministic(self):
        """Test that hashing is deterministic."""
        text = "This is some matched text"
        hash1 = hash_matched_text(text)
        hash2 = hash_matched_text(text)
        assert hash1 == hash2

    def test_hash_different_for_different_text(self):
        """Test that different text produces different hashes."""
        hash1 = hash_matched_text("Text A")
        hash2 = hash_matched_text("Text B")
        assert hash1 != hash2

    def test_hash_format(self):
        """Test that hash is valid SHA256 hex format."""
        h = hash_matched_text("test")
        assert len(h) == 64  # SHA256 hex length
        assert all(c in "0123456789abcdef" for c in h)


# =============================================================================
# MOCK PROVIDER TESTS
# =============================================================================


class TestMockPlagiarismProvider:
    """Tests for the mock plagiarism provider."""

    def test_provider_name(self):
        """Test provider name is 'mock'."""
        provider = MockPlagiarismProvider()
        assert provider.name == "mock"

    def test_provider_status(self):
        """Test provider status is SANDBOX."""
        provider = MockPlagiarismProvider()
        assert provider.get_status() == ProviderStatus.SANDBOX

    def test_check_returns_result(self):
        """Test that check returns a valid result."""
        provider = MockPlagiarismProvider(simulate_latency=False)
        result = provider.check("Sample text for testing", "doc123")

        assert isinstance(result, PlagiarismResult)
        assert result.provider == "mock"
        assert result.document_id == "doc123"
        assert result.is_mock is True
        assert 0 <= result.similarity_score <= 1

    def test_check_deterministic(self):
        """Test that same input produces same output."""
        provider = MockPlagiarismProvider(simulate_latency=False)
        text = "Deterministic test text"
        doc_id = "doc456"

        result1 = provider.check(text, doc_id)
        result2 = provider.check(text, doc_id)

        assert result1.similarity_score == result2.similarity_score
        assert result1.scan_id == result2.scan_id

    def test_demo_mode_always_passes(self):
        """Test that demo mode produces low similarity (passing)."""
        provider = MockPlagiarismProvider(demo_mode=True, simulate_latency=False)

        # Run multiple checks to verify consistent passing
        for i in range(10):
            result = provider.check(f"Test text {i}", f"doc{i}")
            assert result.passed is True
            assert result.similarity_score < 0.10

    def test_non_demo_mode_varied_results(self):
        """Test that non-demo mode can produce varied results."""
        provider = MockPlagiarismProvider(demo_mode=False, simulate_latency=False)

        # Collect multiple results
        similarities = []
        for i in range(20):
            result = provider.check(f"Different text {i}", f"doc{i}")
            similarities.append(result.similarity_score)

        # Should have some variation in results
        assert min(similarities) != max(similarities)

    def test_force_similarity(self):
        """Test that force_similarity overrides normal calculation."""
        provider = MockPlagiarismProvider(
            force_similarity=0.50,
            simulate_latency=False,
        )

        result = provider.check("Any text", "doc123")
        assert result.similarity_score == 0.50
        assert result.passed is False  # 50% > 10% threshold

    def test_matches_generated_for_similarity(self):
        """Test that matches are generated proportional to similarity."""
        provider = MockPlagiarismProvider(
            force_similarity=0.25,
            simulate_latency=False,
        )

        result = provider.check("A" * 500, "doc123")  # Need enough text for matches
        assert len(result.matches) > 0

        # Low similarity should have few or no matches
        provider2 = MockPlagiarismProvider(
            force_similarity=0.001,
            simulate_latency=False,
        )
        result2 = provider2.check("Short", "doc456")
        assert len(result2.matches) == 0

    def test_matches_have_hashed_text(self):
        """Test that matches use hashed text, not raw text."""
        provider = MockPlagiarismProvider(
            force_similarity=0.25,
            simulate_latency=False,
        )

        result = provider.check("A" * 500, "doc123")

        for match in result.matches:
            # Verify hash format (should be hex SHA256)
            assert len(match.matched_text_hash) == 64
            assert all(c in "0123456789abcdef" for c in match.matched_text_hash)


# =============================================================================
# COPYLEAKS PROVIDER TESTS
# =============================================================================


class TestCopyleaksProvider:
    """Tests for Copyleaks provider configuration."""

    def test_provider_name(self):
        """Test provider name is 'copyleaks'."""
        provider = CopyleaksProvider()
        assert provider.name == "copyleaks"

    def test_not_configured_without_credentials(self):
        """Test provider is not configured without API key."""
        with mock.patch.dict(os.environ, {}, clear=True):
            provider = CopyleaksProvider()
            assert provider.is_configured is False
            assert provider.get_status() == ProviderStatus.UNAVAILABLE

    def test_configured_with_credentials(self):
        """Test provider is configured with API key and email."""
        provider = CopyleaksProvider(
            api_key="test_key",
            email="test@example.com",
        )
        assert provider.is_configured is True
        # Status should be AVAILABLE or SANDBOX depending on sandbox flag
        assert provider.get_status() in (ProviderStatus.AVAILABLE, ProviderStatus.SANDBOX)

    def test_sandbox_mode(self):
        """Test sandbox mode detection."""
        provider = CopyleaksProvider(
            api_key="test_key",
            email="test@example.com",
            sandbox=True,
        )
        assert provider.get_status() == ProviderStatus.SANDBOX

    def test_check_fails_without_config(self):
        """Test that check fails without configuration."""
        with mock.patch.dict(os.environ, {}, clear=True):
            provider = CopyleaksProvider()

            with pytest.raises(PlagiarismCheckError) as exc_info:
                provider.check("Test text", "doc123")

            assert exc_info.value.reason_code == "PROVIDER_NOT_CONFIGURED"


# =============================================================================
# GATE TESTS
# =============================================================================


class TestPlagiarismGate:
    """Tests for the plagiarism approval gate."""

    def test_gate_demo_mode_no_approval_required(self):
        """Test that DEMO mode doesn't require approval."""
        with mock.patch.dict(os.environ, {"ROS_MODE": "DEMO"}):
            gate = PlagiarismGate(mode="DEMO", persist_audit=False)
            assert gate.requires_approval("doc123") is False
            assert gate.is_approved("doc123") is True

    def test_gate_live_mode_with_mock_no_approval(self):
        """Test LIVE mode with mock provider (no Copyleaks) doesn't require approval."""
        with mock.patch.dict(os.environ, {"ROS_MODE": "LIVE"}, clear=True):
            gate = PlagiarismGate(mode="LIVE", persist_audit=False)
            # Without Copyleaks configured, falls back to mock
            assert gate.requires_approval("doc123") is False

    def test_gate_live_mode_with_copyleaks_requires_approval(self):
        """Test LIVE mode with Copyleaks requires approval."""
        with mock.patch.dict(os.environ, {
            "ROS_MODE": "LIVE",
            "COPYLEAKS_API_KEY": "test_key",
            "COPYLEAKS_EMAIL": "test@example.com",
        }):
            gate = PlagiarismGate(mode="LIVE", persist_audit=False)
            assert gate.requires_approval("doc123") is True
            assert gate.is_approved("doc123") is False

    def test_gate_approve_document(self):
        """Test approving a document."""
        with mock.patch.dict(os.environ, {
            "ROS_MODE": "LIVE",
            "COPYLEAKS_API_KEY": "test_key",
            "COPYLEAKS_EMAIL": "test@example.com",
        }):
            gate = PlagiarismGate(mode="LIVE", persist_audit=False)

            assert gate.requires_approval("doc123") is True
            gate.approve("doc123", "test_user")
            assert gate.requires_approval("doc123") is False
            assert gate.is_approved("doc123") is True

    def test_gate_check_without_approval_blocked(self):
        """Test that check is blocked without approval in LIVE mode."""
        with mock.patch.dict(os.environ, {
            "ROS_MODE": "LIVE",
            "COPYLEAKS_API_KEY": "test_key",
            "COPYLEAKS_EMAIL": "test@example.com",
        }):
            gate = PlagiarismGate(mode="LIVE", persist_audit=False)

            with pytest.raises(PlagiarismCheckError) as exc_info:
                gate.check("Test text", "doc123")

            assert exc_info.value.reason_code == "APPROVAL_REQUIRED"

    def test_gate_check_demo_mode_succeeds(self):
        """Test that check succeeds in DEMO mode without approval."""
        gate = PlagiarismGate(mode="DEMO", persist_audit=False)
        result = gate.check("Test text for checking", "doc123")

        assert isinstance(result, PlagiarismResult)
        assert result.is_mock is True

    def test_gate_get_provider_demo_mode(self):
        """Test provider selection in DEMO mode."""
        gate = PlagiarismGate(mode="DEMO", persist_audit=False)
        provider = gate.get_provider()

        assert isinstance(provider, MockPlagiarismProvider)

    def test_gate_get_provider_live_mode_fallback(self):
        """Test provider falls back to mock in LIVE mode without Copyleaks."""
        with mock.patch.dict(os.environ, {"ROS_MODE": "LIVE"}, clear=True):
            gate = PlagiarismGate(mode="LIVE", persist_audit=False)
            provider = gate.get_provider()

            # Without Copyleaks configured, should fall back to mock
            assert isinstance(provider, MockPlagiarismProvider)


# =============================================================================
# FAIL-CLOSED BEHAVIOR TESTS
# =============================================================================


class TestFailClosedBehavior:
    """Tests for fail-closed behavior."""

    def test_export_blocked_without_check(self):
        """Test export is blocked if required check not performed."""
        gate = PlagiarismGate(mode="LIVE", persist_audit=False)

        result = gate.block_export_if_required(
            document_id="doc123",
            plagiarism_required=True,
            last_result=None,
        )

        assert result["allowed"] is False
        assert result["reason_code"] == "CHECK_NOT_PERFORMED"

    def test_export_blocked_on_failed_check(self):
        """Test export is blocked if plagiarism check failed."""
        gate = PlagiarismGate(mode="LIVE", persist_audit=False)

        failed_result = PlagiarismResult(
            similarity_score=0.25,  # 25% > 10% threshold
            matches=[],
            provider="mock",
            checked_at=datetime.now(timezone.utc),
        )

        result = gate.block_export_if_required(
            document_id="doc123",
            plagiarism_required=True,
            last_result=failed_result,
        )

        assert result["allowed"] is False
        assert result["reason_code"] == "CHECK_FAILED"
        assert result["similarity_score"] == 0.25

    def test_export_allowed_on_passed_check(self):
        """Test export is allowed if plagiarism check passed."""
        gate = PlagiarismGate(mode="LIVE", persist_audit=False)

        passed_result = PlagiarismResult(
            similarity_score=0.03,  # 3% < 10% threshold
            matches=[],
            provider="mock",
            checked_at=datetime.now(timezone.utc),
        )

        result = gate.block_export_if_required(
            document_id="doc123",
            plagiarism_required=True,
            last_result=passed_result,
        )

        assert result["allowed"] is True

    def test_export_allowed_when_not_required(self):
        """Test export is allowed when plagiarism check not required."""
        gate = PlagiarismGate(mode="DEMO", persist_audit=False)

        result = gate.block_export_if_required(
            document_id="doc123",
            plagiarism_required=False,
            last_result=None,
        )

        assert result["allowed"] is True


# =============================================================================
# AUDIT LOGGING TESTS
# =============================================================================


class TestPlagiarismAuditLogger:
    """Tests for plagiarism audit logging."""

    def test_log_action(self):
        """Test logging an action."""
        with tempfile.TemporaryDirectory() as tmpdir:
            log_file = Path(tmpdir) / "audit.json"
            logger = PlagiarismAuditLogger(log_file=log_file)

            audit_id = logger.log_action(
                action=PlagiarismAuditAction.PLAGIARISM_CHECK_REQUESTED,
                document_id="doc123",
                mode="DEMO",
            )

            assert audit_id.startswith("PLAG_AUDIT_")

            entries = logger.get_entries()
            assert len(entries) == 1
            assert entries[0]["action"] == "PLAGIARISM_CHECK_REQUESTED"
            assert entries[0]["documentId"] == "doc123"

    def test_save_and_load(self):
        """Test persisting and loading audit log."""
        with tempfile.TemporaryDirectory() as tmpdir:
            log_file = Path(tmpdir) / "audit.json"

            # Create and save
            logger1 = PlagiarismAuditLogger(log_file=log_file)
            logger1.log_action(
                action=PlagiarismAuditAction.PLAGIARISM_CHECK_COMPLETED,
                document_id="doc456",
                similarity_score=0.05,
                passed=True,
            )
            logger1.save()

            # Load in new instance
            logger2 = PlagiarismAuditLogger(log_file=log_file)
            entries = logger2.get_entries()

            assert len(entries) == 1
            assert entries[0]["similarityScore"] == 0.05
            assert entries[0]["passed"] is True

    def test_hash_chain(self):
        """Test that entries form a hash chain."""
        with tempfile.TemporaryDirectory() as tmpdir:
            log_file = Path(tmpdir) / "audit.json"
            logger = PlagiarismAuditLogger(log_file=log_file)

            logger.log_action(
                action=PlagiarismAuditAction.PLAGIARISM_CHECK_REQUESTED,
                document_id="doc1",
            )
            logger.log_action(
                action=PlagiarismAuditAction.PLAGIARISM_CHECK_COMPLETED,
                document_id="doc1",
            )

            entries = logger.get_entries()

            # Second entry should reference first entry's hash
            assert entries[1]["prevLogHash"] == entries[0]["logHash"]


# =============================================================================
# CONVENIENCE FUNCTION TESTS
# =============================================================================


class TestConvenienceFunctions:
    """Tests for convenience functions."""

    def test_check_plagiarism_with_gate(self):
        """Test the check_plagiarism_with_gate convenience function."""
        with mock.patch.dict(os.environ, {"ROS_MODE": "DEMO"}):
            result = check_plagiarism_with_gate(
                text="Sample text for testing",
                document_id="doc123",
            )

            assert isinstance(result, PlagiarismResult)
            assert result.is_mock is True

    def test_is_plagiarism_check_required_from_config(self):
        """Test plagiarism_required flag from template config."""
        # Explicit True
        assert is_plagiarism_check_required(
            template_config={"plagiarism_required": True}
        ) is True

        # Explicit False
        assert is_plagiarism_check_required(
            template_config={"plagiarism_required": False}
        ) is False

    def test_is_plagiarism_check_required_live_manuscript(self):
        """Test that LIVE mode manuscript exports require check."""
        with mock.patch.dict(os.environ, {"ROS_MODE": "LIVE"}):
            assert is_plagiarism_check_required(
                export_type="manuscript"
            ) is True

            assert is_plagiarism_check_required(
                export_type="publication"
            ) is True

    def test_is_plagiarism_check_required_demo_no_default(self):
        """Test that DEMO mode doesn't require check by default."""
        with mock.patch.dict(os.environ, {"ROS_MODE": "DEMO"}):
            assert is_plagiarism_check_required(
                export_type="manuscript"
            ) is False


# =============================================================================
# INTEGRATION-STYLE TESTS
# =============================================================================


class TestPlagiarismWorkflow:
    """Integration-style tests for typical plagiarism check workflows."""

    def test_demo_mode_full_workflow(self):
        """Test complete workflow in DEMO mode."""
        with mock.patch.dict(os.environ, {"ROS_MODE": "DEMO"}):
            gate = PlagiarismGate(mode="DEMO", persist_audit=False)

            # Check should work without approval
            result = gate.check(
                text="This is a sample manuscript text for checking.",
                document_id="manuscript_001",
            )

            assert result.is_mock is True
            assert result.passed is True  # Demo mode always passes

            # Export should be allowed
            export_decision = gate.block_export_if_required(
                document_id="manuscript_001",
                plagiarism_required=True,
                last_result=result,
            )
            assert export_decision["allowed"] is True

    def test_live_mode_approved_workflow(self):
        """Test approved workflow in LIVE mode (mocked Copyleaks)."""
        with mock.patch.dict(os.environ, {
            "ROS_MODE": "LIVE",
            "COPYLEAKS_API_KEY": "test_key",
            "COPYLEAKS_EMAIL": "test@example.com",
        }):
            gate = PlagiarismGate(mode="LIVE", persist_audit=False)

            # Should require approval
            assert gate.requires_approval("doc123") is True

            # Approve the document
            gate.approve("doc123", "steward_user")

            # Now check should work
            # (Would actually call Copyleaks in real scenario, but it will fail
            # due to invalid credentials, so we mock at the provider level)
            with mock.patch.object(
                CopyleaksProvider, 'check',
                return_value=PlagiarismResult(
                    similarity_score=0.02,
                    matches=[],
                    provider="copyleaks",
                    checked_at=datetime.now(timezone.utc),
                    document_id="doc123",
                    is_mock=False,
                )
            ):
                result = gate.check(
                    text="Manuscript text",
                    document_id="doc123",
                )

                assert result.similarity_score == 0.02
                assert result.passed is True
