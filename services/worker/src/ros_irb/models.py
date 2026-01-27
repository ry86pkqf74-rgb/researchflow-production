"""
Enhanced IRB data models supporting institution-specific requirements.
Maintains backwards compatibility with existing IRBRequestInput.
"""

from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Optional, Dict, List, Any


class ExemptionCategory(str, Enum):
    """Federal exemption categories per 45 CFR 46.104(d)"""
    D1 = "D1"  # Educational settings
    D2 = "D2"  # Tests, surveys, interviews, observation
    D3 = "D3"  # Benign behavioral interventions
    D4 = "D4"  # Secondary research
    NONE = "NONE"  # Not exempt
    PENDING = "PENDING"  # Determination pending


class VulnerablePopulation(str, Enum):
    """Special populations requiring additional protections"""
    CHILDREN = "children"  # Minors under 18
    IMPAIRED_ADULTS = "impaired_adults"  # Adults with impaired decision-making
    NEONATES = "neonates"  # Neonates
    PREGNANT = "pregnant"  # Pregnant women/fetuses
    PRISONERS = "prisoners"  # Incarcerated/detained individuals
    NONE = "none"  # No vulnerable populations
    NA_SECONDARY = "na_secondary"  # N/A - secondary analysis only


class ReviewType(str, Enum):
    """IRB review pathway types"""
    EXEMPT = "exempt"
    EXPEDITED = "expedited"
    FULL_BOARD = "full_board"
    NOT_HUMAN_SUBJECTS = "not_human_subjects"


class Institution(str, Enum):
    """Supported institutions for IRB templates"""
    GENERIC = "generic"
    EMORY = "emory"
    VANDERBILT = "vanderbilt"
    DUKE = "duke"


@dataclass
class EmoryMetadata:
    """Emory-specific IRB metadata fields"""
    legacy_study_id: Optional[str] = None
    short_title: Optional[str] = None
    exemption_categories: List[ExemptionCategory] = field(default_factory=list)
    is_repository_registry: bool = False
    is_multi_site_review: bool = False
    emory_is_single_irb: bool = False
    single_irb_sites: List[str] = field(default_factory=list)
    expanded_access_treatment: bool = False


@dataclass
class VulnerablePopulationInfo:
    """Structured information about vulnerable populations in study"""
    populations: List[VulnerablePopulation] = field(default_factory=list)
    children_age_range: Optional[str] = None
    children_assent_process: Optional[str] = None
    parental_consent_process: Optional[str] = None
    impaired_adults_surrogate_consent: Optional[str] = None
    prisoner_justification: Optional[str] = None
    pregnant_risk_category: Optional[str] = None
    neonates_viability_status: Optional[str] = None
    additional_protections: Optional[str] = None


@dataclass
class AIMLUsage:
    """AI/ML tool usage disclosure for IRB"""
    uses_ai_ml: bool = False
    ai_ml_description: Optional[str] = None
    algorithm_type: Optional[str] = None
    training_data_source: Optional[str] = None
    potential_biases: Optional[str] = None
    validation_plan: Optional[str] = None
    clinical_decision_use: Optional[str] = None
    fda_regulated: bool = False


@dataclass
class LaySummary:
    """Structured lay summary following institutional guidelines"""
    summary_text: str = ""
    objectives_stated: bool = False
    population_described: bool = False
    data_sources_listed: bool = False
    prospective_or_retrospective: Optional[str] = None
    procedures_described: bool = False
    participant_duration: Optional[str] = None
    recruitment_locations: List[str] = field(default_factory=list)
    total_enrollment: Optional[int] = None
    includes_screen_failures: bool = False
    specimen_banking: bool = False
    data_banking: bool = False
    consent_methods: List[str] = field(default_factory=list)
    assent_methods: List[str] = field(default_factory=list)


@dataclass
class IRBRequestInputEnhanced:
    """
    Enhanced IRB request input supporting institution-specific requirements.
    Backwards compatible with original IRBRequestInput.
    """
    # === Original fields (required for compatibility) ===
    study_title: str
    research_question: Optional[str] = None
    answers: Dict[str, str] = field(default_factory=dict)
    literature_query: Optional[str] = None

    # === Institution selection ===
    institution: Institution = Institution.GENERIC

    # === Enhanced metadata ===
    short_title: Optional[str] = None
    legacy_study_id: Optional[str] = None

    # === Regulatory determinations ===
    review_type: ReviewType = ReviewType.FULL_BOARD
    exemption_categories: List[ExemptionCategory] = field(default_factory=list)

    # === Study type flags ===
    is_repository_registry: bool = False
    is_multi_site: bool = False
    institution_is_single_irb: bool = False
    participating_sites: List[str] = field(default_factory=list)

    # === Structured components ===
    lay_summary: Optional[LaySummary] = None
    vulnerable_populations: Optional[VulnerablePopulationInfo] = None
    ai_ml_usage: Optional[AIMLUsage] = None

    # === Institution-specific metadata ===
    emory_metadata: Optional[EmoryMetadata] = None

    # === Additional context ===
    principal_investigator: Optional[str] = None
    department: Optional[str] = None
    funding_source: Optional[str] = None
    estimated_duration_months: Optional[int] = None

    def to_legacy_format(self) -> dict:
        """Convert to original IRBRequestInput format for backwards compatibility"""
        return {
            "study_title": self.study_title,
            "research_question": self.research_question,
            "answers": self.answers,
            "literature_query": self.literature_query,
        }

    @classmethod
    def from_legacy(cls, legacy_input: dict) -> "IRBRequestInputEnhanced":
        """Create enhanced input from legacy format"""
        return cls(
            study_title=legacy_input.get("study_title", ""),
            research_question=legacy_input.get("research_question"),
            answers=legacy_input.get("answers", {}),
            literature_query=legacy_input.get("literature_query"),
        )


@dataclass
class IRBDraftEnhanced:
    """Enhanced IRB draft with institution-specific sections."""
    id: str = field(default_factory=lambda: str(datetime.utcnow().timestamp()))
    study_title: str = ""
    short_title: Optional[str] = None
    answers: Dict[str, str] = field(default_factory=dict)
    created_at: datetime = field(default_factory=datetime.utcnow)
    updated_at: datetime = field(default_factory=datetime.utcnow)

    literature_summary: Optional[str] = None
    references: List[str] = field(default_factory=list)

    institution: Institution = Institution.GENERIC
    review_type: ReviewType = ReviewType.FULL_BOARD
    exemption_categories: List[ExemptionCategory] = field(default_factory=list)

    lay_summary: Optional[LaySummary] = None
    vulnerable_populations: Optional[VulnerablePopulationInfo] = None
    ai_ml_usage: Optional[AIMLUsage] = None

    legacy_study_id: Optional[str] = None
    is_repository_registry: bool = False
    is_multi_site: bool = False
    participating_sites: List[str] = field(default_factory=list)

    phi_detected: bool = False
    phi_categories_found: List[str] = field(default_factory=list)
    phi_redacted: bool = False

    status: str = "draft"
    version: int = 1

    def to_dict(self) -> dict:
        """Convert to dictionary for JSON serialization"""
        return {
            "id": self.id,
            "study_title": self.study_title,
            "short_title": self.short_title,
            "answers": self.answers,
            "created_at": self.created_at.isoformat(),
            "updated_at": self.updated_at.isoformat(),
            "literature_summary": self.literature_summary,
            "references": self.references,
            "institution": self.institution.value if isinstance(self.institution, Enum) else self.institution,
            "review_type": self.review_type.value if isinstance(self.review_type, Enum) else self.review_type,
            "exemption_categories": [e.value for e in self.exemption_categories],
            "lay_summary": self.lay_summary.__dict__ if self.lay_summary else None,
            "vulnerable_populations": self.vulnerable_populations.__dict__ if self.vulnerable_populations else None,
            "ai_ml_usage": self.ai_ml_usage.__dict__ if self.ai_ml_usage else None,
            "legacy_study_id": self.legacy_study_id,
            "is_repository_registry": self.is_repository_registry,
            "is_multi_site": self.is_multi_site,
            "participating_sites": self.participating_sites,
            "phi_detected": self.phi_detected,
            "phi_categories_found": self.phi_categories_found,
            "phi_redacted": self.phi_redacted,
            "status": self.status,
            "version": self.version,
        }
