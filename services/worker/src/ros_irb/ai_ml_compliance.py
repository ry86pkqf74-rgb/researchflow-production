"""
AI/ML usage compliance for IRB submissions.

Provides structured disclosure requirements for studies that develop,
evaluate, or use artificial intelligence and machine learning tools.
"""

from dataclasses import dataclass, field
from typing import List, Dict, Optional
from enum import Enum


class AIMLCategory(str, Enum):
    """Categories of AI/ML usage in research."""
    DEVELOPMENT = "development"  # Building new AI/ML models
    EVALUATION = "evaluation"    # Testing/validating AI/ML performance
    ANALYSIS = "analysis"        # Using AI/ML for data analysis
    CLINICAL_SUPPORT = "clinical_support"  # AI/ML in clinical decision support


class FDAStatus(str, Enum):
    """FDA regulatory status for AI/ML tools."""
    APPROVED_510K = "510k"         # 510(k) cleared
    APPROVED_PMA = "pma"           # PMA approved
    BREAKTHROUGH = "breakthrough"  # Breakthrough device designation
    EXEMPT = "exempt"              # Exempt from regulation
    NOT_REGULATED = "not_regulated"  # Not FDA regulated
    PENDING = "pending"            # Regulatory status pending
    UNKNOWN = "unknown"            # Status unknown


@dataclass
class AIMLQuestion:
    """A question for AI/ML disclosure."""
    id: str
    prompt: str
    guidance: str
    required: bool = True
    applicable_categories: List[AIMLCategory] = field(
        default_factory=lambda: list(AIMLCategory)
    )


# Comprehensive AI/ML disclosure questions
AI_ML_QUESTIONS: List[AIMLQuestion] = [
    AIMLQuestion(
        id="ai_ml_category",
        prompt="What category of AI/ML use applies to this research?",
        guidance=(
            "Select all that apply:\n"
            "- Development: Building new AI/ML models\n"
            "- Evaluation: Testing/validating AI/ML performance\n"
            "- Analysis: Using AI/ML for data analysis\n"
            "- Clinical Support: AI/ML in clinical decision support"
        ),
        required=True,
    ),
    AIMLQuestion(
        id="ai_ml_description",
        prompt="Describe the AI/ML tool(s) used in this research.",
        guidance=(
            "Include:\n"
            "- Name of tool/algorithm (if applicable)\n"
            "- Type of AI/ML (machine learning, deep learning, NLP, etc.)\n"
            "- Purpose/function of the tool\n"
            "- Commercial vs. custom-developed"
        ),
        required=True,
    ),
    AIMLQuestion(
        id="ai_ml_training_data",
        prompt="Describe the training data used for AI/ML development.",
        guidance=(
            "Include:\n"
            "- Source of training data\n"
            "- Size of training dataset\n"
            "- Demographics of training population\n"
            "- Time period of data collection\n"
            "- Any data cleaning or preprocessing"
        ),
        required=True,
        applicable_categories=[AIMLCategory.DEVELOPMENT],
    ),
    AIMLQuestion(
        id="ai_ml_bias",
        prompt="What potential biases exist and how will they be mitigated?",
        guidance=(
            "Consider:\n"
            "- Selection bias in training data\n"
            "- Demographic gaps or underrepresentation\n"
            "- Historical bias in labeled data\n"
            "- Algorithmic fairness across subgroups\n"
            "- Mitigation strategies implemented"
        ),
        required=True,
    ),
    AIMLQuestion(
        id="ai_ml_validation",
        prompt="Describe the validation approach for AI/ML performance.",
        guidance=(
            "Include:\n"
            "- Performance metrics (accuracy, sensitivity, specificity, AUC, etc.)\n"
            "- Validation dataset characteristics\n"
            "- External validation plans\n"
            "- Ongoing monitoring approach"
        ),
        required=True,
        applicable_categories=[AIMLCategory.DEVELOPMENT, AIMLCategory.EVALUATION],
    ),
    AIMLQuestion(
        id="ai_ml_clinical_use",
        prompt="How will AI/ML outputs be used in clinical decisions?",
        guidance=(
            "Include:\n"
            "- Role of AI/ML in clinical workflow\n"
            "- Level of human oversight required\n"
            "- How results will be communicated to providers/patients\n"
            "- Documentation of AI/ML involvement in care\n"
            "- Override procedures when clinician disagrees"
        ),
        required=True,
        applicable_categories=[AIMLCategory.CLINICAL_SUPPORT],
    ),
    AIMLQuestion(
        id="ai_ml_fda_status",
        prompt="What is the FDA regulatory status of the AI/ML tool?",
        guidance=(
            "Select status:\n"
            "- 510(k) cleared\n"
            "- PMA approved\n"
            "- Breakthrough device designation\n"
            "- Exempt from regulation\n"
            "- Not FDA regulated\n"
            "- Pending determination\n"
            "Provide clearance numbers if applicable"
        ),
        required=True,
        applicable_categories=[AIMLCategory.CLINICAL_SUPPORT, AIMLCategory.EVALUATION],
    ),
    AIMLQuestion(
        id="ai_ml_explainability",
        prompt="How will AI/ML decisions be explained to users and patients?",
        guidance=(
            "Address:\n"
            "- Interpretability of the model\n"
            "- Explanation methods (feature importance, etc.)\n"
            "- What information will be shared with patients\n"
            "- Documentation of AI/ML rationale"
        ),
        required=False,
    ),
    AIMLQuestion(
        id="ai_ml_failure_modes",
        prompt="What are known failure modes and how will they be handled?",
        guidance=(
            "Consider:\n"
            "- Scenarios where AI/ML may fail\n"
            "- Impact of failures on patient safety\n"
            "- Fallback procedures\n"
            "- Error reporting and correction"
        ),
        required=False,
        applicable_categories=[AIMLCategory.CLINICAL_SUPPORT],
    ),
]


def get_ai_ml_questions(
    categories: Optional[List[AIMLCategory]] = None,
) -> List[AIMLQuestion]:
    """
    Get AI/ML disclosure questions.

    Args:
        categories: Optional filter for specific AI/ML categories.
                   If None, returns all questions.

    Returns:
        List of applicable AIMLQuestion objects
    """
    if categories is None:
        return AI_ML_QUESTIONS.copy()

    # Filter to questions applicable to specified categories
    return [
        q for q in AI_ML_QUESTIONS
        if any(cat in q.applicable_categories for cat in categories)
    ]


def get_required_questions(
    categories: Optional[List[AIMLCategory]] = None,
) -> List[AIMLQuestion]:
    """Get only required AI/ML questions for given categories."""
    questions = get_ai_ml_questions(categories)
    return [q for q in questions if q.required]


def validate_ai_ml_responses(
    responses: Dict[str, str],
    categories: List[AIMLCategory],
) -> List[str]:
    """
    Validate AI/ML disclosure responses.

    Args:
        responses: Dictionary of question ID to response
        categories: AI/ML categories applicable to the study

    Returns:
        List of error messages for missing/invalid responses
    """
    errors = []
    required_questions = get_required_questions(categories)

    for q in required_questions:
        if q.id not in responses or not responses[q.id].strip():
            errors.append(f"Missing required AI/ML disclosure: {q.prompt}")

    # Additional validation rules
    if responses.get("ai_ml_clinical_use") and not responses.get("ai_ml_fda_status"):
        errors.append(
            "FDA regulatory status required when AI/ML is used for clinical support"
        )

    if responses.get("ai_ml_training_data"):
        # Check for demographic information
        training_desc = responses["ai_ml_training_data"].lower()
        demographic_keywords = ["demographic", "age", "sex", "gender", "race", "ethnicity"]
        if not any(kw in training_desc for kw in demographic_keywords):
            errors.append(
                "Training data description should include demographic characteristics"
            )

    return errors


def get_ai_ml_guidance() -> str:
    """Get general guidance for AI/ML disclosure in IRB submissions."""
    return """
AI/ML DISCLOSURE GUIDANCE FOR IRB SUBMISSIONS

1. WHY DISCLOSURE IS IMPORTANT
   AI/ML tools can introduce unique risks including algorithmic bias,
   lack of transparency, and potential for harm if predictions are incorrect.
   IRBs need to understand how AI/ML is being used to assess risks.

2. KEY AREAS TO ADDRESS
   - Tool Description: What AI/ML is being used and for what purpose
   - Training Data: How the model was trained and on what data
   - Bias Assessment: Potential for algorithmic bias and mitigation
   - Validation: How performance has been or will be validated
   - Clinical Integration: How AI/ML outputs affect patient care
   - Regulatory Status: FDA clearance/approval if applicable

3. BEST PRACTICES
   - Be specific about the type of AI/ML (not just "AI")
   - Describe human oversight and ability to override
   - Explain how results will be communicated
   - Document failure modes and fallback procedures
   - Consider equity implications across populations

4. REGULATORY CONSIDERATIONS
   - Clinical decision support may require FDA clearance
   - Document compliance with applicable regulations
   - Consider institutional policies on AI/ML use
"""


def get_fda_status_guidance(status: FDAStatus) -> str:
    """Get guidance specific to FDA regulatory status."""
    guidance = {
        FDAStatus.APPROVED_510K: (
            "The device has FDA 510(k) clearance. Document the clearance number "
            "and ensure use is within cleared indications."
        ),
        FDAStatus.APPROVED_PMA: (
            "The device has FDA PMA approval. Document the approval number "
            "and conditions of approval."
        ),
        FDAStatus.BREAKTHROUGH: (
            "The device has breakthrough designation. Note that this is not "
            "the same as FDA clearance/approval."
        ),
        FDAStatus.EXEMPT: (
            "Document the basis for exemption from FDA regulation. "
            "Common bases include clinical decision support exemptions."
        ),
        FDAStatus.NOT_REGULATED: (
            "Explain why the tool is not FDA regulated. "
            "Consider whether it meets the definition of a medical device."
        ),
        FDAStatus.PENDING: (
            "Document the regulatory pathway being pursued and "
            "expected timeline for determination."
        ),
        FDAStatus.UNKNOWN: (
            "Regulatory status should be determined before clinical use. "
            "Consider consulting with regulatory affairs."
        ),
    }
    return guidance.get(status, "No specific guidance available.")
