"""
NLM Client - Direct NCBI E-utilities API integration for MeSH term lookup.

This module provides direct access to NLM's NCBI E-utilities API for:
- MeSH term lookup and validation
- PubMed search integration
- Term normalization to standard medical terminology

Features:
- Local LRU caching to reduce API calls
- Retry logic with exponential backoff
- Rate limiting compliance (NCBI allows 3 req/sec without key, 10 with key)
- Fallback for when orchestrator is unavailable

NCBI E-utilities Documentation: https://www.ncbi.nlm.nih.gov/books/NBK25500/
"""

import asyncio
import hashlib
import logging
import os
import time
from dataclasses import dataclass, field
from datetime import datetime, timezone
from functools import lru_cache
from typing import Any, Dict, List, Optional, Tuple
from xml.etree import ElementTree

import httpx

logger = logging.getLogger(__name__)

# NCBI E-utilities base URL
EUTILS_BASE = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils"

# Configuration from environment
NCBI_API_KEY = os.getenv("NCBI_API_KEY", "")
NCBI_TOOL = os.getenv("NCBI_TOOL", "researchflow")
NCBI_EMAIL = os.getenv("NCBI_EMAIL", "")

# Rate limiting: 3 req/sec without key, 10 with key
RATE_LIMIT_DELAY = 0.1 if NCBI_API_KEY else 0.35

# Timeouts and retries
REQUEST_TIMEOUT = int(os.getenv("NLM_REQUEST_TIMEOUT", "30"))
MAX_RETRIES = int(os.getenv("NLM_MAX_RETRIES", "3"))
RETRY_BACKOFF = 1.5


@dataclass
class MeSHTermResult:
    """Result of a MeSH term lookup."""
    original_term: str
    mesh_id: Optional[str] = None
    mesh_label: Optional[str] = None
    tree_numbers: List[str] = field(default_factory=list)
    scope_note: Optional[str] = None
    synonyms: List[str] = field(default_factory=list)
    confidence: float = 0.0
    matched: bool = False
    source: str = "ncbi"  # 'ncbi' or 'cache'
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "original_term": self.original_term,
            "mesh_id": self.mesh_id,
            "mesh_label": self.mesh_label,
            "tree_numbers": self.tree_numbers,
            "scope_note": self.scope_note,
            "synonyms": self.synonyms,
            "confidence": self.confidence,
            "matched": self.matched,
            "source": self.source,
        }


@dataclass
class NLMClientStats:
    """Statistics for NLM client operations."""
    requests_made: int = 0
    cache_hits: int = 0
    cache_misses: int = 0
    errors: int = 0
    total_latency_ms: float = 0.0
    
    @property
    def cache_hit_rate(self) -> float:
        total = self.cache_hits + self.cache_misses
        return self.cache_hits / total if total > 0 else 0.0
    
    @property
    def avg_latency_ms(self) -> float:
        return self.total_latency_ms / self.requests_made if self.requests_made > 0 else 0.0


class NLMClientError(Exception):
    """Exception for NLM client errors."""
    def __init__(self, message: str, status_code: Optional[int] = None, retryable: bool = False):
        super().__init__(message)
        self.status_code = status_code
        self.retryable = retryable


class NLMClient:
    """
    Direct client for NCBI E-utilities API.
    
    Provides MeSH term lookup with caching, retry logic, and rate limiting.
    
    Usage:
        client = NLMClient()
        result = await client.lookup_mesh_term("myocardial infarction")
        print(result.mesh_id, result.mesh_label)
        
        # Batch lookup
        results = await client.lookup_mesh_terms(["diabetes", "hypertension"])
    """
    
    def __init__(
        self,
        api_key: Optional[str] = None,
        tool_name: Optional[str] = None,
        email: Optional[str] = None,
        cache_size: int = 1000,
        enable_cache: bool = True,
    ):
        """
        Initialize NLM client.
        
        Args:
            api_key: NCBI API key for higher rate limits
            tool_name: Tool name for NCBI tracking
            email: Contact email for NCBI
            cache_size: Maximum number of cached terms
            enable_cache: Enable/disable caching
        """
        self.api_key = api_key or NCBI_API_KEY
        self.tool_name = tool_name or NCBI_TOOL
        self.email = email or NCBI_EMAIL
        self.enable_cache = enable_cache
        
        # Initialize cache
        self._cache: Dict[str, MeSHTermResult] = {}
        self._cache_size = cache_size
        
        # Rate limiting
        self._last_request_time = 0.0
        self._rate_limit_delay = 0.1 if self.api_key else 0.35
        
        # Statistics
        self.stats = NLMClientStats()
        
        # HTTP client (lazy initialized)
        self._client: Optional[httpx.AsyncClient] = None
    
    async def _get_client(self) -> httpx.AsyncClient:
        """Get or create async HTTP client."""
        if self._client is None:
            self._client = httpx.AsyncClient(timeout=REQUEST_TIMEOUT)
        return self._client
    
    async def close(self):
        """Close the HTTP client."""
        if self._client:
            await self._client.aclose()
            self._client = None
    
    def _get_base_params(self) -> Dict[str, str]:
        """Get base parameters for NCBI API calls."""
        params = {"tool": self.tool_name}
        if self.api_key:
            params["api_key"] = self.api_key
        if self.email:
            params["email"] = self.email
        return params
    
    def _cache_key(self, term: str) -> str:
        """Generate cache key for a term."""
        normalized = term.lower().strip()
        return hashlib.md5(normalized.encode()).hexdigest()[:16]
    
    def _get_from_cache(self, term: str) -> Optional[MeSHTermResult]:
        """Get term from cache if available."""
        if not self.enable_cache:
            return None
        
        key = self._cache_key(term)
        if key in self._cache:
            self.stats.cache_hits += 1
            result = self._cache[key]
            # Return copy with updated source
            return MeSHTermResult(
                original_term=term,
                mesh_id=result.mesh_id,
                mesh_label=result.mesh_label,
                tree_numbers=result.tree_numbers.copy(),
                scope_note=result.scope_note,
                synonyms=result.synonyms.copy(),
                confidence=result.confidence,
                matched=result.matched,
                source="cache",
            )
        
        self.stats.cache_misses += 1
        return None
    
    def _add_to_cache(self, term: str, result: MeSHTermResult):
        """Add term result to cache."""
        if not self.enable_cache:
            return
        
        key = self._cache_key(term)
        
        # Simple LRU: remove oldest if at capacity
        if len(self._cache) >= self._cache_size:
            oldest_key = next(iter(self._cache))
            del self._cache[oldest_key]
        
        self._cache[key] = result
    
    async def _rate_limit(self):
        """Apply rate limiting between requests."""
        now = time.time()
        elapsed = now - self._last_request_time
        if elapsed < self._rate_limit_delay:
            await asyncio.sleep(self._rate_limit_delay - elapsed)
        self._last_request_time = time.time()
    
    async def _request_with_retry(
        self,
        method: str,
        url: str,
        params: Dict[str, Any],
        max_retries: int = MAX_RETRIES,
    ) -> httpx.Response:
        """Make HTTP request with retry logic."""
        client = await self._get_client()
        last_error = None
        
        for attempt in range(max_retries):
            try:
                await self._rate_limit()
                
                start_time = time.time()
                if method == "GET":
                    response = await client.get(url, params=params)
                else:
                    response = await client.post(url, data=params)
                
                latency = (time.time() - start_time) * 1000
                self.stats.total_latency_ms += latency
                self.stats.requests_made += 1
                
                response.raise_for_status()
                return response
                
            except httpx.HTTPStatusError as e:
                last_error = e
                status = e.response.status_code
                
                # Don't retry on client errors (except 429)
                if 400 <= status < 500 and status != 429:
                    self.stats.errors += 1
                    raise NLMClientError(
                        f"NCBI API error: {status}",
                        status_code=status,
                        retryable=False,
                    )
                
                # Retry on 429 (rate limit) and 5xx errors
                if attempt < max_retries - 1:
                    wait_time = RETRY_BACKOFF ** attempt
                    logger.warning(f"NCBI request failed ({status}), retrying in {wait_time}s")
                    await asyncio.sleep(wait_time)
                    
            except httpx.RequestError as e:
                last_error = e
                if attempt < max_retries - 1:
                    wait_time = RETRY_BACKOFF ** attempt
                    logger.warning(f"NCBI connection error, retrying in {wait_time}s: {e}")
                    await asyncio.sleep(wait_time)
        
        self.stats.errors += 1
        raise NLMClientError(
            f"NCBI request failed after {max_retries} attempts: {last_error}",
            retryable=True,
        )
    
    async def lookup_mesh_term(self, term: str) -> MeSHTermResult:
        """
        Look up a single term in the MeSH database.
        
        Args:
            term: Medical term to look up
        
        Returns:
            MeSHTermResult with match information
        """
        # Check cache first
        cached = self._get_from_cache(term)
        if cached:
            return cached
        
        try:
            # Step 1: Search MeSH database
            search_params = {
                **self._get_base_params(),
                "db": "mesh",
                "term": term,
                "retmode": "json",
                "retmax": 5,
            }
            
            search_response = await self._request_with_retry(
                "GET",
                f"{EUTILS_BASE}/esearch.fcgi",
                search_params,
            )
            search_data = search_response.json()
            
            id_list = search_data.get("esearchresult", {}).get("idlist", [])
            
            if not id_list:
                # No match found
                result = MeSHTermResult(
                    original_term=term,
                    matched=False,
                    confidence=0.0,
                )
                self._add_to_cache(term, result)
                return result
            
            # Step 2: Fetch term details
            fetch_params = {
                **self._get_base_params(),
                "db": "mesh",
                "id": id_list[0],
                "retmode": "xml",
            }
            
            fetch_response = await self._request_with_retry(
                "GET",
                f"{EUTILS_BASE}/efetch.fcgi",
                fetch_params,
            )
            
            # Parse XML response
            result = self._parse_mesh_xml(term, fetch_response.text, id_list[0])
            self._add_to_cache(term, result)
            return result
            
        except NLMClientError:
            raise
        except Exception as e:
            logger.error(f"Error looking up term '{term}': {e}")
            return MeSHTermResult(
                original_term=term,
                matched=False,
                confidence=0.0,
            )
    
    def _parse_mesh_xml(self, original_term: str, xml_text: str, mesh_uid: str) -> MeSHTermResult:
        """Parse MeSH XML response into MeSHTermResult."""
        try:
            root = ElementTree.fromstring(xml_text)
            
            # Find the DescriptorRecord
            descriptor = root.find(".//DescriptorRecord")
            if descriptor is None:
                return MeSHTermResult(original_term=original_term, matched=False)
            
            # Get DescriptorUI (MeSH ID)
            mesh_id_elem = descriptor.find("DescriptorUI")
            mesh_id = mesh_id_elem.text if mesh_id_elem is not None else f"D{mesh_uid}"
            
            # Get DescriptorName
            name_elem = descriptor.find(".//DescriptorName/String")
            mesh_label = name_elem.text if name_elem is not None else None
            
            # Get TreeNumberList
            tree_numbers = []
            for tree_num in descriptor.findall(".//TreeNumber"):
                if tree_num.text:
                    tree_numbers.append(tree_num.text)
            
            # Get ScopeNote
            scope_note_elem = descriptor.find(".//ScopeNote")
            scope_note = scope_note_elem.text if scope_note_elem is not None else None
            
            # Get synonyms from ConceptList
            synonyms = []
            for term_elem in descriptor.findall(".//Term/String"):
                if term_elem.text and term_elem.text != mesh_label:
                    synonyms.append(term_elem.text)
            
            # Calculate confidence based on match quality
            confidence = self._calculate_confidence(original_term, mesh_label, synonyms)
            
            return MeSHTermResult(
                original_term=original_term,
                mesh_id=mesh_id,
                mesh_label=mesh_label,
                tree_numbers=tree_numbers,
                scope_note=scope_note[:500] if scope_note else None,  # Truncate long notes
                synonyms=synonyms[:10],  # Limit synonyms
                confidence=confidence,
                matched=True,
                source="ncbi",
            )
            
        except ElementTree.ParseError as e:
            logger.error(f"Failed to parse MeSH XML: {e}")
            return MeSHTermResult(original_term=original_term, matched=False)
    
    def _calculate_confidence(
        self,
        original: str,
        mesh_label: Optional[str],
        synonyms: List[str],
    ) -> float:
        """Calculate confidence score for MeSH match."""
        if not mesh_label:
            return 0.0
        
        original_lower = original.lower().strip()
        mesh_lower = mesh_label.lower()
        
        # Exact match
        if original_lower == mesh_lower:
            return 0.98
        
        # Check synonyms
        for syn in synonyms:
            if original_lower == syn.lower():
                return 0.95
        
        # Partial match (substring)
        if original_lower in mesh_lower or mesh_lower in original_lower:
            return 0.85
        
        # Word overlap
        original_words = set(original_lower.split())
        mesh_words = set(mesh_lower.split())
        overlap = len(original_words & mesh_words)
        total = len(original_words | mesh_words)
        if total > 0:
            jaccard = overlap / total
            if jaccard > 0.5:
                return 0.7 + (jaccard - 0.5) * 0.3
        
        # Default low confidence for fuzzy matches
        return 0.5
    
    async def lookup_mesh_terms(
        self,
        terms: List[str],
        max_concurrent: int = 3,
    ) -> List[MeSHTermResult]:
        """
        Look up multiple terms in the MeSH database.
        
        Args:
            terms: List of medical terms to look up
            max_concurrent: Maximum concurrent requests
        
        Returns:
            List of MeSHTermResult in same order as input
        """
        if not terms:
            return []
        
        # Deduplicate while preserving order
        seen = set()
        unique_terms = []
        term_indices: Dict[str, List[int]] = {}
        
        for i, term in enumerate(terms):
            normalized = term.lower().strip()
            if normalized not in seen:
                seen.add(normalized)
                unique_terms.append(term)
            term_indices.setdefault(normalized, []).append(i)
        
        # Lookup unique terms with concurrency control
        semaphore = asyncio.Semaphore(max_concurrent)
        
        async def lookup_with_semaphore(t: str) -> Tuple[str, MeSHTermResult]:
            async with semaphore:
                result = await self.lookup_mesh_term(t)
                return t.lower().strip(), result
        
        tasks = [lookup_with_semaphore(t) for t in unique_terms]
        lookup_results = await asyncio.gather(*tasks, return_exceptions=True)
        
        # Build result map
        result_map: Dict[str, MeSHTermResult] = {}
        for item in lookup_results:
            if isinstance(item, Exception):
                logger.error(f"Batch lookup error: {item}")
                continue
            normalized, result = item
            result_map[normalized] = result
        
        # Reconstruct results in original order
        results = []
        for term in terms:
            normalized = term.lower().strip()
            if normalized in result_map:
                result = result_map[normalized]
                # Update original_term to match input
                results.append(MeSHTermResult(
                    original_term=term,
                    mesh_id=result.mesh_id,
                    mesh_label=result.mesh_label,
                    tree_numbers=result.tree_numbers.copy(),
                    scope_note=result.scope_note,
                    synonyms=result.synonyms.copy(),
                    confidence=result.confidence,
                    matched=result.matched,
                    source=result.source,
                ))
            else:
                results.append(MeSHTermResult(original_term=term, matched=False))
        
        return results
    
    async def search_pubmed(
        self,
        query: str,
        max_results: int = 10,
    ) -> List[str]:
        """
        Search PubMed for articles matching a query.
        
        Args:
            query: Search query
            max_results: Maximum number of PMIDs to return
        
        Returns:
            List of PubMed IDs (PMIDs)
        """
        params = {
            **self._get_base_params(),
            "db": "pubmed",
            "term": query,
            "retmode": "json",
            "retmax": max_results,
        }
        
        try:
            response = await self._request_with_retry(
                "GET",
                f"{EUTILS_BASE}/esearch.fcgi",
                params,
            )
            data = response.json()
            return data.get("esearchresult", {}).get("idlist", [])
        except Exception as e:
            logger.error(f"PubMed search failed: {e}")
            return []
    
    def get_stats(self) -> Dict[str, Any]:
        """Get client statistics."""
        return {
            "requests_made": self.stats.requests_made,
            "cache_hits": self.stats.cache_hits,
            "cache_misses": self.stats.cache_misses,
            "cache_hit_rate": f"{self.stats.cache_hit_rate:.2%}",
            "errors": self.stats.errors,
            "avg_latency_ms": f"{self.stats.avg_latency_ms:.1f}",
            "cache_size": len(self._cache),
        }
    
    def clear_cache(self):
        """Clear the term cache."""
        self._cache.clear()


# Module-level singleton for convenience
_default_client: Optional[NLMClient] = None


def get_nlm_client() -> NLMClient:
    """Get or create the default NLM client singleton."""
    global _default_client
    if _default_client is None:
        _default_client = NLMClient()
    return _default_client


async def lookup_mesh_term(term: str) -> MeSHTermResult:
    """Convenience function to look up a single term."""
    client = get_nlm_client()
    return await client.lookup_mesh_term(term)


async def lookup_mesh_terms(terms: List[str]) -> List[MeSHTermResult]:
    """Convenience function to look up multiple terms."""
    client = get_nlm_client()
    return await client.lookup_mesh_terms(terms)


# Exports
__all__ = [
    "NLMClient",
    "NLMClientError",
    "MeSHTermResult",
    "NLMClientStats",
    "get_nlm_client",
    "lookup_mesh_term",
    "lookup_mesh_terms",
]
