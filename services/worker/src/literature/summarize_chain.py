"""
Literature Summarization Chain

Processes retrieved literature to produce:
- Abstract summaries
- Thematic clustering
- Key insights and research gaps
- Citations list

Uses orchestrator AI router for LLM calls with PHI guarding.
"""

from __future__ import annotations

import os
import json
import logging
from dataclasses import dataclass, field, asdict
from typing import Any, Dict, List, Optional
import httpx

from src.governance.output_phi_guard import guard_text

logger = logging.getLogger(__name__)

AI_URL = os.getenv("AI_ROUTER_URL") or (
    os.getenv("ORCHESTRATOR_URL", "http://orchestrator:3001") + "/api/ai"
)


@dataclass
class ThematicCluster:
    """A cluster of papers sharing a theme"""
    theme: str
    paper_indices: List[int]
    summary: str
    key_terms: List[str] = field(default_factory=list)


@dataclass
class SummarizationResult:
    """Complete summarization output"""
    clusters: List[ThematicCluster]
    key_insights: List[str]
    research_gaps: List[str]
    top_methods: List[str]
    citations_formatted: List[str]
    paper_count: int
    success: bool = True
    error: Optional[str] = None


async def _call_ai(
    task_type: str,
    prompt: str,
    response_format: str = "json",
    max_tokens: int = 2000
) -> Dict[str, Any]:
    """
    Call orchestrator AI router endpoint.

    Args:
        task_type: Type of AI task (e.g., 'complex_synthesis')
        prompt: The prompt to send
        response_format: Expected response format ('json' or 'text')
        max_tokens: Maximum tokens in response

    Returns:
        AI response as dictionary
    """
    async with httpx.AsyncClient(timeout=60.0) as client:
        response = await client.post(
            AI_URL,
            json={
                "taskType": task_type,
                "prompt": prompt,
                "responseFormat": response_format,
                "maxTokens": max_tokens,
            },
        )
        response.raise_for_status()
        return response.json()


def _format_papers_for_prompt(papers: List[Dict[str, Any]]) -> str:
    """Format papers for inclusion in AI prompt"""
    lines = []
    for i, paper in enumerate(papers):
        title = paper.get('title', 'Untitled')
        abstract = paper.get('abstract', '') or ''
        year = paper.get('year', 'N/A')
        authors = paper.get('authors', [])
        author_str = ', '.join(authors[:3]) + ('...' if len(authors) > 3 else '')

        lines.append(f"[{i}] TITLE: {title}")
        lines.append(f"    AUTHORS: {author_str}")
        lines.append(f"    YEAR: {year}")
        if abstract:
            # Truncate long abstracts
            abstract_truncated = abstract[:500] + '...' if len(abstract) > 500 else abstract
            lines.append(f"    ABSTRACT: {abstract_truncated}")
        lines.append("")

    return "\n".join(lines)


def _format_citation(paper: Dict[str, Any], style: str = "vancouver") -> str:
    """Format a paper citation in specified style"""
    authors = paper.get('authors', [])
    title = paper.get('title', 'Untitled')
    year = paper.get('year', '')
    journal = paper.get('journal', '')
    doi = paper.get('doi', '')

    if style == "vancouver":
        # Vancouver style: Authors. Title. Journal. Year;...
        if authors:
            if len(authors) > 6:
                author_str = ', '.join(authors[:6]) + ', et al'
            else:
                author_str = ', '.join(authors)
        else:
            author_str = 'Unknown'

        citation = f"{author_str}. {title}."
        if journal:
            citation += f" {journal}."
        if year:
            citation += f" {year}."
        if doi:
            citation += f" doi:{doi}"
        return citation

    elif style == "apa":
        # APA style
        if authors:
            author_str = ', '.join(authors[:2])
            if len(authors) > 2:
                author_str += ', et al.'
        else:
            author_str = 'Unknown'

        return f"{author_str} ({year}). {title}. {journal}."

    return f"{title} ({year})"


async def summarize_papers(
    papers: List[Dict[str, Any]],
    citation_style: str = "vancouver",
    fail_closed: bool = True
) -> SummarizationResult:
    """
    Summarize a collection of papers with clustering and insights.

    Args:
        papers: List of paper dictionaries with title, abstract, authors, etc.
        citation_style: Citation format ('vancouver' or 'apa')
        fail_closed: If True, block on PHI detection (required in LIVE mode)

    Returns:
        SummarizationResult with clusters, insights, and gaps
    """
    if not papers:
        return SummarizationResult(
            clusters=[],
            key_insights=[],
            research_gaps=[],
            top_methods=[],
            citations_formatted=[],
            paper_count=0,
            success=True
        )

    try:
        # Format papers for prompt
        papers_text = _format_papers_for_prompt(papers)

        # PHI guard before sending to AI
        safe_text, findings = guard_text(papers_text, fail_closed=fail_closed)

        if findings and fail_closed:
            logger.warning(f"PHI detected in literature summarization input: {len(findings)} findings")
            return SummarizationResult(
                clusters=[],
                key_insights=[],
                research_gaps=["PHI detected in input - summarization blocked"],
                top_methods=[],
                citations_formatted=[],
                paper_count=len(papers),
                success=False,
                error="PHI_BLOCKED"
            )

        # Build summarization prompt
        prompt = f"""You are a medical systematic review assistant analyzing research papers.

Given the following {len(papers)} paper titles and abstracts, provide a structured analysis.

Return a JSON object with these fields:
- clusters: Array of thematic clusters, each with:
  - theme: string (descriptive theme name)
  - paper_indices: array of integers (indices of papers in this cluster)
  - summary: string (2-3 sentence summary of this theme)
  - key_terms: array of strings (key terms for this theme)
- key_insights: Array of 3-5 key insights from the literature (strings)
- research_gaps: Array of 2-4 identified research gaps (strings)
- top_methods: Array of common methodologies mentioned (strings)

Rules:
- Ground all insights in the provided abstracts
- Do not fabricate citations or claims
- Use cautious language for uncertain findings
- Identify genuine gaps, not just topics not covered

PAPERS:
{safe_text}

Return ONLY valid JSON, no markdown formatting."""

        # Call AI router
        ai_response = await _call_ai(
            task_type="complex_synthesis",
            prompt=prompt,
            response_format="json",
            max_tokens=3000
        )

        # Parse AI response
        result_data = ai_response.get('result') or ai_response.get('content') or ai_response

        if isinstance(result_data, str):
            # Try to parse as JSON
            try:
                result_data = json.loads(result_data)
            except json.JSONDecodeError:
                logger.error("Failed to parse AI response as JSON")
                result_data = {}

        # PHI guard the output
        output_str = json.dumps(result_data)
        safe_output, output_findings = guard_text(output_str, fail_closed=fail_closed)

        if output_findings and fail_closed:
            logger.warning("PHI detected in AI summarization output")
            return SummarizationResult(
                clusters=[],
                key_insights=[],
                research_gaps=["PHI detected in output - results blocked"],
                top_methods=[],
                citations_formatted=[],
                paper_count=len(papers),
                success=False,
                error="PHI_BLOCKED_OUTPUT"
            )

        # Build result
        clusters = []
        for cluster_data in result_data.get('clusters', []):
            clusters.append(ThematicCluster(
                theme=cluster_data.get('theme', 'Unknown'),
                paper_indices=cluster_data.get('paper_indices', []),
                summary=cluster_data.get('summary', ''),
                key_terms=cluster_data.get('key_terms', [])
            ))

        # Format citations
        citations = [_format_citation(p, citation_style) for p in papers]

        return SummarizationResult(
            clusters=clusters,
            key_insights=result_data.get('key_insights', []),
            research_gaps=result_data.get('research_gaps', []),
            top_methods=result_data.get('top_methods', []),
            citations_formatted=citations,
            paper_count=len(papers),
            success=True
        )

    except httpx.HTTPError as e:
        logger.error(f"AI router HTTP error: {e}")
        return SummarizationResult(
            clusters=[],
            key_insights=[],
            research_gaps=[],
            top_methods=[],
            citations_formatted=[_format_citation(p, citation_style) for p in papers],
            paper_count=len(papers),
            success=False,
            error=f"AI_ERROR: {str(e)}"
        )
    except Exception as e:
        logger.exception(f"Summarization failed: {e}")
        return SummarizationResult(
            clusters=[],
            key_insights=[],
            research_gaps=[],
            top_methods=[],
            citations_formatted=[],
            paper_count=len(papers),
            success=False,
            error=str(e)
        )


def summarization_result_to_dict(result: SummarizationResult) -> Dict[str, Any]:
    """Convert SummarizationResult to dictionary for JSON serialization"""
    return {
        'clusters': [asdict(c) for c in result.clusters],
        'key_insights': result.key_insights,
        'research_gaps': result.research_gaps,
        'top_methods': result.top_methods,
        'citations_formatted': result.citations_formatted,
        'paper_count': result.paper_count,
        'success': result.success,
        'error': result.error
    }
