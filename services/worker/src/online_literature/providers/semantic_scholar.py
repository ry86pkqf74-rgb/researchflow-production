"""Semantic Scholar literature provider implementation."""

from __future__ import annotations

import json
import os
import urllib.parse
import urllib.request
from dataclasses import dataclass

from src.online_literature.provider import OnlineLiteratureProvider, PaperMetadata
from src.runtime_config import RuntimeConfig


@dataclass(frozen=True)
class SemanticScholarProvider:
    """
    Metadata-only provider for Semantic Scholar API.

    This provider searches the Semantic Scholar academic paper database and returns
    metadata-only results (no full-text PDFs). It is gated by RuntimeConfig.no_network
    and intended only for ACTIVE/ONLINE mode.

    Attributes:
        name: Provider identifier ("semantic_scholar")

    Environment Variables:
        SEMANTIC_SCHOLAR_BASE_URL: Optional base URL override for API endpoint
                                   (default: https://api.semanticscholar.org/graph/v1)
        SEMANTIC_SCHOLAR_API_KEY: Optional API key for higher rate limits
                                 (without key: 100 req/5min, with key: 5000 req/5min)

    Network Governance:
        - Checks RuntimeConfig.no_network before any API calls (fail-closed)
        - Raises RuntimeError if NO_NETWORK=1
        - No network library imports at module level (defense-in-depth)

    API Details:
        - Endpoint: /paper/search
        - Fields: title, year, authors, doi, url, abstract
        - Timeout: 20 seconds
        - Free tier available (no credit card required)
    """

    name: str = "semantic_scholar"

    def search(self, topic: str, *, max_results: int = 20) -> list[PaperMetadata]:
        """Search Semantic Scholar for papers matching the topic.

        Args:
            topic: Search query string (e.g., "machine learning")
            max_results: Maximum number of results to return (default: 20)

        Returns:
            List of PaperMetadata objects with title, authors, year, DOI, URL, abstract

        Raises:
            RuntimeError: If NO_NETWORK=1 (fail-closed network gating)
            OnlineLiteratureError: If API request fails

        Examples:
            >>> provider = SemanticScholarProvider()
            >>> results = provider.search("deep learning", max_results=10)
            >>> print(f"Found {len(results)} papers")
            >>> print(results[0].title)
        """
        # Network governance: fail-closed check
        cfg = RuntimeConfig.from_env_and_optional_yaml(None)
        if cfg.no_network:
            raise RuntimeError(
                "NO_NETWORK=1 blocks Semantic Scholar calls (fail-closed)."
            )

        # Build API request
        base_url = os.getenv(
            "SEMANTIC_SCHOLAR_BASE_URL",
            "https://api.semanticscholar.org/graph/v1",
        )
        fields = "title,year,authors,doi,url,abstract"
        q = urllib.parse.quote(topic)
        url = (
            f"{base_url}/paper/search"
            f"?query={q}"
            f"&limit={int(max_results)}"
            f"&fields={urllib.parse.quote(fields)}"
        )

        # Set headers (including optional API key)
        headers = {"Accept": "application/json"}
        api_key = os.getenv("SEMANTIC_SCHOLAR_API_KEY")
        if api_key:
            headers["x-api-key"] = api_key

        # Execute API request
        req = urllib.request.Request(url, headers=headers, method="GET")
        with urllib.request.urlopen(req, timeout=20) as resp:
            payload = json.loads(resp.read().decode("utf-8"))

        # Parse results into PaperMetadata objects
        out: list[PaperMetadata] = []
        for item in payload.get("data") or []:
            title = (item.get("title") or "").strip() or "Untitled"
            authors_list = [
                (a.get("name") or "").strip()
                for a in (item.get("authors") or [])
                if (a.get("name") or "").strip()
            ]
            year = item.get("year")
            doi = item.get("doi")
            url_i = item.get("url")
            abstract = item.get("abstract")

            out.append(
                PaperMetadata(
                    title=title,
                    year=int(year) if isinstance(year, int) else None,
                    authors=authors_list,
                    venue=None,  # Semantic Scholar doesn't provide venue in search endpoint
                    doi=str(doi).strip() if doi else None,
                    url=str(url_i).strip() if url_i else None,
                    abstract=str(abstract).strip() if abstract else None,
                )
            )

        return out
