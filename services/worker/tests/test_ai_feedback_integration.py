"""
AI Feedback Integration Tests (Phase 11)

Comprehensive tests for the AI self-improvement loop components:
- Quality checks
- Refinement engine
- Configuration
- End-to-end workflows

Last Updated: 2026-01-23
"""

import os
import pytest
from typing import List

# Set test environment before importing modules
os.environ["AUTO_REFINE_ENABLED"] = "true"
os.environ["MAX_REFINE_ATTEMPTS"] = "3"
os.environ["REFINEMENT_ESCALATION_THRESHOLD"] = "2"
os.environ["ENVIRONMENT"] = "test"

from ai_feedback import (
    # Quality checks
    QualityCheck,
    check_citations_present,
    check_key_points_covered,
    check_no_question_marks,
    check_length_within_bounds,
    check_no_placeholders,
    validate_narrative_content,
    # Refinement
    RefinementEngine,
    RefinementContext,
    refine_prompt,
    get_refinement_engine,
    get_applicable_rules,
    # Configuration
    AIFeedbackConfig,
    get_ai_feedback_config,
    is_auto_refine_enabled,
    is_narrative_task,
    get_quality_check_options,
    reset_config,
    # Types
    FeedbackRecord,
)


# =============================================================================
# Quality Checks Tests
# =============================================================================

class TestCitationsCheck:
    """Tests for citation detection."""
    
    def test_detects_numbered_citations(self):
        content = "The study showed results [1]. Previous work [2] confirmed this."
        result = check_citations_present(content, min_count=2)
        
        assert result.passed is True
        assert result.category == "citations"
        assert result.details["actual"] == 2
    
    def test_detects_author_citations(self):
        content = "According to (Smith, 2024), the findings were clear."
        result = check_citations_present(content, min_count=1)
        
        assert result.passed is True
    
    def test_fails_when_insufficient(self):
        content = "Content without any citations."
        result = check_citations_present(content, min_count=3)
        
        assert result.passed is False
        assert result.score == 0.0
        assert "expected at least 3" in result.reason
    
    def test_detects_doi(self):
        content = "See doi:10.1234/example.2024 for details."
        result = check_citations_present(content, min_count=1)
        
        assert result.passed is True
    
    def test_detects_citation_ranges(self):
        content = "Multiple studies [1-5] support this."
        result = check_citations_present(content, min_count=1)
        
        assert result.passed is True


class TestKeyPointsCheck:
    """Tests for key points coverage."""
    
    def test_all_points_covered(self):
        content = "Methods section here. Results show improvement. Conclusions drawn."
        key_points = ["methods", "results", "conclusions"]
        result = check_key_points_covered(content, key_points)
        
        assert result.passed is True
        assert result.score == 1.0
        assert result.category == "coverage"
    
    def test_missing_points_detected(self):
        content = "Only methods discussed here."
        key_points = ["methods", "results", "conclusions"]
        result = check_key_points_covered(content, key_points)
        
        assert result.passed is False
        assert "results" in result.details["missing"]
        assert "conclusions" in result.details["missing"]
    
    def test_case_insensitive(self):
        content = "METHODS and RESULTS discussed."
        key_points = ["methods", "results"]
        result = check_key_points_covered(content, key_points, case_sensitive=False)
        
        assert result.passed is True
    
    def test_empty_points_list(self):
        content = "Any content here."
        result = check_key_points_covered(content, [])
        
        assert result.passed is True
        assert result.score == 1.0


class TestQuestionMarksCheck:
    """Tests for question mark detection."""
    
    def test_no_questions(self):
        content = "This is definitive. Results are clear."
        result = check_no_question_marks(content)
        
        assert result.passed is True
        assert result.score == 1.0
    
    def test_questions_detected(self):
        content = "Is this correct? Should we reconsider?"
        result = check_no_question_marks(content)
        
        assert result.passed is False
        assert result.details["actual"] == 2
        assert result.severity == "warning"
    
    def test_score_reduction(self):
        content = "Question? Another? Third?"
        result = check_no_question_marks(content)
        
        assert result.score == pytest.approx(0.7, rel=0.1)


class TestLengthCheck:
    """Tests for length validation."""
    
    def test_within_bounds(self):
        content = " ".join(["word"] * 50)
        result = check_length_within_bounds(content, min_words=10, max_words=100)
        
        assert result.passed is True
        assert result.category == "length"
    
    def test_too_short(self):
        content = "Too short."
        result = check_length_within_bounds(content, min_words=50, max_words=200)
        
        assert result.passed is False
        assert "too short" in result.reason
    
    def test_too_long(self):
        content = " ".join(["word"] * 100)
        result = check_length_within_bounds(content, min_words=10, max_words=50)
        
        assert result.passed is False
        assert "too long" in result.reason


class TestPlaceholdersCheck:
    """Tests for placeholder detection."""
    
    def test_no_placeholders(self):
        content = "Complete content with no missing parts."
        result = check_no_placeholders(content)
        
        assert result.passed is True
        assert result.category == "completeness"
    
    def test_detects_todo(self):
        content = "Introduction done. [TODO: Add conclusion]"
        result = check_no_placeholders(content)
        
        assert result.passed is False
        assert result.severity == "error"
    
    def test_detects_tbd(self):
        content = "Results are TBD."
        result = check_no_placeholders(content)
        
        assert result.passed is False
    
    def test_detects_xxx(self):
        content = "Value is XXX."
        result = check_no_placeholders(content)
        
        assert result.passed is False


class TestValidateNarrative:
    """Tests for combined narrative validation."""
    
    def test_all_checks_pass(self):
        content = "The study [1] examined methods. Results showed improvement. Conclusions support the hypothesis."
        checks = validate_narrative_content(
            content,
            min_citations=1,
            key_points=["methods", "results", "conclusions"],
            min_words=5,
            max_words=50,
            check_placeholders=True,
        )
        
        assert all(c.passed for c in checks)
    
    def test_reports_all_failures(self):
        content = "Short [TODO]."
        checks = validate_narrative_content(
            content,
            min_citations=3,
            key_points=["methods", "results"],
            min_words=100,
            check_placeholders=True,
        )
        
        failed = [c for c in checks if not c.passed]
        assert len(failed) >= 3


# =============================================================================
# Refinement Engine Tests
# =============================================================================

class TestRefinementEngine:
    """Tests for the refinement engine."""
    
    @pytest.fixture
    def engine(self):
        return RefinementEngine(max_attempts=3, escalation_threshold=2)
    
    def test_refines_failed_checks(self, engine):
        original = "Write about clinical outcomes."
        failed_checks = [
            QualityCheck(
                name="citations_present",
                passed=False,
                severity="warning",
                category="citations",
                details={"expected": 3, "actual": 0},
            ),
        ]
        
        result = engine.refine(original, failed_checks)
        
        assert result.refined is True
        assert "REFINEMENT INSTRUCTIONS" in result.prompt
        assert original in result.prompt
        assert len(result.applied_rules) == 1
    
    def test_respects_max_attempts(self, engine):
        original = "Write content."
        failed_checks = [
            QualityCheck(name="citations_present", passed=False, severity="warning"),
        ]
        context = RefinementContext(
            original_prompt=original,
            attempt_count=3,  # At max
            max_attempts=3,
        )
        
        result = engine.refine(original, failed_checks, context)
        
        assert result.refined is False
        assert "Maximum refinement attempts" in result.skip_reason
        assert result.should_escalate is True
    
    def test_recommends_escalation_at_threshold(self, engine):
        original = "Write content."
        failed_checks = [
            QualityCheck(name="citations_present", passed=False, severity="warning"),
        ]
        context = RefinementContext(
            original_prompt=original,
            attempt_count=2,  # At escalation threshold
            max_attempts=3,
            current_tier="MINI",
        )
        
        result = engine.refine(original, failed_checks, context)
        
        assert result.should_escalate is True
        assert result.suggested_tier == "FRONTIER"
    
    def test_no_escalate_from_frontier(self, engine):
        original = "Write content."
        failed_checks = [
            QualityCheck(name="citations_present", passed=False, severity="warning"),
        ]
        context = RefinementContext(
            original_prompt=original,
            attempt_count=2,
            max_attempts=3,
            current_tier="FRONTIER",
        )
        
        result = engine.refine(original, failed_checks, context)
        
        assert result.suggested_tier is None
    
    def test_creates_anonymized_summary(self, engine):
        original = "Sensitive prompt content."
        failed_checks = [
            QualityCheck(
                name="citations_present",
                passed=False,
                severity="warning",
                category="citations",
            ),
        ]
        
        result = engine.refine(original, failed_checks)
        
        assert len(result.summary.prompt_hash) == 16
        assert result.summary.failed_check_count == 1
        assert "citations" in result.summary.failed_categories
    
    def test_can_refine(self, engine):
        failed_checks = [
            QualityCheck(name="citations_present", passed=False, severity="warning"),
        ]
        
        assert engine.can_refine(failed_checks) is True
    
    def test_cannot_refine_unknown_checks(self, engine):
        failed_checks = [
            QualityCheck(name="unknown_check", passed=False, severity="warning"),
        ]
        
        assert engine.can_refine(failed_checks) is False
    
    def test_get_recommendation(self, engine):
        failed_checks = [
            QualityCheck(name="citations_present", passed=False, severity="warning"),
        ]
        
        rec = engine.get_recommendation(failed_checks)
        
        assert rec["can_refine"] is True
        assert "citations_present" in rec["applicable_rules"]


class TestApplicableRules:
    """Tests for rule selection."""
    
    def test_returns_rules_for_failed_checks(self):
        failed_checks = [
            QualityCheck(name="citations_present", passed=False, severity="warning"),
            QualityCheck(name="key_points_covered", passed=False, severity="warning"),
        ]
        
        rules = get_applicable_rules(failed_checks)
        
        assert len(rules) == 2
        assert rules[0].check_name == "key_points_covered"  # Higher priority
    
    def test_handles_length_short(self):
        failed_checks = [
            QualityCheck(
                name="length_within_bounds",
                passed=False,
                severity="warning",
                details={"expected": {"min": 100, "max": 500}, "actual": 50},
            ),
        ]
        
        rules = get_applicable_rules(failed_checks)
        
        assert any(r.check_name == "length_within_bounds_short" for r in rules)
    
    def test_handles_length_long(self):
        failed_checks = [
            QualityCheck(
                name="length_within_bounds",
                passed=False,
                severity="warning",
                details={"expected": {"min": 100, "max": 500}, "actual": 1000},
            ),
        ]
        
        rules = get_applicable_rules(failed_checks)
        
        assert any(r.check_name == "length_within_bounds_long" for r in rules)


# =============================================================================
# Configuration Tests
# =============================================================================

class TestConfiguration:
    """Tests for configuration loading."""
    
    @pytest.fixture(autouse=True)
    def reset(self):
        reset_config()
        yield
        reset_config()
    
    def test_loads_from_env(self):
        config = get_ai_feedback_config()
        
        assert config.auto_refine.enabled is True
        assert config.auto_refine.max_attempts == 3
        assert config.auto_refine.escalation_threshold == 2
    
    def test_validation(self):
        config = get_ai_feedback_config()
        valid, errors = config.validate()
        
        assert valid is True
        assert len(errors) == 0
    
    def test_is_auto_refine_enabled(self):
        assert is_auto_refine_enabled() is True
    
    def test_is_narrative_task(self):
        assert is_narrative_task("draft_section") is True
        assert is_narrative_task("abstract_generate") is True
        assert is_narrative_task("classify") is False
    
    def test_get_quality_check_options(self):
        options = get_quality_check_options("draft_section")
        
        assert options["min_citations"] == 3
        assert options["min_words"] == 100
        assert options["max_words"] == 2000
        assert options["check_placeholders"] is True


# =============================================================================
# FeedbackRecord Tests
# =============================================================================

class TestFeedbackRecord:
    """Tests for feedback record creation."""
    
    def test_creates_with_defaults(self):
        record = FeedbackRecord(job_id="job_123", task_type="draft_section")
        
        assert record.feedback_id.startswith("fb_")
        assert record.job_id == "job_123"
        assert record.overall_passed is False
    
    def test_hash_prompt(self):
        prompt = "Test prompt content"
        hash1 = FeedbackRecord.hash_prompt(prompt)
        hash2 = FeedbackRecord.hash_prompt(prompt)
        
        assert hash1 == hash2
        assert len(hash1) == 64  # SHA-256
    
    def test_add_check(self):
        record = FeedbackRecord(job_id="job_123")
        record.add_check("citations", True, 0.9, "citations")
        
        assert len(record.quality_checks) == 1
        assert record.quality_checks[0].passed is True
    
    def test_finalize(self):
        record = FeedbackRecord(job_id="job_123")
        record.add_check("citations", True, 0.9)
        record.add_check("length", True, 0.8)
        record.finalize()
        
        assert record.overall_passed is True
        assert record.overall_score == pytest.approx(0.85, rel=0.01)
    
    def test_to_dict(self):
        record = FeedbackRecord(job_id="job_123", task_type="draft_section")
        record.add_check("citations", True, 0.9)
        record.finalize()
        
        data = record.to_dict()
        
        assert data["jobId"] == "job_123"
        assert data["taskType"] == "draft_section"
        assert len(data["qualityChecks"]) == 1


# =============================================================================
# Integration Tests
# =============================================================================

class TestEndToEndWorkflow:
    """End-to-end integration tests."""
    
    def test_full_refinement_workflow(self):
        """Test complete workflow: check → refine → verify."""
        
        # 1. Initial content with issues
        content = "Short content without citations."
        
        # 2. Run quality checks
        checks = validate_narrative_content(
            content,
            min_citations=2,
            key_points=["methods", "results"],
            min_words=50,
            check_placeholders=True,
        )
        
        failed = [c for c in checks if not c.passed]
        assert len(failed) >= 2  # Citations and key points should fail
        
        # 3. Refine prompt
        engine = get_refinement_engine()
        result = engine.refine("Write a research summary.", failed)
        
        assert result.refined is True
        assert "REFINEMENT INSTRUCTIONS" in result.prompt
        
        # 4. Create feedback record
        record = FeedbackRecord(
            job_id="job_test",
            task_type="draft_section",
            model_tier="MINI",
        )
        
        for check in checks:
            record.add_check(
                check.name,
                check.passed,
                check.score,
                check.category,
            )
        
        record.refinement_applied = result.refined
        record.refinement_attempts = 1
        record.finalize()
        
        # 5. Verify record
        assert record.overall_passed is False  # Still has failures
        assert record.refinement_applied is True
        assert len(record.quality_checks) >= 2
    
    def test_narrative_task_workflow(self):
        """Test narrative task with all checks passing."""
        
        # Good content - long enough to pass min_words=100
        content = """
        The study [1] used comprehensive methods to analyze patient outcomes in a 
        large-scale clinical trial involving over 500 participants across multiple
        healthcare facilities. The research team employed rigorous statistical 
        analysis techniques to ensure the validity and reliability of our findings.
        
        Results showed significant improvement in mortality rates, with a 25% 
        reduction observed in the treatment group compared to the control group [2].
        Secondary outcomes including hospital readmission rates and quality of life
        measures also demonstrated substantial improvements in the intervention arm.
        
        These conclusions support the hypothesis that early intervention significantly
        improves clinical outcomes for patients with this condition [3]. The findings
        have important implications for clinical practice and healthcare policy.
        """
        
        # Get task-specific options
        options = get_quality_check_options("draft_section")
        
        # Run checks
        checks = validate_narrative_content(
            content,
            min_citations=options["min_citations"],
            key_points=["methods", "results", "conclusions"],
            min_words=options["min_words"],
            max_words=options["max_words"],
            check_placeholders=options["check_placeholders"],
        )
        
        # Should pass all checks
        failed = [c for c in checks if not c.passed]
        assert len(failed) == 0


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
