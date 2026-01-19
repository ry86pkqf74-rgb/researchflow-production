"""
Internationalization (i18n) Module

Multi-language support for text processing.
"""

from .language_detector import detect_language, LanguageDetectionResult
from .translator import translate_text, TranslationResult

__all__ = [
    'detect_language',
    'LanguageDetectionResult',
    'translate_text',
    'TranslationResult',
]
