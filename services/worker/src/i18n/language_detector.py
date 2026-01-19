"""
Language Detection

Detects the language of text content.
"""

from __future__ import annotations

import logging
import re
from dataclasses import dataclass, field
from typing import Dict, List, Optional

logger = logging.getLogger(__name__)


@dataclass
class LanguageDetectionResult:
    """Language detection result"""
    success: bool
    language: Optional[str] = None
    language_name: Optional[str] = None
    confidence: float = 0.0
    alternatives: List[Dict[str, float]] = field(default_factory=list)
    error: Optional[str] = None


# Common language codes and names
LANGUAGE_NAMES = {
    'en': 'English',
    'es': 'Spanish',
    'fr': 'French',
    'de': 'German',
    'it': 'Italian',
    'pt': 'Portuguese',
    'nl': 'Dutch',
    'ru': 'Russian',
    'zh': 'Chinese',
    'ja': 'Japanese',
    'ko': 'Korean',
    'ar': 'Arabic',
    'hi': 'Hindi',
    'tr': 'Turkish',
    'pl': 'Polish',
    'vi': 'Vietnamese',
    'th': 'Thai',
    'sv': 'Swedish',
    'da': 'Danish',
    'no': 'Norwegian',
    'fi': 'Finnish',
}


def detect_language(
    text: str,
    return_alternatives: bool = False
) -> LanguageDetectionResult:
    """
    Detect the language of text.

    Args:
        text: Text to analyze
        return_alternatives: Whether to return alternative language guesses

    Returns:
        LanguageDetectionResult with detected language
    """
    if not text or not text.strip():
        return LanguageDetectionResult(
            success=False,
            error="Empty text provided"
        )

    # Try langdetect library first
    try:
        from langdetect import detect, detect_langs

        lang = detect(text)
        confidence = 1.0

        alternatives = []
        if return_alternatives:
            try:
                lang_probs = detect_langs(text)
                for lp in lang_probs:
                    if lp.lang != lang:
                        alternatives.append({
                            'language': lp.lang,
                            'language_name': LANGUAGE_NAMES.get(lp.lang, lp.lang),
                            'probability': lp.prob
                        })
                # Set confidence from actual probability
                for lp in lang_probs:
                    if lp.lang == lang:
                        confidence = lp.prob
                        break
            except Exception:
                pass

        return LanguageDetectionResult(
            success=True,
            language=lang,
            language_name=LANGUAGE_NAMES.get(lang, lang),
            confidence=confidence,
            alternatives=alternatives[:3]  # Top 3 alternatives
        )

    except ImportError:
        logger.debug("langdetect not installed, using fallback")
        pass
    except Exception as e:
        logger.warning(f"langdetect failed: {e}")

    # Fallback: basic heuristic detection
    return _fallback_detection(text)


def _fallback_detection(text: str) -> LanguageDetectionResult:
    """Basic language detection using character analysis"""
    text = text.lower()

    # Character range checks
    def has_range(text: str, start: int, end: int) -> bool:
        return any(start <= ord(c) <= end for c in text)

    # Chinese characters
    if has_range(text, 0x4E00, 0x9FFF):
        return LanguageDetectionResult(
            success=True,
            language='zh',
            language_name='Chinese',
            confidence=0.8
        )

    # Japanese (Hiragana/Katakana)
    if has_range(text, 0x3040, 0x30FF):
        return LanguageDetectionResult(
            success=True,
            language='ja',
            language_name='Japanese',
            confidence=0.8
        )

    # Korean (Hangul)
    if has_range(text, 0xAC00, 0xD7AF):
        return LanguageDetectionResult(
            success=True,
            language='ko',
            language_name='Korean',
            confidence=0.8
        )

    # Arabic
    if has_range(text, 0x0600, 0x06FF):
        return LanguageDetectionResult(
            success=True,
            language='ar',
            language_name='Arabic',
            confidence=0.8
        )

    # Cyrillic (Russian, etc.)
    if has_range(text, 0x0400, 0x04FF):
        return LanguageDetectionResult(
            success=True,
            language='ru',
            language_name='Russian',
            confidence=0.7
        )

    # Thai
    if has_range(text, 0x0E00, 0x0E7F):
        return LanguageDetectionResult(
            success=True,
            language='th',
            language_name='Thai',
            confidence=0.8
        )

    # Latin-based - use common word detection
    words = set(re.findall(r'\b[a-z]+\b', text))

    # English common words
    english_words = {'the', 'and', 'is', 'in', 'to', 'of', 'for', 'with', 'on', 'at'}
    english_score = len(words & english_words) / max(len(words), 1)

    # Spanish common words
    spanish_words = {'el', 'la', 'de', 'que', 'en', 'es', 'un', 'los', 'del', 'con'}
    spanish_score = len(words & spanish_words) / max(len(words), 1)

    # French common words
    french_words = {'le', 'la', 'les', 'de', 'et', 'est', 'un', 'une', 'du', 'en'}
    french_score = len(words & french_words) / max(len(words), 1)

    # German common words
    german_words = {'der', 'die', 'und', 'in', 'ist', 'von', 'mit', 'den', 'das', 'zu'}
    german_score = len(words & german_words) / max(len(words), 1)

    scores = [
        ('en', 'English', english_score),
        ('es', 'Spanish', spanish_score),
        ('fr', 'French', french_score),
        ('de', 'German', german_score),
    ]

    # Sort by score
    scores.sort(key=lambda x: x[2], reverse=True)

    if scores[0][2] > 0.1:
        return LanguageDetectionResult(
            success=True,
            language=scores[0][0],
            language_name=scores[0][1],
            confidence=min(scores[0][2] * 2, 0.7)  # Cap confidence
        )

    # Default to English with low confidence
    return LanguageDetectionResult(
        success=True,
        language='en',
        language_name='English',
        confidence=0.3
    )


def is_english(text: str, threshold: float = 0.7) -> bool:
    """
    Quick check if text is English.

    Args:
        text: Text to check
        threshold: Confidence threshold

    Returns:
        True if text is likely English
    """
    result = detect_language(text)
    return result.success and result.language == 'en' and result.confidence >= threshold
