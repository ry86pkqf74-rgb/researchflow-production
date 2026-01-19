"""Peer review simulation via chained prompts.

Simulates the peer review process with multiple reviewers
and an editor meta-review.
"""

from __future__ import annotations

import logging
import os
from typing import Any, Dict, List, Optional

from src.security.phi_guard import assert_no_phi, PhiBlocked

logger = logging.getLogger(__name__)


REVIEWER_1_PROMPT = """You are a senior academic peer reviewer for a medical journal.
Review this manuscript from a methodological perspective.

Focus on:
1. Study design appropriateness
2. Statistical methods validity
3. Sample size and power considerations
4. Potential confounders not addressed
5. Data presentation clarity

Provide:
- Summary of strengths
- Major concerns (issues that must be addressed)
- Minor concerns (suggestions for improvement)
- Specific questions for authors

Be constructive but rigorous. Use academic tone."""


REVIEWER_2_PROMPT = """You are a clinical expert peer reviewer for a medical journal.
Review this manuscript from a clinical relevance perspective.

Focus on:
1. Clinical significance of findings
2. Applicability to practice
3. Comparison with existing treatments/approaches
4. Patient safety considerations
5. Generalizability of results

Provide:
- Summary of clinical contribution
- Major concerns (issues affecting clinical validity)
- Minor concerns (suggestions)
- Questions regarding clinical implementation

Be thorough and clinically focused."""


EDITOR_META_PROMPT = """You are the editor synthesizing peer reviews for a medical manuscript.

Given the two reviewer assessments below, provide:
1. Overall recommendation (Accept, Minor Revision, Major Revision, Reject)
2. Key issues that must be addressed
3. Prioritized action items for authors
4. Summary of reviewer consensus and disagreements

Be fair and constructive in your synthesis."""


def run_review_prompt(
    system_prompt: str,
    manuscript_content: str,
    additional_context: str = "",
) -> str:
    """Run a review prompt through the AI provider.

    In production, this would use the AI router with proper model selection.
    """
    try:
        from src.llm.providers.anthropic_provider import AnthropicProvider
        from src.llm.providers.openai_provider import OpenAIProvider
    except ImportError:
        logger.warning("AI providers not available, using stub response")
        return _stub_review_response(system_prompt)

    user_prompt = f"""Please review the following manuscript:

{manuscript_content}

{additional_context}"""

    # Try Anthropic first
    if os.getenv("ANTHROPIC_API_KEY"):
        try:
            provider = AnthropicProvider()
            return provider.complete(system_prompt, user_prompt)
        except Exception as e:
            logger.warning(f"Anthropic failed: {e}")

    # Try OpenAI
    if os.getenv("OPENAI_API_KEY"):
        try:
            provider = OpenAIProvider()
            return provider.complete(system_prompt, user_prompt)
        except Exception as e:
            logger.warning(f"OpenAI failed: {e}")

    return _stub_review_response(system_prompt)


def _stub_review_response(system_prompt: str) -> str:
    """Generate stub review for testing."""
    if "methodological" in system_prompt.lower():
        return """## Reviewer 1 Assessment (Methodological)

### Strengths
- Clear study objectives
- Appropriate statistical methods described
- Adequate sample size calculation

### Major Concerns
1. The primary endpoint definition needs clarification
2. Missing details on randomization procedure
3. Sensitivity analyses should be included

### Minor Concerns
1. Table formatting could be improved
2. Consider adding a CONSORT flow diagram

### Questions for Authors
1. How were missing data handled?
2. What was the protocol for adverse event reporting?

**Recommendation: Major Revision**"""

    elif "clinical" in system_prompt.lower():
        return """## Reviewer 2 Assessment (Clinical)

### Clinical Contribution
This study addresses an important clinical question with practical implications.

### Major Concerns
1. The clinical significance threshold should be justified
2. Long-term follow-up data is needed
3. Subgroup analyses by comorbidity status would strengthen findings

### Minor Concerns
1. Consider discussing cost-effectiveness implications
2. Patient-reported outcomes could add value

### Implementation Questions
1. What is the learning curve for this intervention?
2. Are there contraindications not discussed?

**Recommendation: Minor Revision**"""

    else:
        return """## Editor Synthesis

### Overall Recommendation: Major Revision

### Key Issues to Address
1. Clarify primary endpoint definition (R1)
2. Add long-term follow-up discussion (R2)
3. Include sensitivity analyses (R1)

### Prioritized Action Items
1. [HIGH] Address methodological concerns from Reviewer 1
2. [MEDIUM] Expand clinical implications section
3. [LOW] Improve figure/table formatting

### Reviewer Consensus
- Both reviewers agree on scientific merit
- Disagreement on revision scope (major vs minor)

The manuscript shows promise but requires substantive revision before acceptance."""


def extract_action_items(editor_review: str) -> List[str]:
    """Extract prioritized action items from editor review."""
    action_items = []

    # Look for numbered items or bullet points
    import re

    # Match patterns like "1.", "- ", "•", "[HIGH]", etc.
    patterns = [
        r'\d+\.\s*\[?(?:HIGH|MEDIUM|LOW)?\]?\s*(.+)',
        r'[-•]\s*(.+)',
    ]

    for pattern in patterns:
        matches = re.findall(pattern, editor_review, re.MULTILINE)
        action_items.extend(matches)

    # Clean up and deduplicate
    action_items = [item.strip() for item in action_items if len(item.strip()) > 10]
    return list(dict.fromkeys(action_items))[:10]  # Max 10 items


def simulate_peer_review(
    manuscript_md: str,
    journal_style: Optional[str] = None,
) -> Dict[str, Any]:
    """Simulate peer review with multiple reviewers and editor synthesis.

    Args:
        manuscript_md: Full manuscript content in markdown
        journal_style: Optional journal style identifier

    Returns:
        Dict with reviewer assessments, editor synthesis, and action items

    Raises:
        PhiBlocked: If PHI is detected in manuscript
    """
    # PHI scan manuscript
    try:
        assert_no_phi("peer_review_input", manuscript_md)
    except PhiBlocked as e:
        return {
            "status": "BLOCKED",
            "error": "PHI_BLOCKED",
            "locations": [loc.__dict__ for loc in e.locations],
        }

    additional_context = ""
    if journal_style:
        additional_context = f"Target journal style: {journal_style}"

    # Run Reviewer 1 (Methodological)
    logger.info("Running Reviewer 1 assessment...")
    reviewer1 = run_review_prompt(REVIEWER_1_PROMPT, manuscript_md, additional_context)

    # PHI scan output
    try:
        assert_no_phi("reviewer1_output", reviewer1)
    except PhiBlocked:
        reviewer1 = "[Review blocked due to PHI in output]"

    # Run Reviewer 2 (Clinical)
    logger.info("Running Reviewer 2 assessment...")
    reviewer2 = run_review_prompt(REVIEWER_2_PROMPT, manuscript_md, additional_context)

    try:
        assert_no_phi("reviewer2_output", reviewer2)
    except PhiBlocked:
        reviewer2 = "[Review blocked due to PHI in output]"

    # Run Editor Meta-Review
    logger.info("Running Editor synthesis...")
    combined_reviews = f"""REVIEWER 1 ASSESSMENT:
{reviewer1}

REVIEWER 2 ASSESSMENT:
{reviewer2}"""

    editor = run_review_prompt(EDITOR_META_PROMPT, manuscript_md, combined_reviews)

    try:
        assert_no_phi("editor_output", editor)
    except PhiBlocked:
        editor = "[Editor synthesis blocked due to PHI in output]"

    # Extract action items
    action_items = extract_action_items(editor)

    # Determine overall score (1-5 scale)
    overall_score = 3  # Default to "needs revision"
    if "Accept" in editor and "Minor" not in editor:
        overall_score = 5
    elif "Minor Revision" in editor:
        overall_score = 4
    elif "Major Revision" in editor:
        overall_score = 3
    elif "Reject" in editor:
        overall_score = 1

    return {
        "status": "SUCCEEDED",
        "reviewer1": reviewer1,
        "reviewer2": reviewer2,
        "editor": editor,
        "actionItems": action_items,
        "overallScore": overall_score,
    }


def run_peer_review_job(job_id: str, manuscript_id: str, manuscript_md: str) -> Dict[str, Any]:
    """Run peer review as a job.

    Args:
        job_id: Job identifier
        manuscript_id: Manuscript identifier
        manuscript_md: Manuscript content

    Returns:
        Job result
    """
    result = simulate_peer_review(manuscript_md)

    return {
        "jobId": job_id,
        "manuscriptId": manuscript_id,
        **result,
    }
