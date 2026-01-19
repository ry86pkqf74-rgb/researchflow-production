"""
Whisper Transcription Stub

Placeholder for future Whisper integration.
Currently returns mock transcription for development.
"""

from __future__ import annotations

import logging
import os
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional

from src.governance.output_phi_guard import guard_text

logger = logging.getLogger(__name__)

# Feature flag for Whisper
ENABLE_WHISPER = os.getenv('ENABLE_WHISPER', '0') == '1'
WHISPER_MODEL = os.getenv('WHISPER_MODEL', 'base')


@dataclass
class TranscriptionSegment:
    """A segment of transcribed audio"""
    start: float  # seconds
    end: float  # seconds
    text: str
    confidence: Optional[float] = None


@dataclass
class TranscriptionResult:
    """Transcription result"""
    success: bool
    text: Optional[str] = None
    segments: List[TranscriptionSegment] = field(default_factory=list)
    language: Optional[str] = None
    duration: Optional[float] = None
    error: Optional[str] = None


def transcribe_audio(
    audio_path: str,
    language: Optional[str] = None,
    fail_closed: bool = True,
    return_segments: bool = False
) -> TranscriptionResult:
    """
    Transcribe audio file using Whisper.

    NOTE: This is a stub implementation. Real Whisper integration
    requires the openai-whisper package and appropriate hardware.

    Args:
        audio_path: Path to audio file (wav, mp3, m4a, etc.)
        language: Optional language code (auto-detected if not provided)
        fail_closed: If True, redact content with PHI
        return_segments: If True, return timestamped segments

    Returns:
        TranscriptionResult with transcribed text
    """
    if not ENABLE_WHISPER:
        return TranscriptionResult(
            success=False,
            error="Whisper transcription is not enabled. Set ENABLE_WHISPER=1 to enable."
        )

    if not os.path.exists(audio_path):
        return TranscriptionResult(
            success=False,
            error=f"Audio file not found: {audio_path}"
        )

    try:
        # Check for whisper import
        import whisper

        logger.info(f"Loading Whisper model: {WHISPER_MODEL}")
        model = whisper.load_model(WHISPER_MODEL)

        # Transcribe
        options = {}
        if language:
            options['language'] = language

        result = model.transcribe(audio_path, **options)

        text = result.get('text', '')
        detected_language = result.get('language', 'en')

        # PHI guard
        if fail_closed and text:
            text, findings = guard_text(text, fail_closed=True)
            if findings:
                logger.warning("PHI detected in transcription, redacting")

        # Build segments if requested
        segments = []
        if return_segments and 'segments' in result:
            for seg in result['segments']:
                segment_text = seg.get('text', '')
                if fail_closed:
                    segment_text, _ = guard_text(segment_text, fail_closed=True)

                segments.append(TranscriptionSegment(
                    start=seg.get('start', 0),
                    end=seg.get('end', 0),
                    text=segment_text
                ))

        # Calculate duration from segments
        duration = None
        if segments:
            duration = max(s.end for s in segments)

        return TranscriptionResult(
            success=True,
            text=text,
            segments=segments if return_segments else [],
            language=detected_language,
            duration=duration
        )

    except ImportError:
        logger.warning("Whisper not installed, returning stub response")
        return TranscriptionResult(
            success=False,
            error="Whisper library not installed. Install with: pip install openai-whisper"
        )

    except Exception as e:
        logger.exception(f"Transcription failed: {e}")
        return TranscriptionResult(
            success=False,
            error=str(e)
        )


def transcribe_video(
    video_path: str,
    language: Optional[str] = None,
    fail_closed: bool = True
) -> TranscriptionResult:
    """
    Extract and transcribe audio from video file.

    Args:
        video_path: Path to video file
        language: Optional language code
        fail_closed: If True, redact content with PHI

    Returns:
        TranscriptionResult with transcribed audio
    """
    if not ENABLE_WHISPER:
        return TranscriptionResult(
            success=False,
            error="Whisper transcription is not enabled"
        )

    try:
        import tempfile
        import subprocess

        # Extract audio using ffmpeg
        with tempfile.NamedTemporaryFile(suffix='.wav', delete=False) as tmp:
            tmp_path = tmp.name

        cmd = [
            'ffmpeg', '-i', video_path,
            '-vn', '-acodec', 'pcm_s16le',
            '-ar', '16000', '-ac', '1',
            '-y', tmp_path
        ]

        subprocess.run(cmd, capture_output=True, check=True)

        # Transcribe extracted audio
        result = transcribe_audio(tmp_path, language, fail_closed)

        # Cleanup
        os.unlink(tmp_path)

        return result

    except subprocess.CalledProcessError:
        return TranscriptionResult(
            success=False,
            error="Failed to extract audio from video. Is ffmpeg installed?"
        )
    except Exception as e:
        logger.exception(f"Video transcription failed: {e}")
        return TranscriptionResult(
            success=False,
            error=str(e)
        )
