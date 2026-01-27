"""
Vulnerable populations handling for IRB submissions.

Provides comprehensive support for studies involving vulnerable populations
including regulatory requirements, additional questions, and validation.

References:
- 45 CFR 46 Subpart B: Pregnant Women, Fetuses, Neonates
- 45 CFR 46 Subpart C: Prisoners
- 45 CFR 46 Subpart D: Children
"""

from dataclasses import dataclass, field
from typing import List, Dict, Optional, Set
from enum import Enum


class SubpartRegulation(str, Enum):
    """Federal regulations for vulnerable population protections."""
    SUBPART_B = "45 CFR 46 Subpart B"  # Pregnant women, fetuses, neonates
    SUBPART_C = "45 CFR 46 Subpart C"  # Prisoners
    SUBPART_D = "45 CFR 46 Subpart D"  # Children


@dataclass
class VulnerablePopulationRequirement:
    """
    Requirements for a specific vulnerable population.

    Includes regulatory references, required protections,
    additional questions, and consent requirements.
    """
    population_id: str
    display_name: str
    regulation: Optional[SubpartRegulation]
    description: str
    required_protections: List[str]
    additional_questions: List[Dict[str, str]]
    consent_requirements: List[str]
    irb_requirements: List[str]
    risk_categories: List[str] = field(default_factory=list)


# Comprehensive requirements for each vulnerable population
POPULATION_REQUIREMENTS: Dict[str, VulnerablePopulationRequirement] = {
    "children": VulnerablePopulationRequirement(
        population_id="children",
        display_name="Children (Minors under 18)",
        regulation=SubpartRegulation.SUBPART_D,
        description=(
            "Individuals who have not attained the legal age of consent "
            "under applicable state law"
        ),
        required_protections=[
            "Adequate provisions for soliciting assent of children when capable",
            "Adequate provisions for obtaining parental permission",
            "Selection of subjects equitable (children not included unnecessarily)",
            "Additional safeguards when children are wards of the state",
        ],
        additional_questions=[
            {
                "id": "children_age_range",
                "prompt": "What is the age range of children to be enrolled?",
                "guidance": "Specify exact ages (e.g., 7-12 years, 13-17 years)",
            },
            {
                "id": "children_assent",
                "prompt": "Describe the assent process for each age group",
                "guidance": (
                    "Include age-appropriate assent forms, verbal assent for young children, "
                    "and how dissent will be honored"
                ),
            },
            {
                "id": "children_parental",
                "prompt": "Describe the parental permission process",
                "guidance": (
                    "Will one or both parents provide permission? "
                    "Justify if waiving requirement for both parents"
                ),
            },
            {
                "id": "children_necessity",
                "prompt": "Why must this research include children?",
                "guidance": "Explain why the research cannot be done with adults only",
            },
        ],
        consent_requirements=[
            "Parental permission (one or both parents depending on risk)",
            "Child assent when developmentally appropriate",
            "Documentation of assent process",
        ],
        irb_requirements=[
            "IRB must have pediatric expertise",
            "Must determine children's capability to assent",
            "Special review for greater than minimal risk research",
        ],
        risk_categories=[
            "§46.404 - Minimal risk",
            "§46.405 - Greater than minimal risk with prospect of direct benefit",
            "§46.406 - Greater than minimal risk, no direct benefit, but generalizable knowledge",
            "§46.407 - Research not otherwise approvable (requires DHHS review)",
        ],
    ),
    "impaired_adults": VulnerablePopulationRequirement(
        population_id="impaired_adults",
        display_name="Adults with Impaired Decision-Making Capacity",
        regulation=None,  # General Common Rule provisions apply
        description=(
            "Adults who may lack the capacity to provide informed consent "
            "due to cognitive impairment, mental illness, or other conditions"
        ),
        required_protections=[
            "Capacity assessment procedures",
            "Legally authorized representative (LAR) consent",
            "Ongoing monitoring of capacity and assent",
            "Additional safeguards proportionate to risk",
        ],
        additional_questions=[
            {
                "id": "impaired_capacity",
                "prompt": "How will decision-making capacity be assessed?",
                "guidance": (
                    "Describe tools or criteria for assessing capacity "
                    "(e.g., clinical judgment, validated instruments)"
                ),
            },
            {
                "id": "impaired_lar",
                "prompt": "Describe the LAR consent process",
                "guidance": (
                    "How will LARs be identified? What documentation is required? "
                    "How will LAR availability be verified?"
                ),
            },
            {
                "id": "impaired_assent",
                "prompt": "How will ongoing assent be monitored?",
                "guidance": (
                    "Describe how you will honor dissent and monitor for "
                    "changes in willingness to participate"
                ),
            },
            {
                "id": "impaired_necessity",
                "prompt": "Why must this research include cognitively impaired adults?",
                "guidance": (
                    "Explain why the research cannot be conducted with "
                    "non-impaired adults"
                ),
            },
        ],
        consent_requirements=[
            "LAR consent when individual lacks capacity",
            "Participant assent when possible",
            "Ongoing reassessment of capacity",
            "Honor expressed dissent regardless of prior consent",
        ],
        irb_requirements=[
            "IRB must ensure additional safeguards",
            "May require expertise in relevant conditions",
            "Risk-benefit assessment must account for vulnerability",
        ],
    ),
    "neonates": VulnerablePopulationRequirement(
        population_id="neonates",
        display_name="Neonates",
        regulation=SubpartRegulation.SUBPART_B,
        description="Newborns (within first 28 days of life)",
        required_protections=[
            "Preclinical and clinical data supporting safety",
            "Risk to neonate minimized",
            "Both parents' consent typically required",
            "Special considerations for viability status",
        ],
        additional_questions=[
            {
                "id": "neonate_viability",
                "prompt": "What is the viability status of neonates to be enrolled?",
                "guidance": (
                    "Select: Viable neonates, Non-viable neonates, "
                    "Neonates of uncertain viability"
                ),
            },
            {
                "id": "neonate_preclinical",
                "prompt": "What preclinical data supports safety?",
                "guidance": "Describe relevant animal studies or other safety data",
            },
            {
                "id": "neonate_risks",
                "prompt": "What are the specific risks to neonates?",
                "guidance": "Address developmental, physiological, and procedural risks",
            },
        ],
        consent_requirements=[
            "Both parents' consent generally required",
            "Special provisions for non-viable or uncertain viability",
            "Cannot induce termination of pregnancy for research",
        ],
        irb_requirements=[
            "Subpart B compliance required",
            "May require neonatal expertise",
            "Special review for non-viable neonates",
        ],
    ),
    "pregnant": VulnerablePopulationRequirement(
        population_id="pregnant",
        display_name="Pregnant Women and Fetuses",
        regulation=SubpartRegulation.SUBPART_B,
        description=(
            "Research involving pregnant women or research directed "
            "at the fetus or neonates"
        ),
        required_protections=[
            "Preclinical studies provide safety data",
            "Risk to fetus minimized and caused only by interventions with potential benefit",
            "No inducement of abortion",
            "Researchers have no role in timing/method of abortion decisions",
        ],
        additional_questions=[
            {
                "id": "pregnant_preclinical",
                "prompt": "What preclinical data supports fetal safety?",
                "guidance": "Describe animal reproductive studies or other safety data",
            },
            {
                "id": "pregnant_fetal_risk",
                "prompt": "What are the risks to the fetus?",
                "guidance": (
                    "Describe known and potential fetal risks, "
                    "including teratogenicity concerns"
                ),
            },
            {
                "id": "pregnant_benefit",
                "prompt": "Is there potential direct benefit to woman or fetus?",
                "guidance": (
                    "Describe any anticipated benefits. "
                    "Note: If no direct benefit, risk must be minimal"
                ),
            },
            {
                "id": "pregnant_father",
                "prompt": "Is father's consent required?",
                "guidance": (
                    "Father's consent required unless: unknown, unavailable, "
                    "research poses no more than minimal risk"
                ),
            },
        ],
        consent_requirements=[
            "Woman's informed consent",
            "Father's consent when research holds prospect of direct benefit to fetus",
            "May not offer inducements for abortion",
        ],
        irb_requirements=[
            "Subpart B compliance required",
            "May require obstetric or fetal medicine expertise",
            "Ensure no role in abortion decisions",
        ],
    ),
    "prisoners": VulnerablePopulationRequirement(
        population_id="prisoners",
        display_name="Prisoners",
        regulation=SubpartRegulation.SUBPART_C,
        description=(
            "Individuals involuntarily confined or detained in a penal institution, "
            "including persons detained pending arraignment, trial, or sentencing"
        ),
        required_protections=[
            "Research must fall into permissible categories",
            "Any advantages through participation not of such magnitude as to impair voluntariness",
            "Risks accepted by non-prisoner volunteers also appropriate for prisoners",
            "Adequate assurance that parole boards will not consider participation in decisions",
        ],
        additional_questions=[
            {
                "id": "prisoner_category",
                "prompt": "Which permissible research category applies?",
                "guidance": (
                    "Categories: (1) Study of incarceration conditions/prisoners as prisoners, "
                    "(2) Minimal risk studies, (3) Causes/conditions affecting prisoners, "
                    "(4) Practices with intent to benefit prisoners"
                ),
            },
            {
                "id": "prisoner_voluntariness",
                "prompt": "How will voluntariness be ensured?",
                "guidance": (
                    "Describe safeguards against coercion. "
                    "Explain how participation will not affect parole/treatment"
                ),
            },
            {
                "id": "prisoner_selection",
                "prompt": "How will prisoner selection be equitable?",
                "guidance": (
                    "Describe selection criteria and how advantages "
                    "of participation are distributed fairly"
                ),
            },
        ],
        consent_requirements=[
            "Understandable information provided",
            "No influence of parole status on participation",
            "Adequate safeguards for voluntary consent",
        ],
        irb_requirements=[
            "Prisoner representative required on IRB when reviewing prison research",
            "Majority of board must have no association with prison",
            "OHRP certification may be required for some research",
        ],
        risk_categories=[
            "Study of incarceration effects",
            "Minimal risk research",
            "Research on conditions particularly affecting prisoners",
            "Research on practices intended to benefit prisoners",
        ],
    ),
}


def get_requirements_for_population(
    population_id: str,
) -> Optional[VulnerablePopulationRequirement]:
    """
    Get requirements for a specific vulnerable population.

    Args:
        population_id: Identifier for the population

    Returns:
        VulnerablePopulationRequirement or None if not found
    """
    return POPULATION_REQUIREMENTS.get(population_id.lower())


def get_required_subparts(populations: List[str]) -> List[SubpartRegulation]:
    """
    Get list of federal subparts that apply to given populations.

    Args:
        populations: List of population identifiers

    Returns:
        List of applicable SubpartRegulation enums
    """
    subparts: Set[SubpartRegulation] = set()

    for pop_id in populations:
        req = POPULATION_REQUIREMENTS.get(pop_id.lower())
        if req and req.regulation:
            subparts.add(req.regulation)

    return list(subparts)


def get_additional_questions(populations: List[str]) -> List[Dict[str, str]]:
    """
    Get all additional questions required for given populations.

    Args:
        populations: List of population identifiers

    Returns:
        Combined list of additional questions (may have duplicates removed)
    """
    questions = []
    seen_ids: Set[str] = set()

    for pop_id in populations:
        req = POPULATION_REQUIREMENTS.get(pop_id.lower())
        if req:
            for q in req.additional_questions:
                if q["id"] not in seen_ids:
                    questions.append(q)
                    seen_ids.add(q["id"])

    return questions


def validate_vulnerable_population_responses(
    populations: List[str],
    responses: Dict[str, str],
) -> List[str]:
    """
    Validate that all required vulnerable population questions are answered.

    Args:
        populations: List of vulnerable populations included in study
        responses: Dictionary of question ID to response

    Returns:
        List of error messages for missing/incomplete responses
    """
    errors = []

    for pop_id in populations:
        req = POPULATION_REQUIREMENTS.get(pop_id.lower())
        if not req:
            continue

        for q in req.additional_questions:
            if q["id"] not in responses or not responses[q["id"]].strip():
                errors.append(
                    f"Missing required information for {req.display_name}: {q['prompt']}"
                )

    return errors


def get_consent_summary(populations: List[str]) -> Dict[str, List[str]]:
    """
    Get summary of consent requirements for given populations.

    Args:
        populations: List of population identifiers

    Returns:
        Dictionary mapping population names to consent requirements
    """
    summary = {}

    for pop_id in populations:
        req = POPULATION_REQUIREMENTS.get(pop_id.lower())
        if req:
            summary[req.display_name] = req.consent_requirements

    return summary


def get_irb_requirements(populations: List[str]) -> List[str]:
    """
    Get combined IRB requirements for given populations.

    Args:
        populations: List of population identifiers

    Returns:
        Deduplicated list of all IRB requirements
    """
    requirements: List[str] = []
    seen: Set[str] = set()

    for pop_id in populations:
        req = POPULATION_REQUIREMENTS.get(pop_id.lower())
        if req:
            for r in req.irb_requirements:
                if r not in seen:
                    requirements.append(r)
                    seen.add(r)

    return requirements


def get_all_population_ids() -> List[str]:
    """Get list of all supported vulnerable population identifiers."""
    return list(POPULATION_REQUIREMENTS.keys())


def get_population_display_names() -> Dict[str, str]:
    """Get mapping of population IDs to display names."""
    return {
        pop_id: req.display_name
        for pop_id, req in POPULATION_REQUIREMENTS.items()
    }
