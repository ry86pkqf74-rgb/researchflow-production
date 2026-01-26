"""
Stage 12: Documentation

Handles report and documentation generation including:
- Markdown report generation
- PDF report generation
- Citation management
- Template-based document creation

This stage generates final documentation from analysis results.
"""

import logging
import os
from datetime import datetime
from typing import Any, Dict, List, Optional

from ..types import StageContext, StageResult
from ..registry import register_stage

logger = logging.getLogger("workflow_engine.stage_12_documentation")

# Default report sections if not specified
DEFAULT_SECTIONS = [
    "executive_summary",
    "methodology",
    "results",
    "discussion",
    "conclusions",
    "references",
]

# Supported template types
SUPPORTED_TEMPLATES = {
    "markdown": ".md",
    "pdf": ".pdf",
    "html": ".html",
    "latex": ".tex",
}


def generate_markdown_section(section_name: str, content: Dict[str, Any]) -> str:
    """Generate a Markdown section from content.

    Args:
        section_name: Name of the section
        content: Content dictionary for the section

    Returns:
        Formatted Markdown string
    """
    title = section_name.replace("_", " ").title()
    markdown = f"## {title}\n\n"

    if isinstance(content, dict):
        for key, value in content.items():
            if isinstance(value, list):
                markdown += f"### {key.replace('_', ' ').title()}\n\n"
                for item in value:
                    markdown += f"- {item}\n"
                markdown += "\n"
            elif isinstance(value, dict):
                markdown += f"### {key.replace('_', ' ').title()}\n\n"
                for sub_key, sub_value in value.items():
                    markdown += f"**{sub_key}**: {sub_value}\n\n"
            else:
                markdown += f"{value}\n\n"
    elif isinstance(content, str):
        markdown += f"{content}\n\n"
    else:
        markdown += f"{str(content)}\n\n"

    return markdown


def format_citations(citations: List[Dict[str, Any]]) -> str:
    """Format citations in a standard format.

    Args:
        citations: List of citation dictionaries

    Returns:
        Formatted citations string
    """
    formatted = "## References\n\n"
    for i, citation in enumerate(citations, 1):
        authors = citation.get("authors", "Unknown")
        title = citation.get("title", "Untitled")
        year = citation.get("year", "n.d.")
        source = citation.get("source", "")
        doi = citation.get("doi", "")

        formatted += f"[{i}] {authors} ({year}). {title}."
        if source:
            formatted += f" *{source}*."
        if doi:
            formatted += f" DOI: {doi}"
        formatted += "\n\n"

    return formatted


def generate_report_content(
    template_type: str,
    sections: List[str],
    previous_results: Dict[int, Any],
    config: Dict[str, Any],
) -> tuple[str, List[Dict[str, Any]]]:
    """Generate report content from analysis results.

    Args:
        template_type: Type of template (markdown, pdf, html)
        sections: List of section names to include
        previous_results: Results from previous stages
        config: Job configuration

    Returns:
        Tuple of (report_content, citations)
    """
    citations: List[Dict[str, Any]] = []
    content_parts: List[str] = []

    # Add title
    title = config.get("report_title", "Research Analysis Report")
    content_parts.append(f"# {title}\n\n")
    content_parts.append(f"*Generated: {datetime.utcnow().isoformat()}Z*\n\n")
    content_parts.append("---\n\n")

    for section in sections:
        section_content = {}

        # Extract relevant data from previous results
        if section == "executive_summary":
            section_content = {
                "overview": config.get("executive_summary", "Analysis completed successfully."),
                "key_findings": _extract_key_findings(previous_results),
            }
        elif section == "methodology":
            section_content = {
                "data_sources": config.get("data_sources", ["Primary dataset"]),
                "analysis_methods": config.get("analysis_methods", ["Statistical analysis"]),
                "tools_used": ["ResearchFlow Workflow Engine"],
            }
        elif section == "results":
            section_content = _extract_results(previous_results)
        elif section == "discussion":
            section_content = config.get("discussion", "Results are presented above.")
        elif section == "conclusions":
            section_content = config.get("conclusions", "Analysis completed per protocol.")
        elif section == "references":
            # Handle references separately
            citations = config.get("citations", [])
            content_parts.append(format_citations(citations))
            continue

        content_parts.append(generate_markdown_section(section, section_content))

    return "".join(content_parts), citations


def _extract_key_findings(previous_results: Dict[int, Any]) -> List[str]:
    """Extract key findings from previous stage results.

    Args:
        previous_results: Results from previous stages

    Returns:
        List of key finding strings
    """
    findings = []

    for stage_id, result in previous_results.items():
        if hasattr(result, 'output') and result.output:
            output = result.output
            if isinstance(output, dict):
                if "findings" in output:
                    findings.extend(output["findings"])
                if "summary" in output:
                    findings.append(f"Stage {stage_id}: {output['summary']}")

    if not findings:
        findings.append("Analysis completed with no critical findings.")

    return findings


def _extract_results(previous_results: Dict[int, Any]) -> Dict[str, Any]:
    """Extract results summary from previous stages.

    Args:
        previous_results: Results from previous stages

    Returns:
        Dictionary of extracted results
    """
    results = {
        "stages_completed": [],
        "outputs": {},
    }

    for stage_id, result in previous_results.items():
        if hasattr(result, 'status') and result.status == "completed":
            results["stages_completed"].append(f"Stage {stage_id}: {getattr(result, 'stage_name', 'Unknown')}")
            if hasattr(result, 'output') and result.output:
                results["outputs"][f"stage_{stage_id}"] = result.output

    return results


@register_stage
class DocumentationStage:
    """Stage 12: Documentation

    Generates reports and documentation from analysis results.
    """

    stage_id = 12
    stage_name = "Documentation"

    async def execute(self, context: StageContext) -> StageResult:
        """Execute documentation generation.

        Args:
            context: Stage execution context

        Returns:
            StageResult with generated documentation
        """
        started_at = datetime.utcnow().isoformat() + "Z"
        errors: List[str] = []
        warnings: List[str] = []
        output: Dict[str, Any] = {}
        artifacts: List[str] = []

        logger.info(f"Starting documentation generation for job {context.job_id}")

        # Get configuration
        template_type = context.config.get("template_type", "markdown")
        sections = context.config.get("sections", DEFAULT_SECTIONS)

        # Validate template type
        if template_type not in SUPPORTED_TEMPLATES:
            errors.append(
                f"Unsupported template type '{template_type}'. "
                f"Supported: {list(SUPPORTED_TEMPLATES.keys())}"
            )
            completed_at = datetime.utcnow().isoformat() + "Z"
            started_dt = datetime.fromisoformat(started_at.replace("Z", "+00:00"))
            completed_dt = datetime.fromisoformat(completed_at.replace("Z", "+00:00"))
            duration_ms = int((completed_dt - started_dt).total_seconds() * 1000)

            return StageResult(
                stage_id=self.stage_id,
                stage_name=self.stage_name,
                status="failed",
                started_at=started_at,
                completed_at=completed_at,
                duration_ms=duration_ms,
                errors=errors,
            )

        # Validate sections
        invalid_sections = [s for s in sections if not isinstance(s, str)]
        if invalid_sections:
            warnings.append(f"Invalid section entries removed: {invalid_sections}")
            sections = [s for s in sections if isinstance(s, str)]

        try:
            # Generate report content
            report_content, citations = generate_report_content(
                template_type=template_type,
                sections=sections,
                previous_results=context.previous_results,
                config=context.config,
            )

            output["report_content"] = report_content
            output["citations"] = citations
            output["template_type"] = template_type
            output["sections_included"] = sections

            # Generate output file
            file_extension = SUPPORTED_TEMPLATES[template_type]
            report_filename = f"report_{context.job_id}{file_extension}"
            report_path = os.path.join(context.artifact_path, report_filename)

            # Ensure artifact directory exists
            os.makedirs(context.artifact_path, exist_ok=True)

            # Write report file
            with open(report_path, "w", encoding="utf-8") as f:
                f.write(report_content)

            artifacts.append(report_path)
            output["generated_files"] = [report_filename]

            logger.info(f"Generated report: {report_path}")

        except Exception as e:
            logger.error(f"Documentation generation failed: {str(e)}")
            errors.append(f"Failed to generate documentation: {str(e)}")

        completed_at = datetime.utcnow().isoformat() + "Z"
        started_dt = datetime.fromisoformat(started_at.replace("Z", "+00:00"))
        completed_dt = datetime.fromisoformat(completed_at.replace("Z", "+00:00"))
        duration_ms = int((completed_dt - started_dt).total_seconds() * 1000)

        status = "failed" if errors else "completed"

        return StageResult(
            stage_id=self.stage_id,
            stage_name=self.stage_name,
            status=status,
            started_at=started_at,
            completed_at=completed_at,
            duration_ms=duration_ms,
            output=output,
            artifacts=artifacts,
            errors=errors,
            warnings=warnings,
            metadata={
                "governance_mode": context.governance_mode,
                "template_type": template_type,
                "sections_count": len(sections),
            },
        )
