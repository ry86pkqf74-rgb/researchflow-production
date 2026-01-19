"""
Plagiarism Detection Service

Detects potential plagiarism through:
- Text similarity analysis
- Citation verification
- Paraphrase detection
- Source matching
- Fingerprint comparison
"""

import hashlib
import re
from dataclasses import dataclass, field
from typing import List, Dict, Any, Optional, Set, Tuple
from collections import defaultdict
import difflib


@dataclass
class TextSegment:
    """A segment of text for analysis"""
    text: str
    start: int
    end: int
    source_id: Optional[str] = None


@dataclass
class SimilarityMatch:
    """A detected similarity match"""
    query_segment: TextSegment
    source_segment: TextSegment
    source_id: str
    source_title: str
    similarity_score: float
    match_type: str  # exact, near_exact, paraphrase, common_phrase
    highlighted_query: str
    highlighted_source: str


@dataclass
class PlagiarismReport:
    """Complete plagiarism analysis report"""
    document_id: str
    analyzed_at: str
    total_words: int
    unique_words: int
    matches: List[SimilarityMatch]
    overall_similarity: float
    similarity_by_source: Dict[str, float]
    flagged_sections: List[TextSegment]
    citation_issues: List[Dict[str, Any]]
    recommendations: List[str]


@dataclass
class SourceDocument:
    """A source document for comparison"""
    id: str
    title: str
    text: str
    author: Optional[str] = None
    year: Optional[int] = None
    url: Optional[str] = None


class PlagiarismDetector:
    """Detects plagiarism and text similarity"""

    # Common phrases to ignore (too generic to be plagiarism)
    COMMON_PHRASES = {
        "in this study", "we found that", "the results show",
        "in conclusion", "further research", "it is important",
        "on the other hand", "in addition to", "as a result",
        "in order to", "according to the", "based on the",
        "the purpose of this study", "the aim of this study"
    }

    def __init__(
        self,
        min_match_length: int = 10,  # Minimum words for a match
        similarity_threshold: float = 0.8,  # Minimum similarity for flagging
        window_size: int = 50  # Words per window for comparison
    ):
        self.min_match_length = min_match_length
        self.similarity_threshold = similarity_threshold
        self.window_size = window_size
        self._fingerprints: Dict[str, Set[str]] = {}

    def analyze(
        self,
        text: str,
        sources: List[SourceDocument],
        document_id: str = "query"
    ) -> PlagiarismReport:
        """
        Analyze text for plagiarism against source documents.

        Args:
            text: Text to check
            sources: Source documents to compare against
            document_id: ID for the query document

        Returns:
            Complete plagiarism report
        """
        from datetime import datetime

        # Preprocess text
        cleaned_text = self._preprocess(text)
        words = cleaned_text.split()
        total_words = len(words)

        # Build fingerprints for sources
        source_fingerprints = {}
        for source in sources:
            source_fingerprints[source.id] = self._build_fingerprints(
                self._preprocess(source.text)
            )

        # Build fingerprints for query
        query_fingerprints = self._build_fingerprints(cleaned_text)

        # Find matches
        matches = []
        similarity_by_source: Dict[str, float] = defaultdict(float)

        for source in sources:
            source_matches = self._find_matches(
                text, cleaned_text,
                source, self._preprocess(source.text),
                query_fingerprints, source_fingerprints[source.id]
            )
            matches.extend(source_matches)

            # Calculate per-source similarity
            if source_matches:
                matched_words = sum(
                    len(m.query_segment.text.split()) for m in source_matches
                )
                similarity_by_source[source.id] = matched_words / total_words

        # Calculate overall similarity
        unique_matched_positions: Set[Tuple[int, int]] = set()
        for match in matches:
            unique_matched_positions.add(
                (match.query_segment.start, match.query_segment.end)
            )

        matched_word_count = sum(
            len(text[start:end].split())
            for start, end in unique_matched_positions
        )
        overall_similarity = matched_word_count / total_words if total_words > 0 else 0

        # Identify flagged sections
        flagged_sections = self._identify_flagged_sections(matches)

        # Check citations
        citation_issues = self._check_citations(text, matches)

        # Generate recommendations
        recommendations = self._generate_recommendations(
            overall_similarity, matches, citation_issues
        )

        return PlagiarismReport(
            document_id=document_id,
            analyzed_at=datetime.utcnow().isoformat(),
            total_words=total_words,
            unique_words=len(set(words)),
            matches=matches,
            overall_similarity=overall_similarity,
            similarity_by_source=dict(similarity_by_source),
            flagged_sections=flagged_sections,
            citation_issues=citation_issues,
            recommendations=recommendations
        )

    def _preprocess(self, text: str) -> str:
        """Preprocess text for comparison"""
        # Lowercase
        text = text.lower()
        # Remove extra whitespace
        text = re.sub(r'\s+', ' ', text)
        # Remove special characters but keep basic punctuation
        text = re.sub(r'[^\w\s.,!?;:\'-]', '', text)
        return text.strip()

    def _build_fingerprints(self, text: str, n: int = 5) -> Set[str]:
        """Build n-gram fingerprints for text"""
        words = text.split()
        fingerprints = set()

        for i in range(len(words) - n + 1):
            ngram = ' '.join(words[i:i+n])
            # Skip common phrases
            if ngram not in self.COMMON_PHRASES:
                fingerprints.add(ngram)

        return fingerprints

    def _find_matches(
        self,
        original_text: str,
        query_text: str,
        source: SourceDocument,
        source_text: str,
        query_fps: Set[str],
        source_fps: Set[str]
    ) -> List[SimilarityMatch]:
        """Find matches between query and source"""
        matches = []

        # Find common fingerprints
        common_fps = query_fps & source_fps

        if not common_fps:
            return matches

        # For each common fingerprint, find the full matching region
        query_words = query_text.split()
        source_words = source_text.split()

        processed_regions: Set[Tuple[int, int]] = set()

        for fp in common_fps:
            fp_words = fp.split()

            # Find in query
            for qi in range(len(query_words) - len(fp_words) + 1):
                if ' '.join(query_words[qi:qi+len(fp_words)]) == fp:
                    # Find in source
                    for si in range(len(source_words) - len(fp_words) + 1):
                        if ' '.join(source_words[si:si+len(fp_words)]) == fp:
                            # Extend match in both directions
                            start_q, end_q, start_s, end_s = self._extend_match(
                                query_words, source_words, qi, si
                            )

                            # Skip if already processed this region
                            region = (start_q, end_q)
                            if region in processed_regions:
                                continue
                            processed_regions.add(region)

                            # Calculate match length
                            match_length = end_q - start_q

                            if match_length >= self.min_match_length:
                                # Find original text positions
                                q_text = ' '.join(query_words[start_q:end_q])
                                s_text = ' '.join(source_words[start_s:end_s])

                                # Calculate similarity
                                similarity = self._calculate_similarity(q_text, s_text)

                                if similarity >= self.similarity_threshold:
                                    # Determine match type
                                    if similarity >= 0.99:
                                        match_type = 'exact'
                                    elif similarity >= 0.9:
                                        match_type = 'near_exact'
                                    else:
                                        match_type = 'paraphrase'

                                    # Find positions in original text
                                    q_start = self._find_position(original_text, q_text)
                                    s_start = self._find_position(source.text, s_text)

                                    matches.append(SimilarityMatch(
                                        query_segment=TextSegment(
                                            text=q_text,
                                            start=q_start,
                                            end=q_start + len(q_text)
                                        ),
                                        source_segment=TextSegment(
                                            text=s_text,
                                            start=s_start,
                                            end=s_start + len(s_text)
                                        ),
                                        source_id=source.id,
                                        source_title=source.title,
                                        similarity_score=similarity,
                                        match_type=match_type,
                                        highlighted_query=self._highlight_text(q_text),
                                        highlighted_source=self._highlight_text(s_text)
                                    ))

        return matches

    def _extend_match(
        self,
        query_words: List[str],
        source_words: List[str],
        qi: int,
        si: int
    ) -> Tuple[int, int, int, int]:
        """Extend a match in both directions"""
        # Extend backwards
        start_q, start_s = qi, si
        while start_q > 0 and start_s > 0:
            if query_words[start_q - 1] == source_words[start_s - 1]:
                start_q -= 1
                start_s -= 1
            else:
                break

        # Extend forwards
        end_q, end_s = qi + 1, si + 1
        while end_q < len(query_words) and end_s < len(source_words):
            if query_words[end_q] == source_words[end_s]:
                end_q += 1
                end_s += 1
            else:
                break

        return start_q, end_q, start_s, end_s

    def _calculate_similarity(self, text1: str, text2: str) -> float:
        """Calculate similarity between two text segments"""
        return difflib.SequenceMatcher(None, text1, text2).ratio()

    def _find_position(self, full_text: str, segment: str) -> int:
        """Find position of segment in full text"""
        pos = full_text.lower().find(segment.lower()[:50])
        return max(0, pos)

    def _highlight_text(self, text: str) -> str:
        """Add highlighting markers to text"""
        return f"**{text}**"

    def _identify_flagged_sections(
        self,
        matches: List[SimilarityMatch]
    ) -> List[TextSegment]:
        """Identify sections that should be flagged for review"""
        flagged = []

        # Sort by similarity score
        sorted_matches = sorted(
            matches,
            key=lambda m: m.similarity_score,
            reverse=True
        )

        for match in sorted_matches:
            if match.similarity_score >= 0.9 and match.match_type in ['exact', 'near_exact']:
                flagged.append(match.query_segment)

        return flagged[:10]  # Top 10 most concerning

    def _check_citations(
        self,
        text: str,
        matches: List[SimilarityMatch]
    ) -> List[Dict[str, Any]]:
        """Check for citation issues"""
        issues = []

        # Citation patterns
        citation_pattern = r'\([^)]*\d{4}[^)]*\)|[\[\d+\]]'

        for match in matches:
            # Check if matched text has nearby citation
            context_start = max(0, match.query_segment.start - 50)
            context_end = min(len(text), match.query_segment.end + 50)
            context = text[context_start:context_end]

            has_citation = bool(re.search(citation_pattern, context))

            if not has_citation and match.similarity_score >= 0.9:
                issues.append({
                    'type': 'missing_citation',
                    'text': match.query_segment.text[:100] + '...',
                    'source': match.source_title,
                    'severity': 'high' if match.match_type == 'exact' else 'medium'
                })

        return issues

    def _generate_recommendations(
        self,
        overall_similarity: float,
        matches: List[SimilarityMatch],
        citation_issues: List[Dict[str, Any]]
    ) -> List[str]:
        """Generate recommendations based on analysis"""
        recommendations = []

        if overall_similarity > 0.3:
            recommendations.append(
                "High overall similarity detected. Review all highlighted sections."
            )

        exact_matches = [m for m in matches if m.match_type == 'exact']
        if exact_matches:
            recommendations.append(
                f"Found {len(exact_matches)} exact matches. "
                "These should be quoted and cited."
            )

        if citation_issues:
            recommendations.append(
                f"Found {len(citation_issues)} sections that may need citations."
            )

        if overall_similarity < 0.1:
            recommendations.append(
                "Low similarity score. Document appears to be original."
            )

        return recommendations

    def compare_two_documents(
        self,
        doc1: str,
        doc2: str
    ) -> float:
        """Quick comparison between two documents"""
        fp1 = self._build_fingerprints(self._preprocess(doc1))
        fp2 = self._build_fingerprints(self._preprocess(doc2))

        if not fp1 or not fp2:
            return 0.0

        common = len(fp1 & fp2)
        total = len(fp1 | fp2)

        return common / total if total > 0 else 0.0


# Convenience function
def check_plagiarism(
    text: str,
    sources: List[SourceDocument]
) -> PlagiarismReport:
    """Check text for plagiarism against sources"""
    detector = PlagiarismDetector()
    return detector.analyze(text, sources)


# Example usage
if __name__ == "__main__":
    # Create sample sources
    sources = [
        SourceDocument(
            id="source1",
            title="Introduction to Machine Learning",
            text="Machine learning is a subset of artificial intelligence that focuses on building systems that can learn from data. These systems improve their performance over time without being explicitly programmed.",
            author="Smith, J.",
            year=2023
        ),
        SourceDocument(
            id="source2",
            title="Deep Learning Fundamentals",
            text="Deep learning uses neural networks with multiple layers to progressively extract higher-level features from raw input. This approach has revolutionized many fields including computer vision and natural language processing.",
            author="Johnson, M.",
            year=2022
        )
    ]

    # Text to check
    query_text = """
    Machine learning is a subset of artificial intelligence that focuses on building
    systems that can learn from data. This technology has transformed many industries.
    Deep learning approaches use neural networks with multiple layers to extract features
    from raw data, revolutionizing fields like computer vision.
    """

    # Check for plagiarism
    report = check_plagiarism(query_text, sources)

    print(f"Overall Similarity: {report.overall_similarity:.1%}")
    print(f"Matches found: {len(report.matches)}")

    for match in report.matches[:3]:
        print(f"\n- Match with '{match.source_title}'")
        print(f"  Similarity: {match.similarity_score:.1%}")
        print(f"  Type: {match.match_type}")
        print(f"  Text: {match.query_segment.text[:80]}...")

    print("\nRecommendations:")
    for rec in report.recommendations:
        print(f"- {rec}")
