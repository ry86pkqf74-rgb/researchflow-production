"""
Translation Service

Translates text between languages (stub for future integration).
"""

from __future__ import annotations

import logging
import os
from dataclasses import dataclass
from typing import Optional

from src.governance.output_phi_guard import guard_text

logger = logging.getLogger(__name__)

# Configuration
ENABLE_TRANSLATION = os.getenv('ENABLE_TRANSLATION', '0') == '1'
TRANSLATION_SERVICE = os.getenv('TRANSLATION_SERVICE', 'none')  # 'google', 'deepl', 'ai_router'


@dataclass
class TranslationResult:
    """Translation result"""
    success: bool
    translated_text: Optional[str] = None
    source_language: Optional[str] = None
    target_language: Optional[str] = None
    confidence: float = 0.0
    service_used: Optional[str] = None
    error: Optional[str] = None


def translate_text(
    text: str,
    target_language: str = 'en',
    source_language: Optional[str] = None,
    fail_closed: bool = True
) -> TranslationResult:
    """
    Translate text to target language.

    NOTE: This is a stub implementation. Production use requires
    configuring a translation service.

    Args:
        text: Text to translate
        target_language: Target language code
        source_language: Source language code (auto-detected if not provided)
        fail_closed: If True, guard output for PHI

    Returns:
        TranslationResult with translated text
    """
    if not text or not text.strip():
        return TranslationResult(
            success=False,
            error="Empty text provided"
        )

    if not ENABLE_TRANSLATION:
        return TranslationResult(
            success=False,
            error="Translation is not enabled. Set ENABLE_TRANSLATION=1"
        )

    # Detect source language if not provided
    if not source_language:
        from .language_detector import detect_language
        detection = detect_language(text)
        source_language = detection.language or 'auto'

    # If source and target are the same, return original
    if source_language == target_language:
        return TranslationResult(
            success=True,
            translated_text=text,
            source_language=source_language,
            target_language=target_language,
            confidence=1.0,
            service_used='passthrough'
        )

    # Try different translation services
    result = None

    if TRANSLATION_SERVICE == 'google':
        result = _translate_google(text, source_language, target_language)
    elif TRANSLATION_SERVICE == 'deepl':
        result = _translate_deepl(text, source_language, target_language)
    elif TRANSLATION_SERVICE == 'ai_router':
        result = _translate_ai_router(text, source_language, target_language)
    else:
        return TranslationResult(
            success=False,
            error=f"Unknown translation service: {TRANSLATION_SERVICE}"
        )

    # PHI guard the result
    if result.success and result.translated_text and fail_closed:
        guarded, findings = guard_text(result.translated_text, fail_closed=True)
        if findings:
            logger.warning("PHI detected in translation, redacting")
            result.translated_text = guarded

    return result


def _translate_google(
    text: str,
    source: str,
    target: str
) -> TranslationResult:
    """Translate using Google Translate API"""
    try:
        from google.cloud import translate_v2 as translate

        client = translate.Client()

        result = client.translate(
            text,
            target_language=target,
            source_language=source if source != 'auto' else None
        )

        return TranslationResult(
            success=True,
            translated_text=result['translatedText'],
            source_language=result.get('detectedSourceLanguage', source),
            target_language=target,
            confidence=0.9,
            service_used='google'
        )

    except ImportError:
        return TranslationResult(
            success=False,
            error="google-cloud-translate not installed"
        )
    except Exception as e:
        logger.warning(f"Google Translate failed: {e}")
        return TranslationResult(
            success=False,
            error=str(e)
        )


def _translate_deepl(
    text: str,
    source: str,
    target: str
) -> TranslationResult:
    """Translate using DeepL API"""
    api_key = os.getenv('DEEPL_API_KEY', '')

    if not api_key:
        return TranslationResult(
            success=False,
            error="DEEPL_API_KEY not configured"
        )

    try:
        import deepl

        translator = deepl.Translator(api_key)

        result = translator.translate_text(
            text,
            target_lang=target.upper(),
            source_lang=source.upper() if source != 'auto' else None
        )

        return TranslationResult(
            success=True,
            translated_text=result.text,
            source_language=result.detected_source_lang.lower(),
            target_language=target,
            confidence=0.95,
            service_used='deepl'
        )

    except ImportError:
        return TranslationResult(
            success=False,
            error="deepl library not installed"
        )
    except Exception as e:
        logger.warning(f"DeepL translation failed: {e}")
        return TranslationResult(
            success=False,
            error=str(e)
        )


def _translate_ai_router(
    text: str,
    source: str,
    target: str
) -> TranslationResult:
    """Translate using AI router (Claude/GPT)"""
    try:
        import httpx

        ai_router_url = os.getenv('AI_ROUTER_URL', 'http://localhost:3001')

        prompt = f"""Translate the following text from {source} to {target}.
Return only the translation, no explanations.

Text to translate:
{text}"""

        response = httpx.post(
            f"{ai_router_url}/api/ai/complete",
            json={
                'prompt': prompt,
                'model': 'fast',
                'max_tokens': len(text) * 2
            },
            timeout=30
        )

        if response.status_code != 200:
            return TranslationResult(
                success=False,
                error=f"AI router error: {response.status_code}"
            )

        data = response.json()
        translated = data.get('text', '').strip()

        return TranslationResult(
            success=True,
            translated_text=translated,
            source_language=source,
            target_language=target,
            confidence=0.85,
            service_used='ai_router'
        )

    except Exception as e:
        logger.warning(f"AI router translation failed: {e}")
        return TranslationResult(
            success=False,
            error=str(e)
        )


def translate_batch(
    texts: list,
    target_language: str = 'en',
    source_language: Optional[str] = None
) -> list:
    """
    Translate multiple texts.

    Args:
        texts: List of texts to translate
        target_language: Target language code
        source_language: Source language code

    Returns:
        List of TranslationResult objects
    """
    return [
        translate_text(text, target_language, source_language)
        for text in texts
    ]
