"""
Generic IRB template for institutions without specific templates.

Provides a baseline template that follows common IRB requirements
and can be used as a fallback for any institution.
"""

from typing import List, Dict, Any
from .base import InstitutionTemplate, TemplateConfig
from ..irb_questions import IRBQuestion, IRB_QUESTIONS, REQUIRED_IRB_CATEGORIES


class GenericTemplate(InstitutionTemplate):
    """
    Generic IRB template for any institution.

    Uses the standard IRB questions without institution-specific additions.
    """

    def get_config(self) -> TemplateConfig:
        return TemplateConfig(
            institution_id="generic",
            institution_name="Generic",
            display_name="Standard IRB",
            description="Standard IRB submission template following common requirements",
            version="1.0",
            required_categories=list(REQUIRED_IRB_CATEGORIES),
            supports_exemption=True,
            supports_expedited=True,
            requires_lay_summary=False,
            requires_vulnerable_populations=True,
            requires_ai_ml_disclosure=False,
            supports_multi_site=True,
        )

    def get_institution_questions(self) -> List[IRBQuestion]:
        """Generic template uses no additional questions."""
        return []

    def validate_submission(self, data: Dict[str, Any]) -> List[str]:
        """
        Validate against generic IRB requirements.

        Checks that all required categories have answers.
        """
        errors = []
        answers = data.get("answers", {})

        for category in self.config.required_categories:
            # Find questions in this category
            category_questions = [q for q in IRB_QUESTIONS if q.category == category]

            # Check if at least one question in the category has an answer
            has_answer = any(
                answers.get(q.category) for q in category_questions
            )

            if not has_answer:
                # Format category name for display
                display_name = category.replace("_", " ").title()
                errors.append(f"Missing required section: {display_name}")

        # Validate study title
        study_title = data.get("study_title", "")
        if not study_title:
            errors.append("Study title is required")
        elif len(study_title) > self.config.max_title_length:
            errors.append(
                f"Study title must be {self.config.max_title_length} characters or fewer"
            )

        return errors
