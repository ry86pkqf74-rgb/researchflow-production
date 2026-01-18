"""
Standardized IRB question prompts.

These prompts are intentionally written in non-expert language and are meant to
help investigators draft responses for common IRB application sections.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Dict, Sequence


@dataclass(frozen=True)
class IRBQuestion:
    """
    A structured IRB prompt.

    category: Stable key used in code/serialization.
    title: Human-friendly label shown to users.
    prompt: The actual question/prompt.
    guidance: Immutable tuple of guidance bullets to help researchers respond.
    """

    category: str
    title: str
    prompt: str
    guidance: tuple[str, ...]


# Required categories for the IRB module (used by governance + unit tests)
# All 11 categories are required to ensure complete IRB coverage
REQUIRED_IRB_CATEGORIES = {
    "purpose_significance",
    "methodology",
    "recruitment",
    "equitable_selection",
    "research_setting",
    "risks_benefits",
    "informed_consent",
    "data_monitoring",
    "hipaa_phi",
    "devices",
    "conflicts",
}


IRB_QUESTIONS: Sequence[IRBQuestion] = [
    IRBQuestion(
        category="purpose_significance",
        title="Purpose / Significance",
        prompt=(
            "Describe the background and purpose of the study in language accessible to a non-expert. "
            "State the research question(s) and why this work matters."
        ),
        guidance=(
            "Briefly summarize what is known and what gap your study addresses.",
            "State primary and (if applicable) secondary objectives.",
            "Keep jargon minimal; define terms when needed.",
        ),
    ),
    IRBQuestion(
        category="methodology",
        title="Methodology / Procedures",
        prompt=(
            "Describe the research design and procedures. What will participants do or experience? "
            "Include the sequence of activities, duration, and any group assignments."
        ),
        guidance=(
            "Explain study flow step-by-step from participant perspective.",
            "Describe sample size rationale and assignment method (randomization, cohort, etc.).",
            "List any instruments, surveys, tasks, interviews, or measurements.",
        ),
    ),
    IRBQuestion(
        category="recruitment",
        title="Recruitment",
        prompt=(
            "Describe how participants will be identified, approached, and recruited. "
            "Include recruitment sources, timing, location, and materials participants will receive."
        ),
        guidance=(
            "Identify source population and where recruitment occurs (clinic, online, community).",
            "Include copies/description of recruitment scripts, emails, ads, flyers, etc.",
            "Justify recruiting any specific group(s).",
        ),
    ),
    IRBQuestion(
        category="equitable_selection",
        title="Equitable Selection / Vulnerable Populations",
        prompt=(
            "Explain how participant selection is equitable and how coercion/undue influence will be avoided. "
            "If including vulnerable populations, describe additional protections."
        ),
        guidance=(
            "Describe safeguards for dependent relationships (student/teacher, employee/employer, clinician/patient).",
            "If including minors, prisoners, pregnant persons, or other vulnerable groups, describe protections.",
        ),
    ),
    IRBQuestion(
        category="research_setting",
        title="Research Setting / Site Access",
        prompt=(
            "Where will the research take place? If using external sites, describe site permissions/letters of access."
        ),
        guidance=(
            "Specify physical location(s) and/or online platform(s).",
            "Note any collaborating institutions and required approvals.",
        ),
    ),
    IRBQuestion(
        category="risks_benefits",
        title="Risks and Benefits",
        prompt=(
            "Describe potential benefits (to participants and/or society) and all reasonably foreseeable risks "
            "(physical, psychological, social, legal, or privacy-related). Explain why risks are reasonable "
            "relative to anticipated benefits and how risks will be minimized."
        ),
        guidance=(
            "Include privacy/confidentiality risks and mitigation steps.",
            "Describe adverse event procedures or referral resources if applicable.",
        ),
    ),
    IRBQuestion(
        category="informed_consent",
        title="Informed Consent",
        prompt=(
            "Describe how informed consent will be obtained (who, when, where, and how). "
            "Include timing, whether written consent is required, and any waivers/alterations requested."
        ),
        guidance=(
            "Describe how participants will be given adequate time to decide and avoid coercion.",
            "If minors are involved, describe assent and parental permission.",
        ),
    ),
    IRBQuestion(
        category="data_monitoring",
        title="Data Monitoring / Privacy / Confidentiality",
        prompt=(
            "Describe how data will be collected, stored, protected, and eventually destroyed. "
            "Include access controls and retention periods."
        ),
        guidance=(
            "Specify physical and electronic storage locations and access restrictions.",
            "Describe de-identification/coding practices, if any.",
            "State when data will be destroyed and how long records will be retained (e.g., 3+ years).",
        ),
    ),
    IRBQuestion(
        category="hipaa_phi",
        title="HIPAA / PHI",
        prompt=(
            "Will protected health information (PHI) be collected, used, or disclosed? "
            "If yes, describe what PHI, why needed, and HIPAA authorization/waiver plans."
        ),
        guidance=(
            "List specific identifiers if applicable and justify necessity.",
            "Describe minimum necessary use and sharing controls.",
        ),
    ),
    IRBQuestion(
        category="devices",
        title="Devices / Drugs / Medical Equipment",
        prompt=(
            "Describe any devices, drugs, biologics, food, or medical equipment involved in the study, if any. "
            "Include whether any are investigational."
        ),
        guidance=(
            "If none, state explicitly that none are involved.",
        ),
    ),
    IRBQuestion(
        category="conflicts",
        title="Conflicts of Interest / Assurances",
        prompt=(
            "Disclose any conflicts of interest and describe any required assurances or disclosures."
        ),
        guidance=(
            "Note funding sources, investigator financial interests, or related relationships.",
            "If none, state explicitly that no conflicts exist.",
        ),
    ),
]


def questions_by_category(questions: Sequence[IRBQuestion] = IRB_QUESTIONS) -> Dict[str, IRBQuestion]:
    """
    Convenience mapping from category key to IRBQuestion.
    """
    return {q.category: q for q in questions}
