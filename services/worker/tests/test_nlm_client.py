"""
Unit tests for the nlm_client module.

Tests direct NCBI E-utilities API integration, caching, and error handling.
"""

import pytest
from unittest.mock import AsyncMock, patch, MagicMock
import sys

sys.path.insert(0, '../src')

from data_extraction.nlm_client import (
    NLMClient,
    NLMClientError,
    MeSHTermResult,
    NLMClientStats,
    get_nlm_client,
)


class TestMeSHTermResult:
    """Test MeSHTermResult data class."""
    
    def test_create_matched_result(self):
        """Should create a matched result with all fields."""
        result = MeSHTermResult(
            original_term="myocardial infarction",
            mesh_id="D009203",
            mesh_label="Myocardial Infarction",
            tree_numbers=["C14.280.647.500", "C23.550.513.355.750"],
            scope_note="NECROSIS of the MYOCARDIUM...",
            synonyms=["Heart Attack", "Cardiac Infarction"],
            confidence=0.98,
            matched=True,
            source="ncbi",
        )
        assert result.matched is True
        assert result.mesh_id == "D009203"
        assert len(result.tree_numbers) == 2
        assert "Heart Attack" in result.synonyms
    
    def test_create_unmatched_result(self):
        """Should create an unmatched result."""
        result = MeSHTermResult(
            original_term="unknown term xyz",
            matched=False,
        )
        assert result.matched is False
        assert result.mesh_id is None
        assert result.confidence == 0.0
    
    def test_to_dict(self):
        """Should serialize to dictionary."""
        result = MeSHTermResult(
            original_term="diabetes",
            mesh_id="D003920",
            mesh_label="Diabetes Mellitus",
            matched=True,
            confidence=0.95,
        )
        d = result.to_dict()
        assert d["original_term"] == "diabetes"
        assert d["mesh_id"] == "D003920"
        assert d["matched"] is True


class TestNLMClientStats:
    """Test NLMClientStats data class."""
    
    def test_initial_stats(self):
        """Should initialize with zero values."""
        stats = NLMClientStats()
        assert stats.requests_made == 0
        assert stats.cache_hits == 0
        assert stats.cache_misses == 0
        assert stats.errors == 0
    
    def test_cache_hit_rate_empty(self):
        """Cache hit rate should be 0 when no lookups."""
        stats = NLMClientStats()
        assert stats.cache_hit_rate == 0.0
    
    def test_cache_hit_rate(self):
        """Should calculate correct cache hit rate."""
        stats = NLMClientStats(cache_hits=7, cache_misses=3)
        assert stats.cache_hit_rate == 0.7
    
    def test_avg_latency(self):
        """Should calculate average latency."""
        stats = NLMClientStats(requests_made=10, total_latency_ms=1500.0)
        assert stats.avg_latency_ms == 150.0


class TestNLMClient:
    """Test NLMClient class."""
    
    def test_init_defaults(self):
        """Should initialize with defaults."""
        client = NLMClient()
        assert client.enable_cache is True
        assert client._cache_size == 1000
        assert client.tool_name == "researchflow"
    
    def test_init_custom(self):
        """Should accept custom configuration."""
        client = NLMClient(
            api_key="test_key",
            tool_name="test_tool",
            email="test@example.com",
            cache_size=500,
            enable_cache=False,
        )
        assert client.api_key == "test_key"
        assert client.tool_name == "test_tool"
        assert client.email == "test@example.com"
        assert client._cache_size == 500
        assert client.enable_cache is False
    
    def test_cache_key_generation(self):
        """Should generate consistent cache keys."""
        client = NLMClient()
        key1 = client._cache_key("Diabetes")
        key2 = client._cache_key("diabetes")
        key3 = client._cache_key("  diabetes  ")
        # All should be the same (case-insensitive, trimmed)
        assert key1 == key2 == key3
    
    def test_cache_key_different_terms(self):
        """Different terms should have different cache keys."""
        client = NLMClient()
        key1 = client._cache_key("diabetes")
        key2 = client._cache_key("hypertension")
        assert key1 != key2
    
    def test_get_from_cache_miss(self):
        """Should return None on cache miss."""
        client = NLMClient()
        result = client._get_from_cache("unknown term")
        assert result is None
        assert client.stats.cache_misses == 1
    
    def test_add_and_get_from_cache(self):
        """Should store and retrieve from cache."""
        client = NLMClient()
        test_result = MeSHTermResult(
            original_term="diabetes",
            mesh_id="D003920",
            matched=True,
            confidence=0.95,
        )
        client._add_to_cache("diabetes", test_result)
        
        # Retrieve
        cached = client._get_from_cache("diabetes")
        assert cached is not None
        assert cached.mesh_id == "D003920"
        assert cached.source == "cache"
        assert client.stats.cache_hits == 1
    
    def test_cache_disabled(self):
        """Should not cache when disabled."""
        client = NLMClient(enable_cache=False)
        test_result = MeSHTermResult(original_term="test", matched=False)
        client._add_to_cache("test", test_result)
        
        result = client._get_from_cache("test")
        assert result is None
    
    def test_cache_eviction(self):
        """Should evict oldest entry when at capacity."""
        client = NLMClient(cache_size=3)
        
        # Fill cache
        for i in range(3):
            client._add_to_cache(f"term{i}", MeSHTermResult(original_term=f"term{i}", matched=False))
        
        assert len(client._cache) == 3
        
        # Add one more (should evict term0)
        client._add_to_cache("term3", MeSHTermResult(original_term="term3", matched=False))
        
        assert len(client._cache) == 3
        assert client._get_from_cache("term0") is None  # Evicted
        assert client._get_from_cache("term3") is not None
    
    def test_confidence_calculation_exact_match(self):
        """Exact match should have high confidence."""
        client = NLMClient()
        conf = client._calculate_confidence("Diabetes Mellitus", "Diabetes Mellitus", [])
        assert conf == 0.98
    
    def test_confidence_calculation_case_insensitive(self):
        """Case differences should still be exact match."""
        client = NLMClient()
        conf = client._calculate_confidence("diabetes mellitus", "Diabetes Mellitus", [])
        assert conf == 0.98
    
    def test_confidence_calculation_synonym(self):
        """Synonym match should have high confidence."""
        client = NLMClient()
        conf = client._calculate_confidence(
            "heart attack",
            "Myocardial Infarction",
            ["Heart Attack", "Cardiac Infarction"],
        )
        assert conf == 0.95
    
    def test_confidence_calculation_partial(self):
        """Partial match should have moderate confidence."""
        client = NLMClient()
        # "myocardial" appears in "Myocardial Infarction" - substring match
        conf = client._calculate_confidence("myocardial", "Myocardial Infarction", [])
        assert conf == 0.85  # Substring match
    
    def test_confidence_calculation_no_match(self):
        """No match should have low confidence."""
        client = NLMClient()
        conf = client._calculate_confidence("completely different", "Diabetes Mellitus", [])
        assert conf == 0.5
    
    def test_get_stats(self):
        """Should return stats dictionary."""
        client = NLMClient()
        client.stats.requests_made = 10
        client.stats.cache_hits = 7
        client.stats.cache_misses = 3
        
        stats = client.get_stats()
        assert stats["requests_made"] == 10
        assert stats["cache_hits"] == 7
        assert stats["cache_hit_rate"] == "70.00%"
    
    def test_clear_cache(self):
        """Should clear the cache."""
        client = NLMClient()
        client._add_to_cache("term1", MeSHTermResult(original_term="term1", matched=False))
        client._add_to_cache("term2", MeSHTermResult(original_term="term2", matched=False))
        
        assert len(client._cache) == 2
        client.clear_cache()
        assert len(client._cache) == 0


class TestNLMClientAsync:
    """Async tests for NLMClient."""
    
    @pytest.mark.asyncio
    async def test_lookup_mesh_term_cached(self):
        """Should return cached result without API call."""
        client = NLMClient()
        
        # Pre-populate cache
        test_result = MeSHTermResult(
            original_term="diabetes",
            mesh_id="D003920",
            mesh_label="Diabetes Mellitus",
            matched=True,
            confidence=0.95,
        )
        client._add_to_cache("diabetes", test_result)
        
        # Lookup should use cache
        result = await client.lookup_mesh_term("diabetes")
        assert result.mesh_id == "D003920"
        assert result.source == "cache"
        assert client.stats.requests_made == 0  # No API call
    
    @pytest.mark.asyncio
    async def test_lookup_mesh_terms_empty(self):
        """Should handle empty list."""
        client = NLMClient()
        results = await client.lookup_mesh_terms([])
        assert results == []
    
    @pytest.mark.asyncio
    async def test_lookup_mesh_terms_with_cache(self):
        """Should use cache for duplicate terms."""
        client = NLMClient()
        
        # Pre-populate cache
        test_result = MeSHTermResult(
            original_term="diabetes",
            mesh_id="D003920",
            matched=True,
        )
        client._add_to_cache("diabetes", test_result)
        
        # Lookup duplicates - should dedupe and use cache
        results = await client.lookup_mesh_terms(["diabetes", "DIABETES", "Diabetes"])
        
        # All should return same result
        assert len(results) == 3
        for r in results:
            assert r.mesh_id == "D003920"


class TestGetNLMClient:
    """Test singleton accessor."""
    
    def test_get_nlm_client_singleton(self):
        """Should return same instance."""
        # Reset singleton for test
        import data_extraction.nlm_client as nlm_module
        nlm_module._default_client = None
        
        client1 = get_nlm_client()
        client2 = get_nlm_client()
        assert client1 is client2


class TestNLMClientError:
    """Test NLMClientError exception."""
    
    def test_error_with_status(self):
        """Should store status code."""
        error = NLMClientError("API error", status_code=429, retryable=True)
        assert error.status_code == 429
        assert error.retryable is True
    
    def test_error_without_status(self):
        """Should work without status code."""
        error = NLMClientError("Connection failed")
        assert error.status_code is None
        assert error.retryable is False


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
