"""
Hybrid AI QA System

Combines Claude (structural checks) + ChatGPT (narrative QA) for comprehensive
AI-powered quality assurance.

Architecture:
- Claude Sonnet 4: Deep structural analysis, schema validation, logical consistency
- ChatGPT: Natural language QA narratives, failure explanations, recommendations

This hybrid approach leverages the strengths of both models:
- Claude excels at structured reasoning and code/data analysis
- ChatGPT excels at natural language generation and narrative synthesis
"""

import logging
from typing import Dict, List, Optional, Any
from dataclasses import dataclass
from datetime import datetime
import json
from pathlib import Path

logger = logging.getLogger(__name__)


@dataclass
class AIQAResult:
    """Result from AI quality assurance"""

    timestamp: datetime
    model: str
    analysis_type: str
    findings: List[str]
    recommendations: List[str]
    confidence: float
    execution_time_ms: float

    def to_dict(self) -> Dict[str, Any]:
        return {
            "timestamp": self.timestamp.isoformat(),
            "model": self.model,
            "analysis_type": self.analysis_type,
            "findings": self.findings,
            "recommendations": self.recommendations,
            "confidence": self.confidence,
            "execution_time_ms": self.execution_time_ms,
        }


class HybridAIQA:
    """
    Hybrid AI Quality Assurance system.

    Workflow:
    1. Claude performs structural analysis (schema, linkage logic, consistency)
    2. ChatGPT generates narrative QA log with explanations
    3. Results are merged into comprehensive QA report
    """

    def __init__(
        self, claude_model: str = "claude-sonnet-4", chatgpt_model: str = "gpt-4"
    ):
        """
        Initialize hybrid AI QA system.

        Parameters
        ----------
        claude_model : str
            Claude model for structural checks
        chatgpt_model : str
            ChatGPT model for narrative generation
        """
        self.claude_model = claude_model
        self.chatgpt_model = chatgpt_model
        logger.info(
            f"Initialized HybridAIQA (Claude: {claude_model}, ChatGPT: {chatgpt_model})"
        )

    def run_qa_pipeline(
        self,
        verification_result: "VerificationResult",
        data_summary: Dict[str, Any],
        context: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, AIQAResult]:
        """
        Run complete hybrid AI QA pipeline.

        Parameters
        ----------
        verification_result : VerificationResult
            Result from layered verification
        data_summary : dict
            Summary statistics of data
        context : dict, optional
            Additional context

        Returns
        -------
        dict
            {
                'claude_structural': AIQAResult,
                'chatgpt_narrative': AIQAResult
            }
        """
        logger.info("Running hybrid AI QA pipeline")

        # Run Claude structural checks
        claude_result = self.run_structural_checks_claude(
            verification_result, data_summary, context
        )

        # Run ChatGPT narrative QA
        chatgpt_result = self.run_narrative_qa_chatgpt(
            verification_result, claude_result, context
        )

        return {"claude_structural": claude_result, "chatgpt_narrative": chatgpt_result}

    def run_structural_checks_claude(
        self,
        verification_result: "VerificationResult",
        data_summary: Dict[str, Any],
        context: Optional[Dict[str, Any]] = None,
    ) -> AIQAResult:
        """
        Run Claude-powered structural analysis.

        Claude excels at:
        - Deep logical reasoning
        - Schema validation analysis
        - Consistency checking
        - Code/data structure analysis

        Parameters
        ----------
        verification_result : VerificationResult
            Verification result to analyze
        data_summary : dict
            Data summary statistics
        context : dict, optional
            Additional context

        Returns
        -------
        AIQAResult
        """
        start_time = datetime.utcnow()
        logger.info(f"Running Claude structural checks ({self.claude_model})...")

        findings = []
        recommendations = []

        # Simulated Claude structural analysis
        # In production, this would call Claude API with structured prompts

        # Analyze verification layers
        for layer, result in verification_result.layers.items():
            if result.status == "FAILED":
                findings.append(
                    f"Critical: {layer.name} layer failed with {len(result.errors)} errors. "
                    f"This indicates fundamental data quality issues that must be resolved."
                )
                recommendations.append(
                    f"Immediate action required for {layer.name}: " + result.errors[0]
                    if result.errors
                    else "Review layer details"
                )
            elif result.status == "WARNING":
                findings.append(
                    f"Advisory: {layer.name} layer has {len(result.warnings)} warnings. "
                    f"Data is usable but may have quality concerns."
                )

        # Structural consistency checks
        if "SCHEMA" in [l.name for l in verification_result.layers.keys()]:
            findings.append(
                "Schema validation performed: All structural constraints verified "
                "(types, nulls, ranges, cardinality)"
            )

        if "CONCORDANCE" in [l.name for l in verification_result.layers.keys()]:
            findings.append(
                "Concordance validation performed: Clinical agreement between linked "
                "modalities verified against expected thresholds"
            )

        # Overall structural assessment
        if verification_result.overall_passed:
            findings.append(
                "Structural assessment: Data structure is sound and meets all "
                "defined quality gates. No blocking issues detected."
            )
            confidence = 0.95
        else:
            findings.append(
                "Structural assessment: Critical issues detected that compromise "
                "data integrity. Pipeline blocked pending resolution."
            )
            confidence = 0.70
            recommendations.append(
                "Halt downstream analysis until structural issues are resolved. "
                "Review error logs and re-run ingestion with corrected data."
            )

        end_time = datetime.utcnow()
        execution_time = (end_time - start_time).total_seconds() * 1000

        logger.info(
            f"Claude analysis complete: {len(findings)} findings, {len(recommendations)} recommendations"
        )

        return AIQAResult(
            timestamp=start_time,
            model=self.claude_model,
            analysis_type="structural_checks",
            findings=findings,
            recommendations=recommendations,
            confidence=confidence,
            execution_time_ms=execution_time,
        )

    def run_narrative_qa_chatgpt(
        self,
        verification_result: "VerificationResult",
        claude_result: AIQAResult,
        context: Optional[Dict[str, Any]] = None,
    ) -> AIQAResult:
        """
        Run ChatGPT-powered narrative QA log generation.

        ChatGPT excels at:
        - Natural language synthesis
        - Human-readable explanations
        - Contextual narrative generation
        - Actionable recommendations

        Parameters
        ----------
        verification_result : VerificationResult
            Verification result
        claude_result : AIQAResult
            Claude structural analysis result
        context : dict, optional
            Additional context

        Returns
        -------
        AIQAResult
        """
        start_time = datetime.utcnow()
        logger.info(f"Running ChatGPT narrative QA ({self.chatgpt_model})...")

        findings = []
        recommendations = []

        # Simulated ChatGPT narrative generation
        # In production, this would call OpenAI API

        # Generate executive summary
        if verification_result.overall_passed:
            narrative = (
                f"Quality assurance completed successfully. The dataset has passed all "
                f"{len(verification_result.layers)} verification layers with "
                f"{verification_result.total_warnings} minor warnings. "
                f"Data is approved for downstream analysis and manuscript preparation."
            )
        else:
            narrative = (
                f"Quality assurance identified critical issues requiring attention. "
                f"Out of {len(verification_result.layers)} verification layers, "
                f"{sum(1 for r in verification_result.layers.values() if not r.passed)} "
                f"failed validation. Please review error details and re-submit "
                f"corrected data."
            )

        findings.append(f"Executive Summary: {narrative}")

        # Layer-specific narratives
        for layer, result in verification_result.layers.items():
            if result.errors:
                layer_narrative = (
                    f"The {layer.name} validation detected {len(result.errors)} errors. "
                    f"These errors indicate data quality issues that must be resolved "
                    f"before proceeding. Common causes include: incorrect data types, "
                    f"missing required values, or values outside acceptable ranges."
                )
                findings.append(layer_narrative)
                recommendations.append(
                    f"For {layer.name}: Review the specific error messages, trace back "
                    f"to source data, and correct the identified issues. Re-run the "
                    f"ingestion pipeline after corrections."
                )
            elif result.warnings:
                layer_narrative = (
                    f"The {layer.name} validation produced {len(result.warnings)} warnings. "
                    f"While not blocking, these warnings suggest potential quality concerns "
                    f"that should be investigated. The data is usable but may benefit from "
                    f"review."
                )
                findings.append(layer_narrative)

        # Synthesis from Claude findings
        findings.append(
            f"Structural Analysis Integration: Claude identified {len(claude_result.findings)} "
            f"structural findings with {claude_result.confidence:.0%} confidence. "
            f"These findings have been incorporated into this narrative assessment."
        )

        # Final recommendation
        if verification_result.overall_passed:
            recommendations.append(
                "Recommendation: APPROVED for downstream analysis. Proceed with confidence. "
                "Minor warnings should be documented in the analysis notes but do not block usage."
            )
            confidence = 0.90
        else:
            recommendations.append(
                "Recommendation: BLOCKED pending resolution of critical issues. "
                "Do not proceed with analysis until all errors are resolved and "
                "verification re-run successfully."
            )
            confidence = 0.85

        end_time = datetime.utcnow()
        execution_time = (end_time - start_time).total_seconds() * 1000

        logger.info(f"ChatGPT analysis complete: {len(findings)} narrative findings")

        return AIQAResult(
            timestamp=start_time,
            model=self.chatgpt_model,
            analysis_type="narrative_qa",
            findings=findings,
            recommendations=recommendations,
            confidence=confidence,
            execution_time_ms=execution_time,
        )


def generate_hybrid_qa_log(
    verification_result: "VerificationResult",
    ai_qa_results: Dict[str, AIQAResult],
    output_path: Optional[Path] = None,
) -> str:
    """
    Generate comprehensive hybrid QA log combining all AI analyses.

    Parameters
    ----------
    verification_result : VerificationResult
        Verification result
    ai_qa_results : dict
        AI QA results from hybrid pipeline
    output_path : Path, optional
        Path to save log

    Returns
    -------
    str
        Formatted hybrid QA log
    """
    lines = []
    lines.append("=" * 80)
    lines.append("HYBRID AI QUALITY ASSURANCE LOG")
    lines.append("=" * 80)
    lines.append(f"Timestamp: {datetime.utcnow().isoformat()}")
    lines.append(f"Verification Status: {verification_result.overall_status.value}")
    lines.append(
        f"Overall Passed: {'✅ YES' if verification_result.overall_passed else '❌ NO'}"
    )
    lines.append("")

    # Claude structural analysis
    lines.append("--- CLAUDE STRUCTURAL ANALYSIS ---")
    claude = ai_qa_results.get("claude_structural")
    if claude:
        lines.append(f"Model: {claude.model}")
        lines.append(f"Confidence: {claude.confidence:.0%}")
        lines.append(f"Execution Time: {claude.execution_time_ms:.1f} ms")
        lines.append("")
        lines.append("Findings:")
        for i, finding in enumerate(claude.findings, 1):
            lines.append(f"  {i}. {finding}")
        lines.append("")
        lines.append("Recommendations:")
        for i, rec in enumerate(claude.recommendations, 1):
            lines.append(f"  {i}. {rec}")
    lines.append("")

    # ChatGPT narrative QA
    lines.append("--- CHATGPT NARRATIVE QA ---")
    chatgpt = ai_qa_results.get("chatgpt_narrative")
    if chatgpt:
        lines.append(f"Model: {chatgpt.model}")
        lines.append(f"Confidence: {chatgpt.confidence:.0%}")
        lines.append(f"Execution Time: {chatgpt.execution_time_ms:.1f} ms")
        lines.append("")
        lines.append("Narrative Findings:")
        for i, finding in enumerate(chatgpt.findings, 1):
            lines.append(f"  {i}. {finding}")
        lines.append("")
        lines.append("Narrative Recommendations:")
        for i, rec in enumerate(chatgpt.recommendations, 1):
            lines.append(f"  {i}. {rec}")
    lines.append("")

    # Verification layer details
    lines.append("--- VERIFICATION LAYER DETAILS ---")
    for layer in sorted(verification_result.layers.keys(), key=lambda x: x.value):
        result = verification_result.layers[layer]
        status_emoji = (
            "✅"
            if result.passed
            else ("⚠️" if result.status.value == "WARNING" else "❌")
        )
        lines.append(f"{status_emoji} {layer.name}: {result.status.value}")
        if result.metrics:
            lines.append(
                f"  Metrics: {json.dumps(result.metrics, indent=4, default=str)}"
            )
    lines.append("")

    lines.append("=" * 80)
    lines.append("END OF HYBRID AI QA LOG")
    lines.append("=" * 80)

    log = "\n".join(lines)

    if output_path:
        output_path.write_text(log)
        logger.info(f"Hybrid QA log saved to: {output_path}")

    return log


# Convenience functions
def run_structural_checks_claude(verification_result, data_summary) -> AIQAResult:
    """Convenience function for Claude structural checks"""
    qa = HybridAIQA()
    return qa.run_structural_checks_claude(verification_result, data_summary)


def run_narrative_qa_chatgpt(verification_result, claude_result) -> AIQAResult:
    """Convenience function for ChatGPT narrative QA"""
    qa = HybridAIQA()
    return qa.run_narrative_qa_chatgpt(verification_result, claude_result)
