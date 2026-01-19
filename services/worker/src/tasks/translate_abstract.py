"""Multi-language abstract translation.

Supports translation via DeepL or Google Translate APIs.
All inputs are PHI-scanned before translation.
"""

from __future__ import annotations

import logging
import os
from typing import Any, Dict, Optional

from src.security.phi_guard import assert_no_phi, PhiBlocked

logger = logging.getLogger(__name__)

# Supported languages
SUPPORTED_LANGUAGES = {
    "es": "Spanish",
    "fr": "French",
    "de": "German",
    "pt": "Portuguese",
    "it": "Italian",
    "nl": "Dutch",
    "pl": "Polish",
    "ru": "Russian",
    "ja": "Japanese",
    "zh": "Chinese (Simplified)",
    "ko": "Korean",
    "ar": "Arabic",
}


def translate_with_deepl(text: str, target_lang: str) -> Optional[str]:
    """Translate text using DeepL API.

    Args:
        text: Text to translate
        target_lang: Target language code (e.g., 'es', 'fr')

    Returns:
        Translated text or None if API unavailable
    """
    api_key = os.getenv("DEEPL_API_KEY")
    if not api_key:
        logger.warning("DEEPL_API_KEY not configured")
        return None

    try:
        import httpx

        # DeepL API endpoint
        url = "https://api-free.deepl.com/v2/translate"
        if os.getenv("DEEPL_PRO"):
            url = "https://api.deepl.com/v2/translate"

        response = httpx.post(
            url,
            data={
                "auth_key": api_key,
                "text": text,
                "target_lang": target_lang.upper(),
            },
            timeout=30.0,
        )

        if response.status_code == 200:
            result = response.json()
            return result["translations"][0]["text"]
        else:
            logger.error(f"DeepL API error: {response.status_code}")
            return None

    except ImportError:
        logger.warning("httpx not installed, cannot use DeepL API")
        return None
    except Exception as e:
        logger.error(f"DeepL translation failed: {e}")
        return None


def translate_with_google(text: str, target_lang: str) -> Optional[str]:
    """Translate text using Google Translate API.

    Args:
        text: Text to translate
        target_lang: Target language code

    Returns:
        Translated text or None if API unavailable
    """
    api_key = os.getenv("GOOGLE_TRANSLATE_API_KEY")
    if not api_key:
        logger.warning("GOOGLE_TRANSLATE_API_KEY not configured")
        return None

    try:
        import httpx

        url = "https://translation.googleapis.com/language/translate/v2"
        response = httpx.post(
            url,
            params={"key": api_key},
            json={
                "q": text,
                "target": target_lang,
                "format": "text",
            },
            timeout=30.0,
        )

        if response.status_code == 200:
            result = response.json()
            return result["data"]["translations"][0]["translatedText"]
        else:
            logger.error(f"Google Translate API error: {response.status_code}")
            return None

    except ImportError:
        logger.warning("httpx not installed, cannot use Google Translate API")
        return None
    except Exception as e:
        logger.error(f"Google translation failed: {e}")
        return None


def translate(text: str, target_lang: str) -> Dict[str, Any]:
    """Translate text to target language.

    Tries DeepL first, then Google Translate.

    Args:
        text: Text to translate
        target_lang: Target language code

    Returns:
        Dict with translation result
    """
    # Validate language
    if target_lang not in SUPPORTED_LANGUAGES:
        return {
            "status": "FAILED",
            "error": f"Unsupported language: {target_lang}",
            "supportedLanguages": list(SUPPORTED_LANGUAGES.keys()),
        }

    # PHI scan
    try:
        assert_no_phi("translate_input", text)
    except PhiBlocked as e:
        return {
            "status": "BLOCKED",
            "error": "PHI_BLOCKED",
            "locations": [loc.__dict__ for loc in e.locations],
        }

    # Try translation providers
    translated = None
    provider = None

    # Try DeepL first
    translated = translate_with_deepl(text, target_lang)
    if translated:
        provider = "deepl"

    # Fall back to Google
    if not translated:
        translated = translate_with_google(text, target_lang)
        if translated:
            provider = "google"

    # If no provider available
    if not translated:
        return {
            "status": "SKIPPED",
            "reason": "No translation provider configured",
            "hint": "Set DEEPL_API_KEY or GOOGLE_TRANSLATE_API_KEY",
        }

    # PHI scan output (in case translation introduced PHI-like patterns)
    try:
        assert_no_phi("translate_output", translated)
    except PhiBlocked:
        return {
            "status": "BLOCKED",
            "error": "PHI detected in translation output",
        }

    return {
        "status": "SUCCEEDED",
        "translatedText": translated,
        "targetLanguage": target_lang,
        "targetLanguageName": SUPPORTED_LANGUAGES[target_lang],
        "provider": provider,
    }


def run_translation_job(
    job_id: str,
    manuscript_id: str,
    section_key: str,
    text: str,
    target_lang: str,
) -> Dict[str, Any]:
    """Run translation as a job.

    Args:
        job_id: Job identifier
        manuscript_id: Manuscript identifier
        section_key: Section being translated
        text: Text to translate
        target_lang: Target language code

    Returns:
        Job result
    """
    result = translate(text, target_lang)

    return {
        "jobId": job_id,
        "manuscriptId": manuscript_id,
        "sectionKey": section_key,
        **result,
    }


def list_supported_languages() -> Dict[str, str]:
    """Get list of supported languages."""
    return SUPPORTED_LANGUAGES.copy()
