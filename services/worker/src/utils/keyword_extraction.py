"""
Keyword Extraction Utility

Extracts keywords from text using TF-IDF and optional n-gram analysis.
"""

from __future__ import annotations

import logging
import re
from dataclasses import dataclass
from typing import List, Optional, Set, Tuple

logger = logging.getLogger(__name__)

# Common English stopwords
STOPWORDS: Set[str] = {
    "a", "an", "and", "are", "as", "at", "be", "been", "by", "for", "from",
    "has", "have", "he", "in", "is", "it", "its", "of", "on", "or", "she",
    "that", "the", "their", "them", "there", "these", "they", "this", "to",
    "was", "were", "which", "who", "will", "with", "would", "you", "your",
    "but", "can", "could", "did", "do", "does", "had", "how", "if", "may",
    "more", "most", "no", "not", "only", "other", "our", "out", "over",
    "should", "so", "some", "such", "than", "then", "through", "up", "very",
    "what", "when", "where", "while", "about", "after", "all", "also", "any",
    "because", "before", "between", "both", "each", "few", "first", "into",
    "just", "last", "made", "make", "many", "must", "my", "new", "now",
    "old", "one", "own", "same", "see", "time", "two", "us", "use", "used",
    "way", "well", "work", "year", "years", "study", "studies", "using",
    "based", "results", "however", "found", "data", "method", "methods",
    "analysis", "research", "significant", "different", "group", "groups",
    "effect", "effects", "conclusion", "conclusions", "background", "objective",
}


@dataclass
class KeywordResult:
    """Result of keyword extraction."""
    keywords: List[Tuple[str, float]]  # (keyword, score) pairs
    total_terms: int
    unique_terms: int
    method: str


def clean_text(text: str) -> str:
    """Clean and normalize text for keyword extraction."""
    # Convert to lowercase
    text = text.lower()
    # Remove special characters but keep spaces
    text = re.sub(r"[^a-z0-9\s-]", " ", text)
    # Normalize whitespace
    text = re.sub(r"\s+", " ", text).strip()
    return text


def tokenize(text: str, min_length: int = 3) -> List[str]:
    """Tokenize text into words."""
    words = text.split()
    return [w for w in words if len(w) >= min_length and w not in STOPWORDS]


def extract_ngrams(tokens: List[str], n: int = 2) -> List[str]:
    """Extract n-grams from token list."""
    return [" ".join(tokens[i:i+n]) for i in range(len(tokens) - n + 1)]


def extract_keywords_tfidf(
    texts: List[str],
    top_k: int = 20,
    min_df: int = 1,
    max_df: float = 0.95,
    ngram_range: Tuple[int, int] = (1, 2),
    use_sklearn: bool = True,
) -> KeywordResult:
    """
    Extract keywords using TF-IDF.

    Args:
        texts: List of texts to analyze
        top_k: Number of top keywords to return
        min_df: Minimum document frequency
        max_df: Maximum document frequency (as proportion)
        ngram_range: Range of n-grams to consider
        use_sklearn: Use sklearn TfidfVectorizer if available

    Returns:
        KeywordResult with top keywords and scores
    """
    if not texts:
        return KeywordResult(
            keywords=[],
            total_terms=0,
            unique_terms=0,
            method="tfidf",
        )

    # Clean texts
    cleaned_texts = [clean_text(t) for t in texts]

    if use_sklearn:
        try:
            return _extract_with_sklearn(
                cleaned_texts, top_k, min_df, max_df, ngram_range
            )
        except ImportError:
            logger.warning("sklearn not available, using simple TF-IDF")

    # Simple fallback TF-IDF implementation
    return _extract_simple_tfidf(cleaned_texts, top_k)


def _extract_with_sklearn(
    texts: List[str],
    top_k: int,
    min_df: int,
    max_df: float,
    ngram_range: Tuple[int, int],
) -> KeywordResult:
    """Extract keywords using sklearn TfidfVectorizer."""
    from sklearn.feature_extraction.text import TfidfVectorizer

    vectorizer = TfidfVectorizer(
        min_df=min_df,
        max_df=max_df,
        ngram_range=ngram_range,
        stop_words=list(STOPWORDS),
    )

    try:
        tfidf_matrix = vectorizer.fit_transform(texts)
    except ValueError as e:
        # Handle empty vocabulary
        logger.warning(f"TF-IDF extraction failed: {e}")
        return KeywordResult(
            keywords=[],
            total_terms=0,
            unique_terms=0,
            method="tfidf_sklearn",
        )

    # Get feature names and average TF-IDF scores
    feature_names = vectorizer.get_feature_names_out()
    avg_scores = tfidf_matrix.mean(axis=0).A1

    # Sort by score
    sorted_indices = avg_scores.argsort()[::-1]

    keywords = [
        (feature_names[i], float(avg_scores[i]))
        for i in sorted_indices[:top_k]
        if avg_scores[i] > 0
    ]

    return KeywordResult(
        keywords=keywords,
        total_terms=int(tfidf_matrix.sum()),
        unique_terms=len(feature_names),
        method="tfidf_sklearn",
    )


def _extract_simple_tfidf(
    texts: List[str],
    top_k: int,
) -> KeywordResult:
    """Simple TF-IDF without sklearn."""
    import math
    from collections import Counter

    # Tokenize all documents
    doc_tokens = [tokenize(t) for t in texts]
    n_docs = len(doc_tokens)

    if n_docs == 0:
        return KeywordResult(
            keywords=[],
            total_terms=0,
            unique_terms=0,
            method="tfidf_simple",
        )

    # Calculate document frequency
    doc_freq: Counter = Counter()
    for tokens in doc_tokens:
        doc_freq.update(set(tokens))

    # Calculate TF-IDF for each term
    tfidf_scores: Counter = Counter()
    total_terms = 0

    for tokens in doc_tokens:
        term_freq = Counter(tokens)
        total_terms += len(tokens)
        for term, tf in term_freq.items():
            df = doc_freq[term]
            idf = math.log((n_docs + 1) / (df + 1)) + 1
            tfidf_scores[term] += tf * idf

    # Normalize by number of documents
    for term in tfidf_scores:
        tfidf_scores[term] /= n_docs

    keywords = tfidf_scores.most_common(top_k)

    return KeywordResult(
        keywords=keywords,
        total_terms=total_terms,
        unique_terms=len(tfidf_scores),
        method="tfidf_simple",
    )


def extract_keywords_rake(
    text: str,
    top_k: int = 20,
    min_length: int = 1,
    max_length: int = 4,
) -> KeywordResult:
    """
    Extract keywords using RAKE (Rapid Automatic Keyword Extraction).

    Args:
        text: Text to analyze
        top_k: Number of top keywords to return
        min_length: Minimum phrase length (in words)
        max_length: Maximum phrase length (in words)

    Returns:
        KeywordResult with top keywords and scores
    """
    # Simple RAKE implementation
    text = clean_text(text)

    # Split into phrases at stopwords and punctuation
    phrases = re.split(r"\b(?:" + "|".join(STOPWORDS) + r")\b", text)
    phrases = [p.strip() for p in phrases if p.strip()]

    # Calculate word frequencies and degrees
    word_freq: Counter = Counter()
    word_degree: Counter = Counter()

    for phrase in phrases:
        words = phrase.split()
        if min_length <= len(words) <= max_length:
            for word in words:
                word_freq[word] += 1
                word_degree[word] += len(words) - 1

    # Calculate word scores (degree/frequency)
    word_scores = {}
    for word in word_freq:
        word_scores[word] = (word_degree[word] + word_freq[word]) / word_freq[word]

    # Score phrases
    phrase_scores = {}
    for phrase in phrases:
        words = phrase.split()
        if min_length <= len(words) <= max_length:
            score = sum(word_scores.get(w, 0) for w in words)
            phrase_scores[phrase] = score

    # Sort and return top keywords
    sorted_phrases = sorted(phrase_scores.items(), key=lambda x: x[1], reverse=True)
    keywords = sorted_phrases[:top_k]

    return KeywordResult(
        keywords=keywords,
        total_terms=sum(word_freq.values()),
        unique_terms=len(word_freq),
        method="rake",
    )


def extract_keywords_from_abstracts(
    abstracts: List[str],
    method: str = "tfidf",
    top_k: int = 20,
    **kwargs,
) -> KeywordResult:
    """
    Extract keywords from a list of abstracts.

    Args:
        abstracts: List of abstract texts
        method: Extraction method ("tfidf" or "rake")
        top_k: Number of keywords to return
        **kwargs: Additional method-specific arguments

    Returns:
        KeywordResult with extracted keywords
    """
    if not abstracts:
        return KeywordResult(
            keywords=[],
            total_terms=0,
            unique_terms=0,
            method=method,
        )

    if method == "rake":
        # Combine abstracts for RAKE
        combined_text = " ".join(abstracts)
        return extract_keywords_rake(combined_text, top_k=top_k, **kwargs)
    else:
        return extract_keywords_tfidf(abstracts, top_k=top_k, **kwargs)
