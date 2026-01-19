"""
Uncertainty Scoring Service - Task 191

Calculates field-level uncertainty scores using multiple methods:
- Rules-based confidence
- Self-consistency (multiple samples)
- Ensemble agreement
- Model log probabilities
"""

import logging
import math
from dataclasses import dataclass
from enum import Enum
from typing import Any, Callable, Dict, List, Optional, Union

import numpy as np

logger = logging.getLogger(__name__)


class UncertaintyMethod(str, Enum):
    """Methods for calculating uncertainty"""
    RULES_CONFIDENCE = "rules_confidence"
    SELF_CONSISTENCY = "self_consistency"
    ENSEMBLE = "ensemble"
    MODEL_LOGPROB = "model_logprob"
    HUMAN_REVIEW = "human_review"
    COMBINED = "combined"


@dataclass
class UncertaintyScore:
    """Uncertainty score for a field"""
    score: float  # 0 = certain, 1 = completely uncertain
    method: UncertaintyMethod
    confidence_interval: Optional[Dict[str, float]] = None
    sample_count: Optional[int] = None
    models: Optional[List[str]] = None
    metadata: Optional[Dict[str, Any]] = None

    @property
    def confidence(self) -> float:
        """Confidence = 1 - uncertainty"""
        return 1.0 - self.score


@dataclass
class UncertaintyConfig:
    """Configuration for uncertainty scoring"""
    default_method: UncertaintyMethod = UncertaintyMethod.RULES_CONFIDENCE
    num_samples: int = 5  # For self-consistency
    confidence_level: float = 0.95  # For confidence intervals
    ensemble_models: List[str] = None
    weight_rules: float = 0.3
    weight_consistency: float = 0.4
    weight_ensemble: float = 0.3
    high_uncertainty_threshold: float = 0.5

    def __post_init__(self):
        if self.ensemble_models is None:
            self.ensemble_models = []


class UncertaintyScoringService:
    """Service for calculating uncertainty scores"""

    def __init__(self, config: Optional[UncertaintyConfig] = None):
        self.config = config or UncertaintyConfig()

    def score_from_rules(
        self,
        field_value: Any,
        validation_result: Dict[str, Any],
    ) -> UncertaintyScore:
        """
        Calculate uncertainty based on validation rules.

        Args:
            field_value: The extracted field value
            validation_result: Result from validation rules including
                              'passed', 'warnings', 'confidence'
        """
        # Base confidence from validation
        base_confidence = validation_result.get("confidence", 0.5)

        # Penalize for warnings
        warnings = validation_result.get("warnings", [])
        warning_penalty = len(warnings) * 0.1

        # Penalize for validation failures
        if not validation_result.get("passed", True):
            base_confidence *= 0.5

        # Check for empty or null values
        if field_value is None or (isinstance(field_value, str) and not field_value.strip()):
            base_confidence *= 0.3

        final_confidence = max(0.0, min(1.0, base_confidence - warning_penalty))

        return UncertaintyScore(
            score=1.0 - final_confidence,
            method=UncertaintyMethod.RULES_CONFIDENCE,
            metadata={
                "validation_passed": validation_result.get("passed"),
                "warnings_count": len(warnings),
            },
        )

    def score_from_self_consistency(
        self,
        samples: List[Any],
        similarity_fn: Optional[Callable[[Any, Any], float]] = None,
    ) -> UncertaintyScore:
        """
        Calculate uncertainty from multiple extraction samples.
        Higher agreement = lower uncertainty.

        Args:
            samples: List of extraction results for same field
            similarity_fn: Optional function to compare two samples
        """
        if len(samples) < 2:
            return UncertaintyScore(
                score=0.5,  # High uncertainty with single sample
                method=UncertaintyMethod.SELF_CONSISTENCY,
                sample_count=len(samples),
            )

        if similarity_fn is None:
            similarity_fn = self._default_similarity

        # Calculate pairwise similarities
        similarities = []
        n = len(samples)
        for i in range(n):
            for j in range(i + 1, n):
                sim = similarity_fn(samples[i], samples[j])
                similarities.append(sim)

        if not similarities:
            return UncertaintyScore(
                score=0.5,
                method=UncertaintyMethod.SELF_CONSISTENCY,
                sample_count=len(samples),
            )

        mean_similarity = np.mean(similarities)
        std_similarity = np.std(similarities)

        # Convert similarity to uncertainty
        # High similarity (1.0) -> low uncertainty (0.0)
        uncertainty = 1.0 - mean_similarity

        # Calculate confidence interval
        if len(similarities) > 1:
            z = 1.96 if self.config.confidence_level == 0.95 else 2.576
            margin = z * std_similarity / math.sqrt(len(similarities))
            ci = {
                "lower": max(0, uncertainty - margin),
                "upper": min(1, uncertainty + margin),
                "level": self.config.confidence_level,
            }
        else:
            ci = None

        return UncertaintyScore(
            score=uncertainty,
            method=UncertaintyMethod.SELF_CONSISTENCY,
            sample_count=len(samples),
            confidence_interval=ci,
            metadata={
                "mean_similarity": mean_similarity,
                "std_similarity": std_similarity,
            },
        )

    def score_from_ensemble(
        self,
        predictions: Dict[str, Any],
    ) -> UncertaintyScore:
        """
        Calculate uncertainty from ensemble model predictions.

        Args:
            predictions: Dict mapping model name to prediction
        """
        if len(predictions) < 2:
            return UncertaintyScore(
                score=0.5,
                method=UncertaintyMethod.ENSEMBLE,
                models=list(predictions.keys()),
            )

        values = list(predictions.values())
        model_names = list(predictions.keys())

        # Calculate pairwise agreement
        agreements = []
        for i in range(len(values)):
            for j in range(i + 1, len(values)):
                agreement = self._default_similarity(values[i], values[j])
                agreements.append(agreement)

        mean_agreement = np.mean(agreements) if agreements else 0.5

        # Higher agreement = lower uncertainty
        uncertainty = 1.0 - mean_agreement

        return UncertaintyScore(
            score=uncertainty,
            method=UncertaintyMethod.ENSEMBLE,
            models=model_names,
            metadata={
                "num_models": len(predictions),
                "mean_agreement": mean_agreement,
            },
        )

    def score_from_logprob(
        self,
        log_probs: List[float],
        tokens: Optional[List[str]] = None,
    ) -> UncertaintyScore:
        """
        Calculate uncertainty from model log probabilities.
        Lower log probs = higher uncertainty.

        Args:
            log_probs: List of log probabilities for each token
            tokens: Optional list of tokens
        """
        if not log_probs:
            return UncertaintyScore(
                score=0.5,
                method=UncertaintyMethod.MODEL_LOGPROB,
            )

        # Convert log probs to probabilities
        probs = [math.exp(lp) for lp in log_probs]

        # Calculate entropy as uncertainty measure
        # Normalize probabilities
        total = sum(probs)
        if total > 0:
            probs = [p / total for p in probs]

        # Calculate average probability (higher = more confident)
        mean_prob = np.mean(probs)

        # Use 1 - mean_prob as uncertainty
        # Also consider variance in probabilities
        var_prob = np.var(probs) if len(probs) > 1 else 0

        # Combine mean and variance
        uncertainty = (1.0 - mean_prob) * 0.7 + min(var_prob * 2, 0.3)
        uncertainty = max(0.0, min(1.0, uncertainty))

        return UncertaintyScore(
            score=uncertainty,
            method=UncertaintyMethod.MODEL_LOGPROB,
            metadata={
                "mean_prob": mean_prob,
                "var_prob": var_prob,
                "num_tokens": len(log_probs),
            },
        )

    def combined_score(
        self,
        rules_score: Optional[UncertaintyScore] = None,
        consistency_score: Optional[UncertaintyScore] = None,
        ensemble_score: Optional[UncertaintyScore] = None,
    ) -> UncertaintyScore:
        """Combine multiple uncertainty scores with configurable weights"""
        scores = []
        weights = []

        if rules_score:
            scores.append(rules_score.score)
            weights.append(self.config.weight_rules)

        if consistency_score:
            scores.append(consistency_score.score)
            weights.append(self.config.weight_consistency)

        if ensemble_score:
            scores.append(ensemble_score.score)
            weights.append(self.config.weight_ensemble)

        if not scores:
            return UncertaintyScore(score=0.5, method=UncertaintyMethod.COMBINED)

        # Normalize weights
        total_weight = sum(weights)
        weights = [w / total_weight for w in weights]

        # Weighted average
        combined = sum(s * w for s, w in zip(scores, weights))

        return UncertaintyScore(
            score=combined,
            method=UncertaintyMethod.COMBINED,
            metadata={
                "components": {
                    "rules": rules_score.score if rules_score else None,
                    "consistency": consistency_score.score if consistency_score else None,
                    "ensemble": ensemble_score.score if ensemble_score else None,
                },
                "weights": {
                    "rules": self.config.weight_rules if rules_score else 0,
                    "consistency": self.config.weight_consistency if consistency_score else 0,
                    "ensemble": self.config.weight_ensemble if ensemble_score else 0,
                },
            },
        )

    def _default_similarity(self, a: Any, b: Any) -> float:
        """Default similarity function"""
        if a == b:
            return 1.0

        if isinstance(a, str) and isinstance(b, str):
            # Simple string similarity (Jaccard on words)
            words_a = set(a.lower().split())
            words_b = set(b.lower().split())
            if not words_a or not words_b:
                return 0.0
            intersection = len(words_a & words_b)
            union = len(words_a | words_b)
            return intersection / union if union > 0 else 0.0

        if isinstance(a, (int, float)) and isinstance(b, (int, float)):
            # Numeric similarity
            diff = abs(a - b)
            max_val = max(abs(a), abs(b), 1)
            return max(0, 1 - diff / max_val)

        # Default: binary comparison
        return 1.0 if a == b else 0.0

    def is_high_uncertainty(self, score: UncertaintyScore) -> bool:
        """Check if uncertainty exceeds threshold"""
        return score.score > self.config.high_uncertainty_threshold


# Global service instance
_uncertainty_service: Optional[UncertaintyScoringService] = None


def get_uncertainty_service(
    config: Optional[UncertaintyConfig] = None,
) -> UncertaintyScoringService:
    """Get or create the global uncertainty service"""
    global _uncertainty_service
    if _uncertainty_service is None:
        _uncertainty_service = UncertaintyScoringService(config)
    return _uncertainty_service


def calculate_uncertainty(
    field_value: Any,
    validation_result: Optional[Dict[str, Any]] = None,
    samples: Optional[List[Any]] = None,
    ensemble_predictions: Optional[Dict[str, Any]] = None,
) -> UncertaintyScore:
    """
    Convenience function to calculate uncertainty.
    Uses all available inputs.
    """
    service = get_uncertainty_service()

    rules_score = None
    consistency_score = None
    ensemble_score = None

    if validation_result:
        rules_score = service.score_from_rules(field_value, validation_result)

    if samples and len(samples) > 1:
        consistency_score = service.score_from_self_consistency(samples)

    if ensemble_predictions and len(ensemble_predictions) > 1:
        ensemble_score = service.score_from_ensemble(ensemble_predictions)

    # If only one method, return that
    available = [s for s in [rules_score, consistency_score, ensemble_score] if s]
    if len(available) == 1:
        return available[0]

    # Otherwise combine
    return service.combined_score(rules_score, consistency_score, ensemble_score)
