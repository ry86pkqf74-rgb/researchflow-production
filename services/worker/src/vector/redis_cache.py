"""
Redis Vector Cache Service

Provides caching layer for vector embeddings and search results:
- Cache embeddings to avoid re-computation
- Cache search results with TTL
- Support for batch operations
- Cache invalidation patterns
"""

import json
import hashlib
import numpy as np
from dataclasses import dataclass, field
from typing import List, Dict, Any, Optional, Tuple, Union
from datetime import datetime, timedelta
import asyncio
import os

try:
    import redis.asyncio as redis
except ImportError:
    import aioredis as redis


@dataclass
class CacheConfig:
    """Configuration for Redis vector cache"""
    host: str = "localhost"
    port: int = 6379
    db: int = 0
    password: Optional[str] = None

    # TTL settings (in seconds)
    embedding_ttl: int = 86400 * 7  # 7 days
    search_ttl: int = 3600  # 1 hour
    metadata_ttl: int = 86400  # 1 day

    # Key prefixes
    embedding_prefix: str = "vec:emb:"
    search_prefix: str = "vec:search:"
    metadata_prefix: str = "vec:meta:"

    # Batch settings
    batch_size: int = 100
    max_connections: int = 10


@dataclass
class CachedEmbedding:
    """Cached embedding with metadata"""
    id: str
    vector: List[float]
    metadata: Dict[str, Any] = field(default_factory=dict)
    created_at: str = field(default_factory=lambda: datetime.utcnow().isoformat())
    hits: int = 0


@dataclass
class CachedSearchResult:
    """Cached search result"""
    query_hash: str
    results: List[Dict[str, Any]]
    created_at: str
    expires_at: str
    hit_count: int = 0


class RedisVectorCache:
    """Redis-based caching layer for vector operations"""

    def __init__(self, config: Optional[CacheConfig] = None):
        """
        Initialize Redis vector cache.

        Args:
            config: Cache configuration
        """
        self.config = config or CacheConfig(
            host=os.getenv("REDIS_HOST", "localhost"),
            port=int(os.getenv("REDIS_PORT", "6379")),
            password=os.getenv("REDIS_PASSWORD")
        )
        self._pool: Optional[redis.ConnectionPool] = None
        self._client: Optional[redis.Redis] = None
        self._stats = {
            "embedding_hits": 0,
            "embedding_misses": 0,
            "search_hits": 0,
            "search_misses": 0,
        }

    async def connect(self) -> None:
        """Establish Redis connection"""
        self._pool = redis.ConnectionPool(
            host=self.config.host,
            port=self.config.port,
            db=self.config.db,
            password=self.config.password,
            max_connections=self.config.max_connections,
            decode_responses=False  # We need binary for vectors
        )
        self._client = redis.Redis(connection_pool=self._pool)

        # Test connection
        await self._client.ping()

    async def disconnect(self) -> None:
        """Close Redis connection"""
        if self._client:
            await self._client.close()
        if self._pool:
            await self._pool.disconnect()

    async def __aenter__(self):
        await self.connect()
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        await self.disconnect()

    # ==================== Embedding Cache ====================

    def _embedding_key(self, content_hash: str) -> str:
        """Generate cache key for embedding"""
        return f"{self.config.embedding_prefix}{content_hash}"

    def _hash_content(self, content: str) -> str:
        """Create deterministic hash of content"""
        return hashlib.sha256(content.encode()).hexdigest()[:32]

    async def get_embedding(
        self,
        content: str
    ) -> Optional[CachedEmbedding]:
        """
        Get cached embedding for content.

        Args:
            content: Text content to look up

        Returns:
            Cached embedding or None if not found
        """
        content_hash = self._hash_content(content)
        key = self._embedding_key(content_hash)

        data = await self._client.get(key)

        if data:
            self._stats["embedding_hits"] += 1
            # Increment hit counter
            await self._client.hincrby(f"{key}:meta", "hits", 1)

            cached = json.loads(data)
            return CachedEmbedding(
                id=cached["id"],
                vector=cached["vector"],
                metadata=cached.get("metadata", {}),
                created_at=cached.get("created_at", ""),
                hits=cached.get("hits", 0) + 1
            )

        self._stats["embedding_misses"] += 1
        return None

    async def set_embedding(
        self,
        content: str,
        vector: List[float],
        metadata: Optional[Dict[str, Any]] = None,
        ttl: Optional[int] = None
    ) -> str:
        """
        Cache an embedding.

        Args:
            content: Original text content
            vector: Embedding vector
            metadata: Optional metadata
            ttl: Time to live in seconds (uses config default if not specified)

        Returns:
            Content hash used as identifier
        """
        content_hash = self._hash_content(content)
        key = self._embedding_key(content_hash)

        cached = CachedEmbedding(
            id=content_hash,
            vector=vector,
            metadata=metadata or {},
            created_at=datetime.utcnow().isoformat()
        )

        # Store as JSON
        data = json.dumps({
            "id": cached.id,
            "vector": cached.vector,
            "metadata": cached.metadata,
            "created_at": cached.created_at,
            "hits": 0
        })

        await self._client.setex(
            key,
            ttl or self.config.embedding_ttl,
            data
        )

        return content_hash

    async def get_embeddings_batch(
        self,
        contents: List[str]
    ) -> Tuple[Dict[str, CachedEmbedding], List[str]]:
        """
        Get multiple cached embeddings at once.

        Args:
            contents: List of text contents

        Returns:
            Tuple of (found embeddings dict, list of missing content hashes)
        """
        hashes = [self._hash_content(c) for c in contents]
        keys = [self._embedding_key(h) for h in hashes]

        # Batch fetch
        results = await self._client.mget(keys)

        found = {}
        missing = []

        for i, (content_hash, result) in enumerate(zip(hashes, results)):
            if result:
                self._stats["embedding_hits"] += 1
                cached = json.loads(result)
                found[content_hash] = CachedEmbedding(
                    id=cached["id"],
                    vector=cached["vector"],
                    metadata=cached.get("metadata", {}),
                    created_at=cached.get("created_at", "")
                )
            else:
                self._stats["embedding_misses"] += 1
                missing.append(contents[i])

        return found, missing

    async def set_embeddings_batch(
        self,
        embeddings: List[Tuple[str, List[float], Optional[Dict[str, Any]]]]
    ) -> List[str]:
        """
        Cache multiple embeddings at once.

        Args:
            embeddings: List of (content, vector, metadata) tuples

        Returns:
            List of content hashes
        """
        pipe = self._client.pipeline()
        hashes = []

        for content, vector, metadata in embeddings:
            content_hash = self._hash_content(content)
            key = self._embedding_key(content_hash)

            data = json.dumps({
                "id": content_hash,
                "vector": vector,
                "metadata": metadata or {},
                "created_at": datetime.utcnow().isoformat(),
                "hits": 0
            })

            pipe.setex(key, self.config.embedding_ttl, data)
            hashes.append(content_hash)

        await pipe.execute()
        return hashes

    # ==================== Search Cache ====================

    def _search_key(self, query_hash: str) -> str:
        """Generate cache key for search result"""
        return f"{self.config.search_prefix}{query_hash}"

    def _hash_search_query(
        self,
        query: str,
        filters: Optional[Dict[str, Any]] = None,
        limit: int = 10
    ) -> str:
        """Create deterministic hash of search query"""
        query_str = json.dumps({
            "query": query,
            "filters": filters or {},
            "limit": limit
        }, sort_keys=True)
        return hashlib.sha256(query_str.encode()).hexdigest()[:32]

    async def get_search_results(
        self,
        query: str,
        filters: Optional[Dict[str, Any]] = None,
        limit: int = 10
    ) -> Optional[CachedSearchResult]:
        """
        Get cached search results.

        Args:
            query: Search query text
            filters: Optional filters applied
            limit: Result limit

        Returns:
            Cached search result or None
        """
        query_hash = self._hash_search_query(query, filters, limit)
        key = self._search_key(query_hash)

        data = await self._client.get(key)

        if data:
            self._stats["search_hits"] += 1
            cached = json.loads(data)
            # Increment hit counter
            await self._client.hincrby(f"{key}:meta", "hits", 1)

            return CachedSearchResult(
                query_hash=query_hash,
                results=cached["results"],
                created_at=cached["created_at"],
                expires_at=cached["expires_at"],
                hit_count=cached.get("hit_count", 0) + 1
            )

        self._stats["search_misses"] += 1
        return None

    async def set_search_results(
        self,
        query: str,
        results: List[Dict[str, Any]],
        filters: Optional[Dict[str, Any]] = None,
        limit: int = 10,
        ttl: Optional[int] = None
    ) -> str:
        """
        Cache search results.

        Args:
            query: Search query text
            results: Search results to cache
            filters: Optional filters applied
            limit: Result limit
            ttl: Time to live in seconds

        Returns:
            Query hash
        """
        query_hash = self._hash_search_query(query, filters, limit)
        key = self._search_key(query_hash)

        now = datetime.utcnow()
        ttl_seconds = ttl or self.config.search_ttl
        expires_at = now + timedelta(seconds=ttl_seconds)

        data = json.dumps({
            "query_hash": query_hash,
            "results": results,
            "created_at": now.isoformat(),
            "expires_at": expires_at.isoformat(),
            "hit_count": 0
        })

        await self._client.setex(key, ttl_seconds, data)
        return query_hash

    # ==================== Cache Management ====================

    async def invalidate_embedding(self, content: str) -> bool:
        """Invalidate cached embedding for content"""
        content_hash = self._hash_content(content)
        key = self._embedding_key(content_hash)
        result = await self._client.delete(key)
        return result > 0

    async def invalidate_embeddings_pattern(self, pattern: str) -> int:
        """
        Invalidate embeddings matching a pattern.

        Args:
            pattern: Glob pattern for keys

        Returns:
            Number of keys deleted
        """
        full_pattern = f"{self.config.embedding_prefix}{pattern}"
        keys = []

        async for key in self._client.scan_iter(match=full_pattern):
            keys.append(key)

        if keys:
            return await self._client.delete(*keys)
        return 0

    async def invalidate_search_results(
        self,
        query: str,
        filters: Optional[Dict[str, Any]] = None,
        limit: int = 10
    ) -> bool:
        """Invalidate cached search results"""
        query_hash = self._hash_search_query(query, filters, limit)
        key = self._search_key(query_hash)
        result = await self._client.delete(key)
        return result > 0

    async def clear_all_search_cache(self) -> int:
        """Clear all cached search results"""
        pattern = f"{self.config.search_prefix}*"
        keys = []

        async for key in self._client.scan_iter(match=pattern):
            keys.append(key)

        if keys:
            return await self._client.delete(*keys)
        return 0

    async def get_cache_stats(self) -> Dict[str, Any]:
        """Get cache statistics"""
        # Count keys
        embedding_count = 0
        search_count = 0

        async for _ in self._client.scan_iter(match=f"{self.config.embedding_prefix}*"):
            embedding_count += 1

        async for _ in self._client.scan_iter(match=f"{self.config.search_prefix}*"):
            search_count += 1

        # Calculate hit rates
        total_embedding_requests = self._stats["embedding_hits"] + self._stats["embedding_misses"]
        total_search_requests = self._stats["search_hits"] + self._stats["search_misses"]

        embedding_hit_rate = (
            self._stats["embedding_hits"] / total_embedding_requests
            if total_embedding_requests > 0 else 0
        )
        search_hit_rate = (
            self._stats["search_hits"] / total_search_requests
            if total_search_requests > 0 else 0
        )

        return {
            "embedding_count": embedding_count,
            "search_count": search_count,
            "embedding_hits": self._stats["embedding_hits"],
            "embedding_misses": self._stats["embedding_misses"],
            "embedding_hit_rate": embedding_hit_rate,
            "search_hits": self._stats["search_hits"],
            "search_misses": self._stats["search_misses"],
            "search_hit_rate": search_hit_rate,
            "memory_info": await self._client.info("memory")
        }

    async def warm_cache(
        self,
        embeddings: List[Tuple[str, List[float], Optional[Dict[str, Any]]]]
    ) -> int:
        """
        Pre-populate cache with embeddings.

        Args:
            embeddings: List of (content, vector, metadata) tuples

        Returns:
            Number of embeddings cached
        """
        count = 0
        for i in range(0, len(embeddings), self.config.batch_size):
            batch = embeddings[i:i + self.config.batch_size]
            await self.set_embeddings_batch(batch)
            count += len(batch)
        return count


class CachedVectorStore:
    """
    Wrapper that adds caching to any vector store.

    Usage:
        weaviate_client = WeaviateClient()
        cache = RedisVectorCache()
        cached_store = CachedVectorStore(weaviate_client, cache)

        # Uses cache automatically
        results = await cached_store.search("query text")
    """

    def __init__(
        self,
        store: Any,  # Any vector store with search/index methods
        cache: RedisVectorCache,
        embedding_fn: Optional[Any] = None
    ):
        """
        Initialize cached vector store.

        Args:
            store: Underlying vector store
            cache: Redis cache instance
            embedding_fn: Optional function to generate embeddings
        """
        self.store = store
        self.cache = cache
        self.embedding_fn = embedding_fn

    async def index(
        self,
        content: str,
        metadata: Optional[Dict[str, Any]] = None,
        use_cache: bool = True
    ) -> str:
        """
        Index content with caching.

        Args:
            content: Text content to index
            metadata: Optional metadata
            use_cache: Whether to cache the embedding

        Returns:
            Document ID
        """
        # Check cache first
        if use_cache:
            cached = await self.cache.get_embedding(content)
            if cached:
                # Use cached embedding for indexing
                return await self.store.index_with_vector(
                    content=content,
                    vector=cached.vector,
                    metadata=metadata
                )

        # Generate embedding and index
        doc_id = await self.store.index(content, metadata)

        # Cache the embedding if we have access to it
        if use_cache and self.embedding_fn:
            vector = await self.embedding_fn(content)
            await self.cache.set_embedding(content, vector, metadata)

        return doc_id

    async def search(
        self,
        query: str,
        limit: int = 10,
        filters: Optional[Dict[str, Any]] = None,
        use_cache: bool = True
    ) -> List[Dict[str, Any]]:
        """
        Search with caching.

        Args:
            query: Search query
            limit: Max results
            filters: Optional filters
            use_cache: Whether to use cache

        Returns:
            Search results
        """
        # Check cache first
        if use_cache:
            cached = await self.cache.get_search_results(query, filters, limit)
            if cached:
                return cached.results

        # Perform actual search
        results = await self.store.search(query, limit, filters)

        # Cache results
        if use_cache:
            await self.cache.set_search_results(query, results, filters, limit)

        return results


# Factory function
def create_redis_cache(
    host: Optional[str] = None,
    port: Optional[int] = None,
    password: Optional[str] = None
) -> RedisVectorCache:
    """Create a Redis vector cache instance"""
    config = CacheConfig(
        host=host or os.getenv("REDIS_HOST", "localhost"),
        port=port or int(os.getenv("REDIS_PORT", "6379")),
        password=password or os.getenv("REDIS_PASSWORD")
    )
    return RedisVectorCache(config)


# Example usage
if __name__ == "__main__":
    async def main():
        cache = create_redis_cache()

        async with cache:
            # Cache an embedding
            content = "This is sample text for embedding"
            vector = [0.1] * 384  # Example vector

            content_hash = await cache.set_embedding(content, vector, {"source": "test"})
            print(f"Cached embedding: {content_hash}")

            # Retrieve embedding
            cached = await cache.get_embedding(content)
            if cached:
                print(f"Cache hit! Vector dim: {len(cached.vector)}")

            # Cache search results
            query = "sample query"
            results = [{"id": "1", "score": 0.9}, {"id": "2", "score": 0.8}]

            await cache.set_search_results(query, results)

            cached_search = await cache.get_search_results(query)
            if cached_search:
                print(f"Search cache hit! {len(cached_search.results)} results")

            # Get stats
            stats = await cache.get_cache_stats()
            print(f"Cache stats: {json.dumps(stats, indent=2, default=str)}")

    asyncio.run(main())
