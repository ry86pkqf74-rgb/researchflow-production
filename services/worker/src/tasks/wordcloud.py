"""
Word Cloud Generation Task

Task 184: Generate word clouds from research topics and text data.
Used by the WordCloud.tsx component for visualization.
"""

import json
import re
from collections import Counter
from typing import Any

# Common stop words to filter out
STOP_WORDS = {
    "a", "an", "and", "are", "as", "at", "be", "by", "for", "from",
    "has", "he", "in", "is", "it", "its", "of", "on", "that", "the",
    "to", "was", "were", "will", "with", "the", "this", "but", "they",
    "have", "had", "what", "when", "where", "who", "which", "why", "how",
    "all", "each", "every", "both", "few", "more", "most", "other",
    "some", "such", "no", "nor", "not", "only", "own", "same", "so",
    "than", "too", "very", "can", "just", "should", "now", "also",
    "into", "our", "out", "up", "down", "about", "after", "before",
    "between", "through", "during", "above", "below", "under", "over",
}

# Medical/research domain stop words
DOMAIN_STOP_WORDS = {
    "study", "studies", "research", "method", "methods", "result", "results",
    "conclusion", "conclusions", "background", "objective", "objectives",
    "patient", "patients", "group", "groups", "data", "analysis",
    "significant", "significantly", "p", "n", "et", "al", "fig", "figure",
    "table", "vs", "ci", "or", "hr", "rr", "mean", "median", "sd",
}


def clean_text(text: str) -> str:
    """Clean and normalize text for word extraction."""
    # Convert to lowercase
    text = text.lower()
    # Remove URLs
    text = re.sub(r"https?://\S+|www\.\S+", "", text)
    # Remove email addresses
    text = re.sub(r"\S+@\S+", "", text)
    # Remove numbers and special characters, keep letters and spaces
    text = re.sub(r"[^a-z\s]", " ", text)
    # Normalize whitespace
    text = re.sub(r"\s+", " ", text).strip()
    return text


def extract_words(text: str, min_length: int = 3) -> list[str]:
    """Extract meaningful words from text."""
    cleaned = clean_text(text)
    words = cleaned.split()

    # Filter stop words and short words
    all_stop_words = STOP_WORDS | DOMAIN_STOP_WORDS
    filtered = [
        word for word in words
        if word not in all_stop_words and len(word) >= min_length
    ]

    return filtered


def calculate_word_frequencies(
    texts: list[str],
    max_words: int = 100,
    min_frequency: int = 2,
) -> list[dict[str, Any]]:
    """
    Calculate word frequencies from multiple texts.

    Args:
        texts: List of text strings to analyze
        max_words: Maximum number of words to return
        min_frequency: Minimum frequency threshold

    Returns:
        List of word frequency objects sorted by frequency
    """
    all_words: list[str] = []

    for text in texts:
        words = extract_words(text)
        all_words.extend(words)

    # Count frequencies
    counter = Counter(all_words)

    # Filter by minimum frequency
    filtered = {
        word: count for word, count in counter.items()
        if count >= min_frequency
    }

    # Sort by frequency and limit
    sorted_words = sorted(
        filtered.items(),
        key=lambda x: x[1],
        reverse=True
    )[:max_words]

    # Calculate relative sizes (1-10 scale)
    if not sorted_words:
        return []

    max_freq = sorted_words[0][1]
    min_freq = sorted_words[-1][1] if len(sorted_words) > 1 else max_freq

    result = []
    for word, freq in sorted_words:
        # Normalize to 1-10 scale
        if max_freq == min_freq:
            size = 5
        else:
            size = 1 + int(9 * (freq - min_freq) / (max_freq - min_freq))

        result.append({
            "text": word,
            "value": freq,
            "size": size,
        })

    return result


def generate_wordcloud_data(
    input_data: dict[str, Any],
) -> dict[str, Any]:
    """
    Generate word cloud data from input.

    Args:
        input_data: Dictionary with 'texts' key containing list of strings,
                   and optional 'options' for configuration

    Returns:
        Dictionary with 'words' list and metadata
    """
    texts = input_data.get("texts", [])
    options = input_data.get("options", {})

    max_words = options.get("maxWords", 100)
    min_frequency = options.get("minFrequency", 2)
    min_length = options.get("minWordLength", 3)

    # Handle single text input
    if isinstance(texts, str):
        texts = [texts]

    # Extract and count words
    all_words: list[str] = []
    for text in texts:
        if isinstance(text, str):
            words = extract_words(text, min_length=min_length)
            all_words.extend(words)

    words = calculate_word_frequencies(
        texts,
        max_words=max_words,
        min_frequency=min_frequency,
    )

    return {
        "words": words,
        "totalTexts": len(texts),
        "totalWords": len(all_words),
        "uniqueWords": len(set(all_words)),
    }


def run_task(payload: dict[str, Any]) -> dict[str, Any]:
    """
    Task entry point for the worker.

    Args:
        payload: Task payload with input data

    Returns:
        Task result with word cloud data
    """
    try:
        result = generate_wordcloud_data(payload)
        return {
            "status": "success",
            "data": result,
        }
    except Exception as e:
        return {
            "status": "error",
            "error": str(e),
        }


# CLI support for testing
if __name__ == "__main__":
    import sys

    if len(sys.argv) > 1:
        # Read from file
        with open(sys.argv[1], "r") as f:
            input_data = json.load(f)
    else:
        # Example usage
        input_data = {
            "texts": [
                "Machine learning models for clinical diagnosis prediction",
                "Deep learning neural networks in medical imaging analysis",
                "Natural language processing for electronic health records",
                "Predictive analytics in healthcare outcomes research",
                "Artificial intelligence applications in drug discovery",
            ],
            "options": {
                "maxWords": 50,
                "minFrequency": 1,
            },
        }

    result = run_task(input_data)
    print(json.dumps(result, indent=2))
