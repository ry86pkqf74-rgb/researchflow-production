"""
Emory University-specific IRB questions and guidance.

Extends the base IRB questions with Emory-specific requirements including:
- Lay summary requirements
- Exemption categories
- Vulnerable populations handling
- AI/ML usage disclosure
"""

from typing import List, Dict, Optional, Sequence
from .irb_questions import IRBQuestion


EMORY_LAY_SUMMARY_REQUIREMENTS = """
According to Emory IRB guidelines, your lay summary must include:

FOR CHART REVIEWS AND SECONDARY USE OF DATA/SPECIMENS:
- Study objectives (what you're trying to learn)
- Population characteristics (who is included, age ranges, conditions)
- Data/specimen sources (where the information comes from)
- Whether the study is prospective or retrospective

FOR ALL OTHER STUDIES:
- Study objectives
- Population characteristics (including any vulnerable groups)
- Study procedures (what participants will experience)
- Duration of participant involvement
- Recruitment locations
- Total anticipated enrollment (including screen failures/withdrawals)
- Whether specimens/data will be banked for future use
- Consent/assent methods

WRITING GUIDELINES:
- Write for a non-expert audience (8th grade reading level)
- Avoid medical jargon and acronyms
- Keep it concise but comprehensive
- Use plain language to describe procedures
"""


EMORY_IRB_QUESTIONS: Sequence[IRBQuestion] = [
    IRBQuestion(
        category="emory_legacy_id",
        title="Legacy Study ID",
        prompt=(
            "If this study was previously submitted under a different system, "
            "provide the legacy study ID."
        ),
        guidance=(
            "Enter the ID from the previous IRB system if applicable.",
            "Leave blank for new studies.",
        ),
    ),
    IRBQuestion(
        category="emory_short_title",
        title="Short Title",
        prompt="Provide a short title for the study (maximum 50 characters).",
        guidance=(
            "Create a brief, memorable title.",
            "Must be 50 characters or fewer.",
        ),
    ),
    IRBQuestion(
        category="emory_lay_summary",
        title="Lay Summary",
        prompt="Provide a lay summary of your research according to Emory IRB guidelines.",
        guidance=(
            "Write for a non-expert audience (8th grade reading level).",
            "Include study objectives and population characteristics.",
            "Describe procedures, duration, and recruitment locations.",
            "Note total enrollment and consent methods.",
            EMORY_LAY_SUMMARY_REQUIREMENTS,
        ),
    ),
    IRBQuestion(
        category="emory_exemption",
        title="Exemption Determination",
        prompt="Does your study qualify for exempt review under any federal category?",
        guidance=(
            "EXEMPT CATEGORIES (45 CFR 46.104(d)):",
            "D1 - Educational settings",
            "D2 - Tests, surveys, interviews, observation",
            "D3 - Benign behavioral interventions",
            "D4 - Secondary research",
            "Select NONE if not exempt, PENDING if determination needed.",
        ),
    ),
    IRBQuestion(
        category="emory_repository_registry",
        title="Repository or Registry",
        prompt=(
            "Is this project intended solely to establish a specimen repository "
            "or data registry?"
        ),
        guidance=(
            "Select YES if PRIMARY purpose is creating a biospecimen bank or data registry.",
            "This affects IRB review requirements.",
        ),
    ),
    IRBQuestion(
        category="emory_multisite",
        title="Multi-Site Study",
        prompt=(
            "Is Emory being asked to act as the Reviewing/Single IRB for other sites?"
        ),
        guidance=(
            "Select YES if Emory will review for other participating sites.",
            "List all participating sites if applicable.",
        ),
    ),
    IRBQuestion(
        category="emory_expanded_access",
        title="Expanded Access",
        prompt=(
            "Is this a single-patient expanded access (compassionate use) treatment?"
        ),
        guidance=(
            "Select YES only for single-patient investigational drug/device treatment.",
            "Additional FDA requirements may apply.",
        ),
    ),
    IRBQuestion(
        category="emory_children",
        title="Children (Minors)",
        prompt="Does your study include children (individuals under 18 years of age)?",
        guidance=(
            "If YES, describe age range of children to be enrolled.",
            "Describe assent procedures appropriate for each age group.",
            "Describe parental permission process (one or both parents).",
            "45 CFR 46 Subpart D applies.",
        ),
    ),
    IRBQuestion(
        category="emory_impaired_adults",
        title="Adults with Impaired Decision-Making",
        prompt=(
            "Does your study include adults who may have impaired capacity to consent?"
        ),
        guidance=(
            "If YES, describe capacity assessment procedures.",
            "Describe legally authorized representative (LAR) consent process.",
            "Describe ongoing assent monitoring procedures.",
        ),
    ),
    IRBQuestion(
        category="emory_neonates",
        title="Neonates",
        prompt="Does your study include neonates (newborns)?",
        guidance=(
            "45 CFR 46 Subpart B applies.",
            "Address viability status (viable, non-viable, uncertain).",
            "Describe parental consent requirements.",
        ),
    ),
    IRBQuestion(
        category="emory_pregnant",
        title="Pregnant Women and Fetuses",
        prompt="Does your study include pregnant women or involve fetuses?",
        guidance=(
            "45 CFR 46 Subpart B applies.",
            "Address fetal risk assessment.",
            "Describe preclinical studies supporting safety.",
            "Address father's consent requirements if applicable.",
        ),
    ),
    IRBQuestion(
        category="emory_prisoners",
        title="Prisoners",
        prompt=(
            "Does your study include prisoners or individuals who may become incarcerated?"
        ),
        guidance=(
            "45 CFR 46 Subpart C applies.",
            "Research must fall into permissible categories.",
            "Describe how voluntariness will be ensured.",
        ),
    ),
    IRBQuestion(
        category="emory_ai_ml",
        title="AI/ML Tools",
        prompt=(
            "Are any artificial intelligence (AI) or machine learning (ML) tools "
            "developed, evaluated, or used in this project?"
        ),
        guidance=(
            "If YES, describe the AI/ML tool and its purpose.",
            "Describe training data sources.",
            "Address potential algorithmic biases.",
            "Describe validation approach.",
            "Explain how outputs will be used in clinical decisions.",
            "Note FDA regulatory status if applicable.",
        ),
    ),
]


EMORY_REQUIRED_CATEGORIES = [
    "emory_lay_summary",
    "emory_exemption",
    "emory_children",
    "emory_impaired_adults",
    "emory_neonates",
    "emory_pregnant",
    "emory_prisoners",
    "emory_ai_ml",
    # Plus base categories
    "purpose_significance",
    "methodology",
    "recruitment",
    "risks_benefits",
    "informed_consent",
    "data_monitoring",
    "hipaa_phi",
]


def get_emory_questions() -> List[IRBQuestion]:
    """Get all Emory-specific questions."""
    return list(EMORY_IRB_QUESTIONS)


def get_emory_question_by_category(category: str) -> Optional[IRBQuestion]:
    """Get a specific Emory question by category."""
    for q in EMORY_IRB_QUESTIONS:
        if q.category == category:
            return q
    return None


def validate_emory_submission(answers: Dict[str, str]) -> List[str]:
    """
    Validate that all required Emory fields are present.

    Returns a list of error messages for missing/invalid fields.
    """
    errors = []

    # Check required Emory categories
    for category in EMORY_REQUIRED_CATEGORIES:
        if category not in answers or not answers[category]:
            question = get_emory_question_by_category(category)
            if question:
                errors.append(f"Missing required field: {question.title}")

    # Validate short title length
    short_title = answers.get("emory_short_title", "")
    if short_title and len(short_title) > 50:
        errors.append("Short title must be 50 characters or fewer")

    # Validate lay summary has content
    lay_summary = answers.get("emory_lay_summary", "")
    if lay_summary:
        word_count = len(lay_summary.split())
        if word_count < 50:
            errors.append("Lay summary should be at least 50 words")
        if word_count > 500:
            errors.append("Lay summary should not exceed 500 words")

    return errors


def get_emory_categories() -> List[str]:
    """Get all Emory-specific question categories."""
    return [q.category for q in EMORY_IRB_QUESTIONS]


def emory_questions_by_category() -> Dict[str, IRBQuestion]:
    """Convenience mapping from category key to Emory IRBQuestion."""
    return {q.category: q for q in EMORY_IRB_QUESTIONS}
