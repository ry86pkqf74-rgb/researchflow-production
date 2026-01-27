"""
Emory University IRB template implementation.

Implements Emory-specific requirements including:
- Lay summary with specific format requirements
- Exemption category selection
- Vulnerable populations handling
- AI/ML usage disclosure
- Short title validation
"""

from typing import List, Dict, Any
from .base import InstitutionTemplate, TemplateConfig
from ..irb_questions import IRBQuestion
from ..emory_questions import (
    EMORY_IRB_QUESTIONS,
    EMORY_REQUIRED_CATEGORIES,
    validate_emory_submission,
)


class EmoryTemplate(InstitutionTemplate):
    """
    Emory University IRB template.

    Extends the generic template with Emory-specific questions
    and validation requirements.
    """

    def get_config(self) -> TemplateConfig:
        return TemplateConfig(
            institution_id="emory",
            institution_name="Emory University",
            display_name="Emory IRB",
            description="Emory University Institutional Review Board submission template",
            version="2026.1",
            required_categories=EMORY_REQUIRED_CATEGORIES,
            optional_categories=[
                "emory_legacy_id",
                "emory_short_title",
                "emory_repository_registry",
                "emory_multisite",
                "emory_expanded_access",
            ],
            supports_exemption=True,
            supports_expedited=True,
            requires_lay_summary=True,
            requires_vulnerable_populations=True,
            requires_ai_ml_disclosure=True,
            supports_multi_site=True,
            max_short_title_length=50,
            lay_summary_min_words=100,
            lay_summary_max_words=500,
        )

    def get_institution_questions(self) -> List[IRBQuestion]:
        """Return all Emory-specific questions."""
        return list(EMORY_IRB_QUESTIONS)

    def validate_submission(self, data: Dict[str, Any]) -> List[str]:
        """
        Validate against Emory-specific requirements.

        Includes validation for:
        - Required Emory fields
        - Lay summary format and length
        - Short title length
        - Vulnerable populations responses
        """
        errors = []

        # Run base Emory validation
        answers = data.get("answers", {})
        errors.extend(validate_emory_submission(answers))

        # Validate lay summary if present
        if data.get("lay_summary"):
            ls = data["lay_summary"]
            if isinstance(ls, dict):
                summary_text = ls.get("summary_text", "")
            else:
                summary_text = str(ls) if ls else ""

            word_count = len(summary_text.split())

            if word_count < self.config.lay_summary_min_words:
                errors.append(
                    f"Lay summary must be at least {self.config.lay_summary_min_words} words "
                    f"(currently {word_count})"
                )
            if word_count > self.config.lay_summary_max_words:
                errors.append(
                    f"Lay summary must not exceed {self.config.lay_summary_max_words} words "
                    f"(currently {word_count})"
                )

        # Validate short title length
        short_title = data.get("short_title", "")
        if short_title and len(short_title) > self.config.max_short_title_length:
            errors.append(
                f"Short title must be {self.config.max_short_title_length} characters or fewer"
            )

        # Validate vulnerable populations consistency
        vp_info = data.get("vulnerable_populations")
        if vp_info:
            self._validate_vulnerable_populations(vp_info, answers, errors)

        # Validate AI/ML disclosure if flagged
        if data.get("ai_ml_usage"):
            self._validate_ai_ml_disclosure(data["ai_ml_usage"], errors)

        return errors

    def _validate_vulnerable_populations(
        self,
        vp_info: Dict[str, Any],
        answers: Dict[str, str],
        errors: List[str],
    ) -> None:
        """Validate vulnerable populations responses are consistent."""
        populations = vp_info.get("populations", [])

        # If children are included, check for required details
        if "children" in populations:
            if not vp_info.get("children_age_range"):
                errors.append(
                    "Children included - please specify age range"
                )
            if not vp_info.get("children_assent_process"):
                errors.append(
                    "Children included - please describe assent process"
                )

        # If impaired adults included, check for LAR consent
        if "impaired_adults" in populations:
            if not vp_info.get("impaired_adults_surrogate_consent"):
                errors.append(
                    "Impaired adults included - please describe LAR consent process"
                )

        # If prisoners included, check for justification
        if "prisoners" in populations:
            if not vp_info.get("prisoner_justification"):
                errors.append(
                    "Prisoners included - please provide justification"
                )

    def _validate_ai_ml_disclosure(
        self,
        ai_ml_info: Dict[str, Any],
        errors: List[str],
    ) -> None:
        """Validate AI/ML disclosure completeness."""
        if ai_ml_info.get("uses_ai_ml"):
            if not ai_ml_info.get("ai_ml_description"):
                errors.append(
                    "AI/ML tools flagged - please describe the tools used"
                )
            if not ai_ml_info.get("validation_plan"):
                errors.append(
                    "AI/ML tools flagged - please describe validation approach"
                )

    def get_conditional_questions(
        self, answers: Dict[str, str]
    ) -> List[IRBQuestion]:
        """
        Return additional questions based on answers.

        For example, if children are included, return child-specific questions.
        """
        conditional = []

        # If study includes children, add detailed assent questions
        if answers.get("emory_children", "").lower() == "yes":
            conditional.append(
                IRBQuestion(
                    category="emory_children_assent_detail",
                    title="Assent Process Details",
                    prompt=(
                        "Describe the assent process for each age group included "
                        "in the study."
                    ),
                    guidance=(
                        "Include age-appropriate assent forms.",
                        "Describe how assent will be documented.",
                        "Explain how dissent will be honored.",
                    ),
                )
            )

        # If AI/ML is used, add detailed disclosure questions
        if answers.get("emory_ai_ml", "").lower() == "yes":
            conditional.append(
                IRBQuestion(
                    category="emory_ai_ml_bias_detail",
                    title="AI/ML Bias Assessment",
                    prompt=(
                        "Describe potential biases in the AI/ML system and "
                        "mitigation strategies."
                    ),
                    guidance=(
                        "Consider training data demographics.",
                        "Address potential disparate impact.",
                        "Describe monitoring plans.",
                    ),
                )
            )

        return conditional

    def get_export_section_order(self) -> List[str]:
        """Return Emory-specific section order for export."""
        return [
            # Metadata first
            "emory_short_title",
            "emory_legacy_id",
            # Lay summary prominent
            "emory_lay_summary",
            # Regulatory
            "emory_exemption",
            "emory_repository_registry",
            "emory_multisite",
            "emory_expanded_access",
            # Standard sections
            "purpose_significance",
            "methodology",
            "recruitment",
            "equitable_selection",
            # Vulnerable populations
            "emory_children",
            "emory_impaired_adults",
            "emory_neonates",
            "emory_pregnant",
            "emory_prisoners",
            # Rest of standard
            "risks_benefits",
            "informed_consent",
            "data_monitoring",
            "hipaa_phi",
            # Technology
            "emory_ai_ml",
            "devices",
            "conflicts",
        ]
