"""
Gap Analysis Job

Identifies research gaps from literature synthesis using keyword analysis
and optional LLM-based insight generation.
"""

from __future__ import annotations

import json
import logging
from collections import Counter
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Dict, List, Optional, Set

from src.llm.router import generate_text
from src.provenance.artifact_store import store_text, new_run_id
from src.utils.keyword_extraction import extract_keywords_tfidf, KeywordResult

logger = logging.getLogger(__name__)


@dataclass
class GapAnalysisConfig:
    """Configuration for gap analysis."""
    use_llm: bool = True
    model: str = "claude-3-haiku-20240307"
    temperature: float = 0.4
    max_tokens: int = 2000
    min_papers_for_analysis: int = 3
    top_keywords: int = 30
    identify_temporal_gaps: bool = True
    identify_methodological_gaps: bool = True
    identify_population_gaps: bool = True


@dataclass
class GapReport:
    """Research gap analysis report."""
    query: str
    paper_count: int
    temporal_coverage: Dict[str, Any]
    keyword_analysis: Dict[str, Any]
    identified_gaps: List[Dict[str, Any]]
    recommendations: List[str]
    confidence: str  # low, medium, high
    generated_at: str
    method: str  # "statistical", "llm", "hybrid"


GAP_ANALYSIS_PROMPT = """You are a research synthesis expert analyzing a body of literature.

Research Topic: {query}
Number of Papers: {paper_count}

## Temporal Distribution
{temporal_info}

## Top Keywords (by frequency/importance)
{keywords}

## Paper Methods (if available)
{methods_summary}

## Existing Synthesis (if available)
{synthesis_summary}

Based on this information, identify:

1. **Research Gaps**: What questions remain unanswered? What populations or contexts are understudied?
2. **Methodological Gaps**: What methods are underutilized? What study designs are missing?
3. **Temporal Gaps**: Are there recent developments not covered? Historical gaps?
4. **Future Directions**: What research would most advance this field?

Respond in JSON format:
{{
  "identified_gaps": [
    {{"type": "population|methodology|temporal|conceptual", "description": "Gap description", "evidence": "Supporting evidence from the corpus", "priority": "high|medium|low"}}
  ],
  "recommendations": [
    "Specific research recommendation 1",
    "Specific research recommendation 2"
  ],
  "confidence_assessment": "high|medium|low",
  "confidence_rationale": "Explanation for confidence level"
}}
"""


def analyze_temporal_distribution(
    papers: List[Dict[str, Any]]
) -> Dict[str, Any]:
    """Analyze temporal distribution of papers."""
    years = [p.get("year") for p in papers if p.get("year")]

    if not years:
        return {
            "year_range": None,
            "papers_with_year": 0,
            "distribution": {},
            "recent_5_years": 0,
            "gaps": [],
        }

    year_counts = Counter(years)
    min_year = min(years)
    max_year = max(years)
    current_year = datetime.now().year

    # Find gaps (missing years in range)
    all_years = set(range(min_year, max_year + 1))
    covered_years = set(year_counts.keys())
    gap_years = sorted(all_years - covered_years)

    # Count recent papers
    recent_years = [y for y in years if y >= current_year - 5]

    return {
        "year_range": [min_year, max_year],
        "papers_with_year": len(years),
        "distribution": dict(sorted(year_counts.items())),
        "recent_5_years": len(recent_years),
        "peak_year": year_counts.most_common(1)[0] if year_counts else None,
        "gaps": gap_years[-10:] if gap_years else [],  # Last 10 gap years
    }


def analyze_methods(papers: List[Dict[str, Any]]) -> Dict[str, Any]:
    """Analyze methods mentioned in papers."""
    method_keywords = {
        "rct": "Randomized Controlled Trial",
        "randomized": "Randomized Study",
        "cohort": "Cohort Study",
        "case-control": "Case-Control Study",
        "cross-sectional": "Cross-Sectional Study",
        "meta-analysis": "Meta-Analysis",
        "systematic review": "Systematic Review",
        "qualitative": "Qualitative Study",
        "survey": "Survey",
        "retrospective": "Retrospective Study",
        "prospective": "Prospective Study",
        "longitudinal": "Longitudinal Study",
        "observational": "Observational Study",
        "experimental": "Experimental Study",
        "pilot": "Pilot Study",
    }

    method_counts: Counter = Counter()

    for paper in papers:
        abstract = (paper.get("abstract") or "").lower()
        title = (paper.get("title") or "").lower()
        text = f"{title} {abstract}"

        for keyword, method_name in method_keywords.items():
            if keyword in text:
                method_counts[method_name] += 1

    return {
        "detected_methods": dict(method_counts.most_common()),
        "total_papers": len(papers),
        "papers_with_methods": sum(1 for p in papers if method_counts),
    }


def identify_statistical_gaps(
    papers: List[Dict[str, Any]],
    keywords: KeywordResult,
    temporal: Dict[str, Any],
    methods: Dict[str, Any],
) -> List[Dict[str, Any]]:
    """Identify gaps using statistical analysis."""
    gaps = []

    # Temporal gaps
    if temporal.get("gaps"):
        gaps.append({
            "type": "temporal",
            "description": f"No publications found for years: {', '.join(map(str, temporal['gaps'][:5]))}",
            "evidence": f"Year coverage: {temporal['year_range']}",
            "priority": "low",
        })

    # Recent literature gap
    if temporal.get("recent_5_years", 0) < 2 and len(papers) > 5:
        gaps.append({
            "type": "temporal",
            "description": "Limited recent publications (last 5 years)",
            "evidence": f"Only {temporal['recent_5_years']} papers from recent 5 years",
            "priority": "medium",
        })

    # Methodological gaps
    all_methods = {"Randomized Controlled Trial", "Cohort Study", "Meta-Analysis",
                   "Qualitative Study", "Systematic Review"}
    detected = set(methods.get("detected_methods", {}).keys())
    missing_methods = all_methods - detected

    if missing_methods and len(papers) > 10:
        gaps.append({
            "type": "methodology",
            "description": f"Study types not represented: {', '.join(list(missing_methods)[:3])}",
            "evidence": f"Detected methods: {', '.join(list(detected)[:5])}",
            "priority": "medium",
        })

    # Low paper count
    if len(papers) < 10:
        gaps.append({
            "type": "conceptual",
            "description": "Limited body of literature on this topic",
            "evidence": f"Only {len(papers)} papers found",
            "priority": "high" if len(papers) < 5 else "medium",
        })

    return gaps


def run_gap_analysis(
    papers: List[Dict[str, Any]],
    query: str = "",
    synthesis: Optional[Dict[str, Any]] = None,
    config: Optional[GapAnalysisConfig] = None,
    save_artifact: bool = True,
) -> Dict[str, Any]:
    """
    Run gap analysis on literature corpus.

    Args:
        papers: List of paper items
        query: Original search query
        synthesis: Optional synthesis result from summarization job
        config: Analysis configuration
        save_artifact: Whether to save as artifact

    Returns:
        Gap analysis report
    """
    if config is None:
        config = GapAnalysisConfig()

    if not papers:
        return {
            "query": query,
            "paper_count": 0,
            "identified_gaps": [],
            "recommendations": ["Insufficient literature for analysis"],
            "confidence": "low",
            "method": "none",
        }

    logger.info(f"Running gap analysis on {len(papers)} papers")

    # Extract keywords from abstracts
    abstracts = [p.get("abstract", "") for p in papers if p.get("abstract")]
    keywords = extract_keywords_tfidf(abstracts, top_k=config.top_keywords)

    # Analyze temporal distribution
    temporal = analyze_temporal_distribution(papers)

    # Analyze methods
    methods = analyze_methods(papers)

    # Statistical gap identification
    statistical_gaps = identify_statistical_gaps(papers, keywords, temporal, methods)

    # Determine analysis method
    use_llm = config.use_llm and len(papers) >= config.min_papers_for_analysis

    if use_llm:
        try:
            llm_result = _run_llm_gap_analysis(
                papers, query, keywords, temporal, methods, synthesis, config
            )
            identified_gaps = llm_result.get("identified_gaps", []) + statistical_gaps
            recommendations = llm_result.get("recommendations", [])
            confidence = llm_result.get("confidence_assessment", "medium")
            method = "hybrid"
        except Exception as e:
            logger.warning(f"LLM gap analysis failed: {e}, using statistical only")
            identified_gaps = statistical_gaps
            recommendations = _generate_statistical_recommendations(papers, temporal, methods)
            confidence = "medium"
            method = "statistical"
    else:
        identified_gaps = statistical_gaps
        recommendations = _generate_statistical_recommendations(papers, temporal, methods)
        confidence = "low" if len(papers) < 5 else "medium"
        method = "statistical"

    # Deduplicate gaps
    seen_descriptions = set()
    unique_gaps = []
    for gap in identified_gaps:
        desc = gap.get("description", "")
        if desc not in seen_descriptions:
            seen_descriptions.add(desc)
            unique_gaps.append(gap)

    result = {
        "query": query,
        "paper_count": len(papers),
        "temporal_coverage": temporal,
        "keyword_analysis": {
            "top_keywords": keywords.keywords[:15],
            "unique_terms": keywords.unique_terms,
            "method": keywords.method,
        },
        "methods_analysis": methods,
        "identified_gaps": unique_gaps,
        "recommendations": recommendations,
        "confidence": confidence,
        "method": method,
        "generated_at": datetime.utcnow().isoformat() + "Z",
    }

    # Save artifact
    if save_artifact:
        try:
            run_id = new_run_id("gap_analysis")

            # Save JSON
            store_text(
                run_id=run_id,
                category="gap_analysis",
                filename="gap_report.json",
                text=json.dumps(result, indent=2, default=str),
            )

            # Save Markdown report
            markdown = _generate_markdown_report(result)
            store_text(
                run_id=run_id,
                category="gap_analysis",
                filename="gap_report.md",
                text=markdown,
            )

            result["artifact_run_id"] = run_id
            logger.info(f"Saved gap analysis artifact: {run_id}")

        except Exception as e:
            logger.warning(f"Failed to save artifact: {e}")

    return result


def _run_llm_gap_analysis(
    papers: List[Dict[str, Any]],
    query: str,
    keywords: KeywordResult,
    temporal: Dict[str, Any],
    methods: Dict[str, Any],
    synthesis: Optional[Dict[str, Any]],
    config: GapAnalysisConfig,
) -> Dict[str, Any]:
    """Run LLM-based gap analysis."""
    # Format temporal info
    temporal_info = f"Year range: {temporal.get('year_range', 'Unknown')}\n"
    temporal_info += f"Papers with year: {temporal.get('papers_with_year', 0)}\n"
    temporal_info += f"Recent 5 years: {temporal.get('recent_5_years', 0)} papers\n"
    if temporal.get("gaps"):
        temporal_info += f"Missing years: {', '.join(map(str, temporal['gaps'][:5]))}"

    # Format keywords
    keyword_text = "\n".join([
        f"- {kw[0]}: {kw[1]:.3f}" for kw in keywords.keywords[:20]
    ])

    # Format methods
    methods_summary = "\n".join([
        f"- {m}: {c} papers" for m, c in methods.get("detected_methods", {}).items()
    ]) or "No specific methods detected"

    # Format synthesis
    synthesis_summary = "Not available"
    if synthesis:
        overall = synthesis.get("overall_summary", "")
        themes = synthesis.get("themes", [])
        if overall:
            synthesis_summary = f"Summary: {overall[:500]}\n"
        if themes:
            theme_list = [t.get("theme", t) if isinstance(t, dict) else t for t in themes[:5]]
            synthesis_summary += f"Themes: {', '.join(theme_list)}"

    prompt = GAP_ANALYSIS_PROMPT.format(
        query=query or "Literature review",
        paper_count=len(papers),
        temporal_info=temporal_info,
        keywords=keyword_text,
        methods_summary=methods_summary,
        synthesis_summary=synthesis_summary,
    )

    result = generate_text(
        task_name="gap_analysis",
        prompt=prompt,
        system_prompt="You are a research methodology expert specializing in identifying research gaps and future directions. Always respond with valid JSON.",
        model=config.model,
        temperature=config.temperature,
        max_tokens=config.max_tokens,
    )

    # Parse response
    response_text = result.text.strip()
    if response_text.startswith("```"):
        lines = response_text.split("\n")
        response_text = "\n".join(lines[1:-1])

    return json.loads(response_text)


def _generate_statistical_recommendations(
    papers: List[Dict[str, Any]],
    temporal: Dict[str, Any],
    methods: Dict[str, Any],
) -> List[str]:
    """Generate recommendations based on statistical analysis."""
    recommendations = []

    if len(papers) < 10:
        recommendations.append(
            "Expand literature search to include more sources and databases"
        )

    if temporal.get("recent_5_years", 0) < 3:
        recommendations.append(
            "Update search to include most recent publications"
        )

    detected_methods = set(methods.get("detected_methods", {}).keys())
    if "Systematic Review" not in detected_methods:
        recommendations.append(
            "Consider conducting a systematic review if none exists"
        )
    if "Meta-Analysis" not in detected_methods and len(papers) > 10:
        recommendations.append(
            "Consider meta-analysis if sufficient quantitative data exists"
        )

    if not recommendations:
        recommendations.append(
            "Continue monitoring the literature for new developments"
        )

    return recommendations


def _generate_markdown_report(result: Dict[str, Any]) -> str:
    """Generate Markdown report from gap analysis result."""
    lines = [
        "# Research Gap Analysis Report",
        "",
        f"**Query:** {result.get('query', 'N/A')}",
        f"**Papers Analyzed:** {result.get('paper_count', 0)}",
        f"**Generated:** {result.get('generated_at', '')}",
        f"**Analysis Method:** {result.get('method', 'unknown')}",
        f"**Confidence:** {result.get('confidence', 'unknown')}",
        "",
        "---",
        "",
        "## Temporal Coverage",
        "",
    ]

    temporal = result.get("temporal_coverage", {})
    if temporal.get("year_range"):
        lines.append(f"- **Year Range:** {temporal['year_range'][0]} - {temporal['year_range'][1]}")
    lines.append(f"- **Papers with Year Data:** {temporal.get('papers_with_year', 0)}")
    lines.append(f"- **Recent 5 Years:** {temporal.get('recent_5_years', 0)} papers")

    if temporal.get("gaps"):
        lines.append(f"- **Gap Years:** {', '.join(map(str, temporal['gaps'][:10]))}")

    lines.extend([
        "",
        "## Top Keywords",
        "",
    ])

    keywords = result.get("keyword_analysis", {}).get("top_keywords", [])
    for kw, score in keywords[:10]:
        lines.append(f"- {kw} ({score:.3f})")

    lines.extend([
        "",
        "## Identified Gaps",
        "",
    ])

    gaps = result.get("identified_gaps", [])
    if gaps:
        for gap in gaps:
            priority = gap.get("priority", "medium")
            gap_type = gap.get("type", "unknown")
            lines.append(f"### [{priority.upper()}] {gap_type.title()} Gap")
            lines.append(f"\n{gap.get('description', '')}")
            if gap.get("evidence"):
                lines.append(f"\n*Evidence: {gap.get('evidence')}*")
            lines.append("")
    else:
        lines.append("No significant gaps identified.")

    lines.extend([
        "",
        "## Recommendations",
        "",
    ])

    for rec in result.get("recommendations", []):
        lines.append(f"- {rec}")

    return "\n".join(lines)
