"""
Literature Summarization Job

Implements map-reduce summarization for literature items using LLM.
"""

from __future__ import annotations

import json
import logging
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional

from src.llm.router import generate_text
from src.provenance.artifact_store import store_text, new_run_id

logger = logging.getLogger(__name__)


@dataclass
class SummarizationConfig:
    """Configuration for literature summarization."""
    include_methods: bool = True
    include_findings: bool = True
    include_limitations: bool = True
    max_papers_for_synthesis: int = 20
    synthesis_style: str = "structured"  # narrative, bullet_points, structured
    model: str = "claude-3-haiku-20240307"
    temperature: float = 0.3
    max_tokens_per_paper: int = 500
    max_tokens_synthesis: int = 2000


# Prompt templates
PAPER_SUMMARY_PROMPT = """Summarize the following research paper. Extract:
1. Study Design/Methods (if available)
2. Population/Sample (if mentioned)
3. Key Findings (2-3 main results)
4. Limitations (if mentioned)

Paper Title: {title}
{abstract_section}

Provide a structured summary in JSON format:
{{
  "methods": "brief description of methods",
  "population": "description of study population",
  "key_findings": ["finding 1", "finding 2"],
  "limitations": ["limitation 1"]
}}

If information is not available, use null for that field."""

SYNTHESIS_PROMPT = """You are synthesizing {num_papers} research papers on the topic: "{query}"

Here are the individual paper summaries:

{paper_summaries}

Create a comprehensive synthesis that identifies:
1. Common themes across papers
2. Key findings that are consistently reported
3. Any contradictions or disagreements
4. Gaps in the literature
5. An overall summary

Provide your synthesis in JSON format:
{{
  "themes": [
    {{"theme": "theme name", "description": "explanation", "supporting_papers": ["paper_id1", "paper_id2"]}}
  ],
  "contradictions": [
    {{"topic": "topic name", "positions": [{{"position": "view 1", "supporting_papers": ["id1"]}}, {{"position": "view 2", "supporting_papers": ["id2"]}}]}}
  ],
  "gaps": ["gap 1", "gap 2"],
  "overall_summary": "A comprehensive 2-3 paragraph summary of the literature"
}}"""

SYNTHESIS_PROMPT_BULLETS = """You are synthesizing {num_papers} research papers on the topic: "{query}"

Paper summaries:
{paper_summaries}

Create a bullet-point synthesis covering:
- Main themes
- Key findings
- Contradictions (if any)
- Research gaps

Format as JSON:
{{
  "themes": ["theme 1", "theme 2"],
  "key_findings": ["finding 1", "finding 2"],
  "contradictions": ["contradiction 1"],
  "gaps": ["gap 1"],
  "overall_summary": "Brief overall summary"
}}"""


def summarize_single_paper(
    paper: Dict[str, Any],
    config: SummarizationConfig,
) -> Dict[str, Any]:
    """
    Summarize a single paper using LLM.

    Args:
        paper: Paper dict with title, abstract, etc.
        config: Summarization configuration

    Returns:
        Summary dict
    """
    title = paper.get("title", "Untitled")
    abstract = paper.get("abstract", "")

    if not abstract:
        # Return minimal summary without abstract
        return {
            "paper_id": paper.get("id", "unknown"),
            "title": title,
            "methods": None,
            "population": None,
            "key_findings": [],
            "limitations": [],
            "error": "No abstract available",
        }

    abstract_section = f"\nAbstract:\n{abstract}" if abstract else ""

    prompt = PAPER_SUMMARY_PROMPT.format(
        title=title,
        abstract_section=abstract_section,
    )

    try:
        result = generate_text(
            task_name="paper_summary",
            prompt=prompt,
            system_prompt="You are a research assistant that summarizes scientific papers accurately and concisely. Always respond with valid JSON.",
            model=config.model,
            temperature=config.temperature,
            max_tokens=config.max_tokens_per_paper,
        )

        # Parse JSON response
        response_text = result.text.strip()
        # Handle potential markdown code blocks
        if response_text.startswith("```"):
            lines = response_text.split("\n")
            response_text = "\n".join(lines[1:-1])

        summary = json.loads(response_text)

        return {
            "paper_id": paper.get("id", "unknown"),
            "title": title,
            "methods": summary.get("methods"),
            "population": summary.get("population"),
            "key_findings": summary.get("key_findings", []),
            "limitations": summary.get("limitations", []),
        }

    except json.JSONDecodeError as e:
        logger.warning(f"Failed to parse summary for {title}: {e}")
        return {
            "paper_id": paper.get("id", "unknown"),
            "title": title,
            "methods": None,
            "population": None,
            "key_findings": [],
            "limitations": [],
            "error": f"JSON parse error: {str(e)}",
        }
    except Exception as e:
        logger.error(f"Error summarizing paper {title}: {e}")
        return {
            "paper_id": paper.get("id", "unknown"),
            "title": title,
            "methods": None,
            "population": None,
            "key_findings": [],
            "limitations": [],
            "error": str(e),
        }


def synthesize_summaries(
    paper_summaries: List[Dict[str, Any]],
    query: str,
    config: SummarizationConfig,
) -> Dict[str, Any]:
    """
    Synthesize multiple paper summaries into a cohesive analysis.

    Args:
        paper_summaries: List of individual paper summaries
        query: Original search query for context
        config: Summarization configuration

    Returns:
        Synthesis result dict
    """
    if not paper_summaries:
        return {
            "themes": [],
            "contradictions": [],
            "gaps": [],
            "overall_summary": "No papers to synthesize.",
        }

    # Limit papers for synthesis
    papers_for_synthesis = paper_summaries[:config.max_papers_for_synthesis]

    # Format paper summaries for prompt
    summaries_text = ""
    for i, summary in enumerate(papers_for_synthesis, 1):
        findings = "\n".join(f"  - {f}" for f in summary.get("key_findings", []))
        limitations = "\n".join(f"  - {l}" for l in summary.get("limitations", []))

        summaries_text += f"""
Paper {i} (ID: {summary.get('paper_id', 'unknown')}):
  Title: {summary.get('title', 'Unknown')}
  Methods: {summary.get('methods', 'Not specified')}
  Population: {summary.get('population', 'Not specified')}
  Key Findings:
{findings or '    - None extracted'}
  Limitations:
{limitations or '    - None extracted'}
"""

    # Choose prompt based on style
    if config.synthesis_style == "bullet_points":
        prompt = SYNTHESIS_PROMPT_BULLETS.format(
            num_papers=len(papers_for_synthesis),
            query=query,
            paper_summaries=summaries_text,
        )
    else:
        prompt = SYNTHESIS_PROMPT.format(
            num_papers=len(papers_for_synthesis),
            query=query,
            paper_summaries=summaries_text,
        )

    try:
        result = generate_text(
            task_name="literature_synthesis",
            prompt=prompt,
            system_prompt="You are a research synthesis expert. Analyze multiple research papers and identify patterns, themes, and gaps. Always respond with valid JSON.",
            model=config.model,
            temperature=config.temperature,
            max_tokens=config.max_tokens_synthesis,
        )

        # Parse JSON response
        response_text = result.text.strip()
        if response_text.startswith("```"):
            lines = response_text.split("\n")
            response_text = "\n".join(lines[1:-1])

        synthesis = json.loads(response_text)

        return {
            "themes": synthesis.get("themes", []),
            "contradictions": synthesis.get("contradictions", []),
            "gaps": synthesis.get("gaps", []),
            "overall_summary": synthesis.get("overall_summary", ""),
        }

    except json.JSONDecodeError as e:
        logger.warning(f"Failed to parse synthesis: {e}")
        return {
            "themes": [],
            "contradictions": [],
            "gaps": [],
            "overall_summary": "Failed to generate synthesis.",
            "error": f"JSON parse error: {str(e)}",
        }
    except Exception as e:
        logger.error(f"Error during synthesis: {e}")
        return {
            "themes": [],
            "contradictions": [],
            "gaps": [],
            "overall_summary": "Error during synthesis.",
            "error": str(e),
        }


def summarize_literature(
    items: List[Dict[str, Any]],
    query: str = "",
    config: Optional[SummarizationConfig] = None,
    save_artifact: bool = True,
) -> Dict[str, Any]:
    """
    Summarize literature items using map-reduce approach.

    Map: Summarize each paper individually
    Reduce: Synthesize all summaries into themes and insights

    Args:
        items: List of literature items
        query: Original search query for context
        config: Summarization configuration
        save_artifact: Whether to save results as artifact

    Returns:
        Complete summarization result
    """
    if config is None:
        config = SummarizationConfig()

    if not items:
        return {
            "paper_summaries": [],
            "synthesis": {
                "themes": [],
                "contradictions": [],
                "gaps": [],
                "overall_summary": "No papers provided for summarization.",
            },
            "generated_at": "",
            "config": {
                "model": config.model,
                "synthesis_style": config.synthesis_style,
            },
        }

    logger.info(f"Summarizing {len(items)} papers...")

    # Map phase: Summarize each paper
    paper_summaries = []
    for item in items:
        summary = summarize_single_paper(item, config)
        paper_summaries.append(summary)
        logger.info(f"Summarized: {summary.get('title', 'Unknown')[:50]}...")

    # Reduce phase: Synthesize summaries
    logger.info("Synthesizing summaries...")
    synthesis = synthesize_summaries(paper_summaries, query, config)

    from datetime import datetime
    generated_at = datetime.utcnow().isoformat() + "Z"

    result = {
        "paper_summaries": paper_summaries,
        "synthesis": synthesis,
        "generated_at": generated_at,
        "config": {
            "model": config.model,
            "synthesis_style": config.synthesis_style,
            "papers_processed": len(items),
            "papers_synthesized": min(len(items), config.max_papers_for_synthesis),
        },
    }

    # Save as artifact
    if save_artifact:
        try:
            run_id = new_run_id("lit_summary")

            # Save JSON
            store_text(
                run_id=run_id,
                category="literature_summary",
                filename="summary.json",
                text=json.dumps(result, indent=2),
            )

            # Save Markdown
            markdown = generate_markdown_report(result, query)
            store_text(
                run_id=run_id,
                category="literature_summary",
                filename="summary.md",
                text=markdown,
            )

            result["artifact_run_id"] = run_id
            logger.info(f"Saved summarization artifact: {run_id}")

        except Exception as e:
            logger.warning(f"Failed to save artifact: {e}")

    return result


def generate_markdown_report(result: Dict[str, Any], query: str) -> str:
    """Generate a Markdown report from summarization result."""
    lines = [
        "# Literature Summarization Report",
        f"\n**Query:** {query}" if query else "",
        f"\n**Generated:** {result.get('generated_at', 'Unknown')}",
        f"\n**Papers Analyzed:** {result['config'].get('papers_processed', 0)}",
        "\n---\n",
        "## Synthesis",
        "\n### Overall Summary",
        result.get('synthesis', {}).get('overall_summary', 'No summary available.'),
        "\n### Themes",
    ]

    themes = result.get('synthesis', {}).get('themes', [])
    if themes:
        for theme in themes:
            if isinstance(theme, dict):
                lines.append(f"\n**{theme.get('theme', 'Unknown')}**")
                lines.append(f"\n{theme.get('description', '')}")
                papers = theme.get('supporting_papers', [])
                if papers:
                    lines.append(f"\n*Supporting papers: {', '.join(papers)}*")
            else:
                lines.append(f"- {theme}")
    else:
        lines.append("\nNo themes identified.")

    lines.append("\n### Research Gaps")
    gaps = result.get('synthesis', {}).get('gaps', [])
    if gaps:
        for gap in gaps:
            lines.append(f"- {gap}")
    else:
        lines.append("\nNo gaps identified.")

    lines.append("\n---\n")
    lines.append("## Individual Paper Summaries")

    for summary in result.get('paper_summaries', []):
        lines.append(f"\n### {summary.get('title', 'Unknown')}")
        lines.append(f"\n*ID: {summary.get('paper_id', 'unknown')}*")

        if summary.get('methods'):
            lines.append(f"\n**Methods:** {summary['methods']}")
        if summary.get('population'):
            lines.append(f"\n**Population:** {summary['population']}")

        findings = summary.get('key_findings', [])
        if findings:
            lines.append("\n**Key Findings:**")
            for f in findings:
                lines.append(f"- {f}")

        limitations = summary.get('limitations', [])
        if limitations:
            lines.append("\n**Limitations:**")
            for l in limitations:
                lines.append(f"- {l}")

        if summary.get('error'):
            lines.append(f"\n*Note: {summary['error']}*")

    return "\n".join(lines)
