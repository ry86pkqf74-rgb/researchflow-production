"""
Stage 02: Literature Review

Handles automated literature search and review including:
- Multi-database search (PubMed, Scopus, etc.)
- Citation data extraction (DOI, title, authors, abstract, year, journal)
- AI-powered literature summary generation
- Relevance scoring and citation tracking

This is a mock/stub implementation that simulates the literature review process.
"""

import logging
import random
import uuid
from datetime import datetime
from typing import Any, Dict, List, Optional

from ..types import StageContext, StageResult
from ..registry import register_stage

logger = logging.getLogger("workflow_engine.stage_02_literature")

# Supported search databases
SUPPORTED_DATABASES = {"pubmed", "scopus", "cochrane", "embase", "web_of_science"}

# Mock journal names for simulated results
MOCK_JOURNALS = [
    "Nature Medicine",
    "The Lancet",
    "JAMA",
    "New England Journal of Medicine",
    "BMJ",
    "Annals of Internal Medicine",
    "PLOS Medicine",
    "BMC Medicine",
    "Journal of Clinical Investigation",
    "Cell",
]

# Mock author surnames for simulated results
MOCK_AUTHOR_SURNAMES = [
    "Smith", "Johnson", "Williams", "Brown", "Jones", "Garcia", "Miller",
    "Davis", "Rodriguez", "Martinez", "Chen", "Wang", "Kim", "Patel",
    "Anderson", "Taylor", "Thomas", "Moore", "Jackson", "Lee",
]


def generate_mock_doi() -> str:
    """Generate a mock DOI identifier.

    Returns:
        Mock DOI string in standard format
    """
    suffix = uuid.uuid4().hex[:8]
    return f"10.1000/mock.{suffix}"


def generate_mock_authors(count: int = 3) -> List[Dict[str, str]]:
    """Generate mock author data.

    Args:
        count: Number of authors to generate

    Returns:
        List of author dictionaries with name and affiliation
    """
    authors = []
    used_names = set()

    for i in range(count):
        surname = random.choice(MOCK_AUTHOR_SURNAMES)
        while surname in used_names and len(used_names) < len(MOCK_AUTHOR_SURNAMES):
            surname = random.choice(MOCK_AUTHOR_SURNAMES)
        used_names.add(surname)

        initial = chr(65 + (i % 26))  # A-Z
        authors.append({
            "name": f"{initial}. {surname}",
            "affiliation": f"University Medical Center {i + 1}",
        })

    return authors


def generate_mock_abstract(query: str) -> str:
    """Generate a mock abstract based on search query.

    Args:
        query: The search query used

    Returns:
        Mock abstract text
    """
    templates = [
        f"BACKGROUND: This study investigates {query} in clinical settings. "
        f"METHODS: A comprehensive analysis was conducted. "
        f"RESULTS: Significant findings were observed. "
        f"CONCLUSION: Further research is warranted.",

        f"OBJECTIVE: To evaluate the impact of {query} on patient outcomes. "
        f"DESIGN: Retrospective cohort study. "
        f"RESULTS: The analysis revealed important correlations. "
        f"CONCLUSIONS: These findings have clinical implications.",

        f"INTRODUCTION: Understanding {query} is crucial for medical practice. "
        f"METHODS: We analyzed data from multiple sources. "
        f"FINDINGS: Key patterns emerged from the analysis. "
        f"DISCUSSION: Results suggest areas for future investigation.",
    ]
    return random.choice(templates)


def generate_mock_citation(query: str, index: int) -> Dict[str, Any]:
    """Generate a single mock citation with full metadata.

    Args:
        query: The search query (used in abstract generation)
        index: Citation index for title variation

    Returns:
        Dictionary containing citation metadata
    """
    year = random.randint(2018, 2024)
    num_authors = random.randint(2, 6)

    return {
        "doi": generate_mock_doi(),
        "title": f"Study {index + 1}: Analysis of {query} in Clinical Practice",
        "authors": generate_mock_authors(num_authors),
        "abstract": generate_mock_abstract(query),
        "year": year,
        "journal": random.choice(MOCK_JOURNALS),
        "volume": str(random.randint(1, 50)),
        "issue": str(random.randint(1, 12)),
        "pages": f"{random.randint(1, 500)}-{random.randint(501, 1000)}",
        "citation_count": random.randint(0, 500),
        "relevance_score": round(random.uniform(0.5, 1.0), 3),
        "source_database": random.choice(list(SUPPORTED_DATABASES)),
    }


def generate_literature_summary(citations: List[Dict[str, Any]], query: str) -> str:
    """Generate an AI-powered summary of the literature.

    This is a mock implementation that simulates AI summarization.

    Args:
        citations: List of citation dictionaries
        query: Original search query

    Returns:
        Generated summary text
    """
    if not citations:
        return "No relevant literature was found for the given search query."

    num_citations = len(citations)
    years = [c["year"] for c in citations]
    min_year, max_year = min(years), max(years)

    avg_relevance = sum(c["relevance_score"] for c in citations) / num_citations
    high_relevance_count = sum(1 for c in citations if c["relevance_score"] > 0.8)

    summary = (
        f"Literature Review Summary for '{query}':\n\n"
        f"A systematic search identified {num_citations} relevant publications "
        f"spanning {min_year} to {max_year}. "
        f"The average relevance score was {avg_relevance:.2f}, with "
        f"{high_relevance_count} publications scoring above 0.8 for relevance.\n\n"
        f"Key themes identified include clinical outcomes, patient populations, "
        f"and methodological considerations. The literature suggests ongoing "
        f"research interest in this area with multiple high-impact publications "
        f"in recent years.\n\n"
        f"Further analysis of specific subgroups and intervention types is "
        f"recommended based on the research objectives."
    )

    return summary


def sanitize_error_message(error: Exception) -> str:
    """Sanitize error message to remove potential PHI.

    Args:
        error: The exception that occurred

    Returns:
        PHI-sanitized error message
    """
    # Remove any potential file paths, patient IDs, or other sensitive data
    error_str = str(error)

    # Generic sanitization - replace anything that looks like an ID or path
    sanitized = "Literature search operation failed"

    # Preserve error type for debugging
    error_type = type(error).__name__
    if error_type in ["ValueError", "KeyError", "TypeError", "ConnectionError"]:
        sanitized = f"{sanitized} ({error_type})"

    return sanitized


@register_stage
class LiteratureReviewStage:
    """Stage 02: Literature Review

    Performs automated literature search and generates AI-powered summaries.
    """

    stage_id = 2
    stage_name = "Literature Review"

    async def execute(self, context: StageContext) -> StageResult:
        """Execute literature review automation.

        Args:
            context: Stage execution context containing search parameters

        Returns:
            StageResult with citations, summary, and search metadata
        """
        started_at = datetime.utcnow().isoformat() + "Z"
        errors: List[str] = []
        warnings: List[str] = []
        output: Dict[str, Any] = {}

        try:
            # Extract search parameters from config
            search_query = context.config.get("search_query")
            databases = context.config.get("databases", ["pubmed"])

            # Validate search query
            if not search_query:
                completed_at = datetime.utcnow().isoformat() + "Z"
                return StageResult(
                    stage_id=self.stage_id,
                    stage_name=self.stage_name,
                    status="failed",
                    started_at=started_at,
                    completed_at=completed_at,
                    duration_ms=0,
                    errors=["No search_query provided in context.config"],
                )

            if not isinstance(search_query, str) or len(search_query.strip()) < 3:
                completed_at = datetime.utcnow().isoformat() + "Z"
                return StageResult(
                    stage_id=self.stage_id,
                    stage_name=self.stage_name,
                    status="failed",
                    started_at=started_at,
                    completed_at=completed_at,
                    duration_ms=0,
                    errors=["search_query must be a string with at least 3 characters"],
                )

            logger.info(f"Starting literature review for query: {search_query}")

            # Validate and filter databases
            if isinstance(databases, str):
                databases = [databases]

            valid_databases = []
            for db in databases:
                db_lower = db.lower()
                if db_lower in SUPPORTED_DATABASES:
                    valid_databases.append(db_lower)
                else:
                    warnings.append(f"Unsupported database '{db}' skipped")

            if not valid_databases:
                valid_databases = ["pubmed"]
                warnings.append("No valid databases specified, defaulting to pubmed")

            logger.info(f"Searching databases: {valid_databases}")

            # Generate mock search results
            num_results = random.randint(5, 15)
            citations = []

            for i in range(num_results):
                citation = generate_mock_citation(search_query, i)
                # Assign source database from valid list
                citation["source_database"] = valid_databases[i % len(valid_databases)]
                citations.append(citation)

            # Sort by relevance score (descending)
            citations.sort(key=lambda x: x["relevance_score"], reverse=True)

            logger.info(f"Found {len(citations)} citations")

            # Generate AI-powered summary
            summary = generate_literature_summary(citations, search_query)

            # Calculate aggregate statistics
            total_citation_count = sum(c["citation_count"] for c in citations)
            avg_relevance = sum(c["relevance_score"] for c in citations) / len(citations)
            years = [c["year"] for c in citations]

            # Build output
            output = {
                "citations": citations,
                "summary": summary,
                "search_metadata": {
                    "query": search_query,
                    "databases_searched": valid_databases,
                    "total_results": len(citations),
                    "search_timestamp": started_at,
                },
                "statistics": {
                    "total_citations_in_results": total_citation_count,
                    "average_relevance_score": round(avg_relevance, 3),
                    "year_range": {
                        "min": min(years),
                        "max": max(years),
                    },
                    "results_by_database": {
                        db: sum(1 for c in citations if c["source_database"] == db)
                        for db in valid_databases
                    },
                },
            }

            logger.info(f"Literature review completed with {len(citations)} results")

        except Exception as e:
            logger.error(f"Literature review failed: {type(e).__name__}")
            errors.append(sanitize_error_message(e))

        # Calculate timing
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
            errors=errors,
            warnings=warnings,
            metadata={
                "governance_mode": context.governance_mode,
                "job_id": context.job_id,
            },
        )
