"""
ML-based Deduplication Service - Task 160

Uses embedding similarity to detect duplicate or near-duplicate records.
Supports configurable similarity thresholds.
"""

import hashlib
import logging
from dataclasses import dataclass
from typing import Any, Dict, List, Optional, Set, Tuple

import numpy as np

logger = logging.getLogger(__name__)


@dataclass
class DedupResult:
    """Result of deduplication check"""
    is_duplicate: bool
    duplicate_of: Optional[str] = None  # ID of original record
    similarity_score: float = 0.0
    method: str = "unknown"
    fingerprint: Optional[str] = None


@dataclass
class DedupConfig:
    """Configuration for deduplication"""
    similarity_threshold: float = 0.85
    exact_match_fields: List[str] = None
    fuzzy_match_fields: List[str] = None
    embedding_model: str = "sentence-transformers/all-MiniLM-L6-v2"
    use_locality_sensitive_hashing: bool = True
    lsh_num_bands: int = 20
    lsh_rows_per_band: int = 5
    max_candidates: int = 100

    def __post_init__(self):
        if self.exact_match_fields is None:
            self.exact_match_fields = ["doi", "pmid", "title"]
        if self.fuzzy_match_fields is None:
            self.fuzzy_match_fields = ["abstract", "authors", "title"]


class MLDeduplicator:
    """ML-based deduplication using embeddings and LSH"""

    def __init__(self, config: Optional[DedupConfig] = None):
        self.config = config or DedupConfig()
        self._embedding_model = None
        self._fingerprints: Dict[str, str] = {}
        self._embeddings: Dict[str, np.ndarray] = {}
        self._lsh_buckets: Dict[str, Set[str]] = {}

    def _get_embedding_model(self):
        """Lazy load embedding model"""
        if self._embedding_model is None:
            try:
                from sentence_transformers import SentenceTransformer
                self._embedding_model = SentenceTransformer(
                    self.config.embedding_model
                )
                logger.info(f"Loaded embedding model: {self.config.embedding_model}")
            except ImportError:
                logger.warning(
                    "sentence-transformers not installed, falling back to hash-based dedup"
                )
                self._embedding_model = False
        return self._embedding_model

    def _compute_fingerprint(self, record: Dict[str, Any]) -> str:
        """Compute a content fingerprint for exact matching"""
        parts = []
        for field in self.config.exact_match_fields:
            value = record.get(field, "")
            if value:
                # Normalize: lowercase, strip whitespace
                normalized = str(value).lower().strip()
                parts.append(f"{field}:{normalized}")

        content = "|".join(sorted(parts))
        return hashlib.sha256(content.encode()).hexdigest()[:32]

    def _compute_embedding(self, record: Dict[str, Any]) -> Optional[np.ndarray]:
        """Compute embedding for fuzzy matching"""
        model = self._get_embedding_model()
        if not model:
            return None

        # Combine fuzzy match fields into text
        parts = []
        for field in self.config.fuzzy_match_fields:
            value = record.get(field, "")
            if value:
                if isinstance(value, list):
                    value = " ".join(str(v) for v in value)
                parts.append(str(value))

        text = " ".join(parts).strip()
        if not text:
            return None

        embedding = model.encode(text, convert_to_numpy=True)
        return embedding / np.linalg.norm(embedding)  # Normalize

    def _compute_lsh_signature(self, embedding: np.ndarray) -> List[str]:
        """Compute LSH signature for approximate nearest neighbor"""
        # MinHash-style LSH using random projections
        np.random.seed(42)  # Deterministic for reproducibility
        num_hashes = self.config.lsh_num_bands * self.config.lsh_rows_per_band

        # Random hyperplanes
        hyperplanes = np.random.randn(num_hashes, len(embedding))
        projections = (hyperplanes @ embedding) > 0

        # Group into bands
        signatures = []
        for band in range(self.config.lsh_num_bands):
            start = band * self.config.lsh_rows_per_band
            end = start + self.config.lsh_rows_per_band
            band_bits = projections[start:end]
            band_hash = hashlib.md5(band_bits.tobytes()).hexdigest()[:8]
            signatures.append(f"b{band}:{band_hash}")

        return signatures

    def _cosine_similarity(self, a: np.ndarray, b: np.ndarray) -> float:
        """Compute cosine similarity between two vectors"""
        return float(np.dot(a, b))

    def index_record(self, record_id: str, record: Dict[str, Any]) -> None:
        """Index a record for deduplication checks"""
        # Compute and store fingerprint
        fingerprint = self._compute_fingerprint(record)
        self._fingerprints[record_id] = fingerprint

        # Compute and store embedding
        embedding = self._compute_embedding(record)
        if embedding is not None:
            self._embeddings[record_id] = embedding

            # Add to LSH buckets
            if self.config.use_locality_sensitive_hashing:
                signatures = self._compute_lsh_signature(embedding)
                for sig in signatures:
                    if sig not in self._lsh_buckets:
                        self._lsh_buckets[sig] = set()
                    self._lsh_buckets[sig].add(record_id)

    def check_duplicate(
        self, record_id: str, record: Dict[str, Any]
    ) -> DedupResult:
        """Check if a record is a duplicate of any indexed record"""
        # Step 1: Exact fingerprint match
        fingerprint = self._compute_fingerprint(record)

        for existing_id, existing_fp in self._fingerprints.items():
            if existing_id == record_id:
                continue
            if existing_fp == fingerprint:
                return DedupResult(
                    is_duplicate=True,
                    duplicate_of=existing_id,
                    similarity_score=1.0,
                    method="exact_fingerprint",
                    fingerprint=fingerprint,
                )

        # Step 2: Embedding-based similarity
        embedding = self._compute_embedding(record)
        if embedding is None:
            return DedupResult(
                is_duplicate=False,
                method="no_embedding",
                fingerprint=fingerprint,
            )

        # Get candidates using LSH
        candidates: Set[str] = set()
        if self.config.use_locality_sensitive_hashing:
            signatures = self._compute_lsh_signature(embedding)
            for sig in signatures:
                if sig in self._lsh_buckets:
                    candidates.update(self._lsh_buckets[sig])
            candidates.discard(record_id)
            candidates = set(list(candidates)[:self.config.max_candidates])
        else:
            candidates = set(self._embeddings.keys())
            candidates.discard(record_id)

        # Compute similarities
        best_match_id = None
        best_similarity = 0.0

        for candidate_id in candidates:
            if candidate_id not in self._embeddings:
                continue
            similarity = self._cosine_similarity(
                embedding, self._embeddings[candidate_id]
            )
            if similarity > best_similarity:
                best_similarity = similarity
                best_match_id = candidate_id

        if best_similarity >= self.config.similarity_threshold:
            return DedupResult(
                is_duplicate=True,
                duplicate_of=best_match_id,
                similarity_score=best_similarity,
                method="embedding_similarity",
                fingerprint=fingerprint,
            )

        return DedupResult(
            is_duplicate=False,
            similarity_score=best_similarity,
            method="embedding_similarity",
            fingerprint=fingerprint,
        )

    def find_duplicates_batch(
        self, records: List[Dict[str, Any]], id_field: str = "id"
    ) -> List[Tuple[str, str, float]]:
        """Find all duplicate pairs in a batch of records"""
        duplicates = []

        # Index all records
        for record in records:
            record_id = record.get(id_field, "")
            if record_id:
                self.index_record(record_id, record)

        # Check each against others
        checked = set()
        for record in records:
            record_id = record.get(id_field, "")
            if not record_id or record_id in checked:
                continue

            result = self.check_duplicate(record_id, record)
            if result.is_duplicate and result.duplicate_of:
                duplicates.append(
                    (record_id, result.duplicate_of, result.similarity_score)
                )

            checked.add(record_id)

        return duplicates

    def get_dedup_stats(self) -> Dict[str, Any]:
        """Get deduplication statistics"""
        return {
            "indexed_records": len(self._fingerprints),
            "embeddings_computed": len(self._embeddings),
            "lsh_buckets": len(self._lsh_buckets),
            "config": {
                "similarity_threshold": self.config.similarity_threshold,
                "embedding_model": self.config.embedding_model,
                "use_lsh": self.config.use_locality_sensitive_hashing,
            },
        }

    def clear(self) -> None:
        """Clear all indexed data"""
        self._fingerprints.clear()
        self._embeddings.clear()
        self._lsh_buckets.clear()


# Global deduplicator instance
_deduplicator: Optional[MLDeduplicator] = None


def get_deduplicator(config: Optional[DedupConfig] = None) -> MLDeduplicator:
    """Get or create the global deduplicator instance"""
    global _deduplicator
    if _deduplicator is None:
        _deduplicator = MLDeduplicator(config)
    return _deduplicator


def check_duplicate(record: Dict[str, Any], record_id: str = None) -> DedupResult:
    """Check if a record is a duplicate"""
    dedup = get_deduplicator()
    rid = record_id or record.get("id", f"rec_{hash(str(record))}")
    return dedup.check_duplicate(rid, record)


def index_record(record: Dict[str, Any], record_id: str = None) -> None:
    """Index a record for future duplicate checks"""
    dedup = get_deduplicator()
    rid = record_id or record.get("id", f"rec_{hash(str(record))}")
    dedup.index_record(rid, record)
