"""
AI Feedback Configuration (Phase 9)

Centralized configuration for the AI feedback and self-improvement loop.

Configuration is loaded from environment variables with sensible defaults.

SAFETY INVARIANTS:
- API keys never logged or exposed
- Feature flags default to safe (disabled) state

Last Updated: 2026-01-23
"""

from __future__ import annotations

import os
from dataclasses import dataclass, field
from typing import List, Optional


def _parse_bool(value: Optional[str], default: bool) -> bool:
    """Parse boolean from environment variable."""
    if not value:
        return default
    return value.lower() in ('true', '1', 'yes')


def _parse_int(value: Optional[str], default: int) -> int:
    """Parse integer from environment variable."""
    if not value:
        return default
    try:
        return int(value)
    except ValueError:
        return default


def _parse_float(value: Optional[str], default: float) -> float:
    """Parse float from environment variable."""
    if not value:
        return default
    try:
        return float(value)
    except ValueError:
        return default


@dataclass(frozen=True)
class AutoRefineConfig:
    """Configuration for auto-refinement loop.
    
    Attributes:
        enabled: Enable the auto-refinement loop
        max_attempts: Maximum refinement attempts per request
        escalation_threshold: Attempts before recommending tier escalation
        strict_mode: Treat warnings as errors in quality checks
        min_score_threshold: Minimum score threshold to pass quality gate
    """
    enabled: bool = False
    max_attempts: int = 3
    escalation_threshold: int = 2
    strict_mode: bool = False
    min_score_threshold: float = 0.7
    
    @classmethod
    def from_env(cls) -> "AutoRefineConfig":
        """Load configuration from environment variables."""
        return cls(
            enabled=_parse_bool(os.getenv("AUTO_REFINE_ENABLED"), False),
            max_attempts=_parse_int(os.getenv("MAX_REFINE_ATTEMPTS"), 3),
            escalation_threshold=_parse_int(os.getenv("REFINEMENT_ESCALATION_THRESHOLD"), 2),
            strict_mode=_parse_bool(os.getenv("QUALITY_CHECK_STRICT_MODE"), False),
            min_score_threshold=_parse_float(os.getenv("MIN_QUALITY_SCORE_THRESHOLD"), 0.7),
        )


@dataclass(frozen=True)
class QualityGateConfig:
    """Configuration for quality gate.
    
    Attributes:
        enabled: Enable quality gate validation
        escalation_enabled: Enable tier escalation on quality failure
        max_escalations: Maximum escalations per request
        narrative_task_types: Task types requiring narrative checks
        default_min_citations: Default minimum citations for narratives
        default_min_words: Default minimum word count
        default_max_words: Default maximum word count
    """
    enabled: bool = True
    escalation_enabled: bool = True
    max_escalations: int = 2
    narrative_task_types: List[str] = field(default_factory=lambda: [
        "draft_section", "abstract_generate", "complex_synthesis"
    ])
    default_min_citations: int = 3
    default_min_words: int = 100
    default_max_words: int = 2000
    
    @classmethod
    def from_env(cls) -> "QualityGateConfig":
        """Load configuration from environment variables."""
        task_types_str = os.getenv("NARRATIVE_TASK_TYPES", "draft_section,abstract_generate,complex_synthesis")
        narrative_task_types = [t.strip() for t in task_types_str.split(",")]
        
        return cls(
            enabled=_parse_bool(os.getenv("QUALITY_GATE_ENABLED"), True),
            escalation_enabled=_parse_bool(os.getenv("ESCALATION_ENABLED"), True),
            max_escalations=_parse_int(os.getenv("MAX_ESCALATIONS"), 2),
            narrative_task_types=narrative_task_types,
            default_min_citations=_parse_int(os.getenv("DEFAULT_MIN_CITATIONS"), 3),
            default_min_words=_parse_int(os.getenv("DEFAULT_MIN_WORDS"), 100),
            default_max_words=_parse_int(os.getenv("DEFAULT_MAX_WORDS"), 2000),
        )


@dataclass(frozen=True)
class AIFeedbackConfig:
    """Complete AI feedback configuration.
    
    Attributes:
        auto_refine: Auto-refinement settings
        quality_gate: Quality gate settings
        environment: Environment name
        debug_logging: Enable detailed logging
    """
    auto_refine: AutoRefineConfig = field(default_factory=AutoRefineConfig)
    quality_gate: QualityGateConfig = field(default_factory=QualityGateConfig)
    environment: str = "development"
    debug_logging: bool = False
    
    @classmethod
    def from_env(cls) -> "AIFeedbackConfig":
        """Load configuration from environment variables."""
        return cls(
            auto_refine=AutoRefineConfig.from_env(),
            quality_gate=QualityGateConfig.from_env(),
            environment=os.getenv("ENVIRONMENT", "development"),
            debug_logging=_parse_bool(os.getenv("AI_DEBUG_LOGGING"), False),
        )
    
    def validate(self) -> tuple[bool, List[str]]:
        """Validate configuration.
        
        Returns:
            Tuple of (is_valid, error_messages)
        """
        errors: List[str] = []
        
        # Validate refinement settings
        if self.auto_refine.max_attempts < 1:
            errors.append("MAX_REFINE_ATTEMPTS must be at least 1")
        if self.auto_refine.escalation_threshold < 1:
            errors.append("REFINEMENT_ESCALATION_THRESHOLD must be at least 1")
        if self.auto_refine.escalation_threshold > self.auto_refine.max_attempts:
            errors.append("REFINEMENT_ESCALATION_THRESHOLD cannot exceed MAX_REFINE_ATTEMPTS")
        
        # Validate quality gate settings
        if self.quality_gate.max_escalations < 0:
            errors.append("MAX_ESCALATIONS cannot be negative")
        if not (0 <= self.auto_refine.min_score_threshold <= 1):
            errors.append("MIN_QUALITY_SCORE_THRESHOLD must be between 0 and 1")
        
        # Validate word bounds
        if self.quality_gate.default_min_words > self.quality_gate.default_max_words:
            errors.append("DEFAULT_MIN_WORDS cannot exceed DEFAULT_MAX_WORDS")
        
        return len(errors) == 0, errors
    
    def is_narrative_task(self, task_type: str) -> bool:
        """Check if a task type requires narrative quality checks."""
        return task_type in self.quality_gate.narrative_task_types
    
    def get_quality_check_options(self, task_type: str) -> dict:
        """Get effective quality check options for a task."""
        is_narrative = self.is_narrative_task(task_type)
        
        return {
            "min_citations": self.quality_gate.default_min_citations if is_narrative else 0,
            "min_words": self.quality_gate.default_min_words if is_narrative else 10,
            "max_words": self.quality_gate.default_max_words if is_narrative else 50000,
            "check_placeholders": True,
            "strict_mode": self.auto_refine.strict_mode,
        }
    
    def to_summary(self) -> dict:
        """Get configuration summary for logging (no secrets)."""
        return {
            "environment": self.environment,
            "debug_logging": self.debug_logging,
            "auto_refine": {
                "enabled": self.auto_refine.enabled,
                "max_attempts": self.auto_refine.max_attempts,
                "escalation_threshold": self.auto_refine.escalation_threshold,
                "strict_mode": self.auto_refine.strict_mode,
            },
            "quality_gate": {
                "enabled": self.quality_gate.enabled,
                "escalation_enabled": self.quality_gate.escalation_enabled,
                "max_escalations": self.quality_gate.max_escalations,
            },
        }


# =============================================================================
# Singleton Configuration
# =============================================================================

_config: Optional[AIFeedbackConfig] = None


def get_ai_feedback_config() -> AIFeedbackConfig:
    """Get the singleton AI feedback configuration.
    
    Returns:
        AIFeedbackConfig loaded from environment.
    """
    global _config
    if _config is None:
        _config = AIFeedbackConfig.from_env()
    return _config


def reset_config() -> None:
    """Reset the configuration singleton (for testing)."""
    global _config
    _config = None


def is_auto_refine_enabled() -> bool:
    """Check if auto-refinement is enabled."""
    return get_ai_feedback_config().auto_refine.enabled


def is_narrative_task(task_type: str) -> bool:
    """Check if a task type requires narrative quality checks."""
    return get_ai_feedback_config().is_narrative_task(task_type)


def get_quality_check_options(task_type: str) -> dict:
    """Get effective quality check options for a task."""
    return get_ai_feedback_config().get_quality_check_options(task_type)
