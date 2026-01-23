"""
Stage 13: Internal Review

Handles AI-powered peer review simulation including:
- Multiple reviewer persona simulation
- Rubric-based evaluation
- Feedback generation
- Score aggregation

This stage provides internal quality review before external submission.
"""

import logging
from datetime import datetime
from typing import Any, Dict, List, Optional

from ..types import StageContext, StageResult
from ..registry import register_stage

logger = logging.getLogger("workflow_engine.stage_13_internal_review")

# Default reviewer personas
DEFAULT_REVIEWER_PERSONAS = [
    {
        "id": "methodologist",
        "name": "Methodology Expert",
        "focus_areas": ["statistical_methods", "study_design", "reproducibility"],
        "strictness": 0.8,
    },
    {
        "id": "domain_expert",
        "name": "Domain Expert",
        "focus_areas": ["scientific_accuracy", "clinical_relevance", "novelty"],
        "strictness": 0.7,
    },
    {
        "id": "editor",
        "name": "Technical Editor",
        "focus_areas": ["clarity", "structure", "completeness"],
        "strictness": 0.6,
    },
]

# Default review rubric
DEFAULT_RUBRIC = {
    "methodology": {
        "weight": 0.3,
        "criteria": [
            "appropriate_methods",
            "sample_size_justification",
            "bias_mitigation",
            "reproducibility",
        ],
    },
    "results": {
        "weight": 0.25,
        "criteria": [
            "clarity_of_presentation",
            "statistical_validity",
            "completeness",
            "appropriate_visualizations",
        ],
    },
    "discussion": {
        "weight": 0.2,
        "criteria": [
            "interpretation_accuracy",
            "limitations_acknowledged",
            "implications_discussed",
            "future_directions",
        ],
    },
    "writing_quality": {
        "weight": 0.15,
        "criteria": [
            "grammar_and_style",
            "logical_flow",
            "technical_accuracy",
            "citation_quality",
        ],
    },
    "ethical_compliance": {
        "weight": 0.1,
        "criteria": [
            "irb_compliance",
            "data_privacy",
            "conflict_disclosure",
            "informed_consent",
        ],
    },
}


def simulate_reviewer_feedback(
    persona: Dict[str, Any],
    rubric: Dict[str, Any],
    previous_results: Dict[int, Any],
    config: Dict[str, Any],
) -> Dict[str, Any]:
    """Simulate feedback from a single reviewer persona.

    Args:
        persona: Reviewer persona configuration
        rubric: Evaluation rubric
        previous_results: Results from previous stages
        config: Job configuration

    Returns:
        Dictionary containing reviewer feedback
    """
    feedback = {
        "reviewer_id": persona["id"],
        "reviewer_name": persona["name"],
        "scores": {},
        "comments": [],
        "recommendations": [],
    }

    focus_areas = persona.get("focus_areas", [])
    strictness = persona.get("strictness", 0.7)

    total_score = 0.0
    total_weight = 0.0

    for category, category_config in rubric.items():
        weight = category_config.get("weight", 0.2)
        criteria = category_config.get("criteria", [])

        # Calculate category score based on available data and strictness
        category_score = _evaluate_category(
            category=category,
            criteria=criteria,
            previous_results=previous_results,
            strictness=strictness,
            focus_areas=focus_areas,
        )

        feedback["scores"][category] = {
            "score": category_score,
            "weight": weight,
            "max_score": 10.0,
        }

        total_score += category_score * weight
        total_weight += weight

        # Generate category-specific comments
        if category_score < 7.0:
            comment = _generate_improvement_comment(category, criteria, category_score)
            feedback["comments"].append(comment)

    # Calculate overall score
    if total_weight > 0:
        feedback["overall_score"] = round(total_score / total_weight, 2)
    else:
        feedback["overall_score"] = 0.0

    # Generate recommendations based on scores
    feedback["recommendations"] = _generate_recommendations(
        feedback["scores"],
        persona["name"],
        strictness,
    )

    return feedback


def _evaluate_category(
    category: str,
    criteria: List[str],
    previous_results: Dict[int, Any],
    strictness: float,
    focus_areas: List[str],
) -> float:
    """Evaluate a single rubric category.

    Args:
        category: Category name
        criteria: List of criteria for the category
        previous_results: Results from previous stages
        strictness: Reviewer strictness (0-1)
        focus_areas: Reviewer's focus areas

    Returns:
        Score for the category (0-10)
    """
    base_score = 7.5  # Assume reasonable quality baseline

    # Adjust based on previous stage results
    for stage_id, result in previous_results.items():
        if hasattr(result, 'status'):
            if result.status == "failed":
                base_score -= 1.0
            elif result.status == "completed":
                if hasattr(result, 'warnings') and result.warnings:
                    base_score -= 0.2 * len(result.warnings)

    # Apply strictness modifier
    strictness_modifier = (1 - strictness) * 2  # More strict = lower scores
    base_score -= strictness_modifier

    # Boost score if category matches reviewer focus
    is_focus_area = any(
        focus in category.lower() for focus in focus_areas
    )
    if is_focus_area:
        base_score += 0.5  # More attention to focus areas

    # Ensure score is within bounds
    return max(0.0, min(10.0, round(base_score, 1)))


def _generate_improvement_comment(
    category: str,
    criteria: List[str],
    score: float,
) -> Dict[str, Any]:
    """Generate an improvement comment for a category.

    Args:
        category: Category name
        criteria: List of criteria
        score: Category score

    Returns:
        Comment dictionary
    """
    severity = "minor" if score >= 5.0 else "major"
    category_title = category.replace("_", " ").title()

    return {
        "category": category,
        "severity": severity,
        "comment": f"The {category_title} section requires attention. "
                   f"Consider reviewing: {', '.join(criteria[:2])}.",
        "score": score,
    }


def _generate_recommendations(
    scores: Dict[str, Any],
    reviewer_name: str,
    strictness: float,
) -> List[str]:
    """Generate recommendations based on scores.

    Args:
        scores: Category scores dictionary
        reviewer_name: Name of the reviewer
        strictness: Reviewer strictness

    Returns:
        List of recommendation strings
    """
    recommendations = []

    # Find lowest scoring categories
    sorted_categories = sorted(
        scores.items(),
        key=lambda x: x[1]["score"],
    )

    for category, data in sorted_categories[:2]:
        if data["score"] < 8.0:
            category_title = category.replace("_", " ").title()
            recommendations.append(
                f"Strengthen {category_title} section before submission."
            )

    if not recommendations:
        recommendations.append("Document meets quality standards for submission.")

    return recommendations


def aggregate_reviews(reviews: List[Dict[str, Any]]) -> Dict[str, Any]:
    """Aggregate multiple reviewer feedback into summary.

    Args:
        reviews: List of individual reviewer feedback

    Returns:
        Aggregated review summary
    """
    if not reviews:
        return {
            "average_score": 0.0,
            "score_range": {"min": 0.0, "max": 0.0},
            "consensus_recommendations": [],
            "reviewer_count": 0,
        }

    scores = [r["overall_score"] for r in reviews]
    all_recommendations = []
    for r in reviews:
        all_recommendations.extend(r.get("recommendations", []))

    # Find common recommendations
    recommendation_counts: Dict[str, int] = {}
    for rec in all_recommendations:
        recommendation_counts[rec] = recommendation_counts.get(rec, 0) + 1

    consensus = [
        rec for rec, count in recommendation_counts.items()
        if count >= len(reviews) / 2
    ]

    return {
        "average_score": round(sum(scores) / len(scores), 2),
        "score_range": {
            "min": min(scores),
            "max": max(scores),
        },
        "consensus_recommendations": consensus,
        "reviewer_count": len(reviews),
    }


def generate_improvement_suggestions(
    reviews: List[Dict[str, Any]],
) -> List[Dict[str, Any]]:
    """Generate actionable improvement suggestions from reviews.

    Args:
        reviews: List of reviewer feedback

    Returns:
        List of improvement suggestion dictionaries
    """
    suggestions = []
    category_issues: Dict[str, List[Dict[str, Any]]] = {}

    # Collect all comments by category
    for review in reviews:
        for comment in review.get("comments", []):
            category = comment.get("category", "general")
            if category not in category_issues:
                category_issues[category] = []
            category_issues[category].append({
                "reviewer": review["reviewer_name"],
                "severity": comment.get("severity", "minor"),
                "comment": comment.get("comment", ""),
            })

    # Generate suggestions for each category with issues
    for category, issues in category_issues.items():
        major_count = sum(1 for i in issues if i["severity"] == "major")
        priority = "high" if major_count > 0 else "medium"

        suggestions.append({
            "category": category,
            "priority": priority,
            "issue_count": len(issues),
            "action": f"Review and improve {category.replace('_', ' ')} based on "
                      f"{len(issues)} reviewer comment(s).",
            "details": issues,
        })

    # Sort by priority
    priority_order = {"high": 0, "medium": 1, "low": 2}
    suggestions.sort(key=lambda x: priority_order.get(x["priority"], 2))

    return suggestions


@register_stage
class InternalReviewStage:
    """Stage 13: Internal Review

    Performs AI-powered peer review simulation.
    """

    stage_id = 13
    stage_name = "Internal Review"

    async def execute(self, context: StageContext) -> StageResult:
        """Execute internal review simulation.

        Args:
            context: Stage execution context

        Returns:
            StageResult with review feedback and scores
        """
        started_at = datetime.utcnow().isoformat() + "Z"
        errors: List[str] = []
        warnings: List[str] = []
        output: Dict[str, Any] = {}

        logger.info(f"Starting internal review for job {context.job_id}")

        # Get configuration
        reviewer_personas = context.config.get("reviewer_personas", DEFAULT_REVIEWER_PERSONAS)
        rubric = context.config.get("rubric", DEFAULT_RUBRIC)

        # Validate personas
        if not reviewer_personas:
            warnings.append("No reviewer personas specified, using defaults.")
            reviewer_personas = DEFAULT_REVIEWER_PERSONAS

        if not isinstance(reviewer_personas, list):
            errors.append("reviewer_personas must be a list of persona configurations.")
            completed_at = datetime.utcnow().isoformat() + "Z"
            started_dt = datetime.fromisoformat(started_at.replace("Z", "+00:00"))
            completed_dt = datetime.fromisoformat(completed_at.replace("Z", "+00:00"))
            duration_ms = int((completed_dt - started_dt).total_seconds() * 1000)

            return StageResult(
                stage_id=self.stage_id,
                stage_name=self.stage_name,
                status="failed",
                started_at=started_at,
                completed_at=completed_at,
                duration_ms=duration_ms,
                errors=errors,
            )

        # Validate rubric
        if not rubric:
            warnings.append("No rubric specified, using default rubric.")
            rubric = DEFAULT_RUBRIC

        try:
            # Simulate reviews from each persona
            reviews: List[Dict[str, Any]] = []

            for persona in reviewer_personas:
                if not isinstance(persona, dict) or "id" not in persona:
                    warnings.append(f"Invalid persona configuration skipped: {persona}")
                    continue

                logger.debug(f"Simulating review from {persona.get('name', persona['id'])}")

                review = simulate_reviewer_feedback(
                    persona=persona,
                    rubric=rubric,
                    previous_results=context.previous_results,
                    config=context.config,
                )
                reviews.append(review)

            if not reviews:
                errors.append("No valid reviews generated.")
            else:
                # Aggregate reviews
                aggregated = aggregate_reviews(reviews)

                # Generate improvement suggestions
                improvement_suggestions = generate_improvement_suggestions(reviews)

                output["reviews"] = reviews
                output["scores"] = {
                    "overall": aggregated["average_score"],
                    "range": aggregated["score_range"],
                    "by_reviewer": {r["reviewer_id"]: r["overall_score"] for r in reviews},
                }
                output["improvement_suggestions"] = improvement_suggestions
                output["consensus_recommendations"] = aggregated["consensus_recommendations"]

                logger.info(
                    f"Internal review completed: {len(reviews)} reviews, "
                    f"average score {aggregated['average_score']}"
                )

        except Exception as e:
            logger.error(f"Internal review failed: {str(e)}")
            errors.append(f"Failed to complete internal review: {str(e)}")

        completed_at = datetime.utcnow().isoformat() + "Z"
        started_dt = datetime.fromisoformat(started_at.replace("Z", "+00:00"))
        completed_dt = datetime.fromisoformat(completed_at.replace("Z", "+00:00"))
        duration_ms = int((completed_dt - started_dt).total_seconds() * 1000)

        status = "failed" if errors else "completed"

        return StageResult(
            stage_id=self.stage_id,
            stage_name=self.stage_name,
            status=status,
            started_at=started_at,
            completed_at=completed_at,
            duration_ms=duration_ms,
            output=output,
            errors=errors,
            warnings=warnings,
            metadata={
                "governance_mode": context.governance_mode,
                "reviewer_count": len(reviewer_personas),
                "rubric_categories": list(rubric.keys()) if rubric else [],
            },
        )
