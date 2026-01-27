"""
Lay summary validation and assistance utilities.

Provides validation for lay summaries following institutional guidelines,
including readability analysis and required element checking.
"""

import re
from dataclasses import dataclass, field
from typing import List, Dict, Optional, Tuple
from enum import Enum


class StudyType(str, Enum):
    """Types of studies with different lay summary requirements."""
    CHART_REVIEW = "chart_review"
    SECONDARY_USE = "secondary_use"
    PROSPECTIVE = "prospective"
    INTERVENTIONAL = "interventional"
    OBSERVATIONAL = "observational"


@dataclass
class ValidationResult:
    """Result of lay summary validation."""
    is_valid: bool
    score: float  # 0-100
    missing_elements: List[str]
    present_elements: List[str]
    suggestions: List[str]
    word_count: int
    reading_level: Optional[str]
    jargon_found: List[str] = field(default_factory=list)


# Required elements for different study types
# Each element is (name, list of keywords to detect presence)
REQUIRED_ELEMENTS: Dict[StudyType, List[Tuple[str, List[str]]]] = {
    StudyType.CHART_REVIEW: [
        ("objectives", ["objective", "aim", "goal", "purpose", "determine", "evaluate", "assess"]),
        ("population", ["patient", "participant", "subject", "individual", "record"]),
        ("data_sources", ["chart", "record", "database", "ehr", "medical record"]),
        ("timeframe", ["retrospective", "prospective", "between", "from", "period"]),
    ],
    StudyType.SECONDARY_USE: [
        ("objectives", ["objective", "aim", "goal", "purpose", "analyze", "examine"]),
        ("population", ["patient", "participant", "subject", "sample"]),
        ("data_sources", ["data", "specimen", "sample", "database", "registry"]),
        ("timeframe", ["retrospective", "collected", "existing"]),
    ],
    StudyType.PROSPECTIVE: [
        ("objectives", ["objective", "aim", "goal", "purpose", "determine", "evaluate"]),
        ("population", ["participant", "subject", "patient", "volunteer", "individual"]),
        ("procedures", ["procedure", "visit", "questionnaire", "interview", "test", "measure"]),
        ("duration", ["duration", "week", "month", "visit", "session", "follow-up"]),
        ("recruitment", ["recruit", "enroll", "identify", "invite", "approach"]),
        ("enrollment", ["enroll", "participant", "total", "number", "sample size"]),
        ("consent", ["consent", "agree", "permission", "voluntary"]),
    ],
    StudyType.INTERVENTIONAL: [
        ("objectives", ["objective", "aim", "goal", "purpose", "test", "compare"]),
        ("population", ["participant", "subject", "patient"]),
        ("intervention", ["intervention", "treatment", "therapy", "drug", "device"]),
        ("procedures", ["procedure", "visit", "randomize", "assign"]),
        ("duration", ["duration", "week", "month", "follow-up"]),
        ("recruitment", ["recruit", "enroll", "screen"]),
        ("enrollment", ["enroll", "total", "sample", "arm", "group"]),
        ("consent", ["consent", "agree", "permission"]),
    ],
    StudyType.OBSERVATIONAL: [
        ("objectives", ["objective", "aim", "goal", "purpose", "observe", "describe"]),
        ("population", ["participant", "subject", "patient", "cohort"]),
        ("procedures", ["procedure", "observation", "measurement", "survey"]),
        ("duration", ["duration", "period", "follow-up"]),
        ("recruitment", ["recruit", "identify", "select"]),
        ("consent", ["consent", "agree", "waiver"]),
    ],
}


# Medical jargon to flag (should be replaced with plain language)
MEDICAL_JARGON = [
    "etiology",
    "pathophysiology",
    "comorbidity",
    "comorbidities",
    "sequelae",
    "pharmacokinetics",
    "bioavailability",
    "efficacy",
    "idiopathic",
    "nosocomial",
    "iatrogenic",
    "prognosis",
    "prophylaxis",
    "contraindication",
    "subcutaneous",
    "intravenous",
    "intramuscular",
    "hemorrhage",
    "necrosis",
    "lesion",
    "edema",
    "hypertension",
    "hypotension",
    "tachycardia",
    "bradycardia",
    "dyspnea",
    "syncope",
    "malignancy",
    "benign",
    "metastasis",
]


class LaySummaryValidator:
    """
    Validates lay summaries against institutional requirements.

    Checks for:
    - Required elements based on study type
    - Word count within limits
    - Reading level appropriateness
    - Medical jargon usage
    """

    def __init__(self, study_type: StudyType = StudyType.PROSPECTIVE):
        self.study_type = study_type
        self.required_elements = REQUIRED_ELEMENTS.get(
            study_type, REQUIRED_ELEMENTS[StudyType.PROSPECTIVE]
        )

    def validate(
        self,
        summary_text: str,
        min_words: int = 100,
        max_words: int = 500,
    ) -> ValidationResult:
        """
        Validate a lay summary.

        Args:
            summary_text: The lay summary text to validate
            min_words: Minimum required word count
            max_words: Maximum allowed word count

        Returns:
            ValidationResult with detailed feedback
        """
        text_lower = summary_text.lower()
        words = summary_text.split()
        word_count = len(words)

        # Check required elements
        present = []
        missing = []

        for element_name, keywords in self.required_elements:
            found = any(kw in text_lower for kw in keywords)
            if found:
                present.append(element_name)
            else:
                missing.append(element_name)

        # Calculate element score (70% of total)
        total_elements = len(self.required_elements)
        element_score = (len(present) / total_elements) * 70 if total_elements > 0 else 70

        # Calculate length score (30% of total)
        if min_words <= word_count <= max_words:
            length_score = 30
        elif word_count < min_words:
            length_score = (word_count / min_words) * 30
        else:
            # Penalty for being over max
            over_by = word_count - max_words
            length_score = max(0, 30 - (over_by / 10))

        total_score = element_score + length_score

        # Find jargon
        jargon_found = [term for term in MEDICAL_JARGON if term in text_lower]

        # Generate suggestions
        suggestions = self._generate_suggestions(
            summary_text, missing, word_count, min_words, max_words, jargon_found
        )

        # Estimate reading level
        reading_level = self._estimate_reading_level(summary_text)

        return ValidationResult(
            is_valid=len(missing) == 0 and min_words <= word_count <= max_words,
            score=round(total_score, 1),
            missing_elements=missing,
            present_elements=present,
            suggestions=suggestions,
            word_count=word_count,
            reading_level=reading_level,
            jargon_found=jargon_found,
        )

    def _generate_suggestions(
        self,
        text: str,
        missing: List[str],
        word_count: int,
        min_words: int,
        max_words: int,
        jargon_found: List[str],
    ) -> List[str]:
        """Generate improvement suggestions."""
        suggestions = []

        # Suggest adding missing elements
        for element in missing:
            friendly_name = element.replace("_", " ")
            suggestions.append(f"Add information about: {friendly_name}")

        # Word count suggestions
        if word_count < min_words:
            suggestions.append(
                f"Expand your summary. Current: {word_count} words, minimum: {min_words}"
            )
        elif word_count > max_words:
            suggestions.append(
                f"Shorten your summary. Current: {word_count} words, maximum: {max_words}"
            )

        # Jargon suggestions
        for term in jargon_found[:3]:  # Limit to top 3
            suggestions.append(
                f"Consider replacing '{term}' with simpler language"
            )

        return suggestions

    def _estimate_reading_level(self, text: str) -> str:
        """
        Estimate the reading level of the text.

        Uses a simplified Flesch-Kincaid-like heuristic based on:
        - Average words per sentence
        - Percentage of complex words (>8 characters)
        """
        words = text.split()
        sentences = re.split(r"[.!?]+", text)
        sentences = [s for s in sentences if s.strip()]

        if not sentences or not words:
            return "Unable to assess"

        avg_words_per_sentence = len(words) / len(sentences)
        complex_words = sum(1 for w in words if len(w) > 8)
        complex_ratio = complex_words / len(words) if words else 0

        # Simplified reading level estimation
        if avg_words_per_sentence < 15 and complex_ratio < 0.1:
            return "6th-8th grade (Good)"
        elif avg_words_per_sentence < 20 and complex_ratio < 0.15:
            return "9th-10th grade (Acceptable)"
        elif avg_words_per_sentence < 25 and complex_ratio < 0.2:
            return "11th-12th grade (Consider simplifying)"
        else:
            return "College level (Too complex - please simplify)"


def validate_emory_lay_summary(
    summary_text: str,
    study_type: str = "prospective",
) -> ValidationResult:
    """
    Validate a lay summary against Emory IRB requirements.

    Args:
        summary_text: The lay summary text
        study_type: Type of study (chart_review, secondary_use, prospective, etc.)

    Returns:
        ValidationResult with detailed feedback
    """
    # Convert string to enum
    try:
        st = StudyType(study_type.lower())
    except ValueError:
        st = StudyType.PROSPECTIVE

    validator = LaySummaryValidator(study_type=st)
    return validator.validate(summary_text, min_words=100, max_words=500)


def get_lay_summary_template(study_type: str) -> str:
    """
    Get a template/outline for a lay summary based on study type.

    Returns suggested sections and prompts to help researchers
    write complete lay summaries.
    """
    templates = {
        "chart_review": """
LAY SUMMARY TEMPLATE - Chart Review Study

1. STUDY OBJECTIVES (What are you trying to learn?)
   [Describe what you hope to discover or understand]

2. POPULATION (Whose records will be reviewed?)
   [Describe patient characteristics: age, conditions, time period]

3. DATA SOURCES (Where does the information come from?)
   [List specific databases, EMR systems, or registries]

4. STUDY DESIGN (Is this looking back or forward?)
   [State if retrospective and the time period covered]

5. DATA TO BE COLLECTED (What information will you extract?)
   [List key variables: demographics, diagnoses, treatments, outcomes]
""",
        "prospective": """
LAY SUMMARY TEMPLATE - Prospective Study

1. STUDY OBJECTIVES (What are you trying to learn?)
   [Describe the main research question in plain language]

2. POPULATION (Who can participate?)
   [Describe eligibility: age range, conditions, exclusions]

3. PROCEDURES (What will participants do?)
   [Describe visits, tests, surveys, interventions step by step]

4. DURATION (How long will participation last?)
   [State total time and number of visits]

5. RECRUITMENT (How will participants be found?)
   [Describe where and how you will recruit]

6. ENROLLMENT (How many participants?)
   [State target enrollment including screen failures]

7. CONSENT (How will permission be obtained?)
   [Describe the consent process]

8. FUTURE USE (Will samples/data be stored?)
   [State if specimens or data will be banked]
""",
    }

    return templates.get(study_type.lower(), templates["prospective"])
