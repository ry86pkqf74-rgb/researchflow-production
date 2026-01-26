"""
Audio Transcription with Whisper

Transcribes audio files using faster-whisper.
"""

from __future__ import annotations

import logging
import os
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Dict, List, Optional, Union

logger = logging.getLogger(__name__)

# Feature flags
TRANSCRIPTION_ENABLED = os.getenv("TRANSCRIPTION_ENABLED", "false").lower() == "true"
WHISPER_MODEL = os.getenv("WHISPER_MODEL", "small")


@dataclass
class TranscriptSegment:
    """A segment of transcribed audio."""
    id: int
    start: float  # Start time in seconds
    end: float  # End time in seconds
    text: str
    confidence: Optional[float] = None
    words: Optional[List[Dict[str, Any]]] = None


@dataclass
class TranscriptionResult:
    """Result of audio transcription."""
    success: bool
    text: str = ""
    segments: List[TranscriptSegment] = field(default_factory=list)
    language: Optional[str] = None
    language_confidence: Optional[float] = None
    duration: Optional[float] = None
    model: str = ""
    errors: List[str] = field(default_factory=list)
    warnings: List[str] = field(default_factory=list)


@dataclass
class TranscriptionConfig:
    """Configuration for audio transcription."""
    model: str = "small"  # tiny, base, small, medium, large-v2, large-v3
    language: Optional[str] = None  # Auto-detect if None
    task: str = "transcribe"  # transcribe or translate
    beam_size: int = 5
    vad_filter: bool = True  # Voice activity detection
    word_timestamps: bool = False
    compute_type: str = "float16"  # float16, int8, int8_float16


class AudioTranscriber:
    """
    Audio transcriber using faster-whisper.

    Supports:
    - MP3, WAV, FLAC, M4A, OGG audio formats
    - Automatic language detection
    - Word-level timestamps
    - Translation to English
    """

    def __init__(self, config: Optional[TranscriptionConfig] = None):
        self.config = config or TranscriptionConfig(model=WHISPER_MODEL)
        self._model = None
        self._available = None

    def is_available(self) -> bool:
        """Check if transcription is available."""
        if self._available is not None:
            return self._available

        if not TRANSCRIPTION_ENABLED:
            self._available = False
            return False

        try:
            from faster_whisper import WhisperModel
            self._available = True
        except ImportError:
            self._available = False

        return self._available

    def _load_model(self):
        """Lazy load the Whisper model."""
        if self._model is not None:
            return self._model

        if not self.is_available():
            raise RuntimeError("Transcription is not available")

        from faster_whisper import WhisperModel

        logger.info(f"Loading Whisper model: {self.config.model}")

        # Determine device
        device = "cpu"
        compute_type = self.config.compute_type

        try:
            import torch
            if torch.cuda.is_available():
                device = "cuda"
            elif hasattr(torch.backends, "mps") and torch.backends.mps.is_available():
                device = "mps"
                compute_type = "float32"  # MPS doesn't support float16 well
        except ImportError:
            pass

        self._model = WhisperModel(
            self.config.model,
            device=device,
            compute_type=compute_type,
        )

        logger.info(f"Whisper model loaded on {device}")
        return self._model

    def transcribe(
        self,
        audio_path: Union[str, Path],
        config: Optional[TranscriptionConfig] = None,
    ) -> TranscriptionResult:
        """
        Transcribe an audio file.

        Args:
            audio_path: Path to the audio file
            config: Transcription configuration

        Returns:
            TranscriptionResult with transcript
        """
        if not self.is_available():
            return TranscriptionResult(
                success=False,
                model=self.config.model,
                errors=["Transcription is not available. Set TRANSCRIPTION_ENABLED=true and install faster-whisper."],
            )

        cfg = config or self.config
        path = Path(audio_path)

        if not path.exists():
            return TranscriptionResult(
                success=False,
                model=cfg.model,
                errors=[f"File not found: {audio_path}"],
            )

        # Check file format
        supported_formats = {".mp3", ".wav", ".flac", ".m4a", ".ogg", ".webm", ".mp4"}
        if path.suffix.lower() not in supported_formats:
            return TranscriptionResult(
                success=False,
                model=cfg.model,
                errors=[f"Unsupported audio format: {path.suffix}"],
            )

        try:
            model = self._load_model()

            # Transcribe
            segments_gen, info = model.transcribe(
                str(path),
                language=cfg.language,
                task=cfg.task,
                beam_size=cfg.beam_size,
                vad_filter=cfg.vad_filter,
                word_timestamps=cfg.word_timestamps,
            )

            # Collect segments
            segments = []
            all_text = []

            for seg in segments_gen:
                segment = TranscriptSegment(
                    id=seg.id,
                    start=seg.start,
                    end=seg.end,
                    text=seg.text.strip(),
                    confidence=seg.avg_logprob if hasattr(seg, "avg_logprob") else None,
                )

                # Add word-level timestamps if available
                if cfg.word_timestamps and hasattr(seg, "words") and seg.words:
                    segment.words = [
                        {
                            "word": w.word,
                            "start": w.start,
                            "end": w.end,
                            "probability": w.probability,
                        }
                        for w in seg.words
                    ]

                segments.append(segment)
                all_text.append(seg.text.strip())

            return TranscriptionResult(
                success=True,
                text=" ".join(all_text),
                segments=segments,
                language=info.language,
                language_confidence=info.language_probability,
                duration=info.duration,
                model=cfg.model,
            )

        except Exception as e:
            logger.exception(f"Transcription error: {e}")
            return TranscriptionResult(
                success=False,
                model=cfg.model,
                errors=[str(e)],
            )

    def transcribe_to_srt(
        self,
        audio_path: Union[str, Path],
        output_path: Optional[Union[str, Path]] = None,
        config: Optional[TranscriptionConfig] = None,
    ) -> str:
        """
        Transcribe audio and return SRT subtitle format.

        Args:
            audio_path: Path to the audio file
            output_path: Optional path to save SRT file
            config: Transcription configuration

        Returns:
            SRT formatted string
        """
        result = self.transcribe(audio_path, config)

        if not result.success:
            return ""

        srt_lines = []
        for seg in result.segments:
            start_srt = self._seconds_to_srt_time(seg.start)
            end_srt = self._seconds_to_srt_time(seg.end)

            srt_lines.append(str(seg.id + 1))
            srt_lines.append(f"{start_srt} --> {end_srt}")
            srt_lines.append(seg.text)
            srt_lines.append("")

        srt_content = "\n".join(srt_lines)

        if output_path:
            Path(output_path).write_text(srt_content)

        return srt_content

    def _seconds_to_srt_time(self, seconds: float) -> str:
        """Convert seconds to SRT timestamp format."""
        hours = int(seconds // 3600)
        minutes = int((seconds % 3600) // 60)
        secs = int(seconds % 60)
        millis = int((seconds % 1) * 1000)
        return f"{hours:02d}:{minutes:02d}:{secs:02d},{millis:03d}"


def transcribe_audio(
    audio_path: Union[str, Path],
    language: Optional[str] = None,
    model: Optional[str] = None,
) -> TranscriptionResult:
    """
    Transcribe an audio file.

    Args:
        audio_path: Path to the audio file
        language: Language code (auto-detect if None)
        model: Whisper model size

    Returns:
        TranscriptionResult with transcript
    """
    config = TranscriptionConfig(
        model=model or WHISPER_MODEL,
        language=language,
    )
    transcriber = AudioTranscriber(config)
    return transcriber.transcribe(audio_path, config)


def is_transcription_available() -> bool:
    """Check if transcription is available."""
    transcriber = AudioTranscriber()
    return transcriber.is_available()


def get_supported_audio_formats() -> List[str]:
    """Get list of supported audio formats."""
    return ["mp3", "wav", "flac", "m4a", "ogg", "webm", "mp4"]
