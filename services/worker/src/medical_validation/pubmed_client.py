"""
PubMed Client via NCBI E-utilities

PubMed search and retrieval via NCBI E-utilities (ESearch + ESummary).

E-utilities share the base URL:
    https://eutils.ncbi.nlm.nih.gov/entrez/eutils/

Based on document_pdf.pdf specification (pages 9-11).

Environment Variables:
    NCBI_API_KEY: Optional API key (increases rate limit to 10 req/sec)
    PUBMED_TIMEOUT_S: Request timeout (default: 30)
    PUBMED_CACHE_TTL_S: Cache TTL in seconds (default: 86400 = 24h)

Rate Limiting:
    - Without API key: 3 requests/second
    - With API key: 10 requests/second
"""

from __future__ import annotations

import logging
import os
from typing import Any, Dict, List, Optional, TYPE_CHECKING

import requests

if TYPE_CHECKING:
    from ..cache.redis_cache import RedisCache

logger = logging.getLogger(__name__)


class PubMedError(Exception):
    """Raised when PubMed API request fails."""
    pass


class PubMedClient:
    """
    PubMed via NCBI E-utilities (ESearch + ESummary).

    Example:
        client = PubMedClient.from_env()
        pmids = client.esearch("laparoscopic cholecystectomy outcomes")
        summaries = client.esummary(pmids)
    """

    BASE = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils"

    def __init__(
        self,
        *,
        api_key: Optional[str] = None,
        cache: Optional["RedisCache"] = None,
        timeout_s: int = 30,
    ) -> None:
        """
        Initialize PubMed client.

        Args:
            api_key: NCBI API key (optional, increases rate limit)
            cache: Redis cache instance for caching results
            timeout_s: Request timeout in seconds
        """
        self.api_key = api_key
        self.cache = cache
        self.timeout_s = timeout_s
        self.session = requests.Session()

    @classmethod
    def from_env(cls, cache: Optional["RedisCache"] = None) -> "PubMedClient":
        """
        Create client from environment variables.

        Optional:
            NCBI_API_KEY: API key for higher rate limits
            PUBMED_TIMEOUT_S: Request timeout (default: 30)
        """
        return cls(
            api_key=os.getenv("NCBI_API_KEY"),
            cache=cache,
            timeout_s=int(os.getenv("PUBMED_TIMEOUT_S", "30")),
        )

    def esearch(
        self,
        term: str,
        *,
        retmax: int = 10,
        sort: str = "relevance",
    ) -> List[str]:
        """
        Search PubMed for articles matching term.

        Uses NCBI ESearch API to find PMIDs.

        Args:
            term: Search query (PubMed syntax supported)
            retmax: Maximum number of results (default: 10)
            sort: Sort order ("relevance" or "pub_date")

        Returns:
            List of PMID strings

        Raises:
            PubMedError: If search fails
        """
        cache_key = f"pubmed:esearch:{term}:{retmax}:{sort}"

        # Check cache
        if self.cache:
            hit = self.cache.get_json(cache_key)
            if hit is not None:
                logger.debug(f"PubMed esearch cache hit: {term}")
                return hit

        params: Dict[str, Any] = {
            "db": "pubmed",
            "term": term,
            "retmode": "json",
            "retmax": retmax,
            "sort": sort,
        }

        if self.api_key:
            params["api_key"] = self.api_key

        url = f"{self.BASE}/esearch.fcgi"

        try:
            resp = self.session.get(url, params=params, timeout=self.timeout_s)
            resp.raise_for_status()
        except requests.RequestException as e:
            raise PubMedError(f"ESearch failed: {e}") from e

        data = resp.json()
        result = data.get("esearchresult", {})

        # Check for errors
        if "error" in result:
            raise PubMedError(f"ESearch error: {result['error']}")

        ids = result.get("idlist", []) or []

        logger.info(f"PubMed esearch '{term}' returned {len(ids)} PMIDs")

        # Cache results
        if self.cache:
            ttl = int(os.getenv("PUBMED_CACHE_TTL_S", "86400"))
            self.cache.set_json(cache_key, ids, ttl_s=ttl)

        return ids

    def esummary(self, pmids: List[str]) -> Dict[str, Any]:
        """
        Get summaries for PubMed articles.

        Uses NCBI ESummary API to retrieve article metadata.

        Args:
            pmids: List of PMID strings

        Returns:
            Dictionary with article summaries keyed by PMID

        Raises:
            PubMedError: If summary retrieval fails
        """
        if not pmids:
            return {}

        joined = ",".join(pmids)
        cache_key = f"pubmed:esummary:{joined}"

        # Check cache
        if self.cache:
            hit = self.cache.get_json(cache_key)
            if hit is not None:
                logger.debug(f"PubMed esummary cache hit: {len(pmids)} PMIDs")
                return hit

        params: Dict[str, Any] = {
            "db": "pubmed",
            "id": joined,
            "retmode": "json",
        }

        if self.api_key:
            params["api_key"] = self.api_key

        url = f"{self.BASE}/esummary.fcgi"

        try:
            resp = self.session.get(url, params=params, timeout=self.timeout_s)
            resp.raise_for_status()
        except requests.RequestException as e:
            raise PubMedError(f"ESummary failed: {e}") from e

        data = resp.json()

        logger.info(f"PubMed esummary retrieved {len(pmids)} articles")

        # Cache results
        if self.cache:
            ttl = int(os.getenv("PUBMED_CACHE_TTL_S", "86400"))
            self.cache.set_json(cache_key, data, ttl_s=ttl)

        return data

    def search_with_summaries(
        self,
        term: str,
        *,
        retmax: int = 10,
    ) -> Dict[str, Any]:
        """
        Convenience method: search and retrieve summaries in one call.

        Args:
            term: Search query
            retmax: Maximum results

        Returns:
            ESummary result with article metadata
        """
        pmids = self.esearch(term, retmax=retmax)
        if not pmids:
            return {"result": {}}
        return self.esummary(pmids)

    def get_article_info(self, pmid: str) -> Optional[Dict[str, Any]]:
        """
        Get info for a single article by PMID.

        Args:
            pmid: PubMed ID

        Returns:
            Article summary dict or None if not found
        """
        result = self.esummary([pmid])
        articles = result.get("result", {})
        return articles.get(pmid)
