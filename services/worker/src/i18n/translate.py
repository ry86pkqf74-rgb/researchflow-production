"""
Translation Service - Task 161

Translates extraction fields marked as 'translatable'.
Stores both original and translated values.
"""

import logging
from dataclasses import dataclass
from enum import Enum
from typing import Any, Dict, List, Optional, Set

logger = logging.getLogger(__name__)


class SupportedLanguage(str, Enum):
    """Supported languages for translation"""
    ENGLISH = "en"
    SPANISH = "es"
    FRENCH = "fr"
    GERMAN = "de"
    ITALIAN = "it"
    PORTUGUESE = "pt"
    CHINESE = "zh"
    JAPANESE = "ja"
    KOREAN = "ko"
    ARABIC = "ar"
    RUSSIAN = "ru"
    HINDI = "hi"


@dataclass
class TranslationResult:
    """Result of a translation"""
    original: str
    translated: str
    source_language: str
    target_language: str
    confidence: float
    method: str


@dataclass
class TranslationConfig:
    """Configuration for translation service"""
    target_language: str = "en"
    translatable_fields: Set[str] = None
    skip_if_target_language: bool = True
    use_cache: bool = True
    translation_provider: str = "auto"  # auto, google, deepl, openai
    max_text_length: int = 5000

    def __post_init__(self):
        if self.translatable_fields is None:
            self.translatable_fields = {
                "title",
                "abstract",
                "description",
                "summary",
                "keywords",
                "notes",
            }


class TranslationService:
    """Service for translating extraction fields"""

    def __init__(self, config: Optional[TranslationConfig] = None):
        self.config = config or TranslationConfig()
        self._cache: Dict[str, TranslationResult] = {}
        self._detector = None
        self._translator = None

    def _get_language_detector(self):
        """Lazy load language detection"""
        if self._detector is None:
            try:
                from langdetect import detect, detect_langs
                self._detector = {"detect": detect, "detect_langs": detect_langs}
                logger.info("Loaded langdetect for language detection")
            except ImportError:
                logger.warning("langdetect not installed, using fallback detection")
                self._detector = False
        return self._detector

    def _get_translator(self):
        """Lazy load translation service"""
        if self._translator is None:
            provider = self.config.translation_provider

            if provider == "auto":
                # Try providers in order of preference
                for prov in ["deepl", "google", "openai"]:
                    translator = self._load_translator(prov)
                    if translator:
                        self._translator = translator
                        break
            else:
                self._translator = self._load_translator(provider)

            if not self._translator:
                logger.warning("No translation provider available")
                self._translator = False

        return self._translator

    def _load_translator(self, provider: str) -> Optional[Any]:
        """Load a specific translation provider"""
        if provider == "deepl":
            try:
                import deepl
                import os

                auth_key = os.environ.get("DEEPL_API_KEY")
                if auth_key:
                    translator = deepl.Translator(auth_key)
                    logger.info("Using DeepL for translation")
                    return {"provider": "deepl", "client": translator}
            except ImportError:
                pass

        elif provider == "google":
            try:
                from google.cloud import translate_v2 as translate

                client = translate.Client()
                logger.info("Using Google Translate")
                return {"provider": "google", "client": client}
            except (ImportError, Exception):
                pass

        elif provider == "openai":
            try:
                import openai
                import os

                api_key = os.environ.get("OPENAI_API_KEY")
                if api_key:
                    openai.api_key = api_key
                    logger.info("Using OpenAI for translation")
                    return {"provider": "openai", "client": openai}
            except ImportError:
                pass

        return None

    def detect_language(self, text: str) -> str:
        """Detect the language of text"""
        if not text or len(text.strip()) < 10:
            return "unknown"

        detector = self._get_language_detector()
        if detector:
            try:
                return detector["detect"](text[:1000])
            except Exception as e:
                logger.warning(f"Language detection failed: {e}")
                return "unknown"

        # Fallback: assume English
        return "en"

    def translate_text(
        self, text: str, source_lang: Optional[str] = None
    ) -> TranslationResult:
        """Translate a single text"""
        if not text or len(text.strip()) == 0:
            return TranslationResult(
                original=text,
                translated=text,
                source_language="unknown",
                target_language=self.config.target_language,
                confidence=1.0,
                method="empty",
            )

        # Detect source language if not provided
        if not source_lang:
            source_lang = self.detect_language(text)

        # Skip if already in target language
        if (
            self.config.skip_if_target_language
            and source_lang == self.config.target_language
        ):
            return TranslationResult(
                original=text,
                translated=text,
                source_language=source_lang,
                target_language=self.config.target_language,
                confidence=1.0,
                method="skip_same_language",
            )

        # Check cache
        cache_key = f"{source_lang}:{self.config.target_language}:{hash(text)}"
        if self.config.use_cache and cache_key in self._cache:
            return self._cache[cache_key]

        # Truncate if too long
        text_to_translate = text[:self.config.max_text_length]

        translator = self._get_translator()
        if not translator:
            return TranslationResult(
                original=text,
                translated=text,
                source_language=source_lang,
                target_language=self.config.target_language,
                confidence=0.0,
                method="no_translator",
            )

        try:
            result = self._perform_translation(
                translator, text_to_translate, source_lang
            )

            if self.config.use_cache:
                self._cache[cache_key] = result

            return result
        except Exception as e:
            logger.error(f"Translation failed: {e}")
            return TranslationResult(
                original=text,
                translated=text,
                source_language=source_lang,
                target_language=self.config.target_language,
                confidence=0.0,
                method="error",
            )

    def _perform_translation(
        self, translator: Dict, text: str, source_lang: str
    ) -> TranslationResult:
        """Perform the actual translation using configured provider"""
        provider = translator["provider"]
        client = translator["client"]
        target = self.config.target_language

        if provider == "deepl":
            result = client.translate_text(
                text, target_lang=target.upper(), source_lang=source_lang.upper()
            )
            return TranslationResult(
                original=text,
                translated=result.text,
                source_language=source_lang,
                target_language=target,
                confidence=0.95,
                method="deepl",
            )

        elif provider == "google":
            result = client.translate(text, target_language=target)
            return TranslationResult(
                original=text,
                translated=result["translatedText"],
                source_language=result.get("detectedSourceLanguage", source_lang),
                target_language=target,
                confidence=0.9,
                method="google",
            )

        elif provider == "openai":
            # Use GPT for translation
            response = client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {
                        "role": "system",
                        "content": f"Translate the following text to {target}. Preserve formatting and meaning.",
                    },
                    {"role": "user", "content": text},
                ],
                max_tokens=len(text) * 2,
                temperature=0.3,
            )
            translated = response.choices[0].message.content.strip()
            return TranslationResult(
                original=text,
                translated=translated,
                source_language=source_lang,
                target_language=target,
                confidence=0.85,
                method="openai",
            )

        raise ValueError(f"Unknown translation provider: {provider}")

    def translate_record(
        self, record: Dict[str, Any], fields: Optional[Set[str]] = None
    ) -> Dict[str, Any]:
        """
        Translate translatable fields in a record.
        Returns record with {field: {original: ..., translated: ...}} structure.
        """
        fields_to_translate = fields or self.config.translatable_fields
        translated_record = {}

        for key, value in record.items():
            if key not in fields_to_translate:
                translated_record[key] = value
                continue

            if isinstance(value, str) and value.strip():
                result = self.translate_text(value)
                translated_record[key] = {
                    "original": result.original,
                    "translated": result.translated,
                    "source_language": result.source_language,
                }
            elif isinstance(value, list):
                # Translate list items (e.g., keywords)
                translated_items = []
                for item in value:
                    if isinstance(item, str) and item.strip():
                        result = self.translate_text(item)
                        translated_items.append({
                            "original": result.original,
                            "translated": result.translated,
                        })
                    else:
                        translated_items.append(item)
                translated_record[key] = translated_items
            else:
                translated_record[key] = value

        return translated_record


# Global service instance
_translation_service: Optional[TranslationService] = None


def get_translation_service(
    config: Optional[TranslationConfig] = None,
) -> TranslationService:
    """Get or create the global translation service"""
    global _translation_service
    if _translation_service is None:
        _translation_service = TranslationService(config)
    return _translation_service


def translate_extraction(
    record: Dict[str, Any], target_language: str = "en"
) -> Dict[str, Any]:
    """Convenience function to translate a record"""
    service = get_translation_service()
    service.config.target_language = target_language
    return service.translate_record(record)
