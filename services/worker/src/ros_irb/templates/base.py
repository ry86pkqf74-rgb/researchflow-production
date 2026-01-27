"""
Base class for institution-specific IRB templates.

Provides the abstract interface that all institution templates must implement,
ensuring consistent behavior across different institutions.
"""

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import List, Dict, Optional, Any, Sequence
from ..irb_questions import IRBQuestion


@dataclass
class TemplateConfig:
    """Configuration for an institution template."""

    institution_id: str
    institution_name: str
    display_name: str
    description: str
    version: str = "1.0"
    required_categories: List[str] = field(default_factory=list)
    optional_categories: List[str] = field(default_factory=list)
    supports_exemption: bool = True
    supports_expedited: bool = True
    requires_lay_summary: bool = True
    requires_vulnerable_populations: bool = True
    requires_ai_ml_disclosure: bool = False
    supports_multi_site: bool = True
    export_formats: List[str] = field(default_factory=lambda: ["docx", "pdf"])
    max_title_length: int = 200
    max_short_title_length: int = 50
    lay_summary_min_words: int = 100
    lay_summary_max_words: int = 500


class InstitutionTemplate(ABC):
    """
    Abstract base class for institution IRB templates.

    Each institution template defines:
    - Configuration settings
    - Institution-specific questions
    - Validation rules
    - Export formatting requirements
    """

    def __init__(self):
        self.config = self.get_config()
        self._questions: Optional[Sequence[IRBQuestion]] = None

    @abstractmethod
    def get_config(self) -> TemplateConfig:
        """Return the template configuration."""
        pass

    @abstractmethod
    def get_institution_questions(self) -> List[IRBQuestion]:
        """Return institution-specific questions."""
        pass

    def get_all_questions(
        self, base_questions: Sequence[IRBQuestion]
    ) -> List[IRBQuestion]:
        """
        Combine base questions with institution-specific questions.

        Institution questions override base questions with the same category.
        """
        institution_qs = self.get_institution_questions()
        institution_categories = {q.category for q in institution_qs}

        # Keep base questions that aren't overridden
        combined = [q for q in base_questions if q.category not in institution_categories]
        # Add all institution questions
        combined.extend(institution_qs)

        return combined

    @abstractmethod
    def validate_submission(self, data: Dict[str, Any]) -> List[str]:
        """
        Validate a submission against institution requirements.

        Returns a list of error messages (empty if valid).
        """
        pass

    def get_required_fields(self) -> List[str]:
        """Get list of required field categories."""
        if self._questions is None:
            from ..irb_questions import IRB_QUESTIONS

            self._questions = self.get_all_questions(IRB_QUESTIONS)
        return list(self.config.required_categories)

    def get_export_section_order(self) -> List[str]:
        """
        Return the order of sections for export.

        Can be overridden by institutions with specific formatting needs.
        """
        return self.config.required_categories + self.config.optional_categories

    def format_for_export(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Format submission data for export.

        Can be overridden to apply institution-specific formatting.
        """
        return data

    def get_conditional_questions(
        self, answers: Dict[str, str]
    ) -> List[IRBQuestion]:
        """
        Return additional questions based on previous answers.

        Override to implement conditional logic (e.g., show child-specific
        questions only if children are included in the study).
        """
        return []
