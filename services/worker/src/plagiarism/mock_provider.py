"""Mock Plagiarism Provider for DEMO/Testing.

This module provides a mock plagiarism provider that returns synthetic
results without making any external API calls. Used for:
- DEMO mode demonstrations
- CI/CD testing
- Development without API keys

Design Principles:
- Deterministic: same input produces same output (seeded random)
- Always passes in DEMO mode (low similarity scores)
- Simulates realistic API latency
- No external dependencies
"""

from __future__ import annotations

import hashlib
import logging
import random
import time
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import List, Optional

from .provider import (
    PlagiarismMatch,
    PlagiarismProvider,
    PlagiarismResult,
    ProviderStatus,
    hash_matched_text,
)

logger = logging.getLogger(__name__)


# Sample source URLs for mock matches (academic-looking)
MOCK_SOURCES = [
    ("https://pubmed.ncbi.nlm.nih.gov/12345678/", "A systematic review of clinical outcomes"),
    ("https://doi.org/10.1000/mock.2024.001", "Statistical methods in biomedical research"),
    ("https://arxiv.org/abs/2024.12345", "Machine learning approaches for healthcare"),
    ("https://www.nature.com/articles/s41591-024-0001", "Randomized controlled trial design principles"),
    ("https://jamanetwork.com/journals/jama/mock", "Evidence-based medicine guidelines"),
    ("https://www.thelancet.com/mock/article", "Population health studies methodology"),
    ("https://bmj.com/content/mock/123", "Meta-analysis best practices"),
]


@dataclass
class MockPlagiarismProvider(PlagiarismProvider):
    """Mock plagiarism provider for DEMO/testing environments.

    This provider generates synthetic plagiarism results without making
    any external API calls. It's designed to:
    - Be deterministic (same input -> same output)
    - Always pass in DEMO mode (low similarity scores)
    - Simulate realistic API latency
    - Provide realistic-looking match data

    Attributes:
        simulate_latency: Whether to add artificial delay (default: True)
        latency_range: Min/max latency in seconds (default: 0.5-2.0)
        force_similarity: If set, use this similarity score (for testing)
        demo_mode: If True, always return low similarity (passing)
    """
    simulate_latency: bool = True
    latency_range: tuple[float, float] = (0.5, 2.0)
    force_similarity: Optional[float] = None
    demo_mode: bool = True

    @property
    def name(self) -> str:
        """Get the provider name."""
        return "mock"

    def get_status(self) -> ProviderStatus:
        """Get the current status of the provider.

        Mock provider is always available in sandbox mode.
        """
        return ProviderStatus.SANDBOX

    def check(self, text: str, document_id: str) -> PlagiarismResult:
        """Perform a mock plagiarism check.

        Generates synthetic results based on document content hash
        for deterministic behavior. In demo_mode, always returns
        low similarity scores (passing).

        Args:
            text: The text to check for plagiarism
            document_id: Unique identifier for the document

        Returns:
            PlagiarismResult with synthetic matches
        """
        logger.info(
            f"Mock plagiarism check started: document_id={document_id}, "
            f"text_length={len(text)}, demo_mode={self.demo_mode}"
        )

        # Simulate API latency
        if self.simulate_latency:
            latency = random.uniform(*self.latency_range)
            logger.debug(f"Simulating latency: {latency:.2f}s")
            time.sleep(latency)

        # Generate deterministic seed from content
        content_hash = hashlib.sha256(
            (document_id + text).encode("utf-8")
        ).hexdigest()
        seed = int(content_hash[:8], 16)
        rng = random.Random(seed)

        # Determine similarity score
        if self.force_similarity is not None:
            similarity_score = max(0.0, min(1.0, self.force_similarity))
        elif self.demo_mode:
            # Demo mode: always low similarity (0-5%)
            similarity_score = rng.uniform(0.0, 0.05)
        else:
            # Non-demo: realistic distribution (0-30% typically)
            similarity_score = rng.uniform(0.0, 0.30)

        # Generate matches based on similarity
        matches = self._generate_mock_matches(text, similarity_score, rng)

        # Generate scan ID
        scan_id = f"MOCK_{content_hash[:12]}"

        result = PlagiarismResult(
            similarity_score=similarity_score,
            matches=matches,
            provider=self.name,
            checked_at=datetime.now(timezone.utc),
            document_id=document_id,
            scan_id=scan_id,
            is_mock=True,
        )

        logger.info(
            f"Mock plagiarism check completed: document_id={document_id}, "
            f"similarity={similarity_score:.2%}, matches={len(matches)}, "
            f"passed={result.passed}"
        )

        return result

    def _generate_mock_matches(
        self,
        text: str,
        similarity_score: float,
        rng: random.Random,
    ) -> List[PlagiarismMatch]:
        """Generate synthetic plagiarism matches.

        Creates realistic-looking matches distributed throughout the text,
        with match count proportional to similarity score.

        Args:
            text: The source text
            similarity_score: Overall similarity (affects match count)
            rng: Seeded random generator for determinism

        Returns:
            List of synthetic PlagiarismMatch objects
        """
        if similarity_score < 0.01 or len(text) < 100:
            # Very low similarity or short text: no matches
            return []

        # Calculate number of matches based on similarity
        # ~1 match per 5% similarity, with some variance
        expected_matches = int(similarity_score * 20)
        num_matches = max(0, min(10, rng.randint(
            max(1, expected_matches - 1),
            expected_matches + 2
        )))

        if num_matches == 0:
            return []

        matches: List[PlagiarismMatch] = []
        text_len = len(text)

        # Distribute matches throughout the text
        chunk_size = text_len // (num_matches + 1)

        for i in range(num_matches):
            # Select a random source
            source_url, source_title = rng.choice(MOCK_SOURCES)

            # Calculate position in text
            start_base = i * chunk_size + rng.randint(0, max(1, chunk_size // 2))
            start_position = min(start_base, text_len - 50)
            match_length = rng.randint(30, 150)
            end_position = min(start_position + match_length, text_len)

            # Extract the "matched" text segment and hash it
            matched_segment = text[start_position:end_position]
            matched_text_hash = hash_matched_text(matched_segment)

            # Individual match similarity (varies around overall)
            match_similarity = max(0.1, min(1.0, rng.uniform(
                similarity_score * 0.5,
                similarity_score * 1.5
            )))

            matches.append(PlagiarismMatch(
                source_url=source_url,
                source_title=source_title,
                matched_text_hash=matched_text_hash,
                similarity=match_similarity,
                start_position=start_position,
                end_position=end_position,
            ))

        return matches


def create_mock_provider(
    demo_mode: bool = True,
    simulate_latency: bool = True,
) -> MockPlagiarismProvider:
    """Factory function to create a mock plagiarism provider.

    Args:
        demo_mode: If True, always return passing results
        simulate_latency: If True, add artificial delay

    Returns:
        Configured MockPlagiarismProvider instance
    """
    return MockPlagiarismProvider(
        demo_mode=demo_mode,
        simulate_latency=simulate_latency,
    )
