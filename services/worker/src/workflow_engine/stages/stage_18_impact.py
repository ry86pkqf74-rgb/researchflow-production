"""
Stage 18: Impact Assessment

Handles research impact metrics tracking including:
- Citation metrics generation and analysis
- Altmetrics tracking (social media, news, policy mentions)
- Usage statistics (downloads, views, shares)
- Field comparison and benchmarking
- Trend analysis over time

This stage generates mock data in DEMO mode and would integrate
with external bibliometric services in production.
"""

import logging
import random
from datetime import datetime, timedelta
from typing import Any, Dict, List

from ..types import StageContext, StageResult
from ..registry import register_stage

logger = logging.getLogger("workflow_engine.stages.stage_18_impact")


def generate_mock_citation_metrics(
    publication_date: str,
    field: str,
) -> Dict[str, Any]:
    """Generate mock citation metrics for demonstration.

    Args:
        publication_date: ISO date string of publication
        field: Research field for context-appropriate metrics

    Returns:
        Dictionary containing citation metrics
    """
    # Calculate days since publication for realistic metrics
    try:
        pub_dt = datetime.fromisoformat(publication_date.replace("Z", "+00:00"))
        days_since_pub = (datetime.now(pub_dt.tzinfo) - pub_dt).days
    except (ValueError, TypeError):
        days_since_pub = 30  # Default

    # Scale citations by time (roughly 2-5 per month for active paper)
    base_citations = max(1, int(days_since_pub / 30 * random.uniform(2, 5)))

    return {
        "total_citations": base_citations,
        "self_citations": max(0, int(base_citations * 0.1)),
        "h_index_contribution": 1 if base_citations >= 5 else 0,
        "citation_velocity": round(base_citations / max(1, days_since_pub / 30), 2),
        "citing_journals": [
            {"name": "Journal of Medical Research", "count": max(1, base_citations // 3)},
            {"name": "Clinical Studies Quarterly", "count": max(1, base_citations // 4)},
            {"name": "Healthcare Analytics", "count": max(1, base_citations // 5)},
        ],
        "citation_contexts": {
            "background": int(base_citations * 0.4),
            "methods": int(base_citations * 0.3),
            "comparison": int(base_citations * 0.2),
            "extension": int(base_citations * 0.1),
        },
    }


def generate_mock_altmetrics(field: str) -> Dict[str, Any]:
    """Generate mock altmetrics data for demonstration.

    Args:
        field: Research field for context

    Returns:
        Dictionary containing altmetric scores and breakdowns
    """
    # Altmetric score typically ranges 0-1000+ for high-impact work
    base_score = random.randint(5, 150)

    return {
        "altmetric_score": base_score,
        "attention_score_percentile": min(99, random.randint(40, 95)),
        "sources": {
            "twitter_mentions": random.randint(10, 200),
            "facebook_shares": random.randint(5, 50),
            "news_outlets": random.randint(0, 5),
            "blog_posts": random.randint(0, 10),
            "policy_documents": random.randint(0, 2),
            "wikipedia_citations": random.randint(0, 1),
            "reddit_posts": random.randint(0, 5),
            "research_highlights": random.randint(0, 3),
        },
        "geographic_reach": {
            "countries_reached": random.randint(5, 30),
            "top_countries": ["United States", "United Kingdom", "Germany", "Canada", "Australia"],
        },
        "demographic_breakdown": {
            "researchers": random.randint(30, 60),
            "practitioners": random.randint(20, 40),
            "public": random.randint(10, 30),
        },
    }


def generate_mock_usage_statistics() -> Dict[str, Any]:
    """Generate mock usage statistics for demonstration.

    Returns:
        Dictionary containing usage metrics
    """
    total_views = random.randint(100, 5000)
    total_downloads = int(total_views * random.uniform(0.1, 0.3))

    return {
        "total_views": total_views,
        "total_downloads": total_downloads,
        "unique_visitors": int(total_views * 0.7),
        "avg_time_on_page_seconds": random.randint(60, 300),
        "bounce_rate_percent": round(random.uniform(20, 50), 1),
        "download_formats": {
            "pdf": int(total_downloads * 0.7),
            "html": int(total_downloads * 0.2),
            "epub": int(total_downloads * 0.1),
        },
        "access_sources": {
            "direct": int(total_views * 0.3),
            "search_engines": int(total_views * 0.4),
            "social_media": int(total_views * 0.15),
            "referral": int(total_views * 0.15),
        },
        "monthly_trend": [
            {"month": f"2025-{str(i).zfill(2)}", "views": random.randint(50, 500)}
            for i in range(1, 13)
        ],
    }


def generate_field_comparison(
    field: str,
    citation_count: int,
    altmetric_score: int,
) -> Dict[str, Any]:
    """Generate field comparison and benchmarking data.

    Args:
        field: Research field
        citation_count: Paper's citation count
        altmetric_score: Paper's altmetric score

    Returns:
        Dictionary containing field comparison metrics
    """
    # Field averages (mock data)
    field_avg_citations = random.randint(10, 30)
    field_avg_altmetric = random.randint(20, 80)

    return {
        "field": field,
        "field_avg_citations": field_avg_citations,
        "field_avg_altmetric": field_avg_altmetric,
        "citation_percentile": min(99, int((citation_count / max(1, field_avg_citations * 2)) * 100)),
        "altmetric_percentile": min(99, int((altmetric_score / max(1, field_avg_altmetric * 2)) * 100)),
        "relative_performance": {
            "citations_vs_field": round(citation_count / max(1, field_avg_citations), 2),
            "altmetric_vs_field": round(altmetric_score / max(1, field_avg_altmetric), 2),
        },
        "similar_papers_comparison": {
            "papers_analyzed": random.randint(50, 200),
            "rank_in_cohort": random.randint(1, 50),
            "above_median": citation_count > field_avg_citations,
        },
        "journal_impact_context": {
            "journal_impact_factor": round(random.uniform(2, 10), 2),
            "journal_quartile": random.choice(["Q1", "Q2", "Q3"]),
            "expected_citations_range": [field_avg_citations - 5, field_avg_citations + 10],
        },
    }


def generate_trend_analysis(months: int = 12) -> Dict[str, Any]:
    """Generate trend analysis data.

    Args:
        months: Number of months for trend analysis

    Returns:
        Dictionary containing trend data
    """
    base_date = datetime.utcnow() - timedelta(days=months * 30)

    monthly_data = []
    cumulative_citations = 0
    cumulative_downloads = 0

    for i in range(months):
        month_date = base_date + timedelta(days=i * 30)
        month_citations = random.randint(0, 5)
        month_downloads = random.randint(10, 100)
        cumulative_citations += month_citations
        cumulative_downloads += month_downloads

        monthly_data.append({
            "month": month_date.strftime("%Y-%m"),
            "citations": month_citations,
            "downloads": month_downloads,
            "views": month_downloads * random.randint(3, 5),
            "cumulative_citations": cumulative_citations,
            "cumulative_downloads": cumulative_downloads,
        })

    # Calculate trends
    recent_months = monthly_data[-3:] if len(monthly_data) >= 3 else monthly_data
    earlier_months = monthly_data[:3] if len(monthly_data) >= 6 else monthly_data

    recent_avg = sum(m["citations"] for m in recent_months) / len(recent_months)
    earlier_avg = sum(m["citations"] for m in earlier_months) / len(earlier_months)

    if earlier_avg > 0:
        trend_direction = "increasing" if recent_avg > earlier_avg else "decreasing"
        trend_percent = round(((recent_avg - earlier_avg) / earlier_avg) * 100, 1)
    else:
        trend_direction = "stable"
        trend_percent = 0

    return {
        "analysis_period_months": months,
        "monthly_data": monthly_data,
        "trend_summary": {
            "direction": trend_direction,
            "percent_change": trend_percent,
            "recent_momentum": "high" if recent_avg > 2 else "moderate" if recent_avg > 0 else "low",
        },
        "peak_month": max(monthly_data, key=lambda x: x["citations"])["month"],
        "projected_annual_citations": int(cumulative_citations * (12 / months)),
    }


@register_stage
class Stage18ImpactAssessment:
    """Impact Assessment Stage.

    This stage tracks and analyzes research impact metrics including:
    - Citation metrics from bibliometric databases
    - Altmetrics from social media, news, and policy sources
    - Usage statistics (views, downloads, shares)
    - Field comparison and benchmarking
    - Temporal trend analysis

    In DEMO mode, generates realistic mock data.
    In PRODUCTION mode, would integrate with external APIs (Crossref, Altmetric, etc.)
    """

    stage_id = 18
    stage_name = "Impact Assessment"

    async def execute(self, context: StageContext) -> StageResult:
        """Execute impact assessment analysis.

        Args:
            context: StageContext with job configuration

        Returns:
            StageResult with impact metrics, trends, and field comparison
        """
        started_at = datetime.utcnow().isoformat() + "Z"
        warnings: List[str] = []
        errors: List[str] = []
        artifacts: List[str] = []

        logger.info(f"Running Impact Assessment for job {context.job_id}")

        try:
            # Get metrics configuration
            metrics_config = context.config.get("metrics_config", {})
            field = metrics_config.get("field", "Medical Research")
            publication_date = metrics_config.get(
                "publication_date",
                (datetime.utcnow() - timedelta(days=90)).isoformat() + "Z"
            )
            include_altmetrics = metrics_config.get("include_altmetrics", True)
            include_usage = metrics_config.get("include_usage_stats", True)
            trend_months = metrics_config.get("trend_months", 12)

            # Check governance mode
            is_demo = context.governance_mode == "DEMO"

            if is_demo:
                logger.info("Running in DEMO mode - generating mock metrics data")
                warnings.append("DEMO mode: Metrics are simulated, not from real sources")

            # Generate citation metrics
            logger.info("Generating citation metrics")
            citation_metrics = generate_mock_citation_metrics(publication_date, field)

            # Generate altmetrics if requested
            altmetrics = None
            if include_altmetrics:
                logger.info("Generating altmetrics")
                altmetrics = generate_mock_altmetrics(field)

            # Generate usage statistics if requested
            usage_stats = None
            if include_usage:
                logger.info("Generating usage statistics")
                usage_stats = generate_mock_usage_statistics()

            # Generate field comparison
            logger.info("Generating field comparison")
            field_comparison = generate_field_comparison(
                field=field,
                citation_count=citation_metrics["total_citations"],
                altmetric_score=altmetrics["altmetric_score"] if altmetrics else 0,
            )

            # Generate trend analysis
            logger.info("Generating trend analysis")
            trends = generate_trend_analysis(months=trend_months)

            # Compile impact metrics output
            impact_metrics = {
                "citation_metrics": citation_metrics,
                "data_source": "mock" if is_demo else "external_apis",
                "generated_at": datetime.utcnow().isoformat() + "Z",
            }

            if altmetrics:
                impact_metrics["altmetrics"] = altmetrics

            if usage_stats:
                impact_metrics["usage_statistics"] = usage_stats

            # Build output
            output = {
                "impact_metrics": impact_metrics,
                "trends": trends,
                "field_comparison": field_comparison,
                "summary": {
                    "total_citations": citation_metrics["total_citations"],
                    "altmetric_score": altmetrics["altmetric_score"] if altmetrics else None,
                    "total_downloads": usage_stats["total_downloads"] if usage_stats else None,
                    "field_percentile": field_comparison["citation_percentile"],
                    "trend_direction": trends["trend_summary"]["direction"],
                },
                "recommendations": self._generate_recommendations(
                    citation_metrics, altmetrics, usage_stats, field_comparison
                ),
            }

            # Determine status
            status = "completed"

        except Exception as e:
            logger.error(f"Stage 18 execution failed: {e}", exc_info=True)
            errors.append(f"Impact assessment failed: {str(e)}")
            status = "failed"
            output = {"error": str(e)}

        # Calculate duration
        completed_at = datetime.utcnow().isoformat() + "Z"
        started_dt = datetime.fromisoformat(started_at.replace("Z", "+00:00"))
        completed_dt = datetime.fromisoformat(completed_at.replace("Z", "+00:00"))
        duration_ms = int((completed_dt - started_dt).total_seconds() * 1000)

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
                "metrics_config": metrics_config if 'metrics_config' in dir() else {},
                "data_source": "mock" if context.governance_mode == "DEMO" else "external",
            },
        )

    def _generate_recommendations(
        self,
        citation_metrics: Dict[str, Any],
        altmetrics: Dict[str, Any] | None,
        usage_stats: Dict[str, Any] | None,
        field_comparison: Dict[str, Any],
    ) -> List[str]:
        """Generate actionable recommendations based on metrics.

        Args:
            citation_metrics: Citation data
            altmetrics: Altmetric data (optional)
            usage_stats: Usage statistics (optional)
            field_comparison: Field comparison data

        Returns:
            List of recommendation strings
        """
        recommendations = []

        # Citation-based recommendations
        if citation_metrics["total_citations"] < field_comparison["field_avg_citations"]:
            recommendations.append(
                "Consider increasing visibility through conference presentations "
                "and social media engagement to boost citations."
            )

        if citation_metrics["self_citations"] > citation_metrics["total_citations"] * 0.2:
            recommendations.append(
                "Self-citation rate is above 20%. Consider diversifying "
                "citation sources for better credibility."
            )

        # Altmetric-based recommendations
        if altmetrics:
            if altmetrics["sources"]["twitter_mentions"] < 20:
                recommendations.append(
                    "Social media presence is low. Consider creating shareable "
                    "summaries and engaging with research communities online."
                )

            if altmetrics["sources"]["news_outlets"] == 0:
                recommendations.append(
                    "No press coverage detected. Consider issuing a press release "
                    "for newsworthy findings."
                )

        # Usage-based recommendations
        if usage_stats:
            if usage_stats["bounce_rate_percent"] > 40:
                recommendations.append(
                    "High bounce rate indicates readers may not be finding expected content. "
                    "Review abstract and keywords for accuracy."
                )

            download_view_ratio = usage_stats["total_downloads"] / max(1, usage_stats["total_views"])
            if download_view_ratio < 0.15:
                recommendations.append(
                    "Low download-to-view ratio. Consider improving the abstract "
                    "to better convey value proposition."
                )

        # Field comparison recommendations
        if field_comparison["citation_percentile"] < 50:
            recommendations.append(
                "Paper is performing below field median. Consider follow-up "
                "publications or commentary pieces to increase visibility."
            )

        if not recommendations:
            recommendations.append(
                "Research impact metrics are healthy. Continue monitoring and "
                "consider periodic updates to maintain engagement."
            )

        return recommendations
